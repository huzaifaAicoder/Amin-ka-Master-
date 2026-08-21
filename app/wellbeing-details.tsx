import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, EmptyState, IconCircle, Tag } from "@/components/lms-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useLmsSession } from "@/lib/lms-session";
import { loadWeeklyLearningTime, loadWellbeingBreakdown, type WellbeingBreakdown } from "@/lib/study-planner";

const formatTime = (seconds: number) => seconds >= 3600 ? `${(seconds / 3600).toFixed(1)}h` : `${Math.round(seconds / 60)}m`;

export default function WellbeingDetailsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const [refreshing, setRefreshing] = useState(false);
  const [breakdown, setBreakdown] = useState<WellbeingBreakdown[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!user || user.role !== "student") return;
    setRefreshing(true);
    try {
      const [days, categories] = await Promise.all([loadWeeklyLearningTime(user.id), loadWellbeingBreakdown(user.id)]);
      setWeekTotal(days.reduce((sum, day) => sum + day.seconds, 0));
      setBreakdown(categories);
      setLoaded(true);
    } finally { setRefreshing(false); }
  }, [user]);
  useEffect(() => { if (user?.role === "student") void refresh(); }, [refresh, user?.role]);
  if (user?.role !== "student") return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="shield" title="Student access required" body="Wellbeing details are private to the Student learning experience." /></View></ScreenContainer>;
  if (!loaded) return <ScreenContainer className="px-5"><View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loading}>Preparing your private wellbeing details…</Text></View></ScreenContainer>;
  const todayTotal = breakdown.reduce((sum, item) => sum + item.seconds, 0);
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Account" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>Digital Wellbeing</Text><Text style={styles.sub}>Private activity details stored on this device</Text></View><Tag label="PRIVATE" tone="green" /></View><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[COLORS.indigo]} tintColor={COLORS.indigo} />}><View style={styles.hero}><IconCircle icon="self-improvement" size={48} color={COLORS.saffron} background="rgba(255,255,255,.13)" /><View style={{ flex: 1 }}><Text style={styles.heroLabel}>TODAY’S FOCUS</Text><Text style={styles.heroTitle}>{formatTime(todayTotal)}</Text><Text style={styles.heroBody}>Time recorded from supported active learning sessions.</Text></View></View><View style={styles.summary}><Metric label="Today" value={formatTime(todayTotal)} icon="today" /><Metric label="Last 7 days" value={formatTime(weekTotal)} icon="date-range" /></View><Text style={styles.section}>Today by activity</Text><View style={styles.card}>{breakdown.map((item) => <View key={item.category} style={styles.row}><View style={styles.rowIcon}><MaterialIcons name={item.category === "Lectures" ? "play-circle" : item.category === "Tests" ? "assignment" : item.category === "Shorts" ? "bolt" : item.category === "Notes" ? "notes" : "more-time"} size={19} color={COLORS.indigo} /></View><Text style={styles.rowLabel}>{item.category}</Text><Text style={styles.rowValue}>{item.seconds ? formatTime(item.seconds) : "—"}</Text></View>)}</View><View style={styles.notice}><MaterialIcons name="lock-outline" size={18} color={COLORS.green} /><Text style={styles.noticeText}>This information is local to your device and is not sent to Staff or used as hidden telemetry. Existing historical totals are preserved; category detail begins when category-aware sessions are recorded.</Text></View></ScrollView></ScreenContainer>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }) { return <View style={styles.metric}><MaterialIcons name={icon} size={18} color={COLORS.indigo} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: "center", gap: 12 }, loading: { color: COLORS.muted, textAlign: "center" }, header: { minHeight: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line }, back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, title: { color: COLORS.ink, fontSize: 20, fontWeight: "900" }, sub: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, content: { padding: 16, paddingBottom: 40, gap: 12 }, hero: { minHeight: 132, padding: 18, borderRadius: 21, backgroundColor: COLORS.indigo, flexDirection: "row", alignItems: "center", gap: 13 }, heroLabel: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: .8 }, heroTitle: { color: COLORS.white, fontSize: 28, fontWeight: "900", marginTop: 4 }, heroBody: { color: "#D6DFF2", fontSize: 11, lineHeight: 16, marginTop: 4 }, summary: { flexDirection: "row", gap: 8 }, metric: { flex: 1, minHeight: 85, padding: 12, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, gap: 4 }, metricValue: { color: COLORS.ink, fontSize: 19, fontWeight: "900" }, metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "800" }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 4 }, card: { padding: 12, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, row: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line }, rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, rowLabel: { flex: 1, color: COLORS.ink, fontSize: 13, fontWeight: "800" }, rowValue: { color: COLORS.indigo, fontSize: 13, fontWeight: "900" }, notice: { padding: 13, borderRadius: 16, flexDirection: "row", gap: 8, backgroundColor: "#F4FBF7", borderWidth: 1, borderColor: "#ABEFC6" }, noticeText: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 16 } });
