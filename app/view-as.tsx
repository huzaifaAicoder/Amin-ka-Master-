import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, EmptyState, Tag } from "@/components/lms-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

const labels: Record<string, string> = { courses: "Courses & learning", assessments: "Assessments", live_classes: "Live classes", shorts: "Shorts", downloads: "Offline downloads", ai_doubt: "AI Doubt Solver", ai_quiz: "AI Quiz" };
type PreviewTarget = { id: number; fullName: string | null; role: "student" | "teacher" | "admin" | "super_admin" | "developer"; status: "active" | "suspended"; canUploadShorts: boolean; permissions: string[]; studentFeatureOverrides: Record<string, boolean> };

export default function ViewAsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const { mutateAsync: previewUser, isPending: previewPending } = trpc.developer.viewAsPreview.useMutation();

  useEffect(() => {
    const id = Number(userId);
    if (user?.role !== "developer" || !Number.isInteger(id) || id <= 0) return;
    void previewUser({ userId: id }).then(setTarget).catch(() => undefined);
  }, [previewUser, user?.role, userId]);

  if (user?.role !== "developer") return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="lock" title="Developer access required" body="View As is available only to the verified Developer account." /></ScreenContainer>;
  if (previewPending || !target) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  const roleLabel = target.role === "super_admin" ? "Owner" : target.role === "teacher" ? "Teacher" : target.role === "admin" ? "Admin" : "Student";
  const visibleFeatures = target.role === "student" ? Object.entries(labels).filter(([feature]) => target.studentFeatureOverrides[feature] !== false).map(([, label]) => label) : target.role === "teacher" ? target.permissions : ["Business controls", "Staff management", "Course management", "Reports"];

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><Stack.Screen options={{ headerShown: false }} /><ScrollView contentContainerStyle={styles.content}><Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={20} color={COLORS.indigo} /><Text style={styles.backText}>Developer Control Center</Text></Pressable><View style={styles.banner}><MaterialIcons name="visibility" size={22} color={COLORS.saffron} /><View style={{ flex: 1 }}><Text style={styles.eyebrow}>READ-ONLY VIEW AS</Text><Text style={styles.bannerTitle}>Safe role visibility preview</Text><Text style={styles.bannerCopy}>No target session, credentials, private files, messages, purchase records, or learning data are opened.</Text></View></View><View style={styles.profile}><View style={styles.avatar}><Text style={styles.initial}>{target.fullName?.slice(0, 1).toUpperCase() ?? "U"}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{target.fullName ?? "Unnamed account"}</Text><Text style={styles.meta}>Previewing the visible application surface only</Text></View><Tag label={roleLabel.toUpperCase()} tone={target.status === "active" ? "green" : "saffron"} /></View><Text style={styles.section}>What this account can see</Text>{visibleFeatures.length ? visibleFeatures.map((feature) => <View key={feature} style={styles.feature}><MaterialIcons name="check-circle" size={18} color={COLORS.green} /><Text style={styles.featureText}>{feature.replace(/\./g, " ")}</Text></View>) : <Text style={styles.meta}>No individual staff permissions are currently granted.</Text>}<Text style={styles.section}>Preview safeguards</Text><View style={styles.safeguard}><Text style={styles.safeguardText}>This preview is not an impersonation session. It cannot read, change, submit, download, purchase, or delete anything as the selected account. Opening this page is recorded in the Developer audit log.</Text></View></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 16, paddingBottom: 38, gap: 12 }, back: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 38 }, backText: { color: COLORS.indigo, fontSize: 13, fontWeight: "900" }, banner: { flexDirection: "row", gap: 11, borderRadius: 18, padding: 15, backgroundColor: COLORS.indigo, alignItems: "flex-start" }, eyebrow: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, bannerTitle: { color: COLORS.white, fontSize: 19, fontWeight: "900", marginTop: 3 }, bannerCopy: { color: "#D6DFF2", fontSize: 12, lineHeight: 18, marginTop: 5 }, profile: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }, avatar: { width: 45, height: 45, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, initial: { color: COLORS.indigo, fontSize: 19, fontWeight: "900" }, name: { color: COLORS.ink, fontSize: 17, fontWeight: "900" }, meta: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 8 }, feature: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, paddingHorizontal: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, featureText: { color: COLORS.ink, fontSize: 13, fontWeight: "800", textTransform: "capitalize" }, safeguard: { borderRadius: 15, padding: 13, backgroundColor: "#FFF1DE" }, safeguardText: { color: COLORS.earth, fontSize: 12, lineHeight: 18, fontWeight: "700" } });
