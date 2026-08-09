import { useMemo } from "react";
import { getUniqueStrings } from "@/lib/format";

export function useSuggestions<T extends string>(items: readonly T[], query: string, selected: string[]) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedSet = new Set(selected);
    return getUniqueStrings(items).filter((item): item is T => !selectedSet.has(item) && (!q || item.toLowerCase().includes(q)));
  }, [items, query, selected]);
}
