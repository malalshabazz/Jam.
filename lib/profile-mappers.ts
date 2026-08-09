import { getProBadgeKind } from "@/lib/pro-entitlements";
import {
  getProfileVideoPinnedRank,
  type Conversation,
  type FeedVideo,
  type InboxRequest,
  type Profile,
  type ProfileVideo,
} from "@/lib/native-social-data";
import { normalizeVideoFilter } from "@/lib/video-filters";
import { normalizeVideoTextOverlays } from "@/lib/video-presentation";
import type { PreloadedUserProfile } from "@/types/app";
import { formatProfileLocation, getProfileLocationParts } from "@/lib/location-filter";
import {
  creatorRoleTagSet,
  getUniqueVideoTags,
  musicGenreTagSet,
  normalizeVideoTag,
} from "@/lib/feed-filters";

export { getUniqueVideoTags, normalizeVideoTag };

export function getVideoPresentation(video: ProfileVideo | FeedVideo) {
  if ("videoFilter" in video || "textOverlays" in video) {
    return {
      filter: normalizeVideoFilter(
        "videoFilter" in video ? video.videoFilter : "video_filter" in video ? video.video_filter : "none",
      ),
      textOverlays: normalizeVideoTextOverlays(
        "textOverlays" in video ? video.textOverlays : "text_overlays" in video ? video.text_overlays : [],
      ),
    };
  }

  return {
    filter: normalizeVideoFilter("video_filter" in video ? video.video_filter : "none"),
    textOverlays: normalizeVideoTextOverlays("text_overlays" in video ? video.text_overlays : []),
  };
}

export function getProfileVideoTags(video: ProfileVideo | FeedVideo | undefined) {
  const categories = getUniqueVideoTags(video?.categories?.length ? video.categories : video?.hashtags ?? []);
  const roleSource = getUniqueVideoTags(video?.roles?.length ? video.roles : categories);
  const genreSource = getUniqueVideoTags(video?.genres?.length ? video.genres : categories);
  const roles = roleSource.filter((tag) => creatorRoleTagSet.has(normalizeVideoTag(tag)));
  const genres = genreSource.filter((tag) => musicGenreTagSet.has(normalizeVideoTag(tag)));

  return {
    categories,
    roles: getUniqueVideoTags(roles),
    genres,
  };
}

export function getProfileFullscreenTags(video: ProfileVideo | FeedVideo | undefined) {
  const tags = getProfileVideoTags(video);
  const roleGenreTags = [...tags.roles, ...tags.genres];
  return roleGenreTags.length ? getUniqueVideoTags(roleGenreTags) : tags.categories;
}

export function profileToFeedVideo(
  profile: Profile,
  video: ProfileVideo | undefined,
  savedByMe: boolean,
  jammedByMe: boolean,
  jammedMe: boolean,
  postedVideoCount = 0,
): FeedVideo {
  const displayName = profile.display_name?.trim() || "creator";
  const role = profile.creator_types?.[0] ?? "creator";
  const tags = getProfileVideoTags(video);
  const videoCount = Math.max(postedVideoCount, profile.video_count ?? 0);
  const proBadge = getProBadgeKind({
    earlyAdopter: profile.early_adopter,
    videoCount,
    proSubscriptionActive: profile.pro_subscription_active,
  });
  return {
    id: video?.id ?? `${profile.id}-profile`,
    userId: profile.id,
    creatorName: displayName,
    role,
    location: formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city) ?? "unknown",
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    caption: video?.caption ?? "",
    hashtags: video?.hashtags ?? [],
    categories: tags.categories,
    roles: tags.roles,
    genres: tags.genres,
    mediaUrl: video?.mediaUrl ?? video?.media_url ?? null,
    cloudflareStreamId: video?.cloudflareStreamId ?? video?.cloudflare_stream_id ?? null,
    thumbnailTimeMs: video?.thumbnailTimeMs ?? video?.thumbnail_time_ms ?? null,
    videoFilter: normalizeVideoFilter(video?.videoFilter ?? video?.video_filter),
    textOverlays: normalizeVideoTextOverlays(video?.textOverlays ?? video?.text_overlays),
    lookingFor: Boolean(
      video && ("lookingFor" in video ? video.lookingFor : "looking_for" in video ? video.looking_for : false),
    ),
    pinnedRank: getProfileVideoPinnedRank(video),
    earlyAdopter: Boolean(profile.early_adopter),
    proBadge,
    videoCount,
    createdAt: video?.created_at ?? new Date().toISOString(),
    savedByMe,
    mutual: jammedByMe && jammedMe,
    jammedByMe,
    jammedMe,
  };
}

