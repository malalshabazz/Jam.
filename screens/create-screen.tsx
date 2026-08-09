import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
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
import { JamVideoView, type JamVideoPlaybackStatus } from "@/components/video/jam-video-view";
import {
  contentFitForVideoSize,
  ensureVideoAspectCached,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromSource,
  imageResizeModeForVideoSize,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SectionLabel } from "@/components/ui/section-label";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import {
  CreateCameraFilterIcon,
  CreateCameraFlashIcon,
  CreateCameraFlipIcon,
  CreateCameraTimerIcon,
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
  getFeedVideoViewport,
  snapTextOverlayCenterRatio,
} from "@/components/create/layout";
import { CreatePostPreviewModal } from "@/components/create/post-preview-modal";
import { RecordButtonCore, RecordProgressRing, RecordingElapsedTimer } from "@/components/create/record-controls";
import { TagPicker } from "@/components/create/tag-picker";
import { CreateEditTextOverlayItem } from "@/components/create/text-overlay-editors";
import { CreateTrimFilmstrip } from "@/components/create/trim-filmstrip";
import { VideoThumbnailFilmstrip } from "@/components/create/video-thumbnail-filmstrip";
import { waitMs } from "@/lib/animation";
import {
  bakeVideoPresentation,
  isVideoBakeAvailable,
  needsPresentationBake,
  normalizeCameraRecording,
} from "@/lib/bake-video-presentation";
import { clamp, formatClipDuration, getUniqueStrings } from "@/lib/format";
import { getVideoUploadErrorDetails, logVideoUploadStep, type NativeVideoAsset } from "@/lib/native-cloudflare";
import { fetchProfile, type Profile } from "@/lib/native-social-data";
import { getNavBarHeight } from "@/lib/nav-bar";
import { enqueuePendingVideoUpload } from "@/lib/pending-video-uploads";
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
  CREATE_CAMERA_RECORD_BUTTON_BORDER_WIDTH,
  CREATE_CAMERA_RECORD_BUTTON_SIZE,
  CREATE_CAMERA_TOP_CONTROLS_OFFSET,
  CREATE_DETAILS_PREVIEW_HEIGHT,
  CREATE_DETAILS_PREVIEW_WIDTH,
  CREATE_RECORDING_TIMER_OPTIONS,
  CREATE_THUMBNAIL_FRAME_COUNT,
  CREATE_TRIM_FILMSTRIP_FRAME_COUNT,
  MAX_VIDEO_GENRES,
  MAX_VIDEO_ROLES,
  TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS,
  TEXT_OVERLAY_CENTER_GUIDE_FADE_MS,
  TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";
