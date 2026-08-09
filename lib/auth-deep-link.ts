import * as Linking from "expo-linking";
import { stringParam } from "@/lib/format";
import { supabase } from "@/lib/native-supabase";
import type { AuthDeepLinkResult } from "@/types/app";

export async function handleAuthDeepLink(url: string | null): Promise<AuthDeepLinkResult> {
  if (!url) return null;

  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const hashParams = Object.fromEntries(new URLSearchParams(hash));

  const tokenHash = stringParam(query.token_hash) ?? stringParam(hashParams.token_hash);
  const type = stringParam(query.type) ?? stringParam(hashParams.type);
  const accessToken = stringParam(query.access_token) ?? stringParam(hashParams.access_token);
  const refreshToken = stringParam(query.refresh_token) ?? stringParam(hashParams.refresh_token);

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return type === "recovery" ? "recovery" : "session";
  }

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error) throw error;
    return "recovery";
  }

  if (tokenHash && type === "email_change") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email_change" });
    return "session";
  }

  if (tokenHash && type === "signup") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
    return "session";
  }

  if (tokenHash && type === "email") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    return "session";
  }

  return null;
}
