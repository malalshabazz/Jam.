import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/native-supabase";

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
  jammedByMe: boolean;
  jammedMe: boolean;
};

export type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  creator_types: string[] | null;
  location: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean | null;
  welcome_seen: boolean | null;
  early_adopter: boolean | null;
};

export type ProfileVideo = {
  id: string;
  caption: string | null;
  hashtags?: string[] | null;
  media_url?: string | null;
  mediaUrl?: string | null;
  cloudflare_stream_id?: string | null;
  cloudflareStreamId?: string | null;
  created_at?: string;
  creatorName?: string;
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

export type InboxMessage = {
  id: string;
  sender_name: string;
  sender_avatar: string | null;
  body: string;
  created_at: string;
  read: boolean;
};

export type InboxData = {
  requests: InboxRequest[];
  conversations: Conversation[];
  sent: Conversation[];
  systemMessages: InboxMessage[];
};

type ProfileRow = Pick<
  Profile,
  "id" | "display_name" | "creator_types" | "location" | "avatar_url" | "bio" | "early_adopter"
>;

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

type JamRequestRow = {
  requester_id: string;
  recipient_id: string;
  created_at: string;
  connected_at: string | null;
};

type SavedVideoRow = {
  user_id: string;
  video_id: string;
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

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, bio, creator_types, location, avatar_url, onboarding_complete, welcome_seen, early_adopter",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function fetchCreatorProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, bio, creator_types, location, avatar_url, onboarding_complete, welcome_seen, early_adopter",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function fetchCreatorVideos(userId: string) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProfileVideo[];
}

export async function saveProfile(
  userId: string,
  input: Partial<Pick<Profile, "display_name" | "first_name" | "last_name" | "bio" | "creator_types" | "location" | "avatar_url" | "onboarding_complete" | "welcome_seen">>,
) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...input })
    .select(
      "id, display_name, first_name, last_name, bio, creator_types, location, avatar_url, onboarding_complete, welcome_seen, early_adopter",
    )
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function markWelcomeSeen(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ welcome_seen: true })
    .eq("id", userId);

  if (error) throw error;
}

export async function getSignupPosition(userId: string) {
  const { data, error } = await supabase.rpc("get_signup_position", {
    target_user_id: userId,
  });

  if (error) throw error;
  return (data ?? 1) as number;
}

export async function createEarlyAdopterWelcome() {
  const { error } = await supabase.rpc("create_early_adopter_welcome");
  if (error) throw error;
}

export async function fetchFeedVideos(currentUserId: string) {
  const [{ data: videos, error: videosError }, savedVideos, jams] = await Promise.all([
    supabase
      .from("videos")
      .select("id, user_id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
      .neq("user_id", currentUserId)
      .order("created_at", { ascending: false }),
    fetchSavedVideos(currentUserId),
    fetchRelevantJams(currentUserId),
  ]);

  if (videosError) throw videosError;

  const savedByMe = new Set(savedVideos.map((savedVideo) => savedVideo.video_id));
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = new Set(
    jams
      .filter((jam) => jam.connected_at)
      .map((jam) =>
        jam.requester_id === currentUserId ? jam.recipient_id : jam.requester_id,
      ),
  );

  const videoRows = (videos ?? []) as VideoRow[];
  const profiles = await fetchProfilesByIds(videoRows.map((video) => video.user_id));

  return videoRows
    .map((video) =>
      toFeedVideo(video, profiles.get(video.user_id), savedByMe, jammedByMe, jammedMe, connected),
    )
    .filter((video): video is FeedVideo => Boolean(video));
}

export async function fetchMyVideos(currentUserId: string) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProfileVideo[];
}

