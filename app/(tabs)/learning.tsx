import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, ProgressBar, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";
import { usePanelRefresh } from "@/hooks/use-panel-refresh";

export default function LearningScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const learningQuery = trpc.student.learning.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const { refreshing, onRefresh } = usePanelRefresh([learningQuery.refetch]);

  if (!user) {
    return <ScreenContainer className="px-5"><View style={styles.unauthWrap}><EmptyState icon="lock-person" title="Your library is waiting" body="Sign in to save enrollments, progress, bookmarks and personal notes across your devices." action={<Pressable onPress={() => router.push("/auth")} style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}><Text style={styles.signInText}>Sign in to learn</Text></Pressable>} /></View></ScreenContainer>;
  }

  if (learningQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <View style={styles.header}><Text style={styles.title}>My learning</Text><Text style={styles.subtitle}>Pick up exactly where you left off.</Text></View>
      {learningQuery.data?.length ? <FlatList data={learningQuery.data} keyExtractor={(item) => item.enrollment.id.toString()} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.indigo]} tintColor={COLORS.indigo} />} contentContainerStyle={styles.list} renderItem={({ item, index }) => { const progress = item.progress.completedLessons / Math.max(item.progress.lessonCount, 1); return <Pressable onPress={() => router.push(`/course/${item.course.slug}`)} style={({ pressed }) => [styles.courseCard, pressed && styles.pressed]}><View style={[styles.cover, index % 2 === 1 && styles.coverEarth]}><MaterialIcons name={index % 2 === 1 ? "school" : "map"} size={30} color={COLORS.white} /></View><View style={styles.courseContent}><View style={styles.topLine}><Tag label={item.enrollment.status === "active" ? "ACTIVE" : item.enrollment.status.toUpperCase()} tone={item.enrollment.status === "active" ? "green" : "red"} /><Text style={styles.progressText}>{Math.round(progress * 100)}%</Text></View><Text numberOfLines={2} style={styles.courseTitle}>{item.course.title}</Text><Text style={styles.lessonText}>{item.progress.completedLessons} of {item.progress.lessonCount} lessons complete</Text><ProgressBar value={progress} /></View><MaterialIcons name="chevron-right" size={23} color="#98A2B3" /></Pressable>; }} /> : <EmptyState icon="menu-book" title="No enrolled courses yet" body="Browse a foundation course and enroll to create your personal learning plan." action={<Pressable onPress={() => router.push("/explore")} style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}><Text style={styles.signInText}>Browse courses</Text></Pressable>} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, marginBottom: 18 },
  title: { color: COLORS.ink, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.muted, marginTop: 5, fontSize: 14 },
  unauthWrap: { flex: 1, justifyContent: "center" },
  list: { paddingBottom: 106, gap: 12 },
  courseCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, padding: 12, gap: 12, flexDirection: "row", alignItems: "center" },
  cover: { width: 72, height: 98, borderRadius: 14, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" },
  coverEarth: { backgroundColor: COLORS.earth },
  courseContent: { flex: 1, gap: 7 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressText: { color: COLORS.indigo, fontWeight: "900", fontSize: 13 },
  courseTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "800", lineHeight: 21 },
  lessonText: { color: COLORS.muted, fontSize: 12 },
  signInButton: { marginTop: 6, minHeight: 44, borderRadius: 14, paddingHorizontal: 17, justifyContent: "center", backgroundColor: COLORS.indigo },
  signInText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
