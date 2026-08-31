import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearDiscoverFeedSessionCache } from "@/lib/discover-feed-session-cache";
import { geocodeProfileLocation } from "@/lib/geocode";
import { publishJamRelationship } from "@/lib/jam-relationship-sync";
import { deleteCloudflareVideo, getCloudflarePlaybackUrl, assertStreamPublishable } from "@/lib/native-cloudflare";
import { isOwnedPostMediaUrl } from "@/lib/native-slideshow-storage";
import { creatorRoles, musicGenres } from "@/lib/options";
import { getProBadgeKind, type ProBadgeKind } from "@/lib/pro-entitlements";
import { supabase } from "@/lib/native-supabase";
import type { VideoFilterId } from "@/lib/video-filters";
import {
  normalizeVideoFilter,
  normalizeVideoTextOverlays,
  type VideoTextOverlay,
} from "@/lib/video-presentation";

export type PostMediaType = "video" | "slideshow";

export type FeedVideo = {
  id: string;
  userId: string;
  creatorName: string;
  role: string;
  location: string;
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
  /** Creator tagged this post as looking for collaborators. */
  lookingFor: boolean;
  /** 1–3 when pinned on the creator profile. */
  pinnedRank?: number | null;
  mediaType: PostMediaType;
  imageUrls: string[];
  audioUrl: string | null;
  audioDurationMs: number | null;
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
  live_location_updated_at: string | null;
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
  looking_for?: boolean | null;
  lookingFor?: boolean;
  /** 1–3 when pinned on the creator profile; null/undefined when unpinned. */
  pinned_rank?: number | null;
  pinnedRank?: number | null;
  mediaType?: PostMediaType | null;
  media_type?: string | null;
  imageUrls?: string[] | null;
  image_urls?: string[] | null;
  audioUrl?: string | null;
  audio_url?: string | null;
  audioDurationMs?: number | null;
  audio_duration_ms?: number | null;
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
  /** Stable random permutation seed for this feed session (unseen or replay). */
  seed: string;
  /** md5(id || seed) keyset cursor from the last returned row. */
  sortKey: string;
  id: string;
};

function createFeedSeed() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Discover feed pool: unseen first, then replay of recently seen clips. */
export type FeedPhase = "unseen" | "replay";

export type FeedPage = {
  items: FeedVideo[];
  nextCursor: FeedCursor | null;
  phase: FeedPhase;
};

/** Optional discover filters applied server-side (role/genre overlaps, location OR). */
export type FeedLocationFilter = {
  country: string;
  cities: string[];
  country_aliases?: string[];
};

export type FeedContentFilters = {
  roles?: string[];
  genres?: string[];
  locations?: FeedLocationFilter[];
  /** When true, only return videos tagged looking_for. */
  lookingForOnly?: boolean;
};

/** Soft TTL for seen_videos — matches server video_is_recently_seen default. */
export const FEED_SEEN_TTL_DAYS = 30;
/** Dwell time before a playing clip counts as seen. */
export const FEED_SEEN_DWELL_MS = 2500;

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
  | "avatar_url"
  | "bio"
  | "early_adopter"
  | "video_count"
  | "pro_subscription_active"
>;

type ProfileLocationRow = {
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  live_latitude: number | null;
  live_longitude: number | null;
  live_location_updated_at: string | null;
};

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
  looking_for?: boolean | null;
  pinned_rank?: number | null;
  media_type?: string | null;
  image_urls?: string[] | null;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
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
  /** Prefer saved_at; created_at kept for pre-migration fallbacks. */
  saved_at?: string;
  created_at?: string;
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
  "id, user_id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, looking_for, pinned_rank, media_type, image_urls, audio_url, audio_duration_ms, created_at";
const OWN_VIDEO_COLUMNS_WITH_TAGS =
  "id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, looking_for, pinned_rank, media_type, image_urls, audio_url, audio_duration_ms, created_at";
const VIDEO_COLUMNS_WITH_TAGS_NO_PIN =
  "id, user_id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, looking_for, created_at";
const OWN_VIDEO_COLUMNS_WITH_TAGS_NO_PIN =
  "id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, looking_for, created_at";
const VIDEO_COLUMNS_WITH_TAGS_NO_LOOKING_FOR =
  "id, user_id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, created_at";
const OWN_VIDEO_COLUMNS_WITH_TAGS_NO_LOOKING_FOR =
  "id, caption, hashtags, categories, roles, genres, media_url, cloudflare_stream_id, thumbnail_time_ms, video_filter, text_overlays, created_at";

export const MAX_PINNED_PROFILE_VIDEOS = 3;
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
  "id, display_name, bio, creator_types, location, country, city, near_me_radius_miles, avatar_url, onboarding_complete, welcome_seen, early_adopter, video_count, pro_subscription_active";
const PROFILE_ROW_COLUMNS =
  "id, display_name, creator_types, location, country, city, avatar_url, bio, early_adopter, video_count, pro_subscription_active";
const PROFILE_LOCATION_COLUMNS =
  "user_id, latitude, longitude, live_latitude, live_longitude, live_location_updated_at";
const creatorRoleSet = new Set(creatorRoles.map(normalizeTag));
const musicGenreSet = new Set(musicGenres.map(normalizeTag));

type ProfileLocationFields = Pick<
  Profile,
  | "latitude"
  | "longitude"
  | "live_latitude"
  | "live_longitude"
  | "live_location_updated_at"
>;

