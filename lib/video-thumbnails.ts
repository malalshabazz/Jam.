import { PixelRatio } from "react-native";
import {
  extractCloudflareStreamId,
  getCloudflareThumbnailUrl,
} from "@/lib/native-cloudflare";
import { CREATE_THUMBNAIL_FRAME_COUNT, viewportWidth } from "@/theme/tokens";
import type {
  FeedVideo,
  MessageVideoAttachment,
  ProfileVideo,
} from "@/lib/native-social-data";
import { getLocalPosterForVideo } from "@/lib/pending-video-uploads";
import { getSlideshowGridThumbUrl, getSlideshowPreviewUrl } from "@/lib/native-slideshow-storage";
import { getVideoStreamId } from "@/lib/video-display";

export const GRID_VIDEO_THUMB_SIZE = { width: 360, height: 640, fit: "fill" as const };
export const GRID_VIDEO_PREVIEW_SIZE = { width: 40, height: 72, fit: "crop" as const };

export function getGridVideoThumbnailUrl(streamId: string, thumbnailTimeMs?: number | null) {
  return getCloudflareThumbnailUrl(streamId, thumbnailTimeMs, GRID_VIDEO_THUMB_SIZE);
}

export function getGridVideoPreviewUrl(streamId: string, thumbnailTimeMs?: number | null) {
  return getCloudflareThumbnailUrl(streamId, thumbnailTimeMs, GRID_VIDEO_PREVIEW_SIZE);
}

/** Force Cloudflare / Supabase to generate and edge-cache the exact grid stills. */
export async function warmGridThumbnailUrls(urls: Array<string | null | undefined>) {
  await Promise.all(
    urls.map(async (url) => {
      const trimmed = url?.trim();
      if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
      try {
        const response = await fetch(trimmed);
        if (response.ok) await response.arrayBuffer();
      } catch {
        /* best-effort — local poster still covers first paint */
      }
    }),
  );
}

export function isLocalImageUri(uri: string | null | undefined) {
  if (!uri) return false;
  if (uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("ph://") || uri.startsWith("assets-library:")) {
    return true;
  }
  return /\.(jpe?g|png|webp|heic|gif)(\?|$)/i.test(uri);
}

export function getVideoThumbnailTimeMs(video: ProfileVideo | FeedVideo | MessageVideoAttachment) {
  if ("thumbnailTimeMs" in video && video.thumbnailTimeMs != null) return video.thumbnailTimeMs;
  if ("thumbnail_time_ms" in video && video.thumbnail_time_ms != null) return video.thumbnail_time_ms;
  return 1000;
}

export function getCloudflareThumbnailFilmstripFrames(
  streamId: string,
  durationMs: number,
  frameCount = CREATE_THUMBNAIL_FRAME_COUNT,
): Array<{ timeMs: number; uri: string }> {
  const safeDuration = Math.max(durationMs, 1000);
  const frameDenominator = Math.max(frameCount - 1, 1);
  return Array.from({ length: frameCount }, (_, index) => {
    const ratio = 0.05 + (index / frameDenominator) * 0.9;
    const timeMs = Math.round(ratio * safeDuration);
    return {
      timeMs,
      uri: getCloudflareThumbnailUrl(streamId, timeMs, { height: 180, width: 102, fit: "fill" }),
    };
  });
}

/** Prefer local posters / never feed HLS URLs into Image (that renders blank). */
export function getGridThumbnailCandidates(video: ProfileVideo | FeedVideo) {
  const candidates: string[] = [];
  const localPoster = getLocalPosterForVideo(video.id);
  if (localPoster) candidates.push(localPoster);

  const slideshowImages =
    ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls) ||
    ("image_urls" in video && Array.isArray(video.image_urls) && video.image_urls) ||
    [];
  const isSlideshow =
    ("mediaType" in video && video.mediaType === "slideshow") ||
    ("media_type" in video && video.media_type === "slideshow") ||
    slideshowImages.length > 0;
  if (isSlideshow) {
    const first = slideshowImages.find((uri) => typeof uri === "string" && uri.trim());
    if (first) {
      const thumb = getSlideshowGridThumbUrl(first);
      if (!candidates.includes(thumb)) candidates.push(thumb);
    }
  }

  const mediaUri =
    ("mediaUrl" in video && video.mediaUrl) ||
    ("media_url" in video && video.media_url) ||
    null;
  if (isLocalImageUri(mediaUri) && mediaUri && !candidates.includes(mediaUri)) {
    candidates.push(mediaUri);
  }

  const streamId = getVideoStreamId(video);
  if (streamId) {
    const chosenMs = getVideoThumbnailTimeMs(video);
    // Happy path: one stable URL. Extra times are onError fallbacks only.
    const timesMs = [chosenMs];
    if (chosenMs !== 1000) timesMs.push(1000);
    if (chosenMs !== 100) timesMs.push(100);
    for (const timeMs of timesMs) {
      const url = getGridVideoThumbnailUrl(streamId, timeMs);
      if (!candidates.includes(url)) candidates.push(url);
    }
  }

  return candidates;
}

