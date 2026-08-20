import AsyncStorage from "@react-native-async-storage/async-storage";

const EARTH_RADIUS_METERS = 6_378_137;
const SQ_METERS_TO_SQ_FEET = 10.7639104167;
const SQ_METERS_PER_ACRE = 4_046.8564224;
const SAVED_PLOTS_KEY = "amin-toolkit.saved-plots.v1";
const PREFERRED_STATE_KEY = "amin-toolkit.preferred-state.v1";
const RECENT_CONVERSIONS_KEY = "amin-toolkit.recent-conversions.v1";

export type GeoPoint = { latitude: number; longitude: number; accuracy?: number | null };
export type SavedPlot = { id: string; name: string; points: GeoPoint[]; createdAt: string };
export type LandUnit = "acre" | "hectare" | "square_feet" | "square_meters" | "bigha" | "katha" | "dhur";
export type RecentConversion = { id: string; stateCode: string; systemId: string; districtOrTehsil: string; amount: number; from: LandUnit; to: LandUnit; createdAt: string };

export const LAND_UNIT_LABELS: Record<LandUnit, string> = {
  acre: "Acre", hectare: "Hectare", square_feet: "Square feet", square_meters: "Square meter", bigha: "Bigha", katha: "Katha", dhur: "Dhur",
};

export type IndiaState = { code: string; name: string; kind: "state" | "union_territory" };
export type UnitSystem = { id: string; stateCode: string; state: string; title: string; geography: string; note: string; squareMeters: Partial<Record<LandUnit, number>>; verification: "standard" | "district_confirmation_required" };

/** Every State/UT is selectable. Standard measurement remains valid in every selection;
 * traditional units are deliberately unavailable until an explicit local profile is chosen. */
