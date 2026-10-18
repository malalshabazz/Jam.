import { requireOptionalNativeModule } from "expo-modules-core";

type JamWaveformNativeModule = {
  getPeaks(uri: string, bucketCount: number): Promise<number[]>;
};

const peaksCache = new Map<string, number[]>();
const inflightByUri = new Map<string, Promise<number[] | null>>();
const PEAKS_TIMEOUT_MS = 4000;

function mapPeakToBarHeight(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return 0.12 + 0.88 * Math.sqrt(clamped);
}

function uriTail(uri: string): string {
  if (uri.length <= 48) return uri;
  return uri.slice(-48);
}

function elapsedSince(timingStartedAt?: number | null, fallbackStartedAt?: number): number {
  if (timingStartedAt != null) return Date.now() - timingStartedAt;
  return Date.now() - (fallbackStartedAt ?? Date.now());
}

export async function getAudioPeaks(
  uri: string,
  bucketCount = 80,
  options?: { timingStartedAt?: number | null },
): Promise<number[] | null> {
  const cached = peaksCache.get(uri);
  if (cached) return cached;

  const inflight = inflightByUri.get(uri);
  if (inflight) return inflight;

  const timingStartedAt = options?.timingStartedAt ?? null;

  const request = (async (): Promise<number[] | null> => {
    const startedAt = Date.now();
    try {
      const native = requireOptionalNativeModule<JamWaveformNativeModule>("JamWaveform");
      if (!native?.getPeaks) {
        if (__DEV__) {
          console.log("[waveform] peaks failed", {
            error: "missing module",
            ms: elapsedSince(timingStartedAt, startedAt),
            uri: uriTail(uri),
          });
        }
        return null;
      }

      const result = await new Promise<number[] | null>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          if (__DEV__) {
            console.log("[waveform] peaks timeout", {
              ms: elapsedSince(timingStartedAt, startedAt),
              uri: uriTail(uri),
            });
          }
          resolve(null);
        }, PEAKS_TIMEOUT_MS);

        void native
          .getPeaks(uri, bucketCount)
          .then((raw) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (!Array.isArray(raw) || raw.length === 0) {
              if (__DEV__) {
                console.log("[waveform] peaks failed", {
                  error: "empty peaks",
                  ms: elapsedSince(timingStartedAt, startedAt),
                  uri: uriTail(uri),
                });
              }
              resolve(null);
              return;
            }
            const heights = raw.map((value) => mapPeakToBarHeight(Number(value) || 0));
            peaksCache.set(uri, heights);
            if (__DEV__) {
              console.log("[waveform] peaks done", {
                uri: uriTail(uri),
                count: heights.length,
                ms: elapsedSince(timingStartedAt, startedAt),
              });
            }
            resolve(heights);
          })
          .catch((error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (__DEV__) {
              console.log("[waveform] peaks failed", {
                error: error instanceof Error ? error.message : String(error),
                ms: elapsedSince(timingStartedAt, startedAt),
                uri: uriTail(uri),
              });
            }
            resolve(null);
          });
      });

      return result;
    } catch (error) {
      if (__DEV__) {
        console.log("[waveform] peaks failed", {
          error: error instanceof Error ? error.message : String(error),
          ms: elapsedSince(timingStartedAt, startedAt),
          uri: uriTail(uri),
        });
      }
      return null;
    } finally {
      inflightByUri.delete(uri);
    }
  })();

  // Register before the async body awaits so concurrent callers share one request
  // and finally always deletes the entry.
  inflightByUri.set(uri, request);
  return request;
}
