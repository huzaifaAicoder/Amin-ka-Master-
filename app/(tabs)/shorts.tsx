import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

const { height: viewportHeight } = Dimensions.get("window");

type ShortItem = { id: number; title: string; description: string | null; videoUrl: string; likeCount: number; isLiked: boolean; isSaved: boolean; };

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") void Haptics.impactAsync(style);
}

export default function ShortsScreen() {
  const shortsQuery = trpc.student.shorts.useQuery(undefined, { retry: 1, staleTime: 60_000 });
  const utils = trpc.useUtils();
  const [activeIndex, setActiveIndex] = useState(0);
  const items = shortsQuery.data ?? [];
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 80 }), []);
  const likeMutation = trpc.student.toggleShortLike.useMutation({
    onMutate: async ({ shortId }) => {
      await utils.student.shorts.cancel();
      const previous = utils.student.shorts.getData();
      utils.student.shorts.setData(undefined, (current) => current?.map((short) => short.id === shortId
        ? { ...short, isLiked: !short.isLiked, likeCount: Math.max(0, short.likeCount + (short.isLiked ? -1 : 1)) }
        : short));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.student.shorts.setData(undefined, context.previous);
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    },
    onSuccess: (result, { shortId }) => {
      utils.student.shorts.setData(undefined, (current) => current?.map((short) => short.id === shortId
        ? { ...short, isLiked: result.liked, likeCount: result.likeCount }
        : short));
    },
    onSettled: () => void utils.student.shorts.invalidate(),
  });
  const saveMutation = trpc.student.toggleShortSave.useMutation({
    onMutate: async ({ shortId }) => {
      await utils.student.shorts.cancel();
      const previous = utils.student.shorts.getData();
      utils.student.shorts.setData(undefined, (current) => current?.map((short) => short.id === shortId ? { ...short, isSaved: !short.isSaved } : short));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.student.shorts.setData(undefined, context.previous);
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    },
    onSuccess: (result, { shortId }) => {
      utils.student.shorts.setData(undefined, (current) => current?.map((short) => short.id === shortId ? { ...short, isSaved: result.saved } : short));
    },
    onSettled: () => void utils.student.shorts.invalidate(),
  });

  const handleShare = async (item: ShortItem) => {
    haptic();
    try {
      await Share.share({ title: item.title, message: [item.title, item.description, "Shared from Amin Ka Master"].filter(Boolean).join("\n\n") });
    } catch {
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  if (shortsQuery.isLoading) return <ScreenContainer edges={["top", "left", "right"]}><View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loadingText}>Loading knowledge Shorts…</Text></View></ScreenContainer>;
  if (shortsQuery.isError) return <ScreenContainer edges={["top", "left", "right"]}><View style={styles.center}><EmptyState icon="wifi-off" title="Shorts could not load" body="Check your connection, then retry the feed." /><Pressable onPress={() => void shortsQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View></ScreenContainer>;
  if (!items.length) return <ScreenContainer edges={["top", "left", "right"]}><View style={styles.center}><EmptyState icon="slow-motion-video" title="No Shorts yet" body="Quick surveying updates and learning tips will appear here soon." /></View></ScreenContainer>;
  return <ScreenContainer edges={["top", "left", "right"]}><FlatList data={items} keyExtractor={(item) => item.id.toString()} pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false} initialNumToRender={1} windowSize={3} maxToRenderPerBatch={2} removeClippedSubviews={Platform.OS === "android"} viewabilityConfig={viewabilityConfig} onViewableItemsChanged={({ viewableItems }) => { const next = viewableItems[0]?.index; if (typeof next === "number") setActiveIndex(next); }} renderItem={(info) => <ShortPage item={info.item} active={info.index === activeIndex} onLike={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); likeMutation.mutate({ shortId: info.item.id }); }} onSave={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); saveMutation.mutate({ shortId: info.item.id }); }} onShare={() => void handleShare(info.item)} liking={likeMutation.isPending && likeMutation.variables?.shortId === info.item.id} saving={saveMutation.isPending && saveMutation.variables?.shortId === info.item.id} />} /></ScreenContainer>;
}

