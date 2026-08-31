import type { VideoFilterId } from "@/lib/video-filters";
import type {
  Profile,
  ProfileVideo,
} from "@/lib/native-social-data";
import type { VideoTextEffectId, VideoTextFontId } from "@/lib/video-presentation";
import type { LocationGranularity, LocationPlace } from "@/lib/location-place";

export type { LocationGranularity, LocationPlace };

export type Route = "auth" | "onboarding" | "welcome" | "main";
export type Tab = "discover" | "inbox" | "create" | "you";
export type ThemeMode = "dark" | "light";
export type MainTabParamList = {
  discover: undefined;
  create: undefined;
  inbox: undefined;
  you: undefined;
};
export type InboxTab = "requests" | "jams" | "sent";
export type CreateStage = "camera" | "edit" | "details";
export type CreateCaptureMode = "video" | "photo";
export type CreateEditItemKind = "video" | "image";
export type CreateTextOverlayItem = {
  id: string;
  text: string;
  centerRatio: { x: number; y: number };
  fontScale: number;
  fontId: VideoTextFontId;
  effectId: VideoTextEffectId;
};
export type CreateEditItem = {
  id: string;
  kind: CreateEditItemKind;
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationMs: number;
  textOverlays: CreateTextOverlayItem[];
};
export type VideoFilter = VideoFilterId;
export type AuthMode = "login" | "signup" | "forgot" | "reset";
export type AuthDeepLinkResult = "recovery" | "session" | null;

export type LocationCountryOption = {
  country: string;
  aliases?: readonly string[];
  cities: readonly string[];
};

export type LocationFilterSelection = {
  country: string;
  cities: string[];
  country_code?: string;
  region?: string;
  granularity?: LocationGranularity;
};

export type PreloadedUserProfile = {
  userId: string;
  profile: Profile | null;
  videos: ProfileVideo[];
  jammedByMe: boolean;
  jammedMe: boolean;
};

export type SavedVideoController = {
  savedVideoIds: Set<string>;
  setVideoSaved: (videoId: string, nextSaved: boolean) => Promise<boolean>;
  refreshSavedVideos: () => Promise<Set<string>>;
};

/** Keep in sync with FEED_PLAYBACK_SPEEDS in theme/tokens. */
export type FeedPlaybackSpeed = 2 | 1.5 | 1 | 0.5;

/** Keep in sync with CREATE_RECORDING_TIMER_OPTIONS in theme/tokens. */
export type RecordingTimerSeconds = 0 | 3 | 10;
