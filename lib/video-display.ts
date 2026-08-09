import type { VideoSource } from "expo-video";

import {
  extractCloudflareStreamId,
  getCloudflarePlaybackUrl,
  getCloudflareThumbnailUrl,
} from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import { getExpoVideoSource as getPrewarmExpoVideoSource } from "@/lib/profile-video-prewarm";

export function getVideoSource(item: FeedVideo) {
  if (item.cloudflareStreamId) return getCloudflarePlaybackUrl(item.cloudflareStreamId);
  return item.mediaUrl;
}

/** Near-start poster for feed transitions — matches playback from the beginning. */
export function getFeedPosterSource(item: FeedVideo) {
  const streamId = item.cloudflareStreamId || extractCloudflareStreamId(item.mediaUrl);
  if (!streamId) return null;
  // 100ms avoids a pure black camera-open frame while staying at the start of the clip.
  return getCloudflareThumbnailUrl(streamId, 100, { height: 1280 });
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
