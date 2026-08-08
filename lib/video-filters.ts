import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ViewStyle } from "react-native";
import { supabase } from "@/lib/native-supabase";

export type VideoFilterId = string;

export type VideoFilterDefinition = {
  id: VideoFilterId;
  label: string;
  sortOrder: number;
  overlay: ViewStyle;
  active: boolean;
};

const FILTER_CACHE_KEY = "jam.video_filters.v1";
const FILTER_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FILTER_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

type CachedFilterCatalog = {
  savedAt: number;
  filters: VideoFilterDefinition[];
};

/** Bundled fallback — used offline and before the first successful fetch. */
export const BUNDLED_VIDEO_FILTERS: VideoFilterDefinition[] = [
  {
    id: "warm",
    label: "Warm",
    sortOrder: 10,
    overlay: { backgroundColor: "rgba(251,146,60,0.18)" },
    active: true,
  },
  {
    id: "cool",
    label: "Cool",
    sortOrder: 20,
    overlay: { backgroundColor: "rgba(96,165,250,0.18)" },
    active: true,
  },
  {
    id: "fade",
    label: "Fade",
    sortOrder: 30,
    overlay: { backgroundColor: "rgba(255,255,255,0.14)" },
    active: true,
  },
  {
    id: "noir",
    label: "Noir",
    sortOrder: 40,
    overlay: { backgroundColor: "rgba(0,0,0,0.34)" },
    active: true,
  },
  {
    id: "vivid",
    label: "Vivid",
    sortOrder: 50,
    overlay: { backgroundColor: "rgba(236,72,153,0.16)" },
    active: true,
  },
  {
    id: "cinema",
    label: "Cinema",
    sortOrder: 60,
    overlay: { backgroundColor: "rgba(120,53,15,0.22)" },
    active: true,
  },
  {
    id: "mist",
    label: "Mist",
    sortOrder: 70,
    overlay: { backgroundColor: "rgba(226,232,240,0.16)" },
    active: true,
  },
  {
    id: "golden",
    label: "Golden",
    sortOrder: 80,
    overlay: { backgroundColor: "rgba(234,179,8,0.18)" },
    active: true,
  },
  {
    id: "arctic",
    label: "Arctic",
    sortOrder: 90,
    overlay: { backgroundColor: "rgba(125,211,252,0.16)" },
    active: true,
  },
  {
    id: "rose",
    label: "Rose",
    sortOrder: 100,
    overlay: { backgroundColor: "rgba(251,113,133,0.17)" },
    active: true,
  },
  {
    id: "olive",
    label: "Olive",
    sortOrder: 110,
    overlay: { backgroundColor: "rgba(132,204,22,0.14)" },
    active: true,
  },
  {
    id: "midnight",
    label: "Midnight",
    sortOrder: 120,
    overlay: { backgroundColor: "rgba(30,27,75,0.28)" },
    active: true,
  },
  {
    id: "bleach",
    label: "Bleach",
    sortOrder: 130,
    overlay: { backgroundColor: "rgba(250,250,249,0.2)" },
    active: true,
  },
];

let memoryCatalog: VideoFilterDefinition[] = [...BUNDLED_VIDEO_FILTERS];
let memoryById = buildLookup(memoryCatalog);
let loadPromise: Promise<VideoFilterDefinition[]> | null = null;
const listeners = new Set<() => void>();

function buildLookup(filters: VideoFilterDefinition[]) {
  return new Map(filters.map((filter) => [filter.id, filter]));
}

function sortFilters(filters: VideoFilterDefinition[]) {
  return [...filters].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore subscriber errors so one bad UI listener can't break catalog updates.
    }
  });
}

function setMemoryCatalog(filters: VideoFilterDefinition[]) {
  memoryCatalog = sortFilters(filters);
  memoryById = buildLookup(memoryCatalog);
  notifyListeners();
}

function isValidFilterId(value: string) {
  return FILTER_ID_PATTERN.test(value);
}

function parseOverlay(value: unknown): ViewStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const backgroundColor =
    "backgroundColor" in value && typeof value.backgroundColor === "string"
      ? value.backgroundColor
      : undefined;
  return backgroundColor ? { backgroundColor } : {};
}

