import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/native-supabase";

const AVATAR_BUCKET = "avatars";
const AVATAR_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

export type NativeAvatarAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function uploadNativeProfileAvatar(userId: string, asset: NativeAvatarAsset) {
  const mimeType = asset.mimeType ?? inferMimeType(asset.fileName, asset.uri);
  if (!mimeType.startsWith("image/")) {
    throw new Error("Choose an image file for your avatar.");
  }

  const extension = getImageExtension(mimeType, asset.fileName ?? asset.uri);
  const objectPath = `${userId}/avatar.${extension}`;
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, decode(base64), {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;

  await removePreviousAvatars(userId, objectPath);

  return getPublicAvatarUrl(objectPath);
}

function getPublicAvatarUrl(objectPath: string) {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function removePreviousAvatars(userId: string, keepPath: string) {
  const stalePaths = AVATAR_EXTENSIONS
    .map((extension) => `${userId}/avatar.${extension}`)
    .filter((path) => path !== keepPath);

  if (stalePaths.length === 0) return;

  await supabase.storage.from(AVATAR_BUCKET).remove(stalePaths);
}

function inferMimeType(fileName: string | null | undefined, uri: string) {
  const extension = (fileName ?? uri).split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return "image/jpeg";
}

function getImageExtension(mimeType: string, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension && AVATAR_EXTENSIONS.includes(extension)) return extension;
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}
