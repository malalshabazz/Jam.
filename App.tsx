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
import {
  subscribeJamRelationship,
  withJamRelationship,
} from "@/lib/jam-relationship-sync";
import { getUnreadInboxCount, getUnreadLocalInboxCount } from "@/lib/inbox-unread";
import {
  PROFILE_VIDEO_DELETE_ANIMATION,
  PROFILE_VIDEO_PIN_REORDER_ANIMATION,
  filterOutLocallyDeletedVideos,
  locallyDeletedProfileVideoIds,
  pruneLocallyDeletedProfileVideoIds,
} from "@/lib/profile-video-delete-cache";

import { ProfileLocationPicker } from "@/components/ui/profile-location-picker";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FeedReportModal } from "@/components/discover/feed-report-modal";
import { useDailyJamUsage } from "@/lib/use-daily-jam-usage";
import { DmModal } from "@/components/chat/dm-modal";
import {
  ProfileNameAnchor,
  ProfileTopScrollFade,
  type ProfileScrollFadeHandle,
} from "@/components/profile/profile-scroll-fade";
import { ProfileVideoFullscreenModal } from "@/components/profile/profile-video-fullscreen-modal";
import { ChatModal } from "@/components/chat/chat-modal";
import { UserProfileModal } from "@/components/profile/user-profile-modal";
import { Avatar } from "@/components/ui/avatar";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";
import { ChipRow } from "@/components/ui/chip-row";
import { EmptyCard } from "@/components/ui/empty-card";
import { GoldBadge, ProBadge, ProProgressBar, VerificationBadge } from "@/components/ui/badges";
import { ProfileJamButton } from "@/components/ui/profile-jam-button";
import { BellIcon } from "@/components/icons/bell-icon";
import { JamJarIcon } from "@/components/icons/jam-jar-icon";
import { LookingForIcon, LOOKING_FOR_ICON_BLUE } from "@/components/icons/looking-for-icon";
import { BookmarkIcon } from "@/components/icons/bookmark-icon";
import { FeedChromeLockIcon } from "@/components/icons/feed-chrome-lock-icon";
import { PinIcon } from "@/components/icons/pin-icon";
import { VideoGrid } from "@/components/profile/video-grid";
import { triggerHoldHaptic } from "@/lib/hold-haptic";
import { getNavBarHeight } from "@/lib/nav-bar";
import {
  getGridThumbnailCandidates,
  getMessageVideoThumbnailSource,
  getVideoCaption,
  getVideoThumbnailTimeMs,
  isLocalImageUri,
  toMessageVideoAttachmentFromVideo,
} from "@/lib/video-thumbnails";
import { deleteOwnProfileVideo } from "@/lib/delete-own-profile-video";
import { confirmNearMeLiveLocationSharing } from "@/lib/near-me-notice";
import { NearMeIcon } from "@/components/icons/near-me-icon";
import { FeedFilterIcon } from "@/components/icons/feed-filter-icon";
import { SectionLabel } from "@/components/ui/section-label";
import { SuggestionList } from "@/components/ui/suggestion-list";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useSuggestions } from "@/lib/use-suggestions";
import { FilterSheet } from "@/components/discover/filter-sheet";
import { DiscoverScreen } from "@/screens/discover-screen";

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

  useEffect(() => {
    return subscribeJamRelationship((state) => {
      const cached = profilePreloadCacheRef.current.get(state.userId);
      if (cached) {
        profilePreloadCacheRef.current.set(state.userId, {
          ...cached,
          jammedByMe: state.jammedByMe,
          jammedMe: state.jammedMe,
        });
      }
      setPreloadedProfile((current) =>
        current?.userId === state.userId
          ? {
              ...current,
              jammedByMe: state.jammedByMe,
              jammedMe: state.jammedMe,
            }
          : current,
      );
      setActiveDm((current) =>
        current?.userId === state.userId ? withJamRelationship(current, state) : current,
      );
    });
  }, []);

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
    if (cached) {
      // Keep cached profile/videos for speed, but always refresh relationship from DB.
      try {
        const relationship = await fetchRelationshipState(userId, targetUserId);
        const nextPreloadedProfile = {
          ...cached,
          jammedByMe: relationship.jammedByMe,
          jammedMe: relationship.jammedMe,
        };
        profilePreloadCacheRef.current.set(targetUserId, nextPreloadedProfile);
        return nextPreloadedProfile;
      } catch {
        return cached;
      }
    }

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

  useEffect(() => {
    return subscribeJamRelationship((state) => {
      setSaved((current) =>
        current.map((entry) =>
          entry.userId === state.userId ? withJamRelationship(entry, state) : entry,
        ),
      );
      setActiveDm((current) =>
        current?.userId === state.userId ? withJamRelationship(current, state) : current,
      );
    });
  }, []);

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

function getTabScreenContentStyle(topInset: number) {
  return [
    styles.screenContent,
    { paddingTop: Math.max(topInset + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING) },
  ];
}

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

