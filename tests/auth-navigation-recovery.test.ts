import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sessionSource = readFileSync("lib/lms-session.tsx", "utf8");
const authSource = readFileSync("app/auth.tsx", "utf8");
const developerSource = readFileSync("app/dev-portal.tsx", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const rootSource = readFileSync("app/_layout.tsx", "utf8");

describe("Developer and Staff authentication recovery", () => {
  it("keeps a verified local session during a transient auth.me failure and only clears it on unauthorized identity recovery", () => {
    expect(sessionSource).toContain('meQuery.isError && meQuery.error?.data?.code === "UNAUTHORIZED"');
    expect(sessionSource).toContain("meQuery.isLoading && !localUser");
  });

  it("retains the required Staff Passkey and current Staff portal destination", () => {
    expect(authSource).toContain('portal: "staff", staffPasskey');
    expect(authSource).toContain('router.replace("/operations")');
    expect(routerSource).toContain('if (!input.staffPasskey) throw new TRPCError');
    expect(routerSource).toContain("verifyActiveStaffPasskey(input.staffPasskey)");
  });

  it("prevents duplicate Staff requests and releases the visible spinner after a bounded wait", () => {
    expect(authSource).toContain("signInAttemptRef.current");
    expect(authSource).toContain("setSignInTimedOut(true)");
    expect(authSource).toContain("15_000");
    expect(authSource).toContain("duplicate submissions are blocked");
  });

  it("retains Developer passkey verification and the existing Control Center route while adding bounded pending recovery", () => {
    expect(developerSource).toContain("developerLoginAttemptRef.current");
    expect(developerSource).toContain("setDeveloperLoginTimedOut(true)");
    expect(developerSource).toContain('router.replace("/dev-portal")');
    expect(routerSource).toContain("verifyDeveloperPortalPasskey(input.developerPasskey)");
    expect(rootSource).toContain('const isDeveloperRoute = rootSegment === "dev-portal" || rootSegment === "view-as"');
  });
});
