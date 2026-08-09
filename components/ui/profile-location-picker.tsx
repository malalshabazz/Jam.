import { useMemo } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ChipRow } from "@/components/ui/chip-row";
import {
  LOCATION_FILTER_COUNTRIES,
  formatProfileLocation,
  getCountrySearchText,
  normalizeLocationText,
} from "@/lib/location-filter";
import type { LocationCountryOption } from "@/types/app";
import { LOCATION_PICKER_VISIBLE_HEIGHT } from "@/theme/tokens";
import { styles } from "@/theme/styles";

export function ProfileLocationPicker({
  country,
  city,
  query,
  onQueryChange,
  onChange,
  onSearchFocus,
}: {
  country: string;
  city: string;
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (country: string, city: string) => void;
  onSearchFocus?: () => void;
}) {
  const countryMatches = useMemo(() => {
    const normalizedQuery = normalizeLocationText(query);
    return LOCATION_FILTER_COUNTRIES.filter((option) => !normalizedQuery || getCountrySearchText(option).includes(normalizedQuery));
  }, [query]);
  const selectedLabel = formatProfileLocation(country, city);

  function toggleCountry(option: LocationCountryOption) {
    if (country === option.country && !city) {
      onChange("", "");
      return;
    }

    onChange(option.country, "");
  }

  function toggleCity(option: LocationCountryOption, nextCity: string) {
    if (country === option.country && city === nextCity) {
      onChange(option.country, "");
      return;
    }

    onChange(option.country, nextCity);
  }

  return (
    <View style={styles.profileLocationPicker}>
      <ChipRow items={selectedLabel ? [selectedLabel] : []} onRemove={() => onChange("", "")} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        onFocus={onSearchFocus}
        placeholder="search countries..."
        placeholderTextColor="#71717a"
        style={styles.input}
      />
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={[
          styles.locationFilterList,
          { maxHeight: LOCATION_PICKER_VISIBLE_HEIGHT },
        ]}
      >
        {countryMatches.map((option) => {
          const isSelectedCountry = country === option.country;
          const hasSelectedCity = isSelectedCountry && Boolean(city);

          return (
            <View key={option.country} style={styles.locationCountryGroup}>
              <Pressable style={styles.locationOptionRow} onPress={() => toggleCountry(option)}>
                <View
                  style={[
                    styles.locationCircle,
                    isSelectedCountry && !hasSelectedCity && styles.locationCircleSelected,
                    hasSelectedCity && styles.locationCirclePartial,
                  ]}
                >
                  {hasSelectedCity && <View style={styles.locationCirclePartialFill} />}
                </View>
                <Text style={styles.locationCountryText}>{option.country}</Text>
              </Pressable>
              {isSelectedCountry && (
                <View style={styles.locationCityList}>
                  {option.cities.map((cityOption) => {
                    const isCitySelected = city === cityOption;
                    return (
                      <Pressable key={cityOption} style={styles.locationCityRow} onPress={() => toggleCity(option, cityOption)}>
                        <View style={[styles.locationCityCircle, isCitySelected && styles.locationCircleSelected]} />
                        <Text style={styles.locationCityText}>{cityOption}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.helper}>{selectedLabel ? "city is optional — country-only shows your whole country" : "no selection — anywhere"}</Text>
    </View>
  );
}
