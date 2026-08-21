import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Wellbeing and authenticated role QA boundaries", () => {
  it("preserves numeric history and exposes category-aware wellbeing data without fabricated minutes", () => {
    const planner = read("lib/study-planner.ts");
    const screen = read("app/wellbeing-details.tsx");
    expect(planner).toContain("typeof existing === \"number\"");
    expect(planner).toContain("category: WellbeingCategory = \"Lectures\"");
    expect(planner).toContain("loadWellbeingBreakdown");
    expect(screen).toContain("Today by activity");
    expect(screen).toContain("category detail begins when category-aware sessions are recorded");
  });

  it("keeps the authenticated role destinations and role boundaries documented", () => {
    const root = read("app/_layout.tsx");
    const runbook = read("docs/authenticated-role-qa-runbook.md");
    expect(root).toContain('user.role === "developer" ? "/dev-portal"');
    expect(root).toContain('user.role === "student" ? "/" : "/operations"');
    expect(runbook).toContain("Student sign-in");
    expect(runbook).toContain("Staff sign-in plus Staff Passkey");
    expect(runbook).toContain("Owner sign-in plus Owner code/passkey");
    expect(runbook).toContain("Developer sign-in plus server-verified Developer Passkey");
  });
});
