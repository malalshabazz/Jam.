import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CloudflareVideoResponse = {
  success: boolean;
  errors?: { message?: string; code?: number }[];
  result?: {
    uid?: string;
    readyToStream?: boolean;
    status?: { state?: string; errorReasonText?: string | null; pctComplete?: string | null };
  };
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStreamReady(
  accountId: string,
  apiToken: string,
  streamId: string,
  timeoutMs = 120000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(streamId)}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );
    const data = (await response.json().catch(() => ({}))) as CloudflareVideoResponse;
    const state = data.result?.status?.state?.toLowerCase();
    const ready = Boolean(data.result?.readyToStream) || state === "ready";
    if (response.ok && data.success && ready) {
      return {
        cloudflareStreamId: data.result?.uid ?? streamId,
        state: state ?? "ready",
        pctComplete: data.result?.status?.pctComplete ?? "100",
      };
    }
    if (state === "error") {
      throw new Error(data.result?.status?.errorReasonText || "Video processing failed.");
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
  };
  const streamId = body.cloudflareStreamId?.trim();
  if (!streamId) {
    return Response.json({ error: "Missing stream id." }, { status: 400 });
  }

  try {
    const ready = await waitForStreamReady(accountId, apiToken, streamId);
    return Response.json({ ready: true, ...ready });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video is not ready." },
      { status: 504 },
    );
  }
}
