import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import {
  normalizeVideoFilter,
  normalizeVideoTextOverlays,
  type VideoFilterId,
  type VideoTextOverlay,
} from "@/lib/video-presentation";

export function getVideoFilterOverlayStyle(filter: VideoFilterId): ViewStyle {
  switch (filter) {
    case "warm":
      return { backgroundColor: "rgba(251,146,60,0.18)" };
    case "cool":
      return { backgroundColor: "rgba(96,165,250,0.18)" };
    case "fade":
      return { backgroundColor: "rgba(255,255,255,0.14)" };
    case "noir":
      return { backgroundColor: "rgba(0,0,0,0.34)" };
    case "vivid":
      return { backgroundColor: "rgba(236,72,153,0.16)" };
    case "none":
    default:
      return {};
  }
}

export function VideoPresentationOverlays({
  filter,
  textOverlays,
  style,
  density = "feed",
}: {
  filter?: VideoFilterId | string | null;
  textOverlays?: VideoTextOverlay[] | unknown;
  style?: StyleProp<ViewStyle>;
  /** feed = playback size; thumb = create preview tile; micro = filmstrip / filter chips */
  density?: "feed" | "thumb" | "micro";
}) {
  const resolvedFilter = normalizeVideoFilter(filter);
  const overlays = normalizeVideoTextOverlays(textOverlays);
  if (resolvedFilter === "none" && overlays.length === 0) return null;

  const textStyle: StyleProp<TextStyle> =
    density === "micro" ? styles.textMicro : density === "thumb" ? styles.textThumb : styles.text;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {resolvedFilter !== "none" ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, getVideoFilterOverlayStyle(resolvedFilter)]}
        />
      ) : null}
      {overlays.map((overlay) => (
        <View
          key={overlay.id}
          pointerEvents="none"
          style={[
            styles.textAnchor,
            {
              left: `${overlay.centerRatio.x * 100}%`,
              top: `${overlay.centerRatio.y * 100}%`,
            },
          ]}
        >
          <Text style={textStyle} numberOfLines={density === "feed" ? undefined : 2}>
            {overlay.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  textAnchor: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
    width: 280,
    maxWidth: 320,
    textShadowColor: "rgba(0,0,0,0.62)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  textThumb: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    textAlign: "center",
    width: 72,
    maxWidth: 84,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  textMicro: {
    color: "#fff",
    fontSize: 7,
    lineHeight: 8,
    fontWeight: "900",
    textAlign: "center",
    width: 40,
    maxWidth: 48,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
});