const EMPTY_PRIVATE_LOCATION: ProfileLocationFields = {
  latitude: null,
  longitude: null,
  live_latitude: null,
  live_longitude: null,
  live_location_updated_at: null,
};

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return attachPrivateLocation(data as Omit<Profile, keyof ProfileLocationFields>);
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
  if (!data) return null;
  // Never attach private coords for another user's profile response.
  return { ...(data as Omit<Profile, keyof ProfileLocationFields>), ...EMPTY_PRIVATE_LOCATION };
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
    const pinRetry = await supabase
      .from("videos")
      .select(OWN_VIDEO_COLUMNS_WITH_TAGS_NO_PIN)
      .eq("user_id", creatorId)
      .order("created_at", { ascending: false });
    if (!pinRetry.error || !isMissingSchemaError(pinRetry.error)) {
      data = pinRetry.data as ProfileVideo[] | null;
      error = pinRetry.error;
    } else {
      const lookingForRetry = await supabase
        .from("videos")
        .select(OWN_VIDEO_COLUMNS_WITH_TAGS_NO_LOOKING_FOR)
        .eq("user_id", creatorId)
        .order("created_at", { ascending: false });
      if (!lookingForRetry.error || !isMissingSchemaError(lookingForRetry.error)) {
        data = lookingForRetry.data as ProfileVideo[] | null;
        error = lookingForRetry.error;
      } else {
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
    }
  }

  if (error) throw error;
  return ((data ?? []) as ProfileVideo[]).map((video) =>
    normalizeOwnProfileVideo(video, creatorId),
  );
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
      | "near_me_radius_miles"
      | "avatar_url"
      | "onboarding_complete"
      | "welcome_seen"
    >
  >,
) {
  const hasLocationUpdate = "country" in input || "city" in input;
  const payload: Record<string, unknown> = { id: userId, ...input };

  delete payload.latitude;
  delete payload.longitude;
  delete payload.live_latitude;
  delete payload.live_longitude;
  delete payload.live_location_updated_at;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;

  if (!hasLocationUpdate) {
    return attachPrivateLocation(data as Omit<Profile, keyof ProfileLocationFields>);
  }

  const trimmedCountry = input.country?.trim() ?? "";
  const trimmedCity = input.city?.trim() ?? "";

  if (!trimmedCountry && !trimmedCity) {
    await upsertPrivateProfileGeocode(userId, null);
    return attachPrivateLocation(data as Omit<Profile, keyof ProfileLocationFields>);
  }

  const coordinates = await geocodeProfileLocation(input.country, input.city);
  if (coordinates) {
    await upsertPrivateProfileGeocode(userId, coordinates);
  }

  return attachPrivateLocation(data as Omit<Profile, keyof ProfileLocationFields>);
}

