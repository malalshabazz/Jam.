import type { VideoSource } from "expo-video";

import {
  contentFitForVideoSize,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromSource,
  getVideoDisplaySize,
} from "@/components/video/aspect-cache";
import {
  extractCloudflareStreamId,
  getCloudflarePlaybackUrl,
  getCloudflareThumbnailUrl,
} from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import { getLocalPosterForVideo } from "@/lib/pending-video-uploads";
import { getExpoVideoSource as getPrewarmExpoVideoSource } from "@/lib/profile-video-prewarm";
import { viewportWidth } from "@/theme/tokens";

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

function feedStillOptions(sourceOrVideo: {
  id?: string;
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  displayWidth?: number | null;
  display_width?: number | null;
  displayHeight?: number | null;
  display_height?: number | null;
} | string) {
  const aspect =
    typeof sourceOrVideo === "string"
      ? getRememberedVideoAspectSize(getVideoAspectCacheKeyFromSource(sourceOrVideo))
      : getVideoDisplaySize(sourceOrVideo);
  const hasAspect = Boolean(aspect && aspect.width > 0 && aspect.height > 0);
  const contentFit = contentFitForVideoSize(aspect?.width, aspect?.height);
  return {
    width: Math.round(viewportWidth),
    height: Math.round((viewportWidth * 16) / 9),
    // crop ≈ VideoView cover, fill ≈ contain with black bars.
    // Same size as the player — never swap crop/fill after first paint.
    fit: hasAspect && contentFit === "cover" ? ("crop" as const) : ("fill" as const),
  };
}

/** Near-start poster for feed transitions — matches playback from t=0. */
export function getStartFramePosterSource(video: {
  id?: string;
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  displayWidth?: number | null;
  display_width?: number | null;
  displayHeight?: number | null;
  display_height?: number | null;
}) {
  const streamId = getVideoStreamId(video);
  if (streamId) {
    return getCloudflareThumbnailUrl(streamId, 0, feedStillOptions(video));
  }

  const localPoster = video.id ? getLocalPosterForVideo(video.id) : null;
  if (localPoster) return localPoster;

  const mediaUrl = video.mediaUrl ?? video.media_url;
  // Local / pending uploads may only have a still image URI.
  return isLikelyImageUri(mediaUrl) ? mediaUrl : null;
}

export function getFeedPosterSource(item: FeedVideo) {
  return getStartFramePosterSource(item);
}

export function getCloudflareFreezeFrameUri(source: string, timeSec: number) {
  const streamId = extractCloudflareStreamId(source);
  if (!streamId) return null;
  const timeMs = Number.isFinite(timeSec) ? Math.max(0, timeSec * 1000) : 0;
  return getCloudflareThumbnailUrl(streamId, timeMs, feedStillOptions(source));
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
