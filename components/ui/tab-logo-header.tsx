import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function TabLogoHeader({
  right,
  center,
}: {
  right?: ReactNode;
  center?: ReactNode;
}) {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.logoSmall}>jam.</Text>
      <View style={styles.headerCenterSlot} pointerEvents="box-none">
        {center}
      </View>
      {right ?? <View style={styles.headerSpacer} />}
    </View>
  );
}
