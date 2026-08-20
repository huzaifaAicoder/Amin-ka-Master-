import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ScreenCapture from "expo-screen-capture";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Card, COLORS, IconCircle, OutlineButton, PrimaryButton, Tag, formatPrice } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { clearOfflineDownloadFailure, downloadAuthorizedOfflineResource, recordOfflineDownloadFailure } from "@/lib/offline-resources";
import { trpc } from "@/lib/trpc";

export default function CourseDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useLmsSession();
  const courseQuery = trpc.catalog.course.useQuery({ slug: slug ?? "" }, { enabled: Boolean(slug) });
  const learningQuery = trpc.student.courseLearning.useQuery({ courseId: courseQuery.data?.course.id ?? 0 }, { enabled: Boolean(user && courseQuery.data?.course.id), retry: false });
  const enrollMutation = trpc.student.enrollFree.useMutation({ onSuccess: () => void learningQuery.refetch() });
  const resourceDownloadMutation = trpc.student.requestResourceDownload.useMutation();
  const enrolled = learningQuery.data?.enrolled === true;
  const protectedCourseId = courseQuery.data?.course.id;
  useEffect(() => {
    if (!enrolled || !protectedCourseId || Platform.OS === "web") return;
    const key = `authorized-course-${protectedCourseId}`;
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => { void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined); };
  }, [enrolled, protectedCourseId]);

  if (courseQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  if (courseQuery.isError) return <ScreenContainer className="items-center justify-center px-5"><Card style={styles.errorCard}><Text style={styles.notFound}>Course information could not load. Check your connection and try again.</Text><PrimaryButton label="Retry" icon="refresh" onPress={() => void courseQuery.refetch()} /></Card></ScreenContainer>;
  if (!courseQuery.data) return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.notFound}>This course is not available.</Text></ScreenContainer>;
  const { course, categoryName, instructorName } = courseQuery.data;
  const benefits = Array.isArray(course.benefits) ? course.benefits.filter((item): item is string => typeof item === "string") : [];
  const startLearning = () => {
    const firstLesson = learningQuery.data?.modules[0]?.lessons[0]?.lesson;
    if (firstLesson) router.push(`/lesson/${firstLesson.id}`);
  };
  const enroll = async () => {
    if (!user) return router.push("/auth");
    if (course.accessType !== "free" || Number(course.sellingPrice) !== 0) {
      Alert.alert("Payment connection required", "This paid course is protected by a server-verified payment boundary. Add Razorpay credentials and webhook configuration before accepting live payments.");
      return;
    }
    try {
      await enrollMutation.mutateAsync({ courseId: course.id });
    } catch (cause) {
      Alert.alert("Enrollment unavailable", cause instanceof Error ? cause.message : "Please try again.");
    }
  };
  const downloadOfflineResource = async (resourceId: number, title: string, expectedType: "pdf" | "video") => {
    try {
      const issued = await resourceDownloadMutation.mutateAsync({ resourceId });
      if (Platform.OS === "web") {
        Alert.alert("Native app required", "Private offline resources are available in the Android or iOS app. Browser handoff is intentionally disabled.");
        return;
      }
      const completed = await downloadAuthorizedOfflineResource(issued, title, expectedType);
      await clearOfflineDownloadFailure(resourceId);
      router.push((completed.kind === "pdf" ? { pathname: "/pdf-reader", params: { uri: completed.uri, title } } : { pathname: "/offline-media", params: { uri: completed.uri, title } }) as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your connection and try again.";
      await recordOfflineDownloadFailure({ resourceId, title, kind: expectedType, message });
      Alert.alert("Offline download unavailable", `${message}\n\nYou can retry this item safely from Downloads.`);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><Pressable onPress={() => user ? router.push("/learning") : router.push("/auth")} hitSlop={10} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="bookmark-border" size={22} color={COLORS.indigo} /></Pressable></View>
        <View style={styles.hero}><View style={styles.heroPattern}><MaterialIcons name="map" size={68} color="rgba(255,255,255,0.16)" /></View><Tag label={categoryName.toUpperCase()} tone="saffron" /><Text style={styles.heroTitle}>{course.title}</Text><Text style={styles.heroDescription}>{course.shortDescription}</Text><View style={styles.heroMeta}><View style={styles.metaItem}><MaterialIcons name="person-outline" size={16} color="#D6DFF2" /><Text style={styles.metaText}>{instructorName ?? "Amin Ka Master Faculty"}</Text></View><View style={styles.metaItem}><MaterialIcons name="schedule" size={16} color="#D6DFF2" /><Text style={styles.metaText}>{course.durationLabel ?? "Self-paced"}</Text></View></View></View>
        <View style={styles.priceCard}><View><Text style={styles.price}>{formatPrice(course.sellingPrice)}</Text>{Number(course.mrp) > Number(course.sellingPrice) ? <Text style={styles.mrp}>MRP ₹{Number(course.mrp).toLocaleString("en-IN")}</Text> : <Text style={styles.accessCopy}>{course.accessType === "free" ? "Free enrollment" : `${course.accessDurationDays ?? ""} day access`}</Text>}</View><Tag label={course.accessType === "free" ? "FREE" : "PREMIUM"} tone={course.accessType === "free" ? "green" : "saffron"} /></View>
        {enrolled ? <PrimaryButton label="Start learning" icon="play-arrow" onPress={startLearning} disabled={!learningQuery.data?.modules[0]?.lessons[0]} /> : <PrimaryButton label={enrollMutation.isPending ? "Enrolling…" : course.accessType === "free" ? "Enroll for free" : "Payment setup required"} icon={course.accessType === "free" ? "school" : "lock"} onPress={enroll} disabled={enrollMutation.isPending} />}
        {course.fullDescription ? <><Text style={styles.sectionTitle}>About this course</Text><Text style={styles.description}>{course.fullDescription}</Text></> : null}
        {benefits.length ? <><Text style={styles.sectionTitle}>What you will learn</Text><Card style={styles.benefitCard}>{benefits.map((benefit, index) => <View key={`${benefit}-${index}`} style={styles.benefitRow}><IconCircle icon="check" size={26} color={COLORS.green} background={COLORS.greenSoft} /><Text style={styles.benefitText}>{benefit}</Text></View>)}</Card></> : null}
        <Text style={styles.sectionTitle}>Course content</Text>
        {enrolled ? <View style={styles.moduleList}>{learningQuery.data?.modules.map((module, index) => <Card key={module.id} style={styles.moduleCard}><View style={styles.moduleHeader}><View style={styles.moduleNumber}><Text style={styles.moduleNumberText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>{module.title}</Text><Text style={styles.moduleCount}>{module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}{module.resources.length ? ` · ${module.resources.length} resources` : ""}</Text></View></View>{module.resources.map((resource) => <View key={`resource-${resource.id}`} style={styles.resourceRow}><Pressable onPress={() => resource.contentUrl ? void Linking.openURL(resource.contentUrl) : undefined} style={({ pressed }) => [styles.resourceOpen, pressed && styles.pressed]}><MaterialIcons name={resource.resourceType === "video" ? "video-library" : "picture-as-pdf"} size={20} color={resource.resourceType === "video" ? COLORS.indigo : COLORS.red} /><Text style={styles.lessonTitle}>{resource.title}</Text><Text style={styles.resourceType}>{resource.resourceType.toUpperCase()}</Text></Pressable>{resource.downloadAllowed ? <Pressable accessibilityRole="button" accessibilityLabel={`Download ${resource.title} for offline use`} onPress={() => void downloadOfflineResource(resource.id, resource.title, resource.resourceType)} disabled={resourceDownloadMutation.isPending} style={({ pressed }) => [styles.downloadButton, (pressed || resourceDownloadMutation.isPending) && styles.pressed]}><MaterialIcons name={resourceDownloadMutation.isPending ? "hourglass-top" : "download"} size={17} color={COLORS.indigo} /><Text style={styles.downloadText}>{resourceDownloadMutation.isPending ? "Preparing" : "Download"}</Text></Pressable> : null}</View>)}{module.lessons.map((row) => <Pressable key={row.lesson.id} onPress={() => router.push(`/lesson/${row.lesson.id}`)} style={({ pressed }) => [styles.lessonRow, pressed && styles.pressed]}><MaterialIcons name={row.progress?.isCompleted ? "check-circle" : "play-circle-outline"} size={20} color={row.progress?.isCompleted ? COLORS.green : COLORS.indigo} /><Text style={styles.lessonTitle}>{row.lesson.title}</Text><Text style={styles.lessonDuration}>{Math.ceil(row.lesson.durationSeconds / 60)}m</Text></Pressable>)}</Card>)}</View> : <Card style={styles.lockedCard}><IconCircle icon="lock" size={40} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={{ flex: 1 }}><Text style={styles.lockedTitle}>Enroll to unlock the full course</Text><Text style={styles.lockedBody}>Your course sequence, resources and progress become available after server-authorized enrollment.</Text></View></Card>}
        <View style={styles.reviewHint}><Text style={styles.reviewTitle}>Course reviews</Text><Text style={styles.reviewBody}>Reviews can be submitted by eligible enrolled learners and moderated by the operations team.</Text><OutlineButton label="Browse more courses" icon="explore" onPress={() => router.push("/explore")} /></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 10, paddingBottom: 34 },
  topbar: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  iconButton: { width: 42, height: 42, backgroundColor: COLORS.indigoSoft, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hero: { minHeight: 252, overflow: "hidden", borderRadius: 24, padding: 20, justifyContent: "flex-end", backgroundColor: COLORS.indigo },
  heroPattern: { position: "absolute", right: 15, top: 21 },
  heroTitle: { color: COLORS.white, fontSize: 27, lineHeight: 34, fontWeight: "800", marginTop: 13, maxWidth: 310 },
  heroDescription: { color: "#D6DFF2", fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 330 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: "#D6DFF2", fontSize: 12 },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  price: { color: COLORS.ink, fontWeight: "900", fontSize: 23 },
  mrp: { color: COLORS.muted, fontSize: 12, textDecorationLine: "line-through", marginTop: 2 },
  accessCopy: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  sectionTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 19, marginTop: 28, marginBottom: 10 },
  description: { color: COLORS.muted, fontSize: 14, lineHeight: 21 },
  benefitCard: { gap: 13 },
  benefitRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  benefitText: { color: COLORS.ink, flex: 1, fontSize: 14, lineHeight: 20 },
  moduleList: { gap: 11 },
  moduleCard: { padding: 14, gap: 12 },
  moduleHeader: { flexDirection: "row", gap: 11, alignItems: "center" },
  moduleNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" },
  moduleNumberText: { color: COLORS.indigo, fontWeight: "900", fontSize: 13 },
  moduleTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 15 },
  moduleCount: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  lessonRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9, borderTopColor: COLORS.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  resourceRow: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 7, borderTopColor: COLORS.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, backgroundColor: "#FAFBFF", borderRadius: 9, paddingHorizontal: 7 },
  resourceOpen: { flex: 1, minHeight: 34, flexDirection: "row", alignItems: "center", gap: 9 },
  downloadButton: { minHeight: 34, borderRadius: 9, backgroundColor: COLORS.indigoSoft, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 4 },
  downloadText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" },
  lessonTitle: { flex: 1, color: COLORS.ink, fontSize: 13, fontWeight: "600" },
  lessonDuration: { color: COLORS.muted, fontSize: 11 },
  resourceType: { color: COLORS.indigo, fontSize: 10, fontWeight: "900" },
  lockedCard: { flexDirection: "row", gap: 13, alignItems: "center", backgroundColor: "#F9FBFF", borderColor: "#C9D3EC" },
  lockedTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 15 },
  lockedBody: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  reviewHint: { marginTop: 26, gap: 8, padding: 16, borderRadius: 19, backgroundColor: "#FFF5E8" },
  reviewTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 16 },
  reviewBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  notFound: { color: COLORS.muted, fontSize: 16 },
  errorCard: { gap: 12, width: "100%" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
