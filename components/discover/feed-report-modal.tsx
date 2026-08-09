import { Modal, Pressable, Text, View } from "react-native";
import type { FeedVideo, ReportReason } from "@/lib/native-social-data";
import { styles } from "@/theme/styles";

export const feedReportReasons: Array<{ id: ReportReason; label: string }> = [
  { id: "inappropriate_content", label: "Inappropriate content" },
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
];

export function FeedReportModal({
  item,
  submitting,
  onClose,
  onSubmit,
}: {
  item: FeedVideo | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason) => void;
}) {
  if (!item) return null;

  return (
    <Modal animationType="fade" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <View style={styles.jamPromptOverlay}>
        <Pressable style={styles.jamPromptShade} onPress={onClose} />
        <View style={styles.jamPromptCard}>
          <Text style={styles.cardTitle}>Report video</Text>
          <Text style={styles.helper}>Tell us what is wrong with {item.creatorName}&apos;s video.</Text>
          <View style={styles.reportReasonList}>
            {feedReportReasons.map((reason) => (
              <Pressable
                key={reason.id}
                disabled={submitting}
                style={[styles.reportReasonButton, submitting && styles.disabled]}
                onPress={() => onSubmit(reason.id)}
              >
                <Text style={styles.reportReasonText}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondaryButton} disabled={submitting} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
