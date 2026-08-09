import { Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export const PIN_ICON_RED = "#ef4444";

export const PIN_ICON_PATH =
  "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z";

export const PIN_PREVIEW_EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const PIN_PREVIEW_SCALE = 1.1;
export const PIN_MENU_CARD_WIDTH = 148;
export const PIN_MENU_CARD_HEIGHT = 52;

/** Classic drawing / push pin — solid fill, angled diagonally. */
export function PinIcon({
  size = 22,
  color = PIN_ICON_RED,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "35deg" }],
      }}
    >
      <View
        style={{
          position: "absolute",
          transform: [{ translateX: 0.8 }, { translateY: 1.1 }],
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d={PIN_ICON_PATH} fill="rgba(0,0,0,0.45)" />
        </Svg>
      </View>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={PIN_ICON_PATH} fill={color} />
      </Svg>
    </View>
  );
}
