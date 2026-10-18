import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus,
} from "expo-audio";

const END_EPSILON_SEC = 0.03;
const BEFORE_START_EPSILON_SEC = 0.1;
const PLAYBACK_RATIO_THROTTLE_MS = 120;
const WATCHDOG_INTERVAL_MS = 250;
const LOADING_TRUE_DEBOUNCE_MS = 150;
const STATUS_LOG_THROTTLE_MS = 1000;
const SEEK_RESTART_COOLDOWN_MS = 600;
const TAP_AFTER_LOG_MS = 400;
const READY_POLL_MS = 100;
const READY_TIMEOUT_MS = 8000;

type SeekTarget = { sec: number; playAfter: boolean };

export type CreateEditSoundtrackHandle = {
  userToggle: (paused: boolean) => void;
};

function isFullTrimRange(trimStartRatio: number, trimEndRatio: number) {
  return trimStartRatio <= 0.001 && trimEndRatio >= 0.999;
}

function windowBounds(duration: number, trimStartRatio: number, trimEndRatio: number) {
  const startSec = Math.max(0, trimStartRatio * duration);
  const endSec = Math.min(duration, Math.max(startSec + 0.1, trimEndRatio * duration));
  return { startSec, endSec };
}

function snapshotForTapLog(status: AudioStatus, player: { muted?: boolean; volume?: number; loop?: boolean }) {
  return {
    isLoaded: status.isLoaded,
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
    muted: player.muted ?? status.mute,
    volume: player.volume,
    loop: player.loop ?? status.loop,
    timeControlStatus: status.timeControlStatus,
    playbackState: status.playbackState,
  };
}

export const CreateEditSoundtrack = forwardRef<
  CreateEditSoundtrackHandle,
  {
    uri: string | null;
    playing: boolean;
    trimStartRatio?: number;
    trimEndRatio?: number;
    scrubToRatio?: number | null;
    resumeSignal?: number;
    onDurationMs?: (durationMs: number) => void;
    onPlaybackRatio?: (ratio: number) => void;
    onReady?: (uri: string) => void;
    onLoadError?: (uri: string, reason: string) => void;
    onLoadingChange?: (loading: boolean) => void;
    loadTimingStartedAt?: number | null;
  }
