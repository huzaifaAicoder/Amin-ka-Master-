export type GeoPoint = { latitude: number; longitude: number; accuracy?: number | null };

const EARTH_RADIUS_METERS = 6_378_137;
const SQ_METERS_TO_SQ_FEET = 10.7639104167;
const SQ_METERS_PER_ACRE = 4_046.8564224;

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
  { id: "dolr", state: "India", title: "Department of Land Resources", url: "https://dolr.gov.in/en/", host: "dolr.gov.in", note: "National Department of Land Resources reference portal." },
] as const;

export function isAllowedOfficialPortalUrl(url: string) {
  if (url === "about:blank") return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return OFFICIAL_LAND_PORTALS.some((portal) => hostname === portal.host || hostname.endsWith(`.${portal.host}`));
  } catch {
    return false;
  }
}
