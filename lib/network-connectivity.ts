const ONLINE_PROBE_URL = "https://www.cloudflare.com/cdn-cgi/trace";
const ONLINE_PROBE_TIMEOUT_MS = 4000;

async function probeReachable() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ONLINE_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(ONLINE_PROBE_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok || response.status === 204;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getIsNetworkOnline() {
  try {
    return await probeReachable();
  } catch {
    return false;
  }
}

/**
 * Resolves when the device has a usable network. Shows no UI itself —
 * call while the jam. splash is already visible.
 */
export function waitForNetworkOnline(options?: {
  onOffline?: () => void;
  pollMs?: number;
}): Promise<void> {
  const pollMs = options?.pollMs ?? 1500;

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      resolve();
    };

    const check = async () => {
      const online = await getIsNetworkOnline();
      if (online) {
        finish();
        return;
      }
      options?.onOffline?.();
    };

    void check();

    pollTimer = setInterval(() => {
      void check();
    }, pollMs);
  });
}
