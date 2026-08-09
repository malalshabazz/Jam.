import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { type VideoContentFit } from "expo-video";
import { contentFitForVideoSize } from "@/components/video/aspect-cache";
import {
  JamVideoView,
  type JamVideoPlaybackStatus,
} from "@/components/video/jam-video-view";
import {
  getCloudflareFreezeFrameUri,
  getFeedPosterSource,
  getVideoSource,
} from "@/lib/video-display";
import { FEED_SEEN_DWELL_MS, type FeedVideo } from "@/lib/native-social-data";
import { VideoPresentationOverlays } from "@/components/VideoPresentationOverlays";
import { getUniqueVideoTags, normalizeVideoTag } from "@/lib/feed-filters";
import type { FeedPlaybackSpeed } from "@/types/app";
import {
  FEED_ACTION_GAP,
  FEED_CHROME_FADE_MS,
  FEED_CHROME_HOLD_MS,
  FEED_CHROME_LOCK_CIRCLE_SIZE,
  FEED_CHROME_LOCK_PULL_PX,
  FEED_CHROME_LOCK_TRACK_TRAVEL,
  FEED_PLAYBACK_SPEEDS,
  FEED_SPEED_DEFAULT_INDEX,
  FEED_SPEED_PILL_HEIGHT,
  FEED_SPEED_PILL_WIDTH,
  FEED_SPEED_SEGMENT_PX,
  FEED_SPEED_ZONE_LEFT_RATIO,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { Avatar } from "@/components/ui/avatar";
import { ProBadge } from "@/components/ui/badges";
import { BookmarkIcon } from "@/components/icons/bookmark-icon";
import { FeedChromeLockIcon } from "@/components/icons/feed-chrome-lock-icon";
import { JamJarIcon } from "@/components/icons/jam-jar-icon";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import { FeedPausedPlayIcon } from "@/components/icons/feed-paused-play-icon";
import { triggerHoldHaptic } from "@/lib/hold-haptic";

export function FeedItem({
  item,
  height,
  navBarHeight,
  isActive,
  paused = false,
  suspendVideo = false,
  resumePositionSec = null,
  onPausedChange,
  onPlaybackProgress,
  onResumePositionApplied,
  activeFilterTags,
  chromeOpacity,
  chromeHolding = false,
  chromeLocked = false,
  onChromeHoldStart,
  onChromeHoldEnd,
  onChromeLock,
  onChromeUnlock,
  onSpeedHoldStart,
  onSpeedHoldEnd,
  onFirstPlay,
  onWatched,
  onOpenProfile,
  onSave,
  onMessage,
  onNotInterested,
  onBlock,
  onReport,
}: {
  item: FeedVideo;
  height: number;
  navBarHeight: number;
  isActive: boolean;
  /** Controlled pause — owned by Discover so it survives tab switches. */
  paused?: boolean;
  /** Filter/near-me reload bridge: poster only, no live player (avoids freeze-frames). */
  suspendVideo?: boolean;
  /** One-shot seek when restoring this clip from a filter session cache. */
  resumePositionSec?: number | null;
  onPausedChange?: (paused: boolean) => void;
  /** Active-clip position for filter session restore. */
  onPlaybackProgress?: (positionSec: number) => void;
  onResumePositionApplied?: () => void;
  /** Normalized role/genre tags from the user's discover filters. */
  activeFilterTags?: ReadonlySet<string>;
  chromeOpacity?: Animated.Value;
  chromeHolding?: boolean;
  chromeLocked?: boolean;
  onChromeHoldStart?: () => void;
  onChromeHoldEnd?: () => void;
  onChromeLock?: () => void;
  onChromeUnlock?: () => void;
  onSpeedHoldStart?: () => void;
  onSpeedHoldEnd?: () => void;
  onFirstPlay?: () => void;
  /** Fired once after a short dwell while the clip is actively playing. */
  onWatched?: () => void;
  onOpenProfile: () => void;
  onSave: (nextSaved: boolean) => Promise<boolean>;
  onMessage: () => void;
  onNotInterested: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  const source = getVideoSource(item);
  const posterUri = getFeedPosterSource(item);
  // Mid-clip cover when restoring a filter session — start poster would flash t≈0.
  const resumeCoverUri =
    resumePositionSec != null && resumePositionSec > 0.25 && source
      ? getCloudflareFreezeFrameUri(source, resumePositionSec)
      : null;
  const [heldResumeCoverUri, setHeldResumeCoverUri] = useState<string | null>(null);
  // Keep the mid-clip cover after parent clears resumePositionSec (seek issued)
  // until the player reports the first real frame.
  const waitingCoverUri = heldResumeCoverUri ?? resumeCoverUri ?? posterUri;
  const onFirstPlayRef = useRef(onFirstPlay);
  const onWatchedRef = useRef(onWatched);
  const onPlaybackProgressRef = useRef(onPlaybackProgress);
  onPlaybackProgressRef.current = onPlaybackProgress;
  const watchedReportedRef = useRef(false);
  const chromeHoldingRef = useRef(false);
  const speedHoldingRef = useRef(false);
  const chromeSuppressPressRef = useRef(false);
  const chromeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeLockHudHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTouchStartYRef = useRef<number | null>(null);
  const chromeTouchStartXRef = useRef<number | null>(null);
  const chromeTouchInSpeedZoneRef = useRef(false);
  const chromeTouchMovedRef = useRef(false);
  const chromePullProgressRef = useRef(0);
  const speedIndexRef = useRef(FEED_SPEED_DEFAULT_INDEX);
  const speedDragBaseIndexRef = useRef(FEED_SPEED_DEFAULT_INDEX);
  const chromeLockedRef = useRef(chromeLocked);
  const chromeLockHudOpacity = useRef(new Animated.Value(0)).current;
  const speedHudOpacity = useRef(new Animated.Value(0)).current;
  const [chromePullProgress, setChromePullProgress] = useState(0);
  const [chromeLockHudSealed, setChromeLockHudSealed] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(FEED_SPEED_DEFAULT_INDEX);
  const [playbackRate, setPlaybackRate] = useState<FeedPlaybackSpeed>(1);
  const [saved, setSaved] = useState(item.savedByMe);
  const [bufferingState, setBufferingState] = useState(() => ({
    source,
    waitingForFirstPlay: Boolean(source),
  }));
  const [showWaitingSpinner, setShowWaitingSpinner] = useState(false);
  const [mediaContentFit, setMediaContentFit] = useState<VideoContentFit>("cover");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [saveScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const connection = item.mutual ? "jamming" : item.jammedMe ? "jammed you" : null;
  const jamAlreadySent = item.jammedByMe || item.mutual;
  const jamPendingReply = item.jammedByMe && !item.mutual;
  const tags = getUniqueVideoTags([...item.roles, ...item.genres]);
  const visibleTags = tags.length ? tags : getUniqueVideoTags(item.categories);
  const caption = item.caption.trim();
  const actionsBottom = navBarHeight + FEED_ACTION_GAP;
  const chromeInteractive = !chromeHolding && !chromeLocked;
  const overlayOpacity = chromeOpacity ?? 1;

  useEffect(() => {
    onFirstPlayRef.current = onFirstPlay;
  }, [onFirstPlay]);

  useEffect(() => {
    onWatchedRef.current = onWatched;
  }, [onWatched]);

  useEffect(() => {
    watchedReportedRef.current = false;
    speedIndexRef.current = FEED_SPEED_DEFAULT_INDEX;
    setSpeedIndex(FEED_SPEED_DEFAULT_INDEX);
    setPlaybackRate(1);
    speedHudOpacity.setValue(0);
  }, [item.id, speedHudOpacity]);

  useEffect(() => {
    if (resumeCoverUri) setHeldResumeCoverUri(resumeCoverUri);
  }, [resumeCoverUri]);

  useEffect(() => {
    if (!bufferingState.waitingForFirstPlay) setHeldResumeCoverUri(null);
  }, [bufferingState.waitingForFirstPlay]);

  useEffect(() => {
    if (waitingCoverUri) {
      void Image.prefetch(waitingCoverUri);
    }
  }, [waitingCoverUri]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSaved(item.savedByMe));
    return () => cancelAnimationFrame(frame);
  }, [item.savedByMe]);

  useEffect(() => {
    setBufferingState({ source, waitingForFirstPlay: Boolean(source) });
    setShowWaitingSpinner(false);
    setMediaContentFit("cover");
  }, [source]);

  useEffect(() => {
    if (!isActive || paused || !source || watchedReportedRef.current) return;
    const timer = setTimeout(() => {
      if (watchedReportedRef.current) return;
      watchedReportedRef.current = true;
      onWatchedRef.current?.();
    }, FEED_SEEN_DWELL_MS);
    return () => clearTimeout(timer);
  }, [isActive, paused, source]);

  useEffect(() => {
    const shouldWait =
      Boolean(source) &&
      isActive &&
      !paused &&
      bufferingState.source === source &&
      bufferingState.waitingForFirstPlay;

    if (!shouldWait) {
      setShowWaitingSpinner(false);
      return;
    }

    // Only show spinner if the poster isn't covering the wait.
    const spinnerTimer = setTimeout(() => setShowWaitingSpinner(!waitingCoverUri), 450);
    // If audio is running but onFirstFrameRender never arrives (known for some
    // HLS sources / surface mismatches), drop the poster so we don't sit on a
    // black thumb forever. Give resume seeks a bit longer before forcing reveal.
    const stuckPosterTimer = setTimeout(
      () => {
        setBufferingState((current) => {
          if (current.source !== source || !current.waitingForFirstPlay) return current;
          return { source, waitingForFirstPlay: false };
        });
      },
      resumeCoverUri ? 1800 : 900,
    );
    return () => {
      clearTimeout(spinnerTimer);
      clearTimeout(stuckPosterTimer);
    };
  }, [
    bufferingState.source,
    bufferingState.waitingForFirstPlay,
    isActive,
    paused,
    resumeCoverUri,
    source,
    waitingCoverUri,
  ]);

  useEffect(() => {
    if (bufferingState.source !== source || bufferingState.waitingForFirstPlay) return;
    onFirstPlayRef.current?.();
  }, [bufferingState.source, bufferingState.waitingForFirstPlay, source]);

  useEffect(() => {
    chromeLockedRef.current = chromeLocked;
  }, [chromeLocked]);

  useEffect(() => {
    return () => {
      if (chromeHoldTimerRef.current) {
        clearTimeout(chromeHoldTimerRef.current);
        chromeHoldTimerRef.current = null;
      }
      if (chromeLockHudHideTimerRef.current) {
        clearTimeout(chromeLockHudHideTimerRef.current);
        chromeLockHudHideTimerRef.current = null;
      }
    };
  }, []);

  function clearChromeHoldTimer() {
    if (chromeHoldTimerRef.current) {
      clearTimeout(chromeHoldTimerRef.current);
      chromeHoldTimerRef.current = null;
    }
  }

  function hideChromeLockHud() {
    if (chromeLockHudHideTimerRef.current) {
      clearTimeout(chromeLockHudHideTimerRef.current);
      chromeLockHudHideTimerRef.current = null;
    }
    chromeLockHudOpacity.stopAnimation();
    Animated.timing(chromeLockHudOpacity, {
      toValue: 0,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setChromePullProgress(0);
      setChromeLockHudSealed(false);
      chromePullProgressRef.current = 0;
    });
  }

  function showChromeLockHud() {
    if (chromeLockHudHideTimerRef.current) {
      clearTimeout(chromeLockHudHideTimerRef.current);
      chromeLockHudHideTimerRef.current = null;
    }
    chromePullProgressRef.current = 0;
    setChromePullProgress(0);
    setChromeLockHudSealed(false);
    chromeLockHudOpacity.stopAnimation();
    chromeLockHudOpacity.setValue(0);
    // Same duration/easing as feed chrome fade-out so they crossfade together.
    Animated.timing(chromeLockHudOpacity, {
      toValue: 1,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function applySpeedIndex(nextIndex: number) {
    const clamped = Math.max(0, Math.min(FEED_PLAYBACK_SPEEDS.length - 1, nextIndex));
    speedIndexRef.current = clamped;
    setSpeedIndex(clamped);
    setPlaybackRate(FEED_PLAYBACK_SPEEDS[clamped]);
  }

  function showSpeedHud() {
    speedHudOpacity.stopAnimation();
    speedHudOpacity.setValue(0);
    Animated.timing(speedHudOpacity, {
      toValue: 1,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function hideSpeedHud() {
    speedHudOpacity.stopAnimation();
    Animated.timing(speedHudOpacity, {
      toValue: 0,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function handleFeedTouchStart(locationX: number, pageY: number) {
    clearChromeHoldTimer();
    chromeTouchStartXRef.current = locationX;
    chromeTouchStartYRef.current = pageY;
    chromeTouchMovedRef.current = false;
    chromePullProgressRef.current = 0;
    chromeTouchInSpeedZoneRef.current = locationX >= viewportWidth * FEED_SPEED_ZONE_LEFT_RATIO;
    if (moreMenuOpen) return;
    // Speed scrubber still works while chrome is locked; clear-hold does not re-trigger.
    if (!chromeTouchInSpeedZoneRef.current && chromeLockedRef.current) return;

    chromeHoldTimerRef.current = setTimeout(() => {
      chromeHoldTimerRef.current = null;
      if (chromeTouchMovedRef.current) return;

      if (chromeTouchInSpeedZoneRef.current) {
        speedHoldingRef.current = true;
        speedDragBaseIndexRef.current = speedIndexRef.current;
        applySpeedIndex(speedIndexRef.current);
        showSpeedHud();
        triggerHoldHaptic();
        onSpeedHoldStart?.();
        return;
      }

      if (chromeLockedRef.current) return;
      chromeHoldingRef.current = true;
      showChromeLockHud();
      triggerHoldHaptic();
      onChromeHoldStart?.();
    }, FEED_CHROME_HOLD_MS);
  }

  function handleFeedTouchMove(pageY: number) {
    const startY = chromeTouchStartYRef.current;
    if (startY == null) return;
    const dy = pageY - startY;

    if (!chromeHoldingRef.current && !speedHoldingRef.current) {
      if (Math.abs(dy) > 12) {
        chromeTouchMovedRef.current = true;
        clearChromeHoldTimer();
      }
      return;
    }

    if (speedHoldingRef.current) {
      // Pull up (negative dy) → faster speeds at the top of the pill.
      const nextIndex = Math.round(speedDragBaseIndexRef.current + dy / FEED_SPEED_SEGMENT_PX);
      applySpeedIndex(nextIndex);
      return;
    }

    const progress = Math.min(1, Math.max(0, dy / FEED_CHROME_LOCK_PULL_PX));
    chromePullProgressRef.current = progress;
    setChromePullProgress(progress);
    setChromeLockHudSealed(progress >= 1);
  }

  function handleFeedTouchEnd() {
    clearChromeHoldTimer();
    const wasChromeHolding = chromeHoldingRef.current;
    const wasSpeedHolding = speedHoldingRef.current;
    chromeHoldingRef.current = false;
    speedHoldingRef.current = false;
    chromeTouchStartYRef.current = null;
    chromeTouchStartXRef.current = null;

    if (!wasChromeHolding && !wasSpeedHolding) return;

    chromeSuppressPressRef.current = true;

    if (wasSpeedHolding) {
      hideSpeedHud();
      onSpeedHoldEnd?.();
      return;
    }

    // Fade the lock HUD as soon as the finger lifts, locked or not.
    hideChromeLockHud();

    // Confirm lock only on release, and only if pull reached the bottom.
    if (chromePullProgressRef.current >= 1 && !chromeLockedRef.current) {
      onChromeLock?.();
      return;
    }

    if (!chromeLockedRef.current) {
      onChromeHoldEnd?.();
    }
  }

  function togglePlayback() {
    if (moreMenuOpen) {
      setMoreMenuOpen(false);
      return;
    }
    if (!source) return;
    onPausedChange?.(!paused);
  }

  function handleFeedPress() {
    if (chromeSuppressPressRef.current) {
      chromeSuppressPressRef.current = false;
      return;
    }
    if (chromeLockedRef.current) {
      onChromeUnlock?.();
      return;
    }
    if (chromeHoldingRef.current || speedHoldingRef.current) return;
    togglePlayback();
  }

  function revealFirstFrame() {
    setBufferingState((current) => {
      if (current.source !== source || !current.waitingForFirstPlay) return current;
      return { source, waitingForFirstPlay: false };
    });
  }

  function runSaveAnimation() {
    saveScale.setValue(1);
    Animated.sequence([
      Animated.timing(saveScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(saveScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }


  function runJamShakeAnimation() {
    jamShake.stopAnimation();
    jamShake.setValue(0);
    Animated.sequence([
      Animated.timing(jamShake, {
        toValue: 1,
        duration: 55,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: -1,
        duration: 90,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: 0.7,
        duration: 80,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(jamShake, {
        toValue: 0,
        damping: 8,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function pressJam() {
    if (item.mutual) {
      onMessage();
      return;
    }

    if (jamPendingReply) {
      runJamShakeAnimation();
      return;
    }

    onMessage();
  }

  async function pressSave() {
    const nextSaved = !saved;

    setSaved(nextSaved);
    if (nextSaved) runSaveAnimation();

    const didSave = await onSave(nextSaved);
    if (!didSave) {
      setSaved(!nextSaved);
    }
  }

  function openMoreMenu() {
    setMoreMenuOpen((current) => !current);
  }

  function runMoreMenuAction(action: () => void) {
    setMoreMenuOpen(false);
    action();
  }

  // Match create/camera: cover the feed viewport above the tab bar, not the full screen.
  const feedVideoFrameStyle = [
    styles.feedVideoLayer,
    styles.feedVideoViewportClip,
    { bottom: navBarHeight },
  ];

  return (
    <Pressable
      style={[styles.feedItem, { height }]}
      onPress={handleFeedPress}
      onPressIn={(event) =>
        handleFeedTouchStart(event.nativeEvent.locationX, event.nativeEvent.pageY)
      }
      onTouchMove={(event) => handleFeedTouchMove(event.nativeEvent.pageY)}
      onPressOut={handleFeedTouchEnd}
      delayLongPress={FEED_CHROME_HOLD_MS + 400}
    >
      {source ? (
        <View style={feedVideoFrameStyle}>
          {suspendVideo ? (
            posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Avatar size={90} />
                <Text style={styles.h2}>{item.creatorName}</Text>
              </View>
            )
          ) : (
            <>
              <JamVideoView
                key={item.id}
                source={source}
                style={StyleSheet.absoluteFill}
                shouldPlay={isActive && !paused}
                isLooping
                // Keep inactive cells silent even if a dying player briefly resumes
                // during filter-driven FlatList remounts.
                isMuted={!isActive || paused}
                volume={isActive && !paused ? 1 : 0}
                playbackRate={playbackRate}
                // Only cover with a thumb when scrolling away — tap-pause keeps the live frame.
                showFreezeFrameOnPause={!isActive}
                resumePositionSec={isActive ? resumePositionSec : null}
                onResumePositionApplied={onResumePositionApplied}
                onPlaybackStatusUpdate={(status: JamVideoPlaybackStatus) => {
                  if (!isActive) return;
                  onPlaybackProgressRef.current?.(status.positionMillis / 1000);
                }}
                onFirstFrameRender={revealFirstFrame}
                onContentFitChange={setMediaContentFit}
              />
              {waitingCoverUri && bufferingState.waitingForFirstPlay ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]}
                >
                  <Image
                    source={{ uri: waitingCoverUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={mediaContentFit === "contain" ? "contain" : "cover"}
                    onLoad={(event) => {
                      const { width, height } = event.nativeEvent.source;
                      setMediaContentFit(contentFitForVideoSize(width, height));
                    }}
                  />
                </View>
              ) : null}
            </>
          )}
          <VideoPresentationOverlays filter={item.videoFilter} textOverlays={item.textOverlays} />
          {isActive && paused && !suspendVideo ? (
            <View pointerEvents="none" style={styles.feedPausedPlayOverlay}>
              <FeedPausedPlayIcon />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={feedVideoFrameStyle}>
          <View style={styles.videoPlaceholder}>
          <Avatar size={90} />
          <Text style={styles.h2}>{item.creatorName}</Text>
          </View>
        </View>
      )}
      {source && !suspendVideo && showWaitingSpinner && (
        <View pointerEvents="none" style={[styles.feedBufferingIndicator, { bottom: navBarHeight }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedChromeLockHud,
          {
            opacity: chromeLockHudOpacity,
            // Open-lock circle sits on the jam button's vertical center; track extends down.
            bottom:
              actionsBottom +
              (56 + FEED_ACTION_GAP) * 2 +
              56 / 2 -
              (FEED_CHROME_LOCK_TRACK_TRAVEL + FEED_CHROME_LOCK_CIRCLE_SIZE / 2),
          },
        ]}
      >
        <View
          style={[
            styles.feedChromeLockTrack,
            { height: FEED_CHROME_LOCK_TRACK_TRAVEL + FEED_CHROME_LOCK_CIRCLE_SIZE },
          ]}
        >
          <View style={styles.feedChromeLockPath} />
          <View
            style={[
              styles.feedChromeLockTarget,
              {
                opacity: 0.28 + chromePullProgress * 0.55,
                transform: [{ scale: 0.92 + chromePullProgress * 0.08 }],
              },
            ]}
          >
            <FeedChromeLockIcon open={false} size={18} />
          </View>
          <View
            style={[
              styles.feedChromeLockKnob,
              {
                transform: [{ translateY: chromePullProgress * FEED_CHROME_LOCK_TRACK_TRAVEL }],
              },
            ]}
          >
            <FeedChromeLockIcon open={!chromeLockHudSealed && chromePullProgress < 0.92} size={20} />
          </View>
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedSpeedHud,
          {
            opacity: speedHudOpacity,
            // Center on the full window (feed item stops above the tab bar).
            top: viewportHeight / 2 - FEED_SPEED_PILL_HEIGHT / 2,
            // Center on the action-icon column (56pt buttons at right: 18).
            right: 18 + (56 - FEED_SPEED_PILL_WIDTH) / 2,
          },
        ]}
      >
        <View style={styles.feedSpeedPill}>
          {FEED_PLAYBACK_SPEEDS.map((speed, index) => {
            const selected = index === speedIndex;
            return (
              <View key={speed} style={styles.feedSpeedRow}>
                <Text style={[styles.feedSpeedText, selected && styles.feedSpeedTextSelected]}>
                  {speed}x
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents={chromeInteractive ? "box-none" : "none"}
        style={[styles.feedOverlayLayer, { opacity: overlayOpacity }]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.40)", "rgba(0,0,0,0)"]}
          locations={[0, 1]}
          style={styles.feedTopShade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)"]}
          locations={[0.05, 1]}
          style={[styles.feedBottomShade, { bottom: navBarHeight }]}
        />
        <View style={[styles.feedMeta, { bottom: navBarHeight + 30 }]}>
          <View style={styles.row}>
            <Pressable onPress={onOpenProfile}>
              <Avatar uri={item.avatarUrl} size={52} />
            </Pressable>
            <View style={styles.flex}>
              <View style={styles.row}>
                <Pressable onPress={onOpenProfile}>
                  <Text style={styles.feedName}>{item.creatorName}</Text>
                </Pressable>
                {item.proBadge ? <ProBadge kind={item.proBadge} /> : null}
                {connection && <Text style={styles.badge}>{connection}</Text>}
              </View>
              <Text style={styles.feedRole}>{item.role} - {item.location}</Text>
            </View>
          </View>
          {item.lookingFor || caption ? (
            <View style={styles.feedCaptionRow}>
              {item.lookingFor ? (
                <View style={styles.feedLookingForIcon} accessibilityLabel="looking for collaborators">
                  <LookingForIcon active size={19} shadow />
                </View>
              ) : null}
              {caption ? <Text style={[styles.caption, styles.feedCaptionText]}>{caption}</Text> : null}
            </View>
          ) : null}
          {visibleTags.length > 0 ? (
            <View style={styles.tags}>
              {visibleTags.map((tag, index) => {
                const highlighted = Boolean(activeFilterTags?.has(normalizeVideoTag(tag)));
                return (
                  <Text
                    key={`${tag}-${index}`}
                    style={[styles.tag, highlighted ? styles.tagHighlighted : null]}
                  >
                    {tag}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={[styles.actions, { bottom: actionsBottom }]}>
        <Pressable
          onPress={pressJam}
          style={styles.actionButton}
          accessibilityLabel={
            item.mutual
              ? `Message ${item.creatorName} about this video`
              : jamPendingReply
              ? `Jam already sent to ${item.creatorName}`
              : `Jam with ${item.creatorName}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: jamAlreadySent }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  translateX: jamShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-5, 0, 5],
                  }),
                },
                {
                  rotate: jamShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ["-7deg", "0deg", "7deg"],
                  }),
                },
              ],
            }}
          >
            <JamJarIcon filled={jamAlreadySent} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={() => void pressSave()}
          style={styles.actionButton}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${item.creatorName} from saved` : `Save ${item.creatorName}`}
          accessibilityState={{ selected: saved }}
        >
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <BookmarkIcon filled={saved} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={openMoreMenu}
          style={styles.actionButton}
          accessibilityLabel={`More options for ${item.creatorName}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreMenuOpen }}
        >
          <Text style={[styles.actionText, styles.actionDotsText]}>⋯</Text>
        </Pressable>
      </View>
      </Animated.View>
      <Modal animationType="slide" transparent visible={moreMenuOpen} onRequestClose={() => setMoreMenuOpen(false)}>
        <View style={styles.feedMoreSheetWrap}>
          <Pressable
            style={styles.feedMoreSheetDismiss}
            onPress={() => setMoreMenuOpen(false)}
            accessibilityLabel="Close video options"
          />
          <View style={styles.feedMoreSheetCard}>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => runMoreMenuAction(onNotInterested)}
            >
              <Text style={styles.feedMoreMenuText}>Not interested</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => runMoreMenuAction(onBlock)}
            >
              <Text style={styles.feedMoreMenuDangerText}>Block</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => runMoreMenuAction(onReport)}
            >
              <Text style={styles.feedMoreMenuText}>Report</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}
