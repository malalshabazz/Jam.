import { Platform, type TextStyle } from "react-native";
import {
  getFilterOverlayStyle,
  normalizeVideoFilter as normalizeVideoFilterFromCatalog,
  type VideoFilterId,
} from "@/lib/video-filters";

export type { VideoFilterId };
export { getFilterOverlayStyle };

export const TEXT_OVERLAY_MIN_FONT_SCALE = 0.55;
export const TEXT_OVERLAY_MAX_FONT_SCALE = 2.4;
export const TEXT_OVERLAY_DEFAULT_FONT_SCALE = 1;

export type VideoTextFontId =
  | "classic"
  | "serif"
  | "typewriter"
  | "rounded"
  | "poster"
  | "condensed"
  | "script";

export const TEXT_OVERLAY_DEFAULT_FONT_ID: VideoTextFontId = "classic";

export type VideoTextEffectId = "none" | "outline" | "whiteBox" | "blackBox";

export const TEXT_OVERLAY_DEFAULT_EFFECT_ID: VideoTextEffectId = "none";

export const VIDEO_TEXT_EFFECT_ORDER: readonly VideoTextEffectId[] = [
  "none",
  "outline",
  "whiteBox",
  "blackBox",
] as const;

const VIDEO_TEXT_EFFECT_IDS = new Set<string>(VIDEO_TEXT_EFFECT_ORDER);

export const VIDEO_TEXT_FONT_OPTIONS: Array<{
  id: VideoTextFontId;
  label: string;
  fontFamily: string;
}> = [
  {
    id: "classic",
    label: "classic",
    fontFamily: Platform.select({ ios: "System", android: "sans-serif", default: "System" })!,
  },
  {
    id: "serif",
    label: "serif",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" })!,
  },
  {
    id: "typewriter",
    label: "type",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "Menlo" })!,
  },
  {
    id: "rounded",
    label: "soft",
    fontFamily: Platform.select({
      ios: "AvenirNext-Medium",
      android: "sans-serif-medium",
      default: "AvenirNext-Medium",
    })!,
  },
  {
    id: "poster",
    label: "poster",
    fontFamily: Platform.select({
      ios: "HelveticaNeue-CondensedBold",
      android: "sans-serif-black",
      default: "HelveticaNeue-CondensedBold",
    })!,
  },
  {
    id: "condensed",
    label: "slim",
    fontFamily: Platform.select({
      ios: "AvenirNextCondensed-Bold",
      android: "sans-serif-condensed",
      default: "AvenirNextCondensed-Bold",
    })!,
  },
  {
    id: "script",
    label: "script",
    fontFamily: Platform.select({
      ios: "Snell Roundhand",
      android: "serif",
      default: "Snell Roundhand",
    })!,
  },
];

const VIDEO_TEXT_FONT_IDS = new Set(VIDEO_TEXT_FONT_OPTIONS.map((option) => option.id));

export type VideoTextOverlay = {
  id: string;
  text: string;
  centerRatio: { x: number; y: number };
  /** Multiplier vs the default overlay font size. */
  fontScale: number;
  fontId: VideoTextFontId;
  /** none = soft shadow; outline / boxed backgrounds */
  effectId: VideoTextEffectId;
};

export function clampTextOverlayFontScale(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return TEXT_OVERLAY_DEFAULT_FONT_SCALE;
  }
  return Math.min(
    TEXT_OVERLAY_MAX_FONT_SCALE,
    Math.max(TEXT_OVERLAY_MIN_FONT_SCALE, value),
  );
}

export function normalizeVideoTextFontId(value: unknown): VideoTextFontId {
  if (typeof value === "string" && VIDEO_TEXT_FONT_IDS.has(value as VideoTextFontId)) {
    return value as VideoTextFontId;
  }
  return TEXT_OVERLAY_DEFAULT_FONT_ID;
}

export function normalizeVideoTextEffectId(value: unknown): VideoTextEffectId {
  if (typeof value === "string" && VIDEO_TEXT_EFFECT_IDS.has(value)) {
    return value as VideoTextEffectId;
  }
  return TEXT_OVERLAY_DEFAULT_EFFECT_ID;
}

export function cycleVideoTextEffectId(value: unknown): VideoTextEffectId {
  const current = normalizeVideoTextEffectId(value);
  const index = VIDEO_TEXT_EFFECT_ORDER.indexOf(current);
  return VIDEO_TEXT_EFFECT_ORDER[(index + 1) % VIDEO_TEXT_EFFECT_ORDER.length]!;
}

export function getVideoTextOverlayFontFamily(fontId: unknown): string {
  const resolved = normalizeVideoTextFontId(fontId);
  return (
    VIDEO_TEXT_FONT_OPTIONS.find((option) => option.id === resolved)?.fontFamily ??
    VIDEO_TEXT_FONT_OPTIONS[0]!.fontFamily
  );
}

