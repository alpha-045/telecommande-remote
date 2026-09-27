import protobuf from 'protobufjs/light';
import { Buffer } from 'buffer';

const pairingSchemaJSON = {
  nested: {
    androidtvremote: {
      nested: {
        RoleType: {
          values: {
            ROLE_TYPE_UNKNOWN: 0,
            ROLE_TYPE_INPUT: 1,
            ROLE_TYPE_OUTPUT: 2,
          },
        },
        Status: {
          values: {
            STATUS_UNKNOWN: 0,
            STATUS_OK: 200,
            STATUS_ERROR_PEER_DECLINED: 400,
            STATUS_ERROR_BUSY: 420,
            STATUS_ERROR_BAD_CONFIGURATION: 403,
            STATUS_ERROR_BAD_SECRET: 401,
          },
        },
        EncodingType: {
          values: {
            ENCODING_TYPE_UNKNOWN: 0,
            ENCODING_TYPE_ALPHANUMERIC: 1,
            ENCODING_TYPE_NUMERIC: 2,
            ENCODING_TYPE_HEXADECIMAL: 3,
            ENCODING_TYPE_QRCODE: 4,
          },
        },
        PairingRequest: {
          fields: {
            serviceName: { type: 'string', id: 1 },
            clientName: { type: 'string', id: 2 },
          },
        },
        PairingResponse: {
          fields: {
            status: { type: 'Status', id: 1 },
          },
        },
        Role: {
          fields: {
            roleType: { type: 'RoleType', id: 1 },
          },
        },
        Encoding: {
          fields: {
            type: { type: 'EncodingType', id: 1 },
            symbolLength: { type: 'uint32', id: 2 },
          },
        },
        PairingOption: {
          fields: {
            inputRole: { rule: 'repeated', type: 'Role', id: 1 },
            outputRole: { rule: 'repeated', type: 'Role', id: 2 },
            preferredRole: { rule: 'repeated', type: 'Encoding', id: 3 },
          },
        },
        PairingConfiguration: {
          fields: {
            encoding: { type: 'Encoding', id: 1 },
            clientRole: { type: 'Role', id: 2 },
          },
        },
        PairingSecret: {
          fields: {
            secret: { type: 'bytes', id: 1 },
          },
        },
        PairingSecretAck: {
          fields: {
            secret: { type: 'bytes', id: 1 },
          },
        },
        PairingMessage: {
          fields: {
            status: { type: 'Status', id: 1 },
            protocolVersion: { type: 'int32', id: 2 },
            pairingRequest: { type: 'PairingRequest', id: 10 },
            pairingResponse: { type: 'PairingResponse', id: 11 },
            pairingOption: { type: 'PairingOption', id: 12 },
            pairingConfiguration: { type: 'PairingConfiguration', id: 13 },
            pairingSecret: { type: 'PairingSecret', id: 14 },
            pairingSecretAck: { type: 'PairingSecretAck', id: 15 },
          },
        },
      },
    },
  },
};

