import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activeThemeMode, styles } from "@/theme/styles";
import {
  NAV_BAR_HEIGHT,
  PROFILE_TOP_FADE_EXTRA,
  dark,
  viewportHeight,
} from "@/theme/tokens";

export type ProfileScrollCollapseContextValue = {
  measureNameEnd: (anchor: View) => void;
};

export const ProfileScrollCollapseContext = createContext<ProfileScrollCollapseContextValue | null>(null);

export function ProfileNameAnchor({ children }: { children: React.ReactNode }) {
  const context = useContext(ProfileScrollCollapseContext);
  const anchorRef = useRef<View>(null);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || !context) return;
    context.measureNameEnd(anchor);
  }, [context]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure, children]);

  return (
    <View ref={anchorRef} collapsable={false} onLayout={measure}>
      {children}
    </View>
  );
}

export type ProfileScrollFadeHandle = {
  /** Scroll so a window-rect is fully inside the visible profile area. */
  ensureWindowRectVisible: (rect: {
    y: number;
    height: number;
    topExtra?: number;
    bottomExtra?: number;
  }) => Promise<void>;
};

export const ProfileTopScrollFade = forwardRef<
  ProfileScrollFadeHandle,
  {
    topInset: number;
    contentContainerStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    collapsedHeader?: {
      title: string;
      left?: React.ReactNode;
      right?: React.ReactNode;
    };
    onCollapseChange?: (collapsed: boolean) => void;
  } & Omit<ScrollViewProps, "contentContainerStyle" | "children" | "onScroll"> & {
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  }
>(function ProfileTopScrollFade(
  {
    topInset,
    contentContainerStyle,
    children,
    collapsedHeader,
    onCollapseChange,
    onScroll,
    ...scrollProps
  },
  ref,
) {
  const contentRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const showCollapsedRef = useRef(false);
  const [nameEndY, setNameEndY] = useState(0);
  const [showCollapsed, setShowCollapsed] = useState(false);
  const collapsedAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useImperativeHandle(
    ref,
    () => ({
      ensureWindowRectVisible: ({ y, height, topExtra = 0, bottomExtra = 0 }) => {
        const minY = Math.max(insets.top, 8) + 6;
        const maxY = viewportHeight - Math.max(insets.bottom, 0) - NAV_BAR_HEIGHT - 8;
        const neededTop = y - topExtra;
        const neededBottom = y + height + bottomExtra;
        let delta = 0;
        if (neededTop < minY) {
          delta = neededTop - minY;
        } else if (neededBottom > maxY) {
          delta = neededBottom - maxY;
        }
        if (Math.abs(delta) < 2) {
          return Promise.resolve();
        }
        const nextY = Math.max(0, scrollYRef.current + delta);
        scrollRef.current?.scrollTo({ y: nextY, animated: true });
        return new Promise((resolve) => {
          setTimeout(resolve, 280);
        });
      },
    }),
    [insets.bottom, insets.top],
  );

  const measureNameEnd = useCallback((anchor: View) => {
    const content = contentRef.current;
    if (!content) return;

    anchor.measureLayout(
      content,
      (_x, y, _width, height) => {
        setNameEndY(y + height);
      },
      () => undefined,
    );
  }, []);

  const collapseContextValue = useMemo(
    () => ({
      measureNameEnd,
    }),
    [measureNameEnd],
  );

  // Keep parent notify + animation outside setState updaters — calling setState on
  // MyProfileScreen from inside ProfileTopScrollFade's updater triggers a React warning.
  const setCollapsedVisible = useCallback(
    (next: boolean) => {
      if (showCollapsedRef.current === next) return;
      showCollapsedRef.current = next;
      setShowCollapsed(next);
      onCollapseChange?.(next);
      Animated.timing(collapsedAnim, {
        toValue: next ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [collapsedAnim, onCollapseChange],
  );

  const updateCollapsedForScroll = useCallback(
    (scrollY: number) => {
      const next = nameEndY > 0 && scrollY >= nameEndY;
      setCollapsedVisible(next);
    },
    [nameEndY, setCollapsedVisible],
  );

  useEffect(() => {
    updateCollapsedForScroll(scrollYRef.current);
  }, [nameEndY, updateCollapsedForScroll]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const scrollY = event.nativeEvent.contentOffset.y;
    scrollYRef.current = scrollY;
    updateCollapsedForScroll(scrollY);
    onScroll?.(event);
  }

  const collapsedTranslateY = collapsedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <ProfileScrollCollapseContext.Provider value={collapseContextValue}>
      <View style={styles.profileScrollFadeRoot}>
        {collapsedHeader ? (
          <Animated.View
            pointerEvents={showCollapsed ? "box-none" : "none"}
            style={[
              styles.profileCollapsedBar,
              {
                paddingTop: topInset,
                opacity: collapsedAnim,
                transform: [{ translateY: collapsedTranslateY }],
              },
            ]}
          >
            <View style={styles.profileCollapsedBarContent}>
              {collapsedHeader.left}
              <Text style={styles.profileCollapsedBarTitle} numberOfLines={1}>
                {collapsedHeader.title}
              </Text>
              {collapsedHeader.right ?? <View style={styles.headerSpacer} />}
            </View>
          </Animated.View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          {...scrollProps}
          onScroll={handleScroll}
          scrollEventThrottle={scrollProps.scrollEventThrottle ?? 16}
          showsVerticalScrollIndicator={scrollProps.showsVerticalScrollIndicator ?? false}
        >
          <View ref={contentRef} collapsable={false} style={contentContainerStyle}>
            {children}
          </View>
        </ScrollView>
        <LinearGradient
          pointerEvents="none"
          colors={
            activeThemeMode === "light"
              ? ["#f7f7f8", "rgba(247, 247, 248, 0)"]
              : [dark, "rgba(10, 10, 10, 0)"]
          }
          locations={[0, 1]}
          style={[styles.profileScrollTopFade, { height: topInset + PROFILE_TOP_FADE_EXTRA }]}
        />
      </View>
    </ProfileScrollCollapseContext.Provider>
  );
});
