import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Production hardening regression guard", () => {
  it("keeps native-safe auth recovery and visible secret controls across shared authentication screens", () => {
    const auth = read("app/auth.tsx");
    const developer = read("app/dev-portal.tsx");
    const askAi = read("app/ask-ai.tsx");
    const client = read("lib/trpc.ts");
    expect(client).not.toContain("window.location.replace");
    for (const source of [auth, developer]) {
      expect(source).toContain('behavior={Platform.OS === "ios" ? "padding" : "height"}');
      expect(source).toContain('name={visible ? "visibility-off" : "visibility"}');
      expect(source).toContain("Show ${label}");
    }
    expect(askAi).toContain('KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}');
    expect(askAi).toContain("styles.chatShell");
    expect(askAi).toContain("styles.composerArea");
  });

  it("retains offline Student routing, provider-aware YouTube safeguards, and bounded Shorts virtualization", () => {
    const rootLayout = read("app/_layout.tsx");
    const shorts = read("app/(tabs)/shorts.tsx");
    const youtube = read("lib/youtube.ts");
    expect(rootLayout).toContain("Network.useNetworkState()");
    expect(rootLayout).toContain("offlineStudent");
    expect(rootLayout).toContain('router.replace("/downloads")');
    for (const value of ['windowSize={5}', 'maxToRenderPerBatch={3}', 'removeClippedSubviews={Platform.OS === "android"}', 'Referer: "https://www.youtube.com/"']) expect(shorts).toContain(value);
    expect(youtube).toContain("enablejsapi=1");
    expect(youtube).toContain("origin=https%3A%2F%2Fwww.youtube.com");
  });

  it("retains persisted learner language preferences and a Developer-managed default", () => {
    const language = read("lib/language-preference.tsx");
    const account = read("app/(tabs)/account.tsx");
    const router = read("server/routers.ts");
    expect(language).toContain("amin-ka-master.interface-language");
    expect(language).toContain("platform.interface_language_default");
    expect(account).toContain("Interface language");
    expect(router).toContain("interfaceLanguageDefault");
    expect(router).toContain("platform.interface_language_default");
  });

  it("keeps ordinary credential login multi-device safe while reserving revocation for explicit security actions", () => {
    const router = read("server/routers.ts");
    const loginBlock = router.slice(router.indexOf("login: publicProcedure"), router.indexOf("requestPasswordReset:"));
    expect(loginBlock).toContain("db.createSession(user.id, ctx.req.headers[\"user-agent\"])");
    expect(loginBlock).not.toMatch(/invalidate.*session|revoke.*session/i);
  });
});
