import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CloudflareDirectUploadResponse = {
  success: boolean;
  errors?: { message?: string; code?: number }[];
  result?: {
    uid: string;
    uploadURL: string;
  };
};

const DEFAULT_MAX_DURATION_SECONDS = 45;
const PRO_MAX_DURATION_SECONDS = 90;
type ProfileDurationRow = {
  early_adopter: boolean | null;
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
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
  };
  const { data: profile } = await supabase
    .from("profiles")
    .select("early_adopter")
    .eq("id", user.id)
    .maybeSingle<ProfileDurationRow>();
  const allowedMaxDurationSeconds = profile?.early_adopter
    ? PRO_MAX_DURATION_SECONDS
    : DEFAULT_MAX_DURATION_SECONDS;
  const maxDurationSeconds = getMaxDurationSeconds(
    body.maxDurationSeconds,
    allowedMaxDurationSeconds,
  );
  logUploadApiStep("cloudflare direct upload create start", {
    maxDurationSeconds,
    allowedMaxDurationSeconds,
    requestedDuration: body.maxDurationSeconds ?? null,
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
  });
}

function getMaxDurationSeconds(requestedDuration: unknown, allowedMaxDurationSeconds: number) {
  if (typeof requestedDuration !== "number" || !Number.isFinite(requestedDuration)) {
    return allowedMaxDurationSeconds;
  }

  return Math.max(
    DEFAULT_MAX_DURATION_SECONDS,
    Math.min(Math.ceil(requestedDuration), allowedMaxDurationSeconds),
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
