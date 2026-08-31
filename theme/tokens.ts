import { Dimensions } from "react-native";

export const { width: viewportWidth, height: viewportHeight } = Dimensions.get("window");

export const dark = "#0a0a0a";
export const panel = "#18181b";
export const panelSoft = "#111113";
export const border = "rgba(255,255,255,0.12)";
export const muted = "#a1a1aa";
export const danger = "#DC2626";

export const THEME_STORAGE_KEY = "jam.themeMode";
export const AUTH_PASSWORD_MIN_LENGTH = 8;

export const WELCOME_HEADER_TAP_GUARD = 56;
export const SCREEN_CONTENT_PADDING = 22;
export const TAB_SCREEN_TOP_PADDING = 18;
export const TAB_SCREEN_MIN_TOP_PADDING = 28;
export const PROFILE_GRID_GAP = 4;
export const PROFILE_GRID_ITEM_WIDTH = (viewportWidth - PROFILE_GRID_GAP * 2) / 3;
export const NAV_BAR_HEIGHT = 92;
export const NAV_BAR_ITEM_HEIGHT = 58;
export const NAV_BAR_TOP_PADDING = 12;
export const FEED_ACTION_GAP = 12;
/** Hold still this long before chrome fades for a clear video view. */
export const FEED_CHROME_HOLD_MS = 220;
/** Finger travel needed while holding to fill the lock gesture (visual track stays shorter). */
export const FEED_CHROME_LOCK_PULL_PX = 130;
/** Visual travel of the lock knob along the pull path. */
export const FEED_CHROME_LOCK_TRACK_TRAVEL = 78;
export const FEED_CHROME_LOCK_CIRCLE_SIZE = 46;
export const FEED_CHROME_FADE_MS = 180;
/** Right-edge fraction of the feed that opens the playback-speed scrubber. */
export const FEED_SPEED_ZONE_LEFT_RATIO = 0.75;
/** Top → bottom speed options in the hold scrubber. */
export const FEED_PLAYBACK_SPEEDS = [2, 1.5, 1, 0.5] as const;
export const FEED_SPEED_DEFAULT_INDEX = FEED_PLAYBACK_SPEEDS.indexOf(1);
/** Vertical drag distance to move one speed step. */
export const FEED_SPEED_SEGMENT_PX = 42;
/** Slightly wider than the jam/bookmark icons; still centered on the action column. */
export const FEED_SPEED_PILL_WIDTH = 38;
export const FEED_SPEED_PILL_PADDING_V = 12;
export const FEED_SPEED_ROW_HEIGHT = 32;
export const FEED_SPEED_PILL_HEIGHT =
  FEED_SPEED_PILL_PADDING_V * 2 + FEED_SPEED_ROW_HEIGHT * FEED_PLAYBACK_SPEEDS.length;
export const FULLSCREEN_MESSAGE_SEND_WIDTH = 72;
export const FULLSCREEN_MESSAGE_TICK_WIDTH = 54;
export const MAX_ACCOUNT_CREATOR_TYPES = 3;
export const MAX_VIDEO_ROLES = 1;
export const MAX_VIDEO_GENRES = 3;
export const LOCATION_PICKER_MAX_VISIBLE_ROWS = 3;
export const LOCATION_PICKER_ROW_HEIGHT = 50;
/** Slightly short of 3 full rows so the next option peeks — same scroll cue as role/genre lists. */
export const LOCATION_PICKER_VISIBLE_HEIGHT =
  LOCATION_PICKER_MAX_VISIBLE_ROWS * LOCATION_PICKER_ROW_HEIGHT - Math.round(LOCATION_PICKER_ROW_HEIGHT * 0.4);
