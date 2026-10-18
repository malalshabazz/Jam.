import { Modal, Pressable, Text, View } from "react-native";
import { FeedFilterIcon } from "@/components/icons/feed-filter-icon";
import { JamJarIcon } from "@/components/icons/jam-jar-icon";
import type { FeedProductTourAnchor, FeedProductTourStep } from "@/lib/feed-product-tour";
import { styles } from "@/theme/styles";
import { viewportHeight, viewportWidth } from "@/theme/tokens";

const HIGHLIGHT_PAD = 10;

export function FeedProductTour({
  visible,
  step,
  target,
  onAdvance,
}: {
  visible: boolean;
  step: FeedProductTourStep;
  target: FeedProductTourAnchor | null;
  onAdvance: () => void;
}) {
  if (!visible) return null;

  const hole = target
    ? {
        left: Math.max(0, target.x - HIGHLIGHT_PAD),
        top: Math.max(0, target.y - HIGHLIGHT_PAD),
        width: target.width + HIGHLIGHT_PAD * 2,
        height: target.height + HIGHLIGHT_PAD * 2,
      }
    : null;

  const copy =
    step === "filter"
      ? "filter by what you're looking for here"
      : "if you like what you see, send a jam";

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onAdvance}>
      <Pressable
        style={styles.feedProductTourRoot}
        onPress={onAdvance}
        accessibilityRole="button"
        accessibilityLabel={`${copy}. tap anywhere to continue`}
      >
        {hole ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.feedProductTourDim,
                { left: 0, top: 0, width: viewportWidth, height: hole.top },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.feedProductTourDim,
                { left: 0, top: hole.top, width: hole.left, height: hole.height },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.feedProductTourDim,
                {
                  left: hole.left + hole.width,
                  top: hole.top,
                  width: Math.max(0, viewportWidth - hole.left - hole.width),
                  height: hole.height,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.feedProductTourDim,
                {
                  left: 0,
                  top: hole.top + hole.height,
                  width: viewportWidth,
                  height: Math.max(0, viewportHeight - hole.top - hole.height),
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.feedProductTourHighlight,
                {
                  left: hole.left,
                  top: hole.top,
                  width: hole.width,
                  height: hole.height,
                },
              ]}
            >
              {step === "filter" ? <FeedFilterIcon /> : <JamJarIcon />}
            </View>
            <View
              pointerEvents="none"
              style={
                step === "filter"
                  ? [
                      styles.feedProductTourToast,
                      {
                        top: hole.top + hole.height + 12,
                        right: Math.max(18, viewportWidth - hole.left - hole.width),
                        maxWidth: Math.min(260, viewportWidth - 36),
                      },
                    ]
                  : [
                      styles.feedProductTourToast,
                      {
                        top: hole.top + hole.height / 2 - 22,
                        right: viewportWidth - hole.left + 10,
                        maxWidth: Math.min(220, hole.left - 28),
                      },
                    ]
              }
            >
              <Text style={styles.feedProductTourToastText}>{copy}</Text>
            </View>
          </>
        ) : (
          <View pointerEvents="none" style={[styles.feedProductTourDim, styles.feedProductTourRoot]} />
        )}
      </Pressable>
    </Modal>
  );
}
