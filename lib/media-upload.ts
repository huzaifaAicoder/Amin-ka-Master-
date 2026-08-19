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

export type UploadProgress = { loaded: number; total: number; percent: number };
export type UploadLearningMediaOptions = {
  purpose?: "student_short";
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;

export async function uploadLearningMedia(asset: PickedLearningMedia, options?: UploadLearningMediaOptions): Promise<UploadedLearningMedia> {
  if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
    throw new Error("Choose a file smaller than 150 MB for a reliable mobile-data upload.");
  }
  const mimeType = asset.mimeType || (asset.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "video/mp4");
  if (!(mimeType === "application/pdf" || mimeType.startsWith("video/"))) {
    throw new Error("Only PDF notes and video files can be uploaded.");
  }
  if (options?.purpose === "student_short" && !mimeType.startsWith("video/")) {
    throw new Error("Choose a video file for your Short submission.");
  }
  const token = await Auth.getSessionToken();
  if (!token) throw new Error("Your session has expired. Sign in again before uploading media.");
  const form = new FormData();
  if (asset.file) {
    form.append("file", asset.file, asset.name);
  } else {
    form.append("file", { uri: asset.uri, name: asset.name, type: mimeType } as unknown as Blob);
  }
  form.append("mimeType", mimeType);
  if (options?.purpose) form.append("purpose", options.purpose);
  return new Promise<UploadedLearningMedia>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => options?.signal?.removeEventListener("abort", abort);
    if (options?.signal?.aborted) {
      reject(new Error("Upload canceled."));
      return;
    }
    options?.signal?.addEventListener("abort", abort, { once: true });
    request.open("POST", `${getApiBaseUrl()}/api/media-upload`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      const total = event.total || asset.size || 0;
      if (!total) return;
      options?.onProgress?.({ loaded: event.loaded, total, percent: Math.min(100, Math.round((event.loaded / total) * 100)) });
    };
    request.onerror = () => {
      cleanup();
      reject(new Error("The upload did not complete. Check your connection and try again."));
    };
    request.onabort = () => {
      cleanup();
      reject(new Error("Upload canceled."));
    };
    request.onload = () => {
      cleanup();
      let payload: (UploadedLearningMedia & { error?: string }) | null = null;
      try { payload = JSON.parse(request.responseText) as UploadedLearningMedia & { error?: string }; } catch { payload = null; }
      if (request.status < 200 || request.status >= 300 || !payload?.url || !payload.key) {
        reject(new Error(payload?.error || "The upload did not complete. Check your connection and try again."));
        return;
      }
      options?.onProgress?.({ loaded: payload.sizeBytes, total: payload.sizeBytes, percent: 100 });
      resolve({ key: payload.key, url: payload.url, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes, provider: payload.provider });
    };
    request.send(form);
  });
}
