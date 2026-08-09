import {
  NAV_BAR_HEIGHT,
  NAV_BAR_ITEM_HEIGHT,
  NAV_BAR_TOP_PADDING,
} from "@/theme/tokens";

export function getNavBarHeight(bottomInset: number) {
  return Math.max(
    NAV_BAR_HEIGHT,
    NAV_BAR_ITEM_HEIGHT + NAV_BAR_TOP_PADDING + Math.max(bottomInset, 12),
  );
}
