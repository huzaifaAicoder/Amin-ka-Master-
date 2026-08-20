import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Developer advanced root-control regression guard", () => {
  it("keeps the private per-Student feature override model and Developer-only procedures", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers.ts");
    const db = read("server/db.ts");
    expect(schema).toContain("studentFeaturePermissions");
    expect(schema).toContain("student_feature_permissions");
    for (const name of ["setStudentFeatureControls", "auditLogs", "viewAsPreview"]) expect(router).toContain(`${name}: requireRoles([\"developer\"])`);
    expect(router).toContain("developer.view_as_preview_opened");
    expect(db).toContain("developerSetStudentFeatureControls");
    expect(db).toContain("listDeveloperAuditLogs");
  });

  it("retains safe CSV export and explicitly avoids target-session impersonation", () => {
    const csv = read("lib/developer-audit-csv.ts");
    const viewAs = read("app/view-as.tsx");
    expect(csv).toContain("buildDeveloperAuditCsv");
    expect(csv).toContain("expo-sharing");
    expect(csv).toContain("text/csv");
    expect(viewAs).toContain("READ-ONLY VIEW AS");
    expect(viewAs).toContain("not an impersonation session");
    expect(viewAs).toContain("Opening this page is recorded");
  });

  it("retains portal controls and route-gate enforcement for individual Student overrides", () => {
    const portal = read("app/dev-portal.tsx");
    const rootLayout = read("app/_layout.tsx");
    expect(portal).toContain("Searchable administrative audit log");
    expect(portal).toContain("Individual Student feature matrix");
    expect(portal).toContain("Individual Teacher permission matrix");
    expect(portal).toContain("View as (read-only)");
    expect(rootLayout).toContain("student.featureOverrides");
    expect(rootLayout).toContain("studentOverridesQuery");
  });
});
