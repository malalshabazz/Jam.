import { creatorRoles, musicGenres } from "@/lib/options";
import type { FeedContentFilters, FeedVideo } from "@/lib/native-social-data";
import type { NearMeRadiusMiles } from "@/lib/location-distance";
import { FEED_QUICK_FILTERS } from "@/theme/tokens";
import { getUniqueStrings } from "@/lib/format";
import {
  LOCATION_FILTER_COUNTRIES,
  locationFilterMatches,
  parseLocationFilter,
} from "@/lib/location-filter";

export type FeedFilterState = {
  roles: string[];
  genres: string[];
  location: string;
  nearMeActive: boolean;
  lookingForActive: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  nearMeRadiusMiles: NearMeRadiusMiles;
};

export function normalizeVideoTag(tag: string) {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
}

export function getUniqueVideoTags(tags: readonly string[]) {
  const seen = new Set<string>();
  const uniqueTags: string[] = [];

  for (const tag of tags) {
    const normalizedTag = normalizeVideoTag(tag);
    if (!normalizedTag || seen.has(normalizedTag)) continue;
    seen.add(normalizedTag);
    uniqueTags.push(tag);
  }

  return uniqueTags;
}

export const FEED_ROLE_FILTER_WHEEL = [
  ...FEED_QUICK_FILTERS,
  ...creatorRoles.filter(
    (role) =>
      role !== "vocalist" && role !== "instrumentalist" && role !== "producer",
  ),
];

export const creatorRoleTagSet = new Set(creatorRoles.map(normalizeVideoTag));
export const musicGenreTagSet = new Set(musicGenres.map(normalizeVideoTag));

export function toFeedContentFilters(
  filters: Pick<FeedFilterState, "roles" | "genres" | "location" | "lookingForActive">,
): FeedContentFilters {
  const roles = getUniqueStrings(filters.roles);
  const genres = getUniqueStrings(filters.genres);
  const locations = parseLocationFilter(filters.location).map((selection) => {
    const option = LOCATION_FILTER_COUNTRIES.find((country) => country.country === selection.country);
    return {
      country: selection.country,
      cities: selection.cities,
      country_aliases: [...(option?.aliases ?? [])],
    };
  });

  return {
    roles: roles.length ? roles : undefined,
    genres: genres.length ? genres : undefined,
    locations: locations.length ? locations : undefined,
    lookingForOnly: filters.lookingForActive || undefined,
  };
}

export function buildDiscoverFeedQueryKey(filters: FeedFilterState) {
  const rolesKey = [...filters.roles].map((role) => role.toLowerCase()).sort().join(",");
  const genresKey = [...filters.genres].map((genre) => genre.toLowerCase()).sort().join(",");
  const lookingKey = filters.lookingForActive ? "looking" : "";
  const contentKey = `${rolesKey}|${genresKey}|${filters.location}|${lookingKey}`;

  if (filters.nearMeActive && filters.userLocation) {
    return `near:${filters.userLocation.latitude.toFixed(5)}:${filters.userLocation.longitude.toFixed(5)}:${filters.nearMeRadiusMiles}:${contentKey}`;
  }

  return `global:${contentKey}`;
}

export function feedVideoMatchesFilters(item: FeedVideo, filters: FeedFilterState) {
  // Match video tags only — never the creator's profile role.
  const itemRoles = item.roles.map((role) => role.toLowerCase());
  const itemGenres = item.genres.map((genre) => genre.toLowerCase());
  const roleMatch =
    filters.roles.length === 0 ||
    filters.roles.some((role) => itemRoles.includes(role.toLowerCase()));
  const genreMatch =
    filters.genres.length === 0 ||
    filters.genres.some((genre) => itemGenres.includes(genre.toLowerCase()));
  const locationMatch = !filters.location || locationFilterMatches(item.location, filters.location);
  const lookingForMatch = !filters.lookingForActive || item.lookingFor;
  // Near-me + role/genre are enforced server-side on new page fetches.
  // Client filter remains so already-loaded / bridged clips stay correct instantly.
  return roleMatch && genreMatch && locationMatch && lookingForMatch;
}

export function isFeedFilterStateActive(filters: FeedFilterState) {
  return (
    filters.roles.length > 0 ||
    filters.genres.length > 0 ||
    Boolean(filters.location) ||
    filters.nearMeActive ||
    filters.lookingForActive
  );
}

export function shuffleVideosWithSpacing(videos: FeedVideo[]) {
  const pool = [...videos];
  const result: FeedVideo[] = [];

  while (pool.length) {
    const recentCreators = result.slice(-10).map((item) => item.userId);
    const candidates = pool.filter((item) => !recentCreators.includes(item.userId));
    const source = candidates.length ? candidates : pool;
    const pick = source[Math.floor(Math.random() * source.length)];
    result.push(pick);
    pool.splice(pool.findIndex((item) => item.id === pick.id), 1);
  }

  return result;
}
