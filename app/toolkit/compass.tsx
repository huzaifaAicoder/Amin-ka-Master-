import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Magnetometer } from "expo-sensors";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, PrimaryButton, Tag } from "@/components/lms-ui";
import { compassHeading } from "@/lib/amin-toolkit";

const cardinalDirection = (heading: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(heading / 45) % 8];
const SENSOR_INTERVAL_MS = 200;
const DISPLAY_UPDATE_INTERVAL_MS = 250;

export default function CompassScreen() {
  const router = useRouter();
  const subscription = useRef<{ remove: () => void } | null>(null);
  const starting = useRef(false);
  const continuousHeading = useRef(0);
  const displayUpdatedAt = useRef(0);
  const needleRotation = useRef(new Animated.Value(0)).current;
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("Start the compass when you are ready to take a direction reading.");
  const stop = useCallback(() => { subscription.current?.remove(); subscription.current = null; starting.current = false; needleRotation.stopAnimation(); setActive(false); }, [needleRotation]);
  useEffect(() => () => stop(), [stop]);
  const start = async () => {
    if (subscription.current || starting.current) return;
    starting.current = true;
    if (Platform.OS === "web") return setMessage("The native digital compass is available on Android and iOS, not in this browser preview.");
    try {
      const available = await Magnetometer.isAvailableAsync();
      if (!available) return setMessage("This device does not expose a compatible magnetometer sensor.");
      const permission = await Magnetometer.requestPermissionsAsync();
      if (!permission.granted) return setMessage("Sensor permission was not granted. Enable it in device settings when ready.");
      // 10 updates/second keeps sensor work bounded. The native-driven needle animation fills
      // the gaps smoothly, while heading text is intentionally rendered at most four times/second.
      Magnetometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      setMessage("Compass active. Keep the device level and away from magnets or metal objects.");
      setActive(true);
      subscription.current = Magnetometer.addListener(({ x, y }) => {
        const nextHeading = compassHeading(x, y);
        const previous = continuousHeading.current;
        const delta = ((nextHeading - (previous % 360) + 540) % 360) - 180;
        continuousHeading.current = previous + delta;
        Animated.timing(needleRotation, { toValue: -continuousHeading.current, duration: SENSOR_INTERVAL_MS, useNativeDriver: true }).start();
        const now = Date.now();
        if (now - displayUpdatedAt.current >= DISPLAY_UPDATE_INTERVAL_MS) {
          displayUpdatedAt.current = now;
          setHeading(nextHeading);
        }
      });
    } finally { starting.current = false; }
  };
  const needleTransform = needleRotation.interpolate({ inputRange: [-360, 0, 360], outputRange: ["-360deg", "0deg", "360deg"], extrapolate: "extend" });
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Amin Toolkit" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View><Text style={styles.eyebrow}>DIRECTION PLOTTING</Text><Text style={styles.title}>Digital Compass</Text></View></View><View style={styles.warning}><Tag label="MAGNETIC INDICATION" tone="saffron" /><Text style={styles.warningText}>Magnetic interference, device calibration, tilt, and nearby metal can affect this reading. Use it for learning support—not as a survey-grade bearing.</Text></View><View style={styles.compassWrap}><View style={styles.compass}><Text style={styles.north}>N</Text><Text style={styles.east}>E</Text><Text style={styles.south}>S</Text><Text style={styles.west}>W</Text><Animated.View style={[styles.needle, { transform: [{ translateY: -22 }, { rotate: needleTransform }] }]} /></View><Text style={styles.headingValue}>{heading === null ? "—" : `${Math.round(heading)}°`}</Text><Text style={styles.cardinal}>{heading === null ? "Waiting for sensor" : cardinalDirection(heading)}</Text></View><View style={styles.status}><MaterialIcons name={active ? "explore" : "explore-off"} size={20} color={active ? COLORS.green : COLORS.indigo} /><Text style={styles.statusText}>{message}</Text></View><PrimaryButton label={active ? "Stop compass" : "Start compass"} icon={active ? "stop-circle" : "explore"} onPress={() => active ? stop() : void start()} /></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 10, paddingBottom: 28, gap: 13 }, header: { flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.indigoSoft, justifyContent: "center", alignItems: "center" }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900", marginTop: 2 }, warning: { gap: 7, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: "#F3D79F", backgroundColor: "#FFF8E9" }, warningText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, compassWrap: { alignItems: "center", gap: 8, paddingVertical: 15 }, compass: { width: 220, height: 220, borderRadius: 110, borderWidth: 10, borderColor: COLORS.indigoSoft, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" }, north: { position: "absolute", top: 15, color: COLORS.red, fontWeight: "900", fontSize: 18 }, east: { position: "absolute", right: 17, color: COLORS.indigo, fontWeight: "900", fontSize: 17 }, south: { position: "absolute", bottom: 15, color: COLORS.indigo, fontWeight: "900", fontSize: 17 }, west: { position: "absolute", left: 17, color: COLORS.indigo, fontWeight: "900", fontSize: 17 }, needle: { width: 5, height: 114, borderRadius: 4, backgroundColor: COLORS.red }, headingValue: { color: COLORS.ink, fontSize: 31, fontWeight: "900", marginTop: 2 }, cardinal: { color: COLORS.indigo, fontSize: 14, fontWeight: "900" }, status: { flexDirection: "row", gap: 9, borderRadius: 15, padding: 12, backgroundColor: COLORS.indigoSoft, alignItems: "center" }, statusText: { color: COLORS.indigo, flex: 1, fontSize: 12, lineHeight: 18 } });
