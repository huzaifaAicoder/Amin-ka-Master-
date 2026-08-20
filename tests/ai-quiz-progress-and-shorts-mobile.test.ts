import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const readProjectFile = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("AI Quiz private progress and Android Shorts safeguards", () => {
  it("persists only Student-owned AI Quiz attempts and returns private aggregate analytics", () => {
    const schema = readProjectFile("drizzle/schema.ts");
    const database = readProjectFile("server/db.ts");
    const routers = readProjectFile("server/routers.ts");
    expect(schema).toContain('"ai_quiz_attempts"');
    expect(database).toContain("export async function saveAiQuizAttempt");
    expect(database).toContain("export async function getStudentAiQuizStats");
    expect(database).toContain("export async function listStudentAiQuizAttempts");
    expect(database).toContain("where(eq(aiQuizAttempts.userId, userId))");
    expect(routers).toContain("saveAiQuizAttempt: protectedProcedure");
    expect(routers).toContain("aiQuizStats: protectedProcedure");
    expect(routers).toContain("aiQuizHistory: protectedProcedure");
    expect(routers).toContain('"Only Students can save AI Quiz practice results."');
    expect(routers).toContain('"AI Quiz analytics are available in the student learning experience."');
  });

  it("keeps the timed Gemini practice flow separate from explicit teacher-review submission", () => {
    const screen = readProjectFile("app/ai-quiz.tsx");
    expect(screen).toContain("const QUIZ_PROFILES");
    expect(screen).toContain("questionCount: 10");
    expect(screen).toContain("seconds: 25 * 60");
    expect(screen).toContain("setInterval");
    expect(screen).toContain("finishQuizRef.current(true)");
    expect(screen).toContain("saveAttemptMutation.mutateAsync");
    expect(screen).toContain("submitAiQuizForReview.useMutation");
    expect(screen).toContain("never auto-published");
    expect(screen).toContain("Try ${advanceDifficulty(difficulty)} next time.");
    expect(screen).toContain("DetailedResultsReview");
    expect(screen).toContain("Detailed results review");
    expect(screen).toContain("YOUR ANSWER");
    expect(screen).toContain("CORRECT ANSWER");
    expect(screen).toContain("AI EXPLANATION");
    expect(screen).toContain("Save detailed PDF for offline review");
    expect(screen).toContain("Print.printToFileAsync");
    expect(screen).toContain("protected-resources/");
    expect(screen).toContain("Question navigator");
    expect(screen).toContain("Recent AI practice");
  });

  it("retains the Student dashboard average widget and Android-conscious YouTube feed constraints", () => {
    const home = readProjectFile("app/(tabs)/index.tsx");
    const shorts = readProjectFile("app/(tabs)/shorts.tsx");
    expect(home).toContain("trpc.student.aiQuizStats.useQuery");
    expect(home).toContain("AI QUIZ AVERAGE");
    expect(home).toContain('router.push("/ai-quiz")');
    expect(shorts).toContain("pagingEnabled");
    expect(shorts).toContain('snapToAlignment="start"');
    expect(shorts).toContain('decelerationRate="fast"');
    expect(shorts).toContain('removeClippedSubviews={Platform.OS === "android"}');
    expect(shorts).toContain('active && !embedFailed');
    expect(shorts).toContain('userAgent={isYouTube ? "Mozilla/5.0 (Linux; Android 13; Mobile)');
    expect(shorts).toContain("getYouTubeEmbedUrl(url)");
  });
});
