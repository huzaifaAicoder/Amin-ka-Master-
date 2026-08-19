import * as ScreenCapture from "expo-screen-capture";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS } from "@/components/lms-ui";

export default function PdfReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; title?: string }>();
  const uri = typeof params.uri === "string" ? params.uri : "";
  const title = typeof params.title === "string" ? params.title : "Course PDF";

  useEffect(() => {
    if (Platform.OS === "web") return;
    const key = "student-pdf-reader";
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => { void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined); };
  }, []);

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close PDF reader" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <Text style={styles.badge}>IN-APP</Text>
    </View>
    {Platform.OS === "web" ? <View style={styles.message}><Text style={styles.messageTitle}>Open this PDF in the Amin Ka Master mobile app</Text><Text style={styles.messageBody}>Private offline PDF storage and the internal reader are intentionally not exposed through the browser download flow.</Text></View> : uri ? <WebView source={{ uri }} style={styles.viewer} originWhitelist={["file://", "http://", "https://"]} javaScriptEnabled={false} domStorageEnabled={false} setSupportMultipleWindows={false} allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} /> : <View style={styles.message}><Text style={styles.messageTitle}>PDF unavailable</Text><Text style={styles.messageBody}>Download the learning resource again from the enrolled course.</Text></View>}
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.line, backgroundColor: COLORS.paper },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  backText: { color: COLORS.indigo, fontSize: 30, lineHeight: 30, marginTop: -3 },
  title: { flex: 1, color: COLORS.ink, fontSize: 15, fontWeight: "900" },
  badge: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  viewer: { flex: 1, backgroundColor: COLORS.paper },
  message: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  messageTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "900", textAlign: "center" },
  messageBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
