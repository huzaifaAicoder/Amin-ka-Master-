import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Developer Control Center mobile discoverability", () => {
  it("keeps every existing Developer area visible from Overview without removing the horizontal tab strip", () => {
    const portal = read("app/dev-portal.tsx");
    const grid = read("components/developer-control-shortcut-grid.tsx");
    expect(portal).toContain("horizontal showsHorizontalScrollIndicator={false}");
    expect(portal).toContain("DeveloperControlShortcutGrid");
    for (const area of ["overview", "health", "branding", "access", "users", "templates", "content", "audit"]) expect(grid).toContain(`id: \"${area}\"`);
  });
});
