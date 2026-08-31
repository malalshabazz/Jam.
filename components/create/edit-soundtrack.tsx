import { useEffect, useRef } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

export function CreateEditSoundtrack({
  uri,
  playing,
  trimStartRatio = 0,
  trimEndRatio = 1,
  scrubToRatio = null,
  onDurationMs,
  onPlaybackRatio,
}: {
  uri: string | null;
  playing: boolean;
  trimStartRatio?: number;
  trimEndRatio?: number;
  scrubToRatio?: number | null;
  onDurationMs?: (durationMs: number) => void;
  onPlaybackRatio?: (ratio: number) => void;
}) {
  const player = useAudioPlayer(uri, {
    updateInterval: 80,
    downloadFirst: false,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const lastSeekKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uri) return;
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  }, [uri]);

  useEffect(() => {
    if (!uri || !status.isLoaded) return;
    const durationMs = Math.max(0, Math.round((status.duration || 0) * 1000));
    if (durationMs > 0) onDurationMs?.(durationMs);
  }, [onDurationMs, status.duration, status.isLoaded, uri]);

  useEffect(() => {
    if (!uri || !status.isLoaded || status.duration <= 0) return;
    onPlaybackRatio?.(Math.min(1, Math.max(0, status.currentTime / status.duration)));
  }, [onPlaybackRatio, status.currentTime, status.duration, status.isLoaded, uri]);

  useEffect(() => {
    if (!uri || !status.isLoaded) return;
    const duration = status.duration || 0;
    if (duration <= 0) return;

    const startSec = Math.max(0, trimStartRatio * duration);
    const endSec = Math.min(duration, Math.max(startSec + 0.1, trimEndRatio * duration));
    const fullRange = trimStartRatio <= 0.001 && trimEndRatio >= 0.999;
    player.loop = fullRange;
    player.muted = false;
    player.volume = 1;

    if (scrubToRatio != null) {
      const seekSec = Math.min(endSec, Math.max(startSec, scrubToRatio * duration));
      const key = `scrub:${seekSec.toFixed(2)}`;
      if (lastSeekKeyRef.current !== key) {
        lastSeekKeyRef.current = key;
        void player.seekTo(seekSec);
      }
      player.pause();
      return;
    }

    if (!playing) {
      player.pause();
      return;
    }

    if (status.currentTime < startSec - 0.05 || status.currentTime >= endSec - 0.05) {
      const key = `loop:${startSec.toFixed(2)}`;
      if (lastSeekKeyRef.current !== key) {
        lastSeekKeyRef.current = key;
        void player.seekTo(startSec).then(() => {
          if (playing) player.play();
        });
      }
      return;
    }

    lastSeekKeyRef.current = null;
    if (!status.playing) player.play();
  }, [
    playing,
    player,
    scrubToRatio,
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.playing,
    trimEndRatio,
    trimStartRatio,
    uri,
  ]);

  return null;
}
