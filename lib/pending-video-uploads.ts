import { useEffect, useMemo, useState } from "react";
import { createVideo } from "@/lib/native-social-data";
import type { ProfileVideo } from "@/lib/native-social-data";
import {
  clipStreamVideo,
  createStreamUpload,
  getVideoUploadErrorDetails,
  logVideoUploadStep,
  resolveLocalFileSize,
  uploadToCloudflare,
  waitForCloudflareStreamReady,
  type NativeVideoAsset,
  type StreamUploadProtocol,
} from "@/lib/native-cloudflare";
import {
  bakeVideoPresentation,
  isVideoBakeAvailable,
  needsPresentationBake,
} from "@/lib/bake-video-presentation";
import type { VideoFilterId } from "@/lib/video-filters";
import {
  normalizeVideoFilter,
  normalizeVideoTextOverlays,
  type VideoTextOverlay,
} from "@/lib/video-presentation";

export const PENDING_VIDEO_ID_PREFIX = "pending:";

export type PendingVideoUploadPhase = "uploading" | "processing" | "saving" | "failed";

export type PendingVideoUpload = {
  id: string;
  userId: string;
  asset: NativeVideoAsset;
  localThumbnailUri: string | null;
  caption: string;
  roles: string[];
  genres: string[];
  thumbnailTimeMs: number;
  maxDurationSeconds: number;
  sourceDurationSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  videoFilter: VideoFilterId;
  textOverlays: VideoTextOverlay[];
  lookingFor: boolean;
  progress: number;
  phase: PendingVideoUploadPhase;
  errorMessage: string | null;
  /** Set after bytes land on Stream so retries can resume without re-uploading. */
  cloudflareStreamId?: string | null;
  /** In-progress tus session — resume chunks without creating a new Stream media. */
  tusUploadUrl?: string | null;
  pendingStreamId?: string | null;
  uploadProtocol?: StreamUploadProtocol | null;
  /** Set after clip succeeds (trimmed posts). */
  clippedStreamId?: string | null;
  publishedThumbnailTimeMs?: number | null;
  /** Local baked MP4 (trim + filter + text) — retries skip re-bake when set. */
  bakedAsset?: NativeVideoAsset | null;
  /** True once edits are burned into bakedAsset. */
  presentationBaked?: boolean;
};

export type PendingUploadPostedEvent = {
  userId: string;
  videoId: string;
};

type PendingUploadListener = () => void;
type PostedListener = (event: PendingUploadPostedEvent) => void;

const pendingUploads: PendingVideoUpload[] = [];
const listeners = new Set<PendingUploadListener>();
const postedListeners = new Set<PostedListener>();
const runningUploads = new Set<string>();
/** Local create-flow posters kept after publish so the grid isn't blank while Stream thumbs settle. */
const localPostersByVideoId = new Map<string, string>();

export function getLocalPosterForVideo(videoId: string) {
  return localPostersByVideoId.get(videoId) ?? null;
}

