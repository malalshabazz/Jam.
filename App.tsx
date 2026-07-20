import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { Camera, CameraView, type CameraType } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Linking from "expo-linking";
import { useEventListener } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { VideoView, useVideoPlayer, type VideoContentFit, type VideoPlayerStatus, type VideoSource } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import * as Location from "expo-location";
import { getThumbnailAsync } from "expo-video-thumbnails";
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
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, createContext, memo, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
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
  isLiveLocationSharingEnabled,
  resumeLiveLocationSharingIfEnabled,
} from "@/lib/live-location-sharing";
import {
  isCreatorWithinNearMeRadius,
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
  fetchConversationMessages,
  fetchFeedVideos,
  fetchInbox,
  fetchMyVideos,
  fetchProfile,
  fetchRelationshipState,
  fetchSavedVideos,
  getSignupPosition,
  hideCreator,
  markConversationRead,
  markInboxMessageRead,
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
  getCloudflarePlaybackUrl,
  getCloudflareThumbnailUrl,
  getVideoUploadErrorDetails,
  logVideoUploadStep,
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
  uploadNativeProfileAvatar,
  type NativeAvatarAsset,
} from "@/lib/native-avatar-storage";
import { getAuthEmailRedirectUrl, supabase } from "@/lib/native-supabase";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import {
  VideoPresentationOverlays,
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
  normalizeVideoFilter,
  normalizeVideoTextOverlays,
} from "@/lib/video-presentation";

type Route = "auth" | "onboarding" | "welcome" | "main";
type Tab = "discover" | "inbox" | "create" | "you";
type ThemeMode = "dark" | "light";
type MainTabParamList = {
  discover: undefined;
  create: undefined;
  inbox: undefined;
  you: undefined;
};
type InboxTab = "requests" | "jams" | "sent";
type CreateStage = "camera" | "edit" | "details";
type VideoFilter = "none" | "warm" | "cool" | "fade" | "noir" | "vivid";
type AuthMode = "login" | "signup" | "forgot" | "reset";
type AuthDeepLinkResult = "recovery" | "session" | null;

const AUTH_PASSWORD_MIN_LENGTH = 8;
type LocationCountryOption = {
  country: string;
  aliases?: readonly string[];
  cities: readonly string[];
};
type LocationFilterSelection = {
  country: string;
  cities: string[];
};
type PreloadedUserProfile = {
  userId: string;
  profile: Profile | null;
  videos: ProfileVideo[];
  jammedByMe: boolean;
  jammedMe: boolean;
};
type SavedVideoController = {
  savedVideoIds: Set<string>;
  setVideoSaved: (videoId: string, nextSaved: boolean) => Promise<boolean>;
  refreshSavedVideos: () => Promise<Set<string>>;
};

const { width: viewportWidth, height: viewportHeight } = Dimensions.get("window");
const dark = "#0a0a0a";
const panel = "#18181b";
const panelSoft = "#111113";
const border = "rgba(255,255,255,0.12)";
const muted = "#a1a1aa";
const WELCOME_HEADER_TAP_GUARD = 56;
const SCREEN_CONTENT_PADDING = 22;

const TAB_SCREEN_TOP_PADDING = 18;
const TAB_SCREEN_MIN_TOP_PADDING = 28;
const PROFILE_GRID_GAP = 4;
const PROFILE_GRID_ITEM_WIDTH = (viewportWidth - PROFILE_GRID_GAP * 2) / 3;
const NAV_BAR_HEIGHT = 92;
const NAV_BAR_ITEM_HEIGHT = 58;
const NAV_BAR_TOP_PADDING = 12;
const FEED_ACTION_GAP = 12;
const FULLSCREEN_MESSAGE_SEND_WIDTH = 72;
const FULLSCREEN_MESSAGE_TICK_WIDTH = 54;
const MAX_ACCOUNT_CREATOR_TYPES = 3;
const MAX_VIDEO_ROLES = 1;
const MAX_VIDEO_GENRES = 3;
const LOCATION_PICKER_MAX_VISIBLE_ROWS = 3;
const LOCATION_PICKER_ROW_HEIGHT = 50;
const LOCATION_FILTER_PREFIX = "jam-location-v1:";
const EMPTY_FILTER_GENRES: string[] = [];
const CREATE_FILTER_OPTIONS: Array<{ id: VideoFilter; label: string }> = [
  { id: "none", label: "None" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "fade", label: "Fade" },
  { id: "noir", label: "Noir" },
  { id: "vivid", label: "Vivid" },
];
const CREATE_RECORDING_TIMER_OPTIONS = [0, 3, 10] as const;
type RecordingTimerSeconds = (typeof CREATE_RECORDING_TIMER_OPTIONS)[number];
const CREATE_CAMERA_CONTROLS_BOTTOM_PADDING = 24;
const CREATE_CAMERA_RECORD_BUTTON_SIZE = 78;
const CREATE_CAMERA_FILTER_ROW_HEIGHT = 44;
const CREATE_CAMERA_CONTROL_BUTTON_SIZE = 54;
const CREATE_CAMERA_CONTROL_ICON_SIZE = 28;
const CREATE_CAMERA_TOP_CONTROLS_OFFSET = 12;
const CREATE_FILTER_THUMB_BORDER_WIDTH = 2;
const CAMERA_PINCH_ZOOM_STEP = 0.14;
const FEED_VIDEO_BOTTOM_CORNER_RADIUS = 24;
const FEED_PREVIEW_VIDEO_BOTTOM_CORNER_RADIUS = 12;
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
function pinchScaleToCameraZoom(baseZoom: number, scale: number) {
  const delta = (Math.log(Math.max(scale, 0.01)) / Math.log(2)) * CAMERA_PINCH_ZOOM_STEP;
  return clamp(baseZoom + delta, 0, 1);
}
function clampTextOverlayCenterRatio(ratio: { x: number; y: number }) {
  return { x: clamp(ratio.x, 0.1, 0.9), y: clamp(ratio.y, 0.1, 0.9) };
}
const TEXT_OVERLAY_CENTER_SNAP_THRESHOLD = 0.035;
const TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD = 0.09;
const TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS = 450;
const TEXT_OVERLAY_CENTER_GUIDE_FADE_MS = 180;
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

type CreateTextOverlayItem = {
  id: string;
  text: string;
  centerRatio: { x: number; y: number };
};

