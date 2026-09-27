import forge from 'node-forge';
import * as SecureStore from 'expo-secure-store';

const CERT_KEY_STORAGE = 'android_tv_client_cert_key';
const CERT_PEM_STORAGE = 'android_tv_client_cert_pem';

export async function getOrCreateClientCertificate() {
  try {
    let keyPem = await SecureStore.getItemAsync(CERT_KEY_STORAGE);
    let certPem = await SecureStore.getItemAsync(CERT_PEM_STORAGE);

    if (keyPem && certPem) {
      return { cert: certPem, key: keyPem };
    }

    // Generate 2048-bit RSA key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 20);

    const attrs = [
      { name: 'commonName', value: 'XiaomiRemoteApp' },
      { name: 'organizationName', value: 'XiaomiRemote' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Sign self-signed certificate with private key
    cert.sign(keys.privateKey, forge.md.sha256.create());

    certPem = forge.pki.certificateToPem(cert);
    keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    await SecureStore.setItemAsync(CERT_KEY_STORAGE, keyPem);
    await SecureStore.setItemAsync(CERT_PEM_STORAGE, certPem);

    return { cert: certPem, key: keyPem };
  } catch (err) {
    console.error('[androidTvCert] Error getting or generating cert:', err);
    throw err;
  }
}

export default {
  getOrCreateClientCertificate,
};
