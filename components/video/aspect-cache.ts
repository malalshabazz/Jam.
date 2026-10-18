import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VideoContentFit } from "expo-video";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { Image } from "react-native";

import {
  extractCloudflareStreamId,
  getCloudflareDisplayAspectThumbnailUrl,
  getCloudflarePlaybackUrl,
  probeHlsVideoSize,
} from "@/lib/native-cloudflare";
import { getVideoSourceCacheKey } from "@/lib/profile-video-prewarm";

const ASPECT_CACHE_STORAGE_KEY = "jam.videoAspectSizes.v1";
const ASPECT_CACHE_MAX_ENTRIES = 400;

/** True 9:16 portrait ratio. */
export const NINE_SIXTEEN = 9 / 16;
const NINE_SIXTEEN_RATIO_SLACK = 0.04;
/** Inclusive upper bound: 9/16 + 0.04 = 0.6025 */
const NINE_SIXTEEN_RATIO_UPPER = NINE_SIXTEEN + NINE_SIXTEEN_RATIO_SLACK;
/** Inclusive lower bound — taller than this letterboxes instead of cover-cropping. */
const NINE_SIXTEEN_RATIO_LOWER = 0.5;

/**
 * Near-9:16 portrait suitable for cover-fill. Wider than ~0.6025 or taller than
 * 0.50 (width/height) gets letterbox bars via contain.
 */
export function isNearNineSixteenPortrait(
  width?: number | null,
  height?: number | null,
): boolean {
  if (!(typeof width === "number" && typeof height === "number" && width > 0 && height > 0)) {
    return false;
  }
  const ratio = width / height;
  return ratio >= NINE_SIXTEEN_RATIO_LOWER && ratio <= NINE_SIXTEEN_RATIO_UPPER;
}

export function parsePositiveDisplaySize(
  width?: number | null,
  height?: number | null,
): { width: number; height: number } | null {
  if (
    !(
      typeof width === "number" &&
      typeof height === "number" &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    )
  ) {
    return null;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/** Shared cover/contain for videos and photos. Unknown size → fallback (contain). */
export function mediaFitForSize(
  width?: number | null,
  height?: number | null,
  fallback: "cover" | "contain" = "contain",
): "cover" | "contain" {
  if (!parsePositiveDisplaySize(width, height)) return fallback;
  return isNearNineSixteenPortrait(width, height) ? "cover" : "contain";
}

export function isPortraitFillVideoSize(
  width?: number | null,
  height?: number | null,
): boolean {
  return isNearNineSixteenPortrait(width, height);
}

export function contentFitForVideoSize(
  width?: number | null,
  height?: number | null,
  fallback: VideoContentFit = "contain",
): VideoContentFit {
  if (!parsePositiveDisplaySize(width, height)) {
    // Unknown size: letterbox rather than cover-crop (landscape would otherwise zoom).
    return fallback;
  }
  return mediaFitForSize(
    width,
    height,
    fallback === "cover" ? "cover" : "contain",
  );
}

/**
 * TikTok-style 9:16 canvas inside a viewport: full width, height = width×16/9,
 * centred vertically. When taller than the viewport it extends equally past
 * the top and bottom (cover crop).
 */
export function getNineSixteenCanvasRect(viewportW: number, viewportH: number) {
  const width = Math.max(0, viewportW);
  const height = width * (16 / 9);
  const top = (viewportH - height) / 2;
  const left = 0;
  return { x: left, y: top, left, top, width, height };
}

/** Center a landscape (or other non-9:16) frame in a portrait container. */
export function letterboxVideoFrameStyle(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): { position: "absolute"; width: number; height: number; left: number; top: number } | null {
  if (
    !(
      containerWidth > 0 &&
      containerHeight > 0 &&
      videoWidth > 0 &&
      videoHeight > 0 &&
      contentFitForVideoSize(videoWidth, videoHeight) === "contain"
    )
  ) {
    return null;
  }
  const videoRatio = videoWidth / videoHeight;
  const containerRatio = containerWidth / containerHeight;
  if (videoRatio >= containerRatio) {
    const height = containerWidth / videoRatio;
    return {
      position: "absolute",
      width: containerWidth,
      height,
      left: 0,
      top: (containerHeight - height) / 2,
    };
  }
  const width = containerHeight * videoRatio;
  return {
    position: "absolute",
    width,
    height: containerHeight,
    left: (containerWidth - width) / 2,
    top: 0,
  };
}

function isLikelyDefaultThumbCanvas(width: number, height: number) {
  // Stream still defaults the missing edge to 640 and returns a square/tall crop.
  const min = Math.min(width, height);
  const max = Math.max(width, height);
  if (Math.abs(width - height) <= 2 && (min === 640 || min === 720)) return true;
  if ((width === 640 && height === 720) || (width === 720 && height === 640)) return true;
  if (min === 640 && max === 640) return true;
  return false;
}

function probeImageDisplaySize(uri: string, timeoutMs = 8000) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    let settled = false;
    const finish = (size: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(size);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    Image.getSize(
      uri,
      (width, height) => {
        clearTimeout(timer);
        finish(width > 0 && height > 0 ? { width, height } : null);
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
    );
  });
}

/**
 * Display-oriented size (rotation / pixel-aspect applied). Coded HLS and
 * ImagePicker dimensions for iOS screen recordings are often still portrait.
 */
export async function probeVideoDisplaySize(
  source: string | null | undefined,
): Promise<{ width: number; height: number } | null> {
  if (!source) return null;
  const streamId = extractCloudflareStreamId(source);
  if (streamId) {
    const fromThumb = await probeImageDisplaySize(getCloudflareDisplayAspectThumbnailUrl(streamId));
    if (fromThumb && !isLikelyDefaultThumbCanvas(fromThumb.width, fromThumb.height)) {
      return fromThumb;
    }
  }
  if (
    source.startsWith("file:") ||
    source.startsWith("ph://") ||
    source.startsWith("content:") ||
    source.startsWith("assets-library:")
  ) {
    try {
      const thumb = await getThumbnailAsync(source, { time: 0, quality: 0.2 });
      if (thumb.width > 0 && thumb.height > 0) {
        return { width: thumb.width, height: thumb.height };
      }
    } catch {
      /* local probe unavailable */
    }
  }
  if (source.includes(".m3u8")) {
    return probeHlsVideoSize(source);
  }
  return null;
}

export function imageResizeModeForVideoSize(
  width?: number | null,
  height?: number | null,
): "contain" | "cover" {
  return mediaFitForSize(width, height);
}

/** Aspect hints learned from DB size / grid thumbs / HLS so the first frame is already correct. */
const videoAspectSizeByKey = new Map<string, { width: number; height: number }>();
let aspectCacheHydrated = false;
let aspectCacheHydratePromise: Promise<void> | null = null;
let aspectCachePersistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAspectCachePersist() {
  if (aspectCachePersistTimer) return;
  aspectCachePersistTimer = setTimeout(() => {
    aspectCachePersistTimer = null;
    const entries = Array.from(videoAspectSizeByKey.entries());
    const trimmed =
      entries.length > ASPECT_CACHE_MAX_ENTRIES
        ? entries.slice(entries.length - ASPECT_CACHE_MAX_ENTRIES)
        : entries;
    void AsyncStorage.setItem(ASPECT_CACHE_STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed))).catch(
      () => undefined,
    );
  }, 400);
}

