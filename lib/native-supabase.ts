import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  cloudflareUploadEndpoint?: string;
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
