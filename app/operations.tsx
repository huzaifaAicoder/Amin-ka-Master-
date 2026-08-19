import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

const metrics = [
  { key: "students", label: "Students", icon: "groups" as const, color: COLORS.indigo, background: COLORS.indigoSoft },
  { key: "courses", label: "Courses", icon: "menu-book" as const, color: COLORS.earth, background: "#FFF0DE" },
  { key: "enrollments", label: "Enrollments", icon: "school" as const, color: COLORS.green, background: COLORS.greenSoft },
  { key: "upcomingLiveClasses", label: "Upcoming live", icon: "videocam" as const, color: COLORS.red, background: "#FDECEA" },
] as const;

export default function OperationsScreen() {
  const router = useRouter();
  const { user, logout } = useLmsSession();
  const [isExiting, setIsExiting] = useState(false);
  const summaryQuery = trpc.operations.summary.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: 1, staleTime: 0, refetchOnMount: "always" });
  const coursesQuery = trpc.operations.courses.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: 1, staleTime: 0, refetchOnMount: "always" });
  const managedCourses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const exitStaffPortal = useCallback(async () => {
    if (isExiting) return;
    setIsExiting(true);
    await logout();
    router.replace("/auth");
  }, [isExiting, logout, router]);
  if (!user || user.role === "student") return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="admin-panel-settings" title="Operations access required" body="This area is visible only to authorized teacher, admin and super-admin accounts, with all permission checks repeated on the server." /></View></ScreenContainer>;
  if (summaryQuery.isLoading || coursesQuery.isLoading) return <OperationsSkeleton role={user.role} />;
  if (summaryQuery.isError || coursesQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="wifi-off" title="Operations could not load" body="The dashboard did not receive a complete server response. Check your connection and retry; no totals are shown until live data is available." /><PrimaryButton label="Retry operations" icon="refresh" onPress={() => { void summaryQuery.refetch(); void coursesQuery.refetch(); }} /></View></ScreenContainer>;
  const summary = summaryQuery.data;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === "android"} keyboardShouldPersistTaps="handled"><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Exit staff portal and return to sign in" accessibilityState={{ busy: isExiting }} disabled={isExiting} onPress={exitStaffPortal} hitSlop={10} style={({ pressed }) => [styles.back, (pressed || isExiting) && styles.pressed]}>{isExiting ? <ActivityIndicator size="small" color={COLORS.indigo} /> : <MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} />}</Pressable><Text style={styles.title}>Operations</Text><Tag label={user.role.replace("_", " ").toUpperCase()} tone="saffron" /></View><Text style={styles.subtitle}>A secure operational view. Content changes use server-side role and delegated-permission checks.</Text>{user.role === "super_admin" ? <Pressable accessibilityRole="button" accessibilityLabel="Open Super Admin Control Center" onPress={() => router.push("/operations/control" as never)} style={({ pressed }) => [styles.controlCenter, pressed && styles.pressed]}><IconCircle icon="admin-panel-settings" size={44} color={COLORS.saffron} background="rgba(255,255,255,0.12)" /><View style={styles.controlCopy}><Text style={styles.controlEyebrow}>OWNER CONTROL CENTER</Text><Text style={styles.controlTitle}>Create staff & manage controls</Text><Text style={styles.controlBody}>People, Staff Passkey, settings, enrollments, content operations and audit activity.</Text></View><MaterialIcons name="arrow-forward" size={23} color={COLORS.white} /></Pressable> : null}<View style={styles.managementActions}><PrimaryButton label="Manage courses" icon="edit" onPress={() => router.push("/operations/courses" as never)} /><PrimaryButton label="Course structure & lessons" icon="account-tree" onPress={() => router.push("/operations/structure" as never)} subtle /><PrimaryButton label="Free Playlists & Shorts" icon="video-library" onPress={() => router.push("/operations/media" as never)} subtle /><PrimaryButton label="Manage tests" icon="assignment" onPress={() => router.push("/operations/tests" as never)} subtle /><PrimaryButton label="Schedule live classes" icon="videocam" onPress={() => router.push("/operations/live" as never)} subtle /></View><Text style={styles.metricsHeading}>Operational overview</Text><View style={styles.metricGrid}>{metrics.map((metric) => <MetricCard key={metric.key} metric={metric} value={summary?.[metric.key] ?? 0} />)}</View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Course management</Text><Text style={styles.sectionDetail}>Publishing status</Text></View>{managedCourses.length ? <View style={styles.courseList}>{managedCourses.map((item) => <View key={item.course.id} style={styles.courseRow}><View style={styles.courseIcon}><MaterialIcons name="menu-book" size={21} color={COLORS.indigo} /></View><View style={styles.courseCopy}><Text numberOfLines={1} style={styles.courseTitle}>{item.course.title}</Text><Text style={styles.courseMeta}>{item.categoryName} · {item.instructorName ?? "Unassigned"}</Text></View><Tag label={item.course.status.toUpperCase()} tone={item.course.status === "published" ? "green" : item.course.status === "draft" ? "saffron" : "neutral"} /></View>)}</View> : <View style={styles.emptyCourses}><EmptyState icon="menu-book" title="No courses to manage" body="Create a category and course from the Control Center." /></View>}<View style={styles.boundary}><MaterialIcons name="verified-user" size={19} color={COLORS.green} /><Text style={styles.boundaryText}>Recorded media is uploaded through protected staff storage. Keep mobile uploads short and optimized for low-data connections.</Text></View></ScrollView></ScreenContainer>;
}

