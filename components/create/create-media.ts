import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { CAMERA_PINCH_ZOOM_STEP } from "@/theme/tokens";
import { clamp } from "@/lib/format";
import { waitMs } from "@/lib/animation";

// Camera-roll thumbnails decode via AVFoundation. Doing that while CameraView is
// starting freezes the live preview, so we cache/preload outside create focus.
export let cachedRecentVideoThumbnailUri: string | null = null;
export let recentVideoThumbnailLoadPromise: Promise<string | null> | null = null;
let cameraPreviewActive = false;

export function setCameraPreviewActive(active: boolean) {
  cameraPreviewActive = active;
}


export async function preloadRecentVideoThumbnail(options?: {
  force?: boolean;
  requestPermission?: boolean;
}): Promise<string | null> {
  if (!options?.force && cachedRecentVideoThumbnailUri) {
    return cachedRecentVideoThumbnailUri;
  }
  if (recentVideoThumbnailLoadPromise && !options?.force) {
    return recentVideoThumbnailLoadPromise;
  }

  recentVideoThumbnailLoadPromise = (async () => {
    try {
      // If create camera took focus while we were queued, wait it out instead of
      // decoding on top of the live session.
      const waitStarted = Date.now();
      while (cameraPreviewActive && Date.now() - waitStarted < 45000) {
        await waitMs(250);
      }
      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      let permission = await MediaLibrary.getPermissionsAsync();
      if (!permission.granted) {
        // Don't prompt during background preload — create keeps the placeholder
        // until the picker (or an explicit refresh) asks.
        if (!options?.requestPermission || !permission.canAskAgain) {
          return cachedRecentVideoThumbnailUri;
        }
        permission = await MediaLibrary.requestPermissionsAsync();
      }
      if (!permission.granted) return cachedRecentVideoThumbnailUri;
      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      const assets = await MediaLibrary.getAssetsAsync({
        first: 1,
        mediaType: MediaLibrary.MediaType.video,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const latestVideo = assets.assets[0];
      if (!latestVideo) {
        cachedRecentVideoThumbnailUri = null;
        return null;
      }

      // Avoid iCloud downloads while the camera may be nearby — local only.
      const assetInfo = await MediaLibrary.getAssetInfoAsync(latestVideo, {
        shouldDownloadFromNetwork: false,
      });
      const rawUri = (assetInfo.localUri ?? latestVideo.uri).replace(/#.*$/, "");
      if (!rawUri || rawUri.startsWith("ph://") || assetInfo.isNetworkAsset) {
        return cachedRecentVideoThumbnailUri;
      }
      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      async function thumbnailFromUri(videoUri: string) {
        return getThumbnailAsync(videoUri, {
          time: 100,
          quality: 0.6,
        });
      }

      try {
        const thumbnail = await thumbnailFromUri(rawUri);
        cachedRecentVideoThumbnailUri = thumbnail.uri;
        return thumbnail.uri;
      } catch {
        // Fall through — iOS often needs a sandbox copy before thumbnails work.
      }

      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return cachedRecentVideoThumbnailUri;

      const copiedUri = `${cacheDir}jam-recent-library-video.mp4`;
      await FileSystem.deleteAsync(copiedUri, { idempotent: true });
      await FileSystem.copyAsync({ from: rawUri, to: copiedUri });
      try {
        if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;
        const thumbnail = await thumbnailFromUri(copiedUri);
        cachedRecentVideoThumbnailUri = thumbnail.uri;
        return thumbnail.uri;
      } finally {
        void FileSystem.deleteAsync(copiedUri, { idempotent: true });
      }
    } catch {
      return cachedRecentVideoThumbnailUri;
    } finally {
      recentVideoThumbnailLoadPromise = null;
    }
  })();

  return recentVideoThumbnailLoadPromise;
}


export function pinchScaleToCameraZoom(baseZoom: number, scale: number) {
  const delta = (Math.log(Math.max(scale, 0.01)) / Math.log(2)) * CAMERA_PINCH_ZOOM_STEP;
  return clamp(baseZoom + delta, 0, 1);
}


export async function extractVideoThumbnailFrames(
  videoUri: string,
  durationMs: number,
  frameCount: number,
  shouldContinue: () => boolean,
) {
  const safeDuration = Math.max(durationMs, 1000);
  const frameDenominator = Math.max(frameCount - 1, 1);
  // Sample inside the clip (5%–95%) so the default poster isn't a black camera-open frame.
  const times = Array.from({ length: frameCount }, (_, index) => {
    const ratio = 0.05 + (index / frameDenominator) * 0.9;
    return Math.round(ratio * safeDuration);
  });
  const frames: Array<{ timeMs: number; uri: string }> = [];

  for (const timeMs of times) {
    if (!shouldContinue()) return frames;

    try {
      const thumbnail = await getThumbnailAsync(videoUri, {
        time: timeMs,
        quality: 0.5,
      });
      frames.push({ timeMs, uri: thumbnail.uri });
    } catch {
      // Skip frames that fail to generate.
    }
  }

  return frames;
}
