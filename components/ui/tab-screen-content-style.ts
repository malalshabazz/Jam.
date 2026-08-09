import { TAB_SCREEN_MIN_TOP_PADDING, TAB_SCREEN_TOP_PADDING } from "@/theme/tokens";
import { styles } from "@/theme/styles";

export function getTabScreenContentStyle(topInset: number) {
  return [
    styles.screenContent,
    { paddingTop: Math.max(topInset + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING) },
  ];
}
