import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Unified Learning Operations & Growth Suite regression guard", () => {
  it("retains distinct Student, Staff, Owner, and Developer procedures with server role boundaries", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("studyCoach: protectedProcedure");
    expect(router).toContain("requireStudentAccess(ctx.user.role)");
    expect(router).toContain("learningOperations: requireRoles([\"teacher\", \"admin\", \"super_admin\"])");
    expect(router).toContain("businessIntelligence: ownerProcedure");
    expect(router).toContain("clientHealth: requireRoles([\"developer\"])");
    expect(router).toContain("requireGrowthSuiteFeature");
  });

  it("retains privacy-minimised at-risk outputs and audited notices", () => {
    const db = read("server/db.ts");
    const router = read("server/routers.ts");
    expect(db).toContain("Exact answers, AI Quiz topics/scores, personal notes, email, and downloads");
    expect(db).toContain("createLearningOperationsNotice");
    expect(router).toContain("learning_operations.notice_sent");
    expect(db).toContain("studyCoachPreferences");
  });

  it("retains every panel entry point and private offline Study Coach report workflow", () => {
    const home = read("app/(tabs)/index.tsx");
    const operations = read("app/operations.tsx");
    const control = read("app/operations/control.tsx");
    const portal = read("app/dev-portal.tsx");
    const coach = read("app/study-coach.tsx");
    expect(home).toContain("/study-coach");
    expect(operations).toContain("/operations/learning-ops");
    expect(control).toContain("/operations/business-intel");
    expect(portal).toContain("Client Health Dashboard");
    expect(coach).toContain("protected-resources/");
    expect(coach).toContain("Print.printToFileAsync");
  });
});
