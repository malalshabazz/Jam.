import { decode as decodeBase64ArrayBuffer } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { cloudflareUploadEndpoint, supabase } from "@/lib/native-supabase";

export type NativeVideoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  /** Pixel size when known (picker / probe). Used for landscape letterboxing. */
  width?: number | null;
  height?: number | null;
};

export type StreamUploadProtocol = "tus" | "basic";

export type StreamUpload = {
  cloudflareStreamId: string;
  uploadUrl: string;
  maxDurationSeconds: number;
  protocol: StreamUploadProtocol;
};

type StreamUploadResponse = Partial<StreamUpload> & {
  uid?: string;
  uploadURL?: string;
  error?: string;
};

/** Cloudflare tus minimum chunk (except final / small whole-file uploads). */
const TUS_CHUNK_SIZE = 5_242_880;

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
  options?: {
    allowLongerSource?: boolean;
    /** Prefer resumable tus when file size is known. */
    uploadLength?: number | null;
  },
) {
  const uploadLength =
    typeof options?.uploadLength === "number" && Number.isFinite(options.uploadLength)
      ? Math.max(0, Math.floor(options.uploadLength))
      : null;

  if (uploadLength && uploadLength > 0) {
    try {
      return await requestStreamUpload(maxDurationSeconds, {
        allowLongerSource: Boolean(options?.allowLongerSource),
        protocol: "tus",
        uploadLength,
      });
    } catch (error) {
      logVideoUploadStep("stream tus create failed — falling back to basic upload", {
        ...getVideoUploadErrorDetails(error),
      });
    }
  }

  return requestStreamUpload(maxDurationSeconds, {
    allowLongerSource: Boolean(options?.allowLongerSource),
    protocol: "basic",
  });
}

