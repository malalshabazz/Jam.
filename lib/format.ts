export function getUniqueStrings(items: readonly string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatClipDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ordinal(value: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = value % 100;
  const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${value}${suffix}`;
}

export function stringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
