import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { styles } from "@/theme/styles";
import { viewportWidth } from "@/theme/tokens";

export function SwipeBackSurface({
  children,
  onBack,
  style,
  resetKey,
  enterFromRight = false,
}: {
  children: React.ReactNode;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
  resetKey?: string | boolean | null;
  enterFromRight?: boolean;
}) {
  const [translateX] = useState(() => new Animated.Value(enterFromRight ? viewportWidth : 0));
  const closingRef = useRef(false);
  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  useEffect(() => {
    if (!resetKey) return;
    closingRef.current = false;
    if (!enterFromRight) {
      translateX.setValue(0);
      return;
    }

    translateX.setValue(viewportWidth);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterFromRight, resetKey, translateX]);
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX } }], {
        useNativeDriver: true,
      }),
    [translateX],
  );

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (
      state !== State.END &&
      state !== State.CANCELLED &&
      state !== State.FAILED
    ) {
      return;
    }

    const { translationX, translationY, velocityX } = event.nativeEvent;
    const movedLikeBackGesture =
      translationX > 42 && Math.abs(translationY) < 90;
    const shouldComplete =
      movedLikeBackGesture &&
      (translationX > viewportWidth * 0.34 || velocityX > 520);

    if (shouldComplete) {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(translateX, {
        toValue: viewportWidth,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onBack();
      });
      return;
    }

    Animated.spring(translateX, {
      toValue: 0,
      damping: 24,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }

  return (
    <PanGestureHandler
      activeOffsetX={24}
      failOffsetY={[-26, 26]}
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleGestureStateChange}
    >
      <Animated.View
        style={[
          styles.swipeBackSurface,
          style,
          { transform: [{ translateX: animatedTranslateX }] },
        ]}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}
