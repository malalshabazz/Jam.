import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllowedMaxVideoSeconds } from "@/lib/pro-entitlements";

type CloudflareVideoResponse = {
  success: boolean;
  errors?: { message?: string; code?: number }[];
  messages?: { message?: string; code?: number }[];
  result?: {
    uid?: string;
    duration?: number;
    creator?: string | null;
    meta?: Record<string, string | undefined> | null;
    status?: { state?: string; errorReasonText?: string | null };
  };
};

/**
 * Clip + source-delete must only run on Stream assets the caller owns.
 * Published rows are checked in `videos`; pending uploads rely on Stream
 * `creator` / `meta.jam_user_id` set at direct-upload time.
 */
async function assertCallerOwnsStreamSource(input: {
  supabase: ReturnType<typeof createAuthenticatedClient>;
  userId: string;
  sourceId: string;
  sourceCreator: string | null | undefined;
  sourceMeta: Record<string, string | undefined> | null | undefined;
}): Promise<Response | null> {
  const { data: videoRows, error } = await input.supabase
    .from("videos")
    .select("user_id")
    .eq("cloudflare_stream_id", input.sourceId)
    .limit(20);

  if (error) {
    return Response.json({ error: "Could not verify video ownership." }, { status: 500 });
  }

  if (videoRows && videoRows.length > 0) {
    const foreignOwner = videoRows.some(
      (row) => typeof row.user_id === "string" && row.user_id !== input.userId,
    );
    if (foreignOwner) {
      return Response.json({ error: "You do not own this video." }, { status: 403 });
    }
    return null;
  }

  const streamOwner =
    input.sourceCreator?.trim() || input.sourceMeta?.jam_user_id?.trim() || "";
  if (!streamOwner || streamOwner !== input.userId) {
    return Response.json({ error: "You do not own this video." }, { status: 403 });
  }

  return null;
}

function cloudflareErrorMessage(data: CloudflareVideoResponse, fallback: string) {
  return (
    data.errors?.find((entry) => entry.message)?.message ||
    data.messages?.find((entry) => entry.message)?.message ||
    data.result?.status?.errorReasonText ||
    fallback
  );
}

/** Cloudflare clip is picky about ranges past duration and overly precise floats. */
function normalizeClipRange(
  startTimeSeconds: number,
  endTimeSeconds: number,
  durationSeconds: number | null | undefined,
) {
  const duration =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : null;

  let start = Math.max(0, startTimeSeconds);
  let end = Math.max(start + 0.1, endTimeSeconds);

  if (duration != null) {
    // Keep a tiny epsilon inside the asset so Cloudflare doesn't 400 on overshoot.
    const maxEnd = Math.max(0.1, duration - 0.05);
    end = Math.min(end, maxEnd);
    start = Math.min(start, Math.max(0, end - 0.1));
  }

  // Prefer centisecond precision — integer-only examples in CF docs, but API accepts numbers.
  start = Math.round(start * 100) / 100;
  end = Math.round(end * 100) / 100;
  if (end <= start) {
    end = Math.round((start + 0.1) * 100) / 100;
  }

  return { startTimeSeconds: start, endTimeSeconds: end, durationSeconds: duration };
}

function createAuthenticatedClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStreamReady(
  accountId: string,
  apiToken: string,
  streamId: string,
  timeoutMs = 90000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );
    const data = (await response.json().catch(() => ({}))) as CloudflareVideoResponse;
    const state = data.result?.status?.state?.toLowerCase();
    if (response.ok && data.success && state === "ready") {
      return data.result ?? null;
    }
    if (state === "error") {
      throw new Error(cloudflareErrorMessage(data, "Video processing failed."));
    }
    await sleep(2000);
  }
  throw new Error("Timed out waiting for video processing.");
}

