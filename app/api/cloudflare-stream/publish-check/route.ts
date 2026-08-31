import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllowedMaxVideoSeconds } from "@/lib/pro-entitlements";
import { createServiceRoleClient } from "@/lib/supabase-admin";

type CloudflareVideoResponse = {
  success: boolean;
  errors?: { message?: string; code?: number }[];
  result?: {
    uid?: string;
    duration?: number;
    creator?: string | null;
    meta?: Record<string, string | undefined> | null;
    status?: { state?: string; errorReasonText?: string | null };
  };
};

type ClaimRow = {
  user_id: string;
  status: string | null;
  allowed_publish_seconds: number | null;
};

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

/**
 * Marks a Stream claim publishable only when Cloudflare duration is within
 * the caller's free/pro entitlement (closes allowLongerSource publish bypass).
 */
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

  const body = (await request.json().catch(() => ({}))) as { cloudflareStreamId?: string };
  const streamId = body.cloudflareStreamId?.trim();
  if (!streamId) {
    return Response.json({ error: "Missing stream id." }, { status: 400 });
  }

  const { data: claim, error: claimError } = await supabase
    .from("stream_upload_claims")
    .select("user_id, status, allowed_publish_seconds")
    .eq("cloudflare_stream_id", streamId)
    .maybeSingle<ClaimRow>();

  if (claimError) {
    if (/stream_upload_claims|does not exist|schema cache/i.test(claimError.message ?? "")) {
      // Pre-claim migrations — nothing to gate.
      return Response.json({ publishable: true, skipped: true });
    }
    return Response.json({ error: "Could not verify upload claim." }, { status: 500 });
  }

  if (!claim || claim.user_id !== user.id) {
    return Response.json({ error: "You do not own this upload." }, { status: 403 });
  }

  if (claim.status === "publishable") {
    return Response.json({ publishable: true, cloudflareStreamId: streamId });
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

  const allowedSeconds = getAllowedMaxVideoSeconds({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });
  const claimAllowed =
    typeof claim.allowed_publish_seconds === "number" && claim.allowed_publish_seconds > 0
      ? Math.min(claim.allowed_publish_seconds, allowedSeconds)
      : allowedSeconds;

  let cfResponse: Response;
  try {
    cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(streamId)}`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
    );
  } catch {
    return Response.json({ error: "Could not reach Cloudflare Stream." }, { status: 502 });
  }

  const cfData = (await cfResponse.json().catch(() => ({}))) as CloudflareVideoResponse;
  if (!cfResponse.ok || !cfData.success) {
    return Response.json({ error: "Could not load uploaded video." }, { status: 502 });
  }

  const duration =
    typeof cfData.result?.duration === "number" && Number.isFinite(cfData.result.duration)
      ? cfData.result.duration
      : null;

  if (duration == null) {
    return Response.json(
      { error: "Video duration is not ready yet. Wait a moment and try again." },
      { status: 409 },
    );
  }

  // Small epsilon for encoder rounding vs entitlement boundary.
  if (duration > claimAllowed + 0.75) {
    return Response.json(
      {
        error: `Videos can be at most ${claimAllowed}s for this account. Trim before posting.`,
        durationSeconds: duration,
        allowedPublishSeconds: claimAllowed,
      },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return Response.json({ error: "Upload claiming is not configured." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("stream_upload_claims")
    .update({
      status: "publishable",
      allowed_publish_seconds: claimAllowed,
    })
    .eq("cloudflare_stream_id", streamId)
    .eq("user_id", user.id);

  if (updateError) {
    if (/status|allowed_publish_seconds|schema cache|column/i.test(updateError.message ?? "")) {
      // Pre-050 schema — duration already verified; client insert policy still allowed publish.
      return Response.json({
        publishable: true,
        cloudflareStreamId: streamId,
        durationSeconds: duration,
        allowedPublishSeconds: claimAllowed,
        skipped: true,
      });
    }
    return Response.json({ error: "Could not mark upload publishable." }, { status: 500 });
  }

  return Response.json({
    publishable: true,
    cloudflareStreamId: streamId,
    durationSeconds: duration,
    allowedPublishSeconds: claimAllowed,
  });
}
