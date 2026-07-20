import { useEffect, useMemo, useState } from "react";
import { createVideo } from "@/lib/native-social-data";
import type { ProfileVideo } from "@/lib/native-social-data";
import {
  clipStreamVideo,
  createStreamUpload,
  getVideoUploadErrorDetails,
  logVideoUploadStep,
  uploadToCloudflare,
  waitForCloudflareStreamReady,
  type NativeVideoAsset,
} from "@/lib/native-cloudflare";
import {
  normalizeVideoFilter,
  normalizeVideoTextOverlays,
  type VideoFilterId,
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
  progress: number;
  phase: PendingVideoUploadPhase;
  errorMessage: string | null;
  /** Set after bytes land on Stream so retries can resume without re-uploading. */
  cloudflareStreamId?: string | null;
  /** Set after clip succeeds (trimmed posts). */
  clippedStreamId?: string | null;
  publishedThumbnailTimeMs?: number | null;
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

export function getPendingUploads() {
  return pendingUploads;
}

export function getPendingUploadsForUser(userId: string) {
  return pendingUploads.filter((upload) => upload.userId === userId);
}

export function getActivePendingUploadsForUser(userId: string) {
  return getPendingUploadsForUser(userId).filter((upload) => upload.phase !== "failed");
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
    let cloudflareStreamId: string | null = upload.cloudflareStreamId ?? null;
    let lastError: unknown = null;
    const uploadMaxDurationSeconds = Math.max(
      upload.maxDurationSeconds,
      Math.ceil(upload.sourceDurationSeconds) + 2,
    );

    if (cloudflareStreamId) {
      logVideoUploadStep("background upload resume after prior success", {
        uploadId,
        cloudflareStreamId,
        clippedStreamId: upload.clippedStreamId ?? null,
      });
      updatePendingUpload(uploadId, { phase: "uploading", progress: Math.max(upload.progress, 78) });
    } else {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          logVideoUploadStep("background upload attempt start", { uploadId, attempt });
          const uploadRequest = await createStreamUpload(uploadMaxDurationSeconds, {
            allowLongerSource: needsTrimClip(upload) || upload.sourceDurationSeconds > upload.maxDurationSeconds,
          });
          await uploadToCloudflare(uploadRequest.uploadUrl, upload.asset, (nextProgress) => {
            updatePendingUpload(uploadId, {
              phase: "uploading",
              progress: Math.min(78, Math.max(1, Math.round(nextProgress * 0.78))),
            });
          });
          cloudflareStreamId = uploadRequest.cloudflareStreamId;
          updatePendingUpload(uploadId, { cloudflareStreamId });
          break;
        } catch (error) {
          lastError = error;
          cloudflareStreamId = null;
          logVideoUploadStep("background upload attempt failed", {
            uploadId,
            attempt,
            ...getVideoUploadErrorDetails(error),
          });
        }
      }
    }

    if (!cloudflareStreamId) {
      throw lastError instanceof Error ? lastError : new Error("Upload failed.");
    }

    let finalStreamId = upload.clippedStreamId ?? cloudflareStreamId;
    let thumbnailTimeMs = upload.publishedThumbnailTimeMs ?? upload.thumbnailTimeMs;

    if (needsTrimClip(upload) && !upload.clippedStreamId) {
      updatePendingUpload(uploadId, { phase: "processing", progress: 82 });
      logVideoUploadStep("background trim start", {
        uploadId,
        startTimeSeconds: upload.trimStartSeconds,
        endTimeSeconds: upload.trimEndSeconds,
      });
      const clipped = await clipStreamVideo({
        cloudflareStreamId,
        startTimeSeconds: upload.trimStartSeconds,
        endTimeSeconds: upload.trimEndSeconds,
        thumbnailTimestampPct: getClipThumbnailPct(upload),
      });
      finalStreamId = clipped.cloudflareStreamId;
      thumbnailTimeMs = getClippedThumbnailTimeMs(upload);
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
      userId: upload.userId,
      caption: upload.caption,
      roles: upload.roles,
      genres: upload.genres,
      cloudflareStreamId: finalStreamId,
      thumbnailTimeMs,
      videoFilter: upload.videoFilter,
      textOverlays: upload.textOverlays,
    });

    updatePendingUpload(uploadId, { phase: "saving", progress: 100 });

    logVideoUploadStep("background upload complete", {
      uploadId,
      cloudflareStreamId: finalStreamId,
      videoId: createdVideo.id,
      videoFilter: upload.videoFilter,
      textOverlayCount: upload.textOverlays.length,
      trimmed: needsTrimClip(upload),
    });

    rememberLocalPosterForVideo(createdVideo.id, upload.localThumbnailUri);
    removePendingUpload(uploadId);
    notifyPosted({ userId: upload.userId, videoId: createdVideo.id });
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
};

export function enqueuePendingVideoUpload(input: EnqueuePendingVideoUploadInput) {
  const trimStartSeconds = Math.max(0, input.trimStartSeconds);
  const trimEndSeconds = Math.max(trimStartSeconds + 0.1, input.trimEndSeconds);
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
    videoFilter: normalizeVideoFilter(input.videoFilter),
    textOverlays: normalizeVideoTextOverlays(input.textOverlays),
    progress: 1,
    phase: "uploading",
    errorMessage: null,
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
