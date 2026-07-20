import AsyncStorage from "@react-native-async-storage/async-storage";
import { geocodeProfileLocation } from "@/lib/geocode";
import { deleteCloudflareVideo } from "@/lib/native-cloudflare";
import { creatorRoles, musicGenres } from "@/lib/options";
import { getProBadgeKind, type ProBadgeKind } from "@/lib/pro-entitlements";
import { supabase } from "@/lib/native-supabase";
import {
  normalizeVideoFilter,
  normalizeVideoTextOverlays,
  type VideoFilterId,
  type VideoTextOverlay,
} from "@/lib/video-presentation";

export type FeedVideo = {
  id: string;
  userId: string;
  creatorName: string;
  role: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  liveLatitude: number | null;
  liveLongitude: number | null;
  avatarUrl: string | null;
  bio: string | null;
  caption: string;
  hashtags: string[];
  categories: string[];
  roles: string[];
  genres: string[];
  mediaUrl: string | null;
  cloudflareStreamId: string | null;
  thumbnailTimeMs: number | null;
  videoFilter: VideoFilterId;
  textOverlays: VideoTextOverlay[];
  earlyAdopter: boolean;
  proBadge: ProBadgeKind | null;
  videoCount: number;
  createdAt: string;
  savedByMe: boolean;
  mutual: boolean;
  jammedByMe: boolean;
  jammedMe: boolean;
};

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  creator_types: string[] | null;
  location: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  live_latitude: number | null;
  live_longitude: number | null;
  near_me_radius_miles: number | null;
  avatar_url: string | null;
  onboarding_complete: boolean | null;
  welcome_seen: boolean | null;
  early_adopter: boolean | null;
  video_count: number | null;
  pro_subscription_active: boolean | null;
};

export type ProfileVideo = {
  id: string;
  userId?: string;
  caption: string | null;
  hashtags?: string[] | null;
  categories?: string[] | null;
  roles?: string[] | null;
  genres?: string[] | null;
  media_url?: string | null;
  mediaUrl?: string | null;
  cloudflare_stream_id?: string | null;
  cloudflareStreamId?: string | null;
  thumbnail_time_ms?: number | null;
  thumbnailTimeMs?: number | null;
  video_filter?: string | null;
  videoFilter?: VideoFilterId | null;
  text_overlays?: unknown;
  textOverlays?: VideoTextOverlay[] | null;
  created_at?: string;
  creatorName?: string;
  role?: string;
  location?: string;
  avatarUrl?: string | null;
  earlyAdopter?: boolean;
  proBadge?: ProBadgeKind | null;
  savedByMe?: boolean;
  mutual?: boolean;
  jammedByMe?: boolean;
  jammedMe?: boolean;
};

export type InboxRequest = {
  id: string;
  userId: string;
  creatorName: string;
  role: string;
  location: string;
  avatarUrl: string | null;
  preview: string;
  sentAt: string;
  unreadCount: number;
  earlyAdopter: boolean;
  proBadge: ProBadgeKind | null;
  video: MessageVideoAttachment | null;
};

export type ChatMessage = {
  id: string;
  serverId?: string;
  body: string;
  incoming: boolean;
  createdAt: string;
  video?: MessageVideoAttachment | null;
};

export type MessageVideoAttachment = {
  id: string;
  userId: string;
  caption: string;
  mediaUrl: string | null;
  cloudflareStreamId: string | null;
  thumbnailTimeMs: number | null;
};

export type MessageCursor = {
  createdAt: string;
  id: string;
};

export type Conversation = {
  id: string;
  userId: string;
  creatorName: string;
  avatarUrl: string | null;
  role: string;
  location: string;
  lastMessage: string;
  timestamp: string;
  lastActivityAt: string;
  unread: boolean;
  unreadCount: number;
  earlyAdopter: boolean;
  proBadge: ProBadgeKind | null;
  unlocked: boolean;
  messages: ChatMessage[];
  hasMoreMessages?: boolean;
  olderMessagesCursor?: MessageCursor | null;
};

export type FeedCursor = {
  createdAt: string;
  id: string;
};

export type FeedPage = {
  items: FeedVideo[];
  nextCursor: FeedCursor | null;
};

export type MessagePage = {
  messages: ChatMessage[];
  nextCursor: MessageCursor | null;
};

export const FEED_PAGE_SIZE = 12;
export const INBOX_RECENT_MESSAGE_LIMIT = 150;
export const CONVERSATION_MESSAGE_PAGE_SIZE = 40;
export const SYSTEM_MESSAGE_PAGE_SIZE = 40;

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

export type BlockedUser = {
  userId: string;
  creatorName: string;
  role: string;
  location: string;
  avatarUrl: string | null;
  blockedAt: string;
};

type ProfileRow = Pick<
  Profile,
  | "id"
  | "display_name"
  | "creator_types"
  | "location"
  | "country"
  | "city"
  | "latitude"
  | "longitude"
  | "live_latitude"
  | "live_longitude"
  | "avatar_url"
  | "bio"
  | "early_adopter"
  | "video_count"
  | "pro_subscription_active"
>;

