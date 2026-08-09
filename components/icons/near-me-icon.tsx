import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export function NearMeIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#d4d4d8";
  const baseCenterY = 27;
  const baseRadiusX = 8.4;
  const baseRadiusY = 2.85;
  const scale = useRef(new Animated.Value(1)).current;
  const wasActiveRef = useRef(active);

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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={24} height={32} viewBox="0 0 24 32" fill="none">
        <Path
          d={`M ${12 + baseRadiusX} ${baseCenterY} A ${baseRadiusX} ${baseRadiusY} 0 0 1 ${12 - baseRadiusX} ${baseCenterY}`}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M12 2.75C7.03 2.75 3 6.58 3 11.25C3 17.2 12 27 12 27C12 27 21 17.2 21 11.25C21 6.58 16.97 2.75 12 2.75Z"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          cx={12}
          cy={10.5}
          r={2.35}
          stroke={stroke}
          strokeWidth={2}
          fill={active ? stroke : "none"}
        />
      </Svg>
    </Animated.View>
  );
}