function createTextOverlayId() {
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortLocationCountries(options: readonly LocationCountryOption[]): readonly LocationCountryOption[] {
  return [...options]
    .sort((a, b) => a.country.localeCompare(b.country))
    .map((option) => ({
      ...option,
      cities: [...option.cities].sort((a, b) => a.localeCompare(b)),
    }));
}
const LOCATION_FILTER_COUNTRIES = sortLocationCountries([
  { country: "United States", aliases: ["USA", "US", "America"], cities: ["New York", "Los Angeles", "Chicago", "Houston", "Miami"] },
  { country: "China", cities: ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu"] },
  { country: "India", cities: ["Mumbai", "Delhi", "Bengaluru", "Kolkata", "Chennai"] },
  { country: "Indonesia", cities: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang"] },
  { country: "Pakistan", cities: ["Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Islamabad"] },
  { country: "Brazil", cities: ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza"] },
  { country: "Nigeria", cities: ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt"] },
  { country: "Bangladesh", cities: ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet"] },
  { country: "Russia", cities: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan"] },
  { country: "Mexico", cities: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana"] },
  { country: "Japan", cities: ["Tokyo", "Osaka", "Nagoya", "Yokohama", "Fukuoka"] },
  { country: "Philippines", cities: ["Manila", "Quezon City", "Davao City", "Caloocan", "Cebu City"] },
  { country: "Ethiopia", cities: ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Hawassa"] },
  { country: "Egypt", cities: ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said"] },
  { country: "Vietnam", cities: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho"] },
  { country: "Democratic Republic of the Congo", aliases: ["DR Congo", "Congo"], cities: ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani"] },
  { country: "Turkey", cities: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"] },
  { country: "Iran", cities: ["Tehran", "Mashhad", "Isfahan", "Karaj", "Shiraz"] },
  { country: "Germany", cities: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt"] },
  { country: "Thailand", cities: ["Bangkok", "Chiang Mai", "Pattaya", "Phuket", "Nakhon Ratchasima"] },
  { country: "United Kingdom", aliases: ["UK", "Great Britain", "England", "Scotland", "Wales"], cities: ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool"] },
  { country: "France", cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"] },
  { country: "Italy", cities: ["Rome", "Milan", "Naples", "Turin", "Palermo"] },
  { country: "South Africa", cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"] },
  { country: "Tanzania", cities: ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya"] },
  { country: "Myanmar", cities: ["Yangon", "Mandalay", "Naypyidaw", "Mawlamyine", "Bago"] },
  { country: "Kenya", cities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"] },
  { country: "South Korea", aliases: ["Korea"], cities: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"] },
  { country: "Colombia", cities: ["Bogota", "Medellin", "Cali", "Barranquilla", "Cartagena"] },
  { country: "Spain", cities: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza"] },
  { country: "Argentina", cities: ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "La Plata"] },
  { country: "Algeria", cities: ["Algiers", "Oran", "Constantine", "Annaba", "Blida"] },
  { country: "Sudan", cities: ["Khartoum", "Omdurman", "Nyala", "Port Sudan", "Kassala"] },
  { country: "Uganda", cities: ["Kampala", "Gulu", "Lira", "Mbarara", "Jinja"] },
  { country: "Iraq", cities: ["Baghdad", "Basra", "Mosul", "Erbil", "Najaf"] },
  { country: "Ukraine", cities: ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Lviv"] },
  { country: "Canada", cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa"] },
  { country: "Poland", cities: ["Warsaw", "Krakow", "Lodz", "Wroclaw", "Poznan"] },
  { country: "Morocco", cities: ["Casablanca", "Rabat", "Fes", "Marrakesh", "Tangier"] },
  { country: "Saudi Arabia", cities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam"] },
  { country: "Uzbekistan", cities: ["Tashkent", "Samarkand", "Namangan", "Andijan", "Bukhara"] },
  { country: "Peru", cities: ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Cusco"] },
  { country: "Malaysia", cities: ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Kota Kinabalu"] },
  { country: "Angola", cities: ["Luanda", "Huambo", "Lobito", "Benguela", "Lubango"] },
  { country: "Mozambique", cities: ["Maputo", "Matola", "Beira", "Nampula", "Chimoio"] },
  { country: "Ghana", cities: ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast"] },
  { country: "Yemen", cities: ["Sanaa", "Aden", "Taiz", "Hodeidah", "Ibb"] },
  { country: "Nepal", cities: ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar", "Bharatpur"] },
  { country: "Venezuela", cities: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay"] },
  { country: "Netherlands", cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"] },
  { country: "Sweden", cities: ["Stockholm", "Gothenburg", "Malmo", "Uppsala", "Vasteras"] },
  { country: "Australia", cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"] },
]);
const SWIPE_BACK_HIT_WIDTH = 112;
const GESTURE_DIRECTION_LOCK_DISTANCE = 10;
const THEME_STORAGE_KEY = "jam.themeMode";
const FEED_QUICK_FILTERS = ["vocalist", "instrumentalist", "producer"] as const;
const FEED_ROLE_FILTER_WHEEL = [
  ...FEED_QUICK_FILTERS,
  ...creatorRoles.filter(
    (role) =>
      role !== "vocalist" && role !== "instrumentalist" && role !== "producer",
  ),
];
const FEED_ROLE_FILTER_LOOP_COPIES = 3;
const PROFILE_TOP_FADE_EXTRA = 28;
const PROFILE_COLLAPSED_BAR_HEIGHT = 44;
const CREATE_THUMBNAIL_FRAME_COUNT = 24;
const CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT = 76;
const CREATE_THUMBNAIL_SELECTOR_WIDTH_SCALE = 1.45;
const CREATE_TRIM_FILMSTRIP_FRAME_COUNT = 10;
const CREATE_TRIM_FILMSTRIP_HEIGHT = 52;
const CREATE_TRIM_HANDLE_WIDTH = 22;
const CREATE_TRIM_FILMSTRIP_RADIUS = 14;

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

const CREATE_DETAILS_PREVIEW_WIDTH = 96;
const CREATE_DETAILS_PREVIEW_HEIGHT = 170;
const creatorRoleTagSet = new Set(creatorRoles.map(normalizeVideoTag));
const musicGenreTagSet = new Set(musicGenres.map(normalizeVideoTag));
let activeThemeMode: ThemeMode = "dark";
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
const TAB_SWITCH_ANIMATION = {
  duration: 260,
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
};

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
    activeThemeMode = nextThemeMode;
    setThemeMode(nextThemeMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedThemeMode) => {
        if (savedThemeMode === "light" || savedThemeMode === "dark") {
          activeThemeMode = savedThemeMode;
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
          if (await isLiveLocationSharingEnabled(userId)) {
            await disableLiveLocationSharing(userId).catch(() => undefined);
          }
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
  const [discoverBootReady, setDiscoverBootReady] = useState(!showLaunchSplash);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(() => new Set());
  const pendingSavedVideoStateRef = useRef(new Map<string, boolean>());
  const seenInboundMessageIdsRef = useRef<Set<string>>(new Set());
  const inboxNotificationsReadyRef = useRef(false);
  const pendingInboundMessagesRef = useRef<DirectMessageNotificationRow[]>([]);
  const inboxNotificationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboxNotificationOpacity = useRef(new Animated.Value(0)).current;
  const inboxNotificationTranslateY = useRef(new Animated.Value(-8)).current;

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
                onCreate={() => navigation.navigate("create")}
                onInboxChanged={bumpInboxRefresh}
                onBootReady={handleDiscoverBootReady}
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
                refreshSignal={inboxRefreshSignal}
                savedVideoController={savedVideoController}
                onUnreadCountChanged={setUnreadInboxCount}
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

function fadeAnimatedValue(value: Animated.Value, toValue: number, duration: number) {
  return new Promise<void>((resolve) => {
    Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  });
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
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
  onCreate,
  onInboxChanged,
  onBootReady,
}: {
  userId: string;
  viewerProfile: Profile | null;
  shuffleSignal: number;
  savedVideoController: SavedVideoController;
  showBootOverlay?: boolean;
  onCreate: () => void;
  onInboxChanged: () => void;
  onBootReady?: () => void;
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
  const [filterFillActive, setFilterFillActive] = useState(false);
  const [feedBridge, setFeedBridge] = useState<FeedVideo[]>([]);
  const initialBootCompleteRef = useRef(!showBootOverlay);
  const feedCursorRef = useRef<FeedCursor | null>(null);
  const loadingMoreFeedRef = useRef(false);
  const filterFillGenerationRef = useRef(0);
  const itemsRef = useRef<FeedVideo[]>([]);
  const listRef = useRef<FlatList<FeedVideo>>(null);
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const feedPrefetchTarget = FEED_PAGE_SIZE * 4;

  const nearMeRadiusMiles = normalizeNearMeRadius(viewerProfile?.near_me_radius_miles);
  const filterState = useMemo<FeedFilterState>(
    () => ({
      roles,
      genres,
      location,
      nearMeActive,
      userLocation,
      nearMeRadiusMiles,
    }),
    [genres, location, nearMeActive, nearMeRadiusMiles, roles, userLocation],
  );
  const filterStateRef = useRef(filterState);
  filterStateRef.current = filterState;
  itemsRef.current = items;
  const filtersActive = isFeedFilterStateActive(filterState);

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

  async function toggleNearMe() {
    if (nearMeLoading) return;

    if (nearMeActive) {
      setNearMeActive(false);
      setActiveVideoId(null);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
      return;
    }

    setNearMeActive(true);
    setNearMeLoading(true);
    setActiveVideoId(null);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setNearMeActive(false);
        Alert.alert(
          "location needed",
          "turn on location access to see creators near you.",
          [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ],
        );
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

  const load = useCallback(async () => {
    filterFillGenerationRef.current += 1;
    setFilterFillActive(false);
    setError(null);
    // Only blank the first-clip gate on the initial boot; later refreshes stay on the feed.
    if (!initialBootCompleteRef.current) setFirstClipReady(false);
    const page = await fetchFeedVideos(userId, { limit: FEED_PAGE_SIZE });
    feedCursorRef.current = page.nextCursor;
    setFeedCursor(page.nextCursor);
    const nextItems = shuffleVideosWithSpacing(page.items);
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, [userId]);

  const loadMoreFeed = useCallback(async () => {
    const cursor = feedCursorRef.current;
    if (!cursor || loadingMoreFeedRef.current) return;

    loadingMoreFeedRef.current = true;
    try {
      let nextCursor: FeedCursor | null = cursor;
      const accumulated: FeedVideo[] = [];
      let rounds = 0;
      const filters = filterStateRef.current;
      const filtersOn = isFeedFilterStateActive(filters);
      const maxRounds = filtersOn ? 12 : 4;
      const targetMatches = filtersOn ? Math.min(FEED_PAGE_SIZE, 6) : FEED_PAGE_SIZE;

      while (nextCursor && rounds < maxRounds) {
        const page = await fetchFeedVideos(userId, {
          cursor: nextCursor,
          limit: FEED_PAGE_SIZE,
        });
        accumulated.push(...page.items);
        nextCursor = page.nextCursor;
        rounds += 1;
        if (!page.nextCursor) break;

        if (!filtersOn) {
          if (accumulated.length >= FEED_PAGE_SIZE) break;
        } else {
          const matchCount = accumulated.filter((item) => feedVideoMatchesFilters(item, filters)).length;
          if (matchCount >= targetMatches) break;
        }
      }

      feedCursorRef.current = nextCursor;
      setFeedCursor(nextCursor);
      if (accumulated.length === 0) return;

      setItems((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const fresh = accumulated.filter((item) => !existingIds.has(item.id));
        if (fresh.length === 0) return current;
        const nextItems = [...current, ...shuffleVideosWithSpacing(fresh)];
        itemsRef.current = nextItems;
        return nextItems;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load more");
    } finally {
      loadingMoreFeedRef.current = false;
    }
  }, [userId]);

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
        let rounds = 0;
        while (feedCursorRef.current && rounds < 24) {
          if (generation !== filterFillGenerationRef.current) return;

          const page = await fetchFeedVideos(userId, {
            cursor: feedCursorRef.current,
            limit: FEED_PAGE_SIZE,
          });

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
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
        .catch((err) => setError(err instanceof Error ? err.message : "could not load feed"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (shuffleSignal === 0) return;
    const frame = requestAnimationFrame(() => {
      setItems((current) => {
        const nextItems = shuffleVideosWithSpacing(current);
        itemsRef.current = nextItems;
        return nextItems;
      });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [shuffleSignal]);

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

  const searchingForFilterMatches =
    filtered.length === 0 &&
    (loading ||
      filterFillActive ||
      nearMeLoading ||
      (nearMeActive && !userLocation) ||
      (filtersActive && Boolean(feedCursor)));

  // Keep the last non-empty feed on screen while filter paging catches up.
  const holdingFilterBridge =
    searchingForFilterMatches && feedBridge.length > 0 && !loading;

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
  }, [filtered, visibleFeed]);

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

  function updateActiveVideo(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / feedItemHeight);
    const safeIndex = Math.max(0, Math.min(nextIndex, visibleFeed.length - 1));
    const nextItem = visibleFeed[safeIndex];
    if (nextItem) setActiveVideoId(nextItem.id);
    // Prefetch the next page before the end-of-feed footer, like TikTok.
    if (feedCursorRef.current && safeIndex >= visibleFeed.length - 3) {
      void loadMoreFeed();
    }
  }

  const navBarHeight = getNavBarHeight(insets.bottom);
  // Full-screen pages so native pagingEnabled can snap like TikTok (no snapToInterval fighting).
  const feedItemHeight = viewportHeight;
  // Keep the feed playing under the jam compose sheet; pause for profiles/chats/filters.
  const shouldPlayFeedVideos =
    isFocused && !filtersOpen && !activeProfile && !activeChat && !holdingFilterBridge;
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

  return (
    <View style={darkStyles.feedRoot}>
      <View style={[styles.feedTopBar, { top: insets.top + 12 }]}>
        <Pressable
          style={[styles.feedNearMeButton, nearMeActive && styles.feedNearMeButtonActive]}
          accessibilityLabel="near me"
          accessibilityRole="button"
          accessibilityState={{ selected: nearMeActive, busy: nearMeLoading }}
          onPress={() => void toggleNearMe()}
        >
          <NearMeIcon active={nearMeActive} />
        </Pressable>
        <FeedRoleFilterWheel selectedRoles={roles} onSelectRole={applyFeedFilterPill} />
        <Pressable onPress={() => setFiltersOpen(true)} style={styles.feedFilterButton}>
          <FeedFilterIcon />
        </Pressable>
      </View>
      {error && <Toast text={error} />}
      {visibleFeed.length === 0 ? (
        searchingForFilterMatches ? (
          <View style={styles.endOfFeedFullscreen}>
            <ActivityIndicator color={getActivityIndicatorColor()} />
            <Text style={[styles.emptyText, { marginTop: 18 }]}>looking for creators...</Text>
          </View>
        ) : (
          <View style={styles.endOfFeedFullscreen}>
            <Text style={styles.emptyText}>{getEndOfFeedCopy(filtersActive)}</Text>
            <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
              <Text style={styles.createNavText}>+</Text>
            </Pressable>
          </View>
        )
      ) : (
        <FlatList
          ref={listRef}
          data={visibleFeed}
          keyExtractor={(item) => item.id}
          pagingEnabled
          scrollEnabled={!holdingFilterBridge}
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
            if (holdingFilterBridge) return;
            void loadMoreFeed();
          }}
          onEndReachedThreshold={0.8}
          refreshControl={<RefreshControl tintColor={getActivityIndicatorColor()} refreshing={refreshing} onRefresh={refresh} />}
          ListFooterComponent={
            feedCursor || holdingFilterBridge ? null : (
              <EndOfFeedState
                filtersActive={filtersActive}
                height={viewportHeight}
                onCreate={onCreate}
              />
            )
          }
          renderItem={({ item }) => (
            <FeedItem
              item={item}
              height={feedItemHeight}
              navBarHeight={navBarHeight}
              isActive={shouldPlayFeedVideos && item.id === activeVideoId}
              onFirstPlay={
                item.id === activeVideoId || item.id === visibleFeed[0]?.id
                  ? () => setFirstClipReady(true)
                  : undefined
              }
              onOpenProfile={() => setActiveProfile(item)}
              onSave={(nextSaved) => toggleSave(item, nextSaved)}
              onMessage={() => void openJamThread(item)}
              onNotInterested={() => hideFeedCreator(item)}
              onBlock={() => blockFeedCreator(item)}
              onReport={() => setReportItem(item)}
            />
          )}
        />
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
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, nextGenres, nextLocation) => {
          setRoles(nextRoles);
          setGenres(nextGenres);
          setLocation(nextLocation);
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

type JamVideoPlaybackStatus = {
  isLoaded: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  positionMillis: number;
  status: VideoPlayerStatus;
};

function JamVideoView({
  source,
  style,
  contentFit,
  shouldPlay,
  isLooping = false,
  isMuted = false,
  volume = 1,
  nativeControls = false,
  trimStartRatio,
  trimEndRatio,
  scrubToRatio,
  trimPlaybackResumeSignal = 0,
  timeUpdateIntervalSec = 0.25,
  onDurationResolved,
  onPlaybackStatusUpdate,
}: {
  source: string | null;
  style: StyleProp<ViewStyle>;
  contentFit: VideoContentFit;
  shouldPlay: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  nativeControls?: boolean;
  trimStartRatio?: number;
  trimEndRatio?: number;
  scrubToRatio?: number | null;
  trimPlaybackResumeSignal?: number;
  timeUpdateIntervalSec?: number;
  onDurationResolved?: (durationMs: number) => void;
  onPlaybackStatusUpdate?: (status: JamVideoPlaybackStatus) => void;
}) {
  const videoSource = useMemo<VideoSource>(() => getExpoVideoSource(source), [source]);
  const onPlaybackStatusUpdateRef = useRef(onPlaybackStatusUpdate);
  const onDurationResolvedRef = useRef(onDurationResolved);
  const trimStartRatioRef = useRef(trimStartRatio ?? 0);
  const trimEndRatioRef = useRef(trimEndRatio ?? 1);
  const scrubToRatioRef = useRef<number | null>(scrubToRatio ?? null);
  const shouldPlayRef = useRef(shouldPlay);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const freezePositionRef = useRef<number | null>(null);
  const freezeCaptureIdRef = useRef(0);
  const wasScrubbingRef = useRef(false);
  const durationReportedRef = useRef(false);
  const [freezeFrameUri, setFreezeFrameUri] = useState<string | null>(null);
  const playbackStatusRef = useRef<JamVideoPlaybackStatus>({
    isLoaded: false,
    isBuffering: Boolean(source),
    isPlaying: false,
    positionMillis: 0,
    status: "idle",
  });
  const player = useVideoPlayer(videoSource, (nextPlayer) => {
    nextPlayer.loop = isLooping;
    nextPlayer.muted = isMuted;
    nextPlayer.volume = volume;
    nextPlayer.timeUpdateEventInterval = timeUpdateIntervalSec;
    nextPlayer.audioMixingMode = "duckOthers";
    // Keep the decoder warm while backgrounded (paused). Needs the expo-video
    // background-playback plugin in standalone/dev builds; still helps in Expo Go
    // when the host app already allows audio background modes.
    nextPlayer.staysActiveInBackground = true;
    nextPlayer.showNowPlayingNotification = false;
    nextPlayer.bufferOptions = {
      // Start playback as soon as a tiny buffer exists (TikTok-like), instead of
      // waiting until AVPlayer thinks stalling is unlikely.
      waitsToMinimizeStalling: false,
      preferredForwardBufferDuration: Platform.OS === "android" ? 2 : 1,
      minBufferForPlayback: 0.5,
      prioritizeTimeOverSizeThreshold: true,
    };
  });

  const hasTrim =
    (trimStartRatio ?? 0) > 0.001 || (trimEndRatio ?? 1) < 0.999;

  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  useEffect(() => {
    freezeCaptureIdRef.current += 1;
    freezePositionRef.current = null;
    setFreezeFrameUri(null);
  }, [source]);

  useEffect(() => {
    player.timeUpdateEventInterval = timeUpdateIntervalSec;
  }, [player, timeUpdateIntervalSec]);

  useEffect(() => {
    trimStartRatioRef.current = trimStartRatio ?? 0;
    trimEndRatioRef.current = trimEndRatio ?? 1;
  }, [trimEndRatio, trimStartRatio]);

  useEffect(() => {
    scrubToRatioRef.current = scrubToRatio ?? null;
  }, [scrubToRatio]);

  useEffect(() => {
    if (scrubToRatio == null) {
      if (wasScrubbingRef.current && player.duration > 0) {
        wasScrubbingRef.current = false;
        player.currentTime = trimStartRatioRef.current * player.duration;
        if (shouldPlay) {
          player.play();
        }
      }
      return;
    }

    wasScrubbingRef.current = true;
    if (player.duration > 0) {
      player.pause();
      player.currentTime = clamp(scrubToRatio, 0, 1) * player.duration;
    }
  }, [player, scrubToRatio, shouldPlay, source]);

  useEffect(() => {
    if (!trimPlaybackResumeSignal || player.duration <= 0) return;

    scrubToRatioRef.current = null;
    wasScrubbingRef.current = false;
    const startSec = trimStartRatioRef.current * player.duration;
    player.currentTime = startSec;
    if (shouldPlay) {
      player.play();
    }
  }, [player, shouldPlay, trimPlaybackResumeSignal]);

  useEffect(() => {
    onDurationResolvedRef.current = onDurationResolved;
  }, [onDurationResolved]);

  useEffect(() => {
    player.loop = isLooping && !hasTrim;
    player.muted = isMuted;
    player.volume = volume;
  }, [hasTrim, isLooping, isMuted, player, volume]);

  useEffect(() => {
    onPlaybackStatusUpdateRef.current = onPlaybackStatusUpdate;
  }, [onPlaybackStatusUpdate]);

  useEffect(() => {
    if (scrubToRatio != null) return;
    if (!source || player.duration <= 0) return;

    const startSec = trimStartRatioRef.current * player.duration;
    const endSec = trimEndRatioRef.current * player.duration;
    if (endSec <= startSec) return;

    if (player.currentTime < startSec || player.currentTime >= endSec) {
      player.currentTime = startSec;
    }
  }, [player, scrubToRatio, source, trimEndRatio, trimStartRatio]);

  const emitPlaybackStatus = useCallback(
    (patch: Partial<JamVideoPlaybackStatus>) => {
      const nextStatus = {
        ...playbackStatusRef.current,
        ...patch,
      };
      playbackStatusRef.current = nextStatus;
      onPlaybackStatusUpdateRef.current?.(nextStatus);
    },
    [],
  );

  useEffect(() => {
    durationReportedRef.current = false;
    playbackStatusRef.current = {
      isLoaded: false,
      isBuffering: Boolean(source),
      isPlaying: false,
      positionMillis: 0,
      status: player.status,
    };
    onPlaybackStatusUpdateRef.current?.(playbackStatusRef.current);
  }, [emitPlaybackStatus, player, source]);

  useEventListener(player, "statusChange", ({ status }) => {
    const alreadyPlayable =
      playbackStatusRef.current.isLoaded || playbackStatusRef.current.isPlaying;
    // HLS can play while more data loads. Only treat the first load as buffering,
    // not mid-stream rebuffers or brief "loading" blips after returning from background.
    emitPlaybackStatus({
      isLoaded: status === "readyToPlay" || alreadyPlayable,
      isBuffering: status === "loading" && !alreadyPlayable,
      status,
    });

    if (status === "readyToPlay" && player.duration > 0 && !durationReportedRef.current) {
      durationReportedRef.current = true;
      onDurationResolvedRef.current?.(Math.round(player.duration * 1000));
    }

    if (status === "readyToPlay" && player.duration > 0 && scrubToRatioRef.current != null) {
      player.pause();
      player.currentTime = clamp(scrubToRatioRef.current, 0, 1) * player.duration;
      return;
    }

    // Only auto-resume while the app is foregrounded. Backgrounding clears the
    // native surface; we cover that with a freeze-frame and resume on AppState.
    if (
      status === "readyToPlay" &&
      shouldPlayRef.current &&
      appStateRef.current === "active" &&
      scrubToRatioRef.current == null
    ) {
      player.play();
    }
  });

  useEventListener(player, "playingChange", ({ isPlaying }) => {
    emitPlaybackStatus({
      isPlaying,
      ...(isPlaying ? { isBuffering: false, isLoaded: true } : {}),
    });
    if (isPlaying && appStateRef.current === "active") {
      setFreezeFrameUri(null);
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (scrubToRatioRef.current != null) {
      emitPlaybackStatus({
        positionMillis: Math.max(0, Math.round(currentTime * 1000)),
      });
      return;
    }

    const duration = player.duration;
    if (duration > 0) {
      const startRatio = trimStartRatioRef.current;
      const endRatio = trimEndRatioRef.current;
      const hasActiveTrim = startRatio > 0.001 || endRatio < 0.999;
      const startSec = startRatio * duration;
      const endSec = endRatio * duration;
      if (hasActiveTrim && endSec > startSec + 0.05 && currentTime >= endSec - 0.08) {
        player.currentTime = startSec;
        if (shouldPlay && appStateRef.current === "active") {
          player.play();
        }
      }
    }

    emitPlaybackStatus({
      isLoaded: true,
      isBuffering: false,
      positionMillis: Math.max(0, Math.round(currentTime * 1000)),
    });
  });

  useEffect(() => {
    if (!source || !shouldPlay || appStateRef.current !== "active") {
      player.pause();
      return;
    }
    player.play();
  }, [player, shouldPlay, source]);

  useEffect(() => {
    const resumeRetryTimeouts: Array<ReturnType<typeof setTimeout>> = [];

    const clearResumeRetries = () => {
      while (resumeRetryTimeouts.length) {
        const timeoutId = resumeRetryTimeouts.pop();
        if (timeoutId != null) clearTimeout(timeoutId);
      }
    };

    const captureFreezeFrame = (atTimeSec: number) => {
      if (!source) return;
      const captureId = freezeCaptureIdRef.current + 1;
      freezeCaptureIdRef.current = captureId;

      const cloudflareUri = getCloudflareFreezeFrameUri(source, atTimeSec);
      if (cloudflareUri) {
        setFreezeFrameUri(cloudflareUri);
        void Image.prefetch(cloudflareUri);
        return;
      }

      if (
        source.startsWith("file://") ||
        source.startsWith("content://") ||
        source.startsWith("ph://") ||
        source.startsWith("assets-library://")
      ) {
        void getThumbnailAsync(source, {
          time: Math.max(0, Math.round(atTimeSec * 1000)),
          quality: 0.72,
        })
          .then((thumbnail) => {
            if (freezeCaptureIdRef.current !== captureId) return;
            setFreezeFrameUri(thumbnail.uri);
          })
          .catch(() => undefined);
      }
    };

    const resumeForegroundPlayback = () => {
      if (!source || scrubToRatioRef.current != null) return;
      if (appStateRef.current !== "active") return;

      if (!shouldPlayRef.current) {
        player.pause();
        return;
      }

      // Never seek on resume — seeking forces an HLS rebuffer and is why return
      // from background felt slow compared to TikTok.
      player.play();
    };

    const syncPlaybackWithAppState = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "inactive" || nextState === "background") {
        clearResumeRetries();
        if (!source || previousState !== "active") return;
        const freezeAt = Math.max(0, player.currentTime || playbackStatusRef.current.positionMillis / 1000);
        freezePositionRef.current = freezeAt;
        // Pause only — keep the player instance warm via staysActiveInBackground.
        player.pause();
        captureFreezeFrame(freezeAt);
        return;
      }

      if (nextState !== "active") return;

      clearResumeRetries();
      resumeForegroundPlayback();
      requestAnimationFrame(resumeForegroundPlayback);
      for (const delayMs of [16, 48, 120]) {
        resumeRetryTimeouts.push(setTimeout(resumeForegroundPlayback, delayMs));
      }
    };

    const subscription = AppState.addEventListener("change", syncPlaybackWithAppState);
    return () => {
      clearResumeRetries();
      subscription.remove();
    };
  }, [player, source]);

  return (
    <View style={style}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={nativeControls}
        fullscreenOptions={{ enable: nativeControls }}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => {
          if (appStateRef.current === "active") {
            setFreezeFrameUri(null);
          }
        }}
      />
      {freezeFrameUri ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: freezeFrameUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={contentFit === "contain" ? "contain" : "cover"}
          />
        </View>
      ) : null}
    </View>
  );
}

function FeedItem({
  item,
  height,
  navBarHeight,
  isActive,
  onFirstPlay,
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
  onFirstPlay?: () => void;
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
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(item.savedByMe);
  const [bufferingState, setBufferingState] = useState(() => ({
    source,
    waitingForFirstPlay: Boolean(source),
  }));
  const [showWaitingSpinner, setShowWaitingSpinner] = useState(false);
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

  useEffect(() => {
    onFirstPlayRef.current = onFirstPlay;
  }, [onFirstPlay]);

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
  }, [source]);

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

  function togglePlayback() {
    if (moreMenuOpen) {
      setMoreMenuOpen(false);
      return;
    }
    if (!source) return;
    setPaused((current) => !current);
  }

  function updatePlaybackStatus(status: JamVideoPlaybackStatus) {
    const hasStartedPlayback = status.isPlaying || status.positionMillis > 50;
    setBufferingState((current) => {
      if (current.source !== source) {
        return { source, waitingForFirstPlay: !hasStartedPlayback };
      }
      if (!current.waitingForFirstPlay || hasStartedPlayback) {
        return current.waitingForFirstPlay
          ? { source, waitingForFirstPlay: false }
          : current;
      }
      return current;
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
    <Pressable style={[styles.feedItem, { height }]} onPress={togglePlayback}>
      {source ? (
        <View style={feedVideoFrameStyle}>
          <JamVideoView
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            shouldPlay={isActive && !paused}
            isLooping
            isMuted={false}
            volume={1}
            onPlaybackStatusUpdate={updatePlaybackStatus}
          />
          <VideoPresentationOverlays filter={item.videoFilter} textOverlays={item.textOverlays} />
          {posterUri && bufferingState.waitingForFirstPlay ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image
                source={{ uri: posterUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={feedVideoFrameStyle}>
          <View style={styles.videoPlaceholder}>
          <Avatar size={90} />
          <Text style={styles.h2}>{item.creatorName}</Text>
          </View>
        </View>
      )}
      {source && showWaitingSpinner && (
        <View pointerEvents="none" style={[styles.feedBufferingIndicator, { bottom: navBarHeight }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <View style={[styles.feedShade, { bottom: navBarHeight }]} />
      <View pointerEvents="box-none" style={styles.feedOverlayLayer}>
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
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          {visibleTags.length > 0 ? (
            <View style={styles.tags}>
              {visibleTags.map((tag, index) => (
                <Text key={`${tag}-${index}`} style={styles.tag}>{tag}</Text>
              ))}
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
      </View>
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
  height,
  onCreate,
}: {
  filtersActive: boolean;
  height: number;
  onCreate: () => void;
}) {
  return (
    <View style={[styles.endOfFeed, { height }]}>
      <Text style={styles.emptyText}>{getEndOfFeedCopy(filtersActive)}</Text>
      <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
        <Text style={styles.createNavText}>+</Text>
      </Pressable>
    </View>
  );
}

function getEndOfFeedCopy(filtersActive: boolean) {
  return filtersActive
    ? "Try expanding your search — or be one of the first to add to this filter →"
    : "The feed is just getting started — be one of the first faces people see";
}

function FilterSheet({
  visible,
  selectedRoles,
  selectedGenres,
  selectedLocation,
  includeGenres = true,
  onClose,
  onApply,
}: {
  visible: boolean;
  selectedRoles: string[];
  selectedGenres: string[];
  selectedLocation: string;
  includeGenres?: boolean;
  onClose: () => void;
  onApply: (roles: string[], genres: string[], location: string) => void;
}) {
  const [roles, setRoles] = useState(selectedRoles);
  const [genres, setGenres] = useState(selectedGenres);
  const [roleQuery, setRoleQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [locationSelections, setLocationSelections] = useState<LocationFilterSelection[]>(() => parseLocationFilter(selectedLocation));
  const [expandedCountries, setExpandedCountries] = useState<string[]>(() => parseLocationFilter(selectedLocation).map((selection) => selection.country));
  const [locationQuery, setLocationQuery] = useState("");
  const [mounted, setMounted] = useState(visible);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [translateY] = useState(() => new Animated.Value(-viewportHeight));
  const closingRef = useRef(false);
  const wasVisibleRef = useRef(visible);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!visible || !justOpened) return;

    const frame = requestAnimationFrame(() => {
      closingRef.current = false;
      setMounted(true);
      setRoles(selectedRoles);
      setGenres(includeGenres ? selectedGenres : []);
      const nextLocationSelections = parseLocationFilter(selectedLocation);
      setLocationSelections(nextLocationSelections);
      setExpandedCountries(nextLocationSelections.map((selection) => selection.country));
      setLocationQuery("");
      setRoleQuery("");
      setGenreQuery("");
      translateY.setValue(-viewportHeight);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [includeGenres, selectedGenres, selectedLocation, selectedRoles, translateY, visible]);

  useEffect(() => {
    if (!mounted) {
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
  }, [mounted]);

  function closeWithAnimation(onComplete = onClose) {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateY, {
      toValue: -viewportHeight,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setMounted(false);
      closingRef.current = false;
      onComplete();
    });
  }

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
      <Pressable style={styles.modalShade} onPress={() => closeWithAnimation()} />
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
          style={styles.topSheetScroll}
          contentContainerStyle={styles.topSheetScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel label="role" light />
          <ChipRow items={roles} onRemove={(item) => setRoles((current) => current.filter((role) => role !== item))} />
          <FilterQueryField
            value={roleQuery}
            onChangeText={setRoleQuery}
            placeholder="type to filter roles..."
            onReset={resetRoles}
          />
          <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
            setRoles((current) => [...current, role]);
            setRoleQuery("");
          }} />
          <Text style={styles.helper}>{roles.length === 0 ? "no role selection" : ""}</Text>
          {includeGenres ? (
            <>
              <SectionLabel label="genre" light />
              <ChipRow items={genres} onRemove={(item) => setGenres((current) => current.filter((genre) => genre !== item))} />
              <FilterQueryField
                value={genreQuery}
                onChangeText={setGenreQuery}
                placeholder="type to filter genres..."
                onReset={resetGenres}
              />
              <SuggestionList items={genreMatches} maxVisibleItems={3} onPick={(genre) => {
                setGenres((current) => [...current, genre]);
                setGenreQuery("");
              }} />
              <Text style={styles.helper}>{genres.length === 0 ? "no genre selection" : ""}</Text>
            </>
          ) : null}
          <SectionLabel label="location" light />
          <FilterQueryField
            value={locationQuery}
            onChangeText={setLocationQuery}
            placeholder="search countries..."
            onReset={resetLocations}
          />
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={[
              styles.locationFilterList,
              { maxHeight: LOCATION_PICKER_MAX_VISIBLE_ROWS * LOCATION_PICKER_ROW_HEIGHT },
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
        </ScrollView>
        <PrimaryButton
          label="apply"
          onPress={() =>
            closeWithAnimation(() =>
              onApply(roles, includeGenres ? genres : [], encodeLocationFilter(locationSelections)),
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
          { maxHeight: LOCATION_PICKER_MAX_VISIBLE_ROWS * LOCATION_PICKER_ROW_HEIGHT },
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
  const menuUnjamItemRef = useRef<View>(null);
  const [profileHeaderCollapsed, setProfileHeaderCollapsed] = useState(false);
  const [notifyOnPost, setNotifyOnPost] = useState(false);
  const [notifyScale] = useState(() => new Animated.Value(1));
  const notifyRequestIdRef = useRef(0);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [jamComposeItem, setJamComposeItem] = useState<FeedVideo | null>(null);
  const [profileChat, setProfileChat] = useState<Conversation | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (profileHeaderCollapsed) setMenuOpen(false);
  }, [profileHeaderCollapsed]);

  useEffect(() => {
    setMenuOpen(false);
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
  const visibleVideos = sortProfileVideosByNewest(
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
  const showProProgress = shouldShowProProgress(proEntitlement);
  const canUnjam = visibleJammedByMe;
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

  function pressNotifyOnPost() {
    if (!userId || userId === currentUserId) return;

    const nextNotify = !notifyOnPost;
    const requestId = ++notifyRequestIdRef.current;
    setNotifyOnPost(nextNotify);
    if (nextNotify) runNotifyAnimation();

    void setCreatorPostAlert(currentUserId, userId, nextNotify).catch((err) => {
      if (requestId !== notifyRequestIdRef.current) return;
      setNotifyOnPost(!nextNotify);
      Alert.alert(
        nextNotify ? "could not turn on alerts" : "could not turn off alerts",
        err instanceof Error ? err.message : "try again",
      );
    });
  }

  const profileNotifyButton = (
    <Pressable
      style={styles.headerIconButton}
      onPress={pressNotifyOnPost}
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
  );

  const profileOptionsButton = (
    <View style={styles.profileMenuAnchor}>
      <Pressable
        style={styles.headerIconButton}
        onPress={() => setMenuOpen((current) => !current)}
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
                    left: profileNotifyButton,
                    right: profileOptionsButton,
                  }
                : undefined
            }
            onCollapseChange={setProfileHeaderCollapsed}
            onScrollBeginDrag={() => {
              if (menuOpen) setMenuOpen(false);
            }}
          >
            <View style={styles.headerRow}>
              {profileHeaderCollapsed ? <View style={styles.headerSpacer} /> : profileNotifyButton}
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
                  onVideoPress={(_video, index) => {
                    setMenuOpen(false);
                    setFullscreenIndex(index);
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
              videos={visibleFeedVideos}
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
  const pendingSwipeResetOffsetRef = useRef<number | null>(null);
  const gestureDirectionRef = useRef<"horizontal" | "vertical" | null>(null);
  const [index, setIndex] = useState(initialIndex);
  const [sessionVideos, setSessionVideos] = useState<Array<ProfileVideo | FeedVideo>>(videos);
  const [savedLocal, setSavedLocal] = useState(saved);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageInputFocused, setMessageInputFocused] = useState(false);
  const messageInputRef = useRef<TextInput>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [messageSentTickVisible, setMessageSentTickVisible] = useState(false);
  const [messageSentTickScale] = useState(() => new Animated.Value(0));
  const [messageSendButtonWidth] = useState(() => new Animated.Value(FULLSCREEN_MESSAGE_SEND_WIDTH));
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [profileBufferingState, setProfileBufferingState] = useState<{
    source: string | null;
    loading: boolean;
  }>({ source: null, loading: false });
  const [delayedProfileLoadingSource, setDelayedProfileLoadingSource] = useState<string | null>(null);
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));
  const [horizontalTranslateY] = useState(() => new Animated.Value(0));
  const [translateYCorrection] = useState(() => new Animated.Value(0));
  const [heartScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const activeVideos = visible ? sessionVideos : videos;
  const video = activeVideos[index] ?? activeVideos[0];
  const previousVideo = index > 0 ? activeVideos[index - 1] : null;
  const nextVideo = index < activeVideos.length - 1 ? activeVideos[index + 1] : null;
  const source = video ? getGridVideoSource(video) : null;
  const showMessageBar = Boolean(onSendMessage && !ownVideoActions);
  const messageBarHeight = getNavBarHeight(insets.bottom);
  const messageBarInset = showMessageBar ? messageBarHeight + keyboardOffset : 0;
  const ownProfileNavBarHeight = ownVideoActions ? messageBarHeight : 0;
  const videoBottomInset = showMessageBar ? messageBarInset : ownProfileNavBarHeight;
  const actionsBottom = videoBottomInset + FEED_ACTION_GAP;
  const metaBottom = showMessageBar ? messageBarInset + 30 : 122;
  const fullscreenCells = [
    previousVideo ? { video: previousVideo, offset: -viewportHeight } : null,
    video ? { video, offset: 0 } : null,
    nextVideo ? { video: nextVideo, offset: viewportHeight } : null,
  ].filter((cell): cell is { video: ProfileVideo | FeedVideo; offset: number } => Boolean(cell));
  const currentFeedItem = video ? profileVideoToFeedVideo(video) : null;
  const currentPendingSentJam = Boolean(currentFeedItem && isPendingSentJam(currentFeedItem));
  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );
  const animatedTranslateY = useMemo(
    () =>
      Animated.add(translateYCorrection, translateY.interpolate({
        inputRange: [-viewportHeight, viewportHeight],
        outputRange: [-viewportHeight, viewportHeight],
        extrapolate: "clamp",
      })),
    [translateY, translateYCorrection],
  );
  const animatedHorizontalTranslateY = useMemo(
    () => horizontalTranslateY,
    [horizontalTranslateY],
  );
  const handleGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationX, translationY } = event.nativeEvent;
      if (!gestureDirectionRef.current) {
        const absX = Math.abs(translationX);
        const absY = Math.abs(translationY);
        if (Math.max(absX, absY) < GESTURE_DIRECTION_LOCK_DISTANCE) {
          translateX.setValue(0);
          horizontalTranslateY.setValue(0);
          translateY.setValue(0);
          return;
        }

        gestureDirectionRef.current = absX > absY ? "horizontal" : "vertical";
      }

      if (gestureDirectionRef.current === "horizontal") {
        translateX.setValue(Math.max(0, translationX));
        horizontalTranslateY.setValue(translationY);
        translateY.setValue(0);
        return;
      }

      translateX.setValue(0);
      horizontalTranslateY.setValue(0);
      translateY.setValue(translationY);
    },
    [horizontalTranslateY, translateX, translateY],
  );

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) return;

    wasVisibleRef.current = true;
    const frame = requestAnimationFrame(() => {
      setSessionVideos(videos);
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0)));
      const initialVideo = videos[initialIndex];
      setSavedLocal(initialVideo ? getSavedForVideo?.(initialVideo) ?? saved : saved);
      setPaused(false);
      setMenuOpen(false);
      setMessageDraft("");
      setMessageInputFocused(false);
      setMessageSentTickVisible(false);
      messageSentTickScale.setValue(0);
      messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_SEND_WIDTH);
      translateX.setValue(0);
      translateY.setValue(0);
      horizontalTranslateY.setValue(0);
      translateYCorrection.setValue(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [getSavedForVideo, horizontalTranslateY, initialIndex, messageSendButtonWidth, messageSentTickScale, saved, translateX, translateY, translateYCorrection, videos, visible]);

  useEffect(() => {
    if (!visible || !video) return;
    const frame = requestAnimationFrame(() => {
      setSavedLocal(getSavedForVideo?.(video) ?? saved);
      setMenuOpen(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [getSavedForVideo, index, saved, video, visible]);

  useEffect(() => {
    if (!visible) return;
    setMessageDraft("");
    setMessageInputFocused(false);
    setMessageSentTickVisible(false);
    messageSentTickScale.setValue(0);
    messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_SEND_WIDTH);
  }, [index, messageSendButtonWidth, messageSentTickScale, visible]);

  useLayoutEffect(() => {
    const finalOffset = pendingSwipeResetOffsetRef.current;
    if (finalOffset === null) return;

    translateYCorrection.setValue(-finalOffset);
    const frame = requestAnimationFrame(() => {
      translateY.setValue(0);
      translateYCorrection.setValue(0);
      pendingSwipeResetOffsetRef.current = null;
    });

    return () => cancelAnimationFrame(frame);
  }, [index, translateY, translateYCorrection]);

  useEffect(() => {
    if (!visible || !source) {
      setProfileBufferingState({ source, loading: Boolean(source) });
      setDelayedProfileLoadingSource(null);
      return;
    }

    setProfileBufferingState({ source, loading: true });
    setDelayedProfileLoadingSource(null);
    const timer = setTimeout(() => {
      setDelayedProfileLoadingSource(source);
    }, 1000);
    return () => clearTimeout(timer);
  }, [source, visible]);

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

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;

    const { translationX, translationY, velocityY } = event.nativeEvent;
    const gestureDirection = gestureDirectionRef.current;
    gestureDirectionRef.current = null;

    if (state === State.CANCELLED || state === State.FAILED) {
      translateYCorrection.setValue(0);
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
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const isHorizontalBackGesture = gestureDirection === "horizontal" && translationX > 0;
    if (isHorizontalBackGesture) {
      if (translationX >= viewportWidth / 2) {
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
        return;
      }

      translateYCorrection.setValue(0);
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
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    translateX.setValue(0);
    horizontalTranslateY.setValue(0);

    if (gestureDirection !== "vertical") {
      translateYCorrection.setValue(0);
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
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const shouldMove = Math.abs(translationY) > 70 || Math.abs(velocityY) > 520;
    if (!shouldMove) {
      translateYCorrection.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        stiffness: 230,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    const nextIndex = translationY < 0 || velocityY < -520
      ? Math.min(index + 1, Math.max(activeVideos.length - 1, 0))
      : Math.max(index - 1, 0);

    if (nextIndex === index) {
      translateYCorrection.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        stiffness: 230,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    const finalOffset = nextIndex > index ? -viewportHeight : viewportHeight;

    Animated.timing(translateY, {
      toValue: finalOffset,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      pendingSwipeResetOffsetRef.current = finalOffset;
      setIndex(nextIndex);
    });
  }

  function pressSave() {
    if (!video) return;
    const nextSaved = !savedLocal;
    setSavedLocal(nextSaved);
    setSessionVideos((current) =>
      current.map((entry) =>
        entry.id === video.id
          ? {
              ...entry,
              savedByMe: nextSaved,
            }
          : entry,
      ),
    );
    if (nextSaved) runSaveAnimation();
    onSave(video, nextSaved);
  }

  function dismissMessageInput() {
    messageInputRef.current?.blur();
    Keyboard.dismiss();
    setMessageInputFocused(false);
  }

  function handleVideoBackgroundPress() {
    if (showMessageBar && (keyboardOffset > 0 || messageInputFocused)) {
      dismissMessageInput();
      return;
    }

    togglePlayback();
  }

  function togglePlayback() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (!source) return;
    setPaused((current) => !current);
  }

  function updateProfilePlaybackStatus(status: JamVideoPlaybackStatus) {
    const hasStartedPlayback = status.isPlaying || status.positionMillis > 0;
    const isReady = status.isLoaded || hasStartedPlayback;
    setProfileBufferingState((current) => {
      if (current.source !== source) {
        return { source, loading: !isReady };
      }
      // Once this clip has started, keep the spinner off for rebuffers / app resume.
      if (!current.loading || isReady) {
        return current.loading ? { source, loading: false } : current;
      }
      return current;
    });
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

  function pressJam() {
    if (!video) return;

    if (currentPendingSentJam) {
      runJamShakeAnimation();
      return;
    }

    onMessage(video);
  }

  function runFullscreenMenuAction(action?: (video: ProfileVideo | FeedVideo) => void) {
    if (!video || !action) return;
    setMenuOpen(false);
    action(video);
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

    if (currentPendingSentJam) {
      runJamShakeAnimation();
      return;
    }

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

  if (!visible) return null;

  const content = (
    <View style={styles.fullscreenMessageRoot}>
      <PanGestureHandler
        minDist={20}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleGestureStateChange}
      >
        <Animated.View
          style={[
            styles.fullscreenVideoRoot,
            { transform: [{ translateY: animatedTranslateY }] },
          ]}
        >
          {fullscreenCells.map((cell) => {
            const cellSource = getGridVideoSource(cell.video);
            const isCurrentCell = cell.offset === 0;
            const cellOwner = getOwnerForVideo ? getOwnerForVideo(cell.video) : owner;
            const cellFeedItem = profileVideoToFeedVideo(cell.video);
            const cellConnection = cellFeedItem?.mutual
              ? "jamming"
              : cellFeedItem?.jammedMe
                ? "jammed you"
                : null;
            const cellHasSentJam = Boolean(cellFeedItem && hasSentJam(cellFeedItem));
            const cellPendingSentJam = Boolean(cellFeedItem && isPendingSentJam(cellFeedItem));
            const cellSaved = isCurrentCell
              ? savedLocal
              : getSavedForVideo?.(cell.video) ?? saved;
            const cellCaption = getVideoCaption(cell.video);
            const cellTags = getProfileFullscreenTags(cell.video);
            const showModerationMenu = Boolean(onNotInterested && onBlock && onReport);
            return (
              <Animated.View
                key={cell.video.id}
                pointerEvents={isCurrentCell ? "auto" : "none"}
                style={[
                  styles.fullscreenAdjacentVideo,
                  { top: cell.offset },
                  isCurrentCell && styles.fullscreenCurrentVideo,
                  isCurrentCell && {
                    transform: [
                      { translateX: animatedTranslateX },
                      { translateY: animatedHorizontalTranslateY },
                    ],
                  },
                ]}
              >
                {ownVideoActions ? (
                  <View style={[styles.feedPreviewVideoClip, { bottom: ownProfileNavBarHeight }]}>
                    {cellSource ? (
                      <JamVideoView
                        source={cellSource}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        shouldPlay={isCurrentCell && !paused}
                        isLooping
                        isMuted={!isCurrentCell}
                        volume={isCurrentCell ? 1 : 0}
                        onPlaybackStatusUpdate={isCurrentCell ? updateProfilePlaybackStatus : undefined}
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}>
                        <Avatar uri={cellOwner.avatarUrl} size={90} />
                        <Text style={styles.h2}>{cellOwner.creatorName}</Text>
                        <Text style={styles.helper}>video unavailable</Text>
                      </View>
                    )}
                    <VideoPresentationOverlays
                      filter={getVideoPresentation(cell.video).filter}
                      textOverlays={getVideoPresentation(cell.video).textOverlays}
                    />
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoBackgroundPress} />
                    <View style={styles.feedShade} pointerEvents="none" />
                  </View>
                ) : (
                  <>
                    {cellSource ? (
                      <JamVideoView
                        source={cellSource}
                        style={[StyleSheet.absoluteFill, videoBottomInset > 0 && { bottom: videoBottomInset }]}
                        contentFit="cover"
                        shouldPlay={isCurrentCell && !paused}
                        isLooping
                        isMuted={!isCurrentCell}
                        volume={isCurrentCell ? 1 : 0}
                        onPlaybackStatusUpdate={isCurrentCell ? updateProfilePlaybackStatus : undefined}
                      />
                    ) : (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          videoBottomInset > 0 && { bottom: videoBottomInset },
                          styles.videoPlaceholder,
                        ]}
                      >
                        <Avatar uri={cellOwner.avatarUrl} size={90} />
                        <Text style={styles.h2}>{cellOwner.creatorName}</Text>
                        <Text style={styles.helper}>video unavailable</Text>
                      </View>
                    )}
                    <VideoPresentationOverlays
                      filter={getVideoPresentation(cell.video).filter}
                      textOverlays={getVideoPresentation(cell.video).textOverlays}
                      style={videoBottomInset > 0 ? { bottom: videoBottomInset } : undefined}
                    />
                    <Pressable
                      style={[StyleSheet.absoluteFill, videoBottomInset > 0 && { bottom: videoBottomInset }]}
                      onPress={handleVideoBackgroundPress}
                    />
                    <View
                      style={[styles.feedShade, videoBottomInset > 0 && { bottom: videoBottomInset }]}
                      pointerEvents="none"
                    />
                  </>
                )}
                <View style={[styles.feedMeta, { bottom: metaBottom }]}>
                  <View style={styles.row}>
                    <Avatar uri={cellOwner.avatarUrl} size={52} />
                    <View style={styles.flex}>
                      <View style={styles.row}>
                        <Text style={styles.feedName}>{cellOwner.creatorName}</Text>
                        {cellOwner.proBadge ? <ProBadge kind={cellOwner.proBadge} /> : null}
                        {cellConnection && <Text style={styles.badge}>{cellConnection}</Text>}
                      </View>
                      <Text style={styles.feedRole}>{cellOwner.role} - {cellOwner.location}</Text>
                    </View>
                  </View>
                  {cellCaption ? <Text style={styles.caption}>{cellCaption}</Text> : null}
                  {cellTags.length > 0 ? (
                    <View style={styles.tags}>
                      {cellTags.map((tag, index) => (
                        <Text key={`${tag}-${index}`} style={styles.tag}>{tag}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={[styles.actions, { bottom: actionsBottom }]}>
                  {ownVideoActions ? (
                    <View>
                      <Pressable onPress={() => setMenuOpen((current) => !current)} style={styles.actionButton}>
                        <Text style={styles.actionText}>⋯</Text>
                      </Pressable>
                      {isCurrentCell && menuOpen && (
                        <View style={styles.videoMenu}>
                          <Pressable
                            style={styles.videoMenuItem}
                            onPress={() => {
                              setMenuOpen(false);
                              ownVideoActions.onDelete(cell.video);
                            }}
                          >
                            <Text style={styles.videoMenuDangerText}>delete</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      <Pressable
                        onPress={pressJam}
                        style={styles.actionButton}
                        accessibilityLabel={
                          cellFeedItem?.mutual
                            ? `Message ${cellOwner.creatorName} about this video`
                            : cellPendingSentJam
                              ? `Jam already sent to ${cellOwner.creatorName}`
                              : `Jam with ${cellOwner.creatorName}`
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected: cellHasSentJam }}
                      >
                        <Animated.View
                          style={{
                            transform: isCurrentCell
                              ? [
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
                                ]
                              : [],
                          }}
                        >
                          <JamJarIcon filled={cellHasSentJam} />
                        </Animated.View>
                      </Pressable>
                      <Pressable
                        onPress={pressSave}
                        style={styles.actionButton}
                        accessibilityRole="button"
                        accessibilityLabel={cellSaved ? "Remove from saved" : "Save video"}
                        accessibilityState={{ selected: cellSaved }}
                      >
                        <Animated.View
                          style={isCurrentCell ? { transform: [{ scale: heartScale }] } : undefined}
                        >
                          <BookmarkIcon filled={cellSaved} />
                        </Animated.View>
                      </Pressable>
                      {showModerationMenu && (
                        <Pressable
                          onPress={() => setMenuOpen((current) => !current)}
                          style={styles.actionButton}
                          accessibilityLabel={`More options for ${cellOwner.creatorName}`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isCurrentCell && menuOpen }}
                        >
                          <Text style={[styles.actionText, styles.actionDotsText]}>⋯</Text>
                        </Pressable>
                      )}
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
            );
          })}
          {source &&
            profileBufferingState.source === source &&
            profileBufferingState.loading &&
            delayedProfileLoadingSource === source && (
            <View pointerEvents="none" style={styles.videoBufferingIndicator}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <Modal animationType="slide" transparent visible={Boolean(menuOpen && !ownVideoActions && video)} onRequestClose={() => setMenuOpen(false)}>
            <View style={styles.feedMoreSheetWrap}>
              <Pressable
                style={styles.feedMoreSheetDismiss}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="Close video options"
              />
              <View style={styles.feedMoreSheetCard}>
                <Pressable
                  style={styles.feedMoreMenuItem}
                  onPress={() => runFullscreenMenuAction(onNotInterested)}
                >
                  <Text style={styles.feedMoreMenuText}>Not interested</Text>
                </Pressable>
                <Pressable
                  style={styles.feedMoreMenuItem}
                  onPress={() => runFullscreenMenuAction(onBlock)}
                >
                  <Text style={styles.feedMoreMenuDangerText}>Block</Text>
                </Pressable>
                <Pressable
                  style={styles.feedMoreMenuItem}
                  onPress={() => runFullscreenMenuAction(onReport)}
                >
                  <Text style={styles.feedMoreMenuText}>Report</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </Animated.View>
      </PanGestureHandler>
      {showMessageBar && (
        <View
          style={[
            styles.fullscreenMessageBar,
            {
              height: messageBarHeight,
              bottom: keyboardOffset,
              paddingBottom: Math.max(insets.bottom, 12),
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
        </View>
      )}
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
      <View style={styles.jamPromptOverlay}>
        <Pressable style={styles.jamPromptShade} onPress={onCancel} />
        <View style={styles.jamPromptCard}>
          <Text style={styles.cardTitle}>{title}</Text>
          {message ? <Text style={styles.helper}>{message}</Text> : null}
          <View style={styles.twoCol}>
            <Pressable style={styles.confirmOption} onPress={onCancel}>
              <Text style={styles.confirmOptionCancelText}>cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmOption} onPress={onConfirm}>
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

function getCreatePostPreviewFilterStyle(filter: VideoFilter): ViewStyle {
  switch (filter) {
    case "warm":
      return { backgroundColor: "rgba(251,146,60,0.11)" };
    case "cool":
      return { backgroundColor: "rgba(96,165,250,0.11)" };
    case "fade":
      return { backgroundColor: "rgba(255,255,255,0.08)" };
    case "noir":
      return { backgroundColor: "rgba(0,0,0,0.2)" };
    case "vivid":
      return { backgroundColor: "rgba(236,72,153,0.1)" };
    case "none":
    default:
      return {};
  }
}

function CreatePostPreviewModal({
  visible,
  onClose,
  videoUri,
  filter,
  textOverlays,
  caption,
  profile,
  roles,
  genres,
  trimStartRatio = 0,
  trimEndRatio = 1,
}: {
  visible: boolean;
  onClose: () => void;
  videoUri: string | null;
  filter: VideoFilter;
  textOverlays: CreateTextOverlayItem[];
  caption: string;
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
              contentFit="cover"
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
                style={[styles.createPostPreviewFilter, getCreatePostPreviewFilterStyle(filter)]}
              />
            )}
            <View pointerEvents="none" style={styles.createPostPreviewShade} />
          </View>
          {visibleTextOverlays.map((overlay) => {
            const previewTextSize = previewTextSizes[overlay.id] ?? { width: 0, height: 0 };
            const previewTextLeft = previewFrameSize.width * overlay.centerRatio.x - previewTextSize.width / 2;
            const previewTextTop = previewVideoHeight * overlay.centerRatio.y - previewTextSize.height / 2;

            return (
              <View
                key={overlay.id}
                pointerEvents="none"
                style={[
                  styles.createPostPreviewTextOverlay,
                  { left: previewTextLeft, top: previewTextTop },
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
                <Text style={styles.createPostPreviewTextOverlayText}>{overlay.text.trim()}</Text>
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
            {trimmedCaption ? <Text style={styles.caption}>{trimmedCaption}</Text> : null}
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
  onDraftChange,
}: {
  initialText: string;
  inputRef: RefObject<TextInput | null>;
  onDraftChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initialText);

  useEffect(() => {
    setDraft(initialText);
    onDraftChange(initialText);
  }, [initialText, onDraftChange]);

  return (
    <TextInput
      ref={inputRef}
      value={draft}
      onChangeText={(value) => {
        const next = value.slice(0, 60);
        setDraft(next);
        onDraftChange(next);
      }}
      style={styles.createTextOverlayInput}
      maxLength={60}
      multiline
      blurOnSubmit={false}
      selectionColor="rgba(255,255,255,0.9)"
      cursorColor="#ffffff"
      placeholder=""
    />
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
  onSizeChange,
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
  onSizeChange: (size: { width: number; height: number }) => void;
  onPanGesture: (event: PanGestureHandlerGestureEvent) => void;
  onPanStateChange: (event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const [liveSize, setLiveSize] = useState(committedSize);
  const showOverlay = isEditing || Boolean(overlay.text.trim());
  const size = isEditing ? liveSize : committedSize;
  const overlayLeft = viewportWidth * overlay.centerRatio.x - size.width / 2;
  const overlayTop = viewportHeight * overlay.centerRatio.y - size.height / 2;

  useEffect(() => {
    if (!isEditing) {
      setLiveSize(committedSize);
    }
  }, [committedSize, isEditing]);

  if (!showOverlay) return null;

  return (
    <PanGestureHandler
      enabled={!isEditing}
      activeOffsetX={[-12, 12]}
      activeOffsetY={[-12, 12]}
      onGestureEvent={onPanGesture}
      onHandlerStateChange={onPanStateChange}
    >
      <Animated.View
        style={[
          styles.createTextOverlayDraggable,
          {
            left: overlayLeft,
            top: overlayTop,
          },
        ]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width === size.width && height === size.height) return;
          if (isEditing) {
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
            onDraftChange={onDraftChange}
          />
        ) : (
          <Pressable onPress={onOpenActions} accessibilityLabel="text overlay options">
            <Text style={styles.createTextOverlayPreviewText}>{overlay.text.trim()}</Text>
          </Pressable>
        )}
      </Animated.View>
    </PanGestureHandler>
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
  const [textOverlays, setTextOverlays] = useState<CreateTextOverlayItem[]>([]);
  const [editingTextOverlayId, setEditingTextOverlayId] = useState<string | null>(null);
  const [textOverlayActionId, setTextOverlayActionId] = useState<string | null>(null);
  const [textOverlaySizes, setTextOverlaySizes] = useState<Record<string, { width: number; height: number }>>({});
  const [editViewportSize, setEditViewportSize] = useState({
    width: viewportWidth,
    height: viewportHeight - getNavBarHeight(0),
  });
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);
  const [microphonePermissionGranted, setMicrophonePermissionGranted] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [cameraFacingKey, setCameraFacingKey] = useState<CameraType>("back");
  const [cameraZoom, setCameraZoom] = useState(0);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [recordingTimerSeconds, setRecordingTimerSeconds] = useState<RecordingTimerSeconds>(0);
  const [cameraFiltersOpen, setCameraFiltersOpen] = useState(false);
  const [cameraFilterPickerMounted, setCameraFilterPickerMounted] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recentVideoThumbnailUri, setRecentVideoThumbnailUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const cameraFacingRef = useRef<CameraType>("back");
  const lastCameraTapRef = useRef(0);
  const recordingCountdownCancelRef = useRef(false);
  const cameraFilterSlideY = useRef(new Animated.Value(0)).current;
  const cameraFilterPickerOpenRef = useRef(false);
  const cameraZoomRef = useRef(0);
  const pinchBaseZoomRef = useRef(0);
  const textInputRef = useRef<TextInput>(null);
  const editingTextDraftRef = useRef("");
  const editingTextOverlayIdRef = useRef<string | null>(null);
  const textOverlayDragStartRatioRef = useRef({ x: 0.5, y: 0.5 });
  const textOverlayDragActiveRef = useRef(false);
  const textOverlayVerticalGuideOpacity = useRef(new Animated.Value(0)).current;
  const textOverlayHorizontalGuideOpacity = useRef(new Animated.Value(0)).current;
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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void fetchProfile(userId).then((nextProfile) => {
        if (active) setProfile(nextProfile);
      });

      void (async () => {
        const [cameraPermission, microphonePermission] = await Promise.all([
          Camera.requestCameraPermissionsAsync(),
          Camera.requestMicrophonePermissionsAsync(),
        ]);

        if (!active) return;
        setCameraPermissionGranted(cameraPermission.granted);
        setMicrophonePermissionGranted(microphonePermission.granted);
      })();

      void loadRecentVideoThumbnail();

      return () => {
        active = false;
        if (pinchZoomFrameRef.current !== null) {
          cancelAnimationFrame(pinchZoomFrameRef.current);
          pinchZoomFrameRef.current = null;
        }
        cameraZoomRef.current = 0;
        pinchBaseZoomRef.current = 0;
        setCameraZoom(0);
      };
    }, [userId]),
  );

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
      return;
    }

    const navBarHeight = getNavBarHeight(insets.bottom);
    const filterSlideDistance = getCreateCameraFilterSlideDistance(navBarHeight);

    if (cameraFiltersOpen) {
      cameraFilterPickerOpenRef.current = true;
      setCameraFilterPickerMounted(true);
      cameraFilterSlideY.stopAnimation();
      cameraFilterSlideY.setValue(filterSlideDistance);
      Animated.spring(cameraFilterSlideY, {
        toValue: 0,
        damping: 28,
        stiffness: 240,
        mass: 0.9,
        overshootClamping: true,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!cameraFilterPickerOpenRef.current) return;

    cameraFilterPickerOpenRef.current = false;
    Animated.timing(cameraFilterSlideY, {
      toValue: filterSlideDistance,
      duration: 210,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setCameraFilterPickerMounted(false);
    });
  }, [cameraFilterSlideY, cameraFiltersOpen, createStage, insets.bottom]);

  useEffect(() => {
    if (createStage !== "details" || !asset?.uri || !selectedVideoDurationMs) return;

    void loadThumbnailFrameOptions(asset.uri, selectedVideoDurationMs);
  }, [asset?.uri, createStage, selectedVideoDurationMs]);

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
    setTextOverlays([]);
    setEditingTextOverlayId(null);
    setTextOverlayActionId(null);
    setTextOverlaySizes({});
    hideTextOverlaySnapGuides(true);
    setRecording(false);
    setPostPreviewOpen(false);
    setFlashEnabled(false);
    setRecordingTimerSeconds(0);
    setCameraFiltersOpen(false);
    setRecordingCountdown(null);
    recordingCountdownCancelRef.current = false;
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
    try {
      const permission = await MediaLibrary.getPermissionsAsync();
      if (!permission.granted) return;

      const assets = await MediaLibrary.getAssetsAsync({
        first: 1,
        mediaType: MediaLibrary.MediaType.video,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const latestVideo = assets.assets[0];
      if (!latestVideo) return;

      const assetInfo = await MediaLibrary.getAssetInfoAsync(latestVideo, {
        shouldDownloadFromNetwork: true,
      });
      const videoUri = assetInfo.localUri ?? assetInfo.uri;
      if (!videoUri || videoUri.startsWith("ph://")) {
        setRecentVideoThumbnailUri(null);
        return;
      }

      const thumbnail = await getThumbnailAsync(videoUri, {
        time: 0,
        quality: 1,
      });
      setRecentVideoThumbnailUri(thumbnail.uri);
    } catch {
      setRecentVideoThumbnailUri(null);
    }
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

    const nextAsset = {
      uri: picked.uri,
      fileName: picked.fileName ?? picked.uri.split("/").pop() ?? "jam-video.mp4",
      mimeType: picked.mimeType ?? "video/mp4",
      fileSize: picked.fileSize ?? null,
    };
    logVideoUploadStep("picker asset selected", {
      source,
      fileName: nextAsset.fileName,
      fileSize: nextAsset.fileSize,
      mimeType: nextAsset.mimeType,
      uriScheme: nextAsset.uri.split(":")[0] || "unknown",
      duration: picked.duration ?? null,
      width: picked.width ?? null,
      height: picked.height ?? null,
    });
    await startVideoUpload(nextAsset, picked.duration ?? 0);
  }

  async function recordVideo() {
    if (!cameraRef.current || !cameraReady || recording) return;

    if (!cameraPermissionGranted || !microphonePermissionGranted) {
      Alert.alert("permission needed", "camera and microphone permissions are needed to record.");
      return;
    }

    setRecording(true);
    logVideoUploadStep("in-app camera recording start", { maxDuration });
    try {
      const recorded = await cameraRef.current.recordAsync({
        maxDuration,
      });
      if (!recorded?.uri) {
        logVideoUploadStep("in-app camera recording missing uri", {});
        return;
      }

      const nextAsset = {
        uri: recorded.uri,
        fileName: recorded.uri.split("/").pop() ?? "jam-video.mp4",
        mimeType: "video/mp4",
        fileSize: null,
      };
      logVideoUploadStep("in-app camera recording selected", {
        fileName: nextAsset.fileName,
        uriScheme: nextAsset.uri.split(":")[0] || "unknown",
      });
      await startVideoUpload(nextAsset, 0);
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

  function flipCameraFacing() {
    const nextFacing: CameraType = cameraFacingRef.current === "back" ? "front" : "back";
    cameraFacingRef.current = nextFacing;

    if (!recording) {
      setCameraReady(false);
      setCameraFacingKey(nextFacing);
    }

    resetCameraZoom();
    setCameraFacing(nextFacing);
  }

  function handleCameraTap() {
    const now = Date.now();
    const isDoubleTap = now - lastCameraTapRef.current < 280;
    lastCameraTapRef.current = now;

    if (!isDoubleTap || recordingCountdown !== null) return;
    flipCameraFacing();
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

  function startVideoUpload(nextAsset: NativeVideoAsset, durationMs = 0) {
    uploadSessionRef.current += 1;
    setAsset(nextAsset);
    setSelectedVideoDurationMs(durationMs);
    setTrimStartRatio(0);
    setTrimEndRatio(1);
    setActiveEditTool(null);
    setSelectedFilter("none");
    setTextOverlays([]);
    setEditingTextOverlayId(null);
    setTextOverlayActionId(null);
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
    setTextOverlayActionId(null);
    setTextOverlays((current) => [
      ...current.filter((overlay) => overlay.text.trim()),
      { id, text: "", centerRatio: { x: 0.5, y: 0.5 } },
    ]);
    editingTextDraftRef.current = "";
    setEditingTextOverlayId(id);
    setActiveEditTool("text");
    textInputRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => textInputRef.current?.focus(), 60);
  }

  function openTextOverlayActions(id: string) {
    if (textOverlayDragActiveRef.current) return;
    dismissEditTextKeyboard();
    setTextOverlayActionId(id);
  }

  function startEditingTextOverlay(id: string) {
    const overlay = textOverlaysRef.current.find((item) => item.id === id);
    editingTextDraftRef.current = overlay?.text ?? "";
    setTextOverlayActionId(null);
    setEditingTextOverlayId(id);
    setActiveEditTool("text");
    setTimeout(() => textInputRef.current?.focus(), 60);
  }

  function deleteTextOverlay(id: string) {
    setTextOverlays((current) => current.filter((overlay) => overlay.id !== id));
    setTextOverlayActionId(null);
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
    setTextOverlayActionId(null);
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
        setTextOverlayActionId(null);
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

  function goToDetailsStage() {
    dismissEditTextKeyboard();
    setTextOverlayActionId(null);
    setTextOverlays((current) => current.filter((overlay) => overlay.text.trim()));
    if (selectedVideoDurationMs > 0) {
      const trimStartMs = Math.round(trimStartRatio * selectedVideoDurationMs);
      const trimEndMs = Math.round(trimEndRatio * selectedVideoDurationMs);
      if (selectedThumbnailTimeMs < trimStartMs || selectedThumbnailTimeMs > trimEndMs) {
        setSelectedThumbnailTimeMs(trimStartMs);
      }
    }
    setCreateStage("details");
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
    const sourceDurationSeconds =
      selectedVideoDurationMs > 0 ? selectedVideoDurationMs / 1000 : maxDuration;
    const trimStartSeconds = Math.max(0, trimStartRatio * sourceDurationSeconds);
    const trimEndSeconds = Math.min(
      sourceDurationSeconds,
      Math.max(trimStartSeconds + 0.1, trimEndRatio * sourceDurationSeconds),
    );
    const trimmedSeconds = trimEndSeconds - trimStartSeconds;
    const postedTextOverlays = textOverlays
      .filter((overlay) => overlay.text.trim())
      .map((overlay) => ({
        id: overlay.id,
        text: overlay.text.trim(),
        centerRatio: overlay.centerRatio,
      }));
    logVideoUploadStep("post submission start", {
      hasAsset: Boolean(asset),
      captionLength: caption.trim().length,
      roleCount: postRoles.length,
      genreCount: postGenres.length,
      trimStartSeconds,
      trimEndSeconds,
      videoFilter: selectedFilter,
      textOverlayCount: postedTextOverlays.length,
    });
    if (!asset) {
      logVideoUploadStep("post submission blocked", { reason: "missing-asset" });
      Alert.alert("missing video", "record or select a video first.");
      return;
    }
    if (postRoles.length === 0 && postGenres.length === 0) {
      logVideoUploadStep("post submission blocked", { reason: "missing-tags" });
      Alert.alert("choose tags", "select at least one role or genre for this video.");
      return;
    }
    if (trimmedSeconds > maxDuration + 0.5) {
      logVideoUploadStep("post submission blocked", { reason: "trim-too-long", trimmedSeconds, maxDuration });
      Alert.alert("clip too long", `trim this video to ${maxDuration}s or less before posting.`);
      return;
    }

    let localThumbnailUri = selectedVideoThumbnailUri;
    if (!localThumbnailUri && asset.uri) {
      try {
        const thumbnail = await getThumbnailAsync(asset.uri, {
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
      asset,
      localThumbnailUri,
      caption: caption.trim(),
      roles: postRoles,
      genres: postGenres,
      thumbnailTimeMs: selectedThumbnailTimeMs,
      maxDurationSeconds: maxDuration,
      sourceDurationSeconds,
      trimStartSeconds,
      trimEndSeconds,
      videoFilter: selectedFilter,
      textOverlays: postedTextOverlays,
    };

    // Queue first so progress/profile tiles appear as soon as we leave create.
    enqueuePendingVideoUpload(uploadPayload);
    resetUploadState();
    logVideoUploadStep("post submission queued", {
      roleCount: postRoles.length,
      genreCount: postGenres.length,
      trimmed: trimStartSeconds > 0.05 || trimEndSeconds < sourceDurationSeconds - 0.05,
      videoFilter: selectedFilter,
      textOverlayCount: postedTextOverlays.length,
      hasThumbnail: Boolean(localThumbnailUri),
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
        <View style={[styles.createCameraViewport, { bottom: feedViewport.navBarHeight }]}>
          {cameraPermissionGranted === null || microphonePermissionGranted === null ? (
            <View style={styles.createCameraPermission}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.helper}>opening camera...</Text>
            </View>
          ) : cameraPermissionReady ? (
            <>
              <CameraView
                key={cameraFacingKey}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={cameraFacing}
                mode="video"
                mute={false}
                videoQuality="1080p"
                active={isFocused}
                animateShutter={false}
                zoom={cameraZoom}
                enableTorch={flashEnabled && cameraFacing === "back"}
                onCameraReady={() => setCameraReady(true)}
              />
              {selectedFilter !== "none" ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.createCameraFilterPreview, getCreateFilterOverlayStyle(selectedFilter)]}
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
                enabled={isFocused && recordingCountdown === null}
                onGestureEvent={handleCameraPinchGesture}
                onHandlerStateChange={handleCameraPinchStateChange}
              >
                <Animated.View style={styles.createCameraTapLayer} collapsable={false}>
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={handleCameraTap}
                    disabled={recordingCountdown !== null}
                    accessibilityLabel="double tap to flip camera"
                  />
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
          <Pressable
            onPress={() => void pickVideo("library")}
            style={styles.createLibraryButton}
            disabled={recording || recordingCountdown !== null}
            accessibilityLabel="choose video from camera roll"
          >
            {recentVideoThumbnailUri ? (
              <Image source={{ uri: recentVideoThumbnailUri }} style={styles.createLibraryThumbnail as ImageStyle} />
            ) : (
              <View style={styles.createLibraryPlaceholder}>
                <Text style={styles.createLibraryPlaceholderText}>▦</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              void handleRecordPress();
            }}
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
              centerOffset={(78 - 2 * 4 - 79) / 2}
            />
          </Pressable>
          <View style={styles.createCameraSpacer} />
        </View>
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
    const actionOverlay = textOverlayActionId
      ? textOverlays.find((overlay) => overlay.id === textOverlayActionId)
      : null;
    const actionOverlaySize = actionOverlay ? textOverlaySizes[actionOverlay.id] ?? { width: 0, height: 0 } : { width: 0, height: 0 };
    const actionOverlayLeft = actionOverlay
      ? editViewportSize.width * actionOverlay.centerRatio.x - actionOverlaySize.width / 2
      : 0;
    const actionOverlayTop = actionOverlay
      ? editViewportSize.height * actionOverlay.centerRatio.y - actionOverlaySize.height / 2
      : 0;

    return (
      <View style={styles.createCameraRoot}>
        <View style={styles.createCameraRoot}>
          <View
            style={[styles.createCameraViewport, { bottom: feedViewport.navBarHeight }]}
            onLayout={handleEditViewportLayout}
          >
            <JamVideoView
              source={asset.uri}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
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
                style={[StyleSheet.absoluteFill, styles.createCameraFilterPreview, getCreateFilterOverlayStyle(selectedFilter)]}
              />
            )}
            {editingTextOverlayId ? (
              <Pressable
                style={styles.createEditKeyboardDismissLayer}
                onPress={dismissEditTextKeyboard}
                accessibilityLabel="dismiss keyboard"
              />
            ) : null}
            {textOverlayActionId ? (
              <Pressable
                style={styles.createEditKeyboardDismissLayer}
                onPress={() => setTextOverlayActionId(null)}
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
                onSizeChange={(size) => updateTextOverlaySize(overlay.id, size)}
                onPanGesture={(event) => handleTextOverlayPanGesture(overlay.id, event)}
                onPanStateChange={(event) => handleTextOverlayPanStateChange(overlay.id, event)}
              />
            ))}
            {actionOverlay ? (
              <View
                pointerEvents="box-none"
                style={[
                  styles.createTextOverlayActionMenu,
                  {
                    left: clamp(
                      actionOverlayLeft + actionOverlaySize.width / 2 - 72,
                      12,
                      Math.max(12, editViewportSize.width - 156),
                    ),
                    top: clamp(
                      actionOverlayTop + actionOverlaySize.height + 10,
                      12,
                      Math.max(12, editViewportSize.height - 52),
                    ),
                  },
                ]}
              >
                <Pressable
                  style={styles.createTextOverlayActionButton}
                  onPress={() => startEditingTextOverlay(actionOverlay.id)}
                  accessibilityLabel="edit text overlay"
                >
                  <Text style={styles.createTextOverlayActionButtonText}>edit</Text>
                </Pressable>
                <View style={styles.createTextOverlayActionDivider} />
                <Pressable
                  style={styles.createTextOverlayActionButton}
                  onPress={() => deleteTextOverlay(actionOverlay.id)}
                  accessibilityLabel="delete text overlay"
                >
                  <Text style={styles.createTextOverlayActionDeleteText}>delete</Text>
                </Pressable>
              </View>
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

          <View pointerEvents="box-none" style={[styles.createEditNextBand, { height: feedViewport.navBarHeight }]}>
            {editingTextOverlayId ? (
              <Pressable
                style={styles.createEditKeyboardDismissBand}
                onPress={dismissEditTextKeyboard}
                accessibilityLabel="dismiss keyboard"
              />
            ) : null}
            <Pressable onPress={goToDetailsStage} style={styles.createEditNextPill} accessibilityLabel="continue to post details">
              <Text style={styles.createEditNextText}>next</Text>
            </Pressable>
          </View>

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

          {activeEditTool === "filters" ? (
            <View
              pointerEvents="box-none"
              style={[styles.createCameraFilterBand, { height: feedViewport.navBarHeight }]}
            >
              <CreateFilterPickerRow
                compact
                selectedFilter={selectedFilter}
                thumbnailUri={selectedVideoThumbnailUri}
                textOverlays={textOverlays}
                onSelect={setSelectedFilter}
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
        <Text style={styles.copy}>finish your post details.</Text>
        <Text style={styles.helper}>{maxDuration}s max for this account</Text>
        {asset && (
          <>
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
                onPress={() => setPostPreviewOpen(true)}
                style={styles.createDetailsVideoTap}
                accessibilityLabel="preview post"
              >
                {selectedVideoThumbnailUri ? (
                  <Image
                    source={{ uri: selectedVideoThumbnailUri }}
                    style={styles.createDetailsVideoTapImage as ImageStyle}
                  />
                ) : (
                  <View style={styles.createDetailsVideoTapFallback} />
                )}
                <VideoPresentationOverlays
                  filter={selectedFilter}
                  textOverlays={textOverlays}
                  density="thumb"
                />
                <View style={styles.createDetailsVideoTapBadge}>
                  <Text style={styles.createDetailsVideoTapBadgeText}>preview</Text>
                </View>
              </Pressable>
            </View>
            {loadingThumbnailFrames ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.createThumbnailLoader} />
            ) : thumbnailFrameOptions.length > 0 ? (
              <VideoThumbnailFilmstrip
                frames={thumbnailFrameOptions}
                filter={selectedFilter}
                textOverlays={textOverlays}
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
          label="post"
          disabled={!asset || (selectedRoles.length === 0 && selectedGenres.length === 0)}
          onPress={() => {
            void post();
          }}
        />
      </ScrollView>
      <CreatePostPreviewModal
        visible={postPreviewOpen}
        onClose={() => setPostPreviewOpen(false)}
        videoUri={asset?.uri ?? null}
        filter={selectedFilter}
        textOverlays={textOverlays.filter((overlay) => overlay.text.trim())}
        caption={caption}
        profile={profile}
        roles={selectedRoles}
        genres={selectedGenres}
        trimStartRatio={trimStartRatio}
        trimEndRatio={trimEndRatio}
      />
    </SafeAreaView>
  );
}

function InboxScreen({
  userId,
  refreshSignal,
  savedVideoController,
  onUnreadCountChanged,
}: {
  userId: string;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  onUnreadCountChanged: (count: number) => void;
}) {
  const [tab, setTab] = useState<InboxTab>("requests");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [jams, setJams] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [system, setSystem] = useState<InboxMessage[]>([]);
  const [removedInboxUserIds, setRemovedInboxUserIds] = useState<Set<string>>(() => new Set());
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [activeRequest, setActiveRequest] = useState<InboxRequest | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [preloadedProfile, setPreloadedProfile] = useState<PreloadedUserProfile | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const profilePreloadCacheRef = useRef(new Map<string, PreloadedUserProfile>());
  const profileNavigationRequestRef = useRef(0);
  const insets = useSafeAreaInsets();

  const matchesInboxFilters = useCallback(
    (role: string, location: string) => {
      const roleMatch =
        filterRoles.length === 0 ||
        filterRoles.some((selectedRole) => selectedRole.toLowerCase() === role.toLowerCase());
      const locationMatch = !filterLocation || locationFilterMatches(location, filterLocation);
      return roleMatch && locationMatch;
    },
    [filterLocation, filterRoles],
  );

  const filteredRequests = useMemo(
    () => requests.filter((request) => matchesInboxFilters(request.role, request.location)),
    [matchesInboxFilters, requests],
  );
  const filteredJams = useMemo(
    () => jams.filter((conversation) => matchesInboxFilters(conversation.role, conversation.location)),
    [jams, matchesInboxFilters],
  );
  const filteredSent = useMemo(
    () => sent.filter((conversation) => matchesInboxFilters(conversation.role, conversation.location)),
    [matchesInboxFilters, sent],
  );
  const filtersActive = filterRoles.length > 0 || Boolean(filterLocation);
  const jamTabItems = useMemo(() => {
    const conversationItems = filteredJams.map((conversation) => ({
      type: "conversation" as const,
      id: conversation.id,
      sortAt: conversation.lastActivityAt,
      conversation,
    }));
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

  useEffect(() => {
    const chatUserId =
      activeChat && !("sender_name" in activeChat)
        ? activeChat.userId
        : activeRequest?.userId ?? activeDm?.userId ?? null;
    setActiveInboxChatUserId(chatUserId);
    return () => {
      if (getActiveInboxChatUserId() === chatUserId) {
        setActiveInboxChatUserId(null);
      }
    };
  }, [activeChat, activeDm, activeRequest]);

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

      setActiveRequest(null);
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

  function openConversation(conversation: Conversation) {
    const removedUnreadCount = jams.some((item) => item.userId === conversation.userId)
      ? conversation.unreadCount
      : 0;
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
    onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - removedUnreadCount));
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
    const removedUnreadCount = message.read ? 0 : 1;
    const nextMessage = { ...message, read: true };
    setActiveChat(nextMessage);
    setSystem((current) =>
      current.map((item) => (item.id === message.id ? { ...item, read: true } : item)),
    );
    onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - removedUnreadCount));
    void markInboxMessageRead(message.id).catch(() => undefined);
  }

  return (
    <View style={styles.safeWithNav}>
      <ScrollView
        contentContainerStyle={getTabScreenContentStyle(insets.top)}
        refreshControl={
          <RefreshControl
            tintColor={getActivityIndicatorColor()}
            refreshing={refreshing}
            onRefresh={refreshInbox}
          />
        }
      >
        <TabLogoHeader
          right={
            <Pressable
              onPress={() => setFiltersOpen(true)}
              style={[styles.filterButton, filtersActive && styles.inboxFilterButtonActive]}
              accessibilityLabel="filter inbox"
              accessibilityRole="button"
              accessibilityState={{ selected: filtersActive }}
            >
              <FeedFilterIcon />
            </Pressable>
          }
        />
        <SegmentedTabs tabs={["requests", "jams", "sent"]} active={tab} onChange={(value) => setTab(value as InboxTab)} />
        {loading ? (
          <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
        ) : tab === "requests" ? (
          <View style={styles.list}>
            {filteredRequests.map((request) => (
              <Pressable key={request.id} style={styles.listCard} onPress={() => setActiveRequest(request)}>
                <Pressable onPress={() => openProfile(request.userId)} accessibilityLabel={`open ${request.creatorName}'s profile`}>
                  <Avatar uri={request.avatarUrl} size={52} />
                </Pressable>
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <Text style={styles.listTitle}>{request.creatorName}</Text>
                    {request.proBadge ? <ProBadge kind={request.proBadge} /> : null}
                    <Text numberOfLines={1} style={[styles.helper, styles.flex]}>
                      {request.role} - {request.location}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.copy}>{request.preview}</Text>
                </View>
                <Text style={styles.helper}>{request.sentAt}</Text>
              </Pressable>
            ))}
            {filteredRequests.length === 0 && (
              <EmptyCard text={filtersActive ? "no requests match these filters." : "no requests right now."} />
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
              <EmptyCard text={filtersActive ? "no jams match these filters." : "no jams yet. mutual jams will appear here."} />
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
              <EmptyCard text={filtersActive ? "no sent jams match these filters." : "no sent jams waiting right now."} />
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
      <RequestModal
        request={activeRequest}
        onClose={() => setActiveRequest(null)}
        onOpenProfile={(request) => openProfile(request.userId)}
        onMessage={(request) => {
          setActiveRequest(null);
          const conversation = conversationFromRequest(request);
          setActiveChat(conversation);
          setRequests((current) =>
            current.map((item) =>
              item.userId === request.userId ? { ...item, unreadCount: 0 } : item,
            ),
          );
          onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - request.unreadCount));
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
  onInboxChanged,
  onProfileChanged,
  onLoggedOut,
}: {
  userId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  onInboxChanged: () => void;
  onProfileChanged: (profile: Profile) => void;
  onLoggedOut: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
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
  const [loading, setLoading] = useState(true);
  const [postedToastVisible, setPostedToastVisible] = useState(false);
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
    () => (activeTab === "videos" ? [...pendingProfileVideos, ...videos] : saved),
    [activeTab, pendingProfileVideos, saved, videos],
  );

  const load = useCallback(async () => {
    const [nextProfile, ownVideos, savedVideos] = await Promise.all([
      fetchProfile(userId),
      fetchMyVideos(userId),
      fetchSavedVideos(userId),
      refreshSavedVideos(),
    ]);
    setProfile(nextProfile);
    if (nextProfile) onProfileChanged(nextProfile);
    setVideos(ownVideos);
    setSaved(savedVideos);
  }, [onProfileChanged, refreshSavedVideos, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
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
      const timer = setTimeout(() => {
        void load().finally(() => {
          if (active) setLoading(false);
        });
      }, 0);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [load]),
  );

  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    return subscribePendingUploadPosted((event) => {
      if (event.userId !== userId) return;

      setPostedToastVisible(true);
      void load();

      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setPostedToastVisible(false), 2400);
    });
  }, [load, userId]);

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);
    setActiveDm(profileFeedItem);
  }

  function changeProfileTab(nextTab: "videos" | "saved") {
    if (nextTab === activeTab) return;

    const direction = nextTab === "saved" ? 1 : -1;
    tabSlide.stopAnimation();
    tabSlide.setValue(direction * viewportWidth);
    setActiveTab(nextTab);
    Animated.timing(tabSlide, {
      toValue: 0,
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

  if (loading) return <LoadingScreen label="loading profile..." />;

  const postedVideoCount = Math.max(videos.length, profile?.video_count ?? 0);
  const proEntitlement = {
    earlyAdopter: profile?.early_adopter,
    videoCount: postedVideoCount,
    proSubscriptionActive: profile?.pro_subscription_active,
  };
  const proBadge = getProBadgeKind(proEntitlement);
  const showProProgress = Boolean(profile) && shouldShowProProgress(proEntitlement);

  const settingsButton = (
    <Pressable
      style={styles.headerIconButton}
      onPress={() => setSettingsOpen(true)}
      accessibilityLabel="settings"
    >
      <MenuIcon />
    </Pressable>
  );

  return (
    <View style={styles.safeWithNav}>
      <ProfileTopScrollFade
        topInset={insets.top}
        contentContainerStyle={getTabScreenContentStyle(insets.top)}
        onCollapseChange={setProfileHeaderCollapsed}
        collapsedHeader={
          profile
            ? {
                title: profile.display_name ?? "your profile",
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
        {profile ? (
          <>
            <View style={styles.profileCentered}>
              <Avatar uri={profile.avatar_url} size={78} />
              <ProfileNameAnchor>
                <View style={styles.centerRow}>
                  <Text style={styles.h2}>{profile.display_name ?? "your profile"}</Text>
                  {proBadge ? <ProBadge kind={proBadge} /> : null}
                </View>
              </ProfileNameAnchor>
              <Text style={styles.subtitle}>{profile.creator_types?.join(", ") || "creator"}</Text>
              {formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city) && (
                <Text style={styles.subtitle}>{formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city)}</Text>
              )}
              <Text style={styles.profileBio}>{profile.bio || "no bio yet."}</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(true)}>
              <Text style={styles.secondaryButtonText}>edit profile</Text>
            </Pressable>
          </>
        ) : (
          <EmptyCard text="no profile found." />
        )}
        <View style={styles.profileVideoDivider} />
        <SegmentedTabs tabs={["videos", "saved"]} active={activeTab} onChange={(value) => changeProfileTab(value as "videos" | "saved")} />
        <Animated.View style={[styles.profileTabSlider, { transform: [{ translateX: tabSlide }] }]}>
          <VideoGrid
            videos={displayVideos}
            privateCopy={activeTab === "saved"}
            showPendingUploadState={activeTab === "videos"}
            onRetryPendingUpload={retryPendingVideoUpload}
            onVideoPress={(video, index) => {
              if (activeTab === "saved") {
                setFullscreenIndex(index);
                return;
              }
              if (isPendingProfileVideoId(video.id)) return;
              const realIndex = videos.findIndex((entry) => entry.id === video.id);
              if (realIndex >= 0) setOwnFullscreenIndex(realIndex);
            }}
          />
        </Animated.View>
      </ProfileTopScrollFade>
      {postedToastVisible ? (
        <View pointerEvents="none" style={[styles.profilePostedToast, { top: insets.top + 56 }]}>
          <Text style={styles.profilePostedToastText}>Posted!</Text>
        </View>
      ) : null}
      {profile && (
        <ProfileVideoFullscreenModal
          visible={ownFullscreenIndex !== null}
          videos={videos}
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
        profile={profile}
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
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [termsAndPoliciesOpen, setTermsAndPoliciesOpen] = useState(false);
  const [savingNearMeRadius, setSavingNearMeRadius] = useState(false);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [savingShareLiveLocation, setSavingShareLiveLocation] = useState(false);
  const selectedNearMeRadius = normalizeNearMeRadius(profile?.near_me_radius_miles);
  const [translateX] = useState(() => new Animated.Value(drawerWidth));
  const closingRef = useRef(false);
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

  useEffect(() => {
    if (!visible) return;

    const frame = requestAnimationFrame(() => {
      closingRef.current = false;
      setMounted(true);
      translateX.setValue(drawerWidth);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => cancelAnimationFrame(frame);
  }, [drawerWidth, translateX, visible]);

  useEffect(() => {
    if (!visible || !profile) return;

    void isLiveLocationSharingEnabled(profile.id).then(setShareLiveLocation);
  }, [profile?.id, visible]);

  function animateClosed(afterClose?: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateX, {
      toValue: drawerWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setMounted(false);
      closingRef.current = false;
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

    setSavingShareLiveLocation(true);
    try {
      if (enabled) {
        const result = await enableLiveLocationSharing(profile.id);
        if ("error" in result) {
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          setShareLiveLocation(false);
          return;
        }

        onProfileUpdated(result.profile);
        setShareLiveLocation(true);
        return;
      }

      const updatedProfile = await disableLiveLocationSharing(profile.id);
      onProfileUpdated(updatedProfile);
      setShareLiveLocation(false);
    } catch (err) {
      Alert.alert(
        "could not update live location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
      const current = profile ? await isLiveLocationSharingEnabled(profile.id) : false;
      setShareLiveLocation(current);
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
                onPress={() => {
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
                accessibilityRole="button"
                accessibilityLabel="log out"
              >
                <Text style={styles.logoutText}>log out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </PanGestureHandler>
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
                        { maxHeight: LOCATION_PICKER_MAX_VISIBLE_ROWS * LOCATION_PICKER_ROW_HEIGHT },
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
            <Pressable onPress={onClose} style={styles.iconCircle}>
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

function RequestModal({
  request,
  onClose,
  onOpenProfile,
  onMessage,
}: {
  request: InboxRequest | null;
  onClose: () => void;
  onOpenProfile: (request: InboxRequest) => void;
  onMessage: (request: InboxRequest) => void;
}) {
  if (!request) return null;
  return (
    <Modal animationType="none" transparent visible={Boolean(request)} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={request.id} onBack={onClose} style={styles.flex}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.screenContent}>
            <Pressable onPress={onClose} style={styles.iconCircle}>
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            <View style={styles.profileCentered}>
            <Pressable onPress={() => onOpenProfile(request)} accessibilityLabel={`open ${request.creatorName}'s profile`}>
              <Avatar uri={request.avatarUrl} size={78} />
            </Pressable>
              <View style={styles.centerRow}>
                <Text style={styles.h2}>{request.creatorName}</Text>
                {request.proBadge ? <ProBadge kind={request.proBadge} /> : null}
              </View>
              <Text style={styles.subtitle}>{request.role} - {request.location}</Text>
              <Text style={styles.copyCentered}>{request.preview}</Text>
            </View>
            <PrimaryButton label="reply to jam" onPress={() => onMessage(request)} />
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
}: BottomTabBarProps & {
  userId: string;
  currentUserProfile: Profile | null;
  unreadInboxCount: number;
  onShuffleDiscover: () => void;
  feedReady?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name as Tab;
  const navBarHeight = getNavBarHeight(insets.bottom);
  const navStyles = activeRoute === "discover" ? darkStyles : styles;
  const postingStatus = usePendingUploadFeedProgress(userId);

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
      LayoutAnimation.configureNext(TAB_SWITCH_ANIMATION);
      navigation.navigate(route.name);
    }
  }

  // Height 0 so React Navigation doesn't reserve a second bottom inset — screens already
  // pad with safeWithNav. Nav + progress line overlay absolutely on top.
  return (
    <View pointerEvents="box-none" style={styles.uploadProgressNavWrap}>
      {postingStatus && activeRoute === "discover" ? (
        <View
          pointerEvents="none"
          style={[styles.uploadProgressLine, { bottom: navBarHeight }]}
          accessibilityLabel={
            postingStatus.phase === "uploading"
              ? "Uploading video"
              : postingStatus.phase === "processing"
                ? "Processing video"
                : "Finishing post"
          }
        >
          <View style={[styles.uploadProgressLineFill, { width: `${postingStatus.progress}%` }]} />
        </View>
      ) : null}
      <View style={[navStyles.nav, { height: navBarHeight, paddingBottom: Math.max(insets.bottom, 12) }]}>
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
      </View>
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
          <Text style={styleSet.mailBadgeText}>{badgeText}</Text>
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

const JAM_JAR_FILL_EMPTY_HEIGHT = 11.5;
const JAM_JAR_FILL_FULL_HEIGHT = 21;
const JAM_JAR_LID_EMPTY_HEIGHT = 7;
const JAM_JAR_LID_FULL_HEIGHT = 4;
const JAM_JAR_LID_EMPTY_GAP = -1;
const JAM_JAR_LID_FULL_GAP = 2;
const JAM_JAR_JAM_COLOR = "#d63438";
const UNJAM_POPOVER_WIDTH = 200;
const jamTint = { backgroundColor: JAM_JAR_JAM_COLOR } as const;
const jamBorder = { borderColor: JAM_JAR_JAM_COLOR } as const;
// Subtle drop shadow so overlay icons stay visible on bright videos (iOS shadows follow the icon's alpha).
const overlayIconShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.45,
  shadowRadius: 3.5,
  shadowOffset: { width: 0, height: 1 },
} as const;
// TikTok-style text shadow for any text sitting on top of video.
const overlayTextShadow = {
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
} as const;

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

const BOOKMARK_CREAM = "#f6e7c1";

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
        <Circle cx={12} cy={10.5} r={2.35} stroke={stroke} strokeWidth={2} />
      </Svg>
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
  const strokeWidth = active ? 2.2 : 1.75;
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

function CreateCameraFlashIcon({ enabled }: { enabled: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        stroke="#fff"
        strokeWidth={enabled ? 2.2 : 1.8}
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
      <Circle cx="12" cy="13" r="8" stroke="#fff" strokeWidth={1.8} />
      <Path d="M12 9.5v4.2l2.4 1.8" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 3.5h6" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function FeedFilterIcon() {
  return (
    <Svg width={26} height={34} viewBox="0 0 24 32" fill="none">
      <Path d="M4 8h16" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M7 16h10" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M4 24h16" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function MenuIcon() {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16" fill="none">
      <Path d="M1 1h20" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 8h20" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 15h20" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
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
  const scallops = Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    const radius = 5.7;
    return {
      left: 6.6 + Math.cos(angle) * radius,
      top: 6.6 + Math.sin(angle) * radius,
    };
  });
  const colors =
    tone === "blue"
      ? (["#0b3a7a", "#2f7de1", "#9fd0ff", "#2a6fd0", "#0a2f66"] as const)
      : (["#8b5b10", "#d7a435", "#fff36f", "#c98d21", "#7b4e0b"] as const);
  const scallopColor = tone === "blue" ? "#2f7de1" : "#d7a435";

  return (
    <View style={styles.goldBadge}>
      {scallops.map((scallop, index) => (
        <View
          key={index}
          style={[styles.goldBadgeScallop, scallop, { backgroundColor: scallopColor }]}
        />
      ))}
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

function ProfileTopScrollFade({
  topInset,
  contentContainerStyle,
  children,
  collapsedHeader,
  onCollapseChange,
  onScroll,
  ...scrollProps
}: {
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
}) {
  const contentRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const showCollapsedRef = useRef(false);
  const [nameEndY, setNameEndY] = useState(0);
  const [showCollapsed, setShowCollapsed] = useState(false);
  const collapsedAnim = useRef(new Animated.Value(0)).current;

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
          colors={[dark, "rgba(10, 10, 10, 0)"]}
          locations={[0, 1]}
          style={[styles.profileScrollTopFade, { height: topInset + PROFILE_TOP_FADE_EXTRA }]}
        />
      </View>
    </ProfileScrollCollapseContext.Provider>
  );
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
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onReset: () => void;
}) {
  return (
    <View style={styles.filterQueryRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
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

function ProfileGridThumbnail({ video }: { video: ProfileVideo | FeedVideo }) {
  const streamId = getVideoStreamId(video);
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
  const uri = candidates[candidateIndex] ?? null;
  const caption = getVideoCaption(video);

  useEffect(() => {
    setCandidateIndex(0);
  }, [video.id, streamId, thumbnailTimeMs, mediaUri]);

  if (!uri) {
    return <Text style={styles.gridCaption}>{caption}</Text>;
  }

  const presentation = getVideoPresentation(video);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        alt={caption}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => {
          setCandidateIndex((current) => (current + 1 < candidates.length ? current + 1 : current));
        }}
      />
      <VideoPresentationOverlays
        filter={presentation.filter}
        textOverlays={presentation.textOverlays}
        density="thumb"
      />
    </View>
  );
}

function VideoGrid({
  videos,
  locked,
  privateCopy,
  showPendingUploadState = false,
  onRetryPendingUpload,
  onVideoPress,
}: {
  videos: Array<ProfileVideo | FeedVideo>;
  locked?: boolean;
  privateCopy?: boolean;
  showPendingUploadState?: boolean;
  onRetryPendingUpload?: (uploadId: string) => void;
  onVideoPress?: (video: ProfileVideo | FeedVideo, index: number) => void;
}) {
  usePendingVideoUploads();

  if (videos.length === 0) return <EmptyCard text="no videos yet" />;
  return (
    <View>
      <View style={styles.grid}>
        {videos.map((video, index) => {
          const isLocked = locked && index >= 3;
          const pendingUpload =
            showPendingUploadState && isPendingProfileVideoId(video.id)
              ? getPendingUploadById(getPendingUploadIdFromProfileVideoId(video.id))
              : null;
          const isPendingFailed = pendingUpload?.phase === "failed";
          const content = (
            <>
              <ProfileGridThumbnail video={video} />
              {pendingUpload && !isPendingFailed ? (
                <View style={styles.gridPendingOverlay}>
                  <UploadProgressRing progress={pendingUpload.progress} />
                  <Text style={styles.gridPendingStatusText}>
                    {pendingUpload.phase === "processing"
                      ? "processing"
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
              {isLocked && (
                <View style={styles.lockedOverlay}>
                  <Text style={styles.lockedText}>jam to unlock full profile</Text>
                </View>
              )}
            </>
          );

          // Pending uploads stay visible with a ring, but aren't openable until Stream is ready.
          if (onVideoPress && !isLocked && !isPendingFailed && !pendingUpload) {
            return (
              <Pressable
                key={video.id}
                style={styles.gridItem}
                onPress={() => onVideoPress(video, index)}
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
      {privateCopy && <Text style={styles.helper}>only visible to you.</Text>}
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

function getUniqueStrings(items: readonly string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeLocationText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getCountrySearchText(option: LocationCountryOption) {
  return [option.country, ...(option.aliases ?? []), ...option.cities].join(" ").toLowerCase();
}

function getCountryMatchTerms(option: LocationCountryOption) {
  return [option.country, ...(option.aliases ?? [])].map(normalizeLocationText);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function locationContainsTerm(location: string, term: string) {
  if (!term) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i").test(location);
}

function parseLocationFilter(value: string): LocationFilterSelection[] {
  if (!value) return [];

  if (!value.startsWith(LOCATION_FILTER_PREFIX)) {
    const normalizedValue = normalizeLocationText(value);
    const legacyMatch = LOCATION_FILTER_COUNTRIES.find(
      (option) =>
        getCountryMatchTerms(option).some((term) => locationContainsTerm(normalizedValue, term)) ||
        option.cities.some((city) => locationContainsTerm(normalizedValue, normalizeLocationText(city))),
    );

    if (!legacyMatch) return [];

    const legacyCities = legacyMatch.cities.filter((city) =>
      locationContainsTerm(normalizedValue, normalizeLocationText(city)),
    );
    return [{ country: legacyMatch.country, cities: legacyCities }];
  }

  try {
    const parsed = JSON.parse(value.slice(LOCATION_FILTER_PREFIX.length));
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): LocationFilterSelection[] => {
      if (!entry || typeof entry.country !== "string") return [];
      const country = LOCATION_FILTER_COUNTRIES.find((option) => option.country === entry.country);
      if (!country) return [];
      const validCities = Array.isArray(entry.cities)
        ? entry.cities.filter((city: unknown): city is string => typeof city === "string" && country.cities.includes(city))
        : [];
      return [{ country: country.country, cities: getUniqueStrings(validCities) }];
    });
  } catch {
    return [];
  }
}

function encodeLocationFilter(selections: readonly LocationFilterSelection[]) {
  const cleanSelections = selections
    .map((selection) => {
      const country = LOCATION_FILTER_COUNTRIES.find((option) => option.country === selection.country);
      if (!country) return null;
      const cities = getUniqueStrings(selection.cities).filter((city) => country.cities.includes(city));
      return { country: country.country, cities };
    })
    .filter((selection): selection is LocationFilterSelection => Boolean(selection));

  return cleanSelections.length ? `${LOCATION_FILTER_PREFIX}${JSON.stringify(cleanSelections)}` : "";
}

function locationFilterMatches(itemLocation: string, filterValue: string) {
  if (!filterValue) return true;

  const normalizedItemLocation = normalizeLocationText(itemLocation);
  const selections = parseLocationFilter(filterValue);

  if (selections.length === 0) {
    const normalizedFilter = normalizeLocationText(filterValue);
    return normalizedItemLocation.includes(normalizedFilter) || normalizedFilter.includes(normalizedItemLocation);
  }

  return selections.some((selection) => {
    const option = LOCATION_FILTER_COUNTRIES.find((country) => country.country === selection.country);
    if (!option) return false;

    if (selection.cities.length === 0) {
      return getCountryMatchTerms(option).some((term) => locationContainsTerm(normalizedItemLocation, term));
    }

    return selection.cities.some((city) => locationContainsTerm(normalizedItemLocation, normalizeLocationText(city)));
  });
}

type FeedFilterState = {
  roles: string[];
  genres: string[];
  location: string;
  nearMeActive: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  nearMeRadiusMiles: NearMeRadiusMiles;
};

function feedVideoMatchesFilters(item: FeedVideo, filters: FeedFilterState) {
  const itemRoles = item.roles.length
    ? item.roles.map((role) => role.toLowerCase())
    : item.categories.length
      ? item.categories.map((category) => category.toLowerCase())
      : [item.role.toLowerCase()];
  const itemGenres = item.genres.map((genre) => genre.toLowerCase());
  const roleMatch =
    filters.roles.length === 0 ||
    filters.roles.some((role) => itemRoles.includes(role.toLowerCase()));
  const genreMatch =
    filters.genres.length === 0 ||
    filters.genres.some((genre) => itemGenres.includes(genre.toLowerCase()));
  const locationMatch = !filters.location || locationFilterMatches(item.location, filters.location);
  const nearMeMatch =
    !filters.nearMeActive ||
    (filters.userLocation != null &&
      isCreatorWithinNearMeRadius(
        filters.userLocation.latitude,
        filters.userLocation.longitude,
        item.latitude,
        item.longitude,
        item.liveLatitude,
        item.liveLongitude,
        filters.nearMeRadiusMiles,
      ));
  return roleMatch && genreMatch && locationMatch && nearMeMatch;
}

function isFeedFilterStateActive(filters: FeedFilterState) {
  return (
    filters.roles.length > 0 ||
    filters.genres.length > 0 ||
    Boolean(filters.location) ||
    filters.nearMeActive
  );
}

function getProfileLocationParts(profile?: Pick<Profile, "country" | "city" | "location"> | null) {
  const country = profile?.country?.trim() ?? "";
  const city = profile?.city?.trim() ?? "";
  if (country) return { country, city };

  const legacySelection = parseLocationFilter(profile?.location ?? "").at(0);
  return {
    country: legacySelection?.country ?? "",
    city: legacySelection?.cities.at(0) ?? "",
  };
}

function formatProfileLocation(country: string, city: string) {
  const nextCountry = country.trim();
  const nextCity = city.trim();
  if (nextCountry && nextCity) return `${nextCity}, ${nextCountry}`;
  return nextCountry || null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatClipDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

function getCreateFilterOverlayStyle(filter: VideoFilter): ViewStyle {
  return getVideoFilterOverlayStyle(filter);
}

function getVideoPresentation(video: ProfileVideo | FeedVideo) {
  if ("videoFilter" in video || "textOverlays" in video) {
    return {
      filter: normalizeVideoFilter(
        "videoFilter" in video ? video.videoFilter : "video_filter" in video ? video.video_filter : "none",
      ),
      textOverlays: normalizeVideoTextOverlays(
        "textOverlays" in video ? video.textOverlays : "text_overlays" in video ? video.text_overlays : [],
      ),
    };
  }

  return {
    filter: normalizeVideoFilter("video_filter" in video ? video.video_filter : "none"),
    textOverlays: normalizeVideoTextOverlays("text_overlays" in video ? video.text_overlays : []),
  };
}

function CreateFilterThumbImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={styles.createFilterThumbImage as ImageStyle}
      resizeMode="cover"
      {...(Platform.OS === "android" ? { resizeMethod: "resize" as const } : {})}
    />
  );
}

function CreateFilterPickerRow({
  selectedFilter,
  onSelect,
  thumbnailUri,
  textOverlays = [],
  compact = false,
}: {
  selectedFilter: VideoFilter;
  onSelect: (filter: VideoFilter) => void;
  thumbnailUri?: string | null;
  textOverlays?: CreateTextOverlayItem[];
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.createFilterList, compact && styles.createFilterListCompact]}
    >
      {CREATE_FILTER_OPTIONS.map((filter) => (
        <Pressable
          key={filter.id}
          style={[styles.createFilterOption, compact && styles.createFilterOptionCompact]}
          onPress={() => onSelect(filter.id)}
        >
          <View
            style={[
              styles.createFilterThumbRing,
              compact && styles.createFilterThumbRingCompact,
              selectedFilter === filter.id && styles.createFilterThumbRingActive,
            ]}
          >
            <View style={[styles.createFilterThumbInner, compact && styles.createFilterThumbInnerCompact]}>
              {thumbnailUri ? (
                <CreateFilterThumbImage uri={thumbnailUri} />
              ) : (
                <View style={styles.createFilterThumbFallback} />
              )}
              <VideoPresentationOverlays
                filter={filter.id}
                textOverlays={textOverlays}
                density="micro"
              />
            </View>
          </View>
          {!compact ? <Text style={styles.createFilterLabel}>{filter.label}</Text> : null}
        </Pressable>
      ))}
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

function shuffleVideosWithSpacing(videos: FeedVideo[]) {
  const pool = [...videos];
  const result: FeedVideo[] = [];

  while (pool.length) {
    const recentCreators = result.slice(-10).map((item) => item.userId);
    const candidates = pool.filter((item) => !recentCreators.includes(item.userId));
    const source = candidates.length ? candidates : pool;
    const pick = source[Math.floor(Math.random() * source.length)];
    result.push(pick);
    pool.splice(pool.findIndex((item) => item.id === pick.id), 1);
  }

  return result;
}

function getVideoSource(item: FeedVideo) {
  if (item.cloudflareStreamId) return getCloudflarePlaybackUrl(item.cloudflareStreamId);
  return item.mediaUrl;
}

/** First-frame poster for feed transitions — not the creator-picked grid thumbnail. */
function getFeedPosterSource(item: FeedVideo) {
  const streamId = item.cloudflareStreamId || extractCloudflareStreamId(item.mediaUrl);
  if (!streamId) return null;
  return getCloudflareThumbnailUrl(streamId, 1000, { height: 1280 });
}

function getCloudflareFreezeFrameUri(source: string, timeSec: number) {
  const streamId = extractCloudflareStreamId(source);
  if (!streamId) return null;
  const clampedTimeMs = Math.max(100, (Number.isFinite(timeSec) ? timeSec : 0) * 1000);
  return getCloudflareThumbnailUrl(streamId, clampedTimeMs, { height: 1280 });
}

function getExpoVideoSource(source: string | null): VideoSource {
  if (!source) return null;
  return {
    uri: source,
    contentType: source.includes(".m3u8") ? "hls" : "auto",
  };
}

function getGridVideoSource(video: ProfileVideo | FeedVideo) {
  if ("cloudflareStreamId" in video && video.cloudflareStreamId) {
    return getCloudflarePlaybackUrl(video.cloudflareStreamId);
  }
  if ("cloudflare_stream_id" in video && video.cloudflare_stream_id) {
    return getCloudflarePlaybackUrl(video.cloudflare_stream_id);
  }
  if ("mediaUrl" in video && video.mediaUrl) return video.mediaUrl;
  if ("media_url" in video && video.media_url) return video.media_url;
  return null;
}

function getVideoStreamId(video: {
  cloudflareStreamId?: string | null;
  cloudflare_stream_id?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
}) {
  return (
    video.cloudflareStreamId ||
    video.cloudflare_stream_id ||
    extractCloudflareStreamId(video.mediaUrl) ||
    extractCloudflareStreamId(video.media_url) ||
    null
  );
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

function profileToFeedVideo(
  profile: Profile,
  video: ProfileVideo | undefined,
  savedByMe: boolean,
  jammedByMe: boolean,
  jammedMe: boolean,
  postedVideoCount = 0,
): FeedVideo {
  const displayName = profile.display_name?.trim() || "creator";
  const role = profile.creator_types?.[0] ?? "creator";
  const tags = getProfileVideoTags(video);
  const videoCount = Math.max(postedVideoCount, profile.video_count ?? 0);
  const proBadge = getProBadgeKind({
    earlyAdopter: profile.early_adopter,
    videoCount,
    proSubscriptionActive: profile.pro_subscription_active,
  });
  return {
    id: video?.id ?? `${profile.id}-profile`,
    userId: profile.id,
    creatorName: displayName,
    role,
    location: formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city) ?? "unknown",
    latitude: profile.latitude,
    longitude: profile.longitude,
    liveLatitude: profile.live_latitude,
    liveLongitude: profile.live_longitude,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    caption: video?.caption ?? "",
    hashtags: video?.hashtags ?? [],
    categories: tags.categories,
    roles: tags.roles,
    genres: tags.genres,
    mediaUrl: video?.mediaUrl ?? video?.media_url ?? null,
    cloudflareStreamId: video?.cloudflareStreamId ?? video?.cloudflare_stream_id ?? null,
    thumbnailTimeMs: video?.thumbnailTimeMs ?? video?.thumbnail_time_ms ?? null,
    videoFilter: normalizeVideoFilter(video?.videoFilter ?? video?.video_filter),
    textOverlays: normalizeVideoTextOverlays(video?.textOverlays ?? video?.text_overlays),
    earlyAdopter: Boolean(profile.early_adopter),
    proBadge,
    videoCount,
    createdAt: video?.created_at ?? new Date().toISOString(),
    savedByMe,
    mutual: jammedByMe && jammedMe,
    jammedByMe,
    jammedMe,
  };
}

function getUnreadInboxCount(inbox: InboxData) {
  return getUnreadLocalInboxCount(
    inbox.requests,
    inbox.conversations,
    inbox.sent,
    inbox.systemMessages,
  );
}

function getUnreadLocalInboxCount(
  requests: InboxRequest[],
  conversations: Conversation[],
  _sent: Conversation[],
  systemMessages: InboxMessage[],
) {
  return (
    requests.reduce((total, request) => total + request.unreadCount, 0) +
    conversations.reduce((total, conversation) => total + conversation.unreadCount, 0) +
    systemMessages.filter((message) => !message.read).length
  );
}

function feedItemToPreloadedProfile(item: FeedVideo, feedItems: FeedVideo[]): PreloadedUserProfile {
  const videos = feedItems
    .filter((video) => video.userId === item.userId)
    .map((video): ProfileVideo => ({
      id: video.id,
      userId: video.userId,
      caption: video.caption,
      hashtags: video.hashtags,
      categories: video.categories,
      roles: video.roles,
      genres: video.genres,
      mediaUrl: video.mediaUrl,
      cloudflareStreamId: video.cloudflareStreamId,
      thumbnailTimeMs: video.thumbnailTimeMs,
      videoFilter: video.videoFilter,
      textOverlays: video.textOverlays,
      created_at: video.createdAt,
      creatorName: video.creatorName,
      role: video.role,
      location: video.location,
      avatarUrl: video.avatarUrl,
      earlyAdopter: video.earlyAdopter,
      proBadge: video.proBadge,
      savedByMe: video.savedByMe,
      mutual: video.mutual,
      jammedByMe: video.jammedByMe,
      jammedMe: video.jammedMe,
    }));

  return {
    userId: item.userId,
    profile: {
      id: item.userId,
      display_name: item.creatorName,
      bio: item.bio,
      creator_types: [item.role],
      location: item.location,
      country: null,
      city: null,
      latitude: item.latitude,
      longitude: item.longitude,
      live_latitude: item.liveLatitude,
      live_longitude: item.liveLongitude,
      near_me_radius_miles: null,
      avatar_url: item.avatarUrl,
      onboarding_complete: true,
      welcome_seen: true,
      early_adopter: item.earlyAdopter,
      video_count: item.videoCount,
      pro_subscription_active: item.proBadge === "blue",
    },
    videos,
    jammedByMe: item.jammedByMe || item.mutual,
    jammedMe: item.jammedMe || item.mutual,
  };
}

function profileVideoToFeedVideo(video: ProfileVideo | FeedVideo): FeedVideo | null {
  if ("userId" in video && video.userId) {
    const mediaUrl = "mediaUrl" in video && video.mediaUrl
      ? video.mediaUrl
      : "media_url" in video
        ? video.media_url ?? null
        : null;
    const cloudflareStreamId = "cloudflareStreamId" in video && video.cloudflareStreamId
      ? video.cloudflareStreamId
      : "cloudflare_stream_id" in video
        ? video.cloudflare_stream_id ?? null
        : null;
    const createdAt = "createdAt" in video
      ? video.createdAt
      : "created_at" in video
        ? video.created_at ?? new Date().toISOString()
        : new Date().toISOString();
    const tags = getProfileVideoTags(video);
    const presentation = getVideoPresentation(video);

    return {
      id: video.id,
      userId: video.userId,
      creatorName: video.creatorName ?? "creator",
      role: video.role ?? "creator",
      location: video.location ?? "unknown",
      latitude: "latitude" in video ? video.latitude ?? null : null,
      longitude: "longitude" in video ? video.longitude ?? null : null,
      liveLatitude: "liveLatitude" in video ? video.liveLatitude ?? null : null,
      liveLongitude: "liveLongitude" in video ? video.liveLongitude ?? null : null,
      avatarUrl: video.avatarUrl ?? null,
      bio: null,
      caption: video.caption ?? "",
      hashtags: video.hashtags ?? [],
      categories: tags.categories,
      roles: tags.roles,
      genres: tags.genres,
      mediaUrl,
      cloudflareStreamId,
      thumbnailTimeMs: "thumbnailTimeMs" in video
        ? video.thumbnailTimeMs ?? null
        : "thumbnail_time_ms" in video
          ? video.thumbnail_time_ms ?? null
          : null,
      videoFilter: presentation.filter,
      textOverlays: presentation.textOverlays,
      earlyAdopter: Boolean(video.earlyAdopter),
      proBadge: "proBadge" in video ? video.proBadge ?? null : null,
      videoCount: "videoCount" in video && typeof video.videoCount === "number" ? video.videoCount : 0,
      createdAt,
      savedByMe: video.savedByMe ?? true,
      mutual: video.mutual ?? false,
      jammedByMe: video.jammedByMe ?? false,
      jammedMe: video.jammedMe ?? false,
    };
  }

  return null;
}

function getProfileVideoOwner(video: ProfileVideo | FeedVideo) {
  const feedItem = profileVideoToFeedVideo(video);
  return {
    creatorName: feedItem?.creatorName ?? "creator",
    role: feedItem?.role ?? "creator",
    location: feedItem?.location ?? "unknown",
    avatarUrl: feedItem?.avatarUrl ?? null,
    earlyAdopter: Boolean(feedItem?.earlyAdopter),
    proBadge: feedItem?.proBadge ?? null,
  };
}

function sortProfileVideosByNewest<T extends ProfileVideo | FeedVideo>(videos: T[]) {
  return [...videos].sort((a, b) => getProfileVideoCreatedAtMs(b) - getProfileVideoCreatedAtMs(a));
}

function getProfileVideoCreatedAtMs(video: ProfileVideo | FeedVideo) {
  const createdAt = "createdAt" in video
    ? video.createdAt
    : "created_at" in video
      ? video.created_at
      : null;
  return createdAt ? Date.parse(createdAt) || 0 : 0;
}

function getProfileVideoTags(video: ProfileVideo | FeedVideo | undefined) {
  const categories = getUniqueVideoTags(video?.categories?.length ? video.categories : video?.hashtags ?? []);
  const roleSource = getUniqueVideoTags(video?.roles?.length ? video.roles : categories);
  const genreSource = getUniqueVideoTags(video?.genres?.length ? video.genres : categories);
  const roles = roleSource.filter((tag) => creatorRoleTagSet.has(normalizeVideoTag(tag)));
  const genres = genreSource.filter((tag) => musicGenreTagSet.has(normalizeVideoTag(tag)));

  return {
    categories,
    roles: getUniqueVideoTags(roles),
    genres,
  };
}

function getProfileFullscreenTags(video: ProfileVideo | FeedVideo | undefined) {
  const tags = getProfileVideoTags(video);
  const roleGenreTags = [...tags.roles, ...tags.genres];
  return roleGenreTags.length ? getUniqueVideoTags(roleGenreTags) : tags.categories;
}

function normalizeVideoTag(tag: string) {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
}

function getUniqueVideoTags(tags: readonly string[]) {
  const seen = new Set<string>();
  const uniqueTags: string[] = [];

  for (const tag of tags) {
    const normalizedTag = normalizeVideoTag(tag);
    if (!normalizedTag || seen.has(normalizedTag)) continue;
    seen.add(normalizedTag);
    uniqueTags.push(tag);
  }

  return uniqueTags;
}

function hasSentJam(video: ProfileVideo | FeedVideo) {
  return Boolean(video.mutual || video.jammedByMe);
}

function isPendingSentJam(video: ProfileVideo | FeedVideo) {
  return Boolean(video.jammedByMe && !video.mutual);
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
  const previousVideosPromise = new Promise<ProfileVideo[]>((resolve) => {
    setVideos((current) => {
      resolve(current);
      return current.filter((video) => video.id !== videoId);
    });
  });

  setFullscreenIndex(null);

  try {
    await deleteVideo(videoId);
  } catch (err) {
    const previousVideos = await previousVideosPromise;
    setVideos(() => previousVideos);
    Alert.alert("could not delete", err instanceof Error ? err.message : "try again");
  }
}

function conversationFromRequest(request: InboxRequest): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: request.userId,
    userId: request.userId,
    creatorName: request.creatorName,
    avatarUrl: request.avatarUrl,
    role: request.role,
    location: request.location,
    lastMessage: "reply to start jamming.",
    timestamp: "now",
    lastActivityAt: createdAt,
    unread: false,
    unreadCount: 0,
    earlyAdopter: request.earlyAdopter,
    proBadge: request.proBadge,
    unlocked: false,
    messages: [
      {
        id: request.id,
        body: request.preview,
        incoming: true,
        createdAt,
        video: request.video ?? null,
      },
    ],
  };
}

function conversationFromFeedItem(item: FeedVideo, unlocked: boolean): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: item.userId,
    userId: item.userId,
    creatorName: item.creatorName,
    avatarUrl: item.avatarUrl,
    role: item.role,
    location: item.location,
    lastMessage: unlocked ? "you are jamming. chat is open." : "jam sent. waiting for a reply.",
    timestamp: "now",
    lastActivityAt: createdAt,
    unread: false,
    unreadCount: 0,
    earlyAdopter: item.earlyAdopter,
    proBadge: item.proBadge,
    unlocked,
    messages: [],
  };
}

function ordinal(value: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = value % 100;
  const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${value}${suffix}`;
}

function stringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getActivityIndicatorColor() {
  return activeThemeMode === "light" ? "#0a0a0a" : "#fff";
}

const baseStyles = {
  gestureRoot: { flex: 1, backgroundColor: dark },
  swipeBackSurface: { flex: 1, backgroundColor: dark },
  profileStackOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: dark, zIndex: 20 },
  fullscreenOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 60, elevation: 60 },
  app: { flex: 1, backgroundColor: dark },
  tabScene: { backgroundColor: dark },
  safe: { flex: 1, backgroundColor: dark },
  safeWithNav: { flex: 1, paddingBottom: NAV_BAR_HEIGHT, backgroundColor: dark },
  profileScrollFadeRoot: { flex: 1 },
  profileScrollTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  profileCollapsedBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    backgroundColor: dark,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  profileCollapsedBarContent: {
    height: PROFILE_COLLAPSED_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SCREEN_CONTENT_PADDING,
  },
  profileCollapsedBarTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  authCard: { width: "100%", gap: 14 },
  onboardingHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  onboardingBackButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  onboardingBackButtonHidden: { opacity: 0 },
  onboardingBackText: { color: "#fff", fontSize: 28, lineHeight: 30, fontWeight: "600" },
  onboardingHeaderSpacer: { width: 40, height: 40 },
  onboardingProgressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  onboardingProgressSegment: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)" },
  onboardingProgressSegmentActive: { backgroundColor: "#fff" },
  onboardingStepsViewport: { flex: 1, overflow: "hidden" },
  onboardingStepsTrack: { flexDirection: "row", flex: 1 },
  onboardingStepPanel: { width: viewportWidth },
  onboardingContent: { flexGrow: 1, gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  onboardingPhotoContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 32,
  },
  onboardingPhotoIntro: { alignItems: "center", gap: 8, paddingHorizontal: 12 },
  onboardingPhotoTitle: { textAlign: "center" },
  onboardingPhotoCopy: { textAlign: "center" },
  onboardingFooter: { flexShrink: 0, gap: 10, paddingHorizontal: 24, paddingTop: 8, alignItems: "stretch" },
  onboardingFooterButton: { flex: 0, width: "100%" },
  onboardingAvatarPicker: { alignItems: "center", justifyContent: "center", gap: 20, width: "100%", maxWidth: 320 },
  onboardingAvatarActions: { flexDirection: "row", gap: 20, alignItems: "center", justifyContent: "center" },
  onboardingAvatarActionButton: { paddingVertical: 8, paddingHorizontal: 4 },
  onboardingAvatarActionText: { color: "#fff", fontSize: 17, fontWeight: "700", textTransform: "lowercase" },
  onboardingSkipButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  onboardingSkipText: { color: muted, fontSize: 15, fontWeight: "600", textTransform: "lowercase" },
  welcomeStage: { flex: 1 },
  welcomeHeaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    minHeight: WELCOME_HEADER_TAP_GUARD,
    paddingTop: 8,
    paddingHorizontal: 16,
    zIndex: 10,
    elevation: 10,
  },
  welcomeBeat: { justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  welcomeBeatLayer: { ...StyleSheet.absoluteFillObject },
  welcomeIntroText: {
    color: muted,
    fontSize: 16,
    textTransform: "lowercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  welcomePositionText: { textAlign: "center" },
  welcomePositionLayout: { flex: 1, width: "100%" },
  welcomePositionTextWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  welcomeForwardHint: { color: "#fff", fontSize: 28, lineHeight: 30, fontWeight: "600" },
  welcomeForwardHintPositioned: { position: "absolute", left: 0, right: 0, textAlign: "center" },
  welcomeMessagePage: { ...StyleSheet.absoluteFillObject, width: "100%" },
  welcomeMessageOneLayout: { flex: 1, width: "100%" },
  welcomeMessageOneTop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: SCREEN_CONTENT_PADDING,
    paddingBottom: 16,
  },
  welcomeMessageOneCenter: { paddingHorizontal: SCREEN_CONTENT_PADDING, alignItems: "center" },
  welcomeMessageOneBottom: { flex: 1 },
  welcomeMessageTwoContent: {
    width: "100%",
    paddingHorizontal: SCREEN_CONTENT_PADDING,
    gap: 24,
  },
  welcomeBackTapZone: {
    position: "absolute",
    top: WELCOME_HEADER_TAP_GUARD,
    bottom: 0,
    left: 0,
    width: viewportWidth * 0.2,
    zIndex: 5,
  },
  welcomeMessageTwoButton: { flex: 0, alignSelf: "stretch" },
  welcomeMessageOneCopy: { textAlign: "center", fontSize: 15, lineHeight: 26 },
  welcomeCallout: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 42,
    textAlign: "center",
    letterSpacing: -0.8,
  },
  authLogoWrap: { alignItems: "center", justifyContent: "center" },
  authWelcomeTo: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 2,
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
    textTransform: "lowercase",
  },
  logo: { color: "#fff", fontSize: 58, fontWeight: "800", letterSpacing: -3, textAlign: "center" },
  logoSmall: { color: "#fff", fontSize: 42, fontWeight: "800", letterSpacing: -2 },
  h1: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -1.2, lineHeight: 40 },
  h2: { color: "#fff", fontSize: 27, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { color: muted, fontSize: 15, lineHeight: 22 },
  copy: { color: "#d4d4d8", fontSize: 15, lineHeight: 22 },
  copyCentered: { color: "#d4d4d8", fontSize: 15, lineHeight: 23, textAlign: "center" },
  profileBio: { color: "#f4f4f5", fontSize: 15, lineHeight: 23, textAlign: "center" },
  longCopy: { color: "#d4d4d8", fontSize: 17, lineHeight: 30 },
  eyebrow: { color: muted, fontSize: 14, textTransform: "lowercase", letterSpacing: 0.4 },
  screenContent: { padding: SCREEN_CONTENT_PADDING, gap: 16 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: border, color: "#fff", backgroundColor: panel, paddingHorizontal: 16, fontSize: 16 },
  filterQueryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterQueryInput: { flex: 1, minWidth: 0 },
  filterResetButton: { minHeight: 52, minWidth: 52, alignItems: "center", justifyContent: "center" },
  filterResetIcon: { color: muted, fontSize: 20, fontWeight: "600", lineHeight: 22 },
  textArea: { minHeight: 112, paddingTop: 14, textAlignVertical: "top" },
  primaryButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#fff", paddingHorizontal: 16 },
  primaryButtonText: { color: "#000", fontSize: 16, fontWeight: "800", textTransform: "lowercase" },
  profileJamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
  },
  profileJamButton: {
    minWidth: 190,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: panel,
    paddingHorizontal: 24,
  },
  profileJamButtonJamming: { borderColor: "#fff", backgroundColor: "#fff" },
  profileJamButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  profileJamButtonTextJamming: { color: "#000" },
  profileJamCancelButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
  },
  profileJamCancelIcon: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 28,
    marginTop: -1,
  },
  secondaryButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: panel, paddingHorizontal: 16 },
  secondaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700", textTransform: "lowercase" },
  destructiveButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: "rgba(252,165,165,0.45)", backgroundColor: "rgba(239,68,68,0.18)", paddingHorizontal: 16 },
  destructiveButtonText: { color: "#fca5a5", fontSize: 16, fontWeight: "800", textTransform: "lowercase" },
  confirmOption: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center" },
  confirmOptionCancelText: { color: "#d4d4d8", fontSize: 16, fontWeight: "700", textTransform: "lowercase" },
  confirmOptionDangerText: { color: "#fca5a5", fontSize: 16, fontWeight: "800", textTransform: "lowercase" },
  disabled: { opacity: 0.45 },
  switchText: { color: muted, textAlign: "center", marginTop: 6, textTransform: "lowercase" },
  forgotPasswordText: {
    color: muted,
    textAlign: "right",
    marginTop: -4,
    marginBottom: 2,
    fontSize: 14,
    textTransform: "lowercase",
  },
  notice: { color: "#bbf7d0", textAlign: "center", padding: 12, borderRadius: 14, backgroundColor: "rgba(22,101,52,0.18)" },
  error: { color: "#fca5a5", textAlign: "center" },
  helper: { color: "#71717a", fontSize: 13, lineHeight: 18 },
  charCount: { alignSelf: "flex-end", color: "#71717a", fontSize: 12 },
  jamPromptMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  jamLimitReachedText: { color: "#fca5a5" },
  loader: { marginTop: 28 },
  sectionLabel: { color: "#8b8b95", fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 4 },
  sectionLabelLight: { color: "#fff" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: panel },
  chipText: { color: "#e4e4e7", fontSize: 14 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryOption: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  categoryOptionActive: { borderColor: "#fff", backgroundColor: "#fff" },
  categoryOptionText: { color: "#e4e4e7", fontSize: 14, fontWeight: "700" },
  categoryOptionTextActive: { color: "#000" },
  suggestionList: { overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: panel },
  suggestionItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  suggestionText: { color: "#e4e4e7", fontSize: 15 },
  profileLocationPicker: { gap: 10 },
  locationFilterList: { overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: panel },
  locationCountryGroup: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  locationOptionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  locationCircle: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1.5, borderColor: "#fff" },
  locationCityCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.25, borderColor: "#d4d4d8" },
  locationCircleSelected: { backgroundColor: "#fff" },
  locationCirclePartial: { backgroundColor: "transparent" },
  locationCirclePartialFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  locationCountryText: { flex: 1, color: "#f4f4f5", fontSize: 16, fontWeight: "700" },
  locationCityList: { gap: 2, paddingBottom: 8 },
  locationCityRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 48, paddingRight: 16, paddingVertical: 8 },
  locationCityText: { color: "#d4d4d8", fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerCenterSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 42, height: 42 },
  headerIconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", zIndex: 1 },
  proProgressWrap: {
    alignItems: "center",
    gap: 5,
    minWidth: 72,
  },
  proProgressLabel: {
    color: "#f6e7c1",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  proProgressTrack: {
    width: 72,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(246,231,193,0.22)",
    overflow: "hidden",
    flexDirection: "row",
  },
  proProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#d7a435",
  },
  profileMenu: { position: "absolute", right: 0, top: 48, zIndex: 40, minWidth: 170, overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.98)" },
  profileMenuAnchor: { zIndex: 40 },
  profileMenuDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  profileMenuItem: { paddingHorizontal: 16, paddingVertical: 13 },
  profileMenuDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", textTransform: "lowercase" },
  unjamPopover: { position: "absolute", width: 200, gap: 4, padding: 12, paddingBottom: 4, borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.98)" },
  unjamPopoverTitle: { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" },
  profileMenuMutedText: { color: "#71717a", fontSize: 14, fontWeight: "700", textTransform: "lowercase" },
  blockedUsersList: { gap: 10 },
  blockedUserRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  blockedUserInfo: { flex: 1, gap: 2 },
  unblockButton: { minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: border, backgroundColor: panel, paddingHorizontal: 13 },
  unblockButtonText: { color: "#fff", fontSize: 13, fontWeight: "800", textTransform: "lowercase" },
  editAvatarButton: { alignSelf: "center", alignItems: "center", gap: 8, paddingVertical: 4 },
  twoCol: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  profileCentered: { alignItems: "center", gap: 7, paddingVertical: 8 },
  profileVideoDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.28)", marginTop: 4 },
  avatarImage: { backgroundColor: panel },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#27272a" },
  avatarText: { color: "#fff", fontWeight: "800" },
  goldBadge: { width: 19, height: 19, alignItems: "center", justifyContent: "center" },
  goldBadgeScallop: { position: "absolute", width: 5.7, height: 5.7, borderRadius: 2.85, backgroundColor: "#d5a231" },
  goldBadgeBase: { width: 15, height: 15, borderRadius: 7.5, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#f8d363", shadowOpacity: 0.32, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  goldBadgeInnerRing: { position: "absolute", width: 13.2, height: 13.2, borderRadius: 6.6, borderWidth: 1, borderColor: "#050505" },
  checkMark: { width: 9, height: 7.2, marginLeft: 0.6, marginTop: -0.6, alignItems: "center", justifyContent: "center" },
  checkStroke: { width: 7.5, height: 4.2, borderLeftWidth: 2.4, borderBottomWidth: 2.4, borderColor: "#020202", transform: [{ rotate: "-45deg" }] },
  feedRoot: { flex: 1, backgroundColor: "#000" },
  feedBootOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: "#000" },
  uploadProgressNavWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 0,
    overflow: "visible",
    zIndex: 50,
  },
  uploadProgressLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    zIndex: 51,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  uploadProgressLineFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  feedTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  feedRecentFiltersArea: { flex: 1, justifyContent: "center", overflow: "visible" },
  feedRecentFiltersMask: { flex: 1, height: 44 },
  feedRecentFiltersMaskElement: { flex: 1, backgroundColor: "transparent" },
  feedRecentFiltersRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  feedRecentFilterItem: { alignItems: "center", justifyContent: "center" },
  feedRecentFilterText: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "lowercase",
  },
  feedRecentFilterTextActive: { color: "#fff", fontWeight: "700" },
  fullscreenMessageRoot: { flex: 1, backgroundColor: "transparent" },
  fullscreenVideoRoot: { flex: 1, backgroundColor: "transparent", justifyContent: "flex-end" },
  fullscreenAdjacentVideo: { position: "absolute", left: 0, right: 0, height: viewportHeight, backgroundColor: "#000" },
  fullscreenCurrentVideo: { zIndex: 2, elevation: 2 },
  filterButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  inboxFilterButtonActive: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(63,63,70,0.92)",
  },
  feedFilterButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -2 }],
  },
  feedNearMeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  feedNearMeButtonActive: { opacity: 1 },
  nearMeRadiusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
  nearMeRadiusOption: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(39,39,42,0.72)",
    alignItems: "center",
  },
  nearMeRadiusOptionActive: {
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(63,63,70,0.92)",
  },
  nearMeRadiusOptionText: { color: "#a1a1aa", fontSize: 13, fontWeight: "600", textTransform: "lowercase" },
  nearMeRadiusOptionTextActive: { color: "#fff" },
  iconText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  closeIconText: { color: "#fff", fontSize: 28, fontWeight: "500", lineHeight: 30 },
  feedItem: { width: "100%", backgroundColor: "#000", justifyContent: "flex-end", overflow: "visible" },
  feedVideoLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  feedVideoViewportClip: {
    overflow: "hidden",
  },
  feedPreviewVideoClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden",
    borderBottomLeftRadius: FEED_PREVIEW_VIDEO_BOTTOM_CORNER_RADIUS,
    borderBottomRightRadius: FEED_PREVIEW_VIDEO_BOTTOM_CORNER_RADIUS,
  },
  feedBufferingIndicator: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  videoBufferingIndicator: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  feedShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.28)" },
  feedOverlayLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  feedMeta: { position: "absolute", left: 18, right: 76, gap: 11 },
  feedName: { color: "#fff", fontSize: 25, fontWeight: "800", letterSpacing: -0.4, ...overlayTextShadow },
  feedRole: { color: "#f4f4f5", fontSize: 14, fontWeight: "600", ...overlayTextShadow },
  caption: { color: "#fff", fontSize: 15, lineHeight: 21, ...overlayTextShadow },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { color: "#e4e4e7", fontSize: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", ...overlayTextShadow },
  badge: { color: "#fff", fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.20)", overflow: "hidden", ...overlayTextShadow },
  actions: { position: "absolute", right: 18, gap: FEED_ACTION_GAP },
  actionButton: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff", fontSize: 31, lineHeight: 33, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  actionDotsText: { transform: [{ translateY: -6 }] },
  feedMoreSheetWrap: { flex: 1, justifyContent: "flex-end" },
  feedMoreSheetDismiss: { ...StyleSheet.absoluteFillObject },
  feedMoreSheetCard: { margin: 14, marginBottom: 24, borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(9,9,11,0.98)", paddingVertical: 8, overflow: "hidden" },
  feedMoreMenuItem: { paddingHorizontal: 16, paddingVertical: 13 },
  feedMoreMenuText: { color: "#f4f4f5", fontSize: 15, fontWeight: "700", ...overlayTextShadow },
  feedMoreMenuDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", ...overlayTextShadow },
  fullscreenMessageBar: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: NAV_BAR_HEIGHT, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 13, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: border, backgroundColor: "rgba(10,10,10,0.96)" },
  fullscreenMessageInput: { flex: 1, minHeight: NAV_BAR_ITEM_HEIGHT, borderRadius: 18, borderWidth: 1, borderColor: border, color: "#fff", backgroundColor: panel, paddingHorizontal: 16, fontSize: 16 },
  fullscreenMessageSendFrame: { minHeight: NAV_BAR_ITEM_HEIGHT },
  fullscreenMessageSendButton: { minHeight: NAV_BAR_ITEM_HEIGHT, width: "100%", borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  fullscreenMessageSendText: { color: "#000", fontWeight: "800" },
  fullscreenMessageSentTick: { fontSize: 19, lineHeight: 22 },
  videoMenu: { position: "absolute", right: 52, top: 4, minWidth: 132, borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.94)", overflow: "hidden" },
  videoMenuItem: { paddingHorizontal: 16, paddingVertical: 13 },
  videoMenuDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", textTransform: "lowercase", ...overlayTextShadow },
  jamJarIcon: { width: 31, height: 36, alignItems: "center", justifyContent: "flex-end" },
  jamJarLid: { width: 23, height: 7, borderRadius: 3, borderWidth: 2, borderColor: "#fff", marginBottom: -1, overflow: "hidden" },
  jamJarLidSent: { height: 4, borderWidth: 0, backgroundColor: "#fff", borderRadius: 2, marginBottom: 2 },
  jamJarLidSolidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    borderRadius: 2,
    margin: -1,
  },
  jamJarBody: { width: 27, height: 27, borderRadius: 9, borderWidth: 2, borderColor: "#fff", overflow: "hidden", justifyContent: "flex-end" },
  jamJarAnimatedFill: {
    width: 23,
    alignSelf: "center",
    backgroundColor: "#fff",
    position: "relative",
  },
  jamJarSmoothWaveSurface: {
    position: "absolute",
    top: -4,
    left: 0,
    width: 23,
    height: 5,
  },
  jamJarBumpWaveWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  jamJarLeak: {
    position: "absolute",
    top: 3,
    alignSelf: "center",
    zIndex: 2,
  },
  jamJarLeakDrop: {
    position: "absolute",
    left: -3,
    top: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  jamJarLeakDropSide: {
    left: -2.25,
    top: -4.5,
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
  jamJarFill: { height: 7, backgroundColor: "#fff" },
  jamJarFillSent: { height: 21 },
  jamJarEmptyJam: { position: "absolute", left: 0, bottom: 0 },
  jamJarWaveLeft: { position: "absolute", left: -3, top: -4, width: 15, height: 8, borderRadius: 8, backgroundColor: "#fff" },
  jamJarWaveRight: { position: "absolute", right: -4, top: -2, width: 18, height: 7, borderRadius: 9, backgroundColor: "#fff" },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: "#09090b" },
  emptyFeed: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 28 },
  endOfFeed: {
    width: "100%",
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 28,
    paddingBottom: NAV_BAR_HEIGHT,
    backgroundColor: dark,
  },
  endOfFeedFullscreen: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 28,
    paddingBottom: NAV_BAR_HEIGHT,
    backgroundColor: dark,
  },
  emptyText: { color: "#e4e4e7", fontSize: 22, lineHeight: 31, textAlign: "center", fontWeight: "700" },
  modalShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" },
  topSheet: { position: "absolute", left: 0, right: 0, top: 0, gap: 10, padding: 22, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#09090b" },
  topSheetScroll: { flexShrink: 1 },
  topSheetScrollContent: { gap: 10, paddingBottom: 2 },
  bottomModalWrap: { flex: 1, justifyContent: "flex-end" },
  bottomCard: { gap: 14, padding: 18, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#09090b" },
  jamPromptOverlay: { flex: 1, justifyContent: "center", padding: 22 },
  jamPromptHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  chatOverlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 70,
  },
  chatOverlaySwipeSurface: {
    flex: 1,
    backgroundColor: "transparent",
  },
  jamPromptShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)" },
  jamPromptCard: { gap: 14, padding: 18, borderRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.92)" },
  cardTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  reportReasonList: { gap: 8 },
  reportReasonButton: { minHeight: 48, justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: panel, paddingHorizontal: 16 },
  reportReasonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  smallPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: border, backgroundColor: panel },
  smallPillText: { color: "#e4e4e7", fontWeight: "700" },
  iconCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: border, backgroundColor: panelSoft, alignItems: "center", justifyContent: "center" },
  previewBox: { overflow: "hidden", borderRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#000" },
  previewVideo: { width: "100%", aspectRatio: 9 / 16, backgroundColor: "#000" },
  createThumbnailLoader: { alignSelf: "center", marginVertical: 8 },
  createThumbnailFilmstripWrap: {
    height: CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT + 6,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: border,
    justifyContent: "center",
  },
  createThumbnailFilmstripRow: { flexDirection: "row" },
  createThumbnailFilmstripGestureArea: { flex: 1, justifyContent: "center" },
  createThumbnailFilmstripSelector: {
    position: "absolute",
    top: 0,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 8,
    zIndex: 2,
  },
  createDetailsComposerRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  createDetailsCaptionInput: {
    flex: 1,
    minHeight: CREATE_DETAILS_PREVIEW_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    color: "#fff",
    backgroundColor: panel,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  createDetailsVideoTap: {
    width: CREATE_DETAILS_PREVIEW_WIDTH,
    height: CREATE_DETAILS_PREVIEW_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "#000",
  },
  createDetailsVideoTapImage: { width: "100%", height: "100%" },
  createDetailsVideoTapFallback: { flex: 1, backgroundColor: "#18181b" },
  createDetailsVideoTapBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  createDetailsVideoTapBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "lowercase",
  },
  createPostPreviewBackdrop: { flex: 1, backgroundColor: "#000" },
  createPostPreviewFrame: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  createPostPreviewVideo: { ...StyleSheet.absoluteFillObject },
  createPostPreviewFilter: { ...StyleSheet.absoluteFillObject },
  createPostPreviewTextOverlay: {
    position: "absolute",
    zIndex: 4,
    maxWidth: "85%",
  },
  createPostPreviewTextOverlayText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  createPostPreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  createPostPreviewMeta: { position: "absolute", left: 18, right: 76, bottom: 122, gap: 11 },
  createPostPreviewNavBarPlaceholder: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 6,
  },
  createPostPreviewClose: {
    position: "absolute",
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "rgba(9,9,11,0.72)",
    zIndex: 10,
  },
  createEditNextBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  createEditKeyboardDismissBand: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  createEditKeyboardDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  createEditNextPill: {
    minHeight: 48,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 28,
    zIndex: 1,
  },
  createEditNextText: { color: "#000", fontSize: 16, fontWeight: "900", textTransform: "lowercase" },
  createEditToolPanel: {
    position: "absolute",
    left: 18,
    right: 72,
    zIndex: 6,
    gap: 10,
    paddingHorizontal: 4,
  },
  createTrimToolPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 6,
    alignItems: "center",
    paddingHorizontal: 18,
  },
  createTrimToolPanelContent: {
    width: "100%",
    maxWidth: 360,
    gap: 8,
  },
  createEditUploadProgressWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 6,
  },
  createFilterOverlay: { ...StyleSheet.absoluteFillObject },
  createTextOverlayDraggable: {
    position: "absolute",
    zIndex: 2,
    maxWidth: "85%",
  },
  createTextOverlaySnapGuideVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    marginLeft: -0.5,
    backgroundColor: "#FFE566",
    zIndex: 1,
  },
  createTextOverlaySnapGuideHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    marginTop: -0.5,
    backgroundColor: "#FFE566",
    zIndex: 1,
  },
  createTextOverlayPreviewText: { color: "#fff", fontSize: 30, lineHeight: 36, fontWeight: "900", textAlign: "center", textShadowColor: "rgba(0,0,0,0.62)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  createTextOverlayInput: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.62)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
    padding: 0,
    margin: 0,
    minWidth: 18,
    maxWidth: "100%",
    backgroundColor: "transparent",
    includeFontPadding: false,
  },
  createTextOverlayActionMenu: {
    position: "absolute",
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,20,22,0.94)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  createTextOverlayActionButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  createTextOverlayActionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "lowercase",
  },
  createTextOverlayActionDeleteText: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "lowercase",
  },
  createTextOverlayActionDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  createTrimHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  createTrimDuration: { color: "#fff", fontSize: 14, fontWeight: "900" },
  createTrimFilmstripOuter: {
    position: "relative",
    height: CREATE_TRIM_FILMSTRIP_HEIGHT,
    justifyContent: "center",
  },
  createTrimFilmstrip: {
    height: CREATE_TRIM_FILMSTRIP_HEIGHT,
    borderRadius: CREATE_TRIM_FILMSTRIP_RADIUS,
    overflow: "hidden",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    position: "relative",
  },
  createTrimFilmstripLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createTrimFilmstripFrames: {
    flex: 1,
    flexDirection: "row",
  },
  createTrimFilmstripFrame: {
    flex: 1,
    height: "100%",
  },
  createTrimFilmstripFramePlaceholder: {
    flex: 1,
    height: "100%",
    backgroundColor: "#27272a",
  },
  createTrimFilmstripDim: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  createTrimFilmstripSelection: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "#fff",
  },
  createTrimProgressTrack: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 3,
    overflow: "hidden",
  },
  createTrimProgressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  createTrimPlayhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  createTrimHandleTab: {
    position: "absolute",
    top: 0,
    width: CREATE_TRIM_HANDLE_WIDTH,
    height: CREATE_TRIM_FILMSTRIP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
    borderColor: "#fff",
    borderTopWidth: 2,
    borderBottomWidth: 2,
    zIndex: 4,
  },
  createTrimHandleTabStart: {
    borderRightWidth: 2,
  },
  createTrimHandleTabStartFlush: {
    borderLeftWidth: 2,
    borderTopLeftRadius: CREATE_TRIM_FILMSTRIP_RADIUS - 1,
    borderBottomLeftRadius: CREATE_TRIM_FILMSTRIP_RADIUS - 1,
  },
  createTrimHandleTabEnd: {
    borderLeftWidth: 2,
  },
  createTrimHandleTabEndFlush: {
    borderRightWidth: 2,
    borderTopRightRadius: CREATE_TRIM_FILMSTRIP_RADIUS - 1,
    borderBottomRightRadius: CREATE_TRIM_FILMSTRIP_RADIUS - 1,
  },
  createFilterList: { gap: 10, paddingVertical: 2 },
  createFilterListCompact: { gap: 10, paddingVertical: 0, paddingHorizontal: 16 },
  createFilterOption: { width: 70, gap: 6, alignItems: "center" },
  createFilterOptionCompact: { width: 44 },
  createFilterThumbRing: {
    width: 64,
    height: 78,
    borderRadius: 16,
    borderWidth: CREATE_FILTER_THUMB_BORDER_WIDTH,
    borderColor: "rgba(255,255,255,0.14)",
  },
  createFilterThumbRingCompact: { width: 44, height: 44, borderRadius: 22 },
  createFilterThumbRingActive: { borderColor: "#fff" },
  createFilterThumbInner: {
    flex: 1,
    borderRadius: 16 - CREATE_FILTER_THUMB_BORDER_WIDTH,
    overflow: "hidden",
    backgroundColor: "#18181b",
  },
  createFilterThumbInnerCompact: { borderRadius: 22 - CREATE_FILTER_THUMB_BORDER_WIDTH },
  createFilterThumbImage: { width: "100%", height: "100%" },
  createFilterThumbFallback: { flex: 1, backgroundColor: "#27272a" },
  createFilterLabel: { color: "#d4d4d8", fontSize: 12, fontWeight: "800" },
  createFilterLabelCompact: { fontSize: 10 },
  createEditUploadProgress: { height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  createCameraRoot: { flex: 1, backgroundColor: "#000" },
  createCameraViewport: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden",
    backgroundColor: "#000",
    borderBottomLeftRadius: FEED_VIDEO_BOTTOM_CORNER_RADIUS,
    borderBottomRightRadius: FEED_VIDEO_BOTTOM_CORNER_RADIUS,
  },
  createCameraPermission: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 16, padding: 28, backgroundColor: "#000" },
  createCameraTapLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  createCameraFilterPreview: { zIndex: 2 },
  createCameraScreenFlash: { zIndex: 3 },
  createCameraCountdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  createCameraCountdownText: { color: "#fff", fontSize: 88, fontWeight: "900", letterSpacing: -2 },
  createCameraTopBar: { position: "absolute", left: 18, right: 18, zIndex: 5, flexDirection: "row", alignItems: "center", justifyContent: "flex-start" },
  createCameraSideRail: { position: "absolute", right: 18, zIndex: 5, gap: 16, alignItems: "center" },
  createCameraControlButton: {
    width: CREATE_CAMERA_CONTROL_BUTTON_SIZE,
    height: CREATE_CAMERA_CONTROL_BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  createCameraSideRailText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  createCameraCloseIconText: { color: "#fff", fontSize: 32, fontWeight: "500", lineHeight: 34 },
  createCameraFilterSheetWrap: { ...StyleSheet.absoluteFillObject, zIndex: 8 },
  createCameraFilterDismiss: { ...StyleSheet.absoluteFillObject },
  createCameraFilterBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  createCameraFilterFloat: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  createCameraBottomBar: { position: "absolute", left: 28, right: 28, zIndex: 5, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  createCameraSpacer: { width: 58, height: 58 },
  createLibraryButton: { width: 58, height: 58, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(24,24,27,0.72)" },
  createLibraryThumbnail: { width: "100%", height: "100%" },
  createLibraryPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(24,24,27,0.82)" },
  createLibraryPlaceholderText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  createRecordButton: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  createCameraHint: { position: "absolute", left: 0, right: 0, zIndex: 5, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: "800", textTransform: "lowercase" },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  segmented: { alignSelf: "flex-start", flexDirection: "row", borderRadius: 14, padding: 4, borderWidth: 1, borderColor: border, backgroundColor: panel },
  segment: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  segmentActive: { backgroundColor: "#fff" },
  segmentText: { color: "#d4d4d8", fontSize: 15, textTransform: "lowercase" },
  segmentTextActive: { color: "#000", fontWeight: "800" },
  list: { gap: 10 },
  listCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  listTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  conversationRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: border },
  subdued: { opacity: 0.7 },
  alignEnd: { alignItems: "flex-end", gap: 5 },
  unreadDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#ec4899" },
  emptyCard: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: border },
  chatProfileTarget: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  chatContent: { flexGrow: 1, gap: 10, padding: 16 },
  chatLoadOlderButton: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 6,
  },
  chatLoadOlderText: { color: "#d4d4d8", fontSize: 13, fontWeight: "600" },
  messageWrap: { maxWidth: "82%", gap: 6 },
  messageWrapIn: { alignSelf: "flex-start" },
  messageWrapOut: { alignSelf: "flex-end" },
  bubble: { maxWidth: "100%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  bubbleIn: { alignSelf: "flex-start", backgroundColor: panel },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: "#fff" },
  bubbleWithVideo: { marginTop: -22, zIndex: 1 },
  messageVideoThumbnailWrap: { width: 190, height: 260, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" },
  messageVideoThumbnailIn: { alignSelf: "flex-start" },
  messageVideoThumbnailOut: { alignSelf: "flex-end" },
  messageVideoThumbnail: { width: "100%", height: "100%" },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  bubbleTextOut: { color: "#000" },
  messageContextMenu: { alignSelf: "flex-end", minWidth: 128, borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.96)", overflow: "hidden" },
  messageContextItem: { paddingHorizontal: 16, paddingVertical: 12 },
  messageContextText: { color: "#fff", fontSize: 15, fontWeight: "700", textTransform: "lowercase" },
  messageContextDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", textTransform: "lowercase" },
  editMessageBox: { gap: 8, minWidth: 180 },
  editMessageInput: { color: "#000", fontSize: 15, lineHeight: 22, padding: 0, minHeight: 28 },
  editMessageActions: { flexDirection: "row", justifyContent: "flex-end", gap: 14 },
  editMessageCancel: { color: "#52525b", fontSize: 13, fontWeight: "700", textTransform: "lowercase" },
  editMessageSave: { color: "#000", fontSize: 13, fontWeight: "900", textTransform: "lowercase" },
  composer: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 0, borderTopWidth: 1, borderTopColor: border },
  chatComposerDock: {
    backgroundColor: dark,
  },
  sendButton: { paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  sendButtonText: { color: "#000", fontWeight: "800" },
  profileTabSlider: { overflow: "visible" },
  grid: { width: viewportWidth, flexDirection: "row", flexWrap: "wrap", gap: PROFILE_GRID_GAP, marginTop: 8, marginHorizontal: -SCREEN_CONTENT_PADDING },
  gridItem: { width: PROFILE_GRID_ITEM_WIDTH, aspectRatio: 9 / 16, overflow: "hidden", alignItems: "flex-end", justifyContent: "flex-end", padding: 8, backgroundColor: panel },
  gridPendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  gridPendingStatusText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  gridPendingErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
  },
  gridPendingErrorText: { color: "rgba(255,255,255,0.82)", fontSize: 11, textAlign: "center" },
  gridPendingRetryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  gridPendingRetryText: { color: "#fff", fontSize: 11, fontWeight: "700", textTransform: "lowercase" },
  uploadProgressRingWrap: { alignItems: "center", justifyContent: "center" },
  profilePostedToast: {
    position: "absolute",
    alignSelf: "center",
    left: "28%",
    right: "28%",
    zIndex: 40,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  profilePostedToastText: { color: "#000", fontWeight: "700", fontSize: 14 },
  gridCaption: { color: "#fff", fontSize: 11, lineHeight: 15, fontWeight: "600", ...overlayTextShadow },
  lockedOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.58)", padding: 8 },
  lockedText: { color: "#fff", textAlign: "center", fontSize: 11, fontWeight: "800", ...overlayTextShadow },
  settingsOverlay: { flex: 1, alignItems: "flex-end" },
  settingsBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)" },
  settingsDrawer: { position: "absolute", right: 0, top: 0, bottom: 0, borderLeftWidth: 1, borderLeftColor: border, backgroundColor: "#09090b", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: -8, height: 0 }, elevation: 16 },
  settingsPanel: { flex: 1, backgroundColor: "#09090b", paddingHorizontal: 20 },
  settingsPanelScroll: { flex: 1 },
  settingsPanelScrollContent: { gap: 8, paddingBottom: 12 },
  settingsButton: { paddingVertical: 14, paddingHorizontal: 10, borderRadius: 16 },
  settingsToggleGroup: { marginTop: 10, gap: 0 },
  settingsLocationGroup: { gap: 0 },
  settingsNearMeSection: { gap: 4, paddingBottom: 8, paddingHorizontal: 10 },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 10 },
  settingsRowLabel: { flex: 1, paddingRight: 12 },
  settingsText: { color: "#e4e4e7", fontSize: 15, textTransform: "lowercase" },
  settingsSwitch: { alignSelf: "center" },
  notificationSettingsSection: { gap: 4, paddingTop: 8 },
  notificationSettingsCopy: { color: muted, fontSize: 14, lineHeight: 22, paddingHorizontal: 10, paddingBottom: 4 },
  notificationCategoryPicker: { gap: 10, paddingTop: 4 },
  notificationCategoryPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  notificationConfirmButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  notificationConfirmText: { color: "#000", fontSize: 18, lineHeight: 20, fontWeight: "800" },
  legalTabRow: { flexDirection: "row", marginTop: 8, borderBottomWidth: 1, borderBottomColor: border },
  legalTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  legalTabActive: { borderBottomColor: "#fff" },
  legalTabText: { color: "#71717a", fontSize: 14, fontWeight: "600", textAlign: "center", textTransform: "lowercase" },
  legalTabTextActive: { color: "#fff", fontWeight: "800" },
  legalCopy: { color: "#a1a1aa", fontSize: 15, lineHeight: 24, paddingTop: 18 },
  logoutButton: {
    marginTop: 8,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: border,
  },
  logoutText: { color: "#fca5a5", fontSize: 15, textTransform: "lowercase" },
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: NAV_BAR_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: border, backgroundColor: "rgba(10,10,10,0.96)" },
  navItem: { height: 58, minWidth: 58, borderRadius: 18, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  navItemActive: { minWidth: 132, borderColor: "#93c5fd", backgroundColor: panel },
  navIcon: { color: "#fff", fontSize: 23 },
  navLabel: { color: "#fff", fontSize: 16, textTransform: "lowercase" },
  gridNavIcon: { width: 23, height: 23, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  gridNavCell: { width: 9, height: 9, borderWidth: 1.8, borderColor: "#fff", borderRadius: 3 },
  mailIconWrap: { width: 33, height: 30, alignItems: "center", justifyContent: "center" },
  mailIcon: { width: 26, height: 19, borderColor: "#fff" },
  mailBadge: { position: "absolute", right: -3, top: -4, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 8.5, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(10,10,10,0.96)", backgroundColor: "#ef4444" },
  mailBadgeText: { color: "#fff", fontSize: 10, lineHeight: 12, fontWeight: "900" },
  createNav: { width: 66, height: 66, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  createNavText: { color: "#000", fontSize: 38, lineHeight: 41, fontWeight: "600" },
  toast: { position: "absolute", top: 76, left: 18, right: 18, zIndex: 30, alignItems: "center" },
  toastText: { color: "#fecaca", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(127,29,29,0.82)" },
  inboxNotificationWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 80,
    alignItems: "center",
  },
  inboxNotificationCard: {
    maxWidth: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(9,9,11,0.94)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inboxNotificationText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
};

const mediaOverlayStyleNames = new Set([
  "topSheet",
  "topSheetScroll",
  "topSheetScrollContent",
  "sectionLabelLight",
  "locationFilterList",
  "locationCountryGroup",
  "locationOptionRow",
  "locationCircle",
  "locationCityCircle",
  "locationCircleSelected",
  "locationCirclePartial",
  "locationCirclePartialFill",
  "locationCountryText",
  "locationCityList",
  "locationCityRow",
  "locationCityText",
  "feedRoot",
  "feedBootOverlay",
  "feedName",
  "feedRole",
  "caption",
  "tag",
  "badge",
  "actionText",
  "jamJarLid",
  "jamJarLidSent",
  "jamJarLidSolidFill",
  "jamJarBody",
  "jamJarAnimatedFill",
  "jamJarSmoothWaveSurface",
  "jamJarBumpWaveWrap",
  "jamJarLeak",
  "jamJarLeakDrop",
  "jamJarLeakDropSide",
  "jamJarFill",
  "jamJarFillSent",
  "jamJarEmptyJam",
  "jamJarWaveLeft",
  "jamJarWaveRight",
  "gridCaption",
  "lockedText",
  "videoPlaceholder",
  "feedShade",
  "fullscreenVideoRoot",
  "fullscreenAdjacentVideo",
  "fullscreenMessageRoot",
  "fullscreenMessageBar",
  "fullscreenMessageInput",
  "fullscreenMessageSendFrame",
  "fullscreenMessageSendButton",
  "fullscreenMessageSendText",
  "fullscreenMessageSentTick",
  "feedItem",
  "feedVideoLayer",
  "createEditNextBand",
  "createEditNextPill",
  "createEditNextText",
  "createEditToolPanel",
  "createTrimToolPanel",
  "createTrimToolPanelContent",
  "createEditUploadProgressWrap",
  "createFilterOverlay",
  "createTextOverlayDraggable",
  "createTextOverlaySnapGuideVertical",
  "createTextOverlaySnapGuideHorizontal",
  "createTextOverlayPreviewText",
  "createTextOverlayInput",
  "createTextOverlayActionMenu",
  "createTextOverlayActionButton",
  "createTextOverlayActionButtonText",
  "createTextOverlayActionDeleteText",
  "createTextOverlayActionDivider",
  "createTrimHeader",
  "createTrimDuration",
  "createTrimFilmstripOuter",
  "createTrimFilmstrip",
  "createTrimFilmstripLoading",
  "createTrimFilmstripFrames",
  "createTrimFilmstripFrame",
  "createTrimFilmstripFramePlaceholder",
  "createTrimFilmstripDim",
  "createTrimFilmstripSelection",
  "createTrimHandleTab",
  "createTrimHandleTabStart",
  "createTrimHandleTabStartFlush",
  "createTrimHandleTabEnd",
  "createTrimHandleTabEndFlush",
  "createFilterList",
  "createFilterOption",
  "createFilterThumbRing",
  "createFilterThumbRingActive",
  "createFilterThumbInner",
  "createFilterThumbInnerCompact",
  "createFilterThumbImage",
  "createFilterThumbFallback",
  "createFilterLabel",
  "createEditUploadProgress",
  "createCameraRoot",
  "createCameraViewport",
  "createCameraPermission",
  "createCameraTapLayer",
  "createCameraFilterPreview",
  "createCameraScreenFlash",
  "createCameraCountdownOverlay",
  "createCameraCountdownText",
  "createCameraTopBar",
  "createCameraSideRail",
  "createCameraControlButton",
  "createCameraSideRailText",
  "createCameraCloseIconText",
  "createCameraFilterSheetWrap",
  "createCameraFilterDismiss",
  "createCameraFilterBand",
  "createCameraFilterFloat",
  "createCameraBottomBar",
  "createCameraSpacer",
  "createLibraryButton",
  "createLibraryThumbnail",
  "createLibraryPlaceholder",
  "createLibraryPlaceholderText",
  "createRecordButton",
  "createCameraHint",
]);

function createLightStyles<T extends Record<string, unknown>>(source: T): T {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      mediaOverlayStyleNames.has(key) ? value : transformStyleForLightMode(value),
    ]),
  ) as T;
}

function transformStyleForLightMode(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(transformStyleForLightMode);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        key.toLowerCase().includes("shadow")
          ? nestedValue
          : transformStyleForLightMode(nestedValue),
      ]),
    );
  }

  if (typeof value !== "string") return value;
  return getLightModeColor(value);
}

function getLightModeColor(value: string) {
  const colorMap: Record<string, string> = {
    [dark]: "#f7f7f8",
    [panel]: "#ffffff",
    [panelSoft]: "#f2f2f4",
    [border]: "rgba(0,0,0,0.12)",
    [muted]: "#52525b",
    "#fff": "#0a0a0a",
    "#000": "#ffffff",
    "#09090b": "#ffffff",
    "#27272a": "#e4e4e7",
    "#e4e4e7": "#27272a",
    "#d4d4d8": "#3f3f46",
    "#8b8b95": "#52525b",
    "#71717a": "#71717a",
    "#52525b": "#71717a",
    "rgba(10,10,10,0.96)": "rgba(255,255,255,0.96)",
    "rgba(9,9,11,0.98)": "rgba(255,255,255,0.98)",
    "rgba(9,9,11,0.96)": "rgba(255,255,255,0.96)",
    "rgba(9,9,11,0.94)": "rgba(255,255,255,0.96)",
    "rgba(9,9,11,0.92)": "rgba(255,255,255,0.94)",
    "rgba(24,24,27,0.82)": "rgba(255,255,255,0.88)",
    "rgba(255,255,255,0.14)": "rgba(0,0,0,0.14)",
    "rgba(255,255,255,0.20)": "rgba(0,0,0,0.10)",
    "rgba(255,255,255,0.10)": "rgba(0,0,0,0.08)",
    "rgba(0,0,0,0.42)": "rgba(0,0,0,0.18)",
    "rgba(0,0,0,0.62)": "rgba(0,0,0,0.20)",
    "rgba(0,0,0,0.58)": "rgba(255,255,255,0.58)",
  };
  return colorMap[value] ?? value;
}

type AppStyle = ViewStyle | TextStyle | ImageStyle;
type AppNamedStyles = Record<string, AppStyle>;
type AppStyleSet = Record<keyof typeof baseStyles, StyleProp<AppStyle>>;

const darkStyles = StyleSheet.create(baseStyles as unknown as AppNamedStyles) as AppStyleSet;
const lightStyles = StyleSheet.create(createLightStyles(baseStyles) as unknown as AppNamedStyles) as AppStyleSet;
const styles = new Proxy(darkStyles, {
  get(target, property: keyof typeof darkStyles) {
    return activeThemeMode === "light" ? lightStyles[property] : target[property];
  },
}) as AppStyleSet;
