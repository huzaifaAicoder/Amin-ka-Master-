import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { ScreenContainer } from "@/components/screen-container";
import { usePanelRefresh } from "@/hooks/use-panel-refresh";
import { useLmsSession } from "@/lib/lms-session";
import { buildGuardianProgressPdfHtml, type GuardianProgressPdfReport } from "@/lib/guardian-report-pdf";
import { trpc } from "@/lib/trpc";

type GuardianReport = GuardianProgressPdfReport & { studentUserId: number; guardianContact: string };

export default function GuardianReportsOperationsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const [sharingId, setSharingId] = useState<number | null>(null);
  const reportsQuery = trpc.operations.guardianReports.useQuery(undefined, { enabled: Boolean(user && user.role !== "student" && user.role !== "developer"), retry: false });
  const recordShare = trpc.operations.recordGuardianReportShare.useMutation();
  const { refreshing, onRefresh } = usePanelRefresh([reportsQuery.refetch]);
  const share = async (report: GuardianReport) => {
    if (Platform.OS === "web") return Alert.alert("Native app required", "For privacy, guardian reports can be explicitly shared from the Android or iOS app. Web does not share local report files.");
    setSharingId(report.studentUserId);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) throw new Error("The system share sheet is unavailable on this device.");
      const file = await Print.printToFileAsync({ html: buildGuardianProgressPdfHtml(report) });
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `Share progress report for ${report.studentName}` });
      await recordShare.mutateAsync({ studentUserId: report.studentUserId });
      Alert.alert("Share action recorded", "The Student was notified that an authorized guardian-report share action was initiated.");
    } catch (error) { Alert.alert("Report could not be shared", error instanceof Error ? error.message : "Please try again."); }
    finally { setSharingId(null); }
  };
  if (!user || user.role === "student" || user.role === "developer") return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="family-restroom" title="Staff access required" body="Guardian progress reports are available only to authorized staff or Owner accounts." /></View></ScreenContainer>;
  if (reportsQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loading}>Loading consented guardian reports…</Text></View></ScreenContainer>;
  if (reportsQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock" title="Guardian reports unavailable" body="Your account needs the guardian-report permission or the service could not be reached." /><PrimaryButton label="Retry" icon="refresh" onPress={() => void reportsQuery.refetch()} /></View></ScreenContainer>;
  const reports = (reportsQuery.data ?? []) as GuardianReport[];
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><FlatList data={reports} keyExtractor={(item) => item.studentUserId.toString()} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.indigo]} tintColor={COLORS.indigo} />} contentContainerStyle={styles.content} ListHeaderComponent={<><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Operations" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>Guardian reports</Text><Text style={styles.sub}>Consented aggregate progress only</Text></View><Tag label="STAFF" tone="saffron" /></View><View style={styles.boundary}><MaterialIcons name="verified-user" size={21} color={COLORS.green} /><View style={{ flex: 1 }}><Text style={styles.boundaryTitle}>Explicit delivery boundary</Text><Text style={styles.boundaryBody}>Only Students who opted in appear here. Choose Share to create a one-time local PDF and open the native share sheet; the platform does not automatically message a guardian.</Text></View></View><Text style={styles.section}>Consented report queue</Text></>} ListEmptyComponent={<EmptyState icon="verified" title="No consented reports waiting" body="A Student must add a guardian contact and explicitly opt in before their aggregate progress appears here." />} renderItem={({ item }) => <View style={styles.card}><View style={styles.cardTop}><IconCircle icon="school" size={40} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={{ flex: 1 }}><Text style={styles.student}>{item.studentName}</Text><Text style={styles.guardian}>Selected guardian: {item.guardianName}</Text></View><Tag label="CONSENTED" tone="green" /></View><View style={styles.metrics}><Metric value={item.summary.activeCourseCount} label="Active courses" /><Metric value={`${item.summary.overallProgressPercent}%`} label="Progress" /><Metric value={item.summary.currentStreakDays} label="Day streak" /></View><Text style={styles.guidance}>{item.summary.guidance}</Text><Text style={styles.contact}>Share destination chosen by staff: {item.guardianContact}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Share guardian report for ${item.studentName}`} disabled={sharingId === item.studentUserId || recordShare.isPending} onPress={() => void share(item)} style={({ pressed }) => [styles.share, (pressed || sharingId === item.studentUserId) && styles.pressed]}>{sharingId === item.studentUserId ? <ActivityIndicator size="small" color={COLORS.white} /> : <MaterialIcons name="ios-share" size={19} color={COLORS.white} />}<Text style={styles.shareText}>{sharingId === item.studentUserId ? "Preparing report…" : "Create & share consented PDF"}</Text></Pressable></View>} /></ScreenContainer>;
}

function Metric({ value, label }: { value: string | number; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
const styles = StyleSheet.create({ center: { flex: 1, justifyContent: "center", gap: 14 }, loading: { color: COLORS.muted, textAlign: "center", marginTop: 10 }, content: { padding: 16, paddingBottom: 36, gap: 10 }, header: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, title: { color: COLORS.ink, fontSize: 20, fontWeight: "900" }, sub: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, boundary: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 13, borderRadius: 17, backgroundColor: "#F4FBF7", borderWidth: 1, borderColor: "#ABEFC6" }, boundaryTitle: { color: COLORS.green, fontSize: 13, fontWeight: "900" }, boundaryBody: { color: "#2B684C", fontSize: 11, lineHeight: 17, marginTop: 3 }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 7 }, card: { gap: 11, padding: 13, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, cardTop: { flexDirection: "row", alignItems: "center", gap: 9 }, student: { color: COLORS.ink, fontSize: 14, fontWeight: "900" }, guardian: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, metrics: { flexDirection: "row", gap: 7 }, metric: { flex: 1, padding: 9, borderRadius: 12, backgroundColor: COLORS.indigoSoft }, metricValue: { color: COLORS.indigo, fontSize: 17, fontWeight: "900" }, metricLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "800", marginTop: 2 }, guidance: { color: COLORS.ink, fontSize: 12, lineHeight: 18, fontWeight: "700" }, contact: { color: COLORS.muted, fontSize: 10, lineHeight: 15 }, share: { minHeight: 43, borderRadius: 13, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, shareText: { color: COLORS.white, fontSize: 12, fontWeight: "900" }, pressed: { opacity: .74, transform: [{ scale: .985 }] } });