type VideoRow = {
  id: string;
  user_id: string;
  caption: string | null;
  hashtags: string[] | null;
  categories: string[] | null;
  roles: string[] | null;
  genres: string[] | null;
  media_url: string | null;
  cloudflare_stream_id: string | null;
  thumbnail_time_ms: number | null;
  video_filter?: string | null;
  text_overlays?: unknown;
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

type HiddenCreatorRow = {
  hidden_user_id: string;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export type ReportReason = "inappropriate_content" | "spam" | "harassment" | "other";

type MessageVideoRow = {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  cloudflare_stream_id: string | null;
  thumbnail_time_ms: number | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  video_id: string | null;
  video: MessageVideoRow | MessageVideoRow[] | null;
};

const VIDEO_COLUMNS_WITH_TAGS =
  "id, user_id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, created_at";
const OWN_VIDEO_COLUMNS_WITH_TAGS =
  "id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, created_at";
const VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION =
  "id, user_id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, created_at";
const OWN_VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION =
  "id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, created_at";
const VIDEO_COLUMNS_WITH_CATEGORIES =
  "id, user_id, caption, hashtags, categories, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, created_at";
const OWN_VIDEO_COLUMNS_WITH_CATEGORIES =
  "id, caption, hashtags, categories, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, created_at";
const VIDEO_COLUMNS_WITH_CATEGORIES_NO_PRESENTATION =
  "id, user_id, caption, hashtags, categories, media_url, cloudflare_stream_id, thumbnail_time_ms, created_at";
const OWN_VIDEO_COLUMNS_WITH_CATEGORIES_NO_PRESENTATION =
  "id, caption, hashtags, categories, media_url, cloudflare_stream_id, thumbnail_time_ms, created_at";
const VIDEO_COLUMNS_LEGACY =
  "id, user_id, caption, hashtags, media_url, cloudflare_stream_id, created_at";
const OWN_VIDEO_COLUMNS_LEGACY =
  "id, caption, hashtags, media_url, cloudflare_stream_id, created_at";
const PROFILE_COLUMNS =
  "id, display_name, bio, creator_types, location, country, city, latitude, longitude, live_latitude, live_longitude, near_me_radius_miles, avatar_url, onboarding_complete, welcome_seen, early_adopter, video_count, pro_subscription_active";
const PROFILE_ROW_COLUMNS =
  "id, display_name, creator_types, location, country, city, latitude, longitude, live_latitude, live_longitude, avatar_url, bio, early_adopter, video_count, pro_subscription_active";
const creatorRoleSet = new Set(creatorRoles.map(normalizeTag));
const musicGenreSet = new Set(musicGenres.map(normalizeTag));

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function fetchCreatorProfile(viewerId: string, creatorId: string) {
  if (viewerId === creatorId) {
    return fetchProfile(creatorId);
  }
  if (await usersAreBlocked(viewerId, creatorId)) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", creatorId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function fetchCreatorVideos(viewerId: string, creatorId: string) {
  if (viewerId !== creatorId && (await usersAreBlocked(viewerId, creatorId))) {
    return [];
  }

  const result = await supabase
    .from("videos")
    .select(OWN_VIDEO_COLUMNS_WITH_TAGS)
    .eq("user_id", creatorId)
    .order("created_at", { ascending: false });
  let data = result.data as ProfileVideo[] | null;
  let error = result.error;

  if (error && isMissingSchemaError(error)) {
    const tagsRetry = await supabase
      .from("videos")
      .select(OWN_VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION)
      .eq("user_id", creatorId)
      .order("created_at", { ascending: false });
    if (!tagsRetry.error || !isMissingSchemaError(tagsRetry.error)) {
      data = tagsRetry.data as ProfileVideo[] | null;
      error = tagsRetry.error;
    } else {
      const categoryRetry = await supabase
        .from("videos")
        .select(OWN_VIDEO_COLUMNS_WITH_CATEGORIES)
        .eq("user_id", creatorId)
        .order("created_at", { ascending: false });
      if (categoryRetry.error && isMissingSchemaError(categoryRetry.error)) {
        const legacyRetry = await supabase
          .from("videos")
          .select(OWN_VIDEO_COLUMNS_LEGACY)
          .eq("user_id", creatorId)
          .order("created_at", { ascending: false });
        data = legacyRetry.data as ProfileVideo[] | null;
        error = legacyRetry.error;
      } else {
        data = categoryRetry.data as ProfileVideo[] | null;
        error = categoryRetry.error;
      }
    }
  }

  if (error) throw error;
  return ((data ?? []) as ProfileVideo[]).map(normalizeOwnProfileVideo);
}

export async function saveProfile(
  userId: string,
  input: Partial<
    Pick<
      Profile,
      | "display_name"
      | "bio"
      | "creator_types"
      | "location"
      | "country"
      | "city"
      | "latitude"
      | "longitude"
      | "near_me_radius_miles"
      | "avatar_url"
      | "onboarding_complete"
      | "welcome_seen"
    >
  >,
) {
  const hasLocationUpdate = "country" in input || "city" in input;
  const payload: Record<string, unknown> = { id: userId, ...input };

  delete payload.live_latitude;
  delete payload.live_longitude;

  if (hasLocationUpdate) {
    delete payload.latitude;
    delete payload.longitude;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;

  if (!hasLocationUpdate) {
    return data as Profile;
  }

  const trimmedCountry = input.country?.trim() ?? "";
  const trimmedCity = input.city?.trim() ?? "";

  if (!trimmedCountry && !trimmedCity) {
    const { data: cleared, error: clearError } = await supabase
      .from("profiles")
      .update({ latitude: null, longitude: null })
      .eq("id", userId)
      .select(PROFILE_COLUMNS)
      .single();

    if (clearError) throw clearError;
    return cleared as Profile;
  }

  const coordinates = await geocodeProfileLocation(input.country, input.city);
  if (!coordinates) {
    return data as Profile;
  }

  const { data: updated, error: coordError } = await supabase
    .from("profiles")
    .update({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (coordError) throw coordError;
  return updated as Profile;
}

export async function updateLiveLocation(
  userId: string,
  coordinates: { latitude: number; longitude: number } | null,
) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      live_latitude: coordinates?.latitude ?? null,
      live_longitude: coordinates?.longitude ?? null,
    })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
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

export async function fetchFeedVideos(
  currentUserId: string,
  options?: { cursor?: FeedCursor | null; limit?: number },
): Promise<FeedPage> {
  const limit = Math.max(1, Math.min(options?.limit ?? FEED_PAGE_SIZE, 40));
  const [savedVideos, jams, moderation] = await Promise.all([
    fetchSavedVideoRows(currentUserId),
    fetchRelevantJams(currentUserId),
    fetchFeedModeration(currentUserId),
  ]);

  const savedByMe = new Set(savedVideos.map((savedVideo) => savedVideo.video_id));
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = getConnectedJamUserIds(jams, currentUserId);

  const pageItems: FeedVideo[] = [];
  let cursor = options?.cursor ?? null;
  let nextCursor: FeedCursor | null = null;
  let rounds = 0;

  // Client-side hide/block filtering can thin a page — keep walking cursors a few times.
  while (pageItems.length < limit && rounds < 6) {
    const batchSize = Math.max(limit - pageItems.length + 4, 8);
    const { rows, error } = await fetchFeedVideoRowsPage(currentUserId, cursor, batchSize + 1);
    if (error) throw error;

    const hasMore = rows.length > batchSize;
    const pageRows = hasMore ? rows.slice(0, batchSize) : rows;
    if (pageRows.length === 0) {
      nextCursor = null;
      break;
    }

    const lastRow = pageRows[pageRows.length - 1];
    cursor = { createdAt: lastRow.created_at, id: lastRow.id };
    nextCursor = hasMore ? cursor : null;

    const visibleRows = pageRows.filter(
      (video) =>
        !moderation.hiddenUserIds.has(video.user_id) &&
        !moderation.blockedUserIds.has(video.user_id),
    );
    const profiles = await fetchProfilesByIds(visibleRows.map((video) => video.user_id));
    for (const video of visibleRows) {
      const item = toFeedVideo(
        video,
        profiles.get(video.user_id),
        savedByMe,
        jammedByMe,
        jammedMe,
        connected,
      );
      if (!item) continue;
      if (pageItems.some((existing) => existing.id === item.id)) continue;
      pageItems.push(item);
      if (pageItems.length >= limit) break;
    }

    rounds += 1;
    if (!hasMore) break;
  }

  return {
    items: pageItems.slice(0, limit),
    nextCursor: pageItems.length > 0 ? nextCursor : null,
  };
}

export async function fetchMyVideos(currentUserId: string) {
  const result = await supabase
    .from("videos")
    .select(OWN_VIDEO_COLUMNS_WITH_TAGS)
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });
  let data = result.data as ProfileVideo[] | null;
  let error = result.error;

  if (error && isMissingSchemaError(error)) {
    const tagsRetry = await supabase
      .from("videos")
      .select(OWN_VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION)
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });
    if (!tagsRetry.error || !isMissingSchemaError(tagsRetry.error)) {
      data = tagsRetry.data as ProfileVideo[] | null;
      error = tagsRetry.error;
    } else {
      const categoryRetry = await supabase
        .from("videos")
        .select(OWN_VIDEO_COLUMNS_WITH_CATEGORIES)
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });
      if (categoryRetry.error && isMissingSchemaError(categoryRetry.error)) {
        const legacyRetry = await supabase
          .from("videos")
          .select(OWN_VIDEO_COLUMNS_LEGACY)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false });
        data = legacyRetry.data as ProfileVideo[] | null;
        error = legacyRetry.error;
      } else {
        data = categoryRetry.data as ProfileVideo[] | null;
        error = categoryRetry.error;
      }
    }
  }

  if (error) throw error;
  return ((data ?? []) as ProfileVideo[]).map(normalizeOwnProfileVideo);
}

