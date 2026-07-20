import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  changeAccountPassword,
  deleteCurrentAccount,
  fetchAccountDetails,
  requestEmailChange,
  type AccountDetails,
} from "@/lib/native-account";
import { downloadAccountDataExport } from "@/lib/native-data-export";

type AccountPanel = "email" | "password" | "delete" | null;

export function AccountSettingsModal({
  visible,
  themeMode,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  themeMode: "dark" | "light";
  onClose: () => void;
  onDeleted: () => void;
}) {
  const colors = useMemo(() => getColors(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [panel, setPanel] = useState<AccountPanel>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    resetForms();
    setLoading(true);
    void fetchAccountDetails()
      .then((details) => {
        if (!active) return;
        setAccount(details);
        setEmail(details.email ?? "");
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  function resetForms() {
    setAccount(null);
    setPanel(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDeletePassword("");
    setDeleteConfirmation("");
    setExporting(false);
    setNotice(null);
    setError(null);
  }

  function openPanel(nextPanel: Exclude<AccountPanel, null>) {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
    setNotice(null);
    setError(null);
  }

  async function submitEmail() {
    setLoading(true);
    setNotice(null);
    setError(null);
    try {
      await requestEmailChange(email);
      setNotice("confirmation links sent. your email changes after confirmation.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword() {
    setNotice(null);
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("new passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("password changed.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete() {
    if (deleteConfirmation.trim().toLowerCase() !== "delete") {
      setError('type "delete" to confirm.');
      return;
    }

    Alert.alert(
      "delete account?",
      "this permanently removes your profile, videos, saves, jams and messages. this cannot be undone.",
      [
        { text: "cancel", style: "cancel" },
        {
          text: "delete forever",
          style: "destructive",
          onPress: () => {
            setLoading(true);
            setNotice(null);
            setError(null);
            void deleteCurrentAccount(deletePassword)
              .then(onDeleted)
              .catch((err) => setError(getErrorMessage(err)))
              .finally(() => setLoading(false));
          },
        },
      ],
    );
  }

  async function exportAccountData() {
    if (exporting || loading) return;

    setExporting(true);
    setNotice(null);
    setError(null);
    try {
      await downloadAccountDataExport();
      setNotice("your data export is ready. save the file from the share sheet.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="close account settings"
              hitSlop={10}
            >
              <Text style={styles.headerAction}>back</Text>
            </Pressable>
            <Text style={styles.title}>account</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading && !account ? <ActivityIndicator color={colors.text} /> : null}

            <View style={styles.group}>
              <AccountRow
                label="email"
                value={account?.email ?? "not connected"}
                onPress={() => openPanel("email")}
                styles={styles}
              />
              {panel === "email" ? (
                <View style={styles.form}>
                  <Text style={styles.copy}>
                    we’ll send confirmation links before changing your sign-in email.
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="new email"
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                  />
                  <ActionButton
                    label={loading ? "sending..." : "send confirmation"}
                    disabled={loading || !email.trim() || email.trim() === account?.email}
                    onPress={() => void submitEmail()}
                    styles={styles}
                  />
                </View>
              ) : null}
              <View style={styles.divider} />
              <AccountRow
                label="download your data"
                value={exporting ? "preparing..." : undefined}
                onPress={() => void exportAccountData()}
                disabled={exporting || loading}
                styles={styles}
              />
            </View>

            <View style={styles.group}>
              <AccountRow
                label="change password"
                onPress={() => openPanel("password")}
                styles={styles}
              />
              {panel === "password" ? (
                <View style={styles.form}>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="current password"
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                  />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="new password"
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                  />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="repeat new password"
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                  />
                  <ActionButton
                    label={loading ? "changing..." : "change password"}
                    disabled={
                      loading ||
                      !currentPassword ||
                      newPassword.length < 8 ||
                      !confirmPassword
                    }
                    onPress={() => void submitPassword()}
                    styles={styles}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>passkey</Text>
              <View style={styles.group}>
                <AccountRow
                  label="create a passkey"
                  value="coming soon"
                  onPress={() => {
                    Alert.alert(
                      "passkeys are coming soon",
                      "you’ll be able to sign in securely with Face ID, Touch ID or your device passcode.",
                    );
                  }}
                  styles={styles}
                />
              </View>
              <Text style={styles.sectionCopy}>
                sign in without a password using Face ID, Touch ID or your device passcode.
              </Text>
            </View>

            <View style={styles.dangerGroup}>
              <Pressable
                style={styles.row}
                onPress={() => openPanel("delete")}
                accessibilityRole="button"
                accessibilityLabel="delete account"
              >
                <Text style={styles.dangerText}>delete account</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              {panel === "delete" ? (
                <View style={styles.form}>
                  <Text style={styles.dangerCopy}>
                    permanently deletes your profile, posts, messages and account.
                  </Text>
                  <TextInput
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="current password"
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                  />
                  <TextInput
                    value={deleteConfirmation}
                    onChangeText={setDeleteConfirmation}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder='type "delete"'
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                  />
                  <Pressable
                    style={[
                      styles.deleteButton,
                      (loading || !deletePassword || deleteConfirmation.toLowerCase() !== "delete") &&
                        styles.disabled,
                    ]}
                    disabled={
                      loading || !deletePassword || deleteConfirmation.toLowerCase() !== "delete"
                    }
                    onPress={confirmDelete}
                  >
                    <Text style={styles.deleteButtonText}>
                      {loading ? "deleting..." : "delete account forever"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function AccountRow({
  label,
  value,
  onPress,
  disabled = false,
  styles,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled }}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? (
          <Text numberOfLines={1} style={styles.rowValue}>
            {value}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
  styles,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[styles.actionButton, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : "something went wrong. try again.";
}

function getColors(themeMode: "dark" | "light") {
  return themeMode === "light"
    ? {
        background: "#f7f7f8",
        surface: "#ffffff",
        surfaceSoft: "#f2f2f4",
        border: "rgba(0,0,0,0.12)",
        text: "#0a0a0a",
        muted: "#52525b",
        placeholder: "#71717a",
        button: "#0a0a0a",
        buttonText: "#ffffff",
      }
    : {
        background: "#0a0a0a",
        surface: "#18181b",
        surfaceSoft: "#111113",
        border: "rgba(255,255,255,0.12)",
        text: "#ffffff",
        muted: "#a1a1aa",
        placeholder: "#71717a",
        button: "#ffffff",
        buttonText: "#000000",
      };
}

function createStyles(colors: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      minHeight: 58,
      paddingHorizontal: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerAction: { color: colors.muted, fontSize: 15, textTransform: "lowercase" },
    headerSpacer: { width: 34 },
    title: { color: colors.text, fontSize: 20, fontWeight: "800", textTransform: "lowercase" },
    content: { padding: 22, paddingBottom: 52, gap: 18 },
    section: { gap: 8 },
    sectionLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      paddingHorizontal: 4,
      textTransform: "lowercase",
    },
    sectionCopy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    group: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    dangerGroup: {
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.32)",
      borderRadius: 20,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    row: {
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    rowCopy: { flex: 1, gap: 3 },
    rowLabel: { color: colors.text, fontSize: 15, fontWeight: "600", textTransform: "lowercase" },
    rowValue: { color: colors.muted, fontSize: 13 },
    chevron: { color: colors.muted, fontSize: 26, lineHeight: 28 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },
    form: {
      padding: 16,
      paddingTop: 4,
      gap: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    copy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    dangerCopy: { color: "#fca5a5", fontSize: 13, lineHeight: 19 },
    input: {
      minHeight: 50,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: 14,
      fontSize: 15,
    },
    actionButton: {
      minHeight: 50,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.button,
      paddingHorizontal: 16,
    },
    actionButtonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: "800",
      textTransform: "lowercase",
    },
    dangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "600", textTransform: "lowercase" },
    deleteButton: {
      minHeight: 50,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#dc2626",
      paddingHorizontal: 16,
    },
    deleteButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "800",
      textTransform: "lowercase",
    },
    disabled: { opacity: 0.45 },
    notice: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: 8,
    },
    error: {
      color: "#fca5a5",
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: 8,
    },
  });
}
