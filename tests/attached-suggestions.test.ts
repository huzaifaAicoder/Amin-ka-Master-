import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("attached additive improvements", () => {
  it("keeps an explicit Owner-only middleware and Owner business controls", () => {
    const trpc = read("server/_core/trpc.ts");
    const router = read("server/routers.ts");
    expect(trpc).toContain('export const ownerProcedure = requireRoles(["super_admin"])');
    expect(router).toContain("businessIntelligence: ownerProcedure");
    expect(router).toContain("masterSettings: ownerProcedure");
    expect(router).toContain("saveMasterSettings: ownerProcedure");
    expect(router).toContain('courses: requireRoles(["teacher", "admin", "super_admin"])');
  });

  it("keeps universal Gemini text plus normalized inline image delivery behind Student auth", () => {
    const router = read("server/routers.ts");
    const ai = read("app/ask-ai.tsx");
    expect(router).toContain("Universal Helpful Assistant");
    expect(router).toContain('ctx.user.role !== "student"');
    expect(router).toContain("input.image.base64.replace(/^data:[^;]+;base64,/, \"\")");
    expect(router).toContain("inlineData: { data: input.image.base64");
    expect(ai).toContain("ImageManipulator.manipulateAsync");
    expect(ai).toContain("KeyboardAvoidingView");
    expect(ai).toContain("Cropped preview ready");
    expect(ai).toContain("keyboardVerticalOffset={Platform.OS === \"ios\" ? 6 : 0}");
  });

  it("provides a private interactive wellbeing details route and backward-compatible category storage", () => {
    const planner = read("lib/study-planner.ts");
    const wellbeing = read("app/wellbeing-details.tsx");
    const account = read("app/(tabs)/account.tsx");
    expect(planner).toContain("WellbeingCategory");
    expect(planner).toContain("loadWellbeingBreakdown");
    expect(planner).toContain("typeof existing === \"number\"");
    expect(wellbeing).toContain("Today by activity");
    expect(wellbeing).toContain("not sent to Staff");
    expect(account).toContain('router.push("/wellbeing-details" as never)');
  });

  it("reduces redundant preview startup refetches without disabling manual refresh", () => {
    const root = read("app/_layout.tsx");
    const tabs = read("app/(tabs)/_layout.tsx");
    expect(root).toContain("staleTime: 60_000");
    expect(root).toContain("gcTime: 5 * 60_000");
    expect(tabs).toContain("staleTime: 60_000");
    expect(tabs).toContain("refetchOnWindowFocus: false");
  });
});
