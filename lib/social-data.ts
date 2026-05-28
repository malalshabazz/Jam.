import { supabase } from "@/lib/supabase";

export type FeedVideo = {
  id: string;
  userId: string;
  creatorName: string;
  role: string;
  location: string;
  avatarUrl: string | null;
  avatarFallback: string;
  bio: string | null;
  caption: string;
  hashtags: string[];
  mediaUrl: string | null;
  cloudflareStreamId: string | null;
  earlyAdopter: boolean;
  createdAt: string;
  likedByMe: boolean;
  likedMe: boolean;
  mutual: boolean;
};

export type InboxRequest = {
  id: string;
  userId: string;
  creatorName: string;
  role: string;
  location: string;
  avatarUrl: string | null;
  avatarFallback: string;
  preview: string;
  sentAt: string;
  earlyAdopter: boolean;
};

export type ChatMessage = {
  id: string;
  body: string;
  incoming: boolean;
  createdAt: string;
};

export type Conversation = {
  id: string;
  userId: string;
  creatorName: string;
  avatarUrl: string | null;
  avatarFallback: string;
  role: string;
  location: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  earlyAdopter: boolean;
  unlocked: boolean;
  messages: ChatMessage[];
};

export type InboxData = {
  requests: InboxRequest[];
  conversations: Conversation[];
  sent: Conversation[];
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  creator_types: string[] | null;
  location: string | null;
  avatar_url: string | null;
  bio: string | null;
  early_adopter: boolean | null;
};

type VideoRow = {
  id: string;
  user_id: string;
  caption: string | null;
  hashtags: string[] | null;
  media_url: string | null;
  cloudflare_stream_id: string | null;
  created_at: string;
};

