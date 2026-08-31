import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { darkStyles, getActivityIndicatorColor, styles } from "@/theme/styles";

export function LoadingScreen({
  label,
  logoOnly = false,
  connectionHint = null,
}: {
  label: string;
  logoOnly?: boolean;
  /** Subtle offline cue under the logo (e.g. after waiting with no network). */
  connectionHint?: string | null;
}) {
  // Logo boot screens stay on the dark palette and skip SafeAreaView so the mark
  // doesn't jump when theme hydrates or when the tab bar scene mounts.
  if (logoOnly) {
    return (
      <View style={[darkStyles.feedRoot, darkStyles.centered]}>
        <Text style={darkStyles.logo}>jam.</Text>
        {connectionHint ? (
          <Text style={darkStyles.bootConnectionHint}>{connectionHint}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={getActivityIndicatorColor()} />
        <Text style={styles.helper}>{label}</Text>
        {connectionHint ? <Text style={styles.helper}>{connectionHint}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
