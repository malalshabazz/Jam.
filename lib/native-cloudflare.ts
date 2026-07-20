import * as FileSystem from "expo-file-system/legacy";
import { cloudflareUploadEndpoint, supabase } from "@/lib/native-supabase";

export type NativeVideoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type StreamUpload = {
  cloudflareStreamId: string;
  uploadUrl: string;
  maxDurationSeconds: number;
};

type StreamUploadResponse = Partial<StreamUpload> & {
  uid?: string;
  uploadURL?: string;
  error?: string;
};

export function logVideoUploadStep(step: string, details?: Record<string, unknown>) {
  console.log(`[video upload] ${step}`, details ?? {});
}

export function getVideoUploadErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: "code" in error ? (error as { code?: unknown }).code : undefined,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

export async function createStreamUpload(
  maxDurationSeconds: number,
  options?: { allowLongerSource?: boolean },
) {
  if (!cloudflareUploadEndpoint) {
    throw new Error("Set EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT to your Next upload endpoint.");
  }

  logVideoUploadStep("stream upload request start", {
    endpointHost: getUrlHost(cloudflareUploadEndpoint),
    maxDurationSeconds,
    allowLongerSource: Boolean(options?.allowLongerSource),
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    logVideoUploadStep("stream upload request blocked", { reason: "missing-session" });
    throw new Error("Log in again before uploading.");
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    response = await fetch(cloudflareUploadEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        maxDurationSeconds,
        allowLongerSource: Boolean(options?.allowLongerSource),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    logVideoUploadStep("stream upload request network error", getVideoUploadErrorDetails(error));
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The upload server took too long to respond. Try again.");
    }
    throw new Error("Could not reach the upload server. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as StreamUploadResponse;
  const cloudflareStreamId = data.cloudflareStreamId ?? data.uid;
  const uploadUrl = data.uploadUrl ?? data.uploadURL;

  logVideoUploadStep("stream upload request response", {
    endpointHost: getUrlHost(cloudflareUploadEndpoint),
    status: response.status,
    ok: response.ok,
    hasUploadUrl: Boolean(uploadUrl),
    hasStreamId: Boolean(cloudflareStreamId),
    uploadHost: getUrlHost(uploadUrl),
    error: data.error,
  });

  if (!response.ok || !uploadUrl || !cloudflareStreamId) {
    throw new Error(data.error ?? "Could not start upload.");
  }

  return {
    cloudflareStreamId,
    uploadUrl,
    maxDurationSeconds: data.maxDurationSeconds ?? maxDurationSeconds,
  };
}

export function uploadToCloudflare(
  uploadUrl: string,
  asset: NativeVideoAsset,
  onProgress: (progress: number) => void,
) {
  const uploadUrls = getCloudflareUploadUrlCandidates(uploadUrl);
  logVideoUploadStep("cloudflare direct upload selected", {
    strategy: "native-file-system-multipart",
    uploadHost: getUrlHost(uploadUrls[0]),
    fallbackUploadHost: uploadUrls[1] ? getUrlHost(uploadUrls[1]) : null,
    fileName: normalizeFileName(asset.fileName, asset.uri),
    fileSize: asset.fileSize ?? null,
    mimeType: asset.mimeType ?? inferMimeType(normalizeFileName(asset.fileName, asset.uri)),
    uriScheme: getUriScheme(asset.uri),
  });
  return uploadToCloudflareWithFallbacks(uploadUrls, asset, onProgress);
}

export function getCloudflarePlaybackUrl(streamId: string) {
  // Adaptive HLS (no bandwidth lock): start on a light rung for fast first frame,
  // then let the player ramp quality — same idea as TikTok-style feeds.
  return `https://videodelivery.net/${streamId}/manifest/video.m3u8`;
}

export function getCloudflareDownloadUrl(streamId: string) {
  return `https://videodelivery.net/${streamId}/downloads/default.mp4`;
}

export function extractCloudflareStreamId(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return null;
  const match = mediaUrl.match(
    /(?:videodelivery\.net|cloudflarestream\.com)\/([a-f0-9]{32}|[a-zA-Z0-9_-]{10,})/i,
  );
  return match?.[1] ?? null;
}

export function getCloudflareThumbnailUrl(
  streamId: string,
  thumbnailTimeMs?: number | null,
  options?: { height?: number },
) {
  const height = options?.height ?? 640;
  const rawMs =
    typeof thumbnailTimeMs === "number" && Number.isFinite(thumbnailTimeMs) ? thumbnailTimeMs : 1000;
  // Prefer a non-zero timestamp — exact 0s is often a black camera-open frame.
  const timeSeconds = Math.max(0.1, rawMs <= 0 ? 1 : rawMs / 1000);
  return `https://videodelivery.net/${streamId}/thumbnails/thumbnail.jpg?time=${timeSeconds}s&height=${height}`;
}

function getCloudflareStreamApiEndpoint(action: "clip" | "videos" | "ready") {
  if (!cloudflareUploadEndpoint) return "";
  try {
    const url = new URL(cloudflareUploadEndpoint);
    if (url.pathname.endsWith("/uploads")) {
      url.pathname = url.pathname.replace(/\/uploads\/?$/, `/${action}`);
      return url.toString();
    }
    if (url.pathname.includes("/cloudflare-stream/")) {
      url.pathname = url.pathname.replace(/\/[^/]*\/?$/, `/${action}`);
      return url.toString();
    }
  } catch {
    return "";
  }
  return "";
}

export function getCloudflareClipEndpoint() {
  return getCloudflareStreamApiEndpoint("clip");
}

export function getCloudflareVideoDeleteEndpoint() {
  // Prefer the deployed uploads endpoint (DELETE + { videoId }). /videos may 404 on older hosts.
  if (cloudflareUploadEndpoint) return cloudflareUploadEndpoint;
  return getCloudflareStreamApiEndpoint("videos");
}

export function getCloudflareReadyEndpoint() {
  return getCloudflareStreamApiEndpoint("ready");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll the public HLS manifest — works without deploying a /ready API route. */
async function isPublicStreamManifestReady(cloudflareStreamId: string) {
  const manifestUrl = getCloudflarePlaybackUrl(cloudflareStreamId);
  try {
    const response = await fetch(manifestUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
      },
    });
    if (!response.ok) return false;
    const text = await response.text();
    return text.includes("#EXTM3U");
  } catch {
    return false;
  }
}

/** Thumbnails can lag briefly behind the HLS manifest becoming available. */
async function isPublicStreamThumbnailReady(cloudflareStreamId: string) {
  const thumbnailUrl = getCloudflareThumbnailUrl(cloudflareStreamId, 1000, { height: 320 });
  try {
    const response = await fetch(thumbnailUrl, { method: "GET" });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) return false;
    const bytes = await response.arrayBuffer();
    return bytes.byteLength > 500;
  } catch {
    return false;
  }
}

export async function waitForCloudflareStreamReady(cloudflareStreamId: string) {
  const timeoutMs = 120_000;
  const thumbnailGraceMs = 45_000;
  const intervalMs = 2_000;
  const started = Date.now();
  let polls = 0;
  let manifestReadyAt: number | null = null;

  logVideoUploadStep("stream ready wait start", {
    strategy: "public-manifest-and-thumbnail-poll",
    cloudflareStreamId,
  });

  while (Date.now() - started < timeoutMs) {
    polls += 1;
    const manifestReady = await isPublicStreamManifestReady(cloudflareStreamId);
    if (!manifestReady) {
      await sleep(intervalMs);
      continue;
    }

    if (manifestReadyAt == null) {
      manifestReadyAt = Date.now();
      logVideoUploadStep("stream ready manifest available", {
        cloudflareStreamId,
        polls,
        elapsedMs: Date.now() - started,
      });
    }

    const thumbnailReady = await isPublicStreamThumbnailReady(cloudflareStreamId);
    if (thumbnailReady || Date.now() - manifestReadyAt >= thumbnailGraceMs) {
      logVideoUploadStep("stream ready wait response", {
        ok: true,
        ready: true,
        thumbnailReady,
        polls,
        elapsedMs: Date.now() - started,
      });
      return { ready: true as const };
    }

    await sleep(intervalMs);
  }

  logVideoUploadStep("stream ready wait response", {
    ok: false,
    ready: false,
    polls,
    elapsedMs: Date.now() - started,
  });
  throw new Error("Video processing took too long. Try again.");
}

export async function deleteCloudflareVideo(videoId: string) {
  const deleteEndpoint = getCloudflareVideoDeleteEndpoint();
  if (!deleteEndpoint) {
    throw new Error("Set EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT so video deletion can remove Stream media.");
  }

  logVideoUploadStep("stream delete request start", {
    endpointHost: getUrlHost(deleteEndpoint),
    videoId,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Log in again before deleting.");
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    response = await fetch(deleteEndpoint, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ videoId }),
      signal: controller.signal,
    });
  } catch (error) {
    logVideoUploadStep("stream delete request network error", getVideoUploadErrorDetails(error));
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Deleting the video took too long. Try again.");
    }
    throw new Error("Could not delete the video. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as {
    deleted?: boolean;
    error?: string;
  };

  logVideoUploadStep("stream delete request response", {
    status: response.status,
    ok: response.ok,
    deleted: Boolean(data.deleted),
    error: data.error,
  });

  if (response.ok && data.deleted) {
    return { deleted: true as const, viaApi: true as const };
  }

  // Route missing / not deployed yet — let the caller remove the DB row locally.
  if (response.status === 404 || response.status === 405) {
    return { deleted: false as const, viaApi: false as const, unavailable: true as const };
  }

  throw new Error(data.error ?? "Could not delete video.");
}

