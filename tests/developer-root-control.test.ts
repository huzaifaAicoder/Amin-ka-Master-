import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Developer root-control regression guard", () => {
  it("retains Developer-only lifecycle, permission, content, and feature-control procedures", () => {
    const router = read("server/routers.ts");
    for (const procedure of ["createUser: requireRoles([\"developer\"])", "deleteUser: requireRoles([\"developer\"])", "setUserControls: requireRoles([\"developer\"])", "contentInventory: requireRoles([\"developer\"])", "setContentStatus: requireRoles([\"developer\"])"]) expect(router).toContain(procedure);
    for (const control of ["studentAccessEnabled", "staffAccessEnabled", "ownerAccessEnabled", "shortsEnabled", "downloadsEnabled", "aiDoubtEnabled", "aiQuizEnabled"]) expect(router).toContain(control);
  });

  it("retains the tabbed root-control portal and safe non-recoverable-secret wording", () => {
    const portal = read("app/dev-portal.tsx");
    for (const tab of ["overview", "branding", "access", "users", "content"]) expect(portal).toContain(`\"${tab}\"`);
    expect(portal).toContain("Passwords and provider secrets remain non-recoverable");
    expect(portal).toContain("Global maintenance mode");
    expect(portal).toContain("Root content control");
  });

  it("enforces root panel and Student module switches in the shared navigation gate", () => {
    const rootLayout = read("app/_layout.tsx");
    const tabs = read("app/(tabs)/_layout.tsx");
    for (const control of ["platform.student_access_enabled", "platform.staff_access_enabled", "platform.owner_access_enabled", "platform.maintenance_enabled"]) expect(rootLayout).toContain(control);
    for (const feature of ["feature.shorts_enabled", "feature.downloads_enabled", "feature.courses_enabled"]) expect(tabs).toContain(feature);
  });
});
