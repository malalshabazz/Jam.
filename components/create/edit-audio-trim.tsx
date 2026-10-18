import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
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

function AudioWaveformLoadingBars() {
  const pulse = useRef(new Animated.Value(0)).current;
  const bars = useMemo(
    () => Array.from({ length: 28 }, (_, index) => 0.22 + 0.58 * Math.abs(Math.sin(index * 0.42))),
    [],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 640,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 640,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.createAudioWaveformBars}>
      {bars.map((height, index) => {
        const phase = (index % 8) / 8;
        return (
          <Animated.View
            key={index}
            style={[
              styles.createAudioWaveformBar,
              {
                height: `${Math.round(height * 100)}%`,
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.18 + phase * 0.2, 0.82 - phase * 0.12],
                }),
                transform: [
                  {
                    scaleY: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.38 + (1 - phase) * 0.18, 0.72 + phase * 0.28],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function PlaybackLoadingDots({ visible }: { visible: boolean }) {
  const [rowOpacity] = useState(() => new Animated.Value(0));
  const [dots] = useState(() => [
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);

  useEffect(() => {
    const fade = Animated.timing(rowOpacity, {
      toValue: visible ? 1 : 0,
      duration: 120,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [rowOpacity, visible]);

  useEffect(() => {
    if (!visible) return;

    const loops = dots.map((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      const timeout = setTimeout(() => {
        loop.start();
      }, index * 150);
      return { loop, timeout };
    });

    return () => {
      for (const { loop, timeout } of loops) {
        clearTimeout(timeout);
        loop.stop();
      }
    };
  }, [dots, visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "100%",
        height: 5,
        marginBottom: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        opacity: rowOpacity,
        zIndex: 2,
      }}
    >
      {dots.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: "rgba(255,255,255,0.7)",
            opacity: value.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1],
            }),
            transform: [
              {
                scale: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
              },
            ],
          }}
        />
      ))}
    </Animated.View>
  );
}

export function CreateAudioTrimStrip({
  seed,
  empty = false,
  loading = false,
  peaksLoading = false,
  peaks = null,
  playbackLoading = false,
  trimStartRatio,
  trimEndRatio,
  playbackRatio,
  scrubRatio,
  onLayoutWidth,
  onTrimHandleGesture,
  onTrimHandleStateChange,
}: {
  seed: string;
  empty?: boolean;
  loading?: boolean;
  peaksLoading?: boolean;
  peaks?: number[] | null;
  playbackLoading?: boolean;
  trimStartRatio: number;
  trimEndRatio: number;
  playbackRatio: number;
  scrubRatio: number | null;
  onLayoutWidth: (width: number) => void;
  onTrimHandleGesture: (handle: "start" | "end", translationX: number) => void;
  onTrimHandleStateChange: (handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const [stripWidth, setStripWidth] = useState(0);
  const fallbackBars = useMemo(() => waveformHeights(seed), [seed]);
  const bars = peaks && peaks.length > 0 ? peaks : fallbackBars;
  const showWaveformLoading = loading || (peaksLoading && !(peaks && peaks.length > 0));
  const trimLeft = trimStartRatio * stripWidth;
  const trimRight = (1 - trimEndRatio) * stripWidth;
  const selectionWidth = Math.max(0, stripWidth - trimLeft - trimRight);
  const { progressTrackLeft, progressTrackWidth } = getTrimProgressTrackGeometry(trimLeft, selectionWidth);
  const leftHandleLeft = trimLeft;
  const rightHandleLeft = trimLeft + selectionWidth - CREATE_TRIM_HANDLE_WIDTH;
  const selectionCornerRadius = CREATE_TRIM_FILMSTRIP_RADIUS - 1;
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
      <PlaybackLoadingDots visible={playbackLoading && !loading && !empty} />
      <View style={styles.createAudioWaveformStrip}>
        {showWaveformLoading ? (
          <AudioWaveformLoadingBars />
        ) : empty ? null : (
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
        )}

        {!empty && !showWaveformLoading && stripWidth > 0 ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.createTrimFilmstripDim,
                { left: 0, width: trimLeft + selectionCornerRadius },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.createTrimFilmstripDim,
                { right: 0, width: trimRight + selectionCornerRadius },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.createTrimFilmstripSelection,
                {
                  left: trimLeft,
                  width: selectionWidth,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
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
  empty = false,
  loading = false,
  peaksLoading = false,
  peaks = null,
  playbackLoading = false,
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
  empty?: boolean;
  loading?: boolean;
  peaksLoading?: boolean;
  peaks?: number[] | null;
  playbackLoading?: boolean;
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
    <View style={styles.createAudioNextSlot}>
      <View style={[styles.createTrimHeader, styles.createAudioNextHeader]}>
        <Text style={styles.sectionLabel}>audio</Text>
        <View style={styles.createAudioTrimHeaderActions}>
          <Text style={styles.createTrimDuration}>{loading ? "loading" : durationLabel}</Text>
          <Pressable onPress={onChangeAudio} accessibilityLabel="change audio">
            <Text style={styles.createAudioChangeText}>change</Text>
          </Pressable>
        </View>
      </View>
      <CreateAudioTrimStrip
        seed={seed}
        empty={empty}
        loading={loading}
        peaksLoading={peaksLoading}
        peaks={peaks}
        playbackLoading={playbackLoading}
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
