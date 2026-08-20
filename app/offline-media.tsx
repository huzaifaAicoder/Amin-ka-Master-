import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ScreenCapture from "expo-screen-capture";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS } from "@/components/lms-ui";

export default function OfflineMediaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; title?: string }>();
  const uri = typeof params.uri === "string" ? params.uri : "";
  const title = typeof params.title === "string" ? params.title : "Offline video";
  const player = useVideoPlayer(uri, (video) => { video.staysActiveInBackground = false; });
  useEffect(() => { if (Platform.OS === "web") return; const key = "student-offline-video"; void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined); return () => { void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined); }; }, []);
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Close offline video" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><Text numberOfLines={1} style={styles.title}>{title}</Text><Text style={styles.badge}>OFFLINE</Text></View>{uri ? <VideoView player={player} nativeControls contentFit="contain" style={styles.video} surfaceType="textureView" /> : <View style={styles.empty}><Text style={styles.emptyTitle}>Video unavailable</Text><Text style={styles.emptyCopy}>Download the course video again from the enrolled course.</Text></View>}</ScreenContainer>;
}

const styles = StyleSheet.create({ header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.line }, back: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, title: { flex: 1, color: COLORS.ink, fontSize: 15, fontWeight: "900" }, badge: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 }, video: { flex: 1, backgroundColor: "#0F172A" }, empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 28 }, emptyTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "900" }, emptyCopy: { color: COLORS.muted, textAlign: "center", fontSize: 13 } });
