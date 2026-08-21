import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Preview and Student translation repair", () => {
  it("retains the project’s explicit managed web-preview command without forcing a cache rebuild", () => {
    const pkg = read("package.json");
    expect(pkg).toContain('cross-env CI=false EXPO_USE_METRO_WORKSPACE_ROOT=1 sh -c');
    expect(pkg).toContain('tail -f /dev/null | script -q -e -c');
    expect(pkg).toContain('npx expo start --web --port ${EXPO_PORT:-8081}');
    expect(pkg).toContain('concurrently -k');
    expect(pkg).not.toContain('expo start --web --clear');
  });

  it("uses the existing saved language preference to visibly translate the Student Home", () => {
    const home = read("app/(tabs)/index.tsx");
    expect(home).toContain("const { language, setLanguage, label }");
    expect(home).toContain('t("YOUR LEARNING SPACE", "आपका अध्ययन स्थान")');
    expect(home).toContain('t("Ask AI · Doubt Solver", "AI से पूछें · डाउट सॉल्वर")');
    expect(home).toContain("languageCode");
  });
});
