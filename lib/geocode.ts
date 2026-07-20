import * as Location from "expo-location";
import { Platform } from "react-native";

type GeocodeResult = {
  latitude: number;
  longitude: number;
};

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_CONTACT_EMAIL = "jam-app@users.noreply.github.com";

function parseNominatimResults(
  results: Array<{ lat?: string; lon?: string }> | null | undefined,
): GeocodeResult | null {
  if (!Array.isArray(results) || results.length === 0) return null;

  const latitude = Number(results[0]?.lat);
  const longitude = Number(results[0]?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

async function nominatimSearch(
  params: Record<string, string>,
): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_SEARCH_URL}?${new URLSearchParams({
    format: "json",
    limit: "1",
    email: NOMINATIM_CONTACT_EMAIL,
    ...params,
  })}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;

  const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  return parseNominatimResults(results);
}

async function geocodeWithNominatim(
  country: string,
  city: string,
): Promise<GeocodeResult | null> {
  if (city && country) {
    const structured = await nominatimSearch({ city, country });
    if (structured) return structured;

    const freeForm = await nominatimSearch({ q: `${city}, ${country}` });
    if (freeForm) return freeForm;
  }

  const fallbackQuery = city || country;
  if (!fallbackQuery) return null;

  return nominatimSearch({ q: fallbackQuery });
}

async function geocodeWithDevice(query: string): Promise<GeocodeResult | null> {
  if (Platform.OS === "web") return null;

  try {
    const results = await Location.geocodeAsync(query);
    if (!results.length) return null;

    const { latitude, longitude } = results[0];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}

export async function geocodeProfileLocation(
  country?: string | null,
  city?: string | null,
): Promise<GeocodeResult | null> {
  const trimmedCountry = country?.trim() ?? "";
  const trimmedCity = city?.trim() ?? "";
  if (!trimmedCountry && !trimmedCity) return null;

  const nominatimResult = await geocodeWithNominatim(trimmedCountry, trimmedCity);
  if (nominatimResult) return nominatimResult;

  const deviceQuery =
    trimmedCity && trimmedCountry
      ? `${trimmedCity}, ${trimmedCountry}`
      : trimmedCity || trimmedCountry;

  return geocodeWithDevice(deviceQuery);
}
