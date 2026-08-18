import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";

export type UploadedLearningMedia = {
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  provider: string;
};

export type PickedLearningMedia = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  file?: File;
};

const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;

export async function uploadLearningMedia(asset: PickedLearningMedia): Promise<UploadedLearningMedia> {
  if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
    throw new Error("Choose a file smaller than 150 MB for a reliable mobile-data upload.");
  }
  const mimeType = asset.mimeType || (asset.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "video/mp4");
  if (!(mimeType === "application/pdf" || mimeType.startsWith("video/"))) {
    throw new Error("Only PDF notes and video files can be uploaded.");
  }
  const token = await Auth.getSessionToken();
  if (!token) throw new Error("Your staff session has expired. Sign in again before uploading media.");
  const body = asset.file ?? await (await fetch(asset.uri)).blob();
  const response = await fetch(`${getApiBaseUrl()}/api/media-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
      "X-File-Name": asset.name,
    },
    body,
  });
  const payload = await response.json().catch(() => null) as (UploadedLearningMedia & { error?: string }) | null;
  if (!response.ok || !payload?.url || !payload.key) {
    throw new Error(payload?.error || "The upload did not complete. Check your connection and try again.");
  }
  return { key: payload.key, url: payload.url, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes, provider: payload.provider };
}
