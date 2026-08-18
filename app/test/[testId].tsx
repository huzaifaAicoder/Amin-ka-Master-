import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type ActiveAttempt = NonNullable<ReturnType<typeof useAttemptState>>;

function useAttemptState() {
  const [attempt, setAttempt] = useState<{ attemptId: number; durationMinutes: number; title: string; questions: Array<{ id: number; prompt: string; options: unknown; marks: number }> } | null>(null);
  return [attempt, setAttempt] as const;
}

export default function TestAttemptScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();
  const { user } = useLmsSession();
  const startMutation = trpc.student.startTest.useMutation();
  const submitMutation = trpc.student.submitTest.useMutation();
  const [attempt, setAttempt] = useAttemptState();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<{ score: number; totalMarks: number } | null>(null);

  useEffect(() => {
    if (!attempt || result || remainingSeconds <= 0) return;
    const interval = setInterval(() => setRemainingSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [attempt, result, remainingSeconds]);

  const begin = async () => {
    try {
      const data = await startMutation.mutateAsync({ testId: Number(testId) });
      setAttempt({ attemptId: data.attemptId, durationMinutes: data.test.durationMinutes, title: data.test.title, questions: data.questions });
      setRemainingSeconds(data.test.durationMinutes * 60);
    } catch (cause) {
      Alert.alert("Test unavailable", cause instanceof Error ? cause.message : "Please return to the test list.");
    }
  };
  const submit = async () => {
    if (!attempt) return;
    try {
      const data = await submitMutation.mutateAsync({ attemptId: attempt.attemptId, answers: attempt.questions.map((question) => ({ questionId: question.id, selectedOptionIndex: answers[question.id] ?? null })) });
      setResult({ score: data.score, totalMarks: data.totalMarks });
    } catch (cause) {
      Alert.alert("Unable to submit", cause instanceof Error ? cause.message : "Your attempt was not submitted. Please try again.");
    }
  };
  const currentQuestion = attempt?.questions[currentIndex];
  const currentOptions = useMemo(() => Array.isArray(currentQuestion?.options) ? currentQuestion.options.filter((option): option is string => typeof option === "string") : [], [currentQuestion?.options]);
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in to take a test" body="Secure assessment attempts belong to an authenticated learning profile." /></View></ScreenContainer>;
  if (result) return <ScreenContainer className="px-5"><View style={styles.resultWrap}><View style={styles.scoreRing}><Text style={styles.score}>{result.score}</Text><Text style={styles.outOf}>of {result.totalMarks}</Text></View><Tag label={result.score >= Math.ceil(result.totalMarks / 2) ? "ATTEMPT COMPLETE" : "RESULT RECORDED"} tone={result.score >= Math.ceil(result.totalMarks / 2) ? "green" : "saffron"} /><Text style={styles.resultTitle}>{result.score >= Math.ceil(result.totalMarks / 2) ? "Strong work" : "Keep practising"}</Text><Text style={styles.resultBody}>Your score was calculated on the server from stored answer keys and saved to your attempt history.</Text><PrimaryButton label="Back to tests" onPress={() => router.replace("/tests")} icon="assignment" /></View></ScreenContainer>;
  if (!attempt) return <ScreenContainer className="px-5"><View style={styles.center}><Text style={styles.preTitle}>TIMED MCQ ASSESSMENT</Text><Text style={styles.readyTitle}>Ready to begin?</Text><Text style={styles.readyBody}>The timer starts when the server creates your attempt. Your score is calculated only when you submit.</Text><PrimaryButton label={startMutation.isPending ? "Starting test…" : "Start test"} onPress={begin} icon="play-arrow" disabled={startMutation.isPending} /></View></ScreenContainer>;
  if (!currentQuestion) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5"><View style={styles.attemptHeader}><Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="close" size={24} color={COLORS.indigo} /></Pressable><View style={styles.timer}><MaterialIcons name="timer" size={18} color={remainingSeconds < 60 ? COLORS.red : COLORS.indigo} /><Text style={[styles.timerText, remainingSeconds < 60 && { color: COLORS.red }]}>{minutes}:{seconds}</Text></View></View><View style={styles.attemptBody}><Text style={styles.attemptTitle}>{attempt.title}</Text><View style={styles.questionMeta}><Text style={styles.questionCount}>Question {currentIndex + 1} of {attempt.questions.length}</Text><Text style={styles.marks}>{currentQuestion.marks} mark{currentQuestion.marks === 1 ? "" : "s"}</Text></View><View style={styles.questionCard}><Text style={styles.question}>{currentQuestion.prompt}</Text>{currentOptions.map((option, index) => { const selected = answers[currentQuestion.id] === index; return <Pressable key={`${option}-${index}`} onPress={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: index }))} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><View style={[styles.optionMark, selected && styles.optionMarkSelected]}>{selected ? <MaterialIcons name="check" size={16} color={COLORS.white} /> : <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>}</View><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text></Pressable>; })}</View></View><View style={styles.footer}><Pressable disabled={currentIndex === 0} onPress={() => setCurrentIndex((value) => Math.max(0, value - 1))} style={[styles.previous, currentIndex === 0 && styles.disabled]}><Text style={styles.previousText}>Previous</Text></Pressable>{currentIndex === attempt.questions.length - 1 ? <PrimaryButton label={submitMutation.isPending ? "Submitting…" : "Submit test"} onPress={submit} disabled={submitMutation.isPending} /> : <PrimaryButton label="Next question" icon="arrow-forward" onPress={() => setCurrentIndex((value) => Math.min(attempt.questions.length - 1, value + 1))} />}</View></ScreenContainer>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", gap: 13 },
  preTitle: { color: COLORS.earth, fontWeight: "900", fontSize: 10, letterSpacing: 1.1 },
  readyTitle: { color: COLORS.ink, fontSize: 30, fontWeight: "800" },
  readyBody: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  resultWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 13, paddingHorizontal: 20 },
  scoreRing: { width: 154, height: 154, borderRadius: 77, borderWidth: 12, borderColor: COLORS.greenSoft, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  score: { color: COLORS.indigo, fontSize: 43, fontWeight: "900" },
  outOf: { color: COLORS.muted, fontSize: 13 },
  resultTitle: { color: COLORS.ink, fontSize: 28, fontWeight: "800", marginTop: 4 },
  resultBody: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 7 },
  attemptHeader: { paddingTop: 10, minHeight: 61, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timer: { minHeight: 39, backgroundColor: COLORS.indigoSoft, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  timerText: { color: COLORS.indigo, fontWeight: "900", fontVariant: ["tabular-nums"] },
  attemptBody: { flex: 1, paddingTop: 17 },
  attemptTitle: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  questionMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  questionCount: { color: COLORS.muted, fontSize: 13 },
  marks: { color: COLORS.indigo, fontWeight: "800", fontSize: 13 },
  questionCard: { marginTop: 21, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 22, padding: 17, gap: 11 },
  question: { color: COLORS.ink, fontSize: 18, lineHeight: 26, fontWeight: "800", marginBottom: 8 },
  option: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  optionSelected: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft },
  optionMark: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: "#C8D0DC", alignItems: "center", justifyContent: "center" },
  optionMarkSelected: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  optionLetter: { color: COLORS.muted, fontWeight: "800", fontSize: 11 },
  optionText: { color: COLORS.ink, fontSize: 14, flex: 1, lineHeight: 19 },
  optionTextSelected: { color: COLORS.indigo, fontWeight: "800" },
  footer: { paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  previous: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  previousText: { color: COLORS.indigo, fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
