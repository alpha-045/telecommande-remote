import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Vibration,
  StatusBar,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Colors ───
const C = {
  bg: "#0a0a0f",
  card: "#14141f",
  cardLight: "#1c1c2e",
  border: "#2a2a40",
  fg: "#e8e8f0",
  muted: "#6a6a8a",
  accent: "#00e5a0",
  accentGlow: "rgba(0,229,160,0.25)",
  accentDim: "rgba(0,229,160,0.08)",
  danger: "#ff4060",
  dangerGlow: "rgba(255,64,96,0.25)",
  warning: "#ffb020",
};

function PulseButton({
  children,
  onPress,
  style,
  hitSlop,
  color = C.accent,
  glowColor = C.accentGlow,
  disabled = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    Vibration?.cancel();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          alignSelf: "center",
          width: "120%",
          height: "120%",
          borderRadius: 100,
          backgroundColor: glowColor,
          opacity: glow,
          top: "-10%",
        }}
      />
      <TouchableOpacity
        activeOpacity={0.7}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        disabled={disabled}
        hitSlop={hitSlop || { top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.pulseBtn, { borderColor: color }, style]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function StatusDot({ powered }) {
  const pulse = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!powered) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [powered]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: powered ? C.accent : C.danger,
        opacity: pulse,
        marginRight: 6,
      }}
    />
  );
}

