import { describe, expect, it } from "vitest";

import { buildAiQuizResultsPdfHtml } from "../lib/ai-quiz-results-pdf";

describe("AI Quiz results PDF export", () => {
  it("includes the missed answer, correct answer, and escaped AI explanation in a private practice report", () => {
    const html = buildAiQuizResultsPdfHtml({
      topic: "Chain <survey>",
      difficulty: "beginner",
      score: 0,
      scorePercent: 0,
      questions: [{ question: "What is <baseline>?", options: ["A & B", "Correct"], correctIndex: 1, explanation: "Use a & reliable baseline." }],
      answers: { 0: 0 },
      completedAt: new Date("2026-08-20T00:00:00.000Z"),
    });
    expect(html).toContain("AI Quiz Detailed Results");
    expect(html).toContain("Chain &lt;survey&gt;");
    expect(html).toContain("Your answer");
    expect(html).toContain("A. A &amp; B");
    expect(html).toContain("Correct answer");
    expect(html).toContain("B. Correct");
    expect(html).toContain("AI EXPLANATION");
    expect(html).toContain("Use a &amp; reliable baseline.");
  });

  it("uses a mastery summary when every answer is correct", () => {
    const html = buildAiQuizResultsPdfHtml({
      topic: "Area calculation",
      difficulty: "intermediate",
      score: 1,
      scorePercent: 100,
      questions: [{ question: "Which formula applies?", options: ["Correct", "Other"], correctIndex: 0, explanation: "The first formula applies." }],
      answers: { 0: 0 },
    });
    expect(html).toContain("All answers correct");
    expect(html).toContain("Mastery review");
  });
});
