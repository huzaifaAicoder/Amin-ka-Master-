import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Mega Upgrade follow-ups", () => {
  it("keeps wellbeing time local, bounded, and category-specific", () => {
    const planner = read("lib/study-planner.ts");
    expect(planner).toContain("learningTimeKey");
    expect(planner).toContain("if (bounded < 30) return");
    expect(planner).toContain('"Lectures", "Notes", "Shorts", "Tests", "Other"');
  });

  it("adds desktop course layout only at the web breakpoint while retaining mobile flow", () => {
    const course = read("app/course/[slug].tsx");
    expect(course).toContain('Platform.OS === "web" && width >= 900');
    expect(course).toContain("heroRowDesktop");
    expect(course).toContain("bodyRowDesktop");
    expect(course).toContain("authorized-course-");
    expect(course).toContain("downloadAuthorizedOfflineResource");
  });
});
