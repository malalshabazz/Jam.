import { Modal, Pressable, Text, View } from "react-native";
import { styles } from "@/theme/styles";

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.confirmModalOverlay}>
        <Pressable style={styles.jamPromptShade} onPress={onCancel} />
        <View style={styles.confirmModalCard}>
          <Text style={styles.confirmModalTitle}>{title}</Text>
          {message ? <Text style={styles.confirmModalMessage}>{message}</Text> : null}
          <View style={styles.confirmModalActions}>
            <Pressable style={styles.confirmModalOption} onPress={onCancel}>
              <Text style={styles.confirmOptionCancelText}>cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmModalOption} onPress={onConfirm}>
              <Text style={styles.confirmOptionDangerText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
