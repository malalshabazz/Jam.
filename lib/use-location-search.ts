import { useEffect, useState } from "react";
import { searchLocationPlaces } from "@/lib/nominatim-search";
import type { LocationPlace } from "@/types/app";

export const LOCATION_SEARCH_MIN_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 450;

export type LocationSearchStatus = "idle" | "loading" | "empty" | "error";

export function useLocationSearch(query: string) {
  const [results, setResults] = useState<LocationPlace[]>([]);
  const [status, setStatus] = useState<LocationSearchStatus>("idle");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < LOCATION_SEARCH_MIN_LENGTH) {
      setResults([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(() => {
      void searchLocationPlaces(trimmed)
        .then((places) => {
          if (cancelled) return;
          setResults(places);
          setStatus(places.length ? "idle" : "empty");
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setStatus("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, status };
}
