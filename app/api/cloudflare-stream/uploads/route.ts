import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllowedMaxVideoSeconds } from "@/lib/pro-entitlements";

type CloudflareDirectUploadResponse = {
  success: boolean;
  errors?: { message?: string; code?: number }[];
  result?: {
    uid: string;
    uploadURL: string;
  };
};

const DEFAULT_MAX_DURATION_SECONDS = 45;
type ProfileDurationRow = {
  early_adopter: boolean | null;
  video_count: number | null;
  pro_subscription_active: boolean | null;
};
type AccountVideoRow = {
  cloudflare_stream_id: string | null;
};

export async function POST(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.match(/^Bearer (.+)$/)?.[1];

  logUploadApiStep("request received", {
    hasAuthorization: Boolean(accessToken),
    hasAccountId: Boolean(accountId),
    hasApiToken: Boolean(apiToken),
  });

  if (!accessToken) {
    logUploadApiStep("request rejected", { reason: "missing-auth" });
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAuthenticatedClient(accessToken);
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);

  if (!user) {
    logUploadApiStep("request rejected", { reason: "invalid-user" });
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!accountId || !apiToken) {
    logUploadApiStep("request rejected", { reason: "missing-cloudflare-config" });
    return Response.json(
      { error: "Cloudflare Stream is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    maxDurationSeconds?: number;
    allowLongerSource?: boolean;
    protocol?: "tus" | "basic";
    uploadLength?: number;
  };
  const { data: profile } = await supabase
    .from("profiles")
    .select("early_adopter, video_count, pro_subscription_active")
    .eq("id", user.id)
    .maybeSingle<ProfileDurationRow>();
  const allowedMaxDurationSeconds = getAllowedMaxVideoSeconds({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });
  const maxDurationSeconds = getMaxDurationSeconds(
    body.maxDurationSeconds,
    allowedMaxDurationSeconds,
    Boolean(body.allowLongerSource),
  );
  const uploadLength =
    typeof body.uploadLength === "number" && Number.isFinite(body.uploadLength)
      ? Math.max(0, Math.floor(body.uploadLength))
      : null;
  const useTus = body.protocol === "tus" || (uploadLength != null && uploadLength > 0);

  if (useTus) {
    if (!uploadLength || uploadLength <= 0) {
      return Response.json(
        { error: "uploadLength is required for resumable uploads." },
        { status: 400 },
      );
    }
    return createTusDirectUpload({
      accountId,
      apiToken,
      userId: user.id,
      maxDurationSeconds,
      allowedMaxDurationSeconds,
      requestedDuration: body.maxDurationSeconds ?? null,
      uploadLength,
    });
  }

  logUploadApiStep("cloudflare direct upload create start", {
    maxDurationSeconds,
    allowedMaxDurationSeconds,
    requestedDuration: body.maxDurationSeconds ?? null,
    protocol: "basic",
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs: false,
          // Ownership tags used by clip/delete APIs to prevent Stream IDOR.
          creator: user.id,
          meta: { jam_user_id: user.id },
        }),
      },
    );
  } catch (error) {
    logUploadApiStep("cloudflare direct upload create network error", getErrorDetails(error));
    return Response.json(
      { error: "Could not reach Cloudflare Stream." },
      { status: 502 },
    );
  }

  const data = (await response.json().catch(() => ({}))) as CloudflareDirectUploadResponse;
  logUploadApiStep("cloudflare direct upload create response", {
    status: response.status,
    ok: response.ok,
    success: data.success,
    hasResult: Boolean(data.result),
    uploadHost: getUrlHost(data.result?.uploadURL),
    cloudflareErrorCode: data.errors?.[0]?.code,
    cloudflareErrorMessage: data.errors?.[0]?.message,
    protocol: "basic",
  });

  if (!response.ok || !data.success || !data.result) {
    const cloudflareError = data.errors?.[0];
    const permissionMessage =
      response.status === 401 || response.status === 403
        ? "Cloudflare Stream API token must include Stream read and write/edit permissions for this account."
        : null;

    return Response.json(
      {
        error:
          permissionMessage ??
          cloudflareError?.message ??
          "Could not create a Cloudflare Stream upload.",
        cloudflareStatus: response.status,
        cloudflareErrorCode: cloudflareError?.code,
      },
      { status: response.status || 500 },
    );
  }

  return Response.json({
    cloudflareStreamId: data.result.uid,
    uploadUrl: data.result.uploadURL,
    maxDurationSeconds,
    protocol: "basic",
  });
}

