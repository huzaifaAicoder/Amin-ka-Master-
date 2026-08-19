import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { uploadLearningMedia, type PickedLearningMedia, type UploadedLearningMedia } from "@/lib/media-upload";
import { trpc } from "@/lib/trpc";

type ContentKind = "video" | "pdf";

export default function MediaStudioScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const playlistsQuery = trpc.operations.freePlaylists.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: false });
  const shortsQuery = trpc.operations.shorts.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: false });
  const savePlaylist = trpc.operations.saveFreePlaylist.useMutation({ onSuccess: () => void playlistsQuery.refetch() });
  const saveItem = trpc.operations.saveFreePlaylistItem.useMutation({ onSuccess: () => void playlistsQuery.refetch() });
  const saveShort = trpc.operations.saveShort.useMutation({ onSuccess: () => void shortsQuery.refetch() });
  const [activeTab, setActiveTab] = useState<"playlists" | "shorts">("playlists");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemKind, setItemKind] = useState<ContentKind>("video");
  const [itemFile, setItemFile] = useState<PickedLearningMedia | null>(null);
  const [shortTitle, setShortTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [shortFile, setShortFile] = useState<PickedLearningMedia | null>(null);
  const [uploading, setUploading] = useState(false);

  const playlists = playlistsQuery.data?.playlists ?? [];
  const playlistItems = playlistsQuery.data?.items ?? [];
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const busy = uploading || savePlaylist.isPending || saveItem.isPending || saveShort.isPending;
  if (!user || user.role === "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Operations permission is required.</Text></ScreenContainer>;

  const pickFile = async (kind: ContentKind, target: "item" | "short") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: kind === "pdf" ? "application/pdf" : "video/*", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, file: asset.file } as PickedLearningMedia;
      if (target === "item") setItemFile(file); else setShortFile(file);
    } catch (error) {
      Alert.alert("File not selected", error instanceof Error ? error.message : "The device could not open the file picker. Please try again.");
    }
  };
  const upload = async (file: PickedLearningMedia) => {
    setUploading(true);
    try { return await uploadLearningMedia(file); } finally { setUploading(false); }
  };
  const createPlaylist = async () => {
    if (playlistTitle.trim().length < 3) return Alert.alert("Add a playlist title", "Use at least three characters so students can identify this free collection.");
    try { const result = await savePlaylist.mutateAsync({ title: playlistTitle.trim(), description: playlistDescription.trim() || undefined, thumbnailUrl: "", isPublished: true, displayOrder: playlists.length }); setSelectedPlaylistId(result.playlistId); setPlaylistTitle(""); setPlaylistDescription(""); } catch (error) { Alert.alert("Playlist not saved", error instanceof Error ? error.message : "Please try again."); }
  };
  const createItem = async (isPublished: boolean) => {
    if (!selectedPlaylist) return Alert.alert("Choose a playlist", "Select or create a free playlist before adding a resource.");
    if (itemTitle.trim().length < 3 || !itemFile) return Alert.alert("Add a title and file", "Choose a video or PDF note to publish inside this playlist.");
    try {
      const uploaded = await upload(itemFile);
      await saveItem.mutateAsync({ playlistId: selectedPlaylist.id, title: itemTitle.trim(), description: itemDescription.trim() || undefined, contentType: itemKind, contentUrl: uploaded.url, storageKey: uploaded.key, provider: uploaded.provider, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes, durationSeconds: 0, thumbnailUrl: "", isPublished, displayOrder: playlistItems.filter((item) => item.playlistId === selectedPlaylist.id).length });
      setItemTitle(""); setItemDescription(""); setItemFile(null);
      Alert.alert(isPublished ? "Resource published" : "Resource saved as draft", isPublished ? "Students can now see this free resource." : "You can publish this resource later from Media Maintenance.");
    } catch (error) { Alert.alert(isPublished ? "Resource not published" : "Draft not saved", error instanceof Error ? error.message : "Check your connection and try again."); }
  };
  const createShort = async (status: "draft" | "published") => {
    if (shortTitle.trim().length < 3 || !shortFile) return Alert.alert("Add a title and vertical video", "Choose a vertical MP4 or compatible video before publishing a Short.");
    try {
      const uploaded: UploadedLearningMedia = await upload(shortFile);
      await saveShort.mutateAsync({ title: shortTitle.trim(), description: shortDescription.trim() || undefined, contentUrl: uploaded.url, storageKey: uploaded.key, provider: uploaded.provider, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes, durationSeconds: 0, thumbnailUrl: "", status, displayOrder: (shortsQuery.data ?? []).length });
      setShortTitle(""); setShortDescription(""); setShortFile(null);
      Alert.alert(status === "published" ? "Short published" : "Short saved as draft", status === "published" ? "Students can now view this Short." : "You can publish this Short later from Media Maintenance.");
    } catch (error) { Alert.alert(status === "published" ? "Short not published" : "Draft not saved", error instanceof Error ? error.message : "Check your connection and try again."); }
  };

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={24} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Media studio</Text><View style={{ width: 24 }} /></View><Text style={styles.subtitle}>Upload lightweight recorded lessons, free resources, and vertical knowledge Shorts. Files are sent as authenticated multipart uploads through the protected staff boundary.</Text><View style={styles.tabs}><Tab active={activeTab === "playlists"} label="Free Playlists" onPress={() => setActiveTab("playlists")} /><Tab active={activeTab === "shorts"} label="Shorts" onPress={() => setActiveTab("shorts")} /></View>{activeTab === "playlists" ? <><View style={styles.card}><Text style={styles.cardTitle}>Create free playlist</Text><TextInput value={playlistTitle} onChangeText={setPlaylistTitle} placeholder="e.g. Surveying basics — free" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={playlistDescription} onChangeText={setPlaylistDescription} placeholder="What will students learn?" placeholderTextColor="#98A2B3" multiline style={[styles.input, styles.textarea]} /><PrimaryButton label={savePlaylist.isPending ? "Creating…" : "Create free playlist"} icon="playlist-add" disabled={busy} onPress={createPlaylist} /></View><Text style={styles.sectionTitle}>Choose playlist for resource</Text><FlatList horizontal data={playlists} keyExtractor={(item) => item.id.toString()} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlistStrip} ListEmptyComponent={<Text style={styles.empty}>Create a playlist first.</Text>} renderItem={({ item }) => <Pressable onPress={() => setSelectedPlaylistId(item.id)} style={({ pressed }) => [styles.playlistChip, selectedPlaylistId === item.id && styles.playlistChipActive, pressed && styles.pressed]}><IconCircle icon="playlist-play" size={30} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.chipTitle, selectedPlaylistId === item.id && styles.chipTitleActive]}>{item.title}</Text><Text style={styles.chipMeta}>{playlistItems.filter((resource) => resource.playlistId === item.id).length} resources</Text></View></Pressable>} /><View style={styles.card}><Text style={styles.cardTitle}>{selectedPlaylist ? `Add to ${selectedPlaylist.title}` : "Add a free resource"}</Text><TextInput value={itemTitle} onChangeText={setItemTitle} placeholder="Resource title" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={itemDescription} onChangeText={setItemDescription} placeholder="Short optional description" placeholderTextColor="#98A2B3" multiline style={[styles.input, styles.textareaSmall]} /><View style={styles.kindRow}><Tab active={itemKind === "video"} label="Video" onPress={() => { setItemKind("video"); setItemFile(null); }} /><Tab active={itemKind === "pdf"} label="PDF note" onPress={() => { setItemKind("pdf"); setItemFile(null); }} /></View><Pressable onPress={() => void pickFile(itemKind, "item")} style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}><MaterialIcons name={itemKind === "video" ? "video-library" : "picture-as-pdf"} size={21} color={COLORS.indigo} /><Text style={styles.fileButtonText}>{itemFile?.name ?? `Choose ${itemKind === "video" ? "video" : "PDF"}`}</Text></Pressable><View style={styles.actionRow}><View style={styles.actionHalf}><PrimaryButton label={busy ? "Uploading…" : "Save draft"} icon="save" disabled={busy || !selectedPlaylist} onPress={() => createItem(false)} subtle /></View><View style={styles.actionHalf}><PrimaryButton label={busy ? "Uploading…" : "Publish"} icon="cloud-upload" disabled={busy || !selectedPlaylist} onPress={() => createItem(true)} /></View></View></View></> : <><View style={styles.card}><View style={styles.shortHeading}><View><Text style={styles.cardTitle}>Publish knowledge Short</Text><Text style={styles.note}>Use vertical video, concise title and a brief learning context.</Text></View><IconCircle icon="play-circle-filled" size={42} color={COLORS.saffron} background="#FFF0DE" /></View><TextInput value={shortTitle} onChangeText={setShortTitle} placeholder="Short title" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={shortDescription} onChangeText={setShortDescription} placeholder="Short description" placeholderTextColor="#98A2B3" multiline style={[styles.input, styles.textareaSmall]} /><Pressable onPress={() => void pickFile("video", "short")} style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}><MaterialIcons name="smart-display" size={21} color={COLORS.indigo} /><Text style={styles.fileButtonText}>{shortFile?.name ?? "Choose vertical video"}</Text></Pressable><View style={styles.actionRow}><View style={styles.actionHalf}><PrimaryButton label={busy ? "Uploading…" : "Save draft"} icon="save" disabled={busy} onPress={() => createShort("draft")} subtle /></View><View style={styles.actionHalf}><PrimaryButton label={busy ? "Uploading…" : "Publish Short"} icon="cloud-upload" disabled={busy} onPress={() => createShort("published")} /></View></View></View><Text style={styles.sectionTitle}>Published & draft Shorts</Text>{(shortsQuery.data ?? []).map((item) => <View key={item.id} style={styles.shortRow}><IconCircle icon="play-circle-filled" size={36} color={COLORS.indigo} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.rowCopy}>{item.description || "No description"}</Text></View><Tag label={item.status.toUpperCase()} tone={item.status === "published" ? "green" : item.status === "draft" ? "saffron" : "neutral"} /></View>)}</>}</ScrollView></ScreenContainer>;
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 38, gap: 13 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }, title: { color: COLORS.ink, fontSize: 21, fontWeight: "900" }, subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19 }, tabs: { flexDirection: "row", gap: 8 }, tab: { flex: 1, minHeight: 40, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: COLORS.indigoSoft }, tabActive: { backgroundColor: COLORS.indigo }, tabText: { color: COLORS.indigo, fontWeight: "800", fontSize: 12 }, tabTextActive: { color: COLORS.white }, card: { gap: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, borderRadius: 19, padding: 14 }, cardTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, input: { minHeight: 51, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, backgroundColor: COLORS.paper, color: COLORS.ink, paddingHorizontal: 12, fontSize: 14 }, textarea: { minHeight: 84, paddingTop: 12, textAlignVertical: "top" }, textareaSmall: { minHeight: 65, paddingTop: 12, textAlignVertical: "top" }, sectionTitle: { color: COLORS.ink, fontWeight: "900", fontSize: 16, marginTop: 3 }, playlistStrip: { gap: 8, paddingRight: 12 }, playlistChip: { width: 210, minHeight: 68, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, borderRadius: 15, padding: 10, flexDirection: "row", gap: 8, alignItems: "center" }, playlistChipActive: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft }, chipTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 12 }, chipTitleActive: { color: COLORS.indigo }, chipMeta: { color: COLORS.muted, fontSize: 10, marginTop: 3 }, kindRow: { flexDirection: "row", gap: 8 }, actionRow: { flexDirection: "row", gap: 8 }, actionHalf: { flex: 1 }, fileButton: { minHeight: 50, borderRadius: 13, borderStyle: "dashed", borderWidth: 1, borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft, paddingHorizontal: 13, flexDirection: "row", gap: 9, alignItems: "center" }, fileButtonText: { flex: 1, color: COLORS.indigo, fontWeight: "800", fontSize: 13 }, shortHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, note: { color: COLORS.muted, fontSize: 11, marginTop: 3, maxWidth: 240 }, shortRow: { minHeight: 66, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, padding: 10, flexDirection: "row", alignItems: "center", gap: 9 }, rowTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 13 }, rowCopy: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, empty: { color: COLORS.muted, fontSize: 12 }, denied: { color: COLORS.muted, textAlign: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
