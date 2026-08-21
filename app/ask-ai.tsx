import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { PinchGestureHandler, State as GestureState } from "react-native-gesture-handler";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, Tag } from "@/components/lms-ui";
import { useLanguagePreference } from "@/lib/language-preference";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type ChatMessage = { id: string; role: "student" | "assistant"; body: string; placeholder?: boolean; suggestions?: string[] };
type SelectedStudyImage = { uri: string; base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" };
const MAX_VISION_IMAGE_BASE64 = 3_500_000;

function getFollowUpPrompts(question: string) {
  const topic = question.toLowerCase();
  if (topic.includes("survey") || topic.includes("chain") || topic.includes("theodolite")) return ["Show me a worked field example", "What are the common errors?", "Give me a practice question"];
  if (topic.includes("revenue") || topic.includes("record") || topic.includes("jamabandi")) return ["Explain this in simple Hindi-English", "What documents should I check?", "Give me an exam-style question"];
  if (topic.includes("area") || topic.includes("measure") || topic.includes("calculate")) return ["Show the calculation step by step", "Which formula should I remember?", "Give me a similar problem"];
  return ["Can you explain that with a simple example?", "What are the key points to remember?", "Give me a practice question"];
}

export default function AskAiScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const { label } = useLanguagePreference();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedImage, setSelectedImage] = useState<SelectedStudyImage | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const composerInputRef = useRef<TextInput>(null);
  const askMutation = trpc.student.askAi.useMutation();
  const threadRef = useRef<ScrollView>(null);
  const typingPulse = useRef(new Animated.Value(0)).current;
  const previewScale = useRef(new Animated.Value(1)).current;
  const enabled = user?.role === "student";

  const scrollToLatest = () => requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));

  useEffect(() => {
    scrollToLatest();
  }, [messages.length, askMutation.isPending]);

  useEffect(() => {
    if (!askMutation.isPending) {
      typingPulse.stopAnimation();
      typingPulse.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(typingPulse, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(typingPulse, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [askMutation.isPending, typingPulse]);

  useEffect(() => {
    if (!askMutation.isPending) {
      setWaitingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setWaitingSeconds(0);
    const timer = setInterval(() => setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(timer);
  }, [askMutation.isPending]);

  const waitingStage = waitingSeconds < 5
    ? label("Reading your question", "आपका प्रश्न पढ़ रहे हैं")
    : waitingSeconds < 13
      ? label("Preparing a clear answer", "स्पष्ट उत्तर तैयार कर रहे हैं")
      : label("Still working — this may take a little longer", "अभी उत्तर तैयार हो रहा है — थोड़ा समय लग सकता है");
  const thinkingLabel = label("GEMINI IS THINKING", "जेमिनी सोच रहा है");
  const elapsedLabel = label(`${waitingSeconds}s elapsed`, `${waitingSeconds} सेकंड`);
  const waitingAccessibilityLabel = label("Gemini is preparing an answer.", "जेमिनी उत्तर तैयार कर रहा है। ");

  const sendQuestion = async () => {
    const cleanQuestion = question.trim();
    if (cleanQuestion.length < 3) return Alert.alert("Add your doubt", "Type a question with at least three characters.");
    const imageForRequest = selectedImage;
    setQuestion("");
    setSelectedImage(null);
    setMessages((current) => [...current, { id: `student-${Date.now()}`, role: "student", body: imageForRequest ? `${cleanQuestion}\n\n[Image attached for educational analysis]` : cleanQuestion }]);
    try {
      const result = await askMutation.mutateAsync({ question: cleanQuestion, ...(imageForRequest ? { image: { base64: imageForRequest.base64, mimeType: imageForRequest.mimeType } } : {}) });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", body: result.answer, placeholder: result.mode === "fallback", suggestions: getFollowUpPrompts(cleanQuestion) }]);
    } catch (error) {
      Alert.alert("Doubt Solver unavailable", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const chooseFollowUp = (prompt: string) => {
    setQuestion(prompt);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const attachImage = async (source: "camera" | "library") => {
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") return Alert.alert("Camera permission needed", "Allow camera access to photograph a map or document for this study question.");
      }
      setPreparingImage(true);
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 1, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 1, allowsEditing: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) return Alert.alert("Image unavailable", "This image could not be prepared. Try another JPG, PNG, or WebP image.");
      const sourceUri = Platform.OS === "web" ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}` : asset.uri;
      const prepared = await ImageManipulator.manipulateAsync(sourceUri, [{ resize: { width: 1_600 } }], { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!prepared.base64 || prepared.base64.length > MAX_VISION_IMAGE_BASE64) return Alert.alert("Choose a smaller image", "Use a clearer, smaller map or document image so it can be analysed securely.");
      setSelectedImage({ uri: prepared.uri, base64: prepared.base64, mimeType: "image/jpeg" });
    } catch {
      Alert.alert("Image not attached", "The image picker could not open. Please try again.");
    } finally { setPreparingImage(false); }
  };

  const chooseImageSource = () => Alert.alert("Add map or document image", "After selection, use the native Crop / Adjust step to focus on the needed part. The cropped image is sent only with this AI question and is not saved in your chat, downloads, or learning profile.", [{ text: "Cancel", style: "cancel" }, { text: "Take photo", onPress: () => void attachImage("camera") }, { text: "Choose from library", onPress: () => void attachImage("library") }]);

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Sign in with a Student account to use the Doubt Solver.</Text></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0} style={styles.keyboardAvoider}>
      <View style={styles.chatShell}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Home" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.title}>Ask AI</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open AI Quiz" onPress={() => router.push("/ai-quiz")} style={({ pressed }) => [styles.quizLink, pressed && styles.pressed]}><MaterialIcons name="quiz" size={16} color={COLORS.indigo} /><Text style={styles.quizLinkText}>Quiz</Text></Pressable><Tag label="GEMINI" tone="green" /></View>
      {messages.length === 0 ? <View style={styles.notice}><Text style={styles.noticeText}>Ask about anything you are learning—general knowledge, maths, science, surveying, land measurement, revenue records, or exam preparation. Attach a map or document image for educational guidance, not official verification.</Text></View> : null}
      {messages.length ? <View style={styles.historyHeader}><View style={styles.historyTitleWrap}><MaterialIcons name="forum" size={16} color={COLORS.indigo} /><Text style={styles.historyTitle}>Conversation</Text><Text style={styles.historyCount}>{messages.length} message{messages.length === 1 ? "" : "s"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Clear Doubt Solver conversation" onPress={() => setMessages([])} disabled={askMutation.isPending} style={({ pressed }) => [styles.clearButton, (pressed || askMutation.isPending) && styles.pressed]}><MaterialIcons name="delete-outline" size={16} color={COLORS.indigo} /><Text style={styles.clearText}>Clear</Text></Pressable></View> : null}
      <ScrollView ref={threadRef} style={styles.threadScroll} onContentSizeChange={scrollToLatest} contentContainerStyle={[styles.thread, messages.length === 0 && styles.emptyThread]} showsVerticalScrollIndicator keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
        {messages.length === 0 ? <View style={styles.empty}><IconCircle icon="psychology" size={52} color={COLORS.indigo} background={COLORS.indigoSoft} /><Text style={styles.emptyTitle}>What are you stuck on?</Text><Text style={styles.emptyBody}>Ask about a general, mathematical, scientific, or surveying question. Gemini answers stay behind the authenticated server boundary.</Text><View style={styles.suggestions}><Text style={styles.suggestion}>“How do I calculate chain survey error?”</Text><Text style={styles.suggestion}>“Explain plot measurement in simple Hindi-English.”</Text></View></View> : messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === "student" ? styles.studentBubble : styles.aiBubble]}><Text style={[styles.bubbleLabel, message.role === "student" && styles.studentLabel]}>{message.role === "student" ? "YOU" : "DOUBT SOLVER"}</Text><Text style={[styles.bubbleText, message.role === "student" && styles.studentText]}>{message.body}</Text>{message.placeholder ? <Text style={styles.placeholderNote}>Fallback response · provider unavailable</Text> : null}{message.role === "assistant" && message.suggestions?.length ? <View style={styles.followUps}><Text style={styles.followUpLabel}>CONTINUE LEARNING</Text><View style={styles.followUpRow}>{message.suggestions.map((prompt) => <Pressable key={prompt} accessibilityRole="button" accessibilityLabel={`Ask follow-up: ${prompt}`} disabled={askMutation.isPending} onPress={() => chooseFollowUp(prompt)} style={({ pressed }) => [styles.followUpChip, (pressed || askMutation.isPending) && styles.pressed]}><Text style={styles.followUpText}>{prompt}</Text></Pressable>)}</View></View> : null}</View>)}
        {askMutation.isPending ? <View accessibilityRole="progressbar" accessibilityLabel={`${waitingAccessibilityLabel} ${waitingStage}. ${elapsedLabel}.`} accessibilityValue={{ text: elapsedLabel }} accessibilityLiveRegion="polite" style={[styles.bubble, styles.aiBubble, styles.thinking]}><View style={styles.typingAvatar}><ActivityIndicator size="small" color={COLORS.indigo} /></View><View style={styles.typingCopy}><Text style={styles.typingLabel}>{thinkingLabel}</Text><Text style={styles.thinkingStage}>{waitingStage}</Text><View style={styles.dotRow}><Animated.View style={[styles.typingDot, { opacity: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }), transform: [{ translateY: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]} /><Animated.View style={[styles.typingDot, { opacity: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] }) }]} /><Animated.View style={[styles.typingDot, { opacity: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }), transform: [{ translateY: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [-3, 0] }) }] }]} /><Text style={styles.elapsedText}>{elapsedLabel}</Text></View></View></View> : null}
      </ScrollView>
      <View style={styles.composerArea}>{selectedImage ? <View style={styles.imageDraft}><Pressable accessibilityRole="button" accessibilityLabel="Preview cropped image" onPress={() => setImagePreviewVisible(true)} style={({ pressed }) => [styles.imagePreviewButton, pressed && styles.pressed]}><Image source={{ uri: selectedImage.uri }} style={styles.imageThumb} /><View style={{ flex: 1 }}><Text style={styles.imageDraftTitle}>Cropped preview ready</Text><Text style={styles.imageDraftBody}>Tap to review. Sent only with your next question; it is not stored in chat history.</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remove selected image" onPress={() => setSelectedImage(null)} style={styles.removeImage}><MaterialIcons name="close" size={18} color={COLORS.indigo} /></Pressable></View> : null}<Pressable accessibilityRole="none" onPress={() => composerInputRef.current?.focus()} style={styles.composer}><Pressable accessibilityRole="button" accessibilityLabel="Attach and crop a map or document image" disabled={askMutation.isPending || preparingImage} onPress={chooseImageSource} style={({ pressed }) => [styles.attach, (pressed || askMutation.isPending || preparingImage) && styles.pressed]}>{preparingImage ? <ActivityIndicator size="small" color={COLORS.indigo} /> : <MaterialIcons name="add-a-photo" size={21} color={COLORS.indigo} />}</Pressable><TextInput ref={composerInputRef} value={question} onChangeText={setQuestion} onFocus={scrollToLatest} editable={!askMutation.isPending && !preparingImage} placeholder="Type your doubt…" placeholderTextColor="#98A2B3" multiline style={styles.input} textAlignVertical="top" maxLength={1500} /><Pressable accessibilityRole="button" accessibilityLabel="Send question to Doubt Solver" disabled={askMutation.isPending || preparingImage} onPress={() => void sendQuestion()} style={({ pressed }) => [styles.send, (pressed || askMutation.isPending || preparingImage) && styles.pressed]}>{askMutation.isPending ? <ActivityIndicator size="small" color={COLORS.white} /> : <MaterialIcons name="send" size={21} color={COLORS.white} />}</Pressable></Pressable></View>
      </View>
      <Modal visible={imagePreviewVisible && Boolean(selectedImage)} transparent animationType="fade" onRequestClose={() => setImagePreviewVisible(false)}><View style={styles.previewOverlay}><View style={styles.previewCard}><View style={styles.previewHeader}><Text style={styles.previewTitle}>Cropped image preview</Text><Pressable accessibilityRole="button" accessibilityLabel="Close image preview" onPress={() => setImagePreviewVisible(false)} style={styles.previewClose}><MaterialIcons name="close" size={20} color={COLORS.indigo} /></Pressable></View><Text style={styles.zoomHint}>Pinch with two fingers to zoom. The preview resets when you lift your fingers.</Text>{selectedImage ? <PinchGestureHandler onGestureEvent={Animated.event([{ nativeEvent: { scale: previewScale } }], { useNativeDriver: true })} onHandlerStateChange={(event) => { if (event.nativeEvent.oldState === GestureState.ACTIVE) Animated.spring(previewScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0 }).start(); }}><Animated.View style={[styles.previewImageFrame, { transform: [{ scale: previewScale }] }]}><Image accessibilityLabel="Pinch-to-zoom cropped study image" source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="contain" /></Animated.View></PinchGestureHandler> : null}<Text style={styles.previewCopy}>This prepared image remains in local memory until you send or remove it. It is not saved in chat history, downloads, or your learning profile.</Text></View></View></Modal>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, keyboardAvoider: { flex: 1 }, chatShell: { flex: 1, minHeight: 0 }, threadScroll: { flex: 1 }, composerArea: { flexShrink: 0, paddingTop: 8, paddingBottom: 2, backgroundColor: COLORS.paper }, header: { paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, heading: { flex: 1 }, quizLink: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 10, paddingHorizontal: 8, backgroundColor: COLORS.indigoSoft }, quizLinkText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }, title: { color: COLORS.ink, fontSize: 21, fontWeight: "900" }, notice: { borderRadius: 16, backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F", padding: 12, gap: 7 }, noticeText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, historyHeader: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, historyTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 }, historyTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, historyCount: { color: COLORS.muted, fontSize: 11 }, clearButton: { minHeight: 32, borderRadius: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.indigoSoft }, clearText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" }, thread: { paddingVertical: 16, gap: 10, flexGrow: 1, paddingBottom: 24 }, emptyThread: { justifyContent: "center" }, empty: { alignItems: "center", gap: 11, paddingHorizontal: 20 }, emptyTitle: { color: COLORS.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }, emptyBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }, suggestions: { width: "100%", gap: 7, marginTop: 5 }, suggestion: { padding: 10, borderRadius: 12, backgroundColor: COLORS.indigoSoft, color: COLORS.indigo, fontSize: 12, fontWeight: "700" }, bubble: { maxWidth: "88%", borderRadius: 18, padding: 12, gap: 5 }, studentBubble: { alignSelf: "flex-end", backgroundColor: COLORS.indigo, borderBottomRightRadius: 5 }, aiBubble: { alignSelf: "flex-start", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderBottomLeftRadius: 5 }, bubbleLabel: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, studentLabel: { color: "#D8E1F7" }, bubbleText: { color: COLORS.ink, fontSize: 14, lineHeight: 20 }, studentText: { color: COLORS.white }, placeholderNote: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", marginTop: 3 }, followUps: { marginTop: 7, gap: 7, borderTopWidth: 1, borderTopColor: "#E7ECF5", paddingTop: 8 }, followUpLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, followUpRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, followUpChip: { borderRadius: 12, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#D9E2F5", paddingHorizontal: 9, paddingVertical: 7, maxWidth: "100%" }, followUpText: { color: COLORS.indigo, fontSize: 11, lineHeight: 15, fontWeight: "800" }, thinking: { flexDirection: "row", alignItems: "center", gap: 9, minWidth: 220 }, typingAvatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, typingCopy: { flex: 1, gap: 4 }, typingLabel: { color: COLORS.indigo, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, thinkingStage: { color: COLORS.ink, fontSize: 12, fontWeight: "800", lineHeight: 16 }, dotRow: { flexDirection: "row", gap: 5, minHeight: 12, alignItems: "center" }, typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.indigo }, elapsedText: { marginLeft: 2, color: COLORS.muted, fontSize: 10, fontWeight: "800" }, imageDraft: { marginTop: 0, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, padding: 8, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#D9E2F5" }, imagePreviewButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9 }, imageThumb: { width: 42, height: 42, borderRadius: 9, backgroundColor: "#D9E2F5" }, imageDraftTitle: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, imageDraftBody: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 2 }, removeImage: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white }, previewOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.72)", padding: 22, justifyContent: "center" }, previewCard: { maxHeight: "82%", padding: 14, borderRadius: 20, backgroundColor: COLORS.white, gap: 11 }, previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, previewTitle: { flex: 1, color: COLORS.ink, fontSize: 16, fontWeight: "900" }, previewClose: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, zoomHint: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: -5 }, previewImageFrame: { width: "100%", height: 300, overflow: "hidden", borderRadius: 14, backgroundColor: "#F1F5F9" }, previewImage: { width: "100%", height: 300, borderRadius: 14, backgroundColor: "#F1F5F9" }, previewCopy: { color: COLORS.muted, fontSize: 11, lineHeight: 16 }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line }, attach: { width: 44, height: 50, borderRadius: 15, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, input: { flex: 1, minHeight: 50, maxHeight: 110, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 12, color: COLORS.ink, fontSize: 14 }, send: { width: 50, height: 50, borderRadius: 15, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" }, denied: { color: COLORS.muted, textAlign: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
