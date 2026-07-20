import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, type AppStateStatus } from "react-native";
import { getDistanceInMiles } from "@/lib/location-distance";
import { updateLiveLocation, type Profile } from "@/lib/native-social-data";

export const LIVE_LOCATION_TASK_NAME = "jam-live-location-updates";
const SHARE_LIVE_LOCATION_KEY_PREFIX = "jam.shareLiveLocation:";
const MIN_PUBLISH_INTERVAL_MS = 30_000;
const MIN_PUBLISH_DISTANCE_MILES = 0.06;

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

function shouldPublishLocation(latitude: number, longitude: number) {
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

async function publishLiveLocation(userId: string, latitude: number, longitude: number) {
  if (!shouldPublishLocation(latitude, longitude)) return;

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
  return updateLiveLocation(userId, null);
}

export async function resumeLiveLocationSharingIfEnabled(userId: string) {
  if (!(await isLiveLocationSharingEnabled(userId))) return null;

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    await disableLiveLocationSharing(userId);
    return null;
  }

  try {
    return await startLocationTracking(userId);
  } catch {
    return null;
  }
}
