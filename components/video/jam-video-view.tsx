import { useEventListener } from "expo";
import {
  VideoView,
  useVideoPlayer,
  type VideoContentFit,
  type VideoPlayer,
  type VideoPlayerStatus,
  type VideoSource,
} from "expo-video";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Image,
  Platform,
  StyleSheet,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  contentFitForVideoSize,
  ensureVideoAspectCached,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromSource,
  getVideoAspectCacheKeyFromVideo,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import { clamp } from "@/lib/format";
import { probeHlsVideoSize } from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import {
  adoptPrewarmedProfileVideoPlayer,
  prewarmProfileVideoSource,
} from "@/lib/profile-video-prewarm";
import {
  getCloudflareFreezeFrameUri,
  getExpoVideoSource,
  getGridVideoSource,
} from "@/lib/video-display";

export type JamVideoPlaybackStatus = {
  isLoaded: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  positionMillis: number;
  status: VideoPlayerStatus;
};

/** Open profile fullscreen; warm aspect cache without blocking the open. */
export function openProfileVideoFullscreen(
  video: ProfileVideo | FeedVideo,
  open: () => void,
) {
  const source = getGridVideoSource(video);
  // Kick prewarm if the thumb became visible but pool entry isn't ready yet.
  prewarmProfileVideoSource(source);
  if (!getRememberedVideoAspectSize(getVideoAspectCacheKeyFromVideo(video))) {
    void ensureVideoAspectCached(video);
  }
  open();
}

export const PROFILE_VIDEO_OPEN_GREY = "#3f3f46";

