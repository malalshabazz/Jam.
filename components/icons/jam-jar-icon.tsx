import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { styles } from "@/theme/styles";
import {
  JAM_JAR_FILL_EMPTY_HEIGHT,
  JAM_JAR_FILL_FULL_HEIGHT,
  JAM_JAR_JAM_COLOR,
  JAM_JAR_LID_EMPTY_GAP,
  JAM_JAR_LID_EMPTY_HEIGHT,
  JAM_JAR_LID_FULL_GAP,
  JAM_JAR_LID_FULL_HEIGHT,
  jamBorder,
  jamTint,
  overlayIconShadow,
} from "@/theme/tokens";

export function JamJarSmoothWaveSurface({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={23} height={5} viewBox="0 0 23 5">
      <Path
        d="M -1 4.2 C 3.8 1.55, 7.7 4.85, 11.5 3.7 C 15.3 1.55, 19.2 4.85, 24 3.7 V 5 H -1 Z"
        fill={color}
      />
    </Svg>
  );
}

export function JamJarIcon({ filled = false }: { filled?: boolean }) {
  const prevFilledRef = useRef<boolean | null>(null);
  const fillAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const fillHeight = useRef(new Animated.Value(filled ? JAM_JAR_FILL_FULL_HEIGHT : JAM_JAR_FILL_EMPTY_HEIGHT)).current;
  const lidSolid = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const lidHeight = useRef(new Animated.Value(filled ? JAM_JAR_LID_FULL_HEIGHT : JAM_JAR_LID_EMPTY_HEIGHT)).current;
  const lidGap = useRef(new Animated.Value(filled ? JAM_JAR_LID_FULL_GAP : JAM_JAR_LID_EMPTY_GAP)).current;
  const smoothWaveOpacity = useRef(new Animated.Value(filled ? 0 : 1)).current;
  const bumpWaveOpacity = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const leakProgress = useRef(new Animated.Value(0)).current;

  const setFilledState = useCallback(
    (isFilled: boolean, animate: boolean) => {
      fillAnimationRef.current?.stop();
      fillAnimationRef.current = null;

      if (!animate) {
        fillHeight.setValue(isFilled ? JAM_JAR_FILL_FULL_HEIGHT : JAM_JAR_FILL_EMPTY_HEIGHT);
        lidSolid.setValue(isFilled ? 1 : 0);
        lidHeight.setValue(isFilled ? JAM_JAR_LID_FULL_HEIGHT : JAM_JAR_LID_EMPTY_HEIGHT);
        lidGap.setValue(isFilled ? JAM_JAR_LID_FULL_GAP : JAM_JAR_LID_EMPTY_GAP);
        smoothWaveOpacity.setValue(isFilled ? 0 : 1);
        bumpWaveOpacity.setValue(isFilled ? 1 : 0);
        leakProgress.setValue(0);
        return;
      }

      smoothWaveOpacity.setValue(1);
      bumpWaveOpacity.setValue(0);
      leakProgress.setValue(0);

      fillAnimationRef.current = Animated.sequence([
        Animated.parallel([
          Animated.timing(fillHeight, {
            toValue: JAM_JAR_FILL_FULL_HEIGHT + 2.5,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.delay(280),
            Animated.parallel([
              Animated.timing(smoothWaveOpacity, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
              }),
              Animated.timing(bumpWaveOpacity, {
                toValue: 1,
                duration: 240,
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.sequence([
            Animated.delay(340),
            Animated.parallel([
              Animated.timing(lidSolid, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(lidHeight, {
                toValue: JAM_JAR_LID_FULL_HEIGHT,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(lidGap, {
                toValue: JAM_JAR_LID_FULL_GAP,
                duration: 200,
                useNativeDriver: false,
              }),
            ]),
          ]),
        ]),
        Animated.timing(fillHeight, {
          toValue: JAM_JAR_FILL_FULL_HEIGHT,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        // Drops shoot up, arc outward, and fall down the sides (keyframed below).
        Animated.timing(leakProgress, {
          toValue: 1,
          duration: 680,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);

      fillAnimationRef.current.start(({ finished }) => {
        fillAnimationRef.current = null;
        if (!finished) return;
        fillHeight.setValue(JAM_JAR_FILL_FULL_HEIGHT);
        leakProgress.setValue(0);
      });
    },
    [bumpWaveOpacity, fillHeight, leakProgress, lidGap, lidHeight, lidSolid, smoothWaveOpacity],
  );

  useEffect(() => {
    const previousFilled = prevFilledRef.current;
    prevFilledRef.current = filled;

    if (previousFilled === null) {
      setFilledState(filled, false);
      return;
    }

    if (!previousFilled && filled) {
      setFilledState(true, true);
      return;
    }

    if (previousFilled && !filled) {
      setFilledState(false, false);
    }
  }, [filled, setFilledState]);

  useEffect(() => {
    return () => {
      fillAnimationRef.current?.stop();
    };
  }, []);

  // Each drop launches upward, drifts to its side, and falls back down in an arc.
  const makeLeakDropStyle = (xEnd: number, yApex: number, yEnd: number) => ({
    opacity: leakProgress.interpolate({
      inputRange: [0, 0.06, 0.7, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateX: leakProgress.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, xEnd * 0.45, xEnd],
        }),
      },
      {
        translateY: leakProgress.interpolate({
          inputRange: [0, 0.2, 0.45, 0.75, 1],
          outputRange: [0, yApex * 0.8, yApex, yApex * 0.25, yEnd],
        }),
      },
    ],
  });

  return (
    <View style={[styles.jamJarIcon, overlayIconShadow]}>
      <View pointerEvents="none" style={styles.jamJarLeak}>
        <Animated.View
          style={[styles.jamJarLeakDrop, styles.jamJarLeakDropSide, filled && jamTint, makeLeakDropStyle(-11, -13, 8)]}
        />
        <Animated.View style={[styles.jamJarLeakDrop, filled && jamTint, makeLeakDropStyle(1.5, -17, 5)]} />
        <Animated.View
          style={[styles.jamJarLeakDrop, styles.jamJarLeakDropSide, filled && jamTint, makeLeakDropStyle(11, -15, 8)]}
        />
      </View>
      <Animated.View style={[styles.jamJarLid, { height: lidHeight, marginBottom: lidGap }]}>
        <Animated.View pointerEvents="none" style={[styles.jamJarLidSolidFill, { opacity: lidSolid }]} />
      </Animated.View>
      <View style={[styles.jamJarBody, filled && jamBorder]}>
        <Animated.View style={[styles.jamJarAnimatedFill, filled && jamTint, { height: fillHeight }]}>
          <Animated.View pointerEvents="none" style={[styles.jamJarSmoothWaveSurface, { opacity: smoothWaveOpacity }]}>
            <JamJarSmoothWaveSurface color={filled ? JAM_JAR_JAM_COLOR : "#fff"} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.jamJarBumpWaveWrap, { opacity: bumpWaveOpacity }]}>
            <View style={[styles.jamJarWaveLeft, filled && jamTint]} />
            <View style={[styles.jamJarWaveRight, filled && jamTint]} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
