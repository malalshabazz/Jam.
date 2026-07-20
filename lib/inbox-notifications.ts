import { loadNotificationPreferences } from "@/lib/notification-preferences";
import { supabase } from "@/lib/native-supabase";

export type InboxNotificationKind = "jam_request" | "jam_accept" | "message";

export type DirectMessageNotificationRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

export type InboxNotification = {
  id: string;
  kind: InboxNotificationKind;
  text: string;
  senderId: string;
  senderName: string;
};

type ThreadMessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
};

export function formatInboxNotificationText(
  kind: InboxNotificationKind,
  userName: string,
  body: string,
) {
  const name = userName.trim() || "someone";

  if (kind === "jam_request") {
    return `${name} wants to jam!`;
  }

  if (kind === "jam_accept") {
    return `you and ${name} are now jamming!`;
  }

  const message = body.trim().replace(/\s+/g, " ");
  const preview = message.length > 96 ? `${message.slice(0, 93).trimEnd()}...` : message;
  return `${name}: ${preview || "sent a message"}`;
}

export function classifyInboxNotificationKind(input: {
  inboundCount: number;
  outboundCount: number;
}): InboxNotificationKind {
  if (input.inboundCount <= 1 && input.outboundCount === 0) {
    return "jam_request";
  }

  if (input.inboundCount <= 1 && input.outboundCount >= 1) {
    return "jam_accept";
  }

  return "message";
}

async function fetchThreadCounts(currentUserId: string, senderId: string) {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, created_at")
    .or(
      `and(sender_id.eq.${senderId},recipient_id.eq.${currentUserId}),and(sender_id.eq.${currentUserId},recipient_id.eq.${senderId})`,
    );

  if (error) throw error;

  const thread = (data ?? []) as ThreadMessageRow[];
  const inboundCount = thread.filter((message) => message.sender_id === senderId).length;
  const outboundCount = thread.filter((message) => message.sender_id === currentUserId).length;

  return { inboundCount, outboundCount };
}

async function fetchSenderName(senderId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", senderId)
    .maybeSingle();

  if (error) throw error;

  const displayName =
    data && typeof data.display_name === "string" ? data.display_name.trim() : "";
  return displayName || "someone";
}

export async function resolveInboxNotification(
  currentUserId: string,
  message: DirectMessageNotificationRow,
): Promise<InboxNotification | null> {
  if (message.recipient_id !== currentUserId || message.sender_id === currentUserId) {
    return null;
  }

  const [{ inboundCount, outboundCount }, senderName, preferences] = await Promise.all([
    fetchThreadCounts(currentUserId, message.sender_id),
    fetchSenderName(message.sender_id),
    loadNotificationPreferences(currentUserId),
  ]);

  if (!preferences.inAppNotifications) return null;

  const kind = classifyInboxNotificationKind({ inboundCount, outboundCount });

  if (kind === "jam_request" && !preferences.jamRequests) return null;
  if (kind === "jam_accept" && !preferences.jamAccepts) return null;
  if (kind === "message" && !preferences.messages) return null;

  return {
    id: message.id,
    kind,
    text: formatInboxNotificationText(kind, senderName, message.body ?? ""),
    senderId: message.sender_id,
    senderName,
  };
}

export async function fetchRecentInboundMessages(
  currentUserId: string,
  limit = 25,
): Promise<DirectMessageNotificationRow[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at")
    .eq("recipient_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DirectMessageNotificationRow[];
}
