import { useEffect, useRef, useState } from "react";
import { Image, View, type ImageStyle } from "react-native";
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { VideoPresentationOverlays } from "@/components/VideoPresentationOverlays";
import { clamp } from "@/lib/format";
import { styles } from "@/theme/styles";
import {
  CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT,
  CREATE_THUMBNAIL_SELECTOR_WIDTH_SCALE,
} from "@/theme/tokens";
import type { CreateTextOverlayItem, VideoFilter } from "@/types/app";

export function VideoThumbnailFilmstrip({
  frames,
  onSelect,
  filter = "none",
  textOverlays = [],
  initialTimeMs,
}: {
  frames: Array<{ timeMs: number; uri: string }>;
  onSelect: (timeMs: number, uri: string) => void;
  filter?: VideoFilter;
  textOverlays?: CreateTextOverlayItem[];
  initialTimeMs?: number;
}) {
  const onSelectRef = useRef(onSelect);
  const lastIndexRef = useRef(0);
  const selectorLeftRef = useRef(0);
  const dragStartLeftRef = useRef(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [selectorLeft, setSelectorLeft] = useState(0);
  const frameHeight = CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT;
  const frameWidth = stripWidth > 0 && frames.length > 0 ? stripWidth / frames.length : 0;
  const selectorWidth =
    frameWidth > 0 ? Math.min(frameWidth * CREATE_THUMBNAIL_SELECTOR_WIDTH_SCALE, stripWidth) : 0;
  const selectorVisualLeft = selectorLeft - (selectorWidth - frameWidth) / 2;
  const maxSelectorLeft = Math.max(0, (frames.length - 1) * frameWidth);

  onSelectRef.current = onSelect;

  const initialIndex =
    frames.length === 0 || typeof initialTimeMs !== "number"
      ? 0
      : frames.reduce((best, frame, index) => {
          const bestDist = Math.abs(frames[best].timeMs - initialTimeMs);
          const nextDist = Math.abs(frame.timeMs - initialTimeMs);
          return nextDist < bestDist ? index : best;
        }, 0);

  useEffect(() => {
    lastIndexRef.current = initialIndex;
    const nextLeft = frameWidth > 0 ? initialIndex * frameWidth : 0;
    selectorLeftRef.current = nextLeft;
    setSelectorLeft(nextLeft);
    const frame = frames[initialIndex];
    if (frame) {
      onSelectRef.current(frame.timeMs, frame.uri);
    }
  }, [frames, frameWidth, initialIndex]);

  function setSelectorPosition(left: number) {
    const nextLeft = clamp(left, 0, maxSelectorLeft);
    selectorLeftRef.current = nextLeft;
    setSelectorLeft(nextLeft);
    return nextLeft;
  }

  function applySelectionForLeft(left: number) {
    if (!frameWidth || frames.length === 0) return;

    const index = clamp(Math.round(left / frameWidth), 0, frames.length - 1);
    const frame = frames[index];
    if (!frame || index === lastIndexRef.current) return;

    lastIndexRef.current = index;
    onSelectRef.current(frame.timeMs, frame.uri);
  }

  function snapSelector(left: number) {
    if (!frameWidth || frames.length === 0) return;

    const index = clamp(Math.round(left / frameWidth), 0, frames.length - 1);
    const snappedLeft = index * frameWidth;
    setSelectorPosition(snappedLeft);

    const frame = frames[index];
    if (!frame) return;

    lastIndexRef.current = index;
    onSelectRef.current(frame.timeMs, frame.uri);
  }

  function beginSelectorDrag() {
    dragStartLeftRef.current = selectorLeftRef.current;
  }

  function updateSelectorDrag(translationX: number) {
    const nextLeft = setSelectorPosition(dragStartLeftRef.current + translationX);
    applySelectionForLeft(nextLeft);
  }

  function handleSelectorGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (state === State.BEGAN) {
      beginSelectorDrag();
      return;
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      snapSelector(selectorLeftRef.current);
    }
  }

  return (
    <View
      style={styles.createThumbnailFilmstripWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== stripWidth) setStripWidth(nextWidth);
      }}
    >
      <PanGestureHandler
        onGestureEvent={(event) => updateSelectorDrag(event.nativeEvent.translationX)}
        onHandlerStateChange={handleSelectorGestureStateChange}
      >
        <View style={styles.createThumbnailFilmstripGestureArea}>
          <View style={[styles.createThumbnailFilmstripRow, stripWidth > 0 && { width: stripWidth }]}>
            {frames.map((frame) => (
              <View
                key={frame.timeMs}
                style={{ width: frameWidth, height: frameHeight, overflow: "hidden" }}
              >
                <Image
                  source={{ uri: frame.uri }}
                  style={{ width: frameWidth, height: frameHeight } as ImageStyle}
                />
                <VideoPresentationOverlays
                  filter={filter}
                  textOverlays={textOverlays}
                  density="micro"
                />
              </View>
            ))}
          </View>
          {frameWidth > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.createThumbnailFilmstripSelector,
                {
                  width: selectorWidth,
                  height: frameHeight,
                  left: selectorVisualLeft,
                },
              ]}
            />
          )}
        </View>
      </PanGestureHandler>
    </View>
  );
}
