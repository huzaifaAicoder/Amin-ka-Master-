import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

const TABS = ["Liked", "Saved", "Offline"] as const;
type Tab = (typeof TABS)[number];
type Short = { id: number; title: string; description: string | null; videoUrl: string; sourceType: "managed" | "youtube" | "instagram"; likeCount: number; isLiked: boolean; isSaved: boolean };
type OfflineItem = { uri: string; title: string; size: number; kind: "video" | "pdf" };

export default function ReelsHubScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Liked");
  const likedQuery = trpc.student.likedShorts.useQuery(undefined, { retry: 1, staleTime: 30_000 });
  const savedQuery = trpc.student.savedShorts.useQuery(undefined, { retry: 1, staleTime: 30_000 });
  const utils = trpc.useUtils();
  const [offline, setOffline] = useState<OfflineItem[]>([]);
  const [loadingOffline, setLoadingOffline] = useState(false);
  const toggleLike = trpc.student.toggleShortLike.useMutation({ onSuccess: () => { void utils.student.likedShorts.invalidate(); void utils.student.shorts.invalidate(); } });
  const toggleSave = trpc.student.toggleShortSave.useMutation({ onSuccess: () => { void utils.student.savedShorts.invalidate(); void utils.student.shorts.invalidate(); } });
  const loadOffline = useCallback(async () => {
    if (Platform.OS === "web" || !FileSystem.documentDirectory) { setOffline([]); return; }
    setLoadingOffline(true);
    try {
      const folder = `${FileSystem.documentDirectory}protected-resources/`;
      const names = await FileSystem.readDirectoryAsync(folder).catch(() => []);
      const rows = await Promise.all(names.filter((name) => /\.(mp4|mov|m4v|webm|pdf)$/i.test(name)).map(async (name) => {
        const uri = `${folder}${name}`;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return null;
        return { uri, title: name.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\.(mp4|mov|m4v|webm|pdf)$/i, ""), size: info.size ?? 0, kind: /\.pdf$/i.test(name) ? "pdf" as const : "video" as const };
      }));
      setOffline(rows.filter((row): row is OfflineItem => Boolean(row)));
    } finally { setLoadingOffline(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadOffline(); }, [loadOffline]));
  const refresh = async () => { await Promise.all([likedQuery.refetch(), savedQuery.refetch(), loadOffline()]); };
  const isLoading = likedQuery.isLoading || savedQuery.isLoading || (tab === "Offline" && loadingOffline);
  const shorts = useMemo(() => tab === "Liked" ? ((likedQuery.data ?? []) as Short[]) : ((savedQuery.data ?? []) as Short[]), [likedQuery.data, savedQuery.data, tab]);
  const currentError = tab !== "Offline" && (tab === "Liked" ? likedQuery.isError : savedQuery.isError);

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>YOUR REELS</Text><Text style={styles.title}>Reels Hub</Text><Text style={styles.subtitle}>Your learning Shorts, organized in one private place.</Text></View></View>
    <View style={styles.tabs}>{TABS.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><MaterialIcons name={item === "Liked" ? "favorite" : item === "Saved" ? "bookmark" : "download-done"} size={17} color={tab === item ? COLORS.white : COLORS.indigo} /><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text></Pressable>)}</View>
    {isLoading ? <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.muted}>Loading your {tab.toLowerCase()} library…</Text></View> : currentError ? <View style={styles.center}><EmptyState icon="wifi-off" title={`${tab} Shorts could not load`} body="Your existing private data is safe. Check your connection and retry." /><Pressable onPress={() => void refresh()} style={styles.retry}><MaterialIcons name="refresh" size={18} color={COLORS.white} /><Text style={styles.retryText}>Retry</Text></Pressable></View> : tab === "Offline" ? <FlatList data={offline} keyExtractor={(item) => item.uri} refreshControl={<RefreshControl refreshing={loadingOffline} onRefresh={() => void refresh()} colors={[COLORS.indigo]} />} contentContainerStyle={offline.length ? styles.list : styles.emptyList} ListEmptyComponent={<EmptyState icon="download" title="No offline Reels yet" body="Use Download on a managed Short to keep it inside your private Downloads library." />} renderItem={({ item }) => <OfflineCard item={item} onOpen={() => router.push((item.kind === "pdf" ? { pathname: "/pdf-reader", params: { uri: item.uri, title: item.title } } : { pathname: "/offline-media", params: { uri: item.uri, title: item.title } }) as never)} />} /> : <FlatList data={shorts} keyExtractor={(item) => item.id.toString()} refreshControl={<RefreshControl refreshing={likedQuery.isFetching || savedQuery.isFetching} onRefresh={() => void refresh()} colors={[COLORS.indigo]} />} contentContainerStyle={shorts.length ? styles.list : styles.emptyList} ListEmptyComponent={<EmptyState icon={tab === "Liked" ? "favorite-border" : "bookmark-border"} title={`No ${tab.toLowerCase()} Shorts`} body={tab === "Liked" ? "Like a quick lesson to bring it back here for revision." : "Save a quick lesson to keep it ready for later."} />} renderItem={({ item }) => <ShortCard item={item} onToggle={() => tab === "Liked" ? toggleLike.mutate({ shortId: item.id }) : toggleSave.mutate({ shortId: item.id })} busy={toggleLike.isPending || toggleSave.isPending} />} />}
  </ScreenContainer>;
}

