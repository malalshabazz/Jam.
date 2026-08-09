import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { FEED_ROLE_FILTER_LOOP_COPIES } from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { FEED_ROLE_FILTER_WHEEL } from "@/lib/feed-filters";

export function getFeedRoleFilterOpacity(
  index: number,
  itemWidth: number,
  areaWidth: number,
  scrollX: number,
) {
  if (!itemWidth || !areaWidth) return 1;

  const itemCenter = index * itemWidth + itemWidth / 2;
  const viewportCenter = scrollX + areaWidth / 2;
  const distance = Math.abs(itemCenter - viewportCenter);

  // Soft dissolve as labels leave the centre band. The MaskedView rim handles
  // glyph-level edge fade; this keeps far loop copies from flashing.
  const fadeStart = itemWidth * 0.95;
  const fadeEnd = itemWidth * 1.55;
  if (distance <= fadeStart) return 1;
  if (distance >= fadeEnd) return 0;

  const t = (distance - fadeStart) / (fadeEnd - fadeStart);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

/** Place labels on a large circle so centre sits lowest and sides rise on an arc. */
export function getFeedRoleFilterWheelLift(
  index: number,
  itemWidth: number,
  areaWidth: number,
  scrollX: number,
) {
  if (!itemWidth || !areaWidth) return 0;

  const itemCenter = index * itemWidth + itemWidth / 2;
  const viewportCenter = scrollX + areaWidth / 2;
  const x = itemCenter - viewportCenter;
  // Large radius → shallow arch (sides only slightly higher than centre).
  const radius = Math.max(areaWidth * 3.6, itemWidth * 10);
  const clampedX = Math.max(-radius + 1, Math.min(radius - 1, x));
  // Circle centred above the row: y = R - sqrt(R² - x²), then lift upward in RN.
  const lift = radius - Math.sqrt(radius * radius - clampedX * clampedX);
  return -lift;
}

export function FeedRoleFilterWheel({
  selectedRoles,
  onSelectRole,
}: {
  selectedRoles: string[];
  onSelectRole: (role: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const itemWidth = areaWidth > 0 ? areaWidth / 3 : 0;
  const loopWidth = FEED_ROLE_FILTER_WHEEL.length * itemWidth;
  const wheelItems = useMemo(
    () =>
      Array.from({ length: FEED_ROLE_FILTER_LOOP_COPIES }, () => FEED_ROLE_FILTER_WHEEL).flat(),
    [],
  );

  useEffect(() => {
    if (!itemWidth) return;
    scrollRef.current?.scrollTo({ x: loopWidth, animated: false });
    setScrollX(loopWidth);
  }, [itemWidth, loopWidth]);

  function handleWheelScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setScrollX(event.nativeEvent.contentOffset.x);
  }

  function normalizeWheelOffset(offsetX: number) {
    if (!itemWidth || !loopWidth) return offsetX;

    let nextOffset = offsetX;
    if (nextOffset <= loopWidth * 0.5) {
      nextOffset += loopWidth;
    } else if (nextOffset >= loopWidth * 2.5) {
      nextOffset -= loopWidth;
    }
    return nextOffset;
  }

  function normalizeWheelScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!itemWidth) return;

    const offsetX = normalizeWheelOffset(event.nativeEvent.contentOffset.x);
    if (offsetX !== event.nativeEvent.contentOffset.x) {
      scrollRef.current?.scrollTo({ x: offsetX, animated: false });
    }
    setScrollX(offsetX);
  }

  function selectRoleAtIndex(label: string, index: number) {
    const isAlreadySelected = selectedRoles.some(
      (role) => role.toLowerCase() === label.toLowerCase(),
    );
    onSelectRole(label);

    // Rotate the tapped option into the centre; scroll events drive the wheel lift.
    if (isAlreadySelected || !itemWidth) return;

    const targetScroll = normalizeWheelOffset((index - 1) * itemWidth);
    scrollRef.current?.scrollTo({ x: targetScroll, animated: true });
  }

  return (
    <View
      style={styles.feedRecentFiltersArea}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== areaWidth) setAreaWidth(nextWidth);
      }}
    >
      {itemWidth > 0 && (
        <MaskedView
          style={styles.feedRecentFiltersMask}
          maskElement={
            <View style={styles.feedRecentFiltersMaskElement}>
              <LinearGradient
                colors={["transparent", "#000", "#000", "transparent"]}
                locations={[0, 0.14, 0.86, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          }
        >
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={itemWidth}
            disableIntervalMomentum
            scrollEventThrottle={16}
            onScroll={handleWheelScroll}
            onMomentumScrollEnd={normalizeWheelScroll}
            onScrollEndDrag={normalizeWheelScroll}
            contentContainerStyle={styles.feedRecentFiltersRow}
          >
            {wheelItems.map((label, index) => {
              const isActive = selectedRoles.some(
                (role) => role.toLowerCase() === label.toLowerCase(),
              );
              const itemOpacity = getFeedRoleFilterOpacity(index, itemWidth, areaWidth, scrollX);
              const wheelLift = getFeedRoleFilterWheelLift(index, itemWidth, areaWidth, scrollX);

              return (
                <Pressable
                  key={`${label}-${index}`}
                  style={[
                    styles.feedRecentFilterItem,
                    {
                      width: itemWidth,
                      opacity: itemOpacity,
                      transform: [{ translateY: wheelLift }],
                    },
                  ]}
                  onPress={() => selectRoleAtIndex(label, index)}
                  hitSlop={8}
                  disabled={itemOpacity < 0.12}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.feedRecentFilterText, isActive && styles.feedRecentFilterTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </MaskedView>
      )}
    </View>
  );
}
