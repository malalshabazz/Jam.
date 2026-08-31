import { useEffect, useMemo, useRef, useState } from "react";
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
  type GestureResponderEvent,
} from "react-native";
import type {
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { type VideoContentFit } from "expo-video";
import { Avatar } from "@/components/ui/avatar";
import { ProBadge } from "@/components/ui/badges";
import { BookmarkIcon } from "@/components/icons/bookmark-icon";
import { FeedChromeLockIcon } from "@/components/icons/feed-chrome-lock-icon";
import { FeedPausedPlayIcon } from "@/components/icons/feed-paused-play-icon";
import { JamJarIcon } from "@/components/icons/jam-jar-icon";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import {
  contentFitForVideoSize,
  ensureVideoAspectCached,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromVideo,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import {
  JamVideoView,
  PROFILE_VIDEO_OPEN_GREY,
  type JamVideoPlaybackStatus,
} from "@/components/video/jam-video-view";
import { JamSlideshowView } from "@/components/video/jam-slideshow-view";
import {
  VideoPresentationOverlays,
} from "@/components/VideoPresentationOverlays";
import { triggerHoldHaptic } from "@/lib/hold-haptic";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import type { ProBadgeKind } from "@/lib/pro-entitlements";
import {
  getProfileFullscreenTags,
  getVideoPresentation,
  hasSentJam,
  isPendingSentJam,
  profileVideoToFeedVideo,
} from "@/lib/profile-mappers";
import { getGridVideoSource, getFeedPosterSource } from "@/lib/video-display";
import { getGridThumbnailCandidates, getVideoCaption } from "@/lib/video-thumbnails";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
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
  FEED_SPEED_PILL_PADDING_V,
  FEED_SPEED_PILL_WIDTH,
  FEED_SPEED_ROW_HEIGHT,
  FEED_SPEED_SEGMENT_PX,
  FEED_SPEED_ZONE_LEFT_RATIO,
  overlayIconShadow,
  overlayTextShadow,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";

export function ProfileFullscreenFeedItem({
  video,
  height,
  owner,
  isActive,
  videoBottomInset,
  actionsBottom,
  metaBottom,
  ownProfileNavBarHeight,
  ownVideoActions,
  chromeOpacity,
  chromeHolding = false,
  chromeLocked = false,
  onChromeHoldStart,
  onChromeHoldEnd,
  onChromeLock,
  onChromeUnlock,
  onSpeedHoldStart,
  onSpeedHoldEnd,
  onSave,
  onMessage,
  onOpenProfile,
  onNotInterested,
  onBlock,
  onReport,
  onSlideshowIndexChange,
  swipeBackEnabled = false,
  swipeBackTranslateX,
  swipeBackTranslateY,
  onSwipeBackStateChange,
}: {
  video: ProfileVideo | FeedVideo;
  height: number;
  owner: {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    earlyAdopter: boolean;
    proBadge?: ProBadgeKind | null;
  };
  isActive: boolean;
  videoBottomInset: number;
  actionsBottom: number;
  metaBottom: number;
  ownProfileNavBarHeight: number;
  ownVideoActions?: {
    userId: string;
    onDelete: (video: ProfileVideo | FeedVideo) => void;
    onEdited?: (video: ProfileVideo) => void;
    onShared?: () => void;
    onInsights: (video: ProfileVideo | FeedVideo) => void;
    insightsLocked?: boolean;
  };
  chromeOpacity?: Animated.Value;
  chromeHolding?: boolean;
  chromeLocked?: boolean;
  onChromeHoldStart?: () => void;
  onChromeHoldEnd?: () => void;
  onChromeLock?: () => void;
  onChromeUnlock?: () => void;
  onSpeedHoldStart?: () => void;
  onSpeedHoldEnd?: () => void;
  onSave: (video: ProfileVideo | FeedVideo, nextSaved: boolean) => void;
  onMessage: (video: ProfileVideo | FeedVideo) => void;
  onOpenProfile?: () => void;
  onNotInterested?: (video: ProfileVideo | FeedVideo) => void;
  onBlock?: (video: ProfileVideo | FeedVideo) => void;
  onReport?: (video: ProfileVideo | FeedVideo) => void;
  onSlideshowIndexChange?: (videoId: string, index: number) => void;
  swipeBackEnabled?: boolean;
  swipeBackTranslateX?: Animated.Value;
  swipeBackTranslateY?: Animated.Value;
  onSwipeBackStateChange?: (event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const source = getGridVideoSource(video);
  const feedItem = profileVideoToFeedVideo(video);
  const slideshowImages =
    ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls) ||
    ("image_urls" in video && Array.isArray(video.image_urls) && video.image_urls) ||
    feedItem?.imageUrls ||
    [];
  const isSlideshow =
    feedItem?.mediaType === "slideshow" ||
    ("mediaType" in video && video.mediaType === "slideshow") ||
    ("media_type" in video && video.media_type === "slideshow") ||
    slideshowImages.length > 0;
  const slideshowAudio =
    feedItem?.audioUrl ??
    ("audioUrl" in video ? video.audioUrl : null) ??
    ("audio_url" in video ? video.audio_url : null) ??
    null;
  const presentation = getVideoPresentation(video);
  const lookingFor = Boolean(
    feedItem?.lookingFor ||
      ("lookingFor" in video && video.lookingFor) ||
      ("looking_for" in video && (video as { looking_for?: boolean | null }).looking_for),
  );
  const aspectCacheKey = getVideoAspectCacheKeyFromVideo(video);
  const rememberedAspect = getRememberedVideoAspectSize(aspectCacheKey);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(Boolean(video.savedByMe));
  const [menuOpen, setMenuOpen] = useState(false);
  const [waitingForFirstPlay, setWaitingForFirstPlay] = useState(Boolean(source));
  const [showLoadingCover, setShowLoadingCover] = useState(Boolean(source));
  const [showWaitingSpinner, setShowWaitingSpinner] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const posterUri = useMemo(() => {
    if (feedItem) return getFeedPosterSource(feedItem);
    return getGridThumbnailCandidates(video)[0] ?? null;
  }, [feedItem, video]);
  const [mediaContentFit, setMediaContentFit] = useState<VideoContentFit>(() =>
    contentFitForVideoSize(rememberedAspect?.width, rememberedAspect?.height),
  );
  const [heartScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const loadingCoverOpacity = useRef(new Animated.Value(1)).current;
  /** Window Y of the top of own-video meta (avatar row); taps at/below ignore pause. */
  const ownMetaTopPageYRef = useRef<number | null>(null);
  const ownMetaMeasureRef = useRef<View>(null);
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
  const connection = feedItem?.mutual ? "jamming" : feedItem?.jammedMe ? "jammed you" : null;
  const hasJam = Boolean(feedItem && hasSentJam(feedItem));
  const pendingJam = Boolean(feedItem && isPendingSentJam(feedItem));
  const caption = getVideoCaption(video);
  const tags = getProfileFullscreenTags(video);
  const showModerationMenu = Boolean(onNotInterested && onBlock && onReport);
  const chromeInteractive = !chromeHolding && !chromeLocked;
  const overlayOpacity = chromeOpacity ?? 1;

  useEffect(() => {
    setSaved(Boolean(video.savedByMe));
  }, [video.id, video.savedByMe]);

  useEffect(() => {
    setPaused(false);
    setMenuOpen(false);
    setWaitingForFirstPlay(Boolean(source));
    setShowLoadingCover(Boolean(source));
    setShowWaitingSpinner(false);
    setPosterFailed(false);
    ownMetaTopPageYRef.current = null;
    loadingCoverOpacity.stopAnimation();
    loadingCoverOpacity.setValue(1);
    const cached = getRememberedVideoAspectSize(getVideoAspectCacheKeyFromVideo(video));
    setMediaContentFit(contentFitForVideoSize(cached?.width, cached?.height));
    speedIndexRef.current = FEED_SPEED_DEFAULT_INDEX;
    setSpeedIndex(FEED_SPEED_DEFAULT_INDEX);
    setPlaybackRate(1);
    speedHudOpacity.setValue(0);
  }, [loadingCoverOpacity, source, speedHudOpacity, video.id]);

  useEffect(() => {
    setPosterFailed(false);
    if (posterUri) void Image.prefetch(posterUri);
  }, [posterUri]);

  useEffect(() => {
    if (!isActive || paused || !source || !waitingForFirstPlay) {
      setShowWaitingSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowWaitingSpinner(true), 800);
    return () => clearTimeout(timer);
  }, [isActive, paused, source, waitingForFirstPlay]);

  const greyRevealedRef = useRef(false);

  useEffect(() => {
    greyRevealedRef.current = false;
  }, [video.id, source]);

  function revealFirstFrameFromGrey() {
    if (greyRevealedRef.current) return;
    greyRevealedRef.current = true;
    setWaitingForFirstPlay(false);
    setShowWaitingSpinner(false);
    loadingCoverOpacity.stopAnimation();
    Animated.timing(loadingCoverOpacity, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowLoadingCover(false);
    });
  }

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

  function isOwnBottomChromePageY(pageY: number) {
    if (!ownVideoActions) return false;
    const metaTop = ownMetaTopPageYRef.current;
    if (metaTop != null) return pageY >= metaTop;
    // Fallback before measure: approximate band from avatar through bottom.
    return pageY >= height - metaBottom - 200;
  }

  function measureOwnMetaTop() {
    if (!ownVideoActions) return;
    ownMetaMeasureRef.current?.measureInWindow((_x, y) => {
      // Line sits just above the avatar / name block.
      ownMetaTopPageYRef.current = Math.max(0, y - 8);
    });
  }

  function handleProfileTouchStart(locationX: number, pageY: number) {
    clearChromeHoldTimer();
    chromeTouchStartXRef.current = locationX;
    chromeTouchStartYRef.current = pageY;
    chromeTouchMovedRef.current = false;
    chromePullProgressRef.current = 0;
    chromeTouchInSpeedZoneRef.current = locationX >= viewportWidth * FEED_SPEED_ZONE_LEFT_RATIO;
    if (menuOpen) return;
    if (isOwnBottomChromePageY(pageY)) return;
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

  function handleProfileTouchMove(pageY: number, locationX?: number) {
    const startY = chromeTouchStartYRef.current;
    if (startY == null) return;
    const dy = pageY - startY;
    const startX = chromeTouchStartXRef.current;
    const dx = startX != null && locationX != null ? locationX - startX : 0;

    if (!chromeHoldingRef.current && !speedHoldingRef.current) {
      if (Math.abs(dy) > 12 || Math.abs(dx) > 12) {
        chromeTouchMovedRef.current = true;
        clearChromeHoldTimer();
      }
      return;
    }

    if (speedHoldingRef.current) {
      const nextIndex = Math.round(speedDragBaseIndexRef.current + dy / FEED_SPEED_SEGMENT_PX);
      applySpeedIndex(nextIndex);
      return;
    }

    const progress = Math.min(1, Math.max(0, dy / FEED_CHROME_LOCK_PULL_PX));
    chromePullProgressRef.current = progress;
    setChromePullProgress(progress);
    setChromeLockHudSealed(progress >= 1);
  }

  function handleProfileTouchEnd() {
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

    hideChromeLockHud();

    if (chromePullProgressRef.current >= 1 && !chromeLockedRef.current) {
      onChromeLock?.();
      return;
    }

    if (!chromeLockedRef.current) {
      onChromeHoldEnd?.();
    }
  }

  function togglePlayback() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (!source && !isSlideshow) return;
    setPaused((current) => !current);
  }

  function handleProfilePress(event: GestureResponderEvent) {
    if (chromeTouchMovedRef.current) {
      chromeTouchMovedRef.current = false;
      return;
    }
    if (chromeSuppressPressRef.current) {
      chromeSuppressPressRef.current = false;
      return;
    }
    if (chromeLockedRef.current) {
      onChromeUnlock?.();
      return;
    }
    if (chromeHoldingRef.current || speedHoldingRef.current) return;
    if (isOwnBottomChromePageY(event.nativeEvent.pageY)) {
      if (menuOpen) setMenuOpen(false);
      return;
    }
    togglePlayback();
  }

  function runSaveAnimation() {
    heartScale.setValue(1);
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
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

  function pressSave() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (nextSaved) runSaveAnimation();
    onSave(video, nextSaved);
  }

  function pressJam() {
    if (pendingJam) {
      runJamShakeAnimation();
      return;
    }
    onMessage(video);
  }

  const videoFrameStyle = ownVideoActions
    ? [styles.feedPreviewVideoClip, { bottom: ownProfileNavBarHeight }]
    : [styles.feedVideoLayer, styles.feedVideoViewportClip, { bottom: videoBottomInset }];

  return (
    <Pressable
      style={{ height, width: viewportWidth, backgroundColor: "#09090b" }}
      onPress={handleProfilePress}
      onPressIn={(event) =>
        handleProfileTouchStart(event.nativeEvent.locationX, event.nativeEvent.pageY)
      }
      onTouchMove={(event) =>
        handleProfileTouchMove(event.nativeEvent.pageY, event.nativeEvent.locationX)
      }
      onPressOut={handleProfileTouchEnd}
      delayLongPress={FEED_CHROME_HOLD_MS + 400}
    >
      <View style={[videoFrameStyle, { backgroundColor: "#09090b" }]}>
        {isSlideshow && slideshowImages.length > 0 ? (
          <>
            <JamSlideshowView
              imageUrls={slideshowImages as string[]}
              audioUrl={typeof slideshowAudio === "string" ? slideshowAudio : null}
              shouldPlay={isActive && !paused}
              isActive={isActive}
              style={StyleSheet.absoluteFill}
              onFirstImageLoad={revealFirstFrameFromGrey}
              onIndexChange={(nextIndex) => onSlideshowIndexChange?.(video.id, nextIndex)}
              swipeBackEnabled={swipeBackEnabled && isActive}
              swipeBackTranslateX={swipeBackTranslateX}
              swipeBackTranslateY={swipeBackTranslateY}
              onSwipeBackStateChange={onSwipeBackStateChange}
            />
            {isActive && paused ? (
              <View pointerEvents="none" style={styles.feedPausedPlayOverlay}>
                <FeedPausedPlayIcon />
              </View>
            ) : null}
            {showLoadingCover ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "#09090b", opacity: loadingCoverOpacity },
                ]}
              >
                {posterUri && !posterFailed ? (
                  <Image
                    source={{ uri: posterUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={mediaContentFit === "contain" ? "contain" : "cover"}
                    onError={() => setPosterFailed(true)}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: PROFILE_VIDEO_OPEN_GREY }]} />
                )}
              </Animated.View>
            ) : null}
          </>
        ) : source ? (
          <>
            <JamVideoView
              key={video.id}
              source={source}
              style={StyleSheet.absoluteFill}
              contentFit={mediaContentFit}
              knownWidth={rememberedAspect?.width ?? null}
              knownHeight={rememberedAspect?.height ?? null}
              shouldPlay={isActive && !paused}
              isLooping
              isMuted={!isActive || paused}
              volume={isActive && !paused ? 1 : 0}
              playbackRate={playbackRate}
              // Match Discover: only cover with a thumb when scrolling away —
              // tap-pause must keep the live decoded frame (CF thumb was black-flashing).
              showFreezeFrameOnPause={!isActive}
              adoptPrewarmed={isActive}
              onFirstFrameRender={revealFirstFrameFromGrey}
              onContentFitChange={setMediaContentFit}
            />
            <VideoPresentationOverlays
              filter={presentation.filter}
              textOverlays={presentation.textOverlays}
            />
            {isActive && paused ? (
              <View pointerEvents="none" style={styles.feedPausedPlayOverlay}>
                <FeedPausedPlayIcon />
              </View>
            ) : null}
            {showLoadingCover ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "#09090b", opacity: loadingCoverOpacity },
                ]}
              >
                {posterUri && !posterFailed ? (
                  <Image
                    source={{ uri: posterUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={mediaContentFit === "contain" ? "contain" : "cover"}
                    onError={() => setPosterFailed(true)}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: PROFILE_VIDEO_OPEN_GREY }]} />
                )}
              </Animated.View>
            ) : null}
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}>
            <Avatar uri={owner.avatarUrl} size={90} />
            <Text style={styles.h2}>{owner.creatorName}</Text>
            <Text style={styles.helper}>video unavailable</Text>
          </View>
        )}
      </View>

      {source && showWaitingSpinner ? (
        <View pointerEvents="none" style={styles.videoBufferingIndicator}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedChromeLockHud,
          {
            opacity: chromeLockHudOpacity,
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
            top: viewportHeight / 2 - FEED_SPEED_PILL_HEIGHT / 2,
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
          style={[styles.feedBottomShade, { bottom: videoBottomInset }]}
        />

        <View
          ref={ownVideoActions ? ownMetaMeasureRef : undefined}
          collapsable={false}
          style={[styles.feedMeta, { bottom: metaBottom }]}
          pointerEvents="box-none"
          onLayout={ownVideoActions ? measureOwnMetaTop : undefined}
        >
          <View style={styles.row}>
            {onOpenProfile && !ownVideoActions ? (
              <Pressable
                onPress={onOpenProfile}
                accessibilityLabel={`open ${owner.creatorName}'s profile`}
                accessibilityRole="button"
              >
                <Avatar uri={owner.avatarUrl} size={52} />
              </Pressable>
            ) : (
              <Avatar uri={owner.avatarUrl} size={52} />
            )}
            <View style={styles.flex}>
              <View style={styles.row}>
                {onOpenProfile && !ownVideoActions ? (
                  <Pressable
                    onPress={onOpenProfile}
                    accessibilityLabel={`open ${owner.creatorName}'s profile`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.feedName}>{owner.creatorName}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.feedName}>{owner.creatorName}</Text>
                )}
                {owner.proBadge ? <ProBadge kind={owner.proBadge} /> : null}
                {connection ? <Text style={styles.badge}>{connection}</Text> : null}
              </View>
              <Text style={styles.feedRole}>
                {owner.role} - {owner.location}
              </Text>
            </View>
          </View>
          {lookingFor || caption ? (
            <View style={styles.feedCaptionRow}>
              {lookingFor ? (
                <View style={styles.feedLookingForIcon} accessibilityLabel="looking for collaborators">
                  <LookingForIcon active size={19} shadow />
                </View>
              ) : null}
              {caption ? <Text style={[styles.caption, styles.feedCaptionText]}>{caption}</Text> : null}
            </View>
          ) : null}
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((tag, tagIndex) => (
                <Text key={`${tag}-${tagIndex}`} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.actions, { bottom: actionsBottom }]} pointerEvents="box-none">
          {ownVideoActions ? null : (
            <>
              <Pressable
                onPress={pressJam}
                style={styles.actionButton}
                accessibilityLabel={
                  feedItem?.mutual
                    ? `Message ${owner.creatorName} about this video`
                    : pendingJam
                      ? `Jam already sent to ${owner.creatorName}`
                      : `Jam with ${owner.creatorName}`
                }
                accessibilityRole="button"
                accessibilityState={{ selected: hasJam }}
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
                  <JamJarIcon filled={hasJam} />
                </Animated.View>
              </Pressable>
              <Pressable
                onPress={pressSave}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel={saved ? "Remove from saved" : "Save video"}
                accessibilityState={{ selected: saved }}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <BookmarkIcon filled={saved} />
                </Animated.View>
              </Pressable>
              {showModerationMenu ? (
                <Pressable
                  onPress={() => setMenuOpen((current) => !current)}
                  style={styles.actionButton}
                  accessibilityLabel={`More options for ${owner.creatorName}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: menuOpen }}
                >
                  <Text style={[styles.actionText, styles.actionDotsText]}>⋯</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </Animated.View>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(menuOpen && !ownVideoActions)}
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.feedMoreSheetWrap}>
          <Pressable
            style={styles.feedMoreSheetDismiss}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Close video options"
          />
          <View style={styles.feedMoreSheetCard}>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onNotInterested?.(video);
              }}
            >
              <Text style={styles.feedMoreMenuText}>Not interested</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onBlock?.(video);
              }}
            >
              <Text style={styles.feedMoreMenuDangerText}>Block</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onReport?.(video);
              }}
            >
              <Text style={styles.feedMoreMenuText}>Report</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}
