import { useCallback, useRef } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { VideoPresentationOverlays } from "@/components/VideoPresentationOverlays";
import { FeedPausedPlayIcon } from "@/components/icons/feed-paused-play-icon";
import { mediaFitForSize } from "@/components/video/aspect-cache";
import { JamVideoView, type JamVideoPlaybackStatus } from "@/components/video/jam-video-view";
import { styles } from "@/theme/styles";
import { FEED_VIDEO_BOTTOM_CORNER_RADIUS } from "@/theme/tokens";
import type { CreateEditItem } from "@/types/app";

const DOT_SIZE = 6;
const DOT_GAP = 6;

export function CreateEditAlbumPager({
  items,
  index,
  width,
  height,
  cardRect,
  shouldPlay,
  paused = false,
  needsSelfieMirror,
  trimStartRatio,
  trimEndRatio,
  scrubToRatio,
  trimPlaybackResumeSignal,
  timeUpdateIntervalSec,
  muteVideos,
  hideActiveOverlays,
  onIndexChange,
  onPageScrollStart,
  onPageScrollEnd,
  onDurationResolved,
  onPlaybackStatusUpdate,
  onMediaPress,
}: {
  items: CreateEditItem[];
  index: number;
  width: number;
  height: number;
  /** 9:16 card in pager coordinates (pager origin = screen y=0). */
  cardRect: { left: number; top: number; width: number; height: number };
  shouldPlay: boolean;
  paused?: boolean;
  needsSelfieMirror: boolean;
  trimStartRatio: number;
  trimEndRatio: number;
  scrubToRatio: number | null;
  trimPlaybackResumeSignal: number;
  timeUpdateIntervalSec: number;
  muteVideos: boolean;
  hideActiveOverlays: boolean;
  onIndexChange: (index: number) => void;
  onPageScrollStart?: () => void;
  onPageScrollEnd?: () => void;
  onDurationResolved: (durationMs: number) => void;
  onPlaybackStatusUpdate?: (status: JamVideoPlaybackStatus) => void;
  onMediaPress?: () => void;
}) {
  const listRef = useRef<FlatList<CreateEditItem>>(null);
  const pageWidth = Math.max(1, width);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      onIndexChange(Math.max(0, Math.min(items.length - 1, next)));
      onPageScrollEnd?.();
    },
    [items.length, onIndexChange, onPageScrollEnd, pageWidth],
  );

  const renderItem = useCallback(
    ({ item, index: itemIndex }: ListRenderItemInfo<CreateEditItem>) => {
      const active = itemIndex === index;
      const showSlideOverlays = !active || hideActiveOverlays;
      const imageFit = mediaFitForSize(item.width, item.height);
      const media = (
        <>
          {item.kind === "image" ? (
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode={imageFit}
            />
          ) : (
            <JamVideoView
              source={item.uri}
              style={[
                StyleSheet.absoluteFill,
                needsSelfieMirror ? { transform: [{ scaleX: -1 }] } : null,
              ]}
              knownWidth={item.width}
              knownHeight={item.height}
              shouldPlay={shouldPlay && active && !paused}
              isLooping
              isMuted={muteVideos}
              volume={muteVideos || !active ? 0 : 1}
              trimStartRatio={trimStartRatio}
              trimEndRatio={trimEndRatio}
              scrubToRatio={active ? scrubToRatio : null}
              trimPlaybackResumeSignal={active ? trimPlaybackResumeSignal : 0}
              timeUpdateIntervalSec={active ? timeUpdateIntervalSec : 1}
              onDurationResolved={active ? onDurationResolved : undefined}
              onPlaybackStatusUpdate={active ? onPlaybackStatusUpdate : undefined}
            />
          )}
        </>
      );
      return (
        <View style={{ width: pageWidth, height, backgroundColor: "#000" }}>
          <View
            style={[
              styles.createNineSixteenMediaCard,
              {
                position: "absolute",
                left: cardRect.left,
                top: cardRect.top,
                width: cardRect.width,
                height: cardRect.height,
                borderRadius: FEED_VIDEO_BOTTOM_CORNER_RADIUS,
              },
            ]}
          >
            {onMediaPress ? (
              <Pressable style={StyleSheet.absoluteFill} onPress={onMediaPress}>
                {media}
              </Pressable>
            ) : (
              media
            )}
            {showSlideOverlays ? (
              <VideoPresentationOverlays filter="none" textOverlays={item.textOverlays} />
            ) : null}
          </View>
          {active && paused ? (
            <View pointerEvents="none" style={styles.feedPausedPlayOverlay}>
              <FeedPausedPlayIcon />
            </View>
          ) : null}
        </View>
      );
    },
    [
      cardRect.height,
      cardRect.left,
      cardRect.top,
      cardRect.width,
      height,
      hideActiveOverlays,
      index,
      muteVideos,
      needsSelfieMirror,
      onDurationResolved,
      onMediaPress,
      onPlaybackStatusUpdate,
      pageWidth,
      paused,
      scrubToRatio,
      shouldPlay,
      timeUpdateIntervalSec,
      trimEndRatio,
      trimPlaybackResumeSignal,
      trimStartRatio,
    ],
  );

  if (items.length === 0 || pageWidth <= 1) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onScrollBeginDrag={onPageScrollStart}
        onScrollEndDrag={(event) => {
          onPageScrollEnd?.();
          if (Math.abs(event.nativeEvent.velocity?.x ?? 0) > 0.08) return;
          const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          onIndexChange(Math.max(0, Math.min(items.length - 1, next)));
        }}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, itemIndex) => ({
          length: pageWidth,
          offset: pageWidth * itemIndex,
          index: itemIndex,
        })}
        initialNumToRender={2}
        windowSize={3}
        extraData={`${index}:${shouldPlay}:${paused}:${muteVideos}:${hideActiveOverlays}:${trimStartRatio}:${trimEndRatio}`}
      />
      {items.length > 1 ? (
        <View pointerEvents="box-none" style={pagerStyles.dotsWrap}>
          <View style={pagerStyles.dotsPill}>
            {items.map((item, itemIndex) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onPageScrollStart?.();
                  onIndexChange(itemIndex);
                  listRef.current?.scrollToOffset({ offset: itemIndex * pageWidth, animated: true });
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`slide ${itemIndex + 1}`}
                style={[pagerStyles.dot, itemIndex === index ? pagerStyles.dotActive : pagerStyles.dotIdle]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const pagerStyles = StyleSheet.create({
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
