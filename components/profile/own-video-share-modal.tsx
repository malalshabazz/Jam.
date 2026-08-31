import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/avatar";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  fetchJamConnections,
  sendMessage,
  type Conversation,
  type FeedVideo,
  type ProfileVideo,
} from "@/lib/native-social-data";
import { getActivityIndicatorColor, styles } from "@/theme/styles";

export function OwnVideoShareModal({
  visible,
  userId,
  video,
  onClose,
  onShared,
}: {
  visible: boolean;
  userId: string;
  video: ProfileVideo | FeedVideo | null;
  onClose: () => void;
  onShared?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(280)).current;
  const [connections, setConnections] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) {
      slideY.setValue(280);
      return;
    }
    slideY.setValue(280);
    Animated.timing(slideY, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideY, visible]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setSelectedUserId(null);
    setMessage("");
    void fetchJamConnections(userId)
      .then((next) => {
        if (!active) return;
        setConnections(next);
      })
      .catch((error) => {
        if (!active) return;
        Alert.alert(
          "could not load jams",
          error instanceof Error ? error.message : "try again",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, visible]);

  async function submitShare() {
    if (!video || !selectedUserId || sending) return;
    setSending(true);
    try {
      await sendMessage(selectedUserId, message.trim(), video.id);
      onShared?.();
      onClose();
    } catch (error) {
      Alert.alert(
        "could not share",
        error instanceof Error ? error.message : "try again",
      );
    } finally {
      setSending(false);
    }
  }

  if (!visible) return null;

  return (
    <View style={styles.ownVideoOverlayHost} pointerEvents="box-none">
      <Pressable style={styles.ownVideoSheetDismiss} onPress={onClose} accessibilityLabel="close share" />
      <Animated.View
        style={[
          styles.ownVideoSheetCard,
          {
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 12),
            gap: 10,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {loading ? (
          <View style={styles.ownVideoShareEmpty}>
            <ActivityIndicator color={getActivityIndicatorColor()} />
          </View>
        ) : connections.length === 0 ? (
          <View style={styles.ownVideoShareEmpty}>
            <Text style={styles.helper}>no jams yet — mutual jams will show up here.</Text>
          </View>
        ) : (
          <FlatList
            data={connections}
            keyExtractor={(item) => item.userId}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.ownVideoShareList}
            contentContainerStyle={styles.ownVideoShareUserRow}
            renderItem={({ item }) => {
              const selected = item.userId === selectedUserId;
              return (
                <Pressable
                  onPress={() => setSelectedUserId(item.userId)}
                  style={[
                    styles.ownVideoShareUser,
                    selected ? styles.ownVideoShareUserSelected : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`share with ${item.creatorName}`}
                >
                  <Avatar uri={item.avatarUrl} size={44} />
                  <Text style={styles.ownVideoShareName} numberOfLines={1}>
                    {item.creatorName}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
        <TextInput
          value={message}
          onChangeText={(value) => setMessage(value.slice(0, 200))}
          placeholder="add a message (optional)"
          placeholderTextColor="#71717a"
          style={styles.ownVideoShareInput}
          maxLength={200}
          editable={Boolean(selectedUserId) && !sending}
        />
        <PrimaryButton
          label={sending ? "sending..." : "send"}
          disabled={!selectedUserId || sending || !video}
          style={styles.ownVideoShareSend}
          onPress={() => {
            void submitShare();
          }}
        />
      </Animated.View>
    </View>
  );
}