export async function updateLiveLocation(
  userId: string,
  coordinates: { latitude: number; longitude: number } | null,
) {
  const { data: existing, error: existingError } = await supabase
    .from("profile_locations")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  const livePayload = {
    live_latitude: coordinates?.latitude ?? null,
    live_longitude: coordinates?.longitude ?? null,
    live_location_updated_at: coordinates ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("profile_locations")
      .update(livePayload)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("profile_locations").insert({
      user_id: userId,
      latitude: null,
      longitude: null,
      ...livePayload,
    });
    if (error) throw error;
  }

  const profile = await fetchProfile(userId);
  if (!profile) throw new Error("profile not found");
  return profile;
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

function normalizeFeedFilterTags(tags: readonly string[] | undefined) {
  return (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeFeedPhase(phase?: FeedPhase | null): FeedPhase {
  return phase === "replay" ? "replay" : "unseen";
}

/** Upsert a per-video seen row (extends the 30-day soft TTL on rewatch). */
export async function markVideoSeen(currentUserId: string, videoId: string) {
  if (!currentUserId || !videoId) return;

  const { error } = await supabase.from("seen_videos").upsert(
    {
      user_id: currentUserId,
      video_id: videoId,
      seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,video_id" },
  );

  if (error) {
    if (isMissingSchemaError(error)) return;
    throw error;
  }
}

export async function fetchFeedVideos(
  currentUserId: string,
  options?: {
    cursor?: FeedCursor | null;
    limit?: number;
    filters?: FeedContentFilters | null;
    phase?: FeedPhase | null;
  },
): Promise<FeedPage> {
  // Global + filtered discover both go through the RPC so seen phases stay consistent.
  return fetchFilteredFeedVideos(currentUserId, options ?? {});
}

/** Newest video timestamp — used to invalidate session feed caches when something new posts. */
export async function fetchNewestVideoCreatedAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from("videos")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.created_at) return null;
  return data.created_at;
}

/** Role / genre / location filtered global feed (server-side overlaps + profile location). */
async function fetchFilteredFeedVideos(
  currentUserId: string,
  options: {
    cursor?: FeedCursor | null;
    limit?: number;
    filters?: FeedContentFilters | null;
    phase?: FeedPhase | null;
  },
): Promise<FeedPage> {
  const limit = Math.max(1, Math.min(options.limit ?? FEED_PAGE_SIZE, 40));
  const phase = normalizeFeedPhase(options.phase);
  const roles = normalizeFeedFilterTags(options.filters?.roles);
  const genres = normalizeFeedFilterTags(options.filters?.genres);
  const locations = (options.filters?.locations ?? [])
    .map((selection) => ({
      country: selection.country.trim(),
      cities: normalizeFeedFilterTags(selection.cities),
      country_aliases: normalizeFeedFilterTags(selection.country_aliases),
    }))
    .filter((selection) => selection.country);

  const seed = options.cursor?.seed ?? createFeedSeed();
  const [savedVideos, jams, rpcResult] = await Promise.all([
    fetchSavedVideoRows(currentUserId),
    fetchRelevantJams(currentUserId),
    supabase.rpc("fetch_filtered_feed_videos", {
      filter_roles: roles.length ? roles : null,
      filter_genres: genres.length ? genres : null,
      filter_locations: locations.length ? locations : null,
      page_limit: limit + 1,
      cursor_sort_key: options.cursor?.sortKey ?? null,
      cursor_id: options.cursor?.id ?? null,
      feed_phase: phase,
      looking_for_only: Boolean(options.filters?.lookingForOnly),
      feed_seed: seed,
    }),
  ]);

  if (rpcResult.error) throw rpcResult.error;

  return hydrateFeedPageFromOrderedIds({
    currentUserId,
    orderedIds: (rpcResult.data ?? []) as Array<{ id: string; created_at: string; sort_key: string }>,
    limit,
    phase,
    seed,
    savedVideos,
    jams,
  });
}

export type NearbyFeedOptions = {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  cursor?: FeedCursor | null;
  limit?: number;
  roles?: string[];
  genres?: string[];
  phase?: FeedPhase | null;
  lookingForOnly?: boolean;
};

/** Distance-filtered feed page (server-side haversine, live-first with 72h TTL). */
export async function fetchNearbyFeedVideos(
  currentUserId: string,
  options: NearbyFeedOptions,
): Promise<FeedPage> {
  const limit = Math.max(1, Math.min(options.limit ?? FEED_PAGE_SIZE, 40));
  const phase = normalizeFeedPhase(options.phase);
  const roles = normalizeFeedFilterTags(options.roles);
  const genres = normalizeFeedFilterTags(options.genres);
  const seed = options.cursor?.seed ?? createFeedSeed();
  const [savedVideos, jams, rpcResult] = await Promise.all([
    fetchSavedVideoRows(currentUserId),
    fetchRelevantJams(currentUserId),
    supabase.rpc("fetch_nearby_feed_videos", {
      viewer_lat: options.latitude,
      viewer_lng: options.longitude,
      radius_miles: options.radiusMiles,
      page_limit: limit + 1,
      cursor_sort_key: options.cursor?.sortKey ?? null,
      cursor_id: options.cursor?.id ?? null,
      filter_roles: roles.length ? roles : null,
      filter_genres: genres.length ? genres : null,
      feed_phase: phase,
      looking_for_only: Boolean(options.lookingForOnly),
      feed_seed: seed,
    }),
  ]);

  if (rpcResult.error) throw rpcResult.error;

  return hydrateFeedPageFromOrderedIds({
    currentUserId,
    orderedIds: (rpcResult.data ?? []) as Array<{ id: string; created_at: string; sort_key: string }>,
    limit,
    phase,
    seed,
    savedVideos,
    jams,
  });
}

/** Nearby creator IDs within radius (live-first, same rules as discover near-me). */
export async function fetchNearbyUserIds(options: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
}): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("fetch_nearby_user_ids", {
    viewer_lat: options.latitude,
    viewer_lng: options.longitude,
    radius_miles: options.radiusMiles,
  });

  if (error) throw error;

  const ids = new Set<string>();
  for (const row of (data ?? []) as Array<{ user_id: string }>) {
    if (row?.user_id) ids.add(row.user_id);
  }
  return ids;
}

/**
 * Inbox Looking For filter: creators in `userIds` who currently have at least
 * one video tagged looking_for.
 */
export async function fetchLookingForUserIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("videos")
    .select("user_id")
    .in("user_id", uniqueIds)
    .eq("looking_for", true);

  if (error) {
    if (isMissingSchemaError(error)) return new Set();
    throw error;
  }

  const ids = new Set<string>();
  for (const row of (data ?? []) as Array<{ user_id: string | null }>) {
    if (row?.user_id) ids.add(row.user_id);
  }
  return ids;
}

async function hydrateFeedPageFromOrderedIds(input: {
  currentUserId: string;
  orderedIds: Array<{ id: string; created_at: string; sort_key: string }>;
  limit: number;
  phase: FeedPhase;
  seed: string;
  savedVideos: SavedVideoRow[];
  jams: JamRequestRow[];
}): Promise<FeedPage> {
  const { currentUserId, orderedIds, limit, phase, seed, savedVideos, jams } = input;
  const hasMore = orderedIds.length > limit;
  const pageIds = hasMore ? orderedIds.slice(0, limit) : orderedIds;
  if (pageIds.length === 0) {
    return { items: [], nextCursor: null, phase };
  }

  const videoRows = await fetchVideoRowsByIds(pageIds.map((row) => row.id));
  const videoById = new Map(videoRows.map((video) => [video.id, video]));
  const orderedRows = pageIds
    .map((row) => videoById.get(row.id))
    .filter((video): video is VideoRow => Boolean(video));

  const savedByMe = new Set(savedVideos.map((savedVideo) => savedVideo.video_id));
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = getConnectedJamUserIds(jams, currentUserId);
  const profiles = await fetchProfilesByIds(orderedRows.map((video) => video.user_id));

  const items: FeedVideo[] = [];
  for (const video of orderedRows) {
    const item = toFeedVideo(
      video,
      profiles.get(video.user_id),
      savedByMe,
      jammedByMe,
      jammedMe,
      connected,
    );
    if (!item) continue;
    items.push(item);
  }

  const lastRow = pageIds[pageIds.length - 1];
  return {
    items,
    nextCursor:
      hasMore && lastRow?.sort_key
        ? { seed, sortKey: lastRow.sort_key, id: lastRow.id }
        : null,
    phase,
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
    const pinRetry = await supabase
      .from("videos")
      .select(OWN_VIDEO_COLUMNS_WITH_TAGS_NO_PIN)
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });
    if (!pinRetry.error || !isMissingSchemaError(pinRetry.error)) {
      data = pinRetry.data as ProfileVideo[] | null;
      error = pinRetry.error;
    } else {
      const lookingForRetry = await supabase
        .from("videos")
        .select(OWN_VIDEO_COLUMNS_WITH_TAGS_NO_LOOKING_FOR)
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });
      if (!lookingForRetry.error || !isMissingSchemaError(lookingForRetry.error)) {
        data = lookingForRetry.data as ProfileVideo[] | null;
        error = lookingForRetry.error;
      } else {
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
    }
  }

  if (error) throw error;
  return ((data ?? []) as ProfileVideo[]).map((video) =>
    normalizeOwnProfileVideo(video, currentUserId),
  );
}

