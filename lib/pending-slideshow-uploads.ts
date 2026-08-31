import { useEffect, useMemo, useState } from "react";
import { createVideo } from "@/lib/native-social-data";
import type { ProfileVideo } from "@/lib/native-social-data";
import {
  MAX_SLIDESHOW_IMAGES,
  uploadSlideshowAudio,
  uploadSlideshowImages,
  type SlideshowAudioAsset,
  type SlideshowImageAsset,
} from "@/lib/native-slideshow-storage";
import { PENDING_VIDEO_ID_PREFIX, rememberLocalPosterForVideo, notifyPendingUploadPosted } from "@/lib/pending-video-uploads";

export type PendingSlideshowUploadPhase = "uploading" | "saving" | "failed";

export type PendingSlideshowUpload = {
  id: string;
  userId: string;
  images: SlideshowImageAsset[];
  audio: SlideshowAudioAsset | null;
  audioDurationMs: number | null;
  caption: string;
  roles: string[];
  genres: string[];
  lookingFor: boolean;
  progress: number;
  phase: PendingSlideshowUploadPhase;
  errorMessage: string | null;
};

type Listener = () => void;

const pendingSlideshows: PendingSlideshowUpload[] = [];
const listeners = new Set<Listener>();
const running = new Set<string>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePendingSlideshowUploads(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingSlideshowUploads() {
  return pendingSlideshows.slice();
}

export function usePendingSlideshowUploads() {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribePendingSlideshowUploads(() => setVersion((v) => v + 1)), []);
  return useMemo(() => getPendingSlideshowUploads(), [version]);
}

export function pendingSlideshowToProfileVideo(upload: PendingSlideshowUpload): ProfileVideo {
  return {
    id: `${PENDING_VIDEO_ID_PREFIX}${upload.id}`,
    userId: upload.userId,
    caption: upload.caption,
    mediaUrl: upload.images[0]?.uri ?? null,
    media_url: upload.images[0]?.uri ?? null,
    cloudflareStreamId: null,
    roles: upload.roles,
    genres: upload.genres,
    lookingFor: upload.lookingFor,
    looking_for: upload.lookingFor,
    mediaType: "slideshow",
    media_type: "slideshow",
    imageUrls: upload.images.map((image) => image.uri),
    image_urls: upload.images.map((image) => image.uri),
    audioUrl: upload.audio?.uri ?? null,
    audio_url: upload.audio?.uri ?? null,
    audioDurationMs: upload.audioDurationMs,
    audio_duration_ms: upload.audioDurationMs,
    created_at: new Date().toISOString(),
  };
}

export function getPendingSlideshowUploadById(id: string) {
  return pendingSlideshows.find((upload) => upload.id === id) ?? null;
}

export function retryPendingSlideshowUpload(uploadId: string) {
  const upload = getPendingSlideshowUploadById(uploadId);
  if (!upload || upload.phase !== "failed") return;
  updateUpload(uploadId, { phase: "uploading", progress: 0, errorMessage: null });
  void runSlideshowUpload(uploadId);
}

export function enqueuePendingSlideshowUpload(input: {
  userId: string;
  images: SlideshowImageAsset[];
  audio?: SlideshowAudioAsset | null;
  audioDurationMs?: number | null;
  caption: string;
  roles: string[];
  genres: string[];
  lookingFor?: boolean;
}) {
  if (input.images.length === 0 || input.images.length > MAX_SLIDESHOW_IMAGES) {
    throw new Error(`Select 1–${MAX_SLIDESHOW_IMAGES} photos.`);
  }
  const id = `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const upload: PendingSlideshowUpload = {
    id,
    userId: input.userId,
    images: input.images,
    audio: input.audio ?? null,
    audioDurationMs:
      typeof input.audioDurationMs === "number" && Number.isFinite(input.audioDurationMs)
        ? Math.max(0, Math.round(input.audioDurationMs))
        : null,
    caption: input.caption,
    roles: input.roles,
    genres: input.genres,
    lookingFor: Boolean(input.lookingFor),
    progress: 0,
    phase: "uploading",
    errorMessage: null,
  };
  pendingSlideshows.unshift(upload);
  emit();
  void runSlideshowUpload(id);
  return id;
}

async function runSlideshowUpload(id: string) {
  if (running.has(id)) return;
  const upload = pendingSlideshows.find((entry) => entry.id === id);
  if (!upload) return;
  running.add(id);

  try {
    updateUpload(id, { phase: "uploading", progress: 0.05, errorMessage: null });
    const imageUrls = await uploadSlideshowImages(upload.userId, id, upload.images);
    updateUpload(id, { progress: 0.7 });
    const audioUrl = upload.audio?.uri
      ? await uploadSlideshowAudio(upload.userId, id, upload.audio)
      : null;
    updateUpload(id, { phase: "saving", progress: 0.85 });

    const created = await createVideo({
      userId: upload.userId,
      caption: upload.caption,
      roles: upload.roles,
      genres: upload.genres,
      lookingFor: upload.lookingFor,
      mediaType: "slideshow",
      imageUrls,
      audioUrl,
      audioDurationMs: upload.audioDurationMs,
      mediaUrl: imageUrls[0] ?? null,
      cloudflareStreamId: null,
    });

    if (upload.images[0]?.uri) {
      rememberLocalPosterForVideo(created.id, upload.images[0].uri);
    }
    notifyPendingUploadPosted({ userId: upload.userId, videoId: created.id });

    const index = pendingSlideshows.findIndex((entry) => entry.id === id);
    if (index >= 0) pendingSlideshows.splice(index, 1);
    emit();
  } catch (error) {
    updateUpload(id, {
      phase: "failed",
      progress: 0,
      errorMessage: error instanceof Error ? error.message : "could not post slideshow",
    });
  } finally {
    running.delete(id);
  }
}

function updateUpload(id: string, patch: Partial<PendingSlideshowUpload>) {
  const index = pendingSlideshows.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  pendingSlideshows[index] = { ...pendingSlideshows[index], ...patch };
  emit();
}
