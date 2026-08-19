import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type ChatMessage = { id: string; role: "student" | "assistant"; body: string; placeholder?: boolean };

export default function AskAiScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const askMutation = trpc.student.askAi.useMutation();
  const enabled = user?.role === "student";

  const sendQuestion = async () => {
    const cleanQuestion = question.trim();
    if (cleanQuestion.length < 3) return Alert.alert("Add your doubt", "Type a question with at least three characters.");
    setQuestion("");
    setMessages((current) => [...current, { id: `student-${Date.now()}`, role: "student", body: cleanQuestion }]);
    try {
      const result = await askMutation.mutateAsync({ question: cleanQuestion });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", body: result.answer, placeholder: result.mode === "placeholder" }]);
    } catch (error) {
      Alert.alert("Doubt Solver unavailable", error instanceof Error ? error.message : "Please try again.");
    }
  };

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Sign in with a Student account to use the Doubt Solver.</Text></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Home" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.eyebrow}>STUDENT TOOL</Text><Text style={styles.title}>Ask AI</Text></View><IconCircle icon="auto-awesome" size={39} color={COLORS.saffron} background="#FFF1DE" /></View>
      <View style={styles.notice}><Tag label="PLACEHOLDER" tone="saffron" /><Text style={styles.noticeText}>This secure chat boundary is ready for a future approved AI provider. It does not send your question to an external model yet.</Text></View>
      <ScrollView contentContainerStyle={[styles.thread, messages.length === 0 && styles.emptyThread]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? <View style={styles.empty}><IconCircle icon="psychology" size={52} color={COLORS.indigo} background={COLORS.indigoSoft} /><Text style={styles.emptyTitle}>What are you stuck on?</Text><Text style={styles.emptyBody}>Ask about a surveying concept, calculation, revenue record, or exam question. A provider can be connected later without changing this student experience.</Text><View style={styles.suggestions}><Text style={styles.suggestion}>“How do I calculate chain survey error?”</Text><Text style={styles.suggestion}>“Explain plot measurement in simple Hindi-English.”</Text></View></View> : messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === "student" ? styles.studentBubble : styles.aiBubble]}><Text style={[styles.bubbleLabel, message.role === "student" && styles.studentLabel]}>{message.role === "student" ? "YOU" : "DOUBT SOLVER"}</Text><Text style={[styles.bubbleText, message.role === "student" && styles.studentText]}>{message.body}</Text>{message.placeholder ? <Text style={styles.placeholderNote}>Provider not connected</Text> : null}</View>)}
        {askMutation.isPending ? <View style={[styles.bubble, styles.aiBubble, styles.thinking]}><ActivityIndicator size="small" color={COLORS.indigo} /><Text style={styles.thinkingText}>AI is thinking…</Text></View> : null}
      </ScrollView>
      <View style={styles.composer}><TextInput value={question} onChangeText={setQuestion} editable={!askMutation.isPending} placeholder="Type your doubt…" placeholderTextColor="#98A2B3" multiline style={styles.input} textAlignVertical="top" maxLength={1500} /><Pressable accessibilityRole="button" accessibilityLabel="Send question to Doubt Solver" disabled={askMutation.isPending} onPress={() => void sendQuestion()} style={({ pressed }) => [styles.send, (pressed || askMutation.isPending) && styles.pressed]}>{askMutation.isPending ? <ActivityIndicator size="small" color={COLORS.white} /> : <MaterialIcons name="send" size={21} color={COLORS.white} />}</Pressable></View>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, heading: { flex: 1 }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }, title: { color: COLORS.ink, fontSize: 21, fontWeight: "900" }, notice: { borderRadius: 16, backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F", padding: 12, gap: 7 }, noticeText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, thread: { paddingVertical: 16, gap: 10, flexGrow: 1 }, emptyThread: { justifyContent: "center" }, empty: { alignItems: "center", gap: 11, paddingHorizontal: 20 }, emptyTitle: { color: COLORS.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }, emptyBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }, suggestions: { width: "100%", gap: 7, marginTop: 5 }, suggestion: { padding: 10, borderRadius: 12, backgroundColor: COLORS.indigoSoft, color: COLORS.indigo, fontSize: 12, fontWeight: "700" }, bubble: { maxWidth: "88%", borderRadius: 18, padding: 12, gap: 5 }, studentBubble: { alignSelf: "flex-end", backgroundColor: COLORS.indigo, borderBottomRightRadius: 5 }, aiBubble: { alignSelf: "flex-start", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderBottomLeftRadius: 5 }, bubbleLabel: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, studentLabel: { color: "#D8E1F7" }, bubbleText: { color: COLORS.ink, fontSize: 14, lineHeight: 20 }, studentText: { color: COLORS.white }, placeholderNote: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", marginTop: 3 }, thinking: { flexDirection: "row", alignItems: "center", gap: 9 }, thinkingText: { color: COLORS.indigo, fontSize: 13, fontWeight: "800" }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line }, input: { flex: 1, minHeight: 50, maxHeight: 110, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 12, color: COLORS.ink, fontSize: 14 }, send: { width: 50, height: 50, borderRadius: 15, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" }, denied: { color: COLORS.muted, textAlign: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