>(function CreateEditSoundtrack(
  {
    uri,
    playing,
    trimStartRatio = 0,
    trimEndRatio = 1,
    scrubToRatio = null,
    resumeSignal = 0,
    onDurationMs,
    onPlaybackRatio,
    onReady,
    onLoadError,
    onLoadingChange,
    loadTimingStartedAt = null,
  },
  ref,
) {
  const player = useAudioPlayer(uri, {
    updateInterval: 80,
    downloadFirst: false,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);

  const pendingTargetRef = useRef<SeekTarget | null>(null);
  const seekRunningRef = useRef(false);
  const lastResumeSignalRef = useRef(0);
  const readyUriRef = useRef<string | null>(null);
  const lastMutedRef = useRef<boolean | null>(null);
  const lastVolumeRef = useRef<number | null>(null);
  const lastLoopRef = useRef<boolean | null>(null);
  const lastPlaybackEmitAtRef = useRef(0);
  const lastPlaybackRatioRef = useRef(-1);
  const lastScrubSeekSecRef = useRef<number | null>(null);
  const lastStatusLogAtRef = useRef(0);
  const lastStatusLogKeyRef = useRef("");
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedLoadingRef = useRef<boolean | null>(null);
  const lastCompletedSeekRef = useRef<{ sec: number; at: number } | null>(null);
  const userPausedRef = useRef(false);

  const playingRef = useRef(playing);
  const scrubToRatioRef = useRef(scrubToRatio);
  const trimStartRatioRef = useRef(trimStartRatio);
  const trimEndRatioRef = useRef(trimEndRatio);
  const onPlaybackRatioRef = useRef(onPlaybackRatio);
  const onDurationMsRef = useRef(onDurationMs);
  const onReadyRef = useRef(onReady);
  const onLoadErrorRef = useRef(onLoadError);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const loadTimingStartedAtRef = useRef(loadTimingStartedAt);
  const playerRef = useRef(player);
  const statusRef = useRef(status);
  const enqueueSeekRef = useRef<(sec: number, playAfter: boolean) => void>(() => {});
  const reportLoadingRef = useRef<(nextStatus?: AudioStatus) => void>(() => {});
  const tryMarkReadyRef = useRef<(via: "poll" | "event") => boolean>(() => false);

  useEffect(() => {
    playingRef.current = playing;
    scrubToRatioRef.current = scrubToRatio;
    trimStartRatioRef.current = trimStartRatio;
    trimEndRatioRef.current = trimEndRatio;
    onPlaybackRatioRef.current = onPlaybackRatio;
    onDurationMsRef.current = onDurationMs;
    onReadyRef.current = onReady;
    onLoadErrorRef.current = onLoadError;
    onLoadingChangeRef.current = onLoadingChange;
    loadTimingStartedAtRef.current = loadTimingStartedAt;
    playerRef.current = player;
    statusRef.current = status;
  }, [
    loadTimingStartedAt,
    onDurationMs,
    onLoadError,
    onLoadingChange,
    onPlaybackRatio,
    onReady,
    player,
    playing,
    scrubToRatio,
    status,
    trimEndRatio,
    trimStartRatio,
  ]);

  useEffect(() => {
    if (playing) {
      userPausedRef.current = false;
    }
  }, [playing]);

  useEffect(() => {
    const clearLoadingTimer = () => {
      if (loadingTimerRef.current != null) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };

    const reportLoading = (nextStatus?: AudioStatus) => {
      const onChange = onLoadingChangeRef.current;
      if (!onChange) return;
      const s = nextStatus ?? statusRef.current;
      const wantPlaying =
        playingRef.current && !userPausedRef.current && scrubToRatioRef.current == null;

      if (s.playing) {
        clearLoadingTimer();
        if (lastReportedLoadingRef.current !== false) {
          lastReportedLoadingRef.current = false;
          onChange(false);
        }
        return;
      }

      const rawLoading =
        wantPlaying &&
        (!s.isLoaded ||
          seekRunningRef.current ||
          pendingTargetRef.current != null ||
          s.isBuffering ||
          !s.playing);

      if (!rawLoading) {
        clearLoadingTimer();
        if (lastReportedLoadingRef.current !== false) {
          lastReportedLoadingRef.current = false;
          onChange(false);
        }
        return;
      }

      if (lastReportedLoadingRef.current === true) return;
      if (loadingTimerRef.current != null) return;

      loadingTimerRef.current = setTimeout(() => {
        loadingTimerRef.current = null;
        const latest = statusRef.current;
        const stillWant =
          playingRef.current && !userPausedRef.current && scrubToRatioRef.current == null;
        const stillLoading =
          stillWant &&
          !latest.playing &&
          (!latest.isLoaded ||
            seekRunningRef.current ||
            pendingTargetRef.current != null ||
            latest.isBuffering ||
            !latest.playing);
        if (!stillLoading) {
          if (lastReportedLoadingRef.current !== false) {
            lastReportedLoadingRef.current = false;
            onChange(false);
          }
          return;
        }
        if (lastReportedLoadingRef.current !== true) {
          lastReportedLoadingRef.current = true;
          onChange(true);
        }
      }, LOADING_TRUE_DEBOUNCE_MS);
    };

    const runSeek = () => {
      if (seekRunningRef.current) return;
      const target = pendingTargetRef.current;
      if (!target) return;
      pendingTargetRef.current = null;
      seekRunningRef.current = true;
      reportLoading();

      const activePlayer = playerRef.current;
      if (__DEV__) {
        console.log("[edit-soundtrack] seek target", target.sec, {
          playAfter: target.playAfter,
        });
      }
      void activePlayer
        .seekTo(target.sec, 0, 0)
        .then(() => {
          if (__DEV__) {
            console.log("[edit-soundtrack] landed currentTime", activePlayer.currentTime);
          }
        })
        .catch((error) => {
          if (__DEV__) {
            console.warn("[edit-soundtrack] seek error", error);
          }
        })
        .finally(() => {
          seekRunningRef.current = false;
          lastCompletedSeekRef.current = { sec: target.sec, at: Date.now() };
          if (pendingTargetRef.current) {
            runSeek();
            return;
          }
          if (
            target.playAfter &&
            playingRef.current &&
            !userPausedRef.current &&
            scrubToRatioRef.current == null
          ) {
            try {
              activePlayer.play();
            } catch (error) {
              if (__DEV__) {
                console.warn("[edit-soundtrack] play error", error);
              }
            }
          }
          reportLoading();
        });
    };

    reportLoadingRef.current = reportLoading;
    enqueueSeekRef.current = (sec: number, playAfter: boolean) => {
      pendingTargetRef.current = { sec, playAfter };
      reportLoading();
      runSeek();
    };

    return () => {
      clearLoadingTimer();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    userToggle(paused: boolean) {
      const activePlayer = playerRef.current;
      const beforeStatus = statusRef.current;
      const duration = beforeStatus.duration || 0;
      const { startSec, endSec } = windowBounds(
        duration,
        trimStartRatioRef.current,
        trimEndRatioRef.current,
      );
      const before = snapshotForTapLog(beforeStatus, activePlayer);

      if (__DEV__) {
        console.log("[edit-soundtrack] tap", {
          action: paused ? "pause" : "play",
          before,
          cropStart: startSec,
          cropEnd: endSec,
        });
      }

      userPausedRef.current = paused;

      if (paused) {
        pendingTargetRef.current = null;
        try {
          activePlayer.pause();
        } catch (error) {
          if (__DEV__) {
            console.warn("[edit-soundtrack] pause error", error);
          }
        }
        if (loadingTimerRef.current != null) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        if (lastReportedLoadingRef.current !== false) {
          lastReportedLoadingRef.current = false;
          onLoadingChangeRef.current?.(false);
        }
      } else {
        userPausedRef.current = false;
        let currentTime = beforeStatus.currentTime;
        try {
          currentTime = activePlayer.currentTime ?? currentTime;
        } catch {
          // keep status currentTime
        }
        const outsideWindow =
          duration > 0 &&
          (currentTime < startSec || currentTime >= endSec - END_EPSILON_SEC);

        if (outsideWindow) {
          void activePlayer
            .seekTo(startSec, 0, 0)
            .then(() => {
              if (userPausedRef.current) return;
              try {
                activePlayer.play();
              } catch (error) {
                if (__DEV__) {
                  console.warn("[edit-soundtrack] play error", error);
                }
              }
            })
            .catch((error) => {
              if (__DEV__) {
                console.warn("[edit-soundtrack] seek error", error);
              }
            });
        } else {
          try {
            activePlayer.play();
          } catch (error) {
            if (__DEV__) {
              console.warn("[edit-soundtrack] play error", error);
            }
          }
        }
      }

      if (__DEV__) {
        setTimeout(() => {
          const afterStatus = statusRef.current;
          const afterPlayer = playerRef.current;
          const afterDuration = afterStatus.duration || 0;
          const afterBounds = windowBounds(
            afterDuration,
            trimStartRatioRef.current,
            trimEndRatioRef.current,
          );
          console.log("[edit-soundtrack] tap", {
            action: paused ? "pause" : "play",
            after: snapshotForTapLog(afterStatus, afterPlayer),
            cropStart: afterBounds.startSec,
            cropEnd: afterBounds.endSec,
          });
        }, TAP_AFTER_LOG_MS);
      }
    },
  }));

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
    pendingTargetRef.current = null;
    seekRunningRef.current = false;
    lastScrubSeekSecRef.current = null;
    lastResumeSignalRef.current = 0;
    lastPlaybackRatioRef.current = -1;
    lastCompletedSeekRef.current = null;
    lastMutedRef.current = null;
    lastVolumeRef.current = null;
    lastLoopRef.current = null;
    readyUriRef.current = null;
    userPausedRef.current = false;
    if (loadingTimerRef.current != null) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    if (lastReportedLoadingRef.current !== false) {
      lastReportedLoadingRef.current = false;
      onLoadingChangeRef.current?.(false);
    }
  }, [uri, player]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current != null) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      pendingTargetRef.current = null;
      seekRunningRef.current = false;
    };
  }, []);

  // Readiness: sync player.* check + poll. Status events alone can miss readyToPlay
  // when useAudioPlayerStatus subscribes after a fast local file has already loaded.
  useEffect(() => {
    if (!uri) {
      tryMarkReadyRef.current = () => false;
      return;
    }

    let cancelled = false;
    let settled = false;
    const pollStartedAt = Date.now();

    const elapsedMs = () => {
      const started = loadTimingStartedAtRef.current;
      return started != null ? Date.now() - started : Date.now() - pollStartedAt;
    };

    const tryMarkReady = (via: "poll" | "event") => {
      if (cancelled || settled) return false;
      let isLoaded = false;
      let duration = 0;
      try {
        isLoaded = Boolean(player.isLoaded);
        duration = Number(player.duration) || 0;
      } catch {
        return false;
      }
      if (!isLoaded || !(duration > 0)) return false;

      settled = true;
      const durationMs = Math.max(0, Math.round(duration * 1000));
      const fullRange = isFullTrimRange(
        trimStartRatioRef.current,
        trimEndRatioRef.current,
      );
      try {
        if (lastLoopRef.current !== fullRange) {
          lastLoopRef.current = fullRange;
          player.loop = fullRange;
        }
        if (lastMutedRef.current !== false) {
          lastMutedRef.current = false;
          player.muted = false;
        }
        if (lastVolumeRef.current !== 1) {
          lastVolumeRef.current = 1;
          player.volume = 1;
        }
      } catch {
        // ignore; playback watchdog can still recover
      }
      onDurationMsRef.current?.(durationMs);
      if (readyUriRef.current !== uri) {
        readyUriRef.current = uri;
        onReadyRef.current?.(uri);
      }
      if (__DEV__) {
        console.log("[audio-attach] player loaded", {
          via,
          durationMs,
          ms: elapsedMs(),
        });
      }
      return true;
    };

    tryMarkReadyRef.current = tryMarkReady;

    if (tryMarkReady("poll")) {
      return () => {
        cancelled = true;
        tryMarkReadyRef.current = () => false;
      };
    }

    const interval = setInterval(() => {
      if (cancelled || settled) {
        clearInterval(interval);
        return;
      }
      if (Date.now() - pollStartedAt >= READY_TIMEOUT_MS) {
        clearInterval(interval);
        if (cancelled || settled) return;
        settled = true;
        if (__DEV__) {
          console.log("[audio-attach] load timeout", { ms: elapsedMs() });
        }
        onLoadErrorRef.current?.(uri, "timeout");
        return;
      }
      if (tryMarkReady("poll")) {
        clearInterval(interval);
      }
    }, READY_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      tryMarkReadyRef.current = () => false;
    };
  }, [player, uri]);

  useEffect(() => {
    if (!uri) return;
    tryMarkReadyRef.current("event");
    reportLoadingRef.current(status);
  }, [status, uri]);

  useEffect(() => {
    if (!uri) return;
    let isLoaded = false;
    try {
      isLoaded = Boolean(player.isLoaded);
    } catch {
      return;
    }
    if (!isLoaded) return;
    const fullRange = isFullTrimRange(trimStartRatio, trimEndRatio);
    const nextLoop = fullRange;
    if (lastLoopRef.current !== nextLoop) {
      lastLoopRef.current = nextLoop;
      player.loop = nextLoop;
    }
    if (lastMutedRef.current !== false) {
      lastMutedRef.current = false;
      player.muted = false;
    }
    if (lastVolumeRef.current !== 1) {
      lastVolumeRef.current = 1;
      player.volume = 1;
    }
  }, [player, trimEndRatio, trimStartRatio, uri]);

  useEffect(() => {
    if (!uri) return;

    const emitPlaybackRatio = (ratio: number) => {
      const onRatio = onPlaybackRatioRef.current;
      if (!onRatio) return;
      const now = Date.now();
      if (
        now - lastPlaybackEmitAtRef.current < PLAYBACK_RATIO_THROTTLE_MS &&
        Math.abs(ratio - lastPlaybackRatioRef.current) < 0.01
      ) {
        return;
      }
      lastPlaybackEmitAtRef.current = now;
      lastPlaybackRatioRef.current = ratio;
      onRatio(ratio);
    };

    const logStatus = (next: AudioStatus, force: boolean) => {
      if (!__DEV__) return;
      const key = `${next.isLoaded}:${next.playing}:${next.isBuffering}:${next.didJustFinish}`;
      const now = Date.now();
      const keyChanged = key !== lastStatusLogKeyRef.current;
      if (!force && !keyChanged && now - lastStatusLogAtRef.current < STATUS_LOG_THROTTLE_MS) {
        return;
      }
      lastStatusLogAtRef.current = now;
      lastStatusLogKeyRef.current = key;
      const duration = next.duration || 0;
      const { startSec, endSec } = windowBounds(
        duration,
        trimStartRatioRef.current,
        trimEndRatioRef.current,
      );
      console.log("[edit-soundtrack] status", {
        isLoaded: next.isLoaded,
        playing: next.playing,
        isBuffering: next.isBuffering,
        currentTime: next.currentTime,
        duration,
        start: startSec,
        end: endSec,
        seekRunning: seekRunningRef.current,
        pending: pendingTargetRef.current,
        wantPlaying:
          playingRef.current && !userPausedRef.current && scrubToRatioRef.current == null,
      });
    };

    const onStatus = (next: AudioStatus) => {
      statusRef.current = next;
      reportLoadingRef.current(next);

      if (!next.isLoaded || next.duration <= 0) {
        logStatus(next, false);
        return;
      }

      const duration = next.duration;
      emitPlaybackRatio(Math.min(1, Math.max(0, next.currentTime / duration)));
      logStatus(next, Boolean(next.didJustFinish));

      if (__DEV__ && next.didJustFinish) {
        console.log("[edit-soundtrack] didJustFinish", next.currentTime);
      }

      if (scrubToRatioRef.current != null) {
        if (next.playing) player.pause();
        return;
      }

      if (userPausedRef.current) {
        if (next.playing) player.pause();
        return;
      }

      if (!playingRef.current) {
        if (next.playing) player.pause();
        return;
      }

      const trimStart = trimStartRatioRef.current;
      const trimEnd = trimEndRatioRef.current;
      if (isFullTrimRange(trimStart, trimEnd)) {
        if (!next.playing) player.play();
        return;
      }

      const { startSec, endSec } = windowBounds(duration, trimStart, trimEnd);
      const pastEnd = next.currentTime >= endSec - END_EPSILON_SEC;
      const beforeStart = next.currentTime < startSec - BEFORE_START_EPSILON_SEC;
      if (pastEnd || next.didJustFinish || beforeStart) {
        enqueueSeekRef.current(startSec, true);
        return;
      }

      if (!next.playing) player.play();
    };

    const subscription = player.addListener("playbackStatusUpdate", onStatus);
    return () => {
      subscription.remove();
    };
  }, [player, uri]);

  // Dragging a handle: pause and scrub to the handle with zero tolerance.
  useEffect(() => {
    if (!uri || !status.isLoaded || status.duration <= 0) return;
    if (scrubToRatio == null) {
      lastScrubSeekSecRef.current = null;
      return;
    }

    const { startSec, endSec } = windowBounds(status.duration, trimStartRatio, trimEndRatio);
    const seekSec = Math.min(endSec, Math.max(startSec, scrubToRatio * status.duration));
    if (lastScrubSeekSecRef.current != null && Math.abs(lastScrubSeekSecRef.current - seekSec) < 0.005) {
      player.pause();
      return;
    }
    lastScrubSeekSecRef.current = seekSec;
    player.pause();
    enqueueSeekRef.current(seekSec, false);
  }, [player, scrubToRatio, status.duration, status.isLoaded, trimEndRatio, trimStartRatio, uri]);

  // Handle release / play state: seek to crop start then play (unless user-paused).
  useEffect(() => {
    if (!uri || !status.isLoaded || status.duration <= 0) return;
    if (scrubToRatio != null) {
      reportLoadingRef.current(status);
      return;
    }

    const { startSec, endSec } = windowBounds(status.duration, trimStartRatio, trimEndRatio);

    if (resumeSignal > 0 && lastResumeSignalRef.current !== resumeSignal) {
      lastResumeSignalRef.current = resumeSignal;
      enqueueSeekRef.current(startSec, !userPausedRef.current);
      return;
    }

    if (userPausedRef.current) {
      if (status.playing) player.pause();
      reportLoadingRef.current(status);
      return;
    }

    if (!playing) {
      player.pause();
      reportLoadingRef.current(status);
      return;
    }

    if (!status.playing && !seekRunningRef.current && pendingTargetRef.current == null) {
      const t = status.currentTime;
      if (t < startSec - BEFORE_START_EPSILON_SEC || t >= endSec - END_EPSILON_SEC) {
        enqueueSeekRef.current(startSec, true);
      } else {
        player.play();
      }
    }
    reportLoadingRef.current(status);
  }, [
    playing,
    player,
    resumeSignal,
    scrubToRatio,
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.playing,
    trimEndRatio,
    trimStartRatio,
    uri,
  ]);

  // Watchdog: recover paused/stale crop playback without relying on status events.
  useEffect(() => {
    if (!uri) return;

    const timer = setInterval(() => {
      if (userPausedRef.current) return;
      if (!playingRef.current || scrubToRatioRef.current != null) return;
      if (seekRunningRef.current || pendingTargetRef.current != null) return;

      let currentTime = 0;
      let isPlaying = false;
      let duration = 0;
      try {
        currentTime = player.currentTime ?? 0;
        isPlaying = Boolean(player.playing);
        duration = player.duration ?? 0;
      } catch {
        return;
      }
      if (!(duration > 0)) return;

      const trimStart = trimStartRatioRef.current;
      const trimEnd = trimEndRatioRef.current;
      if (isFullTrimRange(trimStart, trimEnd)) {
        if (!isPlaying) {
          try {
            player.play();
          } catch (error) {
            if (__DEV__) {
              console.warn("[edit-soundtrack] watchdog play error", error);
            }
          }
        }
        return;
      }

      const { startSec, endSec } = windowBounds(duration, trimStart, trimEnd);
      const outside =
        currentTime < startSec - BEFORE_START_EPSILON_SEC ||
        currentTime >= endSec - END_EPSILON_SEC;
      if (outside) {
        const last = lastCompletedSeekRef.current;
        if (
          last &&
          Math.abs(last.sec - startSec) < 0.001 &&
          Date.now() - last.at < SEEK_RESTART_COOLDOWN_MS
        ) {
          return;
        }
        enqueueSeekRef.current(startSec, true);
        return;
      }
      if (!isPlaying) {
        try {
          player.play();
        } catch (error) {
          if (__DEV__) {
            console.warn("[edit-soundtrack] watchdog play error", error);
          }
        }
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [player, uri]);

  useEffect(() => {
    reportLoadingRef.current(statusRef.current);
  }, [
    playing,
    scrubToRatio,
    status.isBuffering,
    status.isLoaded,
    status.playing,
    uri,
  ]);

  return null;
});