export async function clipStreamVideo(input: {
  cloudflareStreamId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  thumbnailTimestampPct?: number;
}) {
  const clipEndpoint = getCloudflareClipEndpoint();
  if (!clipEndpoint) {
    throw new Error("Set EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT so trim can use the clip API.");
  }

  logVideoUploadStep("stream clip request start", {
    endpointHost: getUrlHost(clipEndpoint),
    startTimeSeconds: input.startTimeSeconds,
    endTimeSeconds: input.endTimeSeconds,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Log in again before uploading.");
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    response = await fetch(clipEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        cloudflareStreamId: input.cloudflareStreamId,
        startTimeSeconds: input.startTimeSeconds,
        endTimeSeconds: input.endTimeSeconds,
        thumbnailTimestampPct: input.thumbnailTimestampPct,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    logVideoUploadStep("stream clip request network error", getVideoUploadErrorDetails(error));
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Trimming the video took too long. Try again.");
    }
    throw new Error("Could not trim the video. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as {
    cloudflareStreamId?: string;
    error?: string;
  };

  if (response.status === 404) {
    throw new Error(
      "Trim is unavailable on the upload server. Redeploy the app API, or post the full clip without trimming.",
    );
  }

  logVideoUploadStep("stream clip request response", {
    status: response.status,
    ok: response.ok,
    hasStreamId: Boolean(data.cloudflareStreamId),
    error: data.error,
  });

  if (!response.ok || !data.cloudflareStreamId) {
    throw new Error(data.error ?? "Could not trim video.");
  }

  return { cloudflareStreamId: data.cloudflareStreamId };
}

function normalizeFileName(fileName: string | null | undefined, uri: string) {
  const name = fileName?.trim() || uri.split("/").pop() || `jam-video-${Date.now()}.mp4`;
  return name.includes(".") ? name : `${name}.mp4`;
}

function inferMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "mov") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  if (extension === "m4v") return "video/x-m4v";
  return "video/mp4";
}