function configureJamVideoPlayer(
  nextPlayer: VideoPlayer,
  options: {
    isLooping: boolean;
    isMuted: boolean;
    volume: number;
    timeUpdateIntervalSec: number;
  },
) {
  nextPlayer.loop = options.isLooping;
  nextPlayer.muted = options.isMuted;
  nextPlayer.volume = options.volume;
  nextPlayer.timeUpdateEventInterval = options.timeUpdateIntervalSec;
  nextPlayer.audioMixingMode = "duckOthers";
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

/** Fully silence and detach background persistence before release/unmount. */
function stopJamVideoPlayer(player: VideoPlayer) {
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
}

export function JamVideoView({
  source,
  style,
  contentFit = "cover",
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
  timeUpdateIntervalSec = 0.25,
  adoptPrewarmed = false,
  surfaceColor = "#000",
  onDurationResolved,
  onPlaybackStatusUpdate,
  onFirstFrameRender,
  onContentFitChange,
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
  timeUpdateIntervalSec?: number;
  /** Reuse a grid-prewarmed player so the first frame can paint immediately. */
  adoptPrewarmed?: boolean;
  surfaceColor?: string;
  onDurationResolved?: (durationMs: number) => void;
  onPlaybackStatusUpdate?: (status: JamVideoPlaybackStatus) => void;
  onFirstFrameRender?: () => void;
  onContentFitChange?: (fit: VideoContentFit) => void;
}) {
  const videoSource = useMemo<VideoSource>(() => getExpoVideoSource(source), [source]);
  const aspectCacheKey = getVideoAspectCacheKeyFromSource(source);
  const rememberedSize = getRememberedVideoAspectSize(aspectCacheKey);
  const seedWidth = knownWidth ?? rememberedSize?.width ?? null;
  const seedHeight = knownHeight ?? rememberedSize?.height ?? null;
  const onPlaybackStatusUpdateRef = useRef(onPlaybackStatusUpdate);
  const onDurationResolvedRef = useRef(onDurationResolved);
  const onFirstFrameRenderRef = useRef(onFirstFrameRender);
  const onContentFitChangeRef = useRef(onContentFitChange);
  const [resolvedContentFit, setResolvedContentFit] = useState<VideoContentFit>(() =>
    contentFitForVideoSize(seedWidth, seedHeight, contentFit),
  );
  const trimStartRatioRef = useRef(trimStartRatio ?? 0);
  const trimEndRatioRef = useRef(trimEndRatio ?? 1);
  const scrubToRatioRef = useRef<number | null>(scrubToRatio ?? null);
  const shouldPlayRef = useRef(shouldPlay);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const freezePositionRef = useRef<number | null>(null);
  const freezeCaptureIdRef = useRef(0);
  const wasScrubbingRef = useRef(false);
  const durationReportedRef = useRef(false);
  const [freezeFrameUri, setFreezeFrameUri] = useState<string | null>(null);
  const firstFrameClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFrameNotifiedRef = useRef(false);
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
      // Prewarm players buffer muted from 0 — ensure we start clean for fullscreen.
      adopted.currentTime = 0;
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
      });
    } catch {
      /* native object already gone */
    }
  }, [isLooping, isMuted, prewarmedPlayer, timeUpdateIntervalSec, volume]);

  // Hard-stop on unmount so audio cannot continue after navigating away.
  useEffect(() => {
    return () => {
      stopJamVideoPlayer(player);
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
  const prevShouldPlayRef = useRef(shouldPlay);

  const revealAfterFirstFrame = useCallback(() => {
    if (firstFrameClearTimeoutRef.current) {
      clearTimeout(firstFrameClearTimeoutRef.current);
    }
    // onFirstFrameRender can fire before pixels are composited — delay cover removal.
    // Prewarmed players often never re-fire onFirstFrameRender, so callers also
    // invoke this from playingChange once audio/video is actually running.
    // Always clear freeze covers on resume — firstFrameNotified only gates the
    // parent callback (scroll-away captures a new freeze that must be removable).
    firstFrameClearTimeoutRef.current = setTimeout(() => {
      if (appStateRef.current !== "active") {
        return;
      }
      setFreezeFrameUri(null);
      if (firstFrameNotifiedRef.current) return;
      firstFrameNotifiedRef.current = true;
      onFirstFrameRenderRef.current?.();
    }, 48);
  }, []);

  useEffect(() => {
    firstFrameNotifiedRef.current = false;
  }, [source]);

  const captureFreezeFrame = useCallback(
    (atTimeSec: number) => {
      if (!source) return;
      const captureId = freezeCaptureIdRef.current + 1;
      freezeCaptureIdRef.current = captureId;

      const cloudflareUri = getCloudflareFreezeFrameUri(source, atTimeSec);
      if (cloudflareUri) {
        setFreezeFrameUri(cloudflareUri);
        void Image.prefetch(cloudflareUri);
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
    [source],
  );

  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  useEffect(() => {
    freezeCaptureIdRef.current += 1;
    freezePositionRef.current = null;
    setFreezeFrameUri(null);
  }, [source]);

  useEffect(() => {
    onContentFitChangeRef.current = onContentFitChange;
  }, [onContentFitChange]);

  useLayoutEffect(() => {
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    const width = knownWidth ?? cached?.width ?? null;
    const height = knownHeight ?? cached?.height ?? null;
    const nextFit = contentFitForVideoSize(width, height, contentFit);
    setResolvedContentFit(nextFit);
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
      // Never call parent setState inside this updater — that updates
      // ProfileFullscreenFeedItem while JamVideoView is rendering.
      setResolvedContentFit((current) => (current === nextFit ? current : nextFit));
    },
    [aspectCacheKey, contentFit],
  );

  const applyBestTrackSize = useCallback(
    (tracks?: Array<{ size?: { width?: number; height?: number } | null } | null> | null) => {
      // Oriented camera/picker size wins over coded track size. iOS often reports
      // landscape natural size for portrait phone recordings (rotation metadata).
      if (
        typeof seedWidth === "number" &&
        typeof seedHeight === "number" &&
        seedWidth > 0 &&
        seedHeight > 0 &&
        seedWidth < seedHeight
      ) {
        applyVideoTrackSize(seedWidth, seedHeight);
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
      if (!sizes.length) return;
      // Prefer any landscape/square track so a portrait HLS rung can't force cover.
      const landscape = sizes.find((size) => size.width >= size.height);
      const largest = sizes.reduce((best, size) =>
        size.width * size.height > best.width * best.height ? size : best,
      );
      const pick = landscape ?? largest;
      applyVideoTrackSize(pick.width, pick.height);
    },
    [applyVideoTrackSize, seedHeight, seedWidth],
  );

  useEffect(() => {
    applyBestTrackSize([player.videoTrack, ...(player.availableVideoTracks ?? [])]);
  }, [applyBestTrackSize, player, source]);

  // HLS often omits usable track sizes until late (or never). Probe the master
  // playlist RESOLUTION tags so landscape letterboxes instead of cover-zooming.
  useEffect(() => {
    if (!source || !source.includes(".m3u8")) return;
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    if (cached) {
      applyVideoTrackSize(cached.width, cached.height);
    }
    let cancelled = false;
    void probeHlsVideoSize(source).then((size) => {
      if (cancelled || !size) return;
      applyVideoTrackSize(size.width, size.height);
    });
    return () => {
      cancelled = true;
    };
  }, [applyVideoTrackSize, aspectCacheKey, source]);

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
    player.muted = isMuted;
    player.volume = volume;
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

  useEventListener(player, "statusChange", ({ status }) => {
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

    // Only auto-resume once ready and while the app is foregrounded.
    if (
      status === "readyToPlay" &&
      shouldPlayRef.current &&
      appStateRef.current === "active" &&
      scrubToRatioRef.current == null
    ) {
      playJamVideoPlayerWhenReady(player);
    }
  });

  useEventListener(player, "playingChange", ({ isPlaying }) => {
    emitPlaybackStatus({
      isPlaying,
      ...(isPlaying ? { isBuffering: false, isLoaded: true } : {}),
    });
    // Clear covers once playback is running. Prewarmed/adopted players often skip
    // VideoView.onFirstFrameRender, which left the profile grey cover stuck forever.
    if (isPlaying) {
      revealAfterFirstFrame();
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
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
    return () => {
      if (firstFrameClearTimeoutRef.current) {
        clearTimeout(firstFrameClearTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!source || !shouldPlay || appStateRef.current !== "active") {
      // Pause in place and fully silence so swipe-away / inactive pages can't leak audio.
      prevShouldPlayRef.current = shouldPlay;
      const freezeAt = Math.max(
        0,
        player.currentTime || playbackStatusRef.current.positionMillis / 1000,
      );
      if (player.playing || playbackStatusRef.current.isPlaying) {
        freezePositionRef.current = freezeAt;
        captureFreezeFrame(freezeAt);
      }
      stopJamVideoPlayer(player);
      return;
    }

    prevShouldPlayRef.current = true;
    // Hard-stop silences the player; restore prop audio before starting again.
    try {
      player.muted = isMuted;
      player.volume = volume;
    } catch {
      /* ignore */
    }
    // Keep any freeze cover up until playingChange/first-frame clears it.
    // Never play() before readyToPlay — that was the choppy-audio path.
    if (player.playing) {
      // Already playing (rare with gated start) — no playingChange will fire.
      revealAfterFirstFrame();
    } else {
      playJamVideoPlayerWhenReady(player);
    }
  }, [captureFreezeFrame, isMuted, player, revealAfterFirstFrame, shouldPlay, source, volume]);

  // If play() doesn't emit playingChange (stale native state after recycle),
  // retry play once ready and drop the freeze cover so scroll-back can't stay stuck.
  useEffect(() => {
    if (!source || !shouldPlay || appStateRef.current !== "active") return;
    if (!freezeFrameUri) return;
    const retryDelays = [220, 600, 1200];
    const timeoutIds = retryDelays.map((delayMs) =>
      setTimeout(() => {
        if (!shouldPlayRef.current || appStateRef.current !== "active") return;
        if (!player.playing) {
          playJamVideoPlayerWhenReady(player);
        }
        // Always clear the cover — a stuck poster looks like a frozen video.
        revealAfterFirstFrame();
      }, delayMs),
    );
    return () => {
      for (const timeoutId of timeoutIds) clearTimeout(timeoutId);
    };
  }, [freezeFrameUri, player, revealAfterFirstFrame, shouldPlay, source]);

  // Recover from a silent HLS stall: ready/loaded but never actually playing.
  useEffect(() => {
    if (!source || !shouldPlay || appStateRef.current !== "active") return;
    const timeoutId = setTimeout(() => {
      if (!shouldPlayRef.current || appStateRef.current !== "active") return;
      if (player.playing) return;
      playJamVideoPlayerWhenReady(player);
    }, 900);
    return () => clearTimeout(timeoutId);
  }, [player, shouldPlay, source]);

  useEffect(() => {
    const resumeRetryTimeouts: Array<ReturnType<typeof setTimeout>> = [];

    const clearResumeRetries = () => {
      while (resumeRetryTimeouts.length) {
        const timeoutId = resumeRetryTimeouts.pop();
        if (timeoutId != null) clearTimeout(timeoutId);
      }
    };

    const resumeForegroundPlayback = () => {
      if (!source || scrubToRatioRef.current != null) return;
      if (appStateRef.current !== "active") return;

      if (!shouldPlayRef.current) {
        stopJamVideoPlayer(player);
        return;
      }

      setFreezeFrameUri(null);
      // Never seek on resume — seeking forces an HLS rebuffer and is why return
      // from background felt slow compared to TikTok.
      playJamVideoPlayerWhenReady(player);
    };

    const syncPlaybackWithAppState = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "inactive" || nextState === "background") {
        clearResumeRetries();
        if (!source || previousState !== "active") return;
        const freezeAt = Math.max(0, player.currentTime || playbackStatusRef.current.positionMillis / 1000);
        freezePositionRef.current = freezeAt;
        stopJamVideoPlayer(player);
        captureFreezeFrame(freezeAt);
        return;
      }

      if (nextState !== "active") return;

      clearResumeRetries();
      // Restore mute/volume from props before resume — stopJamVideoPlayer silenced the player.
      try {
        player.muted = isMuted;
        player.volume = volume;
      } catch {
        /* ignore */
      }
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
  }, [captureFreezeFrame, isMuted, player, source, volume]);

  return (
    <View style={[style, { backgroundColor: surfaceColor }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={resolvedContentFit}
        nativeControls={nativeControls}
        fullscreenOptions={{ enable: nativeControls }}
        allowsPictureInPicture={false}
        onFirstFrameRender={revealAfterFirstFrame}
      />
      {freezeFrameUri ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: freezeFrameUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={resolvedContentFit === "contain" ? "contain" : "cover"}
          />
        </View>
      ) : null}
    </View>
  );
}
