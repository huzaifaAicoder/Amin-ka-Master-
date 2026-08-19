import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { usePanelRefresh } from "@/hooks/use-panel-refresh";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Decision = "approved" | "rejected";
type PendingShort = {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string;
  authorName: string | null;
  authorEmail: string | null;
  authorMobile: string | null;
  createdAt: Date;
};

export default function ModerationScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const enabled = user?.role === "admin" || user?.role === "super_admin";
  const queueQuery = trpc.operations.pendingShorts.useQuery(undefined, { enabled, retry: 1, staleTime: 0 });
  const moderateMutation = trpc.operations.moderateShort.useMutation({ onSuccess: () => void queueQuery.refetch() });
  const { refreshing, onRefresh } = usePanelRefresh([queueQuery.refetch]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const queue = queueQuery.data ?? [];
  const filteredQueue = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return queue;
    return queue.filter((item) => `${item.title} ${item.authorName ?? ""} ${item.authorEmail ?? ""} ${item.authorMobile ?? ""}`.toLowerCase().includes(search));
  }, [query, queue]);
  const selected = queue.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && queue.some((item) => item.id === selectedId)) return;
    setSelectedId(queue[0]?.id ?? null);
    setNote("");
  }, [queue, selectedId]);

  const select = (id: number) => { setSelectedId(id); setNote(""); };
  const decide = (decision: Decision) => {
    if (!selected) return;
    const approve = decision === "approved";
    Alert.alert(
      approve ? "Approve and publish this Short?" : "Reject this Short?",
      approve ? "The Short will be visible to all eligible students immediately. This action is recorded in the audit trail." : "The Short will remain out of the public feed. Your optional note stays visible only to staff.",
      [
        { text: "Keep reviewing", style: "cancel" },
        {
          text: approve ? "Approve & publish" : "Reject submission",
          style: approve ? "default" : "destructive",
          onPress: () => void moderateMutation.mutateAsync({ shortId: selected.id, decision, moderationNote: note.trim() || undefined }).then(() => { setSelectedId(null); setNote(""); }).catch((error) => Alert.alert("Decision not saved", error instanceof Error ? error.message : "Please retry the review.")),
        },
      ],
    );
  };

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="lock" title="Moderation access required" body="Only Admin and Owner accounts can review student Short submissions." /></ScreenContainer>;
  if (queueQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <FlatList
      data={filteredQueue}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.indigo]} tintColor={COLORS.indigo} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<>
        <View style={styles.header}><Pressable accessibilityLabel="Return to Operations" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.eyebrow}>CONTENT SAFETY DESK</Text><Text style={styles.title}>Shorts moderation</Text></View><IconCircle icon="fact-check" size={42} color={COLORS.saffron} background={COLORS.indigo} /></View>
        <View style={styles.queueBanner}><View style={styles.queueIcon}><MaterialIcons name="hourglass-top" size={25} color={COLORS.saffron} /></View><View style={styles.queueCopy}><Text style={styles.queueCount}>{queue.length} pending {queue.length === 1 ? "submission" : "submissions"}</Text><Text style={styles.queueDetail}>Review video, context and student identity before publishing. Every decision is auditable.</Text></View><Tag label="PENDING" tone="saffron" /></View>
        {queueQuery.isError ? <View style={styles.retry}><EmptyState icon="wifi-off" title="Queue could not load" body="Check the connection and retry the secure moderation queue." /><PrimaryButton label="Retry queue" icon="refresh" onPress={() => void queueQuery.refetch()} /></View> : queue.length ? <>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search title or student" placeholderTextColor="#98A2B3" style={styles.search} autoCapitalize="none" autoCorrect={false} />
          {selected ? <ReviewDesk key={selected.id} item={selected} note={note} onChangeNote={setNote} busy={moderateMutation.isPending} onApprove={() => decide("approved")} onReject={() => decide("rejected")} /> : null}
          <View style={styles.queueHeader}><Text style={styles.sectionTitle}>Review queue</Text><Text style={styles.sectionMeta}>{filteredQueue.length} shown</Text></View>
        </> : null}
      </>}
      ListEmptyComponent={queueQuery.isError ? null : !queue.length ? <EmptyState icon="verified" title="Nothing pending" body="There are no student Shorts awaiting a moderation decision." /> : <EmptyState icon="search-off" title="No matching submissions" body="Try a different title or student search." />}
      renderItem={({ item }) => <QueueRow item={item} selected={item.id === selectedId} onPress={() => select(item.id)} />}
    />
  </ScreenContainer>;
}

