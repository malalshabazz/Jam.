import { createVideoPlayer, type VideoPlayer, type VideoSource } from "expo-video";

import { extractCloudflareStreamId } from "@/lib/native-cloudflare";

const MAX_PREWARM_PLAYERS = 6;

type PrewarmEntry = {
  player: VideoPlayer;
  source: string;
  lastVisibleAt: number;
};

const prewarmPool = new Map<string, PrewarmEntry>();

export function getExpoVideoSource(source: string | null | undefined): VideoSource {
  if (!source) return null;
  return {
    uri: source,
    contentType: source.includes(".m3u8") ? "hls" : "auto",
  };
}

export function getVideoSourceCacheKey(source: string | null | undefined) {
  if (!source) return null;
  return extractCloudflareStreamId(source) ?? source;
}

function configurePrewarmPlayer(player: VideoPlayer) {
  player.muted = true;
  player.volume = 0;
  player.loop = false;
  player.showNowPlayingNotification = false;
  player.audioMixingMode = "mixWithOthers";
  player.bufferOptions = {
    waitsToMinimizeStalling: false,
    preferredForwardBufferDuration: 2,
    minBufferForPlayback: 0.25,
    prioritizeTimeOverSizeThreshold: true,
  };
}

function releaseEntry(entry: PrewarmEntry) {
  try {
    entry.player.pause();
  } catch {
    /* ignore */
  }
  try {
    entry.player.release();
  } catch {
    /* ignore */
  }
}

function evictLeastRecentlyVisible(keepKey?: string | null) {
  while (prewarmPool.size >= MAX_PREWARM_PLAYERS) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of prewarmPool) {
      if (keepKey && key === keepKey) continue;
      if (entry.lastVisibleAt < oldestAt) {
        oldestAt = entry.lastVisibleAt;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    const entry = prewarmPool.get(oldestKey);
    prewarmPool.delete(oldestKey);
    if (entry) releaseEntry(entry);
  }
}

/**
 * Start buffering a profile-grid video as soon as its thumb is on screen.
 * The player is not attached to a view; expo-video still fills buffers.
 */
export function prewarmProfileVideoSource(source: string | null | undefined) {
  const key = getVideoSourceCacheKey(source);
  if (!key || !source) return;

  const existing = prewarmPool.get(key);
  if (existing) {
    existing.lastVisibleAt = Date.now();
    return;
  }

  evictLeastRecentlyVisible(key);

  try {
    const player = createVideoPlayer(getExpoVideoSource(source));
    configurePrewarmPlayer(player);
    prewarmPool.set(key, {
      player,
      source,
      lastVisibleAt: Date.now(),
    });
  } catch {
    /* native player creation can fail offline — ignore */
  }
}

/** Touch LRU without creating a player (thumb still visible). */
export function touchProfileVideoPrewarm(source: string | null | undefined) {
  const key = getVideoSourceCacheKey(source);
  if (!key) return;
  const existing = prewarmPool.get(key);
  if (existing) existing.lastVisibleAt = Date.now();
}

/**
 * Take ownership of a prewarmed player for fullscreen playback.
 * Caller must release() when done.
 */
export function adoptPrewarmedProfileVideoPlayer(
  source: string | null | undefined,
): VideoPlayer | null {
  const key = getVideoSourceCacheKey(source);
  if (!key) return null;
  const entry = prewarmPool.get(key);
  if (!entry) return null;
  prewarmPool.delete(key);
  return entry.player;
}
