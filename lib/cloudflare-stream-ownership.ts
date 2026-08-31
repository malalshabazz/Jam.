import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase-admin";

type StreamOwnerProbe = {
  creator?: string | null;
  meta?: Record<string, string | undefined> | null;
};

const FORBIDDEN = () =>
  Response.json({ error: "You do not own this video." }, { status: 403 });

/**
 * Confirm the caller owns a Stream asset before any long poll.
 * Uses claims / published rows first; one Cloudflare GET only as a last resort.
 */
export async function assertCallerOwnsStreamId(input: {
  supabase: SupabaseClient;
  userId: string;
  streamId: string;
  accountId: string;
  apiToken: string;
}): Promise<Response | null> {
  const admin = createServiceRoleClient();
  const claimClient = admin ?? input.supabase;
  const { data: claim, error: claimError } = await claimClient
    .from("stream_upload_claims")
    .select("user_id")
    .eq("cloudflare_stream_id", input.streamId)
    .maybeSingle<{ user_id: string }>();

  if (claimError && !/stream_upload_claims|does not exist|schema cache/i.test(claimError.message ?? "")) {
    return Response.json({ error: "Could not verify video ownership." }, { status: 500 });
  }
  if (claim) {
    return claim.user_id === input.userId ? null : FORBIDDEN();
  }

  const { data: videoRows, error: videoError } = await input.supabase
    .from("videos")
    .select("user_id")
    .eq("cloudflare_stream_id", input.streamId)
    .limit(20);

  if (videoError) {
    return Response.json({ error: "Could not verify video ownership." }, { status: 500 });
  }
  if (videoRows && videoRows.length > 0) {
    const foreign = videoRows.some(
      (row) => typeof row.user_id === "string" && row.user_id !== input.userId,
    );
    return foreign ? FORBIDDEN() : null;
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/stream/${encodeURIComponent(input.streamId)}`,
      { headers: { Authorization: `Bearer ${input.apiToken}` } },
    );
  } catch {
    return FORBIDDEN();
  }

  const data = (await response.json().catch(() => ({}))) as { result?: StreamOwnerProbe };
  const owner = data.result?.creator?.trim() || data.result?.meta?.jam_user_id?.trim() || "";
  if (!response.ok || !owner || owner !== input.userId) {
    return FORBIDDEN();
  }
  return null;
}