async function createTusDirectUpload(input: {
  accountId: string;
  apiToken: string;
  userId: string;
  maxDurationSeconds: number;
  allowedMaxDurationSeconds: number;
  requestedDuration: number | null;
  uploadLength: number;
}) {
  logUploadApiStep("cloudflare tus upload create start", {
    maxDurationSeconds: input.maxDurationSeconds,
    allowedMaxDurationSeconds: input.allowedMaxDurationSeconds,
    requestedDuration: input.requestedDuration,
    uploadLength: input.uploadLength,
    protocol: "tus",
  });

  // Tus metadata: key + space + base64(value). Omit requiresignedurls (default false).
  // Custom ownership is set via Stream edit after create — TUS metadata only allows reserved keys.
  const metadata = `maxDurationSeconds ${Buffer.from(String(input.maxDurationSeconds), "utf8").toString("base64")}`;

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiToken}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(input.uploadLength),
          "Upload-Metadata": metadata,
        },
      },
    );
  } catch (error) {
    logUploadApiStep("cloudflare tus upload create network error", getErrorDetails(error));
    return Response.json(
      { error: "Could not reach Cloudflare Stream." },
      { status: 502 },
    );
  }

  const uploadUrl =
    response.headers.get("Location") ??
    response.headers.get("location");
  const cloudflareStreamId =
    response.headers.get("stream-media-id") ??
    response.headers.get("Stream-Media-Id");

  logUploadApiStep("cloudflare tus upload create response", {
    status: response.status,
    ok: response.ok,
    hasUploadUrl: Boolean(uploadUrl),
    hasStreamId: Boolean(cloudflareStreamId),
    uploadHost: getUrlHost(uploadUrl),
    protocol: "tus",
  });

  if (!response.ok || !uploadUrl || !cloudflareStreamId) {
    const data = (await response.json().catch(() => ({}))) as {
      errors?: { message?: string; code?: number }[];
    };
    const cloudflareError = data.errors?.[0];
    const permissionMessage =
      response.status === 401 || response.status === 403
        ? "Cloudflare Stream API token must include Stream read and write/edit permissions for this account."
        : null;

    return Response.json(
      {
        error:
          permissionMessage ??
          cloudflareError?.message ??
          "Could not create a Cloudflare Stream resumable upload.",
        cloudflareStatus: response.status,
        cloudflareErrorCode: cloudflareError?.code,
      },
      { status: response.status || 500 },
    );
  }

  // Bind the placeholder Stream asset to this Jam user before the client uploads bytes.
  const ownershipResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/stream/${cloudflareStreamId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creator: input.userId,
        meta: { jam_user_id: input.userId },
      }),
    },
  ).catch(() => null);

  if (!ownershipResponse?.ok) {
    // Best-effort cleanup so we don't leave an unowned upload slot.
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/stream/${cloudflareStreamId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${input.apiToken}` },
      },
    ).catch(() => undefined);
    return Response.json(
      { error: "Could not claim upload ownership." },
      { status: 502 },
    );
  }

  return Response.json({
    cloudflareStreamId,
    uploadUrl,
    maxDurationSeconds: input.maxDurationSeconds,
    protocol: "tus",
  });
}

export async function DELETE(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.match(/^Bearer (.+)$/)?.[1];

  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAuthenticatedClient(accessToken);
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    videoId?: string;
    currentPassword?: string;
  };

  // Single-video delete from the app (Stream media + DB row).
  if (typeof body.videoId === "string" && body.videoId.trim()) {
    return deleteOwnedVideo({
      supabase,
      userId: user.id,
      videoId: body.videoId.trim(),
      accountId,
      apiToken,
    });
  }

  if (!body.currentPassword || !user.email) {
    return Response.json({ error: "Your current password is required." }, { status: 400 });
  }

  const passwordClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error: passwordError } = await passwordClient.auth.signInWithPassword({
    email: user.email,
    password: body.currentPassword,
  });
  if (passwordError) {
    return Response.json({ error: "Your current password is incorrect." }, { status: 401 });
  }

  if (!serviceRoleKey) {
    return Response.json(
      { error: "Account deletion is not configured." },
      { status: 500 },
    );
  }

  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("cloudflare_stream_id")
    .eq("user_id", user.id)
    .returns<AccountVideoRow[]>();
  if (videosError) {
    return Response.json({ error: "Could not load account videos." }, { status: 500 });
  }

  const streamIds = [...new Set(
    (videos ?? [])
      .map((video) => video.cloudflare_stream_id)
      .filter((streamId): streamId is string => Boolean(streamId)),
  )];

  if (streamIds.length > 0 && (!accountId || !apiToken)) {
    return Response.json(
      { error: "Video deletion is not configured. Your account was not deleted." },
      { status: 500 },
    );
  }

  for (const streamId of streamIds) {
    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(streamId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiToken}` },
        },
      );
    } catch {
      return Response.json(
        { error: "Could not delete your uploaded videos. Your account was not deleted." },
        { status: 502 },
      );
    }

    if (!response.ok && response.status !== 404) {
      return Response.json(
        { error: "Could not delete your uploaded videos. Your account was not deleted." },
        { status: 502 },
      );
    }
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ deleted: true });
}

