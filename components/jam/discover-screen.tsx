"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type TouchEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { GoldBadge } from "@/components/jam/gold-badge";
import { FilterIcon, HeartIcon, SendIcon } from "@/components/jam/icons";
import { useSwipeBack } from "@/components/jam/use-swipe-back";
import { creatorRoles, locationSuggestions } from "@/lib/options";
import {
  fetchFeedVideos,
  likeCreator as likeCreatorInDatabase,
  saveVideo as saveVideoInDatabase,
  sendMessage,
  type FeedVideo,
} from "@/lib/social-data";
import { supabase } from "@/lib/supabase";

const DAILY_FREE_ACTIONS = 10;
const FILTER_ANIMATION_MS = 300;
const FEED_SWIPE_THRESHOLD_PX = 40;
const FEED_SNAP_LOCK_MS = 340;
const FEED_RESIDUAL_WHEEL_LOCK_MS = 120;

type ProfileState = "locked" | "liked" | "liked-you" | "mutual";

let savedDiscoverFeedPosition: {
  index: number;
  videoId: string | null;
} = {
  index: 0,
  videoId: null,
};

export function DiscoverScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedVideo[]>([]);
  const [failedVideoIds, setFailedVideoIds] = useState<string[]>([]);
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedLocation, setAppliedLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [draftLocation, setDraftLocation] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [profileForVideoId, setProfileForVideoId] = useState<string | null>(null);
  const [dmForVideoId, setDmForVideoId] = useState<string | null>(null);
  const [dmBody, setDmBody] = useState("");
  const [actionsUsed, setActionsUsed] = useState(0);
  const [actedOnIds, setActedOnIds] = useState<string[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const feedScrollRef = useRef<HTMLElement | null>(null);
  const feedActiveIndexRef = useRef(0);
  const feedSnapLockedRef = useRef(false);
  const feedSnapStartedAtRef = useRef(0);
  const feedSnapTimerRef = useRef<number | null>(null);
  const feedScrollTopRef = useRef(0);
  const feedTouchStartYRef = useRef<number | null>(null);
  const feedPositionRestoredRef = useRef(false);
  const shouldRestoreFeedScrollRef = useRef(false);
  const toastTimersRef = useRef<number[]>([]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemRole = item.role.toLowerCase();
      const matchesRole =
        appliedRoles.length === 0 ||
        appliedRoles.some((role) => itemRole === role);

      const matchesLocation =
        appliedLocation.trim().length === 0 ||
        item.location.toLowerCase().includes(appliedLocation.toLowerCase()) ||
        appliedLocation.toLowerCase().includes(item.location.toLowerCase());

      return matchesRole && matchesLocation;
    });
  }, [appliedLocation, appliedRoles, items]);

  const roleSuggestions = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    return creatorRoles.filter(
      (role) =>
        !draftRoles.includes(role) &&
        (q.length === 0 || role.includes(q)),
    );
  }, [draftRoles, roleQuery]);

  const locationMatches = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    if (q.length === 0) return [];
    return locationSuggestions.filter((loc) =>
      loc.toLowerCase().includes(q),
    );
  }, [locationQuery]);

  const actionsRemaining = Math.max(0, DAILY_FREE_ACTIONS - actionsUsed);
  const feedHeightClass = "h-[calc(100svh-(96px+env(safe-area-inset-bottom)))]";

  useEffect(() => {
    return () => {
      if (feedSnapTimerRef.current !== null) {
        window.clearTimeout(feedSnapTimerRef.current);
      }
      toastTimersRef.current.forEach((id) => window.clearTimeout(id));
      toastTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    function randomizeDiscoverFeed() {
      setItems((current) => {
        const shuffled = shuffleVideos(current);
        savedDiscoverFeedPosition = {
          index: 0,
          videoId: shuffled[0]?.id ?? null,
        };
        feedActiveIndexRef.current = 0;
        feedScrollTopRef.current = 0;
        feedPositionRestoredRef.current = true;

        requestAnimationFrame(() => {
          if (feedScrollRef.current) {
            feedScrollRef.current.scrollTop = 0;
          }
        });

        return shuffled;
      });
    }

    window.addEventListener("jam:randomize-discover", randomizeDiscoverFeed);
    return () => {
      window.removeEventListener("jam:randomize-discover", randomizeDiscoverFeed);
    };
  }, []);

  useEffect(() => {
    if (
      authLoading ||
      filteredItems.length === 0 ||
      feedPositionRestoredRef.current
    ) {
      return;
    }

    const savedVideoIndex = savedDiscoverFeedPosition.videoId
      ? filteredItems.findIndex(
          (item) => item.id === savedDiscoverFeedPosition.videoId,
        )
      : -1;
    const restoredIndex = Math.min(
      Math.max(
        savedVideoIndex >= 0 ? savedVideoIndex : savedDiscoverFeedPosition.index,
        0,
      ),
      filteredItems.length - 1,
    );

    const frame = requestAnimationFrame(() => {
      const itemHeight = getFeedItemHeight();
      const scrollTop = restoredIndex * itemHeight;

      if (feedScrollRef.current) {
        feedScrollRef.current.scrollTop = scrollTop;
      }
      feedActiveIndexRef.current = restoredIndex;
      feedScrollTopRef.current = scrollTop;
      feedPositionRestoredRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [authLoading, filteredItems]);

  useEffect(() => {
    if (profileForVideoId !== null || !shouldRestoreFeedScrollRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (feedScrollRef.current) {
        feedScrollRef.current.scrollTop = feedScrollTopRef.current;
        feedActiveIndexRef.current = Math.round(
          feedScrollTopRef.current / (feedScrollRef.current.clientHeight || 1),
        );
      }
      shouldRestoreFeedScrollRef.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [profileForVideoId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      if (cancelled) return;

      try {
        const feedVideos = await fetchFeedVideos(user.id);
        if (cancelled) return;

        setUserId(user.id);
        setItems(feedVideos);
      } catch (error) {
        if (cancelled) return;

        setFeedError(
          error instanceof Error ? error.message : "Could not load feed.",
        );
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    loadSessionState();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!showFilters) return;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFiltersOpen(true));
    });

    return () => cancelAnimationFrame(frame);
  }, [showFilters]);

  function closeFilters() {
    setFiltersOpen(false);
    window.setTimeout(() => setShowFilters(false), FILTER_ANIMATION_MS);
  }

  function showToast(text: string) {
    toastTimersRef.current.forEach((id) => window.clearTimeout(id));
    toastTimersRef.current = [];

    setToastText(text);
    setToastVisible(true);

    toastTimersRef.current.push(
      window.setTimeout(() => setToastVisible(false), 1400),
    );
    toastTimersRef.current.push(window.setTimeout(() => setToastText(null), 1750));
  }

  function openFilters() {
    if (showFilters) {
      closeFilters();
      return;
    }

    setDraftRoles([...appliedRoles]);
    setDraftLocation(appliedLocation);
    setRoleQuery("");
    setLocationQuery(appliedLocation);
    setShowFilters(true);
  }

  function addRole(role: string) {
    if (draftRoles.includes(role)) return;
    setDraftRoles((current) => [...current, role]);
    setRoleQuery("");
  }

  function removeRole(role: string) {
    setDraftRoles((current) => current.filter((r) => r !== role));
  }

  function selectLocation(loc: string) {
    setDraftLocation(loc);
    setLocationQuery(loc);
  }

  function clearLocation() {
    setDraftLocation("");
    setLocationQuery("");
  }

  function applyFilters() {
    setAppliedRoles([...draftRoles]);
    setAppliedLocation(draftLocation);
    setRoleQuery("");
    setLocationQuery("");
    closeFilters();
  }

  function handleDailyAction(videoId: string) {
    if (actedOnIds.includes(videoId)) {
      showToast("Already connected today.");
      return false;
    }

    if (actionsRemaining === 0) {
      showToast("Daily limit reached.");
      return false;
    }

    const nextUsed = actionsUsed + 1;
    const nextRemaining = Math.max(0, DAILY_FREE_ACTIONS - nextUsed);

    setActedOnIds((current) => [...current, videoId]);
    setActionsUsed(nextUsed);
    showToast(`${nextRemaining} likes left!`);
    return true;
  }

  function likeVideo(item: FeedVideo) {
    if (item.likedByMe) {
      showToast("Already saved.");
      return;
    }

    saveFeedVideo(item);
  }

  function openDm(videoId: string) {
    if (!userId) return;

    const item = filteredItems.find((entry) => entry.id === videoId);
    if (!item) return;
    const alreadyLiked = item.likedByMe;

    if (!alreadyLiked && (actedOnIds.includes(videoId) || actionsRemaining === 0)) {
      handleDailyAction(videoId);
      return;
    }

    setDmForVideoId(videoId);
    setDmBody("");
  }

  function sendDm() {
    if (!dmForVideoId || !userId) return;

    const item = filteredItems.find((entry) => entry.id === dmForVideoId);
    if (!item) return;

    if (!dmBody.trim()) {
      showToast("Add a short message.");
      return;
    }

    const alreadyLiked = item.likedByMe;

    if (!alreadyLiked) {
      const liked = likeCreator(item);
      if (!liked) return;
    }

    sendMessage(item.userId, dmBody)
      .then(async () => {
        setItems(await fetchFeedVideos(userId));
        setDmForVideoId(null);
        setDmBody("");
        showToast("Message sent.");
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Could not send message.");
      });
  }

  function likeCreator(item: FeedVideo) {
    if (!userId) return false;
    if (item.likedByMe) return true;

    const liked = handleDailyAction(item.id);
    if (!liked) return false;

    likeCreatorInDatabase(userId, item.userId)
      .then(async () => {
        setItems(await fetchFeedVideos(userId));
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Could not like creator.");
      });
    return true;
  }

  function saveFeedVideo(item: FeedVideo) {
    if (!userId) return false;
    if (item.likedByMe) return true;

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, likedByMe: true } : entry,
      ),
    );

    saveVideoInDatabase(userId, item.id).catch((error: unknown) => {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, likedByMe: false } : entry,
        ),
      );
      showToast(error instanceof Error ? error.message : "Could not save video.");
    });

    return true;
  }

  function markVideoFailed(videoId: string) {
    setFailedVideoIds((current) =>
      current.includes(videoId) ? current : [...current, videoId],
    );
  }

  function openCreatorProfile(videoId: string) {
    feedActiveIndexRef.current = getNearestFeedIndex();
    rememberFeedPosition(feedActiveIndexRef.current);
    feedScrollTopRef.current = feedScrollRef.current?.scrollTop ?? 0;
    setProfileForVideoId(videoId);
  }

  function closeCreatorProfile() {
    shouldRestoreFeedScrollRef.current = true;
    setProfileForVideoId(null);
  }

  function getFeedItemHeight() {
    return feedScrollRef.current?.clientHeight ?? 1;
  }

  function getNearestFeedIndex() {
    const scrollTop = feedScrollRef.current?.scrollTop ?? 0;
    return Math.round(scrollTop / getFeedItemHeight());
  }

  function rememberFeedPosition(index = getNearestFeedIndex()) {
    const nextIndex = Math.min(Math.max(index, 0), filteredItems.length - 1);
    if (nextIndex < 0) return;

    savedDiscoverFeedPosition = {
      index: nextIndex,
      videoId: filteredItems[nextIndex]?.id ?? null,
    };
  }

  function scrollFeedBy(direction: 1 | -1) {
    if (feedSnapLockedRef.current || filteredItems.length === 0) return;

    const currentIndex = Math.min(
      Math.max(getNearestFeedIndex(), 0),
      filteredItems.length - 1,
    );
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      filteredItems.length - 1,
    );
    if (nextIndex === currentIndex) return;

    feedSnapLockedRef.current = true;
    feedSnapStartedAtRef.current = Date.now();
    feedActiveIndexRef.current = nextIndex;
    rememberFeedPosition(nextIndex);
    feedScrollTopRef.current = nextIndex * getFeedItemHeight();
    feedScrollRef.current?.scrollTo({
      top: feedScrollTopRef.current,
      behavior: "smooth",
    });

    if (feedSnapTimerRef.current !== null) {
      window.clearTimeout(feedSnapTimerRef.current);
    }
    releaseFeedSnapLockAfter(FEED_SNAP_LOCK_MS);
  }

  function releaseFeedSnapLockAfter(delayMs: number) {
    if (feedSnapTimerRef.current !== null) {
      window.clearTimeout(feedSnapTimerRef.current);
    }
    feedSnapTimerRef.current = window.setTimeout(() => {
      feedSnapLockedRef.current = false;
      feedSnapTimerRef.current = null;
    }, delayMs);
  }

  function handleFeedWheel(event: WheelEvent<HTMLElement>) {
    if (Math.abs(event.deltaY) < 1) return;

    event.preventDefault();
    if (feedSnapLockedRef.current) {
      const animationTimeLeft = Math.max(
        0,
        FEED_SNAP_LOCK_MS - (Date.now() - feedSnapStartedAtRef.current),
      );
      releaseFeedSnapLockAfter(
        Math.max(animationTimeLeft, FEED_RESIDUAL_WHEEL_LOCK_MS),
      );
      return;
    }

    scrollFeedBy(event.deltaY > 0 ? 1 : -1);
  }

  function handleFeedTouchStart(event: TouchEvent<HTMLElement>) {
    feedTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleFeedTouchMove(event: TouchEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleFeedTouchEnd(event: TouchEvent<HTMLElement>) {
    const startY = feedTouchStartYRef.current;
    feedTouchStartYRef.current = null;
    if (startY === null) return;

    const endY = event.changedTouches[0]?.clientY ?? startY;
    const distance = startY - endY;
    if (Math.abs(distance) < FEED_SWIPE_THRESHOLD_PX) return;

    scrollFeedBy(distance > 0 ? 1 : -1);
  }

  function handleFeedKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      scrollFeedBy(1);
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      scrollFeedBy(-1);
    }
  }

  function toggleVideoPlayback(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, label, select, textarea")) return;

    const video = event.currentTarget.querySelector("video");
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => undefined);
      return;
    }

    video.pause();
  }

  function getProfileState(item: FeedVideo) {
    if (item.mutual) return "mutual";
    if (item.likedMe) return "liked-you";
    if (item.likedByMe) return "liked";
    return "locked";
  }

  function getFeedConnectionBadge(item: FeedVideo) {
    if (item.mutual) return "friends";
    if (item.likedMe) return "liked you!";
    return null;
  }

  const activeProfileItem = profileForVideoId
    ? filteredItems.find((entry) => entry.id === profileForVideoId)
    : undefined;
  const activeProfileVideos = activeProfileItem
    ? items.filter((entry) => entry.userId === activeProfileItem.userId)
    : [];
  const activeDmItem = dmForVideoId
    ? filteredItems.find((entry) => entry.id === dmForVideoId)
    : undefined;

  if (activeProfileItem) {
    return (
      <>
        <CreatorProfileScreen
          item={activeProfileItem}
          profileState={getProfileState(activeProfileItem)}
          profileVideos={activeProfileVideos}
          failedVideoIds={failedVideoIds}
          onClose={closeCreatorProfile}
          onLike={(item) => likeCreator(item)}
          onMessage={(item) => openDm(item.id)}
          onVideoError={markVideoFailed}
        />
        <ToastOverlay text={toastText} visible={toastVisible} />
        {activeDmItem && (
          <DmComposer
            item={activeDmItem}
            body={dmBody}
            onBodyChange={setDmBody}
            onCancel={() => {
              setDmForVideoId(null);
              setDmBody("");
            }}
            onSend={sendDm}
          />
        )}
      </>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] text-white">
      <header className="absolute inset-x-0 top-0 z-[60] bg-transparent px-4 pt-8">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <span aria-hidden="true" className="block h-10 w-20" />
          <button
            type="button"
            onClick={openFilters}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/70 text-zinc-300"
            aria-label="Open filters"
          >
            <FilterIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section
        ref={feedScrollRef}
        tabIndex={0}
        onKeyDown={handleFeedKeyDown}
        onTouchStart={handleFeedTouchStart}
        onTouchMove={handleFeedTouchMove}
        onTouchEnd={handleFeedTouchEnd}
        onTouchCancel={() => {
          feedTouchStartYRef.current = null;
        }}
        onWheel={handleFeedWheel}
        className={[
          feedHeightClass,
          "touch-none overflow-hidden overscroll-contain focus:outline-none",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[390px]">
          {authLoading ? (
            <FeedSkeleton />
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">
              No creators match your current filters.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isLiked = item.likedByMe;
              const connectionBadge = getFeedConnectionBadge(item);

              return (
                <article
                  key={item.id}
                  className={["snap-start w-full overflow-hidden", feedHeightClass].join(" ")}
                >
                  <div
                    onClick={toggleVideoPlayback}
                    className={[
                      "relative flex h-full items-end bg-gradient-to-b px-4 pb-4",
                      item.mediaUrl && !failedVideoIds.includes(item.id)
                        ? "cursor-pointer"
                        : "",
                      getVideoGradient(item.id),
                    ].join(" ")}
                  >
                    {item.cloudflareStreamId ? (
                      <CloudflareStreamPlayer
                        videoId={item.cloudflareStreamId}
                        title={item.caption || `${item.creatorName} video`}
                        autoPlay
                        className="absolute inset-0 h-full w-full"
                      />
                    ) : item.mediaUrl && !failedVideoIds.includes(item.id) ? (
                      <video
                        src={item.mediaUrl}
                        className="absolute inset-0 h-full w-full bg-black object-contain"
                        muted
                        loop
                        playsInline
                        autoPlay
                        onError={() => markVideoFailed(item.id)}
                      />
                    ) : (
                      <FeedVideoPlaceholder item={item} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="relative z-10 mr-14 w-full space-y-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openCreatorProfile(item.id)}
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950 text-sm font-semibold"
                          aria-label={`Open ${item.creatorName}'s profile`}
                        >
                          {item.avatarFallback}
                        </button>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openCreatorProfile(item.id)}
                              className="text-left text-2xl font-semibold"
                            >
                              {item.creatorName}
                            </button>
                            {connectionBadge && (
                              <span className="rounded-full bg-zinc-500/30 px-2 py-0.5 text-[10px] font-medium leading-none text-white">
                                {connectionBadge}
                              </span>
                            )}
                            {item.earlyAdopter && <GoldBadge />}
                          </div>
                          <p className="text-sm text-zinc-300">
                            {item.role} - {item.location}
                          </p>
                        </div>
                      </div>
                      <p className="text-lg leading-snug text-zinc-100">{item.caption}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-200"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => likeVideo(item)}
                        className={[
                          "rounded-2xl border p-3 transition-colors",
                          isLiked
                            ? "border-white/40 bg-white text-black"
                            : "border-white/20 bg-zinc-900/80 text-zinc-100",
                        ].join(" ")}
                        aria-label={isLiked ? `Liked ${item.creatorName}` : `Like ${item.creatorName}`}
                        aria-pressed={isLiked}
                      >
                        <HeartIcon className="h-6 w-6" filled={isLiked} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDm(item.id)}
                        className="rounded-2xl border border-white/20 bg-zinc-900/80 p-3 text-zinc-100"
                        aria-label={`DM ${item.creatorName}`}
                      >
                        <SendIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {feedError && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-full max-w-[390px] -translate-x-1/2 px-5">
          <div className="mx-auto w-full max-w-md">
            <p className="inline-block rounded-full border border-red-400/20 bg-red-950/70 px-3 py-1.5 text-xs text-red-100">
              {feedError}
            </p>
          </div>
        </div>
      )}

      <ToastOverlay text={toastText} visible={toastVisible} />

      {activeDmItem && (
        <DmComposer
          item={activeDmItem}
          body={dmBody}
          onBodyChange={setDmBody}
          onCancel={() => {
            setDmForVideoId(null);
            setDmBody("");
          }}
          onSend={sendDm}
        />
      )}

      {showFilters && (
        <div className="absolute inset-0 z-50 flex justify-center overflow-hidden">
          <button
            type="button"
            className={[
              "absolute inset-0 bg-black/45 transition-opacity duration-300",
              filtersOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            aria-label="Close filters"
            onClick={closeFilters}
          />
          <div
            className={[
              "absolute left-1/2 top-0 z-10 w-full max-w-[390px] -translate-x-1/2 transition-transform duration-300 ease-out",
              filtersOpen ? "translate-y-0" : "-translate-y-full",
            ].join(" ")}
          >
            <div className="max-h-[calc(100svh-96px-env(safe-area-inset-bottom))] overflow-y-auto rounded-b-3xl border border-t-0 border-white/15 bg-zinc-950 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+4.25rem)] shadow-xl">
              <div className="mb-4 h-14" aria-hidden="true" />

              <section className="mb-5">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  Creator type
                </p>
                {draftRoles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {draftRoles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-zinc-900 px-2.5 py-1 text-sm capitalize text-zinc-200"
                      >
                        {role}
                        <button
                          type="button"
                          onClick={() => removeRole(role)}
                          className="text-zinc-400 hover:text-white"
                          aria-label={`Remove ${role}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={roleQuery}
                  onChange={(event) => setRoleQuery(event.target.value)}
                  placeholder="Type to filter roles…"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
                {roleSuggestions.length > 0 && (
                  <ul className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900">
                    {roleSuggestions.map((role) => (
                      <li key={role}>
                        <button
                          type="button"
                          onClick={() => addRole(role)}
                          className="w-full px-3 py-2 text-left text-sm capitalize text-zinc-200 hover:bg-zinc-800"
                        >
                          {role}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs text-zinc-500">
                  {draftRoles.length === 0 ? "No selection — showing everyone" : null}
                </p>
              </section>

              <section className="mb-5">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  Location
                </p>
                {draftLocation && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-zinc-900 px-2.5 py-1 text-sm text-zinc-200">
                      {draftLocation}
                      <button
                        type="button"
                        onClick={clearLocation}
                        className="text-zinc-400 hover:text-white"
                        aria-label="Clear location"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                )}
                <input
                  value={locationQuery}
                  onChange={(event) => {
                    setLocationQuery(event.target.value);
                    if (!event.target.value.trim()) setDraftLocation("");
                  }}
                  placeholder="Type city or country…"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
                {locationMatches.length > 0 && (
                  <ul className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900">
                    {locationMatches.map((loc) => (
                      <li key={loc}>
                        <button
                          type="button"
                          onClick={() => selectLocation(loc)}
                          className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                        >
                          {loc}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs text-zinc-500">
                  {draftLocation ? null : "No selection — anywhere"}
                </p>
              </section>

              <button
                type="button"
                onClick={applyFilters}
                className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function ToastOverlay({
  text,
  visible,
}: {
  text: string | null;
  visible: boolean;
}) {
  if (!text) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-full max-w-[390px] -translate-x-1/2 px-5">
      <div className="mx-auto w-full max-w-md">
        <p
          className={[
            "inline-block rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-200 shadow-sm backdrop-blur transition-all duration-200",
            visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
          ].join(" ")}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="relative h-full w-full animate-pulse overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-4 pb-8 pt-8">
      <div className="absolute inset-x-4 bottom-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-36 rounded-full bg-white/10" />
            <div className="h-3 w-24 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="h-5 w-5/6 rounded-full bg-white/10" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-full bg-white/10" />
          <div className="h-7 w-24 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="absolute bottom-8 right-4 space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-white/10" />
        <div className="h-12 w-12 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

function shuffleVideos(videos: FeedVideo[]) {
  const shuffled = [...videos];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function DmComposer({
  item,
  body,
  onBodyChange,
  onCancel,
  onSend,
}: {
  item: FeedVideo;
  body: string;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const swipeBack = useSwipeBack(onCancel);

  return (
    <div
      {...swipeBack}
      className="fixed inset-0 z-50 flex justify-center bg-black/60"
    >
      <div className="flex w-full max-w-[390px] items-end px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        <div className="w-full rounded-3xl border border-white/15 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold">
              {item.avatarFallback}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {item.creatorName}
              </p>
              <p className="text-xs text-zinc-500">
                {item.role} - {item.location}
              </p>
            </div>
          </div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
            Message
          </label>
          <textarea
            rows={3}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="Introduce yourself, share what you liked, and suggest a collab idea."
            className="mb-3 w-full resize-none rounded-2xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-zinc-300"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={onSend}
              className="flex-1 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-black"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudflareStreamPlayer({
  videoId,
  title,
  autoPlay,
  className,
}: {
  videoId: string;
  title: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const params = new URLSearchParams({
    controls: "false",
    loop: "true",
    muted: "true",
    preload: "true",
  });

  if (autoPlay) params.set("autoplay", "true");

  return (
    <iframe
      src={`https://iframe.videodelivery.net/${videoId}?${params.toString()}`}
      title={title}
      className={["border-0 bg-black", className ?? ""].join(" ")}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

function CreatorProfileScreen({
  item,
  profileState,
  profileVideos,
  failedVideoIds,
  onClose,
  onLike,
  onMessage,
  onVideoError,
}: {
  item?: FeedVideo;
  profileState: ProfileState;
  profileVideos: FeedVideo[];
  failedVideoIds: string[];
  onClose: () => void;
  onLike: (item: FeedVideo) => boolean;
  onMessage: (item: FeedVideo) => void;
  onVideoError: (videoId: string) => void;
}) {
  const swipeBack = useSwipeBack(onClose);

  if (!item) return null;

  const hasLiked = profileState === "liked" || profileState === "mutual";
  const videos = profileVideos.length > 0 ? profileVideos : [item];

  return (
    <main
      {...swipeBack}
      className="h-[100svh] overflow-y-auto overscroll-contain bg-[#0a0a0a] px-4 pb-32 pt-8 text-white"
    >
      <header className="flex items-center justify-between">
        <h1 className="text-4xl font-semibold tracking-tight">jam.</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-300"
          aria-label="Back to feed"
        >
          feed
        </button>
      </header>

      <section className="mt-5">
        <div className="relative">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-2xl font-semibold">
              {item.avatarFallback}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <h1 className="text-2xl font-semibold">{item.creatorName}</h1>
              {item.earlyAdopter && <GoldBadge />}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {item.role} - {item.location}
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-zinc-300">
              {getCreatorBio(item)}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onLike(item)}
              disabled={hasLiked}
              className={[
                "rounded-2xl px-4 py-3 text-sm font-semibold",
                hasLiked
                  ? "border border-white/15 bg-zinc-900 text-zinc-500"
                  : "bg-white text-black",
              ].join(" ")}
            >
              {profileState === "mutual"
                ? "Connected"
                : hasLiked
                  ? "Liked"
                  : "Like / connect"}
            </button>
            <button
              type="button"
              onClick={() => onMessage(item)}
              className="rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Message
            </button>
          </div>

          <div className="-mx-4 mt-6 grid grid-cols-3 gap-1">
            {videos.map((video, index) => {
              const isVideoLocked = !hasLiked && index >= 3;

              return (
                <article
                  key={video.id}
                  className="relative aspect-square overflow-hidden bg-zinc-900"
                  aria-label={video.caption || `${item.creatorName} video`}
                >
                  <div
                    className={[
                      "absolute inset-0 transition",
                      isVideoLocked ? "select-none blur-sm" : "",
                    ].join(" ")}
                  >
                      {video.cloudflareStreamId ? (
                        <CloudflareStreamPlayer
                          videoId={video.cloudflareStreamId}
                          title={video.caption || `${item.creatorName} video`}
                          className="h-full w-full"
                        />
                      ) : video.mediaUrl && !failedVideoIds.includes(video.id) ? (
                      <video
                        src={video.mediaUrl}
                          className="h-full w-full cursor-pointer bg-black object-contain"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                          onClick={(event) => {
                            if (event.currentTarget.paused) {
                              event.currentTarget.play().catch(() => undefined);
                              return;
                            }

                            event.currentTarget.pause();
                          }}
                        onError={() => onVideoError(video.id)}
                      />
                    ) : (
                      <div
                        className={[
                          "flex h-full w-full items-end bg-gradient-to-b p-2",
                          index % 3 === 0
                            ? "from-zinc-700 to-zinc-950"
                            : index % 3 === 1
                              ? "from-stone-700 to-zinc-950"
                              : "from-slate-700 to-black",
                        ].join(" ")}
                      >
                        <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white">
                          {video.caption || "Video"}
                        </p>
                      </div>
                    )}
                  </div>
                  {isVideoLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-2 text-center">
                      <p className="rounded-2xl border border-white/15 bg-zinc-950/85 px-2 py-2 text-[10px] font-semibold leading-tight text-white shadow-xl">
                        like to unlock full profile
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

    </main>
  );
}

function FeedVideoPlaceholder({ item }: { item: FeedVideo }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white">
          {item.avatarFallback}
        </div>
        <div>
          <p className="text-2xl font-semibold">{item.creatorName}</p>
          <p className="mt-1 text-sm text-zinc-300">
            {item.role} - {item.location}
          </p>
        </div>
        <p className="mx-auto max-w-xs text-sm leading-6 text-zinc-300">
          Video preview unavailable. Showing this creator&apos;s profile info instead.
        </p>
      </div>
    </div>
  );
}

function getCreatorBio(item: FeedVideo) {
  return (
    item.bio ||
    `${item.creatorName} is a ${item.role.toLowerCase()} building ${item.hashtags
      .slice(0, 2)
      .join(" and ")} ideas from ${item.location}.`
  );
}

function getVideoGradient(id: string) {
  const gradients = [
    "from-zinc-800 via-zinc-900 to-black",
    "from-slate-800 via-zinc-900 to-black",
    "from-neutral-800 via-zinc-900 to-black",
  ];
  const index = id.charCodeAt(0) % gradients.length;
  return gradients[index];
}