/**
 * Avoid forcing ultra-black weight onto faces that already encode weight or that
 * break (script) when synthesized bold is applied.
 */
export function getVideoTextOverlayFontWeight(fontId: unknown): TextStyle["fontWeight"] {
  switch (normalizeVideoTextFontId(fontId)) {
    case "script":
      return "400";
    case "typewriter":
      return "600";
    case "serif":
      return "700";
    case "rounded":
    case "poster":
    case "condensed":
      // Family name already carries the intended weight on iOS.
      return undefined;
    case "classic":
    default:
      return "900";
  }
}

export function getVideoTextOutlineRadius(
  fontSize: number,
  density: "feed" | "thumb" | "micro" | "edit" | "menu" = "feed",
) {
  const densityScale =
    density === "micro" ? 0.55 : density === "thumb" || density === "menu" ? 0.72 : 1;
  return Math.max(1.8, fontSize * 0.1 * densityScale);
}

/** Shared chrome for overlay text effects (create + feed). */
export function getVideoTextEffectChrome(
  effectId: unknown,
  options?: { fontSize?: number; density?: "feed" | "thumb" | "micro" | "edit" | "menu" },
): {
  effectId: VideoTextEffectId;
  color: string;
  backgroundColor: string | undefined;
  paddingHorizontal: number;
  paddingVertical: number;
  borderRadius: number;
  useOutline: boolean;
  useSoftShadow: boolean;
  outlinePad: number;
} {
  const resolved = normalizeVideoTextEffectId(effectId);
  const density = options?.density ?? "feed";
  const fontSize = Math.max(6, options?.fontSize ?? 30);
  const densityScale =
    density === "micro" ? 0.4 : density === "thumb" || density === "menu" ? 0.55 : 1;
  // Extra inset so script / bold side-bearings and descenders stay inside the box.
  const boxPadX = Math.max(10, Math.round(fontSize * 0.38 * densityScale));
  const boxPadY = Math.max(5, Math.round(fontSize * 0.22 * densityScale));
  const boxRadius = Math.max(8, Math.round(fontSize * 0.32 * densityScale));
  const outlinePad = Math.ceil(getVideoTextOutlineRadius(fontSize, density) + 2);

  switch (resolved) {
    case "outline":
      return {
        effectId: resolved,
        color: "#fff",
        backgroundColor: undefined,
        paddingHorizontal: outlinePad,
        paddingVertical: outlinePad,
        borderRadius: 0,
        useOutline: true,
        useSoftShadow: false,
        outlinePad,
      };
    case "whiteBox":
      return {
        effectId: resolved,
        color: "#111",
        backgroundColor: "#fff",
        paddingHorizontal: boxPadX,
        paddingVertical: boxPadY,
        borderRadius: boxRadius,
        useOutline: false,
        useSoftShadow: false,
        outlinePad: 0,
      };
    case "blackBox":
      return {
        effectId: resolved,
        color: "#fff",
        backgroundColor: "#111",
        paddingHorizontal: boxPadX,
        paddingVertical: boxPadY,
        borderRadius: boxRadius,
        useOutline: false,
        useSoftShadow: false,
        outlinePad: 0,
      };
    case "none":
    default:
      return {
        effectId: "none",
        color: "#fff",
        backgroundColor: undefined,
        paddingHorizontal: 0,
        paddingVertical: 0,
        borderRadius: 0,
        useOutline: false,
        useSoftShadow: true,
        outlinePad: 0,
      };
  }
}

export function normalizeVideoFilter(value: unknown): VideoFilterId {
  return normalizeVideoFilterFromCatalog(value);
}

export function normalizeVideoTextOverlays(value: unknown): VideoTextOverlay[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const text = "text" in item && typeof item.text === "string" ? item.text.trim() : "";
    if (!text) return [];
    const center =
      "centerRatio" in item && item.centerRatio && typeof item.centerRatio === "object"
        ? item.centerRatio
        : null;
    const x =
      center && "x" in center && typeof center.x === "number" && Number.isFinite(center.x)
        ? Math.min(1, Math.max(0, center.x))
        : 0.5;
    const y =
      center && "y" in center && typeof center.y === "number" && Number.isFinite(center.y)
        ? Math.min(1, Math.max(0, center.y))
        : 0.5;
    const id =
      "id" in item && typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : `overlay-${index}`;
    const fontScale = clampTextOverlayFontScale(
      "fontScale" in item ? item.fontScale : TEXT_OVERLAY_DEFAULT_FONT_SCALE,
    );
    const fontId = normalizeVideoTextFontId("fontId" in item ? item.fontId : TEXT_OVERLAY_DEFAULT_FONT_ID);
    const effectId = normalizeVideoTextEffectId(
      "effectId" in item
        ? item.effectId
        : "effect_id" in item
          ? item.effect_id
          : TEXT_OVERLAY_DEFAULT_EFFECT_ID,
    );
    return [{ id, text, centerRatio: { x, y }, fontScale, fontId, effectId }];
  });
}
