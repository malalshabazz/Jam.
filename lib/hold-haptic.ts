import * as Haptics from "expo-haptics";

export function triggerHoldHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
