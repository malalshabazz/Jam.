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

export async function createStreamUpload(maxDurationSeconds: number) {
  if (!cloudflareUploadEndpoint) {
    throw new Error("Set EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT to your Next upload endpoint.");
  }

  logVideoUploadStep("stream upload request start", {
    endpointHost: getUrlHost(cloudflareUploadEndpoint),
    maxDurationSeconds,
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
      body: JSON.stringify({ maxDurationSeconds }),
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
  logVideoUploadStep("cloudflare direct upload selected", {
    strategy: "native-file-system-multipart",
    uploadHost: getUrlHost(uploadUrl),
    fileName: normalizeFileName(asset.fileName, asset.uri),
    fileSize: asset.fileSize ?? null,
    mimeType: asset.mimeType ?? inferMimeType(normalizeFileName(asset.fileName, asset.uri)),
    uriScheme: getUriScheme(asset.uri),
  });
  return uploadToCloudflareWithFileSystem(uploadUrl, asset, onProgress);
}

export function getCloudflarePlaybackUrl(streamId: string) {
  return `https://videodelivery.net/${streamId}/manifest/video.m3u8`;
}

export function getCloudflareDownloadUrl(streamId: string) {
  return `https://videodelivery.net/${streamId}/downloads/default.mp4`;
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