function normalizeDefinition(row: {
  id?: unknown;
  label?: unknown;
  sort_order?: unknown;
  sortOrder?: unknown;
  overlay?: unknown;
  active?: unknown;
}): VideoFilterDefinition | null {
  const id = typeof row.id === "string" ? row.id.trim().toLowerCase() : "";
  const label = typeof row.label === "string" ? row.label.trim() : "";
  if (!id || !isValidFilterId(id) || !label) return null;
  const sortOrderRaw =
    typeof row.sort_order === "number"
      ? row.sort_order
      : typeof row.sortOrder === "number"
        ? row.sortOrder
        : 0;
  return {
    id,
    label,
    sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0,
    overlay: parseOverlay(row.overlay),
    active: row.active !== false,
  };
}

export function getActiveFilterCatalog(): VideoFilterDefinition[] {
  return memoryCatalog.filter((filter) => filter.active);
}

/** Picker chips: None + active catalog filters. */
export function getFilterPickerOptions(): Array<{ id: VideoFilterId; label: string }> {
  return [
    { id: "none", label: "None" },
    ...getActiveFilterCatalog().map((filter) => ({ id: filter.id, label: filter.label })),
  ];
}

export function subscribeFilterCatalog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function normalizeVideoFilter(value: unknown): VideoFilterId {
  if (typeof value !== "string") return "none";
  const id = value.trim().toLowerCase();
  if (!id || id === "none") return "none";
  if (!isValidFilterId(id)) return "none";
  // Keep unknown-but-valid slugs so posts survive catalog lag; style falls back to {}.
  return id;
}

export function getFilterOverlayStyle(filterId: unknown): ViewStyle {
  const id = normalizeVideoFilter(filterId);
  if (id === "none") return {};
  return memoryById.get(id)?.overlay ?? {};
}

async function readCachedCatalog(): Promise<CachedFilterCatalog | null> {
  try {
    const raw = await AsyncStorage.getItem(FILTER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFilterCatalog;
    if (!parsed || typeof parsed.savedAt !== "number" || !Array.isArray(parsed.filters)) {
      return null;
    }
    const filters = parsed.filters
      .map((item) => normalizeDefinition(item))
      .filter((item): item is VideoFilterDefinition => Boolean(item));
    if (filters.length === 0) return null;
    return { savedAt: parsed.savedAt, filters };
  } catch {
    return null;
  }
}

async function writeCachedCatalog(filters: VideoFilterDefinition[]) {
  const payload: CachedFilterCatalog = {
    savedAt: Date.now(),
    filters,
  };
  try {
    await AsyncStorage.setItem(FILTER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is best-effort.
  }
}

async function fetchRemoteCatalog(): Promise<VideoFilterDefinition[] | null> {
  const { data, error } = await supabase
    .from("video_filters")
    .select("id, label, sort_order, overlay, active")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) return null;

  const filters = data
    .map((row) => normalizeDefinition(row))
    .filter((item): item is VideoFilterDefinition => Boolean(item && item.active));

  return filters.length > 0 ? sortFilters(filters) : null;
}

/**
 * Warm the in-memory catalog from cache, then refresh from Supabase when stale.
 * Safe to call often — concurrent callers share one in-flight promise.
 */
export async function ensureFilterCatalogLoaded(options?: {
  force?: boolean;
}): Promise<VideoFilterDefinition[]> {
  if (loadPromise && !options?.force) return loadPromise;

  loadPromise = (async () => {
    const cached = await readCachedCatalog();
    const cacheFresh =
      cached != null && Date.now() - cached.savedAt < FILTER_CACHE_TTL_MS && !options?.force;

    if (cached) {
      setMemoryCatalog(cached.filters);
      if (cacheFresh) return memoryCatalog;
    }

    const remote = await fetchRemoteCatalog();
    if (remote) {
      setMemoryCatalog(remote);
      await writeCachedCatalog(remote);
      return memoryCatalog;
    }

    if (!cached) {
      setMemoryCatalog(BUNDLED_VIDEO_FILTERS);
      await writeCachedCatalog(BUNDLED_VIDEO_FILTERS);
    }

    return memoryCatalog;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}
