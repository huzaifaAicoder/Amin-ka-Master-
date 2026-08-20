import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { compassHeading, convertLandUnit, estimatePlotArea, isAllowedOfficialPortalUrl, supportedLandUnits } from "../lib/amin-toolkit";

const routerSource = readFileSync("server/routers.ts", "utf8");
const askAiSource = readFileSync("app/ask-ai.tsx", "utf8");
const rootSource = readFileSync("app/_layout.tsx", "utf8");
const dbSource = readFileSync("server/db.ts", "utf8");
const gpsSource = readFileSync("app/toolkit/gps-area.tsx", "utf8");
const converterSource = readFileSync("app/toolkit/unit-converter.tsx", "utf8");

describe("Amin Master Toolkit", () => {
  it("calculates a bounded local plot estimate without a server call", () => {
    const area = estimatePlotArea([
      { latitude: 25, longitude: 85 },
      { latitude: 25, longitude: 85.0001 },
      { latitude: 25.0001, longitude: 85.0001 },
      { latitude: 25.0001, longitude: 85 },
    ]);
    expect(area.squareMeters).toBeGreaterThan(100);
    expect(area.squareFeet).toBeGreaterThan(area.squareMeters);
    expect(area.acres).toBeGreaterThan(0);
  });

  it("normalizes cardinal magnetometer readings into headings", () => {
    expect(compassHeading(1, 0)).toBe(0);
    expect(compassHeading(0, 1)).toBe(270);
    expect(compassHeading(-1, 0)).toBe(180);
  });

  it("allows only reviewed official portal hosts", () => {
    expect(isAllowedOfficialPortalUrl("https://biharbhumi.bihar.gov.in/Biharbhumi/")).toBe(true);
    expect(isAllowedOfficialPortalUrl("https://dolr.gov.in/en/")).toBe(true);
    expect(isAllowedOfficialPortalUrl("https://upbhulekh.gov.in/")).toBe(true);
    expect(isAllowedOfficialPortalUrl("https://mpbhulekh.gov.in/")).toBe(true);
    expect(isAllowedOfficialPortalUrl("https://apnakhata.rajasthan.gov.in/")).toBe(true);
    expect(isAllowedOfficialPortalUrl("https://example.com/land-records")).toBe(false);
    expect(isAllowedOfficialPortalUrl("https://biharbhumi.bihar.gov.in.attacker.example/")).toBe(false);
  });

  it("keeps Gemini Vision inputs bounded, Student-only, and server-side", () => {
    expect(routerSource).toContain('image: z.object({ base64: z.string().min(32).max(3_500_000)');
    expect(routerSource).toContain('ctx.user.role !== "student"');
    expect(routerSource).toContain("inlineData: { data: input.image.base64");
    expect(routerSource).not.toContain("saveVisionImage");
    expect(askAiSource).toContain("MAX_VISION_IMAGE_BASE64");
    expect(askAiSource).toContain("allowsEditing: true");
    expect(askAiSource).toContain("ImageManipulator.manipulateAsync");
    expect(askAiSource).toContain("not saved in your chat, downloads, or learning profile");
  });

  it("converts local units only through an explicitly selected state system", () => {
    expect(supportedLandUnits("bihar-common")).toEqual(expect.arrayContaining(["bigha", "katha", "dhur"]));
    expect(supportedLandUnits("up-pucca")).toContain("bigha");
    expect(supportedLandUnits("up-pucca")).not.toContain("katha");
    expect(supportedLandUnits("metric-only")).not.toContain("bigha");
    expect(convertLandUnit(1, "acre", "bigha", "bihar-common")).toBeCloseTo(1.6, 4);
    expect(convertLandUnit(1, "acre", "bigha", "metric-only")).toBeNull();
    expect(converterSource).toContain("Bigha, Katha, and Dhur are not universal across India");
  });

  it("keeps saved GPS plots local and supports reopening without a server route", () => {
    const toolkitSource = readFileSync("lib/amin-toolkit.ts", "utf8");
    expect(toolkitSource).toContain("AsyncStorage");
    expect(toolkitSource).toContain("amin-toolkit.saved-plots.v1");
    expect(gpsSource).toContain("persistSavedPlot");
    expect(gpsSource).toContain("loadSavedPlots");
    expect(gpsSource).toContain("Opened ${plot.name}");
    expect(gpsSource).not.toContain("trpc.");
  });

  it("enforces the Toolkit through the existing Developer global and individual Student gates", () => {
    expect(dbSource).toContain('"amin_toolkit"');
    expect(dbSource).toContain('"feature.amin_toolkit_enabled"');
    expect(rootSource).toContain('studentFeature("amin_toolkit")');
    expect(rootSource).toContain('flag("feature.amin_toolkit_enabled")');
  });
});
