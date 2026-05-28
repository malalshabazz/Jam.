import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CloudflareDirectUploadResponse = {
  success: boolean;
  errors?: { message?: string }[];
  result?: {
    uid: string;
    uploadURL: string;
  };
};

const DEFAULT_MAX_DURATION_SECONDS = 40;
const PRO_MAX_DURATION_SECONDS = 60;

export async function POST(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.match(/^Bearer (.+)$/)?.[1];

  if (!accessToken) {
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
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!accountId || !apiToken) {
    return Response.json(
      { error: "Cloudflare Stream is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    maxDurationSeconds?: number;
  };
  const maxDurationSeconds =
    body.maxDurationSeconds === PRO_MAX_DURATION_SECONDS
      ? PRO_MAX_DURATION_SECONDS
      : DEFAULT_MAX_DURATION_SECONDS;

  const response = await fetch(
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

  const data = (await response.json()) as CloudflareDirectUploadResponse;

  if (!response.ok || !data.success || !data.result) {
    return Response.json(
      {
        error:
          data.errors?.[0]?.message ??
          "Could not create a Cloudflare Stream upload.",
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
