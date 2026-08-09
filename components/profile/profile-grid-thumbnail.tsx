import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import {
  ensureVideoAspectCached,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromSource,
  getVideoAspectCacheKeyFromVideo,
  imageResizeModeForVideoSize,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import {
  VideoPresentationOverlays,
} from "@/components/VideoPresentationOverlays";
import { probeHlsVideoSize } from "@/lib/native-cloudflare";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import {
  prewarmProfileVideoSource,
  touchProfileVideoPrewarm,
} from "@/lib/profile-video-prewarm";
import { getVideoPresentation } from "@/lib/profile-mappers";
import {
  getGridThumbnailCandidates,
  getVideoCaption,
  getVideoThumbnailTimeMs,
} from "@/lib/video-thumbnails";
import { getGridVideoSource, getVideoStreamId } from "@/lib/video-display";
import { styles } from "@/theme/styles";
import { viewportHeight, viewportWidth } from "@/theme/tokens";

export function ProfileGridThumbnail({
  video,
  blurred = false,
  prewarmEnabled = false,
  visibilitySyncRef,
  instantReveal = false,
  onReady,
}: {
  video: ProfileVideo | FeedVideo;
  blurred?: boolean;
  /** When true, start buffering HLS once this thumb intersects the viewport. */
  prewarmEnabled?: boolean;
  visibilitySyncRef?: MutableRefObject<Set<() => void>>;
  /** Skip the load crossfade (used for the long-press pin preview clone). */
  instantReveal?: boolean;
  /** Fires once the thumb image is painted (pin preview waits on this to avoid a blank flash). */
  onReady?: () => void;
}) {
  const streamId = getVideoStreamId(video);
  const aspectCacheKey = getVideoAspectCacheKeyFromVideo(video);
  const rememberedAspect = getRememberedVideoAspectSize(aspectCacheKey);
  const thumbnailTimeMs = getVideoThumbnailTimeMs(video);
  const mediaUri =
    ("mediaUrl" in video && video.mediaUrl) ||
    ("media_url" in video && video.media_url) ||
    null;
  const candidates = useMemo(
    () => getGridThumbnailCandidates(video),
    [video.id, streamId, thumbnailTimeMs, mediaUri],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [thumbResizeMode, setThumbResizeMode] = useState<"contain" | "cover">(() =>
    imageResizeModeForVideoSize(rememberedAspect?.width, rememberedAspect?.height),
  );
  const uri = candidates[candidateIndex] ?? null;
  const caption = getVideoCaption(video);
  const rootRef = useRef<View>(null);
  const prewarmedVisibleRef = useRef(false);
  const revealedRef = useRef(false);
  const revealGenerationRef = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  // Always start transparent; pin clones must never mount opaque before the bitmap paints.
  const thumbOpacity = useRef(new Animated.Value(0)).current;
  const placeholderOpacity = useRef(new Animated.Value(instantReveal ? 0 : 1)).current;

  function armThumbReveal() {
    const generation = ++revealGenerationRef.current;
    revealedRef.current = false;
    thumbOpacity.stopAnimation();
    placeholderOpacity.stopAnimation();
    placeholderOpacity.setValue(instantReveal ? 0 : 1);
    if (instantReveal) {
      // Don't yank thumbOpacity to 0 — cached onLoad often wins the race against this
      // effect and a reset would blank the clone after onReady (flash).
      return generation;
    }
    thumbOpacity.setValue(0);
    return generation;
  }

  function revealThumb(generation?: number) {
    if (generation != null && generation !== revealGenerationRef.current) return;
    if (revealedRef.current) return;
    revealedRef.current = true;
    if (instantReveal) {
      thumbOpacity.setValue(1);
      placeholderOpacity.setValue(0);
      onReadyRef.current?.();
      return;
    }
    Animated.parallel([
      Animated.timing(thumbOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(placeholderOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onReadyRef.current?.();
    });
  }

  useEffect(() => {
    setCandidateIndex(0);
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    setThumbResizeMode(imageResizeModeForVideoSize(cached?.width, cached?.height));
    prewarmedVisibleRef.current = false;
    armThumbReveal();
  }, [aspectCacheKey, video.id, streamId, thumbnailTimeMs, mediaUri, instantReveal]);

  useEffect(() => {
    // Arm a new reveal for this URI. Cached images often fire onLoad before this
    // effect; a blind reset afterward left opacity at 0 forever (blank grid cell
    // while fullscreen playback still worked). Generation + fallback fixes that.
    const generation = armThumbReveal();
    if (!uri) return;
    // Pin clones: short fallback so onReady still fires if load events are skipped.
    const timer = setTimeout(() => revealThumb(generation), instantReveal ? 320 : 480);
    return () => clearTimeout(timer);
  }, [uri, instantReveal]);

  // Warm aspect cache from HLS before the user taps into fullscreen.
  useEffect(() => {
    if (getRememberedVideoAspectSize(aspectCacheKey)) return;
    const gridSource = getGridVideoSource(video);
    if (!gridSource || !gridSource.includes(".m3u8")) return;
    let cancelled = false;
    void probeHlsVideoSize(gridSource).then((size) => {
      if (cancelled || !size) return;
      rememberVideoAspectSize(aspectCacheKey, size.width, size.height);
      rememberVideoAspectSize(getVideoAspectCacheKeyFromSource(gridSource), size.width, size.height);
      setThumbResizeMode(imageResizeModeForVideoSize(size.width, size.height));
    });
    return () => {
      cancelled = true;
    };
    // Depend on identity fields only — pin toggles must not retrigger probes.
  }, [aspectCacheKey, streamId, video.id]);

  useEffect(() => {
    if (!prewarmEnabled || blurred) return;

    const checkVisibility = () => {
      rootRef.current?.measureInWindow((x, y, width, height) => {
        if (!(width > 0 && height > 0)) return;
        const visible =
          y < viewportHeight &&
          y + height > 0 &&
          x < viewportWidth &&
          x + width > 0;
        if (!visible) return;
        const gridSource = getGridVideoSource(video);
        if (!gridSource) return;
        if (prewarmedVisibleRef.current) {
          touchProfileVideoPrewarm(gridSource);
          return;
        }
        prewarmedVisibleRef.current = true;
        prewarmProfileVideoSource(gridSource);
        void ensureVideoAspectCached(video);
      });
    };

    visibilitySyncRef?.current.add(checkVisibility);
    const frame = requestAnimationFrame(checkVisibility);
    const interval = setInterval(checkVisibility, 700);
    return () => {
      visibilitySyncRef?.current.delete(checkVisibility);
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
    // video.id only — pin metadata updates must not restart prewarm timers.
  }, [blurred, prewarmEnabled, video.id, visibilitySyncRef]);

  if (!uri) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.gridThumbPlaceholder]}>
        <Text style={styles.gridCaption}>{caption}</Text>
      </View>
    );
  }

  const presentation = getVideoPresentation(video);

  return (
    <View
      ref={rootRef}
      collapsable={false}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        // Pin-preview clone stays transparent until the bitmap paints so the
        // real grid thumb underneath doesn't get covered by a black flash.
        { backgroundColor: instantReveal ? "transparent" : "#000" },
      ]}
    >
      <Animated.View
        style={[styles.gridThumbPlaceholder, { opacity: placeholderOpacity }]}
      />
      <Animated.Image
        key={uri}
        alt={caption}
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: thumbOpacity }]}
        resizeMode={thumbResizeMode}
        blurRadius={blurred ? 18 : 0}
        onLoad={(event) => {
          const { width, height } = event.nativeEvent.source;
          // Wide clip thumbs are a reliable landscape signal; portrait image boxes are not
          // (local bake posters can be a tall canvas around landscape footage).
          if (width > height) {
            rememberVideoAspectSize(aspectCacheKey, width, height);
          }
          const cached = getRememberedVideoAspectSize(aspectCacheKey);
          setThumbResizeMode(
            imageResizeModeForVideoSize(cached?.width ?? width, cached?.height ?? height),
          );
          revealThumb();
        }}
        onLoadEnd={() => {
          // Cache hits sometimes skip onLoad after a late opacity reset; onLoadEnd
          // still runs and recovers the visible thumb.
          revealThumb();
        }}
        onError={() => {
          setCandidateIndex((current) => {
            if (current + 1 < candidates.length) return current + 1;
            // Last candidate failed — still unblock pin-preview waiters.
            onReadyRef.current?.();
            return current;
          });
        }}
      />
      {!blurred ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: thumbOpacity }]} pointerEvents="none">
          <VideoPresentationOverlays
            filter={presentation.filter}
            textOverlays={presentation.textOverlays}
            density="thumb"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
