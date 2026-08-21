import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Card, COLORS, IconCircle, PrimaryButton, ProgressBar, SectionHeading, Tag, formatPrice } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";
import { usePanelRefresh } from "@/hooks/use-panel-refresh";
import { useLanguagePreference, type InterfaceLanguage } from "@/lib/language-preference";
import { WeeklyLearningGraph } from "@/components/study-planner";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const { language, setLanguage } = useLanguagePreference();
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const settingsQuery = trpc.catalog.uiSettings.useQuery();
  const coursesQuery = trpc.catalog.courses.useQuery();
  const learningQuery = trpc.student.learning.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const liveQuery = trpc.student.liveClasses.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const aiQuizStatsQuery = trpc.student.aiQuizStats.useQuery(undefined, { enabled: user?.role === "student", retry: false });
  const studyCoachQuery = trpc.student.studyCoach.useQuery(undefined, { enabled: user?.role === "student", retry: false });
  const { refreshing, onRefresh } = usePanelRefresh([categoriesQuery.refetch, settingsQuery.refetch, coursesQuery.refetch, learningQuery.refetch, liveQuery.refetch, aiQuizStatsQuery.refetch, studyCoachQuery.refetch]);
  const activeLearning = learningQuery.data?.[0];
  const upcomingClass = liveQuery.data?.[0];
  const publicSettings = settingsQuery.data ?? {};
  const appName = typeof publicSettings["brand.app_name"] === "string" ? publicSettings["brand.app_name"] : "Amin Ka Master";
  const heroTitle = typeof publicSettings["homepage.hero_title"] === "string" ? publicSettings["homepage.hero_title"] : "Build field confidence, one lesson at a time.";
  const heroSubtitle = typeof publicSettings["homepage.hero_subtitle"] === "string" ? publicSettings["homepage.hero_subtitle"] : "Practical surveying and Amin exam preparation, organised around your next step.";
  const heroCta = typeof publicSettings["homepage.hero_cta"] === "string" ? publicSettings["homepage.hero_cta"] : user ? "Explore courses" : "Start learning";
  const showLive = typeof publicSettings["homepage.show_live"] === "boolean" ? publicSettings["homepage.show_live"] : true;
  const cycleLanguage = () => { const next: Record<InterfaceLanguage, InterfaceLanguage> = { english: "hindi", hindi: "bilingual", bilingual: "english" }; void setLanguage(next[language]); };

  return (
    <ScreenContainer containerClassName="bg-background" className="px-5" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.indigo]} tintColor={COLORS.indigo} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{user ? "YOUR LEARNING SPACE" : "LEARN. MEASURE. MASTER."}</Text>
            <Text style={styles.greeting}>{user?.fullName ? `Hello, ${user.fullName.split(" ")[0]}` : appName}</Text>
          </View>
          <View style={styles.headerActions}><Pressable accessibilityLabel={`Change interface language, currently ${language}`} onPress={cycleLanguage} style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}><MaterialIcons name="translate" size={22} color={COLORS.indigo} /></Pressable><Pressable accessibilityLabel="Notifications" onPress={() => user ? router.push("/notifications") : router.push("/auth")} style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}><MaterialIcons name="notifications-none" size={24} color={COLORS.indigo} /></Pressable></View>
        </View>

        {activeLearning ? (
          <Card style={styles.continueCard}>
            <View style={styles.continueTop}><Tag label="CONTINUE LEARNING" tone="saffron" /><Text style={styles.percent}>{Math.round((activeLearning.progress.completedLessons / Math.max(activeLearning.progress.lessonCount, 1)) * 100)}%</Text></View>
            <Text style={styles.continueTitle}>{activeLearning.course.title}</Text>
            <Text style={styles.continueBody}>{activeLearning.progress.completedLessons} of {activeLearning.progress.lessonCount} lessons complete</Text>
            <ProgressBar value={activeLearning.progress.completedLessons / Math.max(activeLearning.progress.lessonCount, 1)} color={COLORS.saffron} />
            <PrimaryButton label="Resume course" icon="play-arrow" onPress={() => router.push(`/course/${activeLearning.course.slug}`)} />
          </Card>
        ) : (
          <View style={styles.hero}>
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>{heroTitle}</Text><Text style={styles.heroBody}>{heroSubtitle}</Text></View>
            <IconCircle icon="terrain" size={64} color={COLORS.saffron} background="rgba(255,255,255,0.12)" />
            <PrimaryButton label={heroCta} icon="arrow-forward" onPress={() => user ? router.push("/explore") : router.push("/auth")} subtle />
          </View>
        )}

        {showLive && upcomingClass ? (
          <Pressable onPress={() => router.push("/live")} style={({ pressed }) => [styles.liveStrip, pressed && styles.pressed]}>
            <IconCircle icon="videocam" size={38} color={COLORS.green} background={COLORS.greenSoft} />
            <View style={styles.liveCopy}><Text style={styles.liveLabel}>UPCOMING LIVE CLASS</Text><Text numberOfLines={1} style={styles.liveTitle}>{upcomingClass.liveClass.title}</Text><Text style={styles.liveMeta}>{new Date(upcomingClass.liveClass.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text></View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.muted} />
          </Pressable>
        ) : null}
        {user?.role === "student" ? <Pressable accessibilityRole="button" accessibilityLabel="Open AI Doubt Solver" onPress={() => router.push("/ask-ai")} style={({ pressed }) => [styles.askAi, pressed && styles.pressed]}><IconCircle icon="auto-awesome" size={42} color={COLORS.saffron} background="rgba(255,255,255,0.13)" /><View style={styles.askAiCopy}><Text style={styles.askAiLabel}>STUDY TOOL</Text><Text style={styles.askAiTitle}>Ask AI · Doubt Solver</Text><Text style={styles.askAiBody}>Ask a course doubt, then practise it with a private AI Quiz.</Text></View><MaterialIcons name="arrow-forward" size={23} color={COLORS.white} /></Pressable> : null}
        {user?.role === "student" ? <Pressable accessibilityRole="button" accessibilityLabel="Open AI Quiz" onPress={() => router.push("/ai-quiz")} style={({ pressed }) => [styles.quizAverage, pressed && styles.pressed]}><IconCircle icon="quiz" size={42} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.quizAverageCopy}><Text style={styles.quizAverageLabel}>AI QUIZ AVERAGE</Text>{aiQuizStatsQuery.isLoading ? <Text style={styles.quizAverageTitle}>Loading practice history…</Text> : <><Text style={styles.quizAverageTitle}>{aiQuizStatsQuery.data?.totalAttempts ? `${aiQuizStatsQuery.data.averageScore}% average score` : "Start your first private quiz"}</Text><Text style={styles.quizAverageBody}>{aiQuizStatsQuery.data?.totalAttempts ? `${aiQuizStatsQuery.data.totalAttempts} completed practice ${aiQuizStatsQuery.data.totalAttempts === 1 ? "set" : "sets"} · adaptive difficulty ready` : "Timed practice with answers explained after submission."}</Text></>}</View><MaterialIcons name="arrow-forward" size={23} color={COLORS.indigo} /></Pressable> : null}
        {user?.role === "student" ? <><Pressable accessibilityRole="button" accessibilityLabel="Open Study Coach" onPress={() => router.push("/study-coach")} style={({ pressed }) => [styles.studyCoach, pressed && styles.pressed]}><IconCircle icon="local-fire-department" size={42} color={COLORS.green} background={COLORS.greenSoft} /><View style={styles.quizAverageCopy}><Text style={styles.studyCoachLabel}>PERSONAL STUDY COACH</Text>{studyCoachQuery.isLoading ? <Text style={styles.quizAverageTitle}>Preparing your next step…</Text> : <><Text style={styles.quizAverageTitle}>{studyCoachQuery.data?.currentStreakDays ? `${studyCoachQuery.data.currentStreakDays}-day learning streak` : "Plan your next study step"}</Text><Text style={styles.quizAverageBody}>{studyCoachQuery.data ? `${studyCoachQuery.data.overallProgressPercent}% course progress · ${studyCoachQuery.data.revisionPriorities.length} revision ${studyCoachQuery.data.revisionPriorities.length === 1 ? "priority" : "priorities"}` : "Daily plan, weak-topic insights, and private offline reports."}</Text></>}</View><MaterialIcons name="arrow-forward" size={23} color={COLORS.green} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open Performance Insights" onPress={() => router.push("/performance" as never)} style={({ pressed }) => [styles.quizAverage, pressed && styles.pressed]}><IconCircle icon="insights" size={42} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.quizAverageCopy}><Text style={styles.quizAverageLabel}>PERFORMANCE INSIGHTS</Text><Text style={styles.quizAverageTitle}>Your learning evidence, clearly explained</Text><Text style={styles.quizAverageBody}>Review course completion, private practice, and revision focus without public ranking.</Text></View><MaterialIcons name="arrow-forward" size={23} color={COLORS.indigo} /></Pressable><WeeklyLearningGraph userId={user.id} /></> : null}
        {user?.role === "student" ? <Pressable accessibilityRole="button" accessibilityLabel="Open Amin Master Toolkit" onPress={() => router.push("/amin-toolkit" as never)} style={({ pressed }) => [styles.studyCoach, pressed && styles.pressed]}><IconCircle icon="terrain" size={42} color={COLORS.saffron} background="#FFF2D5" /><View style={styles.quizAverageCopy}><Text style={styles.studyCoachLabel}>AMIN MASTER TOOLKIT</Text><Text style={styles.quizAverageTitle}>Practical field-learning tools</Text><Text style={styles.quizAverageBody}>Estimate a GPS plot area, browse official portals, and plot directions with your device compass.</Text></View><MaterialIcons name="arrow-forward" size={23} color={COLORS.saffron} /></Pressable> : null}
        <SectionHeading title="Study by topic" action="Explore" onPress={() => router.push("/explore")} />
        {categoriesQuery.isLoading ? <ActivityIndicator color={COLORS.indigo} /> : <FlatList horizontal showsHorizontalScrollIndicator={false} data={categoriesQuery.data ?? []} contentContainerStyle={styles.categories} keyExtractor={(item) => item.id.toString()} renderItem={({ item, index }) => <Pressable onPress={() => router.push(`/explore?category=${item.slug}`)} style={({ pressed }) => [styles.categoryCard, index % 2 === 1 && styles.categoryCardWarm, pressed && styles.pressed]}><MaterialIcons name={index % 2 === 0 ? "straighten" : "account-balance"} size={23} color={COLORS.indigo} /><Text style={styles.categoryText}>{item.name}</Text></Pressable>} />}

        <SectionHeading title="Featured courses" action="See all" onPress={() => router.push("/explore")} />
        {coursesQuery.isLoading ? <ActivityIndicator color={COLORS.indigo} /> : <FlatList horizontal showsHorizontalScrollIndicator={false} data={(coursesQuery.data ?? []).slice(0, 4)} contentContainerStyle={styles.courses} keyExtractor={(item) => item.course.id.toString()} renderItem={({ item, index }) => <Pressable onPress={() => router.push(`/course/${item.course.slug}`)} style={({ pressed }) => [styles.courseCard, pressed && styles.pressed]}><View style={[styles.courseVisual, index % 2 === 1 && styles.courseVisualSaffron]}><MaterialIcons name={index % 2 === 1 ? "school" : "map"} size={30} color={COLORS.white} /><Tag label={item.course.accessType === "free" ? "FREE COURSE" : "PREMIUM"} tone={item.course.accessType === "free" ? "green" : "saffron"} /></View><Text numberOfLines={2} style={styles.courseTitle}>{item.course.title}</Text><Text numberOfLines={1} style={styles.courseMeta}>{item.instructorName ?? "Amin Ka Master Faculty"}</Text><Text style={styles.coursePrice}>{formatPrice(item.course.sellingPrice)}</Text></Pressable>} />}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 110 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, headerActions: { flexDirection: "row", gap: 8 },
  eyebrow: { color: COLORS.earth, fontWeight: "800", fontSize: 10, letterSpacing: 1.2 },
  greeting: { color: COLORS.ink, fontSize: 27, fontWeight: "800", marginTop: 4 },
  notificationButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line },
  hero: { borderRadius: 24, padding: 20, backgroundColor: COLORS.indigo, minHeight: 250, justifyContent: "space-between" },
  heroCopy: { gap: 8, maxWidth: 280 },
  heroTitle: { color: COLORS.white, fontSize: 25, lineHeight: 32, fontWeight: "800" },
  heroBody: { color: "#D6DFF2", fontSize: 14, lineHeight: 20 },
  continueCard: { borderColor: "#C9D3EC", gap: 12, backgroundColor: "#F9FBFF" },
  continueTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  percent: { fontSize: 15, fontWeight: "800", color: COLORS.indigo },
  continueTitle: { fontSize: 21, lineHeight: 28, fontWeight: "800", color: COLORS.ink },
  continueBody: { fontSize: 13, color: COLORS.muted },
  liveStrip: { marginTop: 16, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: "#CBE7D9", backgroundColor: "#F4FBF7", flexDirection: "row", alignItems: "center", gap: 10 },
  liveCopy: { flex: 1, gap: 2 },
  liveLabel: { color: COLORS.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  liveTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  liveMeta: { color: COLORS.muted, fontSize: 12 },
  askAi: { marginTop: 16, padding: 13, borderRadius: 19, backgroundColor: COLORS.indigo, flexDirection: "row", alignItems: "center", gap: 10 },
  askAiCopy: { flex: 1, gap: 2 },
  askAiLabel: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  askAiTitle: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  askAiBody: { color: "#D6DFF2", fontSize: 11, lineHeight: 16 },
  quizAverage: { marginTop: 12, padding: 13, borderRadius: 19, backgroundColor: COLORS.white, borderWidth: 1, borderColor: "#C9D3EC", flexDirection: "row", alignItems: "center", gap: 10 },
  quizAverageCopy: { flex: 1, gap: 2 },
  quizAverageLabel: { color: COLORS.indigo, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  quizAverageTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "900" },
  quizAverageBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  studyCoach: { marginTop: 12, padding: 13, borderRadius: 19, backgroundColor: "#F4FBF7", borderWidth: 1, borderColor: "#ABEFC6", flexDirection: "row", alignItems: "center", gap: 10 },
  studyCoachLabel: { color: COLORS.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  previewAdmin: { marginTop: 16, padding: 13, borderRadius: 19, backgroundColor: COLORS.indigo, flexDirection: "row", gap: 10, alignItems: "center" },
  previewCopy: { flex: 1, gap: 2 },
  previewLabel: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  previewTitle: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  previewBody: { color: "#D6DFF2", fontSize: 11, lineHeight: 16 },
  categories: { gap: 10, paddingRight: 20 },
  categoryCard: { width: 136, minHeight: 105, borderRadius: 18, padding: 14, gap: 15, backgroundColor: "#EAF0FA", justifyContent: "space-between" },
  categoryCardWarm: { backgroundColor: "#FFF1DE" },
  categoryText: { color: COLORS.ink, fontWeight: "800", fontSize: 14, lineHeight: 18 },
  courses: { gap: 14, paddingRight: 20 },
  courseCard: { width: 208, borderRadius: 20, overflow: "hidden", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, paddingBottom: 14 },
  courseVisual: { height: 112, padding: 14, backgroundColor: COLORS.indigo, justifyContent: "space-between", alignItems: "flex-start" },
  courseVisualSaffron: { backgroundColor: COLORS.earth },
  courseTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 16, lineHeight: 21, marginHorizontal: 14, marginTop: 13, minHeight: 42 },
  courseMeta: { color: COLORS.muted, fontSize: 12, marginHorizontal: 14, marginTop: 4 },
  coursePrice: { color: COLORS.indigo, fontWeight: "900", fontSize: 14, marginHorizontal: 14, marginTop: 10 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
