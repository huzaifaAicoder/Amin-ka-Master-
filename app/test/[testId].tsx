import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type AttemptReview = { attemptId: number; testId: number; testTitle: string; status: "submitted" | "expired"; score: number; totalMarks: number; passingMarks: number; durationMinutes: number; elapsedSeconds: number; review: { questionId: number; prompt: string; options: unknown; selectedOptionIndex: number | null; correctOptionIndex: number; isCorrect: boolean; marksAwarded: number; explanation: string | null }[] };

function useAttemptState() {
  const [attempt, setAttempt] = useState<{ attemptId: number; durationMinutes: number; title: string; questions: { id: number; prompt: string; options: unknown; marks: number }[] } | null>(null);
  return [attempt, setAttempt] as const;
}

export default function TestAttemptScreen() {
  const { testId, attemptId: reviewAttemptId } = useLocalSearchParams<{ testId: string; attemptId?: string }>();
  const router = useRouter();
  const { user } = useLmsSession();
  const startMutation = trpc.student.startTest.useMutation();
  const submitMutation = trpc.student.submitTest.useMutation();
  const [attempt, setAttempt] = useAttemptState();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<AttemptReview | null>(null);
  const requestedReviewId = Number(reviewAttemptId);
  const historicalReviewQuery = trpc.student.testAttemptReview.useQuery({ attemptId: requestedReviewId }, { enabled: Boolean(user && Number.isInteger(requestedReviewId) && requestedReviewId > 0), retry: false });
  const autoSubmitting = useRef(false);

  useEffect(() => {
    if (!attempt || result || remainingSeconds <= 0) return;
    const interval = setInterval(() => setRemainingSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [attempt, result, remainingSeconds]);

  const begin = async () => {
    try {
      const data = await startMutation.mutateAsync({ testId: Number(testId) });
      setAttempt({ attemptId: data.attemptId, durationMinutes: data.test.durationMinutes, title: data.test.title, questions: data.questions });
      setRemainingSeconds(data.remainingSeconds);
    } catch (cause) {
      Alert.alert("Test unavailable", cause instanceof Error ? cause.message : "Please return to the test list.");
    }
  };
  const submit = useCallback(async () => {
    if (!attempt) return;
    try {
      const data = await submitMutation.mutateAsync({ attemptId: attempt.attemptId, answers: attempt.questions.map((question) => ({ questionId: question.id, selectedOptionIndex: answers[question.id] ?? null })) });
      if (data.status === "in_progress") throw new Error("This assessment is still in progress.");
      setResult({ ...data, status: data.status === "expired" ? "expired" : "submitted" });
    } catch (cause) {
      Alert.alert("Unable to submit", cause instanceof Error ? cause.message : "Your attempt was not submitted. Please try again.");
    }
  }, [answers, attempt, submitMutation]);
  useEffect(() => {
    if (!attempt || result || remainingSeconds !== 0 || submitMutation.isPending || autoSubmitting.current) return;
    autoSubmitting.current = true;
    void submit();
  }, [attempt, remainingSeconds, result, submitMutation.isPending, submit]);
  const currentQuestion = attempt?.questions[currentIndex];
  const currentOptions = useMemo(() => Array.isArray(currentQuestion?.options) ? currentQuestion.options.filter((option): option is string => typeof option === "string") : [], [currentQuestion?.options]);
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in to take a test" body="Secure assessment attempts belong to an authenticated learning profile." /></View></ScreenContainer>;
  if (requestedReviewId > 0 && historicalReviewQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  if (requestedReviewId > 0 && historicalReviewQuery.isError) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="assignment-late" title="Review unavailable" body="This attempt may no longer be available. Return to your protected attempt history and try again." action={<PrimaryButton label="Attempt history" icon="history" onPress={() => router.replace("/test-history" as never)} />} /></View></ScreenContainer>;
  const historicalResult = historicalReviewQuery.data && historicalReviewQuery.data.status !== "in_progress" ? historicalReviewQuery.data : null;
  const displayedResult = result ?? historicalResult;
  if (displayedResult) {
    const passed = displayedResult.status === "submitted" && displayedResult.passingMarks > 0 && displayedResult.score >= displayedResult.passingMarks;
    const timeUsed = `${Math.floor(displayedResult.elapsedSeconds / 60)}m ${(displayedResult.elapsedSeconds % 60).toString().padStart(2, "0")}s`;
    return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}><View style={styles.resultWrap}><View style={styles.scoreRing}><Text style={styles.score}>{displayedResult.score}</Text><Text style={styles.outOf}>of {displayedResult.totalMarks}</Text></View><Tag label={displayedResult.status === "expired" ? "TIME EXPIRED" : displayedResult.passingMarks > 0 ? passed ? "PASSED" : "KEEP PRACTISING" : "ATTEMPT COMPLETE"} tone={displayedResult.status === "expired" ? "saffron" : passed || displayedResult.passingMarks === 0 ? "green" : "saffron"} /><Text style={styles.resultTitle}>{displayedResult.status === "expired" ? "Time expired" : passed || displayedResult.passingMarks === 0 ? "Attempt recorded" : "Keep practising"}</Text><Text style={styles.resultBody}>Your score, timing, and answer review were calculated on the server. {displayedResult.status === "expired" ? "Answers submitted after the deadline are not accepted." : `You used ${timeUsed} of ${displayedResult.durationMinutes} minutes.`} Passing mark: {displayedResult.passingMarks || "not configured"}.</Text></View><Text style={styles.reviewTitle}>Detailed answer review</Text>{displayedResult.review.map((item, index) => { const options = Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string") : []; return <View key={item.questionId} style={[styles.reviewCard, item.isCorrect ? styles.reviewCorrect : styles.reviewIncorrect]}><View style={styles.reviewHeader}><Text style={styles.reviewQuestion}>Question {index + 1} · {item.marksAwarded} mark{item.marksAwarded === 1 ? "" : "s"}</Text><Tag label={item.isCorrect ? "CORRECT" : "REVIEW"} tone={item.isCorrect ? "green" : "saffron"} /></View><Text style={styles.reviewPrompt}>{item.prompt}</Text>{options.map((option, optionIndex) => { const selected = item.selectedOptionIndex === optionIndex; const correct = item.correctOptionIndex === optionIndex; return <View key={`${option}-${optionIndex}`} style={[styles.reviewOption, selected && styles.reviewOptionSelected, correct && styles.reviewOptionCorrect]}><Text style={[styles.reviewOptionLetter, correct && styles.reviewOptionCorrectText]}>{String.fromCharCode(65 + optionIndex)}</Text><Text style={[styles.reviewOptionText, correct && styles.reviewOptionCorrectText]}>{option}</Text>{correct ? <MaterialIcons name="check-circle" size={18} color={COLORS.green} /> : selected ? <MaterialIcons name="cancel" size={18} color={COLORS.red} /> : null}</View>; })}<Text style={styles.reviewAnswer}>Your answer: {item.selectedOptionIndex === null ? "Not answered" : options[item.selectedOptionIndex] ?? "Selected answer"}</Text>{item.explanation ? <View style={styles.explanationBox}><MaterialIcons name="lightbulb-outline" size={18} color={COLORS.earth} /><View style={styles.explanationCopy}><Text style={styles.explanationLabel}>WHY THIS IS CORRECT</Text><Text style={styles.explanation}>{item.explanation}</Text></View></View> : <Text style={styles.explanationMissing}>No additional explanation was authored for this question.</Text>}</View>; })}<PrimaryButton label="Back to tests" onPress={() => router.replace("/tests")} icon="assignment" /></ScrollView></ScreenContainer>;
  }
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
  reviewContent: { paddingVertical: 22, gap: 11 },
  scoreRing: { width: 154, height: 154, borderRadius: 77, borderWidth: 12, borderColor: COLORS.greenSoft, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  score: { color: COLORS.indigo, fontSize: 43, fontWeight: "900" },
  outOf: { color: COLORS.muted, fontSize: 13 },
  resultTitle: { color: COLORS.ink, fontSize: 28, fontWeight: "800", marginTop: 4 },
  resultBody: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 7 },
  reviewTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "900", marginTop: 12 },
  reviewCard: { borderRadius: 18, padding: 13, borderWidth: 1, gap: 8, backgroundColor: COLORS.white }, reviewCorrect: { borderColor: "#B5E0C6" }, reviewIncorrect: { borderColor: "#F3D0A7" }, reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, reviewQuestion: { color: COLORS.ink, fontSize: 12, fontWeight: "900" }, reviewPrompt: { color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: "800" }, reviewOption: { minHeight: 43, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 }, reviewOptionSelected: { borderColor: "#F5B6B6", backgroundColor: "#FFF5F5" }, reviewOptionCorrect: { borderColor: "#B5E0C6", backgroundColor: "#F0FAF4" }, reviewOptionLetter: { color: COLORS.muted, width: 18, fontSize: 12, fontWeight: "900" }, reviewOptionText: { color: COLORS.ink, flex: 1, fontSize: 12, lineHeight: 17 }, reviewOptionCorrectText: { color: COLORS.green, fontWeight: "800" }, reviewAnswer: { color: COLORS.muted, fontSize: 12, lineHeight: 18 }, explanationBox: { borderRadius: 12, padding: 11, gap: 8, backgroundColor: "#FFF5E8", flexDirection: "row", alignItems: "flex-start" }, explanationCopy: { flex: 1, gap: 4 }, explanationLabel: { color: COLORS.earth, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" }, explanation: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, explanationMissing: { color: COLORS.muted, fontSize: 12, lineHeight: 18, fontStyle: "italic" },
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
