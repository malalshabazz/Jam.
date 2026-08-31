import { useRef, useState } from "react";
import { Animated, Modal, Pressable, View } from "react-native";
import { Avatar } from "@/components/ui/avatar";
import { triggerHoldHaptic } from "@/lib/hold-haptic";
import { styles } from "@/theme/styles";
import { viewportHeight, viewportWidth } from "@/theme/tokens";

const EXPANDED_SIZE = Math.round(Math.min(viewportWidth, viewportHeight) * 0.72);

const SPRING = {
  damping: 26,
  stiffness: 320,
  mass: 0.6,
  overshootClamping: true,
  restDisplacementThreshold: 0.4,
  restSpeedThreshold: 0.4,
  useNativeDriver: true,
  isInteraction: false,
} as const;

export function ExpandableAvatar({
  uri,
  size,
  label,
  onPress,
}: {
  uri?: string | null;
  size: number;
  label?: string;
  onPress?: () => void;
}) {
  const wrapRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const originRef = useRef({ x: 0, y: 0, size });
  const closingRef = useRef(false);
  const [open, setOpen] = useState(false);

  function expand() {
    if (open || closingRef.current) return;
    wrapRef.current?.measureInWindow((x, y, width) => {
      originRef.current = { x, y, size: width > 0 ? width : size };
      triggerHoldHaptic();
      setOpen(true);
      progress.setValue(0);
      requestAnimationFrame(() => {
        Animated.spring(progress, { toValue: 1, ...SPRING }).start();
      });
    });
  }

  function collapse() {
    if (!open || closingRef.current) return;
    closingRef.current = true;
    progress.stopAnimation();
    Animated.spring(progress, { toValue: 0, ...SPRING }).start(({ finished }) => {
      closingRef.current = false;
      if (finished) setOpen(false);
    });
  }

  const restLeft = (viewportWidth - EXPANDED_SIZE) / 2;
  const restTop = (viewportHeight - EXPANDED_SIZE) / 2;
  const startX = originRef.current.x - restLeft;
  const startY = originRef.current.y - restTop;
  const startScale = originRef.current.size / EXPANDED_SIZE;

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={expand}
        delayLongPress={280}
        accessibilityRole="button"
        accessibilityLabel="profile photo"
        accessibilityHint="hold to enlarge the profile photo"
      >
        <View ref={wrapRef} collapsable={false}>
          <Avatar uri={uri} size={size} label={label} />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={collapse}
      >
        <Pressable
          style={styles.avatarPreviewRoot}
          onPress={collapse}
          accessibilityRole="button"
          accessibilityLabel="close profile photo"
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.avatarPreviewShade, { opacity: progress }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarPreviewCircle,
              {
                width: EXPANDED_SIZE,
                height: EXPANDED_SIZE,
                borderRadius: EXPANDED_SIZE / 2,
                left: restLeft,
                top: restTop,
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [startX, 0],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [startY, 0],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [startScale, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Avatar uri={uri} size={EXPANDED_SIZE} label={label} />
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}
