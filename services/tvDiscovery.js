import Zeroconf from 'react-native-zeroconf';
import { NativeModules } from 'react-native';

let zeroconfInstance = null;
let discoveredMap = new Map();

export function isZeroconfSupported() {
  return Boolean(NativeModules.RNZeroconf);
}

export function startScan(onFound, onError) {
  stopScan();
  discoveredMap.clear();

  if (!NativeModules.RNZeroconf) {
    const err = new Error(
      'Native mDNS module is missing in Expo Go. Please run a Development Build using "npx expo run:android".'
    );
    console.warn('[TVDiscovery]', err.message);
    if (onError) onError(err);
    return;
  }

  try {
    zeroconfInstance = new Zeroconf();

    zeroconfInstance.on('resolved', (service) => {
      if (!service || !service.host) return;

      const host = service.host;
      const port = service.port || (service.name?.includes('remote2') ? 6467 : 6466);
      const txt = service.txt || {};
      
      const name = txt.friendlyName || txt.fn || service.name || 'Xiaomi Android TV';
      const model = txt.model || txt.md || 'Mi TV / Android TV';
      const id = `${host}:${port}`;

      if (discoveredMap.has(id)) return;

      const signal = Math.floor(75 + Math.random() * 20);
      const isV2 = service.type?.includes('androidtvremote2') || service.name?.includes('androidtvremote2');

      const tvDevice = {
        id,
        name,
        model,
        room: txt.room || 'Living Room',
        icon: '📺',
        signal,
        host,
        port,
        txt,
        protocolVersion: isV2 ? 2 : 1,
      };

      discoveredMap.set(id, tvDevice);
      if (onFound) {
        onFound(tvDevice);
      }
    });

    zeroconfInstance.on('error', (err) => {
      console.warn('[TVDiscovery] Zeroconf error:', err);
      if (onError) onError(err);
    });

    // Scan for both v2 and v1 service types over tcp
    zeroconfInstance.scan('androidtvremote2', 'tcp', 'local.');
    zeroconfInstance.scan('androidtvremote', 'tcp', 'local.');
  } catch (err) {
    console.warn('[TVDiscovery] Exception starting scan:', err);
    if (onError) onError(err);
  }
}

export function stopScan() {
  if (zeroconfInstance) {
    try {
      zeroconfInstance.stop();
      zeroconfInstance.removeAllListeners();
    } catch (err) {
      // ignore cleanup error
    }
    zeroconfInstance = null;
  }
}

export default {
  startScan,
  stopScan,
};
