import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const FAILED_DOWNLOADS_KEY = "amin-offline.failed-downloads.v1";

export type OfflineResourceKind = "pdf" | "video";
export type OfflineDownloadFailure = { resourceId: number; title: string; kind: OfflineResourceKind; message: string; occurredAt: string; source?: "course" | "reel" };
type AuthorizedResource = { signedUrl: string; resource: { resourceType: "pdf" | "video"; mimeType?: string | null } };

function safeFileBase(title: string) {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "course-resource";
}

function extensionFor(resource: AuthorizedResource["resource"]) {
  if (resource.resourceType !== "video") return "pdf";
  if (resource.mimeType?.includes("webm")) return "webm";
  if (resource.mimeType?.includes("quicktime")) return "mov";
  return "mp4";
}

/** The only code path that promotes a course resource into protected storage.
 * It downloads to a disposable pending file first, checks it, then moves it into
 * the private library; incomplete bytes can never appear as a completed item. */
export async function downloadAuthorizedOfflineResource(issued: AuthorizedResource, title: string, expectedKind: OfflineResourceKind) {
  if (Platform.OS === "web") throw new Error("Private offline resources are available in the Android or iOS app. Browser handoff is intentionally disabled.");
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error("Your device does not provide private app storage.");
  const kind = issued.resource.resourceType === "video" ? "video" : "pdf";
  if (kind !== expectedKind) throw new Error("The requested resource type changed. Refresh the course and try again.");
  const folder = `${documentDirectory}protected-resources/`;
  const basename = safeFileBase(title);
  const extension = extensionFor(issued.resource);
  const stamp = Date.now();
  const pendingUri = `${folder}.pending-${stamp}-${basename}.${extension}`;
  const targetUri = `${folder}${stamp}-${basename}.${extension}`;
  try {
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const result = await FileSystem.downloadAsync(issued.signedUrl, pendingUri);
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || !info.size) throw new Error("The file did not finish downloading. Please retry it from Downloads.");
    await FileSystem.moveAsync({ from: result.uri, to: targetUri });
    return { uri: targetUri, kind };
  } catch (error) {
    await FileSystem.deleteAsync(pendingUri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}

export async function loadOfflineDownloadFailures(): Promise<OfflineDownloadFailure[]> {
  try {
    const raw = await AsyncStorage.getItem(FAILED_DOWNLOADS_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item): item is OfflineDownloadFailure => Boolean(item && Number.isInteger(item.resourceId) && typeof item.title === "string" && (item.kind === "pdf" || item.kind === "video") && typeof item.message === "string" && typeof item.occurredAt === "string" && (item.source === undefined || item.source === "course" || item.source === "reel"))).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) : [];
  } catch { return []; }
}

export async function recordOfflineDownloadFailure(failure: Omit<OfflineDownloadFailure, "occurredAt">) {
  const existing = await loadOfflineDownloadFailures();
  const next = [{ ...failure, occurredAt: new Date().toISOString() }, ...existing.filter((item) => item.resourceId !== failure.resourceId)];
  await AsyncStorage.setItem(FAILED_DOWNLOADS_KEY, JSON.stringify(next));
  return next;
}

export async function clearOfflineDownloadFailure(resourceId: number) {
  const next = (await loadOfflineDownloadFailures()).filter((item) => item.resourceId !== resourceId);
  await AsyncStorage.setItem(FAILED_DOWNLOADS_KEY, JSON.stringify(next));
  return next;
}

export function matchesOfflineSearch(title: string, query: string) {
  return !query.trim() || title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
