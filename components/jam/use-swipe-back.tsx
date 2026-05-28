import { type TouchEvent, useRef } from "react";

const SWIPE_BACK_EDGE_WIDTH = 48;
const SWIPE_BACK_MIN_DISTANCE = 72;
const SWIPE_BACK_MAX_VERTICAL_DRIFT = 56;

type SwipeBackOptions = {
  disabled?: boolean;
};

type SwipeStart = {
  x: number;
  y: number;
  triggered: boolean;
};

export function useSwipeBack(
  onBack: () => void,
  { disabled = false }: SwipeBackOptions = {},
) {
  const touchStartRef = useRef<SwipeStart | null>(null);

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    if (!touch || disabled || touch.clientX > SWIPE_BACK_EDGE_WIDTH) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      triggered: false,
    };
  }

  function maybeTriggerBack(touch: Touch) {
    const start = touchStartRef.current;
    if (!start || disabled || start.triggered) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isRightSwipe = deltaX >= SWIPE_BACK_MIN_DISTANCE;
    const isMostlyHorizontal =
      Math.abs(deltaY) <= SWIPE_BACK_MAX_VERTICAL_DRIFT &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

    if (!isRightSwipe || !isMostlyHorizontal) return;

    start.triggered = true;
    onBack();
  }

  function onTouchMove(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    if (touch) maybeTriggerBack(touch);
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    if (touch) maybeTriggerBack(touch);
    touchStartRef.current = null;
  }

  return {
    onTouchStartCapture: onTouchStart,
    onTouchMoveCapture: onTouchMove,
    onTouchEndCapture: onTouchEnd,
  };
}
