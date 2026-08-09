import Svg, { Path } from "react-native-svg";

/** Light translucent play glyph shown centered on a user-paused feed clip. */
export function FeedPausedPlayIcon({ size = 148 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 78 78" fill="none">
      {/*
        Right-pointing play triangle with rounded corners (quadratic fillets
        at the tip and both base vertices).
      */}
      <Path
        d="M28 24.2
           Q28 19.6 32.2 21.8
           L54.6 34.2
           Q58.8 36.5 54.6 38.8
           L32.2 51.2
           Q28 53.4 28 48.8
           Z"
        fill="rgba(228,228,231,0.55)"
      />
    </Svg>
  );
}