function Toast({ message, visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, message]);

  return (
    <Animated.View style={[styles.toastWrap, { opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export default function INTER() {
  const [powered, setPowered] = useState(true);
  const [toastKey, setToastKey] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [volume, setVolume] = useState(25);
  const [channel, setChannel] = useState(8);

  const showToast = (msg) => {
    setToastMsg(msg);
    setToastKey((k) => k + 1);
  };

  const handlePower = () => {
    setPowered((p) => !p);
    Vibration?.vibrate(40);
  };

  const handleVol = (dir) => {
    if (!powered) return;
    Vibration?.vibrate(15);
    setVolume((v) => Math.max(0, Math.min(100, v + dir)));
  };

  const handleCh = (dir) => {
    if (!powered) return;
    Vibration?.vibrate(15);
    setChannel((c) => Math.max(1, Math.min(999, c + dir)));
  };

  const handleOk = () => {
    if (!powered) return;
    Vibration?.vibrate(25);
    showToast("OK Confirmed");
  };

  const handleNav = (dir) => {
    if (!powered) return;
    Vibration?.vibrate(15);
    showToast(dir);
  };

  const handleTopBtn = (label) => {
    if (!powered && label !== "POWER") return;
    Vibration?.vibrate(15);
    showToast(label);
  };

  const dimmed = !powered;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />

      {/* Toast */}
      <Toast key={toastKey} message={toastMsg} visible={!!toastMsg} />

      <View style={[styles.remote, dimmed && styles.remoteDim]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>REMOTE</Text>
          <View style={styles.statusRow}>
            <StatusDot powered={powered} />
            <Text style={styles.statusText}>
              {powered ? "CONNECTED" : "OFF"}
            </Text>
          </View>
        </View>

        <View style={styles.topRow}>
          {/* Power */}
          <PulseButton
            color={C.danger}
            glowColor={C.dangerGlow}
            onPress={handlePower}
            style={styles.topBtn}
          >
            <View
              style={[styles.powerIconWrap, powered && styles.powerIconActive]}
            >
              <Text style={styles.powerIcon}>⏻</Text>
            </View>
          </PulseButton>

          {/* Home */}
          <PulseButton
            onPress={() => handleTopBtn("HOME")}
            style={styles.topBtn}
          >
            <View style={styles.homeIcon}>
              <View style={styles.homeRoof} />
              <View style={styles.homeBody} />
            </View>
          </PulseButton>
        </View>

        <View style={styles.dpadContainer}>
          <View style={styles.dpadOuter}>
            {/* Up */}
            <View style={styles.dpadUpPos}>
              <PulseButton
                onPress={() => handleNav("UP")}
                style={styles.dpadArrowBtn}
              >
                <Text style={styles.dpadArrow}>▲</Text>
              </PulseButton>
            </View>

            {/* Left */}
            <View style={styles.dpadLeftPos}>
              <PulseButton
                onPress={() => handleNav("LEFT")}
                style={styles.dpadArrowBtn}
              >
                <Text
                  style={[
                    styles.dpadArrow,
                    { transform: [{ rotate: "-90deg" }] },
                  ]}
                >
                  ▲
                </Text>
              </PulseButton>
            </View>

            {/* Center OK */}
            <View style={styles.dpadCenter}>
              <PulseButton onPress={handleOk} style={styles.okBtn}>
                <Text style={styles.okText}>OK</Text>
              </PulseButton>
            </View>

            {/* Right */}
            <View style={styles.dpadRightPos}>
              <PulseButton
                onPress={() => handleNav("RIGHT")}
                style={styles.dpadArrowBtn}
              >
                <Text
                  style={[
                    styles.dpadArrow,
                    { transform: [{ rotate: "90deg" }] },
                  ]}
                >
                  ▲
                </Text>
              </PulseButton>
            </View>

            {/* Down */}
            <View style={styles.dpadDownPos}>
              <PulseButton
                onPress={() => handleNav("DOWN")}
                style={styles.dpadArrowBtn}
              >
                <Text
                  style={[
                    styles.dpadArrow,
                    { transform: [{ rotate: "180deg" }] },
                  ]}
                >
                  ▲
                </Text>
              </PulseButton>
            </View>

            {/* Ring decoration */}
            <View style={styles.dpadRing} />
            <View style={styles.dpadRing2} />
          </View>
        </View>

      

        {/* ── Bottom Row: Vol + Ch ── */}
        <View style={styles.bottomRow}>
          <View style={styles.bottomGroup}>
            <Text style={styles.groupLabel}>VOL</Text>
            <View style={styles.groupBtns}>
              <PulseButton onPress={() => handleVol(1)} style={styles.volChBtn}>
                <Text style={styles.volChText}>+</Text>
              </PulseButton>
              <View style={styles.groupSeparator} />
              <PulseButton
                onPress={() => handleVol(-1)}
                style={styles.volChBtn}
              >
                <Text style={styles.volChText}>−</Text>
              </PulseButton>
            </View>
          </View>
        </View>

        <View style={styles.extraRow}>
          <PulseButton
            onPress={() => handleTopBtn("MUTE")}
            style={styles.extraBtn}
          >
            <Text style={styles.extraIcon}>🔇</Text>
            <Text style={styles.extraLabel}>Mute</Text>
          </PulseButton>
          <PulseButton
            onPress={() => handleTopBtn("BACK")}
            style={styles.extraBtn}
          >
            <Text style={styles.extraIcon}>↩</Text>
            <Text style={styles.extraLabel}>Back</Text>
          </PulseButton>
          <PulseButton
            onPress={() => handleTopBtn("INFO")}
            style={styles.extraBtn}
          >
            <Text style={styles.extraIcon}>ⓘ</Text>
            <Text style={styles.extraLabel}>Info</Text>
          </PulseButton>
        </View>
      </View>
    </View>
  );
}

const D_PAD_SIZE = 220;
const OK_SIZE = 68;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  bgBlob1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: C.accent,
    opacity: 0.06,
    top: -60,
    left: -80,
    filter: "blur(60px)",
  },
  bgBlob2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#5040ff",
    opacity: 0.07,
    bottom: -40,
    right: -60,
  },

  // Toast
  toastWrap: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: C.cardLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.border,
    zIndex: 999,
  },
  toastText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },

  // Remote body
  remote: {
    width: SCREEN_WIDTH - 32,
    maxWidth: 360,
    backgroundColor: C.card,
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    gap: 18,
  },
  remoteDim: {
    opacity: 0.45,
  },

  // Header
  header: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "monospace",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 6,
    color: C.accent,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  statusText: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 2,
    fontWeight: "600",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  topBtn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.cardLight,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  powerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: C.danger,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  powerIconActive: {
    borderColor: C.danger,
    shadowColor: C.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  powerIcon: {
    fontSize: 16,
    color: C.danger,
    marginTop: -4,
  },

  // Home icon
  homeIcon: {
    alignItems: "center",
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: C.accent,
  },
  homeBody: {
    width: 14,
    height: 10,
    backgroundColor: C.accent,
    borderRadius: 1,
  },

  // Menu icon
  menuIcon: {
    alignItems: "center",
    gap: 3,
  },
  menuLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: C.accent,
  },

  // D-Pad
  dpadContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: D_PAD_SIZE + 30,
  },
  dpadOuter: {
    width: D_PAD_SIZE,
    height: D_PAD_SIZE,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  dpadRing: {
    position: "absolute",
    width: D_PAD_SIZE - 10,
    height: D_PAD_SIZE - 10,
    borderRadius: (D_PAD_SIZE - 10) / 2,
    borderWidth: 1.5,
    borderColor: C.border,
    top: 5,
    left: 5,
  },
  dpadRing2: {
    position: "absolute",
    width: D_PAD_SIZE - 40,
    height: D_PAD_SIZE - 40,
    borderRadius: (D_PAD_SIZE - 40) / 2,
    borderWidth: 1,
    borderColor: "rgba(0,229,160,0.1)",
    top: 20,
    left: 20,
  },

  // D-Pad arrow button
  dpadArrowBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.cardLight,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dpadArrow: {
    fontSize: 16,
    color: C.fg,
    fontWeight: "600",
  },

  // Positioning for D-Pad
  dpadUpPos: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
  },
  dpadDownPos: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  dpadLeftPos: {
    position: "absolute",
    left: 0,
    alignSelf: "center",
    top: (D_PAD_SIZE - 48) / 2,
  },
  dpadRightPos: {
    position: "absolute",
    right: 0,
    alignSelf: "center",
    top: (D_PAD_SIZE - 48) / 2,
  },

  // OK button
  dpadCenter: {
    position: "absolute",
    alignSelf: "center",
    top: (D_PAD_SIZE - OK_SIZE) / 2,
    zIndex: 2,
  },
  okBtn: {
    width: OK_SIZE,
    height: OK_SIZE,
    borderRadius: OK_SIZE / 2,
    backgroundColor: C.accent,
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  okText: {
    fontSize: 16,
    fontWeight: "900",
    color: C.bg,
    letterSpacing: 2,
  },

  infoStrip: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: C.cardLight,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  infoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 2,
  },
  infoBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  infoBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "700",
    color: C.fg,
    width: 26,
    textAlign: "right",
  },
  infoChValue: {
    fontSize: 14,
    fontWeight: "900",
    color: C.fg,
    fontFamily: "monospace",
  },
  infoDivider: {
    width: 1,
    height: 20,
    backgroundColor: C.border,
    marginHorizontal: 10,
  },

  // Bottom row: Vol & Ch
  bottomRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  bottomGroup: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 3,
  },
  groupBtns: {
    flexDirection: "row",
    backgroundColor: C.cardLight,
    borderRadius: 16,
    borderWidth: 5,
    borderColor: C.border,
    overflow: "hidden",
  },
  volChBtn: {
    width: 60,
    height: 52,
    backgroundColor: "transparent",
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  volChText: {
    fontSize: 22,
    fontWeight: "700",
    color: C.fg,
  },
  chArrow: {
    fontSize: 16,
    color: C.fg,
    fontWeight: "600",
  },
  groupSeparator: {
    width: 1,
    height: "80%",
    alignSelf: "center",
    backgroundColor: C.border,
  },
  extraRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  extraBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.cardLight,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  extraIcon: {
    fontSize: 14,
    color: C.muted,
  },
  extraLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.muted,
    letterSpacing: 1,
  },
  pulseBtn: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.accent,
  },
});
