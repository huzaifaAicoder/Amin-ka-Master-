import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Card, COLORS, IconCircle, PrimaryButton, ProgressBar, SectionHeading, Tag, formatPrice } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const coursesQuery = trpc.catalog.courses.useQuery();
  const learningQuery = trpc.student.learning.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const liveQuery = trpc.student.liveClasses.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const activeLearning = learningQuery.data?.[0];
  const upcomingClass = liveQuery.data?.[0];

  return (
    <ScreenContainer containerClassName="bg-background" className="px-5" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{user ? "YOUR LEARNING SPACE" : "LEARN. MEASURE. MASTER."}</Text>
            <Text style={styles.greeting}>{user?.fullName ? `Hello, ${user.fullName.split(" ")[0]}` : "Amin Ka Master"}</Text>
          </View>
          <Pressable accessibilityLabel="Notifications" onPress={() => user ? router.push("/notifications") : router.push("/auth")} style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}>
            <MaterialIcons name="notifications-none" size={24} color={COLORS.indigo} />
          </Pressable>
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
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>Build field confidence, one lesson at a time.</Text><Text style={styles.heroBody}>Practical surveying and Amin exam preparation, organised around your next step.</Text></View>
            <IconCircle icon="terrain" size={64} color={COLORS.saffron} background="rgba(255,255,255,0.12)" />
            <PrimaryButton label={user ? "Explore courses" : "Start learning"} icon="arrow-forward" onPress={() => user ? router.push("/explore") : router.push("/auth")} subtle />
          </View>
        )}

        {upcomingClass ? (
          <Pressable onPress={() => router.push("/live")} style={({ pressed }) => [styles.liveStrip, pressed && styles.pressed]}>
            <IconCircle icon="videocam" size={38} color={COLORS.green} background={COLORS.greenSoft} />
            <View style={styles.liveCopy}><Text style={styles.liveLabel}>UPCOMING LIVE CLASS</Text><Text numberOfLines={1} style={styles.liveTitle}>{upcomingClass.liveClass.title}</Text><Text style={styles.liveMeta}>{new Date(upcomingClass.liveClass.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text></View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.muted} />
          </Pressable>
        ) : null}

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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
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
