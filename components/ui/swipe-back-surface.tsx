import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { styles } from "@/theme/styles";
import { viewportWidth } from "@/theme/tokens";

export type SwipeBackSurfaceHandle = {
  dismiss: () => void;
};

export const SwipeBackSurface = forwardRef<
  SwipeBackSurfaceHandle,
  {
    children: React.ReactNode;
    onBack: () => void;
    style?: StyleProp<ViewStyle>;
    resetKey?: string | boolean | null;
    enterFromRight?: boolean;
  }
>(function SwipeBackSurface(
  { children, onBack, style, resetKey, enterFromRight = false },
  ref,
) {
  const [translateX] = useState(() => new Animated.Value(enterFromRight ? viewportWidth : 0));
  const closingRef = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  function dismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateX, {
      toValue: viewportWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onBackRef.current();
        return;
      }
      closingRef.current = false;
    });
  }

  useImperativeHandle(ref, () => ({ dismiss }), []);

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
      dismiss();
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
});
