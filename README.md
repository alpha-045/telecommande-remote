# Xiaomi TV Remote App

> **Note on Expo Go vs Development Build**:  
> This project uses native mDNS/Bonjour discovery (`react-native-zeroconf`) and raw TLS TCP sockets (`react-native-tcp-socket`) for low-latency client-authenticated Android TV Remote v2 protocol communication. Because these features rely on custom C/Java native modules, **Expo Go cannot be used**.

## Running the App

To run the app with native capabilities, generate native project files and launch an Expo Development Build:

```bash
# 1. Prebuild native Android/iOS project files
npx expo prebuild

# 2. Build & run on Android
npx expo run:android

# 3. Build & run on iOS (macOS only)
npx expo run:ios
```

## Protocol Implementation
- Protocol: Google Android TV Remote Protocol v2 (and v1 mDNS fallback).
- Pairing: TLS client certificate exchange on port 6467.
- Remote Session: Varint length-delimited Protobuf communication over TLS on port 6466.