async function requestStreamUpload(
  maxDurationSeconds: number,
  options: {
    allowLongerSource?: boolean;
    protocol: StreamUploadProtocol;
    uploadLength?: number;
  },
): Promise<StreamUpload> {
  if (!cloudflareUploadEndpoint) {
    throw new Error("Set EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT to your Next upload endpoint.");
  }

  logVideoUploadStep("stream upload request start", {
    endpointHost: getUrlHost(cloudflareUploadEndpoint),
    maxDurationSeconds,
    allowLongerSource: Boolean(options.allowLongerSource),
    protocol: options.protocol,
    uploadLength: options.uploadLength ?? null,
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
        allowLongerSource: Boolean(options.allowLongerSource),
        protocol: options.protocol,
        uploadLength: options.uploadLength,
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
  const protocol: StreamUploadProtocol =
    data.protocol === "tus" || isTusUploadUrl(uploadUrl) ? "tus" : "basic";

  logVideoUploadStep("stream upload request response", {
    endpointHost: getUrlHost(cloudflareUploadEndpoint),
    status: response.status,
    ok: response.ok,
    hasUploadUrl: Boolean(uploadUrl),
    hasStreamId: Boolean(cloudflareStreamId),
    uploadHost: getUrlHost(uploadUrl),
    protocol,
    error: data.error,
  });

  if (!response.ok || !uploadUrl || !cloudflareStreamId) {
    throw new Error(data.error ?? "Could not start upload.");
  }

  return {
    cloudflareStreamId,
    uploadUrl,
    maxDurationSeconds: data.maxDurationSeconds ?? maxDurationSeconds,
    protocol,
  };
}

export async function resolveLocalFileSize(asset: NativeVideoAsset) {
  if (typeof asset.fileSize === "number" && Number.isFinite(asset.fileSize) && asset.fileSize > 0) {
    return Math.floor(asset.fileSize);
  }
  const info = await FileSystem.getInfoAsync(asset.uri).catch(() => null);
  if (info?.exists && typeof info.size === "number" && info.size > 0) {
    return Math.floor(info.size);
  }
  return null;
}

export function uploadToCloudflare(
  uploadUrl: string,
  asset: NativeVideoAsset,
  onProgress: (progress: number) => void,
  options?: { protocol?: StreamUploadProtocol },
) {
  const protocol =
    options?.protocol === "tus" || isTusUploadUrl(uploadUrl) ? "tus" : "basic";

  if (protocol === "tus") {
    logVideoUploadStep("cloudflare direct upload selected", {
      strategy: "tus-resumable",
      uploadHost: getUrlHost(uploadUrl),
      fileName: normalizeFileName(asset.fileName, asset.uri),
      fileSize: asset.fileSize ?? null,
      mimeType: asset.mimeType ?? inferMimeType(normalizeFileName(asset.fileName, asset.uri)),
      uriScheme: getUriScheme(asset.uri),
    });
    return uploadToCloudflareWithTus(uploadUrl, asset, onProgress);
  }

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

/** Remote Cloudflare HLS master (all rungs). Used for readiness / size probes. */
export function getCloudflareStreamManifestUrl(streamId: string) {
  return `https://videodelivery.net/${streamId}/manifest/video.m3u8`;
}

/**
 * Mbps hint for Cloudflare's clientBandwidthHint — picks the representation
 * closest to this bandwidth. High enough that Stream returns the top (~1080p)
 * rung instead of letting native ABR stick on the lowest ladder step.
 *
 * Must stay on the *master* playlist (not a single media variant URL). Pinning
 * to a variant drops demuxed AUDIO groups and plays silent video.
 */
const PLAYBACK_BANDWIDTH_HINT_MBPS = 25;

/**
 * Playback URL for feed / fullscreen.
 * Prefer the highest Cloudflare rung on good connections (TikTok-style),
 * while keeping audio via the master manifest.
 */
export function getCloudflarePlaybackUrl(streamId: string) {
  return `${getCloudflareStreamManifestUrl(streamId)}?clientBandwidthHint=${PLAYBACK_BANDWIDTH_HINT_MBPS}`;
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
  options?: { height?: number; width?: number },
) {
  // Cloudflare defaults width+height to 640 and fit=crop, which center-crops
  // landscape into a tall/square poster and makes the feed think it's portrait.
  const edge = Math.max(320, options?.height ?? options?.width ?? 1280);
  const width = options?.width ?? edge;
  const height = options?.height ?? edge;
  const rawMs =
    typeof thumbnailTimeMs === "number" && Number.isFinite(thumbnailTimeMs) ? thumbnailTimeMs : 1000;
  // Prefer a non-zero timestamp — exact 0s is often a black camera-open frame.
  const timeSeconds = Math.max(0.1, rawMs <= 0 ? 1 : rawMs / 1000);
  return `https://videodelivery.net/${streamId}/thumbnails/thumbnail.jpg?time=${timeSeconds}s&width=${width}&height=${height}&fit=clip`;
}

/** Largest RESOLUTION=WxH from an HLS master playlist (Cloudflare Stream). */
export async function probeHlsVideoSize(
  manifestUrl: string,
): Promise<{ width: number; height: number } | null> {
  try {
    // Always probe the full adaptive master — playback URLs may be a single
    // high-rung media playlist (no RESOLUTION tags) or a bandwidth-hinted master.
    const streamId = extractCloudflareStreamId(manifestUrl);
    const probeUrl = streamId
      ? getCloudflareStreamManifestUrl(streamId)
      : manifestUrl.split("?")[0] || manifestUrl;
    const response = await fetch(probeUrl);
    if (!response.ok) return null;
    const text = await response.text();
    let best: { width: number; height: number; pixels: number } | null = null;
    for (const match of text.matchAll(/RESOLUTION=(\d+)x(\d+)/gi)) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (!(width > 0 && height > 0)) continue;
      const pixels = width * height;
      if (!best || pixels > best.pixels) {
        best = { width, height, pixels };
      }
    }
    return best ? { width: best.width, height: best.height } : null;
  } catch {
    return null;
  }
}

/** Sum EXTINF from a Cloudflare HLS playlist so thumbnail filmstrips match clip length. */
export async function probeHlsDurationMs(manifestUrl: string): Promise<number | null> {
  try {
    const streamId = extractCloudflareStreamId(manifestUrl);
    const probeUrl = streamId
      ? getCloudflareStreamManifestUrl(streamId)
      : manifestUrl.split("?")[0] || manifestUrl;
    const response = await fetch(probeUrl);
    if (!response.ok) return null;
    let text = await response.text();
    if (text.includes("#EXT-X-STREAM-INF")) {
      const lines = text.split("\n");
      let mediaUri: string | null = null;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
        const next = lines[i + 1]?.trim();
        if (next && !next.startsWith("#")) {
          mediaUri = next;
          break;
        }
      }
      if (!mediaUri) return null;
      const mediaUrl = mediaUri.startsWith("http")
        ? mediaUri
        : new URL(mediaUri, probeUrl).toString();
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) return null;
      text = await mediaResponse.text();
    }
    let durationSeconds = 0;
    for (const match of text.matchAll(/#EXTINF:([0-9.]+)/g)) {
      durationSeconds += Number(match[1]);
    }
    return durationSeconds > 0 ? Math.round(durationSeconds * 1000) : null;
  } catch {
    return null;
  }
}

function getCloudflareStreamApiEndpoint(action: "clip" | "videos" | "publish-check" | "ready") {
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

export function getCloudflarePublishCheckEndpoint() {
  return getCloudflareStreamApiEndpoint("publish-check");
}

export function getCloudflareVideoDeleteEndpoint() {
  // Prefer the deployed uploads endpoint (DELETE + { videoId }). /videos may 404 on older hosts.
  if (cloudflareUploadEndpoint) return cloudflareUploadEndpoint;
  return getCloudflareStreamApiEndpoint("videos");
}

/**
 * Ensures the Stream asset is within the account duration entitlement and marks
 * the upload claim publishable. Required before createVideo when H5 gates apply.
 */
export async function assertStreamPublishable(cloudflareStreamId: string) {
  const endpoint = getCloudflarePublishCheckEndpoint();
  if (!endpoint) {
    // Local/dev without upload endpoint — skip server gate.
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Log in again before uploading.");
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ cloudflareStreamId }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Checking video length took too long. Try again.");
    }
    throw new Error("Could not verify video length. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    publishable?: boolean;
  };

  if (!response.ok || data.publishable !== true) {
    throw new Error(data.error ?? "Video is longer than your account allows. Trim before posting.");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll the public HLS manifest — works without deploying a /ready API route. */
async function isPublicStreamManifestReady(cloudflareStreamId: string) {
  const manifestUrl = getCloudflareStreamManifestUrl(cloudflareStreamId);
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
  // Publish as soon as HLS can play — local posters cover thumb lag.
  const timeoutMs = 90_000;
  const intervalMs = 1_500;
  const started = Date.now();
  let polls = 0;

  logVideoUploadStep("stream ready wait start", {
    strategy: "public-manifest-poll",
    cloudflareStreamId,
  });

  while (Date.now() - started < timeoutMs) {
    polls += 1;
    const manifestReady = await isPublicStreamManifestReady(cloudflareStreamId);
    if (manifestReady) {
      // Best-effort thumb check; never block publish on it.
      const thumbnailReady = await isPublicStreamThumbnailReady(cloudflareStreamId);
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
    details?: {
      startTimeSeconds?: number;
      endTimeSeconds?: number;
      sourceDurationSeconds?: number | null;
      cloudflareErrors?: { message?: string }[];
      cloudflareMessages?: { message?: string }[];
    };
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
    details: data.details ?? null,
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

function isTusUploadUrl(uploadUrl: string | null | undefined) {
  if (!uploadUrl) return false;
  try {
    const url = new URL(uploadUrl);
    return url.pathname.includes("/tus") || url.searchParams.has("tus");
  } catch {
    return /\/tus/i.test(uploadUrl);
  }
}

async function getTusUploadOffset(uploadUrl: string) {
  const response = await fetch(uploadUrl, {
    method: "HEAD",
    headers: {
      "Tus-Resumable": "1.0.0",
    },
  });
  if (response.status === 404 || response.status === 410) {
    throw new Error("Upload session expired. Starting a new upload.");
  }
  if (!response.ok) {
    throw new Error(`Could not resume upload (${response.status}).`);
  }
  const offsetHeader = response.headers.get("Upload-Offset") ?? response.headers.get("upload-offset");
  const offset = offsetHeader ? Number.parseInt(offsetHeader, 10) : 0;
  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error("Could not resume upload (invalid offset).");
  }
  return offset;
}

async function uploadToCloudflareWithTus(
  uploadUrl: string,
  asset: NativeVideoAsset,
  onProgress: (progress: number) => void,
) {
  const fileName = normalizeFileName(asset.fileName, asset.uri);
  const fileInfo = await FileSystem.getInfoAsync(asset.uri).catch(() => null);
  const fileSize =
    fileInfo?.exists && typeof fileInfo.size === "number" && fileInfo.size > 0
      ? fileInfo.size
      : typeof asset.fileSize === "number" && asset.fileSize > 0
        ? asset.fileSize
        : null;

  if (!fileSize) {
    throw new Error("Could not read the video file size for resumable upload.");
  }

  onProgress(1);
  logVideoUploadStep("cloudflare tus upload start", {
    uploadHost: getUrlHost(uploadUrl),
    fileName,
    fileSize,
    chunkSize: TUS_CHUNK_SIZE,
  });

  let offset = 0;
  try {
    offset = await getTusUploadOffset(uploadUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/upload session expired/i.test(message)) throw error;
    // Some endpoints reject HEAD before the first PATCH — start at 0.
    logVideoUploadStep("cloudflare tus offset probe", {
      uploadHost: getUrlHost(uploadUrl),
      ...getVideoUploadErrorDetails(error),
    });
    offset = 0;
  }

  if (offset > 0) {
    onProgress(Math.min(99, Math.max(1, Math.round((offset / fileSize) * 100))));
    logVideoUploadStep("cloudflare tus resume", {
      uploadHost: getUrlHost(uploadUrl),
      offset,
      fileSize,
    });
  }

  try {
    while (offset < fileSize) {
      const chunkLength = Math.min(TUS_CHUNK_SIZE, fileSize - offset);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: offset,
        length: chunkLength,
      });
      const chunk = decodeBase64ArrayBuffer(base64);
      const body = new Uint8Array(chunk);

      const response = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
          "Content-Length": String(body.byteLength),
        },
        body,
      });

      if (response.status === 409) {
        // Offset conflict — re-sync from server.
        offset = await getTusUploadOffset(uploadUrl);
        continue;
      }

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        logVideoUploadStep("cloudflare tus chunk error", {
          uploadHost: getUrlHost(uploadUrl),
          status: response.status,
          offset,
          chunkLength,
          details: details.slice(0, 500),
        });
        throw new Error(
          `Cloudflare Stream upload failed (${response.status}).${details ? ` ${details}` : ""}`,
        );
      }

      const nextOffsetHeader =
        response.headers.get("Upload-Offset") ?? response.headers.get("upload-offset");
      const nextOffset = nextOffsetHeader
        ? Number.parseInt(nextOffsetHeader, 10)
        : offset + body.byteLength;
      if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
        throw new Error("Cloudflare Stream upload stalled (no progress).");
      }
      offset = nextOffset;
      onProgress(Math.min(99, Math.max(1, Math.round((offset / fileSize) * 100))));
    }

    onProgress(100);
    logVideoUploadStep("cloudflare tus upload success", {
      uploadHost: getUrlHost(uploadUrl),
      fileName,
      fileSize,
    });
  } catch (error) {
    logVideoUploadStep("cloudflare tus upload failed", {
      uploadHost: getUrlHost(uploadUrl),
      fileName,
      offset,
      fileSize,
      ...getVideoUploadErrorDetails(error),
    });
    if (error instanceof Error) throw error;
    throw new Error("Cloudflare Stream upload failed. Check your connection and try again.");
  }
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
