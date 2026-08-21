import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ScreenCapture from "expo-screen-capture";
import { VideoView, useVideoPlayer } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Card, COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";
import { recordLearningSeconds } from "@/lib/study-planner";

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const { user } = useLmsSession();
  const id = Number(lessonId);
  const lessonQuery = trpc.student.lesson.useQuery({ lessonId: id }, { enabled: Boolean(user && Number.isInteger(id) && id > 0), retry: false });
  const authorizedData = lessonQuery.data?.authorized ? lessonQuery.data : undefined;
  const authorizedLessonId = authorizedData?.lesson.id;
  const courseQuery = trpc.student.courseLearning.useQuery({ courseId: authorizedData?.course.id ?? 0 }, { enabled: Boolean(authorizedData?.course.id), retry: false });
  const progressMutation = trpc.student.updateProgress.useMutation({ onSuccess: () => void lessonQuery.refetch() });
  const bookmarkMutation = trpc.student.toggleBookmark.useMutation({ onSuccess: () => void lessonQuery.refetch() });
  const noteMutation = trpc.student.saveNote.useMutation({ onSuccess: () => void lessonQuery.refetch() });
  const [note, setNote] = useState("");
  const noteSessionStartedAt = useRef<number | null>(null);

  const recordNoteSession = () => {
    if (noteSessionStartedAt.current === null || user?.role !== "student") return;
    const elapsedSeconds = Math.floor((Date.now() - noteSessionStartedAt.current) / 1000);
    noteSessionStartedAt.current = null;
    if (elapsedSeconds >= 30) void recordLearningSeconds(user.id, elapsedSeconds, "Notes");
  };

  useEffect(() => setNote(authorizedData?.note?.body ?? ""), [authorizedData?.note?.body]);
  useEffect(() => {
    if (!authorizedData || Platform.OS === "web") return;
    const key = `authorized-lesson-${authorizedData.lesson.id}`;
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => { void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined); };
  }, [authorizedData?.lesson.id]);
  useEffect(() => {
    if (!authorizedLessonId || user?.role !== "student") return;
    let active = true; let startedAt = Date.now();
    const flush = () => { if (!active) return; const seconds = Math.floor((Date.now() - startedAt) / 1000); startedAt = Date.now(); if (seconds >= 30) void recordLearningSeconds(user.id, seconds, "Lectures"); };
    const subscription = AppState.addEventListener("change", (nextState) => { if (nextState === "active" && !active) { active = true; startedAt = Date.now(); } else if (nextState !== "active" && active) { flush(); active = false; } });
    return () => { flush(); subscription.remove(); };
  }, [authorizedLessonId, user?.id, user?.role]);
  const sequence = useMemo(() => courseQuery.data?.modules.flatMap((module) => module.lessons.map((row) => row.lesson)) ?? [], [courseQuery.data]);
  const currentIndex = sequence.findIndex((lesson) => lesson.id === id);
  const previous = currentIndex > 0 ? sequence[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 ? sequence[currentIndex + 1] : undefined;

  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in to continue" body="Lessons, notes and progress are available only through your authorized learning account." action={<PrimaryButton label="Sign in" onPress={() => router.push("/auth")} />} /></View></ScreenContainer>;
  if (lessonQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  if (lessonQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="wifi-off" title="Lesson could not load" body="Check your connection, then retry. Your learning access has not changed." action={<PrimaryButton label="Retry" icon="refresh" onPress={() => void lessonQuery.refetch()} />} /></View></ScreenContainer>;
  if (!authorizedData) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock" title="Lesson locked" body="Enroll in the course first. Protected content is not delivered until the server confirms your access." action={<PrimaryButton label="Go to my learning" onPress={() => router.replace("/learning")} />} /></View></ScreenContainer>;
  const { lesson, course } = authorizedData;
  const completed = Boolean(authorizedData.progress?.isCompleted);

  const complete = async () => {
    try {
      await progressMutation.mutateAsync({ courseId: course.id, lessonId: lesson.id, watchedSeconds: lesson.durationSeconds, completed: true });
    } catch (cause) {
      Alert.alert("Progress not saved", cause instanceof Error ? cause.message : "Please try again.");
    }
  };
  const saveNote = async () => {
    if (!note.trim()) return Alert.alert("Add a note first", "Your private note cannot be empty.");
    try { await noteMutation.mutateAsync({ lessonId: lesson.id, body: note.trim() }); } catch (cause) { Alert.alert("Note not saved", cause instanceof Error ? cause.message : "Please try again."); }
  };
  const toggleBookmark = async () => {
    try { await bookmarkMutation.mutateAsync({ lessonId: lesson.id }); } catch (cause) { Alert.alert("Bookmark not updated", cause instanceof Error ? cause.message : "Please try again."); }
  };
  const openResource = async (url?: string | null) => {
    if (!url) return Alert.alert("Resource unavailable", "This resource does not have a published link yet.");
    try { await Linking.openURL(url); } catch { Alert.alert("Resource could not open", "Please check your connection and try again."); }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topbar}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><Pressable onPress={toggleBookmark} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name={authorizedData.bookmarked ? "bookmark" : "bookmark-border"} size={22} color={COLORS.indigo} /></Pressable></View>
        <Text style={styles.courseName}>{course.title.toUpperCase()}</Text>
        <Text style={styles.title}>{lesson.title}</Text>
        <View style={styles.meta}><Tag label={lesson.contentType.toUpperCase()} tone="indigo" /><Text style={styles.metaText}>{Math.ceil(lesson.durationSeconds / 60)} min lesson</Text>{completed ? <Tag label="COMPLETE" tone="green" /> : null}</View>
        {Platform.OS !== "web" ? <Text style={styles.captureNotice}>Screen capture deterrence is active for authorized lesson content on supported devices.</Text> : null}
        {lesson.contentType === "video" && lesson.contentUrl ? <LessonVideoPlayer source={lesson.contentUrl} /> : <View style={styles.player}><View style={styles.playerGrid}><MaterialIcons name={lesson.contentType === "video" ? "play-circle-filled" : "menu-book"} size={55} color={COLORS.saffron} /></View><Text style={styles.playerLabel}>{lesson.contentType === "video" ? "This video has not been published with a playback URL yet." : "Lesson reading"}</Text></View>}
        <Text style={styles.description}>{lesson.description ?? "Study the lesson and record your key takeaways below."}</Text>
        {lesson.contentType !== "video" ? <Card style={styles.readingCard}><Text style={styles.readingTitle}>Lesson material</Text><Text style={styles.readingText}>{lesson.contentUrl ? "Open the published lesson material, then record your own field notes below." : "The teacher has not added a reading or document link for this lesson yet."}</Text>{lesson.contentUrl ? <Pressable accessibilityRole="link" onPress={() => void openResource(lesson.contentUrl)} style={({ pressed }) => [styles.openMaterial, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={17} color={COLORS.indigo} /><Text style={styles.openMaterialText}>Open lesson material</Text></Pressable> : null}</Card> : null}
        <PrimaryButton label={completed ? "Lesson completed" : progressMutation.isPending ? "Saving progress…" : "Mark complete"} icon={completed ? "check-circle" : "check"} onPress={complete} disabled={completed || progressMutation.isPending} />
        <Text style={styles.sectionTitle}>Resources</Text>
        {authorizedData.resources.length ? <View style={styles.resources}>{authorizedData.resources.map((resource) => <Pressable key={resource.id} accessibilityRole="link" onPress={() => void openResource(resource.externalUrl)} style={({ pressed }) => [styles.resourceRow, pressed && styles.pressed]}><IconCircle icon={resource.resourceType === "pdf" ? "picture-as-pdf" : resource.resourceType === "link" ? "link" : "description"} size={38} /><View style={{ flex: 1 }}><Text style={styles.resourceTitle}>{resource.title}</Text><Text style={styles.resourceType}>{resource.resourceType.toUpperCase()}</Text></View><MaterialIcons name="open-in-new" size={22} color={COLORS.indigo} /></Pressable>)}</View> : <Card style={styles.noResource}><Text style={styles.noResourceText}>No extra resources have been published for this lesson.</Text></Card>}
        <Text style={styles.sectionTitle}>My private notes</Text>
        <TextInput value={note} onChangeText={setNote} onFocus={() => { noteSessionStartedAt.current = Date.now(); }} onBlur={recordNoteSession} multiline placeholder="Write a takeaway, formula or question for later…" placeholderTextColor="#98A2B3" style={styles.noteInput} textAlignVertical="top" maxLength={6000} />
        <Pressable onPress={saveNote} disabled={noteMutation.isPending} style={({ pressed }) => [styles.saveNote, (pressed || noteMutation.isPending) && styles.pressed]}><MaterialIcons name="save" size={18} color={COLORS.indigo} /><Text style={styles.saveNoteText}>{noteMutation.isPending ? "Saving…" : "Save private note"}</Text></Pressable>
        <View style={styles.navigation}><Pressable disabled={!previous} onPress={() => previous && router.replace(`/lesson/${previous.id}`)} style={({ pressed }) => [styles.navButton, !previous && styles.navDisabled, pressed && previous && styles.pressed]}><MaterialIcons name="arrow-back" size={18} color={COLORS.indigo} /><Text style={styles.navText}>Previous</Text></Pressable><Pressable disabled={!next} onPress={() => next && router.replace(`/lesson/${next.id}`)} style={({ pressed }) => [styles.navButton, !next && styles.navDisabled, pressed && next && styles.pressed]}><Text style={styles.navText}>Next</Text><MaterialIcons name="arrow-forward" size={18} color={COLORS.indigo} /></Pressable></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function LessonVideoPlayer({ source }: { source: string }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = false;
  });
  return <View style={styles.videoShell}><VideoView style={styles.video} player={player} nativeControls allowsFullscreen allowsPictureInPicture contentFit="contain" surfaceType="textureView" /></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 10, paddingBottom: 34 },
  center: { flex: 1, justifyContent: "center" },
  topbar: { flexDirection: "row", justifyContent: "space-between", marginBottom: 21 },
  iconButton: { width: 42, height: 42, backgroundColor: COLORS.indigoSoft, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  courseName: { color: COLORS.earth, fontWeight: "900", fontSize: 10, letterSpacing: 1.1 },
  title: { color: COLORS.ink, fontSize: 27, lineHeight: 34, fontWeight: "800", marginTop: 7 },
  meta: { marginTop: 12, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  metaText: { color: COLORS.muted, fontSize: 12 },
  captureNotice: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  player: { height: 210, borderRadius: 22, overflow: "hidden", backgroundColor: COLORS.indigo, marginTop: 20, justifyContent: "center", alignItems: "center" },
  videoShell: { height: 210, borderRadius: 22, overflow: "hidden", backgroundColor: COLORS.indigo, marginTop: 20 },
  video: { width: "100%", height: "100%" },
  playerGrid: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  playerLabel: { color: "#D6DFF2", fontSize: 12, position: "absolute", bottom: 17, textAlign: "center", paddingHorizontal: 24 },
  description: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 18 },
  readingCard: { marginTop: 15, backgroundColor: "#FFF5E8", borderColor: "#F5D5A6", gap: 7 },
  readingTitle: { color: COLORS.earth, fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },
  readingText: { color: COLORS.ink, fontSize: 14, lineHeight: 21 },
  sectionTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "800", marginTop: 28, marginBottom: 10 },
  resources: { gap: 9 },
  resourceRow: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white },
  resourceTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  resourceType: { color: COLORS.muted, fontSize: 10, fontWeight: "900", marginTop: 3, letterSpacing: 0.7 },
  noResource: { padding: 14 },
  noResourceText: { color: COLORS.muted, fontSize: 13 },
  noteInput: { minHeight: 130, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, borderRadius: 17, padding: 14, color: COLORS.ink, fontSize: 14, lineHeight: 20 },
  saveNote: { alignSelf: "flex-start", minHeight: 42, borderRadius: 12, backgroundColor: COLORS.indigoSoft, paddingHorizontal: 14, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  saveNoteText: { color: COLORS.indigo, fontWeight: "800", fontSize: 13 },
  openMaterial: { alignSelf: "flex-start", minHeight: 38, paddingHorizontal: 12, borderRadius: 11, marginTop: 10, backgroundColor: COLORS.indigoSoft, flexDirection: "row", alignItems: "center", gap: 6 },
  openMaterialText: { color: COLORS.indigo, fontWeight: "900", fontSize: 12 },
  navigation: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 28 },
  navButton: { flex: 1, minHeight: 45, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  navDisabled: { opacity: 0.35 },
  navText: { color: COLORS.indigo, fontWeight: "800", fontSize: 13 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
