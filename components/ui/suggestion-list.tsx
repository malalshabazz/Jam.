import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { darkStyles, styles } from "@/theme/styles";

const SUGGESTION_ITEM_HEIGHT = 45;
/** Short of a full last row so 3 items never sit flush — wheel peek. */
const WHEEL_PEEK = 0.38;
const TOP_FADE = 14;
const BOTTOM_FADE = 30;

export function SuggestionList({
  items,
  onPick,
  maxVisibleItems,
  flush = false,
}: {
  items: readonly string[];
  onPick: (item: string) => void;
  maxVisibleItems?: number;
  flush?: boolean;
}) {
  if (items.length === 0) return null;
  const slotCount = maxVisibleItems ?? 7;
  const visibleCount = Math.min(items.length, slotCount);
  const showWheelPeek = items.length >= 3 && visibleCount >= 3;
  const listMaxHeight =
    (showWheelPeek ? visibleCount - WHEEL_PEEK : visibleCount) * SUGGESTION_ITEM_HEIGHT;
  const canScroll = items.length * SUGGESTION_ITEM_HEIGHT > listMaxHeight + 0.5;
  const topStop = Math.min(0.18, TOP_FADE / listMaxHeight);
  const bottomStop = Math.min(0.32, BOTTOM_FADE / listMaxHeight);
  const listChrome = flush ? styles.suggestionListFlush : darkStyles.suggestionList;

  const list = (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={canScroll ? { height: listMaxHeight } : { maxHeight: listMaxHeight }}
    >
      {items.map((item, index) => (
        <Pressable
          key={`${item}-${index}`}
          style={flush ? styles.suggestionItemFlush : darkStyles.suggestionItem}
          onPress={() => onPick(item)}
        >
          <View style={flush ? styles.suggestionLabelFlush : darkStyles.suggestionLabel}>
            <Text style={darkStyles.suggestionText}>{item}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );

  if (!canScroll) {
    return <View style={listChrome}>{list}</View>;
  }

  return (
    <View style={[listChrome, { height: listMaxHeight }]}>
      <MaskedView
        style={[styles.suggestionListMask, { height: listMaxHeight }]}
        maskElement={
          <View style={styles.suggestionListMaskFill}>
            <LinearGradient
              colors={["transparent", "#000", "#000", "transparent"]}
              locations={[0, topStop, 1 - bottomStop, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        }
      >
        {list}
      </MaskedView>
    </View>
  );
}