import type { CreateStage, CreateTextOverlayItem, RecordingTimerSeconds, VideoFilter } from "@/types/app";

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
  const [asset, setAsset] = useState<NativeVideoAsset | null>(null);
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
  const [activeEditTool, setActiveEditTool] = useState<"trim" | "filters" | "text" | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter>("none");
  const [lookingForCollaborators, setLookingForCollaborators] = useState(false);
  const [textOverlays, setTextOverlays] = useState<CreateTextOverlayItem[]>([]);
  const [editingTextOverlayId, setEditingTextOverlayId] = useState<string | null>(null);
  const [textOverlayActionId, setTextOverlayActionId] = useState<string | null>(null);
  const [textOverlayActionRenderId, setTextOverlayActionRenderId] = useState<string | null>(null);
  const [textFontPickerOverlayId, setTextFontPickerOverlayId] = useState<string | null>(null);
  const [textOverlaySizes, setTextOverlaySizes] = useState<Record<string, { width: number; height: number }>>({});
  const [editViewportSize, setEditViewportSize] = useState({
    width: viewportWidth,
    height: viewportHeight - getNavBarHeight(0),
  });
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
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
  const textOverlayVerticalGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textOverlayHorizontalGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textOverlayVerticalGuideVisibleRef = useRef(false);
  const textOverlayHorizontalGuideVisibleRef = useRef(false);
  const pinchZoomFrameRef = useRef<number | null>(null);
  const trimDragStartRef = useRef({ start: 0, end: 1 });
  const uploadSessionRef = useRef(0);
  const thumbnailLoadSessionRef = useRef(0);
  const trimFilmstripLoadSessionRef = useRef(0);
  const selectedVideoDurationMsRef = useRef(0);
  const textOverlaysRef = useRef<CreateTextOverlayItem[]>([]);
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
    if (!isFocused) return;
    setCameraPreviewActive(createStage === "camera");
  }, [createStage, isFocused]);

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

  useEffect(() => {
    textOverlaysRef.current = textOverlays;
  }, [textOverlays]);

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
    setAsset(null);
    setCaption("");
    setSelectedRoles([]);
    setSelectedGenres([]);
    setSelectedVideoDurationMs(0);
    setSelectedVideoThumbnailUri(null);
    setSelectedThumbnailTimeMs(0);
    setThumbnailFrameOptions([]);
    setLoadingThumbnailFrames(false);
    thumbnailLoadSessionRef.current += 1;
    setTrimStartRatio(0);
    setTrimEndRatio(1);
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
    setTextOverlays([]);
    setEditingTextOverlayId(null);
    setTextOverlayActionId(null);
    setTextOverlayActionRenderId(null);
    setTextFontPickerOverlayId(null);
    setTextOverlaySizes({});
    hideTextOverlaySnapGuides(true);
    setRecording(false);
    setPostPreviewOpen(false);
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

  async function pickVideo(source: "library") {
    logVideoUploadStep("picker permission request start", { source });
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    logVideoUploadStep("picker permission result", {
      source,
      granted: permission.granted,
      status: permission.status,
      canAskAgain: permission.canAskAgain,
    });
    if (!permission.granted) {
      Alert.alert("permission needed", "camera and media permissions are needed to post.");
      return;
    }

    logVideoUploadStep("picker launch start", { source, maxDuration });
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"] as ImagePicker.MediaType[],
        videoMaxDuration: maxDuration,
        quality: 1,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
      });
    } catch (err) {
      logVideoUploadStep("picker launch failed", {
        source,
        ...getVideoUploadErrorDetails(err),
      });
      throw err;
    }

    logVideoUploadStep("picker launch result", {
      source,
      canceled: result.canceled,
      assetCount: result.canceled ? 0 : result.assets.length,
    });
    if (result.canceled) {
      logVideoUploadStep("picker canceled", { source });
      return;
    }
    const picked = result.assets[0];
    if (!picked?.uri) {
      logVideoUploadStep("picker missing asset uri", { source });
      return;
    }

    const nextAsset: NativeVideoAsset = {
      uri: picked.uri,
      fileName: picked.fileName ?? picked.uri.split("/").pop() ?? "jam-video.mp4",
      mimeType: picked.mimeType ?? "video/mp4",
      fileSize: picked.fileSize ?? null,
      width: picked.width ?? null,
      height: picked.height ?? null,
    };
    logVideoUploadStep("picker asset selected", {
      source,
      fileName: nextAsset.fileName,
      fileSize: nextAsset.fileSize,
      mimeType: nextAsset.mimeType,
      uriScheme: nextAsset.uri.split(":")[0] || "unknown",
      duration: picked.duration ?? null,
      width: nextAsset.width ?? null,
      height: nextAsset.height ?? null,
    });
    await startVideoUpload(nextAsset, picked.duration ?? 0);
    void loadRecentVideoThumbnail();
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

  function handleRecordPressIn() {
    if (!cameraPermissionGranted || !microphonePermissionGranted || !cameraReady) return;
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
    const session = thumbnailLoadSessionRef.current + 1;
    thumbnailLoadSessionRef.current = session;
    setLoadingThumbnailFrames(true);
    setThumbnailFrameOptions([]);

    const frames = await extractVideoThumbnailFrames(
      videoUri,
      durationMs,
      CREATE_THUMBNAIL_FRAME_COUNT,
      () => thumbnailLoadSessionRef.current === session,
    );

    if (thumbnailLoadSessionRef.current !== session) return;

    setThumbnailFrameOptions(frames);
    if (frames.length > 0) {
      setSelectedThumbnailTimeMs(frames[0].timeMs);
      setSelectedVideoThumbnailUri(frames[0].uri);
    } else {
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

  function startVideoUpload(
    nextAsset: NativeVideoAsset,
    durationMs = 0,
    options?: { selfieMirrorPending?: boolean },
  ) {
    uploadSessionRef.current += 1;
    setAsset(nextAsset);
    setSelectedVideoDurationMs(durationMs);
    setNeedsSelfieMirror(Boolean(options?.selfieMirrorPending));
    setTrimStartRatio(0);
    setTrimEndRatio(1);
    setActiveEditTool(null);
    setSelectedFilter("none");
    setTextOverlays([]);
    setEditingTextOverlayId(null);
    setTextOverlayActionId(null);
    setTextOverlayActionRenderId(null);
    setTextFontPickerOverlayId(null);
    setTextOverlaySizes({});
    hideTextOverlaySnapGuides(true);
    setCreateStage("edit");
    void prepareVideoThumbnail(nextAsset.uri);
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

  function toggleEditTool(tool: "trim" | "filters" | "text") {
    if (tool === "text") {
      addNewTextOverlay();
      return;
    }

    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setTextFontPickerOverlayId(null);
    setActiveEditTool((current) => (current === tool ? null : tool));
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
    if (!editViewportSize.width || !editViewportSize.height) return;

    const start = textOverlayDragStartRatioRef.current;
    const clampedRatio = clampTextOverlayCenterRatio({
      x: start.x + translationX / editViewportSize.width,
      y: start.y + translationY / editViewportSize.height,
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
    };
  }, [textOverlayHorizontalGuideOpacity, textOverlayVerticalGuideOpacity]);

  function goBackToEditStage() {
    setPostPreviewOpen(false);
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

  async function goToDetailsStage() {
    dismissEditTextKeyboard();
    closeTextOverlayActions(false);
    setActiveEditTool(null);

    const cleanedOverlays = textOverlays.filter((overlay) => overlay.text.trim());
    setTextOverlays(cleanedOverlays);

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
    setSelectedVideoThumbnailUri(null);
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

  function beginTrimDrag() {
    trimDragStartRef.current = {
      start: trimStartRatio,
      end: trimEndRatio,
    };
  }

  function applyTrimHandleDrag(handle: "start" | "end", translationX: number) {
    if (!timelineWidth) return;

    const delta = translationX / timelineWidth;
    const minGap = 0.08;
    const dragStart = trimDragStartRef.current;

    if (handle === "start") {
      const ratio = clamp(dragStart.start + delta, 0, Math.max(0, dragStart.end - minGap));
      setTrimStartRatio(ratio);
      setTrimScrubRatio(ratio);
      return;
    }

    const ratio = clamp(dragStart.end + delta, Math.min(1, dragStart.start + minGap), 1);
    setTrimEndRatio(ratio);
    setTrimScrubRatio(ratio);
  }

  function finishTrimHandleDrag(handle: "start" | "end", translationX: number) {
    if (!timelineWidth) {
      setTrimScrubRatio(null);
      setEditPlaybackRatio(trimStartRatio);
      setTrimPlaybackResumeSignal((token) => token + 1);
      return;
    }

    const delta = translationX / timelineWidth;
    const minGap = 0.08;
    const dragStart = trimDragStartRef.current;
    const nextStart =
      handle === "start"
        ? clamp(dragStart.start + delta, 0, Math.max(0, dragStart.end - minGap))
        : dragStart.start;
    const nextEnd =
      handle === "end"
        ? clamp(dragStart.end + delta, Math.min(1, dragStart.start + minGap), 1)
        : dragStart.end;

    trimDragStartRef.current = { start: nextStart, end: nextEnd };
    setTrimStartRatio(nextStart);
    setTrimEndRatio(nextEnd);
    setTrimScrubRatio(null);
    setEditPlaybackRatio(nextStart);
    setTrimPlaybackResumeSignal((token) => token + 1);
  }

  function handleTrimHandleStateChange(handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) {
    const { state, translationX } = event.nativeEvent;

    if (state === State.BEGAN) {
      beginTrimDrag();
      setTrimScrubRatio(handle === "start" ? trimStartRatio : trimEndRatio);
      return;
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      finishTrimHandleDrag(handle, translationX);
    }
  }

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

  async function post() {
    const postRoles = getUniqueStrings(selectedRoles).slice(0, MAX_VIDEO_ROLES);
    const postGenres = getUniqueStrings(selectedGenres).slice(0, MAX_VIDEO_GENRES);
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
    const postedTextOverlays = useBakedExport
      ? []
      : textOverlays
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
    const cameraControlsDisabled = recording || recordingCountdown !== null || !cameraPermissionReady || !cameraReady;
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

    return (
      <View style={styles.createCameraRoot}>
        <View
          style={[styles.createCameraViewport, { bottom: feedViewport.navBarHeight }]}
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
          <Pressable onPress={closeCreateScreen} style={styles.createCameraControlButton} accessibilityLabel="close create screen">
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
          <Animated.View style={{ transform: [{ scale: recordPressScale }] }}>
            <Pressable
              onPress={() => {
                void handleRecordPress();
              }}
              onPressIn={handleRecordPressIn}
              onPressOut={handleRecordPressOut}
              disabled={!cameraPermissionReady || !cameraReady}
              style={[
                styles.createRecordButton,
                (!cameraPermissionReady || !cameraReady) && styles.disabled,
              ]}
              accessibilityLabel={
                recording
                  ? "stop recording"
                  : recordingCountdown !== null
                    ? "cancel countdown"
                    : "start recording"
              }
            >
              <RecordButtonCore active={recording || recordingCountdown !== null} />
              <RecordProgressRing
                active={recording}
                durationSeconds={maxDuration}
                // Sized so the stroke sits exactly on top of the button's 4px white border.
                size={79}
                strokeWidth={5}
                centerOffset={
                  (CREATE_CAMERA_RECORD_BUTTON_SIZE -
                    2 * CREATE_CAMERA_RECORD_BUTTON_BORDER_WIDTH -
                    79) /
                  2
                }
              />
            </Pressable>
          </Animated.View>
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
            onPress={() => void pickVideo("library")}
            style={StyleSheet.absoluteFill}
            disabled={recording || recordingCountdown !== null || cameraFiltersOpen}
            accessibilityLabel="choose video from camera roll"
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

  if (asset && createStage === "edit") {
    const feedViewport = getFeedVideoViewport(insets.bottom);
    const actionMenuOverlayId = textOverlayActionRenderId ?? textOverlayActionId;
    const actionOverlay = actionMenuOverlayId
      ? textOverlays.find((overlay) => overlay.id === actionMenuOverlayId)
      : null;
    const actionOverlaySize = actionOverlay ? textOverlaySizes[actionOverlay.id] ?? { width: 0, height: 0 } : { width: 0, height: 0 };
    const actionOverlayCenterX = actionOverlay
      ? editViewportSize.width * actionOverlay.centerRatio.x
      : 0;
    const actionOverlayBottom = actionOverlay
      ? editViewportSize.height * actionOverlay.centerRatio.y + actionOverlaySize.height / 2
      : 0;
    const actionBubbleWidth = 210;
    const actionBubbleLeft = clamp(
      actionOverlayCenterX - actionBubbleWidth / 2,
      12,
      Math.max(12, editViewportSize.width - actionBubbleWidth - 12),
    );
    const actionBubbleTop = clamp(
      actionOverlayBottom + 8,
      12,
      Math.max(12, editViewportSize.height - 56),
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
            style={[styles.createCameraViewport, { bottom: feedViewport.navBarHeight }]}
            onLayout={handleEditViewportLayout}
          >
            <JamVideoView
              source={asset.uri}
              style={[
                StyleSheet.absoluteFill,
                // Fallback if post-record mirror bake failed — keep edit preview selfie-flipped.
                needsSelfieMirror ? { transform: [{ scaleX: -1 }] } : null,
              ]}
              knownWidth={asset.width}
              knownHeight={asset.height}
              shouldPlay
              isLooping
              isMuted={false}
              volume={1}
              trimStartRatio={trimStartRatio}
              trimEndRatio={trimEndRatio}
              scrubToRatio={trimScrubRatio}
              trimPlaybackResumeSignal={trimPlaybackResumeSignal}
              timeUpdateIntervalSec={activeEditTool === "trim" ? 0.05 : 0.25}
              onDurationResolved={handleEditVideoDurationResolved}
              onPlaybackStatusUpdate={activeEditTool === "trim" ? handleEditPlaybackStatusUpdate : undefined}
            />
            {selectedFilter !== "none" && (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, styles.createCameraFilterPreview, getVideoFilterOverlayStyle(selectedFilter)]}
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
            {textOverlays.map((overlay) => (
              <CreateEditTextOverlayItem
                key={overlay.id}
                overlay={overlay}
                isEditing={editingTextOverlayId === overlay.id}
                viewportWidth={editViewportSize.width}
                viewportHeight={editViewportSize.height}
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
            ))}
            {actionOverlay ? (
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

          <View style={[styles.createCameraTopBar, { top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET }]}>
            <Pressable
              onPress={confirmDiscardCreateDraft}
              style={styles.createCameraControlButton}
              accessibilityLabel="discard video"
            >
              <Text style={styles.createCameraCloseIconText}>×</Text>
            </Pressable>
          </View>

          <View style={[styles.createCameraSideRail, { top: insets.top + CREATE_CAMERA_TOP_CONTROLS_OFFSET }]}>
            <Pressable
              style={styles.createCameraControlButton}
              onPress={() => toggleEditTool("trim")}
              accessibilityLabel="trim video"
            >
              <CreateEditTrimIcon active={activeEditTool === "trim"} />
            </Pressable>
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
            <Pressable
              onPress={() => {
                void goToDetailsStage();
              }}
              style={styles.createEditNextPill}
              accessibilityLabel="continue to post details"
            >
              <Text style={styles.createEditNextText}>next</Text>
            </Pressable>
          </Animated.View>

          {activeEditTool === "trim" ? (
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
                  thumbnailUri={selectedVideoThumbnailUri}
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
          message="your video and edits will be lost."
          confirmLabel="discard"
          onCancel={dismissDiscardCreateDraft}
          onConfirm={discardCreateDraft}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.logoSmall}>jam.</Text>
          <Pressable onPress={goBackToEditStage} style={styles.iconCircle} accessibilityLabel="back to edit">
            <Text style={styles.closeIconText}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.h1}>create</Text>
        {asset && (
          <>
            <Pressable
              onPress={() => setLookingForCollaborators((current) => !current)}
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
            <View style={styles.createDetailsComposerRow}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="write a caption..."
                placeholderTextColor="#71717a"
                style={styles.createDetailsCaptionInput}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
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
                    textOverlays={textOverlays}
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
            {exportBakeStatus === "baking" ? (
              <View style={styles.createThumbnailLoader}>
                <ActivityIndicator color={getActivityIndicatorColor()} />
                <Text style={styles.helper}>rendering your edits…</Text>
              </View>
            ) : loadingThumbnailFrames ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.createThumbnailLoader} />
            ) : thumbnailFrameOptions.length > 0 ? (
              <VideoThumbnailFilmstrip
                frames={thumbnailFrameOptions}
                filter={exportBakeStatus === "ready" ? "none" : selectedFilter}
                textOverlays={exportBakeStatus === "ready" ? [] : textOverlays}
                onSelect={(timeMs, uri) => selectThumbnailTime(timeMs, uri)}
              />
            ) : (
              <Text style={styles.helper}>could not load thumbnail frames.</Text>
            )}
          </>
        )}
        <SectionLabel label={`role (${selectedRoles.length}/${MAX_VIDEO_ROLES})`} />
        <Text style={styles.helper}>choose one role for this video.</Text>
        <TagPicker
          options={creatorRoles}
          selected={selectedRoles}
          onToggle={(role) => toggleLimitedTag(role, selectedRoles, setSelectedRoles, "role", MAX_VIDEO_ROLES)}
        />
        <SectionLabel label={`genres (${selectedGenres.length}/${MAX_VIDEO_GENRES})`} />
        <Text style={styles.helper}>choose up to {MAX_VIDEO_GENRES} genres for this video.</Text>
        <TagPicker
          options={musicGenres}
          selected={selectedGenres}
          onToggle={(genre) => toggleLimitedTag(genre, selectedGenres, setSelectedGenres, "genre", MAX_VIDEO_GENRES)}
        />
        <PrimaryButton
          label={exportBakeStatus === "baking" ? "rendering..." : "post"}
          disabled={
            !asset ||
            exportBakeStatus === "baking" ||
            (selectedRoles.length === 0 && selectedGenres.length === 0)
          }
          onPress={() => {
            void post();
          }}
        />
      </ScrollView>
      <CreatePostPreviewModal
        visible={postPreviewOpen}
        onClose={() => setPostPreviewOpen(false)}
        videoUri={exportBakedAsset?.uri ?? asset?.uri ?? null}
        videoWidth={exportBakedAsset?.width ?? asset?.width ?? null}
        videoHeight={exportBakedAsset?.height ?? asset?.height ?? null}
        filter={exportBakeStatus === "ready" ? "none" : selectedFilter}
        textOverlays={
          exportBakeStatus === "ready" ? [] : textOverlays.filter((overlay) => overlay.text.trim())
        }
        caption={caption}
        lookingFor={lookingForCollaborators}
        profile={profile}
        roles={selectedRoles}
        genres={selectedGenres}
        trimStartRatio={exportBakeStatus === "ready" ? 0 : trimStartRatio}
        trimEndRatio={exportBakeStatus === "ready" ? 1 : trimEndRatio}
      />
    </SafeAreaView>
  );
}
