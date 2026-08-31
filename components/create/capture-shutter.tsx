import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { RecordButtonCore, RecordProgressRing } from "@/components/create/record-controls";
import { styles } from "@/theme/styles";
import {
  CREATE_CAMERA_CAPTURE_SWITCH_GAP,
  CREATE_CAMERA_PHOTO_BUTTON_SIZE,
  CREATE_CAMERA_RECORD_BUTTON_BORDER_WIDTH,
  CREATE_CAMERA_RECORD_BUTTON_SIZE,
} from "@/theme/tokens";
import type { CreateCaptureMode } from "@/types/app";

const SATELLITE_SCALE = CREATE_CAMERA_PHOTO_BUTTON_SIZE / CREATE_CAMERA_RECORD_BUTTON_SIZE;
const TRAVEL =
  CREATE_CAMERA_RECORD_BUTTON_SIZE / 2 +
  CREATE_CAMERA_CAPTURE_SWITCH_GAP +
  CREATE_CAMERA_PHOTO_BUTTON_SIZE / 2;
const SWIPE_COMMIT = TRAVEL * 0.35;

export function CreateCaptureShutter({
  mode,
  onModeChange,
  recording,
  countdownActive,
  disabled,
  onVideoPress,
  onPhotoPress,
  onPrimaryPressIn,
  onPrimaryPressOut,
  primaryPressScale,
  maxDuration,
}: {
  mode: CreateCaptureMode;
  onModeChange: (mode: CreateCaptureMode) => void;
  recording: boolean;
  countdownActive: boolean;
  disabled: boolean;
  onVideoPress: () => void;
  onPhotoPress: () => void;
  onPrimaryPressIn: () => void;
  onPrimaryPressOut: () => void;
  primaryPressScale: Animated.Value;
  maxDuration: number;
}) {
  const progress = useRef(new Animated.Value(mode === "photo" ? 1 : 0)).current;
  const locked = recording || countdownActive;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: mode === "photo" ? 1 : 0,
      damping: 18,
      stiffness: 280,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }, [mode, progress]);

  function switchMode(next: CreateCaptureMode) {
    if (locked || next === mode) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onModeChange(next);
  }

  function handleSwipe(event: PanGestureHandlerStateChangeEvent) {
    if (locked) return;
    if (event.nativeEvent.state !== State.END && event.nativeEvent.state !== State.CANCELLED) {
      return;
    }

    const { translationX } = event.nativeEvent;
    if (translationX <= -SWIPE_COMMIT) switchMode("photo");
    else if (translationX >= SWIPE_COMMIT) switchMode("video");
  }

  const recordTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -TRAVEL],
  });
  const photoTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRAVEL, 0],
  });
  const recordScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, SATELLITE_SCALE],
  });
  const photoScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SATELLITE_SCALE, 1],
  });
  const photoVisibility = recording
    ? 0
    : 1;

  return (
    <PanGestureHandler
      enabled={!locked && !disabled}
      activeOffsetX={[-16, 16]}
      failOffsetY={[-28, 28]}
      onHandlerStateChange={handleSwipe}
    >
      <Animated.View
        style={[
          styles.createCaptureShutterTrack,
          { width: CREATE_CAMERA_RECORD_BUTTON_SIZE + TRAVEL * 2 },
        ]}
      >
        <Animated.View
          style={[
            styles.createCaptureShutterSlot,
            {
              left: TRAVEL,
              transform: [
                { translateX: recordTranslateX },
                { scale: mode === "video" ? Animated.multiply(recordScale, primaryPressScale) : recordScale },
              ],
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (mode === "video") onVideoPress();
              else switchMode("video");
            }}
            onPressIn={mode === "video" ? onPrimaryPressIn : undefined}
            onPressOut={mode === "video" ? onPrimaryPressOut : undefined}
            disabled={disabled || (mode === "photo" && locked)}
            hitSlop={10}
            style={[styles.createRecordButton, disabled && styles.disabled]}
            accessibilityLabel={
              mode === "video"
                ? recording
                  ? "stop recording"
                  : countdownActive
                    ? "cancel countdown"
                    : "start recording"
                : "switch to video"
            }
          >
            <RecordButtonCore active={recording || countdownActive} />
            <RecordProgressRing
              active={recording}
              durationSeconds={maxDuration}
              size={79}
              strokeWidth={5}
              centerOffset={
                (CREATE_CAMERA_RECORD_BUTTON_SIZE -
                  2 * CREATE_CAMERA_RECORD_BUTTON_BORDER_WIDTH -
                  79) /
                2
              }
            />
          </Pressable>
        </Animated.View>
        <Animated.View
          pointerEvents={recording ? "none" : "auto"}
          style={[
            styles.createCaptureShutterSlot,
            {
              left: TRAVEL,
              opacity: photoVisibility,
              transform: [
                { translateX: photoTranslateX },
                { scale: mode === "photo" ? Animated.multiply(photoScale, primaryPressScale) : photoScale },
              ],
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (mode === "photo") onPhotoPress();
              else switchMode("photo");
            }}
            onPressIn={mode === "photo" ? onPrimaryPressIn : undefined}
            onPressOut={mode === "photo" ? onPrimaryPressOut : undefined}
            disabled={disabled || locked}
            hitSlop={10}
            style={[styles.createRecordButton, disabled && styles.disabled]}
            accessibilityLabel={mode === "photo" ? "take photo" : "switch to photo"}
          >
            <View style={styles.createPhotoShutterCore} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
}
