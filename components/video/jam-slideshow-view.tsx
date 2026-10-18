import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  FlatList,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioPlayer, type AudioStatus } from "expo-audio";
import { LetterboxMediaShell } from "@/components/media/letterbox-media-shell";
import { mediaFitForSize } from "@/components/video/aspect-cache";
import { markSlideshowImageLoaded } from "@/lib/slideshow-prewarm";
import { viewportWidth } from "@/theme/tokens";

const DOT_SIZE = 6;
const DOT_GAP = 6;
const AUDIO_END_EPSILON_SEC = 0.03;
const AUDIO_BEFORE_START_EPSILON_SEC = 0.1;

/** Natural image sizes for slideshow cover/contain — cached per URL. */
const slideshowImageSizeByUrl = new Map<string, { width: number; height: number }>();

function rememberSlideshowImageSize(uri: string, width: number, height: number) {
  if (!(width > 0 && height > 0)) return;
  slideshowImageSizeByUrl.set(uri, { width, height });
}

function SlideshowSlide({
  uri,
  width,
  onReady,
}: {
  uri: string;
  width: number;
  onReady?: () => void;
}) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const notifiedRef = useRef(false);
  const [painted, setPainted] = useState(false);
  const [measured, setMeasured] = useState<{ uri: string; width: number; height: number } | null>(
    () => {
      const cached = slideshowImageSizeByUrl.get(uri);
      return cached ? { uri, width: cached.width, height: cached.height } : null;
    },
  );

  useEffect(() => {
    notifiedRef.current = false;
    setPainted(false);
  }, [uri]);

  const naturalSize =
    measured?.uri === uri
      ? measured
      : slideshowImageSizeByUrl.get(uri) ?? null;

  useEffect(() => {
    if (naturalSize || !uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (imageWidth, imageHeight) => {
        if (cancelled || !(imageWidth > 0 && imageHeight > 0)) return;
        rememberSlideshowImageSize(uri, imageWidth, imageHeight);
        setMeasured({ uri, width: imageWidth, height: imageHeight });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [naturalSize, uri]);

  const notifyReady = useCallback(() => {
    markSlideshowImageLoaded(uri);
    setPainted(true);
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    onReadyRef.current?.();
  }, [uri]);

  // Until natural size is known, contain — cover only once confirmed near 9:16.
  const resizeMode = mediaFitForSize(naturalSize?.width, naturalSize?.height);

  return (
    <LetterboxMediaShell
      loaded={painted}
      previewUri={uri}
      previewContentFit={resizeMode}
      overlayFadeMs={0}
      style={[slideStyles.frame, { width }]}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        fadeDuration={0}
        onLoad={(event) => {
          const source = event.nativeEvent.source;
          if (source?.width > 0 && source?.height > 0) {
            rememberSlideshowImageSize(uri, source.width, source.height);
            setMeasured({ uri, width: source.width, height: source.height });
          }
          notifyReady();
        }}
        onLoadEnd={notifyReady}
      />
    </LetterboxMediaShell>
  );
}

const slideStyles = StyleSheet.create({
  frame: {
    height: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
  },
});

export function JamSlideshowView({
  imageUrls,
  audioUrl,
  audioStartMs = null,
  audioDurationMs = null,
  shouldPlay,
  isActive = true,
  style,
  onFirstImageLoad,
  onIndexChange,
  swipeBackEnabled = false,
  swipeBackTranslateX,
  swipeBackTranslateY,
  onSwipeBackStateChange,
}: {
  imageUrls: string[];
  audioUrl: string | null;
  audioStartMs?: number | null;
  audioDurationMs?: number | null;
  shouldPlay: boolean;
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  onFirstImageLoad?: () => void;
  onIndexChange?: (index: number) => void;
  swipeBackEnabled?: boolean;
  swipeBackTranslateX?: Animated.Value;
  swipeBackTranslateY?: Animated.Value;
  onSwipeBackStateChange?: (event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const images = useMemo(
    () => imageUrls.map((uri) => uri.trim()).filter(Boolean).slice(0, 10),
    [imageUrls],
  );
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(viewportWidth);
  const listRef = useRef<FlatList<string>>(null);
  const edgePanRef = useRef<PanGestureHandler>(null);
  const resistX = useRef(new Animated.Value(0)).current;
  const firstLoadSent = useRef(false);
  const indexRef = useRef(0);
  const onIndexChangeRef = useRef(onIndexChange);
  const imagesKey = images.join("|");
  const pausedAudioSecRef = useRef<number | null>(null);
  const seekInFlightRef = useRef(false);
  const pendingCropTargetRef = useRef<{ sec: number; playAfter: boolean } | null>(null);
  const cropSeekRunningRef = useRef(false);
  const lastLoopRef = useRef<boolean | null>(null);
  const lastMutedRef = useRef<boolean | null>(null);
  const lastVolumeRef = useRef<number | null>(null);
  const shouldPlayRef = useRef(shouldPlay);
  const isActiveRef = useRef(isActive);
  const runCropSeekRef = useRef<() => void>(() => {});

  const cropStartSec =
    typeof audioStartMs === "number" && Number.isFinite(audioStartMs) && audioStartMs >= 0
      ? audioStartMs / 1000
      : null;
  const cropDurationSec =
    typeof audioDurationMs === "number" && Number.isFinite(audioDurationMs) && audioDurationMs > 0
      ? audioDurationMs / 1000
      : null;
  const hasAudioCrop = cropStartSec != null && cropDurationSec != null;
  const cropStartSecRef = useRef(cropStartSec);
  const cropDurationSecRef = useRef(cropDurationSec);
  const hasAudioCropRef = useRef(hasAudioCrop);

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    shouldPlayRef.current = shouldPlay;
    isActiveRef.current = isActive;
    cropStartSecRef.current = cropStartSec;
    cropDurationSecRef.current = cropDurationSec;
    hasAudioCropRef.current = hasAudioCrop;
  }, [cropDurationSec, cropStartSec, hasAudioCrop, isActive, onIndexChange, shouldPlay]);

  const player = useAudioPlayer(audioUrl, {
    updateInterval: hasAudioCrop ? 80 : 500,
    downloadFirst: false,
    keepAudioSessionActive: true,
  });

  const updateIndex = useCallback(
    (next: number) => {
      const safe = Math.max(0, Math.min(images.length - 1, next));
      if (indexRef.current === safe) return;
      indexRef.current = safe;
      setIndex(safe);
      onIndexChangeRef.current?.(safe);
    },
    [images.length],
  );

  useEffect(() => {
    firstLoadSent.current = false;
    indexRef.current = 0;
    pausedAudioSecRef.current = null;
    setIndex(0);
    onIndexChangeRef.current?.(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [imagesKey]);

  useEffect(() => {
    const first = images[0];
    if (!first) return;
    let cancelled = false;
    void Image.prefetch(first).then(() => {
      if (cancelled) return;
      for (const uri of images.slice(1)) {
        void Image.prefetch(uri);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imagesKey]);

  useEffect(() => {
    if (isActive) return;
    pausedAudioSecRef.current = null;
    if (indexRef.current === 0) return;
    indexRef.current = 0;
    setIndex(0);
    onIndexChangeRef.current?.(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [isActive]);

  useEffect(() => {
    pendingCropTargetRef.current = null;
    cropSeekRunningRef.current = false;

    if (!audioUrl) {
      lastLoopRef.current = null;
      lastMutedRef.current = null;
      lastVolumeRef.current = null;
      seekInFlightRef.current = false;
      return;
    }

    const windowBounds = () => {
      const start = cropStartSecRef.current ?? 0;
      const duration = cropDurationSecRef.current ?? 0;
      return { startSec: start, endSec: start + Math.max(0.1, duration) };
    };

    const clampToWindow = (sec: number) => {
      const { startSec, endSec } = windowBounds();
      return Math.min(endSec - 0.05, Math.max(startSec, sec));
    };

    const seekExact = (sec: number) => {
      if (__DEV__) {
        console.log("[jam-slideshow] seek target", sec);
      }
      return player.seekTo(sec, 0, 0).then(() => {
        if (__DEV__) {
          console.log("[jam-slideshow] landed currentTime", player.currentTime);
        }
      });
    };

    runCropSeekRef.current = () => {
      if (cropSeekRunningRef.current) return;
      const target = pendingCropTargetRef.current;
      if (!target) return;
      pendingCropTargetRef.current = null;
      cropSeekRunningRef.current = true;
      void seekExact(target.sec)
        .catch((error) => {
          if (__DEV__) {
            console.warn("[jam-slideshow] seek error", error);
          }
        })
        .finally(() => {
          cropSeekRunningRef.current = false;
          if (pendingCropTargetRef.current) {
            runCropSeekRef.current();
            return;
          }
          if (target.playAfter && shouldPlayRef.current && isActiveRef.current) {
            try {
              player.play();
            } catch (error) {
              if (__DEV__) {
                console.warn("[jam-slideshow] play error", error);
              }
            }
          }
        });
    };

    const enqueueCropSeek = (sec: number, playAfter: boolean) => {
      pendingCropTargetRef.current = { sec, playAfter };
      runCropSeekRef.current();
    };

    const nextLoop = !hasAudioCropRef.current;
    if (lastLoopRef.current !== nextLoop) {
      lastLoopRef.current = nextLoop;
      player.loop = nextLoop;
    }
    if (lastMutedRef.current !== false) {
      lastMutedRef.current = false;
      player.muted = false;
    }
    if (lastVolumeRef.current !== 1) {
      lastVolumeRef.current = 1;
      player.volume = 1;
    }

    const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (!hasAudioCropRef.current) return;
      if (!status.isLoaded) return;
      if (!shouldPlayRef.current || !isActiveRef.current) return;

      const { startSec, endSec } = windowBounds();
      if (__DEV__ && status.didJustFinish) {
        console.log("[jam-slideshow] didJustFinish", status.currentTime);
      }
      const pastEnd = status.currentTime >= endSec - AUDIO_END_EPSILON_SEC;
      const beforeStart = status.currentTime < startSec - AUDIO_BEFORE_START_EPSILON_SEC;
      if (pastEnd || status.didJustFinish || beforeStart) {
        enqueueCropSeek(startSec, true);
      }
    });

    let watchdog: ReturnType<typeof setInterval> | null = null;
    if (hasAudioCrop) {
      watchdog = setInterval(() => {
        if (!shouldPlayRef.current || !isActiveRef.current) return;
        if (cropSeekRunningRef.current || pendingCropTargetRef.current != null) return;

        let currentTime = 0;
        let isPlaying = false;
        try {
          currentTime = player.currentTime ?? 0;
          isPlaying = Boolean(player.playing);
        } catch {
          return;
        }

        const { startSec, endSec } = windowBounds();
        const outside =
          currentTime < startSec - AUDIO_BEFORE_START_EPSILON_SEC ||
          currentTime >= endSec - AUDIO_END_EPSILON_SEC;
        if (outside) {
          enqueueCropSeek(startSec, true);
          return;
        }
        if (!isPlaying) {
          try {
            player.play();
          } catch (error) {
            if (__DEV__) {
              console.warn("[jam-slideshow] watchdog play error", error);
            }
          }
        }
      }, 250);
    }

    try {
      if (shouldPlay && isActive) {
        const restore = pausedAudioSecRef.current;
        pausedAudioSecRef.current = null;
        const start = () => {
          try {
            player.play();
          } catch {
            /* Player may not be ready yet. */
          }
        };
        if (restore != null && restore > 0.05) {
          const target = hasAudioCrop ? clampToWindow(restore) : restore;
          let current = 0;
          try {
            current = player.currentTime ?? 0;
          } catch {
            current = 0;
          }
          if (current <= 0.15 || Math.abs(current - target) > 0.25) {
            if (hasAudioCrop) {
              enqueueCropSeek(target, true);
            } else {
              seekInFlightRef.current = true;
              void seekExact(target)
                .then(start)
                .catch(start)
                .finally(() => {
                  seekInFlightRef.current = false;
                });
            }
            return () => {
              subscription.remove();
              if (watchdog) clearInterval(watchdog);
            };
          }
        } else if (hasAudioCrop) {
          const { startSec, endSec } = windowBounds();
          let current = 0;
          try {
            current = player.currentTime ?? 0;
          } catch {
            current = 0;
          }
          if (current < startSec - AUDIO_BEFORE_START_EPSILON_SEC || current >= endSec - AUDIO_END_EPSILON_SEC) {
            enqueueCropSeek(startSec, true);
            return () => {
              subscription.remove();
              if (watchdog) clearInterval(watchdog);
            };
          }
        }
        start();
      } else {
        try {
          const current = player.currentTime ?? 0;
          if (current > 0.05) {
            pausedAudioSecRef.current = hasAudioCrop ? clampToWindow(current) : current;
          }
        } catch {
          /* ignore */
        }
        player.pause();
      }
    } catch {
      // Player may not be ready yet.
    }

    return () => {
      subscription.remove();
      if (watchdog) clearInterval(watchdog);
    };
  }, [audioUrl, hasAudioCrop, isActive, player, shouldPlay]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const pageWidth = Math.max(1, width);
      const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      updateIndex(next);
    },
    [updateIndex, width],
  );

  const goTo = useCallback(
    (nextIndex: number) => {
      const safe = Math.max(0, Math.min(images.length - 1, nextIndex));
      updateIndex(safe);
      listRef.current?.scrollToOffset({ offset: safe * width, animated: true });
    },
    [images.length, updateIndex, width],
  );

  const renderItem = useCallback(
    ({ item, index: itemIndex }: ListRenderItemInfo<string>) => (
      <SlideshowSlide
        uri={item}
        width={width}
        onReady={
          itemIndex === 0
            ? () => {
                if (firstLoadSent.current) return;
                firstLoadSent.current = true;
                onFirstImageLoad?.();
              }
            : undefined
        }
      />
    ),
    [onFirstImageLoad, width],
  );

  const atStart = index === 0;
  const atEnd = images.length > 0 && index === images.length - 1;
  const canSwipeBack = swipeBackEnabled && atStart && Boolean(onSwipeBackStateChange);
  const edgePanEnabled = canSwipeBack || atEnd;
  const edgeActiveOffsetX =
    canSwipeBack && atEnd
      ? 12
      : canSwipeBack
        ? ([-100000, 12] as [number, number])
        : ([-12, 100000] as [number, number]);
  const edgeFailOffsetX =
    canSwipeBack && atEnd
      ? undefined
      : canSwipeBack
        ? ([-12, 100000] as [number, number])
        : ([-100000, 12] as [number, number]);

  const handleEdgePanGesture = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationX, translationY } = event.nativeEvent;
      if (canSwipeBack && translationX > 0) {
        resistX.setValue(0);
        swipeBackTranslateX?.setValue(translationX);
        swipeBackTranslateY?.setValue(translationY);
        return;
      }
      if (atEnd && translationX < 0) {
        resistX.setValue(translationX / (1 + Math.abs(translationX) / 140));
      }
    },
    [atEnd, canSwipeBack, resistX, swipeBackTranslateX, swipeBackTranslateY],
  );

  const handleEdgePanStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { state, translationX } = event.nativeEvent;
      const ended = state === State.END || state === State.CANCELLED || state === State.FAILED;
      if (canSwipeBack && translationX > 8) {
        onSwipeBackStateChange?.(event);
        return;
      }
      if (ended) {
        Animated.spring(resistX, {
          toValue: 0,
          damping: 20,
          stiffness: 260,
          mass: 0.7,
          useNativeDriver: true,
        }).start();
      }
    },
    [canSwipeBack, onSwipeBackStateChange, resistX],
  );

  if (images.length === 0) {
    return <View style={[styles.root, style]} />;
  }

  // TikTok-style: black behind the status bar; cover/contain slides fill only
  // the below-status-bar box down to the caller's bottom edge (nav bar).
  const mediaBoxStyle = {
    position: "absolute" as const,
    top: insets.top,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden" as const,
    backgroundColor: "#000",
  };

  return (
    <View
      style={[styles.root, style]}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) setWidth(nextWidth);
      }}
    >
      <View style={mediaBoxStyle}>
        <PanGestureHandler
          ref={edgePanRef}
          enabled={edgePanEnabled}
          activeOffsetX={edgeActiveOffsetX}
          failOffsetX={edgeFailOffsetX}
          failOffsetY={[-24, 24]}
          onGestureEvent={handleEdgePanGesture}
          onHandlerStateChange={handleEdgePanStateChange}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: resistX }] }]}>
            <FlatList
              ref={listRef}
              data={images}
              keyExtractor={(uri, i) => `${i}:${uri}`}
              horizontal
              pagingEnabled
              directionalLockEnabled
              nestedScrollEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              renderItem={renderItem}
              waitFor={edgePanEnabled ? edgePanRef : undefined}
              onMomentumScrollEnd={onMomentumEnd}
              onScrollEndDrag={onMomentumEnd}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              initialNumToRender={2}
              windowSize={8}
              maxToRenderPerBatch={2}
              removeClippedSubviews={false}
            />
          </Animated.View>
        </PanGestureHandler>
        {images.length > 1 ? (
          <View pointerEvents="box-none" style={styles.dotsWrap}>
            <View style={styles.dotsPill}>
              {images.map((_, i) => (
                <Pressable
                  key={`dot-${i}`}
                  onPress={() => goTo(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`slide ${i + 1}`}
                  style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle]}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  dotsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center",
  },
  dotsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: DOT_GAP,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  dotActive: {
    backgroundColor: "#fff",
  },
  dotIdle: {
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});
