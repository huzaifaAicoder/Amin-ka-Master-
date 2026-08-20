import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("White-label master template regression guard", () => {
  it("retains separate template, client-project, and release records without changing master data tables", () => {
    const schema = read("drizzle/schema.ts");
    for (const table of ["masterTemplates", "clientProjects", "clientProjectReleases"]) expect(schema).toContain(`export const ${table}`);
    const migration = read("drizzle/0016_organic_corsair.sql");
    for (const table of ["master_templates", "client_projects", "client_project_releases"]) expect(migration).toContain(`CREATE TABLE \`${table}\``);
    expect(migration).not.toMatch(/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i);
  });

  it("retains clone isolation and the Developer-only provisioning boundary", () => {
    const database = read("server/db.ts");
    const router = read("server/routers.ts");
    expect(database).toContain("excludedFromClone");
    for (const secret of ["passwordHashes", "providerSecrets", "paymentSecrets", "webhookSecrets", "databaseCredentials", "productionMedia"]) expect(database).toContain(secret);
    for (const procedure of ["templates: requireRoles([\"developer\"])", "clientProjects: requireRoles([\"developer\"])", "createClientProject: requireRoles([\"developer\"])", "prepareClientProjectRelease: requireRoles([\"developer\"])", "generateClientProjectBlueprint: requireRoles([\"developer\"])"]) expect(router).toContain(procedure);
    expect(router).toContain("manualPlatformPublishRequired: true");
    expect(router).toContain("AI configuration is not available because the server-side Gemini provider is not configured.");
  });

  it("retains the Template Studio and leaves existing Developer Control Center tabs intact", () => {
    const studio = read("components/template-studio.tsx");
    const portal = read("app/dev-portal.tsx");
    for (const label of ["Master Template Studio", "AI configuration assistant", "Create isolated client project", "Save client configuration", "Prepare release package", "does not publish the app, generate an APK"]) expect(studio).toContain(label);
    for (const tab of ["overview", "branding", "access", "users", "templates", "content", "audit"]) expect(portal).toContain(`\"${tab}\"`);
    expect(portal).toContain("<TemplateStudio />");
  });
});
