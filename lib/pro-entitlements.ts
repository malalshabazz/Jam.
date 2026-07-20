export const PRO_UNLOCK_VIDEO_COUNT = 3;
export const FREE_MAX_VIDEO_SECONDS = 45;
export const PRO_MAX_VIDEO_SECONDS = 90;

export type ProBadgeKind = "gold" | "blue";

export type ProEntitlementInput = {
  earlyAdopter?: boolean | null;
  videoCount?: number | null;
  proSubscriptionActive?: boolean | null;
};

export function hasProFeatures({
  earlyAdopter = false,
  videoCount = 0,
  proSubscriptionActive = false,
}: ProEntitlementInput) {
  if (proSubscriptionActive) return true;
  return Boolean(earlyAdopter) && (videoCount ?? 0) >= PRO_UNLOCK_VIDEO_COUNT;
}

export function getProBadgeKind({
  earlyAdopter = false,
  videoCount = 0,
  proSubscriptionActive = false,
}: ProEntitlementInput): ProBadgeKind | null {
  if (proSubscriptionActive) return "blue";
  if (Boolean(earlyAdopter) && (videoCount ?? 0) >= PRO_UNLOCK_VIDEO_COUNT) return "gold";
  return null;
}

export function shouldShowProProgress({
  earlyAdopter = false,
  videoCount = 0,
  proSubscriptionActive = false,
}: ProEntitlementInput) {
  return (
    Boolean(earlyAdopter) &&
    !proSubscriptionActive &&
    (videoCount ?? 0) < PRO_UNLOCK_VIDEO_COUNT
  );
}

export function getAllowedMaxVideoSeconds(input: ProEntitlementInput) {
  return hasProFeatures(input) ? PRO_MAX_VIDEO_SECONDS : FREE_MAX_VIDEO_SECONDS;
}
