import Svg, { Path } from "react-native-svg";

export function MenuIcon({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16" fill="none">
      <Path d="M1 1h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 8h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 15h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
