import { useEffect, useRef } from "react";
import { Animated, Easing, Image } from "react-native";
import { LOOKING_FOR_BINOCULARS_ICON } from "@/theme/tokens";

export const LOOKING_FOR_ICON_BLUE = "#3b82f6";

export function LookingForIcon({
  active = false,
  size = 24,
  color,
  shadow = false,
}: {
  active?: boolean;
  size?: number;
  color?: string;
  /** Soft silhouette shadow for video overlays. */
  shadow?: boolean;
}) {
  const tint = color ?? (active ? LOOKING_FOR_ICON_BLUE : "#d4d4d8");
  const scale = useRef(new Animated.Value(1)).current;
  const wasActiveRef = useRef(active);
  // Asset is wider than tall (~640×350); size is the height.
  const width = Math.round(size * 1.75);
  const height = size;

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.22,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasActiveRef.current = active;
  }, [active, scale]);

  return (
    <Animated.View style={{ width, height, transform: [{ scale }] }}>
      {shadow ? (
        <Image
          source={LOOKING_FOR_BINOCULARS_ICON}
          style={{
            position: "absolute",
            width,
            height,
            tintColor: "rgba(0,0,0,0.55)",
            transform: [{ translateX: 0.6 }, { translateY: 1.1 }],
          }}
          resizeMode="contain"
        />
      ) : null}
      <Image
        source={LOOKING_FOR_BINOCULARS_ICON}
        style={{ width, height, tintColor: tint }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}
