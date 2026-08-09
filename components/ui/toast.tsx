import { Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function Toast({ text }: { text: string }) {
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
}
