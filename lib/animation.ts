import { Animated, Easing } from "react-native";

export function fadeAnimatedValue(value: Animated.Value, toValue: number, duration: number) {
  return new Promise<void>((resolve) => {
    Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  });
}

export function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
