import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

const { height: viewportHeight } = Dimensions.get("window");

type ShortItem = { id: number; title: string; description: string | null; videoUrl: string; };

export default function ShortsScreen() {
  const shortsQuery = trpc.student.shorts.useQuery(undefined, { retry: 1, staleTime: 60_000 });
  const [activeIndex, setActiveIndex] = useState(0);
  const items = shortsQuery.data ?? [];
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 80 }), []);
  if (shortsQuery.isLoading) return <ScreenContainer edges={["top", "left", "right"]}><View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loadingText}>Loading knowledge Shorts…</Text></View></ScreenContainer>;
  if (shortsQuery.isError) return <ScreenContainer edges={["top", "left", "right"]}><View style={styles.center}><EmptyState icon="wifi-off" title="Shorts could not load" body="Check your connection, then retry the feed." /><Pressable onPress={() => void shortsQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View></ScreenContainer>;
  if (!items.length) return <ScreenContainer edges={["top", "left", "right"]}><View style={styles.center}><EmptyState icon="slow-motion-video" title="No Shorts yet" body="Quick surveying updates and learning tips will appear here soon." /></View></ScreenContainer>;
  return <ScreenContainer edges={["top", "left", "right"]}><FlatList data={items} keyExtractor={(item) => item.id.toString()} pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false} initialNumToRender={1} windowSize={3} maxToRenderPerBatch={2} removeClippedSubviews={Platform.OS === "android"} viewabilityConfig={viewabilityConfig} onViewableItemsChanged={({ viewableItems }) => { const next = viewableItems[0]?.index; if (typeof next === "number") setActiveIndex(next); }} renderItem={(info) => <ShortPage item={info.item} active={info.index === activeIndex} />} /></ScreenContainer>;
}

function ShortPage({ item, active }: { item: ShortItem; active: boolean }) {
  const player = useVideoPlayer(item.videoUrl, (video) => { video.loop = true; });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <View style={styles.page}><VideoView style={styles.video} player={player} nativeControls={false} contentFit="cover" surfaceType="textureView" /><View pointerEvents="none" style={styles.gradient}><Text style={styles.eyebrow}>AMIN KA MASTER · QUICK LEARN</Text><Text style={styles.shortTitle}>{item.title}</Text>{item.description ? <Text style={styles.shortDescription}>{item.description}</Text> : null}</View>{active ? <View pointerEvents="none" style={styles.buffering}><ActivityIndicator color={COLORS.white} /><Text style={styles.bufferText}>Video plays when ready</Text></View> : null}</View>;
}

const styles = StyleSheet.create({
  page: { height: Math.max(viewportHeight - 115, 540), backgroundColor: COLORS.indigo, overflow: "hidden" }, video: { width: "100%", height: "100%", backgroundColor: COLORS.indigo }, gradient: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 180, justifyContent: "flex-end", paddingHorizontal: 22, paddingBottom: 30, backgroundColor: "rgba(15,23,42,0.56)" }, eyebrow: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }, shortTitle: { color: COLORS.white, fontSize: 23, fontWeight: "900", lineHeight: 29 }, shortDescription: { color: "#E6EAF2", fontSize: 13, lineHeight: 19, marginTop: 7 }, buffering: { position: "absolute", top: "45%", alignSelf: "center", alignItems: "center", gap: 8, backgroundColor: "rgba(15,23,42,0.6)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }, bufferText: { color: COLORS.white, fontWeight: "700", fontSize: 11 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 }, loadingText: { color: COLORS.muted, fontSize: 13 }, retry: { minHeight: 44, borderRadius: 13, paddingHorizontal: 17, justifyContent: "center", backgroundColor: COLORS.indigo }, retryText: { color: COLORS.white, fontWeight: "900" },
});
