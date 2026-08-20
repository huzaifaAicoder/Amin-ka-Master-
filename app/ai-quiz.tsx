import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, PrimaryButton, Tag } from "@/components/lms-ui";
import { buildAiQuizResultsPdfHtml } from "@/lib/ai-quiz-results-pdf";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Difficulty = "beginner" | "intermediate" | "advanced";
type QuizQuestion = { question: string; options: string[]; correctIndex: number; explanation: string };
const QUIZ_PROFILES = [
  { id: "quick", title: "Quick practice", questionCount: 5, seconds: 10 * 60, description: "5 AI MCQs · 10 minutes" },
  { id: "deep", title: "Deep practice", questionCount: 10, seconds: 25 * 60, description: "10 AI MCQs · 25 minutes" },
] as const;
type QuizProfileId = typeof QUIZ_PROFILES[number]["id"];

const formatTime = (seconds: number) => `${String(Math.floor(Math.max(seconds, 0) / 60)).padStart(2, "0")}:${String(Math.max(seconds, 0) % 60).padStart(2, "0")}`;
const advanceDifficulty = (difficulty: Difficulty): Difficulty => difficulty === "beginner" ? "intermediate" : "advanced";

export default function AiQuizScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const [topic, setTopic] = useState("Land measurement");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [profileId, setProfileId] = useState<QuizProfileId>("quick");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(QUIZ_PROFILES[0].seconds);
  const [exportingPdf, setExportingPdf] = useState(false);
  const startedAt = useRef<number | null>(null);
  const attemptRecorded = useRef(false);
  const finishQuizRef = useRef<(expired: boolean) => void>(() => undefined);
  const quizMutation = trpc.student.generateAiQuiz.useMutation();
  const reviewMutation = trpc.student.submitAiQuizForReview.useMutation();
  const saveAttemptMutation = trpc.student.saveAiQuizAttempt.useMutation();
  const statsQuery = trpc.student.aiQuizStats.useQuery(undefined, { enabled: user?.role === "student", retry: false });
  const historyQuery = trpc.student.aiQuizHistory.useQuery(undefined, { enabled: user?.role === "student", retry: false });
  const activeProfile = QUIZ_PROFILES.find((profile) => profile.id === profileId) ?? QUIZ_PROFILES[0];
  const score = useMemo(() => questions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0), [answers, questions]);
  const scorePercent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const answerCount = Object.keys(answers).length;

  const recommendedDifficulty = (): Difficulty => {
    const latest = statsQuery.data;
    if (!latest?.lastDifficulty) return difficulty;
    if ((latest.lastScore ?? 0) >= 80) return advanceDifficulty(latest.lastDifficulty);
    if ((latest.lastScore ?? 100) < 40) return "beginner";
    return latest.lastDifficulty;
  };

  const finishQuiz = (expired: boolean) => {
    if (!questions.length || submitted || attemptRecorded.current) return;
    attemptRecorded.current = true;
    setSubmitted(true);
    setTimedOut(expired);
    const durationSeconds = startedAt.current ? Math.min(activeProfile.seconds, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000))) : activeProfile.seconds - secondsRemaining;
    void saveAttemptMutation.mutateAsync({ topic: topic.trim(), difficulty, questionCount: questions.length, correctAnswers: score, scorePercent, durationSeconds })
      .then(() => Promise.all([statsQuery.refetch(), historyQuery.refetch()]))
      .catch((error) => {
        attemptRecorded.current = false;
        Alert.alert("Result not saved", error instanceof Error ? error.message : "Your result could not be saved. Please check your connection and try another quiz.");
      });
  };
  finishQuizRef.current = finishQuiz;

  useEffect(() => {
    if (!questions.length || submitted) return;
    const timer = setInterval(() => setSecondsRemaining((current) => {
      if (current <= 1) {
        clearInterval(timer);
        setTimeout(() => finishQuizRef.current(true), 0);
        return 0;
      }
      return current - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [questions.length, submitted]);

  const generate = async () => {
    if (topic.trim().length < 2) return Alert.alert("Choose a topic", "Enter a topic with at least two characters.");
    const selectedDifficulty = recommendedDifficulty();
    setDifficulty(selectedDifficulty);
    setSubmitted(false); setTimedOut(false); setAnswers({}); setQuestions([]); setActiveQuestionIndex(0); setSecondsRemaining(activeProfile.seconds); startedAt.current = null; attemptRecorded.current = false;
    try {
      const result = await quizMutation.mutateAsync({ topic: topic.trim(), difficulty: selectedDifficulty, questionCount: activeProfile.questionCount, language: "Hindi-English" });
      setQuestions(result.questions);
      startedAt.current = Date.now();
    } catch (error) {
      Alert.alert("AI Quiz unavailable", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const submitForReview = async () => {
    if (!questions.length) return;
    try {
      await reviewMutation.mutateAsync({ topic: topic.trim(), difficulty, language: "Hindi-English", questions });
      Alert.alert("Sent for teacher review", "Your private practice questions were added to the teacher review queue. They remain unpublished until a teacher explicitly reviews and exports them.");
    } catch (error) {
      Alert.alert("Review submission unavailable", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const exportResultsPdf = async () => {
    if (!questions.length || !submitted) return;
    if (Platform.OS === "web") return Alert.alert("Native app required", "For privacy, detailed quiz PDFs are saved to the protected offline library in the Android or iOS app.");
    if (!FileSystem.documentDirectory) return Alert.alert("PDF export unavailable", "Your device does not provide private app storage.");
    setExportingPdf(true);
    try {
      const folder = `${FileSystem.documentDirectory}protected-resources/`;
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      const generated = await Print.printToFileAsync({ html: buildAiQuizResultsPdfHtml({ topic: topic.trim(), difficulty, questions, answers, score, scorePercent }) });
      const safeTopic = (topic.trim() || "ai-quiz").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 64);
      const targetUri = `${folder}${Date.now()}-${safeTopic || "ai-quiz"}-results.pdf`;
      await FileSystem.moveAsync({ from: generated.uri, to: targetUri });
      router.push({ pathname: "/pdf-reader", params: { uri: targetUri, title: `${topic.trim() || "AI Quiz"} detailed results` } } as never);
    } catch (error) {
      Alert.alert("PDF export unavailable", error instanceof Error ? error.message : "Your detailed quiz PDF could not be saved. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  if (user?.role !== "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Sign in with a Student account to use AI Quiz.</Text></ScreenContainer>;
  const locked = Boolean(questions.length && !submitted);
  const recommendation = scorePercent >= 80 ? `Strong result. Try ${advanceDifficulty(difficulty)} next time.` : scorePercent < 40 ? "Build confidence with Beginner next time." : "Keep practising this level to strengthen your accuracy.";
  const activeQuestions = submitted ? questions : questions.slice(activeQuestionIndex, activeQuestionIndex + 1);
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Ask AI" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>AI Quiz</Text><Text style={styles.sub}>Private AI practice · never auto-published</Text></View><Tag label="GEMINI" tone="green" /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}><Text style={styles.label}>PRACTICE TOPIC</Text><TextInput value={topic} onChangeText={setTopic} editable={!locked} maxLength={160} placeholder="For example, chain survey" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.label}>DIFFICULTY</Text><View style={styles.chips}>{(["beginner", "intermediate", "advanced"] as const).map((value) => <Pressable key={value} disabled={locked} onPress={() => setDifficulty(value)} style={[styles.chip, difficulty === value && styles.chipActive, locked && styles.disabled]}><Text style={[styles.chipText, difficulty === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</View><Text style={styles.label}>PRACTICE FORMAT</Text><View style={styles.profileChips}>{QUIZ_PROFILES.map((profile) => <Pressable key={profile.id} disabled={locked} onPress={() => { setProfileId(profile.id); setSecondsRemaining(profile.seconds); }} style={[styles.profileChip, profile.id === profileId && styles.profileChipActive, locked && styles.disabled]}><Text style={[styles.profileChipTitle, profile.id === profileId && styles.profileChipTitleActive]}>{profile.title}</Text><Text style={[styles.profileChipCopy, profile.id === profileId && styles.profileChipCopyActive]}>{profile.description}</Text></Pressable>)}</View>{statsQuery.data?.totalAttempts ? <Text style={styles.adaptiveHint}>Average: {statsQuery.data.averageScore}% · last score: {statsQuery.data.lastScore}% · the next level adapts from your private results.</Text> : null}<PrimaryButton label={quizMutation.isPending ? "Generating practice…" : `Generate ${activeProfile.questionCount} AI practice MCQs`} icon="auto-awesome" disabled={quizMutation.isPending || locked} onPress={() => void generate()} /></View>
      {historyQuery.data?.length && (!questions.length || submitted) ? <QuizHistory attempts={historyQuery.data} /> : null}
      {questions.length && !submitted ? <><View style={[styles.timer, secondsRemaining <= 60 && styles.timerUrgent]}><MaterialIcons name="timer" size={20} color={secondsRemaining <= 60 ? COLORS.red : COLORS.indigo} /><View style={styles.flex}><Text style={styles.timerLabel}>QUIZ TIME REMAINING</Text><Text style={[styles.timerValue, secondsRemaining <= 60 && styles.timerValueUrgent]}>{formatTime(secondsRemaining)}</Text></View><Text style={styles.timerMeta}>{answerCount}/{questions.length} answered</Text></View><QuestionNavigator questions={questions} answers={answers} activeIndex={activeQuestionIndex} onSelect={setActiveQuestionIndex} /></> : null}
      {quizMutation.isPending ? <View style={styles.loading}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.loadingText}>Creating a private practice set…</Text></View> : null}
      {activeQuestions.map((question, visibleIndex) => { const index = submitted ? visibleIndex : activeQuestionIndex; return <View key={`${question.question}-${index}`} style={styles.question}><Text style={styles.number}>QUESTION {index + 1} OF {questions.length}</Text><Text style={styles.questionText}>{question.question}</Text>{question.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; const correct = submitted && optionIndex === question.correctIndex; const wrong = submitted && selected && !correct; return <Pressable key={`${option}-${optionIndex}`} disabled={submitted} onPress={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} style={[styles.option, selected && styles.optionSelected, correct && styles.optionCorrect, wrong && styles.optionWrong]}><Text style={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>; })}{submitted ? <View style={styles.explanation}><Text style={styles.explanationLabel}>{answers[index] === question.correctIndex ? "CORRECT" : "EXPLANATION"}</Text><Text style={styles.explanationText}>{question.explanation}</Text></View> : null}</View>; })}
      {questions.length && !submitted ? <View style={styles.footer}><Pressable disabled={activeQuestionIndex === 0} onPress={() => setActiveQuestionIndex((value) => Math.max(0, value - 1))} style={[styles.secondaryButton, activeQuestionIndex === 0 && styles.disabled]}><Text style={styles.secondaryButtonText}>Previous</Text></Pressable>{activeQuestionIndex < questions.length - 1 ? <PrimaryButton label="Next question" icon="arrow-forward" onPress={() => setActiveQuestionIndex((value) => Math.min(questions.length - 1, value + 1))} /> : <PrimaryButton label={`Submit answers (${answerCount}/${questions.length})`} icon="check" disabled={answerCount !== questions.length} onPress={() => finishQuiz(false)} />}</View> : null}
      {questions.length && submitted ? <><View style={styles.result}><Text style={styles.resultLabel}>{timedOut ? "TIME EXPIRED · PRACTICE RESULT" : "PRACTICE RESULT"}</Text><Text style={styles.resultScore}>{score}/{questions.length}</Text><Text style={styles.resultPercent}>{scorePercent}%</Text><Text style={styles.resultCopy}>{recommendation}</Text><Text style={styles.resultSaved}>{saveAttemptMutation.isPending ? "Saving your progress…" : "Your private score is saved to your learning dashboard."}</Text><PrimaryButton label={exportingPdf ? "Preparing offline PDF…" : "Save detailed PDF for offline review"} icon="picture-as-pdf" disabled={exportingPdf} onPress={() => void exportResultsPdf()} /><PrimaryButton label={reviewMutation.isPending ? "Sending to teacher…" : "Send questions for teacher review"} icon="rate-review" disabled={reviewMutation.isPending || exportingPdf} onPress={() => void submitForReview()} /></View><DetailedResultsReview questions={questions} answers={answers} /></> : null}
    </ScrollView>
  </ScreenContainer>;
}

function QuestionNavigator({ questions, answers, activeIndex, onSelect }: { questions: QuizQuestion[]; answers: Record<number, number>; activeIndex: number; onSelect: (index: number) => void }) {
  return <View style={styles.navigator}><View style={styles.navigatorHeader}><Text style={styles.navigatorTitle}>Question navigator</Text><Text style={styles.navigatorCopy}>Tap any question to review before submitting.</Text></View><View style={styles.questionDots}>{questions.map((question, index) => <Pressable key={`nav-${question.question}-${index}`} accessibilityRole="button" accessibilityLabel={`Open question ${index + 1}`} onPress={() => onSelect(index)} style={[styles.questionDot, index === activeIndex && styles.questionDotActive, answers[index] !== undefined && styles.questionDotAnswered]}><Text style={[styles.questionDotText, (index === activeIndex || answers[index] !== undefined) && styles.questionDotTextActive]}>{index + 1}</Text></Pressable>)}</View></View>;
}

function QuizHistory({ attempts }: { attempts: { id: number; topic: string; difficulty: string; questionCount: number; scorePercent: number; durationSeconds: number }[] }) {
  return <View style={styles.historyCard}><View style={styles.historyHeading}><View style={styles.flex}><Text style={styles.historyTitle}>Recent AI practice</Text><Text style={styles.historyCopy}>Private aggregate scores only · questions and answers are not retained.</Text></View><MaterialIcons name="history" size={20} color={COLORS.indigo} /></View>{attempts.slice(0, 4).map((attempt) => <View key={attempt.id} style={styles.historyRow}><View style={styles.flex}><Text numberOfLines={1} style={styles.historyTopic}>{attempt.topic}</Text><Text style={styles.historyMeta}>{attempt.difficulty} · {attempt.questionCount} MCQs · {Math.ceil(attempt.durationSeconds / 60)} min</Text></View><Text style={styles.historyScore}>{attempt.scorePercent}%</Text></View>)}</View>;
}

function DetailedResultsReview({ questions, answers }: { questions: QuizQuestion[]; answers: Record<number, number> }) {
  const misses = questions.map((question, index) => ({ question, index, selectedIndex: answers[index] })).filter((item) => item.selectedIndex !== item.question.correctIndex);
  if (!misses.length) return <View style={styles.masteredReview}><MaterialIcons name="verified" size={25} color={COLORS.green} /><View style={styles.flex}><Text style={styles.masteredTitle}>All answers correct</Text><Text style={styles.masteredCopy}>Excellent work. You did not miss any questions in this private practice set.</Text></View></View>;
  return <View style={styles.reviewSection}><View style={styles.reviewHeading}><View style={styles.reviewHeadingIcon}><MaterialIcons name="fact-check" size={20} color={COLORS.red} /></View><View style={styles.flex}><Text style={styles.reviewTitle}>Detailed results review</Text><Text style={styles.reviewSubtitle}>{misses.length} {misses.length === 1 ? "answer needs review" : "answers need review"} · each explanation came with this Gemini-generated quiz.</Text></View></View>{misses.map(({ question, index, selectedIndex }) => <View key={`review-${question.question}-${index}`} style={styles.missedCard}><Text style={styles.missedNumber}>QUESTION {index + 1} · REVIEW</Text><Text style={styles.missedQuestion}>{question.question}</Text><AnswerReview label="YOUR ANSWER" value={typeof selectedIndex === "number" ? `${String.fromCharCode(65 + selectedIndex)}. ${question.options[selectedIndex]}` : "No answer selected"} icon="close" color={COLORS.red} /><AnswerReview label="CORRECT ANSWER" value={`${String.fromCharCode(65 + question.correctIndex)}. ${question.options[question.correctIndex]}`} icon="check-circle" color={COLORS.green} /><View style={styles.aiExplanation}><View style={styles.aiExplanationLabel}><MaterialIcons name="auto-awesome" size={15} color={COLORS.indigo} /><Text style={styles.aiExplanationLabelText}>AI EXPLANATION</Text></View><Text style={styles.aiExplanationText}>{question.explanation}</Text></View></View>)}</View>;
}

function AnswerReview({ label, value, icon, color }: { label: string; value: string; icon: "close" | "check-circle"; color: string }) {
  return <View style={styles.answerRow}><MaterialIcons name={icon} size={18} color={color} /><View style={styles.flex}><Text style={styles.answerLabel}>{label}</Text><Text style={[styles.answerValue, { color }]}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line }, headerCopy: { flex: 1 }, back: { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.indigoSoft }, title: { color: COLORS.ink, fontSize: 20, fontWeight: "900" }, sub: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, content: { padding: 16, gap: 14 }, card: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line }, label: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 12, color: COLORS.ink }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, chipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, chipText: { color: COLORS.indigo, fontSize: 11, fontWeight: "800", textTransform: "capitalize" }, chipTextActive: { color: COLORS.white }, profileChips: { flexDirection: "row", gap: 8 }, profileChip: { flex: 1, minHeight: 68, padding: 10, borderRadius: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, profileChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, profileChipTitle: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, profileChipTitleActive: { color: COLORS.white }, profileChipCopy: { color: COLORS.muted, fontSize: 10, marginTop: 3, lineHeight: 14 }, profileChipCopyActive: { color: "#D8E1F7" }, adaptiveHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16 }, historyCard: { gap: 8, padding: 13, borderRadius: 17, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: COLORS.line }, historyHeading: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, historyTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900" }, historyCopy: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 2 }, historyRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 8 }, historyTopic: { color: COLORS.ink, fontSize: 12, fontWeight: "800" }, historyMeta: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, historyScore: { color: COLORS.indigo, fontSize: 15, fontWeight: "900" }, timer: { padding: 13, borderRadius: 16, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#C9D3EC", flexDirection: "row", alignItems: "center", gap: 10 }, timerUrgent: { backgroundColor: "#FEF3F2", borderColor: "#FECDCA" }, timerLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, timerValue: { color: COLORS.indigo, fontSize: 22, fontWeight: "900", marginTop: 2, fontVariant: ["tabular-nums"] }, timerValueUrgent: { color: COLORS.red }, timerMeta: { color: COLORS.muted, fontSize: 11, fontWeight: "800" }, navigator: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line }, navigatorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, navigatorTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, navigatorCopy: { flex: 1, textAlign: "right", color: COLORS.muted, fontSize: 10, lineHeight: 14 }, questionDots: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, questionDot: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, questionDotActive: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft }, questionDotAnswered: { borderColor: COLORS.green, backgroundColor: "#ECFDF3" }, questionDotText: { color: COLORS.muted, fontSize: 11, fontWeight: "900" }, questionDotTextActive: { color: COLORS.indigo }, loading: { minHeight: 100, justifyContent: "center", alignItems: "center", gap: 9 }, loadingText: { color: COLORS.muted, fontSize: 12 }, question: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, number: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, questionText: { color: COLORS.ink, fontSize: 16, fontWeight: "800", lineHeight: 22 }, option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper }, optionSelected: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoSoft }, optionCorrect: { borderColor: COLORS.green, backgroundColor: "#ECFDF3" }, optionWrong: { borderColor: COLORS.red, backgroundColor: "#FEF3F2" }, optionLetter: { width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, color: COLORS.indigo, backgroundColor: COLORS.white, fontWeight: "900" }, optionText: { flex: 1, color: COLORS.ink, fontSize: 13, lineHeight: 18 }, explanation: { borderRadius: 12, padding: 10, backgroundColor: COLORS.indigoSoft, gap: 4 }, explanationLabel: { color: COLORS.indigo, fontSize: 10, fontWeight: "900" }, explanationText: { color: COLORS.ink, fontSize: 12, lineHeight: 18 }, footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }, secondaryButton: { minHeight: 46, borderRadius: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white }, secondaryButtonText: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, result: { padding: 18, alignItems: "center", gap: 5, borderRadius: 18, backgroundColor: COLORS.indigo }, resultLabel: { color: "#D8E1F7", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, resultScore: { color: COLORS.white, fontSize: 33, fontWeight: "900" }, resultPercent: { color: COLORS.saffron, fontSize: 18, fontWeight: "900" }, resultCopy: { color: "#D8E1F7", textAlign: "center", fontSize: 12, lineHeight: 17 }, resultSaved: { color: "#D8E1F7", textAlign: "center", fontSize: 10, lineHeight: 15, marginBottom: 5 }, reviewSection: { gap: 12, marginTop: 4 }, reviewHeading: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FFF7F7" }, reviewHeadingIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FEE2E2" }, reviewTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "900" }, reviewSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, missedCard: { gap: 11, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: "#FECACA", backgroundColor: COLORS.white }, missedNumber: { color: COLORS.red, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, missedQuestion: { color: COLORS.ink, fontSize: 16, fontWeight: "800", lineHeight: 22 }, answerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, answerLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, answerValue: { fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 2 }, aiExplanation: { gap: 6, padding: 11, borderRadius: 13, backgroundColor: COLORS.indigoSoft, borderWidth: 1, borderColor: "#C9D5F2" }, aiExplanationLabel: { flexDirection: "row", alignItems: "center", gap: 5 }, aiExplanationLabelText: { color: COLORS.indigo, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, aiExplanationText: { color: COLORS.ink, fontSize: 12, lineHeight: 19 }, masteredReview: { flexDirection: "row", alignItems: "center", gap: 10, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: "#ABEFC6", backgroundColor: "#F4FBF7" }, masteredTitle: { color: COLORS.green, fontSize: 15, fontWeight: "900" }, masteredCopy: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }, disabled: { opacity: 0.45 }, denied: { color: COLORS.muted, textAlign: "center" },
});
