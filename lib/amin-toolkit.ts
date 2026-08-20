import AsyncStorage from "@react-native-async-storage/async-storage";

const EARTH_RADIUS_METERS = 6_378_137;
const SQ_METERS_TO_SQ_FEET = 10.7639104167;
const SQ_METERS_PER_ACRE = 4_046.8564224;
const SAVED_PLOTS_KEY = "amin-toolkit.saved-plots.v1";

export type GeoPoint = { latitude: number; longitude: number; accuracy?: number | null };
export type SavedPlot = { id: string; name: string; points: GeoPoint[]; createdAt: string };
export type LandUnit = "acre" | "hectare" | "square_feet" | "square_meters" | "bigha" | "katha" | "dhur";

export const LAND_UNIT_LABELS: Record<LandUnit, string> = {
  acre: "Acre", hectare: "Hectare", square_feet: "Square feet", square_meters: "Square meter", bigha: "Bigha", katha: "Katha", dhur: "Dhur",
};

type UnitSystem = { id: string; state: string; title: string; note: string; squareMeters: Partial<Record<LandUnit, number>> };

/** Local units are deliberately region-scoped. Unsupported local units stay unavailable
 * rather than presenting a single India-wide conversion as authoritative. */
export const LAND_UNIT_SYSTEMS: UnitSystem[] = [
  { id: "bihar-common", state: "Bihar", title: "Common Bihar system", note: "1 Bigha = 20 Katha = 400 Dhur. Confirm district/revenue-record practice before field or legal use.", squareMeters: { bigha: 2_529.285264, katha: 126.4642632, dhur: 6.32321316 } },
  { id: "up-pucca", state: "Uttar Pradesh", title: "Pucca Bigha reference", note: "Bigha practice can vary locally. Katha and Dhur are not assumed for this selection.", squareMeters: { bigha: 2_529.285264 } },
  { id: "metric-only", state: "All regions", title: "Metric / standard units only", note: "Use this when your local Bigha, Katha, or Dhur definition is not listed. Add a verified local system before converting those units.", squareMeters: {} },
];

function squareMetersPerUnit(unit: LandUnit, systemId: string) {
  const standard: Record<Exclude<LandUnit, "bigha" | "katha" | "dhur">, number> = { acre: SQ_METERS_PER_ACRE, hectare: 10_000, square_feet: 1 / SQ_METERS_TO_SQ_FEET, square_meters: 1 };
  if (unit in standard) return standard[unit as keyof typeof standard];
  return LAND_UNIT_SYSTEMS.find((system) => system.id === systemId)?.squareMeters[unit] ?? null;
}

export function supportedLandUnits(systemId: string) {
  return (Object.keys(LAND_UNIT_LABELS) as LandUnit[]).filter((unit) => squareMetersPerUnit(unit, systemId) !== null);
}

export function convertLandUnit(value: number, from: LandUnit, to: LandUnit, systemId: string) {
  const fromSquareMeters = squareMetersPerUnit(from, systemId);
  const toSquareMeters = squareMetersPerUnit(to, systemId);
  if (!Number.isFinite(value) || fromSquareMeters === null || toSquareMeters === null) return null;
  return value * fromSquareMeters / toSquareMeters;
}

/** Uses a local equirectangular projection and shoelace area. It is suitable
 * only for small, locally mapped plots and is not a certified survey result. */
export function estimatePlotArea(points: GeoPoint[]) {
  if (points.length < 3) return { squareMeters: 0, squareFeet: 0, acres: 0 };
  const referenceLatitudeRadians = points.reduce((total, point) => total + point.latitude, 0) / points.length * Math.PI / 180;
  const projected = points.map((point) => ({
    x: EARTH_RADIUS_METERS * point.longitude * Math.PI / 180 * Math.cos(referenceLatitudeRadians),
    y: EARTH_RADIUS_METERS * point.latitude * Math.PI / 180,
  }));
  let signedTwiceArea = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const current = projected[index];
    const next = projected[(index + 1) % projected.length];
    signedTwiceArea += current.x * next.y - next.x * current.y;
  }
  const squareMeters = Math.abs(signedTwiceArea) / 2;
  return { squareMeters, squareFeet: squareMeters * SQ_METERS_TO_SQ_FEET, acres: squareMeters / SQ_METERS_PER_ACRE };
}

export async function loadSavedPlots(): Promise<SavedPlot[]> {
  try {
    const value = await AsyncStorage.getItem(SAVED_PLOTS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((plot): plot is SavedPlot => Boolean(plot && typeof plot.id === "string" && typeof plot.name === "string" && Array.isArray(plot.points))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  } catch { return []; }
}

export async function persistSavedPlot(name: string, points: GeoPoint[]) {
  const cleanName = name.trim().slice(0, 80) || "Untitled plot";
  const plot: SavedPlot = { id: `plot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: cleanName, points, createdAt: new Date().toISOString() };
  const next = [plot, ...(await loadSavedPlots())];
  await AsyncStorage.setItem(SAVED_PLOTS_KEY, JSON.stringify(next));
  return next;
}

export async function removeSavedPlot(id: string) {
  const next = (await loadSavedPlots()).filter((plot) => plot.id !== id);
  await AsyncStorage.setItem(SAVED_PLOTS_KEY, JSON.stringify(next));
  return next;
}

export function metersBetween(a: GeoPoint, b: GeoPoint) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(b.latitude - a.latitude);
  const deltaLongitude = radians(b.longitude - a.longitude);
  const startLatitude = radians(a.latitude);
  const endLatitude = radians(b.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function compassHeading(x: number, y: number) {
  const heading = Math.atan2(y, x) * 180 / Math.PI;
  return (360 - (heading < 0 ? heading + 360 : heading)) % 360;
}

export const OFFICIAL_LAND_PORTALS = [
  { id: "bihar-bhumi", state: "Bihar", title: "Bihar Bhumi", url: "https://biharbhumi.bihar.gov.in/Biharbhumi/", host: "biharbhumi.bihar.gov.in", note: "Revenue Bihar land and related online services." },
  { id: "up-bhulekh", state: "Uttar Pradesh", title: "UP Bhulekh", url: "https://upbhulekh.gov.in/", host: "upbhulekh.gov.in", note: "Uttar Pradesh official Bhulekh land-record portal." },
  { id: "mp-bhulekh", state: "Madhya Pradesh", title: "MP Bhulekh", url: "https://mpbhulekh.gov.in/", host: "mpbhulekh.gov.in", note: "Madhya Pradesh official land-record and map portal." },
  { id: "rajasthan-apna-khata", state: "Rajasthan", title: "Apna Khata", url: "https://apnakhata.rajasthan.gov.in/", host: "apnakhata.rajasthan.gov.in", note: "Rajasthan Government Apna Khata land-record portal." },
  { id: "dolr", state: "India", title: "Department of Land Resources", url: "https://dolr.gov.in/en/", host: "dolr.gov.in", note: "National Department of Land Resources reference portal." },
] as const;

export function isAllowedOfficialPortalUrl(url: string) {
  if (url === "about:blank") return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return OFFICIAL_LAND_PORTALS.some((portal) => hostname === portal.host || hostname.endsWith(`.${portal.host}`));
  } catch { return false; }
}
