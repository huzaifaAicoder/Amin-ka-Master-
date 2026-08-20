import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { compassHeading, convertLandUnit, estimatePlotArea, INDIA_STATES, isAllowedOfficialPortalUrl, standardSystemForIndiaState, supportedLandUnits, systemsForIndiaState } from "../lib/amin-toolkit";

const routerSource = readFileSync("server/routers.ts", "utf8");
const askAiSource = readFileSync("app/ask-ai.tsx", "utf8");
const rootSource = readFileSync("app/_layout.tsx", "utf8");
const dbSource = readFileSync("server/db.ts", "utf8");
const gpsSource = readFileSync("app/toolkit/gps-area.tsx", "utf8");
const converterSource = readFileSync("app/toolkit/unit-converter.tsx", "utf8");
const compassSource = readFileSync("app/toolkit/compass.tsx", "utf8");

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

  it("provides a standard-units profile for every State/UT and local units only through an explicitly selected local profile", () => {
    expect(INDIA_STATES).toHaveLength(36);
    expect(INDIA_STATES.map((entry) => entry.code)).toEqual(expect.arrayContaining(["BR", "UP", "MP", "RJ", "TN", "MH", "JK"]));
    for (const state of INDIA_STATES) expect(supportedLandUnits(standardSystemForIndiaState(state.code).id)).toEqual(expect.arrayContaining(["acre", "hectare", "square_feet", "square_meters"]));
    expect(supportedLandUnits("BR-bihar-common")).toEqual(expect.arrayContaining(["bigha", "katha", "dhur"]));
    expect(supportedLandUnits("UP-pucca-bigha")).toContain("bigha");
    expect(supportedLandUnits("UP-pucca-bigha")).not.toContain("katha");
    expect(supportedLandUnits(standardSystemForIndiaState("UP").id)).not.toContain("bigha");
    expect(convertLandUnit(1, "acre", "bigha", "BR-bihar-common")).toBeCloseTo(1.6, 4);
    expect(convertLandUnit(1, "acre", "bigha", standardSystemForIndiaState("BR").id)).toBeNull();
    expect(systemsForIndiaState("RJ").map((entry) => entry.id)).toEqual(expect.arrayContaining(["RJ-standard", "RJ-pucca-bigha"]));
    expect(converterSource).toContain("NO UNIVERSAL BIGHA");
    expect(converterSource).toContain("State or Union Territory");
    expect(converterSource).toContain("DISTRICT CHECK");
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

  it("throttles compass updates and uses a native-driven needle animation instead of rendering each sensor sample", () => {
    expect(compassSource).toContain("const SENSOR_INTERVAL_MS = 200");
    expect(compassSource).toContain("const DISPLAY_UPDATE_INTERVAL_MS = 250");
    expect(compassSource).toContain("useNativeDriver: true");
    expect(compassSource).toContain("Animated.View");
    expect(compassSource).not.toContain("addListener(({ x, y }) => setHeading");
  });

  it("enforces the Toolkit through the existing Developer global and individual Student gates", () => {
    expect(dbSource).toContain('"amin_toolkit"');
    expect(dbSource).toContain('"feature.amin_toolkit_enabled"');
    expect(rootSource).toContain('studentFeature("amin_toolkit")');
    expect(rootSource).toContain('flag("feature.amin_toolkit_enabled")');
  });
});
