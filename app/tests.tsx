import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function TestsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const testsQuery = trpc.student.tests.useQuery(undefined, { enabled: Boolean(user), retry: false });
  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in to take tests" body="Assessment attempts and results are protected learning records." /></View></ScreenContainer>;
  if (testsQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Practice tests</Text><View style={{ width: 23 }} /></View>{testsQuery.data?.length ? <FlatList data={testsQuery.data} keyExtractor={(item) => item.test.id.toString()} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.testCard}><View style={styles.top}><IconCircle icon="assignment" size={46} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.copy}><Tag label="PUBLISHED" tone="green" /><Text style={styles.testTitle}>{item.test.title}</Text><Text style={styles.course}>{item.courseTitle ?? "General practice"}</Text></View></View><Text style={styles.description}>{item.test.description ?? "A timed MCQ assessment."}</Text><View style={styles.details}><View style={styles.detail}><MaterialIcons name="timer" size={17} color={COLORS.muted} /><Text style={styles.detailText}>{item.test.durationMinutes} min</Text></View><View style={styles.detail}><MaterialIcons name="emoji-events" size={17} color={COLORS.muted} /><Text style={styles.detailText}>Pass: {item.test.passingMarks}</Text></View></View><PrimaryButton label="Start timed test" icon="play-arrow" onPress={() => router.push(`/test/${item.test.id}`)} /></View>} /> : <View style={styles.center}><EmptyState icon="assignment-late" title="No tests are available" body="Published tests for your enrolled courses will appear here." /></View>}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center" },
  list: { paddingBottom: 36, gap: 13 },
  testCard: { padding: 16, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 21, gap: 13 },
  top: { flexDirection: "row", gap: 11 },
  copy: { flex: 1, gap: 5 },
  testTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 18, lineHeight: 23 },
  course: { color: COLORS.indigo, fontWeight: "700", fontSize: 12 },
  description: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  details: { flexDirection: "row", gap: 16 },
  detail: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
});
