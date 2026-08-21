import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState } from "@/components/lms-ui";
import { clearOfflineDownloadFailure, downloadAuthorizedOfflineResource, loadOfflineDownloadFailures, matchesOfflineSearch, recordOfflineDownloadFailure, type OfflineDownloadFailure } from "@/lib/offline-resources";
import { trpc } from "@/lib/trpc";

type OfflineResource = { uri: string; title: string; size: number; modifiedAt: number; kind: "pdf" | "video" };

export default function DownloadsScreen() {
  const router = useRouter();
  const [resources, setResources] = useState<OfflineResource[]>([]);
  const [failures, setFailures] = useState<OfflineDownloadFailure[]>([]);
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const resourceDownloadMutation = trpc.student.requestResourceDownload.useMutation();
  const shortDownloadMutation = trpc.student.requestShortDownload.useMutation();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (Platform.OS === "web" || !FileSystem.documentDirectory) { setResources([]); setFailures([]); setLoading(false); return; }
    setLoading(true);
    try {
      const folder = `${FileSystem.documentDirectory}protected-resources/`;
      const entries = await FileSystem.readDirectoryAsync(folder).catch(() => []);
      const scanned = await Promise.all(entries.filter((name) => /\.(pdf|mp4|mov|m4v|webm)$/i.test(name)).map(async (name) => {
        const uri = `${folder}${name}`;
        const info = await FileSystem.getInfoAsync(uri);
        const kind = /\.pdf$/i.test(name) ? "pdf" : "video";
        return info.exists ? { uri, title: name.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\.(pdf|mp4|mov|m4v|webm)$/i, ""), size: info.size ?? 0, modifiedAt: info.modificationTime ?? 0, kind } : null;
      }));
      setResources(scanned.filter((item): item is OfflineResource => Boolean(item)).sort((a, b) => b.modifiedAt - a.modifiedAt));
      setFailures(await loadOfflineDownloadFailures());
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const readableSize = (size: number) => size > 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1_000))} KB`;
  const completedMatches = resources.filter((item) => matchesOfflineSearch(item.title, search));
  const failedMatches = failures.filter((item) => matchesOfflineSearch(item.title, search));
  const retry = async (failure: OfflineDownloadFailure) => {
    setRetryingId(failure.resourceId);
    try {
      const issued = failure.source === "reel" ? await shortDownloadMutation.mutateAsync({ shortId: failure.resourceId }) : await resourceDownloadMutation.mutateAsync({ resourceId: failure.resourceId });
      await downloadAuthorizedOfflineResource(issued, failure.title, failure.kind);
      await clearOfflineDownloadFailure(failure.resourceId);
      await load();
      Alert.alert("Downloaded", `${failure.title} is ready in your private offline library.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your connection and try again.";
      const next = await recordOfflineDownloadFailure({ resourceId: failure.resourceId, title: failure.title, kind: failure.kind, source: failure.source, message });
      setFailures(next);
      Alert.alert("Retry unavailable", message);
    } finally { setRetryingId(null); }
  };
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>STUDENT LIBRARY</Text><Text style={styles.title}>Downloads</Text></View><View style={styles.badge}><MaterialIcons name="lock" size={15} color={COLORS.green} /><Text style={styles.badgeText}>PRIVATE</Text></View></View>
    <Text style={styles.copy}>Offline course files stored privately on this device. They remain inside Amin Ka Master and open only in internal viewers.</Text>
    <View style={styles.search}><MaterialIcons name="search" size={20} color={COLORS.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search downloaded files" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="done" /></View>
    {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View> : <FlatList data={completedMatches} keyExtractor={(item) => item.uri} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} colors={[COLORS.indigo]} />} contentContainerStyle={completedMatches.length || failedMatches.length ? styles.list : styles.emptyList} ListHeaderComponent={failedMatches.length ? <View style={styles.failedSection}><Text style={styles.failedHeading}>Needs retry</Text>{failedMatches.map((item) => <View key={`failed-${item.resourceId}`} style={styles.failedRow}><View style={styles.failedIcon}><MaterialIcons name="cloud-off" size={22} color={COLORS.red} /></View><View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text><Text numberOfLines={2} style={styles.failedMeta}>{item.message}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Retry download ${item.title}`} disabled={retryingId === item.resourceId} onPress={() => void retry(item)} style={({ pressed }) => [styles.retry, (pressed || retryingId === item.resourceId) && styles.pressed]}>{retryingId === item.resourceId ? <ActivityIndicator size="small" color={COLORS.white} /> : <><MaterialIcons name="refresh" size={17} color={COLORS.white} /><Text style={styles.retryText}>Retry</Text></>}</Pressable></View>)}</View> : null} ListEmptyComponent={<EmptyState icon={search ? "search-off" : "download"} title={search ? "No matching files" : "No offline resources"} body={search ? "Try another file title. Search works entirely on this device." : Platform.OS === "web" ? "Private downloads are available in the Amin Ka Master mobile app." : "Download an approved course resource to find it here."} />} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title} in the internal ${item.kind} viewer`} onPress={() => router.push((item.kind === "pdf" ? { pathname: "/pdf-reader", params: { uri: item.uri, title: item.title } } : { pathname: "/offline-media", params: { uri: item.uri, title: item.title } }) as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.icon}><MaterialIcons name={item.kind === "pdf" ? "picture-as-pdf" : "video-library"} size={23} color={item.kind === "pdf" ? COLORS.red : COLORS.indigo} /></View><View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.kind.toUpperCase()} · {readableSize(item.size)} · Internal viewer</Text></View><MaterialIcons name="chevron-right" size={22} color={COLORS.indigo} /></Pressable>} />}
  </ScreenContainer>;
}

const styles = StyleSheet.create({ header: { paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: COLORS.ink, fontSize: 27, fontWeight: "900" }, badge: { flexDirection: "row", gap: 4, alignItems: "center", borderRadius: 10, backgroundColor: COLORS.greenSoft, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { color: COLORS.green, fontSize: 10, fontWeight: "900" }, copy: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 12 }, search: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, marginBottom: 12 }, searchInput: { flex: 1, color: COLORS.ink, fontSize: 14, minHeight: 46 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, list: { gap: 10, paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 70 }, failedSection: { gap: 8, marginBottom: 4 }, failedHeading: { color: COLORS.red, fontSize: 13, fontWeight: "900", marginTop: 2 }, failedRow: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 9, padding: 10, borderRadius: 16, backgroundColor: "#FFF7F6", borderWidth: 1, borderColor: "#F6C8C1" }, failedIcon: { width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEA" }, failedMeta: { color: COLORS.red, fontSize: 11, lineHeight: 15 }, retry: { minWidth: 64, minHeight: 36, borderRadius: 10, backgroundColor: COLORS.indigo, paddingHorizontal: 8, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" }, retryText: { color: COLORS.white, fontSize: 11, fontWeight: "900" }, row: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEA" }, rowCopy: { flex: 1, gap: 4 }, rowTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textTransform: "capitalize" }, rowMeta: { color: COLORS.muted, fontSize: 11 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] } });