export function getProfileVideoPinnedRank(
  video:
    | Pick<ProfileVideo, "pinnedRank" | "pinned_rank">
    | Pick<FeedVideo, "pinnedRank">
    | null
    | undefined,
): number | null {
  const raw =
    video && "pinnedRank" in video
      ? video.pinnedRank
      : video && "pinned_rank" in video
        ? video.pinned_rank
        : null;
  return typeof raw === "number" && raw >= 1 && raw <= MAX_PINNED_PROFILE_VIDEOS ? raw : null;
}

function normalizePostMediaType(value: unknown): PostMediaType {
  return value === "slideshow" ? "slideshow" : "video";
}

function normalizeImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .slice(0, 10);
}

function normalizeOwnProfileVideo(video: ProfileVideo, ownerUserId?: string): ProfileVideo {
  const cloudflareStreamId = video.cloudflareStreamId ?? video.cloudflare_stream_id ?? null;
  const mediaType = normalizePostMediaType(video.mediaType ?? video.media_type);
  const imageUrls = normalizeImageUrls(video.imageUrls ?? video.image_urls);
  const audioUrl = video.audioUrl ?? video.audio_url ?? null;
  const audioDurationMs = video.audioDurationMs ?? video.audio_duration_ms ?? null;
  const mediaUrl =
    video.mediaUrl ??
    video.media_url ??
    (mediaType === "slideshow"
      ? imageUrls[0] ?? null
      : cloudflareStreamId
        ? getCloudflarePlaybackUrl(cloudflareStreamId)
        : null);
  const lookingFor = Boolean(video.lookingFor ?? video.looking_for);
  const pinnedRank = getProfileVideoPinnedRank(video);
  // Own/creator selects omit user_id — attach the known owner so profile → feed
  // mapping (and looking-for chrome) works in fullscreen.
  const userId = video.userId ?? ownerUserId;
  return {
    ...video,
    userId,
    cloudflareStreamId,
    cloudflare_stream_id: cloudflareStreamId,
    mediaUrl,
    media_url: mediaUrl,
    thumbnailTimeMs: video.thumbnailTimeMs ?? video.thumbnail_time_ms ?? null,
    thumbnail_time_ms: video.thumbnailTimeMs ?? video.thumbnail_time_ms ?? null,
    videoFilter: normalizeVideoFilter(video.videoFilter ?? video.video_filter),
    textOverlays: normalizeVideoTextOverlays(video.textOverlays ?? video.text_overlays),
    lookingFor,
    looking_for: lookingFor,
    pinnedRank,
    pinned_rank: pinnedRank,
    mediaType,
    media_type: mediaType,
    imageUrls,
    image_urls: imageUrls,
    audioUrl,
    audio_url: audioUrl,
    audioDurationMs,
    audio_duration_ms: audioDurationMs,
  };
}

/** Pin a profile video into the next free 1–3 slot. Throws if already at the cap. */
export async function pinProfileVideo(userId: string, videoId: string): Promise<number> {
  const { data: pinnedRows, error: listError } = await supabase
    .from("videos")
    .select("id, pinned_rank")
    .eq("user_id", userId)
    .not("pinned_rank", "is", null);

  if (listError) throw listError;

  const pinned = (pinnedRows ?? []) as Array<{ id: string; pinned_rank: number | null }>;
  const already = pinned.find((row) => row.id === videoId);
  if (already && typeof already.pinned_rank === "number") {
    return already.pinned_rank;
  }

  if (pinned.length >= MAX_PINNED_PROFILE_VIDEOS) {
    throw new Error(`you can pin up to ${MAX_PINNED_PROFILE_VIDEOS} videos`);
  }

  const used = new Set(
    pinned
      .map((row) => row.pinned_rank)
      .filter((rank): rank is number => typeof rank === "number"),
  );
  let nextRank = 1;
  while (used.has(nextRank) && nextRank <= MAX_PINNED_PROFILE_VIDEOS) {
    nextRank += 1;
  }

  const { error } = await supabase
    .from("videos")
    .update({ pinned_rank: nextRank })
    .eq("id", videoId)
    .eq("user_id", userId);

  if (error) throw error;
  return nextRank;
}

