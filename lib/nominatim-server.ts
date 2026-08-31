import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { LocationGranularity, LocationPlace } from "@/lib/location-place";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_CONTACT_EMAIL = "jam-app@users.noreply.github.com";
const NOMINATIM_USER_AGENT = `Jam/0.1 (https://jam-qvdx.vercel.app; ${NOMINATIM_CONTACT_EMAIL})`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 1000;

const DROPPED_PLACE_TYPES = new Set([
  "town",
  "village",
  "hamlet",
  "suburb",
  "neighbourhood",
  "neighborhood",
  "quarter",
  "city_block",
  "isolated_dwelling",
  "farm",
  "allotments",
  "plot",
  "house",
  "residential",
  "commercial",
  "retail",
  "industrial",
  "yes",
  "peak",
  "river",
  "stream",
  "sea",
  "ocean",
  "island",
  "islet",
  "road",
  "highway",
  "building",
  "aeroway",
  "railway",
  "continent",
]);

const DROPPED_CLASSES = new Set([
  "amenity",
  "shop",
  "tourism",
  "leisure",
  "office",
  "craft",
  "club",
  "emergency",
  "historic",
  "military",
  "natural",
  "man_made",
  "highway",
  "railway",
  "aeroway",
  "waterway",
  "building",
]);

const CITY_TYPES = new Set(["city", "municipality"]);
const REGION_TYPES = new Set([
  "state",
  "region",
  "province",
  "county",
  "state_district",
  "iso3166-2",
]);

type NominatimAddress = {
  city?: string;
  municipality?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  state_district?: string;
  region?: string;
  province?: string;
  country?: string;
  country_code?: string;
};

