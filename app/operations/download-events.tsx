import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function DownloadEventsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const enabled = user?.role === "admin" || user?.role === "super_admin";
  const eventsQuery = trpc.operations.resourceDownloadEvents.useInfiniteQuery(
    { limit: 50 },
    { enabled, retry: 1, getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
  );
  const events = eventsQuery.data?.pages.flatMap((page) => page.events) ?? [];

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="admin-panel-settings" title="Admin access required" body="PDF access records contain student activity information and are available only to Admin and Super Admin accounts." /></ScreenContainer>;
  if (eventsQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loading}>Loading PDF access records…</Text></ScreenContainer>;
  if (eventsQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="wifi-off" title="Download audit could not load" body="The server did not return the PDF access records. Check your connection and retry." /><PrimaryButton label="Retry audit" icon="refresh" onPress={() => void eventsQuery.refetch()} /></View></ScreenContainer>;

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Return to Operations" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable>
      <View style={styles.heading}><Text style={styles.eyebrow}>OPERATIONS / READ ONLY</Text><Text style={styles.title}>PDF access monitor</Text></View>
      <IconCircle icon="download-done" size={38} color={COLORS.green} background={COLORS.greenSoft} />
    </View>
    <FlatList
      data={events}
      keyExtractor={(item) => item.event.id.toString()}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<View style={styles.intro}><Text style={styles.introTitle}>Authorized PDF downloads</Text><Text style={styles.introBody}>Each record is written when an actively enrolled student is issued a fresh, short-lived managed-storage link for a staff-approved module PDF.</Text><Tag label="READ ONLY AUDIT" tone="indigo" /></View>}
      ListEmptyComponent={<View style={styles.empty}><EmptyState icon="download" title="No PDF downloads yet" body="Records will appear here after an enrolled student downloads a staff-approved module PDF." /></View>}
      renderItem={({ item }) => <DownloadEventRow item={item} />}
      ListFooterComponent={eventsQuery.hasNextPage ? <View style={styles.footer}><PrimaryButton label={eventsQuery.isFetchingNextPage ? "Loading older records…" : "Load older records"} icon="history" onPress={() => void eventsQuery.fetchNextPage()} disabled={eventsQuery.isFetchingNextPage} />{eventsQuery.isFetchNextPageError ? <Text style={styles.moreError}>Older records could not load. Tap again to retry.</Text> : null}</View> : events.length ? <Text style={styles.end}>You have reached the earliest available record.</Text> : null}
    />
  </ScreenContainer>;
}

function DownloadEventRow({ item }: { item: any }) {
  const learner = item.studentName ?? item.studentEmail ?? `Student #${item.event.userId}`;
  const when = new Date(item.event.downloadedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return <View style={styles.row}>
    <IconCircle icon="picture-as-pdf" size={40} color={COLORS.red} background="#FDECEA" />
    <View style={styles.copy}>
      <View style={styles.rowTop}><Text numberOfLines={1} style={styles.resourceTitle}>{item.resourceTitle}</Text><Tag label="PDF" tone="red" /></View>
      <Text numberOfLines={1} style={styles.courseTitle}>{item.courseTitle} · {item.moduleTitle}</Text>
      <Text numberOfLines={1} style={styles.learner}>{learner}</Text>
      <Text style={styles.time}>{when}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  heading: { flex: 1, gap: 1 },
  eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "900" },
  list: { paddingBottom: 36, gap: 10 },
  intro: { borderRadius: 18, backgroundColor: COLORS.indigoSoft, padding: 14, gap: 7, marginBottom: 2 },
  introTitle: { color: COLORS.indigo, fontSize: 16, fontWeight: "900" },
  introBody: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  row: { borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  copy: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", gap: 7, alignItems: "center" },
  resourceTitle: { flex: 1, color: COLORS.ink, fontSize: 14, fontWeight: "900" },
  courseTitle: { color: COLORS.indigo, fontSize: 11, fontWeight: "800" },
  learner: { color: COLORS.ink, fontSize: 12, fontWeight: "700" },
  time: { color: COLORS.muted, fontSize: 11 },
  center: { flex: 1, justifyContent: "center" },
  empty: { minHeight: 260, justifyContent: "center" },
  footer: { paddingTop: 4, gap: 8 },
  end: { color: COLORS.muted, fontSize: 12, textAlign: "center", paddingVertical: 12 },
  moreError: { color: COLORS.red, fontSize: 12, textAlign: "center" },
  loading: { marginTop: 10, color: COLORS.muted, fontSize: 13 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
