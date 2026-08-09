import { Pressable, Text, View } from "react-native";
import { getUniqueStrings } from "@/lib/format";
import { styles } from "@/theme/styles";

export function ChipRow({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  const uniqueItems = getUniqueStrings(items);
  if (uniqueItems.length === 0) return null;
  return (
    <View style={styles.chips}>
      {uniqueItems.map((item) => (
        <Pressable key={item} style={styles.chip} onPress={() => onRemove(item)}>
          <Text style={styles.chipText}>{item} ×</Text>
        </Pressable>
      ))}
    </View>
  );
}
