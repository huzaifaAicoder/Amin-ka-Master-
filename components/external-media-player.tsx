import { createElement } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
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
  if (Platform.OS === "web") {
    return createElement("iframe", {
      src: uri,
      title: `${sourceType} educational video`,
      allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
      allowFullScreen: true,
      onError: onFailure,
      style: { width: "100%", height: "100%", border: "0", backgroundColor: "#101A32" },
    });
  }
  const isYouTube = sourceType === "youtube";
  const isProviderNavigation = (url: string) => isYouTube
    ? /(^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\/)/i.test(url)
    : /^https:\/\/(www\.)?instagram\.com\//i.test(url);
  return <WebView source={{ uri, headers: isYouTube ? { Referer: "https://www.youtube.com/", Origin: "https://www.youtube.com", "Accept-Language": "en-US,en;q=0.9" } : undefined }} style={style ?? styles.fill} javaScriptEnabled javaScriptCanOpenWindowsAutomatically domStorageEnabled thirdPartyCookiesEnabled cacheEnabled allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} setSupportMultipleWindows={false} userAgent={isYouTube ? "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" : undefined} onShouldStartLoadWithRequest={(request) => isProviderNavigation(request.url)} onError={onFailure} onHttpError={onFailure} injectedJavaScript={isYouTube ? undefined : `document.addEventListener('click', function(event) { var link = event.target && event.target.closest && event.target.closest('a'); if (link) event.preventDefault(); }, true); true;`} />;
}

const styles = StyleSheet.create({ fill: { flex: 1, width: "100%", backgroundColor: "#101A32" } });
