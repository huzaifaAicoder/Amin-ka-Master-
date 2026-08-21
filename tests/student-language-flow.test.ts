import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Student language preference flow", () => {
  it("keeps the interface preference device-local and supports English, Hindi, and bilingual labels", () => {
    const preference = read("lib/language-preference.tsx");
    expect(preference).toContain('export type InterfaceLanguage = "english" | "hindi" | "bilingual"');
    expect(preference).toContain('const STORAGE_KEY = "amin-ka-master.interface-language"');
    expect(preference).toContain('await AsyncStorage.setItem(STORAGE_KEY, next)');
    expect(preference).toContain('language === "english" ? english : language === "hindi" ? hindi');
  });

  it("cycles the Student Home language control and keeps learner content separate from interface labels", () => {
    const home = read("app/(tabs)/index.tsx");
    const runbook = read("docs/authenticated-role-qa-runbook.md");
    expect(home).toContain('const next: Record<InterfaceLanguage, InterfaceLanguage> = { english: "hindi", hindi: "bilingual", bilingual: "english" }');
    expect(home).toContain("const languageCode = language === \"english\" ? \"EN\" : language === \"hindi\" ? \"हि\" : \"EN/हि\"");
    expect(home).toContain('activeLearning.course.title');
    expect(runbook).toContain("Student interface-language verification");
  });
});