export const EMPTY_FILTER_GENRES: string[] = [];
export const CREATE_RECORDING_TIMER_OPTIONS = [0, 3, 10] as const;
export const CREATE_CAMERA_CONTROLS_BOTTOM_PADDING = 24;
export const CREATE_CAMERA_RECORD_BUTTON_SIZE = 78;
export const CREATE_CAMERA_RECORD_BUTTON_BORDER_WIDTH = 4;
export const CREATE_CAMERA_PHOTO_BUTTON_SIZE = 36;
export const CREATE_CAMERA_CAPTURE_SWITCH_GAP = 18;
export const CREATE_CAMERA_FILTER_ROW_HEIGHT = 44;
export const CREATE_CAMERA_CONTROL_BUTTON_SIZE = 54;
export const CREATE_CAMERA_CONTROL_ICON_SIZE = 28;
export const CREATE_CAMERA_TOP_CONTROLS_OFFSET = 12;
/** Pixels of drag for bias ±1 from center — two full-screen swipes to either edge. */
export const CREATE_CAMERA_EXPOSURE_DRAG_RANGE_PX = viewportHeight * 2;
export const CREATE_CAMERA_FOCUS_RETICLE_SIZE = 72;
export const CREATE_FILTER_THUMB_BORDER_WIDTH = 2;
export const CREATE_FILTER_PREVIEW_IMAGE = require("../assets/filter-preview-base.png");
export const LOOKING_FOR_BINOCULARS_ICON = require("../assets/looking-for-binoculars.png");
export const CAMERA_PINCH_ZOOM_STEP = 0.14;
export const FEED_VIDEO_BOTTOM_CORNER_RADIUS = 24;
export const FEED_PREVIEW_VIDEO_BOTTOM_CORNER_RADIUS = 12;
export const TEXT_OVERLAY_CENTER_SNAP_THRESHOLD = 0.035;
export const TEXT_OVERLAY_CENTER_PROXIMITY_THRESHOLD = 0.09;
export const TEXT_OVERLAY_CENTER_GUIDE_DWELL_MS = 450;
export const TEXT_OVERLAY_CENTER_GUIDE_FADE_MS = 180;
export const TEXT_OVERLAY_BASE_FONT_SIZE = 30;
export const TEXT_OVERLAY_MAX_WIDTH_RATIO = 0.86;
export const SWIPE_BACK_HIT_WIDTH = 112;
export const FEED_QUICK_FILTERS = ["vocalist", "instrumentalist", "producer"] as const;
export const FEED_ROLE_FILTER_LOOP_COPIES = 3;
export const PROFILE_TOP_FADE_EXTRA = 28;
export const PROFILE_COLLAPSED_BAR_HEIGHT = 44;
export const CREATE_THUMBNAIL_FRAME_COUNT = 24;
export const CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT = 76;
export const CREATE_THUMBNAIL_SELECTOR_WIDTH_SCALE = 1.45;
export const CREATE_TRIM_FILMSTRIP_FRAME_COUNT = 10;
export const CREATE_TRIM_FILMSTRIP_HEIGHT = 52;
export const CREATE_TRIM_HANDLE_WIDTH = 22;
export const CREATE_TRIM_FILMSTRIP_RADIUS = 14;
export const CREATE_DETAILS_PREVIEW_WIDTH = 96;
export const CREATE_DETAILS_PREVIEW_HEIGHT = 170;

export const JAM_JAR_FILL_EMPTY_HEIGHT = 11.5;
export const JAM_JAR_FILL_FULL_HEIGHT = 21;
export const JAM_JAR_LID_EMPTY_HEIGHT = 7;
export const JAM_JAR_LID_FULL_HEIGHT = 4;
export const JAM_JAR_LID_EMPTY_GAP = -1;
export const JAM_JAR_LID_FULL_GAP = 2;
export const JAM_JAR_JAM_COLOR = "#d63438";
export const UNJAM_POPOVER_WIDTH = 200;
export const NOTIFY_POPOVER_WIDTH = 240;
export const jamTint = { backgroundColor: JAM_JAR_JAM_COLOR } as const;
export const jamBorder = { borderColor: JAM_JAR_JAM_COLOR } as const;
// Subtle drop shadow so overlay icons stay visible on bright videos (iOS shadows follow the icon's alpha).
export const overlayIconShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.45,
  shadowRadius: 3.5,
  shadowOffset: { width: 0, height: 1 },
} as const;
// TikTok-style text shadow for any text sitting on top of video.
export const overlayTextShadow = {
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
} as const;
export const BOOKMARK_CREAM = "#f6e7c1";
