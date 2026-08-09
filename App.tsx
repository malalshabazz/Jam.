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
import { preloadRecentVideoThumbnail } from "@/components/create/create-media";
import { FilterSheet } from "@/components/discover/filter-sheet";
import { DiscoverScreen } from "@/screens/discover-screen";
import { CreateScreen } from "@/screens/create-screen";
import { InboxScreen } from "@/screens/inbox-screen";
import { MyProfileScreen } from "@/screens/my-profile-screen";

/** Finger travel needed while holding to fill the lock gesture (visual track stays shorter). */



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



function MenuIcon({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16" fill="none">
      <Path d="M1 1h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 8h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 15h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
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