function QueueRow({ item, selected, onPress }: { item: PendingShort; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Review ${item.title}`} onPress={onPress} style={({ pressed }) => [styles.row, selected && styles.selectedRow, pressed && styles.pressed]}><View style={styles.thumbnail}><MaterialIcons name="play-circle-filled" size={31} color={selected ? COLORS.white : COLORS.indigo} /></View><View style={styles.rowCopy}><Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.rowMeta}>{item.authorName ?? "Student"} · {formatShortDate(item.createdAt)}</Text></View><MaterialIcons name={selected ? "check-circle" : "chevron-right"} size={21} color={selected ? COLORS.indigo : COLORS.muted} /></Pressable>;
}

function ReviewDesk({ item, note, onChangeNote, busy, onApprove, onReject }: { item: PendingShort; note: string; onChangeNote: (value: string) => void; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const player = useVideoPlayer(item.videoUrl, (video) => { video.loop = true; });
  const studentContact = item.authorEmail ?? item.authorMobile ?? "No contact detail";
  return <View style={styles.reviewDesk}><View style={styles.reviewHeader}><View><Text style={styles.reviewEyebrow}>NOW REVIEWING</Text><Text style={styles.reviewTitle} numberOfLines={2}>{item.title}</Text></View><Tag label="PENDING" tone="saffron" /></View><VideoView player={player} nativeControls contentFit="contain" style={styles.video} /><View style={styles.checklist}><ChecklistItem icon="smart-display" label="Playback checked" detail="Watch the submitted Short before deciding." /><ChecklistItem icon="person" label={item.authorName ?? "Student"} detail={studentContact} /><ChecklistItem icon="schedule" label="Submitted" detail={formatFullDate(item.createdAt)} /></View><View style={styles.descriptionBox}><Text style={styles.descriptionLabel}>Student description</Text><Text style={styles.description}>{item.description || "No description was provided with this submission."}</Text></View><Text style={styles.noteLabel}>Internal moderation note <Text style={styles.optional}>optional</Text></Text><TextInput value={note} onChangeText={onChangeNote} placeholder="Record a policy reason, editorial change, or follow-up for staff…" placeholderTextColor="#98A2B3" multiline maxLength={1000} style={styles.note} textAlignVertical="top" /><Text style={styles.noteHint}>{note.length}/1000 · This note is not visible to the student.</Text><View style={styles.actions}><View style={styles.actionHalf}><PrimaryButton label={busy ? "Saving…" : "Approve & publish"} icon="check-circle" disabled={busy} onPress={onApprove} loading={busy} /></View><View style={styles.actionHalf}><PrimaryButton label="Reject" icon="block" subtle disabled={busy} onPress={onReject} /></View></View></View>;
}

function ChecklistItem({ icon, label, detail }: { icon: "smart-display" | "person" | "schedule"; label: string; detail: string }) { return <View style={styles.checkItem}><MaterialIcons name={icon} size={17} color={COLORS.indigo} /><View style={styles.checkCopy}><Text numberOfLines={1} style={styles.checkLabel}>{label}</Text><Text numberOfLines={1} style={styles.checkDetail}>{detail}</Text></View></View>; }
function formatShortDate(value: Date) { return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
function formatFullDate(value: Date) { return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 38, gap: 10 },
  header: { minHeight: 54, flexDirection: "row", gap: 10, alignItems: "center" },
  back: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.indigoSoft },
  heading: { flex: 1 },
  eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  title: { color: COLORS.ink, fontSize: 22, fontWeight: "900" },
  queueBanner: { minHeight: 87, borderRadius: 19, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.indigo },
  queueIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  queueCopy: { flex: 1 },
  queueCount: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  queueDetail: { color: "#D6DFF2", fontSize: 11, lineHeight: 16, marginTop: 3 },
  search: { minHeight: 49, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, backgroundColor: COLORS.white, color: COLORS.ink, paddingHorizontal: 13, fontSize: 14 },
  reviewDesk: { gap: 10, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.indigo, backgroundColor: COLORS.white, padding: 13 },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", gap: 9, alignItems: "flex-start" },
  reviewEyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  reviewTitle: { maxWidth: 250, color: COLORS.ink, fontSize: 18, lineHeight: 23, fontWeight: "900", marginTop: 2 },
  video: { width: "100%", height: 230, borderRadius: 14, backgroundColor: COLORS.indigo },
  checklist: { gap: 7, padding: 10, borderRadius: 13, backgroundColor: COLORS.paper },
  checkItem: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 7 },
  checkCopy: { flex: 1, flexDirection: "row", justifyContent: "space-between", gap: 7 },
  checkLabel: { flex: 1, color: COLORS.ink, fontSize: 11, fontWeight: "800" },
  checkDetail: { flex: 1.25, color: COLORS.muted, fontSize: 11, textAlign: "right" },
  descriptionBox: { gap: 3, padding: 10, borderRadius: 13, backgroundColor: "#F7F9FD", borderWidth: 1, borderColor: COLORS.line },
  descriptionLabel: { color: COLORS.indigo, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  description: { color: COLORS.ink, fontSize: 12, lineHeight: 18 },
  noteLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "900", marginTop: 2 },
  optional: { color: COLORS.muted, fontWeight: "700" },
  note: { minHeight: 84, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper, paddingHorizontal: 11, paddingTop: 10, color: COLORS.ink, fontSize: 13 },
  noteHint: { color: COLORS.muted, fontSize: 10, marginTop: -5 },
  actions: { flexDirection: "row", gap: 8 },
  actionHalf: { flex: 1 },
  queueHeader: { marginTop: 5, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" },
  sectionMeta: { color: COLORS.muted, fontSize: 11 },
  row: { minHeight: 71, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 10 },
  selectedRow: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft },
  thumbnail: { width: 45, height: 45, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.indigoSoft },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900" },
  rowMeta: { color: COLORS.muted, fontSize: 11 },
  retry: { minHeight: 260, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
