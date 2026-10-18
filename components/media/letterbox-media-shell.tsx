import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CachedGridImage, prefetchGridImage } from "@/components/media/cached-grid-image";

/** Permanent letterbox/pillarbox. Never used as a loading fill. */
export const MEDIA_LETTERBOX_BLACK = "#000";
/** Loading overlay fallback when no thumbnail URL is ready yet. */
export const MEDIA_LOADING_GREY = "#3f3f46";

/**
 * Two independent layers:
 * 1. Container background is always black (letterbox once media is sized inside).
 * 2. A cover-fill blurred thumbnail overlay, keyed only on `loaded` — never on aspect.
 */
export function LetterboxMediaShell({
  loaded,
  previewUri,
  children,
  style,
  letterboxColor = MEDIA_LETTERBOX_BLACK,
  overlayFadeMs = 160,
  previewContentFit = "cover",
}: {
  loaded: boolean;
  previewUri?: string | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pin-preview clone stays transparent so it doesn't flash over the real cell. */
  letterboxColor?: string;
  /** 0 = snap the still off only after `loaded` (avoids fading into a black VideoView). */
  overlayFadeMs?: number;
  previewContentFit?: "cover" | "contain";
}) {
  const overlayOpacity = useRef(new Animated.Value(loaded ? 0 : 1)).current;
  const [overlayMounted, setOverlayMounted] = useState(!loaded);
  const [previewFailed, setPreviewFailed] = useState(false);
  const fadeGenerationRef = useRef(0);
  const overlayFill =
    previewContentFit === "contain" ? MEDIA_LETTERBOX_BLACK : MEDIA_LOADING_GREY;

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUri]);

  useEffect(() => {
    const generation = ++fadeGenerationRef.current;
    if (!loaded) {
      overlayOpacity.stopAnimation();
      overlayOpacity.setValue(1);
      setOverlayMounted(true);
      return;
    }
    overlayOpacity.stopAnimation();
    if (overlayFadeMs <= 0) {
      overlayOpacity.setValue(0);
      setOverlayMounted(false);
      return;
    }
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: overlayFadeMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && generation === fadeGenerationRef.current) {
        setOverlayMounted(false);
      }
    });
  }, [loaded, overlayFadeMs, overlayOpacity]);

  useEffect(() => {
    if (previewUri) void prefetchGridImage(previewUri);
  }, [previewUri]);

  return (
    <View
      collapsable={false}
      style={[styles.letterbox, { backgroundColor: letterboxColor }, style]}
    >
      {children}
      {overlayMounted ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.loadingOverlay, { opacity: overlayOpacity }]}
        >
          <View style={[styles.loadingGrey, { backgroundColor: overlayFill }]}>
            {previewUri && !previewFailed ? (
              <CachedGridImage
                uri={previewUri}
                contentFit={previewContentFit}
                priority="high"
                onError={() => setPreviewFailed(true)}
              />
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  letterbox: {
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  loadingGrey: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MEDIA_LOADING_GREY,
  },
});
