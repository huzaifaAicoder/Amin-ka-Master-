import { createElement, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { getYouTubeEmbedUrl } from "@/lib/youtube";

export type ExternalMediaSource = "youtube" | "instagram";

/** Converts only already-validated provider URLs into their inline embed form. */
export function getExternalMediaEmbedUrl(sourceType: ExternalMediaSource, url: string) {
  if (sourceType === "youtube") {
    return getYouTubeEmbedUrl(url);
  }
  const match = url.match(/instagram\.com\/(?:reel|p)\/([^/?#]+)/i);
  return match ? `https://www.instagram.com/${url.includes("/p/") ? "p" : "reel"}/${match[1]}/embed/captioned/` : null;
}

export function ExternalMediaPlayer({ sourceType, uri, onFailure, style }: { sourceType: ExternalMediaSource; uri: string; onFailure: () => void; style?: StyleProp<ViewStyle> }) {
  const [loading, setLoading] = useState(true);
  const playerStyle = style ?? styles.fill;
  if (Platform.OS === "web") {
    return <View style={playerStyle}>{createElement("iframe", { src: uri, title: `${sourceType} educational video`, allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture", allowFullScreen: true, onLoad: () => setLoading(false), onError: () => { setLoading(false); onFailure(); }, style: { width: "100%", height: "100%", border: "0", backgroundColor: "#101A32" } })}{loading ? <ProviderLoadingOverlay label={`Loading ${sourceType === "youtube" ? "YouTube" : "Instagram"}…`} /> : null}</View>;
  }
  const isYouTube = sourceType === "youtube";
  const isProviderNavigation = (url: string) => isYouTube
    ? /(^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\/)/i.test(url)
    : /^https:\/\/(www\.)?instagram\.com\//i.test(url);
  return <View style={playerStyle}><WebView source={{ uri, headers: isYouTube ? { Referer: "https://www.youtube.com/", Origin: "https://www.youtube.com", "Accept-Language": "en-US,en;q=0.9" } : undefined }} style={styles.fill} javaScriptEnabled javaScriptCanOpenWindowsAutomatically domStorageEnabled thirdPartyCookiesEnabled cacheEnabled allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} setSupportMultipleWindows={false} userAgent={isYouTube ? "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" : undefined} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onShouldStartLoadWithRequest={(request) => isProviderNavigation(request.url)} onError={() => { setLoading(false); onFailure(); }} onHttpError={() => { setLoading(false); onFailure(); }} injectedJavaScript={isYouTube ? undefined : `document.addEventListener('click', function(event) { var link = event.target && event.target.closest && event.target.closest('a'); if (link) event.preventDefault(); }, true); true;`} />{loading ? <ProviderLoadingOverlay label={`Loading ${isYouTube ? "YouTube" : "Instagram"}…`} /> : null}</View>;
}

function ProviderLoadingOverlay({ label }: { label: string }) { return <View pointerEvents="none" accessibilityLiveRegion="polite" accessibilityLabel={label} style={styles.loading}><ActivityIndicator color="#FFFFFF" /><Text style={styles.loadingText}>{label}</Text></View>; }

const styles = StyleSheet.create({ fill: { flex: 1, width: "100%", backgroundColor: "#101A32" }, loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(16,26,50,0.72)" }, loadingText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" } });
