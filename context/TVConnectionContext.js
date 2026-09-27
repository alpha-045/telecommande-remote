import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tvDiscovery from '../services/tvDiscovery';
import { pairWithTv } from '../services/androidTvPairing';
import androidTvRemote from '../services/androidTvRemote';
import { AndroidKeycodes } from '../constants/androidKeycodes';

const PAIRED_TVS_STORAGE_KEY = 'paired_android_tvs_list';

const TVConnectionContext = createContext();

export function TVConnectionProvider({ children }) {
  const [pairedTvs, setPairedTvs] = useState([]);
  const [activeTv, setActiveTv] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // idle | scanning | pairing | awaiting_pin | connecting | connected | reconnecting | error
  const [errorMessage, setErrorMessage] = useState(null);

  // Real TV state synchronized from remote
  const [volume, setVolume] = useState(25);
  const [powered, setPowered] = useState(true);

  // Callback ref for active PIN submission
  const pinCallbackRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  // 1. Load paired TVs from AsyncStorage on launch
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PAIRED_TVS_STORAGE_KEY);
        if (stored) {
          setPairedTvs(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('[TVConnectionContext] Failed to load paired TVs:', err);
      }
    })();
  }, []);

  // Save paired TVs whenever modified
  const savePairedTvs = async (tvs) => {
    setPairedTvs(tvs);
    try {
      await AsyncStorage.setItem(PAIRED_TVS_STORAGE_KEY, JSON.stringify(tvs));
    } catch (err) {
      console.warn('[TVConnectionContext] Failed to save paired TVs:', err);
    }
  };

  // 2. Subscribe to remote control events
  useEffect(() => {
    const unsubVol = androidTvRemote.on('volume', (volData) => {
      if (typeof volData?.level === 'number') {
        setVolume(volData.level);
      }
    });

    const unsubPower = androidTvRemote.on('powered', (isPowered) => {
      setPowered(Boolean(isPowered));
    });

    const unsubDisconnect = androidTvRemote.on('disconnected', () => {
      if (connectionState === 'connected') {
        attemptReconnect();
      }
    });

    const unsubError = androidTvRemote.on('error', (err) => {
      console.warn('[TVConnectionContext] Remote error:', err);
      if (connectionState === 'connected') {
        attemptReconnect();
      }
    });

    return () => {
      unsubVol();
      unsubPower();
      unsubDisconnect();
      unsubError();
    };
  }, [activeTv, connectionState]);

  // 3. Handle AppState background/foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (androidTvRemote.connected) {
          androidTvRemote.disconnect();
        }
      } else if (nextAppState === 'active') {
        if (activeTv && connectionState !== 'connected') {
          connectToTv(activeTv);
        }
      }
    });
    return () => subscription.remove();
  }, [activeTv, connectionState]);

  // 4. Discovery Scan
  const scanForTvs = (onFound, onError) => {
    setConnectionState('scanning');
    setErrorMessage(null);

    tvDiscovery.startScan(
      (tv) => {
        if (onFound) onFound(tv);
      },
      (err) => {
        setErrorMessage(err.message || 'Scan error');
        if (onError) onError(err);
      }
    );
  };

  const stopScan = () => {
    tvDiscovery.stopScan();
  };

  // 5. Connect to TV (Pair if new, or Connect if already paired)
  const connectToTv = async (tv) => {
    tvDiscovery.stopScan();
    setActiveTv(tv);
    setErrorMessage(null);

    const tvHost = tv.host || tv.ip || tv.id?.split(':')[0];
    const tvId = tv.id || `${tvHost}:${tv.port || 6467}`;

    const isAlreadyPaired = pairedTvs.some((p) => p.id === tvId || p.host === tvHost);

    if (isAlreadyPaired) {
      // Connect directly using stored certificate
      return performDirectControlConnect(tv);
    } else {
      // Initiate pairing first
      return performPairingFlow(tv, tvHost);
    }
  };

  const performPairingFlow = async (tv, tvHost) => {
    setConnectionState('pairing');

    try {
      const pairResult = await pairWithTv(tvHost, tv.port || 6467, (submitPinCallback) => {
        setConnectionState('awaiting_pin');
        pinCallbackRef.current = submitPinCallback;
      });

      // Pairing succeeded! Store TV in pairedTvs
      const newPairedTv = {
        id: pairResult.tvId,
        name: tv.name || 'Xiaomi TV',
        model: tv.model || 'Android TV',
        host: tvHost,
        port: tv.port || 6467,
        remotePort: 6466,
      };

      const updatedList = [...pairedTvs.filter((p) => p.id !== newPairedTv.id), newPairedTv];
      await savePairedTvs(updatedList);

      // Proceed to connect to control socket
      return performDirectControlConnect(newPairedTv);
    } catch (err) {
      console.warn('[TVConnectionContext] Pairing failed:', err);
      setConnectionState('error');
      setErrorMessage(err.message || 'Pairing failed');
      throw err;
    }
  };

  const submitPin = (pinCode) => {
    if (pinCallbackRef.current) {
      setConnectionState('pairing');
      pinCallbackRef.current(pinCode);
      pinCallbackRef.current = null;
    }
  };

  const performDirectControlConnect = async (tv) => {
    setConnectionState('connecting');
    reconnectAttemptsRef.current = 0;

    try {
      await androidTvRemote.connect(tv);
      setConnectionState('connected');
      setErrorMessage(null);
    } catch (err) {
      console.warn('[TVConnectionContext] Connection to control socket failed:', err);
      attemptReconnect(tv);
    }
  };

  const attemptReconnect = (targetTv = activeTv) => {
    if (!targetTv) {
      setConnectionState('error');
      setErrorMessage('No active TV to reconnect');
      return;
    }

    if (reconnectAttemptsRef.current >= 3) {
      setConnectionState('error');
      setErrorMessage('Connection lost. Please tap to try reconnecting.');
      return;
    }

    setConnectionState('reconnecting');
    reconnectAttemptsRef.current += 1;

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      try {
        await androidTvRemote.connect(targetTv);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
      } catch (e) {
        attemptReconnect(targetTv);
      }
    }, 2000 * reconnectAttemptsRef.current);
  };

  const forgetTv = async (tvId) => {
    const updated = pairedTvs.filter((t) => t.id !== tvId);
    await savePairedTvs(updated);
    if (activeTv?.id === tvId) {
      androidTvRemote.disconnect();
      setActiveTv(null);
      setConnectionState('idle');
    }
  };

  // 6. Send Remote Commands
  const sendCommand = (keycode, direction = 'SHORT') => {
    if (connectionState !== 'connected') {
      console.warn('[TVConnectionContext] Cannot send command: TV not connected');
      return false;
    }
    return androidTvRemote.sendKey(keycode, direction);
  };

  return (
    <TVConnectionContext.Provider
      value={{
        pairedTvs,
        activeTv,
        connectionState,
        errorMessage,
        volume,
        powered,
        scanForTvs,
        stopScan,
        connectToTv,
        submitPin,
        forgetTv,
        sendCommand,
        setVolume,
        setPowered,
      }}
    >
      {children}
    </TVConnectionContext.Provider>
  );
}

export function useTVConnection() {
  const ctx = useContext(TVConnectionContext);
  if (!ctx) {
    throw new Error('useTVConnection must be used within a TVConnectionProvider');
  }
  return ctx;
}

export default TVConnectionContext;