export function feedItemToPreloadedProfile(item: FeedVideo, feedItems: FeedVideo[]): PreloadedUserProfile {
  const videos = feedItems
    .filter((video) => video.userId === item.userId)
    .map((video): ProfileVideo => ({
      id: video.id,
      userId: video.userId,
      caption: video.caption,
      hashtags: video.hashtags,
      categories: video.categories,
      roles: video.roles,
      genres: video.genres,
      mediaUrl: video.mediaUrl,
      cloudflareStreamId: video.cloudflareStreamId,
      thumbnailTimeMs: video.thumbnailTimeMs,
      videoFilter: video.videoFilter,
      textOverlays: video.textOverlays,
      lookingFor: video.lookingFor,
      pinnedRank: video.pinnedRank ?? null,
      pinned_rank: video.pinnedRank ?? null,
      created_at: video.createdAt,
      creatorName: video.creatorName,
      role: video.role,
      location: video.location,
      avatarUrl: video.avatarUrl,
      earlyAdopter: video.earlyAdopter,
      proBadge: video.proBadge,
      savedByMe: video.savedByMe,
      mutual: video.mutual,
      jammedByMe: video.jammedByMe,
      jammedMe: video.jammedMe,
    }));

  return {
    userId: item.userId,
    profile: {
      id: item.userId,
      display_name: item.creatorName,
      bio: item.bio,
      creator_types: [item.role],
      location: item.location,
      country: null,
      city: null,
      latitude: null,
      longitude: null,
      live_latitude: null,
      live_longitude: null,
      live_location_updated_at: null,
      near_me_radius_miles: null,
      avatar_url: item.avatarUrl,
      onboarding_complete: true,
      welcome_seen: true,
      early_adopter: item.earlyAdopter,
      video_count: item.videoCount,
      pro_subscription_active: item.proBadge === "blue",
    },
    videos,
    jammedByMe: item.jammedByMe || item.mutual,
    jammedMe: item.jammedMe || item.mutual,
  };
}

export function profileVideoToFeedVideo(video: ProfileVideo | FeedVideo): FeedVideo | null {
  if ("userId" in video && video.userId) {
    const mediaUrl = "mediaUrl" in video && video.mediaUrl
      ? video.mediaUrl
      : "media_url" in video
        ? video.media_url ?? null
        : null;
    const cloudflareStreamId = "cloudflareStreamId" in video && video.cloudflareStreamId
      ? video.cloudflareStreamId
      : "cloudflare_stream_id" in video
        ? video.cloudflare_stream_id ?? null
        : null;
    const createdAt = "createdAt" in video
      ? video.createdAt
      : "created_at" in video
        ? video.created_at ?? new Date().toISOString()
        : new Date().toISOString();
    const tags = getProfileVideoTags(video);
    const presentation = getVideoPresentation(video);

    return {
      id: video.id,
      userId: video.userId,
      creatorName: video.creatorName ?? "creator",
      role: video.role ?? "creator",
      location: video.location ?? "unknown",
      avatarUrl: video.avatarUrl ?? null,
      bio: null,
      caption: video.caption ?? "",
      hashtags: video.hashtags ?? [],
      categories: tags.categories,
      roles: tags.roles,
      genres: tags.genres,
      mediaUrl,
      cloudflareStreamId,
      thumbnailTimeMs: "thumbnailTimeMs" in video
        ? video.thumbnailTimeMs ?? null
        : "thumbnail_time_ms" in video
          ? video.thumbnail_time_ms ?? null
          : null,
      videoFilter: presentation.filter,
      textOverlays: presentation.textOverlays,
      lookingFor: Boolean(
        "lookingFor" in video
          ? video.lookingFor
          : "looking_for" in video
            ? (video as { looking_for?: boolean | null }).looking_for
            : false,
      ),
      pinnedRank: getProfileVideoPinnedRank(video as ProfileVideo),
      earlyAdopter: Boolean(video.earlyAdopter),
      proBadge: "proBadge" in video ? video.proBadge ?? null : null,
      videoCount: "videoCount" in video && typeof video.videoCount === "number" ? video.videoCount : 0,
      createdAt,
      savedByMe: video.savedByMe ?? true,
      mutual: video.mutual ?? false,
      jammedByMe: video.jammedByMe ?? false,
      jammedMe: video.jammedMe ?? false,
    };
  }

  return null;
}

