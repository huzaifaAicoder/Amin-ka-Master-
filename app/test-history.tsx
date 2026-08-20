import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton, Tag } from "@/components/lms-ui";
import { usePanelRefresh } from "@/hooks/use-panel-refresh";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder.toString().padStart(2, "0")}s` : `${remainder}s`;
}

function formatAttemptDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function TestHistoryScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const historyQuery = trpc.student.testHistory.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const { refreshing, onRefresh } = usePanelRefresh([historyQuery.refetch]);
  const summary = useMemo(() => {
    const completed = (historyQuery.data ?? []).filter((item) => item.status !== "in_progress");
    const passed = completed.filter((item) => item.status === "submitted" && item.passingMarks > 0 && item.score >= item.passingMarks).length;
    const bestPercent = completed.reduce((best, item) => item.totalMarks > 0 ? Math.max(best, Math.round((item.score / item.totalMarks) * 100)) : best, 0);
    return { completed: completed.length, passed, bestPercent };
  }, [historyQuery.data]);

  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in to view attempts" body="Assessment history belongs only to your authenticated learner profile." /></View></ScreenContainer>;
  if (historyQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  if (historyQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="wifi-off" title="Attempt history unavailable" body="Check your connection and retry. Your saved assessment records remain protected on the server." action={<PrimaryButton label="Retry" icon="refresh" onPress={() => void historyQuery.refetch()} />} /></View></ScreenContainer>;

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Attempt history</Text><View style={{ width: 23 }} /></View><FlatList data={historyQuery.data ?? []} keyExtractor={(item) => item.attemptId.toString()} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.indigo]} tintColor={COLORS.indigo} />} contentContainerStyle={styles.list} ListHeaderComponent={<><View style={styles.helper}><MaterialIcons name="verified-user" size={18} color={COLORS.indigo} /><Text style={styles.helperText}>Scores, timing, and explanations are server-derived. Only you can open your own reviewed attempts.</Text></View><View style={styles.summary}><HistoryMetric icon="assignment-turned-in" label="COMPLETED" value={summary.completed.toString()} /><HistoryMetric icon="emoji-events" label="BEST" value={`${summary.bestPercent}%`} /><HistoryMetric icon="verified" label="PASSED" value={summary.passed.toString()} /></View></>} ListEmptyComponent={<View style={styles.empty}><EmptyState icon="assignment-late" title="No attempts yet" body="Complete a timed practice test to see your score, time used, and detailed explanations here." /></View>} renderItem={({ item }) => { const passed = item.status === "submitted" && item.passingMarks > 0 && item.score >= item.passingMarks; const completed = item.status !== "in_progress"; const statusLabel = item.status === "in_progress" ? "IN PROGRESS" : item.status === "expired" ? "TIME EXPIRED" : passed ? "PASSED" : item.passingMarks > 0 ? "REVIEW" : "COMPLETED"; const tone = item.status === "in_progress" ? "neutral" : item.status === "expired" ? "saffron" : passed || item.passingMarks === 0 ? "green" : "saffron"; return <Pressable onPress={() => router.push(`/test/${item.testId}${completed ? `?attemptId=${item.attemptId}` : ""}` as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardTop}><View style={styles.icon}><MaterialIcons name="assignment" size={22} color={COLORS.indigo} /></View><View style={styles.copy}><Text numberOfLines={2} style={styles.testTitle}>{item.testTitle}</Text><Text numberOfLines={1} style={styles.course}>{item.courseTitle ?? "General practice"}</Text></View><Tag label={statusLabel} tone={tone} /></View><View style={styles.metrics}><View><Text style={styles.metricLabel}>SCORE</Text><Text style={styles.metricValue}>{completed ? `${item.score}/${item.totalMarks}` : "In progress"}</Text></View><View><Text style={styles.metricLabel}>TIME USED</Text><Text style={styles.metricValue}>{formatElapsed(item.elapsedSeconds)} / {item.durationMinutes}m</Text></View></View><View style={styles.cardFooter}><Text style={styles.date}>{formatAttemptDate(item.startedAt)}</Text><View style={styles.open}><Text style={styles.openText}>{completed ? "View explanation" : "Resume"}</Text><MaterialIcons name="chevron-right" size={18} color={COLORS.indigo} /></View></View></Pressable>; }} /></ScreenContainer>;
}

function HistoryMetric({ icon, label, value }: { icon: "assignment-turned-in" | "emoji-events" | "verified"; label: string; value: string }) {
  return <View style={styles.summaryMetric}><MaterialIcons name={icon} size={16} color={COLORS.indigo} /><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center" },
  list: { paddingBottom: 36, gap: 12 },
  helper: { borderRadius: 15, padding: 12, backgroundColor: COLORS.indigoSoft, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  helperText: { flex: 1, color: COLORS.indigo, fontSize: 12, lineHeight: 18 },
  summary: { flexDirection: "row", gap: 8, marginTop: 11 },
  summaryMetric: { flex: 1, minHeight: 70, borderRadius: 14, padding: 9, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line },
  summaryLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900", marginTop: 4, letterSpacing: 0.5 },
  summaryValue: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 2 },
  empty: { paddingTop: 78 },
  card: { borderRadius: 19, padding: 14, gap: 13, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  copy: { flex: 1, gap: 4 },
  testTitle: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  course: { color: COLORS.indigo, fontSize: 11, fontWeight: "700" },
  metrics: { flexDirection: "row", gap: 28, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 11 },
  metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  metricValue: { color: COLORS.ink, marginTop: 3, fontSize: 13, fontWeight: "800" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { color: COLORS.muted, fontSize: 11 },
  open: { flexDirection: "row", alignItems: "center" },
  openText: { color: COLORS.indigo, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
