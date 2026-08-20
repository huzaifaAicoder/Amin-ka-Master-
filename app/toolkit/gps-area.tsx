import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, PrimaryButton, Tag } from "@/components/lms-ui";
import { estimatePlotArea, metersBetween, type GeoPoint } from "@/lib/amin-toolkit";

export default function GpsAreaScreen() {
  const router = useRouter();
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [mapping, setMapping] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [notice, setNotice] = useState("Use foreground location only while you actively walk the perimeter.");
  const area = estimatePlotArea(points);

  const stopMapping = () => { subscription.current?.remove(); subscription.current = null; setMapping(false); };
  useEffect(() => () => stopMapping(), []);
  const startMapping = async () => {
    if (Platform.OS === "web") return setNotice("GPS perimeter mapping needs the native Android or iOS app. No location is recorded in this browser preview.");
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return setNotice("Turn on device location services, then try Start Mapping again.");
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return setNotice("Location permission was not granted. You can enable it in device settings when ready.");
    setNotice("Mapping is active. Walk the plot boundary; points are kept only on this screen.");
    setMapping(true);
    subscription.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3_000, distanceInterval: 4 }, (location) => {
      const nextPoint = { latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy };
      setAccuracy(location.coords.accuracy);
      setPoints((current) => current.length === 0 || metersBetween(current[current.length - 1], nextPoint) >= 3 ? [...current, nextPoint] : current);
    });
  };
  const reset = () => { stopMapping(); setPoints([]); setAccuracy(null); setNotice("Mapping reset. No points are saved after you leave or reset this screen."); };
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Amin Toolkit" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View><Text style={styles.eyebrow}>FIELD ESTIMATE</Text><Text style={styles.title}>GPS Area Calculator</Text></View></View><View style={styles.warning}><Tag label="APPROXIMATE ONLY" tone="saffron" /><Text style={styles.warningText}>This local estimate depends on GPS accuracy, your walking path, and terrain. Do not use it as a certified survey, legal boundary, or official measurement.</Text></View><View style={styles.areaCard}><Text style={styles.areaValue}>{area.squareFeet ? area.squareFeet.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "0"} sq ft</Text><Text style={styles.areaMeta}>{area.squareMeters.toFixed(1)} m² · {area.acres.toFixed(4)} acres</Text><Text style={styles.pointCount}>{points.length} perimeter point{points.length === 1 ? "" : "s"} · accuracy {accuracy ? `±${Math.round(accuracy)} m` : "waiting"}</Text></View><View style={styles.status}><MaterialIcons name={mapping ? "gps-fixed" : "gps-not-fixed"} size={20} color={mapping ? COLORS.green : COLORS.indigo} /><Text style={styles.statusText}>{notice}</Text></View><PrimaryButton label={mapping ? "Stop mapping & estimate" : "Start mapping"} icon={mapping ? "stop-circle" : "play-arrow"} onPress={() => mapping ? stopMapping() : void startMapping()} /><Pressable accessibilityRole="button" onPress={reset} style={styles.reset}><Text style={styles.resetText}>Reset local points</Text></Pressable><Text style={styles.section}>Current local perimeter</Text>{points.length ? points.map((point, index) => <View key={`${point.latitude}-${point.longitude}-${index}`} style={styles.point}><Text style={styles.pointIndex}>#{index + 1}</Text><Text style={styles.pointText}>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</Text><Text style={styles.pointAccuracy}>{point.accuracy ? `±${Math.round(point.accuracy)} m` : ""}</Text></View>) : <View style={styles.empty}><MaterialIcons name="route" size={26} color={COLORS.muted} /><Text style={styles.emptyText}>Start mapping, then walk the perimeter. Points remain only in this screen session.</Text></View>}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 10, paddingBottom: 28, gap: 13 }, header: { flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.indigoSoft, justifyContent: "center", alignItems: "center" }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900", marginTop: 2 }, warning: { gap: 7, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: "#F3D79F", backgroundColor: "#FFF8E9" }, warningText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, areaCard: { alignItems: "center", gap: 5, padding: 22, borderRadius: 22, backgroundColor: COLORS.indigo }, areaValue: { color: COLORS.white, fontSize: 28, fontWeight: "900" }, areaMeta: { color: "#D6DFF2", fontSize: 13, fontWeight: "700" }, pointCount: { color: "#BFCDE8", fontSize: 11, marginTop: 3 }, status: { flexDirection: "row", gap: 9, borderRadius: 15, padding: 12, backgroundColor: COLORS.indigoSoft, alignItems: "center" }, statusText: { color: COLORS.indigo, flex: 1, fontSize: 12, lineHeight: 18 }, reset: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, resetText: { color: COLORS.indigo, fontSize: 13, fontWeight: "900" }, section: { color: COLORS.ink, fontWeight: "900", fontSize: 16, marginTop: 2 }, point: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, flexDirection: "row", gap: 9, alignItems: "center" }, pointIndex: { color: COLORS.indigo, fontWeight: "900", width: 28 }, pointText: { color: COLORS.ink, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 11, flex: 1 }, pointAccuracy: { color: COLORS.muted, fontSize: 10 }, empty: { padding: 24, alignItems: "center", gap: 8, borderRadius: 17, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, emptyText: { color: COLORS.muted, textAlign: "center", fontSize: 12, lineHeight: 18 } });
