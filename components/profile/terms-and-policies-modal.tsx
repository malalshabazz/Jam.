import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  TAB_SCREEN_MIN_TOP_PADDING,
  TAB_SCREEN_TOP_PADDING,
} from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";

export function TermsAndPoliciesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");

  useEffect(() => {
    if (visible) setActiveTab("terms");
  }, [visible]);

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible ? "terms-and-policies" : null} onBack={onClose} style={styles.flex} enterFromRight>
        <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              {
                paddingTop: Math.max(insets.top + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING),
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>terms and policies</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>done</Text>
              </Pressable>
            </View>

            <View style={styles.legalTabRow}>
              <Pressable
                style={[styles.legalTab, activeTab === "terms" && styles.legalTabActive]}
                onPress={() => setActiveTab("terms")}
              >
                <Text style={[styles.legalTabText, activeTab === "terms" && styles.legalTabTextActive]}>
                  terms of service
                </Text>
              </Pressable>
              <Pressable
                style={[styles.legalTab, activeTab === "privacy" && styles.legalTabActive]}
                onPress={() => setActiveTab("privacy")}
              >
                <Text style={[styles.legalTabText, activeTab === "privacy" && styles.legalTabTextActive]}>
                  privacy policy
                </Text>
              </Pressable>
            </View>

            <Text style={styles.legalCopy}>
              {activeTab === "terms"
                ? "Placeholder terms of service. This will explain how you can use Jam, what you can post, and the rules for using the platform."
                : "Placeholder privacy policy. This will explain what data Jam collects, how it is used, and your rights as a user."}
            </Text>
          </ScrollView>
        </View>
      </SwipeBackSurface>
    </Modal>
  );
}