export async function unpinProfileVideo(userId: string, videoId: string): Promise<void> {
  const { error } = await supabase
    .from("videos")
    .update({ pinned_rank: null })
    .eq("id", videoId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function fetchOrderedSavedVideoRows(currentUserId: string): Promise<SavedVideoRow[]> {
  const modern = await supabase
    .from("saved_videos")
    .select("user_id, video_id, saved_at")
    .eq("user_id", currentUserId)
    .order("saved_at", { ascending: false });

  if (!modern.error) {
    return (modern.data ?? []) as SavedVideoRow[];
  }

  if (!isMissingSchemaError(modern.error)) throw modern.error;

  // Pre-047: column was created_at.
  const legacy = await supabase
    .from("saved_videos")
    .select("user_id, video_id, created_at")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (legacy.error) {
    if (isMissingSchemaError(legacy.error)) return fetchLocalSavedVideoRows(currentUserId);
    throw legacy.error;
  }

  return ((legacy.data ?? []) as SavedVideoRow[]).map((row) => ({
    ...row,
    saved_at: row.saved_at ?? row.created_at,
  }));
}

export async function fetchSavedVideos(currentUserId: string) {
  const [savedVideos, jams, moderation] = await Promise.all([
    fetchOrderedSavedVideoRows(currentUserId),
    fetchRelevantJams(currentUserId),
    fetchFeedModeration(currentUserId),
  ]);

  const savedIds = savedVideos.map((savedVideo) => savedVideo.video_id);
  if (savedIds.length === 0) return [];

  // Don't order videos by their own created_at — that would destroy save order.
  const videos = await fetchVideoRowsByIds(savedIds);

  const videoById = new Map(
    videos
      .filter(
        (video) =>
          !moderation.hiddenUserIds.has(video.user_id) &&
          !moderation.blockedUserIds.has(video.user_id),
      )
      .map((video) => [video.id, video]),
  );
  const profiles = await fetchProfilesByIds(
    [...videoById.values()].map((video) => video.user_id),
  );
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = getConnectedJamUserIds(jams, currentUserId);

  // Keep saved_at desc order from the saved_videos query.
  return savedIds
    .map((videoId) => videoById.get(videoId))
    .filter((video): video is VideoRow => Boolean(video))
    .map((video) =>
      toSavedProfileVideo(video, profiles.get(video.user_id), true, jammedByMe, jammedMe, connected),
    );
}

export async function saveVideo(currentUserId: string, videoId: string) {
  const savedAt = new Date().toISOString();
  const modern = await supabase.from("saved_videos").upsert(
    {
      user_id: currentUserId,
      video_id: videoId,
      saved_at: savedAt,
    },
    { onConflict: "user_id,video_id" },
  );

  if (!modern.error || modern.error.code === "23505") return;

  if (isMissingSchemaError(modern.error)) {
    // Pre-047 schema uses created_at; insert-only path (no bump on re-save).
    const legacy = await supabase.from("saved_videos").upsert(
      {
        user_id: currentUserId,
        video_id: videoId,
      },
      { onConflict: "user_id,video_id" },
    );
    if (!legacy.error || legacy.error.code === "23505") return;
    if (isMissingSchemaError(legacy.error)) {
      await addLocalSavedVideoId(currentUserId, videoId);
      return;
    }
    throw legacy.error;
  }

  throw modern.error;
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

  publishJamRelationship({
    userId: otherUserId,
    jammedByMe: false,
    jammedMe: false,
  });
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

  await publishFreshJamRelationship(recipientUserId, {
    jammedByMe: true,
    jammedMe: false,
  });

  return data as MessageRow;
}

/** Push DB-backed relationship state to any open feed/profile UI. */
async function publishFreshJamRelationship(
  otherUserId: string,
  fallback: { jammedByMe: boolean; jammedMe: boolean },
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      publishJamRelationship({ userId: otherUserId, ...fallback });
      return;
    }
    const relationship = await fetchRelationshipState(user.id, otherUserId);
    publishJamRelationship({ userId: otherUserId, ...relationship });
  } catch {
    publishJamRelationship({ userId: otherUserId, ...fallback });
  }
}

export async function sendMessage(
  recipientUserId: string,
  body: string,
  sourceVideoId?: string | null,
) {
  const payload: Record<string, unknown> = {
    recipient_user_id: recipientUserId,
    message_body: body,
  };
  if (sourceVideoId) {
    payload.source_video_id = sourceVideoId;
  }

  const { data, error } = await supabase.rpc("send_direct_message", payload);

  if (error) {
    // Older DBs without the video arg still accept text-only messages.
    if (sourceVideoId && isMissingSchemaError(error)) {
      const fallback = await supabase.rpc("send_direct_message", {
        recipient_user_id: recipientUserId,
        message_body: body.trim() || "shared a video",
      });
      if (fallback.error) throw fallback.error;
      return fallback.data as MessageRow;
    }
    throw error;
  }
  return data as MessageRow;
}

