"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSwipeBack } from "@/components/jam/use-swipe-back";
import { createVideo } from "@/lib/social-data";
import { supabase } from "@/lib/supabase";

type Stage = "camera" | "uploading" | "details";

const MAX_CAPTION_LENGTH = 200;
const FREE_MAX_RECORDING_SECONDS = 40;
const PRO_MAX_RECORDING_SECONDS = 60;
const NAV_HEIGHT = "calc(96px + env(safe-area-inset-bottom))";

type StreamUpload = {
  cloudflareStreamId: string;
  uploadUrl: string;
  maxDurationSeconds: number;
};

export function PostSheet({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rollInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const [stage, setStage] = useState<Stage>("camera");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [maxRecordingSeconds, setMaxRecordingSeconds] = useState(
    FREE_MAX_RECORDING_SECONDS,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cloudflareStreamId, setCloudflareStreamId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const swipeBack = useSwipeBack(() => {
    if (stage === "details") {
      setStage("camera");
      void restartCamera();
      return;
    }

    closeSheet();
  }, { disabled: stage === "uploading" });

  useEffect(() => {
    let cancelled = false;

    async function initialiseCamera() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("early_adopter")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled && profile?.early_adopter) {
        setMaxRecordingSeconds(PRO_MAX_RECORDING_SECONDS);
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraReady(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setCameraReady(false);
          setCameraError("Camera unavailable. Choose a video from camera roll.");
        }
      }
    }

    initialiseCamera();

    return () => {
      cancelled = true;
      stopRecordingTimers();
      stopCamera();
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function restartCamera() {
    try {
      setCameraError(null);
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraReady(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraReady(false);
      setCameraError("Camera unavailable. Choose a video from camera roll.");
    }
  }

  function stopRecordingTimers() {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function closeSheet() {
    stopRecordingTimers();
    stopCamera();
    if (onClose) {
      onClose();
      return;
    }

    router.push("/feed");
  }

  function normaliseTag(value: string) {
    return value.trim().replace(/^#/, "").toLowerCase();
  }

  function addHashtag(value: string) {
    const tag = normaliseTag(value);
    if (!tag || hashtags.includes(tag)) return;

    setHashtags((current) => [...current, tag]);
    setHashtagInput("");
  }

  function handleHashtagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== " " && event.key !== ",") return;

    event.preventDefault();
    addHashtag(hashtagInput);
  }

  function removeHashtag(tag: string) {
    setHashtags((current) => current.filter((item) => item !== tag));
  }

  function getRecorderMimeType() {
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      return "video/webm;codecs=vp9,opus";
    }
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      return "video/webm;codecs=vp8,opus";
    }
    if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
    return "";
  }

  function startRecording() {
    if (!streamRef.current || recording) return;

    chunksRef.current = [];
    setRecordingSeconds(0);
    setUploadError(null);

    let recorder: MediaRecorder;

    try {
      const mimeType = getRecorderMimeType();
      recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
    } catch {
      setUploadError("Recording is not supported in this browser.");
      return;
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = chunksRef.current[0]?.type || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `jam-recording-${Date.now()}.webm`, { type });
      setRecording(false);
      stopRecordingTimers();
      void uploadVideo(file);
    };

    recorder.start();
    setRecording(true);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((current) =>
        Math.min(current + 1, maxRecordingSeconds),
      );
    }, 1000);
    autoStopTimerRef.current = window.setTimeout(
      stopRecording,
      maxRecordingSeconds * 1000,
    );
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function handleRollChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    void uploadVideo(file);
    event.target.value = "";
  }

  async function createStreamUpload() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/cloudflare-stream/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({ maxDurationSeconds: maxRecordingSeconds }),
    });

    const data = (await response.json()) as Partial<StreamUpload> & {
      error?: string;
    };
    if (!response.ok || !data.uploadUrl || !data.cloudflareStreamId) {
      throw new Error(data.error ?? "Could not start upload.");
    }

    return data as StreamUpload;
  }

  async function uploadVideo(file: File) {
    setStage("uploading");
    setUploadProgress(0);
    setUploadError(null);
    stopCamera();

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const upload = await createStreamUpload();
      await uploadToCloudflare(upload.uploadUrl, file, setUploadProgress);
      setCloudflareStreamId(upload.cloudflareStreamId);
      setStage("details");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      setStage("camera");
      void restartCamera();
    }
  }

  async function postVideo() {
    if (!cloudflareStreamId) return;

    setPosting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    await createVideo({
      userId: user.id,
      caption: caption.trim(),
      hashtags,
      cloudflareStreamId,
    });

    closeSheet();
    router.push("/feed");
  }

  return (
    <div
      {...swipeBack}
      className="fixed left-1/2 top-0 z-[70] w-full max-w-[390px] -translate-x-1/2 bg-[#0a0a0a] text-white"
      style={{ bottom: NAV_HEIGHT }}
    >
      {stage === "camera" && (
        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="relative mx-auto min-h-0 w-full max-w-[390px] flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-contain"
            />
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <p className="rounded-3xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm leading-6 text-zinc-300">
                  {cameraError}
                </p>
              </div>
            )}
            {uploadError && (
              <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-400/20 bg-red-950/70 px-3 py-2 text-center text-xs text-red-100">
                {uploadError}
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-[390px] shrink-0 px-4 pb-5 pt-4">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={!cameraReady}
                className={[
                  "flex h-20 w-20 items-center justify-center rounded-full border-4 transition",
                  recording
                    ? "border-red-400 bg-red-500"
                    : "border-white bg-white/10",
                  !cameraReady ? "opacity-40" : "",
                ].join(" ")}
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                {recording ? (
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {recordingSeconds}s/{maxRecordingSeconds}s
                  </span>
                ) : (
                  <span className="block h-14 w-14 rounded-full bg-red-500 transition-all" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => rollInputRef.current?.click()}
              className="mt-5 w-full rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm font-semibold"
            >
              Choose from camera roll
            </button>
          </div>
        </section>
      )}

      {stage === "uploading" && (
        <section className="flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="w-full max-w-xs">
            <p className="text-lg font-semibold">Uploading video</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-zinc-500">{uploadProgress}%</p>
          </div>
        </section>
      )}

      {stage === "details" && (
        <section className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStage("camera");
                void restartCamera();
              }}
              className="rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-300"
            >
              back
            </button>
            <button type="button" onClick={closeSheet} className="text-sm text-zinc-500">
              close
            </button>
          </div>

          {previewUrl && (
            <div className="overflow-hidden rounded-3xl bg-black">
              <video
                src={previewUrl}
                controls
                playsInline
                className="aspect-[9/16] w-full object-contain"
              />
            </div>
          )}

          <div className="mt-5">
            <textarea
              value={caption}
              maxLength={MAX_CAPTION_LENGTH}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Write a caption..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-500">
              {caption.length}/{MAX_CAPTION_LENGTH}
            </p>
          </div>

          <div className="mt-4">
            {hashtags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeHashtag(tag)}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:text-white"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={hashtagInput}
              onChange={(event) => setHashtagInput(event.target.value)}
              onKeyDown={handleHashtagKeyDown}
              onBlur={() => addHashtag(hashtagInput)}
              placeholder="Add hashtags, then press space or comma"
              className="w-full rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={postVideo}
            disabled={posting || !cloudflareStreamId}
            className="mt-6 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {posting ? "posting..." : "post"}
          </button>
        </section>
      )}

      <input
        ref={rollInputRef}
        type="file"
        accept="video/*"
        onChange={handleRollChange}
        className="sr-only"
      />
    </div>
  );
}

function uploadToCloudflare(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Cloudflare Stream upload failed."));
    };
    request.onerror = () => reject(new Error("Cloudflare Stream upload failed."));
    request.open("POST", uploadUrl);
    request.send(formData);
  });
}
