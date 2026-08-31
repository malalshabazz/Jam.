import Svg, { Path } from "react-native-svg";

export function BellIcon({ filled = false, color = "#fff" }: { filled?: boolean; color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M12 3.2c-3.1 0-5.6 2.5-5.6 5.6v2.1c0 .9-.3 1.8-.9 2.5l-1.1 1.3c-.7.8-.2 2.1.9 2.1h13.4c1.1 0 1.6-1.3.9-2.1l-1.1-1.3c-.6-.7-.9-1.6-.9-2.5V8.8c0-3.1-2.5-5.6-5.6-5.6Z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M10 19.2a2.1 2.1 0 0 0 4 0"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