export async function POST(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.match(/^Bearer (.+)$/)?.[1];

  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!accountId || !apiToken) {
    return Response.json({ error: "Cloudflare Stream is not configured." }, { status: 500 });
  }

  const supabase = createAuthenticatedClient(accessToken);
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    cloudflareStreamId?: string;
    startTimeSeconds?: number;
    endTimeSeconds?: number;
    thumbnailTimestampPct?: number;
  };

  const sourceId = body.cloudflareStreamId?.trim();
  const rawStartTimeSeconds = Number(body.startTimeSeconds);
  const rawEndTimeSeconds = Number(body.endTimeSeconds);
  if (!sourceId) {
    return Response.json({ error: "Missing source video." }, { status: 400 });
  }
  if (!Number.isFinite(rawStartTimeSeconds) || !Number.isFinite(rawEndTimeSeconds)) {
    return Response.json({ error: "Invalid trim range." }, { status: 400 });
  }
  if (rawStartTimeSeconds < 0 || rawEndTimeSeconds <= rawStartTimeSeconds) {
    return Response.json({ error: "Trim end must be after trim start." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("early_adopter, video_count, pro_subscription_active")
    .eq("id", user.id)
    .maybeSingle<{
      early_adopter: boolean | null;
      video_count: number | null;
      pro_subscription_active: boolean | null;
    }>();
  const allowedMaxDurationSeconds = getAllowedMaxVideoSeconds({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });

  let sourceVideo: CloudflareVideoResponse["result"] | null | undefined;
  try {
    sourceVideo = await waitForStreamReady(accountId, apiToken, sourceId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Source video is not ready." },
      { status: 504 },
    );
  }

  const ownershipError = await assertCallerOwnsStreamSource({
    supabase,
    userId: user.id,
    sourceId,
    sourceCreator: sourceVideo?.creator,
    sourceMeta: sourceVideo?.meta,
  });
  if (ownershipError) return ownershipError;

  const { startTimeSeconds, endTimeSeconds, durationSeconds } = normalizeClipRange(
    rawStartTimeSeconds,
    rawEndTimeSeconds,
    sourceVideo?.duration,
  );
  const clipDurationSeconds = endTimeSeconds - startTimeSeconds;
  if (clipDurationSeconds > allowedMaxDurationSeconds + 0.5) {
    return Response.json(
      { error: `Trimmed clips can be at most ${allowedMaxDurationSeconds}s for this account.` },
      { status: 400 },
    );
  }
  if (durationSeconds != null && endTimeSeconds <= startTimeSeconds) {
    return Response.json(
      { error: "Trim range is outside the uploaded video duration." },
      { status: 400 },
    );
  }

  const thumbnailTimestampPct =
    typeof body.thumbnailTimestampPct === "number" && Number.isFinite(body.thumbnailTimestampPct)
      ? Math.min(1, Math.max(0, body.thumbnailTimestampPct))
      : undefined;

  let clipResponse: Response;
  try {
    clipResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/clip`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clippedFromVideoUID: sourceId,
          startTimeSeconds,
          endTimeSeconds,
          requireSignedURLs: false,
          ...(thumbnailTimestampPct != null ? { thumbnailTimestampPct } : {}),
          creator: user.id,
          meta: {
            name: `jam-clip-${user.id.slice(0, 8)}`,
            jam_user_id: user.id,
          },
        }),
      },
    );
  } catch {
    return Response.json({ error: "Could not reach Cloudflare Stream." }, { status: 502 });
  }

  const clipData = (await clipResponse.json().catch(() => ({}))) as CloudflareVideoResponse;
  const clippedId = clipData.result?.uid;
  if (!clipResponse.ok || !clipData.success || !clippedId) {
    return Response.json(
      {
        error: cloudflareErrorMessage(clipData, "Could not trim video."),
        details: {
          startTimeSeconds,
          endTimeSeconds,
          sourceDurationSeconds: durationSeconds,
          cloudflareStatus: clipResponse.status,
          cloudflareErrors: clipData.errors ?? [],
          cloudflareMessages: clipData.messages ?? [],
        },
      },
      { status: clipResponse.status || 500 },
    );
  }

  try {
    await waitForStreamReady(accountId, apiToken, clippedId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Trimmed video is not ready." },
      { status: 504 },
    );
  }

  // Best-effort cleanup of the untrimmed source upload.
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${sourceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  }).catch(() => undefined);

  // Transfer publish claim from source → clipped asset.
  await supabase.from("stream_upload_claims").insert({
    cloudflare_stream_id: clippedId,
    user_id: user.id,
  });
  await supabase
    .from("stream_upload_claims")
    .delete()
    .eq("cloudflare_stream_id", sourceId)
    .eq("user_id", user.id);

  return Response.json({ cloudflareStreamId: clippedId });
}
