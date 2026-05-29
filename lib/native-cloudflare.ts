import { cloudflareUploadEndpoint, supabase } from "@/lib/native-supabase";

export type NativeVideoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type StreamUpload = {
  cloudflareStreamId: string;
  uploadUrl: string;
  maxDurationSeconds: number;
};

export async function createStreamUpload(maxDurationSeconds: number) {
  if (!cloudflareUploadEndpoint) {
    throw new Error("Set EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT to your Next upload endpoint.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(cloudflareUploadEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ maxDurationSeconds }),
  });

  const data = (await response.json()) as Partial<StreamUpload> & {
    error?: string;
  };

  if (!response.ok || !data.uploadUrl || !data.cloudflareStreamId) {
    throw new Error(data.error ?? "Could not start upload.");
  }

  return data as StreamUpload;
}

export function uploadToCloudflare(
  uploadUrl: string,
  asset: NativeVideoAsset,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", {
      uri: asset.uri,
      name: asset.fileName ?? `jam-video-${Date.now()}.mp4`,
      type: asset.mimeType ?? "video/mp4",
    } as unknown as Blob);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Cloudflare Stream upload failed."));
    };
    request.onerror = () => reject(new Error("Cloudflare Stream upload failed."));
    request.open("POST", uploadUrl);
    request.send(formData);
  });
}

export function getCloudflarePlaybackUrl(streamId: string) {
  return `https://videodelivery.net/${streamId}/manifest/video.m3u8`;
}
