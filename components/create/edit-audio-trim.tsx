import { useMemo, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { PanGestureHandler, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { getTrimProgressTrackGeometry, getTrimSelectionProgress } from "@/components/create/layout";
import { styles } from "@/theme/styles";
import { CREATE_TRIM_FILMSTRIP_RADIUS, CREATE_TRIM_HANDLE_WIDTH } from "@/theme/tokens";

const BAR_COUNT = 48;

function waveformHeights(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const wave = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(index * 0.55 + (hash % 17)));
    const noise = (hash % 1000) / 1000;
    return Math.min(1, Math.max(0.16, wave * (0.55 + noise * 0.45)));
  });
}

function TrimHandleChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <Svg width={10} height={14} viewBox="0 0 10 14">
      {direction === "right" ? (
        <Path
          d="M2 1 L8 7 L2 13"
          stroke="#09090b"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M8 1 L2 7 L8 13"
          stroke="#09090b"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

export function CreateAudioTrimStrip({
  seed,
  trimStartRatio,
  trimEndRatio,
  playbackRatio,
  scrubRatio,
  onLayoutWidth,
  onTrimHandleGesture,
  onTrimHandleStateChange,
}: {
  seed: string;
  trimStartRatio: number;
  trimEndRatio: number;
  playbackRatio: number;
  scrubRatio: number | null;
  onLayoutWidth: (width: number) => void;
  onTrimHandleGesture: (handle: "start" | "end", translationX: number) => void;
  onTrimHandleStateChange: (handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const [stripWidth, setStripWidth] = useState(0);
  const bars = useMemo(() => waveformHeights(seed), [seed]);
  const trimLeft = trimStartRatio * stripWidth;
  const trimRight = (1 - trimEndRatio) * stripWidth;
  const selectionWidth = Math.max(0, stripWidth - trimLeft - trimRight);
  const { progressTrackLeft, progressTrackWidth } = getTrimProgressTrackGeometry(trimLeft, selectionWidth);
  const leftHandleLeft = trimLeft;
  const rightHandleLeft = trimLeft + selectionWidth - CREATE_TRIM_HANDLE_WIDTH;
  const isStartFlush = trimStartRatio <= 0.001;
  const isEndFlush = trimEndRatio >= 0.999;
  const selectionProgress = getTrimSelectionProgress(
    scrubRatio ?? playbackRatio,
    trimStartRatio,
    trimEndRatio,
  );

  return (
    <View
      style={styles.createTrimFilmstripOuter}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== stripWidth) {
          setStripWidth(nextWidth);
          onLayoutWidth(nextWidth);
        }
      }}
    >
      <View style={styles.createAudioWaveformStrip}>
        <View style={styles.createAudioWaveformBars}>
          {bars.map((height, index) => (
            <View
              key={index}
              style={[
                styles.createAudioWaveformBar,
                { height: `${Math.round(height * 100)}%` },
              ]}
            />
          ))}
        </View>

        {stripWidth > 0 ? (
          <>
            <View pointerEvents="none" style={[styles.createTrimFilmstripDim, { left: 0, width: trimLeft }]} />
            <View pointerEvents="none" style={[styles.createTrimFilmstripDim, { right: 0, width: trimRight }]} />
            <View
              pointerEvents="none"
              style={[
                styles.createTrimFilmstripSelection,
                {
                  left: trimLeft,
                  width: selectionWidth,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  borderTopLeftRadius: isStartFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                  borderBottomLeftRadius: isStartFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                  borderTopRightRadius: isEndFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                  borderBottomRightRadius: isEndFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                },
              ]}
            />
            {progressTrackWidth > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.createTrimProgressTrack,
                  { left: progressTrackLeft, width: progressTrackWidth },
                ]}
              >
                <View
                  style={[
                    styles.createTrimPlayhead,
                    { transform: [{ translateX: Math.max(0, selectionProgress * (progressTrackWidth - 2)) }] },
                  ]}
                />
              </View>
            ) : null}

            <PanGestureHandler
              onGestureEvent={(event) => onTrimHandleGesture("start", event.nativeEvent.translationX)}
              onHandlerStateChange={(event) => onTrimHandleStateChange("start", event)}
            >
              <Animated.View
                style={[
                  styles.createTrimHandleTab,
                  styles.createTrimHandleTabStart,
                  isStartFlush && styles.createTrimHandleTabStartFlush,
                  { left: leftHandleLeft },
                ]}
                accessibilityLabel="audio start"
              >
                <TrimHandleChevron direction="right" />
              </Animated.View>
            </PanGestureHandler>

            <PanGestureHandler
              onGestureEvent={(event) => onTrimHandleGesture("end", event.nativeEvent.translationX)}
              onHandlerStateChange={(event) => onTrimHandleStateChange("end", event)}
            >
              <Animated.View
                style={[
                  styles.createTrimHandleTab,
                  styles.createTrimHandleTabEnd,
                  isEndFlush && styles.createTrimHandleTabEndFlush,
                  { left: rightHandleLeft },
                ]}
                accessibilityLabel="audio end"
              >
                <TrimHandleChevron direction="left" />
              </Animated.View>
            </PanGestureHandler>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function CreateAudioTrimPanel({
  seed,
  durationLabel,
  trimStartRatio,
  trimEndRatio,
  playbackRatio,
  scrubRatio,
  onLayoutWidth,
  onTrimHandleGesture,
  onTrimHandleStateChange,
  onChangeAudio,
}: {
  seed: string;
  durationLabel: string;
  trimStartRatio: number;
  trimEndRatio: number;
  playbackRatio: number;
  scrubRatio: number | null;
  onLayoutWidth: (width: number) => void;
  onTrimHandleGesture: (handle: "start" | "end", translationX: number) => void;
  onTrimHandleStateChange: (handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) => void;
  onChangeAudio: () => void;
}) {
  return (
    <View style={styles.createTrimToolPanelContent}>
      <View style={styles.createTrimHeader}>
        <Text style={styles.sectionLabel}>audio</Text>
        <View style={styles.createAudioTrimHeaderActions}>
          <Text style={styles.createTrimDuration}>{durationLabel}</Text>
          <Pressable onPress={onChangeAudio} accessibilityLabel="change audio">
            <Text style={styles.createAudioChangeText}>change</Text>
          </Pressable>
        </View>
      </View>
      <CreateAudioTrimStrip
        seed={seed}
        trimStartRatio={trimStartRatio}
        trimEndRatio={trimEndRatio}
        playbackRatio={playbackRatio}
        scrubRatio={scrubRatio}
        onLayoutWidth={onLayoutWidth}
        onTrimHandleGesture={onTrimHandleGesture}
        onTrimHandleStateChange={onTrimHandleStateChange}
      />
    </View>
  );
}
