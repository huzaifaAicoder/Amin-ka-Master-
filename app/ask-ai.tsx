import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type ChatMessage = { id: string; role: "student" | "assistant"; body: string; placeholder?: boolean; suggestions?: string[] };

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
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const composerInputRef = useRef<TextInput>(null);
  const askMutation = trpc.student.askAi.useMutation();
  const threadRef = useRef<ScrollView>(null);
  const typingPulse = useRef(new Animated.Value(0)).current;
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

  const sendQuestion = async () => {
    const cleanQuestion = question.trim();
    if (cleanQuestion.length < 3) return Alert.alert("Add your doubt", "Type a question with at least three characters.");
    setQuestion("");
    setMessages((current) => [...current, { id: `student-${Date.now()}`, role: "student", body: cleanQuestion }]);
    try {
      const result = await askMutation.mutateAsync({ question: cleanQuestion });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", body: result.answer, placeholder: result.mode === "fallback", suggestions: getFollowUpPrompts(cleanQuestion) }]);
    } catch (error) {
      Alert.alert("Doubt Solver unavailable", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const chooseFollowUp = (prompt: string) => {
    setQuestion(prompt);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Sign in with a Student account to use the Doubt Solver.</Text></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Home" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.title}>Ask AI</Text></View><Tag label="GEMINI" tone="green" /></View>
      {messages.length === 0 ? <View style={styles.notice}><Text style={styles.noticeText}>Ask about surveying, land measurement, revenue records, or exam preparation.</Text></View> : null}
      {messages.length ? <View style={styles.historyHeader}><View style={styles.historyTitleWrap}><MaterialIcons name="forum" size={16} color={COLORS.indigo} /><Text style={styles.historyTitle}>Conversation</Text><Text style={styles.historyCount}>{messages.length} message{messages.length === 1 ? "" : "s"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Clear Doubt Solver conversation" onPress={() => setMessages([])} disabled={askMutation.isPending} style={({ pressed }) => [styles.clearButton, (pressed || askMutation.isPending) && styles.pressed]}><MaterialIcons name="delete-outline" size={16} color={COLORS.indigo} /><Text style={styles.clearText}>Clear</Text></Pressable></View> : null}
      <ScrollView ref={threadRef} style={{ flex: 1 }} onContentSizeChange={scrollToLatest} contentContainerStyle={[styles.thread, messages.length === 0 && styles.emptyThread]} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? <View style={styles.empty}><IconCircle icon="psychology" size={52} color={COLORS.indigo} background={COLORS.indigoSoft} /><Text style={styles.emptyTitle}>What are you stuck on?</Text><Text style={styles.emptyBody}>Ask about a surveying concept, calculation, revenue record, or exam question. Gemini answers stay behind the authenticated server boundary.</Text><View style={styles.suggestions}><Text style={styles.suggestion}>“How do I calculate chain survey error?”</Text><Text style={styles.suggestion}>“Explain plot measurement in simple Hindi-English.”</Text></View></View> : messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === "student" ? styles.studentBubble : styles.aiBubble]}><Text style={[styles.bubbleLabel, message.role === "student" && styles.studentLabel]}>{message.role === "student" ? "YOU" : "DOUBT SOLVER"}</Text><Text style={[styles.bubbleText, message.role === "student" && styles.studentText]}>{message.body}</Text>{message.placeholder ? <Text style={styles.placeholderNote}>Fallback response · provider unavailable</Text> : null}{message.role === "assistant" && message.suggestions?.length ? <View style={styles.followUps}><Text style={styles.followUpLabel}>CONTINUE LEARNING</Text><View style={styles.followUpRow}>{message.suggestions.map((prompt) => <Pressable key={prompt} accessibilityRole="button" accessibilityLabel={`Ask follow-up: ${prompt}`} disabled={askMutation.isPending} onPress={() => chooseFollowUp(prompt)} style={({ pressed }) => [styles.followUpChip, (pressed || askMutation.isPending) && styles.pressed]}><Text style={styles.followUpText}>{prompt}</Text></Pressable>)}</View></View> : null}</View>)}
        {askMutation.isPending ? <View accessibilityRole="progressbar" accessibilityLabel="Gemini is preparing an answer" accessibilityLiveRegion="polite" style={[styles.bubble, styles.aiBubble, styles.thinking]}><View style={styles.typingAvatar}><MaterialIcons name="auto-awesome" size={15} color={COLORS.indigo} /></View><View style={styles.typingCopy}><Text style={styles.typingLabel}>GEMINI IS THINKING</Text><View style={styles.dotRow}><Animated.View style={[styles.typingDot, { opacity: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }), transform: [{ translateY: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]} /><Animated.View style={[styles.typingDot, { opacity: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] }) }]} /><Animated.View style={[styles.typingDot, { opacity: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }), transform: [{ translateY: typingPulse.interpolate({ inputRange: [0, 1], outputRange: [-3, 0] }) }] }]} /></View></View></View> : null}
      </ScrollView>
      <View style={styles.composer}><TextInput ref={composerInputRef} value={question} onChangeText={setQuestion} editable={!askMutation.isPending} placeholder="Type your doubt…" placeholderTextColor="#98A2B3" multiline style={styles.input} textAlignVertical="top" maxLength={1500} /><Pressable accessibilityRole="button" accessibilityLabel="Send question to Doubt Solver" disabled={askMutation.isPending} onPress={() => void sendQuestion()} style={({ pressed }) => [styles.send, (pressed || askMutation.isPending) && styles.pressed]}>{askMutation.isPending ? <ActivityIndicator size="small" color={COLORS.white} /> : <MaterialIcons name="send" size={21} color={COLORS.white} />}</Pressable></View>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, heading: { flex: 1 }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }, title: { color: COLORS.ink, fontSize: 21, fontWeight: "900" }, notice: { borderRadius: 16, backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F", padding: 12, gap: 7 }, noticeText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, historyHeader: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, historyTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 }, historyTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, historyCount: { color: COLORS.muted, fontSize: 11 }, clearButton: { minHeight: 32, borderRadius: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.indigoSoft }, clearText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" }, thread: { paddingVertical: 16, gap: 10, flexGrow: 1, paddingBottom: 24 }, emptyThread: { justifyContent: "center" }, empty: { alignItems: "center", gap: 11, paddingHorizontal: 20 }, emptyTitle: { color: COLORS.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }, emptyBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }, suggestions: { width: "100%", gap: 7, marginTop: 5 }, suggestion: { padding: 10, borderRadius: 12, backgroundColor: COLORS.indigoSoft, color: COLORS.indigo, fontSize: 12, fontWeight: "700" }, bubble: { maxWidth: "88%", borderRadius: 18, padding: 12, gap: 5 }, studentBubble: { alignSelf: "flex-end", backgroundColor: COLORS.indigo, borderBottomRightRadius: 5 }, aiBubble: { alignSelf: "flex-start", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderBottomLeftRadius: 5 }, bubbleLabel: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, studentLabel: { color: "#D8E1F7" }, bubbleText: { color: COLORS.ink, fontSize: 14, lineHeight: 20 }, studentText: { color: COLORS.white }, placeholderNote: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", marginTop: 3 }, followUps: { marginTop: 7, gap: 7, borderTopWidth: 1, borderTopColor: "#E7ECF5", paddingTop: 8 }, followUpLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, followUpRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, followUpChip: { borderRadius: 12, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#D9E2F5", paddingHorizontal: 9, paddingVertical: 7, maxWidth: "100%" }, followUpText: { color: COLORS.indigo, fontSize: 11, lineHeight: 15, fontWeight: "800" }, thinking: { flexDirection: "row", alignItems: "center", gap: 9, minWidth: 166 }, typingAvatar: { width: 29, height: 29, borderRadius: 10, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, typingCopy: { gap: 5 }, typingLabel: { color: COLORS.indigo, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, dotRow: { flexDirection: "row", gap: 5, minHeight: 10, alignItems: "center" }, typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.indigo }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line }, input: { flex: 1, minHeight: 50, maxHeight: 110, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 12, color: COLORS.ink, fontSize: 14 }, send: { width: 50, height: 50, borderRadius: 15, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" }, denied: { color: COLORS.muted, textAlign: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
