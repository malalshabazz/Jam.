import { Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function TagPicker({
  options,
  selected,
  onToggle,
  compact = false,
  scroll = false,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
  compact?: boolean;
  scroll?: boolean;
}) {
  const pills = options.map((tag, index) => {
    const active = selected.includes(tag);
    return (
      <Pressable
        key={`${tag}-${index}`}
        onPress={() => onToggle(tag)}
        style={[
          styles.categoryOption,
          compact && styles.categoryOptionCompact,
          active && styles.categoryOptionActive,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text
          style={[
            styles.categoryOptionText,
            compact && styles.categoryOptionTextCompact,
            active && styles.categoryOptionTextActive,
          ]}
        >
          {tag}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.categoryRow}
      >
        {pills}
      </ScrollView>
    );
  }

  return <View style={[styles.categoryGrid, compact && styles.categoryGridCompact]}>{pills}</View>;
}
