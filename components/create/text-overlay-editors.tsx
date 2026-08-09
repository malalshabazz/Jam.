import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Animated, Pressable, TextInput, View } from "react-native";
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { VideoTextOverlayGlyph } from "@/components/VideoPresentationOverlays";
import { getCreateTextOverlayFontSize, getCreateTextOverlayLineHeight } from "@/components/create/layout";
import {
  clampTextOverlayFontScale,
  getVideoTextEffectChrome,
  getVideoTextOutlineRadius,
  getVideoTextOverlayFontFamily,
  getVideoTextOverlayFontWeight,
  type VideoTextEffectId,
  type VideoTextFontId,
} from "@/lib/video-presentation";
import { styles } from "@/theme/styles";
import { TEXT_OVERLAY_MAX_WIDTH_RATIO } from "@/theme/tokens";
import type { CreateTextOverlayItem } from "@/types/app";

export const CreateEditTextOverlayInput = memo(function CreateEditTextOverlayInput({
  initialText,
  inputRef,
  fontSize,
  lineHeight,
  maxWidth,
  fontFamily,
  fontId,
  effectId,
  onDraftChange,
}: {
  initialText: string;
  inputRef: RefObject<TextInput | null>;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  fontFamily: string;
  fontId: VideoTextFontId;
  effectId: VideoTextEffectId;
  onDraftChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initialText);
  const chrome = getVideoTextEffectChrome(effectId, { fontSize, density: "edit" });
  const fontWeight = getVideoTextOverlayFontWeight(fontId);
  // Fixed width while typing — shrink-to-content width recenters the overlay every keystroke.
  const textWidth = Math.max(48, maxWidth - chrome.paddingHorizontal * 2);

  useEffect(() => {
    setDraft(initialText);
    onDraftChange(initialText);
  }, [initialText, onDraftChange]);

  const input = (
    <TextInput
      ref={inputRef}
      value={draft}
      onChangeText={(value) => {
        const next = value.slice(0, 60);
        setDraft(next);
        onDraftChange(next);
      }}
      style={[
        styles.createTextOverlayInput,
        {
          fontSize,
          lineHeight,
          width: textWidth,
          maxWidth: textWidth,
          fontFamily,
          ...(fontWeight ? { fontWeight } : null),
          color: chrome.color,
          textAlign: "center",
          includeFontPadding: false,
          ...(chrome.useSoftShadow
            ? null
            : {
                textShadowColor: "transparent",
                textShadowRadius: 0,
                textShadowOffset: { width: 0, height: 0 },
              }),
          ...(chrome.useOutline
            ? {
                // Soft circular halo approximates the curved glyph stroke while typing.
                textShadowColor: "#000",
                textShadowRadius: Math.max(2.5, getVideoTextOutlineRadius(fontSize, "edit") * 1.15),
                textShadowOffset: { width: 0, height: 0 },
              }
            : null),
        },
      ]}
      maxLength={60}
      multiline
      textAlign="center"
      blurOnSubmit={false}
      selectionColor={chrome.color === "#111" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.9)"}
      cursorColor={chrome.color}
      placeholder=""
    />
  );

  if (!chrome.backgroundColor && !chrome.useOutline) return input;

  return (
    <View
      style={{
        backgroundColor: chrome.backgroundColor,
        paddingHorizontal: chrome.paddingHorizontal,
        paddingVertical: chrome.paddingVertical,
        borderRadius: chrome.borderRadius,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      {input}
    </View>
  );
});

export const CreateEditTextOverlayItem = memo(function CreateEditTextOverlayItem({
  overlay,
  isEditing,
  viewportWidth,
  viewportHeight,
  committedSize,
  inputRef,
  onDraftChange,
  onOpenActions,
  onEditText,
  onSizeChange,
  onFontScaleChange,
  onPinchActiveChange,
  onPanGesture,
  onPanStateChange,
}: {
  overlay: CreateTextOverlayItem;
  isEditing: boolean;
  viewportWidth: number;
  viewportHeight: number;
  committedSize: { width: number; height: number };
  inputRef: RefObject<TextInput | null>;
  onDraftChange: (text: string) => void;
  onOpenActions: () => void;
  onEditText: () => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  onFontScaleChange: (fontScale: number) => void;
  onPinchActiveChange: (active: boolean) => void;
  onPanGesture: (event: PanGestureHandlerGestureEvent) => void;
  onPanStateChange: (event: PanGestureHandlerStateChangeEvent) => void;
}) {
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const pinchBaseScaleRef = useRef(overlay.fontScale);
  const pinchFrameRef = useRef<number | null>(null);
  const pendingPinchScaleRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveFontScale, setLiveFontScale] = useState(overlay.fontScale);
  const [liveSize, setLiveSize] = useState(committedSize);
  // Freeze left/top after the first edit layout so typing doesn't re-center every keystroke.
  const [editAnchor, setEditAnchor] = useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const showOverlay = isEditing || Boolean(overlay.text.trim());
  const fontScale = isEditing ? overlay.fontScale : liveFontScale;
  const fontSize = getCreateTextOverlayFontSize(fontScale);
  const lineHeight = getCreateTextOverlayLineHeight(fontSize);
  const fontFamily = getVideoTextOverlayFontFamily(overlay.fontId);
  const maxTextWidth = Math.max(120, viewportWidth * TEXT_OVERLAY_MAX_WIDTH_RATIO);
  const size = isEditing ? liveSize : committedSize;
  const centeredLeft = viewportWidth * overlay.centerRatio.x - size.width / 2;
  const centeredTop = viewportHeight * overlay.centerRatio.y - size.height / 2;
  const overlayLeft = isEditing && editAnchor ? editAnchor.left : centeredLeft;
  const overlayTop = isEditing && editAnchor ? editAnchor.top : centeredTop;

  useEffect(() => {
    if (!isEditing) {
      setLiveSize(committedSize);
      setEditAnchor(null);
    }
  }, [committedSize, isEditing]);

  useEffect(() => {
    if (!isEditing) return;

    // Seed a stable centered frame once when editing begins so typing doesn't
    // re-center the overlay on every keystroke / layout pass.
    const chrome = getVideoTextEffectChrome(overlay.effectId, {
      fontSize: getCreateTextOverlayFontSize(overlay.fontScale),
      density: "edit",
    });
    const seededWidth =
      committedSize.width > 0
        ? committedSize.width
        : Math.max(120, viewportWidth * TEXT_OVERLAY_MAX_WIDTH_RATIO);
    const seededHeight =
      committedSize.height > 0
        ? committedSize.height
        : getCreateTextOverlayLineHeight(getCreateTextOverlayFontSize(overlay.fontScale)) +
          chrome.paddingVertical * 2;
    setLiveSize({ width: seededWidth, height: seededHeight });
    setEditAnchor({
      left: viewportWidth * overlay.centerRatio.x - seededWidth / 2,
      top: viewportHeight * overlay.centerRatio.y - seededHeight / 2,
    });
    // Only re-run when entering edit for this overlay (isEditing edge), not on
    // every size tick — that was causing jumpiness while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, overlay.id]);

  useEffect(() => {
    setLiveFontScale(overlay.fontScale);
  }, [overlay.fontScale]);

  useEffect(() => {
    if (isEditing) setIsDragging(false);
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (pinchFrameRef.current !== null) {
        cancelAnimationFrame(pinchFrameRef.current);
        pinchFrameRef.current = null;
      }
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  function scheduleLiveFontScale(nextScale: number) {
    pendingPinchScaleRef.current = nextScale;
    if (pinchFrameRef.current !== null) return;
    pinchFrameRef.current = requestAnimationFrame(() => {
      pinchFrameRef.current = null;
      if (pendingPinchScaleRef.current == null) return;
      setLiveFontScale(pendingPinchScaleRef.current);
    });
  }

  const handlePinchGesture = useCallback((event: PinchGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state !== State.ACTIVE) return;
    scheduleLiveFontScale(
      clampTextOverlayFontScale(pinchBaseScaleRef.current * event.nativeEvent.scale),
    );
  }, []);

  const handlePinchStateChange = useCallback(
    (event: PinchGestureHandlerStateChangeEvent) => {
      const { state, scale } = event.nativeEvent;

      if (state === State.BEGAN) {
        pinchBaseScaleRef.current = overlay.fontScale;
        onPinchActiveChange(true);
        return;
      }

      if (state === State.ACTIVE) {
        scheduleLiveFontScale(clampTextOverlayFontScale(pinchBaseScaleRef.current * scale));
        return;
      }

      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (pinchFrameRef.current !== null) {
          cancelAnimationFrame(pinchFrameRef.current);
          pinchFrameRef.current = null;
        }
        const nextScale = clampTextOverlayFontScale(pinchBaseScaleRef.current * scale);
        setLiveFontScale(nextScale);
        onFontScaleChange(nextScale);
        onPinchActiveChange(false);
      }
    },
    [onFontScaleChange, onPinchActiveChange, overlay.fontScale],
  );

  function handlePanStateChange(event: PanGestureHandlerStateChangeEvent) {
    const { state } = event.nativeEvent;
    if (state === State.ACTIVE) {
      setIsDragging(true);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      setIsDragging(false);
    }
    onPanStateChange(event);
  }

  function handleTextPress() {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      onEditText();
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      onOpenActions();
    }, 280);
  }

  if (!showOverlay) return null;

  const effectChrome = getVideoTextEffectChrome(overlay.effectId, { fontSize, density: "edit" });
  const fontWeight = getVideoTextOverlayFontWeight(overlay.fontId);
  const textMaxWidth = Math.max(48, maxTextWidth - effectChrome.paddingHorizontal * 2);
  const textStyle = [
    styles.createTextOverlayPreviewText,
    {
      fontSize,
      lineHeight,
      maxWidth: textMaxWidth,
      fontFamily,
      ...(fontWeight ? { fontWeight } : null),
    },
  ];

  return (
    <PinchGestureHandler
      ref={pinchRef}
      enabled={!isEditing}
      simultaneousHandlers={panRef}
      onGestureEvent={handlePinchGesture}
      onHandlerStateChange={handlePinchStateChange}
    >
      <Animated.View
        collapsable={false}
        pointerEvents={isDragging ? "auto" : "box-none"}
        style={[styles.createTextOverlayPinchCapture, isDragging && { zIndex: 20 }]}
      >
        <PanGestureHandler
          ref={panRef}
          enabled={!isEditing}
          simultaneousHandlers={pinchRef}
          activeOffsetX={[-12, 12]}
          activeOffsetY={[-12, 12]}
          onGestureEvent={onPanGesture}
          onHandlerStateChange={handlePanStateChange}
        >
          <Animated.View
            style={[
              styles.createTextOverlayDraggable,
              {
                left: overlayLeft,
                top: overlayTop,
                maxWidth: maxTextWidth,
                overflow: "visible",
              },
            ]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width === size.width && height === size.height) return;
              if (isEditing) {
                // Keep left/top frozen (editAnchor); only track size for later commit.
                setLiveSize({ width, height });
                return;
              }
              onSizeChange({ width, height });
            }}
          >
            {isEditing ? (
              <CreateEditTextOverlayInput
                initialText={overlay.text}
                inputRef={inputRef}
                fontSize={fontSize}
                lineHeight={lineHeight}
                maxWidth={maxTextWidth}
                fontFamily={fontFamily}
                fontId={overlay.fontId}
                effectId={overlay.effectId}
                onDraftChange={onDraftChange}
              />
            ) : (
              <Pressable
                onPress={handleTextPress}
                accessibilityLabel="text overlay options. double tap to edit"
              >
                <VideoTextOverlayGlyph
                  text={overlay.text.trim()}
                  effectId={overlay.effectId}
                  density="edit"
                  textStyle={textStyle}
                />
              </Pressable>
            )}
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
  );
});