export function getProfileVideoOwner(video: ProfileVideo | FeedVideo) {
  const feedItem = profileVideoToFeedVideo(video);
  return {
    creatorName: feedItem?.creatorName ?? "creator",
    role: feedItem?.role ?? "creator",
    location: feedItem?.location ?? "unknown",
    avatarUrl: feedItem?.avatarUrl ?? null,
    earlyAdopter: Boolean(feedItem?.earlyAdopter),
    proBadge: feedItem?.proBadge ?? null,
  };
}

/** Pinned first (rank 1–3), then newest → oldest. */
export function sortProfileVideos<T extends ProfileVideo | FeedVideo>(videos: T[]) {
  return [...videos].sort((a, b) => {
    const aPin = getProfileVideoPinnedRank(a as ProfileVideo);
    const bPin = getProfileVideoPinnedRank(b as ProfileVideo);
    const aPinned = aPin != null;
    const bPinned = bPin != null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned && aPin !== bPin) return (aPin as number) - (bPin as number);
    return getProfileVideoCreatedAtMs(b) - getProfileVideoCreatedAtMs(a);
  });
}

export function sortProfileVideosByNewest<T extends ProfileVideo | FeedVideo>(videos: T[]) {
  return sortProfileVideos(videos);
}

export function getProfileVideoCreatedAtMs(video: ProfileVideo | FeedVideo) {
  const createdAt = "createdAt" in video
    ? video.createdAt
    : "created_at" in video
      ? video.created_at
      : null;
  return createdAt ? Date.parse(createdAt) || 0 : 0;
}

export function hasSentJam(video: ProfileVideo | FeedVideo) {
  return Boolean(video.mutual || video.jammedByMe);
}

export function isPendingSentJam(video: ProfileVideo | FeedVideo) {
  return Boolean(video.jammedByMe && !video.mutual);
}

export function conversationFromRequest(request: InboxRequest): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: request.userId,
    userId: request.userId,
    creatorName: request.creatorName,
    avatarUrl: request.avatarUrl,
    role: request.role,
    location: request.location,
    lastMessage: "reply to start jamming.",
    timestamp: "now",
    lastActivityAt: createdAt,
    unread: false,
    unreadCount: 0,
    earlyAdopter: request.earlyAdopter,
    proBadge: request.proBadge,
    unlocked: false,
    messages: [
      {
        id: request.id,
        body: request.preview,
        incoming: true,
        createdAt,
        video: request.video ?? null,
      },
    ],
  };
}

export function conversationFromFeedItem(item: FeedVideo, unlocked: boolean): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: item.userId,
    userId: item.userId,
    creatorName: item.creatorName,
    avatarUrl: item.avatarUrl,
    role: item.role,
    location: item.location,
    lastMessage: unlocked ? "you are jamming. chat is open." : "jam sent. waiting for a reply.",
    timestamp: "now",
    lastActivityAt: createdAt,
    unread: false,
    unreadCount: 0,
    earlyAdopter: item.earlyAdopter,
    proBadge: item.proBadge,
    unlocked,
    messages: [],
  };
}