const MetricCard = ({ metric, value }: { metric: (typeof metrics)[number]; value: number }) => <View style={styles.metric}><IconCircle icon={metric.icon} color={metric.color} background={metric.background} size={38} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{metric.label}</Text></View>;

function OperationsSkeleton({ role }: { role: "teacher" | "admin" | "super_admin" }) {
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === "android"} accessibilityLabel="Loading operations dashboard" accessibilityLiveRegion="polite"><View style={styles.header}><View style={styles.back}><SkeletonBlock width={20} height={20} radius={8} /></View><SkeletonBlock width={122} height={23} radius={8} /><SkeletonBlock width={82} height={28} radius={14} /></View><View style={styles.skeletonSubtitle}><SkeletonBlock width="92%" height={13} radius={6} /><SkeletonBlock width="72%" height={13} radius={6} /></View>{role === "super_admin" ? <View style={styles.skeletonControl}><SkeletonBlock width={44} height={44} radius={18} /><View style={styles.skeletonControlCopy}><SkeletonBlock width="45%" height={10} radius={5} /><SkeletonBlock width="82%" height={18} radius={7} /><SkeletonBlock width="96%" height={11} radius={5} /></View></View> : null}<View style={styles.managementActions}>{[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} width="100%" height={48} radius={15} />)}</View><SkeletonBlock width={164} height={20} radius={7} style={styles.skeletonHeading} /><View style={styles.metricGrid}>{metrics.map((metric) => <View key={metric.key} style={styles.metric}><SkeletonBlock width={38} height={38} radius={19} /><SkeletonBlock width="46%" height={24} radius={7} /><SkeletonBlock width="68%" height={12} radius={5} /></View>)}</View><View style={styles.sectionHeader}><SkeletonBlock width={146} height={19} radius={7} /><SkeletonBlock width={86} height={12} radius={5} /></View><View style={styles.courseList}>{[0, 1].map((item) => <View key={item} style={styles.courseRow}><SkeletonBlock width={39} height={39} radius={13} /><View style={styles.skeletonCourseCopy}><SkeletonBlock width="72%" height={13} radius={5} /><SkeletonBlock width="54%" height={11} radius={5} /></View><SkeletonBlock width={58} height={22} radius={11} /></View>)}</View></ScrollView></ScreenContainer>;
}

function SkeletonBlock({ width, height, radius, style }: { width: number | `${number}%`; height: number; radius: number; style?: object }) {
  return <View style={[styles.skeletonBlock, { width, height, borderRadius: radius }, style]} />;
}


const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 36 },
  header: { paddingTop: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  center: { flex: 1, justifyContent: "center" },
  emptyCourses: { minHeight: 180, justifyContent: "center" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48.5%", flexGrow: 1, minHeight: 123, borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 13, gap: 6 },
  metricValue: { color: COLORS.ink, fontSize: 25, fontWeight: "900", marginTop: 2 },
  metricLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  managementActions: { marginTop: 16, gap: 9 },
  metricsHeading: { marginTop: 24, marginBottom: 10, color: COLORS.ink, fontSize: 16, fontWeight: "900" },
  controlCenter: { marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: COLORS.indigo, flexDirection: "row", gap: 11, alignItems: "center" },
  controlCopy: { flex: 1, gap: 2 },
  controlEyebrow: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  controlTitle: { color: COLORS.white, fontSize: 17, fontWeight: "900" },
  controlBody: { color: "#D6DFF2", fontSize: 11, lineHeight: 16 },
  skeletonBlock: { backgroundColor: "#E9EDF3" },
  skeletonSubtitle: { gap: 7, marginBottom: 16 },
  skeletonControl: { marginTop: 16, minHeight: 100, padding: 14, borderRadius: 20, backgroundColor: "#E7ECF5", flexDirection: "row", gap: 11, alignItems: "center" },
  skeletonControlCopy: { flex: 1, gap: 8 },
  skeletonHeading: { marginTop: 24, marginBottom: 10 },
  skeletonCourseCopy: { flex: 1, gap: 7 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  sectionHeader: { marginTop: 25, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "800" },
  sectionDetail: { color: COLORS.muted, fontSize: 11 },
  courseList: { gap: 9, paddingBottom: 12 },
  courseRow: { minHeight: 70, borderRadius: 18, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, padding: 12, gap: 10, flexDirection: "row", alignItems: "center" },
  courseIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" },
  courseCopy: { flex: 1, gap: 4 },
  courseTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "800" },
  courseMeta: { color: COLORS.muted, fontSize: 11 },
  boundary: { marginTop: 6, borderRadius: 15, padding: 13, flexDirection: "row", gap: 9, backgroundColor: "#F4FBF7", alignItems: "flex-start" },
  boundaryText: { flex: 1, color: COLORS.green, fontSize: 12, lineHeight: 17 },
});
