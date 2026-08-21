import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("AI keyboard and Reels interaction repair", () => {
  it("keeps the full AI composer keyboard-safe and refocuses the input from the composer surface", () => {
    const ai = read("app/ask-ai.tsx");
    expect(ai).toContain('keyboardShouldPersistTaps="always"');
    expect(ai).toContain("onPress={() => composerInputRef.current?.focus()}");
    expect(ai).toContain("onFocus={scrollToLatest}");
  });

  it("shows an accessible, elapsed typing state while an AI answer is pending", () => {
    const ai = read("app/ask-ai.tsx");
    expect(ai).toContain("const [waitingSeconds, setWaitingSeconds] = useState(0)");
    expect(ai).toContain("const waitingStage = waitingSeconds < 5");
    expect(ai).toContain("const { label } = useLanguagePreference()");
    expect(ai).toContain('label("Reading your question", "आपका प्रश्न पढ़ रहे हैं")');
    expect(ai).toContain('label("Preparing a clear answer", "स्पष्ट उत्तर तैयार कर रहे हैं")');
    expect(ai).toContain('label("GEMINI IS THINKING", "जेमिनी सोच रहा है")');
    expect(ai).toContain("accessibilityValue={{ text: elapsedLabel }}");
    expect(ai).toContain("<ActivityIndicator size=\"small\" color={COLORS.indigo} />");
    expect(ai).toContain("<Text style={styles.elapsedText}>{elapsedLabel}</Text>");
  });

  it("uses a runtime full-page measurement and active-item tracking for one Reel at a time", () => {
    const shorts = read("app/(tabs)/shorts.tsx");
    expect(shorts).toContain("const { height: windowHeight } = useWindowDimensions()");
    expect(shorts).toContain("const pageHeight = Math.max(windowHeight - insets.top - (70 + insets.bottom), 480)");
    expect(shorts).toContain("pagingEnabled");
    expect(shorts).toContain("disableIntervalMomentum");
    expect(shorts).toContain("onMomentumScrollEnd");
  });

  it("shares useful Short context and limits private downloads to native managed media", () => {
    const shorts = read("app/(tabs)/shorts.tsx");
    expect(shorts).toContain('item.sourceType !== "managed" ? item.videoUrl : null');
    expect(shorts).toContain('const canDownload = item.sourceType === "managed" && Platform.OS !== "web"');
    expect(shorts).toContain("clearOfflineDownloadFailure(item.id)");
    expect(shorts).toContain('Alert.alert("Share unavailable"');
  });
});
