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
import { JamVideoView, type JamVideoPlaybackStatus } from "@/components/video/jam-video-view";
import type { CreateEditItem } from "@/types/app";

const DOT_SIZE = 6;
const DOT_GAP = 6;

export function CreateEditAlbumPager({
  items,
  index,
  width,
  height,
  shouldPlay,
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
}: {
  items: CreateEditItem[];
  index: number;
  width: number;
  height: number;
  shouldPlay: boolean;
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
      return (
        <View style={{ width: pageWidth, height, backgroundColor: "#000" }}>
          {item.kind === "image" ? (
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
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
              shouldPlay={shouldPlay && active}
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
          {showSlideOverlays ? (
            <VideoPresentationOverlays filter="none" textOverlays={item.textOverlays} />
          ) : null}
        </View>
      );
    },
    [
      height,
      hideActiveOverlays,
      index,
      muteVideos,
      needsSelfieMirror,
      onDurationResolved,
      onPlaybackStatusUpdate,
      pageWidth,
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
          if (Math.abs(event.nativeEvent.velocity?.x ?? 0) > 0.08) return;
          onMomentumEnd(event);
        }}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, itemIndex) => ({
          length: pageWidth,
          offset: pageWidth * itemIndex,
          index: itemIndex,
        })}
        initialNumToRender={2}
        windowSize={3}
        extraData={`${index}:${shouldPlay}:${muteVideos}:${hideActiveOverlays}:${trimStartRatio}:${trimEndRatio}`}
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
