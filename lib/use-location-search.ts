import { useEffect, useState } from "react";
import { mergeLocationPlaces, searchGazetteerPlaces } from "@/lib/location-gazetteer";
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

    const local = searchGazetteerPlaces(trimmed);
    setResults(local);
    setStatus(local.length ? "idle" : "loading");

    let cancelled = false;
    const timer = setTimeout(() => {
      void searchLocationPlaces(trimmed)
        .then((remote) => {
          if (cancelled) return;
          const merged = mergeLocationPlaces(remote, local);
          setResults(merged);
          setStatus(merged.length ? "idle" : "empty");
        })
        .catch(() => {
          if (cancelled) return;
          if (local.length) {
            setResults(local);
            setStatus("idle");
            return;
          }
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
