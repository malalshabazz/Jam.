import { Text, View } from "react-native";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import { getUniqueVideoTags, normalizeVideoTag } from "@/lib/feed-filters";
import { styles } from "@/theme/styles";

export function FeedLookingForRow({
  lookingFor,
  roles = [],
  genres = [],
  activeFilterTags,
}: {
  lookingFor: boolean;
  roles?: readonly string[];
  genres?: readonly string[];
  activeFilterTags?: ReadonlySet<string>;
}) {
  if (!lookingFor) return null;

  const tags = getUniqueVideoTags([...roles, ...genres]);

  return (
    <View style={styles.feedLookingForRow} accessibilityLabel="looking for collaborators">
      <View style={styles.feedLookingForIcon}>
        <LookingForIcon active size={19} shadow />
      </View>
      {tags.length > 0 ? (
        <View style={styles.feedLookingForTags}>
          {tags.map((tag, index) => {
            const highlighted = Boolean(activeFilterTags?.has(normalizeVideoTag(tag)));
            const label = index < tags.length - 1 ? `${tag},` : tag;
            return (
              <View key={`${tag}-${index}`} style={styles.feedLookingForTagWrap}>
                <Text
                  style={[
                    styles.feedLookingForTagGlow,
                    highlighted ? styles.feedLookingForTagGlowHighlighted : null,
                  ]}
                >
                  {label}
                </Text>
                <Text style={styles.feedLookingForTag}>{label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
