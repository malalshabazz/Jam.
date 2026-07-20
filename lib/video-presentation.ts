export type VideoFilterId = "none" | "warm" | "cool" | "fade" | "noir" | "vivid";

export type VideoTextOverlay = {
  id: string;
  text: string;
  centerRatio: { x: number; y: number };
};

export function normalizeVideoFilter(value: unknown): VideoFilterId {
  if (
    value === "warm" ||
    value === "cool" ||
    value === "fade" ||
    value === "noir" ||
    value === "vivid"
  ) {
    return value;
  }
  return "none";
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
    return [{ id, text, centerRatio: { x, y } }];
  });
}