/** Load persisted sizes before the Discover feed's first render. */
export function hydrateVideoAspectCache() {
  if (aspectCacheHydrated) return Promise.resolve();
  if (aspectCacheHydratePromise) return aspectCacheHydratePromise;
  aspectCacheHydratePromise = AsyncStorage.getItem(ASPECT_CACHE_STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, { width?: unknown; height?: unknown }>;
      for (const [key, value] of Object.entries(parsed)) {
        if (videoAspectSizeByKey.has(key)) continue;
        const size = parsePositiveDisplaySize(
          typeof value?.width === "number" ? value.width : null,
          typeof value?.height === "number" ? value.height : null,
        );
        if (!size) continue;
        videoAspectSizeByKey.set(key, size);
      }
    })
    .catch(() => undefined)
    .finally(() => {
      aspectCacheHydrated = true;
    });
  return aspectCacheHydratePromise;
}

export function rememberVideoAspectSize(
  key: string | null | undefined,
  width?: number | null,
  height?: number | null,
) {
  if (!key) return;
  const size = parsePositiveDisplaySize(width, height);
  if (!size) return;
  const current = videoAspectSizeByKey.get(key);
  if (current?.width === size.width && current?.height === size.height) return;
  videoAspectSizeByKey.set(key, size);
  scheduleAspectCachePersist();
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

export type VideoDisplaySizeFields = {
  id?: string;
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  displayWidth?: number | null;
  display_width?: number | null;
  displayHeight?: number | null;
  display_height?: number | null;
};

export function getStoredVideoDisplaySize(video: VideoDisplaySizeFields) {
  return parsePositiveDisplaySize(
    video.displayWidth ?? video.display_width,
    video.displayHeight ?? video.display_height,
  );
}

/** DB size first, then the in-memory / disk aspect cache. */
export function getVideoDisplaySize(video: VideoDisplaySizeFields) {
  return getStoredVideoDisplaySize(video) ?? getRememberedVideoAspectSize(getVideoAspectCacheKeyFromVideo(video));
}

export function seedRememberedDisplaySize(video: VideoDisplaySizeFields) {
  const size = getStoredVideoDisplaySize(video);
  if (!size) return null;
  const key = getVideoAspectCacheKeyFromVideo(video);
  rememberVideoAspectSize(key, size.width, size.height);
  const streamId =
    video.cloudflareStreamId ||
    video.cloudflare_stream_id ||
    extractCloudflareStreamId(video.mediaUrl) ||
    extractCloudflareStreamId(video.media_url);
  const source = streamId
    ? getCloudflarePlaybackUrl(streamId)
    : video.mediaUrl ?? video.media_url ?? null;
  if (source) rememberVideoAspectSize(getVideoAspectCacheKeyFromSource(source), size.width, size.height);
  return size;
}

/** Populate aspect cache from the display frame (rotation applied), not coded HLS. */
export async function ensureVideoAspectCached(video: VideoDisplaySizeFields) {
  const seeded = seedRememberedDisplaySize(video);
  if (seeded) return seeded;
  const key = getVideoAspectCacheKeyFromVideo(video);
  const existing = getRememberedVideoAspectSize(key);
  if (existing) return existing;
  const streamId =
    video.cloudflareStreamId ||
    video.cloudflare_stream_id ||
    extractCloudflareStreamId(video.mediaUrl) ||
    extractCloudflareStreamId(video.media_url);
  const source = streamId
    ? getCloudflarePlaybackUrl(streamId)
    : video.mediaUrl ?? video.media_url ?? null;
  const display = await probeVideoDisplaySize(source);
  if (display) {
    rememberVideoAspectSize(key, display.width, display.height);
    if (source) rememberVideoAspectSize(getVideoAspectCacheKeyFromSource(source), display.width, display.height);
    return display;
  }
  if (!source?.includes(".m3u8")) return null;
  const size = await probeHlsVideoSize(source);
  if (!size) return null;
  rememberVideoAspectSize(key, size.width, size.height);
  rememberVideoAspectSize(getVideoAspectCacheKeyFromSource(source), size.width, size.height);
  return size;
}
