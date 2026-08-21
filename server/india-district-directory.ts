const DIRECTORY_TTL_MS = 6 * 60 * 60 * 1000;
const DISTRICT_PAGE_SIZE = 5;
const MAX_DIRECTORY_PAGES = 50;
const IGOD_STATE_CODES: Record<string, string> = { DN: "ND" };

type CachedDirectory = { expiresAt: number; districts: string[] };
const directoryCache = new Map<string, CachedDirectory>();
const pendingDirectories = new Map<string, Promise<string[]>>();

export const IGOD_DISTRICT_DIRECTORY_SOURCE = "https://igod.gov.in/sg/district/states";

export function parseIgodDistrictHtml(html: string) {
  const matches = html.matchAll(/<a\b[^>]*class="[^"]*\bsearch-title\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi);
  return Array.from(matches, (match) => match[1]
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim())
    .filter(Boolean);
}

function sourceStateCode(appStateCode: string) {
  return IGOD_STATE_CODES[appStateCode] ?? appStateCode;
}

async function requestDistrictPage(stateCode: string, start: number) {
  const path = start === 0
    ? `https://igod.gov.in/sg/${stateCode}/E042/organizations`
    : `https://igod.gov.in/sg/${stateCode}/E042/organizations_more/${start}/${DISTRICT_PAGE_SIZE}`;
  const response = await fetch(path, { headers: start === 0 ? undefined : { "X-Requested-With": "XMLHttpRequest" } });
  if (!response.ok) throw new Error(`The official district directory is temporarily unavailable (${response.status}).`);
  return parseIgodDistrictHtml(await response.text());
}

async function fetchDistrictDirectory(appStateCode: string) {
  const stateCode = sourceStateCode(appStateCode);
  const districts = new Set<string>();
  for (let page = 0; page < MAX_DIRECTORY_PAGES; page += 1) {
    const pageDistricts = await requestDistrictPage(stateCode, page * DISTRICT_PAGE_SIZE);
    if (!pageDistricts.length) break;
    pageDistricts.forEach((district) => districts.add(district));
    if (pageDistricts.length < DISTRICT_PAGE_SIZE) break;
  }
  return [...districts].sort((a, b) => a.localeCompare(b, "en-IN"));
}

/** Fetches the current State/UT-specific district directory from iGOD and keeps a short in-memory cache. */
export async function getOfficialDistrictDirectory(stateCode: string) {
  if (!/^[A-Z]{2}$/.test(stateCode)) throw new Error("Choose a valid State or Union Territory first.");
  const cached = directoryCache.get(stateCode);
  if (cached && cached.expiresAt > Date.now()) return cached.districts;
  const pending = pendingDirectories.get(stateCode);
  if (pending) return pending;
  const request = fetchDistrictDirectory(stateCode).then((districts) => {
    directoryCache.set(stateCode, { districts, expiresAt: Date.now() + DIRECTORY_TTL_MS });
    return districts;
  }).finally(() => pendingDirectories.delete(stateCode));
  pendingDirectories.set(stateCode, request);
  return request;
}
