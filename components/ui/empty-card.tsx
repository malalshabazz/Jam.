import { Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.helper}>{text}</Text>
    </View>
  );
}
