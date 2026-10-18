import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { getNineSixteenCanvasRect } from "@/components/video/aspect-cache";
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
import { TEXT_OVERLAY_BASE_FONT_SIZE, viewportWidth } from "@/theme/tokens";

/** Authoring canvas width (create edit 9:16 card is full screen width). */
const EDITOR_CANVAS_WIDTH = viewportWidth;

export function getVideoFilterOverlayStyle(filter: VideoFilterId | string | null | undefined): ViewStyle {
  return getFilterOverlayStyle(filter);
}

const FEED_BASE_FONT_SIZE = TEXT_OVERLAY_BASE_FONT_SIZE;
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
  canvasWidth: number,
  canvasFontScale: number,
): TextStyle {
  const base =
    density === "micro" ? MICRO_BASE_FONT_SIZE : density === "thumb" ? THUMB_BASE_FONT_SIZE : FEED_BASE_FONT_SIZE;
  const scaledBase = density === "feed" ? base * canvasFontScale : base;
  const fontSize = Math.max(6, Math.round(scaledBase * overlay.fontScale * 10) / 10);
  const lineHeight = Math.round(fontSize * 1.25 * 10) / 10;
  const chrome = getVideoTextEffectChrome(overlay.effectId, { fontSize, density });
  const shadowRadius = density === "feed" ? 1.5 : 1;
  const fontWeight = getVideoTextOverlayFontWeight(overlay.fontId);
  // Leave room inside the frame for box padding so glyphs aren't pressed to the edge.
  const frameMax =
    density === "micro"
      ? 48
      : density === "thumb"
        ? 84
        : Math.max(48, Math.round(canvasWidth * 0.86));
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
  contentTopInset = 0,
}: {
  filter?: VideoFilterId | string | null;
  textOverlays?: VideoTextOverlay[] | unknown;
  style?: StyleProp<ViewStyle>;
  /** feed = playback size; thumb = create preview tile; micro = filmstrip / filter chips */
  density?: "feed" | "thumb" | "micro";
  /**
   * When set (slideshow fullscreen), 9:16 canvas is measured from the
   * below-status-bar media box so text/stickers match the photo framing.
   */
  contentTopInset?: number;
}) {
  const resolvedFilter = normalizeVideoFilter(filter);
  const overlays = normalizeVideoTextOverlays(textOverlays);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  if (resolvedFilter === "none" && overlays.length === 0) return null;

  const canvas =
    viewport.width > 0 && viewport.height > 0
      ? getNineSixteenCanvasRect(viewport.width, viewport.height)
      : null;
  const canvasFontScale =
    density === "feed" && canvas && EDITOR_CANVAS_WIDTH > 0
      ? canvas.width / EDITOR_CANVAS_WIDTH
      : 1;

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }

  const topInset = Math.max(0, contentTopInset);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, topInset > 0 ? { top: topInset } : null, style]}
      onLayout={handleLayout}
    >
      {resolvedFilter !== "none" ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, getVideoFilterOverlayStyle(resolvedFilter)]}
        />
      ) : null}
      {canvas
        ? overlays.map((overlay) => (
            <View
              key={overlay.id}
              pointerEvents="none"
              style={[
                styles.textAnchor,
                {
                  left: canvas.left + canvas.width * overlay.centerRatio.x,
                  top: canvas.top + canvas.height * overlay.centerRatio.y,
                },
              ]}
            >
              <VideoTextOverlayGlyph
                text={overlay.text}
                effectId={overlay.effectId}
                density={density}
                textStyle={getOverlayTypeStyles(density, overlay, canvas.width, canvasFontScale)}
                numberOfLines={density === "feed" ? undefined : 2}
              />
            </View>
          ))
        : null}
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
