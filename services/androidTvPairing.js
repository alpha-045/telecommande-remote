import TcpSocket from 'react-native-tcp-socket';
import forge from 'node-forge';
import { Buffer } from 'buffer';
import { getOrCreateClientCertificate } from './androidTvCert';
import { PairingMessage, packFramedMessage, decodeVarint } from './protoSchemas';

export async function pairWithTv(ip, port = 6467, onPinRequired) {
  const clientCert = await getOrCreateClientCertificate();

  return new Promise((resolve, reject) => {
    let socket = null;
    let dataBuffer = Buffer.alloc(0);
    let step = 'INIT';
    let serverCertForge = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (socket) {
        try {
          socket.destroy();
        } catch (e) {}
        socket = null;
      }
    };

    const fail = (errType, message) => {
      cleanup();
      const err = new Error(message || errType);
      err.code = errType;
      reject(err);
    };

    timeoutTimer = setTimeout(() => {
      fail('TV_UNREACHABLE', 'Connection timed out while pairing with TV');
    }, 30000);

    try {
      socket = TcpSocket.connectTLS({
        host: ip,
        port: port,
        key: clientCert.key,
        cert: clientCert.cert,
        rejectUnauthorized: false,
      });
    } catch (e) {
      fail('TV_UNREACHABLE', e.message);
      return;
    }

    socket.on('connect', () => {
      // Step 1: Send PairingRequest
      step = 'SENT_REQUEST';
      const reqMsg = packFramedMessage(PairingMessage, {
        protocolVersion: 2,
        status: 200,
        pairingRequest: {
          serviceName: 'androidtvremote',
          clientName: 'XiaomiRemoteApp',
        },
      });
      socket.write(reqMsg);
    });

    socket.on('data', (data) => {
      dataBuffer = Buffer.concat([dataBuffer, Buffer.from(data)]);

      while (dataBuffer.length > 0) {
        const decodedVar = decodeVarint(dataBuffer);
        if (!decodedVar) break; // Incomplete header

        const { value: msgLen, length: headerLen } = decodedVar;
        if (dataBuffer.length < headerLen + msgLen) break; // Incomplete payload

        const payload = dataBuffer.slice(headerLen, headerLen + msgLen);
        dataBuffer = dataBuffer.slice(headerLen + msgLen);

        let msg;
        try {
          msg = PairingMessage.decode(payload);
        } catch (err) {
          console.warn('[androidTvPairing] Failed to decode PairingMessage:', err);
          continue;
        }

        handleMessage(msg);
      }
    });

    socket.on('error', (err) => {
      console.warn('[androidTvPairing] Socket error:', err);
      fail('TV_UNREACHABLE', err.message);
    });

    socket.on('close', () => {
      if (step !== 'SUCCESS') {
        fail('TV_DISCONNECTED', 'Pairing socket closed unexpectedly');
      }
    });

    const handleMessage = (msg) => {
      if (msg.status && msg.status !== 200) {
        if (msg.status === 401) {
          fail('WRONG_PIN', 'Invalid PIN entered');
        } else {
          fail('TV_REJECTED', `Pairing failed with status ${msg.status}`);
        }
        return;
      }

      if (step === 'SENT_REQUEST' && msg.pairingResponse) {
        // Step 2: Send PairingOption
        step = 'SENT_OPTION';
        const optMsg = packFramedMessage(PairingMessage, {
          protocolVersion: 2,
          status: 200,
          pairingOption: {
            preferredRole: [{ type: 3, symbolLength: 6 }], // HEXADECIMAL symbol length 6
            inputRole: [{ roleType: 1 }], // ROLE_TYPE_INPUT
          },
        });
        socket.write(optMsg);
      } else if (step === 'SENT_OPTION' && msg.pairingConfiguration) {
        // Step 3: Server sent PairingConfiguration -> TV displays PIN
        step = 'AWAITING_PIN';

        // Get TV certificate from TLS socket
        try {
          const peerCert = socket.getPeerCertificate ? socket.getPeerCertificate(true) : null;
          if (peerCert && peerCert.raw) {
            const certAsn1 = forge.asn1.fromDer(peerCert.raw.toString('binary'));
            serverCertForge = forge.pki.certificateFromAsn1(certAsn1);
          }
        } catch (e) {
          console.warn('[androidTvPairing] Could not extract peer cert from socket:', e);
        }

        if (!onPinRequired) {
          fail('NO_PIN_HANDLER', 'No callback provided for PIN entry');
          return;
        }

        onPinRequired(async (pin) => {
          if (!pin || pin.length < 4) {
            fail('WRONG_PIN', 'PIN must be at least 4 digits/characters');
            return;
          }

          try {
            // Calculate secret: SHA256(clientPubKeyDer + serverPubKeyDer + pinBytes)
            const clientCertForge = forge.pki.certificateFromPem(clientCert.cert);
            const clientPubKeyAsn1 = forge.pki.publicKeyToAsn1(clientCertForge.publicKey);
            const clientPubKeyBytes = Buffer.from(forge.asn1.toDer(clientPubKeyAsn1).getBytes(), 'binary');

            let serverPubKeyBytes = Buffer.alloc(0);
            if (serverCertForge) {
              const serverPubKeyAsn1 = forge.pki.publicKeyToAsn1(serverCertForge.publicKey);
              serverPubKeyBytes = Buffer.from(forge.asn1.toDer(serverPubKeyAsn1).getBytes(), 'binary');
            }

            // PIN hex bytes (strip first 2 chars if 6-char hex pin, or ascii/hex byte conversion)
            const cleanPin = pin.trim().toUpperCase();
            let pinBytes;
            if (cleanPin.length === 6) {
              pinBytes = Buffer.from(cleanPin.substring(2), 'hex');
            } else {
              pinBytes = Buffer.from(cleanPin, 'utf8');
            }

            const md = forge.md.sha256.create();
            md.update(clientPubKeyBytes.toString('binary'));
            md.update(serverPubKeyBytes.toString('binary'));
            md.update(pinBytes.toString('binary'));
            const secretHash = Buffer.from(md.digest().getBytes(), 'binary');

            step = 'SENT_SECRET';
            const secretMsg = packFramedMessage(PairingMessage, {
              protocolVersion: 2,
              status: 200,
              pairingSecret: { secret: secretHash },
            });
            socket.write(secretMsg);
          } catch (err) {
            fail('PAIRING_FAILED', err.message);
          }
        });
      } else if (step === 'SENT_SECRET' && (msg.pairingSecretAck || msg.status === 200)) {
        step = 'SUCCESS';
        cleanup();
        resolve({
          tvId: `${ip}:${port}`,
          ip,
          cert: clientCert.cert,
          key: clientCert.key,
        });
      }
    };
  });
}

export default {
  pairWithTv,
};