function ShortPage({ item, active, onLike, onSave, onShare, liking, saving }: { item: ShortItem; active: boolean; onLike: () => void; onSave: () => void; onShare: () => void; liking: boolean; saving: boolean }) {
  const player = useVideoPlayer(item.videoUrl, (video) => { video.loop = true; });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <View style={styles.page}><VideoView style={styles.video} player={player} nativeControls={false} contentFit="cover" surfaceType="textureView" /><View pointerEvents="none" style={styles.gradient}><Text style={styles.eyebrow}>AMIN KA MASTER · QUICK LEARN</Text><Text style={styles.shortTitle}>{item.title}</Text>{item.description ? <Text style={styles.shortDescription}>{item.description}</Text> : null}</View><View style={styles.actions}><EngagementButton icon={item.isLiked ? "favorite" : "favorite-border"} label={item.likeCount ? String(item.likeCount) : "Like"} accessibilityLabel={item.isLiked ? "Unlike this Short" : "Like this Short"} selected={item.isLiked} onPress={onLike} disabled={liking} /><EngagementButton icon="share" label="Share" accessibilityLabel="Share this Short" onPress={onShare} /><EngagementButton icon={item.isSaved ? "bookmark" : "bookmark-border"} label={item.isSaved ? "Saved" : "Save"} accessibilityLabel={item.isSaved ? "Remove this Short from saved items" : "Save this Short"} selected={item.isSaved} onPress={onSave} disabled={saving} /></View>{active ? <View pointerEvents="none" style={styles.buffering}><ActivityIndicator color={COLORS.white} /><Text style={styles.bufferText}>Video plays when ready</Text></View> : null}</View>;
}

function EngagementButton({ icon, label, accessibilityLabel, selected = false, onPress, disabled = false }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; accessibilityLabel: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.engagementButton, selected && styles.engagementButtonSelected, disabled && styles.engagementButtonDisabled, pressed && !disabled && styles.engagementButtonPressed]}><MaterialIcons name={icon} size={27} color={selected ? COLORS.saffron : COLORS.white} /><Text numberOfLines={1} style={[styles.engagementLabel, selected && styles.engagementLabelSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { height: Math.max(viewportHeight - 115, 540), backgroundColor: COLORS.indigo, overflow: "hidden" }, video: { width: "100%", height: "100%", backgroundColor: COLORS.indigo }, gradient: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 180, justifyContent: "flex-end", paddingHorizontal: 22, paddingBottom: 30, paddingRight: 90, backgroundColor: "rgba(15,23,42,0.56)" }, eyebrow: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }, shortTitle: { color: COLORS.white, fontSize: 23, fontWeight: "900", lineHeight: 29 }, shortDescription: { color: "#E6EAF2", fontSize: 13, lineHeight: 19, marginTop: 7 }, actions: { position: "absolute", right: 13, bottom: 106, alignItems: "center", gap: 16 }, engagementButton: { width: 58, minHeight: 54, borderRadius: 18, paddingVertical: 7, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: "rgba(15,23,42,0.52)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }, engagementButtonSelected: { backgroundColor: "rgba(242,165,65,0.2)", borderColor: "rgba(242,165,65,0.72)" }, engagementButtonDisabled: { opacity: 0.68 }, engagementButtonPressed: { opacity: 0.76, transform: [{ scale: 0.97 }] }, engagementLabel: { color: COLORS.white, fontSize: 10, fontWeight: "800", maxWidth: 54, textAlign: "center" }, engagementLabelSelected: { color: "#FFE4B3" }, buffering: { position: "absolute", top: "45%", alignSelf: "center", alignItems: "center", gap: 8, backgroundColor: "rgba(15,23,42,0.6)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }, bufferText: { color: COLORS.white, fontWeight: "700", fontSize: 11 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 }, loadingText: { color: COLORS.muted, fontSize: 13 }, retry: { minHeight: 44, borderRadius: 13, paddingHorizontal: 17, justifyContent: "center", backgroundColor: COLORS.indigo }, retryText: { color: COLORS.white, fontWeight: "900" },
});
