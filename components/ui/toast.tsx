import { useEffect } from "react";
import { Text, View } from "react-native";
import { styles } from "@/theme/styles";

const DEFAULT_TOAST_MS = 2400;

export function Toast({
  text,
  durationMs = DEFAULT_TOAST_MS,
  onDismiss,
}: {
  text: string;
  /** Auto-hide after this many ms. Pass 0 to keep sticky. */
  durationMs?: number;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (durationMs <= 0 || !onDismiss) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [text, durationMs, onDismiss]);

  return (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
}
