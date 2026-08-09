import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageStyle,
} from "react-native";
import { VideoPresentationOverlays } from "@/components/VideoPresentationOverlays";
import {
  ensureFilterCatalogLoaded,
  getFilterPickerOptions,
  subscribeFilterCatalog,
} from "@/lib/video-filters";
import { VIDEO_TEXT_FONT_OPTIONS, type VideoTextFontId } from "@/lib/video-presentation";
import { styles } from "@/theme/styles";
import { CREATE_FILTER_PREVIEW_IMAGE } from "@/theme/tokens";
import type { CreateTextOverlayItem, VideoFilter } from "@/types/app";

export function CreateFilterThumbImage({ uri }: { uri?: string | null }) {
  return (
    <Image
      source={uri ? { uri } : CREATE_FILTER_PREVIEW_IMAGE}
      style={styles.createFilterThumbImage as ImageStyle}
      resizeMode="cover"
      {...(Platform.OS === "android" ? { resizeMethod: "resize" as const } : {})}
    />
  );
}

export function CreateFilterPickerRow({
  selectedFilter,
  onSelect,
  thumbnailUri: _thumbnailUri,
  textOverlays: _textOverlays = [],
  compact = false,
}: {
  selectedFilter: VideoFilter;
  onSelect: (filter: VideoFilter) => void;
  thumbnailUri?: string | null;
  textOverlays?: CreateTextOverlayItem[];
  compact?: boolean;
}) {
  const [filterOptions, setFilterOptions] = useState(getFilterPickerOptions);
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashTokenRef = useRef(0);

  useEffect(() => {
    void ensureFilterCatalogLoaded();
    return subscribeFilterCatalog(() => {
      setFilterOptions(getFilterPickerOptions());
    });
  }, []);

  useEffect(() => {
    return () => {
      flashOpacity.stopAnimation();
    };
  }, [flashOpacity]);

  function flashFilterName(label: string) {
    const token = flashTokenRef.current + 1;
    flashTokenRef.current = token;
    setFlashLabel(label);
    flashOpacity.stopAnimation();
    flashOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || flashTokenRef.current !== token) return;
      setFlashLabel(null);
    });
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.createFilterList, compact && styles.createFilterListCompact]}
      >
        {filterOptions.map((filter) => (
          <Pressable
            key={filter.id}
            style={[styles.createFilterOption, compact && styles.createFilterOptionCompact]}
            onPress={() => {
              onSelect(filter.id);
              flashFilterName(filter.label);
            }}
          >
            <View
              style={[
                styles.createFilterThumbRing,
                compact && styles.createFilterThumbRingCompact,
                selectedFilter === filter.id && styles.createFilterThumbRingActive,
              ]}
            >
              <View style={[styles.createFilterThumbInner, compact && styles.createFilterThumbInnerCompact]}>
                <CreateFilterThumbImage />
                <VideoPresentationOverlays
                  filter={filter.id}
                  textOverlays={[]}
                  density="micro"
                />
              </View>
            </View>
            {!compact ? <Text style={styles.createFilterLabel}>{filter.label}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
      <Modal transparent visible={Boolean(flashLabel)} animationType="none" statusBarTranslucent>
        <View pointerEvents="none" style={styles.createFilterNameFlashRoot}>
          <Animated.Text style={[styles.createFilterNameFlashText, { opacity: flashOpacity }]}>
            {flashLabel}
          </Animated.Text>
        </View>
      </Modal>
    </>
  );
}

export function CreateTextFontPickerRow({
  selectedFontId,
  onSelect,
}: {
  selectedFontId: VideoTextFontId;
  onSelect: (fontId: VideoTextFontId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.createTextFontPickerScroll}
      contentContainerStyle={[styles.createFilterList, styles.createTextFontPickerList]}
    >
      {VIDEO_TEXT_FONT_OPTIONS.map((font) => {
        const selected = selectedFontId === font.id;
        return (
          <Pressable
            key={font.id}
            style={[styles.createFilterOption, styles.createFilterOptionCompact]}
            onPress={() => onSelect(font.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${font.label} font`}
          >
            <View
              style={[
                styles.createFilterThumbRing,
                styles.createFilterThumbRingCompact,
                selected && styles.createFilterThumbRingActive,
              ]}
            >
              <View style={[styles.createTextFontThumbInner, styles.createFilterThumbInnerCompact]}>
                <Text style={[styles.createTextFontThumbSample, { fontFamily: font.fontFamily }]}>
                  Aa
                </Text>
              </View>
            </View>
            <Text style={[styles.createFilterLabel, styles.createFilterLabelCompact]}>{font.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