export async function fetchLikedVideos(currentUserId: string) {
  const { data: savedVideos, error: savedVideosError } = await supabase
    .from("saved_videos")
    .select("video_id, created_at")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (savedVideosError) {
    if (isMissingSchemaError(savedVideosError)) {
      return fetchLegacyLikedVideos(currentUserId);
    }
    throw savedVideosError;
  }

  const savedIds = (savedVideos ?? []).map((savedVideo) => savedVideo.video_id);
  if (savedIds.length === 0) return [];

  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("id, user_id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
    .in("id", savedIds)
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

export async function saveVideo(currentUserId: string, videoId: string) {
  const { error } = await supabase.from("saved_videos").insert({
    user_id: currentUserId,
    video_id: videoId,
  });

  if (error && error.code !== "23505") {
    if (isMissingSchemaError(error)) {
      await saveLegacyVideoLike(currentUserId, videoId);
      return;
    }
    throw error;
  }
}

export async function unsaveVideo(currentUserId: string, videoId: string) {
  const { error } = await supabase
    .from("saved_videos")
    .delete()
    .eq("user_id", currentUserId)
    .eq("video_id", videoId);

  if (error) {
    if (isMissingSchemaError(error)) {
      await deleteLegacyVideoLike(currentUserId, videoId);
      return;
    }
    throw error;
  }
}

export async function likeCreator(currentUserId: string, likedUserId: string) {
  try {
    await sendJamRequest(likedUserId, "");
  } catch (error) {
    if (!isMissingFunctionError(error)) throw error;
    await insertLegacyCreatorLike(currentUserId, likedUserId);
  }
}

export async function fetchRelationshipState(currentUserId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from("jam_requests")
    .select("requester_id, recipient_id, connected_at")
    .or(
      `and(requester_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`,
    );

  if (error) {
    if (isMissingSchemaError(error)) {
      return fetchLegacyRelationshipState(currentUserId, otherUserId);
    }
    throw error;
  }

  const jams = (data ?? []) as Array<Pick<JamRequestRow, "requester_id" | "recipient_id" | "connected_at">>;
  const connected = jams.some((jam) => Boolean(jam.connected_at));
  return {
    likedByMe: connected || jams.some(
      (jam) => jam.requester_id === currentUserId && jam.recipient_id === otherUserId,
    ),
    likedMe: connected || jams.some(
      (jam) =>
        jam.requester_id === otherUserId && jam.recipient_id === currentUserId,
    ),
  };
}

export async function sendJamRequest(recipientUserId: string, body: string) {
  const { data, error } = await supabase.rpc("send_jam_request", {
    recipient_user_id: recipientUserId,
    message_body: body,
  });

  if (error) {
    if (isMissingFunctionError(error)) {
      await insertLegacyCreatorLike(null, recipientUserId);
      return sendMessage(recipientUserId, normalizeJamMessage(body));
    }
    throw error;
  }
  return data as MessageRow;
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
  const [jams, messages, systemMessages] = await Promise.all([
    fetchRelevantJams(currentUserId),
    fetchMessages(),
    fetchSystemMessages(currentUserId),
  ]);

  const relatedIds = Array.from(
    new Set([
      ...jams.map((jam) => (jam.requester_id === currentUserId ? jam.recipient_id : jam.requester_id)),
      ...messages.map((message) =>
        message.sender_id === currentUserId ? message.recipient_id : message.sender_id,
      ),
    ]),
  );

  const profiles = await fetchProfilesByIds(relatedIds);
  const connectedUserIds = new Set(
    jams
      .filter((jam) => jam.connected_at)
      .map((jam) =>
        jam.requester_id === currentUserId ? jam.recipient_id : jam.requester_id,
      ),
  );

  const messagesByUser = new Map<string, MessageRow[]>();
  for (const message of messages) {
    const otherUserId =
      message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    messagesByUser.set(otherUserId, [...(messagesByUser.get(otherUserId) ?? []), message]);
  }

  const incomingRequestUserIds = new Set([
    ...jams
      .filter(
        (jam) =>
          jam.recipient_id === currentUserId &&
          !jam.connected_at &&
          !connectedUserIds.has(jam.requester_id),
      )
      .map((jam) => jam.requester_id),
    ...messages
      .filter(
        (message) =>
          message.recipient_id === currentUserId &&
          !connectedUserIds.has(message.sender_id),
      )
      .map((message) => message.sender_id),
  ]);

  const requests: InboxRequest[] = Array.from(incomingRequestUserIds)
    .map((requestUserId) => {
      const profile = profiles.get(requestUserId);
      if (!profile) return null;

      const incomingThread = (messagesByUser.get(requestUserId) ?? [])
        .filter((message) => message.recipient_id === currentUserId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const latestIncomingMessage = incomingThread.at(-1);
      const incomingJam = jams
        .filter((jam) => jam.requester_id === requestUserId && jam.recipient_id === currentUserId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .at(-1);
      const latestActivityAt = [
        latestIncomingMessage?.created_at,
        incomingJam?.created_at,
      ]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => a.localeCompare(b))
        .at(-1) ?? new Date().toISOString();

      return {
        id: `${requestUserId}-${latestActivityAt}`,
        userId: requestUserId,
        creatorName: getDisplayName(profile),
        role: getRole(profile),
        location: profile.location ?? "Unknown",
        avatarUrl: profile.avatar_url,
        avatarFallback: getAvatarFallback(profile),
        preview: latestIncomingMessage?.body ?? "wants to jam with you",
        sentAt: formatRelativeTime(latestActivityAt),
        earlyAdopter: Boolean(profile.early_adopter),
        sortAt: latestActivityAt,
      };
    })
    .filter((request): request is InboxRequest & { sortAt: string } => Boolean(request))
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
    .map((request) => ({
      id: request.id,
      userId: request.userId,
      creatorName: request.creatorName,
      role: request.role,
      location: request.location,
      avatarUrl: request.avatarUrl,
      avatarFallback: request.avatarFallback,
      preview: request.preview,
      sentAt: request.sentAt,
      earlyAdopter: request.earlyAdopter,
    }));
  const sentUserIds = new Set([
    ...jams
      .filter((jam) => jam.requester_id === currentUserId && !jam.connected_at)
      .map((jam) => jam.recipient_id),
    ...Array.from(messagesByUser.entries())
      .filter(
        ([otherUserId, thread]) =>
          !connectedUserIds.has(otherUserId) &&
          thread.some((message) => message.sender_id === currentUserId),
      )
      .map(([otherUserId]) => otherUserId),
  ]);

  const conversations = Array.from(connectedUserIds)
    .map((otherUserId) =>
      toConversation(currentUserId, otherUserId, profiles.get(otherUserId), messagesByUser, true),
    )
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const sent = Array.from(sentUserIds)
    .map((otherUserId) =>
      toConversation(currentUserId, otherUserId, profiles.get(otherUserId), messagesByUser, false),
    )
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return { requests, conversations, sent, systemMessages };
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

async function fetchSavedVideos(currentUserId: string) {
  const { data, error } = await supabase
    .from("saved_videos")
    .select("user_id, video_id, created_at")
    .eq("user_id", currentUserId);

  if (error) {
    if (isMissingSchemaError(error)) return fetchLegacySavedVideos(currentUserId);
    throw error;
  }
  return (data ?? []) as SavedVideoRow[];
}

async function fetchRelevantJams(currentUserId: string) {
  const { data, error } = await supabase
    .from("jam_requests")
    .select("requester_id, recipient_id, created_at, connected_at")
    .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);

  if (error) {
    if (isMissingSchemaError(error)) return fetchLegacyJams(currentUserId);
    throw error;
  }
  return (data ?? []) as JamRequestRow[];
}

async function fetchMessages() {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

async function fetchSystemMessages(currentUserId: string) {
  const { data, error } = await supabase
    .from("inbox_messages")
    .select("id, sender_name, sender_avatar, body, created_at, read")
    .eq("recipient_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InboxMessage[];
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, creator_types, location, avatar_url, bio, early_adopter")
    .in("id", userIds);

  if (error) throw error;
  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function fetchLegacySavedVideos(currentUserId: string) {
  const likes = await fetchRelevantLegacyLikes(currentUserId);
  const locallyUnsavedVideoIds = await getLegacyUnsavedVideoIds(currentUserId);
  const likedCreatorIds = likes
    .filter((like) => like.liker_id === currentUserId)
    .map((like) => like.liked_id);

  if (likedCreatorIds.length === 0) return [];

  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, user_id, created_at")
    .in("user_id", likedCreatorIds);

  if (error) throw error;

  return ((videos ?? []) as Array<Pick<VideoRow, "id" | "user_id" | "created_at">>)
    .filter((video) => !locallyUnsavedVideoIds.has(video.id))
    .map((video) => ({
      user_id: currentUserId,
      video_id: video.id,
      created_at: video.created_at,
    }));
}

async function fetchLegacyLikedVideos(currentUserId: string) {
  const likes = await fetchRelevantLegacyLikes(currentUserId);
  const locallyUnsavedVideoIds = await getLegacyUnsavedVideoIds(currentUserId);
  const likedCreatorIds = likes
    .filter((like) => like.liker_id === currentUserId)
    .map((like) => like.liked_id);

  if (likedCreatorIds.length === 0) return [];

  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("id, user_id, caption, hashtags, media_url, cloudflare_stream_id, created_at")
    .in("user_id", likedCreatorIds)
    .order("created_at", { ascending: false });

  if (videosError) throw videosError;

  const videoRows = ((videos ?? []) as VideoRow[]).filter(
    (video) => !locallyUnsavedVideoIds.has(video.id),
  );
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

async function saveLegacyVideoLike(currentUserId: string, videoId: string) {
  await removeLegacyUnsavedVideoId(currentUserId, videoId);

  const { data: video, error } = await supabase
    .from("videos")
    .select("user_id")
    .eq("id", videoId)
    .maybeSingle();

  if (error) throw error;
  const ownerId = (video as Pick<VideoRow, "user_id"> | null)?.user_id;
  if (!ownerId || ownerId === currentUserId) return;

  await insertLegacyCreatorLike(currentUserId, ownerId);
}

async function deleteLegacyVideoLike(currentUserId: string, videoId: string) {
  await addLegacyUnsavedVideoId(currentUserId, videoId);

  const { data: video, error } = await supabase
    .from("videos")
    .select("user_id")
    .eq("id", videoId)
    .maybeSingle();

  if (error) throw error;
  const ownerId = (video as Pick<VideoRow, "user_id"> | null)?.user_id;
  if (!ownerId || ownerId === currentUserId) return;

  const { error: deleteError } = await supabase
    .from("creator_likes")
    .delete()
    .eq("liker_id", currentUserId)
    .eq("liked_id", ownerId);

  if (deleteError && deleteError.code !== "42501") throw deleteError;
}

async function fetchLegacyRelationshipState(currentUserId: string, otherUserId: string) {
  const likes = await fetchRelevantLegacyLikes(currentUserId);
  return {
    likedByMe: likes.some(
      (like) => like.liker_id === currentUserId && like.liked_id === otherUserId,
    ),
    likedMe: likes.some(
      (like) => like.liker_id === otherUserId && like.liked_id === currentUserId,
    ),
  };
}

async function fetchLegacyJams(currentUserId: string) {
  const likes = await fetchRelevantLegacyLikes(currentUserId);
  const reciprocalPairs = new Set(
    likes.map((like) => `${like.liked_id}:${like.liker_id}`),
  );

  return likes.map((like) => ({
    requester_id: like.liker_id,
    recipient_id: like.liked_id,
    created_at: like.created_at,
    connected_at: reciprocalPairs.has(`${like.liker_id}:${like.liked_id}`)
      ? like.created_at
      : null,
  }));
}

async function fetchRelevantLegacyLikes(currentUserId: string) {
  const { data, error } = await supabase
    .from("creator_likes")
    .select("liker_id, liked_id, created_at")
    .or(`liker_id.eq.${currentUserId},liked_id.eq.${currentUserId}`);

  if (error) throw error;
  return (data ?? []) as LikeRow[];
}

async function insertLegacyCreatorLike(currentUserId: string | null, likedUserId: string) {
  const likerId = currentUserId ?? (await getCurrentUserId());
  const { error } = await supabase.from("creator_likes").insert({
    liker_id: likerId,
    liked_id: likedUserId,
  });

  if (error && error.code !== "23505") throw error;
}

async function getLegacyUnsavedVideoIds(currentUserId: string) {
  const stored = await AsyncStorage.getItem(getLegacyUnsavedKey(currentUserId));
  if (!stored) return new Set<string>();

  try {
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

async function addLegacyUnsavedVideoId(currentUserId: string, videoId: string) {
  const current = await getLegacyUnsavedVideoIds(currentUserId);
  current.add(videoId);
  await AsyncStorage.setItem(getLegacyUnsavedKey(currentUserId), JSON.stringify([...current]));
}

async function removeLegacyUnsavedVideoId(currentUserId: string, videoId: string) {
  const current = await getLegacyUnsavedVideoIds(currentUserId);
  if (!current.delete(videoId)) return;
  await AsyncStorage.setItem(getLegacyUnsavedKey(currentUserId), JSON.stringify([...current]));
}

function getLegacyUnsavedKey(currentUserId: string) {
  return `jam.legacyUnsavedVideos.${currentUserId}`;
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function normalizeJamMessage(body: string) {
  return body.trim() || "Hey, let's jam.";
}

function isMissingSchemaError(error: unknown) {
  if (!isSupabaseError(error)) return false;
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.toLowerCase().includes("does not exist") ||
    error.message.toLowerCase().includes("schema cache")
  );
}

function isMissingFunctionError(error: unknown) {
  if (!isSupabaseError(error)) return false;
  return (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.message.toLowerCase().includes("could not find the function") ||
    error.message.toLowerCase().includes("schema cache")
  );
}

function isSupabaseError(error: unknown): error is { code?: string; message: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string",
  );
}

function toConversation(
  currentUserId: string,
  otherUserId: string,
  profile: ProfileRow | undefined,
  messagesByUser: Map<string, MessageRow[]>,
  unlocked: boolean,
) {
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
    lastMessage:
      lastMessage?.body ??
      (unlocked ? "you are jamming. chat is open." : "jam sent. waiting for a reply."),
    timestamp: formatRelativeTime(lastMessage?.created_at ?? new Date().toISOString()),
    unread: thread.some(
      (message) => message.recipient_id === currentUserId && message.read_at === null,
    ),
    earlyAdopter: Boolean(profile.early_adopter),
    unlocked,
    messages: thread.map((message) => ({
      id: message.id,
      body: message.body,
      incoming: message.sender_id !== currentUserId,
      createdAt: message.created_at,
    })),
  };
}

function toFeedVideo(
  video: VideoRow,
  profile: ProfileRow | undefined,
  savedByMe: Set<string>,
  jammedByMe: Set<string>,
  jammedMe: Set<string>,
  connected: Set<string>,
) {
  if (!profile) return null;

  const savedByCurrentUser = savedByMe.has(video.id);
  const connectedWithCurrentUser = connected.has(video.user_id);

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
    likedByMe: savedByCurrentUser,
    likedMe: jammedMe.has(video.user_id),
    mutual: connectedWithCurrentUser || (jammedByMe.has(video.user_id) && jammedMe.has(video.user_id)),
    jammedByMe: jammedByMe.has(video.user_id),
    jammedMe: jammedMe.has(video.user_id),
  };
}

function getDisplayName(profile: ProfileRow) {
  return profile.display_name?.trim() || "Creator";
}

function getRole(profile: ProfileRow) {
  return profile.creator_types?.[0] ?? "creator";
}

export function getAvatarFallback(profile: Pick<ProfileRow, "display_name">) {
  return (profile.display_name?.trim() || "Creator")
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
