import {
  Dimensions,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { getFilterOverlayStyle, type VideoFilterId } from "@/lib/video-filters";
import {
  getVideoTextEffectChrome,
  getVideoTextOutlineRadius,
  getVideoTextOverlayFontFamily,
  getVideoTextOverlayFontWeight,
  normalizeVideoFilter,
  normalizeVideoTextEffectId,
  normalizeVideoTextOverlays,
  type VideoTextEffectId,
  type VideoTextOverlay,
} from "@/lib/video-presentation";

const FEED_TEXT_MAX_WIDTH = Math.round(Dimensions.get("window").width * 0.86);

export function getVideoFilterOverlayStyle(filter: VideoFilterId | string | null | undefined): ViewStyle {
  return getFilterOverlayStyle(filter);
}

const FEED_BASE_FONT_SIZE = 30;
const THUMB_BASE_FONT_SIZE = 11;
const MICRO_BASE_FONT_SIZE = 7;

/** Dense circular samples → rounded stroke that hugs glyph curves (not boxy N/S/E/W stacks). */
function buildCurvedOutlineOffsets(radius: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];
  // Two rings are enough for a continuous curve when each sample carries a soft halo.
  const rings = [
    { scale: 0.72, steps: 24 },
    { scale: 1, steps: 32 },
  ];
  for (const ring of rings) {
    const r = radius * ring.scale;
    for (let i = 0; i < ring.steps; i += 1) {
      const angle = (i / ring.steps) * Math.PI * 2;
      offsets.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
  }
  return offsets;
}

function flattenTextStyle(textStyle: StyleProp<TextStyle>): TextStyle {
  return (StyleSheet.flatten(textStyle) ?? {}) as TextStyle;
}

function getOverlayTypeStyles(
  density: "feed" | "thumb" | "micro",
  overlay: VideoTextOverlay,
): TextStyle {
  const base =
    density === "micro" ? MICRO_BASE_FONT_SIZE : density === "thumb" ? THUMB_BASE_FONT_SIZE : FEED_BASE_FONT_SIZE;
  const fontSize = Math.max(6, Math.round(base * overlay.fontScale * 10) / 10);
  const lineHeight = Math.round(fontSize * 1.25 * 10) / 10;
  const chrome = getVideoTextEffectChrome(overlay.effectId, { fontSize, density });
  const shadowRadius = density === "feed" ? 1.5 : 1;
  const fontWeight = getVideoTextOverlayFontWeight(overlay.fontId);
  // Leave room inside the frame for box padding so glyphs aren't pressed to the edge.
  const frameMax =
    density === "micro" ? 48 : density === "thumb" ? 84 : FEED_TEXT_MAX_WIDTH;
  const textMaxWidth = Math.max(24, frameMax - chrome.paddingHorizontal * 2);

  return {
    color: chrome.color,
    fontSize,
    lineHeight,
    ...(fontWeight ? { fontWeight } : null),
    fontFamily: getVideoTextOverlayFontFamily(overlay.fontId),
    textAlign: "center",
    maxWidth: textMaxWidth,
    includeFontPadding: false,
    ...(chrome.useSoftShadow
      ? {
          textShadowColor: "rgba(0,0,0,0.55)",
          textShadowRadius: shadowRadius,
          textShadowOffset: { width: 0, height: density === "feed" ? 1 : 0.5 } as const,
        }
      : {
          textShadowColor: "transparent",
          textShadowRadius: 0,
          textShadowOffset: { width: 0, height: 0 } as const,
        }),
  };
}

function getEffectContainerStyle(
  effectId: VideoTextEffectId,
  fontSize: number,
  density: "feed" | "thumb" | "micro" | "edit" | "menu",
): ViewStyle {
  const chrome = getVideoTextEffectChrome(effectId, { fontSize, density });

  if (chrome.backgroundColor) {
    return {
      backgroundColor: chrome.backgroundColor,
      paddingHorizontal: chrome.paddingHorizontal,
      paddingVertical: chrome.paddingVertical,
      borderRadius: chrome.borderRadius,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      // borderRadius clips on Android unless overflow is visible.
      overflow: "visible",
      ...(density === "menu" && effectId === "blackBox"
        ? { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.4)" }
        : null),
    };
  }

  if (chrome.useOutline) {
    return {
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: chrome.paddingHorizontal,
      paddingVertical: chrome.paddingVertical,
      overflow: "visible",
    };
  }

  return {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  };
}

/** Renders overlay copy with none / outline / whiteBox / blackBox chrome. */
export function VideoTextOverlayGlyph({
  text,
  effectId,
  textStyle,
  numberOfLines,
  density = "feed",
}: {
  text: string;
  effectId?: unknown;
  textStyle: StyleProp<TextStyle>;
  numberOfLines?: number;
  density?: "feed" | "thumb" | "micro" | "edit" | "menu";
}) {
  const resolvedEffect = normalizeVideoTextEffectId(effectId);
  const flatStyle = flattenTextStyle(textStyle);
  const fontSize = typeof flatStyle.fontSize === "number" ? flatStyle.fontSize : 30;
  const chrome = getVideoTextEffectChrome(resolvedEffect, { fontSize, density });
  const containerStyle = getEffectContainerStyle(resolvedEffect, fontSize, density);
  const outlineRadius = getVideoTextOutlineRadius(fontSize, density);
  const outlineOffsets = chrome.useOutline ? buildCurvedOutlineOffsets(outlineRadius) : [];

  const filledTextStyle: StyleProp<TextStyle> = [
    textStyle,
    {
      color: chrome.color,
      textAlign: "center",
      includeFontPadding: false,
      ...(chrome.useSoftShadow
        ? null
        : {
            textShadowColor: "transparent",
            textShadowRadius: 0,
            textShadowOffset: { width: 0, height: 0 },
          }),
    },
  ];

  const label = (
    <View style={styles.glyphInner}>
      {outlineOffsets.map(([x, y], index) => (
        <Text
          key={`outline-${index}`}
          pointerEvents="none"
          numberOfLines={numberOfLines}
          style={[
            filledTextStyle,
            {
              position: "absolute",
              left: x,
              top: y,
              color: "#000",
              // Soften each sample slightly so the ring reads as a continuous curve.
              textShadowColor: "rgba(0,0,0,0.55)",
              textShadowRadius: Math.max(0.6, outlineRadius * 0.35),
              textShadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          {text}
        </Text>
      ))}
      <Text numberOfLines={numberOfLines} style={filledTextStyle}>
        {text}
      </Text>
    </View>
  );

  return <View style={containerStyle}>{label}</View>;
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
          <VideoTextOverlayGlyph
            text={overlay.text}
            effectId={overlay.effectId}
            density={density}
            textStyle={getOverlayTypeStyles(density, overlay)}
            numberOfLines={density === "feed" ? undefined : 2}
          />
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
  glyphInner: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
});