async function uploadToCloudflareWithFallbacks(
  uploadUrls: string[],
  asset: NativeVideoAsset,
  onProgress: (progress: number) => void,
) {
  let lastError: unknown = null;

  for (const [index, uploadUrl] of uploadUrls.entries()) {
    try {
      if (index > 0) {
        logVideoUploadStep("cloudflare direct upload fallback start", {
          uploadHost: getUrlHost(uploadUrl),
          attempt: index + 1,
        });
        onProgress(1);
      }
      await uploadToCloudflareWithFileSystem(uploadUrl, asset, onProgress);
      return;
    } catch (error) {
      lastError = error;
      if (index >= uploadUrls.length - 1) break;
      logVideoUploadStep("cloudflare direct upload fallback queued", {
        failedUploadHost: getUrlHost(uploadUrl),
        nextUploadHost: getUrlHost(uploadUrls[index + 1]),
        ...getVideoUploadErrorDetails(error),
      });
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Cloudflare Stream upload failed. Check your connection and try again.");
}

async function uploadToCloudflareWithFileSystem(
  uploadUrl: string,
  asset: NativeVideoAsset,
  onProgress: (progress: number) => void,
) {
  const fileName = normalizeFileName(asset.fileName, asset.uri);
  const mimeType = asset.mimeType ?? inferMimeType(fileName);

  onProgress(1);
  const fileInfo = await FileSystem.getInfoAsync(asset.uri).catch(() => null);
  logVideoUploadStep("cloudflare direct upload start", {
    strategy: "native-file-system-multipart",
    uploadHost: getUrlHost(uploadUrl),
    fileName,
    fileSize: fileInfo?.exists ? fileInfo.size : asset.fileSize ?? null,
    mimeType,
  });

  try {
    const uploadTask = FileSystem.createUploadTask(uploadUrl, asset.uri, {
      fieldName: "file",
      httpMethod: "POST",
      mimeType,
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    }, ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend <= 0) return;
      const nextProgress = Math.min(
        99,
        Math.max(1, Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)),
      );
      onProgress(nextProgress);
    });

    const response = await uploadTask.uploadAsync();
    if (!response) {
      throw new Error("Cloudflare Stream upload was cancelled.");
    }

    if (response.status < 200 || response.status >= 300) {
      logVideoUploadStep("cloudflare direct upload response error", {
        uploadHost: getUrlHost(uploadUrl),
        status: response.status,
        details: response.body.slice(0, 500),
      });
      throw new Error(`Cloudflare Stream upload failed (${response.status}).${response.body ? ` ${response.body}` : ""}`);
    }

    onProgress(100);
    logVideoUploadStep("cloudflare direct upload success", {
      status: response.status,
      uploadHost: getUrlHost(uploadUrl),
      fileName,
    });
  } catch (error) {
    logVideoUploadStep("cloudflare direct upload failed", {
      uploadHost: getUrlHost(uploadUrl),
      fileName,
      ...getVideoUploadErrorDetails(error),
    });
    if (error instanceof Error) throw error;
    throw new Error("Cloudflare Stream upload failed. Check your connection and try again.");
  }
}

function getUrlHost(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function getUriScheme(uri: string) {
  return uri.split(":")[0] || "unknown";
}

function getCloudflareUploadUrlCandidates(uploadUrl: string) {
  const candidates = [uploadUrl];

  try {
    const url = new URL(uploadUrl);
    if (url.host === "upload.cloudflarestream.com") {
      url.host = "upload.videodelivery.net";
      candidates.push(url.toString());
    }
  } catch {
    return candidates;
  }

  return candidates;
}
