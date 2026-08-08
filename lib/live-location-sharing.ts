import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, type AppStateStatus } from "react-native";
import { getDistanceInMiles } from "@/lib/location-distance";
import { updateLiveLocation, type Profile } from "@/lib/native-social-data";

export const LIVE_LOCATION_TASK_NAME = "jam-live-location-updates";
const SHARE_LIVE_LOCATION_KEY_PREFIX = "jam.shareLiveLocation:";
const NEAR_ME_LIVE_LOCATION_NOTICE_KEY_PREFIX = "jam.nearMeLiveLocationNoticeSeen:";
const MIN_PUBLISH_INTERVAL_MS = 30_000;
const MIN_PUBLISH_DISTANCE_MILES = 0.06;

/** First-time Near Me disclosure — keep in sync with Settings copy. */
export const NEAR_ME_LIVE_LOCATION_NOTICE_TITLE = "near me shares your location";
export const NEAR_ME_LIVE_LOCATION_NOTICE_MESSAGE =
  "turning on near me also turns on share live location in settings. while sharing is on, jam. updates your live location so you can find creators nearby — and they can find you. turn sharing off anytime in settings.";

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 100,
  timeInterval: 30_000,
};

const BACKGROUND_UPDATE_OPTIONS: Location.LocationTaskOptions = {
  ...WATCH_OPTIONS,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "Jam.",
    notificationBody: "Sharing your live location with nearby creators.",
  },
};

let foregroundSubscription: Location.LocationSubscription | null = null;
let activeUserId: string | null = null;
let lastPublishAt = 0;
let lastPublishedLatitude: number | null = null;
let lastPublishedLongitude: number | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let persistingOnBackground = false;

function getSharePreferenceKey(userId: string) {
  return `${SHARE_LIVE_LOCATION_KEY_PREFIX}${userId}`;
}

async function hasAlwaysLocationAccess() {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);

  return foreground.ios?.scope === "always" || background.granted;
}

function shouldPublishLocation(latitude: number, longitude: number, force: boolean) {
  if (force) return true;

  const now = Date.now();
  if (now - lastPublishAt < MIN_PUBLISH_INTERVAL_MS) {
    if (lastPublishedLatitude == null || lastPublishedLongitude == null) {
      return true;
    }

    const movedMiles = getDistanceInMiles(
      lastPublishedLatitude,
      lastPublishedLongitude,
      latitude,
      longitude,
    );
    return movedMiles >= MIN_PUBLISH_DISTANCE_MILES;
  }

  return true;
}

async function publishLiveLocation(
  userId: string,
  latitude: number,
  longitude: number,
  force = false,
) {
  if (!shouldPublishLocation(latitude, longitude, force)) return;

  await updateLiveLocation(userId, { latitude, longitude });
  lastPublishAt = Date.now();
  lastPublishedLatitude = latitude;
  lastPublishedLongitude = longitude;
}

async function getActiveSharingUserId() {
  if (activeUserId) return activeUserId;

  const keys = await AsyncStorage.getAllKeys();
  const shareKey = keys.find((key) => key.startsWith(SHARE_LIVE_LOCATION_KEY_PREFIX));
  if (!shareKey) return null;

  const enabled = await AsyncStorage.getItem(shareKey);
  if (enabled !== "1") return null;

  return shareKey.slice(SHARE_LIVE_LOCATION_KEY_PREFIX.length);
}

async function stopForegroundWatch() {
  foregroundSubscription?.remove();
  foregroundSubscription = null;
}

async function stopBackgroundUpdates() {
  const started = await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME);
  }
}

/**
 * For "while using the app" permission, tracking stops when the app leaves the
 * foreground. Persist the freshest fix we can so near-me still finds this user
 * from their last known live location until they turn sharing off.
 */
async function persistLastKnownLiveLocation(userId: string) {
  if (persistingOnBackground) return;
  persistingOnBackground = true;

  try {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await publishLiveLocation(
        userId,
        position.coords.latitude,
        position.coords.longitude,
        true,
      );
      return;
    } catch {
      // Fall through to last in-memory fix when GPS is unavailable mid-exit.
    }

    if (lastPublishedLatitude != null && lastPublishedLongitude != null) {
      await publishLiveLocation(userId, lastPublishedLatitude, lastPublishedLongitude, true);
    }
  } finally {
    persistingOnBackground = false;
  }
}

