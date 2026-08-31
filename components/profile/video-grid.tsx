import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  PinIcon,
  PIN_MENU_CARD_HEIGHT,
  PIN_MENU_CARD_WIDTH,
  PIN_PREVIEW_EASE,
  PIN_PREVIEW_SCALE,
} from "@/components/icons/pin-icon";
import { ProfileGridThumbnail } from "@/components/profile/profile-grid-thumbnail";
import { UploadProgressRing } from "@/components/profile/upload-progress-ring";
import { triggerHoldHaptic } from "@/lib/hold-haptic";
import {
  getProfileVideoPinnedRank,
  type FeedVideo,
  type ProfileVideo,
} from "@/lib/native-social-data";
import {
  getPendingSlideshowUploadById,
  usePendingSlideshowUploads,
} from "@/lib/pending-slideshow-uploads";
import {
  getPendingUploadById,
  getPendingUploadIdFromProfileVideoId,
  isPendingProfileVideoId,
  usePendingVideoUploads,
} from "@/lib/pending-video-uploads";
import { getGridThumbnailCandidates } from "@/lib/video-thumbnails";
import { activeThemeMode, styles } from "@/theme/styles";
import {
  PROFILE_GRID_GAP,
  PROFILE_GRID_ITEM_WIDTH,
  dark,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";

function resolvePendingGridUpload(videoId: string) {
  if (!isPendingProfileVideoId(videoId)) return null;
  const uploadId = getPendingUploadIdFromProfileVideoId(videoId);
  const videoUpload = getPendingUploadById(uploadId);
  if (videoUpload) {
    return {
      id: videoUpload.id,
      progress: videoUpload.progress,
      phase: videoUpload.phase,
      presentationBaked: Boolean(videoUpload.presentationBaked),
    };
  }
  const slideshowUpload = getPendingSlideshowUploadById(uploadId);
  if (slideshowUpload) {
    return {
      id: slideshowUpload.id,
      progress: Math.round(slideshowUpload.progress * 100),
      phase: slideshowUpload.phase,
      presentationBaked: true,
    };
  }
  return null;
}

export function VideoGrid({
  videos,
  locked,
  lockMessage,
  lockScrollSyncRef,
  privateCopy,
  showPendingUploadState = false,
  prewarmVisibleVideos = false,
  allowPinning = false,
  onRetryPendingUpload,
  onTogglePin,
  onPinPreviewChange,
  ensurePinItemVisible,
  onVideoPress,
}: {
  videos: Array<ProfileVideo | FeedVideo>;
  locked?: boolean;
  lockMessage?: string;
  /** Parent calls this on every scroll frame so the lock copy stays viewport-centred. */
  lockScrollSyncRef?: MutableRefObject<(() => void) | null>;
  privateCopy?: boolean;
  showPendingUploadState?: boolean;
  /** Pre-buffer HLS for thumbs that intersect the viewport. */
  prewarmVisibleVideos?: boolean;
  /** Own-profile only: long-press opens a pin popup. */
  allowPinning?: boolean;
  onRetryPendingUpload?: (uploadId: string) => void;
  onTogglePin?: (video: ProfileVideo | FeedVideo) => void;
  /** Fired when the long-press pin preview opens/closes (lock parent scroll). */
  onPinPreviewChange?: (active: boolean) => void;
  /** Scroll the parent so a partially visible thumb is fully on screen before preview. */
  ensurePinItemVisible?: (rect: {
    y: number;
    height: number;
    topExtra?: number;
    bottomExtra?: number;
  }) => Promise<void>;
  onVideoPress?: (video: ProfileVideo | FeedVideo, index: number) => void;
}) {
  usePendingVideoUploads();
  usePendingSlideshowUploads();
  const lockGateRef = useRef<View>(null);
  const lockMessageRef = useRef<View>(null);
  const lockMessageHeightRef = useRef(48);
  const thumbVisibilityCheckersRef = useRef<Set<() => void>>(new Set());
  const gridItemRefs = useRef(new Map<string, View | null>());
  const pinPreviewScale = useRef(new Animated.Value(1)).current;
  const pinPreviewDim = useRef(new Animated.Value(0)).current;
  const pinMenuCardAnim = useRef(new Animated.Value(0)).current;
  const pinPreviewClosingRef = useRef(false);
  const pinPreviewAfterCloseRef = useRef<(() => void) | null>(null);
  const pinPreviewOpenTokenRef = useRef(0);
  const [pinMenu, setPinMenu] = useState<{
    videoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  /** Clone image has painted — safe to cover the real thumb and enlarge. */
  const [pinCloneReady, setPinCloneReady] = useState(false);
  const pinMenuVideo = pinMenu
    ? videos.find((entry) => entry.id === pinMenu.videoId) ?? null
    : null;
  const pinMenuPinned = getProfileVideoPinnedRank(pinMenuVideo as ProfileVideo | null) != null;

  function openPinMenuForVideo(videoId: string) {
    if (pinPreviewClosingRef.current) return;
    triggerHoldHaptic();
    const targetVideo = videos.find((entry) => entry.id === videoId) ?? null;
    const present = (x: number, y: number, width: number, height: number) => {
      pinPreviewClosingRef.current = false;
      pinPreviewAfterCloseRef.current = null;
      pinPreviewScale.stopAnimation();
      pinPreviewDim.stopAnimation();
      pinMenuCardAnim.stopAnimation();
      pinPreviewScale.setValue(1);
      pinPreviewDim.setValue(0);
      pinMenuCardAnim.setValue(0);
      pinPreviewOpenTokenRef.current += 1;
      // Mount the modal clone first; enlarge waits on paint so we never cover the
      // real thumb with an empty/black frame. Caller scrolls clipped tiles first.
      setPinCloneReady(false);
      setPinMenu({ videoId, x, y, width, height });
    };

    const node = gridItemRefs.current.get(videoId);
    if (!node) {
      present(viewportWidth / 2 - 40, viewportHeight / 2 - 40, 80, 80);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      const expand = (height * (PIN_PREVIEW_SCALE - 1)) / 2;
      // Warm cache in the background; the grid thumb is usually already decoded.
      const thumbUri = targetVideo ? getGridThumbnailCandidates(targetVideo)[0] : null;
      if (thumbUri) {
        void Image.prefetch(thumbUri);
      }

      const presentAfterLayout = () => {
        if (pinPreviewClosingRef.current) return;
        node.measureInWindow((nx, ny, nw, nh) => {
          if (pinPreviewClosingRef.current) return;
          present(nx, ny, nw, nh);
        });
      };

      // Bring a clipped tile fully on screen (with room to enlarge + pin card) first,
      // then open — fully visible tiles resolve immediately and enlarge right away.
      if (!ensurePinItemVisible) {
        present(x, y, width, height);
        return;
      }
      void ensurePinItemVisible({
        y,
        height,
        topExtra: expand + PIN_MENU_CARD_HEIGHT + 10,
        bottomExtra: expand + 8,
      }).then(presentAfterLayout);
    });
  }

  function dismissPinMenu(afterClose?: () => void) {
    // A second dismiss during the close animation used to run afterClose
    // immediately (pin → unpin → pin). Keep a single close callback instead.
    if (pinPreviewClosingRef.current) {
      if (afterClose) pinPreviewAfterCloseRef.current = afterClose;
      return;
    }
    if (!pinMenu) {
      afterClose?.();
      return;
    }
    pinPreviewClosingRef.current = true;
    pinPreviewAfterCloseRef.current = afterClose ?? null;
    pinPreviewOpenTokenRef.current += 1;
    Animated.parallel([
      Animated.timing(pinPreviewScale, {
        toValue: 1,
        duration: 220,
        easing: PIN_PREVIEW_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(pinPreviewDim, {
        toValue: 0,
        duration: 220,
        easing: PIN_PREVIEW_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(pinMenuCardAnim, {
        toValue: 0,
        duration: 220,
        easing: PIN_PREVIEW_EASE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      pinPreviewClosingRef.current = false;
      const cb = pinPreviewAfterCloseRef.current;
      pinPreviewAfterCloseRef.current = null;
      if (!finished) return;
      setPinMenu(null);
      setPinCloneReady(false);
      cb?.();
    });
  }

  useEffect(() => {
    onPinPreviewChange?.(Boolean(pinMenu));
    return () => onPinPreviewChange?.(false);
  }, [onPinPreviewChange, pinMenu]);

  useEffect(() => {
    if (!pinMenu || !pinCloneReady) return;
    const token = pinPreviewOpenTokenRef.current;
    // Enlarge only after the clone bitmap is ready — transparent modal keeps the
    // real grid thumb visible until then (no black flash).
    const frame = requestAnimationFrame(() => {
      if (token !== pinPreviewOpenTokenRef.current || pinPreviewClosingRef.current) return;
      Animated.parallel([
        Animated.timing(pinPreviewScale, {
          toValue: PIN_PREVIEW_SCALE,
          duration: 260,
          easing: PIN_PREVIEW_EASE,
          useNativeDriver: true,
        }),
        Animated.timing(pinPreviewDim, {
          toValue: 0.38,
          duration: 260,
          easing: PIN_PREVIEW_EASE,
          useNativeDriver: true,
        }),
        Animated.timing(pinMenuCardAnim, {
          toValue: 1,
          duration: 260,
          easing: PIN_PREVIEW_EASE,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [pinMenu?.videoId, pinCloneReady]);

  const profileGridItemHeight = PROFILE_GRID_ITEM_WIDTH * (16 / 9);
  const rowStride = profileGridItemHeight + PROFILE_GRID_GAP;
  const showLockGate = Boolean(locked && videos.length > 3);
  // Fade covers all blurred rows (from row 2).
  const lockGateTop = 8 + rowStride;
  // Rise from row 3, release onto the second-to-last row at the end.
  const rowCount = Math.max(1, Math.ceil(videos.length / 3));
  const row3CenterFromRoot = 8 + 2 * rowStride + profileGridItemHeight / 2;
  const secondLastRowIndex = Math.max(0, rowCount - 2);
  const secondLastRowCenterFromRoot =
    8 + secondLastRowIndex * rowStride + profileGridItemHeight / 2;
  const riseAnchorFromGateTop = row3CenterFromRoot - lockGateTop;
  const releaseAnchorFromGateTop = secondLastRowCenterFromRoot - lockGateTop;
  const lockFadeColor = activeThemeMode === "light" ? "#f7f7f8" : dark;

  const updateLockMessagePosition = useCallback(() => {
    if (!showLockGate) {
      lockMessageRef.current?.setNativeProps({ style: { opacity: 0 } });
      return;
    }

    lockGateRef.current?.measureInWindow((_x, y, _width, height) => {
      if (height <= 0) {
        lockMessageRef.current?.setNativeProps({ style: { opacity: 0 } });
        return;
      }

      const viewportCenter = viewportHeight / 2;
      const messageHeight = lockMessageHeightRef.current;
      const riseAnchorY = y + riseAnchorFromGateTop;
      const releaseAnchorY = y + releaseAnchorFromGateTop;
      // Between row 3 and second-to-last: stick to screen middle; else follow those anchors.
      const topAnchorY = Math.min(riseAnchorY, releaseAnchorY);
      const bottomAnchorY = Math.max(riseAnchorY, releaseAnchorY);
      const messageCenterY = Math.min(
        bottomAnchorY,
        Math.max(topAnchorY, viewportCenter),
      );
      const gateBottom = y + height;

      // Fade in as row 3 rises; soft fade if you scroll back up / past the gate.
      const fadeBand = Math.max(64, profileGridItemHeight * 0.75);
      const fadeIn = (viewportHeight - riseAnchorY) / (viewportHeight - viewportCenter);
      const fadeOut = (gateBottom - messageCenterY) / fadeBand;
      const opacity = Math.max(0, Math.min(1, fadeIn, fadeOut));

      lockMessageRef.current?.setNativeProps({
        style: {
          opacity,
          top: Math.max(0, messageCenterY - y - messageHeight / 2),
        },
      });
    });
  }, [
    profileGridItemHeight,
    releaseAnchorFromGateTop,
    riseAnchorFromGateTop,
    showLockGate,
  ]);

  const runGridScrollSync = useCallback(() => {
    if (showLockGate) updateLockMessagePosition();
    if (prewarmVisibleVideos) {
      for (const check of thumbVisibilityCheckersRef.current) {
        check();
      }
    }
  }, [prewarmVisibleVideos, showLockGate, updateLockMessagePosition]);

  useLayoutEffect(() => {
    if (!lockScrollSyncRef) return;
    lockScrollSyncRef.current = runGridScrollSync;
    return () => {
      if (lockScrollSyncRef.current === runGridScrollSync) {
        lockScrollSyncRef.current = null;
      }
    };
  }, [lockScrollSyncRef, runGridScrollSync]);

  useLayoutEffect(() => {
    if (!showLockGate) {
      lockMessageRef.current?.setNativeProps({ style: { opacity: 0 } });
      return;
    }
    updateLockMessagePosition();
  }, [showLockGate, videos.length, updateLockMessagePosition]);

  if (videos.length === 0) {
    return <Text style={styles.profileSavedEmptyText}>no videos yet</Text>;
  }

  return (
    <View>
      {privateCopy ? <Text style={styles.helper}>only visible to you.</Text> : null}
      <View style={styles.grid}>
        {videos.map((video, index) => {
          const isLocked = Boolean(locked && index >= 3);
          const pendingUpload =
            showPendingUploadState ? resolvePendingGridUpload(video.id) : null;
          const isPendingFailed = pendingUpload?.phase === "failed";
          const isPinned = getProfileVideoPinnedRank(video as ProfileVideo) != null;
          const canPin =
            allowPinning &&
            !isLocked &&
            !isPendingFailed &&
            !pendingUpload &&
            !isPendingProfileVideoId(video.id);
          const content = (
            <>
              <ProfileGridThumbnail
                video={video}
                blurred={isLocked}
                prewarmEnabled={prewarmVisibleVideos && !isLocked}
                visibilitySyncRef={thumbVisibilityCheckersRef}
              />
              {isPinned ? (
                <View style={styles.gridPinnedBadge} accessibilityLabel="pinned">
                  <PinIcon size={28} />
                </View>
              ) : null}
              {pendingUpload && !isPendingFailed ? (
                <View style={styles.gridPendingOverlay}>
                  <UploadProgressRing progress={pendingUpload.progress} />
                  <Text style={styles.gridPendingStatusText}>
                    {pendingUpload.phase === "processing"
                      ? pendingUpload.progress < 32 && !pendingUpload.presentationBaked
                        ? "rendering"
                        : "processing"
                      : pendingUpload.phase === "saving"
                        ? "posting"
                        : "uploading"}
                  </Text>
                </View>
              ) : null}
              {pendingUpload && isPendingFailed ? (
                <View style={styles.gridPendingErrorOverlay}>
                  <Text style={styles.gridPendingErrorText}>upload failed</Text>
                  <Pressable
                    onPress={() => onRetryPendingUpload?.(pendingUpload.id)}
                    style={styles.gridPendingRetryButton}
                    accessibilityLabel="retry upload"
                  >
                    <Text style={styles.gridPendingRetryText}>retry</Text>
                  </Pressable>
                </View>
              ) : null}
              {isLocked ? <View style={styles.lockedOverlay} /> : null}
            </>
          );

          // Pending uploads stay visible with a ring, but aren't openable until Stream is ready.
          if ((onVideoPress || canPin) && !isLocked && !isPendingFailed && !pendingUpload) {
            return (
              <Pressable
                key={video.id}
                ref={(node) => {
                  if (node) gridItemRefs.current.set(video.id, node);
                  else gridItemRefs.current.delete(video.id);
                }}
                collapsable={false}
                style={styles.gridItem}
                onPress={() => {
                  if (pinMenu) {
                    dismissPinMenu();
                    return;
                  }
                  onVideoPress?.(video, index);
                }}
                onLongPress={canPin ? () => openPinMenuForVideo(video.id) : undefined}
                delayLongPress={50}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View key={video.id} style={styles.gridItem}>
              {content}
            </View>
          );
        })}
      </View>
      <Modal
        transparent
        animationType="none"
        visible={Boolean(pinMenu && pinMenuVideo)}
        onRequestClose={() => dismissPinMenu()}
      >
        <View style={styles.gridPinMenuRoot} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => dismissPinMenu()}
            accessibilityLabel="dismiss"
          />
          {pinMenu && pinMenuVideo ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.gridPinPreview,
                  {
                    left: pinMenu.x,
                    top: pinMenu.y,
                    width: pinMenu.width,
                    height: pinMenu.height,
                    // Stay invisible until paint so the real thumb shows through.
                    opacity: pinCloneReady ? 1 : 0,
                    transform: [{ scale: pinPreviewScale }],
                  },
                ]}
              >
                <ProfileGridThumbnail
                  video={pinMenuVideo}
                  instantReveal
                  onReady={() => {
                    if (pinPreviewClosingRef.current) return;
                    setPinCloneReady(true);
                  }}
                />
                {pinMenuPinned ? (
                  <View style={styles.gridPinnedBadge} accessibilityLabel="pinned">
                    <PinIcon size={28} />
                  </View>
                ) : null}
                <Animated.View
                  style={[styles.gridPinPreviewDim, { opacity: pinPreviewDim }]}
                />
              </Animated.View>
              <Animated.View
                pointerEvents="box-none"
                style={[
                  styles.gridPinMenuCardWrap,
                  {
                    left: Math.max(
                      8,
                      Math.min(
                        pinMenu.x + pinMenu.width / 2 - PIN_MENU_CARD_WIDTH / 2,
                        viewportWidth - PIN_MENU_CARD_WIDTH - 8,
                      ),
                    ),
                    // Float above the scaled preview (transform origin is center).
                    top: Math.max(
                      8,
                      pinMenu.y -
                        (pinMenu.height * (PIN_PREVIEW_SCALE - 1)) / 2 -
                        PIN_MENU_CARD_HEIGHT -
                        10,
                    ),
                    opacity: pinMenuCardAnim,
                    transform: [
                      {
                        translateY: pinMenuCardAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  style={styles.gridPinMenuCard}
                  onPress={() => {
                    if (pinPreviewClosingRef.current) return;
                    const target = pinMenuVideo;
                    // Pin/unpin immediately so the grid settles before the preview closes.
                    // Waiting until after the dismiss animation caused a visible reorder flash.
                    onTogglePin?.(target);
                    dismissPinMenu();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={pinMenuPinned ? "unpin video" : "pin video"}
                >
                  <PinIcon size={26} />
                </Pressable>
              </Animated.View>
            </>
          ) : null}
        </View>
      </Modal>
      {showLockGate ? (
        <View
          ref={lockGateRef}
          collapsable={false}
          pointerEvents="none"
          style={[styles.profileLockGate, { top: lockGateTop }]}
          onLayout={updateLockMessagePosition}
        >
          <LinearGradient
            colors={[`${lockFadeColor}00`, `${lockFadeColor}CC`, `${lockFadeColor}F2`]}
            locations={[0, 0.28, 0.72]}
            style={StyleSheet.absoluteFill}
          />
          <View
            ref={lockMessageRef}
            collapsable={false}
            style={[styles.profileLockGateMessage, { opacity: 0 }]}
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight > 0 && Math.abs(nextHeight - lockMessageHeightRef.current) > 1) {
                lockMessageHeightRef.current = nextHeight;
                updateLockMessagePosition();
              }
            }}
          >
            <Text style={styles.profileLockGateText}>
              {lockMessage ?? "you must be jamming to see their full profile"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
