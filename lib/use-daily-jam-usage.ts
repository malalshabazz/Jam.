import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  fetchDailyJamUsage,
  type DailyJamUsage,
} from "@/lib/native-social-data";

export function useDailyJamUsage(active: boolean) {
  const [usage, setUsage] = useState<DailyJamUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshRequestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;
    setLoading(true);
    try {
      const next = await fetchDailyJamUsage();
      if (requestId !== refreshRequestIdRef.current) return null;
      setUsage(next);
      return next;
    } catch {
      if (requestId !== refreshRequestIdRef.current) return null;
      return null;
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    void refresh();

    const appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void refresh();
      }
    });

    return () => {
      refreshRequestIdRef.current += 1;
      appStateSubscription.remove();
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !usage?.resetsAt) return;

    const resetsAtMs = new Date(usage.resetsAt).getTime();
    if (!Number.isFinite(resetsAtMs)) return;

    const delayMs = Math.max(1000, resetsAtMs - Date.now() + 250);
    const timer = setTimeout(() => {
      void refresh();
    }, Math.min(delayMs, 24 * 60 * 60 * 1000));

    return () => clearTimeout(timer);
  }, [active, refresh, usage?.resetsAt, usage?.usageDate]);

  return { usage, loading, refresh };
}
