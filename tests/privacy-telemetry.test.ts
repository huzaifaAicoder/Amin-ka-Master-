import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Privacy-approved telemetry regression guard", () => {
  it("uses aggregate bucket schemas with no identity or raw-error fields", () => {
    const schema = read("drizzle/schema.ts");
    const apiSection = schema.slice(schema.indexOf("export const telemetryApiLatencyBuckets"), schema.indexOf("export const telemetryCrashBuckets"));
    const crashSection = schema.slice(schema.indexOf("export const telemetryCrashBuckets"), schema.indexOf("export type User"));
    expect(apiSection).toContain("bucketStartedAt");
    expect(apiSection).toContain("routeGroup");
    expect(apiSection).toContain("statusClass");
    expect(apiSection).not.toContain("userId");
    expect(apiSection).not.toContain("requestBody");
    expect(crashSection).toContain("errorClass");
    expect(crashSection).not.toContain("userId");
    expect(crashSection).not.toContain("stack");
    expect(crashSection).not.toContain("message");
  });

  it("requires explicit Developer controls and applies automatic bounded retention", () => {
    const db = read("server/db.ts");
    const router = read("server/routers.ts");
    const portal = read("app/dev-portal.tsx");
    expect(db).toContain("TELEMETRY_RETENTION_DAYS = 30");
    expect(db).toContain("telemetry.api_latency_enabled");
    expect(db).toContain("telemetry.crash_reporting_enabled");
    expect(router).toContain("telemetry: router");
    expect(router).toContain("config: protectedProcedure");
    expect(portal).toContain("Aggregate API latency telemetry");
    expect(portal).toContain("Aggregate crash telemetry");
  });

  it("instruments fixed server groups and reports fixed client crash categories without forwarding error content", () => {
    const server = read("server/_core/index.ts");
    const reporter = read("components/telemetry-reporter.tsx");
    expect(server).toContain("function telemetryRouteGroup");
    expect(server).toContain("recordApiLatencyMeasurement");
    expect(server).toContain("receives a path, operation name, identity, header, payload, or request body.");
    expect(reporter).toContain("unhandled_error");
    expect(reporter).toContain("unhandled_rejection");
    expect(reporter).not.toContain("error.message");
    expect(reporter).not.toContain("error.stack");
  });
});
