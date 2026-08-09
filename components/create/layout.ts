import { getNavBarHeight } from "@/lib/nav-bar";
import {
  CREATE_CAMERA_CONTROLS_BOTTOM_PADDING,
  CREATE_CAMERA_FILTER_ROW_HEIGHT,
  CREATE_TRIM_HANDLE_WIDTH,
  TEXT_OVERLAY_BASE_FONT_SIZE,
  TEXT_OVERLAY_CENTER_SNAP_THRESHOLD,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";
import { clamp } from "@/lib/format";

export function getFeedVideoViewport(bottomInset: number) {
  const navBarHeight = getNavBarHeight(bottomInset);
  return {
    navBarHeight,
    width: viewportWidth,
    height: viewportHeight - navBarHeight,
  };
}

export function getCreateCameraControlsBottom(navBarHeight: number) {
  return navBarHeight + CREATE_CAMERA_CONTROLS_BOTTOM_PADDING;
}

export function getCreateCameraFilterRestBottom(navBarHeight: number) {
  return (navBarHeight - CREATE_CAMERA_FILTER_ROW_HEIGHT) / 2;
}

export function getCreateCameraFilterSlideDistance(navBarHeight: number) {
  return getCreateCameraFilterRestBottom(navBarHeight) + CREATE_CAMERA_FILTER_ROW_HEIGHT;
}

export function clampTextOverlayCenterRatio(ratio: { x: number; y: number }) {
  // Full edit canvas (including letterbox bars). Keep a thin inset so the
  // overlay center stays on-screen while still allowing edge / bar placement.
  return { x: clamp(ratio.x, 0.02, 0.98), y: clamp(ratio.y, 0.02, 0.98) };
}

export function snapTextOverlayCenterRatio(
  ratio: { x: number; y: number },
  options: { snapX: boolean; snapY: boolean },
) {
  const clamped = clampTextOverlayCenterRatio(ratio);
  return {
    x:
      options.snapX && Math.abs(clamped.x - 0.5) <= TEXT_OVERLAY_CENTER_SNAP_THRESHOLD
        ? 0.5
        : clamped.x,
    y:
      options.snapY && Math.abs(clamped.y - 0.5) <= TEXT_OVERLAY_CENTER_SNAP_THRESHOLD
        ? 0.5
        : clamped.y,
  };
}


export function getCreateTextOverlayFontSize(fontScale: number) {
  return Math.max(12, Math.round(TEXT_OVERLAY_BASE_FONT_SIZE * fontScale * 10) / 10);
}


export function getCreateTextOverlayLineHeight(fontSize: number) {
  // Slightly taller than 1.2 so script descenders / boxed text don't clip.
  return Math.round(fontSize * 1.25 * 10) / 10;
}


export function createTextOverlayId() {
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


export function getTrimSelectionProgress(absoluteRatio: number, trimStartRatio: number, trimEndRatio: number) {
  const span = trimEndRatio - trimStartRatio;
  if (span <= 0.0001) return 0;
  return clamp(absoluteRatio - trimStartRatio, 0, span) / span;
}


export function getTrimProgressTrackGeometry(trimLeft: number, selectionWidth: number) {
  if (selectionWidth <= 0) {
    return { progressTrackLeft: trimLeft, progressTrackWidth: 0 };
  }

  const inset = Math.min(CREATE_TRIM_HANDLE_WIDTH, Math.max(0, selectionWidth / 2 - 1));
  const progressTrackWidth = Math.max(2, selectionWidth - inset * 2);
  const progressTrackLeft = trimLeft + (selectionWidth - progressTrackWidth) / 2;
  return { progressTrackLeft, progressTrackWidth };
}