type NominatimHit = {
  lat?: string;
  lon?: string;
  class?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

const memoryCache = new Map<string, { expiresAt: number; results: LocationPlace[] }>();
let memoryLastRequestAt = 0;
let memoryLock: Promise<void> = Promise.resolve();

export function normalizeNominatimQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function searchNominatimPlaces(query: string): Promise<LocationPlace[]> {
  const queryKey = normalizeNominatimQuery(query);
  const cached = await readCache(queryKey);
  if (cached) return cached;

  await acquireNominatimSlot();

  // One unrestricted search, then classify. featuretype=city would drop
  // country/region hits and would require a second Nominatim call.
  const url = `${NOMINATIM_SEARCH_URL}?${new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "15",
    "accept-language": "en",
    email: NOMINATIM_CONTACT_EMAIL,
    q: query,
  })}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new NominatimUpstreamError(response.status);
  }

  const hits = (await response.json()) as NominatimHit[];
  const results = dedupePlaces(
    (Array.isArray(hits) ? hits : [])
      .map(classifyNominatimHit)
      .filter((place): place is LocationPlace => place != null),
  ).slice(0, 8);

  await writeCache(queryKey, results);
  return results;
}

export class NominatimUpstreamError extends Error {
  status: number;

  constructor(status: number) {
    super("Nominatim request failed.");
    this.status = status;
  }
}

export class NominatimRateLimitError extends Error {
  constructor() {
    super("Location search is busy. Try again in a moment.");
  }
}

async function acquireNominatimSlot() {
  const admin = createServiceRoleClient();
  if (!admin) {
    await acquireMemorySlot();
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.rpc("claim_nominatim_slot");
    if (!error && data === true) return;
    if (error) {
      if (isMissingNominatimSchema(error)) {
        await acquireMemorySlot();
        return;
      }
      throw error;
    }
    if (attempt < 2) await sleep(MIN_REQUEST_GAP_MS + 100);
  }

  throw new NominatimRateLimitError();
}

async function acquireMemorySlot() {
  const run = memoryLock.then(async () => {
    const waitMs = MIN_REQUEST_GAP_MS - (Date.now() - memoryLastRequestAt);
    if (waitMs > 0) await sleep(waitMs);
    memoryLastRequestAt = Date.now();
  });
  memoryLock = run.catch(() => undefined);
  await run;
}

async function readCache(queryKey: string): Promise<LocationPlace[] | null> {
  const memory = memoryCache.get(queryKey);
  if (memory && memory.expiresAt > Date.now()) return memory.results;

  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("nominatim_search_cache")
    .select("results, expires_at")
    .eq("query_key", queryKey)
    .maybeSingle();

  if (error || !data) return null;
  if (Date.parse(data.expires_at) <= Date.now()) return null;
  if (!Array.isArray(data.results)) return null;

  const results = data.results as LocationPlace[];
  memoryCache.set(queryKey, { expiresAt: Date.parse(data.expires_at), results });
  return results;
}

async function writeCache(queryKey: string, results: LocationPlace[]) {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  memoryCache.set(queryKey, { expiresAt, results });

  const admin = createServiceRoleClient();
  if (!admin) return;

  await admin.from("nominatim_search_cache").upsert({
    query_key: queryKey,
    results,
    expires_at: new Date(expiresAt).toISOString(),
  });
}

function classifyNominatimHit(hit: NominatimHit): LocationPlace | null {
  const address = hit.address ?? {};
  const addresstype = normalizeToken(hit.addresstype || hit.type);
  const type = normalizeToken(hit.type);
  const placeClass = normalizeToken(hit.category || hit.class);

  if (DROPPED_PLACE_TYPES.has(addresstype) || DROPPED_PLACE_TYPES.has(type)) return null;
  if (DROPPED_CLASSES.has(placeClass)) return null;

  const name = (hit.name || address.city || address.state || address.country || "").trim();
  const country = (address.country || "").trim();
  const countryCode = (address.country_code || "").trim().toUpperCase();
  if (!name) return null;

  const granularity = inferGranularity({ addresstype, type, name, country });
  if (!granularity) return null;

  const regionName = firstPresent(
    address.state_district,
    address.state,
    address.region,
    address.province,
    address.county,
  );
  const cityName = firstPresent(address.city, address.municipality, name);
  const region =
    granularity === "country"
      ? null
      : granularity === "region"
        ? name
        : regionName && normalizeToken(regionName) !== normalizeToken(cityName)
          ? regionName
          : regionName;
  const city = granularity === "city" ? cityName : null;
  const storedCountry = country || (granularity === "country" ? name : "");
  if (!storedCountry) return null;

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  return {
    label: buildPlaceLabel({
      name: granularity === "city" ? cityName ?? name : name,
      granularity,
      region: granularity === "city" ? region : null,
      country: storedCountry,
    }),
    granularity,
    country: storedCountry,
    country_code: countryCode,
    region: granularity === "country" ? null : region,
    city,
    latitude: granularity === "city" && hasCoords ? latitude : null,
    longitude: granularity === "city" && hasCoords ? longitude : null,
  };
}

function inferGranularity({
  addresstype,
  type,
  name,
  country,
}: {
  addresstype: string;
  type: string;
  name: string;
  country: string;
}): LocationGranularity | null {
  if (addresstype === "country" || type === "country") {
    if (country && normalizeToken(name) !== normalizeToken(country)) return "region";
    return "country";
  }

  if (REGION_TYPES.has(addresstype) || REGION_TYPES.has(type)) return "region";
  if (CITY_TYPES.has(addresstype) || CITY_TYPES.has(type)) return "city";
  return null;
}

function buildPlaceLabel({
  name,
  granularity,
  region,
  country,
}: {
  name: string;
  granularity: LocationGranularity;
  region: string | null;
  country: string;
}) {
  if (granularity === "country") return country || name;
  if (granularity === "region") {
    return country && normalizeToken(name) !== normalizeToken(country)
      ? `${name}, ${country}`
      : name;
  }

  return [name, region, country]
    .filter((part, index, parts) => {
      if (!part) return false;
      return !parts.slice(0, index).some((earlier) => normalizeToken(earlier) === normalizeToken(part));
    })
    .join(", ");
}

function dedupePlaces(places: LocationPlace[]) {
  const seen = new Set<string>();
  const unique: LocationPlace[] = [];
  for (const place of places) {
    const key = [
      place.granularity,
      place.country_code || normalizeToken(place.country),
      normalizeToken(place.region),
      normalizeToken(place.city),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(place);
  }
  return unique;
}

function firstPresent(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeToken(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isMissingNominatimSchema(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    message.includes("claim_nominatim_slot") ||
    message.includes("nominatim_search_cache")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
