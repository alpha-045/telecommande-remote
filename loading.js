// LoadFindTV.js
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Vibration,
  StatusBar,
  Dimensions,
  Easing,
  FlatList,
  TextInput,
  NativeModules,
} from 'react-native';
import { useTVConnection } from './context/TVConnectionContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Colors ───
const C = {
  bg: '#0a0a0f',
  card: '#14141f',
  cardLight: '#1c1c2e',
  border: '#2a2a40',
  fg: '#e8e8f0',
  muted: '#6a6a8a',
  accent: '#00e5a0',
  accentGlow: 'rgba(0,229,160,0.25)',
  danger: '#ff4060',
  warning: '#ffb020',
  blue: '#3b7dff',
};

export default function LoadFindTV({ navigation }) {
  const {
    connectionState,
    errorMessage,
    scanForTvs,
    stopScan,
    connectToTv,
    submitPin,
    activeTv,
  } = useTVConnection();

  const isExpoGo = !NativeModules.RNZeroconf || !NativeModules.TcpSockets;

  const [phase, setPhase] = useState('loading'); // loading | scanning | found | connecting
  const [percent, setPercent] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [foundTVs, setFoundTVs] = useState([]);
  const [selectedTV, setSelectedTV] = useState(null);
  const [connectPercent, setConnectPercent] = useState(0);
  const [pinCode, setPinCode] = useState('');

  const progress = useRef(new Animated.Value(0)).current;
  const scanRotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const tvScale = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const scanWave1 = useRef(new Animated.Value(0)).current;
  const scanWave2 = useRef(new Animated.Value(0)).current;
  const scanWave3 = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const connectProgress = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  // ── Phase 1: Initial Loading ──
  useEffect(() => {
    Animated.spring(tvScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(scanRotate, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(textOpacity, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();

    const listener = progress.addListener(({ value }) => {
      setPercent(Math.round(value));
      if (value < 50) setStatusText('Initializing scanner...');
      else if (value < 90) setStatusText('Preparing network...');
      else setStatusText('Ready to scan');
    });

    Animated.sequence([
      Animated.timing(progress, { toValue: 50, duration: 400, useNativeDriver: false }),
      Animated.timing(progress, { toValue: 100, duration: 400, useNativeDriver: false }),
    ]).start(() => {
      setTimeout(() => setPhase('scanning'), 300);
    });

    return () => progress.removeListener(listener);
  }, []);

  // ── Phase 2: Real mDNS Scanning ──
  useEffect(() => {
    if (phase !== 'scanning') return;

    const makeWaveAnim = (wave, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(wave, { toValue: 1, duration: 1800, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    };
    const w1 = makeWaveAnim(scanWave1, 0);
    const w2 = makeWaveAnim(scanWave2, 600);
    const w3 = makeWaveAnim(scanWave3, 1200);
    w1.start(); w2.start(); w3.start();

    setStatusText('Scanning for Xiaomi / Android TVs...');

    const discoveredList = [];

    scanForTvs((tvDevice) => {
      if (!discoveredList.some((item) => item.id === tvDevice.id)) {
        discoveredList.push(tvDevice);
        setFoundTVs([...discoveredList]);
        Vibration?.vibrate(20);
        setStatusText(`Found ${discoveredList.length} device${discoveredList.length > 1 ? 's' : ''}...`);
      }
    });

    // Auto-transition to list view after 4 seconds of scanning
    const scanTimer = setTimeout(() => {
      stopScan();
      setPhase('found');
      Animated.timing(listOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 4500);

    return () => {
      w1.stop(); w2.stop(); w3.stop();
      clearTimeout(scanTimer);
      stopScan();
    };
  }, [phase]);

  // ── Connection state transitions ──
  useEffect(() => {
    if (phase !== 'connecting' || !selectedTV) return;

    if (connectionState === 'pairing') {
      setStatusText(`Pairing with ${selectedTV.name}...`);
      Animated.timing(connectProgress, { toValue: 40, duration: 500, useNativeDriver: false }).start();
    } else if (connectionState === 'awaiting_pin') {
      setStatusText('Enter 6-character code from TV');
      Animated.timing(connectProgress, { toValue: 50, duration: 300, useNativeDriver: false }).start();
    } else if (connectionState === 'connecting') {
      setStatusText('Syncing remote session...');
      Animated.timing(connectProgress, { toValue: 80, duration: 600, useNativeDriver: false }).start();
    } else if (connectionState === 'connected') {
      setStatusText('Connected!');
      Animated.timing(connectProgress, { toValue: 100, duration: 300, useNativeDriver: false }).start(() => {
        Animated.spring(checkScale, { toValue: 1, friction: 3, useNativeDriver: true }).start();
        Vibration?.vibrate([0, 30, 50, 30]);

        setTimeout(() => {
          navigation.navigate('INTER', { tv: selectedTV });
        }, 800);
      });
    } else if (connectionState === 'error') {
      setStatusText(errorMessage || 'Connection failed');
    }

    const listener = connectProgress.addListener(({ value }) => {
      setConnectPercent(Math.round(value));
    });

    return () => connectProgress.removeListener(listener);
  }, [connectionState, phase, selectedTV]);

  // ── Handle TV tap ──
  const handleTVPress = (tv) => {
    Vibration?.vibrate(25);
    setSelectedTV(tv);
    setPhase('connecting');
    setPinCode('');
    connectToTv(tv);
  };

  const handlePinSubmit = () => {
    if (!pinCode.trim()) return;
    Vibration?.vibrate(20);
    submitPin(pinCode.trim());
  };

  const handleRetry = () => {
    if (selectedTV) {
      connectToTv(selectedTV);
    } else {
      setPhase('scanning');
    }
  };

  const scanAngle = scanRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.blob1} />
      <View style={s.blob2} />

      {/* ── LOADING PHASE ── */}
      {phase === 'loading' && (
        <View style={s.centerWrap}>
          <Animated.View style={[s.tvWrap, { transform: [{ scale: tvScale }] }]}>
            <Animated.View style={[s.scanRing, { transform: [{ rotate: scanAngle }] }]}>
              <View style={s.scanDot} />
            </Animated.View>
            <Animated.View style={[s.pulseCircle, { opacity: pulse }]} />
            <View style={s.tvIconBody}>
              <View style={s.tvScreen}>
                <Animated.View style={[s.tvGlow, { opacity: pulse }]} />
              </View>
              <View style={s.tvStand} />
              <View style={s.tvBase} />
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: textOpacity }}>
            <Text style={s.statusText}>{statusText}</Text>
          </Animated.View>

          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={s.percentText}>{percent}%</Text>
        </View>
      )}

      {/* ── SCANNING PHASE ── */}
      {phase === 'scanning' && (
        <View style={s.centerWrap}>
          <View style={s.radarWrap}>
            <View style={s.radarCircle1} />
            <View style={s.radarCircle2} />
            <View style={s.radarCircle3} />
            <Animated.View style={[s.radarLine, { transform: [{ rotate: scanAngle }] }]} />

            {[scanWave1, scanWave2, scanWave3].map((wave, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  borderWidth: 1.5,
                  borderColor: C.accent,
                  opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  transform: [{
                    scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }),
                  }],
                }}
              />
            ))}

            <Animated.View style={[s.radarCenterDot, { opacity: pulse }]} />
          </View>

          <Text style={s.statusText}>{statusText}</Text>

          {foundTVs.length > 0 && (
            <View style={s.foundPreview}>
              {foundTVs.map((tv) => (
                <View key={tv.id} style={s.foundDot}>
                  <Text style={s.foundDotIcon}>{tv.icon || '📺'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── FOUND DEVICES PHASE ── */}
      {phase === 'found' && (
        <Animated.View style={[s.foundWrap, { opacity: listOpacity }]}>
          <Text style={s.foundTitle}>Available Devices</Text>
          <Text style={s.foundSubtitle}>
            {foundTVs.length > 0
              ? `${foundTVs.length} TV${foundTVs.length > 1 ? 's' : ''} found nearby`
              : 'No Xiaomi / Android TVs found on local Wi-Fi'}
          </Text>

          {isExpoGo && (
            <View style={s.expoWarningBox}>
              <Text style={s.expoWarningTitle}>⚠️ Running in Expo Go</Text>
              <Text style={s.expoWarningText}>
                Expo Go lacks native mDNS discovery & TLS sockets. To discover and pair real Xiaomi / Android TVs on your Wi-Fi, run a Development Build using:
              </Text>
              <Text style={s.expoCommandText}>npx expo run:android</Text>
            </View>
          )}

          {foundTVs.length > 0 ? (
            <FlatList
              data={foundTVs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.tvList}
              renderItem={({ item, index }) => <TVCard tv={item} index={index} onPress={handleTVPress} />}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <TouchableOpacity style={s.rescanBtn} onPress={() => setPhase('scanning')}>
                <Text style={s.rescanBtnText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={{ marginTop: 20, alignSelf: 'center' }}
            onPress={() => {
              const manualDevice = {
                id: '192.168.1.100:6467',
                name: 'Xiaomi TV (Manual IP)',
                model: 'Mi TV / Android TV',
                room: 'Wi-Fi Network',
                icon: '📺',
                signal: 100,
                host: '192.168.1.100',
                port: 6467,
                protocolVersion: 2,
              };
              setSelectedTV(manualDevice);
              setPhase('connecting');
              connectToTv(manualDevice);
            }}
          >
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700' }}>
              + Connect by IP Address
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── CONNECTING / PAIRING PHASE ── */}
      {phase === 'connecting' && selectedTV && (
        <View style={s.centerWrap}>
          <View style={s.connectTvIcon}>
            <Text style={s.connectTvEmoji}>{selectedTV.icon || '📺'}</Text>
          </View>

          <Text style={s.connectName}>{selectedTV.name}</Text>
          <Text style={s.connectRoom}>{selectedTV.room || selectedTV.host}</Text>

          {/* PIN Entry Prompt */}
          {connectionState === 'awaiting_pin' ? (
            <View style={s.pinContainer}>
              <Text style={s.pinTitle}>Enter Code Shown on TV</Text>
              <TextInput
                style={s.pinInput}
                value={pinCode}
                onChangeText={setPinCode}
                placeholder="6-Digit PIN"
                placeholderTextColor={C.muted}
                maxLength={6}
                autoCapitalize="characters"
                keyboardType="default"
              />
              <TouchableOpacity style={s.pinSubmitBtn} onPress={handlePinSubmit}>
                <Text style={s.pinSubmitText}>Pair TV</Text>
              </TouchableOpacity>
            </View>
          ) : connectionState === 'error' ? (
            <View style={s.errorContainer}>
              <Text style={s.errorText}>{errorMessage || 'Failed to connect'}</Text>
              <TouchableOpacity style={s.rescanBtn} onPress={handleRetry}>
                <Text style={s.rescanBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={s.connectTrack}>
                <Animated.View style={[s.connectFill, { width: `${connectPercent}%` }]} />
              </View>
              <Text style={s.connectPercent}>{connectPercent}%</Text>
              <Text style={s.connectStatus}>{statusText}</Text>

              {/* Dots animation */}
              <View style={s.dotsRow}>
                {[0, 1, 2].map((i) => (
                  <AnimatedDot key={i} delay={i * 300} />
                ))}
              </View>

              {connectPercent === 100 && (
                <Animated.View style={[s.checkWrap, { transform: [{ scale: checkScale }] }]}>
                  <View style={s.checkCircle}>
                    <Text style={s.checkIcon}>✓</Text>
                  </View>
                </Animated.View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function TVCard({ tv, index, onPress }) {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(30)).current;
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, delay: index * 120, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, delay: index * 120, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const signalColor = (tv.signal || 90) > 80 ? C.accent : (tv.signal || 90) > 60 ? C.warning : C.danger;

  return (
    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => onPress(tv)}
        style={[s.tvCard, pressed && s.tvCardPressed]}
      >
        <View style={s.tvCardLeft}>
          <View style={s.tvCardIconWrap}>
            <Text style={s.tvCardIcon}>{tv.icon || '📺'}</Text>
          </View>
          <View style={s.tvCardInfo}>
            <Text style={s.tvCardName}>{tv.name}</Text>
            <Text style={s.tvCardModel}>{tv.model || tv.host}</Text>
          </View>
        </View>

        <View style={s.tvCardRight}>
          <Text style={s.tvCardRoom}>{tv.room}</Text>
          <View style={s.signalRow}>
            <View style={s.signalTrack}>
              <View style={[s.signalFill, { width: `${tv.signal || 90}%`, backgroundColor: signalColor }]} />
            </View>
            <Text style={[s.signalVal, { color: signalColor }]}>{tv.signal || 90}%</Text>
          </View>
        </View>

        <Text style={s.tvCardArrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AnimatedDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[s.dot, { opacity }]} />;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  blob1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: C.accent,
    opacity: 0.06,
    top: -60,
    left: -80,
  },
  blob2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#5040ff',
    opacity: 0.07,
    bottom: -40,
    right: -60,
  },

  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  tvWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  scanRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: C.accent,
    borderTopColor: 'transparent',
  },
  scanDot: {
    position: 'absolute',
    top: -4,
    left: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
    marginLeft: -4,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  pulseCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.accentGlow,
  },

  tvIconBody: {
    alignItems: 'center',
  },
  tvScreen: {
    width: 60,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1a1a30',
    borderWidth: 2,
    borderColor: C.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tvGlow: {
    width: 30,
    height: 20,
    borderRadius: 4,
    backgroundColor: C.accent,
    opacity: 0.3,
  },
  tvStand: {
    width: 6,
    height: 8,
    backgroundColor: C.border,
  },
  tvBase: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.border,
  },

  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 20,
  },

  progressTrack: {
    width: SW * 0.6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  percentText: {
    fontSize: 12,
    color: C.accent,
    fontWeight: '700',
    fontFamily: 'monospace',
  },

  radarWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  radarCircle1: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.1)',
  },
  radarCircle2: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.07)',
  },
  radarCircle3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.04)',
  },
  radarLine: {
    position: 'absolute',
    width: 2,
    height: 80,
    backgroundColor: C.accent,
    opacity: 0.5,
    borderRadius: 1,
    bottom: '50%',
  },
  radarCenterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },

  foundPreview: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  foundDot: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.cardLight,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundDotIcon: {
    fontSize: 20,
  },

  foundWrap: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 60,
    flex: 1,
  },
  foundTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: C.fg,
    letterSpacing: 1,
  },
  foundSubtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: 4,
    marginBottom: 24,
    letterSpacing: 1,
  },
  tvList: {
    gap: 12,
    paddingBottom: 40,
  },

  tvCard: {
    backgroundColor: C.cardLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tvCardPressed: {
    borderColor: C.accent,
    backgroundColor: 'rgba(0,229,160,0.05)',
    transform: [{ scale: 0.98 }],
  },
  tvCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tvCardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvCardIcon: {
    fontSize: 22,
  },
  tvCardInfo: {
    flex: 1,
  },
  tvCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.fg,
    marginBottom: 2,
  },
  tvCardModel: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.5,
  },
  tvCardRight: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  tvCardRoom: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalTrack: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  signalFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  signalVal: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  tvCardArrow: {
    fontSize: 22,
    color: C.muted,
    fontWeight: '300',
    marginLeft: 4,
  },

  connectTvIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.cardLight,
    borderWidth: 1.5,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  connectTvEmoji: {
    fontSize: 36,
  },
  connectName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.fg,
    marginBottom: 4,
  },
  connectRoom: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 28,
    letterSpacing: 1,
  },
  connectTrack: {
    width: SW * 0.55,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  connectFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  connectPercent: {
    fontSize: 13,
    color: C.accent,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  connectStatus: {
    fontSize: 13,
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 20,
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
  },

  checkWrap: {
    position: 'absolute',
    bottom: -10,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  checkIcon: {
    fontSize: 28,
    fontWeight: '900',
    color: C.bg,
  },

  // PIN Entry Styles
  pinContainer: {
    alignItems: 'center',
    width: '80%',
    marginVertical: 15,
  },
  pinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.fg,
    marginBottom: 12,
    letterSpacing: 1,
  },
  pinInput: {
    width: '100%',
    height: 50,
    backgroundColor: C.cardLight,
    borderColor: C.accent,
    borderWidth: 1.5,
    borderRadius: 12,
    color: C.accent,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  pinSubmitBtn: {
    width: '100%',
    height: 46,
    backgroundColor: C.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSubmitText: {
    color: C.bg,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },

  // Error / Rescan
  errorContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  errorText: {
    color: C.danger,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  rescanBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.cardLight,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  rescanBtnText: {
    color: C.fg,
    fontWeight: '700',
    fontSize: 13,
  },

  // Expo Go Warning Box
  expoWarningBox: {
    backgroundColor: '#1f1b2e',
    borderColor: C.warning,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  expoWarningTitle: {
    color: C.warning,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  expoWarningText: {
    color: C.fg,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  expoCommandText: {
    color: C.accent,
    backgroundColor: C.bg,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
});