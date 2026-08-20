import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Guardian report consent and privacy regression guard", () => {
  it("requires Student-controlled opt-in and a contact method before a report can be shared", () => {
    const router = read("server/routers.ts");
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("guardianReportPreferences");
    expect(router).toContain("setGuardianReportPreference");
    expect(router).toContain("guardianName.length < 2");
    expect(router).toContain("guardianEmail && !input.guardianMobile");
  });

  it("keeps staff report content privacy-minimised and explicit-share only", () => {
    const db = read("server/db.ts");
    const staffScreen = read("app/operations/guardian-reports.tsx");
    expect(db).toContain("Returns only consented, aggregate progress. It deliberately excludes marks,");
    expect(db).toContain("answers, AI topics, notes, downloads, assessment history, and private plans.");
    expect(staffScreen).toContain("Sharing.shareAsync");
    expect(staffScreen).toContain("platform does not automatically message a guardian");
    expect(staffScreen).toContain("recordGuardianReportShare");
  });

  it("retains strict server feature and permission boundaries", () => {
    const router = read("server/routers.ts");
    const layout = read("app/_layout.tsx");
    expect(router).toContain("guardianReports: requireRoles([\"teacher\", \"admin\", \"super_admin\"])");
    expect(router).toContain("guardian_reports.manage");
    expect(router).toContain("feature.guardian_reports_enabled");
    expect(layout).toContain("feature.guardian_reports_enabled");
  });
});
