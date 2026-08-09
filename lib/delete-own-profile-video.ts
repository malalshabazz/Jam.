import { Alert, LayoutAnimation, Platform, UIManager } from "react-native";
import { deleteVideo, type ProfileVideo } from "@/lib/native-social-data";
import {
  PROFILE_VIDEO_DELETE_ANIMATION,
  locallyDeletedProfileVideoIds,
} from "@/lib/profile-video-delete-cache";

export async function deleteOwnProfileVideo(
  videoId: string,
  setVideos: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  setFullscreenIndex: (value: number | null) => void,
) {
  // Tombstone first so any profile reload can't flash the video back on.
  locallyDeletedProfileVideoIds.add(videoId);
  setFullscreenIndex(null);

  // Wait for the fullscreen to unmount so the grid fade/slide is visible.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  let previousVideos: ProfileVideo[] = [];
  LayoutAnimation.configureNext(PROFILE_VIDEO_DELETE_ANIMATION);
  setVideos((current) => {
    previousVideos = current;
    return current.filter((video) => video.id !== videoId);
  });

  try {
    await deleteVideo(videoId);
  } catch (err) {
    locallyDeletedProfileVideoIds.delete(videoId);
    LayoutAnimation.configureNext(PROFILE_VIDEO_DELETE_ANIMATION);
    setVideos(() => previousVideos);
    Alert.alert("could not delete", err instanceof Error ? err.message : "try again");
  }
}
