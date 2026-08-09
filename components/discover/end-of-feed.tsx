import { Pressable, Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function EndOfFeedState({
  filtersActive,
  nearMeActive,
  seenEveryone = false,
  height,
  onCreate,
}: {
  filtersActive: boolean;
  nearMeActive: boolean;
  seenEveryone?: boolean;
  height: number;
  onCreate: () => void;
}) {
  return (
    <View style={[styles.endOfFeed, { height }]}>
      <Text style={styles.emptyText}>
        {getEndOfFeedCopy({ filtersActive, nearMeActive, seenEveryone })}
      </Text>
      {nearMeActive ? null : (
        <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
          <Text style={styles.createNavText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

export function getEndOfFeedCopy({
  filtersActive,
  nearMeActive,
  seenEveryone = false,
}: {
  filtersActive: boolean;
  nearMeActive: boolean;
  seenEveryone?: boolean;
}) {
  if (seenEveryone) {
    if (nearMeActive) return "You've seen everyone nearby — check back soon";
    if (filtersActive) return "You've seen everyone in this filter — check back soon";
    return "You've seen everyone — check back soon for new faces";
  }
  if (nearMeActive) {
    return "No more creators nearby — try expanding your radius in settings";
  }
  return filtersActive
    ? "Try expanding your search — or be one of the first to add to this filter →"
    : "The feed is just getting started — be one of the first faces people see";
}
