import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";

const tools = [
  { icon: "square-foot" as const, title: "GPS Area Calculator", body: "Walk a plot boundary and estimate local area in m², sq ft, and acres.", route: "/toolkit/gps-area" },
  { icon: "account-balance" as const, title: "State Land Records", body: "Open reviewed official government land-record portals inside the app.", route: "/toolkit/land-records" },
  { icon: "explore" as const, title: "Digital Compass", body: "Use your device magnetometer for practical direction plotting.", route: "/toolkit/compass" },
];

export default function AminToolkitScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  if (user?.role !== "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>The Amin Master Toolkit is available in the Student learning experience.</Text></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Account" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>FIELD LEARNING HUB</Text><Text style={styles.title}>Amin Master Toolkit</Text></View><IconCircle icon="terrain" size={46} color={COLORS.saffron} background="#FFF2D5" /></View><View style={styles.notice}><Tag label="PRACTICAL GUIDANCE" tone="saffron" /><Text style={styles.noticeText}>These tools support learning and field practice. GPS area and compass values are approximate; they are not a legal boundary survey, certified measurement, or official record.</Text></View><Text style={styles.section}>Choose a practical tool</Text>{tools.map((tool) => <Pressable key={tool.route} accessibilityRole="button" accessibilityLabel={`Open ${tool.title}`} onPress={() => router.push(tool.route as never)} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}><IconCircle icon={tool.icon} size={46} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={{ flex: 1 }}><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolBody}>{tool.body}</Text></View><MaterialIcons name="chevron-right" size={25} color={COLORS.muted} /></Pressable>)}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingTop: 10, paddingBottom: 28 }, header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 3 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, eyebrow: { color: COLORS.earth, fontSize: 10, letterSpacing: 1, fontWeight: "900" }, title: { color: COLORS.ink, fontSize: 24, fontWeight: "900", marginTop: 3 }, notice: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F" }, noticeText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, section: { color: COLORS.ink, fontSize: 16, fontWeight: "900", marginTop: 4 }, tool: { minHeight: 92, padding: 13, borderRadius: 19, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", alignItems: "center", gap: 12 }, toolTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900" }, toolBody: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, denied: { color: COLORS.muted, textAlign: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] } });
