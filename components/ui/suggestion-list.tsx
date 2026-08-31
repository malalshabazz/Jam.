import { Pressable, ScrollView, Text } from "react-native";
import { darkStyles } from "@/theme/styles";

export function SuggestionList({
  items,
  onPick,
  maxVisibleItems,
}: {
  items: readonly string[];
  onPick: (item: string) => void;
  maxVisibleItems?: number;
}) {
  if (items.length === 0) return null;
  const visibleCount = maxVisibleItems
    ? Math.min(items.length, maxVisibleItems)
    : Math.min(items.length, 7);
  const listMaxHeight = visibleCount * 45;

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={[darkStyles.suggestionList, { maxHeight: listMaxHeight }]}
    >
      {items.map((item, index) => (
        <Pressable key={`${item}-${index}`} style={darkStyles.suggestionItem} onPress={() => onPick(item)}>
          <Text style={darkStyles.suggestionText}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
