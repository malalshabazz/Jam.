import { getVideoUploadErrorDetails, logVideoUploadStep } from "@/lib/native-cloudflare";
import type { NativeVideoAsset } from "@/lib/native-cloudflare";
import { getFilterOverlayStyle, type VideoFilterId } from "@/lib/video-filters";
import {
  getVideoTextEffectChrome,
  getVideoTextOutlineRadius,
  getVideoTextOverlayFontFamily,
  getVideoTextOverlayFontWeight,
  type VideoTextOverlay,
} from "@/lib/video-presentation";
import { parseCssColor, writeSolidRgbPngFile } from "@/lib/solid-color-png";
import MediaEngine, {
  type CompositionConfig,
  type CompositeTrack,
  type TextStyle,
} from "@projectyoked/expo-media-engine";
import * as FileSystem from "expo-file-system/legacy";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { Dimensions, Platform } from "react-native";

/** Same base as create-edit / feed overlays (`TEXT_OVERLAY_BASE_FONT_SIZE`). */
const FEED_BASE_FONT_SIZE = 30;
const DEFAULT_PORTRAIT = { width: 1080, height: 1920 };
/**
 * True 1080p for vertical video is short-edge 1080 / long-edge 1920 (1080×1920).
 * Capping the *long* edge at 1080 was crushing portrait to ~608×1080.
 */
const UPLOAD_MAX_SHORT_EDGE = 1080;
const UPLOAD_MAX_LONG_EDGE = 1920;
/** ~12–15 Mbps source so Cloudflare HLS rungs stay sharp (TikTok/IG-style uploads). */
const UPLOAD_VIDEO_BITRATE = 14_000_000;

export type BakeVideoPresentationInput = {
  asset: NativeVideoAsset;
  trimStartSeconds: number;
  trimEndSeconds: number;
  videoFilter: VideoFilterId;
  textOverlays: VideoTextOverlay[];
  /** Preferred poster time within the trimmed clip (ms from original timeline). */
  thumbnailTimeMs?: number;
  /** Optional id used in cache filenames. */
  uploadId?: string;
  /**
   * When true, horizontally flip the video track so front-camera selfies match
   * the mirrored live preview (TikTok / Instagram style).
   */
  mirrorHorizontal?: boolean;
};

export type BakeVideoPresentationResult = {
  asset: NativeVideoAsset;
  /** Trim already applied in the baked file. */
  trimmed: boolean;
  /** Filter + text already burned into pixels. */
  presentationBaked: boolean;
  outputDurationSeconds: number;
  /** Poster grabbed from the baked file (includes text/filter). */
  thumbnailUri: string | null;
};

export function isVideoBakeAvailable() {
  try {
    return MediaEngine.isAvailable();
  } catch {
    return false;
  }
}

/** True when filter / text / mirror must be burned into pixels locally. */
export function needsPresentationBake(input: {
  videoFilter: VideoFilterId;
  textOverlays: VideoTextOverlay[];
  mirrorHorizontal?: boolean;
}) {
  return (
    input.videoFilter !== "none" ||
    input.textOverlays.some((overlay) => overlay.text.trim().length > 0) ||
    Boolean(input.mirrorHorizontal)
  );
}

function evenSize(width: number, height: number) {
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));
  return {
    width: w % 2 === 0 ? w : w + 1,
    height: h % 2 === 0 ? h : h + 1,
  };
}

function fitUploadSize(width: number, height: number) {
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  let scale = 1;
  if (shortEdge > UPLOAD_MAX_SHORT_EDGE) {
    scale = Math.min(scale, UPLOAD_MAX_SHORT_EDGE / shortEdge);
  }
  if (longEdge * scale > UPLOAD_MAX_LONG_EDGE) {
    scale = Math.min(scale, UPLOAD_MAX_LONG_EDGE / longEdge);
  }
  if (scale >= 0.999) return evenSize(width, height);
  return evenSize(width * scale, height * scale);
}

