import { createClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-admin";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/** Confirm the password, then revoke only the throwaway session that check created. */
async function verifyPasswordWithoutKeepingSession(email: string, password: string) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    return { ok: false as const, error: Response.json({ error: "Account deletion is not configured." }, { status: 500 }) };
  }

  const passwordClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await passwordClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return {
      ok: false as const,
      error: Response.json({ error: "Your current password is incorrect." }, { status: 401 }),
    };
  }

  await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: anonKey,
    },
  }).catch(() => undefined);

  return { ok: true as const };
}

export async function deleteAuthenticatedAccount(input: {
  accessToken: string;
  currentPassword: string;
}) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    return Response.json({ error: "Account deletion is not configured." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${input.accessToken}` } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(input.accessToken);
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!input.currentPassword || !user.email) {
    return Response.json({ error: "Your current password is required." }, { status: 400 });
  }

  const verified = await verifyPasswordWithoutKeepingSession(user.email, input.currentPassword);
  if (!verified.ok) return verified.error;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("cloudflare_stream_id")
    .eq("user_id", user.id)
    .returns<{ cloudflare_stream_id: string | null }[]>();
  if (videosError) {
    return Response.json({ error: "Could not load account videos." }, { status: 500 });
  }

  const streamIds = [
    ...new Set(
      (videos ?? [])
        .map((video) => video.cloudflare_stream_id)
        .filter((streamId): streamId is string => Boolean(streamId)),
    ),
  ];

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

  const admin = createServiceRoleClient();
  if (!admin) {
    return Response.json({ error: "Account deletion is not configured." }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
