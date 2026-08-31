import { Pressable, Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function OwnVideoActionsBar({
  onDelete,
  onEdit,
  onShare,
  onInsights,
  insightsLocked = false,
}: {
  onDelete: () => void;
  onEdit: () => void;
  onShare: () => void;
  onInsights: () => void;
  insightsLocked?: boolean;
}) {
  return (
    <View style={styles.ownVideoActionsBar}>
      <ActionButton label="delete" onPress={onDelete} danger />
      <ActionButton label="edit" onPress={onEdit} />
      <ActionButton label="share" onPress={onShare} />
      <ActionButton
        label="insights"
        onPress={onInsights}
        badge={insightsLocked ? "pro" : null}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  danger = false,
  badge = null,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      pointerEvents="auto"
      hitSlop={6}
      style={styles.ownVideoActionButton}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      <Text style={[styles.ownVideoActionLabel, danger ? styles.ownVideoActionDanger : null]}>
        {label}
      </Text>
      {badge ? <Text style={styles.ownVideoActionBadge}>{badge}</Text> : null}
    </Pressable>
  );
}
