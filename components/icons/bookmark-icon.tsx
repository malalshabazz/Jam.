import Svg, { Path } from "react-native-svg";
import { BOOKMARK_CREAM, overlayIconShadow } from "@/theme/tokens";

export function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg width={27} height={31} viewBox="0 0 27 31" style={overlayIconShadow}>
      <Path
        d="M4.5 2.5h18a2 2 0 0 1 2 2v24l-11-7-11 7v-24a2 2 0 0 1 2-2Z"
        fill={filled ? BOOKMARK_CREAM : "none"}
        stroke={filled ? BOOKMARK_CREAM : "#fff"}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
