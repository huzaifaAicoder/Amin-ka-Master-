import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("surgical recovery preservation audit", () => {
  it("keeps the protected Developer Control Center and its existing root-control areas connected", () => {
    const root = read("app/_layout.tsx");
    const portal = read("app/dev-portal.tsx");
    for (const area of ["overview", "health", "branding", "access", "users", "templates", "content", "audit"]) {
      expect(portal).toContain(`"${area}"`);
    }
    expect(root).toContain('<Stack.Screen name="dev-portal" />');
    expect(portal).toContain('user.role !== "developer"');
  });

  it("keeps Student navigation and the existing protected learning destinations discoverable", () => {
    const tabs = read("app/(tabs)/_layout.tsx");
    const account = read("app/(tabs)/account.tsx");
    for (const tab of ["learning", "shorts", "downloads", "account"]) expect(tabs).toContain(`name="${tab}"`);
    for (const route of ["/reels-hub", "/saved-shorts", "/tests", "/live", "/amin-toolkit", "/wellbeing-details", "/notifications"]) {
      expect(account).toContain(`router.push("${route}`);
    }
  });

  it("keeps Staff and Owner controls connected to their current protected operations surfaces", () => {
    const operations = read("app/operations.tsx");
    const owner = read("app/operations/control.tsx");
    const router = read("server/routers.ts");
    for (const route of ["/operations/courses", "/operations/structure", "/operations/media", "/operations/tests", "/operations/live"]) {
      expect(operations).toContain(route);
    }
    for (const tab of ["settings", "people", "business", "security", "activity"]) expect(owner).toContain(`"${tab}"`);
    expect(router).toContain("ownerProcedure.query(() => db.getOwnerBusinessIntelligence())");
    expect(router).toContain("saveMasterSettings: ownerProcedure");
  });
});
