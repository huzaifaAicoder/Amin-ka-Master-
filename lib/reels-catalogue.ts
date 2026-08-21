export const REELS_SUBJECTS = ["All", "Surveying", "Land Records", "Amin Exam", "Mathematics", "General"] as const;
export type ReelsSubject = (typeof REELS_SUBJECTS)[number];

const SUBJECT_KEYWORDS: Array<[Exclude<ReelsSubject, "All" | "General">, string[]]> = [
  ["Surveying", ["survey", "gps", "compass", "plot", "chain", "theodolite", "level"]],
  ["Land Records", ["land", "khata", "khasra", "bhulekh", "revenue", "record", "bihar", "up ", "rajasthan", "madhya"]],
  ["Amin Exam", ["amin", "exam", "mcq", "patwari", "lekhpal", "mock"]],
  ["Mathematics", ["math", "area", "unit", "acre", "hectare", "fraction", "percentage"]],
];

export function inferReelsSubject(title: string, description?: string | null): Exclude<ReelsSubject, "All"> {
  const haystack = `${title} ${description ?? ""}`.toLowerCase();
  const found = SUBJECT_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)));
  return found?.[0] ?? "General";
}

export function formatOfflineSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
