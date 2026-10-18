import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CachedGridImage, prefetchGridImage } from "@/components/media/cached-grid-image";
import {
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromVideo,
  getVideoDisplaySize,
  imageResizeModeForVideoSize,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import {
  LetterboxMediaShell,
  MEDIA_LOADING_GREY,
} from "@/components/media/letterbox-media-shell";
import {
  VideoPresentationOverlays,
} from "@/components/VideoPresentationOverlays";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import {
  prewarmProfileVideoSource,
  touchProfileVideoPrewarm,
} from "@/lib/profile-video-prewarm";
import { isSlideshowPost, prewarmSlideshowPost } from "@/lib/slideshow-prewarm";
import { getVideoPresentation } from "@/lib/profile-mappers";
import {
  getGridThumbnailCandidates,
  getGridThumbnailPreviewUrl,
  getVideoCaption,
  getVideoThumbnailTimeMs,
} from "@/lib/video-thumbnails";
import { getGridVideoSource, getVideoStreamId } from "@/lib/video-display";
import { styles } from "@/theme/styles";
import { viewportHeight, viewportWidth } from "@/theme/tokens";

export function ProfileGridThumbnail({
  video,
  blurred = false,
  prewarmEnabled = false,
  visibilitySyncRef,
  instantReveal = false,
  onReady,
}: {
  video: ProfileVideo | FeedVideo;
  blurred?: boolean;
  /** When true, start buffering HLS once this thumb intersects the viewport. */
  prewarmEnabled?: boolean;
  visibilitySyncRef?: MutableRefObject<Set<() => void>>;
  /** Skip the load overlay (used for the long-press pin preview clone). */
  instantReveal?: boolean;
  /** Fires once the thumb image is painted (pin preview waits on this to avoid a blank flash). */
  onReady?: () => void;
}) {
  const streamId = getVideoStreamId(video);
  const aspectCacheKey = getVideoAspectCacheKeyFromVideo(video);
  const displaySize = getVideoDisplaySize(video);
  const thumbnailTimeMs = getVideoThumbnailTimeMs(video);
  const mediaUri =
    ("mediaUrl" in video && video.mediaUrl) ||
    ("media_url" in video && video.media_url) ||
    null;
  const candidates = useMemo(
    () => getGridThumbnailCandidates(video),
    [video.id, streamId, thumbnailTimeMs, mediaUri],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [thumbResizeMode, setThumbResizeMode] = useState<"contain" | "cover">(() =>
    imageResizeModeForVideoSize(displaySize?.width, displaySize?.height),
  );
  const uri = candidates[candidateIndex] ?? null;
  const previewUri = useMemo(() => getGridThumbnailPreviewUrl(video), [video.id, streamId, thumbnailTimeMs, mediaUri]);
  const caption = getVideoCaption(video);
  const rootRef = useRef<View>(null);
  const prewarmedVisibleRef = useRef(false);
  const readyNotifiedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [thumbReady, setThumbReady] = useState(instantReveal);

  function notifyReady() {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onReadyRef.current?.();
  }

  function markThumbReady() {
    setThumbReady(true);
    notifyReady();
  }

  useEffect(() => {
    setCandidateIndex(0);
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    setThumbResizeMode(imageResizeModeForVideoSize(cached?.width, cached?.height));
    prewarmedVisibleRef.current = false;
  }, [aspectCacheKey, video.id, streamId, thumbnailTimeMs, mediaUri]);

  useEffect(() => {
    readyNotifiedRef.current = false;
    setThumbReady(instantReveal);
    if (!uri) {
      if (instantReveal) notifyReady();
      return;
    }
    // Pin clones: still unblock onReady if load events are skipped. Do not
    // strip the loading overlay on a timeout — that would flash letterbox black.
    const timer = setTimeout(() => {
      if (instantReveal) notifyReady();
    }, instantReveal ? 320 : 480);
    return () => clearTimeout(timer);
  }, [uri, instantReveal]);

  useEffect(() => {
    if (!prewarmEnabled || blurred || !thumbReady) return;

    const checkVisibility = () => {
      rootRef.current?.measureInWindow((x, y, width, height) => {
        if (!(width > 0 && height > 0)) return;
        const visible =
          y < viewportHeight &&
          y + height > 0 &&
          x < viewportWidth &&
          x + width > 0;
        if (!visible) return;
        if (isSlideshowPost(video)) {
          prewarmSlideshowPost(video);
          return;
        }
        const gridSource = getGridVideoSource(video);
        if (!gridSource) return;
        if (prewarmedVisibleRef.current) {
          touchProfileVideoPrewarm(gridSource);
          return;
        }
        prewarmedVisibleRef.current = true;
        prewarmProfileVideoSource(gridSource);
      });
    };

    visibilitySyncRef?.current.add(checkVisibility);
    const frame = requestAnimationFrame(checkVisibility);
    const interval = setInterval(checkVisibility, 700);
    return () => {
      visibilitySyncRef?.current.delete(checkVisibility);
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
    // video.id only — pin metadata updates must not restart prewarm timers.
  }, [blurred, prewarmEnabled, thumbReady, video.id, visibilitySyncRef]);

  useEffect(() => {
    if (previewUri) void prefetchGridImage(previewUri);
    if (uri) void prefetchGridImage(uri);
  }, [previewUri, uri]);

  if (!uri && !previewUri) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: MEDIA_LOADING_GREY }]}>
        <Text style={styles.gridCaption}>{caption}</Text>
      </View>
    );
  }

  const presentation = getVideoPresentation(video);

  return (
    <LetterboxMediaShell
      loaded={thumbReady}
      previewUri={previewUri}
      letterboxColor={instantReveal ? "transparent" : undefined}
      style={StyleSheet.absoluteFill}
    >
      <View
        ref={rootRef}
        collapsable={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        {uri ? (
          <CachedGridImage
            uri={uri}
            recyclingKey={uri}
            alt={caption}
            contentFit={thumbResizeMode}
            decodeAtTileSize
            priority="high"
            blurRadius={blurred ? 18 : undefined}
            onLoad={(event) => {
              const { width, height } = event.source;
              // Wide clip thumbs are a reliable landscape signal. Portrait JPEG boxes
              // are not — Cloudflare fill stills are a 9:16 canvas around landscape.
              if (width > height) {
                rememberVideoAspectSize(aspectCacheKey, width, height);
                setThumbResizeMode("contain");
              } else {
                const cached = getRememberedVideoAspectSize(aspectCacheKey);
                if (cached) {
                  setThumbResizeMode(imageResizeModeForVideoSize(cached.width, cached.height));
                }
              }
              markThumbReady();
            }}
            onLoadEnd={() => {
              markThumbReady();
            }}
            onError={() => {
              setCandidateIndex((current) => {
                if (current + 1 < candidates.length) return current + 1;
                notifyReady();
                return current;
              });
            }}
          />
        ) : null}
        {!blurred ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <VideoPresentationOverlays
              filter={presentation.filter}
              textOverlays={presentation.textOverlays}
              density="thumb"
            />
          </View>
        ) : null}
      </View>
    </LetterboxMediaShell>
  );
}
