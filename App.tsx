import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Camera, CameraView, type CameraType } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Linking from "expo-linking";
import { setAudioModeAsync } from "expo-audio";
import { type VideoContentFit } from "expo-video";
import {
  prewarmProfileVideoSource,
  touchProfileVideoPrewarm,
} from "@/lib/profile-video-prewarm";
import {
  contentFitForVideoSize,
  ensureVideoAspectCached,
  getRememberedVideoAspectSize,
  getVideoAspectCacheKeyFromSource,
  getVideoAspectCacheKeyFromVideo,
  imageResizeModeForVideoSize,
  rememberVideoAspectSize,
} from "@/components/video/aspect-cache";
import {
  JamVideoView,
  PROFILE_VIDEO_OPEN_GREY,
  openProfileVideoFullscreen,
  type JamVideoPlaybackStatus,
} from "@/components/video/jam-video-view";
import {
  getFeedPosterSource,
  getGridVideoSource,
  getVideoSource,
  getVideoStreamId,
} from "@/lib/video-display";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import * as Location from "expo-location";
import { getThumbnailAsync } from "expo-video-thumbnails";
import * as FileSystem from "expo-file-system/legacy";
import { DarkTheme, NavigationContainer, useFocusEffect, useIsFocused, type NavigationContainerRef } from "@react-navigation/native";
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, createContext, forwardRef, memo, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { creatorRoles, musicGenres } from "@/lib/options";
import {
  categoryAlertKey,
  formatCategoryAlertLabel,
  loadNotificationPreferences,
  saveNotificationPreferences,
  type CategoryAlertSubscription,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import {
  fetchRecentInboundMessages,
  resolveInboxNotification,
  type DirectMessageNotificationRow,
  type InboxNotification,
} from "@/lib/inbox-notifications";
import { getActiveInboxChatUserId, setActiveInboxChatUserId } from "@/lib/active-inbox-chat";
import {
  disableLiveLocationSharing,
  enableLiveLocationSharing,
  hasSeenNearMeLiveLocationNotice,
  isLiveLocationSharingEnabled,
  markNearMeLiveLocationNoticeSeen,
  NEAR_ME_LIVE_LOCATION_NOTICE_MESSAGE,
  NEAR_ME_LIVE_LOCATION_NOTICE_TITLE,
  pauseLiveLocationSharingOnLogout,
  resumeLiveLocationSharingIfEnabled,
} from "@/lib/live-location-sharing";
import {
  NEAR_ME_RADIUS_OPTIONS,
  normalizeNearMeRadius,
  type NearMeRadiusMiles,
} from "@/lib/location-distance";
import {
  createEarlyAdopterWelcome,
  deleteMessage,
  deleteVideo,
  editMessage,
  blockUser,
  fetchBlockedUsers,
  fetchCreatorProfile,
  fetchCreatorPostAlert,
  fetchCreatorVideos,
  FEED_PAGE_SIZE,
  FEED_SEEN_DWELL_MS,
  fetchConversationMessages,
  fetchFeedVideos,
  fetchNearbyFeedVideos,
  fetchNearbyUserIds,
  fetchInbox,
  fetchMyVideos,
  fetchProfile,
  fetchRelationshipState,
  fetchSavedVideos,
  getProfileVideoPinnedRank,
  MAX_PINNED_PROFILE_VIDEOS,
  pinProfileVideo,
  unpinProfileVideo,
  getSignupPosition,
  hideCreator,
  markConversationRead,
  markInboxMessageRead,
  markVideoSeen,
  markWelcomeSeen,
  removeJamConnection,
  reportVideo,
  saveProfile,
  saveVideo,
  fetchDailyJamUsage,
  formatDailyJamUsageCopy,
  sendJamRequest,
  sendMessage,
  setCreatorPostAlert,
  unblockUser,
  unsaveVideo,
  type BlockedUser,
  type ChatMessage,
  type Conversation,
  type DailyJamUsage,
  type FeedCursor,
  type FeedContentFilters,
  type FeedPhase,
  type FeedVideo,
  type InboxData,
  type InboxMessage,
  type MessageVideoAttachment,
  type InboxRequest,
  type Profile,
  type ProfileVideo,
  type ReportReason,
} from "@/lib/native-social-data";
import {
  extractCloudflareStreamId,
  getCloudflareThumbnailUrl,
  getVideoUploadErrorDetails,
  logVideoUploadStep,
  probeHlsVideoSize,
  type NativeVideoAsset,
} from "@/lib/native-cloudflare";
import {
  enqueuePendingVideoUpload,
  getLocalPosterForVideo,
  getPendingUploadById,
  getPendingUploadIdFromProfileVideoId,
  isPendingProfileVideoId,
  pendingUploadToProfileVideo,
  retryPendingVideoUpload,
  subscribePendingUploadPosted,
  usePendingUploadFeedProgress,
  usePendingVideoUploads,
} from "@/lib/pending-video-uploads";
import {
  bakeVideoPresentation,
  isVideoBakeAvailable,
  needsPresentationBake,
  normalizeCameraRecording,
} from "@/lib/bake-video-presentation";
import {
  uploadNativeProfileAvatar,
  type NativeAvatarAsset,
} from "@/lib/native-avatar-storage";
import { getAuthEmailRedirectUrl, supabase } from "@/lib/native-supabase";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import {
  VideoPresentationOverlays,
  VideoTextOverlayGlyph,
  getVideoFilterOverlayStyle,
} from "@/components/VideoPresentationOverlays";
import {
  PRO_UNLOCK_VIDEO_COUNT,
  getAllowedMaxVideoSeconds,
  getProBadgeKind,
  shouldShowProProgress,
  type ProBadgeKind,
} from "@/lib/pro-entitlements";
import {
  TEXT_OVERLAY_DEFAULT_EFFECT_ID,
  TEXT_OVERLAY_DEFAULT_FONT_ID,
  TEXT_OVERLAY_DEFAULT_FONT_SCALE,
  VIDEO_TEXT_FONT_OPTIONS,
  clampTextOverlayFontScale,
  cycleVideoTextEffectId,
  getVideoTextEffectChrome,
  getVideoTextOutlineRadius,
  getVideoTextOverlayFontFamily,
  getVideoTextOverlayFontWeight,
  normalizeVideoFilter,
  normalizeVideoTextEffectId,
  normalizeVideoTextFontId,
  normalizeVideoTextOverlays,
  type VideoFilterId,
  type VideoTextEffectId,
  type VideoTextFontId,
} from "@/lib/video-presentation";
import {
  ensureFilterCatalogLoaded,
  getFilterPickerOptions,
  subscribeFilterCatalog,
} from "@/lib/video-filters";


import type {
  AuthDeepLinkResult,
  AuthMode,
  CreateStage,
  CreateTextOverlayItem,
  FeedPlaybackSpeed,
  InboxTab,
  LocationCountryOption,
  LocationFilterSelection,
  MainTabParamList,
  PreloadedUserProfile,
  RecordingTimerSeconds,
  Route,
  SavedVideoController,
  Tab,
  ThemeMode,
  VideoFilter,
} from "@/types/app";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  BOOKMARK_CREAM,
  CAMERA_PINCH_ZOOM_STEP,
  CREATE_CAMERA_CONTROLS_BOTTOM_PADDING,
  CREATE_CAMERA_CONTROL_BUTTON_SIZE,
  CREATE_CAMERA_CONTROL_ICON_SIZE,
  CREATE_CAMERA_EXPOSURE_DRAG_RANGE_PX,
  CREATE_CAMERA_FILTER_ROW_HEIGHT,
  CREATE_CAMERA_FOCUS_RETICLE_SIZE,
  CREATE_CAMERA_RECORD_BUTTON_BORDER_WIDTH,
  CREATE_CAMERA_RECORD_BUTTON_SIZE,
  CREATE_CAMERA_TOP_CONTROLS_OFFSET,
  CREATE_DETAILS_PREVIEW_HEIGHT,
  CREATE_DETAILS_PREVIEW_WIDTH,
  CREATE_FILTER_PREVIEW_IMAGE,
  CREATE_FILTER_THUMB_BORDER_WIDTH,
  CREATE_RECORDING_TIMER_OPTIONS,
  CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT,
  CREATE_THUMBNAIL_FRAME_COUNT,
  CREATE_THUMBNAIL_SELECTOR_WIDTH_SCALE,
  CREATE_TRIM_FILMSTRIP_FRAME_COUNT,
  CREATE_TRIM_FILMSTRIP_HEIGHT,
  CREATE_TRIM_FILMSTRIP_RADIUS,
  CREATE_TRIM_HANDLE_WIDTH,
  EMPTY_FILTER_GENRES,
  FEED_ACTION_GAP,
  FEED_CHROME_FADE_MS,
  FEED_CHROME_HOLD_MS,
  FEED_CHROME_LOCK_CIRCLE_SIZE,
  FEED_CHROME_LOCK_PULL_PX,
  FEED_CHROME_LOCK_TRACK_TRAVEL,
  FEED_PLAYBACK_SPEEDS,
  FEED_PREVIEW_VIDEO_BOTTOM_CORNER_RADIUS,
  FEED_QUICK_FILTERS,
  FEED_ROLE_FILTER_LOOP_COPIES,
  FEED_SPEED_DEFAULT_INDEX,
  FEED_SPEED_PILL_HEIGHT,
  FEED_SPEED_PILL_PADDING_V,
  FEED_SPEED_PILL_WIDTH,
  FEED_SPEED_ROW_HEIGHT,
  FEED_SPEED_SEGMENT_PX,
  FEED_SPEED_ZONE_LEFT_RATIO,
  FEED_VIDEO_BOTTOM_CORNER_RADIUS,
  FULLSCREEN_MESSAGE_SEND_WIDTH,
  FULLSCREEN_MESSAGE_TICK_WIDTH,
  JAM_JAR_FILL_EMPTY_HEIGHT,
  JAM_JAR_FILL_FULL_HEIGHT,
  JAM_JAR_JAM_COLOR,
  JAM_JAR_LID_EMPTY_GAP,
  JAM_JAR_LID_EMPTY_HEIGHT,
  JAM_JAR_LID_FULL_GAP,
  JAM_JAR_LID_FULL_HEIGHT,
  LOOKING_FOR_BINOCULARS_ICON,
  LOCATION_PICKER_MAX_VISIBLE_ROWS,
  LOCATION_PICKER_ROW_HEIGHT,
  LOCATION_PICKER_VISIBLE_HEIGHT,
  MAX_ACCOUNT_CREATOR_TYPES,
  MAX_VIDEO_GENRES,
  MAX_VIDEO_ROLES,
  NAV_BAR_HEIGHT,
  NAV_BAR_ITEM_HEIGHT,
  NAV_BAR_TOP_PADDING,
  NOTIFY_POPOVER_WIDTH,
  PROFILE_COLLAPSED_BAR_HEIGHT,
  PROFILE_GRID_GAP,
  PROFILE_GRID_ITEM_WIDTH,
  PROFILE_TOP_FADE_EXTRA,
  SCREEN_CONTENT_PADDING,
  SWIPE_BACK_HIT_WIDTH,
  TAB_SCREEN_MIN_TOP_PADDING,
  TAB_SCREEN_TOP_PADDING,
  TEXT_OVERLAY_BASE_FONT_SIZE,
  TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS,
  TEXT_OVERLAY_CENTER_GUIDE_FADE_MS,
  TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD,
  TEXT_OVERLAY_CENTER_SNAP_THRESHOLD,
  TEXT_OVERLAY_MAX_WIDTH_RATIO,
  THEME_STORAGE_KEY,
  UNJAM_POPOVER_WIDTH,
  WELCOME_HEADER_TAP_GUARD,
  border,
  dark,
  jamBorder,
  jamTint,
  muted,
  overlayIconShadow,
  overlayTextShadow,
  panel,
  panelSoft,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";
import {
  activeThemeMode,
  darkStyles,
  getActivityIndicatorColor,
  setActiveThemeMode,
  styles,
  type AppStyleSet,
} from "@/theme/styles";
import { fadeAnimatedValue, waitMs } from "@/lib/animation";
import { clamp, formatClipDuration, getUniqueStrings, ordinal, stringParam } from "@/lib/format";
import {
  LOCATION_FILTER_COUNTRIES,
  encodeLocationFilter,
  formatProfileLocation,
  getCountryMatchTerms,
  getCountrySearchText,
  getProfileLocationParts,
  locationContainsTerm,
  locationFilterMatches,
  normalizeLocationText,
  parseLocationFilter,
} from "@/lib/location-filter";
import {
  FEED_ROLE_FILTER_WHEEL,
  buildDiscoverFeedQueryKey,
  creatorRoleTagSet,
  feedVideoMatchesFilters,
  isFeedFilterStateActive,
  musicGenreTagSet,
  normalizeVideoTag,
  shuffleVideosWithSpacing,
  toFeedContentFilters,
  type FeedFilterState,
  getUniqueVideoTags,
} from "@/lib/feed-filters";
import {
  conversationFromFeedItem,
  conversationFromRequest,
  feedItemToPreloadedProfile,
  getProfileFullscreenTags,
  getProfileVideoCreatedAtMs,
  getProfileVideoOwner,
  getProfileVideoTags,
  getVideoPresentation,
  hasSentJam,
  isPendingSentJam,
  profileToFeedVideo,
  profileVideoToFeedVideo,
  sortProfileVideos,
  sortProfileVideosByNewest,
} from "@/lib/profile-mappers";
import { getUnreadInboxCount, getUnreadLocalInboxCount } from "@/lib/inbox-unread";
import {
  PROFILE_VIDEO_DELETE_ANIMATION,
  PROFILE_VIDEO_PIN_REORDER_ANIMATION,
  filterOutLocallyDeletedVideos,
  locallyDeletedProfileVideoIds,
  pruneLocallyDeletedProfileVideoIds,
} from "@/lib/profile-video-delete-cache";

function triggerHoldHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
/** Finger travel needed while holding to fill the lock gesture (visual track stays shorter). */

function getFeedVideoViewport(bottomInset: number) {
  const navBarHeight = getNavBarHeight(bottomInset);
  return {
    navBarHeight,
    width: viewportWidth,
    height: viewportHeight - navBarHeight,
  };
}

function getCreateCameraControlsBottom(navBarHeight: number) {
  return navBarHeight + CREATE_CAMERA_CONTROLS_BOTTOM_PADDING;
}

function getCreateCameraFilterRestBottom(navBarHeight: number) {
  return (navBarHeight - CREATE_CAMERA_FILTER_ROW_HEIGHT) / 2;
}

function getCreateCameraFilterSlideDistance(navBarHeight: number) {
  return getCreateCameraFilterRestBottom(navBarHeight) + CREATE_CAMERA_FILTER_ROW_HEIGHT;
}

// Camera-roll thumbnails decode via AVFoundation. Doing that while CameraView is
// starting freezes the live preview, so we cache/preload outside create focus.
let cachedRecentVideoThumbnailUri: string | null = null;
let recentVideoThumbnailLoadPromise: Promise<string | null> | null = null;
let cameraPreviewActive = false;

function setCameraPreviewActive(active: boolean) {
  cameraPreviewActive = active;
}


async function preloadRecentVideoThumbnail(options?: {
  force?: boolean;
  requestPermission?: boolean;
}): Promise<string | null> {
  if (!options?.force && cachedRecentVideoThumbnailUri) {
    return cachedRecentVideoThumbnailUri;
  }
  if (recentVideoThumbnailLoadPromise && !options?.force) {
    return recentVideoThumbnailLoadPromise;
  }

  recentVideoThumbnailLoadPromise = (async () => {
    try {
      // If create camera took focus while we were queued, wait it out instead of
      // decoding on top of the live session.
      const waitStarted = Date.now();
      while (cameraPreviewActive && Date.now() - waitStarted < 45000) {
        await waitMs(250);
      }
      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      let permission = await MediaLibrary.getPermissionsAsync();
      if (!permission.granted) {
        // Don't prompt during background preload — create keeps the placeholder
        // until the picker (or an explicit refresh) asks.
        if (!options?.requestPermission || !permission.canAskAgain) {
          return cachedRecentVideoThumbnailUri;
        }
        permission = await MediaLibrary.requestPermissionsAsync();
      }
      if (!permission.granted) return cachedRecentVideoThumbnailUri;
      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      const assets = await MediaLibrary.getAssetsAsync({
        first: 1,
        mediaType: MediaLibrary.MediaType.video,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const latestVideo = assets.assets[0];
      if (!latestVideo) {
        cachedRecentVideoThumbnailUri = null;
        return null;
      }

      // Avoid iCloud downloads while the camera may be nearby — local only.
      const assetInfo = await MediaLibrary.getAssetInfoAsync(latestVideo, {
        shouldDownloadFromNetwork: false,
      });
      const rawUri = (assetInfo.localUri ?? latestVideo.uri).replace(/#.*$/, "");
      if (!rawUri || rawUri.startsWith("ph://") || assetInfo.isNetworkAsset) {
        return cachedRecentVideoThumbnailUri;
      }
      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      async function thumbnailFromUri(videoUri: string) {
        return getThumbnailAsync(videoUri, {
          time: 100,
          quality: 0.6,
        });
      }

      try {
        const thumbnail = await thumbnailFromUri(rawUri);
        cachedRecentVideoThumbnailUri = thumbnail.uri;
        return thumbnail.uri;
      } catch {
        // Fall through — iOS often needs a sandbox copy before thumbnails work.
      }

      if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;

      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return cachedRecentVideoThumbnailUri;

      const copiedUri = `${cacheDir}jam-recent-library-video.mp4`;
      await FileSystem.deleteAsync(copiedUri, { idempotent: true });
      await FileSystem.copyAsync({ from: rawUri, to: copiedUri });
      try {
        if (cameraPreviewActive) return cachedRecentVideoThumbnailUri;
        const thumbnail = await thumbnailFromUri(copiedUri);
        cachedRecentVideoThumbnailUri = thumbnail.uri;
        return thumbnail.uri;
      } finally {
        void FileSystem.deleteAsync(copiedUri, { idempotent: true });
      }
    } catch {
      return cachedRecentVideoThumbnailUri;
    } finally {
      recentVideoThumbnailLoadPromise = null;
    }
  })();

  return recentVideoThumbnailLoadPromise;
}


function pinchScaleToCameraZoom(baseZoom: number, scale: number) {
  const delta = (Math.log(Math.max(scale, 0.01)) / Math.log(2)) * CAMERA_PINCH_ZOOM_STEP;
  return clamp(baseZoom + delta, 0, 1);
}

function clampTextOverlayCenterRatio(ratio: { x: number; y: number }) {
  // Full edit canvas (including letterbox bars). Keep a thin inset so the
  // overlay center stays on-screen while still allowing edge / bar placement.
  return { x: clamp(ratio.x, 0.02, 0.98), y: clamp(ratio.y, 0.02, 0.98) };
}

function snapTextOverlayCenterRatio(
  ratio: { x: number; y: number },
  options: { snapX: boolean; snapY: boolean },
) {
  const clamped = clampTextOverlayCenterRatio(ratio);
  return {
    x:
      options.snapX && Math.abs(clamped.x - 0.5) <= TEXT_OVERLAY_CENTER_SNAP_THRESHOLD
        ? 0.5
        : clamped.x,
    y:
      options.snapY && Math.abs(clamped.y - 0.5) <= TEXT_OVERLAY_CENTER_SNAP_THRESHOLD
        ? 0.5
        : clamped.y,
  };
}


function getCreateTextOverlayFontSize(fontScale: number) {
  return Math.max(12, Math.round(TEXT_OVERLAY_BASE_FONT_SIZE * fontScale * 10) / 10);
}


function getCreateTextOverlayLineHeight(fontSize: number) {
  // Slightly taller than 1.2 so script descenders / boxed text don't clip.
  return Math.round(fontSize * 1.25 * 10) / 10;
}


function createTextOverlayId() {
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


function confirmNearMeLiveLocationSharing(userId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    void hasSeenNearMeLiveLocationNotice(userId).then((seen) => {
      if (seen) {
        finish(true);
        return;
      }

      Alert.alert(
        NEAR_ME_LIVE_LOCATION_NOTICE_TITLE,
        NEAR_ME_LIVE_LOCATION_NOTICE_MESSAGE,
        [
          { text: "cancel", style: "cancel", onPress: () => finish(false) },
          {
            text: "turn on",
            onPress: () => {
              void markNearMeLiveLocationNoticeSeen(userId).finally(() => finish(true));
            },
          },
        ],
        { cancelable: true, onDismiss: () => finish(false) },
      );
    });
  });
}


function getTrimSelectionProgress(absoluteRatio: number, trimStartRatio: number, trimEndRatio: number) {
  const span = trimEndRatio - trimStartRatio;
  if (span <= 0.0001) return 0;
  return clamp(absoluteRatio - trimStartRatio, 0, span) / span;
}


function getTrimProgressTrackGeometry(trimLeft: number, selectionWidth: number) {
  if (selectionWidth <= 0) {
    return { progressTrackLeft: trimLeft, progressTrackWidth: 0 };
  }

  const inset = Math.min(CREATE_TRIM_HANDLE_WIDTH, Math.max(0, selectionWidth / 2 - 1));
  const progressTrackWidth = Math.max(2, selectionWidth - inset * 2);
  const progressTrackLeft = trimLeft + (selectionWidth - progressTrackWidth) / 2;
  return { progressTrackLeft, progressTrackWidth };
}


const MainTab = createBottomTabNavigator<MainTabParamList>();

function getNavBarHeight(bottomInset: number) {
  return Math.max(
    NAV_BAR_HEIGHT,
    NAV_BAR_ITEM_HEIGHT + NAV_BAR_TOP_PADDING + Math.max(bottomInset, 12),
  );
}

function getJamNavigationTheme(themeMode: ThemeMode) {
  return {
    ...DarkTheme,
    dark: themeMode === "dark",
    colors: {
      ...DarkTheme.colors,
      background: themeMode === "light" ? "#f7f7f8" : dark,
      card: themeMode === "light" ? "#ffffff" : dark,
      border: themeMode === "light" ? "rgba(0,0,0,0.12)" : border,
      text: themeMode === "light" ? "#0a0a0a" : "#fff",
      primary: themeMode === "light" ? "#0a0a0a" : "#fff",
    },
  };
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  const updateThemeMode = useCallback((nextThemeMode: ThemeMode) => {
    setActiveThemeMode(nextThemeMode);
    setThemeMode(nextThemeMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedThemeMode) => {
        if (savedThemeMode === "light" || savedThemeMode === "dark") {
          setActiveThemeMode(savedThemeMode);
          setThemeMode(savedThemeMode);
        }
      })
      .finally(() => setThemeReady(true));
  }, []);

  // Hold a stable dark jam. loader until theme is known — flipping light/dark mid-boot
  // was restyling the logo and reading as a glitch.
  if (!themeReady) {
    return (
      <GestureHandlerRootView style={darkStyles.gestureRoot}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <StatusBar style="light" />
          <LoadingScreen label="opening jam." logoOnly />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style={themeMode === "light" ? "dark" : "light"} />
        <JamApp themeMode={themeMode} onThemeModeChange={updateThemeMode} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function JamApp({
  themeMode,
  onThemeModeChange,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const [route, setRoute] = useState<Route>("auth");
  const [userId, setUserId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [shuffleSignal, setShuffleSignal] = useState(0);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2 | 3>(1);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  // jam. splash over the feed only for cold session restore — not after login/signup.
  const [showLaunchSplash, setShowLaunchSplash] = useState(false);

  const routeAfterAuth = useCallback(async (
    nextUserId: string,
    options?: { fromColdStart?: boolean },
  ) => {
    setPasswordRecoveryPending(false);
    const profile = await fetchProfile(nextUserId);
    setUserId(nextUserId);

    if (!profile?.onboarding_complete) {
      setShowLaunchSplash(false);
      setRoute("onboarding");
      return;
    }

    if (!profile.welcome_seen && profile.early_adopter) {
      setShowLaunchSplash(false);
      setRoute("welcome");
      return;
    }

    setShowLaunchSplash(Boolean(options?.fromColdStart));
    setRoute("main");
  }, []);

  const enterPasswordRecovery = useCallback(() => {
    setPasswordRecoveryPending(true);
    setUserId(null);
    setRoute("auth");
  }, []);

  useEffect(() => {
    if (!userId) return;

    void resumeLiveLocationSharingIfEnabled(userId).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function boot() {
      let linkResult: AuthDeepLinkResult = null;
      try {
        linkResult = await handleAuthDeepLink(await Linking.getInitialURL());
      } catch {
        linkResult = null;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (linkResult === "recovery") {
        enterPasswordRecovery();
      } else if (user) {
        await routeAfterAuth(user.id, { fromColdStart: true });
      } else {
        setRoute("auth");
      }
      setBooting(false);
    }

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthDeepLink(url)
        .then(async (linkResult) => {
          if (linkResult === "recovery") {
            enterPasswordRecovery();
            return;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) await routeAfterAuth(user.id);
        })
        .catch((err) => {
          Alert.alert(
            "could not open link",
            err instanceof Error ? err.message : "try requesting a new reset email.",
          );
        });
    });

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        enterPasswordRecovery();
        return;
      }

      if (!session?.user) {
        setPasswordRecoveryPending(false);
        setUserId(null);
        setRoute("auth");
      }
    });

    void boot();

    return () => {
      active = false;
      subscription.remove();
      authSubscription.data.subscription.unsubscribe();
    };
  }, [enterPasswordRecovery, routeAfterAuth]);

  if (booting) {
    return <LoadingScreen label="opening jam." logoOnly />;
  }

  if (route === "auth") {
    return (
      <AuthScreen
        onAuthenticated={routeAfterAuth}
        passwordRecovery={passwordRecoveryPending}
      />
    );
  }

  if (!userId) {
    return (
      <AuthScreen
        onAuthenticated={routeAfterAuth}
        passwordRecovery={passwordRecoveryPending}
      />
    );
  }

  if (route === "onboarding") {
    return (
      <OnboardingScreen
        key={`onboarding-step-${onboardingInitialStep}`}
        userId={userId}
        initialStep={onboardingInitialStep}
        onFinished={(isEarlyAdopter) => {
          setOnboardingInitialStep(1);
          setShowLaunchSplash(false);
          setRoute(isEarlyAdopter ? "welcome" : "main");
        }}
      />
      );
  }

  if (route === "welcome") {
    return (
      <WelcomeScreen
        userId={userId}
        onBack={() => {
          setOnboardingInitialStep(3);
          setRoute("onboarding");
        }}
        onDone={() => {
          setShowLaunchSplash(false);
          setRoute("main");
        }}
      />
    );
  }

  return (
    <MainTabs
      userId={userId}
      themeMode={themeMode}
      onThemeModeChange={onThemeModeChange}
      shuffleSignal={shuffleSignal}
      showLaunchSplash={showLaunchSplash}
      onShuffleDiscover={() => setShuffleSignal((current) => current + 1)}
      onLoggedOut={async () => {
        try {
          await pauseLiveLocationSharingOnLogout(userId).catch(() => undefined);
          const { error } = await supabase.auth.signOut({ scope: "local" });
          if (error) {
            await supabase.auth.signOut().catch(() => undefined);
          }
        } finally {
          setShowLaunchSplash(false);
          setUserId(null);
          setRoute("auth");
        }
      }}
    />
  );
}

function MainTabs({
  userId,
  themeMode,
  onThemeModeChange,
  shuffleSignal,
  showLaunchSplash,
  onShuffleDiscover,
  onLoggedOut,
}: {
  userId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  shuffleSignal: number;
  showLaunchSplash: boolean;
  onShuffleDiscover: () => void;
  onLoggedOut: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const navigationRef = useRef<NavigationContainerRef<MainTabParamList>>(null);
  const [tabProfile, setTabProfile] = useState<Profile | null>(null);
  const [profileRefreshSignal, setProfileRefreshSignal] = useState(0);
  const [inboxRefreshSignal, setInboxRefreshSignal] = useState(0);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [inboxNotification, setInboxNotification] = useState<InboxNotification | null>(null);
  const [postedToastVisible, setPostedToastVisible] = useState(false);
  const [discoverBootReady, setDiscoverBootReady] = useState(!showLaunchSplash);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(() => new Set());
  const pendingSavedVideoStateRef = useRef(new Map<string, boolean>());
  const seenInboundMessageIdsRef = useRef<Set<string>>(new Set());
  const inboxNotificationsReadyRef = useRef(false);
  const pendingInboundMessagesRef = useRef<DirectMessageNotificationRow[]>([]);
  const inboxNotificationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboxNotificationOpacity = useRef(new Animated.Value(0)).current;
  const inboxNotificationTranslateY = useRef(new Animated.Value(-8)).current;
  const feedChromeOpacity = useRef(new Animated.Value(1)).current;
  const [feedChromeClear, setFeedChromeClear] = useState(false);

  const refreshUnreadInboxCount = useCallback(async () => {
    const inbox = await fetchInbox(userId);
    const nextCount = getUnreadInboxCount(inbox);
    setUnreadInboxCount(nextCount);
    return nextCount;
  }, [userId]);

  const bumpInboxRefresh = useCallback(() => {
    setInboxRefreshSignal((current) => current + 1);
  }, []);

  const hideInboxNotification = useCallback(() => {
    if (inboxNotificationHideTimerRef.current) {
      clearTimeout(inboxNotificationHideTimerRef.current);
      inboxNotificationHideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(inboxNotificationOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(inboxNotificationTranslateY, {
        toValue: -8,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setInboxNotification(null);
    });
  }, [inboxNotificationOpacity, inboxNotificationTranslateY]);

  const showInboxNotification = useCallback(
    (notification: InboxNotification) => {
      if (getActiveInboxChatUserId() === notification.senderId) return;

      if (inboxNotificationHideTimerRef.current) {
        clearTimeout(inboxNotificationHideTimerRef.current);
        inboxNotificationHideTimerRef.current = null;
      }

      setInboxNotification(notification);
      inboxNotificationOpacity.setValue(0);
      inboxNotificationTranslateY.setValue(-8);
      Animated.parallel([
        Animated.timing(inboxNotificationOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(inboxNotificationTranslateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      inboxNotificationHideTimerRef.current = setTimeout(() => {
        hideInboxNotification();
      }, 4200);
    },
    [hideInboxNotification, inboxNotificationOpacity, inboxNotificationTranslateY],
  );

  const handleIncomingDirectMessage = useCallback(
    async (row: DirectMessageNotificationRow) => {
      if (!inboxNotificationsReadyRef.current) {
        pendingInboundMessagesRef.current.push(row);
        return;
      }

      if (seenInboundMessageIdsRef.current.has(row.id)) return;
      seenInboundMessageIdsRef.current.add(row.id);

      if (row.recipient_id !== userId || row.sender_id === userId) return;

      bumpInboxRefresh();

      try {
        const notification = await resolveInboxNotification(userId, row);
        if (!notification) return;
        showInboxNotification(notification);
      } catch {
        // Keep badge/inbox refresh even if banner copy fails.
      }
    },
    [bumpInboxRefresh, showInboxNotification, userId],
  );

  useEffect(() => {
    let cancelled = false;
    inboxNotificationsReadyRef.current = false;
    seenInboundMessageIdsRef.current = new Set();
    pendingInboundMessagesRef.current = [];

    async function bootstrapSeenMessages() {
      try {
        const recent = await fetchRecentInboundMessages(userId);
        if (cancelled) return;
        seenInboundMessageIdsRef.current = new Set(recent.map((message) => message.id));
      } catch {
        // Realtime/polling can still catch future messages.
      } finally {
        if (cancelled) return;
        inboxNotificationsReadyRef.current = true;
        const pending = pendingInboundMessagesRef.current;
        pendingInboundMessagesRef.current = [];
        for (const message of pending) {
          await handleIncomingDirectMessage(message);
        }
      }
    }

    void bootstrapSeenMessages();

    const channel = supabase
      .channel(`inbox-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DirectMessageNotificationRow;
          if (!row?.id || !row.sender_id || !row.recipient_id) return;
          void handleIncomingDirectMessage({
            id: row.id,
            sender_id: row.sender_id,
            recipient_id: row.recipient_id,
            body: typeof row.body === "string" ? row.body : "",
            created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
          });
        },
      )
      .subscribe();

    const pollRecentMessages = async () => {
      if (cancelled || AppState.currentState !== "active") return;
      try {
        const recent = await fetchRecentInboundMessages(userId);
        if (cancelled) return;
        for (const message of [...recent].reverse()) {
          await handleIncomingDirectMessage(message);
        }
      } catch {
        // Ignore transient poll errors.
      }
    };

    const pollTimer = setInterval(() => {
      void pollRecentMessages();
    }, 12000);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void pollRecentMessages();
    });

    return () => {
      cancelled = true;
      inboxNotificationsReadyRef.current = false;
      clearInterval(pollTimer);
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
      if (inboxNotificationHideTimerRef.current) {
        clearTimeout(inboxNotificationHideTimerRef.current);
        inboxNotificationHideTimerRef.current = null;
      }
    };
  }, [handleIncomingDirectMessage, userId]);

  const refreshSavedVideos = useCallback(async () => {
    const savedVideos = await fetchSavedVideos(userId);
    const nextSavedVideoIds = new Set(savedVideos.map((video) => video.id));
    pendingSavedVideoStateRef.current.forEach((pendingSaved, videoId) => {
      if (pendingSaved) {
        nextSavedVideoIds.add(videoId);
        return;
      }

      nextSavedVideoIds.delete(videoId);
    });
    setSavedVideoIds(nextSavedVideoIds);
    return nextSavedVideoIds;
  }, [userId]);

  useEffect(() => {
    void fetchProfile(userId).then((profile) => {
      if (profile) setTabProfile(profile);
    });
  }, [profileRefreshSignal, userId]);

  const setVideoSaved = useCallback(
    async (videoId: string, nextSaved: boolean) => {
      pendingSavedVideoStateRef.current.set(videoId, nextSaved);
      setSavedVideoIds((current) => {
        const next = new Set(current);
        if (nextSaved) {
          next.add(videoId);
        } else {
          next.delete(videoId);
        }
        return next;
      });

      try {
        if (nextSaved) {
          await saveVideo(userId, videoId);
        } else {
          await unsaveVideo(userId, videoId);
        }
        await refreshSavedVideos().catch(() => undefined);
        pendingSavedVideoStateRef.current.delete(videoId);
        return true;
      } catch (err) {
        pendingSavedVideoStateRef.current.delete(videoId);
        await refreshSavedVideos().catch(() => {
          setSavedVideoIds((current) => {
            const next = new Set(current);
            if (nextSaved) {
              next.delete(videoId);
            } else {
              next.add(videoId);
            }
            return next;
          });
        });
        Alert.alert(
          nextSaved ? "could not save" : "could not remove",
          err instanceof Error ? err.message : "try again",
        );
        return false;
      }
    },
    [refreshSavedVideos, userId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshSavedVideos();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshSavedVideos]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshUnreadInboxCount().catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [inboxRefreshSignal, refreshUnreadInboxCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProfile(userId)
        .then(setTabProfile)
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [profileRefreshSignal, userId]);

  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribePendingUploadPosted((event) => {
      if (event.userId !== userId) return;
      setPostedToastVisible(true);
      setProfileRefreshSignal((current) => current + 1);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setPostedToastVisible(false), 2400);
    });
    return () => {
      unsubscribe();
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, [userId]);

  const savedVideoController = useMemo<SavedVideoController>(
    () => ({
      savedVideoIds,
      setVideoSaved,
      refreshSavedVideos,
    }),
    [refreshSavedVideos, savedVideoIds, setVideoSaved],
  );

  const handleDiscoverBootReady = useCallback(() => {
    setDiscoverBootReady(true);
  }, []);

  useEffect(() => {
    if (!discoverBootReady) return;
    // Warm the camera-roll thumb + filter catalog before create opens.
    const timer = setTimeout(() => {
      void preloadRecentVideoThumbnail();
      void ensureFilterCatalogLoaded();
    }, 700);
    return () => clearTimeout(timer);
  }, [discoverBootReady]);

  return (
    <NavigationContainer ref={navigationRef} theme={getJamNavigationTheme(themeMode)}>
      <View style={styles.flex}>
        <MainTab.Navigator
          initialRouteName="discover"
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            lazy: true,
            animation: "none",
            sceneStyle: styles.tabScene,
            tabBarHideOnKeyboard: true,
          }}
          tabBar={(props) => (
            <JamTabBar
              {...props}
              userId={userId}
              currentUserProfile={tabProfile}
              unreadInboxCount={unreadInboxCount}
              onShuffleDiscover={onShuffleDiscover}
              feedReady={discoverBootReady}
              chromeOpacity={feedChromeOpacity}
              chromeClear={feedChromeClear}
            />
          )}
        >
          <MainTab.Screen name="discover">
            {({ navigation }) => (
              <DiscoverScreen
                userId={userId}
                viewerProfile={tabProfile}
                shuffleSignal={shuffleSignal}
                savedVideoController={savedVideoController}
                showBootOverlay={showLaunchSplash}
                feedChromeOpacity={feedChromeOpacity}
                onFeedChromeClearChange={setFeedChromeClear}
                onCreate={() => navigation.navigate("create")}
                onInboxChanged={bumpInboxRefresh}
                onBootReady={handleDiscoverBootReady}
                onViewerProfileUpdated={setTabProfile}
              />
            )}
          </MainTab.Screen>
          <MainTab.Screen name="create">
            {({ navigation }) => (
              <CreateScreen
                userId={userId}
                onClose={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                    return;
                  }

                  navigation.navigate("discover");
                }}
                onPosted={() => {
                  setProfileRefreshSignal((current) => current + 1);
                  navigation.navigate("discover");
                }}
              />
            )}
          </MainTab.Screen>
          <MainTab.Screen name="inbox">
            {() => (
              <InboxScreen
                userId={userId}
                viewerProfile={tabProfile}
                refreshSignal={inboxRefreshSignal}
                savedVideoController={savedVideoController}
                onUnreadCountChanged={setUnreadInboxCount}
                onViewerProfileUpdated={setTabProfile}
              />
            )}
          </MainTab.Screen>
          <MainTab.Screen name="you">
            {() => (
              <MyProfileScreen
                userId={userId}
                themeMode={themeMode}
                onThemeModeChange={onThemeModeChange}
                refreshSignal={profileRefreshSignal}
                savedVideoController={savedVideoController}
                initialProfile={tabProfile}
                onInboxChanged={bumpInboxRefresh}
                onProfileChanged={(nextProfile) => setTabProfile(nextProfile)}
                onLoggedOut={onLoggedOut}
              />
            )}
          </MainTab.Screen>
        </MainTab.Navigator>

        {inboxNotification ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.inboxNotificationWrap,
              {
                top: insets.top + 10,
                opacity: inboxNotificationOpacity,
                transform: [{ translateY: inboxNotificationTranslateY }],
              },
            ]}
          >
            <Pressable
              style={styles.inboxNotificationCard}
              onPress={() => {
                hideInboxNotification();
                navigationRef.current?.navigate("inbox");
              }}
              accessibilityRole="button"
              accessibilityLabel={inboxNotification.text}
            >
              <Text numberOfLines={2} style={styles.inboxNotificationText}>
                {inboxNotification.text}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {postedToastVisible ? (
          <View
            pointerEvents="none"
            style={[styles.profilePostedToast, { top: insets.top + 56 }]}
            accessibilityLabel="Posted"
          >
            <Text style={styles.profilePostedToastText}>Posted!</Text>
          </View>
        ) : null}

        {showLaunchSplash && !discoverBootReady ? (
          <View pointerEvents="auto" style={darkStyles.feedBootOverlay}>
            <LoadingScreen label="opening jam." logoOnly />
          </View>
        ) : null}
      </View>
    </NavigationContainer>
  );
}

async function handleAuthDeepLink(url: string | null): Promise<AuthDeepLinkResult> {
  if (!url) return null;

  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const hashParams = Object.fromEntries(new URLSearchParams(hash));

  const tokenHash = stringParam(query.token_hash) ?? stringParam(hashParams.token_hash);
  const type = stringParam(query.type) ?? stringParam(hashParams.type);
  const accessToken = stringParam(query.access_token) ?? stringParam(hashParams.access_token);
  const refreshToken = stringParam(query.refresh_token) ?? stringParam(hashParams.refresh_token);

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return type === "recovery" ? "recovery" : "session";
  }

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error) throw error;
    return "recovery";
  }

  if (tokenHash && type === "email_change") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email_change" });
    return "session";
  }

  if (tokenHash && type === "signup") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
    return "session";
  }

  if (tokenHash && type === "email") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    return "session";
  }

  return null;
}

function authSubtitle(mode: AuthMode) {
  switch (mode) {
    case "signup":
      return "create your account";
    case "forgot":
      return "reset your password";
    case "reset":
      return "choose a new password";
    default:
      return "welcome back";
  }
}

function AuthScreen({
  onAuthenticated,
  passwordRecovery = false,
}: {
  onAuthenticated: (userId: string) => Promise<void>;
  passwordRecovery?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const welcomeToOpacity = useRef(new Animated.Value(0)).current;
  const welcomeToTranslateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (passwordRecovery) {
      setMode("reset");
      setError(null);
      setMessage(null);
      setPassword("");
      setConfirmPassword("");
    }
  }, [passwordRecovery]);

  useEffect(() => {
    const fadeDuration = mode === "signup" ? 520 : 320;

    Animated.parallel([
      Animated.timing(welcomeToOpacity, {
        toValue: mode === "signup" ? 1 : 0,
        duration: fadeDuration,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeToTranslateY, {
        toValue: mode === "signup" ? 0 : 6,
        duration: fadeDuration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode, welcomeToOpacity, welcomeToTranslateY]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "forgot") {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail.includes("@")) {
          throw new Error("enter a valid email address");
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: getAuthEmailRedirectUrl("auth"),
        });
        if (resetError) throw resetError;
        setMessage("check your email for a reset link");
        return;
      }

      if (mode === "reset") {
        if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
          throw new Error(`password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters`);
        }
        if (password !== confirmPassword) {
          throw new Error("passwords do not match");
        }

        const { data, error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        if (data.user) await onAuthenticated(data.user.id);
        return;
      }

      if (mode === "signup") {
        if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
          throw new Error(`password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters`);
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: getAuthEmailRedirectUrl("auth") },
        });
        if (signUpError) throw signUpError;
        setEmail("");
        setPassword("");
        setMessage("check your email to confirm your account");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      if (data.user) await onAuthenticated(data.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled =
    loading ||
    (mode === "forgot"
      ? !email.trim()
      : mode === "reset"
        ? password.length < AUTH_PASSWORD_MIN_LENGTH || confirmPassword.length < AUTH_PASSWORD_MIN_LENGTH
        : !email.trim() || password.length < AUTH_PASSWORD_MIN_LENGTH);

  const submitLabel = loading
    ? "please wait..."
    : mode === "login"
      ? "log in"
      : mode === "signup"
        ? "sign up"
        : mode === "forgot"
          ? "send reset link"
          : "save new password";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.centered}
      >
        <View style={styles.authCard}>
          <View style={styles.authLogoWrap}>
            <Animated.Text
              pointerEvents="none"
              style={[
                styles.authWelcomeTo,
                {
                  opacity: welcomeToOpacity,
                  transform: [{ translateY: welcomeToTranslateY }],
                },
              ]}
            >
              welcome to
            </Animated.Text>
            <Text style={styles.logo}>jam.</Text>
          </View>
          <Text style={styles.subtitle}>{authSubtitle(mode)}</Text>

          {message && <Text style={styles.notice}>{message}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          {mode !== "reset" ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="email"
              placeholderTextColor="#71717a"
              style={styles.input}
            />
          ) : null}

          {mode === "login" || mode === "signup" || mode === "reset" ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={mode === "reset" ? "new password" : "password"}
              placeholderTextColor="#71717a"
              style={styles.input}
            />
          ) : null}

          {mode === "reset" ? (
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="confirm password"
              placeholderTextColor="#71717a"
              style={styles.input}
            />
          ) : null}

          {mode === "login" ? (
            <Pressable onPress={() => switchMode("forgot")} hitSlop={8}>
              <Text style={styles.forgotPasswordText}>forgot password?</Text>
            </Pressable>
          ) : null}

          <PrimaryButton label={submitLabel} disabled={submitDisabled} onPress={submit} />

          {mode === "login" ? (
            <Pressable onPress={() => switchMode("signup")}>
              <Text style={styles.switchText}>new here? sign up</Text>
            </Pressable>
          ) : null}

          {mode === "signup" ? (
            <Pressable onPress={() => switchMode("login")}>
              <Text style={styles.switchText}>already have an account? log in</Text>
            </Pressable>
          ) : null}

          {mode === "forgot" ? (
            <Pressable onPress={() => switchMode("login")}>
              <Text style={styles.switchText}>back to log in</Text>
            </Pressable>
          ) : null}

          {mode === "reset" && !passwordRecovery ? (
            <Pressable onPress={() => switchMode("login")}>
              <Text style={styles.switchText}>back to log in</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OnboardingScreen({
  userId,
  onFinished,
  initialStep = 1,
}: {
  userId: string;
  onFinished: (isEarlyAdopter: boolean) => void;
  initialStep?: 1 | 2 | 3;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const onboardingSlideX = useRef(new Animated.Value(-(initialStep - 1) * viewportWidth)).current;
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<NativeAvatarAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboardingExitOpacity = useRef(new Animated.Value(initialStep > 1 ? 0 : 1)).current;
  const skipNextSlideAnimationRef = useRef(initialStep > 1);

  const creatorSuggestions = useSuggestions(creatorRoles, creatorQuery, creatorTypes);

  useEffect(() => {
    let active = true;
    void fetchProfile(userId).then((profile) => {
      if (!active || !profile) return;
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCreatorTypes(getUniqueStrings(profile.creator_types ?? []).slice(0, MAX_ACCOUNT_CREATOR_TYPES));
      const nextLocation = getProfileLocationParts(profile);
      setCountry(nextLocation.country);
      setCity(nextLocation.city);
      setLocationQuery("");
      setAvatarUrl(profile.avatar_url ?? null);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (initialStep > 1) {
      void fadeAnimatedValue(onboardingExitOpacity, 1, 320);
    }
  }, [initialStep, onboardingExitOpacity]);

  useEffect(() => {
    const toValue = -(step - 1) * viewportWidth;
    if (skipNextSlideAnimationRef.current) {
      onboardingSlideX.setValue(toValue);
      skipNextSlideAnimationRef.current = false;
      return;
    }

    Animated.timing(onboardingSlideX, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [onboardingSlideX, step]);

  async function applyAvatarAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.uri) return;

    setAvatarUrl(asset.uri);
    setAvatarAsset({
      uri: asset.uri,
      fileName: asset.fileName ?? asset.uri.split("/").pop() ?? "avatar.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }

  async function pickAvatarFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("permission needed", "photo library access is needed to choose a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await applyAvatarAsset(result.assets[0]);
    }
  }

  async function pickAvatarFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("permission needed", "camera access is needed to take a profile photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await applyAvatarAsset(result.assets[0]);
    }
  }

  function addCreatorType(role: string) {
    setCreatorTypes((current) => {
      const uniqueCurrent = getUniqueStrings(current);
      if (uniqueCurrent.includes(role)) return uniqueCurrent;
      if (uniqueCurrent.length >= MAX_ACCOUNT_CREATOR_TYPES) {
        Alert.alert("maximum creator types", `choose up to ${MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.`);
        return uniqueCurrent;
      }
      return [...uniqueCurrent, role];
    });
    setCreatorQuery("");
  }

  function goBack() {
    if (step === 1) return;
    setError(null);
    setStep((current) => (current - 1) as 1 | 2 | 3);
  }

  function continueStep() {
    setError(null);

    if (step === 1) {
      if (!displayName.trim()) {
        setError("add a name to continue");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (creatorTypes.length === 0) {
        setError("choose at least one creator type");
        return;
      }
      setStep(3);
    }
  }

  async function finish() {
    if (!displayName.trim() || creatorTypes.length === 0) {
      setError("add a name and at least one creator type");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nextCreatorTypes = getUniqueStrings(creatorTypes).slice(0, MAX_ACCOUNT_CREATOR_TYPES);
      const nextAvatarUrl = avatarAsset
        ? await uploadNativeProfileAvatar(userId, avatarAsset)
        : avatarUrl;
      const profile = await saveProfile(userId, {
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_types: nextCreatorTypes,
        country: country.trim() || null,
        city: city.trim() || null,
        location: formatProfileLocation(country, city),
        avatar_url: nextAvatarUrl,
        onboarding_complete: true,
        welcome_seen: false,
      });
      setAvatarUrl(nextAvatarUrl);
      setAvatarAsset(null);

      if (profile.early_adopter) {
        await createEarlyAdopterWelcome();
        await fadeAnimatedValue(onboardingExitOpacity, 0, 450);
        onFinished(true);
        return;
      }

      await markWelcomeSeen(userId);
      await fadeAnimatedValue(onboardingExitOpacity, 0, 450);
      onFinished(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Animated.View style={[styles.flex, { opacity: onboardingExitOpacity }]}>
      <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.onboardingHeader}>
          <Pressable
            onPress={goBack}
            disabled={step === 1}
            style={[styles.onboardingBackButton, step === 1 && styles.onboardingBackButtonHidden]}
            accessibilityLabel="go back"
          >
            <Text style={styles.onboardingBackText}>‹</Text>
          </Pressable>
          <Text style={styles.helper}>{step} of 3</Text>
          <View style={styles.onboardingHeaderSpacer} />
        </View>
        <View style={styles.onboardingProgressRow}>
          {[1, 2, 3].map((item) => (
            <View
              key={item}
              style={[styles.onboardingProgressSegment, item <= step && styles.onboardingProgressSegmentActive]}
            />
          ))}
        </View>

        <View style={styles.onboardingStepsViewport}>
          <Animated.View
            style={[
              styles.onboardingStepsTrack,
              { width: viewportWidth * 3, transform: [{ translateX: onboardingSlideX }] },
            ]}
          >
            <ScrollView
              style={styles.onboardingStepPanel}
              contentContainerStyle={styles.onboardingContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.logoSmall}>jam.</Text>
              <Text style={styles.h1}>whats your name?</Text>
              <Text style={styles.copy}>tell us what you want to go by.</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="display name"
                placeholderTextColor="#71717a"
                style={styles.input}
              />
            </ScrollView>

            <ScrollView
              style={styles.onboardingStepPanel}
              contentContainerStyle={styles.onboardingContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.h1}>who are you?</Text>
              <Text style={styles.copy}>pick your creator type, add a bio, and set your location.</Text>

              <SectionLabel label={`creator types (${creatorTypes.length}/${MAX_ACCOUNT_CREATOR_TYPES})`} />
              <Text style={styles.helper}>choose up to {MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.</Text>
              <ChipRow
                items={creatorTypes}
                onRemove={(item) => setCreatorTypes((current) => current.filter((role) => role !== item))}
              />
              <TextInput
                value={creatorQuery}
                onChangeText={setCreatorQuery}
                placeholder="search creator type"
                placeholderTextColor="#71717a"
                style={styles.input}
              />
              <SuggestionList
                items={creatorSuggestions}
                maxVisibleItems={3}
                onPick={(role) => {
                  addCreatorType(role);
                }}
              />

              <SectionLabel label="bio" />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="short bio, optional"
                placeholderTextColor="#71717a"
                style={[styles.input, styles.textArea]}
                multiline
                maxLength={150}
              />

              <SectionLabel label="location" />
              <ProfileLocationPicker
                country={country}
                city={city}
                query={locationQuery}
                onQueryChange={setLocationQuery}
                onChange={(nextCountry, nextCity) => {
                  setCountry(nextCountry);
                  setCity(nextCity);
                }}
              />
            </ScrollView>

            <ScrollView
              style={styles.onboardingStepPanel}
              contentContainerStyle={styles.onboardingPhotoContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.onboardingPhotoIntro}>
                <Text style={[styles.h1, styles.onboardingPhotoTitle]}>profile pic</Text>
                <Text style={[styles.copy, styles.onboardingPhotoCopy]}>
                  optional. add a photo so collaborators can recognize you.
                </Text>
              </View>
              <View style={styles.onboardingAvatarPicker}>
                <Avatar uri={avatarUrl} size={200} />
                <View style={styles.onboardingAvatarActions}>
                  <Pressable style={styles.onboardingAvatarActionButton} onPress={() => void pickAvatarFromCamera()}>
                    <Text style={styles.onboardingAvatarActionText}>take photo</Text>
                  </Pressable>
                  <Pressable style={styles.onboardingAvatarActionButton} onPress={() => void pickAvatarFromLibrary()}>
                    <Text style={styles.onboardingAvatarActionText}>choose photo</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <View style={[styles.onboardingFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {step < 3 ? (
            <PrimaryButton label="next" onPress={continueStep} style={styles.onboardingFooterButton} />
          ) : (
            <>
              <PrimaryButton
                label={saving ? "saving..." : "next"}
                disabled={saving}
                onPress={finish}
                style={styles.onboardingFooterButton}
              />
              {!avatarUrl && (
                <Pressable disabled={saving} onPress={finish} style={styles.onboardingSkipButton}>
                  <Text style={styles.onboardingSkipText}>skip for now</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </Animated.View>
  );
}

type WelcomePhase = "intro" | "position" | "messageOne" | "messageTwo";

function WelcomeScreen({
  userId,
  onBack,
  onDone,
}: {
  userId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<WelcomePhase>("intro");
  const [number, setNumber] = useState(1);
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const introOpacity = useRef(new Animated.Value(0)).current;
  const positionOpacity = useRef(new Animated.Value(0)).current;
  const messageOneOpacity = useRef(new Animated.Value(0)).current;
  const messageTwoOpacity = useRef(new Animated.Value(0)).current;
  const introStartedRef = useRef(false);
  const transitioningRef = useRef(false);
  const leavingWelcomeRef = useRef(false);
  const [welcomeStageHeight, setWelcomeStageHeight] = useState(0);
  const [welcomePositionTextBottom, setWelcomePositionTextBottom] = useState(0);
  const welcomeForwardArrowOffset = 32;
  const welcomeForwardArrowTop =
    welcomeStageHeight > 0 && welcomePositionTextBottom > 0
      ? (welcomePositionTextBottom + welcomeStageHeight) / 2 - welcomeForwardArrowOffset
      : undefined;

  const backButton = (
    <Pressable onPress={() => void handleWelcomeBack()} style={styles.onboardingBackButton} accessibilityLabel="go back">
      <Text style={styles.onboardingBackText}>‹</Text>
    </Pressable>
  );

  useEffect(() => {
    void getSignupPosition(userId).then((position) => {
      setNumber(position);
    });
  }, [userId]);

  useEffect(() => {
    if (introStartedRef.current) return;
    introStartedRef.current = true;

    async function runIntroSequence() {
      await fadeAnimatedValue(screenOpacity, 1, 500);
      await fadeAnimatedValue(introOpacity, 1, 420);
      await waitMs(1000);
      await fadeAnimatedValue(introOpacity, 0, 380);
      await fadeAnimatedValue(positionOpacity, 1, 520);
      setPhase("position");
    }

    void runIntroSequence();
  }, [introOpacity, positionOpacity, screenOpacity]);

  async function openMessageOne() {
    if (phase !== "position" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("messageOne");
    messageOneOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(positionOpacity, 0, 360),
      fadeAnimatedValue(messageOneOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  async function goBackToPosition() {
    if (phase !== "messageOne" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("position");
    positionOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(messageOneOpacity, 0, 360),
      fadeAnimatedValue(positionOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  async function openMessageTwo() {
    if (phase !== "messageOne" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("messageTwo");
    messageTwoOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(messageOneOpacity, 0, 360),
      fadeAnimatedValue(messageTwoOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  async function goBackToMessageOne() {
    if (phase !== "messageTwo" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("messageOne");
    messageOneOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(messageTwoOpacity, 0, 360),
      fadeAnimatedValue(messageOneOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  function handleWelcomeTap() {
    if (phase === "position") {
      void openMessageOne();
      return;
    }

    if (phase === "messageOne") {
      void openMessageTwo();
    }
  }

  async function continueToFeed() {
    await markWelcomeSeen(userId);
    onDone();
  }

  async function handleWelcomeBack() {
    if (leavingWelcomeRef.current || transitioningRef.current) return;

    leavingWelcomeRef.current = true;
    transitioningRef.current = true;
    introOpacity.stopAnimation();
    positionOpacity.stopAnimation();
    messageOneOpacity.stopAnimation();
    messageTwoOpacity.stopAnimation();
    screenOpacity.stopAnimation();
    await fadeAnimatedValue(screenOpacity, 0, 300);
    onBack();
  }

  return (
    <Animated.View style={[styles.flex, { opacity: screenOpacity }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.flex}>
          <Pressable
            style={styles.welcomeStage}
            onPress={handleWelcomeTap}
            disabled={phase !== "position" && phase !== "messageOne"}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.welcomeBeat, styles.welcomeBeatLayer, { opacity: introOpacity }]}
            >
              <Text style={styles.welcomeIntroText}>a quick message...</Text>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.welcomeBeat, styles.welcomeBeatLayer, { opacity: positionOpacity }]}
            >
              <View
                style={styles.welcomePositionLayout}
                onLayout={(event) => setWelcomeStageHeight(event.nativeEvent.layout.height)}
              >
                <View style={styles.welcomePositionTextWrap}>
                  <Text
                    style={[styles.h1, styles.welcomePositionText]}
                    onLayout={(event) => {
                      const { y, height } = event.nativeEvent.layout;
                      setWelcomePositionTextBottom(y + height);
                    }}
                  >
                    you are the {ordinal(number)} person to ever have Jam.
                  </Text>
                </View>
                {welcomeForwardArrowTop !== undefined ? (
                  <Text style={[styles.welcomeForwardHint, styles.welcomeForwardHintPositioned, { top: welcomeForwardArrowTop }]}>
                    ›
                  </Text>
                ) : null}
              </View>
            </Animated.View>

            {phase === "position" ? (
              <Pressable style={styles.welcomeBackTapZone} onPress={() => undefined} accessibilityLabel="inactive" />
            ) : null}

            {phase === "messageOne" || phase === "messageTwo" ? (
              <Animated.View
                pointerEvents={phase === "messageOne" ? "auto" : "none"}
                style={[styles.welcomeMessagePage, { opacity: messageOneOpacity }]}
              >
                <View style={styles.welcomeMessageOneLayout}>
                  <View style={styles.welcomeMessageOneTop}>
                    <Text style={[styles.longCopy, styles.welcomeMessageOneCopy]}>
                      This started as an idea from a bedroom — no corporate investors or connections, no starting fan base. You’re joining an empty platform, hopefully because of a passion for creativity, and because you have faith that this could change the game. And that means a lot to me.
                    </Text>
                  </View>
                  <View style={styles.welcomeMessageOneCenter}>
                    <Text style={styles.welcomeCallout}>As a thank you, accept a lifetime of pro features!</Text>
                  </View>
                  <View style={styles.welcomeMessageOneBottom} />
                  {phase === "messageOne" && welcomeForwardArrowTop !== undefined ? (
                    <Text
                      pointerEvents="none"
                      style={[styles.welcomeForwardHint, styles.welcomeForwardHintPositioned, { top: welcomeForwardArrowTop }]}
                    >
                      ›
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.welcomeBackTapZone}
                  onPress={() => void goBackToPosition()}
                  accessibilityLabel="go back"
                />
              </Animated.View>
            ) : null}

            {phase === "messageTwo" ? (
              <Animated.View
                style={[styles.welcomeBeat, styles.welcomeBeatLayer, { opacity: messageTwoOpacity }]}
              >
                <View style={styles.welcomeMessageTwoContent}>
                  <Text style={[styles.longCopy, styles.welcomeMessageOneCopy]}>
                    And keep in mind — the feed might be empty to begin with, but as long as people like you continue to have faith, it will grow before our eyes and you will find what you’re looking for. Welcome to Jam.
                  </Text>
                  <PrimaryButton
                    label="start jamming"
                    onPress={() => void continueToFeed()}
                    style={styles.welcomeMessageTwoButton}
                  />
                </View>
                <Pressable
                  style={styles.welcomeBackTapZone}
                  onPress={() => void goBackToMessageOne()}
                  accessibilityLabel="go back"
                />
              </Animated.View>
            ) : null}
          </Pressable>

          {phase === "messageOne" || phase === "messageTwo" ? (
            <View style={styles.welcomeHeaderOverlay}>
              {backButton}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function getFeedRoleFilterOpacity(
  index: number,
  itemWidth: number,
  areaWidth: number,
  scrollX: number,
) {
  if (!itemWidth || !areaWidth) return 1;

  const itemCenter = index * itemWidth + itemWidth / 2;
  const viewportCenter = scrollX + areaWidth / 2;
  const distance = Math.abs(itemCenter - viewportCenter);

  // Soft dissolve as labels leave the centre band. The MaskedView rim handles
  // glyph-level edge fade; this keeps far loop copies from flashing.
  const fadeStart = itemWidth * 0.95;
  const fadeEnd = itemWidth * 1.55;
  if (distance <= fadeStart) return 1;
  if (distance >= fadeEnd) return 0;

  const t = (distance - fadeStart) / (fadeEnd - fadeStart);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

/** Place labels on a large circle so centre sits lowest and sides rise on an arc. */
function getFeedRoleFilterWheelLift(
  index: number,
  itemWidth: number,
  areaWidth: number,
  scrollX: number,
) {
  if (!itemWidth || !areaWidth) return 0;

  const itemCenter = index * itemWidth + itemWidth / 2;
  const viewportCenter = scrollX + areaWidth / 2;
  const x = itemCenter - viewportCenter;
  // Large radius → shallow arch (sides only slightly higher than centre).
  const radius = Math.max(areaWidth * 3.6, itemWidth * 10);
  const clampedX = Math.max(-radius + 1, Math.min(radius - 1, x));
  // Circle centred above the row: y = R - sqrt(R² - x²), then lift upward in RN.
  const lift = radius - Math.sqrt(radius * radius - clampedX * clampedX);
  return -lift;
}

function FeedRoleFilterWheel({
  selectedRoles,
  onSelectRole,
}: {
  selectedRoles: string[];
  onSelectRole: (role: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const itemWidth = areaWidth > 0 ? areaWidth / 3 : 0;
  const loopWidth = FEED_ROLE_FILTER_WHEEL.length * itemWidth;
  const wheelItems = useMemo(
    () =>
      Array.from({ length: FEED_ROLE_FILTER_LOOP_COPIES }, () => FEED_ROLE_FILTER_WHEEL).flat(),
    [],
  );

  useEffect(() => {
    if (!itemWidth) return;
    scrollRef.current?.scrollTo({ x: loopWidth, animated: false });
    setScrollX(loopWidth);
  }, [itemWidth, loopWidth]);

  function handleWheelScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setScrollX(event.nativeEvent.contentOffset.x);
  }

  function normalizeWheelOffset(offsetX: number) {
    if (!itemWidth || !loopWidth) return offsetX;

    let nextOffset = offsetX;
    if (nextOffset <= loopWidth * 0.5) {
      nextOffset += loopWidth;
    } else if (nextOffset >= loopWidth * 2.5) {
      nextOffset -= loopWidth;
    }
    return nextOffset;
  }

  function normalizeWheelScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!itemWidth) return;

    const offsetX = normalizeWheelOffset(event.nativeEvent.contentOffset.x);
    if (offsetX !== event.nativeEvent.contentOffset.x) {
      scrollRef.current?.scrollTo({ x: offsetX, animated: false });
    }
    setScrollX(offsetX);
  }

  function selectRoleAtIndex(label: string, index: number) {
    const isAlreadySelected = selectedRoles.some(
      (role) => role.toLowerCase() === label.toLowerCase(),
    );
    onSelectRole(label);

    // Rotate the tapped option into the centre; scroll events drive the wheel lift.
    if (isAlreadySelected || !itemWidth) return;

    const targetScroll = normalizeWheelOffset((index - 1) * itemWidth);
    scrollRef.current?.scrollTo({ x: targetScroll, animated: true });
  }

  return (
    <View
      style={styles.feedRecentFiltersArea}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== areaWidth) setAreaWidth(nextWidth);
      }}
    >
      {itemWidth > 0 && (
        <MaskedView
          style={styles.feedRecentFiltersMask}
          maskElement={
            <View style={styles.feedRecentFiltersMaskElement}>
              <LinearGradient
                colors={["transparent", "#000", "#000", "transparent"]}
                locations={[0, 0.14, 0.86, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          }
        >
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={itemWidth}
            disableIntervalMomentum
            scrollEventThrottle={16}
            onScroll={handleWheelScroll}
            onMomentumScrollEnd={normalizeWheelScroll}
            onScrollEndDrag={normalizeWheelScroll}
            contentContainerStyle={styles.feedRecentFiltersRow}
          >
            {wheelItems.map((label, index) => {
              const isActive = selectedRoles.some(
                (role) => role.toLowerCase() === label.toLowerCase(),
              );
              const itemOpacity = getFeedRoleFilterOpacity(index, itemWidth, areaWidth, scrollX);
              const wheelLift = getFeedRoleFilterWheelLift(index, itemWidth, areaWidth, scrollX);

              return (
                <Pressable
                  key={`${label}-${index}`}
                  style={[
                    styles.feedRecentFilterItem,
                    {
                      width: itemWidth,
                      opacity: itemOpacity,
                      transform: [{ translateY: wheelLift }],
                    },
                  ]}
                  onPress={() => selectRoleAtIndex(label, index)}
                  hitSlop={8}
                  disabled={itemOpacity < 0.12}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.feedRecentFilterText, isActive && styles.feedRecentFilterTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </MaskedView>
      )}
    </View>
  );
}

function DiscoverScreen({
  userId,
  viewerProfile,
  shuffleSignal,
  savedVideoController,
  showBootOverlay = true,
  feedChromeOpacity,
  onFeedChromeClearChange,
  onCreate,
  onInboxChanged,
  onBootReady,
  onViewerProfileUpdated,
}: {
  userId: string;
  viewerProfile: Profile | null;
  shuffleSignal: number;
  savedVideoController: SavedVideoController;
  showBootOverlay?: boolean;
  feedChromeOpacity: Animated.Value;
  onFeedChromeClearChange?: (clear: boolean) => void;
  onCreate: () => void;
  onInboxChanged: () => void;
  onBootReady?: () => void;
  onViewerProfileUpdated?: (profile: Profile) => void;
}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [lookingForActive, setLookingForActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<FeedVideo | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [firstClipReady, setFirstClipReady] = useState(!showBootOverlay);
  const [initialBootComplete, setInitialBootComplete] = useState(!showBootOverlay);
  const [feedCursor, setFeedCursor] = useState<FeedCursor | null>(null);
  const [feedPhase, setFeedPhase] = useState<FeedPhase>("unseen");
  const [filterFillActive, setFilterFillActive] = useState(false);
  const [feedQueryReloading, setFeedQueryReloading] = useState(false);
  const [feedBridge, setFeedBridge] = useState<FeedVideo[]>([]);
  /** Remounts FlatList when the server query key changes so paused players can't stick. */
  const [feedListKey, setFeedListKey] = useState("boot");
  const [replayToastVisible, setReplayToastVisible] = useState(false);
  const initialBootCompleteRef = useRef(!showBootOverlay);
  const feedCursorRef = useRef<FeedCursor | null>(null);
  const feedPhaseRef = useRef<FeedPhase>("unseen");
  const loadingMoreFeedRef = useRef(false);
  const filterFillGenerationRef = useRef(0);
  /** Invalidates in-flight load / load-more when filters or near-me change. */
  const feedReloadGenerationRef = useRef(0);
  const itemsRef = useRef<FeedVideo[]>([]);
  const listRef = useRef<FlatList<FeedVideo>>(null);
  const feedQueryKeyRef = useRef<string | null>(null);
  const markedSeenVideoIdsRef = useRef<Set<string>>(new Set());
  const replayToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayToastOpacity = useRef(new Animated.Value(0)).current;
  const [feedChromeHolding, setFeedChromeHolding] = useState(false);
  const [feedChromeLocked, setFeedChromeLocked] = useState(false);
  const [feedSpeedHolding, setFeedSpeedHolding] = useState(false);
  /** User-toggled pause for the active clip — survives tab switches / cell recycle. */
  const [userPausedVideoId, setUserPausedVideoId] = useState<string | null>(null);
  const feedChromeLockedRef = useRef(false);
  const discoverFocusedRef = useRef(isFocused);
  const resumeFeedVideoIdRef = useRef<string | null>(null);
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const feedPrefetchTarget = FEED_PAGE_SIZE * 4;

  const nearMeRadiusMiles = normalizeNearMeRadius(viewerProfile?.near_me_radius_miles);
  const filterState = useMemo<FeedFilterState>(
    () => ({
      roles,
      genres,
      location,
      nearMeActive,
      lookingForActive,
      userLocation,
      nearMeRadiusMiles,
    }),
    [genres, location, lookingForActive, nearMeActive, nearMeRadiusMiles, roles, userLocation],
  );
  const filterStateRef = useRef(filterState);
  filterStateRef.current = filterState;
  itemsRef.current = items;
  const filtersActive = isFeedFilterStateActive(filterState);
  const activeFilterTags = useMemo(() => {
    const tags = new Set<string>();
    for (const role of roles) {
      const normalized = normalizeVideoTag(role);
      if (normalized) tags.add(normalized);
    }
    for (const genre of genres) {
      const normalized = normalizeVideoTag(genre);
      if (normalized) tags.add(normalized);
    }
    return tags;
  }, [genres, roles]);

  const hideReplayToast = useCallback(() => {
    if (replayToastHideTimerRef.current) {
      clearTimeout(replayToastHideTimerRef.current);
      replayToastHideTimerRef.current = null;
    }
    replayToastOpacity.stopAnimation();
    Animated.timing(replayToastOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setReplayToastVisible(false);
    });
  }, [replayToastOpacity]);

  const showReplayToast = useCallback(() => {
    if (replayToastHideTimerRef.current) {
      clearTimeout(replayToastHideTimerRef.current);
      replayToastHideTimerRef.current = null;
    }
    replayToastOpacity.stopAnimation();
    replayToastOpacity.setValue(0);
    setReplayToastVisible(true);
    // Defer fade-in until after mount — same-tick timing often paints at full opacity.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Animated.timing(replayToastOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });
    replayToastHideTimerRef.current = setTimeout(() => {
      hideReplayToast();
    }, 2400);
  }, [hideReplayToast, replayToastOpacity]);

  useEffect(() => {
    return () => {
      if (replayToastHideTimerRef.current) clearTimeout(replayToastHideTimerRef.current);
    };
  }, []);

  const animateFeedChrome = useCallback(
    (visible: boolean) => {
      feedChromeOpacity.stopAnimation();
      Animated.timing(feedChromeOpacity, {
        toValue: visible ? 1 : 0,
        duration: FEED_CHROME_FADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [feedChromeOpacity],
  );

  const restoreFeedChrome = useCallback(() => {
    feedChromeLockedRef.current = false;
    setFeedChromeLocked(false);
    setFeedChromeHolding(false);
    animateFeedChrome(true);
    onFeedChromeClearChange?.(false);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeHoldStart = useCallback(() => {
    if (feedChromeLockedRef.current) return;
    setFeedChromeHolding(true);
    animateFeedChrome(false);
    onFeedChromeClearChange?.(true);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeHoldEnd = useCallback(() => {
    setFeedChromeHolding(false);
    if (feedChromeLockedRef.current) return;
    animateFeedChrome(true);
    onFeedChromeClearChange?.(false);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeLock = useCallback(() => {
    feedChromeLockedRef.current = true;
    setFeedChromeLocked(true);
    setFeedChromeHolding(false);
    animateFeedChrome(false);
    onFeedChromeClearChange?.(true);
  }, [animateFeedChrome, onFeedChromeClearChange]);

  const handleFeedChromeUnlock = useCallback(() => {
    restoreFeedChrome();
  }, [restoreFeedChrome]);

  const handleFeedSpeedHoldStart = useCallback(() => {
    setFeedSpeedHolding(true);
  }, []);

  const handleFeedSpeedHoldEnd = useCallback(() => {
    setFeedSpeedHolding(false);
  }, []);

  useEffect(() => {
    if (filtersOpen || activeProfile || activeChat || activeDm) {
      restoreFeedChrome();
    }
  }, [activeChat, activeDm, activeProfile, filtersOpen, restoreFeedChrome]);

  const setDiscoverFeedPhase = useCallback((phase: FeedPhase) => {
    feedPhaseRef.current = phase;
    setFeedPhase(phase);
  }, []);

  const fetchDiscoverPage = useCallback(
    async (cursor?: FeedCursor | null, phase?: FeedPhase) => {
      const filters = filterStateRef.current;
      const contentFilters = toFeedContentFilters(filters);
      const activePhase = phase ?? feedPhaseRef.current;
      if (filters.nearMeActive && filters.userLocation) {
        return fetchNearbyFeedVideos(userId, {
          latitude: filters.userLocation.latitude,
          longitude: filters.userLocation.longitude,
          radiusMiles: filters.nearMeRadiusMiles,
          cursor: cursor ?? null,
          limit: FEED_PAGE_SIZE,
          roles: contentFilters.roles,
          genres: contentFilters.genres,
          phase: activePhase,
          lookingForOnly: filters.lookingForActive,
        });
      }
      return fetchFeedVideos(userId, {
        cursor: cursor ?? null,
        limit: FEED_PAGE_SIZE,
        filters: contentFilters,
        phase: activePhase,
      });
    },
    [userId],
  );

  const markFeedVideoSeen = useCallback(
    (videoId: string) => {
      if (!videoId || markedSeenVideoIdsRef.current.has(videoId)) return;
      markedSeenVideoIdsRef.current.add(videoId);
      void markVideoSeen(userId, videoId).catch(() => {
        markedSeenVideoIdsRef.current.delete(videoId);
      });
    },
    [userId],
  );

  const enterReplayPhase = useCallback(async () => {
    setDiscoverFeedPhase("replay");
    const page = await fetchDiscoverPage(null, "replay");
    feedCursorRef.current = page.nextCursor;
    setFeedCursor(page.nextCursor);
    if (page.items.length > 0) {
      showReplayToast();
    }
    return page;
  }, [fetchDiscoverPage, setDiscoverFeedPhase, showReplayToast]);

  function applyFeedFilterPill(role: string) {
    const isAlreadySelected = roles.some(
      (selectedRole) => selectedRole.toLowerCase() === role.toLowerCase(),
    );
    setRoles(isAlreadySelected ? [] : role ? [role] : []);
    setActiveVideoId(null);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }

  async function refreshViewerGpsLocation() {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setUserLocation(nextLocation);
    return nextLocation;
  }

  /** Soft reload: keep the current clip playing until the new page is ready. */
  function beginSoftFeedQueryReload() {
    setFeedQueryReloading(true);
    setDiscoverFeedPhase("unseen");
    feedCursorRef.current = null;
    setFeedCursor(null);
    loadingMoreFeedRef.current = false;
    filterFillGenerationRef.current += 1;
  }

  function commitSoftFeedQueryReload(nextListKey: string, nextItems: FeedVideo[]) {
    itemsRef.current = nextItems;
    setItems(nextItems);
    setFeedBridge([]);
    setUserPausedVideoId(null);
    setFeedListKey(nextListKey);
    setActiveVideoId(nextItems[0]?.id ?? null);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }

  async function toggleNearMe() {
    if (nearMeLoading) return;

    if (nearMeActive) {
      // Keep the current clip playing; the query-key effect swaps when global feed is ready.
      feedQueryKeyRef.current = "near-me-pending-off";
      setNearMeActive(false);
      return;
    }

    const confirmed = await confirmNearMeLiveLocationSharing(userId);
    if (!confirmed) return;

    // Keep the current video playing while GPS + nearby page load.
    // Invalidate the query key so a failed toggle still reloads the global feed.
    feedQueryKeyRef.current = "near-me-pending";
    setNearMeActive(true);
    setNearMeLoading(true);

    try {
      // Near-me filter also turns on live location sharing so others can find you,
      // and so Settings → share live location stays in sync.
      const alreadySharing = await isLiveLocationSharingEnabled(userId);
      if (!alreadySharing) {
        const result = await enableLiveLocationSharing(userId);
        if ("error" in result) {
          setNearMeActive(false);
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          return;
        }

        onViewerProfileUpdated?.(result.profile);
        if (result.profile.live_latitude != null && result.profile.live_longitude != null) {
          setUserLocation({
            latitude: result.profile.live_latitude,
            longitude: result.profile.live_longitude,
          });
        } else {
          await refreshViewerGpsLocation();
        }
        return;
      }

      await refreshViewerGpsLocation();
    } catch (err) {
      setNearMeActive(false);
      Alert.alert(
        "could not get location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
    } finally {
      setNearMeLoading(false);
    }
  }

  const load = useCallback(async (options?: { commit?: boolean }) => {
    const commit = options?.commit !== false;
    const generation = feedReloadGenerationRef.current;
    filterFillGenerationRef.current += 1;
    setFilterFillActive(false);
    setError(null);
    setDiscoverFeedPhase("unseen");
    // Only blank the first-clip gate on the initial boot; later refreshes stay on the feed.
    if (!initialBootCompleteRef.current) setFirstClipReady(false);

    let page = await fetchDiscoverPage(null, "unseen");
    if (generation !== feedReloadGenerationRef.current) return null;

    // Cold start with nothing new → drop straight into replay (toast if clips exist).
    if (page.items.length === 0 && !page.nextCursor) {
      page = await enterReplayPhase();
      if (generation !== feedReloadGenerationRef.current) return null;
    } else {
      feedCursorRef.current = page.nextCursor;
      setFeedCursor(page.nextCursor);
    }

    const nextItems = shuffleVideosWithSpacing(page.items);
    if (generation !== feedReloadGenerationRef.current) return null;
    if (commit) {
      itemsRef.current = nextItems;
      setItems(nextItems);
    }
    return nextItems;
  }, [enterReplayPhase, fetchDiscoverPage, setDiscoverFeedPhase]);

  const loadMoreFeed = useCallback(
    async (options?: { allowReplayTransition?: boolean }) => {
      const allowReplayTransition = options?.allowReplayTransition ?? false;
      if (loadingMoreFeedRef.current) return;
      const generation = feedReloadGenerationRef.current;

      const cursor = feedCursorRef.current;
      if (!cursor) {
        if (!allowReplayTransition || feedPhaseRef.current !== "unseen") return;

        loadingMoreFeedRef.current = true;
        try {
          const page = await enterReplayPhase();
          if (generation !== feedReloadGenerationRef.current) return;
          if (page.items.length === 0) return;

          setItems((current) => {
            if (generation !== feedReloadGenerationRef.current) return current;
            const existingIds = new Set(current.map((item) => item.id));
            const fresh = page.items.filter((item) => !existingIds.has(item.id));
            if (fresh.length === 0) return current;
            const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            return nextItems;
          });
        } catch (err) {
          if (generation === feedReloadGenerationRef.current) {
            setError(err instanceof Error ? err.message : "could not load more");
          }
        } finally {
          if (generation === feedReloadGenerationRef.current) {
            loadingMoreFeedRef.current = false;
          }
        }
        return;
      }

      loadingMoreFeedRef.current = true;
      try {
        let nextCursor: FeedCursor | null = cursor;
        const accumulated: FeedVideo[] = [];
        let rounds = 0;
        const maxRounds = 4;

        while (nextCursor && rounds < maxRounds) {
          if (generation !== feedReloadGenerationRef.current) return;
          const page = await fetchDiscoverPage(nextCursor);
          accumulated.push(...page.items);
          nextCursor = page.nextCursor;
          rounds += 1;
          if (!page.nextCursor) break;
          if (accumulated.length >= FEED_PAGE_SIZE) break;
        }

        if (generation !== feedReloadGenerationRef.current) return;

        feedCursorRef.current = nextCursor;
        setFeedCursor(nextCursor);

        if (accumulated.length > 0) {
          setItems((current) => {
            if (generation !== feedReloadGenerationRef.current) return current;
            const existingIds = new Set(current.map((item) => item.id));
            const fresh = accumulated.filter((item) => !existingIds.has(item.id));
            if (fresh.length === 0) return current;
            const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            return nextItems;
          });
        }

        // User-driven: unseen pool just ended — continue into replay.
        if (
          allowReplayTransition &&
          !nextCursor &&
          feedPhaseRef.current === "unseen" &&
          accumulated.length < FEED_PAGE_SIZE
        ) {
          const replayPage = await enterReplayPhase();
          if (generation !== feedReloadGenerationRef.current) return;
          if (replayPage.items.length === 0) return;
          setItems((current) => {
            if (generation !== feedReloadGenerationRef.current) return current;
            const existingIds = new Set(current.map((item) => item.id));
            const fresh = replayPage.items.filter((item) => !existingIds.has(item.id));
            if (fresh.length === 0) return current;
            const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            return nextItems;
          });
        }
      } catch (err) {
        if (generation === feedReloadGenerationRef.current) {
          setError(err instanceof Error ? err.message : "could not load more");
        }
      } finally {
        if (generation === feedReloadGenerationRef.current) {
          loadingMoreFeedRef.current = false;
        }
      }
    },
    [enterReplayPhase, fetchDiscoverPage],
  );

  const fillFeedForActiveFilters = useCallback(async () => {
    const generation = ++filterFillGenerationRef.current;
    setFilterFillActive(true);

    try {
      for (let wait = 0; wait < 40 && loadingMoreFeedRef.current; wait += 1) {
        if (generation !== filterFillGenerationRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      if (generation !== filterFillGenerationRef.current) return;

      const filters = filterStateRef.current;
      if (!isFeedFilterStateActive(filters)) return;
      if (filters.nearMeActive && !filters.userLocation) return;
      if (!feedCursorRef.current || loadingMoreFeedRef.current) return;
      if (itemsRef.current.some((item) => feedVideoMatchesFilters(item, filters))) return;

      loadingMoreFeedRef.current = true;
      try {
        // Server already returns matching pages; a short walk covers residual thinning.
        let rounds = 0;
        while (feedCursorRef.current && rounds < 4) {
          if (generation !== filterFillGenerationRef.current) return;

          const page = await fetchDiscoverPage(feedCursorRef.current);

          feedCursorRef.current = page.nextCursor;
          setFeedCursor(page.nextCursor);

          if (page.items.length === 0) break;

          const existingIds = new Set(itemsRef.current.map((item) => item.id));
          const fresh = page.items.filter((item) => !existingIds.has(item.id));
          if (fresh.length > 0) {
            const nextItems = [...itemsRef.current, ...shuffleVideosWithSpacing(fresh)];
            itemsRef.current = nextItems;
            setItems(nextItems);

            const currentFilters = filterStateRef.current;
            if (nextItems.some((item) => feedVideoMatchesFilters(item, currentFilters))) {
              break;
            }
          }

          if (!page.nextCursor) break;
          rounds += 1;
        }
      } catch (err) {
        if (generation === filterFillGenerationRef.current) {
          setError(err instanceof Error ? err.message : "could not load more");
        }
      } finally {
        loadingMoreFeedRef.current = false;
      }
    } finally {
      if (generation === filterFillGenerationRef.current) {
        setFilterFillActive(false);
      }
    }
  }, [fetchDiscoverPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      feedQueryKeyRef.current = buildDiscoverFeedQueryKey(filterStateRef.current);
      void load()
        .catch((err) => setError(err instanceof Error ? err.message : "could not load feed"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Reload when near-me mode/center/radius OR role/genre/location filters change —
  // server query params changed, so start a fresh filtered page (client filter still
  // thins anything already bridged on screen).
  useEffect(() => {
    if (nearMeLoading) return;
    if (nearMeActive && !userLocation) return;

    const nextKey = buildDiscoverFeedQueryKey(filterState);

    if (feedQueryKeyRef.current === null) {
      feedQueryKeyRef.current = nextKey;
      setFeedListKey(nextKey);
      return;
    }
    if (feedQueryKeyRef.current === nextKey) return;
    feedQueryKeyRef.current = nextKey;

    feedReloadGenerationRef.current += 1;
    const generation = feedReloadGenerationRef.current;
    loadingMoreFeedRef.current = false;
    filterFillGenerationRef.current += 1;

    if (replayToastHideTimerRef.current) {
      clearTimeout(replayToastHideTimerRef.current);
      replayToastHideTimerRef.current = null;
    }
    replayToastOpacity.setValue(0);
    setReplayToastVisible(false);

    // Keep the current clip playing; swap the list only once the new page is ready.
    beginSoftFeedQueryReload();

    void load({ commit: false })
      .then((nextItems) => {
        if (generation !== feedReloadGenerationRef.current) return;
        if (!nextItems) return;
        commitSoftFeedQueryReload(nextKey, nextItems);
      })
      .catch((err) => {
        if (generation === feedReloadGenerationRef.current) {
          setError(err instanceof Error ? err.message : "could not load feed");
        }
      })
      .finally(() => {
        if (generation === feedReloadGenerationRef.current) {
          setFeedQueryReloading(false);
        }
      });
  }, [filterState, load, nearMeActive, nearMeLoading, replayToastOpacity, setDiscoverFeedPhase, userLocation]);

  useEffect(() => {
    if (shuffleSignal === 0) return;
    restoreFeedChrome();
    const frame = requestAnimationFrame(() => {
      setItems((current) => {
        const nextItems = shuffleVideosWithSpacing(current);
        itemsRef.current = nextItems;
        return nextItems;
      });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [restoreFeedChrome, shuffleSignal]);

  const itemsWithSavedState = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        savedByMe: savedVideoIds.has(item.id),
      })),
    [items, savedVideoIds],
  );

  const filtered = useMemo(
    () => itemsWithSavedState.filter((item) => feedVideoMatchesFilters(item, filterState)),
    [filterState, itemsWithSavedState],
  );

  const feedModeSwitching = nearMeLoading || feedQueryReloading;

  const searchingForFilterMatches =
    filtered.length === 0 &&
    (loading ||
      filterFillActive ||
      feedQueryReloading ||
      nearMeLoading ||
      (nearMeActive && !userLocation) ||
      (filtersActive && Boolean(feedCursor)));

  // Keep the last non-empty feed on screen while filter paging / mode switch catches up.
  const holdingFilterBridge =
    searchingForFilterMatches && feedBridge.length > 0 && !loading;
  /**
   * Poster-only bridge for empty-result filter fills. Soft query reloads
   * (Near Me, etc.) keep the live player mounted until the new page commits.
   */
  const suspendFeedVideo =
    holdingFilterBridge || (feedQueryReloading && filtered.length === 0 && feedBridge.length > 0);

  const visibleFeed = filtered.length > 0 ? filtered : holdingFilterBridge ? feedBridge : [];
  const wasHoldingFilterBridgeRef = useRef(false);

  useEffect(() => {
    if (filtered.length > 0) {
      setFeedBridge(filtered);
      return;
    }
    if (!searchingForFilterMatches) {
      setFeedBridge([]);
    }
  }, [filtered, searchingForFilterMatches]);

  useEffect(() => {
    if (holdingFilterBridge) {
      wasHoldingFilterBridgeRef.current = true;
      return;
    }
    if (!wasHoldingFilterBridgeRef.current || filtered.length === 0) return;
    wasHoldingFilterBridgeRef.current = false;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [filtered.length, holdingFilterBridge]);

  useEffect(() => {
    if (loading || nearMeLoading) return;
    if (!filtersActive) return;
    if (nearMeActive && !userLocation) return;
    if (filtered.length > 0) return;
    if (!feedCursor) return;
    void fillFeedForActiveFilters();
  }, [
    feedCursor,
    fillFeedForActiveFilters,
    filtered.length,
    filtersActive,
    genres,
    loading,
    location,
    nearMeActive,
    nearMeLoading,
    roles,
    userLocation,
  ]);

  // Quietly keep several pages buffered so filter changes usually hit matches immediately.
  useEffect(() => {
    if (loading || filterFillActive) return;
    if (!feedCursor) return;
    if (filtersActive && filtered.length === 0) return;
    if (items.length >= feedPrefetchTarget) {
      if (!(filtersActive && filtered.length > 0 && filtered.length < Math.min(FEED_PAGE_SIZE, 6))) {
        return;
      }
    }
    void loadMoreFeed();
  }, [
    feedCursor,
    feedPrefetchTarget,
    filterFillActive,
    filtered.length,
    filtersActive,
    items.length,
    loadMoreFeed,
    loading,
  ]);

  useEffect(() => {
    if (loading) return;
    if (visibleFeed.length === 0) {
      setFirstClipReady(true);
      return;
    }
    // Don't block the feed forever if the first clip is slow/unavailable.
    const timer = setTimeout(() => setFirstClipReady(true), 2500);
    return () => clearTimeout(timer);
  }, [visibleFeed.length, loading]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // Don't revive playback on the poster-only bridge — wait for the new page.
      if (suspendFeedVideo) {
        setActiveVideoId(null);
        return;
      }

      if (visibleFeed.length === 0) {
        setActiveVideoId(null);
        return;
      }

      // When real filter matches arrive, jump to the first match instead of staying on the bridge.
      if (filtered.length > 0) {
        setActiveVideoId((current) =>
          current && filtered.some((item) => item.id === current) ? current : filtered[0].id,
        );
        return;
      }

      setActiveVideoId((current) =>
        current && visibleFeed.some((item) => item.id === current) ? current : visibleFeed[0].id,
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [filtered, suspendFeedVideo, visibleFeed]);

  async function refresh() {
    setRefreshing(true);
    if (nearMeActive) {
      try {
        await refreshViewerGpsLocation();
      } catch {
        // Keep the previous center point if GPS refresh fails.
      }
    }
    await load().catch((err) => setError(err instanceof Error ? err.message : "could not refresh"));
    setRefreshing(false);
  }

  async function toggleSave(item: FeedVideo, nextSaved: boolean) {
    return setVideoSaved(item.id, nextSaved);
  }

  function removeCreatorFromFeed(creatorUserId: string) {
    setItems((current) => {
      const nextItems = current.filter((entry) => entry.userId !== creatorUserId);
      itemsRef.current = nextItems;
      return nextItems;
    });
    setActiveProfile((current) => (current?.userId === creatorUserId ? null : current));
    setActiveDm((current) => (current?.userId === creatorUserId ? null : current));
  }

  function hideFeedCreator(item: FeedVideo) {
    removeCreatorFromFeed(item.userId);
    void hideCreator(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not hide creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function blockFeedCreator(item: FeedVideo) {
    removeCreatorFromFeed(item.userId);
    void blockUser(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not block creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function submitFeedReport(item: FeedVideo, reason: ReportReason) {
    if (reportSubmitting) return;

    setReportSubmitting(true);
    void reportVideo({
      reporterId: userId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setReportItem(null);
        setError("report submitted");
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setReportSubmitting(false));
  }

  function openJamThread(item: FeedVideo) {
    // A jar on a video always composes a message about that video. Full threads
    // remain available from inbox and the creator's profile.
    setActiveProfile(null);
    setActiveDm(item);
  }

  function openJamFromProfile(item: FeedVideo) {
    openJamThread(item);
  }

  const navBarHeight = getNavBarHeight(insets.bottom);
  // Page height matches the visible feed above the tab bar so the next video
  // sits flush under the current one (as if waiting behind the nav). pagingEnabled
  // still snaps by the list viewport, which is constrained to this same height.
  const feedItemHeight = viewportHeight - navBarHeight;

  function updateActiveVideo(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / feedItemHeight);
    const safeIndex = Math.max(0, Math.min(nextIndex, visibleFeed.length - 1));
    const nextItem = visibleFeed[safeIndex];
    if (nextItem) {
      if (activeVideoId && activeVideoId !== nextItem.id) {
        setUserPausedVideoId(null);
      }
      setActiveVideoId(nextItem.id);
      resumeFeedVideoIdRef.current = nextItem.id;
    }
    // Prefetch the next page before the end-of-feed footer, like TikTok.
    // Only hand off to replay when the user is actually near the last clips.
    if (safeIndex >= visibleFeed.length - 3) {
      void loadMoreFeed({
        allowReplayTransition: !feedCursorRef.current || safeIndex >= visibleFeed.length - 2,
      });
    }
  }

  // Keep the feed playing under the jam compose sheet; pause for profiles/chats/filters.
  // Keep the active clip playing under the filter sheet — only pause for
  // full-screen routes / filter-wheel bridge holds.
  const shouldPlayFeedVideos =
    isFocused && !activeProfile && !activeChat && !suspendFeedVideo;

  // Remember the clip on blur; restore active id on focus without scrolling.
  // Forced scrollToOffset remounts the cell and flashes black over the video.
  useEffect(() => {
    const wasFocused = discoverFocusedRef.current;
    discoverFocusedRef.current = isFocused;

    if (!isFocused) {
      if (wasFocused) {
        if (activeVideoId) resumeFeedVideoIdRef.current = activeVideoId;
        restoreFeedChrome();
        setFeedSpeedHolding(false);
      }
      return;
    }

    if (wasFocused) return;

    const resumeId = resumeFeedVideoIdRef.current ?? activeVideoId;
    if (!resumeId) return;
    if (!visibleFeed.some((item) => item.id === resumeId)) return;
    if (activeVideoId !== resumeId) {
      setActiveVideoId(resumeId);
    }
  }, [activeVideoId, isFocused, restoreFeedChrome, visibleFeed]);
  const activeProfilePreload = useMemo(
    () =>
      activeProfile
        ? feedItemToPreloadedProfile(activeProfile, itemsWithSavedState)
        : null,
    [activeProfile, itemsWithSavedState],
  );

  // jam. covers the feed only on cold app open — not after login/signup.
  const showFeedBootOverlay =
    showBootOverlay &&
    !initialBootComplete &&
    (loading || (!firstClipReady && visibleFeed.length > 0 && !error));

  useEffect(() => {
    if (showFeedBootOverlay || initialBootComplete) return;
    initialBootCompleteRef.current = true;
    setInitialBootComplete(true);
    onBootReady?.();
  }, [initialBootComplete, onBootReady, showFeedBootOverlay]);

  const feedChromeInteractive = !feedChromeHolding && !feedChromeLocked;

  return (
    <View style={darkStyles.feedRoot}>
      <Animated.View
        pointerEvents={feedChromeInteractive ? "box-none" : "none"}
        style={[styles.feedTopBar, { top: insets.top + 12, opacity: feedChromeOpacity }]}
      >
        <Pressable
          style={[styles.feedNearMeButton, nearMeActive && styles.feedNearMeButtonActive]}
          accessibilityLabel={nearMeActive ? "near me on, sharing live location" : "near me"}
          accessibilityHint="turns on share live location to find creators nearby"
          accessibilityRole="button"
          accessibilityState={{ selected: nearMeActive, busy: feedModeSwitching }}
          onPress={() => void toggleNearMe()}
        >
          {feedModeSwitching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <NearMeIcon active={nearMeActive} />
          )}
        </Pressable>
        <FeedRoleFilterWheel selectedRoles={roles} onSelectRole={applyFeedFilterPill} />
        <Pressable onPress={() => setFiltersOpen(true)} style={styles.feedFilterButton}>
          <FeedFilterIcon />
        </Pressable>
      </Animated.View>
      {error && <Toast text={error} />}
      {replayToastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.feedReplayToast,
            { top: insets.top + 64, opacity: replayToastOpacity },
          ]}
          accessibilityLabel="All new videos watched, replaying seen"
        >
          <Text style={styles.feedReplayToastText}>all new videos watched — replaying seen</Text>
        </Animated.View>
      ) : null}
      {visibleFeed.length === 0 ? (
        searchingForFilterMatches ? (
          <View style={styles.endOfFeedFullscreen}>
            <ActivityIndicator color={getActivityIndicatorColor()} />
            <Text style={[styles.emptyText, { marginTop: 18 }]}>looking for creators...</Text>
          </View>
        ) : (
          <View style={styles.endOfFeedFullscreen}>
            <Text style={styles.emptyText}>
              {getEndOfFeedCopy({
                filtersActive,
                nearMeActive,
                seenEveryone: feedPhase === "replay",
              })}
            </Text>
            {nearMeActive ? null : (
              <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
                <Text style={styles.createNavText}>+</Text>
              </Pressable>
            )}
          </View>
        )
      ) : (
        <View style={{ height: feedItemHeight }}>
          <FlatList
            key={feedListKey}
            ref={listRef}
            data={visibleFeed}
            keyExtractor={(item) => item.id}
            style={{ height: feedItemHeight }}
            pagingEnabled
            scrollEnabled={
              !suspendFeedVideo && !feedModeSwitching && !feedChromeHolding && !feedSpeedHolding
            }
            decelerationRate="fast"
            disableIntervalMomentum
            windowSize={5}
            maxToRenderPerBatch={3}
            initialNumToRender={2}
            getItemLayout={(_, index) => ({
              length: feedItemHeight,
              offset: feedItemHeight * index,
              index,
            })}
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={updateActiveVideo}
            onEndReached={() => {
              if (suspendFeedVideo || feedModeSwitching) return;
              void loadMoreFeed({ allowReplayTransition: true });
            }}
            onEndReachedThreshold={0.8}
            refreshControl={<RefreshControl tintColor={getActivityIndicatorColor()} refreshing={refreshing} onRefresh={refresh} />}
            ListFooterComponent={
              feedCursor || suspendFeedVideo || feedPhase === "unseen" ? null : (
                <EndOfFeedState
                  filtersActive={filtersActive}
                  nearMeActive={nearMeActive}
                  seenEveryone
                  height={feedItemHeight}
                  onCreate={onCreate}
                />
              )
            }
            renderItem={({ item }) => (
              <FeedItem
                item={item}
                height={feedItemHeight}
                navBarHeight={0}
                isActive={shouldPlayFeedVideos && item.id === activeVideoId}
                paused={userPausedVideoId === item.id}
                suspendVideo={suspendFeedVideo}
                onPausedChange={(nextPaused) => {
                  setUserPausedVideoId(nextPaused ? item.id : null);
                }}
                activeFilterTags={activeFilterTags}
                chromeOpacity={feedChromeOpacity}
                chromeHolding={feedChromeHolding}
                chromeLocked={feedChromeLocked}
                onChromeHoldStart={handleFeedChromeHoldStart}
                onChromeHoldEnd={handleFeedChromeHoldEnd}
                onChromeLock={handleFeedChromeLock}
                onChromeUnlock={handleFeedChromeUnlock}
                onSpeedHoldStart={handleFeedSpeedHoldStart}
                onSpeedHoldEnd={handleFeedSpeedHoldEnd}
                onFirstPlay={
                  item.id === activeVideoId || item.id === visibleFeed[0]?.id
                    ? () => setFirstClipReady(true)
                    : undefined
                }
                onWatched={() => markFeedVideoSeen(item.id)}
                onOpenProfile={() => setActiveProfile(item)}
                onSave={(nextSaved) => toggleSave(item, nextSaved)}
                onMessage={() => void openJamThread(item)}
                onNotInterested={() => hideFeedCreator(item)}
                onBlock={() => blockFeedCreator(item)}
                onReport={() => setReportItem(item)}
              />
            )}
          />
        </View>
      )}
      {showFeedBootOverlay ? (
        <View pointerEvents="none" style={darkStyles.feedBootOverlay}>
          <LoadingScreen label="finding creators..." logoOnly />
        </View>
      ) : null}
      <FilterSheet
        visible={filtersOpen}
        selectedRoles={roles}
        selectedGenres={genres}
        selectedLocation={location}
        lookingForActive={lookingForActive}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, nextGenres, nextLocation, nextLookingFor) => {
          setRoles(nextRoles);
          setGenres(nextGenres);
          setLocation(nextLocation);
          setLookingForActive(nextLookingFor);
          setActiveVideoId(null);
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: false });
          });
          setFiltersOpen(false);
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        userId={activeProfile?.userId ?? null}
        preloadedProfile={activeProfilePreload}
        savedVideoController={savedVideoController}
        onClose={() => setActiveProfile(null)}
        onMessage={(profileFeedItem) => {
          void openJamFromProfile(profileFeedItem);
        }}
        onJamSent={(sentUserId) => {
          setItems((current) =>
            current.map((entry) =>
              entry.userId === sentUserId ? { ...entry, jammedByMe: true } : entry,
            ),
          );
          setActiveProfile((current) =>
            current?.userId === sentUserId
              ? {
                  ...current,
                  jammedByMe: true,
                  mutual: Boolean(current.jammedMe),
                }
              : current,
          );
        }}
        onInboxChanged={onInboxChanged}
        onUnjammed={(removedUserId) => {
          setItems((current) =>
            current.map((entry) =>
              entry.userId === removedUserId
                ? {
                    ...entry,
                    jammedByMe: false,
                    jammedMe: false,
                    mutual: false,
                  }
                : entry,
            ),
          );
          setActiveProfile((current) =>
            current?.userId === removedUserId ? null : current,
          );
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
          );
          setActiveDm((current) => (current?.userId === removedUserId ? null : current));
          onInboxChanged();
        }}
        onBlocked={(blockedUserId) => {
          removeCreatorFromFeed(blockedUserId);
        }}
      />
      {/*
        All routed profile views use UserProfileModal above. The old discover-specific
        profile implementation was removed from rendering so profile grids/fullscreen
        behavior stays identical across discover, inbox, and DM routes.
      */}
      <ChatModal
        active={activeChat}
        currentUserId={userId}
        savedVideoController={savedVideoController}
        onClose={() => setActiveChat(null)}
        onOpenProfile={(nextUserId) => {
          const profileItem = itemsWithSavedState.find((entry) => entry.userId === nextUserId);
          if (profileItem) {
            setActiveChat(null);
            setActiveProfile(profileItem);
          }
        }}
        onInboxChanged={onInboxChanged}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });

            if (unlocksFromReply) {
              setItems((current) =>
                current.map((entry) =>
                  entry.userId === conversation.userId
                    ? {
                        ...entry,
                        jammedByMe: true,
                        jammedMe: true,
                        mutual: true,
                      }
                    : entry,
                ),
              );
              onInboxChanged();
            }

            await load();
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          setActiveDm(null);
          setActiveProfile(item);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          const recipientUserId = activeDm.userId;
          await sendJamRequest(recipientUserId, body, activeDm.id);
          setItems((current) =>
            current.map((entry) =>
              entry.userId === recipientUserId ? { ...entry, jammedByMe: true } : entry,
            ),
          );
          setActiveDm(null);
          onInboxChanged();
        }}
      />
      <FeedReportModal
        item={reportItem}
        submitting={reportSubmitting}
        onClose={() => setReportItem(null)}
        onSubmit={(reason) => {
          if (reportItem) submitFeedReport(reportItem, reason);
        }}
      />
    </View>
  );
}


function FeedItem({
  item,
  height,
  navBarHeight,
  isActive,
  paused = false,
  suspendVideo = false,
  onPausedChange,
  activeFilterTags,
  chromeOpacity,
  chromeHolding = false,
  chromeLocked = false,
  onChromeHoldStart,
  onChromeHoldEnd,
  onChromeLock,
  onChromeUnlock,
  onSpeedHoldStart,
  onSpeedHoldEnd,
  onFirstPlay,
  onWatched,
  onOpenProfile,
  onSave,
  onMessage,
  onNotInterested,
  onBlock,
  onReport,
}: {
  item: FeedVideo;
  height: number;
  navBarHeight: number;
  isActive: boolean;
  /** Controlled pause — owned by Discover so it survives tab switches. */
  paused?: boolean;
  /** Filter/near-me reload bridge: poster only, no live player (avoids freeze-frames). */
  suspendVideo?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Normalized role/genre tags from the user's discover filters. */
  activeFilterTags?: ReadonlySet<string>;
  chromeOpacity?: Animated.Value;
  chromeHolding?: boolean;
  chromeLocked?: boolean;
  onChromeHoldStart?: () => void;
  onChromeHoldEnd?: () => void;
  onChromeLock?: () => void;
  onChromeUnlock?: () => void;
  onSpeedHoldStart?: () => void;
  onSpeedHoldEnd?: () => void;
  onFirstPlay?: () => void;
  /** Fired once after a short dwell while the clip is actively playing. */
  onWatched?: () => void;
  onOpenProfile: () => void;
  onSave: (nextSaved: boolean) => Promise<boolean>;
  onMessage: () => void;
  onNotInterested: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  const source = getVideoSource(item);
  const posterUri = getFeedPosterSource(item);
  const onFirstPlayRef = useRef(onFirstPlay);
  const onWatchedRef = useRef(onWatched);
  const watchedReportedRef = useRef(false);
  const chromeHoldingRef = useRef(false);
  const speedHoldingRef = useRef(false);
  const chromeSuppressPressRef = useRef(false);
  const chromeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeLockHudHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTouchStartYRef = useRef<number | null>(null);
  const chromeTouchStartXRef = useRef<number | null>(null);
  const chromeTouchInSpeedZoneRef = useRef(false);
  const chromeTouchMovedRef = useRef(false);
  const chromePullProgressRef = useRef(0);
  const speedIndexRef = useRef(FEED_SPEED_DEFAULT_INDEX);
  const speedDragBaseIndexRef = useRef(FEED_SPEED_DEFAULT_INDEX);
  const chromeLockedRef = useRef(chromeLocked);
  const chromeLockHudOpacity = useRef(new Animated.Value(0)).current;
  const speedHudOpacity = useRef(new Animated.Value(0)).current;
  const [chromePullProgress, setChromePullProgress] = useState(0);
  const [chromeLockHudSealed, setChromeLockHudSealed] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(FEED_SPEED_DEFAULT_INDEX);
  const [playbackRate, setPlaybackRate] = useState<FeedPlaybackSpeed>(1);
  const [saved, setSaved] = useState(item.savedByMe);
  const [bufferingState, setBufferingState] = useState(() => ({
    source,
    waitingForFirstPlay: Boolean(source),
  }));
  const [showWaitingSpinner, setShowWaitingSpinner] = useState(false);
  const [mediaContentFit, setMediaContentFit] = useState<VideoContentFit>("cover");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [saveScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const connection = item.mutual ? "jamming" : item.jammedMe ? "jammed you" : null;
  const jamAlreadySent = item.jammedByMe || item.mutual;
  const jamPendingReply = item.jammedByMe && !item.mutual;
  const tags = getUniqueVideoTags([...item.roles, ...item.genres]);
  const visibleTags = tags.length ? tags : getUniqueVideoTags(item.categories);
  const caption = item.caption.trim();
  const actionsBottom = navBarHeight + FEED_ACTION_GAP;
  const chromeInteractive = !chromeHolding && !chromeLocked;
  const overlayOpacity = chromeOpacity ?? 1;

  useEffect(() => {
    onFirstPlayRef.current = onFirstPlay;
  }, [onFirstPlay]);

  useEffect(() => {
    onWatchedRef.current = onWatched;
  }, [onWatched]);

  useEffect(() => {
    watchedReportedRef.current = false;
    speedIndexRef.current = FEED_SPEED_DEFAULT_INDEX;
    setSpeedIndex(FEED_SPEED_DEFAULT_INDEX);
    setPlaybackRate(1);
    speedHudOpacity.setValue(0);
  }, [item.id, speedHudOpacity]);

  useEffect(() => {
    if (posterUri) {
      void Image.prefetch(posterUri);
    }
  }, [posterUri]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSaved(item.savedByMe));
    return () => cancelAnimationFrame(frame);
  }, [item.savedByMe]);

  useEffect(() => {
    setBufferingState({ source, waitingForFirstPlay: Boolean(source) });
    setShowWaitingSpinner(false);
    setMediaContentFit("cover");
  }, [source]);

  useEffect(() => {
    if (!isActive || paused || !source || watchedReportedRef.current) return;
    const timer = setTimeout(() => {
      if (watchedReportedRef.current) return;
      watchedReportedRef.current = true;
      onWatchedRef.current?.();
    }, FEED_SEEN_DWELL_MS);
    return () => clearTimeout(timer);
  }, [isActive, paused, source]);

  useEffect(() => {
    const shouldWait =
      Boolean(source) &&
      isActive &&
      !paused &&
      bufferingState.source === source &&
      bufferingState.waitingForFirstPlay;

    if (!shouldWait) {
      setShowWaitingSpinner(false);
      return;
    }

    // Only show spinner if the poster isn't covering the wait.
    const timer = setTimeout(() => setShowWaitingSpinner(!posterUri), 450);
    return () => clearTimeout(timer);
  }, [bufferingState.source, bufferingState.waitingForFirstPlay, isActive, paused, posterUri, source]);

  useEffect(() => {
    if (bufferingState.source !== source || bufferingState.waitingForFirstPlay) return;
    onFirstPlayRef.current?.();
  }, [bufferingState.source, bufferingState.waitingForFirstPlay, source]);

  useEffect(() => {
    chromeLockedRef.current = chromeLocked;
  }, [chromeLocked]);

  useEffect(() => {
    return () => {
      if (chromeHoldTimerRef.current) {
        clearTimeout(chromeHoldTimerRef.current);
        chromeHoldTimerRef.current = null;
      }
      if (chromeLockHudHideTimerRef.current) {
        clearTimeout(chromeLockHudHideTimerRef.current);
        chromeLockHudHideTimerRef.current = null;
      }
    };
  }, []);

  function clearChromeHoldTimer() {
    if (chromeHoldTimerRef.current) {
      clearTimeout(chromeHoldTimerRef.current);
      chromeHoldTimerRef.current = null;
    }
  }

  function hideChromeLockHud() {
    if (chromeLockHudHideTimerRef.current) {
      clearTimeout(chromeLockHudHideTimerRef.current);
      chromeLockHudHideTimerRef.current = null;
    }
    chromeLockHudOpacity.stopAnimation();
    Animated.timing(chromeLockHudOpacity, {
      toValue: 0,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setChromePullProgress(0);
      setChromeLockHudSealed(false);
      chromePullProgressRef.current = 0;
    });
  }

  function showChromeLockHud() {
    if (chromeLockHudHideTimerRef.current) {
      clearTimeout(chromeLockHudHideTimerRef.current);
      chromeLockHudHideTimerRef.current = null;
    }
    chromePullProgressRef.current = 0;
    setChromePullProgress(0);
    setChromeLockHudSealed(false);
    chromeLockHudOpacity.stopAnimation();
    chromeLockHudOpacity.setValue(0);
    // Same duration/easing as feed chrome fade-out so they crossfade together.
    Animated.timing(chromeLockHudOpacity, {
      toValue: 1,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function applySpeedIndex(nextIndex: number) {
    const clamped = Math.max(0, Math.min(FEED_PLAYBACK_SPEEDS.length - 1, nextIndex));
    speedIndexRef.current = clamped;
    setSpeedIndex(clamped);
    setPlaybackRate(FEED_PLAYBACK_SPEEDS[clamped]);
  }

  function showSpeedHud() {
    speedHudOpacity.stopAnimation();
    speedHudOpacity.setValue(0);
    Animated.timing(speedHudOpacity, {
      toValue: 1,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function hideSpeedHud() {
    speedHudOpacity.stopAnimation();
    Animated.timing(speedHudOpacity, {
      toValue: 0,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function handleFeedTouchStart(locationX: number, pageY: number) {
    clearChromeHoldTimer();
    chromeTouchStartXRef.current = locationX;
    chromeTouchStartYRef.current = pageY;
    chromeTouchMovedRef.current = false;
    chromePullProgressRef.current = 0;
    chromeTouchInSpeedZoneRef.current = locationX >= viewportWidth * FEED_SPEED_ZONE_LEFT_RATIO;
    if (moreMenuOpen) return;
    // Speed scrubber still works while chrome is locked; clear-hold does not re-trigger.
    if (!chromeTouchInSpeedZoneRef.current && chromeLockedRef.current) return;

    chromeHoldTimerRef.current = setTimeout(() => {
      chromeHoldTimerRef.current = null;
      if (chromeTouchMovedRef.current) return;

      if (chromeTouchInSpeedZoneRef.current) {
        speedHoldingRef.current = true;
        speedDragBaseIndexRef.current = speedIndexRef.current;
        applySpeedIndex(speedIndexRef.current);
        showSpeedHud();
        triggerHoldHaptic();
        onSpeedHoldStart?.();
        return;
      }

      if (chromeLockedRef.current) return;
      chromeHoldingRef.current = true;
      showChromeLockHud();
      triggerHoldHaptic();
      onChromeHoldStart?.();
    }, FEED_CHROME_HOLD_MS);
  }

  function handleFeedTouchMove(pageY: number) {
    const startY = chromeTouchStartYRef.current;
    if (startY == null) return;
    const dy = pageY - startY;

    if (!chromeHoldingRef.current && !speedHoldingRef.current) {
      if (Math.abs(dy) > 12) {
        chromeTouchMovedRef.current = true;
        clearChromeHoldTimer();
      }
      return;
    }

    if (speedHoldingRef.current) {
      // Pull up (negative dy) → faster speeds at the top of the pill.
      const nextIndex = Math.round(speedDragBaseIndexRef.current + dy / FEED_SPEED_SEGMENT_PX);
      applySpeedIndex(nextIndex);
      return;
    }

    const progress = Math.min(1, Math.max(0, dy / FEED_CHROME_LOCK_PULL_PX));
    chromePullProgressRef.current = progress;
    setChromePullProgress(progress);
    setChromeLockHudSealed(progress >= 1);
  }

  function handleFeedTouchEnd() {
    clearChromeHoldTimer();
    const wasChromeHolding = chromeHoldingRef.current;
    const wasSpeedHolding = speedHoldingRef.current;
    chromeHoldingRef.current = false;
    speedHoldingRef.current = false;
    chromeTouchStartYRef.current = null;
    chromeTouchStartXRef.current = null;

    if (!wasChromeHolding && !wasSpeedHolding) return;

    chromeSuppressPressRef.current = true;

    if (wasSpeedHolding) {
      hideSpeedHud();
      onSpeedHoldEnd?.();
      return;
    }

    // Fade the lock HUD as soon as the finger lifts, locked or not.
    hideChromeLockHud();

    // Confirm lock only on release, and only if pull reached the bottom.
    if (chromePullProgressRef.current >= 1 && !chromeLockedRef.current) {
      onChromeLock?.();
      return;
    }

    if (!chromeLockedRef.current) {
      onChromeHoldEnd?.();
    }
  }

  function togglePlayback() {
    if (moreMenuOpen) {
      setMoreMenuOpen(false);
      return;
    }
    if (!source) return;
    onPausedChange?.(!paused);
  }

  function handleFeedPress() {
    if (chromeSuppressPressRef.current) {
      chromeSuppressPressRef.current = false;
      return;
    }
    if (chromeLockedRef.current) {
      onChromeUnlock?.();
      return;
    }
    if (chromeHoldingRef.current || speedHoldingRef.current) return;
    togglePlayback();
  }

  function revealFirstFrame() {
    setBufferingState((current) => {
      if (current.source !== source || !current.waitingForFirstPlay) return current;
      return { source, waitingForFirstPlay: false };
    });
  }

  function runSaveAnimation() {
    saveScale.setValue(1);
    Animated.sequence([
      Animated.timing(saveScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(saveScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }


  function runJamShakeAnimation() {
    jamShake.stopAnimation();
    jamShake.setValue(0);
    Animated.sequence([
      Animated.timing(jamShake, {
        toValue: 1,
        duration: 55,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: -1,
        duration: 90,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: 0.7,
        duration: 80,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(jamShake, {
        toValue: 0,
        damping: 8,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function pressJam() {
    if (item.mutual) {
      onMessage();
      return;
    }

    if (jamPendingReply) {
      runJamShakeAnimation();
      return;
    }

    onMessage();
  }

  async function pressSave() {
    const nextSaved = !saved;

    setSaved(nextSaved);
    if (nextSaved) runSaveAnimation();

    const didSave = await onSave(nextSaved);
    if (!didSave) {
      setSaved(!nextSaved);
    }
  }

  function openMoreMenu() {
    setMoreMenuOpen((current) => !current);
  }

  function runMoreMenuAction(action: () => void) {
    setMoreMenuOpen(false);
    action();
  }

  // Match create/camera: cover the feed viewport above the tab bar, not the full screen.
  const feedVideoFrameStyle = [
    styles.feedVideoLayer,
    styles.feedVideoViewportClip,
    { bottom: navBarHeight },
  ];

  return (
    <Pressable
      style={[styles.feedItem, { height }]}
      onPress={handleFeedPress}
      onPressIn={(event) =>
        handleFeedTouchStart(event.nativeEvent.locationX, event.nativeEvent.pageY)
      }
      onTouchMove={(event) => handleFeedTouchMove(event.nativeEvent.pageY)}
      onPressOut={handleFeedTouchEnd}
      delayLongPress={FEED_CHROME_HOLD_MS + 400}
    >
      {source ? (
        <View style={feedVideoFrameStyle}>
          {suspendVideo ? (
            posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Avatar size={90} />
                <Text style={styles.h2}>{item.creatorName}</Text>
              </View>
            )
          ) : (
            <>
              <JamVideoView
                source={source}
                style={StyleSheet.absoluteFill}
                shouldPlay={isActive && !paused}
                isLooping
                isMuted={false}
                volume={1}
                playbackRate={playbackRate}
                onFirstFrameRender={revealFirstFrame}
                onContentFitChange={setMediaContentFit}
              />
              {posterUri && bufferingState.waitingForFirstPlay ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Image
                    source={{ uri: posterUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={mediaContentFit === "contain" ? "contain" : "cover"}
                    onLoad={(event) => {
                      const { width, height } = event.nativeEvent.source;
                      setMediaContentFit(contentFitForVideoSize(width, height));
                    }}
                  />
                </View>
              ) : null}
            </>
          )}
          <VideoPresentationOverlays filter={item.videoFilter} textOverlays={item.textOverlays} />
        </View>
      ) : (
        <View style={feedVideoFrameStyle}>
          <View style={styles.videoPlaceholder}>
          <Avatar size={90} />
          <Text style={styles.h2}>{item.creatorName}</Text>
          </View>
        </View>
      )}
      {source && !suspendVideo && showWaitingSpinner && (
        <View pointerEvents="none" style={[styles.feedBufferingIndicator, { bottom: navBarHeight }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedChromeLockHud,
          {
            opacity: chromeLockHudOpacity,
            // Open-lock circle sits on the jam button's vertical center; track extends down.
            bottom:
              actionsBottom +
              (56 + FEED_ACTION_GAP) * 2 +
              56 / 2 -
              (FEED_CHROME_LOCK_TRACK_TRAVEL + FEED_CHROME_LOCK_CIRCLE_SIZE / 2),
          },
        ]}
      >
        <View
          style={[
            styles.feedChromeLockTrack,
            { height: FEED_CHROME_LOCK_TRACK_TRAVEL + FEED_CHROME_LOCK_CIRCLE_SIZE },
          ]}
        >
          <View style={styles.feedChromeLockPath} />
          <View
            style={[
              styles.feedChromeLockTarget,
              {
                opacity: 0.28 + chromePullProgress * 0.55,
                transform: [{ scale: 0.92 + chromePullProgress * 0.08 }],
              },
            ]}
          >
            <FeedChromeLockIcon open={false} size={18} />
          </View>
          <View
            style={[
              styles.feedChromeLockKnob,
              {
                transform: [{ translateY: chromePullProgress * FEED_CHROME_LOCK_TRACK_TRAVEL }],
              },
            ]}
          >
            <FeedChromeLockIcon open={!chromeLockHudSealed && chromePullProgress < 0.92} size={20} />
          </View>
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedSpeedHud,
          {
            opacity: speedHudOpacity,
            // Center on the full window (feed item stops above the tab bar).
            top: viewportHeight / 2 - FEED_SPEED_PILL_HEIGHT / 2,
            // Center on the action-icon column (56pt buttons at right: 18).
            right: 18 + (56 - FEED_SPEED_PILL_WIDTH) / 2,
          },
        ]}
      >
        <View style={styles.feedSpeedPill}>
          {FEED_PLAYBACK_SPEEDS.map((speed, index) => {
            const selected = index === speedIndex;
            return (
              <View key={speed} style={styles.feedSpeedRow}>
                <Text style={[styles.feedSpeedText, selected && styles.feedSpeedTextSelected]}>
                  {speed}x
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents={chromeInteractive ? "box-none" : "none"}
        style={[styles.feedOverlayLayer, { opacity: overlayOpacity }]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.40)", "rgba(0,0,0,0)"]}
          locations={[0, 1]}
          style={styles.feedTopShade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)"]}
          locations={[0.05, 1]}
          style={[styles.feedBottomShade, { bottom: navBarHeight }]}
        />
        <View style={[styles.feedMeta, { bottom: navBarHeight + 30 }]}>
          <View style={styles.row}>
            <Pressable onPress={onOpenProfile}>
              <Avatar uri={item.avatarUrl} size={52} />
            </Pressable>
            <View style={styles.flex}>
              <View style={styles.row}>
                <Pressable onPress={onOpenProfile}>
                  <Text style={styles.feedName}>{item.creatorName}</Text>
                </Pressable>
                {item.proBadge ? <ProBadge kind={item.proBadge} /> : null}
                {connection && <Text style={styles.badge}>{connection}</Text>}
              </View>
              <Text style={styles.feedRole}>{item.role} - {item.location}</Text>
            </View>
          </View>
          {item.lookingFor || caption ? (
            <View style={styles.feedCaptionRow}>
              {item.lookingFor ? (
                <View style={styles.feedLookingForIcon} accessibilityLabel="looking for collaborators">
                  <LookingForIcon active size={19} shadow />
                </View>
              ) : null}
              {caption ? <Text style={[styles.caption, styles.feedCaptionText]}>{caption}</Text> : null}
            </View>
          ) : null}
          {visibleTags.length > 0 ? (
            <View style={styles.tags}>
              {visibleTags.map((tag, index) => {
                const highlighted = Boolean(activeFilterTags?.has(normalizeVideoTag(tag)));
                return (
                  <Text
                    key={`${tag}-${index}`}
                    style={[styles.tag, highlighted ? styles.tagHighlighted : null]}
                  >
                    {tag}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={[styles.actions, { bottom: actionsBottom }]}>
        <Pressable
          onPress={pressJam}
          style={styles.actionButton}
          accessibilityLabel={
            item.mutual
              ? `Message ${item.creatorName} about this video`
              : jamPendingReply
              ? `Jam already sent to ${item.creatorName}`
              : `Jam with ${item.creatorName}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: jamAlreadySent }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  translateX: jamShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-5, 0, 5],
                  }),
                },
                {
                  rotate: jamShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ["-7deg", "0deg", "7deg"],
                  }),
                },
              ],
            }}
          >
            <JamJarIcon filled={jamAlreadySent} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={() => void pressSave()}
          style={styles.actionButton}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${item.creatorName} from saved` : `Save ${item.creatorName}`}
          accessibilityState={{ selected: saved }}
        >
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <BookmarkIcon filled={saved} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={openMoreMenu}
          style={styles.actionButton}
          accessibilityLabel={`More options for ${item.creatorName}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreMenuOpen }}
        >
          <Text style={[styles.actionText, styles.actionDotsText]}>⋯</Text>
        </Pressable>
      </View>
      </Animated.View>
      <Modal animationType="slide" transparent visible={moreMenuOpen} onRequestClose={() => setMoreMenuOpen(false)}>
        <View style={styles.feedMoreSheetWrap}>
          <Pressable
            style={styles.feedMoreSheetDismiss}
            onPress={() => setMoreMenuOpen(false)}
            accessibilityLabel="Close video options"
          />
          <View style={styles.feedMoreSheetCard}>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => runMoreMenuAction(onNotInterested)}
            >
              <Text style={styles.feedMoreMenuText}>Not interested</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => runMoreMenuAction(onBlock)}
            >
              <Text style={styles.feedMoreMenuDangerText}>Block</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => runMoreMenuAction(onReport)}
            >
              <Text style={styles.feedMoreMenuText}>Report</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

function EndOfFeedState({
  filtersActive,
  nearMeActive,
  seenEveryone = false,
  height,
  onCreate,
}: {
  filtersActive: boolean;
  nearMeActive: boolean;
  seenEveryone?: boolean;
  height: number;
  onCreate: () => void;
}) {
  return (
    <View style={[styles.endOfFeed, { height }]}>
      <Text style={styles.emptyText}>
        {getEndOfFeedCopy({ filtersActive, nearMeActive, seenEveryone })}
      </Text>
      {nearMeActive ? null : (
        <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
          <Text style={styles.createNavText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

function getEndOfFeedCopy({
  filtersActive,
  nearMeActive,
  seenEveryone = false,
}: {
  filtersActive: boolean;
  nearMeActive: boolean;
  seenEveryone?: boolean;
}) {
  if (seenEveryone) {
    if (nearMeActive) return "You've seen everyone nearby — check back soon";
    if (filtersActive) return "You've seen everyone in this filter — check back soon";
    return "You've seen everyone — check back soon for new faces";
  }
  if (nearMeActive) {
    return "No more creators nearby — try expanding your radius in settings";
  }
  return filtersActive
    ? "Try expanding your search — or be one of the first to add to this filter →"
    : "The feed is just getting started — be one of the first faces people see";
}

type FilterSheetSectionKey = "role" | "genre" | "location";

function FilterSheet({
  visible,
  selectedRoles,
  selectedGenres,
  selectedLocation,
  lookingForActive,
  includeGenres = true,
  onClose,
  onApply,
}: {
  visible: boolean;
  selectedRoles: string[];
  selectedGenres: string[];
  selectedLocation: string;
  /** When provided, shows the looking-for control as draft state until apply. */
  lookingForActive?: boolean;
  includeGenres?: boolean;
  onClose: () => void;
  onApply: (roles: string[], genres: string[], location: string, lookingFor: boolean) => void;
}) {
  const showLookingFor = lookingForActive !== undefined;
  const [roles, setRoles] = useState(selectedRoles);
  const [genres, setGenres] = useState(selectedGenres);
  const [lookingForDraft, setLookingForDraft] = useState(Boolean(lookingForActive));
  const [roleQuery, setRoleQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [locationSelections, setLocationSelections] = useState<LocationFilterSelection[]>(() => parseLocationFilter(selectedLocation));
  const [expandedCountries, setExpandedCountries] = useState<string[]>(() => parseLocationFilter(selectedLocation).map((selection) => selection.country));
  const [locationQuery, setLocationQuery] = useState("");
  const [mounted, setMounted] = useState(visible);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const sheetOffscreen = Math.max(viewportHeight, 640);
  const translateY = useRef(new Animated.Value(-sheetOffscreen)).current;
  const shadeOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const openingRef = useRef(false);
  const wasVisibleRef = useRef(visible);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const sectionLayoutsRef = useRef<Partial<Record<FilterSheetSectionKey, { y: number; height: number }>>>({});
  const focusedSectionRef = useRef<FilterSheetSectionKey | null>(null);
  const ensureSectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  function clearEnsureSectionTimer() {
    if (ensureSectionTimerRef.current == null) return;
    clearTimeout(ensureSectionTimerRef.current);
    ensureSectionTimerRef.current = null;
  }

  function ensureSectionVisible(section: FilterSheetSectionKey, delayMs = 0) {
    clearEnsureSectionTimer();
    const run = () => {
      ensureSectionTimerRef.current = null;
      const layout = sectionLayoutsRef.current[section];
      const viewportHeightForScroll = scrollViewportHeightRef.current;
      if (!layout || viewportHeightForScroll <= 0) return;

      const padding = 8;
      const visibleTop = scrollOffsetYRef.current;
      const visibleBottom = visibleTop + viewportHeightForScroll;
      const sectionTop = layout.y;
      const sectionBottom = layout.y + layout.height;
      if (sectionTop >= visibleTop + padding && sectionBottom <= visibleBottom - padding) return;

      const maxScrollY = Math.max(0, sectionBottom - viewportHeightForScroll + padding);
      const targetY = Math.min(Math.max(0, sectionTop - padding), maxScrollY);
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    };

    if (delayMs <= 0) {
      requestAnimationFrame(run);
      return;
    }
    ensureSectionTimerRef.current = setTimeout(run, delayMs);
  }

  function syncDraftFromProps() {
    setRoles(selectedRoles);
    setGenres(includeGenres ? selectedGenres : []);
    setLookingForDraft(Boolean(lookingForActive));
    const nextLocationSelections = parseLocationFilter(selectedLocation);
    setLocationSelections(nextLocationSelections);
    setExpandedCountries(nextLocationSelections.map((selection) => selection.country));
    setLocationQuery("");
    setRoleQuery("");
    setGenreQuery("");
    focusedSectionRef.current = null;
    scrollOffsetYRef.current = 0;
    sectionLayoutsRef.current = {};
  }

  function runOpenAnimation() {
    if (openingRef.current || closingRef.current) return;
    openingRef.current = true;
    translateY.stopAnimation();
    shadeOpacity.stopAnimation();
    translateY.setValue(-sheetOffscreen);
    shadeOpacity.setValue(0);
    // Wait one frame so the off-screen position paints before sliding in.
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(shadeOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) openingRef.current = false;
      });
    });
  }

  function closeWithAnimation(onComplete = onClose) {
    if (closingRef.current) return;
    closingRef.current = true;
    openingRef.current = false;
    translateY.stopAnimation();
    shadeOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -sheetOffscreen,
        duration: 280,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(shadeOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      closingRef.current = false;
      onComplete();
    });
  }

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    const justClosed = !visible && wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (justOpened) {
      closingRef.current = false;
      syncDraftFromProps();
      setMounted(true);
      return;
    }

    if (justClosed && mounted && !closingRef.current) {
      closeWithAnimation(() => onClose());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/close edges only
  }, [visible]);

  useLayoutEffect(() => {
    if (!mounted || !visible || closingRef.current) return;
    runOpenAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when sheet mounts open
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      setKeyboardOffset(0);
      focusedSectionRef.current = null;
      clearEnsureSectionTimer();
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(Math.max(0, viewportHeight - event.endCoordinates.screenY));
      const focused = focusedSectionRef.current;
      if (focused) {
        ensureSectionVisible(focused, Platform.OS === "ios" ? 80 : 40);
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
      focusedSectionRef.current = null;
      clearEnsureSectionTimer();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearEnsureSectionTimer();
    };
  }, [mounted]);

  const roleMatches = useSuggestions(creatorRoles, roleQuery, roles);
  const genreMatches = useSuggestions(musicGenres, genreQuery, genres);
  const countryMatches = useMemo(() => {
    const query = normalizeLocationText(locationQuery);
    return LOCATION_FILTER_COUNTRIES.filter((option) => !query || getCountrySearchText(option).includes(query));
  }, [locationQuery]);
  const selectedLocationCount = locationSelections.reduce((count, selection) => count + Math.max(selection.cities.length, 1), 0);

  function findLocationSelection(country: string) {
    return locationSelections.find((selection) => selection.country === country);
  }

  function toggleCountry(option: LocationCountryOption) {
    setLocationSelections((current) => {
      const existing = current.find((selection) => selection.country === option.country);
      if (existing) return current.filter((selection) => selection.country !== option.country);
      return [...current, { country: option.country, cities: [] }];
    });
    setExpandedCountries((current) =>
      current.includes(option.country)
        ? current.filter((country) => country !== option.country)
        : [...current, option.country],
    );
  }

  function toggleCity(option: LocationCountryOption, city: string) {
    setExpandedCountries((current) => (current.includes(option.country) ? current : [...current, option.country]));
    setLocationSelections((current) => {
      const existing = current.find((selection) => selection.country === option.country);
      if (!existing) return [...current, { country: option.country, cities: [city] }];

      const citySelected = existing.cities.includes(city);
      const nextCities =
        existing.cities.length === 0
          ? [city]
          : citySelected
            ? existing.cities.filter((selectedCity) => selectedCity !== city)
            : [...existing.cities, city];

      if (nextCities.length === 0) return current.filter((selection) => selection.country !== option.country);
      return current.map((selection) =>
        selection.country === option.country ? { ...selection, cities: nextCities } : selection,
      );
    });
  }

  function resetRoles() {
    setRoles([]);
    setRoleQuery("");
  }

  function resetGenres() {
    setGenres([]);
    setGenreQuery("");
  }

  function resetLocations() {
    setLocationSelections([]);
    setExpandedCountries([]);
    setLocationQuery("");
  }

  if (!mounted) return null;

  return (
    <Modal animationType="none" visible={mounted} transparent onRequestClose={() => closeWithAnimation()}>
      <Animated.View style={[styles.modalShade, { opacity: shadeOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeWithAnimation()} />
      </Animated.View>
      <Animated.View
        style={[
          styles.topSheet,
          {
            paddingTop: Math.max(insets.top + 18, 34),
            maxHeight: Math.max(
              320,
              viewportHeight - keyboardOffset - Math.max(insets.bottom + 12, 24),
            ),
            transform: [{ translateY }],
          },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.topSheetScroll}
          contentContainerStyle={styles.topSheetScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onLayout={(event) => {
            scrollViewportHeightRef.current = event.nativeEvent.layout.height;
          }}
          onScroll={(event) => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {showLookingFor ? (
            <View style={styles.filterLookingForRow}>
              <Pressable
                style={styles.filterLookingForControl}
                onPress={() => setLookingForDraft((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel="looking for collaborators"
                accessibilityState={{ selected: lookingForDraft }}
              >
                <Text style={styles.filterLookingForLabel}>looking for?</Text>
                <View
                  style={[
                    styles.filterLookingForIconSlot,
                    lookingForDraft && styles.feedNearMeButtonActive,
                  ]}
                >
                  <LookingForIcon active={lookingForDraft} size={22} />
                </View>
              </Pressable>
            </View>
          ) : null}
          <View
            style={styles.filterSheetSection}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              sectionLayoutsRef.current.role = { y, height };
              if (focusedSectionRef.current === "role") ensureSectionVisible("role");
            }}
          >
            <SectionLabel label="role" light />
            <ChipRow items={roles} onRemove={(item) => setRoles((current) => current.filter((role) => role !== item))} />
            <FilterQueryField
              value={roleQuery}
              onChangeText={setRoleQuery}
              placeholder="type to filter roles..."
              onReset={resetRoles}
              onFocus={() => {
                focusedSectionRef.current = "role";
                ensureSectionVisible("role", Platform.OS === "ios" ? 280 : 120);
              }}
            />
            <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
              setRoles((current) => [...current, role]);
              setRoleQuery("");
            }} />
            <Text style={styles.helper}>{roles.length === 0 ? "no role selection" : ""}</Text>
          </View>
          {includeGenres ? (
            <View
              style={styles.filterSheetSection}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                sectionLayoutsRef.current.genre = { y, height };
                if (focusedSectionRef.current === "genre") ensureSectionVisible("genre");
              }}
            >
              <SectionLabel label="genre" light />
              <ChipRow items={genres} onRemove={(item) => setGenres((current) => current.filter((genre) => genre !== item))} />
              <FilterQueryField
                value={genreQuery}
                onChangeText={setGenreQuery}
                placeholder="type to filter genres..."
                onReset={resetGenres}
                onFocus={() => {
                  focusedSectionRef.current = "genre";
                  ensureSectionVisible("genre", Platform.OS === "ios" ? 280 : 120);
                }}
              />
              <SuggestionList items={genreMatches} maxVisibleItems={3} onPick={(genre) => {
                setGenres((current) => [...current, genre]);
                setGenreQuery("");
              }} />
              <Text style={styles.helper}>{genres.length === 0 ? "no genre selection" : ""}</Text>
            </View>
          ) : null}
          <View
            style={styles.filterSheetSection}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              sectionLayoutsRef.current.location = { y, height };
              if (focusedSectionRef.current === "location") ensureSectionVisible("location");
            }}
          >
            <SectionLabel label="location" light />
            <FilterQueryField
              value={locationQuery}
              onChangeText={setLocationQuery}
              placeholder="search countries..."
              onReset={resetLocations}
              onFocus={() => {
                focusedSectionRef.current = "location";
                ensureSectionVisible("location", Platform.OS === "ios" ? 280 : 120);
              }}
            />
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={[
                styles.locationFilterList,
                { maxHeight: LOCATION_PICKER_VISIBLE_HEIGHT },
              ]}
            >
              {countryMatches.map((option) => {
                const selection = findLocationSelection(option.country);
                const isExpanded = expandedCountries.includes(option.country);
                const isCountrySelected = Boolean(selection && selection.cities.length === 0);
                const isPartiallySelected = Boolean(selection && selection.cities.length > 0);

                return (
                  <View key={option.country} style={styles.locationCountryGroup}>
                    <Pressable style={styles.locationOptionRow} onPress={() => toggleCountry(option)}>
                      <View
                        style={[
                          styles.locationCircle,
                          isCountrySelected && styles.locationCircleSelected,
                          isPartiallySelected && styles.locationCirclePartial,
                        ]}
                      >
                        {isPartiallySelected && <View style={styles.locationCirclePartialFill} />}
                      </View>
                      <Text style={styles.locationCountryText}>{option.country}</Text>
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.locationCityList}>
                        {option.cities.map((city) => {
                          const isCitySelected = Boolean(selection?.cities.includes(city));
                          return (
                            <Pressable key={city} style={styles.locationCityRow} onPress={() => toggleCity(option, city)}>
                              <View style={[styles.locationCityCircle, isCitySelected && styles.locationCircleSelected]} />
                              <Text style={styles.locationCityText}>{city}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.helper}>
              {selectedLocationCount === 0
                ? "no location selection — anywhere"
                : `${selectedLocationCount} location ${selectedLocationCount === 1 ? "selection" : "selections"}`}
            </Text>
          </View>
        </ScrollView>
        <PrimaryButton
          label="apply"
          onPress={() =>
            closeWithAnimation(() =>
              onApply(
                roles,
                includeGenres ? genres : [],
                encodeLocationFilter(locationSelections),
                lookingForDraft,
              ),
            )
          }
        />
      </Animated.View>
    </Modal>
  );
}

function ProfileLocationPicker({
  country,
  city,
  query,
  onQueryChange,
  onChange,
  onSearchFocus,
}: {
  country: string;
  city: string;
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (country: string, city: string) => void;
  onSearchFocus?: () => void;
}) {
  const countryMatches = useMemo(() => {
    const normalizedQuery = normalizeLocationText(query);
    return LOCATION_FILTER_COUNTRIES.filter((option) => !normalizedQuery || getCountrySearchText(option).includes(normalizedQuery));
  }, [query]);
  const selectedLabel = formatProfileLocation(country, city);

  function toggleCountry(option: LocationCountryOption) {
    if (country === option.country && !city) {
      onChange("", "");
      return;
    }

    onChange(option.country, "");
  }

  function toggleCity(option: LocationCountryOption, nextCity: string) {
    if (country === option.country && city === nextCity) {
      onChange(option.country, "");
      return;
    }

    onChange(option.country, nextCity);
  }

  return (
    <View style={styles.profileLocationPicker}>
      <ChipRow items={selectedLabel ? [selectedLabel] : []} onRemove={() => onChange("", "")} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        onFocus={onSearchFocus}
        placeholder="search countries..."
        placeholderTextColor="#71717a"
        style={styles.input}
      />
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={[
          styles.locationFilterList,
          { maxHeight: LOCATION_PICKER_VISIBLE_HEIGHT },
        ]}
      >
        {countryMatches.map((option) => {
          const isSelectedCountry = country === option.country;
          const hasSelectedCity = isSelectedCountry && Boolean(city);

          return (
            <View key={option.country} style={styles.locationCountryGroup}>
              <Pressable style={styles.locationOptionRow} onPress={() => toggleCountry(option)}>
                <View
                  style={[
                    styles.locationCircle,
                    isSelectedCountry && !hasSelectedCity && styles.locationCircleSelected,
                    hasSelectedCity && styles.locationCirclePartial,
                  ]}
                >
                  {hasSelectedCity && <View style={styles.locationCirclePartialFill} />}
                </View>
                <Text style={styles.locationCountryText}>{option.country}</Text>
              </Pressable>
              {isSelectedCountry && (
                <View style={styles.locationCityList}>
                  {option.cities.map((cityOption) => {
                    const isCitySelected = city === cityOption;
                    return (
                      <Pressable key={cityOption} style={styles.locationCityRow} onPress={() => toggleCity(option, cityOption)}>
                        <View style={[styles.locationCityCircle, isCitySelected && styles.locationCircleSelected]} />
                        <Text style={styles.locationCityText}>{cityOption}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.helper}>{selectedLabel ? "city is optional — country-only shows your whole country" : "no selection — anywhere"}</Text>
    </View>
  );
}

function UserProfileModal({
  currentUserId,
  userId,
  preloadedProfile,
  savedVideoController,
  onClose,
  onMessage,
  onInboxChanged,
  onUnjammed,
  onBlocked,
  onJamSent,
  inline,
}: {
  currentUserId: string;
  userId: string | null;
  preloadedProfile?: PreloadedUserProfile | null;
  savedVideoController: SavedVideoController;
  onClose: () => void;
  onMessage: (item: FeedVideo) => void;
  onInboxChanged?: () => void;
  onUnjammed?: (userId: string) => void;
  onBlocked?: (userId: string) => void;
  onJamSent?: (userId: string) => void;
  inline?: boolean;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jammedByMe, setJammedByMe] = useState(false);
  const [jammedMe, setJammedMe] = useState(false);
  const [relationshipOverride, setRelationshipOverride] = useState<{
    userId: string;
    jammedByMe: boolean;
    jammedMe: boolean;
  } | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unjamConfirm, setUnjamConfirm] = useState<{
    kind: "cancel" | "unjam";
    anchor: { x: number; y: number };
  } | null>(null);
  const [notifyConfirmAnchor, setNotifyConfirmAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menuUnjamItemRef = useRef<View>(null);
  const notifyHeaderButtonRef = useRef<View>(null);
  const notifyCollapsedButtonRef = useRef<View>(null);
  const [profileHeaderCollapsed, setProfileHeaderCollapsed] = useState(false);
  const profileLockScrollSyncRef = useRef<(() => void) | null>(null);
  const [notifyOnPost, setNotifyOnPost] = useState(false);
  const [notifyScale] = useState(() => new Animated.Value(1));
  const notifyRequestIdRef = useRef(0);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [jamComposeItem, setJamComposeItem] = useState<FeedVideo | null>(null);
  const [profileChat, setProfileChat] = useState<Conversation | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (profileHeaderCollapsed) {
      setMenuOpen(false);
      setNotifyConfirmAnchor(null);
    }
  }, [profileHeaderCollapsed]);

  useEffect(() => {
    setMenuOpen(false);
    setNotifyConfirmAnchor(null);
    setJamComposeItem(null);
    setProfileChat(null);
    setNotifyOnPost(false);
    notifyScale.setValue(1);
    notifyRequestIdRef.current += 1;
  }, [userId, notifyScale]);

  useEffect(() => {
    if (!userId || !currentUserId || userId === currentUserId) return;

    let active = true;
    const requestId = ++notifyRequestIdRef.current;

    void fetchCreatorPostAlert(currentUserId, userId)
      .then((enabled) => {
        if (!active || requestId !== notifyRequestIdRef.current) return;
        setNotifyOnPost(enabled);
      })
      .catch(() => {
        // Keep the bell off if the preference cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, [currentUserId, userId]);

  useEffect(() => {
    if (!userId) return;
    if (preloadedProfile?.userId === userId) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void Promise.all([
        fetchCreatorProfile(currentUserId, userId),
        fetchCreatorVideos(currentUserId, userId),
        fetchRelationshipState(currentUserId, userId),
      ])
        .then(([nextProfile, nextVideos, relationship]) => {
          if (!active) return;
          setProfile(nextProfile);
          setVideos(nextVideos);
          setJammedByMe(relationship.jammedByMe);
          setJammedMe(relationship.jammedMe);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "could not load profile");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentUserId, preloadedProfile, userId]);

  if (!userId) return null;

  const preloadedMatches = preloadedProfile?.userId === userId;
  const visibleProfile = preloadedMatches ? preloadedProfile.profile : profile;
  const visibleVideos = sortProfileVideos(
    preloadedMatches ? preloadedProfile.videos : videos,
  );
  const { savedVideoIds, setVideoSaved } = savedVideoController;
  const baseJammedByMe = preloadedMatches ? preloadedProfile.jammedByMe : jammedByMe;
  const baseJammedMe = preloadedMatches ? preloadedProfile.jammedMe : jammedMe;
  const activeRelationshipOverride =
    relationshipOverride?.userId === userId ? relationshipOverride : null;
  const visibleJammedByMe = activeRelationshipOverride?.jammedByMe ?? baseJammedByMe;
  const visibleJammedMe = activeRelationshipOverride?.jammedMe ?? baseJammedMe;
  const visibleLoading = preloadedMatches ? false : loading;
  const visibleError = preloadedMatches ? null : error;
  const displayName = visibleProfile?.display_name ?? "creator";
  const postedVideoCount = Math.max(visibleVideos.length, visibleProfile?.video_count ?? 0);
  const proEntitlement = {
    earlyAdopter: visibleProfile?.early_adopter,
    videoCount: postedVideoCount,
    proSubscriptionActive: visibleProfile?.pro_subscription_active,
  };
  const proBadge = getProBadgeKind(proEntitlement);
  const showProProgress =
    currentUserId === userId && shouldShowProProgress(proEntitlement);
  const canUnjam = visibleJammedByMe;
  const isOwnProfile = currentUserId === userId;
  const profileUnlocked = isOwnProfile || (visibleJammedByMe && visibleJammedMe);
  const visibleFeedVideos = visibleProfile
    ? visibleVideos.map((video) =>
        profileToFeedVideo(
          visibleProfile,
          video,
          savedVideoIds.has(video.id),
          visibleJammedByMe,
          visibleJammedMe,
          postedVideoCount,
        ),
      )
    : [];
  const profileFeedItem = visibleProfile
    ? visibleFeedVideos[0] ??
      profileToFeedVideo(
        visibleProfile,
        undefined,
        false,
        visibleJammedByMe,
        visibleJammedMe,
        postedVideoCount,
      )
    : null;

  function confirmUnjam(kind: "cancel" | "unjam", anchor: { x: number; y: number }) {
    if (!userId) return;

    setMenuOpen(false);
    setNotifyConfirmAnchor(null);
    setUnjamConfirm({ kind, anchor });
  }

  function performUnjam() {
    if (!userId) return;

    setUnjamConfirm(null);
    void removeJamConnection(userId)
      .then(() => {
        setJammedByMe(false);
        setJammedMe(false);
        setRelationshipOverride({ userId, jammedByMe: false, jammedMe: false });
        setProfileChat(null);
        onUnjammed?.(userId);
        onInboxChanged?.();
      })
      .catch((err) => {
        Alert.alert("could not unjam", err instanceof Error ? err.message : "try again");
      });
  }

  async function openExistingProfileChat(item: FeedVideo) {
    const unlocked = Boolean(item.mutual);
    let nextChat = conversationFromFeedItem(item, unlocked);

    try {
      const inbox = await fetchInbox(currentUserId);
      nextChat =
        inbox.conversations.find((conversation) => conversation.userId === item.userId) ??
        inbox.sent.find((conversation) => conversation.userId === item.userId) ??
        inbox.requests
          .filter((request) => request.userId === item.userId)
          .map(conversationFromRequest)
          .at(0) ??
        nextChat;
    } catch {
      // Keep the local conversation shell.
    }

    setProfileChat(nextChat);
    void fetchConversationMessages(currentUserId, item.userId)
      .then((page) => {
        setProfileChat((current) => {
          if (!current || current.userId !== item.userId) return current;
          return {
            ...current,
            messages: page.messages.length > 0 ? page.messages : current.messages,
            hasMoreMessages: Boolean(page.nextCursor),
            olderMessagesCursor: page.nextCursor,
          };
        });
      })
      .catch(() => undefined);
  }

  function hideProfileCreator(item: FeedVideo) {
    setFullscreenIndex(null);
    onClose();
    void hideCreator(currentUserId, item.userId)
      .then(() => savedVideoController.refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not hide creator", err instanceof Error ? err.message : "try again");
      });
  }

  function blockProfileCreator(item: FeedVideo) {
    setFullscreenIndex(null);
    onClose();
    void blockUser(currentUserId, item.userId)
      .then(() => {
        onBlocked?.(item.userId);
        onUnjammed?.(item.userId);
        onInboxChanged?.();
        return savedVideoController.refreshSavedVideos();
      })
      .catch((err) => {
        Alert.alert("could not block creator", err instanceof Error ? err.message : "try again");
      });
  }

  function submitProfileReport(item: FeedVideo, reason: ReportReason) {
    if (reportSubmitting) return;

    setReportSubmitting(true);
    void reportVideo({
      reporterId: currentUserId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setReportItem(null);
        setFullscreenIndex(null);
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setReportSubmitting(false));
  }

  function runNotifyAnimation() {
    notifyScale.setValue(1);
    Animated.sequence([
      Animated.timing(notifyScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(notifyScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function applyNotifyOnPost(enabled: boolean) {
    if (!userId || userId === currentUserId) return;

    const requestId = ++notifyRequestIdRef.current;
    setNotifyOnPost(enabled);
    if (enabled) runNotifyAnimation();

    void setCreatorPostAlert(currentUserId, userId, enabled).catch((err) => {
      if (requestId !== notifyRequestIdRef.current) return;
      setNotifyOnPost(!enabled);
      Alert.alert(
        enabled ? "could not turn on alerts" : "could not turn off alerts",
        err instanceof Error ? err.message : "try again",
      );
    });
  }

  function pressNotifyOnPost(anchorRef: RefObject<View | null>) {
    if (!userId || userId === currentUserId) return;

    if (notifyOnPost) {
      setNotifyConfirmAnchor(null);
      applyNotifyOnPost(false);
      return;
    }

    setMenuOpen(false);
    setUnjamConfirm(null);
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setNotifyConfirmAnchor({ x: x + width / 2, y: y + height });
    });
  }

  function renderProfileNotifyButton(anchorRef: RefObject<View | null>) {
    return (
      <View ref={anchorRef} collapsable={false} style={styles.profileMenuAnchor}>
        <Pressable
          style={styles.headerIconButton}
          onPress={() => pressNotifyOnPost(anchorRef)}
          accessibilityRole="button"
          accessibilityLabel={
            notifyOnPost
              ? `Stop notifications when ${displayName} posts`
              : `Notify me when ${displayName} posts`
          }
          accessibilityState={{ selected: notifyOnPost }}
        >
          <Animated.View style={{ transform: [{ scale: notifyScale }] }}>
            <BellIcon filled={notifyOnPost} />
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  const profileOptionsButton = (
    <View style={styles.profileMenuAnchor}>
      <Pressable
        style={styles.headerIconButton}
        onPress={() => {
          setNotifyConfirmAnchor(null);
          setMenuOpen((current) => !current);
        }}
        accessibilityLabel="profile options"
      >
        <Text style={styles.iconText}>⋯</Text>
      </Pressable>
    </View>
  );

  const profileScreen = (
    <SwipeBackSurface
      resetKey={userId}
      onBack={() => {
        setMenuOpen(false);
        onClose();
      }}
      style={styles.flex}
      enterFromRight
    >
      <View style={styles.safe}>
          <ProfileTopScrollFade
            topInset={insets.top}
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: insets.top + 4 },
            ]}
            collapsedHeader={
              visibleProfile
                ? {
                    title: displayName,
                    left: renderProfileNotifyButton(notifyCollapsedButtonRef),
                    right: profileOptionsButton,
                  }
                : undefined
            }
            onCollapseChange={setProfileHeaderCollapsed}
            onScroll={() => {
              profileLockScrollSyncRef.current?.();
            }}
            onScrollBeginDrag={() => {
              if (menuOpen) setMenuOpen(false);
              if (notifyConfirmAnchor) setNotifyConfirmAnchor(null);
            }}
          >
            <View style={styles.headerRow}>
              {profileHeaderCollapsed ? (
                <View style={styles.headerSpacer} />
              ) : (
                renderProfileNotifyButton(notifyHeaderButtonRef)
              )}
              <View style={styles.headerCenterSlot} pointerEvents="box-none">
                {showProProgress && !profileHeaderCollapsed ? (
                  <ProProgressBar posted={postedVideoCount} />
                ) : null}
              </View>
              {profileHeaderCollapsed ? <View style={styles.headerSpacer} /> : profileOptionsButton}
            </View>

            {visibleLoading ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
            ) : visibleProfile ? (
              <>
                <View style={styles.profileCentered}>
                  <Avatar uri={visibleProfile.avatar_url} size={78} />
                  <ProfileNameAnchor>
                    <View style={styles.centerRow}>
                      <Text style={styles.h2}>{displayName}</Text>
                      {proBadge ? <ProBadge kind={proBadge} /> : null}
                    </View>
                  </ProfileNameAnchor>
                  <Text style={styles.subtitle}>
                    {(visibleProfile.creator_types ?? []).join(", ") || "creator"}
                    {visibleProfile.location ? ` - ${visibleProfile.location}` : ""}
                  </Text>
                  <Text style={styles.profileBio}>{visibleProfile.bio || "no bio yet."}</Text>
                </View>
                <View>
                  <ProfileJamButton
                    label={
                      visibleJammedByMe && visibleJammedMe
                        ? "message"
                        : visibleJammedByMe
                          ? "request sent"
                          : "jam"
                    }
                    jamming={visibleJammedByMe && visibleJammedMe}
                    showCancel={visibleJammedByMe}
                    onCancelPress={(anchor) =>
                      confirmUnjam(visibleJammedByMe && visibleJammedMe ? "unjam" : "cancel", anchor)
                    }
                    onPress={() => {
                      if (!profileFeedItem) return;
                      setMenuOpen(false);
                      // Existing relationship → open chat over this profile (no feed flash).
                      if (visibleJammedByMe || visibleJammedMe) {
                        void openExistingProfileChat(profileFeedItem);
                        return;
                      }
                      setJamComposeItem(profileFeedItem);
                    }}
                  />
                </View>
                <View style={styles.profileVideoDivider} />
                <VideoGrid
                  videos={visibleFeedVideos}
                  locked={!profileUnlocked}
                  lockMessage={`you must be jamming with ${displayName} to see their full profile`}
                  lockScrollSyncRef={profileLockScrollSyncRef}
                  prewarmVisibleVideos
                  onVideoPress={(video, index) => {
                    setMenuOpen(false);
                    openProfileVideoFullscreen(video, () => setFullscreenIndex(index));
                  }}
                />
              </>
            ) : (
              <EmptyCard text={visibleError ?? "profile unavailable."} />
            )}
          </ProfileTopScrollFade>
          {menuOpen ? (
            <>
              <Pressable
                style={styles.profileMenuDismiss}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="dismiss profile options"
              />
              <View style={[styles.profileMenu, { top: insets.top + 52, right: 18 }]}>
                {canUnjam ? (
                  <Pressable
                    ref={menuUnjamItemRef}
                    style={styles.profileMenuItem}
                    onPress={() => {
                      menuUnjamItemRef.current?.measureInWindow((x, y, width, height) => {
                        confirmUnjam(visibleJammedByMe && visibleJammedMe ? "unjam" : "cancel", {
                          x: x + width / 2,
                          y: y + height,
                        });
                      });
                    }}
                  >
                    <Text style={styles.profileMenuDangerText}>
                      {visibleJammedByMe && visibleJammedMe ? "Unjam" : "Cancel jam"}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.profileMenuItem}>
                    <Text style={styles.profileMenuMutedText}>more options soon</Text>
                  </View>
                )}
              </View>
            </>
          ) : null}
          {unjamConfirm ? (
            <Modal animationType="fade" transparent visible onRequestClose={() => setUnjamConfirm(null)}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setUnjamConfirm(null)}
                accessibilityLabel="dismiss"
              />
              <View
                style={[
                  styles.unjamPopover,
                  {
                    top: unjamConfirm.anchor.y + 8,
                    left: Math.min(
                      Math.max(unjamConfirm.anchor.x - UNJAM_POPOVER_WIDTH / 2, 12),
                      viewportWidth - UNJAM_POPOVER_WIDTH - 12,
                    ),
                  },
                ]}
              >
                <Text style={styles.unjamPopoverTitle}>
                  {unjamConfirm.kind === "cancel" ? "cancel jam?" : "unjam?"}
                </Text>
                <View style={styles.twoCol}>
                  <Pressable style={styles.confirmOption} onPress={() => setUnjamConfirm(null)}>
                    <Text style={styles.confirmOptionCancelText}>cancel</Text>
                  </Pressable>
                  <Pressable style={styles.confirmOption} onPress={performUnjam}>
                    <Text style={styles.confirmOptionDangerText}>confirm</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          ) : null}
          {notifyConfirmAnchor ? (
            <Modal
              animationType="fade"
              transparent
              visible
              onRequestClose={() => setNotifyConfirmAnchor(null)}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setNotifyConfirmAnchor(null)}
                accessibilityLabel="dismiss"
              />
              <View
                style={[
                  styles.notifyPopover,
                  {
                    top: notifyConfirmAnchor.y + 8,
                    left: Math.min(
                      Math.max(notifyConfirmAnchor.x - NOTIFY_POPOVER_WIDTH / 2, 12),
                      viewportWidth - NOTIFY_POPOVER_WIDTH - 12,
                    ),
                  },
                ]}
              >
                <Text style={styles.unjamPopoverTitle}>
                  get notified when {displayName} posts?
                </Text>
                <View style={styles.twoCol}>
                  <Pressable
                    style={styles.confirmOption}
                    onPress={() => setNotifyConfirmAnchor(null)}
                  >
                    <Text style={styles.confirmOptionCancelText}>cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmOption}
                    onPress={() => {
                      setNotifyConfirmAnchor(null);
                      applyNotifyOnPost(true);
                    }}
                  >
                    <Text style={styles.confirmOptionYesText}>yes</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          ) : null}
          <DmModal
            item={jamComposeItem}
            presentation="overlay"
            onClose={() => setJamComposeItem(null)}
            onOpenProfile={() => setJamComposeItem(null)}
            onSend={async (body) => {
              if (!jamComposeItem) return;
              const recipientUserId = jamComposeItem.userId;
              await sendJamRequest(recipientUserId, body, jamComposeItem.id);
              setJammedByMe(true);
              setRelationshipOverride({
                userId: recipientUserId,
                jammedByMe: true,
                jammedMe: visibleJammedMe,
              });
              setJamComposeItem(null);
              onJamSent?.(recipientUserId);
              onInboxChanged?.();
            }}
          />
          <ChatModal
            active={profileChat}
            currentUserId={currentUserId}
            savedVideoController={savedVideoController}
            presentation="overlay"
            onClose={() => setProfileChat(null)}
            onOpenProfile={() => setProfileChat(null)}
            onInboxChanged={onInboxChanged}
            onLoadOlderMessages={async (conversation) => {
              const page = await fetchConversationMessages(currentUserId, conversation.userId, {
                cursor: conversation.olderMessagesCursor ?? undefined,
              });
              setProfileChat((current) => {
                if (!current || current.userId !== conversation.userId) return current;
                const existingIds = new Set(current.messages.map((message) => message.id));
                const older = page.messages.filter((message) => !existingIds.has(message.id));
                return {
                  ...current,
                  messages: [...older, ...current.messages],
                  hasMoreMessages: Boolean(page.nextCursor),
                  olderMessagesCursor: page.nextCursor,
                };
              });
            }}
            onSend={async (conversation, body) => {
              const optimisticId = `local-${conversation.userId}-${Date.now()}`;
              const optimisticMessage: ChatMessage = {
                id: optimisticId,
                body,
                incoming: false,
                createdAt: new Date().toISOString(),
              };

              setProfileChat((current) => {
                if (!current || current.userId !== conversation.userId) return current;
                const unlocksFromReply =
                  !current.unlocked && current.messages.some((message) => message.incoming);
                return {
                  ...current,
                  unlocked: current.unlocked || unlocksFromReply,
                  lastMessage: body,
                  messages: [...current.messages, optimisticMessage],
                };
              });

              try {
                const savedMessage = conversation.unlocked
                  ? await sendMessage(conversation.userId, body)
                  : await sendJamRequest(conversation.userId, body);
                const unlocksFromReply =
                  !conversation.unlocked && conversation.messages.some((message) => message.incoming);

                setProfileChat((current) => {
                  if (!current || current.userId !== conversation.userId) return current;
                  return {
                    ...current,
                    unlocked: current.unlocked || unlocksFromReply,
                    messages: current.messages.map((message) =>
                      message.id === optimisticId
                        ? {
                            ...message,
                            id: savedMessage.id,
                            serverId: savedMessage.id,
                            createdAt: savedMessage.created_at,
                          }
                        : message,
                    ),
                  };
                });

                if (unlocksFromReply) {
                  setRelationshipOverride({
                    userId: conversation.userId,
                    jammedByMe: true,
                    jammedMe: true,
                  });
                  setJammedByMe(true);
                  setJammedMe(true);
                }

                onInboxChanged?.();
              } catch (err) {
                setProfileChat((current) => {
                  if (!current || current.userId !== conversation.userId) return current;
                  return {
                    ...current,
                    messages: current.messages.filter((message) => message.id !== optimisticId),
                  };
                });
                Alert.alert("could not send", err instanceof Error ? err.message : "try again");
              }
            }}
            onEditMessage={async (messageId, body) => {
              const updated = await editMessage(messageId, body);
              setProfileChat((current) => {
                if (!current) return current;
                return {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === messageId || message.serverId === messageId
                      ? { ...message, body: updated.body }
                      : message,
                  ),
                  lastMessage:
                    current.messages.some(
                      (message) =>
                        (message.id === messageId || message.serverId === messageId) &&
                        message.body === current.lastMessage,
                    )
                      ? updated.body
                      : current.lastMessage,
                };
              });
            }}
            onDeleteMessage={async (messageId) => {
              await deleteMessage(messageId);
              setProfileChat((current) => {
                if (!current) return current;
                const nextMessages = current.messages.filter(
                  (message) => message.id !== messageId && message.serverId !== messageId,
                );
                return {
                  ...current,
                  messages: nextMessages,
                  lastMessage: nextMessages.at(-1)?.body ?? "",
                };
              });
              onInboxChanged?.();
            }}
          />
          {visibleProfile && (
            <ProfileVideoFullscreenModal
              visible={fullscreenIndex !== null}
              videos={profileUnlocked ? visibleFeedVideos : visibleFeedVideos.slice(0, 3)}
              initialIndex={fullscreenIndex ?? 0}
              owner={{
                creatorName: displayName,
                role: visibleProfile.creator_types?.[0] ?? "creator",
                location: visibleProfile.location ?? "unknown",
                avatarUrl: visibleProfile.avatar_url,
                earlyAdopter: Boolean(visibleProfile.early_adopter),
                proBadge,
              }}
              saved={Boolean(visibleFeedVideos[fullscreenIndex ?? 0]?.savedByMe)}
              presentation="overlay"
              onClose={() => setFullscreenIndex(null)}
              getSavedForVideo={(video) => savedVideoIds.has(video.id)}
              onSave={(video, nextSaved) => {
                void setVideoSaved(video.id, nextSaved);
              }}
              onMessage={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) {
                  setFullscreenIndex(null);
                  onMessage(feedItem);
                }
              }}
              onNotInterested={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) hideProfileCreator(feedItem);
              }}
              onBlock={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) blockProfileCreator(feedItem);
              }}
              onReport={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) setReportItem(feedItem);
              }}
              onSendMessage={async (video, body) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (!feedItem) return;
                await sendJamRequest(feedItem.userId, body, video.id);
                setRelationshipOverride({
                  userId: feedItem.userId,
                  jammedByMe: true,
                  jammedMe: Boolean(feedItem.jammedMe),
                });
                onInboxChanged?.();
              }}
            />
          )}
      </View>
    </SwipeBackSurface>
  );

  return (
    <>
      {inline ? (
        <View style={styles.profileStackOverlay}>{profileScreen}</View>
      ) : (
        <Modal animationType="none" transparent visible={Boolean(userId)} onRequestClose={onClose}>
          {profileScreen}
        </Modal>
      )}
      <FeedReportModal
        item={reportItem}
        submitting={reportSubmitting}
        onClose={() => setReportItem(null)}
        onSubmit={(reason) => {
          if (reportItem) submitProfileReport(reportItem, reason);
        }}
      />
    </>
  );
}

function ProfileFullscreenFeedItem({
  video,
  height,
  owner,
  isActive,
  videoBottomInset,
  actionsBottom,
  metaBottom,
  ownProfileNavBarHeight,
  ownVideoActions,
  chromeOpacity,
  chromeHolding = false,
  chromeLocked = false,
  onChromeHoldStart,
  onChromeHoldEnd,
  onChromeLock,
  onChromeUnlock,
  onSpeedHoldStart,
  onSpeedHoldEnd,
  onSave,
  onMessage,
  onNotInterested,
  onBlock,
  onReport,
}: {
  video: ProfileVideo | FeedVideo;
  height: number;
  owner: {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    earlyAdopter: boolean;
    proBadge?: ProBadgeKind | null;
  };
  isActive: boolean;
  videoBottomInset: number;
  actionsBottom: number;
  metaBottom: number;
  ownProfileNavBarHeight: number;
  ownVideoActions?: {
    onDelete: (video: ProfileVideo | FeedVideo) => void;
  };
  chromeOpacity?: Animated.Value;
  chromeHolding?: boolean;
  chromeLocked?: boolean;
  onChromeHoldStart?: () => void;
  onChromeHoldEnd?: () => void;
  onChromeLock?: () => void;
  onChromeUnlock?: () => void;
  onSpeedHoldStart?: () => void;
  onSpeedHoldEnd?: () => void;
  onSave: (video: ProfileVideo | FeedVideo, nextSaved: boolean) => void;
  onMessage: (video: ProfileVideo | FeedVideo) => void;
  onNotInterested?: (video: ProfileVideo | FeedVideo) => void;
  onBlock?: (video: ProfileVideo | FeedVideo) => void;
  onReport?: (video: ProfileVideo | FeedVideo) => void;
}) {
  const source = getGridVideoSource(video);
  const feedItem = profileVideoToFeedVideo(video);
  const presentation = getVideoPresentation(video);
  const lookingFor = Boolean(
    feedItem?.lookingFor ||
      ("lookingFor" in video && video.lookingFor) ||
      ("looking_for" in video && (video as { looking_for?: boolean | null }).looking_for),
  );
  const aspectCacheKey = getVideoAspectCacheKeyFromVideo(video);
  const rememberedAspect = getRememberedVideoAspectSize(aspectCacheKey);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(Boolean(video.savedByMe));
  const [menuOpen, setMenuOpen] = useState(false);
  const [waitingForFirstPlay, setWaitingForFirstPlay] = useState(Boolean(source));
  const [showGreyCover, setShowGreyCover] = useState(Boolean(source));
  const [showWaitingSpinner, setShowWaitingSpinner] = useState(false);
  const [mediaContentFit, setMediaContentFit] = useState<VideoContentFit>(() =>
    contentFitForVideoSize(rememberedAspect?.width, rememberedAspect?.height),
  );
  const [heartScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const greyCoverOpacity = useRef(new Animated.Value(1)).current;
  const chromeHoldingRef = useRef(false);
  const speedHoldingRef = useRef(false);
  const chromeSuppressPressRef = useRef(false);
  const chromeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeLockHudHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTouchStartYRef = useRef<number | null>(null);
  const chromeTouchStartXRef = useRef<number | null>(null);
  const chromeTouchInSpeedZoneRef = useRef(false);
  const chromeTouchMovedRef = useRef(false);
  const chromePullProgressRef = useRef(0);
  const speedIndexRef = useRef(FEED_SPEED_DEFAULT_INDEX);
  const speedDragBaseIndexRef = useRef(FEED_SPEED_DEFAULT_INDEX);
  const chromeLockedRef = useRef(chromeLocked);
  const chromeLockHudOpacity = useRef(new Animated.Value(0)).current;
  const speedHudOpacity = useRef(new Animated.Value(0)).current;
  const [chromePullProgress, setChromePullProgress] = useState(0);
  const [chromeLockHudSealed, setChromeLockHudSealed] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(FEED_SPEED_DEFAULT_INDEX);
  const [playbackRate, setPlaybackRate] = useState<FeedPlaybackSpeed>(1);
  const connection = feedItem?.mutual ? "jamming" : feedItem?.jammedMe ? "jammed you" : null;
  const hasJam = Boolean(feedItem && hasSentJam(feedItem));
  const pendingJam = Boolean(feedItem && isPendingSentJam(feedItem));
  const caption = getVideoCaption(video);
  const tags = getProfileFullscreenTags(video);
  const showModerationMenu = Boolean(onNotInterested && onBlock && onReport);
  const chromeInteractive = !chromeHolding && !chromeLocked;
  const overlayOpacity = chromeOpacity ?? 1;

  useEffect(() => {
    setSaved(Boolean(video.savedByMe));
  }, [video.id, video.savedByMe]);

  useEffect(() => {
    setPaused(false);
    setMenuOpen(false);
    setWaitingForFirstPlay(Boolean(source));
    setShowGreyCover(Boolean(source));
    setShowWaitingSpinner(false);
    greyCoverOpacity.stopAnimation();
    greyCoverOpacity.setValue(1);
    const cached = getRememberedVideoAspectSize(getVideoAspectCacheKeyFromVideo(video));
    setMediaContentFit(contentFitForVideoSize(cached?.width, cached?.height));
    speedIndexRef.current = FEED_SPEED_DEFAULT_INDEX;
    setSpeedIndex(FEED_SPEED_DEFAULT_INDEX);
    setPlaybackRate(1);
    speedHudOpacity.setValue(0);
  }, [greyCoverOpacity, source, speedHudOpacity, video.id]);

  useEffect(() => {
    if (!isActive || paused || !source || !waitingForFirstPlay) {
      setShowWaitingSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowWaitingSpinner(true), 1000);
    return () => clearTimeout(timer);
  }, [isActive, paused, source, waitingForFirstPlay]);

  const greyRevealedRef = useRef(false);

  useEffect(() => {
    greyRevealedRef.current = false;
  }, [video.id, source]);

  function revealFirstFrameFromGrey() {
    if (greyRevealedRef.current) return;
    greyRevealedRef.current = true;
    setWaitingForFirstPlay(false);
    setShowWaitingSpinner(false);
    greyCoverOpacity.stopAnimation();
    Animated.timing(greyCoverOpacity, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowGreyCover(false);
    });
  }

  useEffect(() => {
    chromeLockedRef.current = chromeLocked;
  }, [chromeLocked]);

  useEffect(() => {
    return () => {
      if (chromeHoldTimerRef.current) {
        clearTimeout(chromeHoldTimerRef.current);
        chromeHoldTimerRef.current = null;
      }
      if (chromeLockHudHideTimerRef.current) {
        clearTimeout(chromeLockHudHideTimerRef.current);
        chromeLockHudHideTimerRef.current = null;
      }
    };
  }, []);

  function clearChromeHoldTimer() {
    if (chromeHoldTimerRef.current) {
      clearTimeout(chromeHoldTimerRef.current);
      chromeHoldTimerRef.current = null;
    }
  }

  function hideChromeLockHud() {
    if (chromeLockHudHideTimerRef.current) {
      clearTimeout(chromeLockHudHideTimerRef.current);
      chromeLockHudHideTimerRef.current = null;
    }
    chromeLockHudOpacity.stopAnimation();
    Animated.timing(chromeLockHudOpacity, {
      toValue: 0,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setChromePullProgress(0);
      setChromeLockHudSealed(false);
      chromePullProgressRef.current = 0;
    });
  }

  function showChromeLockHud() {
    if (chromeLockHudHideTimerRef.current) {
      clearTimeout(chromeLockHudHideTimerRef.current);
      chromeLockHudHideTimerRef.current = null;
    }
    chromePullProgressRef.current = 0;
    setChromePullProgress(0);
    setChromeLockHudSealed(false);
    chromeLockHudOpacity.stopAnimation();
    chromeLockHudOpacity.setValue(0);
    Animated.timing(chromeLockHudOpacity, {
      toValue: 1,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function applySpeedIndex(nextIndex: number) {
    const clamped = Math.max(0, Math.min(FEED_PLAYBACK_SPEEDS.length - 1, nextIndex));
    speedIndexRef.current = clamped;
    setSpeedIndex(clamped);
    setPlaybackRate(FEED_PLAYBACK_SPEEDS[clamped]);
  }

  function showSpeedHud() {
    speedHudOpacity.stopAnimation();
    speedHudOpacity.setValue(0);
    Animated.timing(speedHudOpacity, {
      toValue: 1,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function hideSpeedHud() {
    speedHudOpacity.stopAnimation();
    Animated.timing(speedHudOpacity, {
      toValue: 0,
      duration: FEED_CHROME_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function handleProfileTouchStart(locationX: number, pageY: number) {
    clearChromeHoldTimer();
    chromeTouchStartXRef.current = locationX;
    chromeTouchStartYRef.current = pageY;
    chromeTouchMovedRef.current = false;
    chromePullProgressRef.current = 0;
    chromeTouchInSpeedZoneRef.current = locationX >= viewportWidth * FEED_SPEED_ZONE_LEFT_RATIO;
    if (menuOpen) return;
    if (!chromeTouchInSpeedZoneRef.current && chromeLockedRef.current) return;

    chromeHoldTimerRef.current = setTimeout(() => {
      chromeHoldTimerRef.current = null;
      if (chromeTouchMovedRef.current) return;

      if (chromeTouchInSpeedZoneRef.current) {
        speedHoldingRef.current = true;
        speedDragBaseIndexRef.current = speedIndexRef.current;
        applySpeedIndex(speedIndexRef.current);
        showSpeedHud();
        triggerHoldHaptic();
        onSpeedHoldStart?.();
        return;
      }

      if (chromeLockedRef.current) return;
      chromeHoldingRef.current = true;
      showChromeLockHud();
      triggerHoldHaptic();
      onChromeHoldStart?.();
    }, FEED_CHROME_HOLD_MS);
  }

  function handleProfileTouchMove(pageY: number) {
    const startY = chromeTouchStartYRef.current;
    if (startY == null) return;
    const dy = pageY - startY;

    if (!chromeHoldingRef.current && !speedHoldingRef.current) {
      if (Math.abs(dy) > 12) {
        chromeTouchMovedRef.current = true;
        clearChromeHoldTimer();
      }
      return;
    }

    if (speedHoldingRef.current) {
      const nextIndex = Math.round(speedDragBaseIndexRef.current + dy / FEED_SPEED_SEGMENT_PX);
      applySpeedIndex(nextIndex);
      return;
    }

    const progress = Math.min(1, Math.max(0, dy / FEED_CHROME_LOCK_PULL_PX));
    chromePullProgressRef.current = progress;
    setChromePullProgress(progress);
    setChromeLockHudSealed(progress >= 1);
  }

  function handleProfileTouchEnd() {
    clearChromeHoldTimer();
    const wasChromeHolding = chromeHoldingRef.current;
    const wasSpeedHolding = speedHoldingRef.current;
    chromeHoldingRef.current = false;
    speedHoldingRef.current = false;
    chromeTouchStartYRef.current = null;
    chromeTouchStartXRef.current = null;

    if (!wasChromeHolding && !wasSpeedHolding) return;

    chromeSuppressPressRef.current = true;

    if (wasSpeedHolding) {
      hideSpeedHud();
      onSpeedHoldEnd?.();
      return;
    }

    hideChromeLockHud();

    if (chromePullProgressRef.current >= 1 && !chromeLockedRef.current) {
      onChromeLock?.();
      return;
    }

    if (!chromeLockedRef.current) {
      onChromeHoldEnd?.();
    }
  }

  function togglePlayback() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (!source) return;
    setPaused((current) => !current);
  }

  function handleProfilePress() {
    if (chromeSuppressPressRef.current) {
      chromeSuppressPressRef.current = false;
      return;
    }
    if (chromeLockedRef.current) {
      onChromeUnlock?.();
      return;
    }
    if (chromeHoldingRef.current || speedHoldingRef.current) return;
    togglePlayback();
  }

  function runSaveAnimation() {
    heartScale.setValue(1);
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function runJamShakeAnimation() {
    jamShake.stopAnimation();
    jamShake.setValue(0);
    Animated.sequence([
      Animated.timing(jamShake, {
        toValue: 1,
        duration: 55,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: -1,
        duration: 90,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: 0.7,
        duration: 80,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(jamShake, {
        toValue: 0,
        damping: 8,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function pressSave() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (nextSaved) runSaveAnimation();
    onSave(video, nextSaved);
  }

  function pressJam() {
    if (pendingJam) {
      runJamShakeAnimation();
      return;
    }
    onMessage(video);
  }

  const videoFrameStyle = ownVideoActions
    ? [styles.feedPreviewVideoClip, { bottom: ownProfileNavBarHeight }]
    : [styles.feedVideoLayer, styles.feedVideoViewportClip, { bottom: videoBottomInset }];

  return (
    <Pressable
      style={{ height, width: viewportWidth, backgroundColor: "#000" }}
      onPress={handleProfilePress}
      onPressIn={(event) =>
        handleProfileTouchStart(event.nativeEvent.locationX, event.nativeEvent.pageY)
      }
      onTouchMove={(event) => handleProfileTouchMove(event.nativeEvent.pageY)}
      onPressOut={handleProfileTouchEnd}
      delayLongPress={FEED_CHROME_HOLD_MS + 400}
    >
      <View style={[videoFrameStyle, { backgroundColor: "#000" }]}>
        {source ? (
          <>
            <JamVideoView
              key={video.id}
              source={source}
              style={StyleSheet.absoluteFill}
              contentFit={mediaContentFit}
              knownWidth={rememberedAspect?.width ?? null}
              knownHeight={rememberedAspect?.height ?? null}
              shouldPlay={isActive && !paused}
              isLooping
              isMuted={!isActive}
              volume={isActive ? 1 : 0}
              playbackRate={playbackRate}
              adoptPrewarmed={isActive}
              onFirstFrameRender={revealFirstFrameFromGrey}
              onContentFitChange={setMediaContentFit}
            />
            <VideoPresentationOverlays
              filter={presentation.filter}
              textOverlays={presentation.textOverlays}
            />
            {showGreyCover ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: PROFILE_VIDEO_OPEN_GREY, opacity: greyCoverOpacity },
                ]}
              />
            ) : null}
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}>
            <Avatar uri={owner.avatarUrl} size={90} />
            <Text style={styles.h2}>{owner.creatorName}</Text>
            <Text style={styles.helper}>video unavailable</Text>
          </View>
        )}
      </View>

      {source && showWaitingSpinner ? (
        <View pointerEvents="none" style={styles.videoBufferingIndicator}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedChromeLockHud,
          {
            opacity: chromeLockHudOpacity,
            bottom:
              actionsBottom +
              (56 + FEED_ACTION_GAP) * 2 +
              56 / 2 -
              (FEED_CHROME_LOCK_TRACK_TRAVEL + FEED_CHROME_LOCK_CIRCLE_SIZE / 2),
          },
        ]}
      >
        <View
          style={[
            styles.feedChromeLockTrack,
            { height: FEED_CHROME_LOCK_TRACK_TRAVEL + FEED_CHROME_LOCK_CIRCLE_SIZE },
          ]}
        >
          <View style={styles.feedChromeLockPath} />
          <View
            style={[
              styles.feedChromeLockTarget,
              {
                opacity: 0.28 + chromePullProgress * 0.55,
                transform: [{ scale: 0.92 + chromePullProgress * 0.08 }],
              },
            ]}
          >
            <FeedChromeLockIcon open={false} size={18} />
          </View>
          <View
            style={[
              styles.feedChromeLockKnob,
              {
                transform: [{ translateY: chromePullProgress * FEED_CHROME_LOCK_TRACK_TRAVEL }],
              },
            ]}
          >
            <FeedChromeLockIcon open={!chromeLockHudSealed && chromePullProgress < 0.92} size={20} />
          </View>
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedSpeedHud,
          {
            opacity: speedHudOpacity,
            top: viewportHeight / 2 - FEED_SPEED_PILL_HEIGHT / 2,
            right: 18 + (56 - FEED_SPEED_PILL_WIDTH) / 2,
          },
        ]}
      >
        <View style={styles.feedSpeedPill}>
          {FEED_PLAYBACK_SPEEDS.map((speed, index) => {
            const selected = index === speedIndex;
            return (
              <View key={speed} style={styles.feedSpeedRow}>
                <Text style={[styles.feedSpeedText, selected && styles.feedSpeedTextSelected]}>
                  {speed}x
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={chromeInteractive ? "box-none" : "none"}
        style={[styles.feedOverlayLayer, { opacity: overlayOpacity }]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.40)", "rgba(0,0,0,0)"]}
          locations={[0, 1]}
          style={styles.feedTopShade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)"]}
          locations={[0.05, 1]}
          style={[styles.feedBottomShade, { bottom: videoBottomInset }]}
        />

        <View style={[styles.feedMeta, { bottom: metaBottom }]} pointerEvents="box-none">
          <View style={styles.row}>
            <Avatar uri={owner.avatarUrl} size={52} />
            <View style={styles.flex}>
              <View style={styles.row}>
                <Text style={styles.feedName}>{owner.creatorName}</Text>
                {owner.proBadge ? <ProBadge kind={owner.proBadge} /> : null}
                {connection ? <Text style={styles.badge}>{connection}</Text> : null}
              </View>
              <Text style={styles.feedRole}>
                {owner.role} - {owner.location}
              </Text>
            </View>
          </View>
          {lookingFor || caption ? (
            <View style={styles.feedCaptionRow}>
              {lookingFor ? (
                <View style={styles.feedLookingForIcon} accessibilityLabel="looking for collaborators">
                  <LookingForIcon active size={19} shadow />
                </View>
              ) : null}
              {caption ? <Text style={[styles.caption, styles.feedCaptionText]}>{caption}</Text> : null}
            </View>
          ) : null}
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((tag, tagIndex) => (
                <Text key={`${tag}-${tagIndex}`} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.actions, { bottom: actionsBottom }]} pointerEvents="box-none">
          {ownVideoActions ? (
            <View>
              <Pressable onPress={() => setMenuOpen((current) => !current)} style={styles.actionButton}>
                <Text style={styles.actionText}>⋯</Text>
              </Pressable>
              {menuOpen ? (
                <View style={styles.videoMenu}>
                  <Pressable
                    style={styles.videoMenuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      ownVideoActions.onDelete(video);
                    }}
                  >
                    <Text style={styles.videoMenuDangerText}>delete</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <>
              <Pressable
                onPress={pressJam}
                style={styles.actionButton}
                accessibilityLabel={
                  feedItem?.mutual
                    ? `Message ${owner.creatorName} about this video`
                    : pendingJam
                      ? `Jam already sent to ${owner.creatorName}`
                      : `Jam with ${owner.creatorName}`
                }
                accessibilityRole="button"
                accessibilityState={{ selected: hasJam }}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        translateX: jamShake.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: [-5, 0, 5],
                        }),
                      },
                      {
                        rotate: jamShake.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: ["-7deg", "0deg", "7deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <JamJarIcon filled={hasJam} />
                </Animated.View>
              </Pressable>
              <Pressable
                onPress={pressSave}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel={saved ? "Remove from saved" : "Save video"}
                accessibilityState={{ selected: saved }}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <BookmarkIcon filled={saved} />
                </Animated.View>
              </Pressable>
              {showModerationMenu ? (
                <Pressable
                  onPress={() => setMenuOpen((current) => !current)}
                  style={styles.actionButton}
                  accessibilityLabel={`More options for ${owner.creatorName}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: menuOpen }}
                >
                  <Text style={[styles.actionText, styles.actionDotsText]}>⋯</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {ownVideoActions ? (
          <View
            pointerEvents="none"
            style={[styles.createPostPreviewNavBarPlaceholder, { height: ownProfileNavBarHeight }]}
          />
        ) : null}
      </Animated.View>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(menuOpen && !ownVideoActions)}
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.feedMoreSheetWrap}>
          <Pressable
            style={styles.feedMoreSheetDismiss}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Close video options"
          />
          <View style={styles.feedMoreSheetCard}>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onNotInterested?.(video);
              }}
            >
              <Text style={styles.feedMoreMenuText}>Not interested</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onBlock?.(video);
              }}
            >
              <Text style={styles.feedMoreMenuDangerText}>Block</Text>
            </Pressable>
            <Pressable
              style={styles.feedMoreMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onReport?.(video);
              }}
            >
              <Text style={styles.feedMoreMenuText}>Report</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

function ProfileVideoFullscreenModal({
  visible,
  videos,
  initialIndex,
  owner,
  saved,
  presentation = "modal",
  onClose,
  onSave,
  onMessage,
  getSavedForVideo,
  getOwnerForVideo,
  ownVideoActions,
  onNotInterested,
  onBlock,
  onReport,
  onSendMessage,
}: {
  visible: boolean;
  videos: Array<ProfileVideo | FeedVideo>;
  initialIndex: number;
  owner: {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    earlyAdopter: boolean;
    proBadge?: ProBadgeKind | null;
  };
  saved: boolean;
  presentation?: "modal" | "overlay";
  onClose: () => void;
  onSave: (video: ProfileVideo | FeedVideo, nextSaved: boolean) => void;
  onMessage: (video: ProfileVideo | FeedVideo) => void;
  getSavedForVideo?: (video: ProfileVideo | FeedVideo) => boolean;
  ownVideoActions?: {
    onDelete: (video: ProfileVideo | FeedVideo) => void;
  };
  onNotInterested?: (video: ProfileVideo | FeedVideo) => void;
  onBlock?: (video: ProfileVideo | FeedVideo) => void;
  onReport?: (video: ProfileVideo | FeedVideo) => void;
  onSendMessage?: (video: ProfileVideo | FeedVideo, body: string) => Promise<void>;
  getOwnerForVideo?: (video: ProfileVideo | FeedVideo) => {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    earlyAdopter: boolean;
    proBadge?: ProBadgeKind | null;
  };
}) {
  const wasVisibleRef = useRef(false);
  const listRef = useRef<FlatList<ProfileVideo | FeedVideo>>(null);
  const [index, setIndex] = useState(initialIndex);
  const [sessionVideos, setSessionVideos] = useState<Array<ProfileVideo | FeedVideo>>(videos);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(
    videos[initialIndex]?.id ?? videos[0]?.id ?? null,
  );
  const [messageDraft, setMessageDraft] = useState("");
  const [messageInputFocused, setMessageInputFocused] = useState(false);
  const messageInputRef = useRef<TextInput>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [messageSentTickVisible, setMessageSentTickVisible] = useState(false);
  const [messageSentTickScale] = useState(() => new Animated.Value(0));
  const [messageSendButtonWidth] = useState(() => new Animated.Value(FULLSCREEN_MESSAGE_SEND_WIDTH));
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));
  const [horizontalTranslateY] = useState(() => new Animated.Value(0));
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const chromeLockedRef = useRef(false);
  const [chromeHolding, setChromeHolding] = useState(false);
  const [chromeLocked, setChromeLocked] = useState(false);
  const [speedHolding, setSpeedHolding] = useState(false);
  const insets = useSafeAreaInsets();
  const activeVideos = visible ? sessionVideos : videos;
  const pageHeight = viewportHeight;
  const video = activeVideos[index] ?? activeVideos[0] ?? null;
  const showMessageBar = Boolean(onSendMessage && !ownVideoActions);
  const messageBarHeight = getNavBarHeight(insets.bottom);
  const messageBarInset = showMessageBar ? messageBarHeight + keyboardOffset : 0;
  const ownProfileNavBarHeight = ownVideoActions ? messageBarHeight : 0;
  // Always reserve bottom chrome on first paint (never mount full-bleed then inset).
  const videoBottomInset = showMessageBar ? messageBarInset : ownProfileNavBarHeight;
  const actionsBottom = videoBottomInset + FEED_ACTION_GAP;
  const metaBottom = showMessageBar ? messageBarInset + 30 : 122;
  const currentFeedItem = video ? profileVideoToFeedVideo(video) : null;
  const currentPendingSentJam = Boolean(currentFeedItem && isPendingSentJam(currentFeedItem));
  const chromeInteractive = !chromeHolding && !chromeLocked;
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(activeVideos.length - 1, 0),
  );

  // Keep nearby fullscreen pages aspect-warmed so swipe doesn't cover→contain flash.
  useEffect(() => {
    if (!visible) return;
    for (const offset of [-1, 0, 1, 2]) {
      const entry = activeVideos[index + offset] ?? activeVideos[safeInitialIndex + offset];
      if (entry) void ensureVideoAspectCached(entry);
    }
  }, [activeVideos, index, safeInitialIndex, visible]);

  const animateChrome = useCallback(
    (nextVisible: boolean) => {
      chromeOpacity.stopAnimation();
      Animated.timing(chromeOpacity, {
        toValue: nextVisible ? 1 : 0,
        duration: FEED_CHROME_FADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [chromeOpacity],
  );

  const restoreChrome = useCallback(() => {
    chromeLockedRef.current = false;
    setChromeLocked(false);
    setChromeHolding(false);
    animateChrome(true);
  }, [animateChrome]);

  const handleChromeHoldStart = useCallback(() => {
    if (chromeLockedRef.current) return;
    setChromeHolding(true);
    animateChrome(false);
  }, [animateChrome]);

  const handleChromeHoldEnd = useCallback(() => {
    setChromeHolding(false);
    if (chromeLockedRef.current) return;
    animateChrome(true);
  }, [animateChrome]);

  const handleChromeLock = useCallback(() => {
    chromeLockedRef.current = true;
    setChromeLocked(true);
    setChromeHolding(false);
    animateChrome(false);
  }, [animateChrome]);

  const handleChromeUnlock = useCallback(() => {
    restoreChrome();
  }, [restoreChrome]);

  const handleSpeedHoldStart = useCallback(() => {
    setSpeedHolding(true);
  }, []);

  const handleSpeedHoldEnd = useCallback(() => {
    setSpeedHolding(false);
  }, []);

  const clampedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-1, 0, viewportWidth],
        outputRange: [0, 0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  const onHorizontalGestureEvent = useMemo(
    () =>
      Animated.event(
        [
          {
            nativeEvent: {
              translationX: translateX,
              translationY: horizontalTranslateY,
            },
          },
        ],
        { useNativeDriver: true },
      ),
    [horizontalTranslateY, translateX],
  );

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) return;

    wasVisibleRef.current = true;
    const nextIndex = Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0));
    const frame = requestAnimationFrame(() => {
      setSessionVideos(
        videos.map((entry) => ({
          ...entry,
          savedByMe: getSavedForVideo?.(entry) ?? entry.savedByMe ?? saved,
        })),
      );
      setIndex(nextIndex);
      setActiveVideoId(videos[nextIndex]?.id ?? videos[0]?.id ?? null);
      setMessageDraft("");
      setMessageInputFocused(false);
      setMessageSentTickVisible(false);
      messageSentTickScale.setValue(0);
      messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_SEND_WIDTH);
      translateX.setValue(0);
      horizontalTranslateY.setValue(0);
      restoreChrome();
      listRef.current?.scrollToOffset({
        offset: nextIndex * pageHeight,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    getSavedForVideo,
    horizontalTranslateY,
    initialIndex,
    messageSendButtonWidth,
    messageSentTickScale,
    pageHeight,
    restoreChrome,
    saved,
    translateX,
    videos,
    visible,
  ]);

  useEffect(() => {
    if (!visible) return;
    setMessageDraft("");
    setMessageInputFocused(false);
    setMessageSentTickVisible(false);
    messageSentTickScale.setValue(0);
    messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_SEND_WIDTH);
    restoreChrome();
  }, [activeVideoId, messageSendButtonWidth, messageSentTickScale, restoreChrome, visible]);

  useEffect(() => {
    if (!visible || !showMessageBar) {
      setKeyboardOffset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(Math.max(0, viewportHeight - event.endCoordinates.screenY));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [showMessageBar, visible]);

  function updateActiveFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / pageHeight);
    const safeIndex = Math.max(0, Math.min(nextIndex, activeVideos.length - 1));
    const nextVideo = activeVideos[safeIndex];
    if (!nextVideo) return;
    setIndex(safeIndex);
    setActiveVideoId(nextVideo.id);
  }

  function handleHorizontalStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;

    const { translationX, translationY, velocityX } = event.nativeEvent;
    // Slightly eager dismiss so it's easier to swipe back off a video.
    const shouldClose =
      state === State.END &&
      translationX > 28 &&
      Math.abs(translationY) < 110 &&
      (translationX > viewportWidth * 0.22 || velocityX > 480);

    if (!shouldClose) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(horizontalTranslateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: viewportWidth,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(horizontalTranslateY, {
        toValue: translationY,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onClose);
  }

  function dismissMessageInput() {
    messageInputRef.current?.blur();
    Keyboard.dismiss();
    setMessageInputFocused(false);
  }

  function runMessageSentAnimation() {
    setMessageSentTickVisible(true);
    messageSentTickScale.setValue(0.4);
    messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_TICK_WIDTH);
    Animated.sequence([
      Animated.spring(messageSentTickScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.55,
        useNativeDriver: true,
      }),
      Animated.delay(850),
      Animated.parallel([
        Animated.timing(messageSentTickScale, {
          toValue: 0,
          duration: 170,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(messageSendButtonWidth, {
          toValue: FULLSCREEN_MESSAGE_SEND_WIDTH,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      setMessageSentTickVisible(false);
    });
  }

  async function submitFullscreenMessage() {
    const body = messageDraft.trim();
    if (!video || !body || !onSendMessage || messageSending) return;

    if (currentPendingSentJam) return;

    setMessageSending(true);
    try {
      await onSendMessage(video, body);
      setMessageDraft("");
      runMessageSentAnimation();
      const sentFeedItem = profileVideoToFeedVideo(video);
      if (sentFeedItem && !sentFeedItem.mutual) {
        const nextJammedMe = Boolean(sentFeedItem.jammedMe);
        setSessionVideos((current) =>
          current.map((entry) =>
            entry.id === video.id
              ? {
                  ...entry,
                  jammedByMe: true,
                  mutual: nextJammedMe,
                }
              : entry,
          ),
        );
      }
    } catch (err) {
      Alert.alert("could not send", err instanceof Error ? err.message : "try again");
    } finally {
      setMessageSending(false);
    }
  }

  function handleSave(nextVideo: ProfileVideo | FeedVideo, nextSaved: boolean) {
    setSessionVideos((current) =>
      current.map((entry) =>
        entry.id === nextVideo.id
          ? {
              ...entry,
              savedByMe: nextSaved,
            }
          : entry,
      ),
    );
    onSave(nextVideo, nextSaved);
  }

  if (!visible) return null;

  const content = (
    <View style={styles.fullscreenMessageRoot}>
      <PanGestureHandler
        activeOffsetX={14}
        failOffsetY={[-22, 22]}
        onGestureEvent={onHorizontalGestureEvent}
        onHandlerStateChange={handleHorizontalStateChange}
      >
        <Animated.View
          style={[
            styles.fullscreenVideoRoot,
            {
              transform: [
                { translateX: clampedTranslateX },
                { translateY: horizontalTranslateY },
              ],
            },
          ]}
        >
          <FlatList
            ref={listRef}
            data={activeVideos}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            pagingEnabled
            scrollEnabled={!chromeHolding && !speedHolding}
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            windowSize={5}
            maxToRenderPerBatch={3}
            initialNumToRender={2}
            initialScrollIndex={safeInitialIndex}
            getItemLayout={(_, itemIndex) => ({
              length: pageHeight,
              offset: pageHeight * itemIndex,
              index: itemIndex,
            })}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.index * pageHeight,
                animated: false,
              });
            }}
            onMomentumScrollEnd={updateActiveFromScroll}
            onScrollBeginDrag={() => {
              if (showMessageBar && (keyboardOffset > 0 || messageInputFocused)) {
                dismissMessageInput();
              }
            }}
            renderItem={({ item }) => (
              <ProfileFullscreenFeedItem
                video={item}
                height={pageHeight}
                owner={getOwnerForVideo ? getOwnerForVideo(item) : owner}
                isActive={visible && item.id === activeVideoId}
                videoBottomInset={videoBottomInset}
                actionsBottom={actionsBottom}
                metaBottom={metaBottom}
                ownProfileNavBarHeight={ownProfileNavBarHeight}
                ownVideoActions={ownVideoActions}
                chromeOpacity={chromeOpacity}
                chromeHolding={chromeHolding}
                chromeLocked={chromeLocked}
                onChromeHoldStart={handleChromeHoldStart}
                onChromeHoldEnd={handleChromeHoldEnd}
                onChromeLock={handleChromeLock}
                onChromeUnlock={handleChromeUnlock}
                onSpeedHoldStart={handleSpeedHoldStart}
                onSpeedHoldEnd={handleSpeedHoldEnd}
                onSave={handleSave}
                onMessage={onMessage}
                onNotInterested={onNotInterested}
                onBlock={onBlock}
                onReport={onReport}
              />
            )}
          />
        </Animated.View>
      </PanGestureHandler>
      {showMessageBar ? (
        <Animated.View
          pointerEvents={chromeInteractive ? "box-none" : "none"}
          style={[
            styles.fullscreenMessageBar,
            {
              height: messageBarHeight,
              bottom: keyboardOffset,
              paddingBottom: Math.max(insets.bottom, 12),
              opacity: chromeOpacity,
            },
          ]}
        >
          <TextInput
            ref={messageInputRef}
            value={messageDraft}
            onChangeText={(value) => setMessageDraft(value.slice(0, 200))}
            onFocus={() => setMessageInputFocused(true)}
            onBlur={() => setMessageInputFocused(false)}
            editable={!currentPendingSentJam && !messageSending}
            placeholder={currentPendingSentJam ? "waiting for a jam" : "message..."}
            placeholderTextColor="#71717a"
            returnKeyType="send"
            enablesReturnKeyAutomatically
            onSubmitEditing={() => void submitFullscreenMessage()}
            maxLength={200}
            style={styles.fullscreenMessageInput}
          />
          <Animated.View style={[styles.fullscreenMessageSendFrame, { width: messageSendButtonWidth }]}>
            <Pressable
              onPress={() => void submitFullscreenMessage()}
              disabled={!messageDraft.trim() || currentPendingSentJam || messageSending}
              style={[
                styles.fullscreenMessageSendButton,
                (!messageDraft.trim() || currentPendingSentJam || messageSending) && styles.disabled,
              ]}
            >
              {messageSentTickVisible ? (
                <Animated.Text
                  style={[
                    styles.fullscreenMessageSendText,
                    styles.fullscreenMessageSentTick,
                    { transform: [{ scale: messageSentTickScale }] },
                  ]}
                >
                  ✓
                </Animated.Text>
              ) : (
                <Text style={styles.fullscreenMessageSendText}>{messageSending ? "..." : "send"}</Text>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );

  if (presentation === "overlay") {
    return <View style={styles.fullscreenOverlay}>{content}</View>;
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

function useDailyJamUsage(active: boolean) {
  const [usage, setUsage] = useState<DailyJamUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshRequestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;
    setLoading(true);
    try {
      const next = await fetchDailyJamUsage();
      if (requestId !== refreshRequestIdRef.current) return null;
      setUsage(next);
      return next;
    } catch {
      if (requestId !== refreshRequestIdRef.current) return null;
      return null;
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    void refresh();

    const appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void refresh();
      }
    });

    return () => {
      refreshRequestIdRef.current += 1;
      appStateSubscription.remove();
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !usage?.resetsAt) return;

    const resetsAtMs = new Date(usage.resetsAt).getTime();
    if (!Number.isFinite(resetsAtMs)) return;

    const delayMs = Math.max(1000, resetsAtMs - Date.now() + 250);
    const timer = setTimeout(() => {
      void refresh();
    }, Math.min(delayMs, 24 * 60 * 60 * 1000));

    return () => clearTimeout(timer);
  }, [active, refresh, usage?.resetsAt, usage?.usageDate]);

  return { usage, loading, refresh };
}

function DmModal({
  item,
  onClose,
  onOpenProfile,
  onSend,
  presentation = "modal",
}: {
  item: FeedVideo | null;
  onClose: () => void;
  onOpenProfile: (item: FeedVideo) => void;
  onSend: (body: string) => Promise<void>;
  presentation?: "modal" | "overlay";
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const { usage, loading: usageLoading, refresh: refreshJamUsage } = useDailyJamUsage(Boolean(item));
  const jamLimitReached = usage != null && usage.remaining <= 0;

  useEffect(() => {
    const timer = setTimeout(() => setBody(""), 0);
    return () => clearTimeout(timer);
  }, [item]);

  useEffect(() => {
    if (!item) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(Math.max(0, viewportHeight - event.endCoordinates.screenY));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [item]);

  if (!item) return null;

  async function submit() {
    if (!body.trim() || sending) return;
    if (jamLimitReached) {
      Alert.alert(
        "daily jam limit reached",
        "you've used all your jams for today. they reset at midnight.",
      );
      return;
    }

    setSending(true);
    try {
      await onSend(body.trim());
      await refreshJamUsage();
    } catch (err) {
      await refreshJamUsage();
      Alert.alert("could not send", err instanceof Error ? err.message : "try again");
    } finally {
      setSending(false);
    }
  }

  const sendDisabled = sending || !body.trim() || jamLimitReached;
  const usageCopy = usage
    ? formatDailyJamUsageCopy(usage)
    : usageLoading
      ? "checking today's jam limit..."
      : null;

  const content = (
    <View
      style={[
        styles.jamPromptOverlay,
        keyboardInset > 0 && {
          justifyContent: "flex-end",
          paddingBottom: keyboardInset + 12,
        },
      ]}
    >
      <Pressable style={styles.jamPromptShade} onPress={onClose} />
      <View style={styles.jamPromptCard}>
        <View style={styles.row}>
          <Pressable onPress={() => onOpenProfile(item)} accessibilityLabel={`open ${item.creatorName}'s profile`}>
            <Avatar uri={item.avatarUrl} size={44} />
          </Pressable>
          <View>
            <Text style={styles.cardTitle}>jam with {item.creatorName}</Text>
            <Text style={styles.helper}>{item.role} - {item.location}</Text>
          </View>
        </View>
        <TextInput
          value={body}
          onChangeText={(value) => setBody(value.slice(0, 200))}
          placeholder="let's jam"
          placeholderTextColor="#71717a"
          multiline
          blurOnSubmit
          returnKeyType="send"
          enablesReturnKeyAutomatically
          onSubmitEditing={() => void submit()}
          editable={!jamLimitReached}
          maxLength={200}
          style={[styles.input, styles.textArea]}
        />
        <View style={styles.jamPromptMetaRow}>
          {usageCopy ? (
            <Text style={[styles.helper, jamLimitReached && styles.jamLimitReachedText]}>{usageCopy}</Text>
          ) : (
            <View />
          )}
          <Text style={styles.charCount}>{body.length}/200</Text>
        </View>
        <View style={styles.twoCol}>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>cancel</Text>
          </Pressable>
          <PrimaryButton
            label={jamLimitReached ? "limit reached" : sending ? "sending..." : "send"}
            disabled={sendDisabled}
            onPress={submit}
          />
        </View>
      </View>
    </View>
  );

  if (presentation === "overlay") {
    return <View style={styles.jamPromptHost}>{content}</View>;
  }

  return (
    <Modal animationType="fade" transparent visible={Boolean(item)} onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.confirmModalOverlay}>
        <Pressable style={styles.jamPromptShade} onPress={onCancel} />
        <View style={styles.confirmModalCard}>
          <Text style={styles.confirmModalTitle}>{title}</Text>
          {message ? <Text style={styles.confirmModalMessage}>{message}</Text> : null}
          <View style={styles.confirmModalActions}>
            <Pressable style={styles.confirmModalOption} onPress={onCancel}>
              <Text style={styles.confirmOptionCancelText}>cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmModalOption} onPress={onConfirm}>
              <Text style={styles.confirmOptionDangerText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const feedReportReasons: Array<{ id: ReportReason; label: string }> = [
  { id: "inappropriate_content", label: "Inappropriate content" },
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
];

function FeedReportModal({
  item,
  submitting,
  onClose,
  onSubmit,
}: {
  item: FeedVideo | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason) => void;
}) {
  if (!item) return null;

  return (
    <Modal animationType="fade" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <View style={styles.jamPromptOverlay}>
        <Pressable style={styles.jamPromptShade} onPress={onClose} />
        <View style={styles.jamPromptCard}>
          <Text style={styles.cardTitle}>Report video</Text>
          <Text style={styles.helper}>Tell us what is wrong with {item.creatorName}&apos;s video.</Text>
          <View style={styles.reportReasonList}>
            {feedReportReasons.map((reason) => (
              <Pressable
                key={reason.id}
                disabled={submitting}
                style={[styles.reportReasonButton, submitting && styles.disabled]}
                onPress={() => onSubmit(reason.id)}
              >
                <Text style={styles.reportReasonText}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondaryButton} disabled={submitting} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function VideoThumbnailFilmstrip({
  frames,
  onSelect,
  filter = "none",
  textOverlays = [],
}: {
  frames: Array<{ timeMs: number; uri: string }>;
  onSelect: (timeMs: number, uri: string) => void;
  filter?: VideoFilter;
  textOverlays?: CreateTextOverlayItem[];
}) {
  const onSelectRef = useRef(onSelect);
  const lastIndexRef = useRef(0);
  const selectorLeftRef = useRef(0);
  const dragStartLeftRef = useRef(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [selectorLeft, setSelectorLeft] = useState(0);
  const frameHeight = CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT;
  const frameWidth = stripWidth > 0 && frames.length > 0 ? stripWidth / frames.length : 0;
  const selectorWidth =
    frameWidth > 0 ? Math.min(frameWidth * CREATE_THUMBNAIL_SELECTOR_WIDTH_SCALE, stripWidth) : 0;
  const selectorVisualLeft = selectorLeft - (selectorWidth - frameWidth) / 2;
  const maxSelectorLeft = Math.max(0, (frames.length - 1) * frameWidth);

  onSelectRef.current = onSelect;

  useEffect(() => {
    lastIndexRef.current = 0;
    selectorLeftRef.current = 0;
    setSelectorLeft(0);
    if (frames[0]) {
      onSelectRef.current(frames[0].timeMs, frames[0].uri);
    }
  }, [frames]);

  function setSelectorPosition(left: number) {
    const nextLeft = clamp(left, 0, maxSelectorLeft);
    selectorLeftRef.current = nextLeft;
    setSelectorLeft(nextLeft);
    return nextLeft;
  }

  function applySelectionForLeft(left: number) {
    if (!frameWidth || frames.length === 0) return;

    const index = clamp(Math.round(left / frameWidth), 0, frames.length - 1);
    const frame = frames[index];
    if (!frame || index === lastIndexRef.current) return;

    lastIndexRef.current = index;
    onSelectRef.current(frame.timeMs, frame.uri);
  }

  function snapSelector(left: number) {
    if (!frameWidth || frames.length === 0) return;

    const index = clamp(Math.round(left / frameWidth), 0, frames.length - 1);
    const snappedLeft = index * frameWidth;
    setSelectorPosition(snappedLeft);

    const frame = frames[index];
    if (!frame) return;

    lastIndexRef.current = index;
    onSelectRef.current(frame.timeMs, frame.uri);
  }

  function beginSelectorDrag() {
    dragStartLeftRef.current = selectorLeftRef.current;
  }

  function updateSelectorDrag(translationX: number) {
    const nextLeft = setSelectorPosition(dragStartLeftRef.current + translationX);
    applySelectionForLeft(nextLeft);
  }

  function handleSelectorGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (state === State.BEGAN) {
      beginSelectorDrag();
      return;
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      snapSelector(selectorLeftRef.current);
    }
  }

  return (
    <View
      style={styles.createThumbnailFilmstripWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== stripWidth) setStripWidth(nextWidth);
      }}
    >
      <PanGestureHandler
        onGestureEvent={(event) => updateSelectorDrag(event.nativeEvent.translationX)}
        onHandlerStateChange={handleSelectorGestureStateChange}
      >
        <View style={styles.createThumbnailFilmstripGestureArea}>
          <View style={[styles.createThumbnailFilmstripRow, stripWidth > 0 && { width: stripWidth }]}>
            {frames.map((frame) => (
              <View
                key={frame.timeMs}
                style={{ width: frameWidth, height: frameHeight, overflow: "hidden" }}
              >
                <Image
                  source={{ uri: frame.uri }}
                  style={{ width: frameWidth, height: frameHeight } as ImageStyle}
                />
                <VideoPresentationOverlays
                  filter={filter}
                  textOverlays={textOverlays}
                  density="micro"
                />
              </View>
            ))}
          </View>
          {frameWidth > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.createThumbnailFilmstripSelector,
                {
                  width: selectorWidth,
                  height: frameHeight,
                  left: selectorVisualLeft,
                },
              ]}
            />
          )}
        </View>
      </PanGestureHandler>
    </View>
  );
}

function TrimHandleChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <Svg width={10} height={14} viewBox="0 0 10 14">
      {direction === "right" ? (
        <Path
          d="M2 1 L8 7 L2 13"
          stroke="#09090b"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M8 1 L2 7 L8 13"
          stroke="#09090b"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

function CreateTrimFilmstrip({
  frames,
  loading,
  trimStartRatio,
  trimEndRatio,
  playbackRatio,
  scrubRatio,
  onLayoutWidth,
  onTrimHandleGesture,
  onTrimHandleStateChange,
}: {
  frames: Array<{ timeMs: number; uri: string }>;
  loading: boolean;
  trimStartRatio: number;
  trimEndRatio: number;
  playbackRatio: number;
  scrubRatio: number | null;
  onLayoutWidth: (width: number) => void;
  onTrimHandleGesture: (handle: "start" | "end", translationX: number) => void;
  onTrimHandleStateChange: (handle: "start" | "end", event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const [stripWidth, setStripWidth] = useState(0);
  const selectionProgressAnim = useRef(new Animated.Value(0)).current;
  const previousSelectionProgressRef = useRef(0);
  const hasInitializedProgressRef = useRef(false);
  const trimLeft = trimStartRatio * stripWidth;
  const trimRight = (1 - trimEndRatio) * stripWidth;
  const selectionWidth = Math.max(0, stripWidth - trimLeft - trimRight);
  const { progressTrackLeft, progressTrackWidth } = getTrimProgressTrackGeometry(trimLeft, selectionWidth);
  const leftHandleLeft = trimLeft;
  const rightHandleLeft = trimLeft + selectionWidth - CREATE_TRIM_HANDLE_WIDTH;
  const isStartFlush = trimStartRatio <= 0.001;
  const isEndFlush = trimEndRatio >= 0.999;
  const placeholderCount = Math.max(frames.length, CREATE_TRIM_FILMSTRIP_FRAME_COUNT);
  const targetSelectionProgress = getTrimSelectionProgress(
    scrubRatio ?? playbackRatio,
    trimStartRatio,
    trimEndRatio,
  );
  const progressFillWidth = selectionProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, progressTrackWidth],
  });
  const playheadTranslateX = selectionProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, progressTrackWidth - 2)],
  });

  useEffect(() => {
    if (!hasInitializedProgressRef.current) {
      hasInitializedProgressRef.current = true;
      previousSelectionProgressRef.current = targetSelectionProgress;
      selectionProgressAnim.setValue(targetSelectionProgress);
      return;
    }

    const previous = previousSelectionProgressRef.current;
    previousSelectionProgressRef.current = targetSelectionProgress;

    if (scrubRatio != null || targetSelectionProgress < previous - 0.25) {
      selectionProgressAnim.stopAnimation();
      selectionProgressAnim.setValue(targetSelectionProgress);
      return;
    }

    const animation = Animated.timing(selectionProgressAnim, {
      toValue: targetSelectionProgress,
      duration: 100,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [scrubRatio, selectionProgressAnim, targetSelectionProgress]);

  return (
    <View
      style={styles.createTrimFilmstripOuter}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== stripWidth) {
          setStripWidth(nextWidth);
          onLayoutWidth(nextWidth);
        }
      }}
    >
      <View style={styles.createTrimFilmstrip}>
        {loading ? (
          <View style={styles.createTrimFilmstripLoading}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : frames.length > 0 ? (
          <View style={styles.createTrimFilmstripFrames}>
            {frames.map((frame) => (
              <Image
                key={frame.timeMs}
                source={{ uri: frame.uri }}
                style={styles.createTrimFilmstripFrame as ImageStyle}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : (
          <View style={styles.createTrimFilmstripFrames}>
            {Array.from({ length: placeholderCount }, (_, index) => (
              <View key={index} style={styles.createTrimFilmstripFramePlaceholder} />
            ))}
          </View>
        )}

        {stripWidth > 0 ? (
          <>
            <View pointerEvents="none" style={[styles.createTrimFilmstripDim, { left: 0, width: trimLeft }]} />
            <View pointerEvents="none" style={[styles.createTrimFilmstripDim, { right: 0, width: trimRight }]} />
            <View
              pointerEvents="none"
              style={[
                styles.createTrimFilmstripSelection,
                {
                  left: trimLeft,
                  width: selectionWidth,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  borderTopLeftRadius: isStartFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                  borderBottomLeftRadius: isStartFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                  borderTopRightRadius: isEndFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                  borderBottomRightRadius: isEndFlush ? CREATE_TRIM_FILMSTRIP_RADIUS - 1 : 0,
                },
              ]}
            />

            {progressTrackWidth > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.createTrimProgressTrack,
                  {
                    left: progressTrackLeft,
                    width: progressTrackWidth,
                  },
                ]}
              >
                <Animated.View style={[styles.createTrimProgressFill, { width: progressFillWidth }]} />
                <Animated.View
                  style={[
                    styles.createTrimPlayhead,
                    {
                      transform: [{ translateX: playheadTranslateX }],
                    },
                  ]}
                />
              </View>
            ) : null}

            <PanGestureHandler
              onGestureEvent={(event) => onTrimHandleGesture("start", event.nativeEvent.translationX)}
              onHandlerStateChange={(event) => onTrimHandleStateChange("start", event)}
            >
              <Animated.View
                style={[
                  styles.createTrimHandleTab,
                  styles.createTrimHandleTabStart,
                  isStartFlush && styles.createTrimHandleTabStartFlush,
                  { left: leftHandleLeft },
                ]}
                accessibilityLabel="trim start"
              >
                <TrimHandleChevron direction="right" />
              </Animated.View>
            </PanGestureHandler>

            <PanGestureHandler
              onGestureEvent={(event) => onTrimHandleGesture("end", event.nativeEvent.translationX)}
              onHandlerStateChange={(event) => onTrimHandleStateChange("end", event)}
            >
              <Animated.View
                style={[
                  styles.createTrimHandleTab,
                  styles.createTrimHandleTabEnd,
                  isEndFlush && styles.createTrimHandleTabEndFlush,
                  { left: rightHandleLeft },
                ]}
                accessibilityLabel="trim end"
              >
                <TrimHandleChevron direction="left" />
              </Animated.View>
            </PanGestureHandler>
          </>
        ) : null}
      </View>
    </View>
  );
}

function CreatePostPreviewModal({
  visible,
  onClose,
  videoUri,
  videoWidth = null,
  videoHeight = null,
  filter,
  textOverlays,
  caption,
  lookingFor = false,
  profile,
  roles,
  genres,
  trimStartRatio = 0,
  trimEndRatio = 1,
}: {
  visible: boolean;
  onClose: () => void;
  videoUri: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  filter: VideoFilter;
  textOverlays: CreateTextOverlayItem[];
  caption: string;
  lookingFor?: boolean;
  profile: Profile | null;
  roles: string[];
  genres: string[];
  trimStartRatio?: number;
  trimEndRatio?: number;
}) {
  const insets = useSafeAreaInsets();
  const displayName = profile?.display_name?.trim() || "you";
  const role = profile?.creator_types?.[0] ?? "creator";
  const location = profile
    ? formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city) ??
      "unknown"
    : "unknown";
  const visibleTags = getUniqueStrings([...roles, ...genres]);
  const trimmedCaption = caption.trim();
  const createPreviewProBadge = getProBadgeKind({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });
  const visibleTextOverlays = textOverlays.filter((overlay) => overlay.text.trim());
  const previewNavBarHeight = getNavBarHeight(insets.bottom);
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: viewportWidth, height: viewportHeight });
  const [previewTextSizes, setPreviewTextSizes] = useState<Record<string, { width: number; height: number }>>({});
  const previewVideoHeight = Math.max(0, previewFrameSize.height - previewNavBarHeight);

  if (!visible || !videoUri) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.createPostPreviewBackdrop} onPress={onClose}>
        <View
          style={[styles.createPostPreviewFrame, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewFrameSize({ width, height });
          }}
        >
          <View style={[styles.feedPreviewVideoClip, { bottom: previewNavBarHeight }]}>
            <JamVideoView
              source={videoUri}
              style={styles.createPostPreviewVideo}
              knownWidth={videoWidth}
              knownHeight={videoHeight}
              shouldPlay
              isLooping
              isMuted={false}
              volume={1}
              trimStartRatio={trimStartRatio}
              trimEndRatio={trimEndRatio}
            />
            {filter !== "none" && (
              <View
                pointerEvents="none"
                style={[styles.createPostPreviewFilter, getVideoFilterOverlayStyle(filter)]}
              />
            )}
            <View pointerEvents="none" style={styles.createPostPreviewShade} />
          </View>
          {visibleTextOverlays.map((overlay) => {
            const previewTextSize = previewTextSizes[overlay.id] ?? { width: 0, height: 0 };
            const previewTextLeft = previewFrameSize.width * overlay.centerRatio.x - previewTextSize.width / 2;
            const previewTextTop = previewVideoHeight * overlay.centerRatio.y - previewTextSize.height / 2;
            const previewFontSize = getCreateTextOverlayFontSize(
              clampTextOverlayFontScale(overlay.fontScale),
            );
            const previewLineHeight = getCreateTextOverlayLineHeight(previewFontSize);
            const previewMaxWidth = Math.max(120, previewFrameSize.width * TEXT_OVERLAY_MAX_WIDTH_RATIO);
            const previewFontFamily = getVideoTextOverlayFontFamily(overlay.fontId);
            const previewFontWeight = getVideoTextOverlayFontWeight(overlay.fontId);
            const previewChrome = getVideoTextEffectChrome(overlay.effectId, {
              fontSize: previewFontSize,
              density: "edit",
            });
            const previewTextMaxWidth = Math.max(
              48,
              previewMaxWidth - previewChrome.paddingHorizontal * 2,
            );

            return (
              <View
                key={overlay.id}
                pointerEvents="none"
                style={[
                  styles.createPostPreviewTextOverlay,
                  {
                    left: previewTextLeft,
                    top: previewTextTop,
                    maxWidth: previewMaxWidth,
                    overflow: "visible",
                  },
                ]}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setPreviewTextSizes((current) => {
                    const previous = current[overlay.id];
                    if (previous?.width === width && previous?.height === height) return current;
                    return { ...current, [overlay.id]: { width, height } };
                  });
                }}
              >
                <VideoTextOverlayGlyph
                  text={overlay.text.trim()}
                  effectId={overlay.effectId}
                  density="edit"
                  textStyle={[
                    styles.createPostPreviewTextOverlayText,
                    {
                      fontSize: previewFontSize,
                      lineHeight: previewLineHeight,
                      maxWidth: previewTextMaxWidth,
                      fontFamily: previewFontFamily,
                      ...(previewFontWeight
                        ? { fontWeight: previewFontWeight }
                        : { fontWeight: undefined }),
                    },
                  ]}
                />
              </View>
            );
          })}
          <View pointerEvents="none" style={styles.createPostPreviewMeta}>
            <View style={styles.row}>
              <Avatar uri={profile?.avatar_url} size={52} />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={styles.feedName}>{displayName}</Text>
                  {createPreviewProBadge ? <ProBadge kind={createPreviewProBadge} /> : null}
                </View>
                <Text style={styles.feedRole}>
                  {role} - {location}
                </Text>
              </View>
            </View>
            {lookingFor || trimmedCaption ? (
              <View style={styles.feedCaptionRow}>
                {lookingFor ? (
                  <View style={styles.feedLookingForIcon} accessibilityLabel="looking for collaborators">
                    <LookingForIcon active size={19} shadow />
                  </View>
                ) : null}
                {trimmedCaption ? (
                  <Text style={[styles.caption, styles.feedCaptionText]}>{trimmedCaption}</Text>
                ) : null}
              </View>
            ) : null}
            {visibleTags.length > 0 ? (
              <View style={styles.tags}>
                {visibleTags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          <View
            pointerEvents="none"
            style={[styles.createPostPreviewNavBarPlaceholder, { height: previewNavBarHeight }]}
          />
          <Pressable
            style={[styles.createPostPreviewClose, { top: insets.top + 8 }]}
            onPress={onClose}
            accessibilityLabel="close preview"
          >
            <Text style={styles.closeIconText}>×</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const CreateEditTextOverlayInput = memo(function CreateEditTextOverlayInput({
  initialText,
  inputRef,
  fontSize,
  lineHeight,
  maxWidth,
  fontFamily,
  fontId,
  effectId,
  onDraftChange,
}: {
  initialText: string;
  inputRef: RefObject<TextInput | null>;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  fontFamily: string;
  fontId: VideoTextFontId;
  effectId: VideoTextEffectId;
  onDraftChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initialText);
  const chrome = getVideoTextEffectChrome(effectId, { fontSize, density: "edit" });
  const fontWeight = getVideoTextOverlayFontWeight(fontId);
  // Fixed width while typing — shrink-to-content width recenters the overlay every keystroke.
  const textWidth = Math.max(48, maxWidth - chrome.paddingHorizontal * 2);

  useEffect(() => {
    setDraft(initialText);
    onDraftChange(initialText);
  }, [initialText, onDraftChange]);

  const input = (
    <TextInput
      ref={inputRef}
      value={draft}
      onChangeText={(value) => {
        const next = value.slice(0, 60);
        setDraft(next);
        onDraftChange(next);
      }}
      style={[
        styles.createTextOverlayInput,
        {
          fontSize,
          lineHeight,
          width: textWidth,
          maxWidth: textWidth,
          fontFamily,
          ...(fontWeight ? { fontWeight } : null),
          color: chrome.color,
          textAlign: "center",
          includeFontPadding: false,
          ...(chrome.useSoftShadow
            ? null
            : {
                textShadowColor: "transparent",
                textShadowRadius: 0,
                textShadowOffset: { width: 0, height: 0 },
              }),
          ...(chrome.useOutline
            ? {
                // Soft circular halo approximates the curved glyph stroke while typing.
                textShadowColor: "#000",
                textShadowRadius: Math.max(2.5, getVideoTextOutlineRadius(fontSize, "edit") * 1.15),
                textShadowOffset: { width: 0, height: 0 },
              }
            : null),
        },
      ]}
      maxLength={60}
      multiline
      textAlign="center"
      blurOnSubmit={false}
      selectionColor={chrome.color === "#111" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.9)"}
      cursorColor={chrome.color}
      placeholder=""
    />
  );

  if (!chrome.backgroundColor && !chrome.useOutline) return input;

  return (
    <View
      style={{
        backgroundColor: chrome.backgroundColor,
        paddingHorizontal: chrome.paddingHorizontal,
        paddingVertical: chrome.paddingVertical,
        borderRadius: chrome.borderRadius,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      {input}
    </View>
  );
});

const CreateEditTextOverlayItem = memo(function CreateEditTextOverlayItem({
  overlay,
  isEditing,
  viewportWidth,
  viewportHeight,
  committedSize,
  inputRef,
  onDraftChange,
  onOpenActions,
  onEditText,
  onSizeChange,
  onFontScaleChange,
  onPinchActiveChange,
  onPanGesture,
  onPanStateChange,
}: {
  overlay: CreateTextOverlayItem;
  isEditing: boolean;
  viewportWidth: number;
  viewportHeight: number;
  committedSize: { width: number; height: number };
  inputRef: RefObject<TextInput | null>;
  onDraftChange: (text: string) => void;
  onOpenActions: () => void;
  onEditText: () => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  onFontScaleChange: (fontScale: number) => void;
  onPinchActiveChange: (active: boolean) => void;
  onPanGesture: (event: PanGestureHandlerGestureEvent) => void;
  onPanStateChange: (event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const pinchBaseScaleRef = useRef(overlay.fontScale);
  const pinchFrameRef = useRef<number | null>(null);
  const pendingPinchScaleRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveFontScale, setLiveFontScale] = useState(overlay.fontScale);
  const [liveSize, setLiveSize] = useState(committedSize);
  // Freeze left/top after the first edit layout so typing doesn't re-center every keystroke.
  const [editAnchor, setEditAnchor] = useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const showOverlay = isEditing || Boolean(overlay.text.trim());
  const fontScale = isEditing ? overlay.fontScale : liveFontScale;
  const fontSize = getCreateTextOverlayFontSize(fontScale);
  const lineHeight = getCreateTextOverlayLineHeight(fontSize);
  const fontFamily = getVideoTextOverlayFontFamily(overlay.fontId);
  const maxTextWidth = Math.max(120, viewportWidth * TEXT_OVERLAY_MAX_WIDTH_RATIO);
  const size = isEditing ? liveSize : committedSize;
  const centeredLeft = viewportWidth * overlay.centerRatio.x - size.width / 2;
  const centeredTop = viewportHeight * overlay.centerRatio.y - size.height / 2;
  const overlayLeft = isEditing && editAnchor ? editAnchor.left : centeredLeft;
  const overlayTop = isEditing && editAnchor ? editAnchor.top : centeredTop;

  useEffect(() => {
    if (!isEditing) {
      setLiveSize(committedSize);
      setEditAnchor(null);
    }
  }, [committedSize, isEditing]);

  useEffect(() => {
    if (!isEditing) return;

    // Seed a stable centered frame once when editing begins so typing doesn't
    // re-center the overlay on every keystroke / layout pass.
    const chrome = getVideoTextEffectChrome(overlay.effectId, {
      fontSize: getCreateTextOverlayFontSize(overlay.fontScale),
      density: "edit",
    });
    const seededWidth =
      committedSize.width > 0
        ? committedSize.width
        : Math.max(120, viewportWidth * TEXT_OVERLAY_MAX_WIDTH_RATIO);
    const seededHeight =
      committedSize.height > 0
        ? committedSize.height
        : getCreateTextOverlayLineHeight(getCreateTextOverlayFontSize(overlay.fontScale)) +
          chrome.paddingVertical * 2;
    setLiveSize({ width: seededWidth, height: seededHeight });
    setEditAnchor({
      left: viewportWidth * overlay.centerRatio.x - seededWidth / 2,
      top: viewportHeight * overlay.centerRatio.y - seededHeight / 2,
    });
    // Only re-run when entering edit for this overlay (isEditing edge), not on
    // every size tick — that was causing jumpiness while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, overlay.id]);

  useEffect(() => {
    setLiveFontScale(overlay.fontScale);
  }, [overlay.fontScale]);

  useEffect(() => {
    if (isEditing) setIsDragging(false);
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (pinchFrameRef.current !== null) {
        cancelAnimationFrame(pinchFrameRef.current);
        pinchFrameRef.current = null;
      }
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  function scheduleLiveFontScale(nextScale: number) {
    pendingPinchScaleRef.current = nextScale;
    if (pinchFrameRef.current !== null) return;
    pinchFrameRef.current = requestAnimationFrame(() => {
      pinchFrameRef.current = null;
      if (pendingPinchScaleRef.current == null) return;
      setLiveFontScale(pendingPinchScaleRef.current);
    });
  }

  const handlePinchGesture = useCallback((event: PinchGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state !== State.ACTIVE) return;
    scheduleLiveFontScale(
      clampTextOverlayFontScale(pinchBaseScaleRef.current * event.nativeEvent.scale),
    );
  }, []);

  const handlePinchStateChange = useCallback(
    (event: PinchGestureHandlerStateChangeEvent) => {
      const { state, scale } = event.nativeEvent;

      if (state === State.BEGAN) {
        pinchBaseScaleRef.current = overlay.fontScale;
        onPinchActiveChange(true);
        return;
      }

      if (state === State.ACTIVE) {
        scheduleLiveFontScale(clampTextOverlayFontScale(pinchBaseScaleRef.current * scale));
        return;
      }

      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (pinchFrameRef.current !== null) {
          cancelAnimationFrame(pinchFrameRef.current);
          pinchFrameRef.current = null;
        }
        const nextScale = clampTextOverlayFontScale(pinchBaseScaleRef.current * scale);
        setLiveFontScale(nextScale);
        onFontScaleChange(nextScale);
        onPinchActiveChange(false);
      }
    },
    [onFontScaleChange, onPinchActiveChange, overlay.fontScale],
  );

  function handlePanStateChange(event: PanGestureHandlerStateChangeEvent) {
    const { state } = event.nativeEvent;
    if (state === State.ACTIVE) {
      setIsDragging(true);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      setIsDragging(false);
    }
    onPanStateChange(event);
  }

  function handleTextPress() {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      onEditText();
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      onOpenActions();
    }, 280);
  }

  if (!showOverlay) return null;

  const effectChrome = getVideoTextEffectChrome(overlay.effectId, { fontSize, density: "edit" });
  const fontWeight = getVideoTextOverlayFontWeight(overlay.fontId);
  const textMaxWidth = Math.max(48, maxTextWidth - effectChrome.paddingHorizontal * 2);
  const textStyle = [
    styles.createTextOverlayPreviewText,
    {
      fontSize,
      lineHeight,
      maxWidth: textMaxWidth,
      fontFamily,
      ...(fontWeight ? { fontWeight } : null),
    },
  ];

  return (
    <PinchGestureHandler
      ref={pinchRef}
      enabled={!isEditing}
      simultaneousHandlers={panRef}
      onGestureEvent={handlePinchGesture}
      onHandlerStateChange={handlePinchStateChange}
    >
      <Animated.View
        collapsable={false}
        pointerEvents={isDragging ? "auto" : "box-none"}
        style={[styles.createTextOverlayPinchCapture, isDragging && { zIndex: 20 }]}
      >
        <PanGestureHandler
          ref={panRef}
          enabled={!isEditing}
          simultaneousHandlers={pinchRef}
          activeOffsetX={[-12, 12]}
          activeOffsetY={[-12, 12]}
          onGestureEvent={onPanGesture}
          onHandlerStateChange={handlePanStateChange}
        >
          <Animated.View
            style={[
              styles.createTextOverlayDraggable,
              {
                left: overlayLeft,
                top: overlayTop,
                maxWidth: maxTextWidth,
                overflow: "visible",
              },
            ]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width === size.width && height === size.height) return;
              if (isEditing) {
                // Keep left/top frozen (editAnchor); only track size for later commit.
                setLiveSize({ width, height });
                return;
              }
              onSizeChange({ width, height });
            }}
          >
            {isEditing ? (
              <CreateEditTextOverlayInput
                initialText={overlay.text}
                inputRef={inputRef}
                fontSize={fontSize}
                lineHeight={lineHeight}
                maxWidth={maxTextWidth}
                fontFamily={fontFamily}
                fontId={overlay.fontId}
                effectId={overlay.effectId}
                onDraftChange={onDraftChange}
              />
            ) : (
              <Pressable
                onPress={handleTextPress}
                accessibilityLabel="text overlay options. double tap to edit"
              >
                <VideoTextOverlayGlyph
                  text={overlay.text.trim()}
                  effectId={overlay.effectId}
                  density="edit"
                  textStyle={textStyle}
                />
              </Pressable>
            )}
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
  );
});

function CreateScreen({
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
                source={require("./assets/camera-roll-placeholder.png")}
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

function InboxScreen({
  userId,
  viewerProfile,
  refreshSignal,
  savedVideoController,
  onUnreadCountChanged,
  onViewerProfileUpdated,
}: {
  userId: string;
  viewerProfile: Profile | null;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  onUnreadCountChanged: (count: number) => void;
  onViewerProfileUpdated?: (profile: Profile) => void;
}) {
  const [tab, setTab] = useState<InboxTab>("requests");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearbyUserIds, setNearbyUserIds] = useState<Set<string> | null>(null);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [jams, setJams] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [system, setSystem] = useState<InboxMessage[]>([]);
  const [removedInboxUserIds, setRemovedInboxUserIds] = useState<Set<string>>(() => new Set());
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [preloadedProfile, setPreloadedProfile] = useState<PreloadedUserProfile | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const profilePreloadCacheRef = useRef(new Map<string, PreloadedUserProfile>());
  const profileNavigationRequestRef = useRef(0);
  const insets = useSafeAreaInsets();
  const nearMeRadiusMiles = normalizeNearMeRadius(viewerProfile?.near_me_radius_miles);

  const matchesInboxFilters = useCallback(
    (role: string, location: string, otherUserId: string) => {
      const roleMatch =
        filterRoles.length === 0 ||
        filterRoles.some((selectedRole) => selectedRole.toLowerCase() === role.toLowerCase());
      const locationMatch = !filterLocation || locationFilterMatches(location, filterLocation);
      const nearMeMatch = !nearMeActive || (nearbyUserIds?.has(otherUserId) ?? false);
      return roleMatch && locationMatch && nearMeMatch;
    },
    [filterLocation, filterRoles, nearMeActive, nearbyUserIds],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => matchesInboxFilters(request.role, request.location, request.userId)),
    [matchesInboxFilters, requests],
  );
  const filteredJams = useMemo(
    () =>
      jams.filter((conversation) =>
        matchesInboxFilters(conversation.role, conversation.location, conversation.userId),
      ),
    [jams, matchesInboxFilters],
  );
  const filteredSent = useMemo(
    () =>
      sent.filter((conversation) =>
        matchesInboxFilters(conversation.role, conversation.location, conversation.userId),
      ),
    [matchesInboxFilters, sent],
  );
  const filtersActive = filterRoles.length > 0 || Boolean(filterLocation) || nearMeActive;
  const jamTabItems = useMemo(() => {
    const conversationItems = filteredJams.map((conversation) => ({
      type: "conversation" as const,
      id: conversation.id,
      sortAt: conversation.lastActivityAt,
      conversation,
    }));
    // Hide system messages while role/location/near-me filters are on.
    const systemItems = filtersActive
      ? []
      : system.map((message) => ({
          type: "system" as const,
          id: message.id,
          sortAt: message.created_at,
          message,
        }));

    return [...conversationItems, ...systemItems].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  }, [filteredJams, filtersActive, system]);

  const refreshNearbyUserIds = useCallback(
    async (location: { latitude: number; longitude: number }) => {
      const ids = await fetchNearbyUserIds({
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMiles: nearMeRadiusMiles,
      });
      setNearbyUserIds(ids);
      return ids;
    },
    [nearMeRadiusMiles],
  );

  async function refreshViewerGpsLocation() {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setUserLocation(nextLocation);
    return nextLocation;
  }

  async function toggleNearMe() {
    if (nearMeLoading) return;

    if (nearMeActive) {
      setNearMeActive(false);
      setNearbyUserIds(null);
      return;
    }

    const confirmed = await confirmNearMeLiveLocationSharing(userId);
    if (!confirmed) return;

    setNearMeActive(true);
    setNearMeLoading(true);

    try {
      // Near-me also turns on live location sharing so Settings stays in sync.
      const alreadySharing = await isLiveLocationSharingEnabled(userId);
      if (!alreadySharing) {
        const result = await enableLiveLocationSharing(userId);
        if ("error" in result) {
          setNearMeActive(false);
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          return;
        }

        onViewerProfileUpdated?.(result.profile);
        let nextLocation: { latitude: number; longitude: number } | null = null;
        if (result.profile.live_latitude != null && result.profile.live_longitude != null) {
          nextLocation = {
            latitude: result.profile.live_latitude,
            longitude: result.profile.live_longitude,
          };
          setUserLocation(nextLocation);
        } else {
          nextLocation = await refreshViewerGpsLocation();
        }
        await refreshNearbyUserIds(nextLocation);
        return;
      }

      const nextLocation = await refreshViewerGpsLocation();
      await refreshNearbyUserIds(nextLocation);
    } catch (err) {
      setNearMeActive(false);
      setNearbyUserIds(null);
      Alert.alert(
        "could not get location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
    } finally {
      setNearMeLoading(false);
    }
  }

  // Refresh nearby IDs when radius changes while near-me is on.
  useEffect(() => {
    if (!nearMeActive || !userLocation || nearMeLoading) return;
    void refreshNearbyUserIds(userLocation).catch(() => undefined);
  }, [nearMeActive, nearMeLoading, nearMeRadiusMiles, refreshNearbyUserIds, userLocation]);

  useEffect(() => {
    const chatUserId =
      activeChat && !("sender_name" in activeChat)
        ? activeChat.userId
        : activeDm?.userId ?? null;
    setActiveInboxChatUserId(chatUserId);
    return () => {
      if (getActiveInboxChatUserId() === chatUserId) {
        setActiveInboxChatUserId(null);
      }
    };
  }, [activeChat, activeDm]);

  const load = useCallback(async () => {
    const data = await fetchInbox(userId);
    const nextRequests = data.requests.filter((request) => !removedInboxUserIds.has(request.userId));
    const nextJams = data.conversations.filter((conversation) => !removedInboxUserIds.has(conversation.userId));
    const nextSent = data.sent.filter((conversation) => !removedInboxUserIds.has(conversation.userId));
    setRequests(nextRequests);
    setJams(nextJams);
    setSent(nextSent);
    setSystem(data.systemMessages);
    onUnreadCountChanged(getUnreadInboxCount({
      requests: nextRequests,
      conversations: nextJams,
      sent: nextSent,
      systemMessages: data.systemMessages,
    }));
  }, [onUnreadCountChanged, removedInboxUserIds, userId]);

  function removeUserFromInbox(removedUserId: string) {
    const hadUnreadPerson =
      requests.some((request) => request.userId === removedUserId && request.unreadCount > 0) ||
      jams.some((conversation) => conversation.userId === removedUserId && conversation.unreadCount > 0);
    setRemovedInboxUserIds((current) => new Set(current).add(removedUserId));
    setRequests((current) => current.filter((request) => request.userId !== removedUserId));
    setJams((current) => current.filter((conversation) => conversation.userId !== removedUserId));
    setSent((current) => current.filter((conversation) => conversation.userId !== removedUserId));
    setActiveChat((current) =>
      current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
    );
    setActiveDm((current) => (current?.userId === removedUserId ? null : current));
    setProfileUserId(null);
    setPreloadedProfile(null);
    profilePreloadCacheRef.current.delete(removedUserId);
    if (hadUnreadPerson) {
      onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - 1));
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load, refreshSignal]);

  async function refreshInbox() {
    setRefreshing(true);
    try {
      await load();
      if (nearMeActive && userLocation) {
        await refreshNearbyUserIds(userLocation);
      }
    } catch (err) {
      Alert.alert("could not refresh inbox", err instanceof Error ? err.message : "try again");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  const preloadProfile = useCallback(async (targetUserId: string) => {
    const cached = profilePreloadCacheRef.current.get(targetUserId);
    if (cached) return cached;

    const [profile, videos, relationship] = await Promise.all([
      fetchCreatorProfile(userId, targetUserId),
      fetchCreatorVideos(userId, targetUserId),
      fetchRelationshipState(userId, targetUserId),
    ]);
    const nextPreloadedProfile = {
      userId: targetUserId,
      profile,
      videos,
      jammedByMe: relationship.jammedByMe,
      jammedMe: relationship.jammedMe,
    };

    profilePreloadCacheRef.current.set(targetUserId, nextPreloadedProfile);
    return nextPreloadedProfile;
  }, [userId]);

  useEffect(() => {
    if (!activeChat || "sender_name" in activeChat) return;
    void preloadProfile(activeChat.userId).catch(() => undefined);
  }, [activeChat, preloadProfile]);

  async function openProfile(nextUserId: string | null | undefined) {
    try {
      const targetUserId = nextUserId?.trim();
      if (!targetUserId) {
        throw new Error("Profile is unavailable.");
      }

      const requestId = profileNavigationRequestRef.current + 1;
      profileNavigationRequestRef.current = requestId;

      setActiveDm(null);
      setPreloadedProfile(profilePreloadCacheRef.current.get(targetUserId) ?? null);
      setProfileUserId(targetUserId);

      const nextPreloadedProfile = await preloadProfile(targetUserId);
      if (profileNavigationRequestRef.current === requestId) {
        setPreloadedProfile(nextPreloadedProfile);
      }
    } catch (err) {
      Alert.alert("could not open profile", err instanceof Error ? err.message : "try again");
    }
  }

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);
    setPreloadedProfile(null);
    setActiveDm(profileFeedItem);
  }

  function openRequest(request: InboxRequest) {
    const conversation = conversationFromRequest(request);
    setActiveChat(conversation);
    setRequests((current) =>
      current.map((item) =>
        item.userId === request.userId ? { ...item, unreadCount: 0 } : item,
      ),
    );
    onUnreadCountChanged(
      Math.max(
        0,
        getUnreadLocalInboxCount(requests, jams, sent, system) - (request.unreadCount > 0 ? 1 : 0),
      ),
    );
    void markConversationRead(userId, request.userId).catch(() => undefined);
    void fetchConversationMessages(userId, request.userId)
      .then((page) => {
        setActiveChat((current) => {
          if (!current || "sender_name" in current || current.userId !== request.userId) {
            return current;
          }
          return {
            ...current,
            messages: page.messages.length > 0 ? page.messages : current.messages,
            hasMoreMessages: Boolean(page.nextCursor),
            olderMessagesCursor: page.nextCursor,
          };
        });
      })
      .catch(() => undefined);
  }

  function openConversation(conversation: Conversation) {
    const hadUnreadPerson = jams.some((item) => item.userId === conversation.userId)
      ? conversation.unreadCount > 0
      : false;
    const nextConversation = { ...conversation, unread: false, unreadCount: 0 };
    setActiveChat(nextConversation);
    setJams((current) =>
      current.map((item) =>
        item.userId === conversation.userId ? { ...item, unread: false, unreadCount: 0 } : item,
      ),
    );
    setSent((current) =>
      current.map((item) =>
        item.userId === conversation.userId ? { ...item, unread: false, unreadCount: 0 } : item,
      ),
    );
    onUnreadCountChanged(
      Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - (hadUnreadPerson ? 1 : 0)),
    );
    void markConversationRead(userId, conversation.userId).catch(() => undefined);
    void fetchConversationMessages(userId, conversation.userId)
      .then((page) => {
        setActiveChat((current) => {
          if (!current || "sender_name" in current || current.userId !== conversation.userId) {
            return current;
          }
          return {
            ...current,
            messages: page.messages.length > 0 ? page.messages : current.messages,
            hasMoreMessages: Boolean(page.nextCursor),
            olderMessagesCursor: page.nextCursor,
          };
        });
      })
      .catch(() => undefined);
  }

  async function loadOlderChatMessages(conversation: Conversation) {
    if (!conversation.olderMessagesCursor && !conversation.hasMoreMessages) return;
    const page = await fetchConversationMessages(userId, conversation.userId, {
      cursor: conversation.olderMessagesCursor ?? undefined,
    });
    setActiveChat((current) => {
      if (!current || "sender_name" in current || current.userId !== conversation.userId) {
        return current;
      }
      const existingIds = new Set(current.messages.map((message) => message.id));
      const older = page.messages.filter((message) => !existingIds.has(message.id));
      return {
        ...current,
        messages: [...older, ...current.messages],
        hasMoreMessages: Boolean(page.nextCursor),
        olderMessagesCursor: page.nextCursor,
      };
    });
  }

  function openSystemMessage(message: InboxMessage) {
    const hadUnreadSystem = system.some((item) => !item.read);
    const nextMessage = { ...message, read: true };
    setActiveChat(nextMessage);
    setSystem((current) =>
      current.map((item) => (item.id === message.id ? { ...item, read: true } : item)),
    );
    const stillHasUnreadSystem = system.some(
      (item) => item.id !== message.id && !item.read,
    );
    if (hadUnreadSystem && !stillHasUnreadSystem) {
      onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - 1));
    }
    void markInboxMessageRead(message.id).catch(() => undefined);
  }

  return (
    <View style={styles.safeWithNav}>
      <ScrollView
        contentContainerStyle={[
          getTabScreenContentStyle(insets.top),
          // Match discover feedTopBar vertical inset (insets.top + 12).
          { paddingTop: insets.top + 12 },
        ]}
        refreshControl={
          <RefreshControl
            tintColor={getActivityIndicatorColor()}
            refreshing={refreshing}
            onRefresh={refreshInbox}
          />
        }
      >
        <View style={styles.inboxTopBar}>
          <Pressable
            style={[styles.feedNearMeButton, nearMeActive && styles.feedNearMeButtonActive]}
            accessibilityLabel={nearMeActive ? "near me on, sharing live location" : "near me"}
            accessibilityHint="turns on share live location to find creators nearby"
            accessibilityRole="button"
            accessibilityState={{ selected: nearMeActive, busy: nearMeLoading }}
            onPress={() => void toggleNearMe()}
          >
            {nearMeLoading ? (
              <ActivityIndicator color={getActivityIndicatorColor()} size="small" />
            ) : (
              <NearMeIcon active={nearMeActive} />
            )}
          </Pressable>
          <View style={styles.feedRecentFiltersArea} pointerEvents="none" />
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={[
              styles.feedFilterButton,
              (filterRoles.length > 0 || Boolean(filterLocation)) && styles.inboxFilterButtonActive,
            ]}
            accessibilityLabel="filter inbox"
            accessibilityRole="button"
            accessibilityState={{ selected: filterRoles.length > 0 || Boolean(filterLocation) }}
          >
            <FeedFilterIcon color={getActivityIndicatorColor()} />
          </Pressable>
        </View>
        <SegmentedTabs tabs={["requests", "jams", "sent"]} active={tab} onChange={(value) => setTab(value as InboxTab)} />
        {loading || (nearMeActive && nearMeLoading && !nearbyUserIds) ? (
          <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
        ) : tab === "requests" ? (
          <View style={styles.list}>
            {filteredRequests.map((request) => (
              <ConversationRow
                key={request.id}
                conversation={{
                  id: request.id,
                  userId: request.userId,
                  creatorName: request.creatorName,
                  avatarUrl: request.avatarUrl,
                  role: request.role,
                  location: request.location,
                  lastMessage: request.preview,
                  timestamp: request.sentAt,
                  lastActivityAt: request.sentAt,
                  unread: request.unreadCount > 0,
                  unreadCount: request.unreadCount,
                  earlyAdopter: request.earlyAdopter,
                  proBadge: request.proBadge,
                  unlocked: false,
                  messages: [],
                }}
                onPress={() => openRequest(request)}
                onOpenProfile={() => openProfile(request.userId)}
              />
            ))}
            {filteredRequests.length === 0 && (
              <Text style={styles.inboxEmptyText}>
                {getInboxEmptyCopy({
                  tab: "requests",
                  filtersActive: filterRoles.length > 0 || Boolean(filterLocation),
                  nearMeActive,
                })}
              </Text>
            )}
          </View>
        ) : tab === "jams" ? (
          <View style={styles.list}>
            {jamTabItems.map((item) =>
              item.type === "conversation" ? (
                <ConversationRow
                  key={item.id}
                  conversation={item.conversation}
                  onPress={() => openConversation(item.conversation)}
                  onOpenProfile={() => openProfile(item.conversation.userId)}
                />
              ) : (
                <SystemRow
                  key={item.id}
                  message={item.message}
                  onPress={() => openSystemMessage(item.message)}
                />
              ),
            )}
            {jamTabItems.length === 0 && (
              <Text style={styles.inboxEmptyText}>
                {getInboxEmptyCopy({
                  tab: "jams",
                  filtersActive: filterRoles.length > 0 || Boolean(filterLocation),
                  nearMeActive,
                })}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredSent.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onPress={() => openConversation(conversation)}
                onOpenProfile={() => openProfile(conversation.userId)}
                subdued
              />
            ))}
            {filteredSent.length === 0 && (
              <Text style={styles.inboxEmptyText}>
                {getInboxEmptyCopy({
                  tab: "sent",
                  filtersActive: filterRoles.length > 0 || Boolean(filterLocation),
                  nearMeActive,
                })}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      <FilterSheet
        visible={filtersOpen}
        selectedRoles={filterRoles}
        selectedGenres={EMPTY_FILTER_GENRES}
        selectedLocation={filterLocation}
        includeGenres={false}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, _nextGenres, nextLocation) => {
          setFilterRoles(nextRoles);
          setFilterLocation(nextLocation);
          setFiltersOpen(false);
        }}
      />
      <ChatModal
        active={activeChat}
        currentUserId={userId}
        savedVideoController={savedVideoController}
        onClose={() => setActiveChat(null)}
        onOpenProfile={openProfile}
        onLoadOlderMessages={loadOlderChatMessages}
        onInboxChanged={() => {
          void load();
        }}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });

            await load();
            if (unlocksFromReply) setTab("jams");
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
          await load();
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
          await load();
        }}
        profileOverlay={
          activeChat && !("sender_name" in activeChat) && profileUserId ? (
            <UserProfileModal
              currentUserId={userId}
              userId={profileUserId}
              preloadedProfile={preloadedProfile}
              savedVideoController={savedVideoController}
              inline
              onClose={() => {
                setProfileUserId(null);
                setPreloadedProfile(null);
              }}
              onMessage={(profileFeedItem) => {
                openJamFromProfile(profileFeedItem);
              }}
              onInboxChanged={() => {
                void load();
              }}
              onUnjammed={(removedUserId) => {
                removeUserFromInbox(removedUserId);
              }}
              onBlocked={(blockedUserId) => {
                removeUserFromInbox(blockedUserId);
              }}
            />
          ) : null
        }
      />
      <UserProfileModal
        currentUserId={userId}
        userId={activeChat && !("sender_name" in activeChat) ? null : profileUserId}
        preloadedProfile={preloadedProfile}
        savedVideoController={savedVideoController}
        onClose={() => {
          setProfileUserId(null);
          setPreloadedProfile(null);
        }}
        onMessage={(profileFeedItem) => {
          openJamFromProfile(profileFeedItem);
        }}
        onInboxChanged={() => {
          void load();
        }}
        onUnjammed={(removedUserId) => {
          removeUserFromInbox(removedUserId);
        }}
        onBlocked={(blockedUserId) => {
          removeUserFromInbox(blockedUserId);
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          openProfile(item.userId);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          await sendJamRequest(activeDm.userId, body, activeDm.id);
          setActiveDm(null);
          await load();
        }}
      />
    </View>
  );
}

function MyProfileScreen({
  userId,
  themeMode,
  onThemeModeChange,
  refreshSignal,
  savedVideoController,
  initialProfile = null,
  onInboxChanged,
  onProfileChanged,
  onLoggedOut,
}: {
  userId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  /** Cached profile from app shell so the header can paint before videos load. */
  initialProfile?: Profile | null;
  onInboxChanged: () => void;
  onProfileChanged: (profile: Profile) => void;
  onLoggedOut: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [saved, setSaved] = useState<ProfileVideo[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "saved">("videos");
  const [tabSlide] = useState(() => new Animated.Value(0));
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [ownFullscreenIndex, setOwnFullscreenIndex] = useState<number | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [profileHeaderCollapsed, setProfileHeaderCollapsed] = useState(false);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [videosLoading, setVideosLoading] = useState(true);
  const [pinPreviewActive, setPinPreviewActive] = useState(false);
  const hasLoadedVideosRef = useRef(false);
  /** Local pin ranks that must win over in-flight profile reloads. */
  const pendingPinRanksRef = useRef(new Map<string, number | null>());
  const profileScrollRef = useRef<ProfileScrollFadeHandle>(null);
  const insets = useSafeAreaInsets();
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const pendingUploads = usePendingVideoUploads();
  const pendingProfileVideos = useMemo(
    () =>
      pendingUploads
        .filter((upload) => upload.userId === userId)
        .map(pendingUploadToProfileVideo),
    [pendingUploads, userId],
  );
  const displayVideos = useMemo(
    () =>
      filterOutLocallyDeletedVideos([
        ...pendingProfileVideos,
        ...sortProfileVideos(videos),
      ]),
    [pendingProfileVideos, videos],
  );
  const sortedOwnVideos = useMemo(() => sortProfileVideos(videos), [videos]);
  const visibleProfile = profile ?? initialProfile;

  useEffect(() => {
    if (!initialProfile) return;
    setProfile((current) => current ?? initialProfile);
  }, [initialProfile]);

  const load = useCallback(async () => {
    // Only show grid placeholders on the first fetch — later focus refreshes keep the grid.
    if (!hasLoadedVideosRef.current) setVideosLoading(true);
    // Paint/refresh the header as soon as profile returns — don't wait on videos.
    const profilePromise = fetchProfile(userId).then((nextProfile) => {
      setProfile(nextProfile);
      if (nextProfile) onProfileChanged(nextProfile);
      return nextProfile;
    });
    try {
      const [, ownVideos, savedVideos] = await Promise.all([
        profilePromise,
        fetchMyVideos(userId),
        fetchSavedVideos(userId),
        refreshSavedVideos(),
      ]);
      pruneLocallyDeletedProfileVideoIds(ownVideos);
      setVideos((current) => {
        const next = filterOutLocallyDeletedVideos(ownVideos).map((video) => {
          if (!pendingPinRanksRef.current.has(video.id)) return video;
          const pendingRank = pendingPinRanksRef.current.get(video.id) ?? null;
          const serverRank = getProfileVideoPinnedRank(video);
          // Drop the pending override only once the server matches — clearing it
          // earlier lets an in-flight focus refresh flash the video back unpinned.
          if (serverRank === pendingRank) {
            pendingPinRanksRef.current.delete(video.id);
            return video;
          }
          return { ...video, pinnedRank: pendingRank, pinned_rank: pendingRank };
        });
        // Compare by id (not index) — pin reorder must not look like a full reload.
        if (current.length !== next.length) return next;
        const nextById = new Map(next.map((video) => [video.id, video]));
        const same = current.every((video) => {
          const other = nextById.get(video.id);
          if (!other) return false;
          const lookingFor =
            Boolean(video.lookingFor ?? ("looking_for" in video ? video.looking_for : false)) ===
            Boolean(other.lookingFor ?? ("looking_for" in other ? other.looking_for : false));
          const pinned =
            getProfileVideoPinnedRank(video) === getProfileVideoPinnedRank(other);
          return lookingFor && pinned;
        });
        return same ? current : next;
      });
      setSaved(savedVideos);
      hasLoadedVideosRef.current = true;
    } finally {
      setVideosLoading(false);
    }
  }, [onProfileChanged, refreshSavedVideos, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch(() => setVideosLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load, refreshSignal]);

  useEffect(() => {
    setSaved((current) => {
      if (current.length === 0) return current;
      const next = current.filter((video) => savedVideoIds.has(video.id));
      return next.length === current.length ? current : next;
    });
  }, [savedVideoIds]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Defer refresh until after the tab switch paints so navigation stays snappy.
      const timer = setTimeout(() => {
        void load().catch(() => {
          if (active) setVideosLoading(false);
        });
      }, 280);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [load]),
  );

  useEffect(() => {
    return subscribePendingUploadPosted((event) => {
      if (event.userId !== userId) return;
      void load();
    });
  }, [load, userId]);

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);
    setActiveDm(profileFeedItem);
  }

  function changeProfileTab(nextTab: "videos" | "saved") {
    if (nextTab === activeTab) return;

    const toValue = nextTab === "saved" ? -viewportWidth : 0;
    tabSlide.stopAnimation();
    setActiveTab(nextTab);
    Animated.timing(tabSlide, {
      toValue,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function removeCreatorFromSaved(creatorUserId: string) {
    setSaved((current) => current.filter((entry) => entry.userId !== creatorUserId));
    setFullscreenIndex((current) => {
      if (current === null) return current;
      const nextSaved = saved.filter((entry) => entry.userId !== creatorUserId);
      return nextSaved.length === 0 ? null : Math.min(current, nextSaved.length - 1);
    });
    setProfileUserId((current) => (current === creatorUserId ? null : current));
    setActiveDm((current) => (current?.userId === creatorUserId ? null : current));
    setActiveChat((current) =>
      current && !("sender_name" in current) && current.userId === creatorUserId ? null : current,
    );
  }

  function hideSavedCreator(item: FeedVideo) {
    removeCreatorFromSaved(item.userId);
    void hideCreator(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not hide creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function blockSavedCreator(item: FeedVideo) {
    removeCreatorFromSaved(item.userId);
    void blockUser(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not block creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function submitSavedReport(item: FeedVideo, reason: ReportReason) {
    if (reportSubmitting) return;

    setReportSubmitting(true);
    void reportVideo({
      reporterId: userId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setReportItem(null);
        setFullscreenIndex(null);
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setReportSubmitting(false));
  }

  // Only block the whole tab when we have nothing to paint for the header yet.
  if (!visibleProfile && videosLoading) {
    return <LoadingScreen label="loading profile..." />;
  }

  const postedVideoCount = Math.max(videos.length, visibleProfile?.video_count ?? 0);
  const proEntitlement = {
    earlyAdopter: visibleProfile?.early_adopter,
    videoCount: postedVideoCount,
    proSubscriptionActive: visibleProfile?.pro_subscription_active,
  };
  const proBadge = getProBadgeKind(proEntitlement);
  const showProProgress = Boolean(visibleProfile) && shouldShowProProgress(proEntitlement);
  const showVideosGridLoading = videosLoading && displayVideos.length === 0;
  const showSavedGridLoading = videosLoading && saved.length === 0;

  const settingsButton = (
    <Pressable
      style={styles.headerIconButton}
      onPressIn={() => {
        // Open on press-in so the drawer mounts immediately; waiting for press-out
        // made the slide-in feel flaky when the finger lingered or scrolled slightly.
        if (!settingsOpen) setSettingsOpen(true);
      }}
      accessibilityLabel="settings"
      accessibilityRole="button"
    >
      <MenuIcon color={getActivityIndicatorColor()} />
    </Pressable>
  );

  return (
    <View style={styles.safeWithNav}>
      <ProfileTopScrollFade
        ref={profileScrollRef}
        topInset={insets.top}
        contentContainerStyle={getTabScreenContentStyle(insets.top)}
        scrollEnabled={!pinPreviewActive}
        onCollapseChange={setProfileHeaderCollapsed}
        collapsedHeader={
          visibleProfile
            ? {
                title: visibleProfile.display_name ?? "your profile",
                right: settingsButton,
              }
            : undefined
        }
      >
        <TabLogoHeader
          center={
            showProProgress && !profileHeaderCollapsed ? (
              <ProProgressBar posted={postedVideoCount} />
            ) : null
          }
          right={profileHeaderCollapsed ? <View style={styles.headerSpacer} /> : settingsButton}
        />
        {visibleProfile ? (
          <>
            <View style={styles.profileCentered}>
              <Avatar uri={visibleProfile.avatar_url} size={78} />
              <ProfileNameAnchor>
                <View style={styles.centerRow}>
                  <Text style={styles.h2}>{visibleProfile.display_name ?? "your profile"}</Text>
                  {proBadge ? <ProBadge kind={proBadge} /> : null}
                </View>
              </ProfileNameAnchor>
              <Text style={styles.subtitle}>{visibleProfile.creator_types?.join(", ") || "creator"}</Text>
              {formatProfileLocation(
                getProfileLocationParts(visibleProfile).country,
                getProfileLocationParts(visibleProfile).city,
              ) && (
                <Text style={styles.subtitle}>
                  {formatProfileLocation(
                    getProfileLocationParts(visibleProfile).country,
                    getProfileLocationParts(visibleProfile).city,
                  )}
                </Text>
              )}
              <Text style={styles.profileBio}>{visibleProfile.bio || "no bio yet."}</Text>
            </View>
            <Pressable style={styles.profileActionPill} onPress={() => setEditing(true)}>
              <Text style={styles.profileActionPillText}>edit profile</Text>
            </Pressable>
          </>
        ) : (
          <EmptyCard text="no profile found." />
        )}
        <View style={styles.profileVideoDivider} />
        <ProfileLibraryTabs
          active={activeTab}
          onChange={(value) => changeProfileTab(value)}
        />
        <View style={styles.profileTabSliderViewport}>
          <Animated.View
            style={[
              styles.profileTabSliderTrack,
              {
                width: viewportWidth * 2,
                transform: [{ translateX: tabSlide }],
              },
            ]}
          >
            <View style={styles.profileTabPane}>
              {showVideosGridLoading ? (
                <ProfileGridLoadingPlaceholder />
              ) : (
                <VideoGrid
                  videos={displayVideos}
                  showPendingUploadState
                  prewarmVisibleVideos={activeTab === "videos"}
                  allowPinning
                  onRetryPendingUpload={retryPendingVideoUpload}
                  onPinPreviewChange={setPinPreviewActive}
                  ensurePinItemVisible={(rect) =>
                    profileScrollRef.current?.ensureWindowRectVisible(rect) ?? Promise.resolve()
                  }
                  onTogglePin={(video) => {
                    void toggleOwnProfileVideoPin(userId, video, setVideos, pendingPinRanksRef);
                  }}
                  onVideoPress={(video, index) => {
                    if (isPendingProfileVideoId(video.id)) return;
                    const realIndex = sortedOwnVideos.findIndex((entry) => entry.id === video.id);
                    if (realIndex < 0) return;
                    openProfileVideoFullscreen(video, () => setOwnFullscreenIndex(realIndex));
                  }}
                />
              )}
            </View>
            <View style={styles.profileTabPane}>
              {showSavedGridLoading ? (
                <ProfileGridLoadingPlaceholder />
              ) : (
                <VideoGrid
                  videos={saved}
                  privateCopy
                  prewarmVisibleVideos={activeTab === "saved"}
                  onVideoPress={(video, index) => {
                    openProfileVideoFullscreen(video, () => setFullscreenIndex(index));
                  }}
                />
              )}
            </View>
          </Animated.View>
        </View>
      </ProfileTopScrollFade>
      {profile && (
        <ProfileVideoFullscreenModal
          visible={ownFullscreenIndex !== null}
          videos={sortedOwnVideos}
          initialIndex={ownFullscreenIndex ?? 0}
          owner={{
            creatorName: profile.display_name ?? "you",
            role: profile.creator_types?.[0] ?? "creator",
            location: formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city) ?? "unknown",
            avatarUrl: profile.avatar_url,
            earlyAdopter: Boolean(profile.early_adopter),
            proBadge,
          }}
          saved={false}
          onClose={() => setOwnFullscreenIndex(null)}
          onSave={() => undefined}
          onMessage={() => undefined}
          ownVideoActions={{
            onDelete: (video) => {
              Alert.alert("delete video?", "this removes it from your profile.", [
                { text: "cancel", style: "cancel" },
                {
                  text: "delete",
                  style: "destructive",
                  onPress: () => {
                    void deleteOwnProfileVideo(video.id, setVideos, setOwnFullscreenIndex);
                  },
                },
              ]);
            },
          }}
        />
      )}
      <ProfileVideoFullscreenModal
        visible={fullscreenIndex !== null}
        videos={saved}
        initialIndex={fullscreenIndex ?? 0}
        owner={{
          creatorName: "saved",
          role: "creator",
          location: "unknown",
          avatarUrl: null,
          earlyAdopter: false,
          proBadge: null,
        }}
        saved
        getOwnerForVideo={getProfileVideoOwner}
        getSavedForVideo={(video) => savedVideoIds.has(video.id)}
        onClose={() => setFullscreenIndex(null)}
        onSave={(video, nextSaved) => {
          void toggleSavedProfileVideo(video, nextSaved, setSaved, setVideoSaved);
        }}
        onMessage={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (!feedItem) return;
          setFullscreenIndex(null);
          void openJamFromProfile(feedItem);
        }}
        onNotInterested={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (feedItem) hideSavedCreator(feedItem);
        }}
        onBlock={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (feedItem) blockSavedCreator(feedItem);
        }}
        onReport={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (feedItem) setReportItem(feedItem);
        }}
        onSendMessage={async (video, body) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (!feedItem) return;
          await sendJamRequest(feedItem.userId, body, video.id);
          setSaved((current) =>
            current.map((entry) =>
              entry.id === video.id
                ? {
                    ...entry,
                    jammedByMe: true,
                    mutual: Boolean(feedItem.jammedMe),
                  }
                : entry,
            ),
          );
          onInboxChanged();
        }}
      />
      <ChatModal
        active={activeChat}
        currentUserId={userId}
        savedVideoController={savedVideoController}
        onClose={() => setActiveChat(null)}
        onOpenProfile={(nextUserId) => {
          setProfileUserId(nextUserId);
        }}
        onInboxChanged={onInboxChanged}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });
            if (unlocksFromReply || !conversation.unlocked) onInboxChanged();
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          setActiveDm(null);
          setProfileUserId(item.userId);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          await sendJamRequest(activeDm.userId, body, activeDm.id);
          setActiveDm(null);
          onInboxChanged();
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        userId={profileUserId}
        savedVideoController={savedVideoController}
        onClose={() => setProfileUserId(null)}
        onMessage={(profileFeedItem) => {
          void openJamFromProfile(profileFeedItem);
        }}
        onUnjammed={(removedUserId) => {
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
          );
          setActiveDm((current) => (current?.userId === removedUserId ? null : current));
          setProfileUserId(null);
          onInboxChanged();
        }}
        onBlocked={(blockedUserId) => {
          removeCreatorFromSaved(blockedUserId);
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === blockedUserId ? null : current,
          );
          setActiveDm((current) => (current?.userId === blockedUserId ? null : current));
          setProfileUserId(null);
          onInboxChanged();
        }}
      />
      <EditProfileModal
        visible={editing}
        profile={visibleProfile}
        onClose={() => setEditing(false)}
        onSaved={(nextProfile) => {
          setProfile(nextProfile);
          onProfileChanged(nextProfile);
          setEditing(false);
        }}
      />
      <SettingsDrawerModal
        visible={settingsOpen}
        currentUserId={userId}
        themeMode={themeMode}
        onThemeModeChange={onThemeModeChange}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onAccount={() => {
          setAccountSettingsOpen(true);
        }}
        onProfileUpdated={(nextProfile) => {
          setProfile(nextProfile);
          onProfileChanged(nextProfile);
        }}
        onLoggedOut={onLoggedOut}
      />
      <AccountSettingsModal
        visible={accountSettingsOpen}
        themeMode={themeMode}
        onClose={() => setAccountSettingsOpen(false)}
        onDeleted={() => {
          setAccountSettingsOpen(false);
          void onLoggedOut();
        }}
      />
      <FeedReportModal
        item={reportItem}
        submitting={reportSubmitting}
        onClose={() => setReportItem(null)}
        onSubmit={(reason) => {
          if (reportItem) submitSavedReport(reportItem, reason);
        }}
      />
    </View>
  );
}

function EditProfileModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<NativeAvatarAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const initializedProfileIdRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  function ensureFieldVisible() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  useEffect(() => {
    if (!visible) {
      initializedProfileIdRef.current = null;
      return;
    }
    if (!profile || initializedProfileIdRef.current === profile.id) return;
    initializedProfileIdRef.current = profile.id;
    const frame = requestAnimationFrame(() => {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCreatorTypes(getUniqueStrings(profile.creator_types ?? []).slice(0, MAX_ACCOUNT_CREATOR_TYPES));
      const nextLocation = getProfileLocationParts(profile);
      setCountry(nextLocation.country);
      setCity(nextLocation.city);
      setLocationQuery("");
      setAvatarUrl(profile.avatar_url ?? null);
      setAvatarAsset(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [profile, visible]);

  const roleMatches = useSuggestions(creatorRoles, creatorQuery, creatorTypes);

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset?.uri) {
        setAvatarUrl(asset.uri);
        setAvatarAsset({
          uri: asset.uri,
          fileName: asset.fileName ?? asset.uri.split("/").pop() ?? "avatar.jpg",
          mimeType: asset.mimeType ?? "image/jpeg",
        });
      }
    }
  }

  function deleteAvatar() {
    setAvatarUrl(null);
    setAvatarAsset(null);
  }

  function openAvatarOptions() {
    Alert.alert("profile photo", "", [
      { text: "change", onPress: () => void chooseAvatar() },
      { text: "delete", style: "destructive", onPress: deleteAvatar },
      { text: "cancel", style: "cancel" },
    ]);
  }

  function addCreatorType(role: string) {
    setCreatorTypes((current) => {
      const uniqueCurrent = getUniqueStrings(current);
      if (uniqueCurrent.includes(role)) return uniqueCurrent;
      if (uniqueCurrent.length >= MAX_ACCOUNT_CREATOR_TYPES) {
        Alert.alert("maximum creator types", `choose up to ${MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.`);
        return uniqueCurrent;
      }
      return [...uniqueCurrent, role];
    });
    setCreatorQuery("");
  }

  function removeCreatorType(roleToRemove: string) {
    setCreatorTypes((current) =>
      getUniqueStrings(current).filter((role) => role !== roleToRemove),
    );
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const nextCreatorTypes = getUniqueStrings(creatorTypes).slice(0, MAX_ACCOUNT_CREATOR_TYPES);
      const nextAvatarUrl = avatarAsset
        ? await uploadNativeProfileAvatar(profile.id, avatarAsset)
        : avatarUrl;
      const nextProfile = await saveProfile(profile.id, {
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_types: nextCreatorTypes,
        country: country.trim() || null,
        city: city.trim() || null,
        location: formatProfileLocation(country, city),
        avatar_url: nextAvatarUrl,
      });
      setAvatarUrl(nextAvatarUrl);
      setAvatarAsset(null);
      onSaved(nextProfile);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible} onBack={onClose} style={styles.flex} enterFromRight>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.flex}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[
                styles.screenContent,
                { paddingBottom: Math.max(insets.bottom, 16) + keyboardInset + 24 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>edit profile</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>cancel</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.editAvatarButton}
              onPress={openAvatarOptions}
              accessibilityLabel="profile photo options"
              accessibilityRole="button"
            >
              <Avatar uri={avatarUrl} size={92} />
              <Text style={styles.helper}>tap to change or delete</Text>
            </Pressable>
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="display name" placeholderTextColor="#71717a" style={styles.input} />
            <SectionLabel label={`creator types (${creatorTypes.length}/${MAX_ACCOUNT_CREATOR_TYPES})`} />
            <Text style={styles.helper}>choose up to {MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.</Text>
            <ChipRow items={creatorTypes} onRemove={removeCreatorType} />
            <TextInput
              value={creatorQuery}
              onChangeText={setCreatorQuery}
              onFocus={ensureFieldVisible}
              placeholder="search creator type"
              placeholderTextColor="#71717a"
              style={styles.input}
            />
            <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
              addCreatorType(role);
            }} />
            <TextInput
              value={bio}
              onChangeText={setBio}
              onFocus={ensureFieldVisible}
              placeholder="bio"
              placeholderTextColor="#71717a"
              style={[styles.input, styles.textArea]}
              multiline
              maxLength={150}
            />
            <SectionLabel label="location" />
            <ProfileLocationPicker
              country={country}
              city={city}
              query={locationQuery}
              onQueryChange={setLocationQuery}
              onSearchFocus={ensureFieldVisible}
              onChange={(nextCountry, nextCity) => {
                setCountry(nextCountry);
                setCity(nextCity);
              }}
            />
            <PrimaryButton label={saving ? "saving..." : "save profile"} disabled={saving} onPress={save} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SwipeBackSurface>
    </Modal>
  );
}

function SettingsDrawerModal({
  visible,
  currentUserId,
  themeMode,
  onThemeModeChange,
  profile,
  onClose,
  onAccount,
  onProfileUpdated,
  onLoggedOut,
}: {
  visible: boolean;
  currentUserId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  profile: Profile | null;
  onClose: () => void;
  onAccount: () => void;
  onProfileUpdated: (profile: Profile) => void;
  onLoggedOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const drawerWidth = viewportWidth * 0.8;
  const [mounted, setMounted] = useState(visible);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [termsAndPoliciesOpen, setTermsAndPoliciesOpen] = useState(false);
  const [savingNearMeRadius, setSavingNearMeRadius] = useState(false);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [savingShareLiveLocation, setSavingShareLiveLocation] = useState(false);
  const selectedNearMeRadius = normalizeNearMeRadius(profile?.near_me_radius_miles);
  const [translateX] = useState(() => new Animated.Value(drawerWidth));
  const closingRef = useRef(false);
  /** Bumps on each open/close so late animation callbacks can't stomp a new open. */
  const animGenerationRef = useRef(0);
  const openAnimFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const backdropOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, drawerWidth],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [drawerWidth, translateX],
  );
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX } }], {
        useNativeDriver: true,
      }),
    [translateX],
  );

  useLayoutEffect(() => {
    if (!visible) return;

    const generation = ++animGenerationRef.current;
    closingRef.current = false;
    // Mount immediately so the Modal is on-screen for the slide-in.
    setMounted(true);
    translateX.stopAnimation();
    translateX.setValue(drawerWidth);

    if (openAnimFrameRef.current != null) {
      cancelAnimationFrame(openAnimFrameRef.current);
      openAnimFrameRef.current = null;
    }

    let cancelled = false;
    // Two frames: commit mount, then let the Modal present before animating.
    openAnimFrameRef.current = requestAnimationFrame(() => {
      openAnimFrameRef.current = requestAnimationFrame(() => {
        openAnimFrameRef.current = null;
        if (cancelled || generation !== animGenerationRef.current || closingRef.current) return;
        Animated.timing(translateX, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });

    return () => {
      cancelled = true;
      if (openAnimFrameRef.current != null) {
        cancelAnimationFrame(openAnimFrameRef.current);
        openAnimFrameRef.current = null;
      }
    };
  }, [drawerWidth, translateX, visible]);

  useEffect(() => {
    if (!visible || !profile) return;

    let active = true;
    void isLiveLocationSharingEnabled(profile.id).then((enabled) => {
      if (!active) return;
      setShareLiveLocation(enabled);
    });

    return () => {
      active = false;
    };
  }, [profile?.id, visible]);

  function animateNearMeRadiusReveal(show: boolean) {
    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setShareLiveLocation(show);
  }

  function animateClosed(afterClose?: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    const generation = ++animGenerationRef.current;
    if (openAnimFrameRef.current != null) {
      cancelAnimationFrame(openAnimFrameRef.current);
      openAnimFrameRef.current = null;
    }
    translateX.stopAnimation();
    Animated.timing(translateX, {
      toValue: drawerWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // A newer open superseded this close — leave the drawer alone.
      if (generation !== animGenerationRef.current) return;
      closingRef.current = false;
      if (!finished) return;
      setMounted(false);
      onClose();
      afterClose?.();
    });
  }

  function closeWithAnimation() {
    animateClosed();
  }

  function openAccount() {
    animateClosed(onAccount);
  }

  async function updateNearMeRadius(nextRadius: NearMeRadiusMiles) {
    if (!profile || savingNearMeRadius || nextRadius === selectedNearMeRadius) return;

    setSavingNearMeRadius(true);
    try {
      const updatedProfile = await saveProfile(profile.id, { near_me_radius_miles: nextRadius });
      onProfileUpdated(updatedProfile);
    } catch (err) {
      Alert.alert(
        "could not save radius",
        err instanceof Error ? err.message : "try again in a moment.",
      );
    } finally {
      setSavingNearMeRadius(false);
    }
  }

  async function toggleShareLiveLocation(enabled: boolean) {
    if (!profile || savingShareLiveLocation) return;

    // Reveal/hide immediately so the pills track the switch, then persist.
    animateNearMeRadiusReveal(enabled);
    setSavingShareLiveLocation(true);
    try {
      if (enabled) {
        const result = await enableLiveLocationSharing(profile.id);
        if ("error" in result) {
          animateNearMeRadiusReveal(false);
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          return;
        }

        onProfileUpdated(result.profile);
        return;
      }

      const updatedProfile = await disableLiveLocationSharing(profile.id);
      onProfileUpdated(updatedProfile);
    } catch (err) {
      Alert.alert(
        "could not update live location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
      const current = profile ? await isLiveLocationSharingEnabled(profile.id) : false;
      animateNearMeRadiusReveal(current);
    } finally {
      setSavingShareLiveLocation(false);
    }
  }

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (
      state !== State.END &&
      state !== State.CANCELLED &&
      state !== State.FAILED
    ) {
      return;
    }

    const { translationX, translationY, velocityX } = event.nativeEvent;
    const shouldClose =
      translationX > drawerWidth * 0.24 ||
      (translationX > 36 && Math.abs(translationY) < 90 && velocityX > 420);

    if (shouldClose) {
      closeWithAnimation();
      return;
    }

    Animated.spring(translateX, {
      toValue: 0,
      damping: 24,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }

  if (!mounted) return null;

  return (
    <Modal animationType="none" transparent visible={mounted} onRequestClose={closeWithAnimation}>
      <View style={styles.settingsOverlay}>
        <Animated.View style={[styles.settingsBackdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation} />
        </Animated.View>
        <PanGestureHandler
          activeOffsetX={24}
          failOffsetY={[-26, 26]}
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleGestureStateChange}
        >
          <Animated.View
            style={[
              styles.settingsDrawer,
              {
                width: drawerWidth,
                transform: [
                  {
                    translateX: translateX.interpolate({
                      inputRange: [0, drawerWidth],
                      outputRange: [0, drawerWidth],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.settingsPanel,
                {
                  paddingTop: insets.top + 20,
                  paddingBottom: insets.bottom + 20,
                },
              ]}
            >
              <ScrollView
                style={styles.settingsPanelScroll}
                contentContainerStyle={styles.settingsPanelScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.cardTitle}>{profile?.display_name ?? "you"}</Text>
                <Text style={styles.helper}>{profile?.creator_types?.join(", ") || "creator"}</Text>
                <View style={styles.settingsToggleGroup}>
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>light mode</Text>
                    <Switch
                      value={themeMode === "light"}
                      onValueChange={(enabled) => onThemeModeChange(enabled ? "light" : "dark")}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <View style={styles.settingsLocationGroup}>
                    <View style={styles.settingsRow}>
                      <Text style={[styles.settingsText, styles.settingsRowLabel]}>share live location</Text>
                      <Switch
                        value={shareLiveLocation}
                        onValueChange={(enabled) => void toggleShareLiveLocation(enabled)}
                        disabled={savingShareLiveLocation}
                        style={styles.settingsSwitch}
                      />
                    </View>
                    <Text style={styles.settingsLiveLocationCopy}>
                      near me uses this to find creators around you. turning on near me also turns this on.
                    </Text>
                    {shareLiveLocation ? (
                      <View style={styles.settingsNearMeSection}>
                        <Text style={styles.settingsText}>near me radius</Text>
                        <View style={styles.nearMeRadiusRow}>
                          {NEAR_ME_RADIUS_OPTIONS.map((miles) => {
                            const isSelected = selectedNearMeRadius === miles;
                            return (
                              <Pressable
                                key={miles}
                                style={[
                                  styles.nearMeRadiusOption,
                                  isSelected && styles.nearMeRadiusOptionActive,
                                ]}
                                disabled={savingNearMeRadius}
                                onPress={() => void updateNearMeRadius(miles)}
                              >
                                <Text
                                  style={[
                                    styles.nearMeRadiusOptionText,
                                    isSelected && styles.nearMeRadiusOptionTextActive,
                                  ]}
                                >
                                  {miles} mi
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
                <SettingsButton label="account" onPress={openAccount} />
                <SettingsButton label="notifications" onPress={() => setNotificationsOpen(true)} />
                <SettingsButton label="blocked accounts" onPress={() => setBlockedUsersOpen(true)} />
                <SettingsButton label="help centre" />
                <SettingsButton label="terms and policies" onPress={() => setTermsAndPoliciesOpen(true)} />
              </ScrollView>
              <Pressable
                style={styles.logoutButton}
                onPress={() => setLogoutConfirmOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="log out"
              >
                <Text style={styles.logoutText}>log out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </PanGestureHandler>
        <ConfirmModal
          visible={logoutConfirmOpen}
          title="log out?"
          confirmLabel="log out"
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={() => {
            setLogoutConfirmOpen(false);
            void (async () => {
              try {
                await Promise.resolve(onLoggedOut());
              } catch (err) {
                Alert.alert(
                  "could not log out",
                  err instanceof Error ? err.message : "try again",
                );
              }
            })();
          }}
        />
        <BlockedUsersModal
          visible={blockedUsersOpen}
          currentUserId={currentUserId}
          onClose={() => setBlockedUsersOpen(false)}
        />
        <NotificationsSettingsModal
          visible={notificationsOpen}
          currentUserId={currentUserId}
          onClose={() => setNotificationsOpen(false)}
        />
        <TermsAndPoliciesModal
          visible={termsAndPoliciesOpen}
          onClose={() => setTermsAndPoliciesOpen(false)}
        />
      </View>
    </Modal>
  );
}

function NotificationsSettingsModal({
  visible,
  currentUserId,
  onClose,
}: {
  visible: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleQuery, setRoleQuery] = useState("");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [draftGenres, setDraftGenres] = useState<string[]>([]);

  const roleMatches = useMemo(() => {
    const query = roleQuery.trim().toLowerCase();
    return creatorRoles.filter((role) => !query || role.toLowerCase().includes(query));
  }, [roleQuery]);

  function getSavedGenresForRole(role: string) {
    return (
      preferences?.categoryAlerts
        .filter((alert) => alert.role === role && alert.genre)
        .map((alert) => alert.genre) ?? []
    );
  }

  function hasRoleOnlyAlert(role: string) {
    return preferences?.categoryAlerts.some((alert) => alert.role === role && !alert.genre) ?? false;
  }

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setLoading(true);
    void loadNotificationPreferences(currentUserId)
      .then((nextPreferences) => {
        if (active) setPreferences(nextPreferences);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, visible]);

  useEffect(() => {
    if (!visible) {
      setRoleQuery("");
      setActiveRole(null);
      setDraftGenres([]);
    }
  }, [visible]);

  async function updatePreferences(nextPreferences: NotificationPreferences) {
    setPreferences(nextPreferences);
    await saveNotificationPreferences(currentUserId, nextPreferences);
  }

  function togglePreference(
    key: "inAppNotifications" | "jamRequests" | "jamAccepts" | "messages",
    value: boolean,
  ) {
    if (!preferences) return;
    void updatePreferences({ ...preferences, [key]: value });
  }

  function toggleRole(role: string) {
    if (activeRole === role) {
      setActiveRole(null);
      setDraftGenres([]);
      return;
    }

    setActiveRole(role);
    setDraftGenres(getSavedGenresForRole(role));
  }

  function toggleGenre(genre: string) {
    if (!activeRole) return;
    setDraftGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  }

  function confirmCategoryAlerts() {
    if (!preferences || !activeRole) return;

    const nextAlerts = preferences.categoryAlerts.filter((alert) => alert.role !== activeRole);
    if (draftGenres.length === 0) {
      nextAlerts.push({ role: activeRole, genre: "" });
    } else {
      for (const genre of draftGenres) {
        nextAlerts.push({ role: activeRole, genre });
      }
    }

    void updatePreferences({
      ...preferences,
      categoryAlerts: nextAlerts,
    });
    setActiveRole(null);
    setDraftGenres([]);
    setRoleQuery("");
  }

  function removeCategoryAlert(subscription: CategoryAlertSubscription) {
    if (!preferences) return;
    const key = categoryAlertKey(subscription);
    void updatePreferences({
      ...preferences,
      categoryAlerts: preferences.categoryAlerts.filter((item) => categoryAlertKey(item) !== key),
    });
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible ? "notifications-settings" : null} onBack={onClose} style={styles.flex} enterFromRight>
        <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              {
                paddingTop: Math.max(insets.top + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING),
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>notifications</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>done</Text>
              </Pressable>
            </View>

            {loading || !preferences ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
            ) : (
              <>
                <View style={styles.notificationSettingsSection}>
                  <SectionLabel label="in app" />
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>in-app notifications</Text>
                    <Switch
                      value={preferences.inAppNotifications}
                      onValueChange={(value) => togglePreference("inAppNotifications", value)}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <Text style={styles.notificationSettingsCopy}>
                    show banners when you get jam requests, accepts, and messages.
                  </Text>
                </View>

                <View
                  style={[
                    styles.notificationSettingsSection,
                    !preferences.inAppNotifications && styles.subdued,
                  ]}
                  pointerEvents={preferences.inAppNotifications ? "auto" : "none"}
                >
                  <SectionLabel label="activity" />
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>jam requests</Text>
                    <Switch
                      value={preferences.jamRequests}
                      onValueChange={(value) => togglePreference("jamRequests", value)}
                      disabled={!preferences.inAppNotifications}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>jam accepts</Text>
                    <Switch
                      value={preferences.jamAccepts}
                      onValueChange={(value) => togglePreference("jamAccepts", value)}
                      disabled={!preferences.inAppNotifications}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>messages</Text>
                    <Switch
                      value={preferences.messages}
                      onValueChange={(value) => togglePreference("messages", value)}
                      disabled={!preferences.inAppNotifications}
                      style={styles.settingsSwitch}
                    />
                  </View>
                </View>

                <View style={styles.notificationSettingsSection}>
                  <SectionLabel label="new in your area" />
                  <Text style={styles.notificationSettingsCopy}>
                    get notified when new videos are posted in a category you care about.
                  </Text>

                  {preferences.categoryAlerts.length > 0 ? (
                    <View style={styles.chips}>
                      {preferences.categoryAlerts.map((subscription) => (
                        <Pressable
                          key={categoryAlertKey(subscription)}
                          style={styles.chip}
                          onPress={() => removeCategoryAlert(subscription)}
                        >
                          <Text style={styles.chipText}>{formatCategoryAlertLabel(subscription)} ×</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.notificationCategoryPicker}>
                    <TextInput
                      value={roleQuery}
                      onChangeText={setRoleQuery}
                      placeholder="search roles..."
                      placeholderTextColor="#71717a"
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <View style={styles.notificationCategoryPickerHeader}>
                      <Text style={styles.helper}>
                        {!activeRole
                          ? "no category selection"
                          : draftGenres.length === 0
                            ? "any genre"
                            : `${draftGenres.length} genre ${draftGenres.length === 1 ? "selection" : "selections"}`}
                      </Text>
                      <Pressable
                        style={[
                          styles.notificationConfirmButton,
                          !activeRole && styles.disabled,
                        ]}
                        disabled={!activeRole}
                        onPress={confirmCategoryAlerts}
                        accessibilityLabel="confirm categories"
                      >
                        <Text style={styles.notificationConfirmText}>✓</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={[
                        styles.locationFilterList,
                        { maxHeight: LOCATION_PICKER_VISIBLE_HEIGHT },
                      ]}
                    >
                      {roleMatches.map((role) => {
                        const isActive = activeRole === role;
                        const savedGenres = getSavedGenresForRole(role);
                        const isRoleOnlySaved = hasRoleOnlyAlert(role);
                        const isRoleOnlySelected = isRoleOnlySaved && savedGenres.length === 0;
                        const isPartiallySelected = savedGenres.length > 0;

                        return (
                          <View key={role} style={styles.locationCountryGroup}>
                            <Pressable style={styles.locationOptionRow} onPress={() => toggleRole(role)}>
                              <View
                                style={[
                                  styles.locationCircle,
                                  (isActive || isRoleOnlySelected) && styles.locationCircleSelected,
                                  !isActive && isPartiallySelected && styles.locationCirclePartial,
                                ]}
                              >
                                {!isActive && isPartiallySelected ? (
                                  <View style={styles.locationCirclePartialFill} />
                                ) : null}
                              </View>
                              <Text style={styles.locationCountryText}>{role}</Text>
                            </Pressable>
                            {isActive ? (
                              <View style={styles.locationCityList}>
                                {musicGenres.map((genre) => {
                                  const isGenreSelected = draftGenres.includes(genre);
                                  return (
                                    <Pressable
                                      key={genre}
                                      style={styles.locationCityRow}
                                      onPress={() => toggleGenre(genre)}
                                    >
                                      <View
                                        style={[
                                          styles.locationCityCircle,
                                          isGenreSelected && styles.locationCircleSelected,
                                        ]}
                                      />
                                      <Text style={styles.locationCityText}>{genre}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </SwipeBackSurface>
    </Modal>
  );
}

function TermsAndPoliciesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");

  useEffect(() => {
    if (visible) setActiveTab("terms");
  }, [visible]);

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible ? "terms-and-policies" : null} onBack={onClose} style={styles.flex} enterFromRight>
        <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              {
                paddingTop: Math.max(insets.top + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING),
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>terms and policies</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>done</Text>
              </Pressable>
            </View>

            <View style={styles.legalTabRow}>
              <Pressable
                style={[styles.legalTab, activeTab === "terms" && styles.legalTabActive]}
                onPress={() => setActiveTab("terms")}
              >
                <Text style={[styles.legalTabText, activeTab === "terms" && styles.legalTabTextActive]}>
                  terms of service
                </Text>
              </Pressable>
              <Pressable
                style={[styles.legalTab, activeTab === "privacy" && styles.legalTabActive]}
                onPress={() => setActiveTab("privacy")}
              >
                <Text style={[styles.legalTabText, activeTab === "privacy" && styles.legalTabTextActive]}>
                  privacy policy
                </Text>
              </Pressable>
            </View>

            <Text style={styles.legalCopy}>
              {activeTab === "terms"
                ? "Placeholder terms of service. This will explain how you can use Jam, what you can post, and the rules for using the platform."
                : "Placeholder privacy policy. This will explain what data Jam collects, how it is used, and your rights as a user."}
            </Text>
          </ScrollView>
        </View>
      </SwipeBackSurface>
    </Modal>
  );
}

function BlockedUsersModal({
  visible,
  currentUserId,
  onClose,
}: {
  visible: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const nextBlockedUsers = await fetchBlockedUsers(currentUserId);
      setBlockedUsers(nextBlockedUsers);
    } catch (err) {
      Alert.alert("could not load blocked users", err instanceof Error ? err.message : "try again");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      void loadBlockedUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBlockedUsers, visible]);

  async function unblock(blockedUser: BlockedUser) {
    setUnblockingUserId(blockedUser.userId);
    const previousBlockedUsers = blockedUsers;
    setBlockedUsers((current) => current.filter((user) => user.userId !== blockedUser.userId));
    try {
      await unblockUser(currentUserId, blockedUser.userId);
    } catch (err) {
      setBlockedUsers(previousBlockedUsers);
      Alert.alert("could not unblock user", err instanceof Error ? err.message : "try again");
    } finally {
      setUnblockingUserId(null);
    }
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible ? "blocked-users" : null} onBack={onClose} style={styles.flex} enterFromRight>
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: Math.max(insets.top + 18, 28) },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>blocked accounts</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>done</Text>
              </Pressable>
            </View>
            <Text style={styles.copy}>
              People you unblock may be able to see your profile and videos again.
            </Text>
            {loading ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
            ) : blockedUsers.length === 0 ? (
              <EmptyCard text="you have not blocked anyone." />
            ) : (
              <View style={styles.blockedUsersList}>
                {blockedUsers.map((blockedUser) => (
                  <View key={blockedUser.userId} style={styles.blockedUserRow}>
                    <Avatar
                      uri={blockedUser.avatarUrl}
                      size={44}
                    />
                    <View style={styles.blockedUserInfo}>
                      <Text style={styles.settingsText}>{blockedUser.creatorName}</Text>
                      <Text style={styles.helper}>
                        {blockedUser.role} - {blockedUser.location}
                      </Text>
                    </View>
                    <Pressable
                      disabled={unblockingUserId === blockedUser.userId}
                      style={[
                        styles.unblockButton,
                        unblockingUserId === blockedUser.userId && styles.disabled,
                      ]}
                      onPress={() => void unblock(blockedUser)}
                    >
                      <Text style={styles.unblockButtonText}>
                        {unblockingUserId === blockedUser.userId ? "..." : "unblock"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </SwipeBackSurface>
    </Modal>
  );
}

function ChatModal({
  active,
  currentUserId,
  savedVideoController,
  onClose,
  onOpenProfile,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onLoadOlderMessages,
  onInboxChanged,
  profileOverlay,
  presentation = "modal",
}: {
  active: Conversation | InboxMessage | null;
  currentUserId: string;
  savedVideoController: SavedVideoController;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSend: (conversation: Conversation, body: string) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onLoadOlderMessages?: (conversation: Conversation) => Promise<void>;
  onInboxChanged?: () => void;
  profileOverlay?: React.ReactNode;
  presentation?: "modal" | "overlay";
}) {
  const [draft, setDraft] = useState("");
  const [contextMessageId, setContextMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [attachedViewer, setAttachedViewer] = useState<{
    isOwn: boolean;
    videos: Array<ProfileVideo | FeedVideo>;
    initialIndex: number;
    owner: {
      creatorName: string;
      role: string;
      location: string;
      avatarUrl: string | null;
      earlyAdopter: boolean;
      proBadge: ProBadgeKind | null;
    };
    jammedByMe: boolean;
    jammedMe: boolean;
  } | null>(null);
  const [attachedReportItem, setAttachedReportItem] = useState<FeedVideo | null>(null);
  const [attachedReportSubmitting, setAttachedReportSubmitting] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const messagesScrollRef = useRef<ScrollView>(null);
  const stickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const openingAttachedVideoRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const conversationKey = active
    ? "sender_name" in active
      ? `system:${active.id}`
      : `user:${active.userId}`
    : null;
  const activeMessageIds = useMemo(() => {
    if (!active || "sender_name" in active) return new Set<string>();
    return new Set(
      active.messages.flatMap((message) =>
        [message.id, message.serverId].filter((value): value is string => Boolean(value)),
      ),
    );
  }, [active]);
  const pendingSessionMessages = useMemo(
    () =>
      sessionMessages.filter(
        (message) =>
          !activeMessageIds.has(message.id) &&
          !(message.serverId && activeMessageIds.has(message.serverId)),
      ),
    [activeMessageIds, sessionMessages],
  );
  const messageCount = active
    ? "sender_name" in active
      ? 1
      : active.messages.length + pendingSessionMessages.length
    : 0;

  const scrollMessagesToEnd = useCallback((animated = false) => {
    messagesScrollRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    if (!active) {
      setKeyboardHeight(0);
      return;
    }

    const applyKeyboardHeight = (nextHeight: number, duration: number) => {
      if (duration > 0) {
        LayoutAnimation.configureNext({
          duration,
          update: {
            duration,
            // iOS: system keyboard curve so the composer tracks the keyboard exactly.
            type:
              Platform.OS === "ios"
                ? LayoutAnimation.Types.keyboard
                : LayoutAnimation.Types.easeInEaseOut,
          },
        });
      }
      setKeyboardHeight(nextHeight);
    };

    if (Platform.OS === "ios") {
      const showSubscription = Keyboard.addListener("keyboardWillShow", (event) => {
        stickToBottomRef.current = true;
        applyKeyboardHeight(event.endCoordinates.height, event.duration || 250);
        const mid = Math.max(16, Math.floor((event.duration || 250) * 0.55));
        setTimeout(() => scrollMessagesToEnd(false), mid);
      });
      const hideSubscription = Keyboard.addListener("keyboardWillHide", (event) => {
        applyKeyboardHeight(0, event.duration || 250);
      });
      const frameSubscription = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
        // Interactive dismiss / scrub updates arrive with duration 0.
        if ((event.duration ?? 0) > 0) return;
        const screenHeight = Dimensions.get("screen").height;
        applyKeyboardHeight(Math.max(0, screenHeight - event.endCoordinates.screenY), 0);
      });

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
        frameSubscription.remove();
      };
    }

    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      stickToBottomRef.current = true;
      applyKeyboardHeight(event.endCoordinates.height, 0);
      requestAnimationFrame(() => scrollMessagesToEnd(false));
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      applyKeyboardHeight(0, 0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [active, scrollMessagesToEnd]);

  useEffect(() => {
    if (!conversationKey) return;
    stickToBottomRef.current = true;
    loadingOlderRef.current = false;
    setAttachedViewer(null);
    setAttachedReportItem(null);
    setSessionMessages([]);

    const frame = requestAnimationFrame(() => scrollMessagesToEnd(false));
    const timers = [32, 120, 320].map((delay) =>
      setTimeout(() => {
        if (stickToBottomRef.current) scrollMessagesToEnd(false);
      }, delay),
    );

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [conversationKey, scrollMessagesToEnd]);

  useEffect(() => {
    if (!conversationKey || messageCount === 0) return;
    if (!stickToBottomRef.current || loadingOlderRef.current) return;
    const frame = requestAnimationFrame(() => scrollMessagesToEnd(false));
    return () => cancelAnimationFrame(frame);
  }, [conversationKey, messageCount, scrollMessagesToEnd]);

  if (!active) return null;

  const isSystem = "sender_name" in active;
  const title = isSystem ? active.sender_name : active.creatorName;
  const systemAvatarLabel = isSystem ? active.sender_avatar ?? "jam." : undefined;
  const avatarUri = isSystem ? null : active.avatarUrl;
  const profileUserId = isSystem ? null : active.userId;
  const messages = isSystem
    ? [{ id: active.id, body: active.body, incoming: true, createdAt: active.created_at }]
    : [...active.messages, ...pendingSessionMessages];
  const hasOutgoing = !isSystem && messages.some((message) => !message.incoming);
  const hasIncoming = !isSystem && messages.some((message) => message.incoming);
  // Locked threads: only allow the first reply to an incoming jam. Pending outbound jams stay closed.
  const canSend = !isSystem && (active.unlocked || (hasIncoming && !hasOutgoing));
  const canLoadOlder =
    !isSystem &&
    Boolean(onLoadOlderMessages) &&
    Boolean(active.hasMoreMessages || active.olderMessagesCursor);

  async function loadOlder() {
    if (isSystem || !onLoadOlderMessages || loadingOlder) return;
    stickToBottomRef.current = false;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      await onLoadOlderMessages(active as Conversation);
    } catch (err) {
      Alert.alert("could not load messages", err instanceof Error ? err.message : "try again");
    } finally {
      setLoadingOlder(false);
      requestAnimationFrame(() => {
        loadingOlderRef.current = false;
      });
    }
  }

  async function submit() {
    if (!draft.trim() || isSystem) return;
    const body = draft.trim();
    setDraft("");
    stickToBottomRef.current = true;
    await onSend(active as Conversation, body);
    requestAnimationFrame(() => scrollMessagesToEnd(true));
  }

  function openMessageMenu(message: ChatMessage) {
    if (message.incoming) return;
    triggerHoldHaptic();
    setContextMessageId((current) => (current === message.id ? null : message.id));
  }

  function openActiveProfile() {
    if (!profileUserId) return;

    try {
      onOpenProfile(profileUserId);
    } catch (err) {
      Alert.alert("could not open profile", err instanceof Error ? err.message : "try again");
    }
  }

  function startEditingMessage(message: ChatMessage) {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
    setContextMessageId(null);
  }

  async function saveEditedMessage() {
    if (!editingMessageId || !editDraft.trim()) return;
    const editingMessage = messages.find((message) => message.id === editingMessageId);
    if (!editingMessage) return;

    await onEditMessage(editingMessage.serverId ?? editingMessage.id, editDraft.trim());
    setEditingMessageId(null);
    setEditDraft("");
  }

  async function deleteOwnMessage(message: ChatMessage) {
    setContextMessageId(null);
    setEditingMessageId(null);
    await onDeleteMessage(message.serverId ?? message.id);
  }

  async function openAttachedVideo(attachment: MessageVideoAttachment) {
    if (openingAttachedVideoRef.current) return;
    openingAttachedVideoRef.current = true;
    Keyboard.dismiss();

    try {
      const ownerId = attachment.userId;
      if (!ownerId) {
        Alert.alert("video unavailable", "this video could not be opened.");
        return;
      }

      if (ownerId === currentUserId) {
        const [profile, videos] = await Promise.all([
          fetchProfile(currentUserId),
          fetchMyVideos(currentUserId),
        ]);
        if (!profile) {
          Alert.alert("video unavailable", "this video is no longer available.");
          return;
        }

        const ownVideos = videos.map((video) => ({ ...video, userId: currentUserId }));
        const initialIndex = ownVideos.findIndex((video) => video.id === attachment.id);
        if (initialIndex < 0) {
          Alert.alert("video unavailable", "this video is no longer available.");
          return;
        }

        const locationParts = getProfileLocationParts(profile);
        setAttachedViewer({
          isOwn: true,
          videos: ownVideos,
          initialIndex,
          owner: {
            creatorName: profile.display_name ?? "you",
            role: profile.creator_types?.[0] ?? "creator",
            location: formatProfileLocation(locationParts.country, locationParts.city) ?? "unknown",
            avatarUrl: profile.avatar_url,
            earlyAdopter: Boolean(profile.early_adopter),
            proBadge: getProBadgeKind({
              earlyAdopter: profile.early_adopter,
              videoCount: Math.max(ownVideos.length, profile.video_count ?? 0),
              proSubscriptionActive: profile.pro_subscription_active,
            }),
          },
          jammedByMe: false,
          jammedMe: false,
        });
        return;
      }

      const [profile, videos, relationship] = await Promise.all([
        fetchCreatorProfile(currentUserId, ownerId),
        fetchCreatorVideos(currentUserId, ownerId),
        fetchRelationshipState(currentUserId, ownerId),
      ]);
      if (!profile) {
        Alert.alert("video unavailable", "this video is no longer available.");
        return;
      }

      const sortedVideos = sortProfileVideosByNewest(videos);
      const postedVideoCount = Math.max(sortedVideos.length, profile.video_count ?? 0);
      const feedVideos = sortedVideos.map((video) =>
        profileToFeedVideo(
          profile,
          video,
          savedVideoIds.has(video.id),
          relationship.jammedByMe,
          relationship.jammedMe,
          postedVideoCount,
        ),
      );
      const initialIndex = feedVideos.findIndex((video) => video.id === attachment.id);
      if (initialIndex < 0) {
        Alert.alert("video unavailable", "this video is no longer available.");
        return;
      }

      const locationParts = getProfileLocationParts(profile);
      setAttachedViewer({
        isOwn: false,
        videos: feedVideos,
        initialIndex,
        owner: {
          creatorName: profile.display_name ?? "creator",
          role: profile.creator_types?.[0] ?? "creator",
          location: formatProfileLocation(locationParts.country, locationParts.city) ?? "unknown",
          avatarUrl: profile.avatar_url,
          earlyAdopter: Boolean(profile.early_adopter),
          proBadge: getProBadgeKind({
            earlyAdopter: profile.early_adopter,
            videoCount: postedVideoCount,
            proSubscriptionActive: profile.pro_subscription_active,
          }),
        },
        jammedByMe: relationship.jammedByMe,
        jammedMe: relationship.jammedMe,
      });
    } catch (err) {
      Alert.alert("could not open video", err instanceof Error ? err.message : "try again");
    } finally {
      openingAttachedVideoRef.current = false;
    }
  }

  function closeAttachedViewer() {
    setAttachedViewer(null);
  }

  function submitAttachedReport(item: FeedVideo, reason: ReportReason) {
    if (attachedReportSubmitting) return;
    setAttachedReportSubmitting(true);
    void reportVideo({
      reporterId: currentUserId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setAttachedReportItem(null);
        closeAttachedViewer();
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setAttachedReportSubmitting(false));
  }

  const chatScreen = (
    <SwipeBackSurface
      resetKey={isSystem ? active.id : active.userId}
      onBack={onClose}
      style={presentation === "overlay" ? styles.chatOverlaySwipeSurface : styles.flex}
      enterFromRight
    >
      <View style={styles.safe}>
        <View style={styles.flex}>
          <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top + 10, 18) }]}>
            <Pressable
              onPress={onClose}
              style={styles.chatBackButton}
              accessibilityLabel="back"
              hitSlop={10}
            >
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            {!isSystem ? (
              <Pressable
                onPress={openActiveProfile}
                accessibilityLabel={`open ${title}'s profile`}
                hitSlop={10}
                style={styles.chatProfileTarget}
              >
                <Avatar uri={avatarUri} label={systemAvatarLabel} size={44} />
                <View>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.helper}>{canSend ? "messages unlocked" : "waiting for a jam"}</Text>
                </View>
              </Pressable>
            ) : (
              <>
                <Avatar label={systemAvatarLabel ?? "jam."} size={44} />
                <View>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.helper}>system message</Text>
                </View>
              </>
            )}
          </View>
          <ScrollView
            ref={messagesScrollRef}
            style={styles.flex}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            onScroll={(event) => {
              if (loadingOlderRef.current) return;
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const distanceFromBottom =
                contentSize.height - layoutMeasurement.height - contentOffset.y;
              stickToBottomRef.current = distanceFromBottom < 100;
            }}
            onContentSizeChange={() => {
              if (loadingOlderRef.current) return;
              if (stickToBottomRef.current) {
                scrollMessagesToEnd(false);
              }
            }}
          >
            {canLoadOlder ? (
              <Pressable
                onPress={() => void loadOlder()}
                disabled={loadingOlder}
                style={styles.chatLoadOlderButton}
                accessibilityRole="button"
                accessibilityLabel="Load earlier messages"
              >
                {loadingOlder ? (
                  <ActivityIndicator color={getActivityIndicatorColor()} />
                ) : (
                  <Text style={styles.chatLoadOlderText}>load earlier messages</Text>
                )}
              </Pressable>
            ) : null}
            {messages.map((message) => {
              const isEditing = editingMessageId === message.id;
              const isMenuOpen = contextMessageId === message.id;

              return (
                <AnimatedChatMessage
                  key={message.id}
                  messageId={message.id}
                  style={[
                    styles.messageWrap,
                    message.incoming ? styles.messageWrapIn : styles.messageWrapOut,
                  ]}
                >
                  {message.video && !isEditing ? (
                    <MessageVideoThumbnail
                      video={message.video}
                      incoming={message.incoming}
                      onPress={() => void openAttachedVideo(message.video!)}
                    />
                  ) : null}
                  <Pressable
                    disabled={message.incoming}
                    onLongPress={() => openMessageMenu(message)}
                    style={[
                      styles.bubble,
                      message.incoming ? styles.bubbleIn : styles.bubbleOut,
                      message.video && !isEditing ? styles.bubbleWithVideo : null,
                    ]}
                  >
                    {isEditing ? (
                      <View style={styles.editMessageBox}>
                        <TextInput
                          value={editDraft}
                          onChangeText={setEditDraft}
                          multiline
                          autoFocus
                          style={[styles.editMessageInput, styles.bubbleTextOut]}
                        />
                        <View style={styles.editMessageActions}>
                          <Pressable onPress={() => {
                            setEditingMessageId(null);
                            setEditDraft("");
                          }}>
                            <Text style={styles.editMessageCancel}>cancel</Text>
                          </Pressable>
                          <Pressable onPress={() => void saveEditedMessage()}>
                            <Text style={styles.editMessageSave}>save</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.bubbleText, !message.incoming && styles.bubbleTextOut]}>
                        {message.body}
                      </Text>
                    )}
                  </Pressable>
                  {isMenuOpen && !message.incoming && !isEditing && (
                    <View style={styles.messageContextMenu}>
                      <Pressable style={styles.messageContextItem} onPress={() => startEditingMessage(message)}>
                        <Text style={styles.messageContextText}>edit</Text>
                      </Pressable>
                      <Pressable style={styles.messageContextItem} onPress={() => void deleteOwnMessage(message)}>
                        <Text style={styles.messageContextDangerText}>delete</Text>
                      </Pressable>
                    </View>
                  )}
                </AnimatedChatMessage>
              );
            })}
          </ScrollView>
          {!isSystem ? (
            <View
              style={[
                styles.chatComposerDock,
                {
                  marginBottom: keyboardHeight,
                  paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12),
                },
              ]}
            >
              <View style={styles.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  editable={canSend}
                  placeholder={canSend ? "message..." : "waiting for a jam"}
                  placeholderTextColor="#71717a"
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                  onSubmitEditing={() => void submit()}
                  style={[styles.input, styles.flex]}
                />
                <Pressable onPress={() => void submit()} disabled={!canSend} style={styles.sendButton}>
                  <Text style={styles.sendButtonText}>send</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        {profileOverlay}
        {attachedViewer ? (
          <ProfileVideoFullscreenModal
            visible
            videos={attachedViewer.videos}
            initialIndex={attachedViewer.initialIndex}
            owner={attachedViewer.owner}
            saved={Boolean(
              !attachedViewer.isOwn &&
                (attachedViewer.videos[attachedViewer.initialIndex] as FeedVideo | undefined)?.savedByMe,
            )}
            presentation="overlay"
            onClose={closeAttachedViewer}
            getSavedForVideo={(video) => savedVideoIds.has(video.id)}
            onSave={(video, nextSaved) => {
              void setVideoSaved(video.id, nextSaved);
              setAttachedViewer((current) => {
                if (!current || current.isOwn) return current;
                return {
                  ...current,
                  videos: current.videos.map((entry) =>
                    entry.id === video.id ? { ...entry, savedByMe: nextSaved } : entry,
                  ),
                };
              });
            }}
            onMessage={() => {
              closeAttachedViewer();
            }}
            ownVideoActions={
              attachedViewer.isOwn
                ? {
                    onDelete: (video) => {
                      Alert.alert("delete video?", "this removes it from your profile.", [
                        { text: "cancel", style: "cancel" },
                        {
                          text: "delete",
                          style: "destructive",
                          onPress: () => {
                            void deleteOwnProfileVideo(video.id, (updater) => {
                              setAttachedViewer((current) => {
                                if (!current?.isOwn) return current;
                                const nextVideos = updater(current.videos as ProfileVideo[]);
                                if (nextVideos.length === 0) return null;
                                return {
                                  ...current,
                                  videos: nextVideos,
                                  initialIndex: Math.min(current.initialIndex, nextVideos.length - 1),
                                };
                              });
                            }, () => closeAttachedViewer());
                          },
                        },
                      ]);
                    },
                  }
                : undefined
            }
            onNotInterested={
              attachedViewer.isOwn
                ? undefined
                : (video) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (!feedItem) return;
                    closeAttachedViewer();
                    void hideCreator(currentUserId, feedItem.userId)
                      .then(() => refreshSavedVideos())
                      .catch((err) => {
                        Alert.alert(
                          "could not hide creator",
                          err instanceof Error ? err.message : "try again",
                        );
                      });
                  }
            }
            onBlock={
              attachedViewer.isOwn
                ? undefined
                : (video) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (!feedItem) return;
                    closeAttachedViewer();
                    void blockUser(currentUserId, feedItem.userId)
                      .then(() => {
                        onInboxChanged?.();
                        return refreshSavedVideos();
                      })
                      .catch((err) => {
                        Alert.alert(
                          "could not block",
                          err instanceof Error ? err.message : "try again",
                        );
                      });
                  }
            }
            onReport={
              attachedViewer.isOwn
                ? undefined
                : (video) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (feedItem) setAttachedReportItem(feedItem);
                  }
            }
            onSendMessage={
              attachedViewer.isOwn
                ? undefined
                : async (video, body) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (!feedItem) return;
                    const savedMessage = await sendJamRequest(feedItem.userId, body, video.id);
                    const outgoingMessage: ChatMessage = {
                      id: savedMessage.id,
                      serverId: savedMessage.id,
                      body: savedMessage.body,
                      incoming: false,
                      createdAt: savedMessage.created_at,
                      video: toMessageVideoAttachmentFromVideo(video, feedItem.userId),
                    };
                    stickToBottomRef.current = true;
                    setSessionMessages((current) =>
                      current.some((message) => message.id === outgoingMessage.id)
                        ? current
                        : [...current, outgoingMessage],
                    );
                    setAttachedViewer((current) => {
                      if (!current || current.isOwn) return current;
                      return {
                        ...current,
                        jammedByMe: true,
                        jammedMe: Boolean(feedItem.jammedMe),
                        videos: current.videos.map((entry) =>
                          entry.id === video.id ||
                          ("userId" in entry && entry.userId === feedItem.userId)
                            ? {
                                ...entry,
                                jammedByMe: true,
                                mutual: Boolean(feedItem.jammedMe),
                              }
                            : entry,
                        ),
                      };
                    });
                    onInboxChanged?.();
                    requestAnimationFrame(() => scrollMessagesToEnd(true));
                  }
            }
          />
        ) : null}
        <FeedReportModal
          item={attachedReportItem}
          submitting={attachedReportSubmitting}
          onClose={() => setAttachedReportItem(null)}
          onSubmit={(reason) => {
            if (attachedReportItem) submitAttachedReport(attachedReportItem, reason);
          }}
        />
      </View>
    </SwipeBackSurface>
  );

  if (presentation === "overlay") {
    return <View style={styles.chatOverlayHost}>{chatScreen}</View>;
  }

  return (
    <Modal animationType="none" transparent visible={Boolean(active)} onRequestClose={onClose}>
      {chatScreen}
    </Modal>
  );
}

function AnimatedChatMessage({
  children,
  messageId,
  style,
}: {
  children: React.ReactNode;
  messageId: string;
  style: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [messageId, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function MessageVideoThumbnail({
  video,
  incoming,
  onPress,
}: {
  video: MessageVideoAttachment;
  incoming: boolean;
  onPress: () => void;
}) {
  const uri = getMessageVideoThumbnailSource(video);
  if (!uri) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={video.caption ? `Open video: ${video.caption}` : "Open shared video"}
      style={[
        styles.messageVideoThumbnailWrap,
        incoming ? styles.messageVideoThumbnailIn : styles.messageVideoThumbnailOut,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.messageVideoThumbnail as ImageStyle}
        alt={video.caption ? `Video: ${video.caption}` : "Shared video"}
      />
    </Pressable>
  );
}

function JamTabBar({
  state,
  navigation,
  userId,
  currentUserProfile,
  unreadInboxCount,
  onShuffleDiscover,
  feedReady = true,
  chromeOpacity,
  chromeClear = false,
}: BottomTabBarProps & {
  userId: string;
  currentUserProfile: Profile | null;
  unreadInboxCount: number;
  onShuffleDiscover: () => void;
  feedReady?: boolean;
  chromeOpacity?: Animated.Value;
  chromeClear?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name as Tab;
  const navBarHeight = getNavBarHeight(insets.bottom);
  const navStyles = activeRoute === "discover" ? darkStyles : styles;
  const postingStatus = usePendingUploadFeedProgress(userId);
  const hideChromeOnDiscover = activeRoute === "discover" && Boolean(chromeOpacity);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Full-screen jam. boot — nav only appears once the discover feed is ready.
  if (!feedReady) return null;
  if (activeRoute === "create") return null;

  function pressTab(tab: Tab) {
    const route = state.routes.find((item) => item.name === tab);
    if (!route) return;

    const isFocused = activeRoute === tab;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (event.defaultPrevented) return;

    if (tab === "discover" && isFocused) {
      onShuffleDiscover();
      return;
    }

    if (!isFocused) {
      // Instant tab switch — LayoutAnimation here made every change feel laggy.
      navigation.navigate(route.name);
    }
  }

  // Height 0 so React Navigation doesn't reserve a second bottom inset — screens already
  // pad with safeWithNav. Nav + progress line overlay absolutely on top.
  return (
    <View pointerEvents="box-none" style={styles.uploadProgressNavWrap}>
      {postingStatus && activeRoute === "discover" ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.uploadProgressLine,
            { bottom: navBarHeight },
            hideChromeOnDiscover ? { opacity: chromeOpacity } : null,
          ]}
          accessibilityLabel={
            postingStatus.phase === "uploading"
              ? "Uploading video"
              : postingStatus.phase === "processing"
                ? postingStatus.progress < 32
                  ? "Rendering video edits"
                  : "Processing video"
                : "Finishing post"
          }
        >
          <View style={[styles.uploadProgressLineFill, { width: `${postingStatus.progress}%` }]} />
        </Animated.View>
      ) : null}
      <Animated.View
        pointerEvents={hideChromeOnDiscover && chromeClear ? "none" : "box-none"}
        style={[
          navStyles.nav,
          { height: navBarHeight, paddingBottom: Math.max(insets.bottom, 12) },
          hideChromeOnDiscover ? { opacity: chromeOpacity } : null,
        ]}
      >
        <NavItem
          tab="discover"
          label="discover"
          active={activeRoute === "discover"}
          onPress={pressTab}
          iconElement={<GridNavIcon styleSet={navStyles} />}
          styleSet={navStyles}
        />
        <Pressable style={navStyles.createNav} onPress={() => pressTab("create")}>
          <Text style={navStyles.createNavText}>+</Text>
        </Pressable>
        <NavItem
          tab="inbox"
          label="inbox"
          active={activeRoute === "inbox"}
          onPress={pressTab}
          iconElement={<MailNavIcon unreadCount={unreadInboxCount} styleSet={navStyles} />}
          styleSet={navStyles}
        />
        <NavItem
          tab="you"
          label="you"
          active={activeRoute === "you"}
          onPress={pressTab}
          iconElement={<ProfileNavIcon profile={currentUserProfile} />}
          styleSet={navStyles}
        />
      </Animated.View>
    </View>
  );
}

function NavItem({
  tab,
  label,
  icon,
  Icon,
  iconElement,
  active,
  onPress,
  styleSet = styles,
}: {
  tab: Tab;
  label: string;
  icon?: string;
  Icon?: () => React.ReactNode;
  iconElement?: React.ReactNode;
  active: boolean;
  onPress: (tab: Tab) => void;
  styleSet?: AppStyleSet;
}) {
  return (
    <Pressable onPress={() => onPress(tab)} style={[styleSet.navItem, active && styleSet.navItemActive]}>
      {iconElement ?? (Icon ? <Icon /> : <Text style={styleSet.navIcon}>{icon}</Text>)}
      {active && <Text style={styleSet.navLabel}>{label}</Text>}
    </Pressable>
  );
}

function ProfileNavIcon({ profile }: { profile: Profile | null }) {
  return (
    <Avatar
      uri={profile?.avatar_url}
      size={30}
    />
  );
}

function MailNavIcon({
  unreadCount = 0,
  styleSet = styles,
}: {
  unreadCount?: number;
  styleSet?: AppStyleSet;
}) {
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);
  const iconColor =
    (StyleSheet.flatten(styleSet.mailIcon)?.borderColor as string | undefined) ?? "#fff";

  return (
    <View style={styleSet.mailIconWrap}>
      <Svg width={26} height={19} viewBox="0 0 26 19" fill="none">
        <Rect
          x={1.4}
          y={1.4}
          width={23.2}
          height={16.2}
          rx={3.2}
          stroke={iconColor}
          strokeWidth={1.8}
        />
        <Path
          d="M 2.8 5.3 L 11.6 10.7 Q 13 11.7 14.4 10.7 L 23.2 5.3"
          stroke={iconColor}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {unreadCount > 0 && (
        <View style={styleSet.mailBadge}>
          <View style={styleSet.mailBadgeInner}>
            <Text style={styleSet.mailBadgeText}>{badgeText}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function GridNavIcon({ styleSet = styles }: { styleSet?: AppStyleSet }) {
  return (
    <View style={styleSet.gridNavIcon}>
      <View style={styleSet.gridNavCell} />
      <View style={styleSet.gridNavCell} />
      <View style={styleSet.gridNavCell} />
      <View style={styleSet.gridNavCell} />
    </View>
  );
}

// TikTok-style text shadow for any text sitting on top of video.

function JamJarSmoothWaveSurface({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={23} height={5} viewBox="0 0 23 5">
      <Path
        d="M -1 4.2 C 3.8 1.55, 7.7 4.85, 11.5 3.7 C 15.3 1.55, 19.2 4.85, 24 3.7 V 5 H -1 Z"
        fill={color}
      />
    </Svg>
  );
}


function FeedChromeLockIcon({ open, size = 20 }: { open: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {open ? (
        <Path
          d="M8 11V8.2C8 5.9 9.7 4 12 4c1.4 0 2.6.7 3.3 1.7"
          stroke="#fff"
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      ) : (
        <Path
          d="M8 11V8.2C8 5.9 9.7 4 12 4s4 1.9 4 4.2V11"
          stroke="#fff"
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      )}
      <Path
        d="M6.5 11h11c.8 0 1.5.7 1.5 1.5v6c0 1.4-1.1 2.5-2.5 2.5h-9C6.1 21 5 19.9 5 18.5v-6C5 11.7 5.7 11 6.5 11Z"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M12 14.2v2.4"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg width={27} height={31} viewBox="0 0 27 31" style={overlayIconShadow}>
      <Path
        d="M4.5 2.5h18a2 2 0 0 1 2 2v24l-11-7-11 7v-24a2 2 0 0 1 2-2Z"
        fill={filled ? BOOKMARK_CREAM : "none"}
        stroke={filled ? BOOKMARK_CREAM : "#fff"}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BellIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M12 3.2c-3.1 0-5.6 2.5-5.6 5.6v2.1c0 .9-.3 1.8-.9 2.5l-1.1 1.3c-.7.8-.2 2.1.9 2.1h13.4c1.1 0 1.6-1.3.9-2.1l-1.1-1.3c-.6-.7-.9-1.6-.9-2.5V8.8c0-3.1-2.5-5.6-5.6-5.6Z"
        fill={filled ? "#fff" : "none"}
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M10 19.2a2.1 2.1 0 0 0 4 0"
        fill="none"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function JamJarIcon({ filled = false }: { filled?: boolean }) {
  const prevFilledRef = useRef<boolean | null>(null);
  const fillAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const fillHeight = useRef(new Animated.Value(filled ? JAM_JAR_FILL_FULL_HEIGHT : JAM_JAR_FILL_EMPTY_HEIGHT)).current;
  const lidSolid = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const lidHeight = useRef(new Animated.Value(filled ? JAM_JAR_LID_FULL_HEIGHT : JAM_JAR_LID_EMPTY_HEIGHT)).current;
  const lidGap = useRef(new Animated.Value(filled ? JAM_JAR_LID_FULL_GAP : JAM_JAR_LID_EMPTY_GAP)).current;
  const smoothWaveOpacity = useRef(new Animated.Value(filled ? 0 : 1)).current;
  const bumpWaveOpacity = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const leakProgress = useRef(new Animated.Value(0)).current;

  const setFilledState = useCallback(
    (isFilled: boolean, animate: boolean) => {
      fillAnimationRef.current?.stop();
      fillAnimationRef.current = null;

      if (!animate) {
        fillHeight.setValue(isFilled ? JAM_JAR_FILL_FULL_HEIGHT : JAM_JAR_FILL_EMPTY_HEIGHT);
        lidSolid.setValue(isFilled ? 1 : 0);
        lidHeight.setValue(isFilled ? JAM_JAR_LID_FULL_HEIGHT : JAM_JAR_LID_EMPTY_HEIGHT);
        lidGap.setValue(isFilled ? JAM_JAR_LID_FULL_GAP : JAM_JAR_LID_EMPTY_GAP);
        smoothWaveOpacity.setValue(isFilled ? 0 : 1);
        bumpWaveOpacity.setValue(isFilled ? 1 : 0);
        leakProgress.setValue(0);
        return;
      }

      smoothWaveOpacity.setValue(1);
      bumpWaveOpacity.setValue(0);
      leakProgress.setValue(0);

      fillAnimationRef.current = Animated.sequence([
        Animated.parallel([
          Animated.timing(fillHeight, {
            toValue: JAM_JAR_FILL_FULL_HEIGHT + 2.5,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.delay(280),
            Animated.parallel([
              Animated.timing(smoothWaveOpacity, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
              }),
              Animated.timing(bumpWaveOpacity, {
                toValue: 1,
                duration: 240,
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.sequence([
            Animated.delay(340),
            Animated.parallel([
              Animated.timing(lidSolid, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(lidHeight, {
                toValue: JAM_JAR_LID_FULL_HEIGHT,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(lidGap, {
                toValue: JAM_JAR_LID_FULL_GAP,
                duration: 200,
                useNativeDriver: false,
              }),
            ]),
          ]),
        ]),
        Animated.timing(fillHeight, {
          toValue: JAM_JAR_FILL_FULL_HEIGHT,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        // Drops shoot up, arc outward, and fall down the sides (keyframed below).
        Animated.timing(leakProgress, {
          toValue: 1,
          duration: 680,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);

      fillAnimationRef.current.start(({ finished }) => {
        fillAnimationRef.current = null;
        if (!finished) return;
        fillHeight.setValue(JAM_JAR_FILL_FULL_HEIGHT);
        leakProgress.setValue(0);
      });
    },
    [bumpWaveOpacity, fillHeight, leakProgress, lidGap, lidHeight, lidSolid, smoothWaveOpacity],
  );

  useEffect(() => {
    const previousFilled = prevFilledRef.current;
    prevFilledRef.current = filled;

    if (previousFilled === null) {
      setFilledState(filled, false);
      return;
    }

    if (!previousFilled && filled) {
      setFilledState(true, true);
      return;
    }

    if (previousFilled && !filled) {
      setFilledState(false, false);
    }
  }, [filled, setFilledState]);

  useEffect(() => {
    return () => {
      fillAnimationRef.current?.stop();
    };
  }, []);

  // Each drop launches upward, drifts to its side, and falls back down in an arc.
  const makeLeakDropStyle = (xEnd: number, yApex: number, yEnd: number) => ({
    opacity: leakProgress.interpolate({
      inputRange: [0, 0.06, 0.7, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateX: leakProgress.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, xEnd * 0.45, xEnd],
        }),
      },
      {
        translateY: leakProgress.interpolate({
          inputRange: [0, 0.2, 0.45, 0.75, 1],
          outputRange: [0, yApex * 0.8, yApex, yApex * 0.25, yEnd],
        }),
      },
    ],
  });

  return (
    <View style={[styles.jamJarIcon, overlayIconShadow]}>
      <View pointerEvents="none" style={styles.jamJarLeak}>
        <Animated.View
          style={[styles.jamJarLeakDrop, styles.jamJarLeakDropSide, filled && jamTint, makeLeakDropStyle(-11, -13, 8)]}
        />
        <Animated.View style={[styles.jamJarLeakDrop, filled && jamTint, makeLeakDropStyle(1.5, -17, 5)]} />
        <Animated.View
          style={[styles.jamJarLeakDrop, styles.jamJarLeakDropSide, filled && jamTint, makeLeakDropStyle(11, -15, 8)]}
        />
      </View>
      <Animated.View style={[styles.jamJarLid, { height: lidHeight, marginBottom: lidGap }]}>
        <Animated.View pointerEvents="none" style={[styles.jamJarLidSolidFill, { opacity: lidSolid }]} />
      </Animated.View>
      <View style={[styles.jamJarBody, filled && jamBorder]}>
        <Animated.View style={[styles.jamJarAnimatedFill, filled && jamTint, { height: fillHeight }]}>
          <Animated.View pointerEvents="none" style={[styles.jamJarSmoothWaveSurface, { opacity: smoothWaveOpacity }]}>
            <JamJarSmoothWaveSurface color={filled ? JAM_JAR_JAM_COLOR : "#fff"} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.jamJarBumpWaveWrap, { opacity: bumpWaveOpacity }]}>
            <View style={[styles.jamJarWaveLeft, filled && jamTint]} />
            <View style={[styles.jamJarWaveRight, filled && jamTint]} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function NearMeIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#d4d4d8";
  const baseCenterY = 27;
  const baseRadiusX = 8.4;
  const baseRadiusY = 2.85;
  const scale = useRef(new Animated.Value(1)).current;
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.22,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasActiveRef.current = active;
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={24} height={32} viewBox="0 0 24 32" fill="none">
        <Path
          d={`M ${12 + baseRadiusX} ${baseCenterY} A ${baseRadiusX} ${baseRadiusY} 0 0 1 ${12 - baseRadiusX} ${baseCenterY}`}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M12 2.75C7.03 2.75 3 6.58 3 11.25C3 17.2 12 27 12 27C12 27 21 17.2 21 11.25C21 6.58 16.97 2.75 12 2.75Z"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          cx={12}
          cy={10.5}
          r={2.35}
          stroke={stroke}
          strokeWidth={2}
          fill={active ? stroke : "none"}
        />
      </Svg>
    </Animated.View>
  );
}

const LOOKING_FOR_ICON_BLUE = "#3b82f6";

const PIN_ICON_RED = "#ef4444";

const PIN_ICON_PATH =
  "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z";

const PIN_PREVIEW_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const PIN_PREVIEW_SCALE = 1.1;
const PIN_MENU_CARD_WIDTH = 148;
const PIN_MENU_CARD_HEIGHT = 52;

/** Classic drawing / push pin — solid fill, angled diagonally. */
function PinIcon({
  size = 22,
  color = PIN_ICON_RED,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "35deg" }],
      }}
    >
      <View
        style={{
          position: "absolute",
          transform: [{ translateX: 0.8 }, { translateY: 1.1 }],
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d={PIN_ICON_PATH} fill="rgba(0,0,0,0.45)" />
        </Svg>
      </View>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={PIN_ICON_PATH} fill={color} />
      </Svg>
    </View>
  );
}

function LookingForIcon({
  active = false,
  size = 24,
  color,
  shadow = false,
}: {
  active?: boolean;
  size?: number;
  color?: string;
  /** Soft silhouette shadow for video overlays. */
  shadow?: boolean;
}) {
  const tint = color ?? (active ? LOOKING_FOR_ICON_BLUE : "#d4d4d8");
  const scale = useRef(new Animated.Value(1)).current;
  const wasActiveRef = useRef(active);
  // Asset is wider than tall (~640×350); size is the height.
  const width = Math.round(size * 1.75);
  const height = size;

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.22,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasActiveRef.current = active;
  }, [active, scale]);

  return (
    <Animated.View style={{ width, height, transform: [{ scale }] }}>
      {shadow ? (
        <Image
          source={LOOKING_FOR_BINOCULARS_ICON}
          style={{
            position: "absolute",
            width,
            height,
            tintColor: "rgba(0,0,0,0.55)",
            transform: [{ translateX: 0.6 }, { translateY: 1.1 }],
          }}
          resizeMode="contain"
        />
      ) : null}
      <Image
        source={LOOKING_FOR_BINOCULARS_ICON}
        style={{ width, height, tintColor: tint }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

function CreateEditTrimIcon({ active = false }: { active?: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = active ? 2.3 : 1.8;
  const stroke = "#fff";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={7.8} cy={6.8} r={2.55} stroke={stroke} strokeWidth={strokeWidth} />
      <Circle cx={16.2} cy={6.8} r={2.55} stroke={stroke} strokeWidth={strokeWidth} />
      <Path
        d="M7.8 9.25 L12 11.15 L5.7 19.35"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.2 9.25 L12 11.15 L18.3 19.35"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={11.15} r={1.05} fill={stroke} />
    </Svg>
  );
}

function CreateEditTextIcon({ active = false }: { active?: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = active ? 2.4 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 7h12" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 7v12" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M10 19h4" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

function filterIconArcPath(cx: number, cy: number, radius: number, startDeg: number, endDeg: number) {
  const toPoint = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const start = toPoint(startDeg);
  const end = toPoint(endDeg);
  let delta = endDeg - startDeg;
  if (delta < 0) delta += 360;
  const largeArc = delta > 180 ? 1 : 0;

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function CreateCameraFilterIcon({ active = false }: { active?: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = active ? 2.55 : 2.15;
  const stroke = "#fff";
  const radius = 5.15;
  const top = { cx: 12, cy: 8.15 };
  const bottomLeft = { cx: 8.05, cy: 15.85 };
  const bottomRight = { cx: 15.95, cy: 15.85 };

  return (
    <Svg width={size} height={size} viewBox="-1 -1 26 26" fill="none">
      <Path
        d={filterIconArcPath(top.cx, top.cy, radius, 150, 79)}
        stroke={stroke}
        strokeWidth={strokeWidth * 0.88}
        strokeLinecap="round"
        opacity={0.5}
      />
      <Path
        d={filterIconArcPath(bottomLeft.cx, bottomLeft.cy, radius, 40, 320)}
        stroke={stroke}
        strokeWidth={strokeWidth * 0.94}
        strokeLinecap="round"
        opacity={0.72}
      />
      <Circle
        cx={bottomRight.cx}
        cy={bottomRight.cy}
        r={radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill={active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.11)"}
      />
    </Svg>
  );
}

function CreateCameraFlipIcon() {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = 2.2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Two circular arrows — flip / switch camera */}
      <Path
        d="M7.2 6.4a7.2 7.2 0 0 1 11.1 2.4"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M18.6 5.2v4.1h-4.1"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.8 17.6a7.2 7.2 0 0 1-11.1-2.4"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M5.4 18.8v-4.1h4.1"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CreateCameraFlashIcon({ enabled }: { enabled: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        stroke="#fff"
        strokeWidth={enabled ? 2.6 : 2.2}
        fill={enabled ? "#fff" : "none"}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CreateCameraTimerIcon({ seconds }: { seconds: RecordingTimerSeconds }) {
  if (seconds > 0) {
    return <Text style={styles.createCameraSideRailText}>{seconds}s</Text>;
  }

  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="8" stroke="#fff" strokeWidth={2.2} />
      <Path d="M12 9.5v4.2l2.4 1.8" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 3.5h6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function FeedFilterIcon({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={26} height={34} viewBox="0 0 24 32" fill="none">
      <Path d="M4 8h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M7 16h10" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M4 24h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function MenuIcon({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16" fill="none">
      <Path d="M1 1h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 8h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 15h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const AnimatedRecordRingCircle = Animated.createAnimatedComponent(Circle);

function RecordingElapsedTimer({ active, style }: { active: boolean; style?: StyleProp<TextStyle> }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  return <Text style={style}>{`${minutes}:${seconds}`}</Text>;
}

function RecordButtonCore({ active }: { active: boolean }) {
  const morph = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(morph, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, morph]);

  const size = morph.interpolate({ inputRange: [0, 1], outputRange: [58, 28] });
  const borderRadius = morph.interpolate({ inputRange: [0, 1], outputRange: [29, 7] });

  return <Animated.View style={{ width: size, height: size, borderRadius, backgroundColor: "#ef4444" }} />;
}

function RecordProgressRing({
  active,
  durationSeconds,
  size,
  strokeWidth,
  centerOffset = 0,
}: {
  active: boolean;
  durationSeconds: number;
  size: number;
  strokeWidth: number;
  centerOffset?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: durationSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      return;
    }
    progress.stopAnimation(() => progress.setValue(0));
  }, [active, durationSeconds, progress]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: centerOffset, left: centerOffset, width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <AnimatedRecordRingCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#ff3b30"
          strokeOpacity={1}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

function SwipeBackSurface({
  children,
  onBack,
  style,
  resetKey,
  enterFromRight = false,
}: {
  children: React.ReactNode;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
  resetKey?: string | boolean | null;
  enterFromRight?: boolean;
}) {
  const [translateX] = useState(() => new Animated.Value(enterFromRight ? viewportWidth : 0));
  const closingRef = useRef(false);
  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  useEffect(() => {
    if (!resetKey) return;
    closingRef.current = false;
    if (!enterFromRight) {
      translateX.setValue(0);
      return;
    }

    translateX.setValue(viewportWidth);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterFromRight, resetKey, translateX]);
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX } }], {
        useNativeDriver: true,
      }),
    [translateX],
  );

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (
      state !== State.END &&
      state !== State.CANCELLED &&
      state !== State.FAILED
    ) {
      return;
    }

    const { x, translationX, translationY, velocityX } = event.nativeEvent;
    const gestureStartedAtEdge = x - translationX < SWIPE_BACK_HIT_WIDTH;
    const movedLikeBackGesture =
      translationX > 42 && Math.abs(translationY) < 90;
    const shouldComplete =
      gestureStartedAtEdge &&
      movedLikeBackGesture &&
      (translationX > viewportWidth * 0.34 || velocityX > 520);

    if (shouldComplete) {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(translateX, {
        toValue: viewportWidth,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onBack();
      });
      return;
    }

    Animated.spring(translateX, {
      toValue: 0,
      damping: 24,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }

  return (
    <PanGestureHandler
      activeOffsetX={24}
      failOffsetY={[-26, 26]}
      hitSlop={{ left: 0, width: SWIPE_BACK_HIT_WIDTH }}
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleGestureStateChange}
    >
      <Animated.View
        style={[
          styles.swipeBackSurface,
          style,
          { transform: [{ translateX: animatedTranslateX }] },
        ]}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, style, disabled && styles.disabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function ProfileJamButton({
  label,
  jamming,
  showCancel = false,
  disabled,
  onPress,
  onCancelPress,
}: {
  label: string;
  jamming: boolean;
  showCancel?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onCancelPress?: (anchor: { x: number; y: number }) => void;
}) {
  const cancelButtonRef = useRef<View>(null);

  return (
    <View style={[styles.profileJamRow, disabled && !jamming && styles.disabled]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.profileJamButton, jamming && styles.profileJamButtonJamming]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.profileJamButtonText,
            jamming && styles.profileJamButtonTextJamming,
          ]}
        >
          {label}
        </Text>
      </Pressable>
      {showCancel ? (
        <Pressable
          ref={cancelButtonRef}
          onPress={() => {
            cancelButtonRef.current?.measureInWindow((x, y, width, height) => {
              onCancelPress?.({ x: x + width / 2, y: y + height });
            });
          }}
          style={styles.profileJamCancelButton}
          accessibilityRole="button"
          accessibilityLabel={jamming ? "unjam" : "cancel jam"}
          hitSlop={6}
        >
          <Text style={styles.profileJamCancelIcon}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AvatarSilhouette({ size }: { size: number }) {
  const iconSize = size * 0.52;
  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="3.5" fill="#71717a" />
      <Path d="M5 20a7 7 0 0 1 14 0" fill="#71717a" />
    </Svg>
  );
}

function Avatar({ uri, size, label }: { uri?: string | null; size: number; label?: string }) {
  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };
  const cachedSource = useMemo(
    () => (uri ? { uri, cache: "force-cache" as const } : null),
    [uri],
  );
  if (cachedSource) {
    return <Image source={cachedSource} style={[styles.avatarImage as ImageStyle, avatarStyle]} alt="profile photo" />;
  }
  return (
    <View style={[styles.avatarFallback, avatarStyle]}>
      {label ? (
        <Text style={[styles.avatarText, { fontSize: Math.max(12, size / 4) }]}>{label}</Text>
      ) : (
        <AvatarSilhouette size={size} />
      )}
    </View>
  );
}

function GoldBadge() {
  return <VerificationBadge tone="gold" />;
}

function BlueBadge() {
  return <VerificationBadge tone="blue" />;
}

function ProBadge({ kind }: { kind: ProBadgeKind }) {
  return kind === "blue" ? <BlueBadge /> : <GoldBadge />;
}

function VerificationBadge({ tone }: { tone: ProBadgeKind }) {
  const colors =
    tone === "blue"
      ? (["#0b3a7a", "#2f7de1", "#9fd0ff", "#2a6fd0", "#0a2f66"] as const)
      : (["#8b5b10", "#d7a435", "#fff36f", "#c98d21", "#7b4e0b"] as const);

  return (
    <View style={styles.goldBadge}>
      <LinearGradient
        colors={[...colors]}
        locations={[0, 0.25, 0.52, 0.78, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.goldBadgeBase}
      >
        <View style={styles.goldBadgeInnerRing} />
        <View style={styles.checkMark}>
          <View style={styles.checkStroke} />
        </View>
      </LinearGradient>
    </View>
  );
}

function ProProgressBar({ posted }: { posted: number }) {
  const clamped = Math.max(0, Math.min(posted, PRO_UNLOCK_VIDEO_COUNT));
  const progress = clamped / PRO_UNLOCK_VIDEO_COUNT;
  const remaining = Math.max(0, PRO_UNLOCK_VIDEO_COUNT - clamped);

  function handlePress() {
    if (remaining <= 0) return;
    const videoWord = remaining === 1 ? "video" : "videos";
    Alert.alert(
      "pro membership",
      `post ${remaining} more ${videoWord} to unlock pro membership.`,
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.proProgressWrap}
      accessibilityRole="button"
      accessibilityLabel={`${clamped} of ${PRO_UNLOCK_VIDEO_COUNT} videos to pro. post ${remaining} more ${remaining === 1 ? "video" : "videos"} to unlock pro membership.`}
      accessibilityValue={{ min: 0, max: PRO_UNLOCK_VIDEO_COUNT, now: clamped }}
      hitSlop={8}
    >
      <Text style={styles.proProgressLabel}>
        {clamped}/{PRO_UNLOCK_VIDEO_COUNT}
      </Text>
      <View style={styles.proProgressTrack}>
        <View style={[styles.proProgressFill, { flex: progress }]} />
        <View style={{ flex: Math.max(0.0001, 1 - progress) }} />
      </View>
    </Pressable>
  );
}

function SectionLabel({ label, light }: { label: string; light?: boolean }) {
  return <Text style={[styles.sectionLabel, light && styles.sectionLabelLight]}>{label}</Text>;
}

function getTabScreenContentStyle(topInset: number) {
  return [
    styles.screenContent,
    { paddingTop: Math.max(topInset + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING) },
  ];
}

type ProfileScrollCollapseContextValue = {
  measureNameEnd: (anchor: View) => void;
};

const ProfileScrollCollapseContext = createContext<ProfileScrollCollapseContextValue | null>(null);

function ProfileNameAnchor({ children }: { children: React.ReactNode }) {
  const context = useContext(ProfileScrollCollapseContext);
  const anchorRef = useRef<View>(null);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || !context) return;
    context.measureNameEnd(anchor);
  }, [context]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure, children]);

  return (
    <View ref={anchorRef} collapsable={false} onLayout={measure}>
      {children}
    </View>
  );
}

type ProfileScrollFadeHandle = {
  /** Scroll so a window-rect is fully inside the visible profile area. */
  ensureWindowRectVisible: (rect: {
    y: number;
    height: number;
    topExtra?: number;
    bottomExtra?: number;
  }) => Promise<void>;
};

const ProfileTopScrollFade = forwardRef<
  ProfileScrollFadeHandle,
  {
    topInset: number;
    contentContainerStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    collapsedHeader?: {
      title: string;
      left?: React.ReactNode;
      right?: React.ReactNode;
    };
    onCollapseChange?: (collapsed: boolean) => void;
  } & Omit<ScrollViewProps, "contentContainerStyle" | "children" | "onScroll"> & {
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  }
>(function ProfileTopScrollFade(
  {
    topInset,
    contentContainerStyle,
    children,
    collapsedHeader,
    onCollapseChange,
    onScroll,
    ...scrollProps
  },
  ref,
) {
  const contentRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const showCollapsedRef = useRef(false);
  const [nameEndY, setNameEndY] = useState(0);
  const [showCollapsed, setShowCollapsed] = useState(false);
  const collapsedAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useImperativeHandle(
    ref,
    () => ({
      ensureWindowRectVisible: ({ y, height, topExtra = 0, bottomExtra = 0 }) => {
        const minY = Math.max(insets.top, 8) + 6;
        const maxY = viewportHeight - Math.max(insets.bottom, 0) - NAV_BAR_HEIGHT - 8;
        const neededTop = y - topExtra;
        const neededBottom = y + height + bottomExtra;
        let delta = 0;
        if (neededTop < minY) {
          delta = neededTop - minY;
        } else if (neededBottom > maxY) {
          delta = neededBottom - maxY;
        }
        if (Math.abs(delta) < 2) {
          return Promise.resolve();
        }
        const nextY = Math.max(0, scrollYRef.current + delta);
        scrollRef.current?.scrollTo({ y: nextY, animated: true });
        return new Promise((resolve) => {
          setTimeout(resolve, 280);
        });
      },
    }),
    [insets.bottom, insets.top],
  );

  const measureNameEnd = useCallback((anchor: View) => {
    const content = contentRef.current;
    if (!content) return;

    anchor.measureLayout(
      content,
      (_x, y, _width, height) => {
        setNameEndY(y + height);
      },
      () => undefined,
    );
  }, []);

  const collapseContextValue = useMemo(
    () => ({
      measureNameEnd,
    }),
    [measureNameEnd],
  );

  // Keep parent notify + animation outside setState updaters — calling setState on
  // MyProfileScreen from inside ProfileTopScrollFade's updater triggers a React warning.
  const setCollapsedVisible = useCallback(
    (next: boolean) => {
      if (showCollapsedRef.current === next) return;
      showCollapsedRef.current = next;
      setShowCollapsed(next);
      onCollapseChange?.(next);
      Animated.timing(collapsedAnim, {
        toValue: next ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [collapsedAnim, onCollapseChange],
  );

  const updateCollapsedForScroll = useCallback(
    (scrollY: number) => {
      const next = nameEndY > 0 && scrollY >= nameEndY;
      setCollapsedVisible(next);
    },
    [nameEndY, setCollapsedVisible],
  );

  useEffect(() => {
    updateCollapsedForScroll(scrollYRef.current);
  }, [nameEndY, updateCollapsedForScroll]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const scrollY = event.nativeEvent.contentOffset.y;
    scrollYRef.current = scrollY;
    updateCollapsedForScroll(scrollY);
    onScroll?.(event);
  }

  const collapsedTranslateY = collapsedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <ProfileScrollCollapseContext.Provider value={collapseContextValue}>
      <View style={styles.profileScrollFadeRoot}>
        {collapsedHeader ? (
          <Animated.View
            pointerEvents={showCollapsed ? "box-none" : "none"}
            style={[
              styles.profileCollapsedBar,
              {
                paddingTop: topInset,
                opacity: collapsedAnim,
                transform: [{ translateY: collapsedTranslateY }],
              },
            ]}
          >
            <View style={styles.profileCollapsedBarContent}>
              {collapsedHeader.left}
              <Text style={styles.profileCollapsedBarTitle} numberOfLines={1}>
                {collapsedHeader.title}
              </Text>
              {collapsedHeader.right ?? <View style={styles.headerSpacer} />}
            </View>
          </Animated.View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          {...scrollProps}
          onScroll={handleScroll}
          scrollEventThrottle={scrollProps.scrollEventThrottle ?? 16}
          showsVerticalScrollIndicator={scrollProps.showsVerticalScrollIndicator ?? false}
        >
          <View ref={contentRef} collapsable={false} style={contentContainerStyle}>
            {children}
          </View>
        </ScrollView>
        <LinearGradient
          pointerEvents="none"
          colors={
            activeThemeMode === "light"
              ? ["#f7f7f8", "rgba(247, 247, 248, 0)"]
              : [dark, "rgba(10, 10, 10, 0)"]
          }
          locations={[0, 1]}
          style={[styles.profileScrollTopFade, { height: topInset + PROFILE_TOP_FADE_EXTRA }]}
        />
      </View>
    </ProfileScrollCollapseContext.Provider>
  );
});

function TabLogoHeader({
  right,
  center,
}: {
  right?: React.ReactNode;
  center?: React.ReactNode;
}) {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.logoSmall}>jam.</Text>
      <View style={styles.headerCenterSlot} pointerEvents="box-none">
        {center}
      </View>
      {right ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

function FilterResetButton({ onReset }: { onReset: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const spinRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });

  function handlePress() {
    spin.setValue(0);
    Animated.parallel([
      Animated.timing(spin, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.86,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    onReset();
  }

  return (
    <Pressable
      style={styles.filterResetButton}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="reset"
    >
      <Animated.View style={{ transform: [{ rotate: spinRotation }, { scale }] }}>
        <Text style={styles.filterResetIcon}>↺</Text>
      </Animated.View>
    </Pressable>
  );
}

function FilterQueryField({
  value,
  onChangeText,
  placeholder,
  onReset,
  onFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onReset: () => void;
  onFocus?: () => void;
}) {
  return (
    <View style={styles.filterQueryRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
        style={[styles.input, styles.filterQueryInput]}
      />
      <FilterResetButton onReset={onReset} />
    </View>
  );
}

function ChipRow({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  const uniqueItems = getUniqueStrings(items);
  if (uniqueItems.length === 0) return null;
  return (
    <View style={styles.chips}>
      {uniqueItems.map((item) => (
        <Pressable key={item} style={styles.chip} onPress={() => onRemove(item)}>
          <Text style={styles.chipText}>{item} ×</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TagPicker({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.categoryGrid}>
      {options.map((tag, index) => {
        const active = selected.includes(tag);
        return (
          <Pressable
            key={`${tag}-${index}`}
            onPress={() => onToggle(tag)}
            style={[styles.categoryOption, active && styles.categoryOptionActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}>
              {tag}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SuggestionList({
  items,
  onPick,
  maxVisibleItems,
}: {
  items: readonly string[];
  onPick: (item: string) => void;
  maxVisibleItems?: number;
}) {
  if (items.length === 0) return null;
  const visibleCount = maxVisibleItems
    ? Math.min(items.length, maxVisibleItems)
    : Math.min(items.length, 7);
  const listMaxHeight = visibleCount * 45;

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={[styles.suggestionList, { maxHeight: listMaxHeight }]}
    >
      {items.map((item, index) => (
        <Pressable key={`${item}-${index}`} style={styles.suggestionItem} onPress={() => onPick(item)}>
          <Text style={styles.suggestionText}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {tabs.map((tab) => (
        <Pressable key={tab} style={[styles.segment, active === tab && styles.segmentActive]} onPress={() => onChange(tab)}>
          <Text style={[styles.segmentText, active === tab && styles.segmentTextActive]}>{tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ProfileLibraryTabs({
  active,
  onChange,
}: {
  active: "videos" | "saved";
  onChange: (tab: "videos" | "saved") => void;
}) {
  return (
    <View style={styles.profileLibraryTabs}>
      <Pressable
        onPress={() => onChange("videos")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: active === "videos" }}
      >
        <Text style={[styles.profileLibraryTabText, active === "videos" && styles.profileLibraryTabTextActive]}>
          videos
        </Text>
      </Pressable>
      <View style={styles.profileLibraryTabDivider} />
      <Pressable
        onPress={() => onChange("saved")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: active === "saved" }}
      >
        <Text style={[styles.profileLibraryTabText, active === "saved" && styles.profileLibraryTabTextActive]}>
          saved
        </Text>
      </Pressable>
    </View>
  );
}

function ProfileGridLoadingPlaceholder() {
  // One frosted slab over the grid area (not per-cell spinners).
  const coverHeight = PROFILE_GRID_ITEM_WIDTH * (16 / 9) * 2 + PROFILE_GRID_GAP;
  return (
    <View
      style={[styles.profileGridLoadingBlur, { height: coverHeight }]}
      accessibilityLabel="loading videos"
    >
      <ActivityIndicator color={getActivityIndicatorColor()} />
    </View>
  );
}

function UploadProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - clampedProgress / 100);

  return (
    <View style={styles.uploadProgressRingWrap}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
    </View>
  );
}

function ProfileGridThumbnail({
  video,
  blurred = false,
  prewarmEnabled = false,
  visibilitySyncRef,
  instantReveal = false,
}: {
  video: ProfileVideo | FeedVideo;
  blurred?: boolean;
  /** When true, start buffering HLS once this thumb intersects the viewport. */
  prewarmEnabled?: boolean;
  visibilitySyncRef?: MutableRefObject<Set<() => void>>;
  /** Skip the load crossfade (used for the long-press pin preview clone). */
  instantReveal?: boolean;
}) {
  const streamId = getVideoStreamId(video);
  const aspectCacheKey = getVideoAspectCacheKeyFromVideo(video);
  const rememberedAspect = getRememberedVideoAspectSize(aspectCacheKey);
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
    imageResizeModeForVideoSize(rememberedAspect?.width, rememberedAspect?.height),
  );
  const uri = candidates[candidateIndex] ?? null;
  const caption = getVideoCaption(video);
  const rootRef = useRef<View>(null);
  const prewarmedVisibleRef = useRef(false);
  const revealedRef = useRef(instantReveal);
  const thumbOpacity = useRef(new Animated.Value(instantReveal ? 1 : 0)).current;
  const placeholderOpacity = useRef(new Animated.Value(instantReveal ? 0 : 1)).current;

  function resetThumbReveal() {
    if (instantReveal) {
      revealedRef.current = true;
      thumbOpacity.stopAnimation();
      placeholderOpacity.stopAnimation();
      thumbOpacity.setValue(1);
      placeholderOpacity.setValue(0);
      return;
    }
    revealedRef.current = false;
    thumbOpacity.stopAnimation();
    placeholderOpacity.stopAnimation();
    thumbOpacity.setValue(0);
    placeholderOpacity.setValue(1);
  }

  function revealThumb() {
    if (revealedRef.current) return;
    revealedRef.current = true;
    if (instantReveal) {
      thumbOpacity.setValue(1);
      placeholderOpacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(thumbOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(placeholderOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  useEffect(() => {
    setCandidateIndex(0);
    const cached = getRememberedVideoAspectSize(aspectCacheKey);
    setThumbResizeMode(imageResizeModeForVideoSize(cached?.width, cached?.height));
    prewarmedVisibleRef.current = false;
    resetThumbReveal();
  }, [aspectCacheKey, video.id, streamId, thumbnailTimeMs, mediaUri, instantReveal]);

  useEffect(() => {
    resetThumbReveal();
  }, [uri, instantReveal]);

  // Warm aspect cache from HLS before the user taps into fullscreen.
  useEffect(() => {
    if (getRememberedVideoAspectSize(aspectCacheKey)) return;
    const gridSource = getGridVideoSource(video);
    if (!gridSource || !gridSource.includes(".m3u8")) return;
    let cancelled = false;
    void probeHlsVideoSize(gridSource).then((size) => {
      if (cancelled || !size) return;
      rememberVideoAspectSize(aspectCacheKey, size.width, size.height);
      rememberVideoAspectSize(getVideoAspectCacheKeyFromSource(gridSource), size.width, size.height);
      setThumbResizeMode(imageResizeModeForVideoSize(size.width, size.height));
    });
    return () => {
      cancelled = true;
    };
    // Depend on identity fields only — pin toggles must not retrigger probes.
  }, [aspectCacheKey, streamId, video.id]);

  useEffect(() => {
    if (!prewarmEnabled || blurred) return;

    const checkVisibility = () => {
      rootRef.current?.measureInWindow((x, y, width, height) => {
        if (!(width > 0 && height > 0)) return;
        const visible =
          y < viewportHeight &&
          y + height > 0 &&
          x < viewportWidth &&
          x + width > 0;
        if (!visible) return;
        const gridSource = getGridVideoSource(video);
        if (!gridSource) return;
        if (prewarmedVisibleRef.current) {
          touchProfileVideoPrewarm(gridSource);
          return;
        }
        prewarmedVisibleRef.current = true;
        prewarmProfileVideoSource(gridSource);
        void ensureVideoAspectCached(video);
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
  }, [blurred, prewarmEnabled, video.id, visibilitySyncRef]);

  if (!uri) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.gridThumbPlaceholder]}>
        <Text style={styles.gridCaption}>{caption}</Text>
      </View>
    );
  }

  const presentation = getVideoPresentation(video);

  return (
    <View
      ref={rootRef}
      collapsable={false}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]}
    >
      <Animated.View
        style={[styles.gridThumbPlaceholder, { opacity: placeholderOpacity }]}
      />
      <Animated.Image
        alt={caption}
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: thumbOpacity }]}
        resizeMode={thumbResizeMode}
        blurRadius={blurred ? 18 : 0}
        onLoad={(event) => {
          const { width, height } = event.nativeEvent.source;
          // Wide clip thumbs are a reliable landscape signal; portrait image boxes are not
          // (local bake posters can be a tall canvas around landscape footage).
          if (width > height) {
            rememberVideoAspectSize(aspectCacheKey, width, height);
          }
          const cached = getRememberedVideoAspectSize(aspectCacheKey);
          setThumbResizeMode(
            imageResizeModeForVideoSize(cached?.width ?? width, cached?.height ?? height),
          );
          revealThumb();
        }}
        onError={() => {
          setCandidateIndex((current) => (current + 1 < candidates.length ? current + 1 : current));
        }}
      />
      {!blurred ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: thumbOpacity }]} pointerEvents="none">
          <VideoPresentationOverlays
            filter={presentation.filter}
            textOverlays={presentation.textOverlays}
            density="thumb"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function VideoGrid({
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
  const pinMenuVideo = pinMenu
    ? videos.find((entry) => entry.id === pinMenu.videoId) ?? null
    : null;
  const pinMenuPinned = getProfileVideoPinnedRank(pinMenuVideo as ProfileVideo | null) != null;

  function openPinMenuForVideo(videoId: string) {
    if (pinPreviewClosingRef.current) return;
    triggerHoldHaptic();
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
      // Mount the floating clone first; animate on the next frames once it's painted
      // so enlarge doesn't hitch on Modal/image mount.
      setPinMenu({ videoId, x, y, width, height });
    };

    const node = gridItemRefs.current.get(videoId);
    if (!node) {
      present(viewportWidth / 2 - 40, viewportHeight / 2 - 40, 80, 80);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      const expand = (height * (PIN_PREVIEW_SCALE - 1)) / 2;
      const reveal = async () => {
        if (ensurePinItemVisible) {
          await ensurePinItemVisible({
            y,
            height,
            topExtra: expand + PIN_MENU_CARD_HEIGHT + 10,
            bottomExtra: expand + 8,
          });
          // Re-measure after the grid scrolls the thumb fully on screen.
          node.measureInWindow((nx, ny, nw, nh) => {
            present(nx, ny, nw, nh);
          });
          return;
        }
        present(x, y, width, height);
      };
      void reveal();
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
      cb?.();
    });
  }

  useEffect(() => {
    onPinPreviewChange?.(Boolean(pinMenu));
    return () => onPinPreviewChange?.(false);
  }, [onPinPreviewChange, pinMenu]);

  useEffect(() => {
    if (!pinMenu) return;
    const token = pinPreviewOpenTokenRef.current;
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
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
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [pinMenu?.videoId]);

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
    // Saved tab: plain centered copy. Videos tab keeps the bordered empty card.
    if (privateCopy) {
      return <Text style={styles.profileSavedEmptyText}>no videos yet</Text>;
    }
    return <EmptyCard text="no videos yet" />;
  }

  return (
    <View>
      {privateCopy ? <Text style={styles.helper}>only visible to you.</Text> : null}
      <View style={styles.grid}>
        {videos.map((video, index) => {
          const isLocked = Boolean(locked && index >= 3);
          const pendingUpload =
            showPendingUploadState && isPendingProfileVideoId(video.id)
              ? getPendingUploadById(getPendingUploadIdFromProfileVideoId(video.id))
              : null;
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
                    transform: [{ scale: pinPreviewScale }],
                  },
                ]}
              >
                <ProfileGridThumbnail video={pinMenuVideo} instantReveal />
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

function ConversationRow({
  conversation,
  onPress,
  onOpenProfile,
  subdued,
}: {
  conversation: Conversation;
  onPress: () => void;
  onOpenProfile: () => void;
  subdued?: boolean;
}) {
  return (
    <Pressable style={[styles.conversationRow, subdued && styles.subdued]} onPress={onPress}>
      <Pressable onPress={onOpenProfile} accessibilityLabel={`open ${conversation.creatorName}'s profile`}>
        <Avatar uri={conversation.avatarUrl} size={52} />
      </Pressable>
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text style={styles.listTitle}>{conversation.creatorName}</Text>
          {conversation.proBadge ? <ProBadge kind={conversation.proBadge} /> : null}
          <Text numberOfLines={1} style={[styles.helper, styles.flex]}>
            {conversation.role} - {conversation.location}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.copy}>{conversation.lastMessage}</Text>
      </View>
      <View style={styles.alignEnd}>
        <Text style={styles.helper}>{conversation.timestamp}</Text>
        {conversation.unread && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
}

function SystemRow({ message, onPress }: { message: InboxMessage; onPress: () => void }) {
  return (
    <Pressable style={styles.conversationRow} onPress={onPress}>
      <Avatar label={message.sender_avatar ?? "jam."} size={52} />
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text style={styles.listTitle}>{message.sender_name}</Text>
          <GoldBadge />
        </View>
        <Text numberOfLines={1} style={styles.helper}>{message.body}</Text>
      </View>
      {!message.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

function SettingsButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.settingsButton} onPress={onPress}>
      <Text style={styles.settingsText}>{label}</Text>
    </Pressable>
  );
}

function getInboxEmptyCopy({
  tab,
  filtersActive,
  nearMeActive,
}: {
  tab: InboxTab;
  filtersActive: boolean;
  nearMeActive: boolean;
}) {
  if (nearMeActive) {
    if (tab === "requests") return "no nearby requests right now.";
    if (tab === "jams") return "no nearby jams right now.";
    return "no nearby sent jams right now.";
  }
  if (filtersActive) {
    if (tab === "requests") return "no requests match these filters.";
    if (tab === "jams") return "no jams match these filters.";
    return "no sent jams match these filters.";
  }
  if (tab === "requests") return "no requests right now.";
  if (tab === "jams") return "no jams yet. mutual jams will appear here.";
  return "no sent jams waiting right now.";
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.helper}>{text}</Text>
    </View>
  );
}

function LoadingScreen({ label, logoOnly = false }: { label: string; logoOnly?: boolean }) {
  // Logo boot screens stay on the dark palette and skip SafeAreaView so the mark
  // doesn't jump when theme hydrates or when the tab bar scene mounts.
  if (logoOnly) {
    return (
      <View style={[darkStyles.feedRoot, darkStyles.centered]}>
        <Text style={darkStyles.logo}>jam.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={getActivityIndicatorColor()} />
        <Text style={styles.helper}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
}

async function extractVideoThumbnailFrames(
  videoUri: string,
  durationMs: number,
  frameCount: number,
  shouldContinue: () => boolean,
) {
  const safeDuration = Math.max(durationMs, 1000);
  const frameDenominator = Math.max(frameCount - 1, 1);
  // Sample inside the clip (5%–95%) so the default poster isn't a black camera-open frame.
  const times = Array.from({ length: frameCount }, (_, index) => {
    const ratio = 0.05 + (index / frameDenominator) * 0.9;
    return Math.round(ratio * safeDuration);
  });
  const frames: Array<{ timeMs: number; uri: string }> = [];

  for (const timeMs of times) {
    if (!shouldContinue()) return frames;

    try {
      const thumbnail = await getThumbnailAsync(videoUri, {
        time: timeMs,
        quality: 0.5,
      });
      frames.push({ timeMs, uri: thumbnail.uri });
    } catch {
      // Skip frames that fail to generate.
    }
  }

  return frames;
}

function CreateFilterThumbImage({ uri }: { uri?: string | null }) {
  return (
    <Image
      source={uri ? { uri } : CREATE_FILTER_PREVIEW_IMAGE}
      style={styles.createFilterThumbImage as ImageStyle}
      resizeMode="cover"
      {...(Platform.OS === "android" ? { resizeMethod: "resize" as const } : {})}
    />
  );
}

function CreateFilterPickerRow({
  selectedFilter,
  onSelect,
  thumbnailUri: _thumbnailUri,
  textOverlays: _textOverlays = [],
  compact = false,
}: {
  selectedFilter: VideoFilter;
  onSelect: (filter: VideoFilter) => void;
  thumbnailUri?: string | null;
  textOverlays?: CreateTextOverlayItem[];
  compact?: boolean;
}) {
  const [filterOptions, setFilterOptions] = useState(getFilterPickerOptions);
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashTokenRef = useRef(0);

  useEffect(() => {
    void ensureFilterCatalogLoaded();
    return subscribeFilterCatalog(() => {
      setFilterOptions(getFilterPickerOptions());
    });
  }, []);

  useEffect(() => {
    return () => {
      flashOpacity.stopAnimation();
    };
  }, [flashOpacity]);

  function flashFilterName(label: string) {
    const token = flashTokenRef.current + 1;
    flashTokenRef.current = token;
    setFlashLabel(label);
    flashOpacity.stopAnimation();
    flashOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || flashTokenRef.current !== token) return;
      setFlashLabel(null);
    });
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.createFilterList, compact && styles.createFilterListCompact]}
      >
        {filterOptions.map((filter) => (
          <Pressable
            key={filter.id}
            style={[styles.createFilterOption, compact && styles.createFilterOptionCompact]}
            onPress={() => {
              onSelect(filter.id);
              flashFilterName(filter.label);
            }}
          >
            <View
              style={[
                styles.createFilterThumbRing,
                compact && styles.createFilterThumbRingCompact,
                selectedFilter === filter.id && styles.createFilterThumbRingActive,
              ]}
            >
              <View style={[styles.createFilterThumbInner, compact && styles.createFilterThumbInnerCompact]}>
                <CreateFilterThumbImage />
                <VideoPresentationOverlays
                  filter={filter.id}
                  textOverlays={[]}
                  density="micro"
                />
              </View>
            </View>
            {!compact ? <Text style={styles.createFilterLabel}>{filter.label}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
      <Modal transparent visible={Boolean(flashLabel)} animationType="none" statusBarTranslucent>
        <View pointerEvents="none" style={styles.createFilterNameFlashRoot}>
          <Animated.Text style={[styles.createFilterNameFlashText, { opacity: flashOpacity }]}>
            {flashLabel}
          </Animated.Text>
        </View>
      </Modal>
    </>
  );
}

function CreateTextFontPickerRow({
  selectedFontId,
  onSelect,
}: {
  selectedFontId: VideoTextFontId;
  onSelect: (fontId: VideoTextFontId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.createTextFontPickerScroll}
      contentContainerStyle={[styles.createFilterList, styles.createTextFontPickerList]}
    >
      {VIDEO_TEXT_FONT_OPTIONS.map((font) => {
        const selected = selectedFontId === font.id;
        return (
          <Pressable
            key={font.id}
            style={[styles.createFilterOption, styles.createFilterOptionCompact]}
            onPress={() => onSelect(font.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${font.label} font`}
          >
            <View
              style={[
                styles.createFilterThumbRing,
                styles.createFilterThumbRingCompact,
                selected && styles.createFilterThumbRingActive,
              ]}
            >
              <View style={[styles.createTextFontThumbInner, styles.createFilterThumbInnerCompact]}>
                <Text style={[styles.createTextFontThumbSample, { fontFamily: font.fontFamily }]}>
                  Aa
                </Text>
              </View>
            </View>
            <Text style={[styles.createFilterLabel, styles.createFilterLabelCompact]}>{font.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function useSuggestions<T extends string>(items: readonly T[], query: string, selected: string[]) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedSet = new Set(selected);
    return getUniqueStrings(items).filter((item): item is T => !selectedSet.has(item) && (!q || item.toLowerCase().includes(q)));
  }, [items, query, selected]);
}

function isLocalImageUri(uri: string | null | undefined) {
  if (!uri) return false;
  if (uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("ph://") || uri.startsWith("assets-library:")) {
    return true;
  }
  return /\.(jpe?g|png|webp|heic|gif)(\?|$)/i.test(uri);
}

function getVideoThumbnailTimeMs(video: ProfileVideo | FeedVideo | MessageVideoAttachment) {
  if ("thumbnailTimeMs" in video && video.thumbnailTimeMs != null) return video.thumbnailTimeMs;
  if ("thumbnail_time_ms" in video && video.thumbnail_time_ms != null) return video.thumbnail_time_ms;
  return 1000;
}

/** Prefer local posters / never feed HLS URLs into Image (that renders blank). */
function getGridThumbnailCandidates(video: ProfileVideo | FeedVideo) {
  const candidates: string[] = [];
  const localPoster = getLocalPosterForVideo(video.id);
  if (localPoster) candidates.push(localPoster);

  const mediaUri =
    ("mediaUrl" in video && video.mediaUrl) ||
    ("media_url" in video && video.media_url) ||
    null;
  if (isLocalImageUri(mediaUri) && mediaUri && !candidates.includes(mediaUri)) {
    candidates.push(mediaUri);
  }

  const streamId = getVideoStreamId(video);
  if (streamId) {
    const primary = getCloudflareThumbnailUrl(streamId, getVideoThumbnailTimeMs(video), { height: 640 });
    const fallback = getCloudflareThumbnailUrl(streamId, 1000, { height: 640 });
    candidates.push(primary);
    if (fallback !== primary) candidates.push(fallback);
  }

  return candidates;
}

function getMessageVideoThumbnailSource(video: MessageVideoAttachment) {
  const streamId = video.cloudflareStreamId || extractCloudflareStreamId(video.mediaUrl);
  if (streamId) {
    return getCloudflareThumbnailUrl(streamId, video.thumbnailTimeMs ?? 1000, { height: 640 });
  }
  return isLocalImageUri(video.mediaUrl) ? video.mediaUrl : null;
}

function toMessageVideoAttachmentFromVideo(
  video: ProfileVideo | FeedVideo,
  ownerUserId: string,
): MessageVideoAttachment {
  const mediaUrl =
    "mediaUrl" in video && video.mediaUrl
      ? video.mediaUrl
      : "media_url" in video
        ? video.media_url ?? null
        : null;
  const cloudflareStreamId =
    "cloudflareStreamId" in video && video.cloudflareStreamId
      ? video.cloudflareStreamId
      : "cloudflare_stream_id" in video
        ? video.cloudflare_stream_id ?? null
        : null;
  const thumbnailTimeMs =
    "thumbnailTimeMs" in video && video.thumbnailTimeMs != null
      ? video.thumbnailTimeMs
      : "thumbnail_time_ms" in video
        ? video.thumbnail_time_ms ?? null
        : null;

  return {
    id: video.id,
    userId: ownerUserId,
    caption: getVideoCaption(video),
    mediaUrl,
    cloudflareStreamId,
    thumbnailTimeMs,
  };
}

function getVideoCaption(video: ProfileVideo | FeedVideo) {
  return "caption" in video ? video.caption?.trim() ?? "" : "";
}

function prepareProfileGridPinReorderAnimation() {
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  LayoutAnimation.configureNext(PROFILE_VIDEO_PIN_REORDER_ANIMATION);
}

async function toggleOwnProfileVideoPin(
  userId: string,
  video: ProfileVideo | FeedVideo,
  setVideos: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  pendingPinRanks?: MutableRefObject<Map<string, number | null>>,
) {
  if (isPendingProfileVideoId(video.id)) return;

  const currentlyPinned = getProfileVideoPinnedRank(video as ProfileVideo) != null;
  let previousVideos: ProfileVideo[] = [];
  let optimisticRank: number | null = null;
  let didOptimisticReorder = false;

  // Keep fetch order in state; displayVideos sorts. Pending ranks stay until a
  // profile reload sees the matching server value — clearing them on API success
  // let focus refreshes flash the thumb back to its old slot.

  prepareProfileGridPinReorderAnimation();
  setVideos((current) => {
    previousVideos = current;
    if (currentlyPinned) {
      pendingPinRanks?.current.set(video.id, null);
      didOptimisticReorder = true;
      return current.map((entry) =>
        entry.id === video.id
          ? { ...entry, pinnedRank: null, pinned_rank: null }
          : entry,
      );
    }

    const pinnedCount = current.filter((entry) => getProfileVideoPinnedRank(entry) != null).length;
    if (pinnedCount >= MAX_PINNED_PROFILE_VIDEOS) {
      return current;
    }

    const used = new Set(
      current
        .map((entry) => getProfileVideoPinnedRank(entry))
        .filter((rank): rank is number => rank != null),
    );
    optimisticRank = 1;
    while (used.has(optimisticRank) && optimisticRank <= MAX_PINNED_PROFILE_VIDEOS) {
      optimisticRank += 1;
    }

    pendingPinRanks?.current.set(video.id, optimisticRank);
    didOptimisticReorder = true;
    return current.map((entry) =>
      entry.id === video.id
        ? { ...entry, pinnedRank: optimisticRank, pinned_rank: optimisticRank }
        : entry,
    );
  });

  if (!currentlyPinned) {
    const pinnedCount = previousVideos.filter(
      (entry) => getProfileVideoPinnedRank(entry) != null,
    ).length;
    if (pinnedCount >= MAX_PINNED_PROFILE_VIDEOS) {
      pendingPinRanks?.current.delete(video.id);
      Alert.alert("pin limit", `you can pin up to ${MAX_PINNED_PROFILE_VIDEOS} videos`);
      return;
    }
  }

  if (!didOptimisticReorder) return;

  try {
    if (currentlyPinned) {
      await unpinProfileVideo(userId, video.id);
      // Keep pending null until load() confirms the server cleared the pin.
      return;
    }

    const rank = await pinProfileVideo(userId, video.id);
    pendingPinRanks?.current.set(video.id, rank);
    prepareProfileGridPinReorderAnimation();
    setVideos((current) => {
      const existing = getProfileVideoPinnedRank(
        current.find((entry) => entry.id === video.id),
      );
      if (existing === rank) return current;
      return current.map((entry) =>
        entry.id === video.id
          ? { ...entry, pinnedRank: rank, pinned_rank: rank }
          : entry,
      );
    });
  } catch (err) {
    pendingPinRanks?.current.delete(video.id);
    prepareProfileGridPinReorderAnimation();
    setVideos(() => previousVideos);
    Alert.alert(
      currentlyPinned ? "could not unpin" : "could not pin",
      err instanceof Error ? err.message : "try again",
    );
  }
}

async function toggleSavedProfileVideo(
  video: ProfileVideo | FeedVideo,
  nextSaved: boolean,
  setSaved: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  setVideoSaved: (videoId: string, nextSaved: boolean) => Promise<boolean>,
) {
  const profileVideo = video as ProfileVideo;

  if (nextSaved) {
    setSaved((current) =>
      current.some((entry) => entry.id === video.id) ? current : [profileVideo, ...current],
    );
  } else {
    setSaved((current) => current.filter((entry) => entry.id !== video.id));
  }

  const saved = await setVideoSaved(video.id, nextSaved);
  if (!saved) {
    if (nextSaved) {
      setSaved((current) => current.filter((entry) => entry.id !== video.id));
    } else {
      setSaved((current) =>
        current.some((entry) => entry.id === video.id) ? current : [profileVideo, ...current],
      );
    }
  }
}

async function deleteOwnProfileVideo(
  videoId: string,
  setVideos: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  setFullscreenIndex: (value: number | null) => void,
) {
  // Tombstone first so any profile reload can't flash the video back on.
  locallyDeletedProfileVideoIds.add(videoId);
  setFullscreenIndex(null);

  // Wait for the fullscreen to unmount so the grid fade/slide is visible.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  let previousVideos: ProfileVideo[] = [];
  LayoutAnimation.configureNext(PROFILE_VIDEO_DELETE_ANIMATION);
  setVideos((current) => {
    previousVideos = current;
    return current.filter((video) => video.id !== videoId);
  });

  try {
    await deleteVideo(videoId);
  } catch (err) {
    locallyDeletedProfileVideoIds.delete(videoId);
    LayoutAnimation.configureNext(PROFILE_VIDEO_DELETE_ANIMATION);
    setVideos(() => previousVideos);
    Alert.alert("could not delete", err instanceof Error ? err.message : "try again");
  }
}
