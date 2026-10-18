import { Image } from "react-native";

import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";

export function getSlideshowImageUrls(video: ProfileVideo | FeedVideo): string[] {
  const raw =
    ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls) ||
    ("image_urls" in video && Array.isArray((video as { image_urls?: unknown }).image_urls) &&
      (video as { image_urls?: string[] }).image_urls) ||
    [];
  return raw.map((uri) => (typeof uri === "string" ? uri.trim() : "")).filter(Boolean).slice(0, 10);
}

export function isSlideshowPost(video: ProfileVideo | FeedVideo) {
  if ("mediaType" in video && video.mediaType === "slideshow") return true;
  if ("media_type" in video && (video as { media_type?: string }).media_type === "slideshow") {
    return true;
  }
  return getSlideshowImageUrls(video).length > 0;
}

/**
 * Decode slideshow photos into the image cache the way grid HLS players
 * pre-buffer video. First image first, then the rest so swipe-in is ready.
 */
export function prewarmSlideshowImages(urls: string[] | null | undefined) {
  const images = (urls ?? []).map((uri) => uri.trim()).filter(Boolean).slice(0, 10);
  const first = images[0];
  if (!first) return;
  void Image.prefetch(first).then(() => {
    for (const uri of images.slice(1)) {
      void Image.prefetch(uri);
    }
  });
}

const loadedSlideshowUris = new Set<string>();

export function markSlideshowImageLoaded(uri: string | null | undefined) {
  const trimmed = uri?.trim();
  if (trimmed) loadedSlideshowUris.add(trimmed);
}

export function isSlideshowImageLoaded(uri: string | null | undefined) {
  const trimmed = uri?.trim();
  return Boolean(trimmed && loadedSlideshowUris.has(trimmed));
}

export function prewarmSlideshowPost(video: ProfileVideo | FeedVideo) {
  prewarmSlideshowImages(getSlideshowImageUrls(video));
}
