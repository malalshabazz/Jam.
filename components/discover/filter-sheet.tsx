import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { creatorRoles, musicGenres } from "@/lib/options";
import {
  encodeLocationFilter,
  formatLocationSelection,
  locationPlaceToSelection,
  locationSelectionKey,
  parseLocationFilter,
} from "@/lib/location-filter";
import { useLocationSearch } from "@/lib/use-location-search";
import { viewportHeight } from "@/theme/tokens";
import { darkStyles, styles } from "@/theme/styles";
import type { LocationFilterSelection } from "@/types/app";
import { ChipRow } from "@/components/ui/chip-row";
import { LocationSearchResults } from "@/components/ui/location-search-results";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SectionLabel } from "@/components/ui/section-label";
import { FilterQueryField } from "@/components/ui/filter-query-field";
import { SuggestionList } from "@/components/ui/suggestion-list";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import { useSuggestions } from "@/lib/use-suggestions";

export type FilterSheetSectionKey = "role" | "genre" | "location";

export function FilterSheet({
  visible,
  selectedRoles,
  selectedGenres,
  selectedLocation,
  lookingForActive = false,
  showLookingFor = false,
  includeGenres = true,
  onClose,
  onApply,
}: {
  visible: boolean;
  selectedRoles: string[];
  selectedGenres: string[];
  selectedLocation: string;
  /** Applied looking-for state; draft until Apply. */
  lookingForActive?: boolean;
  /** When true, shows the looking-for control (discover + inbox). */
  showLookingFor?: boolean;
  includeGenres?: boolean;
  onClose: () => void;
  onApply: (roles: string[], genres: string[], location: string, lookingFor: boolean) => void;
}) {
  const [roles, setRoles] = useState(selectedRoles);
  const [genres, setGenres] = useState(selectedGenres);
  const [lookingForDraft, setLookingForDraft] = useState(Boolean(lookingForActive));
  const [roleQuery, setRoleQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [locationSelections, setLocationSelections] = useState<LocationFilterSelection[]>(() => parseLocationFilter(selectedLocation));
  const [locationQuery, setLocationQuery] = useState("");
  const [mounted, setMounted] = useState(visible);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const sheetOffscreen = Math.max(viewportHeight, 640);
  const translateY = useRef(new Animated.Value(-sheetOffscreen)).current;
  const shadeOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const openingRef = useRef(false);
  const wasVisibleRef = useRef(visible);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const sectionLayoutsRef = useRef<Partial<Record<FilterSheetSectionKey, { y: number; height: number }>>>({});
  const focusedSectionRef = useRef<FilterSheetSectionKey | null>(null);
  const ensureSectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  function clearEnsureSectionTimer() {
    if (ensureSectionTimerRef.current == null) return;
    clearTimeout(ensureSectionTimerRef.current);
    ensureSectionTimerRef.current = null;
  }

  function ensureSectionVisible(section: FilterSheetSectionKey, delayMs = 0) {
    clearEnsureSectionTimer();
    const run = () => {
      ensureSectionTimerRef.current = null;
      const layout = sectionLayoutsRef.current[section];
      const viewportHeightForScroll = scrollViewportHeightRef.current;
      if (!layout || viewportHeightForScroll <= 0) return;

      const padding = 8;
      const visibleTop = scrollOffsetYRef.current;
      const visibleBottom = visibleTop + viewportHeightForScroll;
      const sectionTop = layout.y;
      const sectionBottom = layout.y + layout.height;
      if (sectionTop >= visibleTop + padding && sectionBottom <= visibleBottom - padding) return;

      const maxScrollY = Math.max(0, sectionBottom - viewportHeightForScroll + padding);
      const targetY = Math.min(Math.max(0, sectionTop - padding), maxScrollY);
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    };

    if (delayMs <= 0) {
      requestAnimationFrame(run);
      return;
    }
    ensureSectionTimerRef.current = setTimeout(run, delayMs);
  }

  function syncDraftFromProps() {
    setRoles(selectedRoles);
    setGenres(includeGenres ? selectedGenres : []);
    setLookingForDraft(Boolean(lookingForActive));
    const nextLocationSelections = parseLocationFilter(selectedLocation);
    setLocationSelections(nextLocationSelections);
    setLocationQuery("");
    setRoleQuery("");
    setGenreQuery("");
    focusedSectionRef.current = null;
    scrollOffsetYRef.current = 0;
    sectionLayoutsRef.current = {};
  }

  function runOpenAnimation() {
    if (openingRef.current || closingRef.current) return;
    openingRef.current = true;
    translateY.stopAnimation();
    shadeOpacity.stopAnimation();
    translateY.setValue(-sheetOffscreen);
    shadeOpacity.setValue(0);
    // Wait one frame so the off-screen position paints before sliding in.
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(shadeOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) openingRef.current = false;
      });
    });
  }

  function closeWithAnimation(onComplete = onClose) {
    if (closingRef.current) return;
    closingRef.current = true;
    openingRef.current = false;
    translateY.stopAnimation();
    shadeOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -sheetOffscreen,
        duration: 280,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(shadeOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      closingRef.current = false;
      onComplete();
    });
  }

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    const justClosed = !visible && wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (justOpened) {
      closingRef.current = false;
      syncDraftFromProps();
      setMounted(true);
      return;
    }

    if (justClosed && mounted && !closingRef.current) {
      closeWithAnimation(() => onClose());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/close edges only
  }, [visible]);

  useLayoutEffect(() => {
    if (!mounted || !visible || closingRef.current) return;
    runOpenAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when sheet mounts open
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      setKeyboardOffset(0);
      focusedSectionRef.current = null;
      clearEnsureSectionTimer();
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(Math.max(0, viewportHeight - event.endCoordinates.screenY));
      const focused = focusedSectionRef.current;
      if (focused) {
        ensureSectionVisible(focused, Platform.OS === "ios" ? 80 : 40);
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
      focusedSectionRef.current = null;
      clearEnsureSectionTimer();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearEnsureSectionTimer();
    };
  }, [mounted]);

  const roleMatches = useSuggestions(creatorRoles, roleQuery, roles);
  const genreMatches = useSuggestions(musicGenres, genreQuery, genres);
  const { results: locationResults, status: locationSearchStatus } = useLocationSearch(locationQuery);
  const selectedLocationCount = locationSelections.length;
  const selectedLocationLabels = locationSelections.map(
    (selection) => formatLocationSelection(selection) ?? selection.country,
  );

  function addLocationPlace(place: Parameters<typeof locationPlaceToSelection>[0]) {
    const next = locationPlaceToSelection(place);
    const nextKey = locationSelectionKey(next);
    setLocationSelections((current) => {
      if (current.some((selection) => locationSelectionKey(selection) === nextKey)) return current;
      return [...current, next];
    });
    setLocationQuery("");
  }

  function removeLocationLabel(label: string) {
    setLocationSelections((current) =>
      current.filter((selection) => (formatLocationSelection(selection) ?? selection.country) !== label),
    );
  }

  function resetRoles() {
    setRoles([]);
    setRoleQuery("");
  }

  function resetGenres() {
    setGenres([]);
    setGenreQuery("");
  }

  function resetLocations() {
    setLocationSelections([]);
    setLocationQuery("");
  }

  if (!mounted) return null;

  return (
    <Modal animationType="none" visible={mounted} transparent onRequestClose={() => closeWithAnimation()}>
      <Animated.View style={[styles.modalShade, { opacity: shadeOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeWithAnimation()} />
      </Animated.View>
      <Animated.View
        style={[
          styles.topSheet,
          {
            paddingTop: Math.max(insets.top + 18, 34),
            maxHeight: Math.max(
              320,
              viewportHeight - keyboardOffset - Math.max(insets.bottom + 12, 24),
            ),
            transform: [{ translateY }],
          },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.topSheetScroll}
          contentContainerStyle={styles.topSheetScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onLayout={(event) => {
            scrollViewportHeightRef.current = event.nativeEvent.layout.height;
          }}
          onScroll={(event) => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {showLookingFor ? (
            <View style={styles.filterLookingForRow}>
              <Pressable
                style={styles.filterLookingForControl}
                onPress={() => setLookingForDraft((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel="looking for collaborators"
                accessibilityState={{ selected: lookingForDraft }}
              >
                <Text style={styles.filterLookingForLabel}>looking for?</Text>
                <View
                  style={[
                    styles.filterLookingForIconSlot,
                    lookingForDraft && styles.feedNearMeButtonActive,
                  ]}
                >
                  <LookingForIcon active={lookingForDraft} size={22} />
                </View>
              </Pressable>
            </View>
          ) : null}
          <View
            style={styles.filterSheetSection}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              sectionLayoutsRef.current.role = { y, height };
              if (focusedSectionRef.current === "role") ensureSectionVisible("role");
            }}
          >
            <SectionLabel label="role" light />
            <ChipRow items={roles} onRemove={(item) => setRoles((current) => current.filter((role) => role !== item))} />
            <FilterQueryField
              value={roleQuery}
              onChangeText={setRoleQuery}
              placeholder="type to filter roles..."
              onReset={resetRoles}
              onFocus={() => {
                focusedSectionRef.current = "role";
                ensureSectionVisible("role", Platform.OS === "ios" ? 280 : 120);
              }}
            />
            <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
              setRoles((current) => [...current, role]);
              setRoleQuery("");
            }} />
            <Text style={styles.helper}>{roles.length === 0 ? "no role selection" : ""}</Text>
          </View>
          {includeGenres ? (
            <View
              style={styles.filterSheetSection}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                sectionLayoutsRef.current.genre = { y, height };
                if (focusedSectionRef.current === "genre") ensureSectionVisible("genre");
              }}
            >
              <SectionLabel label="genre" light />
              <ChipRow items={genres} onRemove={(item) => setGenres((current) => current.filter((genre) => genre !== item))} />
              <FilterQueryField
                value={genreQuery}
                onChangeText={setGenreQuery}
                placeholder="type to filter genres..."
                onReset={resetGenres}
                onFocus={() => {
                  focusedSectionRef.current = "genre";
                  ensureSectionVisible("genre", Platform.OS === "ios" ? 280 : 120);
                }}
              />
              <SuggestionList items={genreMatches} maxVisibleItems={3} onPick={(genre) => {
                setGenres((current) => [...current, genre]);
                setGenreQuery("");
              }} />
              <Text style={styles.helper}>{genres.length === 0 ? "no genre selection" : ""}</Text>
            </View>
          ) : null}
          <View
            style={styles.filterSheetSection}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              sectionLayoutsRef.current.location = { y, height };
              if (focusedSectionRef.current === "location") ensureSectionVisible("location");
            }}
          >
            <SectionLabel label="location" light />
            <ChipRow items={selectedLocationLabels} onRemove={removeLocationLabel} />
            <FilterQueryField
              value={locationQuery}
              onChangeText={setLocationQuery}
              placeholder="search city, region, or country"
              onReset={resetLocations}
              onFocus={() => {
                focusedSectionRef.current = "location";
                ensureSectionVisible("location", Platform.OS === "ios" ? 280 : 120);
              }}
            />
            <LocationSearchResults
              query={locationQuery}
              results={locationResults}
              status={locationSearchStatus}
              onPick={addLocationPlace}
              listStyle={darkStyles.locationFilterList}
              rowStyle={darkStyles.locationOptionRow}
              textStyle={darkStyles.locationCountryText}
            />
            <Text style={styles.helper}>
              {selectedLocationCount === 0
                ? "no location selection — anywhere"
                : `${selectedLocationCount} location ${selectedLocationCount === 1 ? "selection" : "selections"}`}
            </Text>
          </View>
        </ScrollView>
        <PrimaryButton
          label="apply"
          onPress={() =>
            closeWithAnimation(() =>
              onApply(
                roles,
                includeGenres ? genres : [],
                encodeLocationFilter(locationSelections),
                lookingForDraft,
              ),
            )
          }
        />
      </Animated.View>
    </Modal>
  );
}
