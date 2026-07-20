import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { loadNotificationPreferences } from "@/lib/notification-preferences";
import { supabase } from "@/lib/native-supabase";

export type AccountDataExport = {
  exportedAt: string;
  account: {
    id: string;
    email: string | null;
    createdAt: string | null;
  };
  profile: Record<string, unknown> | null;
  videos: Record<string, unknown>[];
  savedVideos: Record<string, unknown>[];
  jamRequests: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  hiddenCreators: Record<string, unknown>[];
  blocks: Record<string, unknown>[];
  creatorPostAlerts: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  notificationPreferences: Record<string, unknown>;
};

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function rowsOrEmpty<T extends Record<string, unknown>>(
  result: PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const { data, error } = await result;
  if (error) {
    if (isMissingSchemaError(error)) return [] as T[];
    throw error;
  }
  return data ?? [];
}

export async function buildAccountDataExport(): Promise<AccountDataExport> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Log in again to download your data.");

  const userId = user.id;

  const [
    profileResult,
    videos,
    savedVideos,
    jamRequests,
    messages,
    hiddenCreators,
    blocks,
    creatorPostAlerts,
    reports,
    notificationPreferences,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    rowsOrEmpty(
      supabase
        .from("videos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("saved_videos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("jam_requests")
        .select("*")
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("user_hidden_creators")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("user_blocks")
        .select("*")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("creator_post_alerts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
    rowsOrEmpty(
      supabase
        .from("content_reports")
        .select("*")
        .eq("reporter_id", userId)
        .order("created_at", { ascending: false }),
    ),
    loadNotificationPreferences(userId),
  ]);

  if (profileResult.error && !isMissingSchemaError(profileResult.error)) {
    throw profileResult.error;
  }

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: userId,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
    },
    profile: (profileResult.data as Record<string, unknown> | null) ?? null,
    videos: videos as Record<string, unknown>[],
    savedVideos: savedVideos as Record<string, unknown>[],
    jamRequests: jamRequests as Record<string, unknown>[],
    messages: messages as Record<string, unknown>[],
    hiddenCreators: hiddenCreators as Record<string, unknown>[],
    blocks: blocks as Record<string, unknown>[],
    creatorPostAlerts: creatorPostAlerts as Record<string, unknown>[],
    reports: reports as Record<string, unknown>[],
    notificationPreferences: notificationPreferences as unknown as Record<string, unknown>,
  };
}

export async function downloadAccountDataExport() {
  const exportPayload = await buildAccountDataExport();
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error("Sharing is not available on this device.");
  }

  const directory = FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error("Could not access device storage.");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const fileUri = `${directory}jam-data-export-${stamp}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportPayload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Download your Jam data",
    UTI: "public.json",
  });

  return fileUri;
}