function normalizeOwnProfileVideo(video: ProfileVideo): ProfileVideo {
  const cloudflareStreamId = video.cloudflareStreamId ?? video.cloudflare_stream_id ?? null;
  const mediaUrl =
    video.mediaUrl ??
    video.media_url ??
    (cloudflareStreamId ? getCloudflarePlaybackUrl(cloudflareStreamId) : null);
  return {
    ...video,
    userId: video.userId,
    cloudflareStreamId,
    cloudflare_stream_id: cloudflareStreamId,
    mediaUrl,
    media_url: mediaUrl,
    thumbnailTimeMs: video.thumbnailTimeMs ?? video.thumbnail_time_ms ?? null,
    thumbnail_time_ms: video.thumbnailTimeMs ?? video.thumbnail_time_ms ?? null,
    videoFilter: normalizeVideoFilter(video.videoFilter ?? video.video_filter),
    textOverlays: normalizeVideoTextOverlays(video.textOverlays ?? video.text_overlays),
  };
}

export async function fetchSavedVideos(currentUserId: string) {
  const [{ data: savedVideos, error: savedVideosError }, jams, moderation] = await Promise.all([
    supabase
      .from("saved_videos")
      .select("video_id, created_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false }),
    fetchRelevantJams(currentUserId),
    fetchFeedModeration(currentUserId),
  ]);

  if (savedVideosError) {
    if (isMissingSchemaError(savedVideosError)) {
      return fetchLocalSavedVideos(currentUserId);
    }
    throw savedVideosError;
  }

  const savedIds = (savedVideos ?? []).map((savedVideo) => savedVideo.video_id);
  if (savedIds.length === 0) return [];

  const videoResult = await supabase
    .from("videos")
    .select(VIDEO_COLUMNS_WITH_TAGS)
    .in("id", savedIds)
    .order("created_at", { ascending: false });
  let videos = videoResult.data as VideoRow[] | null;
  let videosError = videoResult.error;

  if (videosError && isMissingSchemaError(videosError)) {
    const tagsRetry = await supabase
      .from("videos")
      .select(VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION)
      .in("id", savedIds)
      .order("created_at", { ascending: false });
    if (!tagsRetry.error || !isMissingSchemaError(tagsRetry.error)) {
      videos = tagsRetry.data as VideoRow[] | null;
      videosError = tagsRetry.error;
    } else {
      const categoryRetry = await supabase
        .from("videos")
        .select(VIDEO_COLUMNS_WITH_CATEGORIES)
        .in("id", savedIds)
        .order("created_at", { ascending: false });
      if (categoryRetry.error && isMissingSchemaError(categoryRetry.error)) {
        const legacyRetry = await supabase
          .from("videos")
          .select(VIDEO_COLUMNS_LEGACY)
          .in("id", savedIds)
          .order("created_at", { ascending: false });
        videos = legacyRetry.data as VideoRow[] | null;
        videosError = legacyRetry.error;
      } else {
        videos = categoryRetry.data as VideoRow[] | null;
        videosError = categoryRetry.error;
      }
    }
  }

  if (videosError) throw videosError;

  const videoRows = ((videos ?? []) as VideoRow[]).filter(
    (video) =>
      !moderation.hiddenUserIds.has(video.user_id) &&
      !moderation.blockedUserIds.has(video.user_id),
  );
  const profiles = await fetchProfilesByIds(videoRows.map((video) => video.user_id));
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = getConnectedJamUserIds(jams, currentUserId);

  return videoRows.map((video) =>
    toSavedProfileVideo(video, profiles.get(video.user_id), true, jammedByMe, jammedMe, connected),
  );
}

export async function saveVideo(currentUserId: string, videoId: string) {
  const { error } = await supabase.from("saved_videos").upsert(
    {
      user_id: currentUserId,
      video_id: videoId,
    },
    { onConflict: "user_id,video_id" },
  );

  if (error && error.code !== "23505") {
    if (isMissingSchemaError(error)) {
      await addLocalSavedVideoId(currentUserId, videoId);
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
      await removeLocalSavedVideoId(currentUserId, videoId);
      return;
    }
    throw error;
  }
}

export async function hideCreator(currentUserId: string, hiddenUserId: string) {
  const { error } = await supabase.from("user_hidden_creators").upsert(
    {
      user_id: currentUserId,
      hidden_user_id: hiddenUserId,
    },
    { onConflict: "user_id,hidden_user_id" },
  );

  if (error) throw error;

  await Promise.all([
    removeSavedVideosByCreator(currentUserId, hiddenUserId),
    clearCreatorPostAlertQuietly(currentUserId, hiddenUserId),
  ]);
}

export async function blockUser(currentUserId: string, blockedUserId: string) {
  const { error } = await supabase.from("user_blocks").upsert(
    {
      blocker_id: currentUserId,
      blocked_id: blockedUserId,
    },
    { onConflict: "blocker_id,blocked_id" },
  );

  if (error) throw error;

  // Jam/DM/saved cleanup for both sides is handled by the DB trigger on user_blocks.
  // Also clear this user's local/remote saves immediately so Saved updates without a reload race.
  await Promise.all([
    removeSavedVideosByCreator(currentUserId, blockedUserId),
    clearCreatorPostAlertQuietly(currentUserId, blockedUserId),
  ]);
}

export async function usersAreBlocked(userA: string, userB: string) {
  if (!userA || !userB || userA === userB) return false;

  const { data, error } = await supabase.rpc("users_are_blocked", {
    user_a: userA,
    user_b: userB,
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      const { data: blocks, error: blocksError } = await supabase
        .from("user_blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
        )
        .limit(1);
      if (blocksError) {
        if (isMissingSchemaError(blocksError)) return false;
        throw blocksError;
      }
      return (blocks ?? []).length > 0;
    }
    throw error;
  }

  return Boolean(data);
}

export async function fetchCreatorPostAlert(currentUserId: string, creatorId: string) {
  if (!currentUserId || !creatorId || currentUserId === creatorId) return false;

  const { data, error } = await supabase
    .from("creator_post_alerts")
    .select("creator_id")
    .eq("user_id", currentUserId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return false;
    throw error;
  }

  return Boolean(data);
}

export async function setCreatorPostAlert(
  currentUserId: string,
  creatorId: string,
  enabled: boolean,
) {
  if (!currentUserId || !creatorId) {
    throw new Error("missing user");
  }
  if (currentUserId === creatorId) {
    throw new Error("cannot subscribe to your own posts");
  }

  if (enabled) {
    const { error } = await supabase.from("creator_post_alerts").upsert(
      {
        user_id: currentUserId,
        creator_id: creatorId,
      },
      { onConflict: "user_id,creator_id" },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("creator_post_alerts")
    .delete()
    .eq("user_id", currentUserId)
    .eq("creator_id", creatorId);

  if (error) throw error;
}

async function clearCreatorPostAlertQuietly(currentUserId: string, creatorId: string) {
  try {
    await setCreatorPostAlert(currentUserId, creatorId, false);
  } catch {
    // Preference cleanup should not block hide/block.
  }
}

export async function unblockUser(currentUserId: string, blockedUserId: string) {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", currentUserId)
    .eq("blocked_id", blockedUserId);

  if (error) throw error;
}

export async function fetchBlockedUsers(currentUserId: string) {
  const { data: blocks, error: blocksError } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", currentUserId)
    .order("created_at", { ascending: false });

  if (blocksError) {
    if (isMissingSchemaError(blocksError)) return [];
    throw blocksError;
  }

  const blockRows = (blocks ?? []) as Array<{ blocked_id: string; created_at: string }>;
  const blockedIds = blockRows.map((row) => row.blocked_id);
  if (blockedIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(PROFILE_ROW_COLUMNS)
    .in("id", blockedIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  return blockRows.map((row): BlockedUser => {
    const profile = profilesById.get(row.blocked_id);
    const creatorName = profile ? getDisplayName(profile) : "Creator";
    return {
      userId: row.blocked_id,
      creatorName,
      role: profile ? getRole(profile) : "creator",
      location: profile ? getProfileLocation(profile) : "Unknown",
      avatarUrl: profile?.avatar_url ?? null,
      blockedAt: row.created_at,
    };
  });
}

export async function reportVideo(input: {
  reporterId: string;
  reportedUserId: string;
  videoId: string;
  reason: ReportReason;
}) {
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    video_id: input.videoId,
    reason: input.reason,
  });

  if (error) throw error;
}

export async function sendCreatorJamRequest(
  currentUserId: string,
  recipientUserId: string,
  body: string,
) {
  void currentUserId;
  await sendJamRequest(recipientUserId, body);
}

export async function removeJamConnection(otherUserId: string) {
  const { error } = await supabase.rpc("remove_jam_connection", {
    other_user_id: otherUserId,
  });

  if (error) {
    if (isMissingFunctionError(error)) {
      throw new Error("Unjam is not available yet. Apply migration 011_remove_jam_connection.sql to Supabase.");
    }
    throw error;
  }
}

export async function fetchRelationshipState(currentUserId: string, otherUserId: string) {
  if (await usersAreBlocked(currentUserId, otherUserId)) {
    return { jammedByMe: false, jammedMe: false };
  }

  const { data, error } = await supabase
    .from("jam_requests")
    .select("requester_id, recipient_id, connected_at")
    .or(
      `and(requester_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`,
    );

  if (error) {
    if (isMissingSchemaError(error)) {
      return { jammedByMe: false, jammedMe: false };
    }
    throw error;
  }

  const jams = (data ?? []) as JamRequestRow[];
  const connected = getConnectedJamUserIds(jams, currentUserId).has(otherUserId);
  return {
    jammedByMe: connected || jams.some(
      (jam) => jam.requester_id === currentUserId && jam.recipient_id === otherUserId,
    ),
    jammedMe: connected || jams.some(
      (jam) =>
        jam.requester_id === otherUserId && jam.recipient_id === currentUserId,
    ),
  };
}

export type DailyJamUsage = {
  used: number;
  limit: number;
  remaining: number;
  usageDate: string;
  resetsAt: string;
};

type DailyJamUsageRow = {
  used: number;
  daily_limit: number;
  remaining: number;
  usage_date: string;
  resets_at: string;
};

export async function fetchDailyJamUsage(): Promise<DailyJamUsage> {
  const { data, error } = await supabase.rpc("get_my_daily_jam_usage");
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as DailyJamUsageRow | null;
  if (!row) {
    throw new Error("Could not load daily jam usage.");
  }

  return {
    used: Number(row.used) || 0,
    limit: Number(row.daily_limit) || 5,
    remaining: Math.max(0, Number(row.remaining) || 0),
    usageDate: String(row.usage_date),
    resetsAt: String(row.resets_at),
  };
}

export function formatDailyJamUsageCopy(usage: DailyJamUsage) {
  if (usage.remaining <= 0) {
    return "no jams left today · resets at midnight";
  }
  if (usage.remaining === 1) {
    return `last jam for today · ${usage.limit} daily`;
  }
  return `${usage.remaining} of ${usage.limit} jams left today`;
}

export async function sendJamRequest(recipientUserId: string, body: string, sourceVideoId?: string | null) {
  const { data, error } = await supabase.rpc("send_jam_request", {
    recipient_user_id: recipientUserId,
    message_body: body,
    source_video_id: sourceVideoId ?? null,
  });

  if (error) {
    const message = error.message?.toLowerCase() ?? "";
    if (message.includes("daily jam limit")) {
      throw new Error("Daily jam limit reached. Your jams reset at midnight.");
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

export async function editMessage(messageId: string, body: string) {
  const { data, error } = await supabase.rpc("edit_direct_message", {
    message_id: messageId,
    message_body: body,
  });

  if (error) throw error;
  return data as MessageRow;
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase.rpc("delete_direct_message", {
    message_id: messageId,
  });

  if (error) throw error;
}

export async function markConversationRead(currentUserId: string, otherUserId: string) {
  const { error } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", currentUserId)
    .eq("sender_id", otherUserId)
    .is("read_at", null);

  if (error) throw error;
}

export async function markInboxMessageRead(messageId: string) {
  await addLocalReadInboxMessageId(messageId);
  const { error } = await supabase
    .from("inbox_messages")
    .update({ read: true })
    .eq("id", messageId);

  if (error) throw error;
}

export async function fetchInbox(currentUserId: string): Promise<InboxData> {
  const [jams, recentMessages, unreadMessages, systemMessages, moderation] = await Promise.all([
    fetchRelevantJams(currentUserId),
    fetchRecentMessagesForUser(currentUserId, INBOX_RECENT_MESSAGE_LIMIT),
    fetchUnreadMessagesForUser(currentUserId),
    fetchSystemMessages(currentUserId, SYSTEM_MESSAGE_PAGE_SIZE),
    fetchFeedModeration(currentUserId),
  ]);
  const messages = mergeMessageRows(recentMessages, unreadMessages);
  const blockedUserIds = moderation.blockedUserIds;

  const relatedIds = Array.from(
    new Set([
      ...jams.map((jam) => (jam.requester_id === currentUserId ? jam.recipient_id : jam.requester_id)),
      ...messages.map((message) =>
        message.sender_id === currentUserId ? message.recipient_id : message.sender_id,
      ),
    ]),
  ).filter((userId) => !blockedUserIds.has(userId));

  const profiles = await fetchProfilesByIds(relatedIds);
  const connectedUserIds = getConnectedJamUserIds(jams, currentUserId);

  const messagesByUser = new Map<string, MessageRow[]>();
  for (const message of messages) {
    const otherUserId =
      message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    if (blockedUserIds.has(otherUserId)) continue;
    messagesByUser.set(otherUserId, [...(messagesByUser.get(otherUserId) ?? []), message]);
  }

  const incomingRequestUserIds = new Set([
    ...jams
      .filter(
        (jam) =>
          jam.recipient_id === currentUserId &&
          !jam.connected_at &&
          !connectedUserIds.has(jam.requester_id) &&
          !blockedUserIds.has(jam.requester_id),
      )
      .map((jam) => jam.requester_id),
    ...messages
      .filter(
        (message) =>
          message.recipient_id === currentUserId &&
          !connectedUserIds.has(message.sender_id) &&
          !blockedUserIds.has(message.sender_id),
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
      const unreadCount = incomingThread.filter((message) => message.read_at === null).length;
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
        location: getProfileLocation(profile),
        avatarUrl: profile.avatar_url,
        preview: latestIncomingMessage?.body ?? "wants to jam with you",
        sentAt: formatRelativeTime(latestActivityAt),
        unreadCount,
        earlyAdopter: Boolean(profile.early_adopter),
        proBadge: getProBadgeKind({
          earlyAdopter: profile.early_adopter,
          videoCount: profile.video_count,
          proSubscriptionActive: profile.pro_subscription_active,
        }),
        video: toMessageVideoAttachment(latestIncomingMessage?.video ?? null),
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
      preview: request.preview,
      sentAt: request.sentAt,
      unreadCount: request.unreadCount,
      earlyAdopter: request.earlyAdopter,
      proBadge: request.proBadge,
      video: request.video ?? null,
    }));
  const sentUserIds = new Set(
    [
      ...jams
        .filter(
          (jam) =>
            jam.requester_id === currentUserId &&
            !jam.connected_at &&
            !connectedUserIds.has(jam.recipient_id) &&
            !blockedUserIds.has(jam.recipient_id),
        )
        .map((jam) => jam.recipient_id),
      ...Array.from(messagesByUser.entries())
        .filter(
          ([otherUserId, thread]) =>
            !connectedUserIds.has(otherUserId) &&
            !blockedUserIds.has(otherUserId) &&
            thread.some((message) => message.sender_id === currentUserId),
        )
        .map(([otherUserId]) => otherUserId),
    ],
  );

  const conversations = Array.from(connectedUserIds)
    .filter((otherUserId) => !blockedUserIds.has(otherUserId))
    .map((otherUserId) =>
      toConversation(
        currentUserId,
        otherUserId,
        profiles.get(otherUserId),
        messagesByUser,
        true,
        getLatestJamActivityAt(jams, currentUserId, otherUserId),
      ),
    )
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  const sent = Array.from(sentUserIds)
    .map((otherUserId) =>
      toConversation(
        currentUserId,
        otherUserId,
        profiles.get(otherUserId),
        messagesByUser,
        false,
        getLatestJamActivityAt(jams, currentUserId, otherUserId),
      ),
    )
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  return { requests, conversations, sent, systemMessages };
}

export async function fetchConversationMessages(
  currentUserId: string,
  otherUserId: string,
  options?: { cursor?: MessageCursor | null; limit?: number },
): Promise<MessagePage> {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId) {
    return { messages: [], nextCursor: null };
  }

  const limit = Math.max(1, Math.min(options?.limit ?? CONVERSATION_MESSAGE_PAGE_SIZE, 80));
  let query = supabase
    .from("direct_messages")
    .select(
      "id, sender_id, recipient_id, body, read_at, created_at, video_id, video:videos!direct_messages_video_id_fkey(id, user_id, caption, media_url, cloudflare_stream_id, thumbnail_time_ms)",
    )
    .or(
      `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (options?.cursor?.createdAt) {
    // Older page: strictly before the oldest loaded message timestamp.
    query = query.lt("created_at", options.cursor.createdAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as MessageRow[];
  const hasMore = rows.length > limit;
  const pageRows = (hasMore ? rows.slice(0, limit) : rows).slice().reverse();
  const oldest = pageRows[0];

  return {
    messages: pageRows.map((message) => ({
      id: message.id,
      body: message.body,
      incoming: message.sender_id !== currentUserId,
      createdAt: message.created_at,
      video: toMessageVideoAttachment(message.video),
    })),
    nextCursor:
      hasMore && oldest
        ? { createdAt: oldest.created_at, id: oldest.id }
        : null,
  };
}

export async function createVideo(input: {
  userId: string;
  caption: string;
  roles: string[];
  genres: string[];
  mediaUrl?: string | null;
  cloudflareStreamId?: string | null;
  thumbnailTimeMs?: number | null;
  videoFilter?: VideoFilterId | string | null;
  textOverlays?: VideoTextOverlay[] | unknown;
}): Promise<{ id: string }> {
  const roles = getUniqueTags(input.roles);
  const genres = getUniqueTags(input.genres);
  const categories = getUniqueTags([...roles, ...genres]);
  const mediaUrl = input.mediaUrl ?? getCloudflarePlaybackUrl(input.cloudflareStreamId);
  const thumbnailTimeMs =
    typeof input.thumbnailTimeMs === "number" && Number.isFinite(input.thumbnailTimeMs)
      ? Math.max(0, Math.round(input.thumbnailTimeMs))
      : null;
  const videoFilter = normalizeVideoFilter(input.videoFilter);
  const textOverlays = normalizeVideoTextOverlays(input.textOverlays);
  logVideoDatabaseStep("createVideo start", {
    hasCloudflareStreamId: Boolean(input.cloudflareStreamId),
    hasMediaUrl: Boolean(mediaUrl),
    captionLength: input.caption.length,
    roleCount: roles.length,
    genreCount: genres.length,
    videoFilter,
    textOverlayCount: textOverlays.length,
  });
  // Prefer payloads that keep video_filter/text_overlays. The live DB is missing
  // roles/genres columns, so categories+presentation must come before any fallback
  // that drops presentation (otherwise text/filter never persist).
  const insertAttempts: Array<Record<string, unknown>> = [
    {
      user_id: input.userId,
      caption: input.caption,
      roles,
      genres,
      categories,
      hashtags: [],
      media_url: mediaUrl,
      cloudflare_stream_id: input.cloudflareStreamId ?? null,
      thumbnail_time_ms: thumbnailTimeMs,
      video_filter: videoFilter,
      text_overlays: textOverlays,
    },
    {
      user_id: input.userId,
      caption: input.caption,
      categories,
      hashtags: [],
      media_url: mediaUrl,
      cloudflare_stream_id: input.cloudflareStreamId ?? null,
      thumbnail_time_ms: thumbnailTimeMs,
      video_filter: videoFilter,
      text_overlays: textOverlays,
    },
    {
      user_id: input.userId,
      caption: input.caption,
      roles,
      genres,
      categories,
      hashtags: [],
      media_url: mediaUrl,
      cloudflare_stream_id: input.cloudflareStreamId ?? null,
      thumbnail_time_ms: thumbnailTimeMs,
    },
    {
      user_id: input.userId,
      caption: input.caption,
      categories,
      hashtags: [],
      media_url: mediaUrl,
      cloudflare_stream_id: input.cloudflareStreamId ?? null,
      thumbnail_time_ms: thumbnailTimeMs,
    },
    {
      user_id: input.userId,
      caption: input.caption,
      hashtags: categories,
      media_url: mediaUrl,
      cloudflare_stream_id: input.cloudflareStreamId ?? null,
      video_filter: videoFilter,
      text_overlays: textOverlays,
    },
    {
      user_id: input.userId,
      caption: input.caption,
      hashtags: categories,
      media_url: mediaUrl,
      cloudflare_stream_id: input.cloudflareStreamId ?? null,
    },
    {
      user_id: input.userId,
      caption: input.caption,
      hashtags: categories,
      media_url: mediaUrl,
    },
  ];

  let lastSchemaError: unknown = null;
  for (const [index, payload] of insertAttempts.entries()) {
    const attempt = index + 1;
    logVideoDatabaseStep("createVideo insert attempt start", {
      attempt,
      columns: Object.keys(payload),
      hasCloudflareStreamIdColumn: "cloudflare_stream_id" in payload,
      hasRolesColumns: "roles" in payload || "genres" in payload,
      hasCategoriesColumn: "categories" in payload,
    });
    const { data, error } = await supabase.from("videos").insert(payload).select("id").single();
    if (!error) {
      logVideoDatabaseStep("createVideo insert attempt success", { attempt, videoId: data.id });
      return { id: data.id as string };
    }
    logVideoDatabaseStep("createVideo insert attempt failed", {
      attempt,
      schemaFallback: isMissingSchemaError(error),
      ...getErrorDetails(error),
    });
    if (!isMissingSchemaError(error)) {
      logVideoDatabaseStep("createVideo failed", {
        attempt,
        ...getErrorDetails(error),
      });
      throw error;
    }
    lastSchemaError = error;
  }

  logVideoDatabaseStep("createVideo failed all schema attempts", getErrorDetails(lastSchemaError));
  throw lastSchemaError;
}

export async function deleteVideo(videoId: string) {
  // Prefer the upload API (Stream media + DB). If that host doesn't support delete yet,
  // fall back to deleting the DB row directly so the profile still updates.
  try {
    const result = await deleteCloudflareVideo(videoId);
    if (result.deleted && result.viaApi) return;
  } catch (error) {
    logVideoDatabaseStep("deleteVideo api failed, falling back to database delete", {
      videoId,
      ...getErrorDetails(error),
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Log in again before deleting.");
  }

  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", videoId)
    .eq("user_id", user.id);

  if (error) {
    logVideoDatabaseStep("deleteVideo database failed", {
      videoId,
      ...getErrorDetails(error),
    });
    throw new Error(error.message || "Could not delete video.");
  }

  logVideoDatabaseStep("deleteVideo database success", { videoId });
}

async function fetchSavedVideoRows(currentUserId: string) {
  const { data, error } = await supabase
    .from("saved_videos")
    .select("user_id, video_id, created_at")
    .eq("user_id", currentUserId);

  if (error) {
    if (isMissingSchemaError(error)) return fetchLocalSavedVideoRows(currentUserId);
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
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as JamRequestRow[];
}

async function fetchFeedModeration(currentUserId: string) {
  const [{ data: hiddenCreators, error: hiddenError }, { data: blocks, error: blocksError }] =
    await Promise.all([
      supabase
        .from("user_hidden_creators")
        .select("hidden_user_id")
        .eq("user_id", currentUserId),
      supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`),
    ]);

  if (hiddenError) {
    if (!isMissingSchemaError(hiddenError)) throw hiddenError;
  }

  if (blocksError) {
    if (!isMissingSchemaError(blocksError)) throw blocksError;
  }

  const hiddenUserIds = new Set(
    ((hiddenCreators ?? []) as HiddenCreatorRow[]).map((row) => row.hidden_user_id),
  );
  const blockedUserIds = new Set(
    ((blocks ?? []) as BlockRow[]).map((row) =>
      row.blocker_id === currentUserId ? row.blocked_id : row.blocker_id,
    ),
  );

  return { hiddenUserIds, blockedUserIds };
}

const MESSAGE_SELECT =
  "id, sender_id, recipient_id, body, read_at, created_at, video_id, video:videos!direct_messages_video_id_fkey(id, user_id, caption, media_url, cloudflare_stream_id, thumbnail_time_ms)";

async function fetchRecentMessagesForUser(currentUserId: string, limit: number) {
  const { data, error } = await supabase
    .from("direct_messages")
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as unknown as MessageRow[]).slice().reverse();
}

async function fetchUnreadMessagesForUser(currentUserId: string) {
  const { data, error } = await supabase
    .from("direct_messages")
    .select(MESSAGE_SELECT)
    .eq("recipient_id", currentUserId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as unknown as MessageRow[];
}

function mergeMessageRows(...groups: MessageRow[][]) {
  const byId = new Map<string, MessageRow>();
  for (const group of groups) {
    for (const message of group) {
      byId.set(message.id, message);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function fetchFeedVideoRowsPage(
  currentUserId: string,
  cursor: FeedCursor | null,
  limit: number,
): Promise<{ rows: VideoRow[]; error: unknown | null }> {
  const columnSets = [
    VIDEO_COLUMNS_WITH_TAGS,
    VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION,
    VIDEO_COLUMNS_WITH_CATEGORIES,
    VIDEO_COLUMNS_LEGACY,
  ];

  let lastError: unknown = null;
  for (const columns of columnSets) {
    let query = supabase
      .from("videos")
      .select(columns)
      .neq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (cursor?.createdAt && cursor.id) {
      query = query.or(
        `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (!error) {
      return { rows: (data ?? []) as unknown as VideoRow[], error: null };
    }
    lastError = error;
    if (!isMissingSchemaError(error)) {
      return { rows: [], error };
    }
  }

  return { rows: [], error: lastError };
}

async function fetchSystemMessages(currentUserId: string, limit = SYSTEM_MESSAGE_PAGE_SIZE) {
  const [{ data, error }, localReadIds] = await Promise.all([
    supabase
      .from("inbox_messages")
      .select("id, sender_name, sender_avatar, body, created_at, read")
      .eq("recipient_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(limit),
    getLocalReadInboxMessageIds(),
  ]);

  if (error) throw error;
  return ((data ?? []) as InboxMessage[]).map((message) => ({
    ...message,
    read: message.read || localReadIds.has(message.id),
  }));
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_ROW_COLUMNS)
    .in("id", userIds);

  if (error) throw error;
  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function fetchLocalSavedVideoRows(currentUserId: string) {
  const savedVideoIds = await getLocalSavedVideoIds(currentUserId);
  if (savedVideoIds.size === 0) return [];

  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, user_id, created_at")
    .in("id", [...savedVideoIds]);

  if (error) throw error;

  return ((videos ?? []) as Array<Pick<VideoRow, "id" | "user_id" | "created_at">>).map(
    (video) => ({
      user_id: currentUserId,
      video_id: video.id,
      created_at: video.created_at,
    }),
  );
}

async function fetchLocalSavedVideos(currentUserId: string) {
  const savedVideoIds = await getLocalSavedVideoIds(currentUserId);
  if (savedVideoIds.size === 0) return [];

  const [videoResult, jams, moderation] = await Promise.all([
    supabase
      .from("videos")
      .select(VIDEO_COLUMNS_WITH_TAGS)
      .in("id", [...savedVideoIds])
      .order("created_at", { ascending: false }),
    fetchRelevantJams(currentUserId),
    fetchFeedModeration(currentUserId),
  ]);
  let videos = videoResult.data as VideoRow[] | null;
  let videosError = videoResult.error;

  if (videosError && isMissingSchemaError(videosError)) {
    const tagsRetry = await supabase
      .from("videos")
      .select(VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION)
      .in("id", [...savedVideoIds])
      .order("created_at", { ascending: false });
    if (!tagsRetry.error || !isMissingSchemaError(tagsRetry.error)) {
      videos = tagsRetry.data as VideoRow[] | null;
      videosError = tagsRetry.error;
    } else {
      const categoryRetry = await supabase
        .from("videos")
        .select(VIDEO_COLUMNS_WITH_CATEGORIES)
        .in("id", [...savedVideoIds])
        .order("created_at", { ascending: false });
      if (categoryRetry.error && isMissingSchemaError(categoryRetry.error)) {
        const legacyRetry = await supabase
          .from("videos")
          .select(VIDEO_COLUMNS_LEGACY)
          .in("id", [...savedVideoIds])
          .order("created_at", { ascending: false });
        videos = legacyRetry.data as VideoRow[] | null;
        videosError = legacyRetry.error;
      } else {
        videos = categoryRetry.data as VideoRow[] | null;
        videosError = categoryRetry.error;
      }
    }
  }

  if (videosError) throw videosError;

  const videoRows = ((videos ?? []) as VideoRow[]).filter(
    (video) =>
      !moderation.hiddenUserIds.has(video.user_id) &&
      !moderation.blockedUserIds.has(video.user_id),
  );
  const profiles = await fetchProfilesByIds(videoRows.map((video) => video.user_id));
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = getConnectedJamUserIds(jams, currentUserId);

  return videoRows.map((video) =>
    toSavedProfileVideo(video, profiles.get(video.user_id), true, jammedByMe, jammedMe, connected),
  );
}

async function removeSavedVideosByCreator(currentUserId: string, creatorUserId: string) {
  if (!currentUserId || !creatorUserId || currentUserId === creatorUserId) return;

  const { data: creatorVideos, error: videosError } = await supabase
    .from("videos")
    .select("id")
    .eq("user_id", creatorUserId);

  if (videosError) {
    if (isMissingSchemaError(videosError)) return;
    throw videosError;
  }

  const videoIds = ((creatorVideos ?? []) as Array<{ id: string }>).map((video) => video.id);
  if (videoIds.length === 0) return;

  const { error } = await supabase
    .from("saved_videos")
    .delete()
    .eq("user_id", currentUserId)
    .in("video_id", videoIds);

  if (error) {
    if (isMissingSchemaError(error)) {
      await Promise.all(videoIds.map((videoId) => removeLocalSavedVideoId(currentUserId, videoId)));
      return;
    }
    throw error;
  }

  // Keep any local fallback cache in sync with the remote purge.
  await Promise.all(videoIds.map((videoId) => removeLocalSavedVideoId(currentUserId, videoId)));
}

async function getLocalSavedVideoIds(currentUserId: string) {
  const stored = await AsyncStorage.getItem(getLocalSavedKey(currentUserId));
  if (!stored) return new Set<string>();

  try {
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

async function addLocalSavedVideoId(currentUserId: string, videoId: string) {
  const current = await getLocalSavedVideoIds(currentUserId);
  current.add(videoId);
  await AsyncStorage.setItem(getLocalSavedKey(currentUserId), JSON.stringify([...current]));
}

async function removeLocalSavedVideoId(currentUserId: string, videoId: string) {
  const current = await getLocalSavedVideoIds(currentUserId);
  if (!current.delete(videoId)) return;
  await AsyncStorage.setItem(getLocalSavedKey(currentUserId), JSON.stringify([...current]));
}

function getLocalSavedKey(currentUserId: string) {
  return `jam.localSavedVideos.${currentUserId}`;
}

async function getLocalReadInboxMessageIds() {
  const stored = await AsyncStorage.getItem("jam.localReadInboxMessages");
  if (!stored) return new Set<string>();

  try {
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

async function addLocalReadInboxMessageId(messageId: string) {
  const current = await getLocalReadInboxMessageIds();
  current.add(messageId);
  await AsyncStorage.setItem("jam.localReadInboxMessages", JSON.stringify([...current]));
}

function getCloudflarePlaybackUrl(streamId: string | null | undefined) {
  return streamId ? `https://videodelivery.net/${streamId}/manifest/video.m3u8` : null;
}

function logVideoDatabaseStep(step: string, details?: Record<string, unknown>) {
  console.log(`[video upload] database ${step}`, details ?? {});
}

function getErrorDetails(error: unknown) {
  if (isSupabaseError(error)) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
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

function getLatestJamActivityAt(
  jams: JamRequestRow[],
  currentUserId: string,
  otherUserId: string,
) {
  return jams
    .filter(
      (jam) =>
        (jam.requester_id === currentUserId && jam.recipient_id === otherUserId) ||
        (jam.recipient_id === currentUserId && jam.requester_id === otherUserId),
    )
    .flatMap((jam) => [jam.connected_at, jam.created_at].filter((value): value is string => Boolean(value)))
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? null;
}

function toConversation(
  currentUserId: string,
  otherUserId: string,
  profile: ProfileRow | undefined,
  messagesByUser: Map<string, MessageRow[]>,
  unlocked: boolean,
  fallbackActivityAt?: string | null,
): Conversation | null {
  if (!profile) return null;

  const thread = (messagesByUser.get(otherUserId) ?? []).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const lastMessage = thread.at(-1);
  const unreadCount = thread.filter(
    (message) => message.recipient_id === currentUserId && message.read_at === null,
  ).length;
  const lastActivityAt = lastMessage?.created_at ?? fallbackActivityAt ?? new Date(0).toISOString();

  return {
    id: otherUserId,
    userId: otherUserId,
    creatorName: getDisplayName(profile),
    avatarUrl: profile.avatar_url,
    role: getRole(profile),
    location: getProfileLocation(profile),
    lastMessage:
      lastMessage?.body ??
      (unlocked ? "you are jamming. chat is open." : "jam sent. waiting for a reply."),
    timestamp: formatRelativeTime(lastActivityAt),
    lastActivityAt,
    unread: unreadCount > 0,
    unreadCount,
    earlyAdopter: Boolean(profile.early_adopter),
    proBadge: getProBadgeKind({
      earlyAdopter: profile.early_adopter,
      videoCount: profile.video_count,
      proSubscriptionActive: profile.pro_subscription_active,
    }),
    unlocked,
    // Keep a small recent window in the list; open chat hydrates a proper page.
    messages: thread.slice(-CONVERSATION_MESSAGE_PAGE_SIZE).map((message) => ({
      id: message.id,
      body: message.body,
      incoming: message.sender_id !== currentUserId,
      createdAt: message.created_at,
      video: toMessageVideoAttachment(message.video),
    })),
    hasMoreMessages: thread.length > CONVERSATION_MESSAGE_PAGE_SIZE,
    olderMessagesCursor:
      thread.length > CONVERSATION_MESSAGE_PAGE_SIZE
        ? {
            createdAt: thread[thread.length - CONVERSATION_MESSAGE_PAGE_SIZE]?.created_at ?? thread[0].created_at,
            id: thread[thread.length - CONVERSATION_MESSAGE_PAGE_SIZE]?.id ?? thread[0].id,
          }
        : null,
  };
}

function toMessageVideoAttachment(
  relation: MessageVideoRow | MessageVideoRow[] | null,
): MessageVideoAttachment | null {
  const video = Array.isArray(relation) ? relation[0] : relation;
  if (!video?.id || !video.user_id) return null;

  return {
    id: video.id,
    userId: video.user_id,
    caption: video.caption ?? "",
    mediaUrl: video.media_url,
    cloudflareStreamId: video.cloudflare_stream_id,
    thumbnailTimeMs: video.thumbnail_time_ms,
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
  const savedByCurrentUser = savedByMe.has(video.id);
  const connectedWithCurrentUser = connected.has(video.user_id);
  const tags = getVideoTags(video);
  const creatorName = profile ? getDisplayName(profile) : "Creator";
  const proBadge = getProBadgeKind({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });

  return {
    id: video.id,
    userId: video.user_id,
    creatorName,
    role: profile ? getRole(profile) : "creator",
    location: profile ? getProfileLocation(profile) : "Unknown",
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
    liveLatitude: profile?.live_latitude ?? null,
    liveLongitude: profile?.live_longitude ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    caption: video.caption ?? "",
    hashtags: video.hashtags ?? [],
    categories: tags.categories,
    roles: tags.roles,
    genres: tags.genres,
    mediaUrl: video.media_url,
    cloudflareStreamId: video.cloudflare_stream_id,
    thumbnailTimeMs: video.thumbnail_time_ms ?? null,
    videoFilter: normalizeVideoFilter(video.video_filter),
    textOverlays: normalizeVideoTextOverlays(video.text_overlays),
    earlyAdopter: Boolean(profile?.early_adopter),
    proBadge,
    videoCount: profile?.video_count ?? 0,
    createdAt: video.created_at,
    savedByMe: savedByCurrentUser,
    mutual: connectedWithCurrentUser || (jammedByMe.has(video.user_id) && jammedMe.has(video.user_id)),
    jammedByMe: jammedByMe.has(video.user_id),
    jammedMe: jammedMe.has(video.user_id),
  };
}

function toSavedProfileVideo(
  video: VideoRow,
  profile: ProfileRow | undefined,
  savedByMe: boolean,
  jammedByMe = new Set<string>(),
  jammedMe = new Set<string>(),
  connected = new Set<string>(),
): ProfileVideo {
  const creatorName = profile ? getDisplayName(profile) : "creator";
  const connectedWithCurrentUser = connected.has(video.user_id);
  const tags = getVideoTags(video);
  return {
    id: video.id,
    userId: video.user_id,
    creatorName,
    role: profile ? getRole(profile) : "creator",
    location: profile ? getProfileLocation(profile) : "unknown",
    avatarUrl: profile?.avatar_url ?? null,
    earlyAdopter: Boolean(profile?.early_adopter),
    proBadge: getProBadgeKind({
      earlyAdopter: profile?.early_adopter,
      videoCount: profile?.video_count,
      proSubscriptionActive: profile?.pro_subscription_active,
    }),
    caption: video.caption ?? "",
    hashtags: video.hashtags ?? [],
    categories: tags.categories,
    roles: tags.roles,
    genres: tags.genres,
    mediaUrl: video.media_url,
    cloudflareStreamId: video.cloudflare_stream_id,
    thumbnailTimeMs: video.thumbnail_time_ms ?? null,
    videoFilter: normalizeVideoFilter(video.video_filter),
    textOverlays: normalizeVideoTextOverlays(video.text_overlays),
    created_at: video.created_at,
    savedByMe,
    mutual: connectedWithCurrentUser || (jammedByMe.has(video.user_id) && jammedMe.has(video.user_id)),
    jammedByMe: jammedByMe.has(video.user_id),
    jammedMe: jammedMe.has(video.user_id),
  };
}

function getConnectedJamUserIds(jams: JamRequestRow[], currentUserId: string) {
  const connected = new Set<string>();
  const jamPairs = new Set(
    jams.map((jam) => `${jam.requester_id}:${jam.recipient_id}`),
  );

  for (const jam of jams) {
    const otherUserId =
      jam.requester_id === currentUserId ? jam.recipient_id : jam.requester_id;
    const hasReciprocalJam = jamPairs.has(`${jam.recipient_id}:${jam.requester_id}`);

    if (jam.connected_at || hasReciprocalJam) {
      connected.add(otherUserId);
    }
  }

  return connected;
}

function getDisplayName(profile: Pick<ProfileRow, "display_name">) {
  return profile.display_name?.trim() || "Creator";
}

function getProfileLocation(profile: Pick<ProfileRow, "country" | "city" | "location">) {
  const country = profile.country?.trim();
  const city = profile.city?.trim();
  if (country && city) return `${city}, ${country}`;
  return country || profile.location?.trim() || "Unknown";
}

function getVideoTags(video: VideoRow) {
  const categories = getUniqueTags(video.categories?.length ? video.categories : video.hashtags ?? []);
  const roleSource = getUniqueTags(video.roles?.length ? video.roles : categories);
  const genreSource = getUniqueTags(video.genres?.length ? video.genres : categories);
  const roles = roleSource.filter((tag) => creatorRoleSet.has(normalizeTag(tag)));
  const genres = genreSource.filter((tag) => musicGenreSet.has(normalizeTag(tag)));

  return {
    categories,
    roles: getUniqueTags(roles),
    genres: getUniqueTags(genres),
  };
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
}

function getUniqueTags(tags: readonly string[]) {
  const seen = new Set<string>();
  const uniqueTags: string[] = [];

  for (const tag of tags) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag || seen.has(normalizedTag)) continue;
    seen.add(normalizedTag);
    uniqueTags.push(tag);
  }

  return uniqueTags;
}

function getRole(profile: ProfileRow) {
  return profile.creator_types?.[0] ?? "creator";
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
