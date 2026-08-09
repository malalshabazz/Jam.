import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View, type StyleProp, type TextStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedRecordRingCircle = Animated.createAnimatedComponent(Circle);

export function RecordingElapsedTimer({ active, style }: { active: boolean; style?: StyleProp<TextStyle> }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  return <Text style={style}>{`${minutes}:${seconds}`}</Text>;
}

export function RecordButtonCore({ active }: { active: boolean }) {
  const morph = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(morph, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, morph]);

  const size = morph.interpolate({ inputRange: [0, 1], outputRange: [58, 28] });
  const borderRadius = morph.interpolate({ inputRange: [0, 1], outputRange: [29, 7] });

  return <Animated.View style={{ width: size, height: size, borderRadius, backgroundColor: "#ef4444" }} />;
}

export function RecordProgressRing({
  active,
  durationSeconds,
  size,
  strokeWidth,
  centerOffset = 0,
}: {
  active: boolean;
  durationSeconds: number;
  size: number;
  strokeWidth: number;
  centerOffset?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: durationSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      return;
    }
    progress.stopAnimation(() => progress.setValue(0));
  }, [active, durationSeconds, progress]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: centerOffset, left: centerOffset, width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <AnimatedRecordRingCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#ff3b30"
          strokeOpacity={1}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
