import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchBlockedUsers,
  unblockUser,
  type BlockedUser,
} from "@/lib/native-social-data";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import { Avatar } from "@/components/ui/avatar";
import { EmptyCard } from "@/components/ui/empty-card";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";

export function BlockedUsersModal({
  visible,
  currentUserId,
  onClose,
}: {
  visible: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const nextBlockedUsers = await fetchBlockedUsers(currentUserId);
      setBlockedUsers(nextBlockedUsers);
    } catch (err) {
      Alert.alert("could not load blocked users", err instanceof Error ? err.message : "try again");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      void loadBlockedUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBlockedUsers, visible]);

  async function unblock(blockedUser: BlockedUser) {
    setUnblockingUserId(blockedUser.userId);
    const previousBlockedUsers = blockedUsers;
    setBlockedUsers((current) => current.filter((user) => user.userId !== blockedUser.userId));
    try {
      await unblockUser(currentUserId, blockedUser.userId);
    } catch (err) {
      setBlockedUsers(previousBlockedUsers);
      Alert.alert("could not unblock user", err instanceof Error ? err.message : "try again");
    } finally {
      setUnblockingUserId(null);
    }
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible ? "blocked-users" : null} onBack={onClose} style={styles.flex} enterFromRight>
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: Math.max(insets.top + 18, 28) },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>blocked accounts</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>done</Text>
              </Pressable>
            </View>
            <Text style={styles.copy}>
              People you unblock may be able to see your profile and videos again.
            </Text>
            {loading ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
            ) : blockedUsers.length === 0 ? (
              <EmptyCard text="you have not blocked anyone." />
            ) : (
              <View style={styles.blockedUsersList}>
                {blockedUsers.map((blockedUser) => (
                  <View key={blockedUser.userId} style={styles.blockedUserRow}>
                    <Avatar
                      uri={blockedUser.avatarUrl}
                      size={44}
                    />
                    <View style={styles.blockedUserInfo}>
                      <Text style={styles.settingsText}>{blockedUser.creatorName}</Text>
                      <Text style={styles.helper}>
                        {blockedUser.role} - {blockedUser.location}
                      </Text>
                    </View>
                    <Pressable
                      disabled={unblockingUserId === blockedUser.userId}
                      style={[
                        styles.unblockButton,
                        unblockingUserId === blockedUser.userId && styles.disabled,
                      ]}
                      onPress={() => void unblock(blockedUser)}
                    >
                      <Text style={styles.unblockButtonText}>
                        {unblockingUserId === blockedUser.userId ? "..." : "unblock"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </SwipeBackSurface>
    </Modal>
  );
}
