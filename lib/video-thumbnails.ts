import {
  extractCloudflareStreamId,
  getCloudflareThumbnailUrl,
} from "@/lib/native-cloudflare";
import { CREATE_THUMBNAIL_FRAME_COUNT } from "@/theme/tokens";
import type {
  FeedVideo,
  MessageVideoAttachment,
  ProfileVideo,
} from "@/lib/native-social-data";
import { getLocalPosterForVideo } from "@/lib/pending-video-uploads";
import { getVideoStreamId } from "@/lib/video-display";

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
      uri: getCloudflareThumbnailUrl(streamId, timeMs, { height: 180, width: 102 }),
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
    for (const uri of slideshowImages) {
      if (typeof uri === "string" && uri.trim() && !candidates.includes(uri)) {
        candidates.push(uri);
      }
    }
  }

  const mediaUri =
    ("mediaUrl" in video && video.mediaUrl) ||
    ("media_url" in video && video.media_url) ||
    null;
  if (isLocalImageUri(mediaUri) && mediaUri && !candidates.includes(mediaUri)) {
    candidates.push(mediaUri);
  }
  if (isSlideshow && typeof mediaUri === "string" && mediaUri && !candidates.includes(mediaUri)) {
    candidates.push(mediaUri);
  }

  const streamId = getVideoStreamId(video);
  if (streamId) {
    // Prefer the editor-chosen frame, then safer early timestamps. Short clips
    // often 404 when asked for 1s+/custom times beyond their duration — playback
    // still works, so the grid used to look "broken" while tap-to-play succeeded.
    const timesMs = [getVideoThumbnailTimeMs(video), 1000, 100];
    for (const timeMs of timesMs) {
      const url = getCloudflareThumbnailUrl(streamId, timeMs, { height: 640 });
      if (!candidates.includes(url)) candidates.push(url);
    }
  }

  return candidates;
}

export function getMessageVideoThumbnailSource(video: MessageVideoAttachment) {
  const streamId = video.cloudflareStreamId || extractCloudflareStreamId(video.mediaUrl);
  if (streamId) {
    return getCloudflareThumbnailUrl(streamId, video.thumbnailTimeMs ?? 1000, { height: 640 });
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
