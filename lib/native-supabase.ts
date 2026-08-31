import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { createClient } from "@supabase/supabase-js";

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  cloudflareUploadEndpoint?: string;
  authBridgeUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  extra.supabaseUrl;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  extra.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration.");
}

export const cloudflareUploadEndpoint =
  process.env.EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT ??
  extra.cloudflareUploadEndpoint ??
  "";

export function getAccountDeleteEndpoint() {
  return getApiPath("/api/account");
}

export function getGeocodeSearchEndpoint() {
  return getApiPath("/api/geocode/search");
}

function getApiPath(path: string) {
  if (!cloudflareUploadEndpoint) return "";
  try {
    return `${new URL(cloudflareUploadEndpoint).origin}${path}`;
  } catch {
    return "";
  }
}

function resolveAuthBridgeBaseUrl() {
  const configured =
    process.env.EXPO_PUBLIC_AUTH_BRIDGE_URL ?? extra.authBridgeUrl ?? "";
  if (configured) return configured.replace(/\/$/, "");

  if (!cloudflareUploadEndpoint) return "";
  try {
    return `${new URL(cloudflareUploadEndpoint).origin}/auth/native`;
  } catch {
    return "";
  }
}

/**
 * Supabase email links must land on HTTPS first. The bridge page then forwards
 * into the app deep link (jam:// in builds, exp:// in Expo Go).
 */
export function getAuthEmailRedirectUrl(path = "auth") {
  const returnTo = Linking.createURL(path);
  const bridge = resolveAuthBridgeBaseUrl();
  if (!bridge) return returnTo;
  return `${bridge}?return=${encodeURIComponent(returnTo)}`;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
