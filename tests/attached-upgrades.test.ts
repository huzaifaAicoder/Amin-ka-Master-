import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Attached additive Toolkit, portal, and Study Coach upgrade guard", () => {
  it("keeps local-only State preference, district context, conversion history, and official references inside the existing Toolkit module", () => {
    const toolkit = read("lib/amin-toolkit.ts");
    const converter = read("app/toolkit/unit-converter.tsx");
    expect(toolkit).toContain("PREFERRED_STATE_KEY");
    expect(toolkit).toContain("RECENT_CONVERSIONS_KEY");
    expect(toolkit).toContain("officialReferencesForState");
    expect(converter).toContain("District / tehsil confirmation");
    expect(converter).toContain("persistPreferredIndiaState");
    expect(converter).toContain("Save to recent conversions");
  });

  it("retains government-host restrictions while enabling compatible official portal rendering and Digital Map entry", () => {
    const records = read("app/toolkit/land-records.tsx");
    const toolkit = read("app/amin-toolkit.tsx");
    expect(records).toContain("javaScriptEnabled");
    expect(records).toContain("domStorageEnabled");
    expect(records).toContain('mixedContentMode="always"');
    expect(records).toContain("onShouldStartLoadWithRequest");
    expect(toolkit).toContain("Digital Map & Bhumi Records");
  });

  it("keeps Developer User Management keyboard-aware and exposes a clear authenticated password update action", () => {
    const portal = read("app/dev-portal.tsx");
    expect(portal).toContain('behavior={Platform.OS === "ios" ? "padding" : "height"}');
    expect(portal).toContain('label={props.busy ? "Updating password…" : "Update password"}');
    expect(portal).toContain("resetUserPassword");
  });

  it("adds private editable planning and honest supported-session learning-time visualization without altering server Study Coach data", () => {
    const planner = read("lib/study-planner.ts");
    const coach = read("app/study-coach.tsx");
    const lesson = read("app/lesson/[lessonId].tsx");
    const home = read("app/(tabs)/index.tsx");
    expect(planner).toContain("amin-ka-master.study-planner");
    expect(planner).toContain("amin-ka-master.learning-time");
    expect(coach).toContain("EditableStudyPlanner");
    expect(lesson).toContain("recordLearningSeconds");
    expect(home).toContain("WeeklyLearningGraph");
    expect(home).toContain('name="translate"');
  });

  it("retains the image-selection privacy boundary while adding a reviewable cropped preview", () => {
    const doubtSolver = read("app/ask-ai.tsx");
    expect(doubtSolver).toContain("Cropped image preview");
    expect(doubtSolver).toContain("imagePreviewVisible");
    expect(doubtSolver).toContain("not stored in chat history");
  });
});
