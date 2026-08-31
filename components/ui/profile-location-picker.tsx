import { Text, TextInput, View } from "react-native";
import { ChipRow } from "@/components/ui/chip-row";
import { LocationSearchResults } from "@/components/ui/location-search-results";
import { formatProfileLocation } from "@/lib/location-filter";
import { useLocationSearch } from "@/lib/use-location-search";
import type { LocationPlace } from "@/types/app";
import { styles } from "@/theme/styles";

export function ProfileLocationPicker({
  place,
  query,
  onQueryChange,
  onChange,
  onSearchFocus,
}: {
  place: LocationPlace | null;
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (place: LocationPlace | null) => void;
  onSearchFocus?: () => void;
}) {
  const { results, status } = useLocationSearch(query);
  const selectedLabel =
    place?.label ||
    formatProfileLocation(place?.country ?? "", place?.city ?? "", place?.region) ||
    "";

  return (
    <View style={styles.profileLocationPicker}>
      <ChipRow items={selectedLabel ? [selectedLabel] : []} onRemove={() => onChange(null)} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        onFocus={onSearchFocus}
        placeholder="search city, region, or country"
        placeholderTextColor="#71717a"
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <LocationSearchResults
        query={query}
        results={results}
        status={status}
        onPick={(next) => {
          onChange(next);
          onQueryChange("");
        }}
      />
      <Text style={styles.helper}>
        {selectedLabel
          ? "city, region, or country — broader places stay out of city searches"
          : "type at least 3 letters to search"}
      </Text>
    </View>
  );
}
