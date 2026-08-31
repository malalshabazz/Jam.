import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/native-supabase";

const POST_MEDIA_BUCKET = "post-media";
const MAX_SLIDESHOW_IMAGES = 10;

export type SlideshowImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type SlideshowAudioAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  /** When audio is taken from a camera-roll video, keep the video mime. */
  fromVideo?: boolean;
};

export { MAX_SLIDESHOW_IMAGES };

export async function uploadSlideshowImages(
  userId: string,
  postId: string,
  images: SlideshowImageAsset[],
): Promise<string[]> {
  if (images.length === 0) {
    throw new Error("Add at least one photo.");
  }
  if (images.length > MAX_SLIDESHOW_IMAGES) {
    throw new Error(`You can add up to ${MAX_SLIDESHOW_IMAGES} photos.`);
  }

  const urls: string[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const mimeType = image.mimeType ?? inferImageMime(image.fileName, image.uri);
    if (!mimeType.startsWith("image/")) {
      throw new Error("Choose image files for your slideshow.");
    }
    const extension = getImageExtension(mimeType, image.fileName ?? image.uri);
    const objectPath = `${userId}/slideshows/${postId}/image-${String(index).padStart(2, "0")}.${extension}`;
    await uploadFile(objectPath, image.uri, mimeType);
    urls.push(getPublicUrl(objectPath));
  }
  return urls;
}

export async function uploadSlideshowAudio(
  userId: string,
  postId: string,
  audio: SlideshowAudioAsset,
): Promise<string> {
  const mimeType =
    audio.mimeType ??
    (audio.fromVideo ? inferVideoMime(audio.fileName, audio.uri) : inferAudioMime(audio.fileName, audio.uri));
  const extension = getAudioOrVideoExtension(mimeType, audio.fileName ?? audio.uri);
  const objectPath = `${userId}/slideshows/${postId}/audio.${extension}`;
  await uploadFile(objectPath, audio.uri, mimeType);
  return getPublicUrl(objectPath);
}

async function uploadFile(objectPath: string, uri: string, contentType: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).upload(objectPath, decode(base64), {
    contentType,
    upsert: true,
  });
  if (error) throw error;
}

function getPublicUrl(objectPath: string) {
  const { data } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

function inferImageMime(fileName: string | null | undefined, uri: string) {
  const extension = (fileName ?? uri).split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return "image/jpeg";
}

function inferAudioMime(fileName: string | null | undefined, uri: string) {
  const extension = (fileName ?? uri).split(".").pop()?.toLowerCase();
  if (extension === "m4a") return "audio/mp4";
  if (extension === "aac") return "audio/aac";
  if (extension === "wav") return "audio/wav";
  return "audio/mpeg";
}

function inferVideoMime(fileName: string | null | undefined, uri: string) {
  const extension = (fileName ?? uri).split(".").pop()?.toLowerCase();
  if (extension === "mov") return "video/quicktime";
  return "video/mp4";
}

function getImageExtension(mimeType: string, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "png" || mimeType === "image/png") return "png";
  if (extension === "webp" || mimeType === "image/webp") return "webp";
  if (extension === "heic" || mimeType === "image/heic") return "heic";
  if (extension === "heif" || mimeType === "image/heif") return "heif";
  return "jpg";
}

function getAudioOrVideoExtension(mimeType: string, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (mimeType.startsWith("video/")) {
    if (extension === "mov" || mimeType === "video/quicktime") return "mov";
    return "mp4";
  }
  if (extension === "m4a" || mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  if (extension === "aac" || mimeType === "audio/aac") return "aac";
  if (extension === "wav" || mimeType.includes("wav")) return "wav";
  return "mp3";
}
