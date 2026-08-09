import Svg, { Path } from "react-native-svg";

export function FeedFilterIcon({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={26} height={34} viewBox="0 0 24 32" fill="none">
      <Path d="M4 8h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M7 16h10" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M4 24h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