type LikeRow = {
  liker_id: string;
  liked_id: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function fetchFeedVideos(currentUserId: string) {
  const [{ data: videos, error: videosError }, likes] = await Promise.all([
    supabase
      .from("videos")
      .select("id, user_id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
      .neq("user_id", currentUserId)
      .order("created_at", { ascending: false }),
    fetchRelevantLikes(currentUserId),
  ]);

  if (videosError) throw videosError;

  const likedByMe = new Set(
    likes
      .filter((like) => like.liker_id === currentUserId)
      .map((like) => like.liked_id),
  );
  const likedMe = new Set(
    likes
      .filter((like) => like.liked_id === currentUserId)
      .map((like) => like.liker_id),
  );

  const videoRows = (videos ?? []) as VideoRow[];
  const profiles = await fetchProfilesByIds(videoRows.map((video) => video.user_id));

  return videoRows
    .map((video) => toFeedVideo(video, profiles.get(video.user_id), likedByMe, likedMe))
    .filter((video): video is FeedVideo => Boolean(video));
}

export async function fetchMyVideos(currentUserId: string) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchLikedVideos(currentUserId: string) {
  const { data: likes, error: likesError } = await supabase
    .from("creator_likes")
    .select("liked_id, created_at")
    .eq("liker_id", currentUserId)
    .order("created_at", { ascending: false });

  if (likesError) throw likesError;

  const likedIds = (likes ?? []).map((like) => like.liked_id);
  if (likedIds.length === 0) return [];

  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("id, user_id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
    .in("user_id", likedIds)
    .order("created_at", { ascending: false });

  if (videosError) throw videosError;

  const videoRows = (videos ?? []) as VideoRow[];
  const profiles = await fetchProfilesByIds(videoRows.map((video) => video.user_id));

  return videoRows
    .map((video) => {
      const profile = profiles.get(video.user_id);
      if (!profile) return null;

      return {
        id: video.id,
        creatorName: getDisplayName(profile),
        caption: video.caption ?? "",
        hashtags: video.hashtags ?? [],
        mediaUrl: video.media_url,
        cloudflareStreamId: video.cloudflare_stream_id,
      };
    })
    .filter((video): video is NonNullable<typeof video> => Boolean(video));
}

export async function likeCreator(currentUserId: string, likedUserId: string) {
  const { error } = await supabase.from("creator_likes").insert({
    liker_id: currentUserId,
    liked_id: likedUserId,
  });

  if (error && error.code !== "23505") throw error;
}

export async function sendMessage(recipientUserId: string, body: string) {
  const { data, error } = await supabase.rpc("send_direct_message", {
    recipient_user_id: recipientUserId,
    message_body: body,
  });

  if (error) throw error;
  return data as MessageRow;
}

export async function fetchInbox(currentUserId: string): Promise<InboxData> {
  const [likes, messages] = await Promise.all([
    fetchRelevantLikes(currentUserId),
    fetchMessages(),
  ]);

  const relatedIds = Array.from(
    new Set([
      ...likes.map((like) =>
        like.liker_id === currentUserId ? like.liked_id : like.liker_id,
      ),
      ...messages.map((message) =>
        message.sender_id === currentUserId
          ? message.recipient_id
          : message.sender_id,
      ),
    ]),
  );

  const profiles = await fetchProfilesByIds(relatedIds);
  const likedByMe = new Set(
    likes
      .filter((like) => like.liker_id === currentUserId)
      .map((like) => like.liked_id),
  );
  const likedMe = new Set(
    likes
      .filter((like) => like.liked_id === currentUserId)
      .map((like) => like.liker_id),
  );

  const requests: InboxRequest[] = likes
    .filter(
      (like) =>
        like.liked_id === currentUserId && !likedByMe.has(like.liker_id),
    )
    .map((like) => {
      const profile = profiles.get(like.liker_id);
      if (!profile) return null;
      return {
        id: `${like.liker_id}-${like.created_at}`,
        userId: like.liker_id,
        creatorName: getDisplayName(profile),
        role: getRole(profile),
        location: profile.location ?? "Unknown",
        avatarUrl: profile.avatar_url,
        avatarFallback: getAvatarFallback(profile),
        preview: "liked your profile and wants to connect",
        sentAt: formatRelativeTime(like.created_at),
        earlyAdopter: Boolean(profile.early_adopter),
      };
    })
    .filter((request): request is InboxRequest => Boolean(request));

  const messagesByUser = new Map<string, MessageRow[]>();
  for (const message of messages) {
    const otherUserId =
      message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    messagesByUser.set(otherUserId, [
      ...(messagesByUser.get(otherUserId) ?? []),
      message,
    ]);
  }

  const mutualUserIds = new Set(
    Array.from(likedByMe).filter((id) => likedMe.has(id)),
  );
  const sentUserIds = new Set([
    ...Array.from(likedByMe).filter((id) => !likedMe.has(id)),
    ...Array.from(messagesByUser.entries())
      .filter(
        ([otherUserId, thread]) =>
          !mutualUserIds.has(otherUserId) &&
          !likedMe.has(otherUserId) &&
          thread.some((message) => message.sender_id === currentUserId),
      )
      .map(([otherUserId]) => otherUserId),
  ]);

  const conversations: Conversation[] = Array.from(mutualUserIds)
    .map((otherUserId) => {
      const profile = profiles.get(otherUserId);
      if (!profile) return null;

      const thread = (messagesByUser.get(otherUserId) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      const lastMessage = thread.at(-1);

      return {
        id: otherUserId,
        userId: otherUserId,
        creatorName: getDisplayName(profile),
        avatarUrl: profile.avatar_url,
        avatarFallback: getAvatarFallback(profile),
        role: getRole(profile),
        location: profile.location ?? "Unknown",
        lastMessage: lastMessage?.body ?? "You matched. Messaging is now unlocked.",
        timestamp: formatRelativeTime(lastMessage?.created_at ?? new Date().toISOString()),
        unread: thread.some(
          (message) =>
            message.recipient_id === currentUserId && message.read_at === null,
        ),
        earlyAdopter: Boolean(profile.early_adopter),
        unlocked: true,
        messages: thread.map((message) => ({
          id: message.id,
          body: message.body,
          incoming: message.sender_id !== currentUserId,
          createdAt: message.created_at,
        })),
      };
    })
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const sent: Conversation[] = Array.from(sentUserIds)
    .map((otherUserId) => {
      const profile = profiles.get(otherUserId);
      if (!profile) return null;

      const thread = (messagesByUser.get(otherUserId) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      const lastMessage = thread.at(-1);
      const sentLike = likes.find(
        (like) =>
          like.liker_id === currentUserId && like.liked_id === otherUserId,
      );

      return {
        id: otherUserId,
        userId: otherUserId,
        creatorName: getDisplayName(profile),
        avatarUrl: profile.avatar_url,
        avatarFallback: getAvatarFallback(profile),
        role: getRole(profile),
        location: profile.location ?? "Unknown",
        lastMessage: lastMessage?.body ?? "Like sent. Waiting for a jam.",
        timestamp: formatRelativeTime(
          lastMessage?.created_at ??
            sentLike?.created_at ??
            new Date().toISOString(),
        ),
        unread: thread.some(
          (message) =>
            message.recipient_id === currentUserId && message.read_at === null,
        ),
        earlyAdopter: Boolean(profile.early_adopter),
        unlocked: false,
        messages: thread.map((message) => ({
          id: message.id,
          body: message.body,
          incoming: message.sender_id !== currentUserId,
          createdAt: message.created_at,
        })),
      };
    })
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return { requests, conversations, sent };
}

export async function createVideo(input: {
  userId: string;
  caption: string;
  hashtags: string[];
  mediaUrl?: string | null;
  cloudflareStreamId?: string | null;
}) {
  const { error } = await supabase.from("videos").insert({
    user_id: input.userId,
    caption: input.caption,
    hashtags: input.hashtags,
    media_url: input.mediaUrl ?? null,
    cloudflare_stream_id: input.cloudflareStreamId ?? null,
  });

  if (error) throw error;
}

async function fetchRelevantLikes(currentUserId: string) {
  const { data, error } = await supabase
    .from("creator_likes")
    .select("liker_id, liked_id, created_at")
    .or(`liker_id.eq.${currentUserId},liked_id.eq.${currentUserId}`);

  if (error) throw error;
  return (data ?? []) as LikeRow[];
}

async function fetchMessages() {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, creator_types, location, avatar_url, bio, early_adopter")
    .in("id", userIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
}

function toFeedVideo(
  video: VideoRow,
  profile: ProfileRow | undefined,
  likedByMe: Set<string>,
  likedMe: Set<string>,
) {
  if (!profile) return null;

  const likedByCurrentUser = likedByMe.has(video.user_id);
  const likedCurrentUser = likedMe.has(video.user_id);

  return {
    id: video.id,
    userId: video.user_id,
    creatorName: getDisplayName(profile),
    role: getRole(profile),
    location: profile.location ?? "Unknown",
    avatarUrl: profile.avatar_url,
    avatarFallback: getAvatarFallback(profile),
    bio: profile.bio,
    caption: video.caption ?? "",
    hashtags: video.hashtags ?? [],
    mediaUrl: video.media_url,
    cloudflareStreamId: video.cloudflare_stream_id,
    earlyAdopter: Boolean(profile.early_adopter),
    createdAt: video.created_at,
    likedByMe: likedByCurrentUser,
    likedMe: likedCurrentUser,
    mutual: likedByCurrentUser && likedCurrentUser,
  };
}

function getDisplayName(profile: ProfileRow) {
  return profile.display_name?.trim() || "Creator";
}

function getRole(profile: ProfileRow) {
  return profile.creator_types?.[0] ?? "creator";
}

function getAvatarFallback(profile: ProfileRow) {
  return getDisplayName(profile)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelativeTime(value: string) {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}
