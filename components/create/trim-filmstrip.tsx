import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, View, type ImageStyle } from "react-native";
import { PanGestureHandler, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { getTrimProgressTrackGeometry, getTrimSelectionProgress } from "@/components/create/layout";
import { styles } from "@/theme/styles";
import {
  CREATE_TRIM_FILMSTRIP_FRAME_COUNT,
  CREATE_TRIM_FILMSTRIP_RADIUS,
  CREATE_TRIM_HANDLE_WIDTH,
} from "@/theme/tokens";

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

export function CreateTrimFilmstrip({
  frames,
  loading,
  trimStartRatio,
  trimEndRatio,
  playbackRatio,
  scrubRatio,
  onLayoutWidth,
  onTrimHandleGesture,
  onTrimHandleStateChange,
}: {
  frames: Array<{ timeMs: number; uri: string }>;
  loading: boolean;
  trimStartRatio: number;
  trimEndRatio: number;
  playbackRatio: number;
  scrubRatio: number | null;
  onLayoutWidth: (width: number) => void;
  onTrimHandleGesture: (handle: "start" | "end", translationX: number) => void;
  onTrimHandleStateChange: (handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const [stripWidth, setStripWidth] = useState(0);
  const selectionProgressAnim = useRef(new Animated.Value(0)).current;
  const previousSelectionProgressRef = useRef(0);
  const hasInitializedProgressRef = useRef(false);
  const trimLeft = trimStartRatio * stripWidth;
  const trimRight = (1 - trimEndRatio) * stripWidth;
  const selectionWidth = Math.max(0, stripWidth - trimLeft - trimRight);
  const { progressTrackLeft, progressTrackWidth } = getTrimProgressTrackGeometry(trimLeft, selectionWidth);
  const leftHandleLeft = trimLeft;
  const rightHandleLeft = trimLeft + selectionWidth - CREATE_TRIM_HANDLE_WIDTH;
  const isStartFlush = trimStartRatio <= 0.001;
  const isEndFlush = trimEndRatio >= 0.999;
  const placeholderCount = Math.max(frames.length, CREATE_TRIM_FILMSTRIP_FRAME_COUNT);
  const targetSelectionProgress = getTrimSelectionProgress(
    scrubRatio ?? playbackRatio,
    trimStartRatio,
    trimEndRatio,
  );
  const progressFillWidth = selectionProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, progressTrackWidth],
  });
  const playheadTranslateX = selectionProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, progressTrackWidth - 2)],
  });

  useEffect(() => {
    if (!hasInitializedProgressRef.current) {
      hasInitializedProgressRef.current = true;
      previousSelectionProgressRef.current = targetSelectionProgress;
      selectionProgressAnim.setValue(targetSelectionProgress);
      return;
    }

    const previous = previousSelectionProgressRef.current;
    previousSelectionProgressRef.current = targetSelectionProgress;

    if (scrubRatio != null || targetSelectionProgress < previous - 0.25) {
      selectionProgressAnim.stopAnimation();
      selectionProgressAnim.setValue(targetSelectionProgress);
      return;
    }

    const animation = Animated.timing(selectionProgressAnim, {
      toValue: targetSelectionProgress,
      duration: 100,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [scrubRatio, selectionProgressAnim, targetSelectionProgress]);

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
      <View style={styles.createTrimFilmstrip}>
        {loading ? (
          <View style={styles.createTrimFilmstripLoading}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : frames.length > 0 ? (
          <View style={styles.createTrimFilmstripFrames}>
            {frames.map((frame) => (
              <Image
                key={frame.timeMs}
                source={{ uri: frame.uri }}
                style={styles.createTrimFilmstripFrame as ImageStyle}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : (
          <View style={styles.createTrimFilmstripFrames}>
            {Array.from({ length: placeholderCount }, (_, index) => (
              <View key={index} style={styles.createTrimFilmstripFramePlaceholder} />
            ))}
          </View>
        )}

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
                  {
                    left: progressTrackLeft,
                    width: progressTrackWidth,
                  },
                ]}
              >
                <Animated.View style={[styles.createTrimProgressFill, { width: progressFillWidth }]} />
                <Animated.View
                  style={[
                    styles.createTrimPlayhead,
                    {
                      transform: [{ translateX: playheadTranslateX }],
                    },
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
                accessibilityLabel="trim start"
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
                accessibilityLabel="trim end"
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
