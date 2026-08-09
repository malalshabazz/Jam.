import { Text } from "react-native";
import { styles } from "@/theme/styles";

export function SectionLabel({ label, light }: { label: string; light?: boolean }) {
  return <Text style={[styles.sectionLabel, light && styles.sectionLabelLight]}>{label}</Text>;
}
