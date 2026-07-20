import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type VideoDeleteRow = {
  id: string;
  user_id: string;
  cloudflare_stream_id: string | null;
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

async function deleteCloudflareStream(
  accountId: string,
  apiToken: string,
  streamId: string,
) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(streamId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    const data = (await response.json().catch(() => ({}))) as {
      errors?: { message?: string }[];
    };
    throw new Error(data.errors?.[0]?.message ?? `Cloudflare delete failed (${response.status}).`);
  }
}

export async function DELETE(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
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
  };
  const videoId = body.videoId?.trim();
  if (!videoId) {
    return Response.json({ error: "Missing video id." }, { status: 400 });
  }

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id, user_id, cloudflare_stream_id")
    .eq("id", videoId)
    .maybeSingle<VideoDeleteRow>();

  if (videoError) {
    return Response.json({ error: "Could not load video." }, { status: 500 });
  }
  if (!video) {
    return Response.json({ error: "Video not found." }, { status: 404 });
  }
  if (video.user_id !== user.id) {
    return Response.json({ error: "You can only delete your own videos." }, { status: 403 });
  }

  const streamId = video.cloudflare_stream_id?.trim() || null;
  if (streamId) {
    if (!accountId || !apiToken) {
      return Response.json(
        { error: "Cloudflare Stream is not configured for video deletion." },
        { status: 500 },
      );
    }

    try {
      await deleteCloudflareStream(accountId, apiToken, streamId);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not delete Cloudflare Stream media.",
        },
        { status: 502 },
      );
    }
  }

  const { error: deleteError } = await supabase.from("videos").delete().eq("id", videoId).eq("user_id", user.id);
  if (deleteError) {
    return Response.json(
      {
        error: deleteError.message || "Cloudflare media was deleted, but the video row could not be removed.",
      },
      { status: 500 },
    );
  }

  return Response.json({
    deleted: true,
    cloudflareStreamId: streamId,
  });
}
