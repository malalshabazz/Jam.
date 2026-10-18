import { useEventListener } from "expo";
import { Image } from "expo-image";
import {
  VideoView,
  useVideoPlayer,
  type VideoContentFit,
  type VideoPlayer,
  type VideoPlayerStatus,
  type VideoSource,
  type VideoThumbnail,
} from "expo-video";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Platform,
  StyleSheet,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  CachedCoverImage,
  prefetchGridImage,
} from "@/components/media/cached-grid-image";
import { MEDIA_LETTERBOX_BLACK } from "@/components/media/letterbox-media-shell";
import {
  contentFitForVideoSize,
  ensureVideoAspectCached,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromSource,
  getVideoAspectCacheKeyFromVideo,
  isPortraitFillVideoSize,
  letterboxVideoFrameStyle,
  parsePositiveDisplaySize,
  probeVideoDisplaySize,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import { clamp } from "@/lib/format";
import { probeHlsVideoSize } from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import {
  adoptPrewarmedProfileVideoPlayer,
  prewarmProfileVideoSource,
} from "@/lib/profile-video-prewarm";
import { isSlideshowPost, prewarmSlideshowPost } from "@/lib/slideshow-prewarm";
import {
  getCloudflareFreezeFrameUri,
  getExpoVideoSource,
  getGridVideoSource,
} from "@/lib/video-display";
import { getProfileFullscreenCoverUrl } from "@/lib/video-thumbnails";

export type JamVideoPlaybackStatus = {
  isLoaded: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  positionMillis: number;
  status: VideoPlayerStatus;
};

/** Open profile fullscreen; warm a sharp first-frame cover without blocking the open. */
export function openProfileVideoFullscreen(
  video: ProfileVideo | FeedVideo,
  open: () => void,
) {
  const source = getGridVideoSource(video);
  const cover = getProfileFullscreenCoverUrl(video);
  if (cover) void prefetchGridImage(cover);
  if (isSlideshowPost(video)) {
    prewarmSlideshowPost(video);
  } else {
    prewarmProfileVideoSource(source);
  }
  if (!getRememberedVideoAspectSize(getVideoAspectCacheKeyFromVideo(video))) {
    void ensureVideoAspectCached(video);
  }
  open();
}

export const PROFILE_VIDEO_OPEN_GREY = "#3f3f46";

function feedHoldLogId(source: string | null) {
  if (!source) return "none";
  const bare = source.split("?")[0] ?? source;
  const parts = bare.split("/");
  return parts[parts.length - 1] || bare.slice(-24);
}

function logFeedHold(payload: Record<string, unknown>) {
  if (__DEV__) {
    console.log("[feed-hold]", payload);
  }
}

type HoldStillKind = "midclip" | "poster" | "last" | "none";

function describeHoldStill(
  still: string | VideoThumbnail | null,
  midClipUri: string | null,
  posterUri: string | null | undefined,
  lastLoadedUri: string | null,
  loadedUris: Set<string>,
): { kind: HoldStillKind; loaded: boolean } {
  if (still == null) return { kind: "none", loaded: false };
  if (typeof still !== "string") return { kind: "midclip", loaded: true };
  if (midClipUri && still === midClipUri) {
    return { kind: "midclip", loaded: loadedUris.has(still) };
  }
  if (posterUri && still === posterUri) {
    return { kind: "poster", loaded: loadedUris.has(still) };
  }
  if (lastLoadedUri && still === lastLoadedUri) {
    return { kind: "last", loaded: loadedUris.has(still) };
  }
  return {
    kind: loadedUris.has(still) ? "last" : "none",
    loaded: loadedUris.has(still),
  };
}

/** Still shown over VideoView until a real frame paints — never leave a black hole. */
function pickStillUri(
  source: string | null,
  posterUri: string | null | undefined,
  timeSec = 0,
) {
  // Prefer the stable t=0 poster. Mid-clip Cloudflare thumbs are unique
  // per timestamp and paint black until they download.
  if (timeSec <= 0.2 && posterUri) return posterUri;
  if (source && timeSec > 0.2) {
    const freeze = getCloudflareFreezeFrameUri(source, timeSec);
    if (freeze) return freeze;
  }
  if (posterUri) return posterUri;
  if (source) return getCloudflareFreezeFrameUri(source, 0);
  return null;
}

/** Unmute only in the same tick as play() + cover drop. Never play muted. */
function applyVisibleAudio(
  player: VideoPlayer,
  isMuted: boolean,
  volume: number,
  surfaceReady: boolean,
) {
  const silent = isMuted || !surfaceReady;
  try {
    player.muted = silent;
    player.volume = silent ? 0 : volume;
  } catch {
    /* native object already gone */
  }
}

function configureJamVideoPlayer(
  nextPlayer: VideoPlayer,
  options: {
    isLooping: boolean;
    isMuted: boolean;
    volume: number;
    timeUpdateIntervalSec: number;
    surfaceReady?: boolean;
  },
) {
  nextPlayer.loop = options.isLooping;
  nextPlayer.timeUpdateEventInterval = options.timeUpdateIntervalSec;
  nextPlayer.audioMixingMode = "duckOthers";
  applyVisibleAudio(
    nextPlayer,
    options.isMuted,
    options.volume,
    options.surfaceReady ?? false,
  );
  // Never keep audio alive after navigate-away / app background. Playback is
  // resumed explicitly when the surface is active again.
  nextPlayer.staysActiveInBackground = false;
  nextPlayer.showNowPlayingNotification = false;
  nextPlayer.bufferOptions = {
    // Wait until the player is actually ready before decoding A/V — starting
    // early (especially on adopted prewarm players) caused choppy audio.
    waitsToMinimizeStalling: true,
    // iOS: 0 = let AVPlayer choose (best for HLS quality switching).
    // Android: ~15s target matches expo-video's quality-friendly default.
    preferredForwardBufferDuration: Platform.OS === "android" ? 15 : 0,
    minBufferForPlayback: 2,
    // false = allow larger buffers so ExoPlayer can select higher bitrates.
    prioritizeTimeOverSizeThreshold: false,
  };
}

/** Only start once the native player reports ready — prevents choppy first audio. */
function playJamVideoPlayerWhenReady(player: VideoPlayer) {
  try {
    if (player.status !== "readyToPlay") return false;
    player.play();
    return true;
  } catch {
    return false;
  }
}

/** Feed swipes start at t=0 so the incoming clip matches its start-frame cover. */
function parkJamVideoPlayerAtStart(player: VideoPlayer) {
  try {
    if (player.currentTime > 0.05) {
      player.currentTime = 0;
    }
  } catch {
    /* native object already gone */
  }
}

/** Seek without playing — keep the still up until beginVisiblePlayback. */
function restoreJamVideoPosition(
  player: VideoPlayer,
  restoreSec?: number | null,
) {
  let current = 0;
  try {
    current = player.currentTime;
  } catch {
    current = 0;
  }
  if (current <= 0.2) {
    if (restoreSec != null && restoreSec > 0.2) {
      try {
        player.currentTime = restoreSec;
      } catch {
        /* native object already gone */
      }
    } else {
      parkJamVideoPlayerAtStart(player);
    }
  }
}

/**
 * Silence a player. Pass `clearSource` on unmount so the native AVPlayer item is
 * dropped — expo-video `release()` alone can leave audio playing until GC
 * (especially when FlatList remounts on filter changes).
 */
function stopJamVideoPlayer(
  player: VideoPlayer,
  options?: {
    clearSource?: boolean;
  },
) {
  try {
    player.pause();
  } catch {
    /* already gone */
  }
  try {
    player.muted = true;
    player.volume = 0;
    player.staysActiveInBackground = false;
  } catch {
    /* already gone */
  }
  if (options?.clearSource) {
    void player.replaceAsync(null).catch(() => {
      /* already gone / replace unsupported mid-teardown */
    });
  }
}

export function JamVideoView({
  source,
  style,
  contentFit = "contain",
  knownWidth = null,
  knownHeight = null,
  shouldPlay,
  isLooping = false,
  isMuted = false,
  volume = 1,
  playbackRate = 1,
  nativeControls = false,
  trimStartRatio,
  trimEndRatio,
  scrubToRatio,
  trimPlaybackResumeSignal = 0,
  resumePositionSec = null,
  timeUpdateIntervalSec = 0.25,
  adoptPrewarmed = false,
  whenPaused = "pause",
  posterUri = null,
  surfaceColor = PROFILE_VIDEO_OPEN_GREY,
  onDurationResolved,
  onPlaybackStatusUpdate,
  onFirstFrameRender,
  onContentFitChange,
  onResumePositionApplied,
}: {
  source: string | null;
  style: StyleProp<ViewStyle>;
  contentFit?: VideoContentFit;
  /** Optional early size hint (picker / probe) so landscape letterboxes before tracks load. */
  knownWidth?: number | null;
  knownHeight?: number | null;
  shouldPlay: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  playbackRate?: number;
  nativeControls?: boolean;
  trimStartRatio?: number;
  trimEndRatio?: number;
  scrubToRatio?: number | null;
  trimPlaybackResumeSignal?: number;
  /**
   * One-shot seek used when restoring a discover filter session.
   * Applied on readyToPlay, then cleared via onResumePositionApplied.
   */
  resumePositionSec?: number | null;
  timeUpdateIntervalSec?: number;
  /** Reuse a grid-prewarmed player so the first frame can paint immediately. */
  adoptPrewarmed?: boolean;
  /**
   * `restart` — swipe away, park at 0 under a still.
   * `hold` — profile/tab leave: pause in place (no solid cover); resume without waiting for first-frame.
   * `pause` — tap-pause, keep the live frame (a still flashes black).
   */
  whenPaused?: "restart" | "hold" | "pause";
  /** Fallback still when Cloudflare freeze frames are not available. */
  posterUri?: string | null;
  surfaceColor?: string;
  onDurationResolved?: (durationMs: number) => void;
  onPlaybackStatusUpdate?: (status: JamVideoPlaybackStatus) => void;
  onFirstFrameRender?: () => void;
  onContentFitChange?: (fit: VideoContentFit) => void;
  onResumePositionApplied?: () => void;
}) {
  const videoSource = useMemo<VideoSource>(() => getExpoVideoSource(source), [source]);
  const aspectCacheKey = getVideoAspectCacheKeyFromSource(source);
  const rememberedSize = getRememberedVideoAspectSize(aspectCacheKey);
  const seedSize = parsePositiveDisplaySize(
    knownWidth ?? rememberedSize?.width,
    knownHeight ?? rememberedSize?.height,
  );
  const seedWidth = seedSize?.width ?? null;
  const seedHeight = seedSize?.height ?? null;
  const onPlaybackStatusUpdateRef = useRef(onPlaybackStatusUpdate);
  const onDurationResolvedRef = useRef(onDurationResolved);
  const onFirstFrameRenderRef = useRef(onFirstFrameRender);
  const onContentFitChangeRef = useRef(onContentFitChange);
  const [resolvedContentFit, setResolvedContentFit] = useState<VideoContentFit>(() =>
    contentFitForVideoSize(seedWidth, seedHeight, contentFit),
  );
  const [resolvedVideoSize, setResolvedVideoSize] = useState<{ width: number; height: number } | null>(
    () => seedSize,
  );
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  /** Rotation-applied frame size. iOS screen recordings are often portrait-coded. */
  const displayOrientedSizeRef = useRef<{ width: number; height: number } | null>(seedSize);
  const displayProbeSettledRef = useRef(Boolean(seedSize));
  const trimStartRatioRef = useRef(trimStartRatio ?? 0);
  const trimEndRatioRef = useRef(trimEndRatio ?? 1);
  const scrubToRatioRef = useRef<number | null>(scrubToRatio ?? null);
  /** Seek still needs to be issued for this restore. */
  const resumeSeekPendingRef = useRef(
    resumePositionSec != null && resumePositionSec > 0.05,
  );
  /** Keep the mid-clip cover until currentTime is near this (HLS scrub is async). */
  const resumeGateSecRef = useRef<number | null>(
    resumePositionSec != null && resumePositionSec > 0.05 ? resumePositionSec : null,
  );
  const resumeConfirmRafRef = useRef<number | null>(null);
  const onResumePositionAppliedRef = useRef(onResumePositionApplied);
  const shouldPlayRef = useRef(shouldPlay);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  /** True once VideoView has painted — safe to unmute. Playback still starts at t=0. */
  const surfaceReadyRef = useRef(false);
  const mountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const freezePositionRef = useRef<number | null>(null);
  /** Last in-place pause time so tab return / tap-unpause can restore if native currentTime dropped. */
  const heldPauseSecRef = useRef<number | null>(null);
  /** Soft hold (profile/tab): paused AVPlayerLayer stays visible; no solid-colour cover. */
  const softHoldActiveRef = useRef(false);
  /** Soft-hold overlay is covering VideoView (hold + return until fade-clear). */
  const holdOverlayActiveRef = useRef(false);
  const holdThumbGenRef = useRef(0);
  const freezeCaptureIdRef = useRef(0);
  const wasScrubbingRef = useRef(false);
  const durationReportedRef = useRef(false);
  const whenPausedRef = useRef(whenPaused);
  const posterUriRef = useRef(posterUri);
  const [freezeFrameUri, setFreezeFrameUri] = useState<string | null>(() =>
    pickStillUri(source, posterUri, 0),
  );
  const [coverPosterFailed, setCoverPosterFailed] = useState(false);
  const [coverFreezeFailed, setCoverFreezeFailed] = useState(false);
  const [coverHeld, setCoverHeld] = useState(true);
  /** Soft-hold safety still — overlay above VideoView (never a bare colour). */
  const [holdFreezeSource, setHoldFreezeSource] = useState<string | VideoThumbnail | null>(null);
  const [holdOverlayOpacity] = useState(() => new Animated.Value(1));
  const holdFadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const loadedStillUrisRef = useRef(new Set<string>());
  const lastLoadedStillUriRef = useRef<string | null>(null);
  /** Soft-hold overlay fades once playback passes this time (heldSec + 0.15). */
  const holdOverlayClearAfterSecRef = useRef<number | null>(null);
  /** Set on soft-hold return; used for progress/failsafe clear (never time-alone). */
  const holdReturnPendingClearRef = useRef(false);
  const holdReturnAtMsRef = useRef<number | null>(null);
  const holdReturnHeldSecRef = useRef<number | null>(null);
  const holdReturnFirstFrameSeenRef = useRef(false);
  const holdReturnLoggedRef = useRef(false);
  const firstFrameCountBySourceRef = useRef(0);
  const holdShowingStillRef = useRef<{ kind: HoldStillKind; loaded: boolean }>({
    kind: "none",
    loaded: false,
  });
  const stillAdoptGenRef = useRef(0);
  const firstFrameNotifiedRef = useRef(false);
  /** VideoView has painted at least one frame into this surface. */
  const hasPaintedFrameRef = useRef(false);
  /**
   * This player already decoded a frame for the current source.
   * Survives pause / restart / hold — reset only when source or player changes.
   */
  const hasDecodedFrameRef = useRef(false);
  /** Native first-frame arrived while we were not allowed to drop the cover yet. */
  const paintedFramePendingRevealRef = useRef(false);
  const playbackStatusRef = useRef<JamVideoPlaybackStatus>({
    isLoaded: false,
    isBuffering: Boolean(source),
    isPlaying: false,
    positionMillis: 0,
    status: "idle",
  });
  // Adopt a grid-prewarmed player once on mount (pair with key={video.id} at call site).
  // Configure immediately so unmute/volume are applied before any play attempt.
  const [prewarmedPlayer] = useState<VideoPlayer | null>(() => {
    if (!adoptPrewarmed || !source) return null;
    const adopted = adoptPrewarmedProfileVideoPlayer(source);
    if (!adopted) return null;
    try {
      configureJamVideoPlayer(adopted, {
        isLooping,
        isMuted,
        volume,
        timeUpdateIntervalSec,
      });
      // Prewarm players already buffer from 0. Seeking here blanks the
      // VideoView and flashes black under the open still.
      if (adopted.currentTime > 0.05) {
        adopted.currentTime = 0;
      }
    } catch {
      /* native configure can fail if the entry was already torn down */
    }
    return adopted;
  });
  const hookPlayer = useVideoPlayer(prewarmedPlayer ? null : videoSource, (nextPlayer) => {
    configureJamVideoPlayer(nextPlayer, {
      isLooping,
      isMuted,
      volume,
      timeUpdateIntervalSec,
    });
  });
  const player = prewarmedPlayer ?? hookPlayer;

  // Configure adopted players when mute/volume/loop change — never release here.
  // Release belongs only in the unmount effect below; releasing on prop changes
  // left JS holding a dead shared object (NativeSharedObjectNotFoundException on set/pause).
  useEffect(() => {
    if (!prewarmedPlayer) return;
    try {
      configureJamVideoPlayer(prewarmedPlayer, {
        isLooping,
        isMuted,
        volume,
        timeUpdateIntervalSec,
        surfaceReady: surfaceReadyRef.current,
      });
    } catch {
      /* native object already gone */
    }
  }, [isLooping, isMuted, prewarmedPlayer, timeUpdateIntervalSec, volume]);

  // Hard-stop on unmount so audio cannot continue after navigating away /
  // filter-driven FlatList remounts. Clear shouldPlay first so in-flight
  // statusChange handlers cannot call play() on a dying player.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      shouldPlayRef.current = false;
      holdFadeAnimRef.current?.stop();
      holdFadeAnimRef.current = null;
      holdOverlayClearAfterSecRef.current = null;
      holdReturnPendingClearRef.current = false;
      holdReturnAtMsRef.current = null;
      holdReturnHeldSecRef.current = null;
      holdReturnFirstFrameSeenRef.current = false;
      holdReturnLoggedRef.current = false;
      holdOverlayActiveRef.current = false;
      stopJamVideoPlayer(player, { clearSource: true });
      if (prewarmedPlayer) {
        try {
          prewarmedPlayer.release();
        } catch {
          /* already released */
        }
      }
    };
  }, [player, prewarmedPlayer]);

  const hasTrim =
    (trimStartRatio ?? 0) > 0.001 || (trimEndRatio ?? 1) < 0.999;

  const markStillLoaded = useCallback((uri: string) => {
    loadedStillUrisRef.current.add(uri);
    lastLoadedStillUriRef.current = uri;
  }, []);

  const adoptStillUri = useCallback((uri: string | null, immediate: boolean) => {
    if (!uri) return;
    if (immediate || loadedStillUrisRef.current.has(uri)) {
      setFreezeFrameUri(uri);
      return;
    }
    // Mid-clip still: only paint once loaded. Never flash the t=0 poster
    // as a placeholder over a hold that is not at the start.
    if (uri === posterUriRef.current) return;
    const adoptGen = stillAdoptGenRef.current + 1;
    stillAdoptGenRef.current = adoptGen;
    void prefetchGridImage(uri)
      .then((ok) => {
        if (!ok || stillAdoptGenRef.current !== adoptGen) return;
        loadedStillUrisRef.current.add(uri);
        lastLoadedStillUriRef.current = uri;
        setCoverFreezeFailed(false);
        setFreezeFrameUri(uri);
      })
      .catch(() => undefined);
  }, []);

  const showStill = useCallback(
    (timeSec = 0) => {
      const uri = pickStillUri(source, posterUriRef.current, timeSec);
      adoptStillUri(uri, timeSec <= 0.2);
    },
    [adoptStillUri, source],
  );

  const clearHoldOverlayImmediate = useCallback(() => {
    holdFadeAnimRef.current?.stop();
    holdFadeAnimRef.current = null;
    holdOverlayClearAfterSecRef.current = null;
    holdReturnPendingClearRef.current = false;
    holdReturnAtMsRef.current = null;
    holdReturnHeldSecRef.current = null;
    holdReturnFirstFrameSeenRef.current = false;
    holdReturnLoggedRef.current = false;
    holdOverlayActiveRef.current = false;
    softHoldActiveRef.current = false;
    holdOverlayOpacity.setValue(1);
    setHoldFreezeSource(null);
    holdShowingStillRef.current = { kind: "none", loaded: false };
  }, [holdOverlayOpacity]);

  const fadeClearHoldOverlay = useCallback(
    (reason: string) => {
      if (!holdOverlayActiveRef.current) return;
      holdOverlayActiveRef.current = false;
      softHoldActiveRef.current = false;
      holdOverlayClearAfterSecRef.current = null;
      holdReturnPendingClearRef.current = false;
      let currentTime = 0;
      try {
        currentTime = player.currentTime;
      } catch {
        currentTime = 0;
      }
      const msSinceReturn =
        holdReturnAtMsRef.current != null
          ? Date.now() - holdReturnAtMsRef.current
          : null;
      logFeedHold({
        phase: "overlay-clear",
        id: feedHoldLogId(source),
        reason,
        currentTime,
        msSinceReturn,
      });
      holdReturnAtMsRef.current = null;
      holdReturnHeldSecRef.current = null;
      holdReturnFirstFrameSeenRef.current = false;
      holdReturnLoggedRef.current = false;
      holdFadeAnimRef.current?.stop();
      holdFadeAnimRef.current = Animated.timing(holdOverlayOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      });
      holdFadeAnimRef.current.start(({ finished }) => {
        holdFadeAnimRef.current = null;
        if (!finished || !mountedRef.current) return;
        setHoldFreezeSource(null);
        holdOverlayOpacity.setValue(1);
        holdShowingStillRef.current = { kind: "none", loaded: false };
      });
    },
    [holdOverlayOpacity, player, source],
  );

  const clearSoftHoldFreeze = useCallback(() => {
    holdThumbGenRef.current += 1;
    softHoldActiveRef.current = false;
    clearHoldOverlayImmediate();
  }, [clearHoldOverlayImmediate]);

  /**
   * Soft-hold overlay still (above VideoView). Prefetch mid-clip when heldSec > 0.2;
   * until it lands show loaded poster or last-loaded still. Never bare colour.
   */
  const captureHoldSafetyStill = useCallback(
    (timeSec: number) => {
      const gen = holdThumbGenRef.current + 1;
      holdThumbGenRef.current = gen;
      const startedAt = Date.now();
      const holdId = feedHoldLogId(source);
      const heldSec = Math.max(0, timeSec);
      const midClipUri =
        heldSec > 0.2 && source
          ? getCloudflareFreezeFrameUri(source, heldSec)
          : null;
      const isHls = Boolean(source?.includes(".m3u8"));
      const poster = posterUriRef.current;
      const last = lastLoadedStillUriRef.current;
      const loaded = loadedStillUrisRef.current;

      holdFadeAnimRef.current?.stop();
      holdFadeAnimRef.current = null;
      holdOverlayOpacity.setValue(1);
      holdOverlayActiveRef.current = true;
      holdOverlayClearAfterSecRef.current = null;
      holdReturnPendingClearRef.current = false;
      holdReturnAtMsRef.current = null;
      holdReturnHeldSecRef.current = null;
      holdReturnFirstFrameSeenRef.current = false;
      holdReturnLoggedRef.current = false;

      let initial: string | null = null;
      if (midClipUri && loaded.has(midClipUri)) {
        initial = midClipUri;
      } else if (poster && loaded.has(poster)) {
        initial = poster;
      } else if (last) {
        initial = last;
      } else if (poster) {
        initial = poster;
      } else if (lastLoadedStillUriRef.current) {
        initial = lastLoadedStillUriRef.current;
      }

      setHoldFreezeSource((prev) => {
        if (initial) return initial;
        if (prev) return prev;
        // Never null / bare colour — keep whatever we already have.
        return prev ?? poster ?? last ?? null;
      });

      const showing = describeHoldStill(
        initial,
        midClipUri,
        poster,
        last,
        loaded,
      );
      holdShowingStillRef.current = showing;
      let status: VideoPlayerStatus = "idle";
      try {
        status = player.status;
      } catch {
        status = "idle";
      }
      logFeedHold({
        phase: "hold",
        id: holdId,
        status,
        heldSec,
        still: showing.kind,
        stillLoaded: showing.loaded,
      });

      if (midClipUri && heldSec > 0.2) {
        void prefetchGridImage(midClipUri)
          .then((ok) => {
            logFeedHold({
              phase: "midclip-prefetch",
              id: holdId,
              ms: Date.now() - startedAt,
              ok,
            });
            if (!ok || holdThumbGenRef.current !== gen) return;
            loadedStillUrisRef.current.add(midClipUri);
            lastLoadedStillUriRef.current = midClipUri;
            // Prefer a local generateThumbnailsAsync result if it already landed.
            setHoldFreezeSource((prev) =>
              prev != null && typeof prev !== "string" ? prev : midClipUri,
            );
            holdShowingStillRef.current = { kind: "midclip", loaded: true };
          })
          .catch(() => {
            logFeedHold({
              phase: "midclip-prefetch",
              id: holdId,
              ms: Date.now() - startedAt,
              ok: false,
            });
          });
      }

      // AVAssetImageGenerator cannot grab HLS frames — local/file sources only.
      if (isHls || !source) return;

      void player
        .generateThumbnailsAsync([heldSec])
        .then((thumbs) => {
          if (holdThumbGenRef.current !== gen) return;
          const thumb = thumbs[0];
          if (!thumb) return;
          setCoverFreezeFailed(false);
          setHoldFreezeSource(thumb);
          holdShowingStillRef.current = { kind: "midclip", loaded: true };
        })
        .catch(() => undefined);
    },
    [holdOverlayOpacity, player, source],
  );

  /**
   * Pause / cover the surface.
   * `hold` — feed profile / tab blur: pause in place, no solid cover (AVPlayerLayer keeps the frame).
   * `background` — AppState: hard cover then stop (may blank without a still).
   * `restart` / `pause` — unchanged.
   */
  const coverAndStop = useCallback(
    (timeSec: number, mode: "restart" | "hold" | "pause" | "background") => {
      if (mode === "pause") {
        // Returning from soft hold while still user-paused: keep the overlay
        // until onFirstFrameRender after return, or until they resume.
        if (!softHoldActiveRef.current && !holdOverlayActiveRef.current) {
          clearSoftHoldFreeze();
        } else {
          holdReturnPendingClearRef.current = true;
          holdReturnAtMsRef.current = Date.now();
          holdReturnHeldSecRef.current = Math.max(0, timeSec);
          holdReturnFirstFrameSeenRef.current = false;
        }
        if (timeSec > 0.2) heldPauseSecRef.current = timeSec;
        if (!hasDecodedFrameRef.current) showStill(timeSec);
        else if (timeSec > 0.2) {
          const midClip = pickStillUri(source, posterUriRef.current, timeSec);
          if (midClip) {
            void prefetchGridImage(midClip)
              .then((ok) => {
                if (ok) loadedStillUrisRef.current.add(midClip);
              })
              .catch(() => undefined);
          }
        }
        applyVisibleAudio(player, true, 0, surfaceReadyRef.current);
        stopJamVideoPlayer(player);
        return;
      }

      if (mode === "hold") {
        // Soft hold: keep decoded/painted/surface flags — resume must not wait for first-frame.
        heldPauseSecRef.current = Math.max(0, timeSec);
        softHoldActiveRef.current = true;
        applyVisibleAudio(player, true, 0, surfaceReadyRef.current);
        try {
          player.pause();
        } catch {
          /* native object already gone */
        }
        captureHoldSafetyStill(timeSec);
        return;
      }

      clearSoftHoldFreeze();
      if (mode === "restart") {
        heldPauseSecRef.current = null;
        showStill(0);
        parkJamVideoPlayerAtStart(player);
      } else {
        // AppState background — hard cover under a still.
        if (timeSec > 0.2) heldPauseSecRef.current = timeSec;
        showStill(timeSec);
      }
      firstFrameNotifiedRef.current = false;
      hasPaintedFrameRef.current = false;
      surfaceReadyRef.current = false;
      paintedFramePendingRevealRef.current = true;
      setCoverHeld(true);
      applyVisibleAudio(player, true, 0, false);
      stopJamVideoPlayer(player);
    },
    [captureHoldSafetyStill, clearSoftHoldFreeze, player, showStill, source],
  );

  /**
   * Same tick: unmute, play, drop the still, tell the feed to drop its cover.
   * Never play while muted or covered.
   * Soft-hold resume keeps the on-screen paused frame — no new onFirstFrameRender wait.
   */
  const beginVisiblePlayback = useCallback(() => {
    if (!shouldPlayRef.current) return false;
    if (appStateRef.current !== "active") return false;
    if (!mountedRef.current) return false;
    if (resumeGateSecRef.current != null || resumeSeekPendingRef.current) return false;
    const softHoldResume = softHoldActiveRef.current;
    if (!hasDecodedFrameRef.current && !softHoldResume) return false;
    if (player.status !== "readyToPlay") return false;

    stillAdoptGenRef.current += 1;
    holdThumbGenRef.current += 1;
    const heldSec = heldPauseSecRef.current;
    if (softHoldResume && heldSec != null && heldSec > 0.05) {
      try {
        if (Math.abs(player.currentTime - heldSec) > 0.05) {
          player.currentTime = heldSec;
        }
      } catch {
        /* native object already gone */
      }
    } else {
      restoreJamVideoPosition(player, heldSec);
    }
    paintedFramePendingRevealRef.current = false;
    hasDecodedFrameRef.current = true;
    hasPaintedFrameRef.current = true;
    surfaceReadyRef.current = true;
    softHoldActiveRef.current = false;
    applyVisibleAudio(player, isMutedRef.current, volumeRef.current, true);
    playJamVideoPlayerWhenReady(player);
    setCoverHeld(false);
    setFreezeFrameUri(null);
    // Soft-hold overlay stays above VideoView until playing past heldSec + 0.15
    // (progress listener) or the first-frame failsafe after return.
    if (softHoldResume && holdOverlayActiveRef.current) {
      holdOverlayClearAfterSecRef.current = (heldSec ?? 0) + 0.15;
      holdReturnPendingClearRef.current = true;
      if (holdReturnAtMsRef.current == null) {
        holdReturnAtMsRef.current = Date.now();
      }
      holdReturnHeldSecRef.current = heldSec ?? 0;
      if (!holdReturnLoggedRef.current) {
        holdReturnLoggedRef.current = true;
        let currentTime = 0;
        let playing = false;
        let status: VideoPlayerStatus = "idle";
        try {
          currentTime = player.currentTime;
          playing = player.playing;
          status = player.status;
        } catch {
          /* native object already gone */
        }
        logFeedHold({
          phase: "return",
          id: feedHoldLogId(source),
          status,
          playing,
          currentTime,
          still: holdShowingStillRef.current.kind,
          stillLoaded: holdShowingStillRef.current.loaded,
          heldSec,
        });
      }
    }
    if (!firstFrameNotifiedRef.current) {
      firstFrameNotifiedRef.current = true;
      onFirstFrameRenderRef.current?.();
    }
    return true;
  }, [player, source]);

  const handleViewFirstFrame = useCallback(() => {
    hasDecodedFrameRef.current = true;
    hasPaintedFrameRef.current = true;
    paintedFramePendingRevealRef.current = true;
    firstFrameCountBySourceRef.current += 1;
    const count = firstFrameCountBySourceRef.current;
    let playing = false;
    let currentTime = 0;
    try {
      playing = player.playing;
      currentTime = player.currentTime;
    } catch {
      /* native object already gone */
    }
    logFeedHold({
      phase: "onFirstFrameRender",
      id: feedHoldLogId(source),
      count,
      playing,
      currentTime,
      softHold: softHoldActiveRef.current,
      overlay: holdOverlayActiveRef.current,
    });

    // Soft-hold return while user stayed paused: clear on first paint after return.
    if (
      holdReturnPendingClearRef.current &&
      !shouldPlayRef.current &&
      holdOverlayActiveRef.current
    ) {
      holdReturnFirstFrameSeenRef.current = true;
      fadeClearHoldOverlay("paused-return-first-frame");
      return;
    }

    // Failsafe: never on time alone — need first frame after return + playing + time advanced.
    if (holdReturnPendingClearRef.current && holdOverlayActiveRef.current) {
      holdReturnFirstFrameSeenRef.current = true;
      const heldSec = holdReturnHeldSecRef.current ?? 0;
      if (playing && currentTime > heldSec) {
        fadeClearHoldOverlay("failsafe-first-frame");
        return;
      }
    }

    beginVisiblePlayback();
  }, [beginVisiblePlayback, fadeClearHoldOverlay, player, source]);

  useEffect(() => {
    hasDecodedFrameRef.current = false;
  }, [player, source]);

  useEffect(() => {
    firstFrameNotifiedRef.current = false;
    hasPaintedFrameRef.current = false;
    paintedFramePendingRevealRef.current = false;
    surfaceReadyRef.current = false;
    softHoldActiveRef.current = false;
    holdThumbGenRef.current += 1;
    firstFrameCountBySourceRef.current = 0;
    clearHoldOverlayImmediate();
    setCoverPosterFailed(false);
    setCoverFreezeFailed(false);
    setCoverHeld(true);
    applyVisibleAudio(player, true, 0, false);
    showStill(resumePositionSec != null && resumePositionSec > 0.05 ? resumePositionSec : 0);
  }, [clearHoldOverlayImmediate, player, resumePositionSec, showStill, source]);

  const captureFreezeFrame = useCallback(
    (atTimeSec: number) => {
      if (!source) return;
      const captureId = freezeCaptureIdRef.current + 1;
      freezeCaptureIdRef.current = captureId;

      const cloudflareUri = getCloudflareFreezeFrameUri(source, atTimeSec);
      if (cloudflareUri) {
        adoptStillUri(cloudflareUri, atTimeSec <= 0.2);
        return;
      }

      if (
        source.startsWith("file://") ||
        source.startsWith("content://") ||
        source.startsWith("ph://") ||
        source.startsWith("assets-library://")
      ) {
        void getThumbnailAsync(source, {
          time: Math.max(0, Math.round(atTimeSec * 1000)),
          quality: 0.72,
        })
          .then((thumbnail) => {
            if (freezeCaptureIdRef.current !== captureId) return;
            setFreezeFrameUri(thumbnail.uri);
          })
          .catch(() => undefined);
      }
    },
    [adoptStillUri, source],
  );

  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  useEffect(() => {
    whenPausedRef.current = whenPaused;
    posterUriRef.current = posterUri;
    if (posterUri) {
      loadedStillUrisRef.current.add(posterUri);
      lastLoadedStillUriRef.current = posterUri;
    }
  }, [posterUri, whenPaused]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
    applyVisibleAudio(player, isMuted, volume, surfaceReadyRef.current);
  }, [isMuted, player, volume]);

  useEffect(() => {
    onResumePositionAppliedRef.current = onResumePositionApplied;
  }, [onResumePositionApplied]);

  const clearResumeConfirmLoop = useCallback(() => {
    if (resumeConfirmRafRef.current != null) {
      cancelAnimationFrame(resumeConfirmRafRef.current);
      resumeConfirmRafRef.current = null;
    }
  }, []);

  /** After seek: wait until currentTime is near the restore point, then play. Cover stays until a painted frame. */
  const confirmResumeAndPlay = useCallback(() => {
    clearResumeConfirmLoop();
    const target = resumeGateSecRef.current;
    if (target == null) {
      beginVisiblePlayback();
      return;
    }

    const startedAt = Date.now();
    const tick = () => {
      if (!mountedRef.current) return;
      let current = 0;
      try {
        current = player.currentTime;
      } catch {
        current = 0;
      }
      const closeEnough = Math.abs(current - target) <= 0.45;
      const timedOut = Date.now() - startedAt > 900;
      if (!closeEnough && !timedOut) {
        resumeConfirmRafRef.current = requestAnimationFrame(tick);
        return;
      }
      resumeConfirmRafRef.current = null;
      resumeGateSecRef.current = null;
      onResumePositionAppliedRef.current?.();
      beginVisiblePlayback();
    };
    resumeConfirmRafRef.current = requestAnimationFrame(tick);
  }, [beginVisiblePlayback, clearResumeConfirmLoop, player]);

  /** Seek while paused — never play until confirmResumeAndPlay says the frame is ready. */
  const applyResumePosition = useCallback(() => {
    if (!resumeSeekPendingRef.current) return false;
    const resumeSec = resumeGateSecRef.current;
    if (resumeSec == null || resumeSec <= 0.05) return false;
    if (!(player.duration > 0)) return false;
    const target = Math.min(resumeSec, Math.max(0, player.duration - 0.05));
    try {
      player.pause();
      player.currentTime = target;
    } catch {
      return false;
    }
    resumeSeekPendingRef.current = false;
    resumeGateSecRef.current = target;
    confirmResumeAndPlay();
    return true;
  }, [confirmResumeAndPlay, player]);

  useEffect(() => {
    if (resumePositionSec == null || resumePositionSec <= 0.05) return;
    resumeSeekPendingRef.current = true;
    resumeGateSecRef.current = resumePositionSec;
    // Keep / refresh the mid-clip cover for the whole seek window.
    captureFreezeFrame(resumePositionSec);
    if (player.status !== "readyToPlay") return;
    applyResumePosition();
  }, [applyResumePosition, captureFreezeFrame, player, resumePositionSec]);

  useEffect(() => {
    freezeCaptureIdRef.current += 1;
    freezePositionRef.current = null;
    heldPauseSecRef.current = null;
    clearSoftHoldFreeze();
    clearResumeConfirmLoop();
    if (resumePositionSec != null && resumePositionSec > 0.05) {
      resumeSeekPendingRef.current = true;
      resumeGateSecRef.current = resumePositionSec;
      captureFreezeFrame(resumePositionSec);
    } else {
      resumeSeekPendingRef.current = false;
      resumeGateSecRef.current = null;
      showStill(0);
    }
    // Only reset covers when the source identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume handled above
  }, [captureFreezeFrame, clearResumeConfirmLoop, clearSoftHoldFreeze, showStill, source]);

  useEffect(() => {
    return () => clearResumeConfirmLoop();
  }, [clearResumeConfirmLoop]);

  useEffect(() => {
    onContentFitChangeRef.current = onContentFitChange;
  }, [onContentFitChange]);

  useLayoutEffect(() => {
    const display = displayOrientedSizeRef.current;
    if (display) {
      const nextFit = contentFitForVideoSize(display.width, display.height, contentFit);
      setResolvedContentFit(nextFit);
      setResolvedVideoSize(display);
      return;
    }
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    const size = parsePositiveDisplaySize(
      knownWidth ?? cached?.width,
      knownHeight ?? cached?.height,
    );
    if (!size) return;
    const nextFit = contentFitForVideoSize(size.width, size.height, contentFit);
    setResolvedContentFit(nextFit);
    setResolvedVideoSize(size);
  }, [aspectCacheKey, contentFit, knownHeight, knownWidth, source]);

  useEffect(() => {
    onContentFitChangeRef.current?.(resolvedContentFit);
  }, [resolvedContentFit]);

  const applyVideoTrackSize = useCallback(
    (width?: number | null, height?: number | null) => {
      if (!(typeof width === "number" && typeof height === "number" && width > 0 && height > 0)) {
        return;
      }
      rememberVideoAspectSize(aspectCacheKey, width, height);
      const nextFit = contentFitForVideoSize(width, height, contentFit);
      setResolvedVideoSize((current) =>
        current?.width === width && current?.height === height ? current : { width, height },
      );
      // Never call parent setState inside this updater — that updates
      // ProfileFullscreenFeedItem while JamVideoView is rendering.
      setResolvedContentFit((current) => (current === nextFit ? current : nextFit));
    },
    [aspectCacheKey, contentFit],
  );

  const applyBestTrackSize = useCallback(
    (tracks?: Array<{ size?: { width?: number; height?: number } | null } | null> | null) => {
      const display = displayOrientedSizeRef.current;
      if (display) {
        applyVideoTrackSize(display.width, display.height);
        return;
      }

      const sizes = (tracks ?? [])
        .map((track) => track?.size)
        .filter(
          (size): size is { width: number; height: number } =>
            typeof size?.width === "number" &&
            typeof size?.height === "number" &&
            size.width > 0 &&
            size.height > 0,
        );
      const largest = sizes.length
        ? sizes.reduce((best, size) =>
            size.width * size.height > best.width * best.height ? size : best,
          )
        : null;

      // Wait for the display-size probe before treating a tall coded size as 9:16
      // cover — landscape screen recordings are stored as portrait + rotation.
      if (!displayProbeSettledRef.current) {
        if (largest && largest.width > largest.height && !isPortraitFillVideoSize(seedWidth, seedHeight)) {
          applyVideoTrackSize(largest.width, largest.height);
        }
        return;
      }

      // Oriented 9:16 camera size wins over coded track size. iOS often reports
      // landscape natural size for portrait phone recordings (rotation metadata).
      if (isPortraitFillVideoSize(seedWidth, seedHeight)) {
        applyVideoTrackSize(seedWidth, seedHeight);
        return;
      }

      if (!largest) {
        if (
          typeof seedWidth === "number" &&
          typeof seedHeight === "number" &&
          seedWidth > 0 &&
          seedHeight > 0
        ) {
          applyVideoTrackSize(seedWidth, seedHeight);
        }
        return;
      }
      if (largest.width > largest.height) {
        applyVideoTrackSize(largest.width, largest.height);
        return;
      }
      const cached = getRememberedVideoAspectSize(aspectCacheKey);
      if (cached && isPortraitFillVideoSize(cached.width, cached.height)) {
        applyVideoTrackSize(cached.width, cached.height);
        return;
      }
      applyVideoTrackSize(largest.width, largest.height);
    },
    [applyVideoTrackSize, aspectCacheKey, seedHeight, seedWidth],
  );

  useEffect(() => {
    applyBestTrackSize([player.videoTrack, ...(player.availableVideoTracks ?? [])]);
  }, [applyBestTrackSize, player, source]);

  // Display size (preferredTransform / CF native thumb) beats coded HLS.
  // Landscape iPhone screen recordings are stored as tall buffers + 90° rotation.
  // DB / cache size is authoritative — don't wait, and don't probe unless missing.
  useEffect(() => {
    const known = parsePositiveDisplaySize(
      knownWidth ?? getRememberedVideoAspectSize(aspectCacheKey)?.width,
      knownHeight ?? getRememberedVideoAspectSize(aspectCacheKey)?.height,
    );
    if (known) {
      displayOrientedSizeRef.current = known;
      displayProbeSettledRef.current = true;
      applyVideoTrackSize(known.width, known.height);
      return;
    }
    displayOrientedSizeRef.current = null;
    displayProbeSettledRef.current = false;
    if (!source) {
      displayProbeSettledRef.current = true;
      return;
    }
    let cancelled = false;
    void probeVideoDisplaySize(source).then((size) => {
      if (cancelled) return;
      displayProbeSettledRef.current = true;
      if (!size) return;
      const previous = displayOrientedSizeRef.current;
      const previousFit = contentFitForVideoSize(previous?.width, previous?.height, contentFit);
      const nextFit = contentFitForVideoSize(size.width, size.height, contentFit);
      displayOrientedSizeRef.current = size;
      if (!previous || previousFit !== nextFit) {
        applyVideoTrackSize(size.width, size.height);
        return;
      }
      rememberVideoAspectSize(aspectCacheKey, size.width, size.height);
    });
    return () => {
      cancelled = true;
    };
  }, [applyVideoTrackSize, aspectCacheKey, contentFit, knownHeight, knownWidth, source]);

  // HLS often omits usable track sizes until late (or never). Probe the master
  // playlist RESOLUTION tags so landscape letterboxes instead of cover-zooming.
  useEffect(() => {
    if (!source || !source.includes(".m3u8")) return;
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    if (cached && cached.width > cached.height) {
      applyVideoTrackSize(cached.width, cached.height);
    }
    let cancelled = false;
    void probeHlsVideoSize(source).then((size) => {
      if (cancelled || !size) return;
      const display = displayOrientedSizeRef.current;
      if (display) {
        applyVideoTrackSize(display.width, display.height);
        return;
      }
      // Landscape HLS is authoritative — even if a portrait thumb canvas was cached.
      if (size.width > size.height) {
        applyVideoTrackSize(size.width, size.height);
        return;
      }
      // Portrait HLS may be a rotated screen recording. Wait for display probe
      // unless we already know this is a 9:16 camera clip.
      if (isPortraitFillVideoSize(seedWidth, seedHeight) && size.width <= size.height) {
        applyVideoTrackSize(seedWidth, seedHeight);
        return;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyVideoTrackSize, aspectCacheKey, seedHeight, seedWidth, source]);

  useEffect(() => {
    player.timeUpdateEventInterval = timeUpdateIntervalSec;
  }, [player, timeUpdateIntervalSec]);

  useEffect(() => {
    trimStartRatioRef.current = trimStartRatio ?? 0;
    trimEndRatioRef.current = trimEndRatio ?? 1;
  }, [trimEndRatio, trimStartRatio]);

  useEffect(() => {
    scrubToRatioRef.current = scrubToRatio ?? null;
  }, [scrubToRatio]);

  useEffect(() => {
    if (scrubToRatio == null) {
      if (wasScrubbingRef.current && player.duration > 0) {
        wasScrubbingRef.current = false;
        player.currentTime = trimStartRatioRef.current * player.duration;
        if (shouldPlay) {
          playJamVideoPlayerWhenReady(player);
        }
      }
      return;
    }

    wasScrubbingRef.current = true;
    if (player.duration > 0) {
      player.pause();
      player.currentTime = clamp(scrubToRatio, 0, 1) * player.duration;
    }
  }, [player, scrubToRatio, shouldPlay, source]);

  useEffect(() => {
    if (!trimPlaybackResumeSignal || player.duration <= 0) return;

    scrubToRatioRef.current = null;
    wasScrubbingRef.current = false;
    const startSec = trimStartRatioRef.current * player.duration;
    player.currentTime = startSec;
    if (shouldPlay) {
      playJamVideoPlayerWhenReady(player);
    }
  }, [player, shouldPlay, trimPlaybackResumeSignal]);

  useEffect(() => {
    onDurationResolvedRef.current = onDurationResolved;
  }, [onDurationResolved]);

  useEffect(() => {
    onFirstFrameRenderRef.current = onFirstFrameRender;
  }, [onFirstFrameRender]);

  useEffect(() => {
    player.loop = isLooping && !hasTrim;
    applyVisibleAudio(player, isMuted, volume, surfaceReadyRef.current);
  }, [hasTrim, isLooping, isMuted, player, volume]);

  useEffect(() => {
    const nextRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    if (player.playbackRate === nextRate) return;
    player.playbackRate = nextRate;
  }, [playbackRate, player]);

  useEffect(() => {
    onPlaybackStatusUpdateRef.current = onPlaybackStatusUpdate;
  }, [onPlaybackStatusUpdate]);

  useEffect(() => {
    if (scrubToRatio != null) return;
    if (!source || player.duration <= 0) return;

    const startSec = trimStartRatioRef.current * player.duration;
    const endSec = trimEndRatioRef.current * player.duration;
    if (endSec <= startSec) return;

    if (player.currentTime < startSec || player.currentTime >= endSec) {
      player.currentTime = startSec;
    }
  }, [player, scrubToRatio, source, trimEndRatio, trimStartRatio]);

  const emitPlaybackStatus = useCallback(
    (patch: Partial<JamVideoPlaybackStatus>) => {
      const nextStatus = {
        ...playbackStatusRef.current,
        ...patch,
      };
      playbackStatusRef.current = nextStatus;
      onPlaybackStatusUpdateRef.current?.(nextStatus);
    },
    [],
  );

  useEffect(() => {
    durationReportedRef.current = false;
    playbackStatusRef.current = {
      isLoaded: false,
      isBuffering: Boolean(source),
      isPlaying: false,
      positionMillis: 0,
      status: player.status,
    };
    onPlaybackStatusUpdateRef.current?.(playbackStatusRef.current);
  }, [emitPlaybackStatus, player, source]);

  useEventListener(player, "videoTrackChange", ({ videoTrack }) => {
    applyBestTrackSize([videoTrack, ...(player.availableVideoTracks ?? [])]);
  });

  useEventListener(player, "sourceLoad", ({ availableVideoTracks }) => {
    applyBestTrackSize([...(availableVideoTracks ?? []), player.videoTrack]);
  });

  useEventListener(player, "statusChange", ({ status, error }) => {
    if (softHoldActiveRef.current || holdOverlayActiveRef.current) {
      logFeedHold({
        phase: "statusChange",
        id: feedHoldLogId(source),
        status,
        error: error?.message ?? error ?? null,
      });
    }
    const alreadyPlayable =
      playbackStatusRef.current.isLoaded || playbackStatusRef.current.isPlaying;
    // HLS can play while more data loads. Only treat the first load as buffering,
    // not mid-stream rebuffers or brief "loading" blips after returning from background.
    emitPlaybackStatus({
      isLoaded: status === "readyToPlay" || alreadyPlayable,
      isBuffering: status === "loading" && !alreadyPlayable,
      status,
    });

    if (status === "readyToPlay") {
      applyBestTrackSize([player.videoTrack, ...(player.availableVideoTracks ?? [])]);
    }

    if (status === "readyToPlay" && player.duration > 0 && !durationReportedRef.current) {
      durationReportedRef.current = true;
      onDurationResolvedRef.current?.(Math.round(player.duration * 1000));
    }

    if (status === "readyToPlay" && player.duration > 0 && scrubToRatioRef.current != null) {
      player.pause();
      player.currentTime = clamp(scrubToRatioRef.current, 0, 1) * player.duration;
      return;
    }

    if (status === "readyToPlay" && player.duration > 0 && resumeSeekPendingRef.current) {
      // Seek while paused; confirmResumeAndPlay starts playback only once
      // currentTime is near the restore point (avoids flashing scrub frames).
      applyResumePosition();
      return;
    }

    // Neighbors stay parked on frame 0 so a swipe-in doesn't flash a mid-clip poster.
    // Mid-clip tap-pause / profile overlay must not rewind.
    if (
      status === "readyToPlay" &&
      !shouldPlayRef.current &&
      resumeGateSecRef.current == null &&
      !resumeSeekPendingRef.current &&
      scrubToRatioRef.current == null
    ) {
      let current = 0;
      try {
        current = player.currentTime;
      } catch {
        current = 0;
      }
      if (current <= 0.2) {
        parkJamVideoPlayerAtStart(player);
      } else {
        stopJamVideoPlayer(player);
      }
      return;
    }

    // Only auto-resume once ready and while the app is foregrounded.
    // Gate on mountedRef so filter remounts can't revive a tearing-down player.
    if (
      status === "readyToPlay" &&
      mountedRef.current &&
      shouldPlayRef.current &&
      appStateRef.current === "active" &&
      scrubToRatioRef.current == null &&
      resumeGateSecRef.current == null &&
      !resumeSeekPendingRef.current
    ) {
      restoreJamVideoPosition(player, heldPauseSecRef.current);
      beginVisiblePlayback();
    }
  });

  useEventListener(player, "playingChange", ({ isPlaying }) => {
    emitPlaybackStatus({
      isPlaying,
      ...(isPlaying ? { isBuffering: false, isLoaded: true } : {}),
    });
    if (isPlaying) {
      softHoldActiveRef.current = false;
      let current = 0;
      try {
        current = player.currentTime;
      } catch {
        current = 0;
      }
      const held = heldPauseSecRef.current;
      if (current > 0.2 || (held != null && Math.abs(current - held) <= 0.45)) {
        heldPauseSecRef.current = null;
      }
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (shouldPlayRef.current && currentTime > 0.2) {
      heldPauseSecRef.current = null;
    }
    // Soft-hold overlay: fade once playing past heldSec + 0.15 (never time alone).
    const clearAfter = holdOverlayClearAfterSecRef.current;
    if (
      clearAfter != null &&
      holdOverlayActiveRef.current &&
      player.playing &&
      currentTime > clearAfter
    ) {
      fadeClearHoldOverlay("progress-past-hold");
    }
    if (scrubToRatioRef.current != null) {
      emitPlaybackStatus({
        positionMillis: Math.max(0, Math.round(currentTime * 1000)),
      });
      return;
    }

    const duration = player.duration;
    if (duration > 0) {
      const startRatio = trimStartRatioRef.current;
      const endRatio = trimEndRatioRef.current;
      const hasActiveTrim = startRatio > 0.001 || endRatio < 0.999;
      const startSec = startRatio * duration;
      const endSec = endRatio * duration;
      if (hasActiveTrim && endSec > startSec + 0.05 && currentTime >= endSec - 0.08) {
        player.currentTime = startSec;
        if (shouldPlay && appStateRef.current === "active") {
          playJamVideoPlayerWhenReady(player);
        }
      }
    }

    emitPlaybackStatus({
      isLoaded: true,
      isBuffering: false,
      positionMillis: Math.max(0, Math.round(currentTime * 1000)),
    });
  });

  useEffect(() => {
    // Control Center: keep the live frame. Don't tear down.
    if (appStateRef.current === "inactive") return;

    if (!source || !shouldPlay || appStateRef.current !== "active") {
      const freezeAt = Math.max(
        0,
        player.currentTime || playbackStatusRef.current.positionMillis / 1000,
      );

      if (appStateRef.current !== "active") {
        coverAndStop(freezeAt, "background");
        return;
      }

      coverAndStop(freezeAt, whenPaused);
      return;
    }

    applyVisibleAudio(player, isMuted, volume, surfaceReadyRef.current);
    if (resumeSeekPendingRef.current || resumeGateSecRef.current != null) {
      if (player.status === "readyToPlay") {
        if (resumeSeekPendingRef.current) {
          applyResumePosition();
        } else {
          confirmResumeAndPlay();
        }
      }
      return;
    }
    restoreJamVideoPosition(player, heldPauseSecRef.current);
    beginVisiblePlayback();
  }, [
    applyResumePosition,
    beginVisiblePlayback,
    confirmResumeAndPlay,
    coverAndStop,
    isMuted,
    player,
    shouldPlay,
    source,
    volume,
    whenPaused,
  ]);

  // Already-loaded players may miss onFirstFrameRender. Retry the atomic start
  // only — never play() under a muted cover.
  useEffect(() => {
    if (!source || !shouldPlay || appStateRef.current !== "active") return;
    const retryDelays = [220, 600, 1200];
    const timeoutIds = retryDelays.map((delayMs) =>
      setTimeout(() => {
        if (!mountedRef.current || !shouldPlayRef.current || appStateRef.current !== "active") {
          return;
        }
        if (player.playing && surfaceReadyRef.current) return;
        if (resumeSeekPendingRef.current && player.status === "readyToPlay") {
          applyResumePosition();
          return;
        }
        if (resumeGateSecRef.current != null) {
          confirmResumeAndPlay();
          return;
        }
        restoreJamVideoPosition(player, heldPauseSecRef.current);
        beginVisiblePlayback();
      }, delayMs),
    );
    return () => {
      for (const timeoutId of timeoutIds) clearTimeout(timeoutId);
    };
  }, [
    applyResumePosition,
    beginVisiblePlayback,
    confirmResumeAndPlay,
    player,
    shouldPlay,
    source,
  ]);

  // Recover from a silent HLS stall: ready/loaded but never actually playing.
  useEffect(() => {
    if (!source || !shouldPlay || appStateRef.current !== "active") return;
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current || !shouldPlayRef.current || appStateRef.current !== "active") {
        return;
      }
      if (player.playing) return;
      if (resumeSeekPendingRef.current || resumeGateSecRef.current != null) {
        if (player.status === "readyToPlay") {
          if (resumeSeekPendingRef.current) {
            applyResumePosition();
          } else {
            confirmResumeAndPlay();
          }
        }
        return;
      }
      restoreJamVideoPosition(player, heldPauseSecRef.current);
      beginVisiblePlayback();
    }, 900);
    return () => clearTimeout(timeoutId);
  }, [applyResumePosition, beginVisiblePlayback, confirmResumeAndPlay, player, shouldPlay, source]);

  useEffect(() => {
    const resumeRetryTimeouts: Array<ReturnType<typeof setTimeout>> = [];

    const clearResumeRetries = () => {
      while (resumeRetryTimeouts.length) {
        const timeoutId = resumeRetryTimeouts.pop();
        if (timeoutId != null) clearTimeout(timeoutId);
      }
    };

    const resumeForegroundPlayback = () => {
      if (!mountedRef.current) return;
      if (!source || scrubToRatioRef.current != null) return;
      if (appStateRef.current !== "active") return;

      if (!shouldPlayRef.current) {
        stopJamVideoPlayer(player);
        return;
      }

      restoreJamVideoPosition(player, heldPauseSecRef.current);
      beginVisiblePlayback();
    };

    const syncPlaybackWithAppState = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      // Control Center / notification shade → "inactive". Stopping the player
      // blanks the VideoView (black flash) until a remote freeze thumb loads.
      // Only mute under the shade; tear down on true background.
      if (nextState === "inactive") {
        if (!source || previousState !== "active") return;
        try {
          player.muted = true;
          player.volume = 0;
        } catch {
          /* ignore */
        }
        return;
      }

      if (nextState === "background") {
        clearResumeRetries();
        if (!source || previousState === "background") return;
        const freezeAt = Math.max(
          0,
          player.currentTime || playbackStatusRef.current.positionMillis / 1000,
        );
        coverAndStop(freezeAt, "background");
        return;
      }

      if (nextState !== "active") return;

      clearResumeRetries();
      applyVisibleAudio(player, isMuted, volume, surfaceReadyRef.current);
      resumeForegroundPlayback();
      requestAnimationFrame(resumeForegroundPlayback);
      for (const delayMs of [16, 48, 120]) {
        resumeRetryTimeouts.push(setTimeout(resumeForegroundPlayback, delayMs));
      }
    };

    const subscription = AppState.addEventListener("change", syncPlaybackWithAppState);
    return () => {
      clearResumeRetries();
      subscription.remove();
    };
  }, [beginVisiblePlayback, coverAndStop, isMuted, player, source, volume]);

  const letterboxStyle = letterboxVideoFrameStyle(
    surfaceSize.width,
    surfaceSize.height,
    resolvedVideoSize?.width ?? 0,
    resolvedVideoSize?.height ?? 0,
  );
  const mediaFrameStyle = letterboxStyle ?? StyleSheet.absoluteFill;
  const mediaContentFit = letterboxStyle ? "cover" : resolvedContentFit;
  const coverFit = letterboxStyle || mediaContentFit === "cover" ? "cover" : "contain";
  // Letterbox bars stay black; grey is only for cover-fit open/still surfaces.
  const effectiveSurfaceColor =
    resolvedContentFit === "contain" ? MEDIA_LETTERBOX_BLACK : surfaceColor;
  const coverPosterUri = posterUri ?? null;
  const coverFreezeUri =
    freezeFrameUri && freezeFrameUri !== coverPosterUri ? freezeFrameUri : null;
  const showStartPoster = Boolean(
    coverPosterUri && freezeFrameUri && freezeFrameUri === coverPosterUri,
  );
  // Hard cover (initial load / swipe / app background) may use a solid surface.
  // Soft hold uses an overlay still above VideoView — never a bare colour.
  const showHardCoverLayer = coverHeld || Boolean(freezeFrameUri);

  return (
    <View
      style={[style, { backgroundColor: effectiveSurfaceColor }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSurfaceSize((current) =>
          current.width === width && current.height === height ? current : { width, height },
        );
      }}
    >
      <VideoView
        player={player}
        style={mediaFrameStyle}
        contentFit={mediaContentFit}
        nativeControls={nativeControls}
        fullscreenOptions={{ enable: nativeControls }}
        allowsPictureInPicture={false}
        onFirstFrameRender={handleViewFirstFrame}
      />
      {holdFreezeSource ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: holdOverlayOpacity }]}
        >
          {typeof holdFreezeSource === "string" ? (
            <CachedCoverImage
              uri={holdFreezeSource}
              contentFit={coverFit}
              style={mediaFrameStyle}
              onLoad={() => markStillLoaded(holdFreezeSource)}
              onError={() => {
                const fallback =
                  posterUriRef.current || lastLoadedStillUriRef.current;
                if (fallback && fallback !== holdFreezeSource) {
                  setHoldFreezeSource(fallback);
                }
              }}
            />
          ) : (
            <Image
              source={holdFreezeSource}
              contentFit={coverFit}
              style={mediaFrameStyle}
              transition={0}
              alt=""
            />
          )}
        </Animated.View>
      ) : null}
      {showHardCoverLayer ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: effectiveSurfaceColor }]}
        >
          {showStartPoster && coverPosterUri && !coverPosterFailed ? (
            <CachedCoverImage
              uri={coverPosterUri}
              contentFit={coverFit}
              style={mediaFrameStyle}
              onLoad={() => markStillLoaded(coverPosterUri)}
              onError={() => setCoverPosterFailed(true)}
            />
          ) : null}
          {coverFreezeUri && !coverFreezeFailed ? (
            <CachedCoverImage
              uri={coverFreezeUri}
              contentFit={coverFit}
              style={mediaFrameStyle}
              onLoad={() => markStillLoaded(coverFreezeUri)}
              onError={() => {
                setCoverFreezeFailed(true);
                setFreezeFrameUri(null);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
