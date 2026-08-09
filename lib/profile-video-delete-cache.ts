import { LayoutAnimation } from "react-native";

export const PROFILE_VIDEO_DELETE_ANIMATION = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

/** Grid thumbs slide into their new slots when a video is pinned / unpinned. */
export const PROFILE_VIDEO_PIN_REORDER_ANIMATION = {
  duration: 340,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

/** Keeps deleted videos off the grid if a profile reload races the server delete. */
export const locallyDeletedProfileVideoIds = new Set<string>();

export function filterOutLocallyDeletedVideos<T extends { id: string }>(videos: T[]) {
  if (locallyDeletedProfileVideoIds.size === 0) return videos;
  return videos.filter((video) => !locallyDeletedProfileVideoIds.has(video.id));
}

export function pruneLocallyDeletedProfileVideoIds(serverVideos: Array<{ id: string }>) {
  if (locallyDeletedProfileVideoIds.size === 0) return;
  const serverIds = new Set(serverVideos.map((video) => video.id));
  for (const id of [...locallyDeletedProfileVideoIds]) {
    if (!serverIds.has(id)) locallyDeletedProfileVideoIds.delete(id);
  }
}
