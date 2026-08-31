import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  enableLiveLocationSharing,
  isLiveLocationSharingEnabled,
} from "@/lib/live-location-sharing";
import { normalizeNearMeRadius } from "@/lib/location-distance";
import {
  FEED_PAGE_SIZE,
  blockUser,
  fetchFeedVideos,
  fetchNearbyFeedVideos,
  fetchNewestVideoCreatedAt,
  hideCreator,
  markVideoSeen,
  reportVideo,
  sendJamRequest,
  type FeedCursor,
  type FeedPhase,
  type FeedVideo,
  type Profile,
  type ReportReason,
} from "@/lib/native-social-data";
import { getCloudflareFreezeFrameUri, getFeedPosterSource, getVideoSource } from "@/lib/video-display";
import type { SavedVideoController } from "@/types/app";
import {
  FEED_CHROME_FADE_MS,
  viewportHeight,
} from "@/theme/tokens";
import {
  darkStyles,
  getActivityIndicatorColor,
  styles,
} from "@/theme/styles";
import {
  getDiscoverFeedSessionCache,
  isDiscoverFeedCacheStale,
  putDiscoverFeedSessionCache,
  removeCreatorFromDiscoverFeedSessionCache,
  updateDiscoverFeedSessionCache,
  type DiscoverFeedSessionCacheEntry,
} from "@/lib/discover-feed-session-cache";
import {
  buildDiscoverFeedQueryKey,
  feedVideoMatchesFilters,
  isFeedFilterStateActive,
  normalizeVideoTag,
  shuffleVideosWithSpacing,
  toFeedContentFilters,
  type FeedFilterState,
} from "@/lib/feed-filters";
import { feedItemToPreloadedProfile } from "@/lib/profile-mappers";
import {
  subscribeJamRelationship,
  withJamRelationship,
} from "@/lib/jam-relationship-sync";
import { FeedReportModal } from "@/components/discover/feed-report-modal";
import { DmModal } from "@/components/chat/dm-modal";
import { UserProfileModal } from "@/components/profile/user-profile-modal";
import { getNavBarHeight } from "@/lib/nav-bar";
import { confirmNearMeLiveLocationSharing } from "@/lib/near-me-notice";
import { NearMeIcon } from "@/components/icons/near-me-icon";
import { FeedFilterIcon } from "@/components/icons/feed-filter-icon";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Toast } from "@/components/ui/toast";
import { FeedRoleFilterWheel } from "@/components/discover/feed-role-filter-wheel";
import { EndOfFeedState, getEndOfFeedCopy } from "@/components/discover/end-of-feed";
import { FilterSheet } from "@/components/discover/filter-sheet";
import { FeedItem } from "@/components/discover/feed-item";

