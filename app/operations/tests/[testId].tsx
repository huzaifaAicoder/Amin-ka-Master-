import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

function asFourOptions(value: unknown) {
  const options = Array.isArray(value) ? value.filter((option): option is string => typeof option === "string").slice(0, 4) : [];
  while (options.length < 4) options.push("");
  return options;
}

export default function TestEditorScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();
  const id = Number(testId);
  const testQuery = trpc.operations.test.useQuery({ testId: id }, { enabled: Number.isInteger(id) && id > 0 });
  const saveMutation = trpc.operations.saveQuestion.useMutation({ onSuccess: () => void testQuery.refetch() });
  const deleteMutation = trpc.operations.deleteQuestion.useMutation({ onSuccess: () => void testQuery.refetch() });
  const statusMutation = trpc.operations.setTestStatus.useMutation({ onSuccess: () => void testQuery.refetch() });
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [marks, setMarks] = useState("1");
  const [explanation, setExplanation] = useState("");

  if (testQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  if (!testQuery.data) return <ScreenContainer className="items-center justify-center"><Text style={styles.muted}>Test not found.</Text></ScreenContainer>;

  const { test, questions } = testQuery.data;
  const editingQuestion = editingQuestionId ? questions.find((question) => question.id === editingQuestionId) : undefined;
  const resetForm = () => {
    setFormOpen(false);
    setEditingQuestionId(null);
    setPrompt("");
    setOptions(["", "", "", ""]);
    setCorrect(0);
    setMarks("1");
    setExplanation("");
  };
  const beginCreate = () => {
    resetForm();
    setFormOpen(true);
  };
  const beginEdit = (question: typeof questions[number]) => {
    setEditingQuestionId(question.id);
    setPrompt(question.prompt);
    setOptions(asFourOptions(question.options));
    setCorrect(question.correctOptionIndex);
    setMarks(String(question.marks));
    setExplanation(question.explanation ?? "");
    setFormOpen(true);
  };
  const save = async () => {
    if (prompt.trim().length < 5 || options.some((option) => !option.trim())) return Alert.alert("Complete the MCQ", "Add a question and all four answer options.");
    try {
      await saveMutation.mutateAsync({
        questionId: editingQuestionId ?? undefined,
        testId: id,
        prompt: prompt.trim(),
        options: options.map((option) => option.trim()),
        correctOptionIndex: correct,
        marks: Math.max(1, Number(marks) || 1),
        explanation: explanation.trim() || undefined,
        displayOrder: editingQuestion?.displayOrder ?? questions.length + 1,
      });
      Alert.alert(editingQuestionId ? "Question updated" : "Question added", editingQuestionId ? "The MCQ and learner explanation have been saved." : "Add more questions or publish when the assessment is ready.");
      resetForm();
    } catch (cause) {
      Alert.alert("Question not saved", cause instanceof Error ? cause.message : "Please check your staff permission and try again.");
    }
  };
  const cycleStatus = async () => {
    const next = test.status === "draft" ? "published" : test.status === "published" ? "archived" : "draft";
    try {
      await statusMutation.mutateAsync({ testId: id, status: next });
    } catch (cause) {
      Alert.alert("Status not changed", cause instanceof Error ? cause.message : "Add a question before publishing.");
    }
  };

  const editing = Boolean(editingQuestionId);
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => formOpen ? resetForm() : router.back()} hitSlop={10}><MaterialIcons name={formOpen ? "close" : "arrow-back"} size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>{formOpen ? editing ? "Edit MCQ" : "Add MCQ" : "Test editor"}</Text><Pressable onPress={cycleStatus} hitSlop={8}><Tag label={test.status.toUpperCase()} tone={test.status === "published" ? "green" : test.status === "draft" ? "saffron" : "neutral"} /></Pressable></View>{formOpen ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><View style={styles.formHeader}><Text style={styles.formTitle}>{editing ? "Update question" : test.title}</Text><Text style={styles.note}>The correct answer and explanation stay hidden during an active attempt. Learners see them only after secure server scoring.</Text></View><FieldLabel text="Question prompt" /><TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="Write the MCQ question" placeholderTextColor="#98A2B3" style={[styles.input, styles.prompt]} textAlignVertical="top" /><FieldLabel text="Answer options" detail="Tap the numbered circle to mark the correct option." />{options.map((option, index) => <View key={index} style={styles.optionRow}><Pressable onPress={() => setCorrect(index)} accessibilityRole="radio" accessibilityState={{ selected: correct === index }} accessibilityLabel={`Mark option ${index + 1} as correct`} style={({ pressed }) => [styles.number, correct === index && styles.numberSelected, pressed && styles.pressed]}><Text style={[styles.numberText, correct === index && styles.numberTextSelected]}>{index + 1}</Text></Pressable><TextInput value={option} onChangeText={(value) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder={`Option ${index + 1}`} placeholderTextColor="#98A2B3" style={styles.optionInput} /></View>)}<FieldLabel text="Marks" /><TextInput value={marks} onChangeText={setMarks} keyboardType="number-pad" placeholder="Marks" placeholderTextColor="#98A2B3" style={styles.input} /><View style={styles.explanationHeader}><View style={styles.explanationIcon}><MaterialIcons name="lightbulb-outline" size={18} color={COLORS.earth} /></View><View style={styles.explanationCopy}><FieldLabel text="Detailed learner explanation" detail="Explain why the correct answer is right and address likely mistakes. Shown only after submission." /></View></View><TextInput value={explanation} onChangeText={setExplanation} multiline placeholder="Write a clear explanation for the reviewed answer" placeholderTextColor="#98A2B3" style={[styles.input, styles.explanationInput]} textAlignVertical="top" /><PrimaryButton label={saveMutation.isPending ? editing ? "Saving changes…" : "Saving question…" : editing ? "Save question changes" : "Save MCQ question"} icon="save" onPress={save} disabled={saveMutation.isPending} /></ScrollView> : <><View style={styles.testInfo}><IconCircle icon="assignment" size={42} /><View style={styles.testCopy}><Text style={styles.testName}>{test.title}</Text><Text style={styles.muted}>{test.durationMinutes} min · Pass {test.passingMarks} · {questions.length} question{questions.length === 1 ? "" : "s"}</Text></View><Pressable onPress={beginCreate} accessibilityRole="button" accessibilityLabel="Add a question" style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><MaterialIcons name="add" size={21} color={COLORS.white} /></Pressable></View><FlatList data={questions} keyExtractor={(item) => item.id.toString()} contentContainerStyle={styles.list} ListHeaderComponent={<Text style={styles.helper}>Tap **Edit** on any question to update its wording, options, correct answer, marks, or learner explanation.</Text>} ListEmptyComponent={<Text style={styles.empty}>Add at least one MCQ before publishing this test.</Text>} renderItem={({ item, index }) => <View style={styles.questionCard}><View style={styles.questionTop}><Text style={styles.questionIndex}>QUESTION {index + 1}</Text><View style={styles.cardActions}><Pressable onPress={() => beginEdit(item)} accessibilityRole="button" accessibilityLabel={`Edit question ${index + 1}`} style={({ pressed }) => [styles.editAction, pressed && styles.pressed]}><MaterialIcons name="edit" size={17} color={COLORS.indigo} /><Text style={styles.editActionText}>Edit</Text></Pressable><Pressable onPress={() => void deleteMutation.mutateAsync({ testId: id, questionId: item.id })} accessibilityRole="button" accessibilityLabel={`Delete question ${index + 1}`} hitSlop={8} style={({ pressed }) => [styles.deleteAction, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={19} color={COLORS.red} /></Pressable></View></View><Text style={styles.questionText}>{item.prompt}</Text><Text style={styles.answer}>Correct: {String.fromCharCode(65 + item.correctOptionIndex)} · {item.marks} mark{item.marks === 1 ? "" : "s"}</Text>{item.explanation ? <View style={styles.readyExplanation}><MaterialIcons name="lightbulb-outline" size={15} color={COLORS.earth} /><Text numberOfLines={2} style={styles.explanationPreview}>Explanation ready: {item.explanation}</Text></View> : <Text style={styles.explanationMissing}>No learner explanation yet — select Edit to add one.</Text>}</View>} /></>}</ScreenContainer>;
}

function FieldLabel({ text, detail }: { text: string; detail?: string }) {
  return <View style={styles.labelGroup}><Text style={styles.label}>{text}</Text>{detail ? <Text style={styles.labelDetail}>{detail}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  muted: { color: COLORS.muted, fontSize: 12 },
  testInfo: { borderRadius: 18, padding: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", gap: 10, alignItems: "center" },
  testCopy: { flex: 1 },
  testName: { color: COLORS.ink, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  addButton: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigo },
  list: { paddingTop: 12, paddingBottom: 35, gap: 10 },
  helper: { color: COLORS.indigo, backgroundColor: COLORS.indigoSoft, borderRadius: 13, padding: 12, fontSize: 12, lineHeight: 18 },
  empty: { color: COLORS.muted, textAlign: "center", padding: 30 },
  questionCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 17, padding: 13, gap: 8 },
  questionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questionIndex: { color: COLORS.indigo, fontWeight: "900", fontSize: 10, letterSpacing: 0.8 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  editAction: { minHeight: 32, paddingHorizontal: 9, borderRadius: 10, backgroundColor: COLORS.indigoSoft, flexDirection: "row", alignItems: "center", gap: 4 },
  editActionText: { color: COLORS.indigo, fontSize: 12, fontWeight: "800" },
  deleteAction: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  questionText: { color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  answer: { color: COLORS.green, fontSize: 12, fontWeight: "700" },
  readyExplanation: { borderRadius: 10, padding: 9, backgroundColor: "#FFF5E8", flexDirection: "row", gap: 6, alignItems: "flex-start" },
  explanationPreview: { flex: 1, color: COLORS.earth, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  explanationMissing: { color: COLORS.muted, fontSize: 11, lineHeight: 16, fontStyle: "italic" },
  form: { paddingBottom: 34, gap: 10 },
  formHeader: { gap: 5, marginBottom: 2 },
  formTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800" },
  note: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  labelGroup: { gap: 3, marginTop: 4 },
  label: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  labelDetail: { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 },
  prompt: { minHeight: 92, paddingTop: 12 },
  optionRow: { flexDirection: "row", gap: 9, alignItems: "center" },
  number: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" },
  numberSelected: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  numberText: { color: COLORS.muted, fontWeight: "900" },
  numberTextSelected: { color: COLORS.white },
  optionInput: { flex: 1, minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 12, color: COLORS.ink, fontSize: 14 },
  explanationHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 3 },
  explanationIcon: { width: 29, height: 29, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF5E8" },
  explanationCopy: { flex: 1 },
  explanationInput: { minHeight: 128, paddingTop: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
