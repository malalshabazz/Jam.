import type { VideoSource } from "expo-video";

import {
  extractCloudflareStreamId,
  getCloudflarePlaybackUrl,
  getCloudflareThumbnailUrl,
} from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import { getLocalPosterForVideo } from "@/lib/pending-video-uploads";
import { getExpoVideoSource as getPrewarmExpoVideoSource } from "@/lib/profile-video-prewarm";

function isLikelyImageUri(uri: string | null | undefined) {
  if (!uri) return false;
  if (
    uri.startsWith("file:") ||
    uri.startsWith("content:") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library:")
  ) {
    return true;
  }
  return /\.(jpe?g|png|webp|heic|gif)(\?|$)/i.test(uri);
}

export function getVideoSource(item: FeedVideo) {
  if (item.cloudflareStreamId) return getCloudflarePlaybackUrl(item.cloudflareStreamId);
  return item.mediaUrl;
}

/** Near-start poster for feed transitions — matches playback from the beginning. */
export function getFeedPosterSource(item: FeedVideo) {
  const localPoster = getLocalPosterForVideo(item.id);
  if (localPoster) return localPoster;

  const streamId = item.cloudflareStreamId || extractCloudflareStreamId(item.mediaUrl);
  if (!streamId) {
    // Local / pending uploads may only have a still image URI.
    return isLikelyImageUri(item.mediaUrl) ? item.mediaUrl : null;
  }

  // Prefer the editor-chosen frame; fall back to an early frame (avoid t=0 black).
  const preferredTimeMs =
    typeof item.thumbnailTimeMs === "number" && Number.isFinite(item.thumbnailTimeMs)
      ? item.thumbnailTimeMs
      : 100;
  return getCloudflareThumbnailUrl(streamId, Math.max(100, preferredTimeMs), { height: 1280 });
}

export function getCloudflareFreezeFrameUri(source: string, timeSec: number) {
  const streamId = extractCloudflareStreamId(source);
  if (!streamId) return null;
  const clampedTimeMs = Math.max(100, (Number.isFinite(timeSec) ? timeSec : 0) * 1000);
  return getCloudflareThumbnailUrl(streamId, clampedTimeMs, { height: 1280 });
}

export function getExpoVideoSource(source: string | null): VideoSource {
  return getPrewarmExpoVideoSource(source);
}

export function getGridVideoSource(video: ProfileVideo | FeedVideo) {
  if ("cloudflareStreamId" in video && video.cloudflareStreamId) {
    return getCloudflarePlaybackUrl(video.cloudflareStreamId);
  }
  if ("cloudflare_stream_id" in video && video.cloudflare_stream_id) {
    return getCloudflarePlaybackUrl(video.cloudflare_stream_id);
  }
  if ("mediaUrl" in video && video.mediaUrl) return video.mediaUrl;
  if ("media_url" in video && video.media_url) return video.media_url;
  return null;
}

export function getVideoStreamId(video: {
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
}) {
  return (
    video.cloudflareStreamId ||
    video.cloudflare_stream_id ||
    extractCloudflareStreamId(video.mediaUrl) ||
    extractCloudflareStreamId(video.media_url) ||
    null
  );
}
