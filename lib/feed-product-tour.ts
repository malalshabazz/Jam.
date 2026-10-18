import AsyncStorage from "@react-native-async-storage/async-storage";

export const FEED_PRODUCT_TOUR_STEPS = ["filter", "jam"] as const;
export type FeedProductTourStep = (typeof FEED_PRODUCT_TOUR_STEPS)[number];

export type FeedProductTourAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function feedProductTourStorageKey(userId: string) {
  return `feed-product-tour-seen:${userId}`;
}

export async function hasCompletedFeedProductTour(userId: string) {
  const value = await AsyncStorage.getItem(feedProductTourStorageKey(userId));
  return value === "1";
}

export async function markFeedProductTourComplete(userId: string) {
  await AsyncStorage.setItem(feedProductTourStorageKey(userId), "1");
}