/** Tiny still that can paint immediately (blurred) while the grid thumb decodes. */
export function getGridThumbnailPreviewUrl(video: ProfileVideo | FeedVideo) {
  const streamId = getVideoStreamId(video);
  if (streamId) {
    return getGridVideoPreviewUrl(streamId, getVideoThumbnailTimeMs(video));
  }
  const slideshowImages =
    ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls) ||
    ("image_urls" in video && Array.isArray(video.image_urls) && video.image_urls) ||
    [];
  const firstSlide = slideshowImages.find((uri) => typeof uri === "string" && uri.trim());
  if (firstSlide) return getSlideshowPreviewUrl(firstSlide);
  const localPoster = getLocalPosterForVideo(video.id);
  if (localPoster) return getSlideshowPreviewUrl(localPoster);
  return null;
}

function getSlideshowImages(video: ProfileVideo | FeedVideo) {
  return (
    ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls) ||
    ("image_urls" in video && Array.isArray(video.image_urls) && video.image_urls) ||
    []
  );
}

/**
 * Sharp first frame / first slide for profile fullscreen open.
 * Never the 40×72 grid preview — that looks pixelated when stretched.
 */
export function getProfileFullscreenCoverUrl(video: ProfileVideo | FeedVideo) {
  const slideshowImages = getSlideshowImages(video);
  const isSlideshow =
    ("mediaType" in video && video.mediaType === "slideshow") ||
    ("media_type" in video && video.media_type === "slideshow") ||
    slideshowImages.length > 0;
  if (isSlideshow) {
    const first = slideshowImages.find((uri) => typeof uri === "string" && uri.trim());
    return first?.trim() ?? null;
  }

  const streamId = getVideoStreamId(video);
  if (streamId) {
    const width = Math.min(1080, Math.round(viewportWidth * PixelRatio.get()));
    return getCloudflareThumbnailUrl(streamId, 0, {
      width,
      height: Math.round((width * 16) / 9),
      fit: "fill",
    });
  }

  const localPoster = getLocalPosterForVideo(video.id);
  if (localPoster) return localPoster;
  const mediaUri =
    ("mediaUrl" in video && video.mediaUrl) ||
    ("media_url" in video && video.media_url) ||
    null;
  return isLocalImageUri(mediaUri) ? mediaUri : null;
}

export function getMessageVideoThumbnailSource(video: MessageVideoAttachment) {
  const streamId = video.cloudflareStreamId || extractCloudflareStreamId(video.mediaUrl);
  if (streamId) {
    return getGridVideoThumbnailUrl(streamId, video.thumbnailTimeMs ?? 1000);
  }
  return isLocalImageUri(video.mediaUrl) ? video.mediaUrl : null;
}

export function toMessageVideoAttachmentFromVideo(
  video: ProfileVideo | FeedVideo,
  ownerUserId: string,
): MessageVideoAttachment {
  const mediaUrl =
    "mediaUrl" in video && video.mediaUrl
      ? video.mediaUrl
      : "media_url" in video
        ? video.media_url ?? null
        : null;
  const cloudflareStreamId =
    "cloudflareStreamId" in video && video.cloudflareStreamId
      ? video.cloudflareStreamId
      : "cloudflare_stream_id" in video
        ? video.cloudflare_stream_id ?? null
        : null;
  const thumbnailTimeMs =
    "thumbnailTimeMs" in video && video.thumbnailTimeMs != null
      ? video.thumbnailTimeMs
      : "thumbnail_time_ms" in video
        ? video.thumbnail_time_ms ?? null
        : null;

  return {
    id: video.id,
    userId: ownerUserId,
    caption: getVideoCaption(video),
    mediaUrl,
    cloudflareStreamId,
    thumbnailTimeMs,
  };
}

export function getVideoCaption(video: ProfileVideo | FeedVideo) {
  return "caption" in video ? video.caption?.trim() ?? "" : "";
}