/** Expand #rgb → #rrggbb so native hex parsers never misread short colors. */
function expandCssHex(color: string | undefined): string | undefined {
  if (!color) return color;
  const match = color.trim().match(/^#([0-9a-f]{3})$/i);
  if (!match?.[1]) return color;
  const [r, g, b] = match[1];
  return `#${r}${r}${g}${g}${b}${b}`;
}

/**
 * Display size for the composition canvas (orientation already applied by the
 * thumbnail generator). Do not invent swaps here — that fights the encoder.
 */
async function resolveVideoSize(uri: string, known?: { width?: number | null; height?: number | null }) {
  try {
    // Full-res frame probe (quality only affects JPEG bytes, not reported size).
    const thumb = await getThumbnailAsync(uri, { time: 0, quality: 1 });
    if (thumb.width > 0 && thumb.height > 0) {
      const probed = evenSize(thumb.width, thumb.height);
      const size = fitUploadSize(probed.width, probed.height);
      logVideoUploadStep("video bake size probe", {
        width: size.width,
        height: size.height,
        thumbWidth: thumb.width,
        thumbHeight: thumb.height,
        capped: size.width !== probed.width || size.height !== probed.height,
      });
      return size;
    }
  } catch (error) {
    logVideoUploadStep("video bake size probe failed — trying known dimensions", {
      ...getVideoUploadErrorDetails(error),
      knownWidth: known?.width ?? null,
      knownHeight: known?.height ?? null,
    });
  }

  const knownWidth = known?.width ?? 0;
  const knownHeight = known?.height ?? 0;
  if (knownWidth > 0 && knownHeight > 0) {
    const size = fitUploadSize(knownWidth, knownHeight);
    logVideoUploadStep("video bake size from known dimensions", {
      width: size.width,
      height: size.height,
      knownWidth,
      knownHeight,
    });
    return size;
  }

  logVideoUploadStep("video bake size fallback — portrait default", {});
  return fitUploadSize(DEFAULT_PORTRAIT.width, DEFAULT_PORTRAIT.height);
}

/** Screen-point font size used in the create editor, then scaled into video pixels. */
function editorFontSizeForScale(fontScale: number) {
  return Math.max(12, Math.round(FEED_BASE_FONT_SIZE * fontScale * 10) / 10);
}

function bakeFontWeightToken(overlay: VideoTextOverlay): string {
  const weight = getVideoTextOverlayFontWeight(overlay.fontId);
  if (!weight) {
    // Family already encodes weight (rounded / poster / condensed).
    return "normal";
  }
  return String(weight);
}

function buildTextStyle(overlay: VideoTextOverlay, fontSize: number): TextStyle & { fontFamily?: string } {
  // Use edit density so padding / outline match what the user saw while placing text.
  const chrome = getVideoTextEffectChrome(overlay.effectId, { fontSize, density: "edit" });
  const style: TextStyle & { fontFamily?: string } = {
    color: expandCssHex(chrome.color) ?? chrome.color,
    fontSize,
    fontWeight: bakeFontWeightToken(overlay) === "normal" ? "normal" : "bold",
    fontFamily: getVideoTextOverlayFontFamily(overlay.fontId),
  };

  if (chrome.backgroundColor) {
    style.backgroundColor = expandCssHex(chrome.backgroundColor) ?? chrome.backgroundColor;
    style.backgroundPadding = Math.max(chrome.paddingHorizontal, chrome.paddingVertical);
  }

  if (chrome.useOutline) {
    style.strokeColor = "#000000";
    style.strokeWidth = Math.max(2, getVideoTextOutlineRadius(fontSize, "edit"));
  } else if (chrome.useSoftShadow) {
    style.shadowColor = "rgba(0,0,0,0.55)";
    style.shadowRadius = Math.max(1.5, fontSize * 0.05);
    style.shadowOffsetX = 0;
    style.shadowOffsetY = Math.max(1, fontSize * 0.033);
  }

  return style;
}

function ensureFileUri(uri: string) {
  if (!uri) return uri;
  if (uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("ph://")) {
    return uri;
  }
  return uri.startsWith("/") ? `file://${uri}` : uri;
}

async function assertReadableFile(uri: string, label: string) {
  const info = await FileSystem.getInfoAsync(uri);
  const size =
    info.exists && "size" in info && typeof info.size === "number" ? info.size : null;
  logVideoUploadStep(`video bake ${label}`, {
    uri,
    exists: info.exists,
    size,
  });
  if (!info.exists) {
    throw new Error(`${label} is missing: ${uri}`);
  }
  if (size != null && size <= 0) {
    throw new Error(`${label} is empty: ${uri}`);
  }
  return size;
}

/**
 * Bake trim + filter wash + text into a new MP4 for Cloudflare upload.
 * Requires a custom/dev client with @projectyoked/expo-media-engine linked.
 */
export async function bakeVideoPresentation(
  input: BakeVideoPresentationInput,
): Promise<BakeVideoPresentationResult> {
  if (!isVideoBakeAvailable()) {
    throw new Error("Video bake needs a rebuilt Jam app with the media engine linked.");
  }

  const trimStart = Math.max(0, input.trimStartSeconds);
  // Keep end slightly inside the reported range — camera-roll duration metadata is
  // often a hair longer than what AVAssetExportSession will accept.
  const trimEnd = Math.max(trimStart + 0.1, input.trimEndSeconds - 0.05);
  const outputDuration = Math.max(0.1, trimEnd - trimStart);
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) {
    throw new Error("No cache directory available for video bake.");
  }

  const token = (input.uploadId ?? `${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const outputUri = `${cacheRoot}jam-baked-${token}.mp4`;
  const sourceUri = ensureFileUri(input.asset.uri);

  logVideoUploadStep("video bake step: validate source", {
    uploadId: input.uploadId,
    sourceUri,
    outputUri,
    platform: Platform.OS,
  });
  await assertReadableFile(sourceUri, "source");

  logVideoUploadStep("video bake step: resolve canvas size", { uploadId: input.uploadId });
  const primarySize = await resolveVideoSize(sourceUri, {
    width: input.asset.width,
    height: input.asset.height,
  });
  const textOverlays = input.textOverlays.filter((overlay) => overlay.text.trim().length > 0);
  const mirrorHorizontal = Boolean(input.mirrorHorizontal);
  const hasPresentationOverlays =
    input.videoFilter !== "none" || textOverlays.length > 0;
  // Only letterbox into a portrait canvas when overlays were placed on the full
  // edit screen (including black bars). Otherwise keep native aspect so a
  // 1920×1080 camera-roll clip stays ~1080p landscape instead of being crushed
  // into a soft ~540×304 letterbox retry.
  const letterboxToPortrait =
    primarySize.width >= primarySize.height && hasPresentationOverlays;
  const canvasSize = letterboxToPortrait
    ? fitUploadSize(DEFAULT_PORTRAIT.width, DEFAULT_PORTRAIT.height)
    : primarySize;
  const videoResizeMode = letterboxToPortrait ? ("contain" as const) : ("cover" as const);

  // Landscape .MOV clips often fail AVAssetExportSession ("Operation Stopped").
  // Retry full-res without a separate audio track before any downscale — never
  // accept a 540p "success" that destroys quality.
  type ComposeAttempt = {
    size: { width: number; height: number };
    bitrate: number;
    label: string;
    includeAudioTrack: boolean;
    resizeMode: "cover" | "contain";
  };
  const composeAttempts: ComposeAttempt[] = [
    {
      size: canvasSize,
      bitrate: UPLOAD_VIDEO_BITRATE,
      label: letterboxToPortrait ? "portrait-letterbox" : "primary",
      includeAudioTrack: true,
      resizeMode: videoResizeMode,
    },
    {
      size: canvasSize,
      bitrate: UPLOAD_VIDEO_BITRATE,
      label: letterboxToPortrait
        ? "portrait-letterbox-no-audio-track"
        : "primary-no-audio-track",
      includeAudioTrack: false,
      resizeMode: videoResizeMode,
    },
  ];
  if (letterboxToPortrait) {
    // Last-resort letterbox still at usable detail — no 540p path.
    composeAttempts.push({
      size: fitUploadSize(720, 1280),
      bitrate: 10_000_000,
      label: "portrait-letterbox-720-no-audio-track",
      includeAudioTrack: false,
      resizeMode: "contain",
    });
  } else if (
    primarySize.width >= primarySize.height ||
    Math.max(primarySize.width, primarySize.height) > 1280
  ) {
    const scaleTo = (longEdge: number) =>
      fitUploadSize(
        primarySize.width * (longEdge / Math.max(primarySize.width, primarySize.height)),
        primarySize.height * (longEdge / Math.max(primarySize.width, primarySize.height)),
      );
    // Keep landscape as landscape (e.g. 1920×1080 → 1280×720), not portrait.
    composeAttempts.push({
      size: scaleTo(1280),
      bitrate: 10_000_000,
      label: "native-safe-1280-no-audio-track",
      includeAudioTrack: false,
      resizeMode: "cover",
    });
  }

  const screenWidth = Math.max(1, Dimensions.get("window").width);
  let lastError: unknown = null;

  for (let attemptIndex = 0; attemptIndex < composeAttempts.length; attemptIndex += 1) {
    const attempt = composeAttempts[attemptIndex]!;
    const size = attempt.size;
    const fontScaleToVideo = size.width / screenWidth;
    const attemptOutputUri =
      attemptIndex === 0 ? outputUri : `${cacheRoot}jam-baked-${token}-r${attemptIndex}.mp4`;

    logVideoUploadStep("video bake start", {
      uploadId: input.uploadId,
      platform: Platform.OS,
      attempt: attempt.label,
      width: size.width,
      height: size.height,
      bitrate: attempt.bitrate,
      resizeMode: attempt.resizeMode,
      letterboxToPortrait,
      screenWidth,
      fontScaleToVideo,
      trimStart,
      trimEnd,
      filter: input.videoFilter,
      mirrorHorizontal,
      textOverlayCount: textOverlays.length,
    });

    // Full-frame clip. Orientation comes from AVAsset preferredTransform in the
    // native media-engine patch — do not set rotation/x/y here.
    // Non-portrait sources use contain so letterbox bars match the edit canvas.
    const videoClip = {
      uri: sourceUri,
      startTime: 0,
      duration: outputDuration,
      clipStart: trimStart,
      clipEnd: trimEnd,
      volume: 1,
      resizeMode: attempt.resizeMode,
      mirrorHorizontal,
    };

    const tracks: CompositeTrack[] = [
      {
        type: "video",
        clips: [videoClip],
      },
    ];
    if (attempt.includeAudioTrack) {
      // Explicit audio track — video-only volume was silent after overlay passes.
      tracks.push({
        type: "audio",
        clips: [
          {
            uri: sourceUri,
            startTime: 0,
            duration: outputDuration,
            clipStart: trimStart,
            clipEnd: trimEnd,
            volume: 1,
          },
        ],
      });
    }

    const filterStyle = getFilterOverlayStyle(input.videoFilter);
    const wash = parseCssColor(
      typeof filterStyle.backgroundColor === "string" ? filterStyle.backgroundColor : null,
    );
    if (wash && wash.a > 0.01) {
      logVideoUploadStep("video bake step: write filter wash png", {
        uploadId: input.uploadId,
        attempt: attempt.label,
        filter: input.videoFilter,
        rgba: wash,
      });
      const overlayUri = `${cacheRoot}jam-filter-${token}-${attemptIndex}.png`;
      const overlay = await writeSolidRgbPngFile(overlayUri, size.width, size.height, wash, {
        maxEdge: Math.max(size.width, size.height),
      });
      await assertReadableFile(ensureFileUri(overlay.uri), "filter wash");
      tracks.push({
        type: "image",
        clips: [
          {
            uri: ensureFileUri(overlay.uri),
            startTime: 0,
            duration: outputDuration,
            x: 0.5,
            y: 0.5,
            scale: 1,
            opacity: wash.a,
          },
        ],
      });
    } else {
      logVideoUploadStep("video bake step: no filter wash", {
        uploadId: input.uploadId,
        attempt: attempt.label,
        filter: input.videoFilter,
      });
    }

    if (textOverlays.length > 0) {
      logVideoUploadStep("video bake step: build text track", {
        uploadId: input.uploadId,
        attempt: attempt.label,
        count: textOverlays.length,
        fontScaleToVideo,
      });
      tracks.push({
        type: "text",
        clips: textOverlays.map((overlay) => {
          const screenFont = editorFontSizeForScale(overlay.fontScale);
          const fontSize = Math.max(12, Math.round(screenFont * fontScaleToVideo * 10) / 10);
          const textStyle = buildTextStyle(overlay, fontSize);
          const fontWeight = bakeFontWeightToken(overlay);
          return {
            uri: sourceUri,
            text: overlay.text.trim(),
            startTime: 0,
            duration: outputDuration,
            x: overlay.centerRatio.x,
            y: overlay.centerRatio.y,
            opacity: 1,
            textStyle,
            color: textStyle.color,
            fontSize,
            fontWeight,
            fontFamily: textStyle.fontFamily,
            backgroundColor: textStyle.backgroundColor,
            backgroundPadding: textStyle.backgroundPadding,
            shadowColor: textStyle.shadowColor,
            shadowRadius: textStyle.shadowRadius,
            shadowOffsetX: textStyle.shadowOffsetX,
            shadowOffsetY: textStyle.shadowOffsetY,
            strokeColor: textStyle.strokeColor,
            strokeWidth: textStyle.strokeWidth,
          };
        }),
      });
    }

    const config: CompositionConfig = {
      outputUri: attemptOutputUri,
      width: size.width,
      height: size.height,
      frameRate: 30,
      quality: "high",
      videoBitrate: attempt.bitrate,
      bitrate: attempt.bitrate,
      enablePassthrough: false,
      tracks,
    };

    logVideoUploadStep("video bake step: composeCompositeVideo", {
      uploadId: input.uploadId,
      attempt: attempt.label,
      outputUri: attemptOutputUri,
      width: config.width,
      height: config.height,
      quality: config.quality,
      videoBitrate: config.videoBitrate,
      trackTypes: tracks.map((track) => track.type),
      trackClipCounts: tracks.map((track) => track.clips.length),
      enablePassthrough: false,
    });

    try {
      const bakedPath = await MediaEngine.composeCompositeVideo(config);
      const bakedUri = ensureFileUri(bakedPath || attemptOutputUri);
      logVideoUploadStep("video bake step: native returned", {
        uploadId: input.uploadId,
        attempt: attempt.label,
        bakedPath,
        bakedUri,
      });
      const fileSize = await assertReadableFile(bakedUri, "baked output");

      let thumbnailUri: string | null = null;
      try {
        const preferredMs = Math.max(0, (input.thumbnailTimeMs ?? trimStart * 1000) - trimStart * 1000);
        const thumbTimeMs = Math.min(
          Math.max(0, preferredMs),
          Math.max(0, Math.round(outputDuration * 1000) - 50),
        );
        logVideoUploadStep("video bake step: grab poster frame", {
          uploadId: input.uploadId,
          thumbTimeMs,
        });
        const thumb = await getThumbnailAsync(bakedUri, {
          time: thumbTimeMs,
          quality: 0.7,
        });
        thumbnailUri = thumb.uri;
      } catch (thumbError) {
        logVideoUploadStep("video bake thumbnail failed", {
          uploadId: input.uploadId,
          ...getVideoUploadErrorDetails(thumbError),
        });
      }

      logVideoUploadStep("video bake complete", {
        uploadId: input.uploadId,
        attempt: attempt.label,
        outputUri: bakedUri,
        fileSize,
        outputDuration,
        hasThumbnail: Boolean(thumbnailUri),
        bakedFilter: input.videoFilter,
        bakedTextCount: textOverlays.length,
      });

      return {
        asset: {
          uri: bakedUri,
          fileName: `jam-baked-${token}.mp4`,
          mimeType: "video/mp4",
          fileSize,
          width: size.width,
          height: size.height,
        },
        trimmed: true,
        presentationBaked: true,
        outputDurationSeconds: outputDuration,
        thumbnailUri,
      };
    } catch (error) {
      lastError = error;
      logVideoUploadStep("video bake attempt failed", {
        uploadId: input.uploadId,
        attempt: attempt.label,
        outputUri: attemptOutputUri,
        willRetry: attemptIndex < composeAttempts.length - 1,
        ...getVideoUploadErrorDetails(error),
      });
    }
  }

  logVideoUploadStep("video bake failed", {
    uploadId: input.uploadId,
    outputUri,
    ...getVideoUploadErrorDetails(lastError),
  });
  throw lastError instanceof Error ? lastError : new Error("Video bake failed.");
}

/**
 * Remux a fresh camera recording onto an orientation-correct canvas
 * (no trim/filter/text). Front uses mirrorHorizontal; back uses false so
 * portrait phone clips aren't left as landscape-coded + rotation metadata.
 */
export async function normalizeCameraRecording(
  asset: NativeVideoAsset,
  options?: {
    uploadId?: string;
    durationSeconds?: number;
    mirrorHorizontal?: boolean;
  },
): Promise<BakeVideoPresentationResult> {
  let durationSeconds = options?.durationSeconds ?? 0;
  if (!(durationSeconds > 0.1)) {
    durationSeconds = await probeVideoDurationSeconds(asset.uri);
  }
  const mirrorHorizontal = Boolean(options?.mirrorHorizontal);
  logVideoUploadStep(mirrorHorizontal ? "video mirror start" : "video orientation normalize start", {
    uploadId: options?.uploadId,
    durationSeconds,
    mirrorHorizontal,
    uriScheme: asset.uri.split(":")[0] || "unknown",
  });
  return bakeVideoPresentation({
    asset,
    trimStartSeconds: 0,
    trimEndSeconds: durationSeconds,
    videoFilter: "none",
    textOverlays: [],
    uploadId: options?.uploadId ?? `${mirrorHorizontal ? "mirror" : "orient"}-${Date.now()}`,
    mirrorHorizontal,
  });
}

/**
 * Bake a horizontal selfie-mirror into a new file (no trim/filter/text).
 * Used right after front-camera capture so edit + upload see the same view.
 */
export async function mirrorVideoHorizontal(
  asset: NativeVideoAsset,
  options?: { uploadId?: string; durationSeconds?: number },
): Promise<BakeVideoPresentationResult> {
  return normalizeCameraRecording(asset, {
    ...options,
    mirrorHorizontal: true,
  });
}

async function probeVideoDurationSeconds(uri: string): Promise<number> {
  const { createVideoPlayer } = await import("expo-video");
  const player = createVideoPlayer(ensureFileUri(uri));
  try {
    player.pause();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out reading video duration for mirror."));
      }, 10000);

      const finish = () => {
        if (player.duration > 0) {
          cleanup();
          resolve();
        }
      };

      const statusSub = player.addListener("statusChange", ({ status }) => {
        if (status === "readyToPlay") finish();
      });
      const sourceSub = player.addListener("sourceLoad", () => {
        finish();
      });

      function cleanup() {
        clearTimeout(timeout);
        statusSub.remove();
        sourceSub.remove();
      }

      // Duration may already be available synchronously on some platforms.
      finish();
    });
    return Math.max(0.1, player.duration);
  } finally {
    player.release();
  }
}
