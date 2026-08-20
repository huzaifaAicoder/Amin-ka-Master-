import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Modern learning-experience additive guard", () => {
  it("exports only saved local conversion history to a protected native PDF and keeps local-unit reference cards scoped", () => {
    const converter = read("app/toolkit/unit-converter.tsx");
    const report = read("lib/land-conversion-report.ts");
    const toolkit = read("lib/amin-toolkit.ts");
    expect(converter).toContain("Export PDF");
    expect(converter).toContain("protected-resources/");
    expect(converter).toContain("reviewedLandReferenceCardsForState");
    expect(report).toContain("not a legal land record");
    expect(toolkit).toContain("REVIEWED_LAND_REFERENCE_CARDS");
    expect(toolkit).toContain("rajasthan-land-revenue-circulars");
  });

  it("keeps the AI image preview local while exposing native pinch zoom", () => {
    const chat = read("app/ask-ai.tsx");
    expect(chat).toContain("PinchGestureHandler");
    expect(chat).toContain("Pinch with two fingers to zoom");
    expect(chat).toContain("useNativeDriver: true");
    expect(chat).toContain("not saved in chat history, downloads, or your learning profile");
  });

  it("adds test navigation and history continuity without replacing server submission or review", () => {
    const test = read("app/test/[testId].tsx");
    const history = read("app/test-history.tsx");
    expect(test).toContain("Submit this test?");
    expect(test).toContain("QuestionNavigator");
    expect(test).toContain("Mark for review");
    expect(test).toContain("View attempt history");
    expect(test).toContain("submitMutation.mutateAsync");
    expect(history).toContain("COMPLETED");
    expect(history).toContain("BEST");
    expect(history).toContain("PASSED");
  });
});
