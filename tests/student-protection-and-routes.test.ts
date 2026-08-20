import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

describe("Student protection and retained advanced routes", () => {
  it("keeps keyed Student capture prevention and iOS app-switcher privacy at the root", () => {
    const layout = readFileSync(resolve(root, "app/_layout.tsx"), "utf8");
    expect(layout).toContain('usePreventScreenCapture("student-session")');
    expect(layout).toContain('preventScreenCaptureAsync(key)');
    expect(layout).toContain('const key = "student-root-secure"');
    expect(layout).toContain("enableAppSwitcherProtectionAsync(1)");
    expect(layout).toContain("allowScreenCaptureAsync(key)");
  });

  it("retains the advanced Student and staff routes that must not disappear during feature work", () => {
    const requiredRoutes = [
      "app/(tabs)/downloads.tsx",
      "app/(tabs)/shorts.tsx",
      "app/ask-ai.tsx",
      "app/ai-quiz.tsx",
      "app/offline-media.tsx",
      "app/pdf-reader.tsx",
      "app/dev-portal.tsx",
      "app/operations/tests.tsx",
      "app/operations/ai-quiz-reviews.tsx",
      "app/operations/moderation.tsx",
    ];
    for (const route of requiredRoutes) expect(existsSync(resolve(root, route)), `${route} must remain available`).toBe(true);
  });
});
