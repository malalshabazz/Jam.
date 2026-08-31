import * as Location from "expo-location";
import { Platform } from "react-native";

type GeocodeResult = {
  latitude: number;
  longitude: number;
};

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

/** Device fallback only. Live Nominatim search goes through /api/geocode/search. */
export async function geocodeProfileLocation(
  country?: string | null,
  city?: string | null,
): Promise<GeocodeResult | null> {
  const trimmedCountry = country?.trim() ?? "";
  const trimmedCity = city?.trim() ?? "";
  if (!trimmedCountry && !trimmedCity) return null;

  const deviceQuery =
    trimmedCity && trimmedCountry
      ? `${trimmedCity}, ${trimmedCountry}`
      : trimmedCity || trimmedCountry;

  return geocodeWithDevice(deviceQuery);
}