async function startForegroundWatch(userId: string) {
  await stopForegroundWatch();

  foregroundSubscription = await Location.watchPositionAsync(WATCH_OPTIONS, (location) => {
    void publishLiveLocation(userId, location.coords.latitude, location.coords.longitude).catch(
      () => undefined,
    );
  });
}

async function startBackgroundUpdates() {
  await stopForegroundWatch();

  const started = await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME);
  if (!started) {
    await Location.startLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME, BACKGROUND_UPDATE_OPTIONS);
  }
}

async function startLocationTracking(userId: string) {
  activeUserId = userId;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const profile = await updateLiveLocation(userId, {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
  lastPublishAt = Date.now();
  lastPublishedLatitude = position.coords.latitude;
  lastPublishedLongitude = position.coords.longitude;

  const alwaysAccess = await hasAlwaysLocationAccess();
  if (alwaysAccess) {
    await startBackgroundUpdates();
  } else if (AppState.currentState === "active") {
    await startForegroundWatch(userId);
  }

  return profile;
}

async function stopLocationTracking() {
  activeUserId = null;
  lastPublishAt = 0;
  lastPublishedLatitude = null;
  lastPublishedLongitude = null;
  await stopForegroundWatch();
  await stopBackgroundUpdates();
}

async function handleAppStateChange(nextState: AppStateStatus) {
  const userId = await getActiveSharingUserId();
  if (!userId) return;

  if (await hasAlwaysLocationAccess()) return;

  if (nextState === "active") {
    await startForegroundWatch(userId);
    return;
  }

  // Leaving the app with while-using permission: save last fix, then stop watching.
  // Stored live_latitude / live_longitude stay until share live location is turned off.
  await persistLastKnownLiveLocation(userId).catch(() => undefined);
  await stopForegroundWatch();
}

function ensureAppStateListener() {
  if (appStateSubscription) return;

  appStateSubscription = AppState.addEventListener("change", (nextState) => {
    void handleAppStateChange(nextState);
  });
}

TaskManager.defineTask(LIVE_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const userId = await getActiveSharingUserId();
  if (!userId) return;

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  await publishLiveLocation(userId, latest.coords.latitude, latest.coords.longitude);
});

ensureAppStateListener();

export async function isLiveLocationSharingEnabled(userId: string) {
  return (await AsyncStorage.getItem(getSharePreferenceKey(userId))) === "1";
}

function getNearMeLiveLocationNoticeKey(userId: string) {
  return `${NEAR_ME_LIVE_LOCATION_NOTICE_KEY_PREFIX}${userId}`;
}

export async function hasSeenNearMeLiveLocationNotice(userId: string) {
  return (await AsyncStorage.getItem(getNearMeLiveLocationNoticeKey(userId))) === "1";
}

export async function markNearMeLiveLocationNoticeSeen(userId: string) {
  await AsyncStorage.setItem(getNearMeLiveLocationNoticeKey(userId), "1");
}

export async function enableLiveLocationSharing(
  userId: string,
): Promise<{ profile: Profile } | { error: string }> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { error: "turn on location access to share your live location." };
  }

  await Location.requestBackgroundPermissionsAsync();

  await AsyncStorage.setItem(getSharePreferenceKey(userId), "1");

  try {
    const profile = await startLocationTracking(userId);
    return { profile };
  } catch (err) {
    await AsyncStorage.removeItem(getSharePreferenceKey(userId));
    await stopLocationTracking();
    return {
      error: err instanceof Error ? err.message : "could not start live location sharing.",
    };
  }
}

export async function disableLiveLocationSharing(userId: string) {
  await AsyncStorage.removeItem(getSharePreferenceKey(userId));
  await stopLocationTracking();
  // Only explicit opt-out clears stored live coords so offline near-me stops matching.
  return updateLiveLocation(userId, null);
}

/**
 * Sign-out path: stop local GPS tracking, but keep the last live fix + share
 * preference so this user can still appear in others' near-me feeds (until TTL
 * or they turn sharing off).
 */
export async function pauseLiveLocationSharingOnLogout(userId: string) {
  if (await isLiveLocationSharingEnabled(userId)) {
    await persistLastKnownLiveLocation(userId).catch(() => undefined);
  }
  await stopLocationTracking();
}

export async function resumeLiveLocationSharingIfEnabled(userId: string) {
  if (!(await isLiveLocationSharingEnabled(userId))) return null;

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    // Keep the last stored live location for near-me; only stop local tracking.
    await stopLocationTracking();
    return null;
  }

  try {
    return await startLocationTracking(userId);
  } catch {
    return null;
  }
}
