import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Attached sequential UX instruction preservation", () => {
  it("adds a safe history back control to the Developer login without changing secure entry validation", () => {
    const portal = read("app/dev-portal.tsx");
    expect(portal).toContain('accessibilityLabel="Return to previous screen"');
    expect(portal).toContain("hitSlop={12}");
    expect(portal).toContain('const returnToEntry = () => { if (router.canGoBack()) router.back(); else router.replace("/"); }');
    expect(portal).toContain("onPress={returnToEntry}");
    expect(portal).toContain("server-only Developer Passkey");
    expect(portal).toContain("Password must be at least 12 characters long.");
  });

  it("retains the existing Home language toggle and camera-enabled image thumbnail/removal inside the keyboard-aware chat shell", () => {
    const home = read("app/(tabs)/index.tsx");
    const chat = read("app/ask-ai.tsx");
    expect(home).toContain("const cycleLanguage");
    expect(home).toContain('name="translate"');
    expect(home).toContain("Change interface language");
    expect(chat).toContain("KeyboardAvoidingView");
    expect(chat).toContain("imageDraft");
    expect(chat).toContain("Cropped preview ready");
    expect(chat).toContain("Remove selected image");
  });

  it("retains fast State filtering, district/tehsil context, reviewed references, and staff-controlled long mock-test presets", () => {
    const converter = read("app/toolkit/unit-converter.tsx");
    const toolkit = read("lib/amin-toolkit.ts");
    const operations = read("app/operations/tests.tsx");
    expect(converter).toContain("stateSearch");
    expect(converter).toContain("shownStates");
    expect(converter).toContain("districtSearch");
    expect(toolkit).toContain("mp-revenue-circulars");
    expect(toolkit).toContain("bihar-revenue-department");
    expect(operations).toContain("MOCK_TEST_PRESETS");
    expect(operations).toContain("durationMinutes: 120");
    expect(operations).toContain("durationMinutes: 180");
    expect(operations).toContain("Presets are staff-selectable starting points");
  });
});