export const INDIA_STATES: IndiaState[] = [
  { code: "AN", name: "Andaman and Nicobar Islands", kind: "union_territory" }, { code: "AP", name: "Andhra Pradesh", kind: "state" }, { code: "AR", name: "Arunachal Pradesh", kind: "state" }, { code: "AS", name: "Assam", kind: "state" }, { code: "BR", name: "Bihar", kind: "state" }, { code: "CH", name: "Chandigarh", kind: "union_territory" }, { code: "CT", name: "Chhattisgarh", kind: "state" }, { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", kind: "union_territory" }, { code: "DL", name: "Delhi", kind: "union_territory" }, { code: "GA", name: "Goa", kind: "state" }, { code: "GJ", name: "Gujarat", kind: "state" }, { code: "HR", name: "Haryana", kind: "state" }, { code: "HP", name: "Himachal Pradesh", kind: "state" }, { code: "JK", name: "Jammu and Kashmir", kind: "union_territory" }, { code: "JH", name: "Jharkhand", kind: "state" }, { code: "KA", name: "Karnataka", kind: "state" }, { code: "KL", name: "Kerala", kind: "state" }, { code: "LA", name: "Ladakh", kind: "union_territory" }, { code: "LD", name: "Lakshadweep", kind: "union_territory" }, { code: "MP", name: "Madhya Pradesh", kind: "state" }, { code: "MH", name: "Maharashtra", kind: "state" }, { code: "MN", name: "Manipur", kind: "state" }, { code: "ML", name: "Meghalaya", kind: "state" }, { code: "MZ", name: "Mizoram", kind: "state" }, { code: "NL", name: "Nagaland", kind: "state" }, { code: "OD", name: "Odisha", kind: "state" }, { code: "PY", name: "Puducherry", kind: "union_territory" }, { code: "PB", name: "Punjab", kind: "state" }, { code: "RJ", name: "Rajasthan", kind: "state" }, { code: "SK", name: "Sikkim", kind: "state" }, { code: "TN", name: "Tamil Nadu", kind: "state" }, { code: "TS", name: "Telangana", kind: "state" }, { code: "TR", name: "Tripura", kind: "state" }, { code: "UP", name: "Uttar Pradesh", kind: "state" }, { code: "UK", name: "Uttarakhand", kind: "state" }, { code: "WB", name: "West Bengal", kind: "state" },
];

const LOCAL_REFERENCE_SYSTEMS: UnitSystem[] = [
  { id: "BR-bihar-common", stateCode: "BR", state: "Bihar", title: "Common Bihar Bigha/Katha/Dhur reference", geography: "Use only where the local revenue record confirms this convention", note: "1 Bigha = 20 Katha = 400 Dhur. This is a selectable local reference, not a Bihar-wide legal default.", squareMeters: { bigha: 2_529.285264, katha: 126.4642632, dhur: 6.32321316 }, verification: "district_confirmation_required" },
  { id: "UP-pucca-bigha", stateCode: "UP", state: "Uttar Pradesh", title: "Pucca Bigha reference", geography: "Use only in a district/tehsil that confirms the Pucca Bigha convention", note: "Traditional UP Bigha practice can vary within the state. Katha and Dhur are intentionally unavailable in this profile.", squareMeters: { bigha: 2_529.285264 }, verification: "district_confirmation_required" },
  { id: "MP-pucca-bigha", stateCode: "MP", state: "Madhya Pradesh", title: "Pucca Bigha reference", geography: "Use only in a district/tehsil that confirms the Pucca Bigha convention", note: "MP Bigha usage is locally variable. Katha and Dhur are intentionally unavailable in this profile.", squareMeters: { bigha: 2_529.285264 }, verification: "district_confirmation_required" },
  { id: "RJ-pucca-bigha", stateCode: "RJ", state: "Rajasthan", title: "Pucca Bigha reference", geography: "Use only in a district/tehsil that confirms the Pucca Bigha convention", note: "Rajasthan Bigha/Biswa practice is locally variable. Katha and Dhur are intentionally unavailable in this profile.", squareMeters: { bigha: 2_529.285264 }, verification: "district_confirmation_required" },
];

const STANDARD_SYSTEMS: UnitSystem[] = INDIA_STATES.map((state) => ({ id: `${state.code}-standard`, stateCode: state.code, state: state.name, title: "Standard units only", geography: `${state.name} · all districts`, note: "Acre, hectare, square feet, and square metres are available. A verified local district profile is not yet catalogued for this selection.", squareMeters: {}, verification: "standard" }));

/** Local systems must be actively selected; selecting a state always starts with its safe standard-unit profile. */
export const LAND_UNIT_SYSTEMS: UnitSystem[] = [...STANDARD_SYSTEMS, ...LOCAL_REFERENCE_SYSTEMS];

export function systemsForIndiaState(stateCode: string) {
  return LAND_UNIT_SYSTEMS.filter((system) => system.stateCode === stateCode);
}

export function standardSystemForIndiaState(stateCode: string) {
  return LAND_UNIT_SYSTEMS.find((system) => system.id === `${stateCode}-standard`) ?? LAND_UNIT_SYSTEMS.find((system) => system.id === "BR-standard")!;
}

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

/** State preference and conversion history stay device-local, contain no land parcel data,
 * and let Students reuse a carefully selected context without creating a backend profile. */
export async function loadPreferredIndiaState() {
  try { const value = await AsyncStorage.getItem(PREFERRED_STATE_KEY); return INDIA_STATES.some((state) => state.code === value) ? value : null; } catch { return null; }
}

export async function persistPreferredIndiaState(stateCode: string) {
  if (!INDIA_STATES.some((state) => state.code === stateCode)) return;
  await AsyncStorage.setItem(PREFERRED_STATE_KEY, stateCode);
}

export async function loadRecentConversions(): Promise<RecentConversion[]> {
  try {
    const value = await AsyncStorage.getItem(RECENT_CONVERSIONS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is RecentConversion => Boolean(entry && typeof entry.id === "string" && typeof entry.stateCode === "string" && typeof entry.systemId === "string" && typeof entry.amount === "number" && typeof entry.from === "string" && typeof entry.to === "string")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12) : [];
  } catch { return []; }
}

export async function persistRecentConversion(input: Omit<RecentConversion, "id" | "createdAt">) {
  if (!Number.isFinite(input.amount) || input.amount < 0 || !LAND_UNIT_SYSTEMS.some((system) => system.id === input.systemId)) return await loadRecentConversions();
  const entry: RecentConversion = { ...input, districtOrTehsil: input.districtOrTehsil.trim().slice(0, 80), id: `conversion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  const next = [entry, ...(await loadRecentConversions())].slice(0, 12);
  await AsyncStorage.setItem(RECENT_CONVERSIONS_KEY, JSON.stringify(next));
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
  { id: "bihar-revenue-department", state: "Bihar", title: "Bihar Revenue & Land Reforms Department", url: "https://land.bihar.gov.in/landbihar/Default.aspx", host: "land.bihar.gov.in", note: "Government of Bihar Revenue and Land Reforms Department and survey/record reference directory." },
  { id: "up-bhulekh", state: "Uttar Pradesh", title: "UP Bhulekh", url: "https://upbhulekh.gov.in/", host: "upbhulekh.gov.in", note: "Uttar Pradesh official Bhulekh land-record portal." },
  { id: "mp-bhulekh", state: "Madhya Pradesh", title: "MP Bhulekh", url: "https://mpbhulekh.gov.in/", host: "mpbhulekh.gov.in", note: "Madhya Pradesh official land-record and map portal." },
  { id: "mp-revenue-circulars", state: "Madhya Pradesh", title: "MP Revenue Orders & Circulars", url: "https://revenue.mp.gov.in/circular/", host: "revenue.mp.gov.in", note: "Madhya Pradesh Revenue Department official orders and circulars directory." },
  { id: "rajasthan-apna-khata", state: "Rajasthan", title: "Apna Khata", url: "https://apnakhata.rajasthan.gov.in/", host: "apnakhata.rajasthan.gov.in", note: "Rajasthan Government Apna Khata land-record portal." },
  { id: "rajasthan-land-revenue-circulars", state: "Rajasthan", title: "Rajasthan Land Revenue Circulars", url: "https://landrevenue.rajasthan.gov.in/content/landrevenuenew/en/board-of-revenue-for-raj-dep/documents/circulars/LRcircular.html", host: "landrevenue.rajasthan.gov.in", note: "Rajasthan Board of Revenue circular directory." },
  { id: "dolr", state: "India", title: "Department of Land Resources", url: "https://dolr.gov.in/en/", host: "dolr.gov.in", note: "National Department of Land Resources reference portal." },
] as const;

/** Official entry points are references only. A district/tehsil record must still confirm any local-unit convention. */
export function officialReferencesForState(stateCode: string) {
  const state = INDIA_STATES.find((entry) => entry.code === stateCode)?.name;
  const stateReferences = OFFICIAL_LAND_PORTALS.filter((portal) => portal.state === state);
  return stateReferences.length ? stateReferences : OFFICIAL_LAND_PORTALS.filter((portal) => portal.id === "dolr");
}

export type ReviewedLandReferenceCard = { id: string; portalId: typeof OFFICIAL_LAND_PORTALS[number]["id"]; title: string; issuer: string; coverage: string; kind: "official records" | "revenue department reference" | "circular directory"; note: string };

/** Only source-reviewed state coverage is presented. The UI deliberately does not fabricate a district-specific circular where one was not reviewed. */
export const REVIEWED_LAND_REFERENCE_CARDS: Record<string, ReviewedLandReferenceCard[]> = {
  BR: [
    { id: "BR-department", portalId: "bihar-revenue-department", title: "Bihar Revenue & Land Reforms Department", issuer: "Government of Bihar", coverage: "Bihar · statewide department and survey directory", kind: "revenue department reference", note: "Use the department and survey directory to locate the appropriate record or survey reference for the district/tehsil." },
    { id: "BR-revenue", portalId: "bihar-bhumi", title: "Bihar official land-record reference", issuer: "Government of Bihar", coverage: "Bihar · verify district/tehsil practice", kind: "official records", note: "Use the official record portal to confirm terminology used in the local revenue record." },
  ],
  UP: [{ id: "UP-bhulekh", portalId: "up-bhulekh", title: "UP Bhulekh official record reference", issuer: "Government of Uttar Pradesh", coverage: "Uttar Pradesh · verify district/tehsil practice", kind: "official records", note: "Use the official record portal to confirm local terminology before applying a traditional-unit profile." }],
  MP: [
    { id: "MP-circulars", portalId: "mp-revenue-circulars", title: "MP Revenue Department orders & circulars", issuer: "Government of Madhya Pradesh", coverage: "Madhya Pradesh · statewide directory; verify district applicability", kind: "circular directory", note: "Search the official order/circular directory and confirm that the selected item applies to the district/tehsil before using a local profile." },
    { id: "MP-bhulekh", portalId: "mp-bhulekh", title: "MP Bhulekh official record reference", issuer: "Government of Madhya Pradesh", coverage: "Madhya Pradesh · verify district/tehsil practice", kind: "official records", note: "Use the official record and map portal to confirm the local revenue convention." },
  ],
  RJ: [
    { id: "RJ-circulars", portalId: "rajasthan-land-revenue-circulars", title: "Rajasthan Board of Revenue circular directory", issuer: "Rajasthan Land Revenue Department", coverage: "Rajasthan · statewide directory; verify district applicability", kind: "circular directory", note: "A statewide official circular directory. Check the relevant district/tehsil context before relying on a local unit." },
    { id: "RJ-apna-khata", portalId: "rajasthan-apna-khata", title: "Apna Khata official record reference", issuer: "Government of Rajasthan", coverage: "Rajasthan · verify district/tehsil practice", kind: "official records", note: "Use official record terminology alongside the selected local profile." },
  ],
};

export function reviewedLandReferenceCardsForState(stateCode: string) {
  return REVIEWED_LAND_REFERENCE_CARDS[stateCode] ?? [];
}

export function isAllowedOfficialPortalUrl(url: string) {
  if (url === "about:blank") return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return OFFICIAL_LAND_PORTALS.some((portal) => hostname === portal.host || hostname.endsWith(`.${portal.host}`));
  } catch { return false; }
}
