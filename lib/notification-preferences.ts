import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATION_PREFERENCES_KEY = "jam.notificationPreferences.v1";

export type CategoryAlertSubscription = {
  role: string;
  genre: string;
};

export type NotificationPreferences = {
  inAppNotifications: boolean;
  jamRequests: boolean;
  jamAccepts: boolean;
  messages: boolean;
  categoryAlerts: CategoryAlertSubscription[];
};

export function formatCategoryAlertLabel(subscription: CategoryAlertSubscription) {
  if (!subscription.genre) return subscription.role;
  return `${subscription.role} · ${subscription.genre}`;
}

export function categoryAlertKey(subscription: CategoryAlertSubscription) {
  return `${subscription.role.toLowerCase()}|${subscription.genre.toLowerCase()}`;
}

export function isRoleOnlyCategoryAlert(subscription: CategoryAlertSubscription) {
  return subscription.role.length > 0 && subscription.genre.length === 0;
}

export function isDuplicateCategoryAlert(
  subscriptions: CategoryAlertSubscription[],
  candidate: CategoryAlertSubscription,
) {
  const key = categoryAlertKey(candidate);
  return subscriptions.some((item) => categoryAlertKey(item) === key);
}

export function getDefaultNotificationPreferences(): NotificationPreferences {
  return {
    inAppNotifications: true,
    jamRequests: true,
    jamAccepts: true,
    messages: true,
    categoryAlerts: [],
  };
}

function normalizeCategoryAlerts(value: unknown): CategoryAlertSubscription[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const role = "role" in item && typeof item.role === "string" ? item.role.trim() : "";
    const genre = "genre" in item && typeof item.genre === "string" ? item.genre.trim() : "";
    if (!role) return [];
    return [{ role, genre }];
  });
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const defaults = getDefaultNotificationPreferences();
  const raw = await AsyncStorage.getItem(`${NOTIFICATION_PREFERENCES_KEY}.${userId}`);
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      ...defaults,
      ...parsed,
      inAppNotifications:
        typeof parsed.inAppNotifications === "boolean"
          ? parsed.inAppNotifications
          : defaults.inAppNotifications,
      jamRequests: typeof parsed.jamRequests === "boolean" ? parsed.jamRequests : defaults.jamRequests,
      jamAccepts: typeof parsed.jamAccepts === "boolean" ? parsed.jamAccepts : defaults.jamAccepts,
      messages: typeof parsed.messages === "boolean" ? parsed.messages : defaults.messages,
      categoryAlerts: normalizeCategoryAlerts(parsed.categoryAlerts),
    };
  } catch {
    return defaults;
  }
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  await AsyncStorage.setItem(`${NOTIFICATION_PREFERENCES_KEY}.${userId}`, JSON.stringify(preferences));
}
