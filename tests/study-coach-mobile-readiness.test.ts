import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Study Coach mobile-readiness regression guard", () => {
  it("keeps Study Coach reports in private app storage and routes them only to the internal reader", () => {
    const screen = read("app/study-coach.tsx");
    expect(screen).toContain('const privateFolder = `${documentDirectory}protected-resources/`;');
    expect(screen).toContain("FileSystem.makeDirectoryAsync(privateFolder, { intermediates: true })");
    expect(screen).toContain("Print.printToFileAsync");
    expect(screen).toContain("FileSystem.moveAsync");
    expect(screen).toContain('pathname: "/pdf-reader"');
    expect(screen).toContain("Platform.OS === \"web\"");
  });

  it("refuses non-private PDF reader parameters while retaining native capture protection", () => {
    const reader = read("app/pdf-reader.tsx");
    expect(reader).toContain('uri.includes("protected-resources/")');
    expect(reader).toContain('originWhitelist={["file://"]}');
    expect(reader).toContain("Protected PDF unavailable");
    expect(reader).toContain("ScreenCapture.preventScreenCaptureAsync");
  });

  it("records an in-app confirmation only when Study Coach notices change from off to on", () => {
    const router = read("server/routers.ts");
    const db = read("server/db.ts");
    const screen = read("app/study-coach.tsx");
    expect(router).toContain("const previous = await db.getStudyCoachNoticePreference(ctx.user.id)");
    expect(router).toContain("input.noticesEnabled && !previous.noticesEnabled");
    expect(db).toContain("createStudyCoachNoticeConfirmation");
    expect(screen).toContain("Notice preference not saved");
  });
});
