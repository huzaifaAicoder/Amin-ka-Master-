import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState } from "@/components/lms-ui";

type OfflineResource = { uri: string; title: string; size: number; modifiedAt: number; kind: "pdf" | "video" };

export default function DownloadsScreen() {
  const router = useRouter();
  const [resources, setResources] = useState<OfflineResource[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (Platform.OS === "web" || !FileSystem.documentDirectory) { setResources([]); setLoading(false); return; }
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
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const readableSize = (size: number) => size > 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1_000))} KB`;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>STUDENT LIBRARY</Text><Text style={styles.title}>Downloads</Text></View><View style={styles.badge}><MaterialIcons name="lock" size={15} color={COLORS.green} /><Text style={styles.badgeText}>PRIVATE</Text></View></View>
    <Text style={styles.copy}>Offline course files stored privately on this device. They remain inside Amin Ka Master and open only in internal viewers.</Text>
    {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View> : <FlatList data={resources} keyExtractor={(item) => item.uri} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} colors={[COLORS.indigo]} />} contentContainerStyle={resources.length ? styles.list : styles.emptyList} ListEmptyComponent={<EmptyState icon="download" title="No offline resources" body={Platform.OS === "web" ? "Private downloads are available in the Amin Ka Master mobile app." : "Download an approved course resource to find it here."} />} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title} in the internal ${item.kind} viewer`} onPress={() => router.push((item.kind === "pdf" ? { pathname: "/pdf-reader", params: { uri: item.uri, title: item.title } } : { pathname: "/offline-media", params: { uri: item.uri, title: item.title } }) as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.icon}><MaterialIcons name={item.kind === "pdf" ? "picture-as-pdf" : "video-library"} size={23} color={item.kind === "pdf" ? COLORS.red : COLORS.indigo} /></View><View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.kind.toUpperCase()} · {readableSize(item.size)} · Internal viewer</Text></View><MaterialIcons name="chevron-right" size={22} color={COLORS.indigo} /></Pressable>} />}
  </ScreenContainer>;
}

const styles = StyleSheet.create({ header: { paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: COLORS.ink, fontSize: 27, fontWeight: "900" }, badge: { flexDirection: "row", gap: 4, alignItems: "center", borderRadius: 10, backgroundColor: COLORS.greenSoft, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { color: COLORS.green, fontSize: 10, fontWeight: "900" }, copy: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 14 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, list: { gap: 10, paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 70 }, row: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEA" }, rowCopy: { flex: 1, gap: 4 }, rowTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900", textTransform: "capitalize" }, rowMeta: { color: COLORS.muted, fontSize: 11 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] } });
