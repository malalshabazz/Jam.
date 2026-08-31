import { Pressable, ScrollView, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { LocationSearchStatus } from "@/lib/use-location-search";
import { LOCATION_SEARCH_MIN_LENGTH } from "@/lib/use-location-search";
import type { LocationPlace } from "@/types/app";
import { LOCATION_PICKER_VISIBLE_HEIGHT } from "@/theme/tokens";
import { styles } from "@/theme/styles";

export function LocationSearchResults({
  query,
  results,
  status,
  onPick,
  listStyle,
  rowStyle,
  textStyle,
}: {
  query: string;
  results: LocationPlace[];
  status: LocationSearchStatus;
  onPick: (place: LocationPlace) => void;
  listStyle?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const trimmed = query.trim();
  if (trimmed.length < LOCATION_SEARCH_MIN_LENGTH && status === "idle") {
    return null;
  }

  if (status === "loading") {
    return <Text style={styles.helper}>searching...</Text>;
  }

  if (status === "error") {
    return <Text style={styles.helper}>could not search locations</Text>;
  }

  if (status === "empty") {
    return <Text style={styles.helper}>no matches found</Text>;
  }

  if (results.length === 0) return null;

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={[styles.locationFilterList, { maxHeight: LOCATION_PICKER_VISIBLE_HEIGHT }, listStyle]}
    >
      {results.map((place) => (
        <Pressable
          key={`${place.granularity}:${place.country_code}:${place.region}:${place.city}:${place.label}`}
          style={[styles.locationOptionRow, rowStyle]}
          onPress={() => onPick(place)}
        >
          <Text style={[styles.locationCountryText, textStyle]}>{place.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
