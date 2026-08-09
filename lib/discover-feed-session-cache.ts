import type { FeedCursor, FeedPhase, FeedVideo } from "@/lib/native-social-data";

/**
 * Session-scoped discover feed pages keyed by `buildDiscoverFeedQueryKey`.
 * Survives Discover unmount within the app process so filter revisit is instant.
 */
export type DiscoverFeedSessionCacheEntry = {
  items: FeedVideo[];
  feedCursor: FeedCursor | null;
  feedPhase: FeedPhase;
  activeVideoId: string | null;
  /** Seconds into the active clip when the user left this filter. */
  playbackPositionSec: number;
  /**
   * True when the active clip was user-paused before leaving.
   * Filter switches themselves are not treated as a user pause — returning
   * resumes playback unless this flag is set.
   */
  userPaused: boolean;
  /**
   * Newest `videos.created_at` observed when this page was fetched.
   * Used to decide whether a cache hit is still fresh.
   */
  feedWatermarkAt: string | null;
  fetchedAt: number;
};

const cacheByQueryKey = new Map<string, DiscoverFeedSessionCacheEntry>();

export function getDiscoverFeedSessionCache(queryKey: string | null | undefined) {
  if (!queryKey) return null;
  return cacheByQueryKey.get(queryKey) ?? null;
}

export function putDiscoverFeedSessionCache(
  queryKey: string | null | undefined,
  entry: Omit<DiscoverFeedSessionCacheEntry, "fetchedAt"> & { fetchedAt?: number },
) {
  if (!queryKey) return;
  // Pending near-me keys are transitional — never cache them.
  if (queryKey.startsWith("near-me-pending")) return;

  cacheByQueryKey.set(queryKey, {
    items: entry.items,
    feedCursor: entry.feedCursor,
    feedPhase: entry.feedPhase,
    activeVideoId: entry.activeVideoId,
    playbackPositionSec: Math.max(0, entry.playbackPositionSec ?? 0),
    userPaused: Boolean(entry.userPaused),
    feedWatermarkAt: entry.feedWatermarkAt,
    fetchedAt: entry.fetchedAt ?? Date.now(),
  });
}

/** Patch items/cursor for an existing key while keeping the freshness watermark. */
export function updateDiscoverFeedSessionCache(
  queryKey: string | null | undefined,
  patch: Partial<
    Pick<
      DiscoverFeedSessionCacheEntry,
      | "items"
      | "feedCursor"
      | "feedPhase"
      | "activeVideoId"
      | "playbackPositionSec"
      | "userPaused"
      | "feedWatermarkAt"
    >
  >,
) {
  if (!queryKey) return;
  const current = cacheByQueryKey.get(queryKey);
  if (!current) {
    if (patch.items) {
      putDiscoverFeedSessionCache(queryKey, {
        items: patch.items,
        feedCursor: patch.feedCursor ?? null,
        feedPhase: patch.feedPhase ?? "unseen",
        activeVideoId: patch.activeVideoId ?? patch.items[0]?.id ?? null,
        playbackPositionSec: patch.playbackPositionSec ?? 0,
        userPaused: patch.userPaused ?? false,
        feedWatermarkAt: patch.feedWatermarkAt ?? null,
      });
    }
    return;
  }
  cacheByQueryKey.set(queryKey, {
    ...current,
    ...patch,
    fetchedAt: Date.now(),
  });
}

export function clearDiscoverFeedSessionCache() {
  cacheByQueryKey.clear();
}

/** Drop a creator from every cached page (hide/block). */
export function removeCreatorFromDiscoverFeedSessionCache(creatorUserId: string) {
  for (const [key, entry] of cacheByQueryKey) {
    const nextItems = entry.items.filter((item) => item.userId !== creatorUserId);
    if (nextItems.length === entry.items.length) continue;
    const activeRemoved =
      entry.activeVideoId != null &&
      !nextItems.some((item) => item.id === entry.activeVideoId);
    cacheByQueryKey.set(key, {
      ...entry,
      items: nextItems,
      activeVideoId: activeRemoved
        ? nextItems[0]?.id ?? null
        : entry.activeVideoId && nextItems.some((item) => item.id === entry.activeVideoId)
          ? entry.activeVideoId
          : nextItems[0]?.id ?? null,
      playbackPositionSec: activeRemoved ? 0 : entry.playbackPositionSec,
      userPaused: activeRemoved ? false : entry.userPaused,
    });
  }
}

export function isDiscoverFeedCacheStale(
  entry: DiscoverFeedSessionCacheEntry,
  newestCreatedAt: string | null,
) {
  if (!newestCreatedAt) return false;
  if (!entry.feedWatermarkAt) return true;
  return newestCreatedAt > entry.feedWatermarkAt;
}