function ShortCard({ item, onToggle, busy }: { item: Short; onToggle: () => void; busy: boolean }) {
  const player = useVideoPlayer(item.sourceType === "managed" ? item.videoUrl : null, (video) => { video.loop = false; });
  const share = async () => { try { await Share.share({ title: item.title, message: [item.title, item.description, item.videoUrl, "Shared from Amin Ka Master"].filter(Boolean).join("\n\n") }); } catch { Alert.alert("Share unavailable", "Your device could not open the share sheet."); } };
  return <View style={styles.card}>{item.sourceType === "managed" ? <VideoView player={player} nativeControls contentFit="cover" style={styles.video} /> : <View style={styles.external}><MaterialIcons name={item.sourceType === "youtube" ? "smart-display" : "play-circle-filled"} size={38} color={COLORS.saffron} /><Text style={styles.externalText}>{item.sourceType === "youtube" ? "YouTube Short" : "Instagram Short"}</Text><Text style={styles.externalMeta}>Inline playback remains available in Shorts.</Text></View>}<View style={styles.cardBody}><View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text>{item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}<Text style={styles.cardMeta}>{item.likeCount} {item.likeCount === 1 ? "like" : "likes"}</Text></View><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Share ${item.title}`} onPress={() => void share()} style={styles.iconButton}><MaterialIcons name="share" size={20} color={COLORS.indigo} /></Pressable><Pressable accessibilityRole="button" accessibilityState={{ busy }} onPress={onToggle} disabled={busy} style={styles.removeButton}><MaterialIcons name={item.isLiked ? "favorite" : item.isSaved ? "bookmark-remove" : "bookmark-remove"} size={18} color={COLORS.white} /><Text style={styles.removeText}>{item.isLiked ? "Unlike" : "Remove"}</Text></Pressable></View></View></View>;
}

function OfflineCard({ item, onOpen }: { item: OfflineItem; onOpen: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={`Open offline ${item.title}`} onPress={onOpen} style={({ pressed }) => [styles.offline, pressed && styles.pressed]}><View style={styles.offlineIcon}><MaterialIcons name={item.kind === "pdf" ? "picture-as-pdf" : "video-library"} size={23} color={item.kind === "pdf" ? COLORS.red : COLORS.indigo} /></View><View style={styles.copy}><Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{item.kind.toUpperCase()} · Private internal viewer</Text></View><MaterialIcons name="chevron-right" size={22} color={COLORS.indigo} /></Pressable>; }

const styles = StyleSheet.create({ header: { paddingTop: 10, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 11 }, back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, headerCopy: { flex: 1 }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: COLORS.ink, fontSize: 26, fontWeight: "900" }, subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 }, tabs: { flexDirection: "row", gap: 7, marginBottom: 13 }, tab: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" }, tabActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, tabText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" }, tabTextActive: { color: COLORS.white }, list: { gap: 13, paddingBottom: 30 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 80 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }, muted: { color: COLORS.muted, fontSize: 13 }, retry: { minHeight: 42, paddingHorizontal: 15, borderRadius: 12, backgroundColor: COLORS.indigo, flexDirection: "row", alignItems: "center", gap: 6 }, retryText: { color: COLORS.white, fontWeight: "900" }, card: { overflow: "hidden", borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }, video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: COLORS.indigo }, external: { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#101A32" }, externalText: { color: COLORS.white, fontSize: 16, fontWeight: "900" }, externalMeta: { color: "#D7DFEC", fontSize: 11 }, cardBody: { padding: 13, gap: 12 }, copy: { flex: 1, gap: 4 }, cardTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, cardDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 18 }, cardMeta: { color: COLORS.indigo, fontSize: 11, fontWeight: "800" }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 9 }, iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, removeButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.indigo }, removeText: { color: COLORS.white, fontSize: 12, fontWeight: "900" }, offline: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, offlineIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEA" }, pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] } });
