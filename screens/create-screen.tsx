import * as Haptics from "expo-haptics";
import { Camera, CameraView, type CameraType } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
} from "react-native";
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { creatorRoles, musicGenres } from "@/lib/options";
import {
  VideoPresentationOverlays,
  VideoTextOverlayGlyph,
  getVideoFilterOverlayStyle,
} from "@/components/VideoPresentationOverlays";
import type { JamVideoPlaybackStatus } from "@/components/video/jam-video-view";
import { contentFitForVideoSize } from "@/components/video/aspect-cache";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PrimaryButton } from "@/components/ui/primary-button";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import {
  CreateCameraFilterIcon,
  CreateCameraFlashIcon,
  CreateCameraFlipIcon,
  CreateCameraTimerIcon,
  CreateEditAudioIcon,
  CreateEditAudioWaveformIcon,
  CreateEditTextIcon,
  CreateEditTrimIcon,
} from "@/components/create/create-icons";
import {
  cachedRecentVideoThumbnailUri,
  extractVideoThumbnailFrames,
  pinchScaleToCameraZoom,
  preloadRecentVideoThumbnail,
  recentVideoThumbnailLoadPromise,
  setCameraPreviewActive,
} from "@/components/create/create-media";
import { CreateFilterPickerRow, CreateTextFontPickerRow } from "@/components/create/filter-picker-row";
import {
  clampTextOverlayCenterRatio,
  createTextOverlayId,
  getCreateCameraControlsBottom,
  getCreateCameraFilterRestBottom,
  getCreateCameraFilterSlideDistance,
  getCreateMediaCardRect,
  getFeedVideoViewport,
  snapTextOverlayCenterRatio,
} from "@/components/create/layout";
import { CreatePostPreviewModal } from "@/components/create/post-preview-modal";
import { CreateCaptureShutter } from "@/components/create/capture-shutter";
import { CreateEditAlbumPager } from "@/components/create/edit-album-pager";
import { CreateAudioTrimPanel } from "@/components/create/edit-audio-trim";
import {
  CreateEditSoundtrack,
  type CreateEditSoundtrackHandle,
} from "@/components/create/edit-soundtrack";
import { RecordingElapsedTimer } from "@/components/create/record-controls";
import { LinedTagField } from "@/components/create/lined-tag-field";
import { LookingForTagFields } from "@/components/create/looking-for-tag-fields";
import { CreateEditTextOverlayItem } from "@/components/create/text-overlay-editors";
import { CreateTrimFilmstrip } from "@/components/create/trim-filmstrip";
import { waitMs } from "@/lib/animation";
import { getAudioPeaks } from "@/lib/audio-waveform";
import {
  bakeVideoPresentation,
  isVideoBakeAvailable,
  needsPresentationBake,
  normalizeCameraRecording,
} from "@/lib/bake-video-presentation";
import { clamp, formatClipDuration, getUniqueStrings } from "@/lib/format";
import {
  isLibraryVideoAsset,
  launchCreateLibraryPicker,
  libraryPickerErrorMessage,
  materializeLibraryAsset,
} from "@/lib/create-library-media";
import { getVideoUploadErrorDetails, logVideoUploadStep, type NativeVideoAsset } from "@/lib/native-cloudflare";
import { fetchProfile, type Profile } from "@/lib/native-social-data";
import { getNavBarHeight } from "@/lib/nav-bar";
import { enqueuePendingVideoUpload } from "@/lib/pending-video-uploads";
import { enqueuePendingSlideshowUpload } from "@/lib/pending-slideshow-uploads";
import {
  MAX_SLIDESHOW_IMAGES,
  type SlideshowAudioAsset,
  type SlideshowImageAsset,
} from "@/lib/native-slideshow-storage";
import { getAllowedMaxVideoSeconds } from "@/lib/pro-entitlements";
import { triggerHoldHaptic } from "@/lib/hold-haptic";
import {
  TEXT_OVERLAY_DEFAULT_EFFECT_ID,
  TEXT_OVERLAY_DEFAULT_FONT_ID,
  TEXT_OVERLAY_DEFAULT_FONT_SCALE,
  clampTextOverlayFontScale,
  cycleVideoTextEffectId,
  getVideoTextEffectChrome,
  getVideoTextOverlayFontFamily,
  getVideoTextOverlayFontWeight,
  normalizeVideoFilter,
  normalizeVideoTextEffectId,
  normalizeVideoTextFontId,
  normalizeVideoTextOverlays,
  type VideoTextFontId,
} from "@/lib/video-presentation";
import { ensureFilterCatalogLoaded } from "@/lib/video-filters";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import {
  CREATE_CAMERA_CONTROL_BUTTON_SIZE,
  CREATE_CAMERA_EXPOSURE_DRAG_RANGE_PX,
  CREATE_CAMERA_FOCUS_RETICLE_SIZE,
  CREATE_CAMERA_TOP_CONTROLS_OFFSET,
  CREATE_DETAILS_PREVIEW_HEIGHT,
  CREATE_DETAILS_PREVIEW_WIDTH,
  CREATE_RECORDING_TIMER_OPTIONS,
  CREATE_THUMBNAIL_FRAME_COUNT,
  CREATE_TRIM_FILMSTRIP_FRAME_COUNT,
  FEED_VIDEO_BOTTOM_CORNER_RADIUS,
  MAX_VIDEO_GENRES,
  MAX_VIDEO_ROLES,
  TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS,
  TEXT_OVERLAY_CENTER_GUIDE_FADE_MS,
  TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";
import type {
  CreateCaptureMode,
  CreateEditItem,
  CreateStage,
  CreateTextOverlayItem,
  RecordingTimerSeconds,
  VideoFilter,
} from "@/types/app";

/** Soundtrack is required unless the album is exactly one video and no photos. */
function albumRequiresSoundtrack(items: CreateEditItem[]) {
  const videos = items.filter((item) => item.kind === "video").length;
  const images = items.filter((item) => item.kind === "image").length;
  return !(videos === 1 && images === 0);
}

export function CreateScreen({
  userId,
  onClose,
  onPosted,
}: {
  userId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [createStage, setCreateStage] = useState<CreateStage>("camera");
  const [captureMode, setCaptureMode] = useState<CreateCaptureMode>("video");
  const [asset, setAsset] = useState<NativeVideoAsset | null>(null);
  const [editItems, setEditItems] = useState<CreateEditItem[]>([]);
  const [editItemIndex, setEditItemIndex] = useState(0);
  const [slideshowImages, setSlideshowImages] = useState<SlideshowImageAsset[]>([]);
  const [slideshowAudio, setSlideshowAudio] = useState<SlideshowAudioAsset | null>(null);
  const [slideshowAudioDurationMs, setSlideshowAudioDurationMs] = useState<number | null>(null);
  const [slideshowAudioLabel, setSlideshowAudioLabel] = useState<string | null>(null);
  const [slideshowAudioAttaching, setSlideshowAudioAttaching] = useState(false);
  const [slideshowAudioReady, setSlideshowAudioReady] = useState(false);
  const [slideshowAudioError, setSlideshowAudioError] = useState(false);
  const [audioAttachTimingStartedAt, setAudioAttachTimingStartedAt] = useState<number | null>(null);
  const [audioLoadingToastVisible, setAudioLoadingToastVisible] = useState(false);
  const [audioToastMessage, setAudioToastMessage] = useState("audio still loading");
  const [caption, setCaption] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedVideoDurationMs, setSelectedVideoDurationMs] = useState(0);
  const [selectedVideoThumbnailUri, setSelectedVideoThumbnailUri] = useState<string | null>(null);
  const [selectedThumbnailTimeMs, setSelectedThumbnailTimeMs] = useState(0);
  const [thumbnailFrameOptions, setThumbnailFrameOptions] = useState<Array<{ timeMs: number; uri: string }>>([]);
  const [loadingThumbnailFrames, setLoadingThumbnailFrames] = useState(false);
  const [trimStartRatio, setTrimStartRatio] = useState(0);
  const [trimEndRatio, setTrimEndRatio] = useState(1);
  const [trimScrubRatio, setTrimScrubRatio] = useState<number | null>(null);
  const [trimPlaybackResumeSignal, setTrimPlaybackResumeSignal] = useState(0);
  const [editPlaybackRatio, setEditPlaybackRatio] = useState(0);
  const [trimFilmstripFrames, setTrimFilmstripFrames] = useState<Array<{ timeMs: number; uri: string }>>([]);
  const [loadingTrimFilmstrip, setLoadingTrimFilmstrip] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [activeEditTool, setActiveEditTool] = useState<"trim" | "filters" | "text" | "audio" | null>(null);
  const [audioTrimStartRatio, setAudioTrimStartRatio] = useState(0);
  const [audioTrimEndRatio, setAudioTrimEndRatio] = useState(1);
  const [audioPeaks, setAudioPeaks] = useState<number[] | null>(null);
  const [audioPeaksLoading, setAudioPeaksLoading] = useState(false);
  const [audioScrubRatio, setAudioScrubRatio] = useState<number | null>(null);
  const [audioPlaybackRatio, setAudioPlaybackRatio] = useState(0);
  const [audioTimelineWidth, setAudioTimelineWidth] = useState(0);
  const [audioTrimResumeSignal, setAudioTrimResumeSignal] = useState(0);
  const [audioPlaybackLoading, setAudioPlaybackLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter>("none");
  const [lookingForCollaborators, setLookingForCollaborators] = useState(false);
  const [selectedLookingForRoles, setSelectedLookingForRoles] = useState<string[]>([]);
  const [selectedLookingForGenres, setSelectedLookingForGenres] = useState<string[]>([]);
  const [editingTextOverlayId, setEditingTextOverlayId] = useState<string | null>(null);
  const [editPagerScrolling, setEditPagerScrolling] = useState(false);
  const [editUserPaused, setEditUserPaused] = useState(false);
  const [textOverlayActionId, setTextOverlayActionId] = useState<string | null>(null);
  const [textOverlayActionRenderId, setTextOverlayActionRenderId] = useState<string | null>(null);
  const [textFontPickerOverlayId, setTextFontPickerOverlayId] = useState<string | null>(null);
  const [textOverlaySizes, setTextOverlaySizes] = useState<Record<string, { width: number; height: number }>>({});
  const [editViewportSize, setEditViewportSize] = useState({
    width: viewportWidth,
    height: viewportHeight,
  });
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  /** Composed export for details preview / thumbs / upload (trim + filter + text). */
  const [exportBakedAsset, setExportBakedAsset] = useState<NativeVideoAsset | null>(null);
  const [exportBakedDurationMs, setExportBakedDurationMs] = useState(0);
  const [exportBakeStatus, setExportBakeStatus] = useState<"idle" | "baking" | "ready" | "failed">("idle");
  /** Front-camera selfie mirror still needs to be applied (file not flipped yet). */
  const [needsSelfieMirror, setNeedsSelfieMirror] = useState(false);
  const exportBakeSessionRef = useRef(0);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);
  const [microphonePermissionGranted, setMicrophonePermissionGranted] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  // Don't mount CameraView until feed AVPlayer / thumb decode have released —
  // starting the capture session in that window freezes the preview until remount.
  const [cameraSessionArmed, setCameraSessionArmed] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("front");
  const [cameraFacingKey, setCameraFacingKey] = useState<CameraType>("front");
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [recordingTimerSeconds, setRecordingTimerSeconds] = useState<RecordingTimerSeconds>(0);
  const [cameraFiltersOpen, setCameraFiltersOpen] = useState(false);
  const [cameraFilterPickerMounted, setCameraFilterPickerMounted] = useState(false);
  const [editFilterPickerMounted, setEditFilterPickerMounted] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [recentVideoThumbnailUri, setRecentVideoThumbnailUri] = useState<string | null>(
    () => cachedRecentVideoThumbnailUri,
  );
  // Patched onto CameraView by patches/expo-camera+17.0.10.patch (dev client).
  // Keep optional so Next/Vercel typecheck still passes when the patch is skipped.
  type FocusableCameraView = CameraView & {
    focusAtPoint?: (x: number, y: number) => Promise<void>;
    setExposureBias?: (bias: number) => Promise<void>;
  };
  const cameraRef = useRef<FocusableCameraView>(null);
  const cameraFacingRef = useRef<CameraType>("front");
  const lastCameraTapRef = useRef(0);
  const cameraViewportSizeRef = useRef({ width: viewportWidth, height: viewportHeight });
  const cameraExposureBiasRef = useRef(0);
  const cameraExposureDragBaseRef = useRef(0);
  const cameraExposureFrameRef = useRef<number | null>(null);
  const focusReticleHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusReticle, setFocusReticle] = useState<{ x: number; y: number; key: number } | null>(null);
  const [exposureAdjusting, setExposureAdjusting] = useState(false);
  const [exposureBiasUi, setExposureBiasUi] = useState(0);
  const focusReticleScale = useRef(new Animated.Value(1.15)).current;
  const focusReticleOpacity = useRef(new Animated.Value(0)).current;
  const recordingCountdownCancelRef = useRef(false);
  const cameraFilterSlideY = useRef(new Animated.Value(0)).current;
  const libraryButtonSlideY = useRef(new Animated.Value(0)).current;
  const editFilterSlideY = useRef(new Animated.Value(0)).current;
  const editNextButtonSlideY = useRef(new Animated.Value(0)).current;
  const recordPressScale = useRef(new Animated.Value(1)).current;
  const cameraFilterPickerOpenRef = useRef(false);
  const editFilterPickerOpenRef = useRef(false);
  const cameraZoomRef = useRef(0);
  const pinchBaseZoomRef = useRef(0);
  const cameraFocusGenerationRef = useRef(0);
  const createStageRef = useRef<CreateStage>("camera");
  const soundtrackRef = useRef<CreateEditSoundtrackHandle | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const editingTextDraftRef = useRef("");
  const editingTextOverlayIdRef = useRef<string | null>(null);
  const textOverlayDragStartRatioRef = useRef({ x: 0.5, y: 0.5 });
  const textOverlayDragActiveRef = useRef(false);
  const textOverlayPinchActiveRef = useRef(false);
  const textOverlayActionClosingRef = useRef(false);
  const textOverlayActionScale = useRef(new Animated.Value(0)).current;
  const textOverlayActionOpacity = useRef(new Animated.Value(0)).current;
  const textOverlayActionTranslateY = useRef(new Animated.Value(-8)).current;
  const textOverlayVerticalGuideOpacity = useRef(new Animated.Value(0)).current;
  const textOverlayHorizontalGuideOpacity = useRef(new Animated.Value(0)).current;
  const editNextButtonOpacity = useRef(new Animated.Value(1)).current;
  const audioLoadingToastOpacity = useRef(new Animated.Value(0)).current;
  const audioLoadingToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioAttachTimingStartedAtRef = useRef<number | null>(null);
  const textOverlayVerticalGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textOverlayHorizontalGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textOverlayVerticalGuideVisibleRef = useRef(false);
  const textOverlayHorizontalGuideVisibleRef = useRef(false);
  const pinchZoomFrameRef = useRef<number | null>(null);
  const trimDragStartRef = useRef({ start: 0, end: 1 });
  const trimDragActiveRef = useRef(false);
  const trimDisplayedRef = useRef({ start: 0, end: 1 });
  const trimLastHandleRef = useRef<"start" | "end">("start");
  const trimLastTranslationXRef = useRef(0);
  const trimFailsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimFailsafeRearmedRef = useRef(false);
  const trimScrubRatioRef = useRef<number | null>(null);
  const audioTrimDragStartRef = useRef({ start: 0, end: 1 });
  const audioTrimDragActiveRef = useRef(false);
  const audioTrimDisplayedRef = useRef({ start: 0, end: 1 });
  const audioTrimLastHandleRef = useRef<"start" | "end">("start");
  const audioTrimLastTranslationXRef = useRef(0);
  const audioTrimFailsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioTrimFailsafeRearmedRef = useRef(false);
  const audioScrubRatioRef = useRef<number | null>(null);
  const editPagerScrollFailsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadSessionRef = useRef(0);
  const thumbnailLoadSessionRef = useRef(0);
  const thumbnailFramesSourceRef = useRef<string | null>(null);
  const trimFilmstripLoadSessionRef = useRef(0);
  const selectedVideoDurationMsRef = useRef(0);
  const textOverlaysRef = useRef<CreateTextOverlayItem[]>([]);
  const currentEditItemIdRef = useRef<string | null>(null);
  const detailsScrollRef = useRef<ScrollView>(null);
  const detailsScrollYRef = useRef(0);
  const detailsPostBarHeightRef = useRef(64);
  const focusedTagFieldRef = useRef<View | null>(null);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const maxDuration = getAllowedMaxVideoSeconds({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });

  useEffect(() => {
    void fetchProfile(userId).then(setProfile);
  }, [userId]);

  function revealFocusedTagField(keyboardHeight: number) {
    const field = focusedTagFieldRef.current;
    if (!field || keyboardHeight <= 0) return;
    field.measureInWindow((_x, y, _w, height) => {
      const reserved = keyboardHeight + detailsPostBarHeightRef.current + 16;
      const overflow = y + height - (viewportHeight - reserved);
      if (overflow <= 8) return;
      detailsScrollRef.current?.scrollTo({
        y: Math.max(0, detailsScrollYRef.current + overflow),
        animated: true,
      });
    });
  }

  function handleTagFieldFocus(fieldRef: RefObject<View | null>) {
    focusedTagFieldRef.current = fieldRef.current;
    const keyboardHeight = Keyboard.metrics?.()?.height ?? 0;
    if (keyboardHeight > 0) {
      requestAnimationFrame(() => revealFocusedTagField(keyboardHeight));
    }
  }

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      revealFocusedTagField(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      focusedTagFieldRef.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(editNextButtonOpacity, {
      toValue: textFontPickerOverlayId ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [editNextButtonOpacity, textFontPickerOverlayId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const focusGeneration = ++cameraFocusGenerationRef.current;
      const openingOnCamera = createStageRef.current === "camera";

      // Block library thumb decode immediately when the live camera will run —
      // don't wait for useEffect, or a decode can overlap the first session.
      setCameraPreviewActive(openingOnCamera);
      setCameraReady(false);
      // Disarm so the arming effect below waits out feed/thumb AV work first.
      setCameraSessionArmed(false);
      if (cachedRecentVideoThumbnailUri) {
        setRecentVideoThumbnailUri(cachedRecentVideoThumbnailUri);
      }

      void fetchProfile(userId).then((nextProfile) => {
        if (active) setProfile(nextProfile);
      });

      void ensureFilterCatalogLoaded();

      void (async () => {
        const [cameraPermission, microphonePermission] = await Promise.all([
          Camera.requestCameraPermissionsAsync(),
          Camera.requestMicrophonePermissionsAsync(),
        ]);

        if (!active) return;
        setCameraPermissionGranted(cameraPermission.granted);
        setMicrophonePermissionGranted(microphonePermission.granted);
      })();

      return () => {
        active = false;
        setCameraPreviewActive(false);
        setCameraSessionArmed(false);
        setCameraReady(false);
        if (pinchZoomFrameRef.current !== null) {
          cancelAnimationFrame(pinchZoomFrameRef.current);
          pinchZoomFrameRef.current = null;
        }
        cameraZoomRef.current = 0;
        pinchBaseZoomRef.current = 0;
        setCameraZoom(0);
        // Refresh the library thumb only after the capture session is released.
        setTimeout(() => {
          if (cameraFocusGenerationRef.current !== focusGeneration) return;
          void preloadRecentVideoThumbnail({ force: true }).then((uri) => {
            if (cameraFocusGenerationRef.current !== focusGeneration) return;
            setRecentVideoThumbnailUri(uri);
          });
        }, 450);
      };
    }, [userId]),
  );

  useEffect(() => {
    createStageRef.current = createStage;
  }, [createStage]);

  useEffect(() => {
    setEditUserPaused(false);
  }, [createStage]);

  useEffect(() => {
    audioScrubRatioRef.current = audioScrubRatio;
  }, [audioScrubRatio]);

  useEffect(() => {
    trimScrubRatioRef.current = trimScrubRatio;
  }, [trimScrubRatio]);

  useEffect(() => {
    if (!isFocused) return;
    setCameraPreviewActive(createStage === "camera");
  }, [createStage, isFocused]);

  useEffect(() => {
    if (!__DEV__) return;
    if (createStage !== "camera" && createStage !== "edit") return;
    const card = getCreateMediaCardRect(insets.top);
    console.log("[create-card]", {
      stage: createStage,
      top: card.top,
      height: card.height,
      insetsTop: insets.top,
      screenH: viewportHeight,
    });
  }, [createStage, insets.top]);

  useEffect(() => {
    return () => {
      if (focusReticleHideTimerRef.current) {
        clearTimeout(focusReticleHideTimerRef.current);
        focusReticleHideTimerRef.current = null;
      }
      if (cameraExposureFrameRef.current !== null) {
        cancelAnimationFrame(cameraExposureFrameRef.current);
        cameraExposureFrameRef.current = null;
      }
    };
  }, []);

  // Mount CameraView only after feed AVPlayer / in-flight thumb decode settle.
  // Starting AVCaptureSession in that window freezes the preview until remount
  // (which is why double-tap flip appeared to "fix" it).
  useEffect(() => {
    if (!isFocused || createStage !== "camera") {
      if (createStage !== "camera") {
        setCameraSessionArmed(false);
        setCameraReady(false);
      }
      return;
    }
    if (cameraSessionArmed) return;

    let cancelled = false;

    void (async () => {
      const pendingThumbnailLoad = recentVideoThumbnailLoadPromise;
      if (pendingThumbnailLoad) {
        await pendingThumbnailLoad.catch(() => null);
      }
      if (cancelled) return;

      await waitMs(300);
      if (cancelled) return;
      if (createStageRef.current !== "camera") return;

      setCameraReady(false);
      setCameraSessionKey((key) => key + 1);
      setCameraSessionArmed(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraSessionArmed, createStage, isFocused]);

  useEffect(() => {
    cameraFacingRef.current = cameraFacing;
  }, [cameraFacing]);

  useEffect(() => {
    selectedVideoDurationMsRef.current = selectedVideoDurationMs;
  }, [selectedVideoDurationMs]);

  const currentEditItem = editItems[editItemIndex] ?? editItems[0] ?? null;
  const textOverlays = currentEditItem?.textOverlays ?? [];

  useEffect(() => {
    currentEditItemIdRef.current = currentEditItem?.id ?? null;
  }, [currentEditItem?.id]);

  useEffect(() => {
    textOverlaysRef.current = textOverlays;
  }, [textOverlays]);

  function setTextOverlays(updater: SetStateAction<CreateTextOverlayItem[]>) {
    const itemId = currentEditItemIdRef.current;
    if (!itemId) return;
    setEditItems((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const prev = item.textOverlays ?? [];
        const next = typeof updater === "function" ? updater(prev) : updater;
        return next === prev ? item : { ...item, textOverlays: next };
      }),
    );
  }

  useEffect(() => {
    editingTextOverlayIdRef.current = editingTextOverlayId;
  }, [editingTextOverlayId]);

  const syncEditingTextDraft = useCallback((text: string) => {
    editingTextDraftRef.current = text;
  }, []);

  const handleEditPlaybackStatusUpdate = useCallback((status: JamVideoPlaybackStatus) => {
    const durationMs = selectedVideoDurationMsRef.current;
    if (durationMs <= 0) return;
    setEditPlaybackRatio(clamp(status.positionMillis / durationMs, 0, 1));
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        recordingCountdownCancelRef.current = true;
        setRecordingCountdown(null);
        resetUploadState();
      };
    }, []),
  );

  useEffect(() => {
    if (createStage !== "camera") {
      cameraFilterPickerOpenRef.current = false;
      setCameraFilterPickerMounted(false);
      cameraFilterSlideY.setValue(0);
      libraryButtonSlideY.setValue(0);
      return;
    }

    const navBarHeight = getNavBarHeight(insets.bottom);
    const filterSlideDistance = getCreateCameraFilterSlideDistance(navBarHeight);
    // Slide the camera-roll thumb down out of the nav band while filters are up.
    const librarySlideDistance = (navBarHeight - 58) / 2 + 58 + 10;

    if (cameraFiltersOpen) {
      cameraFilterPickerOpenRef.current = true;
      setCameraFilterPickerMounted(true);
      cameraFilterSlideY.stopAnimation();
      libraryButtonSlideY.stopAnimation();
      cameraFilterSlideY.setValue(filterSlideDistance);
      Animated.parallel([
        Animated.spring(cameraFilterSlideY, {
          toValue: 0,
          damping: 28,
          stiffness: 240,
          mass: 0.9,
          overshootClamping: true,
          useNativeDriver: true,
        }),
        Animated.spring(libraryButtonSlideY, {
          toValue: librarySlideDistance,
          damping: 28,
          stiffness: 240,
          mass: 0.9,
          overshootClamping: true,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!cameraFilterPickerOpenRef.current) return;

    cameraFilterPickerOpenRef.current = false;
    Animated.parallel([
      Animated.timing(cameraFilterSlideY, {
        toValue: filterSlideDistance,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(libraryButtonSlideY, {
        toValue: 0,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setCameraFilterPickerMounted(false);
    });
  }, [cameraFilterSlideY, cameraFiltersOpen, createStage, insets.bottom, libraryButtonSlideY]);

  useEffect(() => {
    if (createStage !== "edit") {
      editFilterPickerOpenRef.current = false;
      setEditFilterPickerMounted(false);
      editFilterSlideY.setValue(0);
      editNextButtonSlideY.setValue(0);
      return;
    }

    const navBarHeight = getNavBarHeight(insets.bottom);
    const filterSlideDistance = getCreateCameraFilterSlideDistance(navBarHeight);
    // Sink the next pill out of the nav band while filters are up.
    const nextSlideDistance = (navBarHeight - 48) / 2 + 48 + 10;
    const filtersOpen = activeEditTool === "filters";

    if (filtersOpen) {
      editFilterPickerOpenRef.current = true;
      setEditFilterPickerMounted(true);
      editFilterSlideY.stopAnimation();
      editNextButtonSlideY.stopAnimation();
      editFilterSlideY.setValue(filterSlideDistance);
      Animated.parallel([
        Animated.spring(editFilterSlideY, {
          toValue: 0,
          damping: 28,
          stiffness: 240,
          mass: 0.9,
          overshootClamping: true,
          useNativeDriver: true,
        }),
        Animated.spring(editNextButtonSlideY, {
          toValue: nextSlideDistance,
          damping: 28,
          stiffness: 240,
          mass: 0.9,
          overshootClamping: true,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!editFilterPickerOpenRef.current) return;

    editFilterPickerOpenRef.current = false;
    Animated.parallel([
      Animated.timing(editFilterSlideY, {
        toValue: filterSlideDistance,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(editNextButtonSlideY, {
        toValue: 0,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setEditFilterPickerMounted(false);
    });
  }, [activeEditTool, createStage, editFilterSlideY, editNextButtonSlideY, insets.bottom]);

  useEffect(() => {
    if (createStage !== "details") return;
    if (exportBakeStatus === "baking") return;

    const previewUri = exportBakedAsset?.uri ?? asset?.uri;
    const previewDurationMs =
      exportBakedAsset && exportBakedDurationMs > 0
        ? exportBakedDurationMs
        : selectedVideoDurationMs;
    if (!previewUri || !previewDurationMs) return;

    void loadThumbnailFrameOptions(previewUri, previewDurationMs);
  }, [
    asset?.uri,
    createStage,
    exportBakeStatus,
    exportBakedAsset?.uri,
    exportBakedDurationMs,
    selectedVideoDurationMs,
  ]);

  useEffect(() => {
    if (createStage !== "edit" || !asset?.uri || !selectedVideoDurationMs) return;

    void loadTrimFilmstripFrames(asset.uri, selectedVideoDurationMs);
  }, [asset?.uri, createStage, selectedVideoDurationMs]);

  function handleEditVideoDurationResolved(durationMs: number) {
    if (durationMs <= 0) return;
    setSelectedVideoDurationMs(durationMs);
  }

  function getTrimDurationLabel() {
    if (!selectedVideoDurationMs) return "--:--";
    return formatClipDuration(
      Math.max(0, Math.round((trimEndRatio - trimStartRatio) * selectedVideoDurationMs)),
    );
  }

  function resetUploadState() {
    uploadSessionRef.current += 1;
    cameraRef.current?.stopRecording();
    setCreateStage("camera");
    setCaptureMode("video");
    setAsset(null);
    setEditItems([]);
    setEditItemIndex(0);
    setSlideshowImages([]);
    setSlideshowAudio(null);
    setSlideshowAudioDurationMs(null);
    setSlideshowAudioLabel(null);
    setSlideshowAudioAttaching(false);
    setSlideshowAudioReady(false);
    setSlideshowAudioError(false);
    setAudioAttachTimingStartedAt(null);
    audioAttachTimingStartedAtRef.current = null;
    setAudioPeaks(null);
    setAudioPeaksLoading(false);
    setAudioLoadingToastVisible(false);
    audioLoadingToastOpacity.setValue(0);
    setAudioTrimStartRatio(0);
    setAudioTrimEndRatio(1);
    audioTrimDragActiveRef.current = false;
    audioTrimFailsafeRearmedRef.current = false;
    if (audioTrimFailsafeTimerRef.current) {
      clearTimeout(audioTrimFailsafeTimerRef.current);
      audioTrimFailsafeTimerRef.current = null;
    }
    audioScrubRatioRef.current = null;
    setAudioScrubRatio(null);
    setAudioPlaybackRatio(0);
    setAudioTimelineWidth(0);
    setAudioTrimResumeSignal(0);
    setAudioPlaybackLoading(false);
    setCaption("");
    setSelectedRoles([]);
    setSelectedGenres([]);
    setSelectedVideoDurationMs(0);
    setSelectedVideoThumbnailUri(null);
    setSelectedThumbnailTimeMs(0);
    setThumbnailFrameOptions([]);
    setLoadingThumbnailFrames(false);
    thumbnailLoadSessionRef.current += 1;
    thumbnailFramesSourceRef.current = null;
    setTrimStartRatio(0);
    setTrimEndRatio(1);
    trimDragActiveRef.current = false;
    trimFailsafeRearmedRef.current = false;
    if (trimFailsafeTimerRef.current) {
      clearTimeout(trimFailsafeTimerRef.current);
      trimFailsafeTimerRef.current = null;
    }
    trimScrubRatioRef.current = null;
    setTrimScrubRatio(null);
    setTrimPlaybackResumeSignal(0);
    setEditPlaybackRatio(0);
    setTrimFilmstripFrames([]);
    setLoadingTrimFilmstrip(false);
    trimFilmstripLoadSessionRef.current += 1;
    setTimelineWidth(0);
    setActiveEditTool(null);
    setSelectedFilter("none");
    setLookingForCollaborators(false);
    setSelectedLookingForRoles([]);
    setSelectedLookingForGenres([]);
    currentEditItemIdRef.current = null;
    if (editPagerScrollFailsafeTimerRef.current) {
      clearTimeout(editPagerScrollFailsafeTimerRef.current);
      editPagerScrollFailsafeTimerRef.current = null;
    }
    setEditPagerScrolling(false);
    setEditingTextOverlayId(null);
    setTextOverlayActionId(null);
    setTextOverlayActionRenderId(null);
    setTextFontPickerOverlayId(null);
    setTextOverlaySizes({});
    hideTextOverlaySnapGuides(true);
    setRecording(false);
    setCapturingPhoto(false);
    setLibraryBusy(false);
    setPostPreviewOpen(false);
    setAudioPickerOpen(false);
    setFlashEnabled(false);
    setRecordingTimerSeconds(0);
    setCameraFiltersOpen(false);
    setRecordingCountdown(null);
    recordingCountdownCancelRef.current = false;
    exportBakeSessionRef.current += 1;
    setExportBakedAsset(null);
    setExportBakedDurationMs(0);
    setExportBakeStatus("idle");
    setNeedsSelfieMirror(false);
  }

  function resetCameraZoom() {
    cameraZoomRef.current = 0;
    pinchBaseZoomRef.current = 0;
    setCameraZoom(0);
  }

  function scheduleCameraZoomUpdate(nextZoom: number) {
    cameraZoomRef.current = nextZoom;
    if (pinchZoomFrameRef.current !== null) return;

    pinchZoomFrameRef.current = requestAnimationFrame(() => {
      pinchZoomFrameRef.current = null;
      setCameraZoom(cameraZoomRef.current);
    });
  }

  const handleCameraPinchGesture = useCallback((event: PinchGestureHandlerGestureEvent) => {
    const { scale, state } = event.nativeEvent;
    if (state !== State.ACTIVE) return;

    scheduleCameraZoomUpdate(pinchScaleToCameraZoom(pinchBaseZoomRef.current, scale));
  }, []);

  const handleCameraPinchStateChange = useCallback((event: PinchGestureHandlerStateChangeEvent) => {
    const { scale, state } = event.nativeEvent;

    if (state === State.BEGAN) {
      pinchBaseZoomRef.current = cameraZoomRef.current;
      return;
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      if (pinchZoomFrameRef.current !== null) {
        cancelAnimationFrame(pinchZoomFrameRef.current);
        pinchZoomFrameRef.current = null;
      }

      const nextZoom = pinchScaleToCameraZoom(pinchBaseZoomRef.current, scale);
      cameraZoomRef.current = nextZoom;
      pinchBaseZoomRef.current = nextZoom;
      setCameraZoom(nextZoom);
    }
  }, []);

  function closeCreateScreen() {
    resetUploadState();
    onClose();
  }

  async function loadRecentVideoThumbnail() {
    const uri = await preloadRecentVideoThumbnail({ force: true, requestPermission: true });
    setRecentVideoThumbnailUri(uri);
  }

  async function pickFromLibrary() {
    const source = "library";
    logVideoUploadStep("picker permission request start", { source });
    try {
      logVideoUploadStep("picker launch start", { source });
      const result = await launchCreateLibraryPicker({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: MAX_SLIDESHOW_IMAGES,
      });

      logVideoUploadStep("picker launch result", {
        source,
        canceled: result.canceled,
        assetCount: result.canceled ? 0 : result.assets.length,
      });
      if (result.canceled) {
        logVideoUploadStep("picker canceled", { source });
        return;
      }

      const pickedAssets = result.assets.filter((entry) => Boolean(entry.uri));
      if (pickedAssets.length === 0) {
        Alert.alert("couldn’t open that file", "try another video or photo from your camera roll.");
        return;
      }

      setLibraryBusy(true);
      const album: CreateEditItem[] = [];
      for (const entry of pickedAssets.slice(0, MAX_SLIDESHOW_IMAGES)) {
        const kind = isLibraryVideoAsset(entry) ? "video" : "image";
        const materialized = await materializeLibraryAsset(entry, kind);
        album.push({
          id: `${kind}-${materialized.uri}-${album.length}`,
          kind,
          uri: materialized.uri,
          fileName: materialized.fileName,
          mimeType: materialized.mimeType,
          fileSize: materialized.fileSize,
          width: materialized.width,
          height: materialized.height,
          durationMs: materialized.durationMs,
          textOverlays: [],
        });
      }
      if (album.length === 0) {
        Alert.alert("couldn’t open that file", "try another video or photo from your camera roll.");
        return;
      }

      logVideoUploadStep("picker album selected", {
        source,
        itemCount: album.length,
        imageCount: album.filter((item) => item.kind === "image").length,
        videoCount: album.filter((item) => item.kind === "video").length,
      });
      startEditAlbum(album);
      void loadRecentVideoThumbnail();
    } catch (err) {
      logVideoUploadStep("picker launch failed", {
        source,
        ...getVideoUploadErrorDetails(err),
      });
      Alert.alert("couldn’t open that file", libraryPickerErrorMessage(err));
    } finally {
      setLibraryBusy(false);
    }
  }

  async function recordVideo() {
    if (!cameraRef.current || !cameraReady || recording) return;

    if (!cameraPermissionGranted || !microphonePermissionGranted) {
      Alert.alert("permission needed", "camera and microphone permissions are needed to record.");
      return;
    }

    setRecording(true);
    const recordedFacing = cameraFacingRef.current;
    logVideoUploadStep("in-app camera recording start", { maxDuration, facing: recordedFacing });
    try {
      const recorded = await cameraRef.current.recordAsync({
        maxDuration,
      });
      if (!recorded?.uri) {
        logVideoUploadStep("in-app camera recording missing uri", {});
        return;
      }
      if (__DEV__) {
        const recordedSize = recorded as { uri: string; width?: unknown; height?: unknown };
        const width = typeof recordedSize.width === "number" ? recordedSize.width : null;
        const height = typeof recordedSize.height === "number" ? recordedSize.height : null;
        console.log("[camera] output", {
          kind: "video",
          width,
          height,
          ratio: width && height ? width / height : null,
        });
      }

      setRecording(false);

      let nextAsset: NativeVideoAsset = {
        uri: recorded.uri,
        fileName: recorded.uri.split("/").pop() ?? "jam-video.mp4",
        mimeType: "video/mp4",
        fileSize: null,
      };
      let durationMs = 0;
      let selfieMirrorPending = recordedFacing === "front";

      logVideoUploadStep("in-app camera recording selected", {
        fileName: nextAsset.fileName,
        uriScheme: nextAsset.uri.split(":")[0] || "unknown",
        facing: recordedFacing,
      });

      // Remux onto an orientation-correct canvas so edit/feed match the tall
      // camera preview. Front also bakes the selfie mirror; back only orients
      // (raw expo-camera files are often landscape-coded + rotation metadata).
      if (isVideoBakeAvailable()) {
        try {
          const normalized = await normalizeCameraRecording(nextAsset, {
            uploadId: `${recordedFacing === "front" ? "selfie" : "orient"}-${Date.now()}`,
            mirrorHorizontal: recordedFacing === "front",
          });
          nextAsset = normalized.asset;
          durationMs = Math.max(0, Math.round(normalized.outputDurationSeconds * 1000));
          selfieMirrorPending = false;
          logVideoUploadStep(
            recordedFacing === "front"
              ? "in-app camera selfie mirror baked"
              : "in-app camera orientation normalized",
            {
              uriScheme: nextAsset.uri.split(":")[0] || "unknown",
              durationMs,
              width: nextAsset.width ?? null,
              height: nextAsset.height ?? null,
            },
          );
        } catch (normalizeError) {
          logVideoUploadStep(
            recordedFacing === "front"
              ? "in-app camera selfie mirror failed — will retry on export"
              : "in-app camera orientation normalize failed — probing display size",
            getVideoUploadErrorDetails(normalizeError),
          );
        }
      }

      // If remux was skipped/failed, still attach oriented display size so
      // JamVideoView doesn't letterbox portrait phone recordings as landscape.
      if (!(typeof nextAsset.width === "number" && typeof nextAsset.height === "number")) {
        try {
          const probe = await getThumbnailAsync(nextAsset.uri, { time: 0, quality: 1 });
          if (probe.width > 0 && probe.height > 0) {
            nextAsset = { ...nextAsset, width: probe.width, height: probe.height };
            logVideoUploadStep("in-app camera size probed", {
              width: probe.width,
              height: probe.height,
            });
          }
        } catch (probeError) {
          logVideoUploadStep("in-app camera size probe failed", getVideoUploadErrorDetails(probeError));
        }
      }

      await startVideoUpload(nextAsset, durationMs, { selfieMirrorPending });
      void loadRecentVideoThumbnail();
    } catch (err) {
      logVideoUploadStep("in-app camera recording failed", getVideoUploadErrorDetails(err));
      Alert.alert("could not record", err instanceof Error ? err.message : "try again");
    } finally {
      setRecording(false);
      setCameraFacingKey(cameraFacingRef.current);
    }
  }

  function stopRecording() {
    if (!recording) return;
    cameraRef.current?.stopRecording();
  }

  function toggleFlash() {
    setFlashEnabled((current) => !current);
  }

  function cycleRecordingTimer() {
    setRecordingTimerSeconds((current) => {
      const currentIndex = CREATE_RECORDING_TIMER_OPTIONS.indexOf(current);
      const nextIndex = (currentIndex + 1) % CREATE_RECORDING_TIMER_OPTIONS.length;
      return CREATE_RECORDING_TIMER_OPTIONS[nextIndex];
    });
  }

  function cancelRecordingCountdown() {
    recordingCountdownCancelRef.current = true;
    setRecordingCountdown(null);
  }

  async function runRecordingCountdown() {
    if (recordingTimerSeconds <= 0) return true;

    recordingCountdownCancelRef.current = false;
    for (let remaining = recordingTimerSeconds; remaining > 0; remaining -= 1) {
      if (recordingCountdownCancelRef.current) return false;
      setRecordingCountdown(remaining);
      await waitMs(1000);
    }

    setRecordingCountdown(null);
    return !recordingCountdownCancelRef.current;
  }

  async function takePhoto() {
    if (!cameraRef.current || !cameraReady || capturingPhoto || recording) return;

    if (!cameraPermissionGranted) {
      Alert.alert("permission needed", "camera access is needed to take a photo.");
      return;
    }

    setCapturingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        shutterSound: true,
        mirror: cameraFacingRef.current === "front",
      });
      if (!photo?.uri) {
        logVideoUploadStep("in-app camera photo missing uri", {});
        return;
      }
      if (__DEV__) {
        const width = typeof photo.width === "number" ? photo.width : null;
        const height = typeof photo.height === "number" ? photo.height : null;
        console.log("[camera] output", {
          kind: "photo",
          width,
          height,
          ratio: width && height ? width / height : null,
        });
      }

      startEditAlbum([
        {
          id: `photo-${Date.now()}`,
          kind: "image",
          uri: photo.uri,
          fileName: photo.uri.split("/").pop() ?? "jam-photo.jpg",
          mimeType: photo.format === "png" ? "image/png" : "image/jpeg",
          fileSize: null,
          width: photo.width ?? null,
          height: photo.height ?? null,
          durationMs: 0,
          textOverlays: [],
        },
      ]);
      void loadRecentVideoThumbnail();
    } catch (err) {
      logVideoUploadStep("in-app camera photo failed", getVideoUploadErrorDetails(err));
      Alert.alert("could not take photo", err instanceof Error ? err.message : "try again");
    } finally {
      setCapturingPhoto(false);
    }
  }

  async function handleRecordPress() {
    if (recording) {
      stopRecording();
      return;
    }

    if (recordingCountdown !== null) {
      cancelRecordingCountdown();
      return;
    }

    setCameraFiltersOpen(false);
    const shouldRecord = await runRecordingCountdown();
    if (!shouldRecord) return;
    await recordVideo();
  }

  async function handlePhotoPress() {
    if (recordingCountdown !== null) {
      cancelRecordingCountdown();
      return;
    }

    setCameraFiltersOpen(false);
    const shouldShoot = await runRecordingCountdown();
    if (!shouldShoot) return;
    await takePhoto();
  }

  function handleRecordPressIn() {
    if (!cameraPermissionGranted || !cameraReady) return;
    if (captureMode === "video" && !microphonePermissionGranted) return;
    recordPressScale.stopAnimation();
    Animated.spring(recordPressScale, {
      toValue: 1.12,
      damping: 16,
      stiffness: 320,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }

  function handleRecordPressOut() {
    recordPressScale.stopAnimation();
    Animated.spring(recordPressScale, {
      toValue: 1,
      damping: 18,
      stiffness: 280,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }

  function flipCameraFacing() {
    const nextFacing: CameraType = cameraFacingRef.current === "back" ? "front" : "back";
    cameraFacingRef.current = nextFacing;

    if (!recording) {
      setCameraReady(false);
      setCameraFacingKey(nextFacing);
    }

    resetCameraZoom();
    cameraExposureBiasRef.current = 0;
    setExposureBiasUi(0);
    setFocusReticle(null);
    setExposureAdjusting(false);
    setCameraFacing(nextFacing);
  }

  function showFocusReticleAt(x: number, y: number) {
    if (focusReticleHideTimerRef.current) {
      clearTimeout(focusReticleHideTimerRef.current);
      focusReticleHideTimerRef.current = null;
    }
    setFocusReticle({ x, y, key: Date.now() });
    focusReticleOpacity.setValue(1);
    focusReticleScale.setValue(1.2);
    Animated.spring(focusReticleScale, {
      toValue: 1,
      damping: 14,
      stiffness: 220,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
    focusReticleHideTimerRef.current = setTimeout(() => {
      Animated.timing(focusReticleOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setFocusReticle(null);
      });
      focusReticleHideTimerRef.current = null;
    }, 1400);
  }

  async function focusCameraAt(locationX: number, locationY: number) {
    const camera = cameraRef.current;
    const { width, height } = cameraViewportSizeRef.current;
    if (!camera || !cameraReady || width <= 0 || height <= 0) return;

    const normalizedX = Math.min(1, Math.max(0, locationX / width));
    const normalizedY = Math.min(1, Math.max(0, locationY / height));
    // Front preview is mirrored — flip X so focus matches the tapped spot.
    const focusX = cameraFacingRef.current === "front" ? 1 - normalizedX : normalizedX;

    cameraExposureBiasRef.current = 0;
    setExposureBiasUi(0);
    showFocusReticleAt(locationX, locationY);

    try {
      await camera.focusAtPoint?.(focusX, normalizedY);
      await camera.setExposureBias?.(0);
    } catch {
      // Native focus/exposure unavailable (simulator / older binary).
    }
  }

  function scheduleExposureBias(nextBias: number) {
    const clamped = Math.min(1, Math.max(-1, nextBias));
    cameraExposureBiasRef.current = clamped;
    setExposureBiasUi(clamped);
    if (cameraExposureFrameRef.current !== null) return;
    cameraExposureFrameRef.current = requestAnimationFrame(() => {
      cameraExposureFrameRef.current = null;
      void cameraRef.current?.setExposureBias?.(cameraExposureBiasRef.current)?.catch(() => undefined);
    });
  }

  const handleCameraExposureGesture = useCallback((event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state !== State.ACTIVE) return;
    // Pull up (negative Y) → brighter; pull down → darker.
    const nextBias =
      cameraExposureDragBaseRef.current - event.nativeEvent.translationY / CREATE_CAMERA_EXPOSURE_DRAG_RANGE_PX;
    scheduleExposureBias(nextBias);
  }, []);

  const handleCameraExposureStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { state, x, y } = event.nativeEvent;
    if (state === State.BEGAN) {
      cameraExposureDragBaseRef.current = cameraExposureBiasRef.current;
      setExposureAdjusting(true);
      if (focusReticleHideTimerRef.current) {
        clearTimeout(focusReticleHideTimerRef.current);
        focusReticleHideTimerRef.current = null;
      }
      setFocusReticle((current) => current ?? { x, y, key: Date.now() });
      focusReticleOpacity.setValue(1);
      return;
    }
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      if (cameraExposureFrameRef.current !== null) {
        cancelAnimationFrame(cameraExposureFrameRef.current);
        cameraExposureFrameRef.current = null;
      }
      void cameraRef.current?.setExposureBias?.(cameraExposureBiasRef.current)?.catch(() => undefined);
      setExposureAdjusting(false);
      focusReticleHideTimerRef.current = setTimeout(() => {
        Animated.timing(focusReticleOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setFocusReticle(null);
        });
        focusReticleHideTimerRef.current = null;
      }, 900);
    }
  }, [focusReticleOpacity]);

  function handleCameraTap(event: { nativeEvent: { locationX: number; locationY: number } }) {
    const { locationX, locationY } = event.nativeEvent;
    const now = Date.now();
    const isDoubleTap = now - lastCameraTapRef.current < 280;
    lastCameraTapRef.current = now;

    void focusCameraAt(locationX, locationY);
    if (isDoubleTap && recordingCountdown === null) {
      flipCameraFacing();
    }
  }

  async function prepareVideoThumbnail(videoUri: string, timeMs = 0) {
    try {
      const thumbnail = await getThumbnailAsync(videoUri, {
        time: timeMs,
        quality: 1,
      });
      setSelectedVideoThumbnailUri(thumbnail.uri);
      setSelectedThumbnailTimeMs(timeMs);
    } catch {
      setSelectedVideoThumbnailUri(null);
    }
  }

  async function loadThumbnailFrameOptions(videoUri: string, durationMs: number) {
    if (thumbnailFramesSourceRef.current === videoUri && thumbnailFrameOptions.length > 0) {
      return;
    }

    const session = thumbnailLoadSessionRef.current + 1;
    thumbnailLoadSessionRef.current = session;
    setLoadingThumbnailFrames(true);

    const frames = await extractVideoThumbnailFrames(
      videoUri,
      durationMs,
      CREATE_THUMBNAIL_FRAME_COUNT,
      () => thumbnailLoadSessionRef.current === session,
    );

    if (thumbnailLoadSessionRef.current !== session) return;

    thumbnailFramesSourceRef.current = videoUri;
    setThumbnailFrameOptions(frames);
    if (frames.length > 0) {
      setSelectedVideoThumbnailUri((current) => current ?? frames[0].uri);
      setSelectedThumbnailTimeMs((current) => (current > 0 ? current : frames[0].timeMs));
    } else if (!selectedVideoThumbnailUri) {
      await prepareVideoThumbnail(videoUri, 0);
    }
    setLoadingThumbnailFrames(false);
  }

  async function loadTrimFilmstripFrames(videoUri: string, durationMs: number) {
    const session = trimFilmstripLoadSessionRef.current + 1;
    trimFilmstripLoadSessionRef.current = session;
    setLoadingTrimFilmstrip(true);
    setTrimFilmstripFrames([]);

    const frames = await extractVideoThumbnailFrames(
      videoUri,
      durationMs,
      CREATE_TRIM_FILMSTRIP_FRAME_COUNT,
      () => trimFilmstripLoadSessionRef.current === session,
    );

    if (trimFilmstripLoadSessionRef.current !== session) return;

    setTrimFilmstripFrames(frames);
    setLoadingTrimFilmstrip(false);
  }

  function selectThumbnailTime(timeMs: number, uri?: string) {
    setSelectedThumbnailTimeMs(timeMs);
    if (uri) {
      setSelectedVideoThumbnailUri(uri);
      return;
    }

    const frame = thumbnailFrameOptions.find((option) => option.timeMs === timeMs);
    if (frame) {
      setSelectedVideoThumbnailUri(frame.uri);
    }
  }

  function startEditAlbum(items: CreateEditItem[], options?: { selfieMirrorPending?: boolean }) {
    if (items.length === 0) return;
    uploadSessionRef.current += 1;
    const images = items
      .filter((item) => item.kind === "image")
      .map((item) => ({
        uri: item.uri,
        fileName: item.fileName,
        mimeType: item.mimeType,
      }));
    const video = items.find((item) => item.kind === "video") ?? null;
    const album = items.map((item) => ({
      ...item,
      textOverlays: item.textOverlays ?? [],
    }));
    currentEditItemIdRef.current = album[0]?.id ?? null;
    setEditItems(album);
    setEditItemIndex(0);
    setEditPagerScrolling(false);
    setEditUserPaused(false);
    setSlideshowImages(images);
    setSlideshowAudio(null);
    setSlideshowAudioDurationMs(null);
    setSlideshowAudioLabel(null);
    setSlideshowAudioAttaching(false);
    setSlideshowAudioReady(false);
    setSlideshowAudioError(false);
    setAudioAttachTimingStartedAt(null);
    audioAttachTimingStartedAtRef.current = null;
    setAudioPeaks(null);
    setAudioPeaksLoading(false);
    setAudioTrimStartRatio(0);
    setAudioTrimEndRatio(1);
    audioTrimDragActiveRef.current = false;
    audioTrimFailsafeRearmedRef.current = false;
    if (audioTrimFailsafeTimerRef.current) {
      clearTimeout(audioTrimFailsafeTimerRef.current);
      audioTrimFailsafeTimerRef.current = null;
    }
    audioScrubRatioRef.current = null;
    setAudioScrubRatio(null);
    setAudioPlaybackRatio(0);
    setAudioTimelineWidth(0);
    setAudioTrimResumeSignal(0);
    setAudioPlaybackLoading(false);
    setAsset(
      video
        ? {
            uri: video.uri,
            fileName: video.fileName,
            mimeType: video.mimeType,
            fileSize: video.fileSize,
            width: video.width,
            height: video.height,
          }
        : null,
    );
    setSelectedVideoDurationMs(video?.durationMs ?? 0);
    setNeedsSelfieMirror(Boolean(options?.selfieMirrorPending));
    setTrimStartRatio(0);
    setTrimEndRatio(1);
    trimDragActiveRef.current = false;
    trimFailsafeRearmedRef.current = false;
    if (trimFailsafeTimerRef.current) {
      clearTimeout(trimFailsafeTimerRef.current);
      trimFailsafeTimerRef.current = null;
    }
    trimScrubRatioRef.current = null;
    setTrimScrubRatio(null);
    setTrimPlaybackResumeSignal(0);
    setActiveEditTool(null);
    setSelectedFilter("none");
    setEditingTextOverlayId(null);
    setTextOverlayActionId(null);
    setTextOverlayActionRenderId(null);
    setTextFontPickerOverlayId(null);
    setTextOverlaySizes({});
    hideTextOverlaySnapGuides(true);
    setCreateStage("edit");
    if (video) {
      void prepareVideoThumbnail(video.uri);
      return;
    }
    setSelectedVideoThumbnailUri(images[0]?.uri ?? null);
    setSelectedThumbnailTimeMs(0);
  }

  function startVideoUpload(
    nextAsset: NativeVideoAsset,
    durationMs = 0,
    options?: { selfieMirrorPending?: boolean },
  ) {
    startEditAlbum(
      [
        {
          id: `video-${nextAsset.uri}`,
          kind: "video",
          uri: nextAsset.uri,
          fileName: nextAsset.fileName ?? nextAsset.uri.split("/").pop() ?? "jam-video.mp4",
          mimeType: nextAsset.mimeType ?? "video/mp4",
          fileSize: nextAsset.fileSize ?? null,
          width: nextAsset.width ?? null,
          height: nextAsset.height ?? null,
          durationMs,
          textOverlays: [],
        },
      ],
      options,
    );
  }

  function endEditPagerScroll() {
    if (editPagerScrollFailsafeTimerRef.current) {
      clearTimeout(editPagerScrollFailsafeTimerRef.current);
      editPagerScrollFailsafeTimerRef.current = null;
    }
    setEditPagerScrolling(false);
  }

  function beginEditPagerScroll() {
    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setTextFontPickerOverlayId(null);
    hideTextOverlaySnapGuides(true);
    setEditPagerScrolling(true);
    if (editPagerScrollFailsafeTimerRef.current) {
      clearTimeout(editPagerScrollFailsafeTimerRef.current);
    }
    editPagerScrollFailsafeTimerRef.current = setTimeout(() => {
      editPagerScrollFailsafeTimerRef.current = null;
      setEditPagerScrolling(false);
    }, 600);
  }

  function handleEditItemIndexChange(nextIndex: number) {
    const item = editItems[nextIndex];
    if (!item) return;
    if (nextIndex !== editItemIndex) {
      dismissEditTextKeyboard();
      closeTextOverlayActions(false);
      setTextFontPickerOverlayId(null);
    }
    currentEditItemIdRef.current = item.id;
    setEditItemIndex(nextIndex);
    if (item.kind === "image") {
      if (activeEditTool === "trim") setActiveEditTool(null);
      return;
    }
    setAsset({
      uri: item.uri,
      fileName: item.fileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      width: item.width,
      height: item.height,
    });
    setSelectedVideoDurationMs(item.durationMs);
  }

  function attachSlideshowAudio(next: {
    uri: string;
    fileName: string;
    mimeType: string;
    fromVideo: boolean;
    label: string;
    durationMs: number | null;
  }) {
    setSlideshowAudioReady(false);
    setSlideshowAudioError(false);
    setEditUserPaused(false);
    setSlideshowAudio({
      uri: next.uri,
      fileName: next.fileName,
      mimeType: next.mimeType,
      fromVideo: next.fromVideo,
    });
    setSlideshowAudioDurationMs(next.durationMs);
    setSlideshowAudioLabel(next.label);
    setAudioTrimStartRatio(0);
    setAudioTrimEndRatio(1);
    audioTrimDragActiveRef.current = false;
    audioTrimFailsafeRearmedRef.current = false;
    if (audioTrimFailsafeTimerRef.current) {
      clearTimeout(audioTrimFailsafeTimerRef.current);
      audioTrimFailsafeTimerRef.current = null;
    }
    audioScrubRatioRef.current = null;
    setAudioScrubRatio(null);
    setAudioPlaybackRatio(0);
    setAudioTrimResumeSignal(0);
    setAudioPlaybackLoading(false);
    setActiveEditTool("audio");
    if (__DEV__) {
      const startedAt = audioAttachTimingStartedAtRef.current;
      const uri = next.uri;
      console.log("[audio-attach] attached", {
        uri: uri.length > 48 ? uri.slice(-48) : uri,
        name: next.fileName,
        ms: startedAt != null ? Date.now() - startedAt : undefined,
      });
    }
  }

  function handleEditMediaPress() {
    if (editingTextOverlayId) {
      if (__DEV__) console.log("[edit-preview] tap", { blockedBy: "editingText", paused: editUserPaused });
      return;
    }
    if (textOverlayActionId || textOverlayActionRenderId || textFontPickerOverlayId) {
      if (__DEV__) {
        console.log("[edit-preview] tap", { blockedBy: "textOverlayChrome", paused: editUserPaused });
      }
      return;
    }
    if (editPagerScrolling) {
      if (__DEV__) {
        console.log("[edit-preview] tap", { blockedBy: "pagerScrolling", paused: editUserPaused });
      }
      return;
    }
    if (audioTrimDragActiveRef.current || trimDragActiveRef.current) {
      if (__DEV__) console.log("[edit-preview] tap", { blockedBy: "trimDrag", paused: editUserPaused });
      return;
    }

    const nextPaused = !editUserPaused;
    setEditUserPaused(nextPaused);
    if (slideshowAudio?.uri) {
      soundtrackRef.current?.userToggle(nextPaused);
    }
    if (__DEV__) {
      console.log("[edit-preview] tap", { paused: nextPaused });
    }
  }

  function beginSlideshowAudioAttach() {
    setAudioPickerOpen(false);
    setSlideshowAudioAttaching(true);
    setActiveEditTool("audio");
  }

  async function dismissAudioSheet() {
    setAudioPickerOpen(false);
    // iOS cannot present PHPicker / document picker from a React Native Modal.
    await waitMs(400);
  }

  async function pickSlideshowAudioFromFiles() {
    await dismissAudioSheet();
    const startedAt = Date.now();
    audioAttachTimingStartedAtRef.current = startedAt;
    setAudioAttachTimingStartedAt(startedAt);
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (__DEV__) {
        console.log("[audio-attach] picker returned", { ms: Date.now() - startedAt, source: "files" });
      }
      if (result.canceled || !result.assets?.[0]?.uri) return;
      beginSlideshowAudioAttach();
      const picked = result.assets[0];
      attachSlideshowAudio({
        uri: picked.uri,
        fileName: picked.name ?? picked.uri.split("/").pop() ?? "audio.mp3",
        mimeType: picked.mimeType ?? "audio/mpeg",
        fromVideo: false,
        label: picked.name ?? "MP3 from Files",
        durationMs: null,
      });
      setSlideshowAudioAttaching(false);
    } catch (error) {
      setSlideshowAudioAttaching(false);
      Alert.alert(
        "could not open files",
        error instanceof Error ? error.message : "try again or pick audio from a video.",
      );
    }
  }

  async function pickSlideshowAudioFromVideo() {
    await dismissAudioSheet();
    const startedAt = Date.now();
    audioAttachTimingStartedAtRef.current = startedAt;
    setAudioAttachTimingStartedAt(startedAt);
    try {
      logVideoUploadStep("audio from video picker start", {});
      const result = await launchCreateLibraryPicker({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
        selectionLimit: 1,
        preferCompatibleVideo: true,
      });
      if (__DEV__) {
        console.log("[audio-attach] picker returned", { ms: Date.now() - startedAt, source: "video" });
      }
      if (result.canceled || !result.assets[0]?.uri) {
        logVideoUploadStep("audio from video picker canceled", {});
        return;
      }
      beginSlideshowAudioAttach();
      const picked = await materializeLibraryAsset(result.assets[0], "video");
      attachSlideshowAudio({
        uri: picked.uri,
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        fromVideo: true,
        label: picked.fileName,
        durationMs: picked.durationMs > 0 ? picked.durationMs : null,
      });
      setSlideshowAudioAttaching(false);
      logVideoUploadStep("audio from video attached", {
        fileName: picked.fileName,
        durationMs: picked.durationMs,
        mimeType: picked.mimeType,
      });
    } catch (error) {
      setSlideshowAudioAttaching(false);
      logVideoUploadStep("audio from video failed", getVideoUploadErrorDetails(error));
      Alert.alert("couldn’t use that video", libraryPickerErrorMessage(error));
    }
  }

  function dismissEditTextKeyboard() {
    textInputRef.current?.blur();
    Keyboard.dismiss();
    const editingId = editingTextOverlayIdRef.current;
    if (editingId) {
      const text = editingTextDraftRef.current.slice(0, 60);
      setTextOverlays((current) => {
        const updated = current.map((overlay) =>
          overlay.id === editingId ? { ...overlay, text } : overlay,
        );
        return updated.filter((overlay) => overlay.id !== editingId || overlay.text.trim());
      });
    }
    setEditingTextOverlayId(null);
  }

  function addNewTextOverlay() {
    const id = createTextOverlayId();
    closeTextOverlayActions(false);
    setTextOverlays((current) => [
      ...current.filter((overlay) => overlay.text.trim()),
      {
        id,
        text: "",
        centerRatio: { x: 0.5, y: 0.5 },
        fontScale: TEXT_OVERLAY_DEFAULT_FONT_SCALE,
        fontId: TEXT_OVERLAY_DEFAULT_FONT_ID,
        effectId: TEXT_OVERLAY_DEFAULT_EFFECT_ID,
      },
    ]);
    editingTextDraftRef.current = "";
    setTextFontPickerOverlayId(null);
    setEditingTextOverlayId(id);
    setActiveEditTool("text");
    textInputRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => textInputRef.current?.focus(), 60);
  }

  function openTextOverlayActions(id: string) {
    if (textOverlayDragActiveRef.current || textOverlayPinchActiveRef.current) return;
    dismissEditTextKeyboard();
    setTextFontPickerOverlayId(null);
    textOverlayActionClosingRef.current = false;
    textOverlayActionScale.stopAnimation();
    textOverlayActionOpacity.stopAnimation();
    textOverlayActionTranslateY.stopAnimation();
    setTextOverlayActionId(id);
    setTextOverlayActionRenderId(id);
    textOverlayActionScale.setValue(0.72);
    textOverlayActionOpacity.setValue(0);
    textOverlayActionTranslateY.setValue(-8);
    Animated.parallel([
      Animated.spring(textOverlayActionScale, {
        toValue: 1,
        friction: 6,
        tension: 420,
        useNativeDriver: true,
      }),
      Animated.timing(textOverlayActionOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(textOverlayActionTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function closeTextOverlayActions(animated = true) {
    if (!textOverlayActionId && !textOverlayActionRenderId) return;
    setTextOverlayActionId(null);

    if (!animated) {
      textOverlayActionClosingRef.current = false;
      textOverlayActionScale.stopAnimation();
      textOverlayActionOpacity.stopAnimation();
      textOverlayActionTranslateY.stopAnimation();
      textOverlayActionScale.setValue(0);
      textOverlayActionOpacity.setValue(0);
      textOverlayActionTranslateY.setValue(-8);
      setTextOverlayActionRenderId(null);
      return;
    }

    if (textOverlayActionClosingRef.current) return;
    textOverlayActionClosingRef.current = true;
    Animated.parallel([
      Animated.timing(textOverlayActionScale, {
        toValue: 0.72,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(textOverlayActionOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(textOverlayActionTranslateY, {
        toValue: -8,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      textOverlayActionClosingRef.current = false;
      if (!finished) return;
      setTextOverlayActionRenderId(null);
    });
  }

  function openTextFontPicker(id: string) {
    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setActiveEditTool(null);
    setTextFontPickerOverlayId(id);
  }

  function updateTextOverlayFontScale(id: string, fontScale: number) {
    const nextScale = clampTextOverlayFontScale(fontScale);
    setTextOverlays((current) =>
      current.map((overlay) => (overlay.id === id ? { ...overlay, fontScale: nextScale } : overlay)),
    );
  }

  function updateTextOverlayFontId(id: string, fontId: VideoTextFontId) {
    const nextFontId = normalizeVideoTextFontId(fontId);
    setTextOverlays((current) =>
      current.map((overlay) => (overlay.id === id ? { ...overlay, fontId: nextFontId } : overlay)),
    );
  }

  function cycleTextOverlayEffect(id: string) {
    setTextOverlays((current) =>
      current.map((overlay) =>
        overlay.id === id
          ? { ...overlay, effectId: cycleVideoTextEffectId(overlay.effectId) }
          : overlay,
      ),
    );
  }

  function startEditingTextOverlay(id: string) {
    if (textOverlayDragActiveRef.current || textOverlayPinchActiveRef.current) return;
    const overlay = textOverlaysRef.current.find((item) => item.id === id);
    editingTextDraftRef.current = overlay?.text ?? "";
    closeTextOverlayActions(false);
    setTextFontPickerOverlayId(null);
    setEditingTextOverlayId(id);
    setActiveEditTool("text");
    setTimeout(() => textInputRef.current?.focus(), 60);
  }

  function deleteTextOverlay(id: string) {
    setTextOverlays((current) => current.filter((overlay) => overlay.id !== id));
    closeTextOverlayActions(false);
    setTextFontPickerOverlayId((current) => (current === id ? null : current));
    setTextOverlaySizes((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingTextOverlayId((currentId) => {
      if (currentId !== id) return currentId;
      textInputRef.current?.blur();
      Keyboard.dismiss();
      return null;
    });
  }

  function updateTextOverlaySize(id: string, size: { width: number; height: number }) {
    setTextOverlaySizes((current) => {
      const previous = current[id];
      if (previous?.width === size.width && previous?.height === size.height) return current;
      return { ...current, [id]: size };
    });
  }

  function getAudioDurationLabel() {
    if (slideshowAudioError) return "couldn't load";
    if (!slideshowAudioDurationMs) return "--:--";
    return formatClipDuration(
      Math.max(0, Math.round((audioTrimEndRatio - audioTrimStartRatio) * slideshowAudioDurationMs)),
    );
  }

  function clearAudioTrimFailsafe() {
    if (audioTrimFailsafeTimerRef.current) {
      clearTimeout(audioTrimFailsafeTimerRef.current);
      audioTrimFailsafeTimerRef.current = null;
    }
  }

  function restartAudioTrimFailsafe() {
    clearAudioTrimFailsafe();
    audioTrimFailsafeTimerRef.current = setTimeout(() => {
      audioTrimFailsafeTimerRef.current = null;
      if (audioScrubRatioRef.current == null) return;
      // Finger may still be down (held still) — re-arm once instead of finishing.
      if (audioTrimDragActiveRef.current && !audioTrimFailsafeRearmedRef.current) {
        audioTrimFailsafeRearmedRef.current = true;
        restartAudioTrimFailsafe();
        return;
      }
      finishAudioTrimHandleDrag(
        audioTrimLastHandleRef.current,
        audioTrimLastTranslationXRef.current,
        "failsafe",
      );
    }, 1000);
  }

  function beginAudioTrimDrag() {
    audioTrimDragStartRef.current = {
      start: audioTrimStartRatio,
      end: audioTrimEndRatio,
    };
    audioTrimDisplayedRef.current = {
      start: audioTrimStartRatio,
      end: audioTrimEndRatio,
    };
  }

  function applyAudioTrimHandleDrag(handle: "start" | "end", translationX: number) {
    if (!audioTrimDragActiveRef.current) {
      if (__DEV__) console.log("[edit-trim] ignored late drag event");
      return;
    }
    audioTrimLastHandleRef.current = handle;
    audioTrimLastTranslationXRef.current = translationX;
    audioTrimFailsafeRearmedRef.current = false;
    restartAudioTrimFailsafe();
    if (!audioTimelineWidth) return;
    const delta = translationX / audioTimelineWidth;
    const minGap = 0.08;
    const dragStart = audioTrimDragStartRef.current;
    if (handle === "start") {
      const ratio = clamp(dragStart.start + delta, 0, Math.max(0, dragStart.end - minGap));
      audioTrimDisplayedRef.current = { start: ratio, end: dragStart.end };
      setAudioTrimStartRatio(ratio);
      audioScrubRatioRef.current = ratio;
      setAudioScrubRatio(ratio);
      return;
    }
    const ratio = clamp(dragStart.end + delta, Math.min(1, dragStart.start + minGap), 1);
    audioTrimDisplayedRef.current = { start: dragStart.start, end: ratio };
    setAudioTrimEndRatio(ratio);
    audioScrubRatioRef.current = ratio;
    setAudioScrubRatio(ratio);
  }

  function finishAudioTrimHandleDrag(
    handle: "start" | "end",
    translationX: number,
    reason: "end" | "cancel" | "fail" | "failsafe" | "unmount" = "end",
  ) {
    clearAudioTrimFailsafe();
    audioTrimFailsafeRearmedRef.current = false;
    if (!audioTrimDragActiveRef.current && audioScrubRatioRef.current == null) return;
    audioTrimDragActiveRef.current = false;
    void reason;
    const displayed = audioTrimDisplayedRef.current;
    const nextStart = displayed.start;
    const nextEnd = displayed.end;
    const delta = audioTimelineWidth ? translationX / audioTimelineWidth : 0;
    const minGap = 0.08;
    const dragStart = audioTrimDragStartRef.current;
    const endEventRatio =
      handle === "start"
        ? clamp(dragStart.start + delta, 0, Math.max(0, dragStart.end - minGap))
        : clamp(dragStart.end + delta, Math.min(1, dragStart.start + minGap), 1);
    audioTrimDragStartRef.current = { start: nextStart, end: nextEnd };
    audioTrimDisplayedRef.current = { start: nextStart, end: nextEnd };
    setAudioTrimStartRatio(nextStart);
    setAudioTrimEndRatio(nextEnd);
    audioScrubRatioRef.current = null;
    setAudioScrubRatio(null);
    setAudioPlaybackRatio(nextStart);
    setAudioTrimResumeSignal((token) => token + 1);
    if (__DEV__) {
      const durationSec = (slideshowAudioDurationMs ?? 0) / 1000;
      const committedRatio = handle === "start" ? nextStart : nextEnd;
      const displayedSec = committedRatio * durationSec;
      const committedSec = displayedSec;
      const endEventSec = endEventRatio * durationSec;
      console.log("[edit-trim] commit", {
        kind: "audio",
        handle,
        displayedSec,
        committedSec,
        endEventSec,
      });
    }
  }

  function clearAudioTrimInteraction(reason: "unmount" | "failsafe" = "unmount") {
    if (audioTrimDragActiveRef.current) {
      finishAudioTrimHandleDrag(
        audioTrimLastHandleRef.current,
        audioTrimLastTranslationXRef.current,
        reason,
      );
      return;
    }
    clearAudioTrimFailsafe();
    audioTrimFailsafeRearmedRef.current = false;
    if (audioScrubRatioRef.current == null) return;
    audioScrubRatioRef.current = null;
    setAudioScrubRatio(null);
    setAudioPlaybackRatio(audioTrimDisplayedRef.current.start);
    setAudioTrimResumeSignal((token) => token + 1);
  }

  function handleAudioTrimHandleStateChange(handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) {
    const { state, translationX } = event.nativeEvent;
    if (state === State.BEGAN || state === State.ACTIVE) {
      if (!audioTrimDragActiveRef.current) {
        audioTrimDragActiveRef.current = true;
        audioTrimLastHandleRef.current = handle;
        beginAudioTrimDrag();
        const ratio = handle === "start" ? audioTrimStartRatio : audioTrimEndRatio;
        audioScrubRatioRef.current = ratio;
        setAudioScrubRatio(ratio);
        if (__DEV__) console.log("[edit-trim] scrub start", { handle, kind: "audio" });
      }
      audioTrimLastTranslationXRef.current = translationX;
      audioTrimFailsafeRearmedRef.current = false;
      restartAudioTrimFailsafe();
      return;
    }
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      if (!audioTrimDragActiveRef.current && audioScrubRatioRef.current == null) {
        if (__DEV__) console.log("[edit-trim] ignored late end", { kind: "audio", handle });
        return;
      }
      const reason = state === State.END ? "end" : state === State.CANCELLED ? "cancel" : "fail";
      finishAudioTrimHandleDrag(handle, translationX, reason);
    }
  }

  function toggleEditTool(tool: "trim" | "filters" | "text") {
    setAudioPickerOpen(false);
    if (tool === "text") {
      addNewTextOverlay();
      return;
    }

    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setTextFontPickerOverlayId(null);
    setActiveEditTool((current) => (current === tool ? null : tool));
  }

  function toggleAudioEditor() {
    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setTextFontPickerOverlayId(null);

    if (activeEditTool === "audio") {
      setAudioPickerOpen(false);
      setActiveEditTool(null);
      return;
    }

    setActiveEditTool("audio");
    if (!slideshowAudio?.uri && !slideshowAudioAttaching) {
      setAudioPickerOpen(true);
    }
  }

  function handleEditViewportLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setEditViewportSize({ width, height });
  }

  function hideTextOverlaySnapGuide(axis: "horizontal" | "vertical", immediate = false) {
    const timerRef = axis === "horizontal" ? textOverlayHorizontalGuideTimerRef : textOverlayVerticalGuideTimerRef;
    const opacity = axis === "horizontal" ? textOverlayHorizontalGuideOpacity : textOverlayVerticalGuideOpacity;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (axis === "horizontal") {
      textOverlayHorizontalGuideVisibleRef.current = false;
    } else {
      textOverlayVerticalGuideVisibleRef.current = false;
    }

    if (immediate) {
      opacity.setValue(0);
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: TEXT_OVERLAY_CENTER_GUIDE_FADE_MS,
      useNativeDriver: true,
    }).start();
  }

  function hideTextOverlaySnapGuides(immediate = false) {
    hideTextOverlaySnapGuide("horizontal", immediate);
    hideTextOverlaySnapGuide("vertical", immediate);
  }

  function updateTextOverlaySnapGuides(ratio: { x: number; y: number }) {
    const nearHorizontalCenter = Math.abs(ratio.x - 0.5) <= TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD;
    const nearVerticalCenter = Math.abs(ratio.y - 0.5) <= TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD;

    if (nearHorizontalCenter) {
      if (!textOverlayVerticalGuideVisibleRef.current && !textOverlayVerticalGuideTimerRef.current) {
        textOverlayVerticalGuideTimerRef.current = setTimeout(() => {
          textOverlayVerticalGuideTimerRef.current = null;
          Animated.timing(textOverlayVerticalGuideOpacity, {
            toValue: 1,
            duration: TEXT_OVERLAY_CENTER_GUIDE_FADE_MS,
            useNativeDriver: true,
          }).start(() => {
            textOverlayVerticalGuideVisibleRef.current = true;
          });
        }, TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS);
      }
    } else {
      hideTextOverlaySnapGuide("vertical");
    }

    if (nearVerticalCenter) {
      if (!textOverlayHorizontalGuideVisibleRef.current && !textOverlayHorizontalGuideTimerRef.current) {
        textOverlayHorizontalGuideTimerRef.current = setTimeout(() => {
          textOverlayHorizontalGuideTimerRef.current = null;
          Animated.timing(textOverlayHorizontalGuideOpacity, {
            toValue: 1,
            duration: TEXT_OVERLAY_CENTER_GUIDE_FADE_MS,
            useNativeDriver: true,
          }).start(() => {
            textOverlayHorizontalGuideVisibleRef.current = true;
          });
        }, TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS);
      }
    } else {
      hideTextOverlaySnapGuide("horizontal");
    }
  }

  function applyTextOverlayDragRatio(id: string, translationX: number, translationY: number) {
    const canvas = getCreateMediaCardRect(insets.top);
    if (!canvas.width || !canvas.height) return;

    const start = textOverlayDragStartRatioRef.current;
    const clampedRatio = clampTextOverlayCenterRatio({
      x: start.x + translationX / canvas.width,
      y: start.y + translationY / canvas.height,
    });

    updateTextOverlaySnapGuides(clampedRatio);
    const nextCenterRatio = snapTextOverlayCenterRatio(clampedRatio, {
      snapX: textOverlayVerticalGuideVisibleRef.current,
      snapY: textOverlayHorizontalGuideVisibleRef.current,
    });
    setTextOverlays((current) =>
      current.map((overlay) => (overlay.id === id ? { ...overlay, centerRatio: nextCenterRatio } : overlay)),
    );
  }

  function handleTextOverlayPanGesture(id: string, event: PanGestureHandlerGestureEvent) {
    if (event.nativeEvent.state !== State.ACTIVE) return;
    applyTextOverlayDragRatio(id, event.nativeEvent.translationX, event.nativeEvent.translationY);
  }

  function handleTextOverlayPanStateChange(id: string, event: PanGestureHandlerStateChangeEvent) {
    const { state, translationX, translationY } = event.nativeEvent;

    if (state === State.BEGAN) {
      const overlay = textOverlaysRef.current.find((item) => item.id === id);
      textOverlayDragStartRatioRef.current = overlay?.centerRatio ?? { x: 0.5, y: 0.5 };
      return;
    }

    if (state === State.ACTIVE) {
      if (!textOverlayDragActiveRef.current) {
        textOverlayDragActiveRef.current = true;
        closeTextOverlayActions(false);
        setTextFontPickerOverlayId(null);
        dismissEditTextKeyboard();
      }
      return;
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      textOverlayDragActiveRef.current = false;
      applyTextOverlayDragRatio(id, translationX, translationY);
      hideTextOverlaySnapGuides();
    }
  }

  useEffect(() => {
    return () => {
      if (textOverlayHorizontalGuideTimerRef.current) {
        clearTimeout(textOverlayHorizontalGuideTimerRef.current);
        textOverlayHorizontalGuideTimerRef.current = null;
      }
      if (textOverlayVerticalGuideTimerRef.current) {
        clearTimeout(textOverlayVerticalGuideTimerRef.current);
        textOverlayVerticalGuideTimerRef.current = null;
      }
      textOverlayHorizontalGuideOpacity.setValue(0);
      textOverlayVerticalGuideOpacity.setValue(0);
      if (audioLoadingToastHideTimerRef.current) {
        clearTimeout(audioLoadingToastHideTimerRef.current);
        audioLoadingToastHideTimerRef.current = null;
      }
    };
  }, [textOverlayHorizontalGuideOpacity, textOverlayVerticalGuideOpacity]);

  function goBackToEditStage() {
    setPostPreviewOpen(false);
    if (editItems.length > 0) {
      setCreateStage("edit");
      return;
    }
    exportBakeSessionRef.current += 1;
    setExportBakedAsset(null);
    setExportBakedDurationMs(0);
    setExportBakeStatus("idle");
    setCreateStage("edit");
  }

  function goBackToCameraStage() {
    resetUploadState();
  }

  function confirmDiscardCreateDraft() {
    setDiscardConfirmOpen(true);
  }

  function dismissDiscardCreateDraft() {
    setDiscardConfirmOpen(false);
  }

  function discardCreateDraft() {
    setDiscardConfirmOpen(false);
    goBackToCameraStage();
  }

  function hideAudioLoadingToast() {
    if (audioLoadingToastHideTimerRef.current) {
      clearTimeout(audioLoadingToastHideTimerRef.current);
      audioLoadingToastHideTimerRef.current = null;
    }
    audioLoadingToastOpacity.stopAnimation();
    Animated.timing(audioLoadingToastOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAudioLoadingToastVisible(false);
    });
  }

  function showAudioLoadingToast(message = "audio still loading") {
    if (audioLoadingToastHideTimerRef.current) {
      clearTimeout(audioLoadingToastHideTimerRef.current);
      audioLoadingToastHideTimerRef.current = null;
    }
    audioLoadingToastOpacity.stopAnimation();
    audioLoadingToastOpacity.setValue(0);
    setAudioToastMessage(message);
    setAudioLoadingToastVisible(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Animated.timing(audioLoadingToastOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });
    audioLoadingToastHideTimerRef.current = setTimeout(() => {
      hideAudioLoadingToast();
    }, 2400);
  }

  function isCroppedSlideshowAudioTooLong() {
    if (!slideshowAudio?.uri) return false;
    if (slideshowAudioDurationMs == null || !(slideshowAudioDurationMs > 0)) {
      if (__DEV__) {
        console.log("[create] slideshow audio duration unknown; skipping length check", {
          durationMs: slideshowAudioDurationMs,
        });
      }
      return false;
    }
    const croppedMs =
      (audioTrimEndRatio - audioTrimStartRatio) * slideshowAudioDurationMs;
    return croppedMs > maxDuration * 1000 + 500;
  }

  async function goToDetailsStage() {
    if (
      slideshowAudioAttaching ||
      Boolean(slideshowAudio?.uri && !slideshowAudioReady && !slideshowAudioError)
    ) {
      showAudioLoadingToast();
      return;
    }
    if (albumRequiresSoundtrack(editItems) && (!slideshowAudio?.uri || slideshowAudioError)) {
      Alert.alert(
        slideshowAudioError ? "couldn't load audio" : "add audio",
        slideshowAudioError
          ? "change the track and try again before continuing."
          : "choose a track from files or a video before continuing.",
      );
      setAudioPickerOpen(true);
      return;
    }
    if (isCroppedSlideshowAudioTooLong()) {
      showAudioLoadingToast(`audio needs to be ${maxDuration}s or less`);
      setActiveEditTool("audio");
      return;
    }

    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setActiveEditTool(null);

    const postedVideoItem =
      (asset
        ? editItems.find((item) => item.kind === "video" && item.uri === asset.uri)
        : null) ?? editItems.find((item) => item.kind === "video");
    const draftId = editingTextOverlayIdRef.current;
    const draftText = editingTextDraftRef.current.slice(0, 60);
    const overlaysForExport = (postedVideoItem?.textOverlays ?? textOverlays).map((overlay) =>
      overlay.id === draftId ? { ...overlay, text: draftText } : overlay,
    );
    const cleanedOverlays = overlaysForExport.filter((overlay) => overlay.text.trim());
    if (postedVideoItem && currentEditItemIdRef.current === postedVideoItem.id) {
      setTextOverlays(cleanedOverlays);
    } else if (!postedVideoItem) {
      setTextOverlays(cleanedOverlays);
    }

    if (selectedVideoDurationMs > 0) {
      const trimStartMs = Math.round(trimStartRatio * selectedVideoDurationMs);
      const trimEndMs = Math.round(trimEndRatio * selectedVideoDurationMs);
      if (selectedThumbnailTimeMs < trimStartMs || selectedThumbnailTimeMs > trimEndMs) {
        setSelectedThumbnailTimeMs(trimStartMs);
      }
    }

    if (!asset) {
      setCreateStage("details");
      return;
    }

    const sourceDurationSeconds =
      selectedVideoDurationMs > 0 ? selectedVideoDurationMs / 1000 : maxDuration;
    const trimStartSeconds = Math.max(0, trimStartRatio * sourceDurationSeconds);
    const trimEndSeconds = Math.min(
      sourceDurationSeconds,
      Math.max(trimStartSeconds + 0.1, trimEndRatio * sourceDurationSeconds),
    );
    // Trim-only skips local bake — upload the original and let Cloudflare Stream
    // clip apply the trim. Landscape remux previously fell through to ~540p.
    const shouldCompose = needsPresentationBake({
      videoFilter: selectedFilter,
      textOverlays: cleanedOverlays,
      mirrorHorizontal: needsSelfieMirror,
    });

    if (!shouldCompose || !isVideoBakeAvailable()) {
      exportBakeSessionRef.current += 1;
      setExportBakedAsset(null);
      setExportBakedDurationMs(0);
      setExportBakeStatus(needsSelfieMirror && !isVideoBakeAvailable() ? "failed" : "idle");
      if (thumbnailFrameOptions.length === 0) setLoadingThumbnailFrames(true);
      setCreateStage("details");
      if (needsSelfieMirror && !isVideoBakeAvailable()) {
        Alert.alert(
          "could not mirror selfie",
          "rebuild the Jam app to save front-camera videos the way they look while filming.",
        );
      }
      return;
    }

    const bakeSession = exportBakeSessionRef.current + 1;
    exportBakeSessionRef.current = bakeSession;
    setExportBakedAsset(null);
    setExportBakedDurationMs(0);
    setExportBakeStatus("baking");
    setThumbnailFrameOptions([]);
    thumbnailFramesSourceRef.current = null;
    setCreateStage("details");

    try {
      // Let the edit JamVideoView unmount and release the source file first.
      await new Promise<void>((resolve) => setTimeout(resolve, 320));
      if (exportBakeSessionRef.current !== bakeSession) return;

      const baked = await bakeVideoPresentation({
        asset,
        trimStartSeconds,
        trimEndSeconds,
        videoFilter: selectedFilter,
        textOverlays: cleanedOverlays.map((overlay) => ({
          id: overlay.id,
          text: overlay.text.trim(),
          centerRatio: overlay.centerRatio,
          fontScale: clampTextOverlayFontScale(overlay.fontScale),
          fontId: normalizeVideoTextFontId(overlay.fontId),
          effectId: normalizeVideoTextEffectId(overlay.effectId),
        })),
        thumbnailTimeMs: selectedThumbnailTimeMs,
        uploadId: `details-${bakeSession}`,
        mirrorHorizontal: needsSelfieMirror,
      });
      if (exportBakeSessionRef.current !== bakeSession) return;

      const bakedDurationMs = Math.max(100, Math.round(baked.outputDurationSeconds * 1000));
      setExportBakedAsset(baked.asset);
      setExportBakedDurationMs(bakedDurationMs);
      setExportBakeStatus("ready");
      setNeedsSelfieMirror(false);
      logVideoUploadStep("details export bake ready", {
        uri: baked.asset.uri,
        fileSize: baked.asset.fileSize,
        durationMs: bakedDurationMs,
        presentationBaked: baked.presentationBaked,
        hasThumbnail: Boolean(baked.thumbnailUri),
        mirroredSelfie: needsSelfieMirror,
      });
      if (baked.thumbnailUri) {
        setSelectedVideoThumbnailUri(baked.thumbnailUri);
        setSelectedThumbnailTimeMs(0);
      }
    } catch (error) {
      if (exportBakeSessionRef.current !== bakeSession) return;
      logVideoUploadStep("details export bake failed — using overlay preview", {
        ...getVideoUploadErrorDetails(error),
      });
      setExportBakedAsset(null);
      setExportBakedDurationMs(0);
      setExportBakeStatus("failed");
      // Don't block posting — overlays still preview, trim/filter retry on upload bake.
      Alert.alert(
        "could not pre-render edits",
        "you can still post — edits will be applied while uploading.",
      );
    }
  }

  function clearTrimFailsafe() {
    if (trimFailsafeTimerRef.current) {
      clearTimeout(trimFailsafeTimerRef.current);
      trimFailsafeTimerRef.current = null;
    }
  }

  function restartTrimFailsafe() {
    clearTrimFailsafe();
    trimFailsafeTimerRef.current = setTimeout(() => {
      trimFailsafeTimerRef.current = null;
      if (trimScrubRatioRef.current == null) return;
      // Finger may still be down (held still) — re-arm once instead of finishing.
      if (trimDragActiveRef.current && !trimFailsafeRearmedRef.current) {
        trimFailsafeRearmedRef.current = true;
        restartTrimFailsafe();
        return;
      }
      finishTrimHandleDrag(trimLastHandleRef.current, trimLastTranslationXRef.current, "failsafe");
    }, 1000);
  }

  function beginTrimDrag() {
    trimDragStartRef.current = {
      start: trimStartRatio,
      end: trimEndRatio,
    };
    trimDisplayedRef.current = {
      start: trimStartRatio,
      end: trimEndRatio,
    };
  }

  function applyTrimHandleDrag(handle: "start" | "end", translationX: number) {
    if (!trimDragActiveRef.current) {
      if (__DEV__) console.log("[edit-trim] ignored late drag event");
      return;
    }
    trimLastHandleRef.current = handle;
    trimLastTranslationXRef.current = translationX;
    trimFailsafeRearmedRef.current = false;
    restartTrimFailsafe();
    if (!timelineWidth) return;

    const delta = translationX / timelineWidth;
    const minGap = 0.08;
    const dragStart = trimDragStartRef.current;

    if (handle === "start") {
      const ratio = clamp(dragStart.start + delta, 0, Math.max(0, dragStart.end - minGap));
      trimDisplayedRef.current = { start: ratio, end: dragStart.end };
      setTrimStartRatio(ratio);
      trimScrubRatioRef.current = ratio;
      setTrimScrubRatio(ratio);
      return;
    }

    const ratio = clamp(dragStart.end + delta, Math.min(1, dragStart.start + minGap), 1);
    trimDisplayedRef.current = { start: dragStart.start, end: ratio };
    setTrimEndRatio(ratio);
    trimScrubRatioRef.current = ratio;
    setTrimScrubRatio(ratio);
  }

  function finishTrimHandleDrag(
    handle: "start" | "end",
    translationX: number,
    reason: "end" | "cancel" | "fail" | "failsafe" | "unmount" = "end",
  ) {
    clearTrimFailsafe();
    trimFailsafeRearmedRef.current = false;
    if (!trimDragActiveRef.current && trimScrubRatioRef.current == null) return;
    trimDragActiveRef.current = false;
    void reason;

    const displayed = trimDisplayedRef.current;
    const nextStart = displayed.start;
    const nextEnd = displayed.end;
    const delta = timelineWidth ? translationX / timelineWidth : 0;
    const minGap = 0.08;
    const dragStart = trimDragStartRef.current;
    const endEventRatio =
      handle === "start"
        ? clamp(dragStart.start + delta, 0, Math.max(0, dragStart.end - minGap))
        : clamp(dragStart.end + delta, Math.min(1, dragStart.start + minGap), 1);

    trimDragStartRef.current = { start: nextStart, end: nextEnd };
    trimDisplayedRef.current = { start: nextStart, end: nextEnd };
    setTrimStartRatio(nextStart);
    setTrimEndRatio(nextEnd);
    trimScrubRatioRef.current = null;
    setTrimScrubRatio(null);
    setEditPlaybackRatio(nextStart);
    setTrimPlaybackResumeSignal((token) => token + 1);
    if (__DEV__) {
      const durationSec = selectedVideoDurationMs / 1000;
      const committedRatio = handle === "start" ? nextStart : nextEnd;
      const displayedSec = committedRatio * durationSec;
      const committedSec = displayedSec;
      const endEventSec = endEventRatio * durationSec;
      console.log("[edit-trim] commit", {
        kind: "video",
        handle,
        displayedSec,
        committedSec,
        endEventSec,
      });
    }
  }

  function clearTrimInteraction(reason: "unmount" | "failsafe" = "unmount") {
    if (trimDragActiveRef.current) {
      finishTrimHandleDrag(trimLastHandleRef.current, trimLastTranslationXRef.current, reason);
      return;
    }
    clearTrimFailsafe();
    trimFailsafeRearmedRef.current = false;
    if (trimScrubRatioRef.current == null) return;
    trimScrubRatioRef.current = null;
    setTrimScrubRatio(null);
    setEditPlaybackRatio(trimDisplayedRef.current.start);
    setTrimPlaybackResumeSignal((token) => token + 1);
  }

  function handleTrimHandleStateChange(handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) {
    const { state, translationX } = event.nativeEvent;

    if (state === State.BEGAN || state === State.ACTIVE) {
      if (!trimDragActiveRef.current) {
        trimDragActiveRef.current = true;
        trimLastHandleRef.current = handle;
        beginTrimDrag();
        const ratio = handle === "start" ? trimStartRatio : trimEndRatio;
        trimScrubRatioRef.current = ratio;
        setTrimScrubRatio(ratio);
        if (__DEV__) console.log("[edit-trim] scrub start", { handle, kind: "video" });
      }
      trimLastTranslationXRef.current = translationX;
      trimFailsafeRearmedRef.current = false;
      restartTrimFailsafe();
      return;
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      if (!trimDragActiveRef.current && trimScrubRatioRef.current == null) {
        if (__DEV__) console.log("[edit-trim] ignored late end", { kind: "video", handle });
        return;
      }
      const reason = state === State.END ? "end" : state === State.CANCELLED ? "cancel" : "fail";
      finishTrimHandleDrag(handle, translationX, reason);
    }
  }

  // clear* helpers use refs; omitting them from deps avoids rebinding every render.
  useEffect(() => {
    if (activeEditTool === "audio") return;
    const timer = setTimeout(() => clearAudioTrimInteraction("unmount"), 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [activeEditTool]);

  useEffect(() => {
    if (activeEditTool === "trim") return;
    const timer = setTimeout(() => clearTrimInteraction("unmount"), 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [activeEditTool]);

  useEffect(() => {
    const timer = setTimeout(() => clearAudioTrimInteraction("unmount"), 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [slideshowAudio?.uri]);

  useEffect(() => {
    const uri = slideshowAudio?.uri ?? null;
    const timingStartedAt = audioAttachTimingStartedAtRef.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (!uri) {
        setAudioPeaks(null);
        setAudioPeaksLoading(false);
        return;
      }
      setAudioPeaks(null);
      setAudioPeaksLoading(true);
      void getAudioPeaks(uri, 80, { timingStartedAt }).then((peaks) => {
        if (cancelled) return;
        setAudioPeaks(peaks);
        setAudioPeaksLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slideshowAudio?.uri]);

  useEffect(() => {
    if (createStage === "edit") return;
    const timer = setTimeout(() => {
      clearAudioTrimInteraction("unmount");
      clearTrimInteraction("unmount");
      endEditPagerScroll();
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [createStage]);

  useEffect(() => {
    return () => {
      if (audioTrimFailsafeTimerRef.current) {
        clearTimeout(audioTrimFailsafeTimerRef.current);
        audioTrimFailsafeTimerRef.current = null;
      }
      if (trimFailsafeTimerRef.current) {
        clearTimeout(trimFailsafeTimerRef.current);
        trimFailsafeTimerRef.current = null;
      }
      if (editPagerScrollFailsafeTimerRef.current) {
        clearTimeout(editPagerScrollFailsafeTimerRef.current);
        editPagerScrollFailsafeTimerRef.current = null;
      }
      audioTrimDragActiveRef.current = false;
      trimDragActiveRef.current = false;
    };
  }, []);

  function toggleLimitedTag(tag: string, selected: string[], setSelected: Dispatch<SetStateAction<string[]>>, label: string, maxItems: number) {
    if (selected.includes(tag)) {
      setSelected((current) => current.filter((item) => item !== tag));
      return;
    }

    if (selected.length >= maxItems) {
      Alert.alert(`maximum ${label}s`, `choose up to ${maxItems} ${label}${maxItems === 1 ? "" : "s"} for this video.`);
      return;
    }

    setSelected((current) => [...current, tag]);
  }

  function toggleLookingForCollaborators() {
    setLookingForCollaborators((current) => {
      if (current) {
        setSelectedLookingForRoles([]);
        setSelectedLookingForGenres([]);
      }
      return !current;
    });
  }

  async function post() {
    const postRoles = getUniqueStrings(selectedRoles).slice(0, MAX_VIDEO_ROLES);
    const postGenres = getUniqueStrings(selectedGenres).slice(0, MAX_VIDEO_GENRES);
    const postLookingForRoles = lookingForCollaborators
      ? getUniqueStrings(selectedLookingForRoles).slice(0, MAX_VIDEO_ROLES)
      : [];
    const postLookingForGenres = lookingForCollaborators
      ? getUniqueStrings(selectedLookingForGenres).slice(0, MAX_VIDEO_GENRES)
      : [];

    const imageOnlyAlbum = editItems.length > 0 && editItems.every((item) => item.kind === "image");
    if (albumRequiresSoundtrack(editItems) && (!slideshowAudio?.uri || slideshowAudioError)) {
      Alert.alert(
        slideshowAudioError ? "couldn't load audio" : "add audio",
        slideshowAudioError
          ? "change the track and try again before posting."
          : "choose a track from files or a video before posting.",
      );
      return;
    }
    if (imageOnlyAlbum) {
      if (postRoles.length === 0 && postGenres.length === 0) {
        Alert.alert("choose tags", "select at least one role or genre for this post.");
        return;
      }
      if (isCroppedSlideshowAudioTooLong()) {
        const message = `audio needs to be ${maxDuration}s or less`;
        if (createStage === "edit") {
          showAudioLoadingToast(message);
          setActiveEditTool("audio");
        } else {
          Alert.alert("audio too long", message);
        }
        return;
      }
      const fullAudioMs = slideshowAudioDurationMs;
      const audioCropped =
        Boolean(fullAudioMs) &&
        (audioTrimStartRatio > 0.001 || audioTrimEndRatio < 0.999);
      enqueuePendingSlideshowUpload({
        userId,
        images: slideshowImages,
        audio: slideshowAudio,
        audioStartMs:
          audioCropped && fullAudioMs
            ? Math.max(0, Math.round(audioTrimStartRatio * fullAudioMs))
            : null,
        audioDurationMs: fullAudioMs
          ? Math.max(
              100,
              Math.round((audioTrimEndRatio - audioTrimStartRatio) * fullAudioMs),
            )
          : null,
        caption: caption.trim(),
        roles: postRoles,
        genres: postGenres,
        lookingFor: lookingForCollaborators,
        lookingForRoles: postLookingForRoles,
        lookingForGenres: postLookingForGenres,
      });
      resetUploadState();
      onPosted();
      return;
    }

    const useBakedExport = exportBakeStatus === "ready" && Boolean(exportBakedAsset?.uri);
    const sourceDurationSeconds = useBakedExport
      ? Math.max(0.1, exportBakedDurationMs / 1000)
      : selectedVideoDurationMs > 0
        ? selectedVideoDurationMs / 1000
        : maxDuration;
    const trimStartSeconds = useBakedExport
      ? 0
      : Math.max(0, trimStartRatio * sourceDurationSeconds);
    const trimEndSeconds = useBakedExport
      ? sourceDurationSeconds
      : Math.min(
          sourceDurationSeconds,
          Math.max(trimStartSeconds + 0.1, trimEndRatio * sourceDurationSeconds),
        );
    const trimmedSeconds = trimEndSeconds - trimStartSeconds;
    const postedVideoItem =
      (asset
        ? editItems.find((item) => item.kind === "video" && item.uri === asset.uri)
        : null) ?? editItems.find((item) => item.kind === "video");
    const overlaysForPost = postedVideoItem?.textOverlays ?? textOverlays;
    const postedTextOverlays = useBakedExport
      ? []
      : overlaysForPost
          .filter((overlay) => overlay.text.trim())
          .map((overlay) => ({
            id: overlay.id,
            text: overlay.text.trim(),
            centerRatio: overlay.centerRatio,
            fontScale: clampTextOverlayFontScale(overlay.fontScale),
            fontId: normalizeVideoTextFontId(overlay.fontId),
            effectId: normalizeVideoTextEffectId(overlay.effectId),
          }));
    const publishFilter = useBakedExport ? "none" : selectedFilter;
    const uploadAsset = useBakedExport && exportBakedAsset ? exportBakedAsset : asset;
    logVideoUploadStep("post submission start", {
      hasAsset: Boolean(uploadAsset),
      captionLength: caption.trim().length,
      roleCount: postRoles.length,
      genreCount: postGenres.length,
      trimStartSeconds,
      trimEndSeconds,
      videoFilter: publishFilter,
      textOverlayCount: postedTextOverlays.length,
      presentationBaked: useBakedExport,
    });
    if (!uploadAsset) {
      logVideoUploadStep("post submission blocked", { reason: "missing-asset" });
      Alert.alert("missing video", "record or select a video first.");
      return;
    }
    if (exportBakeStatus === "baking") {
      Alert.alert("still rendering", "wait for your edits to finish rendering before posting.");
      return;
    }
    if (postRoles.length === 0 && postGenres.length === 0) {
      logVideoUploadStep("post submission blocked", { reason: "missing-tags" });
      Alert.alert("choose tags", "select at least one role or genre for this video.");
      return;
    }
    if (!useBakedExport && trimmedSeconds > maxDuration + 0.5) {
      logVideoUploadStep("post submission blocked", { reason: "trim-too-long", trimmedSeconds, maxDuration });
      Alert.alert("clip too long", `trim this video to ${maxDuration}s or less before posting.`);
      return;
    }

    let localThumbnailUri = selectedVideoThumbnailUri;
    if (!localThumbnailUri && uploadAsset.uri) {
      try {
        const thumbnail = await getThumbnailAsync(uploadAsset.uri, {
          time: Math.max(0, selectedThumbnailTimeMs),
          quality: 0.6,
        });
        localThumbnailUri = thumbnail.uri;
      } catch {
        localThumbnailUri = null;
      }
    }

    const uploadPayload = {
      userId,
      asset: uploadAsset,
      localThumbnailUri,
      caption: caption.trim(),
      roles: postRoles,
      genres: postGenres,
      thumbnailTimeMs: selectedThumbnailTimeMs,
      maxDurationSeconds: maxDuration,
      sourceDurationSeconds,
      trimStartSeconds,
      trimEndSeconds,
      videoFilter: publishFilter,
      textOverlays: postedTextOverlays,
      lookingFor: lookingForCollaborators,
      lookingForRoles: postLookingForRoles,
      lookingForGenres: postLookingForGenres,
      presentationBaked: useBakedExport,
      bakedAsset: useBakedExport ? uploadAsset : null,
    };

    // Queue first so progress/profile tiles appear as soon as we leave create.
    enqueuePendingVideoUpload(uploadPayload);
    resetUploadState();
    logVideoUploadStep("post submission queued", {
      roleCount: postRoles.length,
      genreCount: postGenres.length,
      trimmed: trimStartSeconds > 0.05 || trimEndSeconds < sourceDurationSeconds - 0.05,
      videoFilter: publishFilter,
      textOverlayCount: postedTextOverlays.length,
      hasThumbnail: Boolean(localThumbnailUri),
      presentationBaked: useBakedExport,
    });
    onPosted();
  }

  if (createStage === "camera") {
    const cameraPermissionReady = cameraPermissionGranted && microphonePermissionGranted;
    const cameraControlsDisabled = recording || capturingPhoto || libraryBusy || recordingCountdown !== null || !cameraPermissionReady || !cameraReady;
    const cameraHint =
      recordingCountdown !== null
        ? `starting in ${recordingCountdown}...`
        : recording
          ? null
          : recordingTimerSeconds > 0
            ? `timer ${recordingTimerSeconds}s`
            : null;
    const frontScreenFlashActive = flashEnabled && cameraFacing === "front" && cameraPermissionReady;
    const frontScreenFlashOpacity = recording || recordingCountdown !== null ? 0.97 : 0.9;
    const feedViewport = getFeedVideoViewport(insets.bottom);
    const controlsBottom = getCreateCameraControlsBottom(feedViewport.navBarHeight);
    const filterRestBottom = getCreateCameraFilterRestBottom(feedViewport.navBarHeight);
    const mediaCard = getCreateMediaCardRect(insets.top);

    return (
      <View style={styles.createCameraRoot}>
        <View
          style={[
            styles.createNineSixteenMediaCard,
            {
              marginTop: mediaCard.top,
              height: mediaCard.height,
              borderRadius: FEED_VIDEO_BOTTOM_CORNER_RADIUS,
            },
          ]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            cameraViewportSizeRef.current = { width, height };
          }}
        >
          {cameraPermissionGranted === null || microphonePermissionGranted === null ? (
            <View style={styles.createCameraPermission}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.helper}>opening camera...</Text>
            </View>
          ) : cameraPermissionReady ? (
            <>
              {cameraSessionArmed ? (
                <CameraView
                  key={`${cameraSessionKey}-${cameraFacingKey}`}
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing={cameraFacing}
                  mode="video"
                  mute={false}
                  videoQuality="1080p"
                  // Front preview is mirrored by the system. Selfie flip is baked
                  // into the file after recording (and during export if needed).
                  mirror={false}
                  active={isFocused}
                  animateShutter={false}
                  zoom={cameraZoom}
                  enableTorch={flashEnabled && cameraFacing === "back"}
                  onCameraReady={() => setCameraReady(true)}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
              )}
              {selectedFilter !== "none" ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.createCameraFilterPreview, getVideoFilterOverlayStyle(selectedFilter)]}
                />
              ) : null}
              {frontScreenFlashActive ? (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.createCameraScreenFlash,
                    { backgroundColor: `rgba(255,255,255,${frontScreenFlashOpacity})` },
                  ]}
                />
              ) : null}
              {recordingCountdown !== null ? (
                <View pointerEvents="none" style={styles.createCameraCountdownOverlay}>
                  <Text style={styles.createCameraCountdownText}>{recordingCountdown}</Text>
                </View>
              ) : null}
              <PinchGestureHandler
                enabled={isFocused && cameraSessionArmed && recordingCountdown === null}
                onGestureEvent={handleCameraPinchGesture}
                onHandlerStateChange={handleCameraPinchStateChange}
              >
                <Animated.View style={styles.createCameraTapLayer} collapsable={false}>
                  <PanGestureHandler
                    enabled={isFocused && cameraSessionArmed && recordingCountdown === null && cameraReady}
                    activeOffsetY={[-2, 2]}
                    failOffsetX={[-28, 28]}
                    maxPointers={1}
                    onGestureEvent={handleCameraExposureGesture}
                    onHandlerStateChange={handleCameraExposureStateChange}
                  >
                    <Animated.View style={StyleSheet.absoluteFill} collapsable={false}>
                      <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={handleCameraTap}
                        disabled={recordingCountdown !== null || !cameraSessionArmed || !cameraReady}
                        accessibilityLabel="tap to focus, drag vertically for exposure, double tap to flip"
                      />
                      {focusReticle ? (
                        <Animated.View
                          pointerEvents="none"
                          key={focusReticle.key}
                          style={[
                            styles.createCameraFocusReticle,
                            {
                              left: focusReticle.x - CREATE_CAMERA_FOCUS_RETICLE_SIZE / 2,
                              top: focusReticle.y - CREATE_CAMERA_FOCUS_RETICLE_SIZE / 2,
                              opacity: focusReticleOpacity,
                              transform: [{ scale: focusReticleScale }],
                            },
                          ]}
                        >
                          <View style={styles.createCameraFocusReticleCircle} />
                          {exposureAdjusting || Math.abs(exposureBiasUi) > 0.02 ? (
                            <View style={styles.createCameraExposureRail}>
                              <View style={styles.createCameraExposureLine} />
                              <View
                                style={[
                                  styles.createCameraExposureDot,
                                  {
                                    transform: [
                                      {
                                        translateY:
                                          (-exposureBiasUi) * (CREATE_CAMERA_FOCUS_RETICLE_SIZE * 0.42),
                                      },
                                    ],
                                  },
                                ]}
                              />
                            </View>
                          ) : null}
                        </Animated.View>
                      ) : null}
                    </Animated.View>
                  </PanGestureHandler>
                </Animated.View>
              </PinchGestureHandler>
            </>
          ) : (
            <View style={styles.createCameraPermission}>
              <Text style={styles.h2}>camera access needed</Text>
              <Text style={styles.copyCentered}>enable camera and microphone access to record videos in jam.</Text>
              <PrimaryButton
                label="allow camera"
                onPress={() => {
                  void (async () => {
                    const [cameraPermission, microphonePermission] = await Promise.all([
                      Camera.requestCameraPermissionsAsync(),
                      Camera.requestMicrophonePermissionsAsync(),
                    ]);
                    setCameraPermissionGranted(cameraPermission.granted);
                    setMicrophonePermissionGranted(microphonePermission.granted);
                  })();
                }}
              />
            </View>
          )}
        </View>
        <View style={[styles.createCameraTopBar, { top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET }]}>
          <Pressable onPress={closeCreateScreen} style={styles.createCameraControlButton} accessibilityLabel="close create">
            <Text style={styles.createCameraCloseIconText}>×</Text>
          </Pressable>
        </View>
        {cameraPermissionReady ? (
          <View style={[styles.createCameraSideRail, { top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET }]}>
            <Pressable
              style={[styles.createCameraControlButton, cameraControlsDisabled && styles.disabled]}
              disabled={cameraControlsDisabled}
              onPress={flipCameraFacing}
              accessibilityLabel="flip camera"
            >
              <CreateCameraFlipIcon />
            </Pressable>
            <Pressable
              style={[styles.createCameraControlButton, cameraControlsDisabled && styles.disabled]}
              disabled={cameraControlsDisabled}
              onPress={toggleFlash}
              accessibilityLabel={flashEnabled ? "turn flash off" : "turn flash on"}
            >
              <CreateCameraFlashIcon enabled={flashEnabled} />
            </Pressable>
            <Pressable
              style={[styles.createCameraControlButton, cameraControlsDisabled && styles.disabled]}
              disabled={cameraControlsDisabled}
              onPress={cycleRecordingTimer}
              accessibilityLabel={
                recordingTimerSeconds > 0
                  ? `recording timer ${recordingTimerSeconds} seconds`
                  : "recording timer off"
              }
            >
              <CreateCameraTimerIcon seconds={recordingTimerSeconds} />
            </Pressable>
            <Pressable
              style={[styles.createCameraControlButton, cameraControlsDisabled && styles.disabled]}
              disabled={cameraControlsDisabled}
              onPress={() => setCameraFiltersOpen(true)}
              accessibilityLabel="open filters"
            >
              <CreateCameraFilterIcon active={selectedFilter !== "none"} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.createCameraBottomBar, { bottom: controlsBottom }]}>
          <CreateCaptureShutter
            mode={captureMode}
            onModeChange={setCaptureMode}
            recording={recording}
            countdownActive={recordingCountdown !== null}
            disabled={!cameraPermissionReady || !cameraReady || capturingPhoto}
            onVideoPress={() => {
              void handleRecordPress();
            }}
            onPhotoPress={() => {
              void handlePhotoPress();
            }}
            onPrimaryPressIn={handleRecordPressIn}
            onPrimaryPressOut={handleRecordPressOut}
            primaryPressScale={recordPressScale}
            maxDuration={maxDuration}
          />
        </View>
        <Animated.View
          style={[
            styles.createLibraryButton,
            {
              bottom: (feedViewport.navBarHeight - 58) / 2,
              transform: [{ translateY: libraryButtonSlideY }],
            },
          ]}
        >
          <Pressable
            onPress={() => void pickFromLibrary()}
            style={StyleSheet.absoluteFill}
            disabled={recording || capturingPhoto || libraryBusy || recordingCountdown !== null || cameraFiltersOpen}
            accessibilityLabel="choose video or photo from camera roll"
          >
            {recentVideoThumbnailUri ? (
              <Image source={{ uri: recentVideoThumbnailUri }} style={styles.createLibraryThumbnail as ImageStyle} />
            ) : (
              <Image
                source={require("../assets/camera-roll-placeholder.png")}
                style={styles.createLibraryThumbnail as ImageStyle}
              />
            )}
          </Pressable>
        </Animated.View>
        {libraryBusy ? (
          <View style={styles.createCameraCountdownOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.helper}>opening...</Text>
          </View>
        ) : null}
        {recording ? (
          <RecordingElapsedTimer
            active={recording}
            style={[styles.createCameraHint, { bottom: controlsBottom + 82 }]}
          />
        ) : cameraHint ? (
          <Text style={[styles.createCameraHint, { bottom: controlsBottom + 82 }]}>{cameraHint}</Text>
        ) : null}
        {cameraFilterPickerMounted ? (
          <View style={styles.createCameraFilterSheetWrap} pointerEvents="box-none">
            {cameraFiltersOpen ? (
              <Pressable style={styles.createCameraFilterDismiss} onPress={() => setCameraFiltersOpen(false)} />
            ) : null}
            <View
              pointerEvents="box-none"
              style={[styles.createCameraFilterBand, { height: feedViewport.navBarHeight }]}
            >
              <Animated.View
                pointerEvents={cameraFiltersOpen ? "auto" : "none"}
                style={[
                  styles.createCameraFilterFloat,
                  { bottom: filterRestBottom },
                  { transform: [{ translateY: cameraFilterSlideY }] },
                ]}
              >
                <CreateFilterPickerRow
                  compact
                  selectedFilter={selectedFilter}
                  thumbnailUri={recentVideoThumbnailUri}
                  onSelect={(filter) => {
                    setSelectedFilter(filter);
                  }}
                />
              </Animated.View>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  const slideshowAudioBusy =
    slideshowAudioAttaching ||
    Boolean(slideshowAudio?.uri && !slideshowAudioReady && !slideshowAudioError);

  if (editItems.length > 0 && createStage === "edit") {
    const currentIsVideo = currentEditItem?.kind === "video";
    const feedViewport = getFeedVideoViewport(insets.bottom);
    const editCanvas = getCreateMediaCardRect(insets.top);
    const actionMenuOverlayId = textOverlayActionRenderId ?? textOverlayActionId;
    const actionOverlay = actionMenuOverlayId
      ? textOverlays.find((overlay) => overlay.id === actionMenuOverlayId)
      : null;
    const actionOverlaySize = actionOverlay ? textOverlaySizes[actionOverlay.id] ?? { width: 0, height: 0 } : { width: 0, height: 0 };
    const actionOverlayCenterX = actionOverlay
      ? editCanvas.width * actionOverlay.centerRatio.x
      : 0;
    const actionOverlayBottom = actionOverlay
      ? editCanvas.height * actionOverlay.centerRatio.y + actionOverlaySize.height / 2
      : 0;
    const actionBubbleWidth = 210;
    const actionBubbleLeft = clamp(
      actionOverlayCenterX - actionBubbleWidth / 2,
      12,
      Math.max(12, editCanvas.width - actionBubbleWidth - 12),
    );
    const actionBubbleTop = clamp(
      actionOverlayBottom + 8,
      12,
      Math.max(12, editCanvas.height - 56),
    );
    const actionCaretLeft = clamp(
      actionOverlayCenterX - actionBubbleLeft - 8,
      14,
      actionBubbleWidth - 30,
    );
    const filterRestBottom = getCreateCameraFilterRestBottom(feedViewport.navBarHeight);

    return (
      <View style={styles.createCameraRoot}>
        <View style={styles.createCameraRoot}>
          <View
            style={[styles.createCameraViewport, { bottom: 0 }]}
            onLayout={handleEditViewportLayout}
          >
            <CreateEditSoundtrack
              ref={soundtrackRef}
              uri={slideshowAudio?.uri ?? null}
              playing={
                isFocused &&
                slideshowAudioReady &&
                !slideshowAudioAttaching &&
                Boolean(slideshowAudio?.uri) &&
                audioScrubRatio == null &&
                !editUserPaused
              }
              trimStartRatio={audioTrimStartRatio}
              trimEndRatio={audioTrimEndRatio}
              scrubToRatio={audioScrubRatio}
              resumeSignal={audioTrimResumeSignal}
              loadTimingStartedAt={audioAttachTimingStartedAt}
              onDurationMs={(durationMs) => {
                if (durationMs > 0) setSlideshowAudioDurationMs(durationMs);
              }}
              onPlaybackRatio={setAudioPlaybackRatio}
              onReady={(readyUri) => {
                if (readyUri === slideshowAudio?.uri) {
                  setSlideshowAudioReady(true);
                  setSlideshowAudioError(false);
                }
              }}
              onLoadError={(errorUri) => {
                if (errorUri !== slideshowAudio?.uri) return;
                setSlideshowAudioReady(false);
                setSlideshowAudioError(true);
                setAudioPeaksLoading(false);
              }}
              onLoadingChange={setAudioPlaybackLoading}
            />
            <CreateEditAlbumPager
              items={editItems}
              index={editItemIndex}
              width={editViewportSize.width}
              height={editViewportSize.height}
              cardRect={editCanvas}
              shouldPlay={isFocused}
              paused={editUserPaused}
              muteVideos={
                Boolean(slideshowAudio?.uri) ||
                editItems.filter((item) => item.kind === "video").length > 1
              }
              hideActiveOverlays={editPagerScrolling}
              needsSelfieMirror={needsSelfieMirror}
              trimStartRatio={trimStartRatio}
              trimEndRatio={trimEndRatio}
              scrubToRatio={trimScrubRatio}
              trimPlaybackResumeSignal={trimPlaybackResumeSignal}
              timeUpdateIntervalSec={activeEditTool === "trim" ? 0.05 : 0.25}
              onIndexChange={handleEditItemIndexChange}
              onPageScrollStart={beginEditPagerScroll}
              onPageScrollEnd={endEditPagerScroll}
              onDurationResolved={handleEditVideoDurationResolved}
              onPlaybackStatusUpdate={activeEditTool === "trim" ? handleEditPlaybackStatusUpdate : undefined}
              onMediaPress={handleEditMediaPress}
            />
            {selectedFilter !== "none" && (
              <View
                pointerEvents="none"
                style={[
                  styles.createCameraFilterPreview,
                  getVideoFilterOverlayStyle(selectedFilter),
                  {
                    position: "absolute",
                    left: editCanvas.left,
                    top: editCanvas.top,
                    width: editCanvas.width,
                    height: editCanvas.height,
                    borderRadius: FEED_VIDEO_BOTTOM_CORNER_RADIUS,
                    overflow: "hidden",
                  },
                ]}
              />
            )}
            {editingTextOverlayId ? (
              <Pressable
                style={styles.createEditKeyboardDismissLayer}
                onPress={dismissEditTextKeyboard}
                accessibilityLabel="dismiss keyboard"
              />
            ) : null}
            {textOverlayActionRenderId || textFontPickerOverlayId ? (
              <Pressable
                style={styles.createEditKeyboardDismissLayer}
                onPress={() => {
                  if (textOverlayActionRenderId) closeTextOverlayActions(true);
                  setTextFontPickerOverlayId(null);
                }}
                accessibilityLabel="dismiss text actions"
              />
            ) : null}
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: editCanvas.left,
                top: editCanvas.top,
                width: editCanvas.width,
                height: editCanvas.height,
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.createTextOverlaySnapGuideVertical,
                  { opacity: textOverlayVerticalGuideOpacity },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.createTextOverlaySnapGuideHorizontal,
                  { opacity: textOverlayHorizontalGuideOpacity },
                ]}
              />
              {!editPagerScrolling
                ? textOverlays.map((overlay) => (
                <CreateEditTextOverlayItem
                  key={overlay.id}
                  overlay={overlay}
                  isEditing={editingTextOverlayId === overlay.id}
                  viewportWidth={editCanvas.width}
                  viewportHeight={editCanvas.height}
                  committedSize={textOverlaySizes[overlay.id] ?? { width: 0, height: 0 }}
                  inputRef={textInputRef}
                  onDraftChange={syncEditingTextDraft}
                  onOpenActions={() => openTextOverlayActions(overlay.id)}
                  onEditText={() => startEditingTextOverlay(overlay.id)}
                  onSizeChange={(size) => updateTextOverlaySize(overlay.id, size)}
                  onFontScaleChange={(fontScale) => updateTextOverlayFontScale(overlay.id, fontScale)}
                  onPinchActiveChange={(active) => {
                    textOverlayPinchActiveRef.current = active;
                    if (active) {
                      closeTextOverlayActions(false);
                      setTextFontPickerOverlayId(null);
                      dismissEditTextKeyboard();
                    }
                  }}
                  onPanGesture={(event) => handleTextOverlayPanGesture(overlay.id, event)}
                  onPanStateChange={(event) => handleTextOverlayPanStateChange(overlay.id, event)}
                />
              ))
                : null}
              {actionOverlay && !editPagerScrolling ? (
                <Animated.View
                  pointerEvents={textOverlayActionId ? "box-none" : "none"}
                  style={[
                    styles.createTextOverlayActionMenu,
                    {
                      left: actionBubbleLeft,
                      top: actionBubbleTop,
                      width: actionBubbleWidth,
                      opacity: textOverlayActionOpacity,
                      transform: [
                        { translateY: textOverlayActionTranslateY },
                        { scale: textOverlayActionScale },
                      ],
                    },
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={[styles.createTextOverlayActionCaret, { left: actionCaretLeft }]}
                  />
                  <View style={styles.createTextOverlayActionBubble}>
                    <Pressable
                      style={styles.createTextOverlayActionButton}
                      onPress={() => openTextFontPicker(actionOverlay.id)}
                      accessibilityLabel="change text font"
                    >
                      <Text style={styles.createTextOverlayActionButtonText}>font</Text>
                    </Pressable>
                    <Pressable
                      style={styles.createTextOverlayActionEffectButton}
                      onPress={() => cycleTextOverlayEffect(actionOverlay.id)}
                      accessibilityLabel="cycle text style"
                    >
                      <VideoTextOverlayGlyph
                        text="A"
                        effectId={actionOverlay.effectId}
                        density="menu"
                        textStyle={styles.createTextOverlayActionEffectGlyph}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.createTextOverlayActionButton}
                      onPress={() => deleteTextOverlay(actionOverlay.id)}
                      accessibilityLabel="delete text overlay"
                    >
                      <Text style={styles.createTextOverlayActionDeleteText}>delete</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ) : null}
            </View>
          </View>

          {audioPickerOpen ? (
            <Pressable
              style={styles.createAudioPickerDismiss}
              onPress={() => {
                setAudioPickerOpen(false);
                if (!slideshowAudio?.uri && !slideshowAudioAttaching) {
                  setActiveEditTool(null);
                }
              }}
              accessibilityLabel="dismiss audio options"
            />
          ) : null}

          <View style={[styles.createCameraTopBar, { top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET }]}>
            <Pressable
              onPress={confirmDiscardCreateDraft}
              style={styles.createCameraControlButton}
              accessibilityLabel="discard video"
            >
              <Text style={styles.createCameraCloseIconText}>×</Text>
            </Pressable>
          </View>
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET,
              left: 0,
              right: 0,
              zIndex: 6,
              alignItems: "center",
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Pressable
                onPress={toggleAudioEditor}
                hitSlop={8}
                style={[
                  styles.createEditAudioButton,
                  slideshowAudio?.uri ||
                  slideshowAudioAttaching ||
                  audioPickerOpen ||
                  activeEditTool === "audio"
                    ? styles.createEditAudioButtonActive
                    : null,
                ]}
                accessibilityLabel={
                  slideshowAudioAttaching
                    ? "audio still loading"
                    : activeEditTool === "audio"
                      ? slideshowAudio?.uri
                        ? "close audio editor"
                        : "close audio options"
                      : slideshowAudio?.uri
                        ? "edit audio"
                        : "add audio"
                }
              >
                {slideshowAudio?.uri ? (
                  <CreateEditAudioWaveformIcon active={activeEditTool === "audio"} />
                ) : (
                  <CreateEditAudioIcon active={activeEditTool === "audio"} />
                )}
              </Pressable>
              {audioPickerOpen ? (
                <View style={styles.createAudioDropdown}>
                  <Pressable
                    style={styles.createAudioDropdownItem}
                    onPress={() => void pickSlideshowAudioFromFiles()}
                    accessibilityLabel="choose audio from files"
                  >
                    <Text style={styles.createAudioDropdownItemText}>from files</Text>
                  </Pressable>
                  <Pressable
                    style={styles.createAudioDropdownItem}
                    onPress={() => void pickSlideshowAudioFromVideo()}
                    accessibilityLabel="choose audio from camera roll"
                  >
                    <Text style={styles.createAudioDropdownItemText}>from camera roll</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.createCameraSideRail, { top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET }]}>
            {currentIsVideo ? (
              <Pressable
                style={styles.createCameraControlButton}
                onPress={() => toggleEditTool("trim")}
                accessibilityLabel="trim video"
              >
                <CreateEditTrimIcon active={activeEditTool === "trim"} />
              </Pressable>
            ) : null}
            <Pressable
              style={styles.createCameraControlButton}
              onPress={() => toggleEditTool("text")}
              accessibilityLabel="add text overlay"
            >
              <CreateEditTextIcon active={activeEditTool === "text"} />
            </Pressable>
            <Pressable
              style={styles.createCameraControlButton}
              onPress={() => toggleEditTool("filters")}
              accessibilityLabel="open filters"
            >
              <CreateCameraFilterIcon active={activeEditTool === "filters" || selectedFilter !== "none"} />
            </Pressable>
          </View>

          <Animated.View
            pointerEvents={textFontPickerOverlayId ? "none" : "box-none"}
            style={[
              styles.createEditNextBand,
              {
                height: feedViewport.navBarHeight,
                opacity: editNextButtonOpacity,
                transform: [{ translateY: editNextButtonSlideY }],
                zIndex:
                  activeEditTool === "audio" &&
                  (slideshowAudio?.uri || slideshowAudioAttaching)
                    ? 6
                    : 5,
              },
            ]}
          >
            {editingTextOverlayId ? (
              <Pressable
                style={styles.createEditKeyboardDismissBand}
                onPress={dismissEditTextKeyboard}
                accessibilityLabel="dismiss keyboard"
              />
            ) : null}
            {activeEditTool === "audio" &&
            (slideshowAudio?.uri || slideshowAudioAttaching) ? (
              <CreateAudioTrimPanel
                seed={slideshowAudio?.uri ?? "loading"}
                empty={!slideshowAudio?.uri && !slideshowAudioAttaching}
                loading={slideshowAudioBusy}
                peaksLoading={
                  audioPeaksLoading && slideshowAudioReady && !slideshowAudioError
                }
                peaks={audioPeaks}
                playbackLoading={audioPlaybackLoading}
                durationLabel={getAudioDurationLabel()}
                trimStartRatio={audioTrimStartRatio}
                trimEndRatio={audioTrimEndRatio}
                playbackRatio={audioPlaybackRatio}
                scrubRatio={audioScrubRatio}
                onLayoutWidth={setAudioTimelineWidth}
                onTrimHandleGesture={applyAudioTrimHandleDrag}
                onTrimHandleStateChange={handleAudioTrimHandleStateChange}
                onChangeAudio={() => setAudioPickerOpen(true)}
              />
            ) : (
              <Pressable
                onPress={() => {
                  void goToDetailsStage();
                }}
                style={styles.createEditNextPill}
                accessibilityLabel="continue to post details"
              >
                <Text style={styles.createEditNextText}>next</Text>
              </Pressable>
            )}
          </Animated.View>

          {audioLoadingToastVisible ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.createAudioLoadingToast,
                {
                  top:
                    insets.top +
                    CREATE_CAMERA_TOP_CONTROLS_OFFSET +
                    CREATE_CAMERA_CONTROL_BUTTON_SIZE +
                    16,
                  opacity: audioLoadingToastOpacity,
                },
              ]}
            >
              <Text style={styles.createAudioLoadingToastText}>{audioToastMessage}</Text>
            </Animated.View>
          ) : null}

          {activeEditTool === "trim" && currentIsVideo ? (
            <View
              style={[styles.createTrimToolPanel, { bottom: feedViewport.navBarHeight }]}
              pointerEvents="box-none"
            >
              <View style={styles.createTrimToolPanelContent}>
                <View style={styles.createTrimHeader}>
                  <Text style={styles.sectionLabel}>trim</Text>
                  <Text style={styles.createTrimDuration}>{getTrimDurationLabel()}</Text>
                </View>
                <CreateTrimFilmstrip
                  frames={trimFilmstripFrames}
                  loading={loadingTrimFilmstrip}
                  trimStartRatio={trimStartRatio}
                  trimEndRatio={trimEndRatio}
                  playbackRatio={editPlaybackRatio}
                  scrubRatio={trimScrubRatio}
                  onLayoutWidth={setTimelineWidth}
                  onTrimHandleGesture={applyTrimHandleDrag}
                  onTrimHandleStateChange={handleTrimHandleStateChange}
                />
              </View>
            </View>
          ) : null}

          {editFilterPickerMounted ? (
            <View
              pointerEvents="box-none"
              style={[styles.createCameraFilterBand, { height: feedViewport.navBarHeight }]}
            >
              <Animated.View
                pointerEvents={activeEditTool === "filters" ? "auto" : "none"}
                style={[
                  styles.createCameraFilterFloat,
                  { bottom: filterRestBottom },
                  { transform: [{ translateY: editFilterSlideY }] },
                ]}
              >
                <CreateFilterPickerRow
                  compact
                  selectedFilter={selectedFilter}
                  thumbnailUri={selectedVideoThumbnailUri ?? currentEditItem?.uri ?? null}
                  textOverlays={textOverlays}
                  onSelect={setSelectedFilter}
                />
              </Animated.View>
            </View>
          ) : null}

          {textFontPickerOverlayId ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.createCameraFilterBand,
                styles.createTextFontPickerBand,
                { height: feedViewport.navBarHeight },
              ]}
            >
              <CreateTextFontPickerRow
                selectedFontId={
                  textOverlays.find((overlay) => overlay.id === textFontPickerOverlayId)?.fontId ??
                  TEXT_OVERLAY_DEFAULT_FONT_ID
                }
                onSelect={(fontId) => updateTextOverlayFontId(textFontPickerOverlayId, fontId)}
              />
            </View>
          ) : null}
        </View>

        <ConfirmModal
          visible={discardConfirmOpen}
          title="discard?"
          message="your post and edits will be lost."
          confirmLabel="discard"
          onCancel={dismissDiscardCreateDraft}
          onConfirm={discardCreateDraft}
        />
      </View>
    );
  }

  const imageOnlyAlbum = editItems.length > 0 && editItems.every((item) => item.kind === "image");
  const soundtrackRequired = albumRequiresSoundtrack(editItems);
  const postedVideoItem =
    (asset
      ? editItems.find((item) => item.kind === "video" && item.uri === asset.uri)
      : null) ?? editItems.find((item) => item.kind === "video");
  const postedPreviewOverlays = postedVideoItem?.textOverlays ?? textOverlays;
  const lookingForTagFields = lookingForCollaborators ? (
    <LookingForTagFields
      onInputFocus={handleTagFieldFocus}
      selectedRoles={selectedLookingForRoles}
      selectedGenres={selectedLookingForGenres}
      onToggleRole={(role) =>
        toggleLimitedTag(
          role,
          selectedLookingForRoles,
          setSelectedLookingForRoles,
          "role",
          MAX_VIDEO_ROLES,
        )
      }
      onToggleGenre={(genre) =>
        toggleLimitedTag(
          genre,
          selectedLookingForGenres,
          setSelectedLookingForGenres,
          "genre",
          MAX_VIDEO_GENRES,
        )
      }
    />
  ) : null;

  const captionField = (
    <View style={styles.createDetailsCaptionColumn}>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="write a caption"
        placeholderTextColor="#71717a"
        style={styles.createDetailsCaptionInput}
        multiline
        maxLength={200}
        underlineColorAndroid="transparent"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={detailsScrollRef}
        contentContainerStyle={[styles.screenContent, styles.createDetailsScrollContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={(event) => {
          detailsScrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.headerRow}>
          <Text style={styles.logoSmall}>jam.</Text>
          <Pressable onPress={goBackToEditStage} hitSlop={12} accessibilityLabel="back">
            <Text style={styles.closeIconText}>×</Text>
          </Pressable>
        </View>
        {imageOnlyAlbum ? (
          <>
            <CreateEditSoundtrack
              uri={slideshowAudio?.uri ?? null}
              playing={
                isFocused &&
                !postPreviewOpen &&
                slideshowAudioReady &&
                !slideshowAudioAttaching &&
                Boolean(slideshowAudio?.uri)
              }
              trimStartRatio={audioTrimStartRatio}
              trimEndRatio={audioTrimEndRatio}
              loadTimingStartedAt={audioAttachTimingStartedAt}
              onDurationMs={(durationMs) => {
                if (durationMs > 0) setSlideshowAudioDurationMs(durationMs);
              }}
              onReady={(readyUri) => {
                if (readyUri === slideshowAudio?.uri) {
                  setSlideshowAudioReady(true);
                  setSlideshowAudioError(false);
                }
              }}
              onLoadError={(errorUri) => {
                if (errorUri !== slideshowAudio?.uri) return;
                setSlideshowAudioReady(false);
                setSlideshowAudioError(true);
                setAudioPeaksLoading(false);
              }}
            />
            <Pressable
              onPress={toggleLookingForCollaborators}
              style={styles.createLookingForToggle}
              accessibilityRole="switch"
              accessibilityState={{ checked: lookingForCollaborators }}
              accessibilityLabel="looking for collaborators"
            >
              <LookingForIcon active={lookingForCollaborators} size={28} />
              <View style={styles.createLookingForToggleCopy}>
                <Text style={styles.createLookingForToggleTitle}>looking for?</Text>
                <Text style={styles.createLookingForToggleHelper}>
                  tag your post to show you're looking to collab
                </Text>
              </View>
            </Pressable>
            {lookingForTagFields}
            <View style={styles.createDetailsComposer}>
              <View style={styles.createCaptionHairline} />
              <View style={styles.createDetailsComposerRow}>
              {captionField}
              <Pressable
                onPress={() => setPostPreviewOpen(true)}
                style={styles.createDetailsVideoTap}
                accessibilityLabel="preview post"
              >
                <Image
                  source={{ uri: slideshowImages[0]?.uri }}
                  style={styles.createDetailsVideoTapImage as ImageStyle}
                  resizeMode="contain"
                />
                <View style={styles.createDetailsVideoTapBadge}>
                  <Text style={styles.createDetailsVideoTapBadgeText}>
                    {slideshowImages.length} photo{slideshowImages.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </Pressable>
              </View>
            </View>
            {slideshowAudioLabel ? (
              <Text style={styles.helper}>audio · {slideshowAudioLabel}</Text>
            ) : null}
          </>
        ) : asset ? (
          <>
            <Pressable
              onPress={toggleLookingForCollaborators}
              style={styles.createLookingForToggle}
              accessibilityRole="switch"
              accessibilityState={{ checked: lookingForCollaborators }}
              accessibilityLabel="looking for collaborators"
            >
              <LookingForIcon active={lookingForCollaborators} size={28} />
              <View style={styles.createLookingForToggleCopy}>
                <Text style={styles.createLookingForToggleTitle}>looking for?</Text>
                <Text style={styles.createLookingForToggleHelper}>
                  tag your video to show you're looking to collab
                </Text>
              </View>
            </Pressable>
            {lookingForTagFields}
            <View style={styles.createDetailsComposer}>
              <View style={styles.createCaptionHairline} />
              <View style={styles.createDetailsComposerRow}>
              {captionField}
              <Pressable
                onPress={() => {
                  if (exportBakeStatus === "baking") return;
                  setPostPreviewOpen(true);
                }}
                style={styles.createDetailsVideoTap}
                accessibilityLabel="preview post"
              >
                {exportBakeStatus === "baking" ? (
                  <View style={styles.createDetailsVideoTapFallback}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : selectedVideoThumbnailUri ? (
                  <Image
                    source={{ uri: selectedVideoThumbnailUri }}
                    style={styles.createDetailsVideoTapImage as ImageStyle}
                    resizeMode={
                      exportBakeStatus === "ready"
                        ? "cover"
                        : contentFitForVideoSize(asset.width, asset.height) === "contain"
                          ? "contain"
                          : "cover"
                    }
                  />
                ) : (
                  <View style={styles.createDetailsVideoTapFallback} />
                )}
                {exportBakeStatus !== "ready" ? (
                  <VideoPresentationOverlays
                    filter={selectedFilter}
                    textOverlays={postedPreviewOverlays}
                    density="thumb"
                  />
                ) : null}
                <View style={styles.createDetailsVideoTapBadge}>
                  <Text style={styles.createDetailsVideoTapBadgeText}>
                    {exportBakeStatus === "baking" ? "rendering" : "preview"}
                  </Text>
                </View>
              </Pressable>
              </View>
            </View>
            {exportBakeStatus === "baking" ? (
              <View style={styles.createThumbnailLoader}>
                <ActivityIndicator color={getActivityIndicatorColor()} />
                <Text style={styles.helper}>rendering your edits…</Text>
              </View>
            ) : null}
          </>
        ) : null}
        <LinedTagField
          placeholder="role"
          options={creatorRoles}
          selected={selectedRoles}
          onInputFocus={handleTagFieldFocus}
          onToggle={(role) => toggleLimitedTag(role, selectedRoles, setSelectedRoles, "role", MAX_VIDEO_ROLES)}
        />
        <LinedTagField
          placeholder="genre"
          options={musicGenres}
          selected={selectedGenres}
          onInputFocus={handleTagFieldFocus}
          onToggle={(genre) => toggleLimitedTag(genre, selectedGenres, setSelectedGenres, "genre", MAX_VIDEO_GENRES)}
        />
      </ScrollView>
      <View
        style={styles.createDetailsPostBar}
        onLayout={(event) => {
          detailsPostBarHeightRef.current = event.nativeEvent.layout.height;
        }}
      >
        <PrimaryButton
          style={styles.createDetailsPostButton}
          label={
            imageOnlyAlbum
              ? "post"
              : exportBakeStatus === "baking"
                ? "rendering..."
                : "post"
          }
          disabled={
            (soundtrackRequired && !slideshowAudio?.uri) ||
            (selectedRoles.length === 0 && selectedGenres.length === 0) ||
            (!imageOnlyAlbum && (!asset || exportBakeStatus === "baking"))
          }
          onPress={() => {
            void post();
          }}
        />
      </View>
      <CreatePostPreviewModal
        visible={postPreviewOpen}
        onClose={() => setPostPreviewOpen(false)}
        videoUri={imageOnlyAlbum ? null : exportBakedAsset?.uri ?? asset?.uri ?? null}
        videoWidth={imageOnlyAlbum ? null : exportBakedAsset?.width ?? asset?.width ?? null}
        videoHeight={imageOnlyAlbum ? null : exportBakedAsset?.height ?? asset?.height ?? null}
        slideshowImageUris={imageOnlyAlbum ? slideshowImages.map((image) => image.uri) : []}
        audioUri={imageOnlyAlbum ? slideshowAudio?.uri ?? null : null}
        audioTrimStartRatio={audioTrimStartRatio}
        audioTrimEndRatio={audioTrimEndRatio}
        filter={imageOnlyAlbum || exportBakeStatus === "ready" ? "none" : selectedFilter}
        textOverlays={
          imageOnlyAlbum || exportBakeStatus === "ready"
            ? []
            : postedPreviewOverlays.filter((overlay) => overlay.text.trim())
        }
        caption={caption}
        lookingFor={lookingForCollaborators}
        lookingForRoles={lookingForCollaborators ? selectedLookingForRoles : []}
        lookingForGenres={lookingForCollaborators ? selectedLookingForGenres : []}
        profile={profile}
        roles={selectedRoles}
        genres={selectedGenres}
        trimStartRatio={exportBakeStatus === "ready" ? 0 : trimStartRatio}
        trimEndRatio={exportBakeStatus === "ready" ? 1 : trimEndRatio}
        thumbnailFrames={imageOnlyAlbum ? [] : thumbnailFrameOptions}
        selectedThumbnailTimeMs={selectedThumbnailTimeMs}
        loadingThumbnailFrames={imageOnlyAlbum ? false : loadingThumbnailFrames}
        onSelectThumbnail={imageOnlyAlbum ? undefined : (timeMs, uri) => selectThumbnailTime(timeMs, uri)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
