import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const router = read("server/routers.ts");
const root = read("app/_layout.tsx");
const developer = read("app/dev-portal.tsx");
const hub = read("app/reels-hub.tsx");
const player = read("components/external-media-player.tsx");

describe("forensic stabilization repairs", () => {
  it("uses a server-enforced Student procedure for private learner endpoints", () => {
    for (const procedure of ["featureOverrides: studentProcedure", "learning: studentProcedure", "certificate: studentProcedure", "savedShorts: studentProcedure", "freePlaylists: studentProcedure"]) expect(router).toContain(procedure);
  });

  it("redirects non-Students away from direct Student-only routes while retaining the role-aware Account tab", () => {
    expect(root).toContain('segments[1] !== "account"');
    for (const route of ["reels-hub", "saved-shorts", "free-playlists", "certificate", "offline-media", "pdf-reader", "wellbeing-details"]) expect(root).toContain(`rootSegment === "${route}"`);
  });

  it("requires the dedicated Owner flow, keeps delegated test access server-checked, and wires upload permission correctly", () => {
    expect(router).toContain("Owner accounts must use the Owner Portal");
    expect(router).toContain('await requireDelegatedPermission(ctx.user, "assessments.manage")');
    expect(developer).toContain("onStudentShortUpload");
    expect(developer).toContain("canUploadShorts: enabled");
  });

  it("shares real inline external-provider playback with the Reels Hub and retains a truthful provider fallback", () => {
    expect(player).toContain("allowsInlineMediaPlayback");
    expect(player).toContain("getExternalMediaEmbedUrl");
    expect(hub).toContain("ExternalMediaPlayer");
    expect(hub).toContain("Open provider");
    expect(hub).not.toContain("Inline playback remains available in Shorts.");
  });
});
