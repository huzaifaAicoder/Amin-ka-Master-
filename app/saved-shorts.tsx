import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton } from "@/components/lms-ui";
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

  if (savedQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.muted}>Loading saved Shorts…</Text></View></ScreenContainer>;
  if (savedQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="wifi-off" title="Saved Shorts could not load" body="Check your connection and retry. Saved items stay private to your account." /><PrimaryButton label="Retry" icon="refresh" onPress={() => void savedQuery.refetch()} /></View></ScreenContainer>;
  const shorts = savedQuery.data ?? [];
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Saved Shorts</Text><Text style={styles.subtitle}>Quick lessons you saved for later.</Text></View></View>{shorts.length ? <FlatList data={shorts} keyExtractor={(item) => item.id.toString()} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({ item }) => <SavedShortCard item={item} removing={removeSave.isPending && removeSave.variables?.shortId === item.id} onRemove={() => removeSave.mutate({ shortId: item.id })} />} /> : <View style={styles.center}><EmptyState icon="bookmark-border" title="No saved Shorts" body="Tap Save on a knowledge Short to keep it ready for revision." /><PrimaryButton label="Browse Shorts" icon="slow-motion-video" onPress={() => router.replace("/(tabs)/shorts" as never)} /></View>}</ScreenContainer>;
}

function SavedShortCard({ item, removing, onRemove }: { item: SavedShort; removing: boolean; onRemove: () => void }) {
  const player = useVideoPlayer(item.videoUrl, (video) => { video.loop = false; });
  useEffect(() => () => player.pause(), [player]);
  const share = async () => {
    try { await Share.share({ title: item.title, message: [item.title, item.description, "Shared from Amin Ka Master"].filter(Boolean).join("\n\n") }); }
    catch { Alert.alert("Share unavailable", "Your device could not open the share sheet."); }
  };
  return <View style={styles.card}><VideoView player={player} nativeControls contentFit="cover" style={styles.video} /><View style={styles.cardBody}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.title}</Text>{item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}<Text style={styles.likes}>{item.likeCount} {item.likeCount === 1 ? "like" : "likes"}</Text></View><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Share ${item.title}`} onPress={() => void share()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="share" size={20} color={COLORS.indigo} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from saved Shorts`} accessibilityState={{ busy: removing }} disabled={removing} onPress={onRemove} style={({ pressed }) => [styles.removeButton, (pressed || removing) && styles.pressed]}>{removing ? <ActivityIndicator size="small" color={COLORS.white} /> : <><MaterialIcons name="bookmark-remove" size={18} color={COLORS.white} /><Text style={styles.removeText}>Remove</Text></>}</Pressable></View></View></View>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  headerCopy: { flex: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900" }, subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  list: { gap: 13, paddingBottom: 30 }, card: { overflow: "hidden", borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }, video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: COLORS.indigo }, cardBody: { padding: 13, gap: 12 }, cardCopy: { gap: 4 }, cardTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, cardDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 18 }, likes: { color: COLORS.indigo, fontSize: 12, fontWeight: "800" }, actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 9 }, iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, removeButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.indigo }, removeText: { color: COLORS.white, fontSize: 12, fontWeight: "900" }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }, muted: { color: COLORS.muted, fontSize: 13 }, pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
