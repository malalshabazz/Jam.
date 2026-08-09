import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function ProfileJamButton({
  label,
  jamming,
  showCancel = false,
  disabled,
  onPress,
  onCancelPress,
}: {
  label: string;
  jamming: boolean;
  showCancel?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onCancelPress?: (anchor: { x: number; y: number }) => void;
}) {
  const cancelButtonRef = useRef<View>(null);

  return (
    <View style={[styles.profileJamRow, disabled && !jamming && styles.disabled]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.profileJamButton, jamming && styles.profileJamButtonJamming]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.profileJamButtonText,
            jamming && styles.profileJamButtonTextJamming,
          ]}
        >
          {label}
        </Text>
      </Pressable>
      {showCancel ? (
        <Pressable
          ref={cancelButtonRef}
          onPress={() => {
            cancelButtonRef.current?.measureInWindow((x, y, width, height) => {
              onCancelPress?.({ x: x + width / 2, y: y + height });
            });
          }}
          style={styles.profileJamCancelButton}
          accessibilityRole="button"
          accessibilityLabel={jamming ? "unjam" : "cancel jam"}
          hitSlop={6}
        >
          <Text style={styles.profileJamCancelIcon}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
