import { getGeocodeSearchEndpoint, supabase } from "@/lib/native-supabase";
import type { LocationPlace } from "@/lib/location-place";

export async function searchLocationPlaces(query: string, attempt = 0): Promise<LocationPlace[]> {
  const endpoint = getGeocodeSearchEndpoint();
  if (!endpoint) {
    throw new Error("Location search is not configured.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated.");
  }

  const response = await fetch(`${endpoint}?${new URLSearchParams({ q: query })}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.status === 429 && attempt < 1) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    return searchLocationPlaces(query, attempt + 1);
  }

  if (!response.ok) {
    throw new Error("Location search failed.");
  }

  const body = (await response.json()) as { results?: LocationPlace[] };
  return Array.isArray(body.results) ? body.results : [];
}