const remoteSchemaJSON = {
  nested: {
    androidtvremote: {
      nested: {
        RemoteDirection: {
          values: {
            UNKNOWN_DIRECTION: 0,
            SHORT: 1,
            START_LONG: 2,
            END_LONG: 3,
          },
        },
        RemoteKeyCode: {
          values: {
            KEYCODE_UNKNOWN: 0,
            KEYCODE_SOFT_LEFT: 1,
            KEYCODE_SOFT_RIGHT: 2,
            KEYCODE_HOME: 3,
            KEYCODE_BACK: 4,
            KEYCODE_CALL: 5,
            KEYCODE_ENDCALL: 6,
            KEYCODE_0: 7,
            KEYCODE_1: 8,
            KEYCODE_2: 9,
            KEYCODE_3: 10,
            KEYCODE_4: 11,
            KEYCODE_5: 12,
            KEYCODE_6: 13,
            KEYCODE_7: 14,
            KEYCODE_8: 15,
            KEYCODE_9: 16,
            KEYCODE_STAR: 17,
            KEYCODE_POUND: 18,
            KEYCODE_DPAD_UP: 19,
            KEYCODE_DPAD_DOWN: 20,
            KEYCODE_DPAD_LEFT: 21,
            KEYCODE_DPAD_RIGHT: 22,
            KEYCODE_DPAD_CENTER: 23,
            KEYCODE_VOLUME_UP: 24,
            KEYCODE_VOLUME_DOWN: 25,
            KEYCODE_POWER: 26,
            KEYCODE_VOLUME_MUTE: 164,
            KEYCODE_INFO: 165,
          },
        },
        RemoteConfigure: {
          fields: {
            code1: { type: 'int32', id: 1 },
            deviceName: { type: 'string', id: 2 },
          },
        },
        RemoteSetActive: {
          fields: {
            active: { type: 'int32', id: 1 },
          },
        },
        RemoteKeyInject: {
          fields: {
            keycode: { type: 'RemoteKeyCode', id: 1 },
            direction: { type: 'RemoteDirection', id: 2 },
          },
        },
        RemoteKeycodeAck: { fields: {} },
        RemoteImeBatchEdit: { fields: {} },
        RemoteImeShowRequest: { fields: {} },
        RemoteImeKeyInject: {
          fields: {
            app: { type: 'string', id: 1 },
          },
        },
        RemoteAppLinkLaunchRequest: {
          fields: {
            appLink: { type: 'string', id: 1 },
          },
        },
        RemoteReset: { fields: {} },
        RemotePingResponse: {
          fields: {
            val1: { type: 'int32', id: 1 },
          },
        },
        RemotePingRequest: {
          fields: {
            val1: { type: 'int32', id: 1 },
          },
        },
        RemoteSetVolumeLevel: {
          fields: {
            volumeLevel: { type: 'int32', id: 1 },
            volumeMax: { type: 'int32', id: 2 },
            volumeMuted: { type: 'bool', id: 3 },
          },
        },
        RemoteSetPowered: {
          fields: {
            powered: { type: 'bool', id: 1 },
          },
        },
        RemoteMessage: {
          fields: {
            remoteConfigure: { type: 'RemoteConfigure', id: 1 },
            remoteSetActive: { type: 'RemoteSetActive', id: 2 },
            remoteKeyInject: { type: 'RemoteKeyInject', id: 3 },
            remoteKeycodeAck: { type: 'RemoteKeycodeAck', id: 4 },
            remoteImeBatchEdit: { type: 'RemoteImeBatchEdit', id: 5 },
            remoteImeShowRequest: { type: 'RemoteImeShowRequest', id: 6 },
            remoteImeKeyInject: { type: 'RemoteImeKeyInject', id: 7 },
            remoteAppLinkLaunchRequest: { type: 'RemoteAppLinkLaunchRequest', id: 8 },
            remoteReset: { type: 'RemoteReset', "id": 9 },
            remotePingResponse: { type: 'RemotePingResponse', id: 10 },
            remotePingRequest: { type: 'RemotePingRequest', id: 11 },
            remoteSetVolumeLevel: { type: 'RemoteSetVolumeLevel', id: 12 },
            remoteSetPowered: { type: 'RemoteSetPowered', id: 13 },
          },
        },
      },
    },
  },
};

const pairingRoot = protobuf.Root.fromJSON(pairingSchemaJSON);
const remoteRoot = protobuf.Root.fromJSON(remoteSchemaJSON);

export const PairingMessage = pairingRoot.lookupType('androidtvremote.PairingMessage');
export const RemoteMessage = remoteRoot.lookupType('androidtvremote.RemoteMessage');

// ─── Varint Length Framing Helpers ───

export function encodeVarint(val) {
  const bytes = [];
  while (val > 127) {
    bytes.push((val & 127) | 128);
    val >>>= 7;
  }
  bytes.push(val & 127);
  return Buffer.from(bytes);
}

export function decodeVarint(buffer, offset = 0) {
  let res = 0;
  let shift = 0;
  let len = 0;

  while (offset + len < buffer.length) {
    const byte = buffer[offset + len];
    res |= (byte & 0x7f) << shift;
    len++;
    if ((byte & 0x80) === 0) {
      return { value: res, length: len };
    }
    shift += 7;
    if (shift >= 35) {
      throw new Error('Varint overflow');
    }
  }
  return null; // Incomplete varint
}

export function packFramedMessage(typeInstance, msgObj) {
  const errMsg = typeInstance.verify(msgObj);
  if (errMsg) throw new Error(`Protobuf verification failed: ${errMsg}`);
  const payload = typeInstance.encode(msgObj).finish();
  const varintHeader = encodeVarint(payload.length);
  return Buffer.concat([varintHeader, Buffer.from(payload)]);
}
