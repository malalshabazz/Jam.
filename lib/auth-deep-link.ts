import * as Linking from "expo-linking";
import { stringParam } from "@/lib/format";
import { supabase } from "@/lib/native-supabase";
import type { AuthDeepLinkResult } from "@/types/app";

/** OTP / redirect types we intentionally handle from auth emails. */
const RECOVERY_LINK_TYPES = new Set(["recovery"]);
const SESSION_LINK_TYPES = new Set([
  "signup",
  "email",
  "email_change",
  "magiclink",
  "invite",
]);

function normalizeAuthLinkType(raw: string | null | undefined) {
  const value = raw?.trim().toLowerCase() ?? "";
  return value || null;
}

export async function handleAuthDeepLink(url: string | null): Promise<AuthDeepLinkResult> {
  if (!url) return null;

  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const hashParams = Object.fromEntries(new URLSearchParams(hash));

  const tokenHash = stringParam(query.token_hash) ?? stringParam(hashParams.token_hash);
  const type = normalizeAuthLinkType(
    stringParam(query.type) ?? stringParam(hashParams.type),
  );
  const accessToken = stringParam(query.access_token) ?? stringParam(hashParams.access_token);
  const refreshToken = stringParam(query.refresh_token) ?? stringParam(hashParams.refresh_token);

  if (accessToken && refreshToken) {
    // Require a known type when one is present; reject unknown link kinds.
    if (type && !RECOVERY_LINK_TYPES.has(type) && !SESSION_LINK_TYPES.has(type)) {
      throw new Error("This auth link type is not supported.");
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return type && RECOVERY_LINK_TYPES.has(type) ? "recovery" : "session";
  }

  if (tokenHash && type && RECOVERY_LINK_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) throw error;
    return "recovery";
  }

  if (tokenHash && type === "email_change") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email_change",
    });
    if (error) throw error;
    return "session";
  }

  if (tokenHash && type === "signup") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "signup",
    });
    if (error) throw error;
    return "session";
  }

  if (tokenHash && type === "email") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (error) throw error;
    return "session";
  }

  if (tokenHash && type === "magiclink") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (error) throw error;
    return "session";
  }

  if (tokenHash && type === "invite") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });
    if (error) throw error;
    return "session";
  }

  // token_hash without a recognized type — do not treat as success.
  if (tokenHash) {
    throw new Error("This auth link is missing a valid type.");
  }

  return null;
}
