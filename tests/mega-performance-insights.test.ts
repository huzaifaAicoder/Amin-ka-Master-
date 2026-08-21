import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Mega Platform Upgrade: Student Performance Insights", () => {
  it("reuses current Student records without a duplicate analytics backend", () => {
    const screen = read("app/performance.tsx");
    const home = read("app/(tabs)/index.tsx");
    expect(screen).toContain("trpc.student.learning.useQuery");
    expect(screen).toContain("trpc.student.testHistory.useQuery");
    expect(screen).toContain("trpc.student.aiQuizStats.useQuery");
    expect(screen).toContain("trpc.student.studyCoach.useQuery");
    expect(screen).toContain("They are designed to support your learning, not to label or rank you.");
    expect(home).toContain('router.push("/performance" as never)');
  });

  it("keeps Insights private to Student accounts", () => {
    const screen = read("app/performance.tsx");
    expect(screen).toContain('user?.role !== "student"');
    expect(screen).toContain("Student access required");
  });
});
