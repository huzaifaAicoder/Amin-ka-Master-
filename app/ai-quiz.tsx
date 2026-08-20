import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Difficulty = "beginner" | "intermediate" | "advanced";
type QuizQuestion = { question: string; options: string[]; correctIndex: number; explanation: string };

const QUIZ_SECONDS = 10 * 60;
const advanceDifficulty = (difficulty: Difficulty): Difficulty => difficulty === "beginner" ? "intermediate" : "advanced";
const formatTime = (seconds: number) => `${String(Math.floor(Math.max(seconds, 0) / 60)).padStart(2, "0")}:${String(Math.max(seconds, 0) % 60).padStart(2, "0")}`;

export default function AiQuizScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const [topic, setTopic] = useState("Land measurement");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(QUIZ_SECONDS);
  const startedAt = useRef<number | null>(null);
  const attemptRecorded = useRef(false);
  const finishQuizRef = useRef<(expired: boolean) => void>(() => undefined);
  const quizMutation = trpc.student.generateAiQuiz.useMutation();
  const reviewMutation = trpc.student.submitAiQuizForReview.useMutation();
  const saveAttemptMutation = trpc.student.saveAiQuizAttempt.useMutation();
  const statsQuery = trpc.student.aiQuizStats.useQuery(undefined, { enabled: user?.role === "student", retry: false });
  const score = useMemo(() => questions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0), [answers, questions]);
  const scorePercent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const answerCount = Object.keys(answers).length;
  const recommendation = scorePercent >= 80 ? `Strong result. Try ${advanceDifficulty(difficulty)} next time.` : scorePercent < 40 ? "Build confidence with Beginner next time." : "Keep practising this level to strengthen your accuracy.";

  const recommendedDifficulty = (): Difficulty => {
    const stats = statsQuery.data;
    if (!stats?.lastDifficulty) return difficulty;
    if ((stats.lastScore ?? 0) >= 80) return advanceDifficulty(stats.lastDifficulty);
    if ((stats.lastScore ?? 100) < 40) return "beginner";
    return stats.lastDifficulty;
  };

  const finishQuiz = (expired: boolean) => {
    if (!questions.length || submitted || attemptRecorded.current) return;
    attemptRecorded.current = true;
    setSubmitted(true);
    setTimedOut(expired);
    const durationSeconds = startedAt.current ? Math.min(QUIZ_SECONDS, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000))) : QUIZ_SECONDS - secondsRemaining;
    void saveAttemptMutation.mutateAsync({ topic: topic.trim(), difficulty, questionCount: questions.length, correctAnswers: score, scorePercent, durationSeconds })
      .then(() => statsQuery.refetch())
      .catch((error) => {
        attemptRecorded.current = false;
        Alert.alert("Result not saved", error instanceof Error ? error.message : "Your result could not be saved. Please check your connection and try another quiz.");
      });
  };
  finishQuizRef.current = finishQuiz;

  useEffect(() => {
    if (!questions.length || submitted) return;
    const timer = setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setTimeout(() => finishQuizRef.current(true), 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [questions.length, submitted]);

  const generate = async () => {
    if (topic.trim().length < 2) return Alert.alert("Choose a topic", "Enter a topic with at least two characters.");
    const selectedDifficulty = recommendedDifficulty();
    setDifficulty(selectedDifficulty);
    setSubmitted(false); setTimedOut(false); setAnswers({}); setQuestions([]); setSecondsRemaining(QUIZ_SECONDS); startedAt.current = null; attemptRecorded.current = false;
    try {
      const result = await quizMutation.mutateAsync({ topic: topic.trim(), difficulty: selectedDifficulty, questionCount: 5, language: "Hindi-English" });
      setQuestions(result.questions);
      startedAt.current = Date.now();
    } catch (error) { Alert.alert("AI Quiz unavailable", error instanceof Error ? error.message : "Please try again."); }
  };

  const submitForReview = async () => {
    if (!questions.length) return;
    try { await reviewMutation.mutateAsync({ topic: topic.trim(), difficulty, language: "Hindi-English", questions }); Alert.alert("Sent for teacher review", "Your private practice questions were added to the teacher review queue. They will remain unpublished until a teacher explicitly exports and reviews them."); }
    catch (error) { Alert.alert("Review submission unavailable", error instanceof Error ? error.message : "Please try again."); }
  };

  if (user?.role !== "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Sign in with a Student account to use AI Quiz.</Text></ScreenContainer>;
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Ask AI" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>AI Quiz</Text><Text style={styles.sub}>Private practice · never auto-published</Text></View><Tag label="GEMINI" tone="green" /></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.card}><Text style={styles.label}>PRACTICE TOPIC</Text><TextInput value={topic} onChangeText={setTopic} editable={!questions.length || submitted} maxLength={160} placeholder="For example, chain survey" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.label}>DIFFICULTY</Text><View style={styles.chips}>{(["beginner", "intermediate", "advanced"] as const).map((value) => <Pressable key={value} disabled={Boolean(questions.length && !submitted)} onPress={() => setDifficulty(value)} style={[styles.chip, difficulty === value && styles.chipActive, Boolean(questions.length && !submitted) && styles.chipDisabled]}><Text style={[styles.chipText, difficulty === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</View>{statsQuery.data?.totalAttempts ? <Text style={styles.adaptiveHint}>Last score: {statsQuery.data.lastScore}% · your next quiz adapts from practice history.</Text> : null}<PrimaryButton label={quizMutation.isPending ? "Generating practice…" : "Generate 5 practice MCQs"} icon="auto-awesome" disabled={quizMutation.isPending || Boolean(questions.length && !submitted)} onPress={() => void generate()} /></View>{questions.length && !submitted ? <View style={[styles.timer, secondsRemaining <= 60 && styles.timerUrgent]}><MaterialIcons name="timer" size={20} color={secondsRemaining <= 60 ? COLORS.red : COLORS.indigo} /><View style={{ flex: 1 }}><Text style={styles.timerLabel}>QUIZ TIME REMAINING</Text><Text style={[styles.timerValue, secondsRemaining <= 60 && styles.timerValueUrgent]}>{formatTime(secondsRemaining)}</Text></View><Text style={styles.timerMeta}>{answerCount}/{questions.length} answered</Text></View> : null}{quizMutation.isPending ? <View style={styles.loading}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loadingText}>Creating a private practice set…</Text></View> : null}{questions.map((question, index) => <View key={`${question.question}-${index}`} style={styles.question}><Text style={styles.number}>QUESTION {index + 1}</Text><Text style={styles.questionText}>{question.question}</Text>{question.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; const correct = submitted && optionIndex === question.correctIndex; const wrong = submitted && selected && !correct; return <Pressable key={`${option}-${optionIndex}`} disabled={submitted} onPress={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} style={[styles.option, selected && styles.optionSelected, correct && styles.optionCorrect, wrong && styles.optionWrong]}><Text style={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>; })}{submitted ? <View style={styles.explanation}><Text style={styles.explanationLabel}>{answers[index] === question.correctIndex ? "CORRECT" : "EXPLANATION"}</Text><Text style={styles.explanationText}>{question.explanation}</Text></View> : null}</View>)}{questions.length && !submitted ? <PrimaryButton label={`Submit answers (${answerCount}/${questions.length})`} icon="check" disabled={answerCount !== questions.length} onPress={() => finishQuiz(false)} /> : null}{questions.length && submitted ? <View style={styles.result}><Text style={styles.resultLabel}>{timedOut ? "TIME EXPIRED · PRACTICE RESULT" : "PRACTICE RESULT"}</Text><Text style={styles.resultScore}>{score}/{questions.length}</Text><Text style={styles.resultPercent}>{scorePercent}%</Text><Text style={styles.resultCopy}>{recommendation}</Text><Text style={styles.resultSaved}>{saveAttemptMutation.isPending ? "Saving your progress…" : "Your private score is saved to your learning dashboard."}</Text><PrimaryButton label={reviewMutation.isPending ? "Sending to teacher…" : "Send questions for teacher review"} icon="rate-review" disabled={reviewMutation.isPending} onPress={() => void submitForReview()} /></View> : null}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ header: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line }, back: { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.indigoSoft }, title: { color: COLORS.ink, fontSize: 20, fontWeight: "900" }, sub: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, content: { padding: 16, gap: 14 }, card: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line }, label: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 12, color: COLORS.ink }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, chipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, chipDisabled: { opacity: 0.55 }, chipText: { color: COLORS.indigo, fontSize: 11, fontWeight: "800", textTransform: "capitalize" }, chipTextActive: { color: COLORS.white }, adaptiveHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16 }, timer: { padding: 13, borderRadius: 16, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#C9D3EC", flexDirection: "row", alignItems: "center", gap: 10 }, timerUrgent: { backgroundColor: "#FEF3F2", borderColor: "#FECDCA" }, timerLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, timerValue: { color: COLORS.indigo, fontSize: 22, fontWeight: "900", marginTop: 2 }, timerValueUrgent: { color: COLORS.red }, timerMeta: { color: COLORS.muted, fontSize: 11, fontWeight: "800" }, loading: { minHeight: 100, justifyContent: "center", alignItems: "center", gap: 9 }, loadingText: { color: COLORS.muted, fontSize: 12 }, question: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, number: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, questionText: { color: COLORS.ink, fontSize: 16, fontWeight: "800", lineHeight: 22 }, option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper }, optionSelected: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft }, optionCorrect: { borderColor: COLORS.green, backgroundColor: "#ECFDF3" }, optionWrong: { borderColor: COLORS.red, backgroundColor: "#FEF3F2" }, optionLetter: { width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, color: COLORS.indigo, backgroundColor: COLORS.white, fontWeight: "900" }, optionText: { flex: 1, color: COLORS.ink, fontSize: 13, lineHeight: 18 }, explanation: { borderRadius: 12, padding: 10, backgroundColor: COLORS.indigoSoft, gap: 4 }, explanationLabel: { color: COLORS.indigo, fontSize: 10, fontWeight: "900" }, explanationText: { color: COLORS.ink, fontSize: 12, lineHeight: 18 }, result: { padding: 18, alignItems: "center", gap: 5, borderRadius: 18, backgroundColor: COLORS.indigo }, resultLabel: { color: "#D8E1F7", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, resultScore: { color: COLORS.white, fontSize: 33, fontWeight: "900" }, resultPercent: { color: COLORS.saffron, fontSize: 18, fontWeight: "900" }, resultCopy: { color: "#D8E1F7", textAlign: "center", fontSize: 12, lineHeight: 17 }, resultSaved: { color: "#D8E1F7", textAlign: "center", fontSize: 10, lineHeight: 15, marginBottom: 5 }, denied: { color: COLORS.muted, textAlign: "center" } });