type VideoDeleteRow = {
  id: string;
  user_id: string;
  cloudflare_stream_id: string | null;
};

async function deleteOwnedVideo(input: {
  supabase: ReturnType<typeof createAuthenticatedClient>;
  userId: string;
  videoId: string;
  accountId: string | undefined;
  apiToken: string | undefined;
}) {
  const { data: video, error: videoError } = await input.supabase
    .from("videos")
    .select("id, user_id, cloudflare_stream_id")
    .eq("id", input.videoId)
    .maybeSingle<VideoDeleteRow>();

  if (videoError) {
    return Response.json({ error: "Could not load video." }, { status: 500 });
  }
  if (!video) {
    return Response.json({ error: "Video not found." }, { status: 404 });
  }
  if (video.user_id !== input.userId) {
    return Response.json({ error: "You can only delete your own videos." }, { status: 403 });
  }

  const streamId = video.cloudflare_stream_id?.trim() || null;
  if (streamId) {
    if (!input.accountId || !input.apiToken) {
      // Still remove the app row so delete isn't blocked by missing Stream config.
      logUploadApiStep("video delete skipping stream cleanup", {
        reason: "missing-cloudflare-config",
        videoId: input.videoId,
      });
    } else {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/stream/${encodeURIComponent(streamId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${input.apiToken}` },
          },
        );
        if (!response.ok && response.status !== 404) {
          const data = (await response.json().catch(() => ({}))) as {
            errors?: { message?: string }[];
          };
          logUploadApiStep("video delete stream failed", {
            videoId: input.videoId,
            status: response.status,
            error: data.errors?.[0]?.message,
          });
          // Continue to DB delete — orphan Stream media is better than a stuck profile tile.
        }
      } catch (error) {
        logUploadApiStep("video delete stream network error", getErrorDetails(error));
      }
    }
  }

  const { error: deleteError } = await input.supabase
    .from("videos")
    .delete()
    .eq("id", input.videoId)
    .eq("user_id", input.userId);

  if (deleteError) {
    return Response.json(
      { error: deleteError.message || "Could not delete video." },
      { status: 500 },
    );
  }

  return Response.json({
    deleted: true,
    cloudflareStreamId: streamId,
  });
}

const SOURCE_UPLOAD_CAP_SECONDS = 600;

function getMaxDurationSeconds(
  requestedDuration: unknown,
  allowedMaxDurationSeconds: number,
  allowLongerSource = false,
) {
  if (typeof requestedDuration !== "number" || !Number.isFinite(requestedDuration)) {
    return allowedMaxDurationSeconds;
  }

  const requested = Math.ceil(requestedDuration);
  if (allowLongerSource && requested > allowedMaxDurationSeconds) {
    // Source may be longer when the client will clip to the allowed output length.
    return Math.min(SOURCE_UPLOAD_CAP_SECONDS, Math.max(allowedMaxDurationSeconds, requested));
  }

  return Math.max(
    DEFAULT_MAX_DURATION_SECONDS,
    Math.min(requested, allowedMaxDurationSeconds),
  );
}

function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

function logUploadApiStep(step: string, details?: Record<string, unknown>) {
  console.log(`[video upload api] ${step}`, details ?? {});
}

function getUrlHost(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
