import type { VideoContentFit } from "expo-video";

import { extractCloudflareStreamId, probeHlsVideoSize } from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import { getVideoSourceCacheKey } from "@/lib/profile-video-prewarm";
import { getGridVideoSource } from "@/lib/video-display";

export function contentFitForVideoSize(
  width?: number | null,
  height?: number | null,
  fallback: VideoContentFit = "cover",
): VideoContentFit {
  // Non-portrait (landscape or square): letterbox like TikTok. Portrait keeps cover.
  if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0 && width >= height) {
    return "contain";
  }
  return fallback;
}

export function imageResizeModeForVideoSize(
  width?: number | null,
  height?: number | null,
): "contain" | "cover" {
  return contentFitForVideoSize(width, height) === "contain" ? "contain" : "cover";
}

/** Aspect hints learned from grid thumbs / HLS so fullscreen opens letterboxed instantly. */
const videoAspectSizeByKey = new Map<string, { width: number; height: number }>();

export function rememberVideoAspectSize(
  key: string | null | undefined,
  width?: number | null,
  height?: number | null,
) {
  if (!key) return;
  if (!(typeof width === "number" && typeof height === "number" && width > 0 && height > 0)) {
    return;
  }
  videoAspectSizeByKey.set(key, { width, height });
}

export function getRememberedVideoAspectSize(key: string | null | undefined) {
  if (!key) return null;
  return videoAspectSizeByKey.get(key) ?? null;
}

export function getVideoAspectCacheKeyFromSource(source: string | null | undefined) {
  return getVideoSourceCacheKey(source);
}

export function getVideoAspectCacheKeyFromVideo(video: {
  id?: string;
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
}) {
  const streamId =
    video.cloudflareStreamId ||
    video.cloudflare_stream_id ||
    extractCloudflareStreamId(video.mediaUrl) ||
    extractCloudflareStreamId(video.media_url);
  return streamId || video.id || null;
}

/** Populate aspect cache from the HLS master playlist (authoritative track size). */
export async function ensureVideoAspectCached(video: {
  id?: string;
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
}) {
  const key = getVideoAspectCacheKeyFromVideo(video);
  const existing = getRememberedVideoAspectSize(key);
  if (existing) return existing;
  const source = getGridVideoSource(video as ProfileVideo | FeedVideo);
  if (!source?.includes(".m3u8")) return null;
  const size = await probeHlsVideoSize(source);
  if (!size) return null;
  rememberVideoAspectSize(key, size.width, size.height);
  rememberVideoAspectSize(getVideoAspectCacheKeyFromSource(source), size.width, size.height);
  return size;
}
