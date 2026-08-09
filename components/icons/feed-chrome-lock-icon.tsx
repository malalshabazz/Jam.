import Svg, { Path, Rect } from "react-native-svg";

export function FeedChromeLockIcon({ open, size = 20 }: { open: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {open ? (
        <Path
          d="M8 11V8.2C8 5.9 9.7 4 12 4c1.4 0 2.6.7 3.3 1.7"
          stroke="#fff"
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      ) : (
        <Path
          d="M8 11V8.2C8 5.9 9.7 4 12 4s4 1.9 4 4.2V11"
          stroke="#fff"
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      )}
      <Path
        d="M6.5 11h11c.8 0 1.5.7 1.5 1.5v6c0 1.4-1.1 2.5-2.5 2.5h-9C6.1 21 5 19.9 5 18.5v-6C5 11.7 5.7 11 6.5 11Z"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M12 14.2v2.4"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}