export function rememberLocalPosterForVideo(videoId: string, localUri: string | null | undefined) {
  if (!videoId || !localUri) return;
  localPostersByVideoId.set(videoId, localUri);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function notifyPosted(event: PendingUploadPostedEvent) {
  postedListeners.forEach((listener) => listener(event));
}

export function subscribePendingUploads(listener: PendingUploadListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribePendingUploadPosted(listener: PostedListener) {
  postedListeners.add(listener);
  return () => {
    postedListeners.delete(listener);
  };
}

export function usePendingVideoUploads() {
  const [version, setVersion] = useState(0);

  useEffect(() => subscribePendingUploads(() => setVersion((current) => current + 1)), []);

  // Snapshot so consumers (and useMemo deps) see a new reference when uploads change.
  return useMemo(() => pendingUploads.map((upload) => ({ ...upload })), [version]);
}

export function usePendingUploadFeedProgress(userId: string) {
  const uploads = usePendingVideoUploads();
  return useMemo(() => getPendingUploadFeedProgress(userId), [uploads, userId]);
}

export function getPendingUploadsForUser(userId: string) {
  return pendingUploads.filter((upload) => upload.userId === userId);
}

export function getPendingUploadById(id: string) {
  return pendingUploads.find((upload) => upload.id === id) ?? null;
}

export function isPendingProfileVideoId(id: string) {
  return id.startsWith(PENDING_VIDEO_ID_PREFIX);
}

export function getPendingUploadIdFromProfileVideoId(id: string) {
  return id.slice(PENDING_VIDEO_ID_PREFIX.length);
}

export function pendingUploadToProfileVideo(upload: PendingVideoUpload): ProfileVideo {
  return {
    id: `${PENDING_VIDEO_ID_PREFIX}${upload.id}`,
    userId: upload.userId,
    caption: upload.caption,
    roles: upload.roles,
    genres: upload.genres,
    media_url: upload.localThumbnailUri,
    mediaUrl: upload.localThumbnailUri,
    thumbnail_time_ms: upload.thumbnailTimeMs,
    thumbnailTimeMs: upload.thumbnailTimeMs,
    videoFilter: upload.videoFilter,
    textOverlays: upload.textOverlays,
    lookingFor: upload.lookingFor,
    looking_for: upload.lookingFor,
    created_at: new Date().toISOString(),
  };
}

export function getPendingUploadFeedProgress(userId: string) {
  const uploads = getPendingUploadsForUser(userId).filter((upload) => upload.phase !== "failed");
  if (uploads.length === 0) return null;

  const progress =
    uploads.reduce((total, upload) => total + upload.progress, 0) / Math.max(uploads.length, 1);
  const phase: PendingVideoUploadPhase = uploads.some((upload) => upload.phase === "uploading")
    ? "uploading"
    : uploads.some((upload) => upload.phase === "processing")
      ? "processing"
      : "saving";

  return {
    count: uploads.length,
    progress: Math.round(progress),
    phase,
  };
}

function updatePendingUpload(id: string, patch: Partial<PendingVideoUpload>) {
  const index = pendingUploads.findIndex((upload) => upload.id === id);
  if (index < 0) return;
  pendingUploads[index] = { ...pendingUploads[index], ...patch };
  notify();
}

function removePendingUpload(id: string) {
  const index = pendingUploads.findIndex((upload) => upload.id === id);
  if (index < 0) return;
  pendingUploads.splice(index, 1);
  notify();
}

function needsTrimClip(upload: PendingVideoUpload) {
  const sourceDuration = Math.max(upload.sourceDurationSeconds, upload.trimEndSeconds);
  if (sourceDuration <= 0) return false;
  const startRatio = upload.trimStartSeconds / sourceDuration;
  const endRatio = upload.trimEndSeconds / sourceDuration;
  return startRatio > 0.001 || endRatio < 0.999;
}

function getClippedThumbnailTimeMs(upload: PendingVideoUpload) {
  const clipStartMs = Math.round(upload.trimStartSeconds * 1000);
  const clipEndMs = Math.round(upload.trimEndSeconds * 1000);
  const spanMs = Math.max(1, clipEndMs - clipStartMs);
  const relativeMs = Math.max(0, upload.thumbnailTimeMs - clipStartMs);
  return Math.min(spanMs, relativeMs);
}

function getClipThumbnailPct(upload: PendingVideoUpload) {
  const clipStartMs = Math.round(upload.trimStartSeconds * 1000);
  const clipEndMs = Math.round(upload.trimEndSeconds * 1000);
  const spanMs = Math.max(1, clipEndMs - clipStartMs);
  return Math.min(1, Math.max(0, getClippedThumbnailTimeMs(upload) / spanMs));
}

async function runPendingUpload(uploadId: string) {
  if (runningUploads.has(uploadId)) return;

  const upload = getPendingUploadById(uploadId);
  if (!upload) return;

  runningUploads.add(uploadId);
  updatePendingUpload(uploadId, {
    phase: "uploading",
    progress: Math.max(upload.progress, 1),
    errorMessage: null,
  });

  try {
    let working = getPendingUploadById(uploadId) ?? upload;
    let assetToUpload = working.bakedAsset ?? working.asset;
    let publishFilter = working.presentationBaked ? ("none" as VideoFilterId) : working.videoFilter;
    let publishOverlays = working.presentationBaked ? [] : working.textOverlays;
    let clientTrimmed = Boolean(working.presentationBaked);
    let uploadMaxDurationSeconds = Math.max(
      working.maxDurationSeconds,
      Math.ceil(working.sourceDurationSeconds) + 2,
    );
    let publishedThumbnailTimeMs = working.publishedThumbnailTimeMs ?? working.thumbnailTimeMs;

    // Trim-only must NOT local-bake — landscape camera-roll remux often fails and
    // previously fell through to a soft 540p "success". Cloudflare Stream clip
    // applies trim after uploading the original full-res file.
    const shouldBake =
      !working.presentationBaked &&
      !working.cloudflareStreamId &&
      needsPresentationBake(working);

    if (shouldBake && isVideoBakeAvailable()) {
      updatePendingUpload(uploadId, { phase: "processing", progress: Math.max(working.progress, 4) });
      const bakePulse = setInterval(() => {
        const current = getPendingUploadById(uploadId);
        if (!current || current.phase !== "processing" || current.presentationBaked) return;
        updatePendingUpload(uploadId, {
          phase: "processing",
          progress: Math.min(28, Math.max(4, current.progress + 1)),
        });
      }, 1200);
      try {
        const baked = await bakeVideoPresentation({
          asset: working.asset,
          trimStartSeconds: working.trimStartSeconds,
          trimEndSeconds: working.trimEndSeconds,
          videoFilter: working.videoFilter,
          textOverlays: working.textOverlays,
          thumbnailTimeMs: working.thumbnailTimeMs,
          uploadId,
        });
        publishedThumbnailTimeMs = getClippedThumbnailTimeMs(working);
        assetToUpload = baked.asset;
        publishFilter = "none";
        publishOverlays = [];
        clientTrimmed = baked.trimmed;
        uploadMaxDurationSeconds = Math.max(
          working.maxDurationSeconds,
          Math.ceil(baked.outputDurationSeconds) + 2,
        );
        const bakedThumbnailUri = baked.thumbnailUri ?? working.localThumbnailUri;
        updatePendingUpload(uploadId, {
          bakedAsset: baked.asset,
          presentationBaked: true,
          publishedThumbnailTimeMs,
          localThumbnailUri: bakedThumbnailUri,
          // Clear overlay metadata on the pending tile — pixels already include them.
          videoFilter: "none",
          textOverlays: [],
          phase: "processing",
          progress: 30,
        });
        working = {
          ...working,
          bakedAsset: baked.asset,
          presentationBaked: true,
          publishedThumbnailTimeMs,
          localThumbnailUri: bakedThumbnailUri,
          videoFilter: "none",
          textOverlays: [],
        };
      } catch (error) {
        logVideoUploadStep("video bake failed — falling back to overlay metadata", {
          uploadId,
          ...getVideoUploadErrorDetails(error),
        });
        // Keep original asset + Stream clip / playback overlays.
      } finally {
        clearInterval(bakePulse);
      }
    } else if (shouldBake && !isVideoBakeAvailable()) {
      logVideoUploadStep("video bake skipped — native module unavailable", {
        uploadId,
        hint: "Rebuild the Jam development client after installing @projectyoked/expo-media-engine.",
      });
    }

    working = getPendingUploadById(uploadId) ?? working;
    let cloudflareStreamId: string | null = working.cloudflareStreamId ?? null;
    let lastError: unknown = null;
    const maxUploadAttempts = 5;
    const uploadBackoffMs = [1000, 2000, 4000, 8000];

    if (cloudflareStreamId) {
      logVideoUploadStep("background upload resume after prior success", {
        uploadId,
        cloudflareStreamId,
        clippedStreamId: working.clippedStreamId ?? null,
      });
      updatePendingUpload(uploadId, { phase: "uploading", progress: Math.max(working.progress, 78) });
    } else {
      const uploadLength = await resolveLocalFileSize(assetToUpload);
      for (let attempt = 1; attempt <= maxUploadAttempts; attempt += 1) {
        try {
          working = getPendingUploadById(uploadId) ?? working;
          logVideoUploadStep("background upload attempt start", {
            uploadId,
            attempt,
            maxUploadAttempts,
            presentationBaked: clientTrimmed,
            uploadLength,
            hasTusSession: Boolean(working.tusUploadUrl && working.pendingStreamId),
          });

          let uploadUrl = working.tusUploadUrl ?? null;
          let streamId = working.pendingStreamId ?? null;
          let protocol: StreamUploadProtocol = working.uploadProtocol === "tus" ? "tus" : "basic";

          if (!uploadUrl || !streamId) {
            const uploadRequest = await createStreamUpload(uploadMaxDurationSeconds, {
              allowLongerSource:
                (!clientTrimmed && needsTrimClip(working)) ||
                working.sourceDurationSeconds > working.maxDurationSeconds,
              uploadLength,
            });
            uploadUrl = uploadRequest.uploadUrl;
            streamId = uploadRequest.cloudflareStreamId;
            protocol = uploadRequest.protocol;
            if (protocol === "tus") {
              // Persist before bytes finish so retries can resume mid-file.
              updatePendingUpload(uploadId, {
                tusUploadUrl: uploadUrl,
                pendingStreamId: streamId,
                uploadProtocol: "tus",
              });
            }
          }

          await uploadToCloudflare(
            uploadUrl,
            assetToUpload,
            (nextProgress) => {
              updatePendingUpload(uploadId, {
                phase: "uploading",
                progress: Math.min(
                  78,
                  Math.max(clientTrimmed ? 32 : 1, Math.round(32 + nextProgress * 0.46)),
                ),
              });
            },
            { protocol },
          );
          cloudflareStreamId = streamId;
          updatePendingUpload(uploadId, {
            cloudflareStreamId,
            tusUploadUrl: null,
            pendingStreamId: null,
            uploadProtocol: null,
          });
          break;
        } catch (error) {
          lastError = error;
          working = getPendingUploadById(uploadId) ?? working;
          const message = error instanceof Error ? error.message : String(error);
          const sessionExpired = /upload session expired|starting a new upload/i.test(message);
          if (sessionExpired || working.uploadProtocol !== "tus") {
            // Drop dead one-shot / expired tus sessions before the next attempt.
            updatePendingUpload(uploadId, {
              tusUploadUrl: null,
              pendingStreamId: null,
              uploadProtocol: null,
            });
          }
          logVideoUploadStep("background upload attempt failed", {
            uploadId,
            attempt,
            maxUploadAttempts,
            ...getVideoUploadErrorDetails(error),
          });
          if (attempt < maxUploadAttempts) {
            const delay = uploadBackoffMs[attempt - 1] ?? 8000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }

    if (!cloudflareStreamId) {
      throw lastError instanceof Error ? lastError : new Error("Upload failed.");
    }

    working = getPendingUploadById(uploadId) ?? working;
    let finalStreamId = working.clippedStreamId ?? cloudflareStreamId;
    let thumbnailTimeMs = working.publishedThumbnailTimeMs ?? publishedThumbnailTimeMs;

    if (!clientTrimmed && needsTrimClip(working) && !working.clippedStreamId) {
      updatePendingUpload(uploadId, { phase: "processing", progress: 82 });
      // Prefer client-known duration so we don't ask Cloudflare to clip past EOF
      // (a common 400 when camera-roll metadata is slightly longer than encoded duration).
      const sourceDuration = Math.max(
        0.1,
        working.sourceDurationSeconds || working.trimEndSeconds,
      );
      const startTimeSeconds = Math.max(0, Math.min(working.trimStartSeconds, sourceDuration - 0.1));
      const endTimeSeconds = Math.max(
        startTimeSeconds + 0.1,
        Math.min(working.trimEndSeconds, Math.max(0.1, sourceDuration - 0.05)),
      );
      logVideoUploadStep("background trim start", {
        uploadId,
        startTimeSeconds,
        endTimeSeconds,
        sourceDurationSeconds: sourceDuration,
        rawStartTimeSeconds: working.trimStartSeconds,
        rawEndTimeSeconds: working.trimEndSeconds,
      });
      const clipped = await clipStreamVideo({
        cloudflareStreamId,
        startTimeSeconds,
        endTimeSeconds,
        thumbnailTimestampPct: getClipThumbnailPct(working),
      });
      finalStreamId = clipped.cloudflareStreamId;
      thumbnailTimeMs = getClippedThumbnailTimeMs(working);
      updatePendingUpload(uploadId, {
        clippedStreamId: finalStreamId,
        publishedThumbnailTimeMs: thumbnailTimeMs,
      });
      logVideoUploadStep("background trim complete", {
        uploadId,
        cloudflareStreamId: finalStreamId,
      });
    }

    // Don't publish until Stream can actually play — avoids black/unplayable profile opens.
    updatePendingUpload(uploadId, { phase: "processing", progress: 86 });
    const processingPulse = setInterval(() => {
      const current = getPendingUploadById(uploadId);
      if (!current || current.phase !== "processing") return;
      updatePendingUpload(uploadId, {
        phase: "processing",
        progress: Math.min(96, Math.max(86, current.progress + 1)),
      });
    }, 1600);
    try {
      await waitForCloudflareStreamReady(finalStreamId);
    } finally {
      clearInterval(processingPulse);
    }

    updatePendingUpload(uploadId, { phase: "saving", progress: 97 });

    const createdVideo = await createVideo({
      userId: working.userId,
      caption: working.caption,
      roles: working.roles,
      genres: working.genres,
      cloudflareStreamId: finalStreamId,
      thumbnailTimeMs,
      videoFilter: publishFilter,
      textOverlays: publishOverlays,
      lookingFor: working.lookingFor,
    });

    updatePendingUpload(uploadId, { phase: "saving", progress: 100 });

    logVideoUploadStep("background upload complete", {
      uploadId,
      cloudflareStreamId: finalStreamId,
      videoId: createdVideo.id,
      videoFilter: publishFilter,
      textOverlayCount: publishOverlays.length,
      trimmed: clientTrimmed || needsTrimClip(working),
      presentationBaked: clientTrimmed,
    });

    rememberLocalPosterForVideo(createdVideo.id, working.localThumbnailUri);
    removePendingUpload(uploadId);
    notifyPosted({ userId: working.userId, videoId: createdVideo.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    logVideoUploadStep("background upload failed", { uploadId, ...getVideoUploadErrorDetails(error) });
    updatePendingUpload(uploadId, {
      phase: "failed",
      progress: 0,
      errorMessage: message,
    });
  } finally {
    runningUploads.delete(uploadId);
  }
}

export type EnqueuePendingVideoUploadInput = {
  userId: string;
  asset: NativeVideoAsset;
  localThumbnailUri: string | null;
  caption: string;
  roles: string[];
  genres: string[];
  thumbnailTimeMs: number;
  maxDurationSeconds: number;
  sourceDurationSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  videoFilter?: VideoFilterId | string | null;
  textOverlays?: VideoTextOverlay[] | unknown;
  lookingFor?: boolean;
  /** True when asset is already the composed export (skip re-bake). */
  presentationBaked?: boolean;
  bakedAsset?: NativeVideoAsset | null;
};

export function enqueuePendingVideoUpload(input: EnqueuePendingVideoUploadInput) {
  const trimStartSeconds = Math.max(0, input.trimStartSeconds);
  const trimEndSeconds = Math.max(trimStartSeconds + 0.1, input.trimEndSeconds);
  const presentationBaked = Boolean(input.presentationBaked && (input.bakedAsset ?? input.asset));
  const upload: PendingVideoUpload = {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    asset: input.asset,
    localThumbnailUri: input.localThumbnailUri,
    caption: input.caption.trim(),
    roles: input.roles,
    genres: input.genres,
    thumbnailTimeMs: input.thumbnailTimeMs,
    maxDurationSeconds: input.maxDurationSeconds,
    sourceDurationSeconds: Math.max(input.sourceDurationSeconds, trimEndSeconds),
    trimStartSeconds,
    trimEndSeconds,
    videoFilter: presentationBaked ? "none" : normalizeVideoFilter(input.videoFilter),
    textOverlays: presentationBaked ? [] : normalizeVideoTextOverlays(input.textOverlays),
    lookingFor: Boolean(input.lookingFor),
    progress: 1,
    phase: "uploading",
    errorMessage: null,
    presentationBaked,
    bakedAsset: presentationBaked ? (input.bakedAsset ?? input.asset) : null,
    publishedThumbnailTimeMs: presentationBaked ? input.thumbnailTimeMs : null,
  };

  pendingUploads.unshift(upload);
  notify();
  void runPendingUpload(upload.id);
  return upload.id;
}

export function retryPendingVideoUpload(uploadId: string) {
  const upload = getPendingUploadById(uploadId);
  if (!upload) return;
  updatePendingUpload(uploadId, {
    phase: "uploading",
    progress: 1,
    errorMessage: null,
  });
  void runPendingUpload(uploadId);
}
