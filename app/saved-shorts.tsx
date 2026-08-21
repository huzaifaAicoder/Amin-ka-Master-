import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton } from "@/components/lms-ui";
import { clearOfflineDownloadFailure, downloadAuthorizedOfflineResource, loadOfflineMediaIndex, recordOfflineDownloadFailure, type OfflineMediaEntry } from "@/lib/offline-resources";
import { trpc } from "@/lib/trpc";

type SavedShort = { id: number; title: string; description: string | null; videoUrl: string; likeCount: number; isLiked: boolean; isSaved: boolean };

export default function SavedShortsScreen() {
  const router = useRouter();
  const savedQuery = trpc.student.savedShorts.useQuery(undefined, { retry: 1, staleTime: 30_000 });
  const utils = trpc.useUtils();
  const removeSave = trpc.student.toggleShortSave.useMutation({
    onSuccess: () => {
      void utils.student.savedShorts.invalidate();
      void utils.student.shorts.invalidate();
    },
    onError: (error) => Alert.alert("Could not update saved Shorts", error.message || "Please try again."),
  });
  const shortDownload = trpc.student.requestShortDownload.useMutation();
  const [offline, setOffline] = useState<Record<number, OfflineMediaEntry>>({});
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const refreshOffline = useCallback(async () => {
    const entries = await loadOfflineMediaIndex();
    setOffline(Object.fromEntries(entries.filter((entry) => entry.source === "reel").map((entry) => [entry.resourceId, entry])));
  }, []);
  useFocusEffect(useCallback(() => { void refreshOffline(); }, [refreshOffline]));
  const saveOffline = async (item: SavedShort) => {
    if (isExternalVideo(item.videoUrl)) return Alert.alert("External media", "YouTube and Instagram videos cannot be downloaded directly. Use Share or open the provider instead.");
    setDownloadingId(item.id);
    try {
      const issued = await shortDownload.mutateAsync({ shortId: item.id });
      await downloadAuthorizedOfflineResource(issued, item.title, "video", { resourceId: item.id, source: "reel" });
      await clearOfflineDownloadFailure(item.id);
      await refreshOffline();
      Alert.alert("Saved offline", `${item.title} is ready in your private Downloads library.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your connection and try again.";
      await recordOfflineDownloadFailure({ resourceId: item.id, title: item.title, kind: "video", source: "reel", message });
      Alert.alert("Offline save unavailable", message);
    } finally { setDownloadingId(null); }
  };

  if (savedQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.muted}>Loading saved Shorts…</Text></View></ScreenContainer>;
  if (savedQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="wifi-off" title="Saved Shorts could not load" body="Check your connection and retry. Saved items stay private to your account." /><PrimaryButton label="Retry" icon="refresh" onPress={() => void savedQuery.refetch()} /></View></ScreenContainer>;
  const shorts = savedQuery.data ?? [];
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Saved Shorts</Text><Text style={styles.subtitle}>Quick lessons you saved for later.</Text></View></View>{shorts.length ? <FlatList data={shorts} keyExtractor={(item) => item.id.toString()} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({ item }) => <SavedShortCard item={item} offlineUri={offline[item.id]?.uri} downloading={downloadingId === item.id} removing={removeSave.isPending && removeSave.variables?.shortId === item.id} onDownload={() => void saveOffline(item)} onRemove={() => removeSave.mutate({ shortId: item.id })} />} /> : <View style={styles.center}><EmptyState icon="bookmark-border" title="No saved Shorts" body="Tap Save on a knowledge Short to keep it ready for revision." /><PrimaryButton label="Browse Shorts" icon="slow-motion-video" onPress={() => router.replace("/(tabs)/shorts" as never)} /></View>}</ScreenContainer>;
}

function isExternalVideo(url: string) { return /(?:youtube\.com|youtu\.be|instagram\.com)/i.test(url); }

function SavedShortCard({ item, offlineUri, downloading, removing, onDownload, onRemove }: { item: SavedShort; offlineUri?: string; downloading: boolean; removing: boolean; onDownload: () => void; onRemove: () => void }) {
  const player = useVideoPlayer(offlineUri ?? item.videoUrl, (video) => { video.loop = false; });
  useEffect(() => () => player.pause(), [player]);
  const share = async () => {
    try { await Share.share({ title: item.title, message: [item.title, item.description, "Shared from Amin Ka Master"].filter(Boolean).join("\n\n") }); }
    catch { Alert.alert("Share unavailable", "Your device could not open the share sheet."); }
  };
  return <View style={styles.card}><VideoView player={player} nativeControls contentFit="cover" style={styles.video} /><View style={styles.cardBody}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.title}</Text>{item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}<Text style={styles.likes}>{offlineUri ? "Available offline · internal player" : `${item.likeCount} ${item.likeCount === 1 ? "like" : "likes"}`}</Text></View><View style={styles.actions}>{!offlineUri && !isExternalVideo(item.videoUrl) ? <Pressable accessibilityRole="button" accessibilityLabel={`Save ${item.title} for offline playback`} accessibilityState={{ busy: downloading }} disabled={downloading} onPress={onDownload} style={({ pressed }) => [styles.downloadButton, (pressed || downloading) && styles.pressed]}>{downloading ? <ActivityIndicator size="small" color={COLORS.indigo} /> : <><MaterialIcons name="download" size={18} color={COLORS.indigo} /><Text style={styles.downloadText}>Offline</Text></>}</Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Share ${item.title}`} onPress={() => void share()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="share" size={20} color={COLORS.indigo} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from saved Shorts`} accessibilityState={{ busy: removing }} disabled={removing} onPress={onRemove} style={({ pressed }) => [styles.removeButton, (pressed || removing) && styles.pressed]}>{removing ? <ActivityIndicator size="small" color={COLORS.white} /> : <><MaterialIcons name="bookmark-remove" size={18} color={COLORS.white} /><Text style={styles.removeText}>Remove</Text></>}</Pressable></View></View></View>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  headerCopy: { flex: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900" }, subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  list: { gap: 13, paddingBottom: 30 }, card: { overflow: "hidden", borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }, video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: COLORS.indigo }, cardBody: { padding: 13, gap: 12 }, cardCopy: { gap: 4 }, cardTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, cardDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 18 }, likes: { color: COLORS.indigo, fontSize: 12, fontWeight: "800" }, actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 9 }, iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, downloadButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#C9D5F2" }, downloadText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" }, removeButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.indigo }, removeText: { color: COLORS.white, fontSize: 12, fontWeight: "900" }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }, muted: { color: COLORS.muted, fontSize: 13 }, pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
