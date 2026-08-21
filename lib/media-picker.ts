import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { PickedLearningMedia } from "@/lib/media-upload";

function fromDocument(asset: DocumentPicker.DocumentPickerAsset): PickedLearningMedia {
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, file: asset.file };
}

/** Opens the device Files chooser, including installed cloud providers such as Drive where available. */
export async function pickMediaFromFiles(kind: "video" | "pdf") {
  const result = await DocumentPicker.getDocumentAsync({ type: kind === "video" ? "video/*" : "application/pdf", copyToCacheDirectory: true, multiple: false });
  return result.canceled ? null : fromDocument(result.assets[0]);
}

/** Opens the device gallery for a video and normalizes its temporary URI for the existing authenticated uploader. */
export async function pickVideoFromGallery() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `gallery-video-${Date.now()}.mp4`,
    mimeType: asset.mimeType ?? "video/mp4",
    size: asset.fileSize,
    file: asset.file,
  } as PickedLearningMedia;
}
