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
import { useAudioPlayer } from "expo-audio";
import { viewportWidth } from "@/theme/tokens";

const DOT_SIZE = 6;
const DOT_GAP = 6;

export function JamSlideshowView({
  imageUrls,
  audioUrl,
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
  onIndexChangeRef.current = onIndexChange;
  const imagesKey = images.join("|");
  const player = useAudioPlayer(audioUrl, {
    updateInterval: 500,
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
    indexRef.current = 0;
    setIndex(0);
    onIndexChangeRef.current?.(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [imagesKey]);

  useEffect(() => {
    if (isActive) return;
    if (indexRef.current === 0) return;
    indexRef.current = 0;
    setIndex(0);
    onIndexChangeRef.current?.(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [isActive]);

  useEffect(() => {
    if (!audioUrl) return;
    try {
      player.loop = true;
      player.muted = false;
      player.volume = 1;
      if (shouldPlay && isActive) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Player may not be ready yet.
    }
  }, [audioUrl, isActive, player, shouldPlay]);

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
      <View style={{ width, height: "100%" }}>
        <Image
          source={{ uri: item }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={() => {
            if (itemIndex === 0 && !firstLoadSent.current) {
              firstLoadSent.current = true;
              onFirstImageLoad?.();
            }
          }}
        />
      </View>
    ),
    [onFirstImageLoad, width],
  );

  if (images.length === 0) {
    return <View style={[styles.root, style]} />;
  }

  const atStart = index === 0;
  const atEnd = index === images.length - 1;
  const canSwipeBack = swipeBackEnabled && atStart && Boolean(onSwipeBackStateChange);
  const edgePanEnabled = canSwipeBack || atEnd;
  const edgeActiveOffsetX = canSwipeBack && atEnd ? 12 : canSwipeBack ? ([-100000, 12] as [number, number]) : ([-12, 100000] as [number, number]);
  const edgeFailOffsetX = canSwipeBack && atEnd ? undefined : canSwipeBack ? ([-12, 100000] as [number, number]) : ([-100000, 12] as [number, number]);

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

  return (
    <View
      style={[styles.root, style]}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) setWidth(nextWidth);
      }}
    >
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
            windowSize={3}
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
