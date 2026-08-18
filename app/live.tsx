import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag, formatDate } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function LiveClassesScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const classesQuery = trpc.student.liveClasses.useQuery(undefined, { enabled: Boolean(user), retry: false });

  const openClass = async (url: string | null, title: string) => {
    if (!url) return Alert.alert("Meeting link not configured", `${title} is scheduled, but the instructor has not published a secure meeting URL yet.`);
    await WebBrowser.openBrowserAsync(url);
  };
  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in for live learning" body="Your schedule only includes classes you are authorized to attend." /></View></ScreenContainer>;
  if (classesQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Live classes</Text><View style={{ width: 23 }} /></View>{classesQuery.data?.length ? <FlatList data={classesQuery.data} keyExtractor={(item) => item.liveClass.id.toString()} contentContainerStyle={styles.list} renderItem={({ item }) => { const live = item.liveClass; const tone = live.status === "live" ? "red" : live.status === "completed" ? "neutral" : "green"; return <View style={styles.classCard}><View style={styles.classTop}><IconCircle icon="videocam" size={44} color={COLORS.green} background={COLORS.greenSoft} /><View style={styles.copy}><View style={styles.tagLine}><Tag label={live.status.toUpperCase()} tone={tone} /><Text style={styles.date}>{formatDate(live.startsAt)}</Text></View><Text style={styles.classTitle}>{live.title}</Text><Text style={styles.course}>{item.courseTitle ?? "Open live session"}</Text></View></View><Text style={styles.description}>{live.description ?? "Join this instructor-led learning session."}</Text><PrimaryButton label={live.status === "completed" ? "Recording unavailable" : live.status === "live" ? "Join live class" : "View meeting link"} icon={live.status === "live" ? "play-arrow" : "open-in-new"} onPress={() => void openClass(live.status === "completed" ? live.recordingUrl : live.meetingUrl, live.title)} subtle={live.status === "completed"} /></View>; }} /> : <View style={styles.center}><EmptyState icon="event-busy" title="No live classes scheduled" body="Authorized upcoming sessions will appear here. The operations team can add a secure meeting URL and a post-class recording." /></View>}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center" },
  list: { paddingBottom: 36, gap: 13 },
  classCard: { padding: 16, backgroundColor: COLORS.white, borderRadius: 21, borderWidth: 1, borderColor: COLORS.line, gap: 13 },
  classTop: { flexDirection: "row", gap: 11 },
  copy: { flex: 1, gap: 4 },
  tagLine: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" },
  date: { color: COLORS.muted, fontSize: 11 },
  classTitle: { color: COLORS.ink, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  course: { color: COLORS.indigo, fontSize: 12, fontWeight: "700" },
  description: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
});