export async function updateOwnVideo(input: {
  videoId: string;
  caption?: string;
  roles?: string[];
  genres?: string[];
  videoFilter?: string | null;
  lookingFor?: boolean;
  thumbnailTimeMs?: number | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in again before editing.");

  const roles = getUniqueTags(input.roles ?? []).slice(0, 1);
  const genres = getUniqueTags(input.genres ?? []).slice(0, 3);
  const categories = getUniqueTags([...roles, ...genres]);
  const caption = (input.caption ?? "").trim().slice(0, 200);
  const videoFilter = normalizeVideoFilter(input.videoFilter);
  const lookingFor = Boolean(input.lookingFor);
  const thumbnailTimeMs =
    typeof input.thumbnailTimeMs === "number" && Number.isFinite(input.thumbnailTimeMs)
      ? Math.max(0, Math.round(input.thumbnailTimeMs))
      : null;
  const thumbnailFields =
    thumbnailTimeMs != null ? { thumbnail_time_ms: thumbnailTimeMs } : {};

  const updateAttempts: Array<Record<string, unknown>> = [
    {
      caption,
      roles,
      genres,
      categories,
      video_filter: videoFilter,
      looking_for: lookingFor,
      ...thumbnailFields,
    },
    {
      caption,
      roles,
      genres,
      categories,
      video_filter: videoFilter,
      looking_for: lookingFor,
    },
    {
      caption,
      roles,
      genres,
      categories,
      video_filter: videoFilter,
    },
    {
      caption,
      categories,
      video_filter: videoFilter,
    },
    {
      caption,
      categories,
    },
  ];

  let lastError: unknown = null;
  for (const payload of updateAttempts) {
    const { data, error } = await supabase
      .from("videos")
      .update(payload)
      .eq("id", input.videoId)
      .eq("user_id", user.id)
      .select(OWN_VIDEO_COLUMNS_WITH_TAGS)
      .maybeSingle();

    if (!error) {
      if (!data) throw new Error("Video not found.");
      return normalizeOwnProfileVideo(data as ProfileVideo, user.id);
    }
    lastError = error;
    if (!isMissingSchemaError(error)) break;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not update video.");
}

export async function fetchJamConnections(currentUserId: string) {
  const inbox = await fetchInbox(currentUserId);
  return inbox.conversations;
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
  lookingFor?: boolean;
  mediaType?: PostMediaType;
  imageUrls?: string[] | null;
  audioUrl?: string | null;
  audioDurationMs?: number | null;
}): Promise<{ id: string }> {
  const roles = getUniqueTags(input.roles);
  const genres = getUniqueTags(input.genres);
  const categories = getUniqueTags([...roles, ...genres]);
  const lookingFor = Boolean(input.lookingFor);
  const mediaType: PostMediaType = input.mediaType === "slideshow" ? "slideshow" : "video";
  const imageUrls =
    mediaType === "slideshow"
      ? (input.imageUrls ?? []).map((url) => url.trim()).filter(Boolean).slice(0, 10)
      : [];
  const audioUrl = mediaType === "slideshow" ? input.audioUrl?.trim() || null : null;
  const audioDurationMs =
    mediaType === "slideshow" &&
    typeof input.audioDurationMs === "number" &&
    Number.isFinite(input.audioDurationMs)
      ? Math.max(0, Math.round(input.audioDurationMs))
      : null;
  const mediaUrl =
    input.mediaUrl ??
    (mediaType === "slideshow"
      ? imageUrls[0] ?? null
      : input.cloudflareStreamId
        ? getCloudflarePlaybackUrl(input.cloudflareStreamId)
        : null);
  const thumbnailTimeMs =
    typeof input.thumbnailTimeMs === "number" && Number.isFinite(input.thumbnailTimeMs)
      ? Math.max(0, Math.round(input.thumbnailTimeMs))
      : null;
  const videoFilter = normalizeVideoFilter(input.videoFilter);
  const textOverlays = normalizeVideoTextOverlays(input.textOverlays);
  logVideoDatabaseStep("createVideo start", {
    mediaType,
    hasCloudflareStreamId: Boolean(input.cloudflareStreamId),
    hasMediaUrl: Boolean(mediaUrl),
    imageCount: imageUrls.length,
    hasAudioUrl: Boolean(audioUrl),
    captionLength: input.caption.length,
    roleCount: roles.length,
    genreCount: genres.length,
    videoFilter,
    textOverlayCount: textOverlays.length,
    lookingFor,
  });

  if (mediaType === "slideshow") {
    if (imageUrls.length === 0) throw new Error("Add at least one photo.");
    if (imageUrls.some((url) => !isOwnedPostMediaUrl(url, input.userId))) {
      throw new Error("Slideshow photos must be your own uploads.");
    }
    if (audioUrl && !isOwnedPostMediaUrl(audioUrl, input.userId)) {
      throw new Error("Slideshow audio must be your own upload.");
    }
    if (mediaUrl && !isOwnedPostMediaUrl(mediaUrl, input.userId)) {
      throw new Error("Slideshow media must be your own upload.");
    }
  }

  if (input.cloudflareStreamId) {
    await assertStreamPublishable(input.cloudflareStreamId);
  }

  const slideshowFields =
    mediaType === "slideshow"
      ? {
          media_type: "slideshow" as const,
          image_urls: imageUrls,
          audio_url: audioUrl,
          audio_duration_ms: audioDurationMs,
        }
      : {
          media_type: "video" as const,
          image_urls: [] as string[],
          audio_url: null as string | null,
          audio_duration_ms: null as number | null,
        };

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
      looking_for: lookingFor,
      ...slideshowFields,
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
      video_filter: videoFilter,
      text_overlays: textOverlays,
      looking_for: lookingFor,
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
      looking_for: lookingFor,
      ...slideshowFields,
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
      looking_for: lookingFor,
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
      looking_for: lookingFor,
      ...slideshowFields,
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
      looking_for: lookingFor,
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

  // When Looking For is on, prefer payloads that include looking_for so a roles/
  // genres schema miss doesn't silently save the video without the flag.
  const orderedInsertAttempts = lookingFor
    ? [
        ...insertAttempts.filter((payload) => "looking_for" in payload),
        ...insertAttempts.filter((payload) => !("looking_for" in payload)),
      ]
    : insertAttempts;

  let lastSchemaError: unknown = null;
  for (const [index, payload] of orderedInsertAttempts.entries()) {
    const attempt = index + 1;
    logVideoDatabaseStep("createVideo insert attempt start", {
      attempt,
      columns: Object.keys(payload),
      hasCloudflareStreamIdColumn: "cloudflare_stream_id" in payload,
      hasRolesColumns: "roles" in payload || "genres" in payload,
      hasCategoriesColumn: "categories" in payload,
      hasLookingForColumn: "looking_for" in payload,
    });
    const { data, error } = await supabase.from("videos").insert(payload).select("id").single();
    if (!error) {
      logVideoDatabaseStep("createVideo insert attempt success", {
        attempt,
        videoId: data.id,
        lookingForPersisted: "looking_for" in payload ? lookingFor : null,
      });
      // New post should not be hidden behind stale filter pages from this session.
      clearDiscoverFeedSessionCache();
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
  return fetchOrderedSavedVideoRows(currentUserId);
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
  _cursor: FeedCursor | null,
  limit: number,
): Promise<{ rows: VideoRow[]; error: unknown | null }> {
  // Legacy direct-table fallback (unused). Feed paging goes through RPCs with seeded random order.
  const columnSets = [
    VIDEO_COLUMNS_WITH_TAGS,
    VIDEO_COLUMNS_WITH_TAGS_NO_PIN,
    VIDEO_COLUMNS_WITH_TAGS_NO_LOOKING_FOR,
    VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION,
    VIDEO_COLUMNS_WITH_CATEGORIES,
    VIDEO_COLUMNS_LEGACY,
  ];

  let lastError: unknown = null;
  for (const columns of columnSets) {
    const { data, error } = await supabase
      .from("videos")
      .select(columns)
      .neq("user_id", currentUserId)
      .limit(limit);
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

async function fetchVideoRowsByIds(videoIds: string[]): Promise<VideoRow[]> {
  if (videoIds.length === 0) return [];

  // Prefer security-definer RPC so discover/saved hydration still works when
  // jam-gated RLS only exposes a creator's top-3 profile preview via SELECT.
  const rpc = await supabase.rpc("fetch_videos_by_ids_for_viewer", {
    p_ids: videoIds,
  });
  if (!rpc.error) {
    return (rpc.data ?? []) as unknown as VideoRow[];
  }
  if (!isMissingSchemaError(rpc.error)) {
    throw rpc.error;
  }

  const columnSets = [
    VIDEO_COLUMNS_WITH_TAGS,
    VIDEO_COLUMNS_WITH_TAGS_NO_PIN,
    VIDEO_COLUMNS_WITH_TAGS_NO_LOOKING_FOR,
    VIDEO_COLUMNS_WITH_TAGS_NO_PRESENTATION,
    VIDEO_COLUMNS_WITH_CATEGORIES,
    VIDEO_COLUMNS_LEGACY,
  ];

  let lastError: unknown = null;
  for (const columns of columnSets) {
    const { data, error } = await supabase.from("videos").select(columns).in("id", videoIds);
    if (!error) {
      return (data ?? []) as unknown as VideoRow[];
    }
    lastError = error;
    if (!isMissingSchemaError(error)) {
      throw error;
    }
  }

  throw lastError ?? new Error("could not load nearby videos");
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

/** Owner-only via RLS — other users always get null coords. */
async function attachPrivateLocation(
  profile: Omit<Profile, keyof ProfileLocationFields>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profile_locations")
    .select(PROFILE_LOCATION_COLUMNS)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) throw error;
  const location = data as ProfileLocationRow | null;
  if (!location) {
    return { ...profile, ...EMPTY_PRIVATE_LOCATION };
  }

  return {
    ...profile,
    latitude: location.latitude,
    longitude: location.longitude,
    live_latitude: location.live_latitude,
    live_longitude: location.live_longitude,
    live_location_updated_at: location.live_location_updated_at,
  };
}

async function upsertPrivateProfileGeocode(
  userId: string,
  coordinates: { latitude: number; longitude: number } | null,
) {
  const { data: existing, error: existingError } = await supabase
    .from("profile_locations")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  const geocodePayload = {
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("profile_locations")
      .update(geocodePayload)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("profile_locations").insert({
    user_id: userId,
    live_latitude: null,
    live_longitude: null,
    live_location_updated_at: null,
    ...geocodePayload,
  });
  if (error) throw error;
}

async function fetchLocalSavedVideoRows(currentUserId: string) {
  const savedIds = [...(await getLocalSavedVideoIds(currentUserId))];
  if (savedIds.length === 0) return [];

  const videos = await fetchVideoRowsByIds(savedIds);

  const videoById = new Map(
    videos.map((video) => [
      video.id,
      video,
    ]),
  );

  return savedIds
    .map((videoId) => videoById.get(videoId))
    .filter((video): video is VideoRow => Boolean(video))
    .map((video) => ({
      user_id: currentUserId,
      video_id: video.id,
      saved_at: video.created_at,
      created_at: video.created_at,
    }));
}

async function fetchLocalSavedVideos(currentUserId: string) {
  const savedIds = [...(await getLocalSavedVideoIds(currentUserId))];
  if (savedIds.length === 0) return [];

  const [videos, jams, moderation] = await Promise.all([
    fetchVideoRowsByIds(savedIds),
    fetchRelevantJams(currentUserId),
    fetchFeedModeration(currentUserId),
  ]);

  const videoById = new Map(
    videos
      .filter(
        (video) =>
          !moderation.hiddenUserIds.has(video.user_id) &&
          !moderation.blockedUserIds.has(video.user_id),
      )
      .map((video) => [video.id, video]),
  );
  const profiles = await fetchProfilesByIds(
    [...videoById.values()].map((video) => video.user_id),
  );
  const jammedByMe = new Set(
    jams.filter((jam) => jam.requester_id === currentUserId).map((jam) => jam.recipient_id),
  );
  const jammedMe = new Set(
    jams.filter((jam) => jam.recipient_id === currentUserId).map((jam) => jam.requester_id),
  );
  const connected = getConnectedJamUserIds(jams, currentUserId);

  // Local list is newest-saved-first (see addLocalSavedVideoId).
  return savedIds
    .map((videoId) => videoById.get(videoId))
    .filter((video): video is VideoRow => Boolean(video))
    .map((video) =>
      toSavedProfileVideo(video, profiles.get(video.user_id), true, jammedByMe, jammedMe, connected),
    );
}

async function removeSavedVideosByCreator(currentUserId: string, creatorUserId: string) {
  if (!currentUserId || !creatorUserId || currentUserId === creatorUserId) return;

  const rpc = await supabase.rpc("clear_saved_videos_by_creator", {
    p_creator_id: creatorUserId,
  });
  if (rpc.error) {
    if (!isMissingFunctionError(rpc.error) && !isMissingSchemaError(rpc.error)) {
      throw rpc.error;
    }
    await deleteOwnSavesOfCreatorViaKnownIds(currentUserId, creatorUserId);
  }

  await replaceLocalSavedCacheFromRemote(currentUserId);
}

/** Fallback when 055 is not applied — only uses ids this user already saved. */
async function deleteOwnSavesOfCreatorViaKnownIds(currentUserId: string, creatorUserId: string) {
  const { data, error } = await supabase
    .from("saved_videos")
    .select("video_id")
    .eq("user_id", currentUserId);

  let savedIds: string[] = [];
  if (error) {
    if (!isMissingSchemaError(error)) throw error;
  } else {
    savedIds = ((data ?? []) as Array<{ video_id: string }>)
      .map((row) => row.video_id)
      .filter((id): id is string => Boolean(id));
  }

  const localIds = await getLocalSavedVideoIds(currentUserId);
  const knownIds = [...new Set([...savedIds, ...localIds])];
  if (knownIds.length === 0) return;

  const rows = await fetchVideoRowsByIds(knownIds);
  const videoIds = rows
    .filter((video) => video.user_id === creatorUserId)
    .map((video) => video.id);
  if (videoIds.length === 0) return;

  const { error: deleteError } = await supabase
    .from("saved_videos")
    .delete()
    .eq("user_id", currentUserId)
    .in("video_id", videoIds);

  if (deleteError && !isMissingSchemaError(deleteError)) throw deleteError;
}

async function replaceLocalSavedCacheFromRemote(currentUserId: string) {
  const { data, error } = await supabase
    .from("saved_videos")
    .select("video_id")
    .eq("user_id", currentUserId);

  if (error) {
    if (isMissingSchemaError(error)) return;
    throw error;
  }

  const next = ((data ?? []) as Array<{ video_id: string }>)
    .map((row) => row.video_id)
    .filter((id): id is string => Boolean(id));
  await AsyncStorage.setItem(getLocalSavedKey(currentUserId), JSON.stringify(next));
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
  const next = [videoId, ...[...current].filter((id) => id !== videoId)];
  await AsyncStorage.setItem(getLocalSavedKey(currentUserId), JSON.stringify(next));
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

function conversationPreviewText(message: MessageRow | undefined, unlocked: boolean) {
  if (!message) {
    return unlocked ? "you are jamming. chat is open." : "jam sent. waiting for a reply.";
  }
  const body = message.body?.trim() ?? "";
  if (body) return body;
  if (message.video_id || message.video) return "sent a video";
  return "";
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
    lastMessage: conversationPreviewText(lastMessage, unlocked),
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
    lookingFor: Boolean(video.looking_for),
    pinnedRank: getProfileVideoPinnedRank({ pinned_rank: video.pinned_rank }),
    mediaType: normalizePostMediaType(video.media_type),
    imageUrls: normalizeImageUrls(video.image_urls),
    audioUrl: video.audio_url ?? null,
    audioDurationMs: video.audio_duration_ms ?? null,
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
  const pinnedRank = getProfileVideoPinnedRank({ pinned_rank: video.pinned_rank });
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
    lookingFor: Boolean(video.looking_for),
    looking_for: Boolean(video.looking_for),
    pinnedRank,
    pinned_rank: pinnedRank,
    mediaType: normalizePostMediaType(video.media_type),
    media_type: normalizePostMediaType(video.media_type),
    imageUrls: normalizeImageUrls(video.image_urls),
    image_urls: normalizeImageUrls(video.image_urls),
    audioUrl: video.audio_url ?? null,
    audio_url: video.audio_url ?? null,
    audioDurationMs: video.audio_duration_ms ?? null,
    audio_duration_ms: video.audio_duration_ms ?? null,
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
