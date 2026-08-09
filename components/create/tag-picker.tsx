import { Pressable, Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function TagPicker({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.categoryGrid}>
      {options.map((tag, index) => {
        const active = selected.includes(tag);
        return (
          <Pressable
            key={`${tag}-${index}`}
            onPress={() => onToggle(tag)}
            style={[styles.categoryOption, active && styles.categoryOptionActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}>
              {tag}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
