import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/ui/avatar";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  formatDailyJamUsageCopy,
  type FeedVideo,
} from "@/lib/native-social-data";
import { useDailyJamUsage } from "@/lib/use-daily-jam-usage";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import { viewportHeight } from "@/theme/tokens";

export function DmModal({
  item,
  onClose,
  onOpenProfile,
  onSend,
  presentation = "modal",
}: {
  item: FeedVideo | null;
  onClose: () => void;
  onOpenProfile: (item: FeedVideo) => void;
  onSend: (body: string) => Promise<void>;
  presentation?: "modal" | "overlay";
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const { usage, loading: usageLoading, refresh: refreshJamUsage } = useDailyJamUsage(Boolean(item));
  const jamLimitReached = usage != null && usage.remaining <= 0;

  useEffect(() => {
    const timer = setTimeout(() => setBody(""), 0);
    return () => clearTimeout(timer);
  }, [item]);

  useEffect(() => {
    if (!item) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(Math.max(0, viewportHeight - event.endCoordinates.screenY));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [item]);

  if (!item) return null;

  async function submit() {
    if (!body.trim() || sending) return;
    if (jamLimitReached) {
      Alert.alert(
        "daily jam limit reached",
        "you've used all your jams for today. they reset at midnight.",
      );
      return;
    }

    setSending(true);
    try {
      await onSend(body.trim());
      await refreshJamUsage();
    } catch (err) {
      await refreshJamUsage();
      Alert.alert("could not send", err instanceof Error ? err.message : "try again");
    } finally {
      setSending(false);
    }
  }

  const sendDisabled = sending || !body.trim() || jamLimitReached;
  const usageCopy = usage
    ? formatDailyJamUsageCopy(usage)
    : usageLoading
      ? "checking today's jam limit..."
      : null;

  const content = (
    <View
      style={[
        styles.jamPromptOverlay,
        keyboardInset > 0 && {
          justifyContent: "flex-end",
          paddingBottom: keyboardInset + 12,
        },
      ]}
    >
      <Pressable style={styles.jamPromptShade} onPress={onClose} />
      <View style={styles.jamPromptCard}>
        <View style={styles.row}>
          <Pressable onPress={() => onOpenProfile(item)} accessibilityLabel={`open ${item.creatorName}'s profile`}>
            <Avatar uri={item.avatarUrl} size={44} />
          </Pressable>
          <View>
            <Text style={styles.cardTitle}>jam with {item.creatorName}</Text>
            <Text style={styles.helper}>{item.role} - {item.location}</Text>
          </View>
        </View>
        <TextInput
          value={body}
          onChangeText={(value) => setBody(value.slice(0, 200))}
          placeholder="let's jam"
          placeholderTextColor="#71717a"
          multiline
          blurOnSubmit
          returnKeyType="send"
          enablesReturnKeyAutomatically
          onSubmitEditing={() => void submit()}
          editable={!jamLimitReached}
          maxLength={200}
          style={[styles.input, styles.textArea]}
        />
        <View style={styles.jamPromptMetaRow}>
          {usageCopy ? (
            <Text style={[styles.helper, jamLimitReached && styles.jamLimitReachedText]}>{usageCopy}</Text>
          ) : (
            <View />
          )}
          <Text style={styles.charCount}>{body.length}/200</Text>
        </View>
        <View style={styles.twoCol}>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>cancel</Text>
          </Pressable>
          <PrimaryButton
            label={jamLimitReached ? "limit reached" : sending ? "sending..." : "send"}
            disabled={sendDisabled}
            onPress={submit}
          />
        </View>
      </View>
    </View>
  );

  if (presentation === "overlay") {
    return <View style={styles.jamPromptHost}>{content}</View>;
  }

  return (
    <Modal animationType="fade" transparent visible={Boolean(item)} onRequestClose={onClose}>
      {content}
    </Modal>
  );
}