export function DiscoverScreen({
  userId,
  viewerProfile,
  shuffleSignal,
  savedVideoController,
  showBootOverlay = true,
  feedChromeOpacity,
  onFeedChromeClearChange,
  onCreate,
  onInboxChanged,
  onBootReady,
  onViewerProfileUpdated,
}: {
  userId: string;
  viewerProfile: Profile | null;
  shuffleSignal: number;
  savedVideoController: SavedVideoController;
  showBootOverlay?: boolean;
  feedChromeOpacity: Animated.Value;
  onFeedChromeClearChange?: (clear: boolean) => void;
  onCreate: () => void;
  onInboxChanged: () => void;
  onBootReady?: () => void;
  onViewerProfileUpdated?: (profile: Profile) => void;
}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [lookingForActive, setLookingForActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<FeedVideo | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [firstClipReady, setFirstClipReady] = useState(!showBootOverlay);
  const [initialBootComplete, setInitialBootComplete] = useState(!showBootOverlay);
  const [feedCursor, setFeedCursor] = useState<FeedCursor | null>(null);
  const [feedPhase, setFeedPhase] = useState<FeedPhase>("unseen");
  const [filterFillActive, setFilterFillActive] = useState(false);
  const [feedQueryReloading, setFeedQueryReloading] = useState(false);
  /**
   * Frozen on-screen rows while a filter/near-me query reloads. Without this, the
   * client filter immediately thins `items` to local matches and flashes that
   * intermediate list before the server page commits.
   */
  const [queryReloadHold, setQueryReloadHold] = useState<FeedVideo[] | null>(null);
  const [feedBridge, setFeedBridge] = useState<FeedVideo[]>([]);
  /** Remounts FlatList when the server query key changes so paused players can't stick. */
  const [feedListKey, setFeedListKey] = useState("boot");
  /** Paired with feedListKey so cache restore opens on the left-off clip, not index 0. */
  const [feedInitialScrollIndex, setFeedInitialScrollIndex] = useState(0);
  const [replayToastVisible, setReplayToastVisible] = useState(false);
  const initialBootCompleteRef = useRef(!showBootOverlay);
  const feedCursorRef = useRef<FeedCursor | null>(null);
  const feedPhaseRef = useRef<FeedPhase>("unseen");
  const loadingMoreFeedRef = useRef(false);
  const filterFillGenerationRef = useRef(0);
  /** Invalidates in-flight load / load-more when filters or near-me change. */
  const feedReloadGenerationRef = useRef(0);
  const itemsRef = useRef<FeedVideo[]>([]);
  const listRef = useRef<FlatList<FeedVideo>>(null);
  const feedQueryKeyRef = useRef<string | null>(null);
  const markedSeenVideoIdsRef = useRef<Set<string>>(new Set());
  const replayToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayToastOpacity = useRef(new Animated.Value(0)).current;
  const [feedChromeHolding, setFeedChromeHolding] = useState(false);
  const [feedChromeLocked, setFeedChromeLocked] = useState(false);
  const [feedSpeedHolding, setFeedSpeedHolding] = useState(false);
  /** User-toggled pause for the active clip — survives tab switches / cell recycle. */
  const [userPausedVideoId, setUserPausedVideoId] = useState<string | null>(null);
  const feedChromeLockedRef = useRef(false);
  const discoverFocusedRef = useRef(isFocused);
  const resumeFeedVideoIdRef = useRef<string | null>(null);
  const activeVideoIdRef = useRef<string | null>(null);
  const userPausedVideoIdRef = useRef<string | null>(null);
  const activePlaybackPositionSecRef = useRef(0);
  /** One-shot seek target after restoring a cached filter page. */
  const [resumePlayback, setResumePlayback] = useState<{
    videoId: string;
    positionSec: number;
  } | null>(null);
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const feedPrefetchTarget = FEED_PAGE_SIZE * 4;

  const nearMeRadiusMiles = normalizeNearMeRadius(viewerProfile?.near_me_radius_miles);
  const filterState = useMemo<FeedFilterState>(
    () => ({
      roles,
      genres,
      location,
      nearMeActive,
      lookingForActive,
      userLocation,
      nearMeRadiusMiles,
    }),
    [genres, location, lookingForActive, nearMeActive, nearMeRadiusMiles, roles, userLocation],
  );
  const filterStateRef = useRef(filterState);
  filterStateRef.current = filterState;
  activeVideoIdRef.current = activeVideoId;
  userPausedVideoIdRef.current = userPausedVideoId;

  useEffect(() => {
    // Keep restored filter position until the first seek lands; otherwise reset
    // when the user scrolls to a different clip in this feed.
    if (resumePlayback?.videoId === activeVideoId) return;
    activePlaybackPositionSecRef.current = 0;
  }, [activeVideoId, resumePlayback?.videoId]);
  itemsRef.current = items;
  const filtersActive = isFeedFilterStateActive(filterState);
  const activeFilterTags = useMemo(() => {
    const tags = new Set<string>();
    for (const role of roles) {
      const normalized = normalizeVideoTag(role);
      if (normalized) tags.add(normalized);
    }
    for (const genre of genres) {
      const normalized = normalizeVideoTag(genre);
      if (normalized) tags.add(normalized);
    }
    return tags;
  }, [genres, roles]);

  const hideReplayToast = useCallback(() => {
    if (replayToastHideTimerRef.current) {
      clearTimeout(replayToastHideTimerRef.current);
      replayToastHideTimerRef.current = null;
    }
    replayToastOpacity.stopAnimation();
    Animated.timing(replayToastOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setReplayToastVisible(false);
    });
  }, [replayToastOpacity]);

  const showReplayToast = useCallback(() => {
    if (replayToastHideTimerRef.current) {
      clearTimeout(replayToastHideTimerRef.current);
      replayToastHideTimerRef.current = null;
    }
    replayToastOpacity.stopAnimation();
    replayToastOpacity.setValue(0);
    setReplayToastVisible(true);
    // Defer fade-in until after mount — same-tick timing often paints at full opacity.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Animated.timing(replayToastOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });
    replayToastHideTimerRef.current = setTimeout(() => {
      hideReplayToast();
    }, 2400);
  }, [hideReplayToast, replayToastOpacity]);

  useEffect(() => {
    return () => {
      if (replayToastHideTimerRef.current) clearTimeout(replayToastHideTimerRef.current);
    };
  }, []);

  const animateFeedChrome = useCallback(
    (visible: boolean) => {
      feedChromeOpacity.stopAnimation();
      Animated.timing(feedChromeOpacity, {
        toValue: visible ? 1 : 0,
        duration: FEED_CHROME_FADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [feedChromeOpacity],
  );

  const restoreFeedChrome = useCallback(() => {
    feedChromeLockedRef.current = false;
    setFeedChromeLocked(false);
    setFeedChromeHolding(false);
    animateFeedChrome(true);
    onFeedChromeClearChange?.(false);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeHoldStart = useCallback(() => {
    if (feedChromeLockedRef.current) return;
    setFeedChromeHolding(true);
    animateFeedChrome(false);
    onFeedChromeClearChange?.(true);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeHoldEnd = useCallback(() => {
    setFeedChromeHolding(false);
    if (feedChromeLockedRef.current) return;
    animateFeedChrome(true);
    onFeedChromeClearChange?.(false);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeLock = useCallback(() => {
    feedChromeLockedRef.current = true;
    setFeedChromeLocked(true);
    setFeedChromeHolding(false);
    animateFeedChrome(false);
    onFeedChromeClearChange?.(true);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeUnlock = useCallback(() => {
    restoreFeedChrome();
  }, [restoreFeedChrome]);

  const handleFeedSpeedHoldStart = useCallback(() => {
    setFeedSpeedHolding(true);
  }, []);

  const handleFeedSpeedHoldEnd = useCallback(() => {
    setFeedSpeedHolding(false);
  }, []);

  useEffect(() => {
    if (filtersOpen || activeProfile || activeDm) {
      restoreFeedChrome();
    }
  }, [activeDm, activeProfile, filtersOpen, restoreFeedChrome]);

  useEffect(() => {
    return subscribeJamRelationship((state) => {
      setItems((current) =>
        current.map((entry) =>
          entry.userId === state.userId ? withJamRelationship(entry, state) : entry,
        ),
      );
      setActiveProfile((current) =>
        current?.userId === state.userId ? withJamRelationship(current, state) : current,
      );
      setActiveDm((current) =>
        current?.userId === state.userId ? withJamRelationship(current, state) : current,
      );
    });
  }, []);

  const setDiscoverFeedPhase = useCallback((phase: FeedPhase) => {
    feedPhaseRef.current = phase;
    setFeedPhase(phase);
  }, []);

  const fetchDiscoverPage = useCallback(
    async (cursor?: FeedCursor | null, phase?: FeedPhase) => {
      const filters = filterStateRef.current;
      const contentFilters = toFeedContentFilters(filters);
      const activePhase = phase ?? feedPhaseRef.current;
      if (filters.nearMeActive && filters.userLocation) {
        return fetchNearbyFeedVideos(userId, {
          latitude: filters.userLocation.latitude,
          longitude: filters.userLocation.longitude,
          radiusMiles: filters.nearMeRadiusMiles,
          cursor: cursor ?? null,
          limit: FEED_PAGE_SIZE,
          roles: contentFilters.roles,
          genres: contentFilters.genres,
          phase: activePhase,
          lookingForOnly: filters.lookingForActive,
        });
      }
      return fetchFeedVideos(userId, {
        cursor: cursor ?? null,
        limit: FEED_PAGE_SIZE,
        filters: contentFilters,
        phase: activePhase,
      });
    },
    [userId],
  );

  const markFeedVideoSeen = useCallback(
    (videoId: string) => {
      if (!videoId || markedSeenVideoIdsRef.current.has(videoId)) return;
      markedSeenVideoIdsRef.current.add(videoId);
      void markVideoSeen(userId, videoId).catch(() => {
        markedSeenVideoIdsRef.current.delete(videoId);
      });
    },
    [userId],
  );

  const enterReplayPhase = useCallback(async () => {
    setDiscoverFeedPhase("replay");
    const page = await fetchDiscoverPage(null, "replay");
    feedCursorRef.current = page.nextCursor;
    setFeedCursor(page.nextCursor);
    if (page.items.length > 0) {
      showReplayToast();
    }
    return page;
  }, [fetchDiscoverPage, setDiscoverFeedPhase, showReplayToast]);

  function beginFilterTransition(holdItems: FeedVideo[]) {
    // Snapshot + mark reloading in the same event as the filter change so the
    // first painted frame never shows the client-thinned intermediate list.
    setQueryReloadHold(holdItems.length > 0 ? holdItems : itemsRef.current);
    setFeedQueryReloading(true);
  }

  function snapshotCurrentFeedToSessionCache() {
    const key = feedQueryKeyRef.current;
    if (!key) return;
    const existing = getDiscoverFeedSessionCache(key);
    const activeId = activeVideoIdRef.current;
    const positionSec = activePlaybackPositionSecRef.current;
    putDiscoverFeedSessionCache(key, {
      items: itemsRef.current,
      feedCursor: feedCursorRef.current,
      feedPhase: feedPhaseRef.current,
      activeVideoId: activeId,
      playbackPositionSec: positionSec,
      // Only remember an explicit user pause — leaving via filter switch is not a pause.
      userPaused: Boolean(activeId && userPausedVideoIdRef.current === activeId),
      feedWatermarkAt: existing?.feedWatermarkAt ?? null,
    });
    // Warm the mid-clip thumb so switching back never waits on a network decode.
    if (activeId && positionSec > 0.25) {
      const activeItem = itemsRef.current.find((item) => item.id === activeId);
      const activeSource = activeItem ? getVideoSource(activeItem) : null;
      const resumeUri = activeSource
        ? getCloudflareFreezeFrameUri(activeSource, positionSec)
        : null;
      if (resumeUri) void Image.prefetch(resumeUri);
    }
  }

  function restoreFeedFromSessionCache(
    entry: DiscoverFeedSessionCacheEntry,
    nextKey: string,
  ) {
    itemsRef.current = entry.items;
    feedCursorRef.current = entry.feedCursor;
    setFeedCursor(entry.feedCursor);
    setDiscoverFeedPhase(entry.feedPhase);
    setItems(entry.items);
    setQueryReloadHold(null);
    setFeedBridge([]);
    setFeedQueryReloading(false);
    setError(null);
    const restoreId =
      entry.activeVideoId && entry.items.some((item) => item.id === entry.activeVideoId)
        ? entry.activeVideoId
        : entry.items[0]?.id ?? null;
    const index = restoreId
      ? Math.max(
          0,
          entry.items.findIndex((item) => item.id === restoreId),
        )
      : 0;
    // Remount already scrolled to the left-off clip — avoids index-0 black flash.
    setFeedInitialScrollIndex(index);
    setFeedListKey(nextKey);
    setActiveVideoId(restoreId);
    // Resume playing unless the user had paused before switching away.
    setUserPausedVideoId(entry.userPaused && restoreId ? restoreId : null);
    activePlaybackPositionSecRef.current = entry.playbackPositionSec ?? 0;
    if (restoreId && (entry.playbackPositionSec ?? 0) > 0.25) {
      const restoreItem = entry.items.find((item) => item.id === restoreId);
      const restoreSource = restoreItem ? getVideoSource(restoreItem) : null;
      const resumeUri = restoreSource
        ? getCloudflareFreezeFrameUri(restoreSource, entry.playbackPositionSec)
        : null;
      if (resumeUri) void Image.prefetch(resumeUri);
      setResumePlayback({
        videoId: restoreId,
        positionSec: entry.playbackPositionSec,
      });
    } else {
      setResumePlayback(null);
    }
  }

  function writeFeedSessionCache(
    queryKey: string | null,
    items: FeedVideo[],
    feedWatermarkAt: string | null,
  ) {
    putDiscoverFeedSessionCache(queryKey, {
      items,
      feedCursor: feedCursorRef.current,
      feedPhase: feedPhaseRef.current,
      activeVideoId: activeVideoIdRef.current ?? items[0]?.id ?? null,
      playbackPositionSec: 0,
      userPaused: false,
      feedWatermarkAt,
    });
  }

  function applyFeedFilterPill(role: string) {
    const isAlreadySelected = roles.some(
      (selectedRole) => selectedRole.toLowerCase() === role.toLowerCase(),
    );
    const nextRoles = isAlreadySelected ? [] : role ? [role] : [];
    const nextKey = buildDiscoverFeedQueryKey({ ...filterState, roles: nextRoles });
    snapshotCurrentFeedToSessionCache();
    const cached = getDiscoverFeedSessionCache(nextKey);
    if (cached) {
      feedQueryKeyRef.current = nextKey;
      restoreFeedFromSessionCache(cached, nextKey);
      setRoles(nextRoles);
      void refreshCachedFeedIfStale(nextKey, cached);
      return;
    }
    beginFilterTransition(visibleFeed);
    setRoles(nextRoles);
  }

  async function refreshViewerGpsLocation() {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setUserLocation(nextLocation);
    return nextLocation;
  }

  /** Soft reload: keep the current clip playing until the new page is ready. */
  function beginSoftFeedQueryReload() {
    setFeedQueryReloading(true);
    setQueryReloadHold((current) =>
      current && current.length > 0 ? current : itemsRef.current,
    );
    setDiscoverFeedPhase("unseen");
    feedCursorRef.current = null;
    setFeedCursor(null);
    loadingMoreFeedRef.current = false;
    filterFillGenerationRef.current += 1;
  }

  function commitSoftFeedQueryReload(
    nextListKey: string,
    nextItems: FeedVideo[],
    options?: { feedWatermarkAt?: string | null },
  ) {
    itemsRef.current = nextItems;
    setQueryReloadHold(null);
    setItems(nextItems);
    setFeedBridge([]);
    setUserPausedVideoId(null);
    setResumePlayback(null);
    activePlaybackPositionSecRef.current = 0;
    // Remount the list under a new key so outgoing players unmount and clear their
    // native sources — prevents choppy zombie audio from the previous filter page.
    setFeedInitialScrollIndex(0);
    setFeedListKey(nextListKey);
    setActiveVideoId(nextItems[0]?.id ?? null);
    writeFeedSessionCache(
      nextListKey,
      nextItems,
      options?.feedWatermarkAt ??
        getDiscoverFeedSessionCache(nextListKey)?.feedWatermarkAt ??
        null,
    );
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }

  async function refreshCachedFeedIfStale(
    queryKey: string,
    entry: DiscoverFeedSessionCacheEntry,
  ) {
    try {
      const newest = await fetchNewestVideoCreatedAt();
      if (!isDiscoverFeedCacheStale(entry, newest)) return;
      if (feedQueryKeyRef.current !== queryKey) return;

      feedReloadGenerationRef.current += 1;
      const generation = feedReloadGenerationRef.current;
      loadingMoreFeedRef.current = false;
      filterFillGenerationRef.current += 1;
      beginSoftFeedQueryReload();

      const loaded = await load({ commit: false });
      if (generation !== feedReloadGenerationRef.current) return;
      if (!loaded) return;
      if (feedQueryKeyRef.current !== queryKey) return;

      commitSoftFeedQueryReload(queryKey, loaded.items, {
        feedWatermarkAt: loaded.watermark ?? newest,
      });
    } catch {
      /* keep showing the cached page */
    } finally {
      if (feedQueryKeyRef.current === queryKey) {
        setFeedQueryReloading(false);
      }
    }
  }

  async function toggleNearMe() {
    if (nearMeLoading) return;

    if (nearMeActive) {
      // Persist the nearby page before the transitional key so revisit stays instant.
      snapshotCurrentFeedToSessionCache();
      // Keep the current clip playing; the query-key effect swaps when global feed is ready.
      feedQueryKeyRef.current = "near-me-pending-off";
      setNearMeActive(false);
      return;
    }

    const confirmed = await confirmNearMeLiveLocationSharing(userId);
    if (!confirmed) return;

    // Persist the global page before GPS/nearby load.
    snapshotCurrentFeedToSessionCache();
    // Keep the current video playing while GPS + nearby page load.
    // Invalidate the query key so a failed toggle still reloads the global feed.
    feedQueryKeyRef.current = "near-me-pending";
    setNearMeActive(true);
    setNearMeLoading(true);

    try {
      // Near-me filter also turns on live location sharing so others can find you,
      // and so Settings → share live location stays in sync.
      const alreadySharing = await isLiveLocationSharingEnabled(userId);
      if (!alreadySharing) {
        const result = await enableLiveLocationSharing(userId);
        if ("error" in result) {
          setNearMeActive(false);
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          return;
        }

        onViewerProfileUpdated?.(result.profile);
        if (result.profile.live_latitude != null && result.profile.live_longitude != null) {
          setUserLocation({
            latitude: result.profile.live_latitude,
            longitude: result.profile.live_longitude,
          });
        } else {
          await refreshViewerGpsLocation();
        }
        return;
      }

      await refreshViewerGpsLocation();
    } catch (err) {
      setNearMeActive(false);
      Alert.alert(
        "could not get location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
    } finally {
      setNearMeLoading(false);
    }
  }

  const load = useCallback(async (options?: { commit?: boolean }) => {
    const commit = options?.commit !== false;
    const generation = feedReloadGenerationRef.current;
    filterFillGenerationRef.current += 1;
    setFilterFillActive(false);
    setError(null);
    setDiscoverFeedPhase("unseen");
    // Only blank the first-clip gate on the initial boot; later refreshes stay on the feed.
    if (!initialBootCompleteRef.current) setFirstClipReady(false);

    const watermarkPromise = fetchNewestVideoCreatedAt().catch(() => null);
    let page = await fetchDiscoverPage(null, "unseen");
    if (generation !== feedReloadGenerationRef.current) return null;

    // Cold start with nothing new → drop straight into replay (toast if clips exist).
    if (page.items.length === 0 && !page.nextCursor) {
      page = await enterReplayPhase();
      if (generation !== feedReloadGenerationRef.current) return null;
    } else {
      feedCursorRef.current = page.nextCursor;
      setFeedCursor(page.nextCursor);
    }

    const nextItems = shuffleVideosWithSpacing(page.items);
    const watermark = await watermarkPromise;
    if (generation !== feedReloadGenerationRef.current) return null;
    if (commit) {
      itemsRef.current = nextItems;
      setItems(nextItems);
      putDiscoverFeedSessionCache(feedQueryKeyRef.current, {
        items: nextItems,
        feedCursor: feedCursorRef.current,
        feedPhase: feedPhaseRef.current,
        activeVideoId: nextItems[0]?.id ?? null,
        playbackPositionSec: 0,
        userPaused: false,
        feedWatermarkAt: watermark,
      });
    }
    return { items: nextItems, watermark };
  }, [enterReplayPhase, fetchDiscoverPage, setDiscoverFeedPhase]);

  const loadMoreFeed = useCallback(
    async (options?: { allowReplayTransition?: boolean }) => {
      const allowReplayTransition = options?.allowReplayTransition ?? false;
      if (loadingMoreFeedRef.current) return;
      const generation = feedReloadGenerationRef.current;

      const cursor = feedCursorRef.current;
      if (!cursor) {
        if (!allowReplayTransition || feedPhaseRef.current !== "unseen") return;

        loadingMoreFeedRef.current = true;
        try {
          const page = await enterReplayPhase();
          if (generation !== feedReloadGenerationRef.current) return;
          if (page.items.length === 0) return;

          setItems((current) => {
            if (generation !== feedReloadGenerationRef.current) return current;
            const existingIds = new Set(current.map((item) => item.id));
            const fresh = page.items.filter((item) => !existingIds.has(item.id));
            if (fresh.length === 0) return current;
            const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            updateDiscoverFeedSessionCache(feedQueryKeyRef.current, {
              items: nextItems,
              feedCursor: feedCursorRef.current,
              feedPhase: feedPhaseRef.current,
              activeVideoId: activeVideoIdRef.current,
            });
            return nextItems;
          });
        } catch (err) {
          if (generation === feedReloadGenerationRef.current) {
            setError(err instanceof Error ? err.message : "could not load more");
          }
        } finally {
          if (generation === feedReloadGenerationRef.current) {
            loadingMoreFeedRef.current = false;
          }
        }
        return;
      }

      loadingMoreFeedRef.current = true;
      try {
        let nextCursor: FeedCursor | null = cursor;
        const accumulated: FeedVideo[] = [];
        let rounds = 0;
        const maxRounds = 4;

        while (nextCursor && rounds < maxRounds) {
          if (generation !== feedReloadGenerationRef.current) return;
          const page = await fetchDiscoverPage(nextCursor);
          accumulated.push(...page.items);
          nextCursor = page.nextCursor;
          rounds += 1;
          if (!page.nextCursor) break;
          if (accumulated.length >= FEED_PAGE_SIZE) break;
        }

        if (generation !== feedReloadGenerationRef.current) return;

        feedCursorRef.current = nextCursor;
        setFeedCursor(nextCursor);

        if (accumulated.length > 0) {
          setItems((current) => {
            if (generation !== feedReloadGenerationRef.current) return current;
            const existingIds = new Set(current.map((item) => item.id));
            const fresh = accumulated.filter((item) => !existingIds.has(item.id));
            if (fresh.length === 0) return current;
            const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            updateDiscoverFeedSessionCache(feedQueryKeyRef.current, {
              items: nextItems,
              feedCursor: feedCursorRef.current,
              feedPhase: feedPhaseRef.current,
              activeVideoId: activeVideoIdRef.current,
            });
            return nextItems;
          });
        }

        // User-driven: unseen pool just ended — continue into replay.
        if (
          allowReplayTransition &&
          !nextCursor &&
          feedPhaseRef.current === "unseen" &&
          accumulated.length < FEED_PAGE_SIZE
        ) {
          const replayPage = await enterReplayPhase();
          if (generation !== feedReloadGenerationRef.current) return;
          if (replayPage.items.length === 0) return;
          setItems((current) => {
            if (generation !== feedReloadGenerationRef.current) return current;
            const existingIds = new Set(current.map((item) => item.id));
            const fresh = replayPage.items.filter((item) => !existingIds.has(item.id));
            if (fresh.length === 0) return current;
            const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            updateDiscoverFeedSessionCache(feedQueryKeyRef.current, {
              items: nextItems,
              feedCursor: feedCursorRef.current,
              feedPhase: feedPhaseRef.current,
              activeVideoId: activeVideoIdRef.current,
            });
            return nextItems;
          });
        }
      } catch (err) {
        if (generation === feedReloadGenerationRef.current) {
          setError(err instanceof Error ? err.message : "could not load more");
        }
      } finally {
        if (generation === feedReloadGenerationRef.current) {
          loadingMoreFeedRef.current = false;
        }
      }
    },
    [enterReplayPhase, fetchDiscoverPage],
  );

  const fillFeedForActiveFilters = useCallback(async () => {
    const generation = ++filterFillGenerationRef.current;
    setFilterFillActive(true);

    try {
      for (let wait = 0; wait < 40 && loadingMoreFeedRef.current; wait += 1) {
        if (generation !== filterFillGenerationRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      if (generation !== filterFillGenerationRef.current) return;

      const filters = filterStateRef.current;
      if (!isFeedFilterStateActive(filters)) return;
      if (filters.nearMeActive && !filters.userLocation) return;
      if (!feedCursorRef.current || loadingMoreFeedRef.current) return;
      if (itemsRef.current.some((item) => feedVideoMatchesFilters(item, filters))) return;

      loadingMoreFeedRef.current = true;
      try {
        // Server already returns matching pages; a short walk covers residual thinning.
        let rounds = 0;
        while (feedCursorRef.current && rounds < 4) {
          if (generation !== filterFillGenerationRef.current) return;

          const page = await fetchDiscoverPage(feedCursorRef.current);

          feedCursorRef.current = page.nextCursor;
          setFeedCursor(page.nextCursor);

          if (page.items.length === 0) break;

          const existingIds = new Set(itemsRef.current.map((item) => item.id));
          const fresh = page.items.filter((item) => !existingIds.has(item.id));
          if (fresh.length > 0) {
            const nextItems = [...itemsRef.current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            setItems(nextItems);
            updateDiscoverFeedSessionCache(feedQueryKeyRef.current, {
              items: nextItems,
              feedCursor: feedCursorRef.current,
              feedPhase: feedPhaseRef.current,
              activeVideoId: activeVideoIdRef.current,
            });

            const currentFilters = filterStateRef.current;
            if (nextItems.some((item) => feedVideoMatchesFilters(item, currentFilters))) {
              break;
            }
          }

          if (!page.nextCursor) break;
          rounds += 1;
        }
      } catch (err) {
        if (generation === filterFillGenerationRef.current) {
          setError(err instanceof Error ? err.message : "could not load more");
        }
      } finally {
        loadingMoreFeedRef.current = false;
      }
    } finally {
      if (generation === filterFillGenerationRef.current) {
        setFilterFillActive(false);
      }
    }
  }, [fetchDiscoverPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      feedQueryKeyRef.current = buildDiscoverFeedQueryKey(filterStateRef.current);
      void load()
        .catch((err) => setError(err instanceof Error ? err.message : "could not load feed"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Reload when near-me mode/center/radius OR role/genre/location filters change —
  // unless this combination was already loaded this session (instant cache restore).
  useEffect(() => {
    if (nearMeLoading) return;
    if (nearMeActive && !userLocation) return;

    const nextKey = buildDiscoverFeedQueryKey(filterState);

    if (feedQueryKeyRef.current === null) {
      feedQueryKeyRef.current = nextKey;
      setFeedListKey(nextKey);
      return;
    }
    if (feedQueryKeyRef.current === nextKey) return;

    snapshotCurrentFeedToSessionCache();

    const cached = getDiscoverFeedSessionCache(nextKey);
    if (cached) {
      feedQueryKeyRef.current = nextKey;
      if (replayToastHideTimerRef.current) {
        clearTimeout(replayToastHideTimerRef.current);
        replayToastHideTimerRef.current = null;
      }
      replayToastOpacity.setValue(0);
      setReplayToastVisible(false);
      restoreFeedFromSessionCache(cached, nextKey);
      void refreshCachedFeedIfStale(nextKey, cached);
      return;
    }

    feedQueryKeyRef.current = nextKey;

    feedReloadGenerationRef.current += 1;
    const generation = feedReloadGenerationRef.current;
    loadingMoreFeedRef.current = false;
    filterFillGenerationRef.current += 1;

    if (replayToastHideTimerRef.current) {
      clearTimeout(replayToastHideTimerRef.current);
      replayToastHideTimerRef.current = null;
    }
    replayToastOpacity.setValue(0);
    setReplayToastVisible(false);

    // Keep the current clip playing; swap the list only once the new page is ready.
    beginSoftFeedQueryReload();

    void load({ commit: false })
      .then((loaded) => {
        if (generation !== feedReloadGenerationRef.current) return;
        if (!loaded) return;
        commitSoftFeedQueryReload(nextKey, loaded.items, {
          feedWatermarkAt: loaded.watermark,
        });
      })
      .catch((err) => {
        if (generation === feedReloadGenerationRef.current) {
          setError(err instanceof Error ? err.message : "could not load feed");
        }
      })
      .finally(() => {
        if (generation === feedReloadGenerationRef.current) {
          setFeedQueryReloading(false);
        }
      });
  }, [filterState, load, nearMeActive, nearMeLoading, replayToastOpacity, setDiscoverFeedPhase, userLocation]);

  useEffect(() => {
    if (shuffleSignal === 0) return;
    restoreFeedChrome();
    const frame = requestAnimationFrame(() => {
      setItems((current) => {
        const nextItems = shuffleVideosWithSpacing(current);
        itemsRef.current = nextItems;
        return nextItems;
      });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [restoreFeedChrome, shuffleSignal]);

  const itemsWithSavedState = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        savedByMe: savedVideoIds.has(item.id),
      })),
    [items, savedVideoIds],
  );

  const filtered = useMemo(
    () => itemsWithSavedState.filter((item) => feedVideoMatchesFilters(item, filterState)),
    [filterState, itemsWithSavedState],
  );

  const heldFeed = useMemo(() => {
    if (!queryReloadHold || queryReloadHold.length === 0) return null;
    const withSaved = queryReloadHold.map((item) => ({
      ...item,
      savedByMe: savedVideoIds.has(item.id),
    }));
    // Only keep clips that still match the active filters (e.g. Looking For alone).
    // Otherwise Apply looks like a no-op while the unfiltered hold stays on screen.
    const matched = withSaved.filter((item) => feedVideoMatchesFilters(item, filterState));
    return matched.length > 0 ? matched : null;
  }, [filterState, queryReloadHold, savedVideoIds]);

  const feedModeSwitching = nearMeLoading || feedQueryReloading;

  const matchingBridge = useMemo(
    () => feedBridge.filter((item) => feedVideoMatchesFilters(item, filterState)),
    [feedBridge, filterState],
  );

  const searchingForFilterMatches =
    filtered.length === 0 &&
    (loading ||
      filterFillActive ||
      feedQueryReloading ||
      nearMeLoading ||
      (nearMeActive && !userLocation) ||
      (filtersActive && Boolean(feedCursor)));

  // Keep the last non-empty *matching* feed on screen while filter paging / mode switch catches up.
  const holdingFilterBridge =
    searchingForFilterMatches && matchingBridge.length > 0 && !loading && !feedQueryReloading;
  /**
   * Poster-only bridge for empty-result filter fills. Soft query reloads
   * keep the live player on the held rows until the new page commits.
   */
  const suspendFeedVideo =
    holdingFilterBridge || (feedQueryReloading && !heldFeed && filtered.length === 0 && matchingBridge.length > 0);

  const visibleFeed =
    feedQueryReloading && heldFeed
      ? heldFeed
      : filtered.length > 0
        ? filtered
        : holdingFilterBridge
          ? matchingBridge
          : [];
  const wasHoldingFilterBridgeRef = useRef(false);

  // Warm neighbor posters so half-swipes paint immediately (no black VideoView).
  useEffect(() => {
    if (!activeVideoId || visibleFeed.length === 0) return;
    const activeIndex = visibleFeed.findIndex((item) => item.id === activeVideoId);
    if (activeIndex < 0) return;
    for (const offset of [-1, 0, 1, 2]) {
      const item = visibleFeed[activeIndex + offset];
      if (!item) continue;
      const poster = getFeedPosterSource(item);
      if (poster) void Image.prefetch(poster);
    }
  }, [activeVideoId, visibleFeed]);

  useEffect(() => {
    // Don't replace the bridge with client-thinned matches mid soft-reload.
    if (feedQueryReloading) return;
    if (filtered.length > 0) {
      setFeedBridge(filtered);
      return;
    }
    if (!searchingForFilterMatches) {
      setFeedBridge([]);
    }
  }, [feedQueryReloading, filtered, searchingForFilterMatches]);

  useEffect(() => {
    if (holdingFilterBridge) {
      wasHoldingFilterBridgeRef.current = true;
      return;
    }
    if (!wasHoldingFilterBridgeRef.current || filtered.length === 0) return;
    wasHoldingFilterBridgeRef.current = false;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [filtered.length, holdingFilterBridge]);

  useEffect(() => {
    if (loading || nearMeLoading) return;
    if (!filtersActive) return;
    if (nearMeActive && !userLocation) return;
    if (filtered.length > 0) return;
    if (!feedCursor) return;
    void fillFeedForActiveFilters();
  }, [
    feedCursor,
    fillFeedForActiveFilters,
    filtered.length,
    filtersActive,
    genres,
    loading,
    location,
    lookingForActive,
    nearMeActive,
    nearMeLoading,
    roles,
    userLocation,
  ]);

  // Quietly keep several pages buffered so filter changes usually hit matches immediately.
  useEffect(() => {
    if (loading || filterFillActive) return;
    if (!feedCursor) return;
    if (filtersActive && filtered.length === 0) return;
    if (items.length >= feedPrefetchTarget) {
      if (!(filtersActive && filtered.length > 0 && filtered.length < Math.min(FEED_PAGE_SIZE, 6))) {
        return;
      }
    }
    void loadMoreFeed();
  }, [
    feedCursor,
    feedPrefetchTarget,
    filterFillActive,
    filtered.length,
    filtersActive,
    items.length,
    loadMoreFeed,
    loading,
  ]);

  useEffect(() => {
    if (loading) return;
    if (visibleFeed.length === 0) {
      setFirstClipReady(true);
      return;
    }
    // Don't block the feed forever if the first clip is slow/unavailable.
    const timer = setTimeout(() => setFirstClipReady(true), 2500);
    return () => clearTimeout(timer);
  }, [visibleFeed.length, loading]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // Soft reload: keep the clip the user was watching — don't jump to a
      // client-filtered intermediate row (that flash is what we're preventing).
      if (feedQueryReloading) return;

      // Don't revive playback on the poster-only bridge — wait for the new page.
      if (suspendFeedVideo) {
        setActiveVideoId(null);
        return;
      }

      if (visibleFeed.length === 0) {
        setActiveVideoId(null);
        return;
      }

      // When real filter matches arrive, jump to the first match instead of staying on the bridge.
      if (filtered.length > 0) {
        setActiveVideoId((current) =>
          current && filtered.some((item) => item.id === current) ? current : filtered[0].id,
        );
        return;
      }

      setActiveVideoId((current) =>
        current && visibleFeed.some((item) => item.id === current) ? current : visibleFeed[0].id,
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [feedQueryReloading, filtered, suspendFeedVideo, visibleFeed]);

  async function refresh() {
    setRefreshing(true);
    if (nearMeActive) {
      try {
        await refreshViewerGpsLocation();
      } catch {
        // Keep the previous center point if GPS refresh fails.
      }
    }
    await load().catch((err) => setError(err instanceof Error ? err.message : "could not refresh"));
    setRefreshing(false);
  }

  async function toggleSave(item: FeedVideo, nextSaved: boolean) {
    return setVideoSaved(item.id, nextSaved);
  }

  function removeCreatorFromFeed(creatorUserId: string) {
    setItems((current) => {
      const nextItems = current.filter((entry) => entry.userId !== creatorUserId);
      itemsRef.current = nextItems;
      updateDiscoverFeedSessionCache(feedQueryKeyRef.current, {
        items: nextItems,
        feedCursor: feedCursorRef.current,
        feedPhase: feedPhaseRef.current,
        activeVideoId: activeVideoIdRef.current,
      });
      return nextItems;
    });
    removeCreatorFromDiscoverFeedSessionCache(creatorUserId);
    setActiveProfile((current) => (current?.userId === creatorUserId ? null : current));
    setActiveDm((current) => (current?.userId === creatorUserId ? null : current));
  }

  function hideFeedCreator(item: FeedVideo) {
    removeCreatorFromFeed(item.userId);
    void hideCreator(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not hide creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function blockFeedCreator(item: FeedVideo) {
    removeCreatorFromFeed(item.userId);
    void blockUser(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not block creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function submitFeedReport(item: FeedVideo, reason: ReportReason) {
    if (reportSubmitting) return;

    setReportSubmitting(true);
    void reportVideo({
      reporterId: userId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setReportItem(null);
        setError(null);
        setToast("report submitted");
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setReportSubmitting(false));
  }

  function openJamThread(item: FeedVideo) {
    // A jar on a video always composes a message about that video. Full threads
    // remain available from inbox and the creator's profile.
    setActiveProfile(null);
    setActiveDm(item);
  }

  function openJamFromProfile(item: FeedVideo) {
    openJamThread(item);
  }

  const navBarHeight = getNavBarHeight(insets.bottom);
  // Page height matches the visible feed above the tab bar so the next video
  // sits flush under the current one (as if waiting behind the nav). pagingEnabled
  // still snaps by the list viewport, which is constrained to this same height.
  const feedItemHeight = viewportHeight - navBarHeight;

  function updateActiveVideo(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / feedItemHeight);
    const safeIndex = Math.max(0, Math.min(nextIndex, visibleFeed.length - 1));
    const nextItem = visibleFeed[safeIndex];
    if (nextItem) {
      if (activeVideoId && activeVideoId !== nextItem.id) {
        setUserPausedVideoId(null);
      }
      setActiveVideoId(nextItem.id);
      resumeFeedVideoIdRef.current = nextItem.id;
    }
    // Prefetch the next page before the end-of-feed footer, like TikTok.
    // Only hand off to replay when the user is actually near the last clips.
    if (safeIndex >= visibleFeed.length - 3) {
      void loadMoreFeed({
        allowReplayTransition: !feedCursorRef.current || safeIndex >= visibleFeed.length - 2,
      });
    }
  }

  // Keep the feed playing under the jam compose sheet; pause for profiles/chats/filters.
  // Keep the active clip playing under the filter sheet — only pause for
  // full-screen routes / filter-wheel bridge holds.
  const shouldPlayFeedVideos =
    isFocused && !activeProfile && !suspendFeedVideo;

  // Remember the clip on blur; restore active id on focus without scrolling.
  // Forced scrollToOffset remounts the cell and flashes black over the video.
  useEffect(() => {
    const wasFocused = discoverFocusedRef.current;
    discoverFocusedRef.current = isFocused;

    if (!isFocused) {
      if (wasFocused) {
        if (activeVideoId) resumeFeedVideoIdRef.current = activeVideoId;
        restoreFeedChrome();
        setFeedSpeedHolding(false);
      }
      return;
    }

    if (wasFocused) return;

    const resumeId = resumeFeedVideoIdRef.current ?? activeVideoId;
    if (!resumeId) return;
    if (!visibleFeed.some((item) => item.id === resumeId)) return;
    if (activeVideoId !== resumeId) {
      setActiveVideoId(resumeId);
    }
  }, [activeVideoId, isFocused, restoreFeedChrome, visibleFeed]);
  const activeProfilePreload = useMemo(
    () =>
      activeProfile
        ? feedItemToPreloadedProfile(activeProfile, itemsWithSavedState)
        : null,
    [activeProfile, itemsWithSavedState],
  );

  // jam. covers the feed only on cold app open — not after login/signup.
  const showFeedBootOverlay =
    showBootOverlay &&
    !initialBootComplete &&
    (loading || (!firstClipReady && visibleFeed.length > 0 && !error));

  useEffect(() => {
    if (showFeedBootOverlay || initialBootComplete) return;
    initialBootCompleteRef.current = true;
    setInitialBootComplete(true);
    onBootReady?.();
  }, [initialBootComplete, onBootReady, showFeedBootOverlay]);

  const feedChromeInteractive = !feedChromeHolding && !feedChromeLocked;

  return (
    <View style={darkStyles.feedRoot}>
      <Animated.View
        pointerEvents={feedChromeInteractive ? "box-none" : "none"}
        style={[styles.feedTopBar, { top: insets.top + 12, opacity: feedChromeOpacity }]}
      >
        <Pressable
          style={[styles.feedNearMeButton, nearMeActive && styles.feedNearMeButtonActive]}
          accessibilityLabel={nearMeActive ? "near me on, sharing live location" : "near me"}
          accessibilityHint="turns on share live location to find creators nearby"
          accessibilityRole="button"
          accessibilityState={{ selected: nearMeActive, busy: feedModeSwitching }}
          onPress={() => void toggleNearMe()}
        >
          {feedModeSwitching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <NearMeIcon active={nearMeActive} />
          )}
        </Pressable>
        <FeedRoleFilterWheel selectedRoles={roles} onSelectRole={applyFeedFilterPill} />
        <Pressable onPress={() => setFiltersOpen(true)} style={styles.feedFilterButton}>
          <FeedFilterIcon />
        </Pressable>
      </Animated.View>
      {error ? <Toast text={error} onDismiss={() => setError(null)} /> : null}
      {toast ? <Toast text={toast} onDismiss={() => setToast(null)} /> : null}
      {replayToastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.feedReplayToast,
            { top: insets.top + 64, opacity: replayToastOpacity },
          ]}
          accessibilityLabel="All new videos watched, replaying seen"
        >
          <Text style={styles.feedReplayToastText}>all new videos watched — replaying seen</Text>
        </Animated.View>
      ) : null}
      {visibleFeed.length === 0 ? (
        searchingForFilterMatches ? (
          <View style={styles.endOfFeedFullscreen}>
            <ActivityIndicator color={getActivityIndicatorColor()} />
            <Text style={[styles.emptyText, { marginTop: 18 }]}>looking for creators...</Text>
          </View>
        ) : (
          <View style={styles.endOfFeedFullscreen}>
            <Text style={styles.emptyText}>
              {getEndOfFeedCopy({
                filtersActive,
                nearMeActive,
                seenEveryone: feedPhase === "replay",
              })}
            </Text>
            {nearMeActive ? null : (
              <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
                <Text style={styles.createNavText}>+</Text>
              </Pressable>
            )}
          </View>
        )
      ) : (
        <View style={{ height: feedItemHeight }}>
          <FlatList
            key={feedListKey}
            ref={listRef}
            data={visibleFeed}
            keyExtractor={(item) => item.id}
            style={{ height: feedItemHeight }}
            pagingEnabled
            directionalLockEnabled
            scrollEnabled={
              !suspendFeedVideo && !feedModeSwitching && !feedChromeHolding && !feedSpeedHolding
            }
            decelerationRate="fast"
            disableIntervalMomentum
            windowSize={5}
            maxToRenderPerBatch={3}
            initialScrollIndex={Math.min(
              feedInitialScrollIndex,
              Math.max(0, visibleFeed.length - 1),
            )}
            initialNumToRender={Math.min(
              visibleFeed.length,
              Math.max(2, feedInitialScrollIndex + 1),
            )}
            getItemLayout={(_, index) => ({
              length: feedItemHeight,
              offset: feedItemHeight * index,
              index,
            })}
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={updateActiveVideo}
            onEndReached={() => {
              if (suspendFeedVideo || feedModeSwitching) return;
              void loadMoreFeed({ allowReplayTransition: true });
            }}
            onEndReachedThreshold={0.8}
            refreshControl={<RefreshControl tintColor={getActivityIndicatorColor()} refreshing={refreshing} onRefresh={refresh} />}
            ListFooterComponent={
              feedCursor || suspendFeedVideo || feedPhase === "unseen" ? null : (
                <EndOfFeedState
                  filtersActive={filtersActive}
                  nearMeActive={nearMeActive}
                  seenEveryone
                  height={feedItemHeight}
                  onCreate={onCreate}
                />
              )
            }
            renderItem={({ item }) => (
              <FeedItem
                item={item}
                height={feedItemHeight}
                navBarHeight={0}
                isActive={shouldPlayFeedVideos && item.id === activeVideoId}
                paused={userPausedVideoId === item.id}
                suspendVideo={suspendFeedVideo}
                resumePositionSec={
                  resumePlayback?.videoId === item.id ? resumePlayback.positionSec : null
                }
                onResumePositionApplied={() => {
                  setResumePlayback((current) =>
                    current?.videoId === item.id ? null : current,
                  );
                }}
                onPlaybackProgress={(positionSec) => {
                  if (item.id !== activeVideoIdRef.current) return;
                  activePlaybackPositionSecRef.current = positionSec;
                }}
                onPausedChange={(nextPaused) => {
                  setUserPausedVideoId(nextPaused ? item.id : null);
                }}
                activeFilterTags={activeFilterTags}
                chromeOpacity={feedChromeOpacity}
                chromeHolding={feedChromeHolding}
                chromeLocked={feedChromeLocked}
                onChromeHoldStart={handleFeedChromeHoldStart}
                onChromeHoldEnd={handleFeedChromeHoldEnd}
                onChromeLock={handleFeedChromeLock}
                onChromeUnlock={handleFeedChromeUnlock}
                onSpeedHoldStart={handleFeedSpeedHoldStart}
                onSpeedHoldEnd={handleFeedSpeedHoldEnd}
                onFirstPlay={
                  item.id === activeVideoId || item.id === visibleFeed[0]?.id
                    ? () => setFirstClipReady(true)
                    : undefined
                }
                onWatched={() => markFeedVideoSeen(item.id)}
                onOpenProfile={() => setActiveProfile(item)}
                onSave={(nextSaved) => toggleSave(item, nextSaved)}
                onMessage={() => void openJamThread(item)}
                onNotInterested={() => hideFeedCreator(item)}
                onBlock={() => blockFeedCreator(item)}
                onReport={() => setReportItem(item)}
              />
            )}
          />
        </View>
      )}
      {showFeedBootOverlay ? (
        <View pointerEvents="none" style={darkStyles.feedBootOverlay}>
          <LoadingScreen label="finding creators..." logoOnly />
        </View>
      ) : null}
      <FilterSheet
        visible={filtersOpen}
        selectedRoles={roles}
        selectedGenres={genres}
        selectedLocation={location}
        lookingForActive={lookingForActive}
        showLookingFor
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, nextGenres, nextLocation, nextLookingFor) => {
          const nextKey = buildDiscoverFeedQueryKey({
            ...filterState,
            roles: nextRoles,
            genres: nextGenres,
            location: nextLocation,
            lookingForActive: nextLookingFor,
          });
          snapshotCurrentFeedToSessionCache();
          const cached = getDiscoverFeedSessionCache(nextKey);
          if (cached) {
            feedQueryKeyRef.current = nextKey;
            restoreFeedFromSessionCache(cached, nextKey);
            setRoles(nextRoles);
            setGenres(nextGenres);
            setLocation(nextLocation);
            setLookingForActive(nextLookingFor);
            setFiltersOpen(false);
            void refreshCachedFeedIfStale(nextKey, cached);
            return;
          }
          // Looking For alone must invalidate the query key the same way role/genre
          // do — bump a stale sentinel if somehow the key already matched.
          if (feedQueryKeyRef.current === nextKey) {
            feedQueryKeyRef.current = `${nextKey}:reapply`;
          }
          beginFilterTransition(visibleFeed);
          setRoles(nextRoles);
          setGenres(nextGenres);
          setLocation(nextLocation);
          setLookingForActive(nextLookingFor);
          setFiltersOpen(false);
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        userId={activeProfile?.userId ?? null}
        preloadedProfile={activeProfilePreload}
        savedVideoController={savedVideoController}
        onClose={() => setActiveProfile(null)}
        onMessage={(profileFeedItem) => {
          void openJamFromProfile(profileFeedItem);
        }}
        onJamSent={(sentUserId) => {
          setItems((current) =>
            current.map((entry) =>
              entry.userId === sentUserId ? { ...entry, jammedByMe: true } : entry,
            ),
          );
          setActiveProfile((current) =>
            current?.userId === sentUserId
              ? {
                  ...current,
                  jammedByMe: true,
                  mutual: Boolean(current.jammedMe),
                }
              : current,
          );
        }}
        onInboxChanged={onInboxChanged}
        onUnjammed={(removedUserId) => {
          setItems((current) =>
            current.map((entry) =>
              entry.userId === removedUserId
                ? {
                    ...entry,
                    jammedByMe: false,
                    jammedMe: false,
                    mutual: false,
                  }
                : entry,
            ),
          );
          setActiveProfile((current) =>
            current?.userId === removedUserId ? null : current,
          );
          setActiveDm((current) => (current?.userId === removedUserId ? null : current));
          onInboxChanged();
        }}
        onBlocked={(blockedUserId) => {
          removeCreatorFromFeed(blockedUserId);
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          setActiveDm(null);
          setActiveProfile(item);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          const recipientUserId = activeDm.userId;
          await sendJamRequest(recipientUserId, body, activeDm.id);
          setItems((current) =>
            current.map((entry) =>
              entry.userId === recipientUserId ? { ...entry, jammedByMe: true } : entry,
            ),
          );
          setActiveDm(null);
          onInboxChanged();
        }}
      />
      <FeedReportModal
        item={reportItem}
        submitting={reportSubmitting}
        onClose={() => setReportItem(null)}
        onSubmit={(reason) => {
          if (reportItem) submitFeedReport(reportItem, reason);
        }}
      />
    </View>
  );
}
