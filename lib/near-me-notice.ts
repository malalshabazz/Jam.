import { Alert } from "react-native";
import {
  hasSeenNearMeLiveLocationNotice,
  markNearMeLiveLocationNoticeSeen,
  NEAR_ME_LIVE_LOCATION_NOTICE_MESSAGE,
  NEAR_ME_LIVE_LOCATION_NOTICE_TITLE,
} from "@/lib/live-location-sharing";

export function confirmNearMeLiveLocationSharing(userId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    void hasSeenNearMeLiveLocationNotice(userId).then((seen) => {
      if (seen) {
        finish(true);
        return;
      }

      Alert.alert(
        NEAR_ME_LIVE_LOCATION_NOTICE_TITLE,
        NEAR_ME_LIVE_LOCATION_NOTICE_MESSAGE,
        [
          { text: "cancel", style: "cancel", onPress: () => finish(false) },
          {
            text: "turn on",
            onPress: () => {
              void markNearMeLiveLocationNoticeSeen(userId).finally(() => finish(true));
            },
          },
        ],
        { cancelable: true, onDismiss: () => finish(false) },
      );
    });
  });
}
