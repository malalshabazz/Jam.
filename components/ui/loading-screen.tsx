import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { darkStyles, getActivityIndicatorColor, styles } from "@/theme/styles";

export function LoadingScreen({ label, logoOnly = false }: { label: string; logoOnly?: boolean }) {
  // Logo boot screens stay on the dark palette and skip SafeAreaView so the mark
  // doesn't jump when theme hydrates or when the tab bar scene mounts.
  if (logoOnly) {
    return (
      <View style={[darkStyles.feedRoot, darkStyles.centered]}>
        <Text style={darkStyles.logo}>jam.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={getActivityIndicatorColor()} />
        <Text style={styles.helper}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}
