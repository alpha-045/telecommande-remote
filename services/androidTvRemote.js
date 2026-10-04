import TcpSocket from 'react-native-tcp-socket';
import { NativeModules } from 'react-native';
import { Buffer } from 'buffer';
import { getOrCreateClientCertificate } from './androidTvCert';
import { RemoteMessage, packFramedMessage, decodeVarint } from './protoSchemas';

class AndroidTvRemoteService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.dataBuffer = Buffer.alloc(0);
    this.connected = false;
    this.activeTv = null;
  }

  async connect(tv) {
    this.disconnect();
    this.activeTv = tv;
    const ip = tv.host || tv.ip;
    const port = tv.remotePort || 6466;

    if (!NativeModules.TcpSockets) {
      throw new Error(
        'Native TCP Socket module is missing in Expo Go. Please run a Development Build using "npx expo run:android" to connect to real TVs.'
      );
    }

    const clientCert = await getOrCreateClientCertificate();

    return new Promise((resolve, reject) => {
      let connectTimeout = setTimeout(() => {
        this.disconnect();
        reject(new Error('Connection to TV control socket timed out'));
      }, 15000);

      try {
        this.socket = TcpSocket.connectTLS({
          host: ip,
          port: port,
          key: clientCert.key,
          cert: clientCert.cert,
          rejectUnauthorized: false,
        });
      } catch (err) {
        clearTimeout(connectTimeout);
        reject(err);
        return;
      }

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this.connected = true;

        // 1. Send RemoteConfigure
        try {
          const configMsg = packFramedMessage(RemoteMessage, {
            remoteConfigure: {
              code1: 622,
              deviceName: 'XiaomiRemoteApp',
            },
          });
          this.socket.write(configMsg);

          // 2. Send RemoteSetActive
          const activeMsg = packFramedMessage(RemoteMessage, {
            remoteSetActive: {
              active: 622,
            },
          });
          this.socket.write(activeMsg);

          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.socket.on('data', (data) => {
        this.dataBuffer = Buffer.concat([this.dataBuffer, Buffer.from(data)]);

        while (this.dataBuffer.length > 0) {
          const decodedVar = decodeVarint(this.dataBuffer);
          if (!decodedVar) break;

          const { value: msgLen, length: headerLen } = decodedVar;
          if (this.dataBuffer.length < headerLen + msgLen) break;

          const payload = this.dataBuffer.slice(headerLen, headerLen + msgLen);
          this.dataBuffer = this.dataBuffer.slice(headerLen + msgLen);

          let msg;
          try {
            msg = RemoteMessage.decode(payload);
          } catch (err) {
            console.warn('[androidTvRemote] Failed to decode RemoteMessage:', err);
            continue;
          }

          this.handleIncomingMessage(msg);
        }
      });

      this.socket.on('error', (err) => {
        console.warn('[androidTvRemote] Socket error:', err);
        this.emit('error', err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
      });
    });
  }

  handleIncomingMessage(msg) {
    if (msg.remotePingRequest) {
      // Automatic ping response
      try {
        const pingResp = packFramedMessage(RemoteMessage, {
          remotePingResponse: {
            val1: msg.remotePingRequest.val1 || 1,
          },
        });
        if (this.socket) {
          this.socket.write(pingResp);
        }
      } catch (e) {
        console.warn('[androidTvRemote] Failed to send ping response:', e);
      }
    }

    if (msg.remoteSetVolumeLevel) {
      this.emit('volume', {
        level: msg.remoteSetVolumeLevel.volumeLevel,
        max: msg.remoteSetVolumeLevel.volumeMax,
        muted: msg.remoteSetVolumeLevel.volumeMuted,
      });
    }

    if (msg.remoteSetPowered) {
      this.emit('powered', msg.remoteSetPowered.powered);
    }

    if (msg.remoteImeKeyInject) {
      this.emit('currentApp', msg.remoteImeKeyInject.app);
    }
  }

  sendKey(keycode, directionStr = 'SHORT') {
    if (!this.connected || !this.socket) {
      console.warn('[androidTvRemote] Cannot send key: socket not connected');
      return false;
    }

    const directionMap = {
      SHORT: 1,
      START_LONG: 2,
      END_LONG: 3,
    };
    const direction = directionMap[directionStr] || 1;

    try {
      const keyMsg = packFramedMessage(RemoteMessage, {
        remoteKeyInject: {
          keycode,
          direction,
        },
      });
      this.socket.write(keyMsg);
      return true;
    } catch (err) {
      console.error('[androidTvRemote] Error sending key:', err);
      return false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, filtered);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[androidTvRemote] Error in event listener for ${event}:`, e);
        }
      });
    }
  }

  disconnect() {
    this.connected = false;
    this.dataBuffer = Buffer.alloc(0);
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (e) {}
      this.socket = null;
    }
  }
}

export const androidTvRemote = new AndroidTvRemoteService();
export default androidTvRemote;
