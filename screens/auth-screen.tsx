import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuthEmailRedirectUrl, supabase } from "@/lib/native-supabase";
import type { AuthMode } from "@/types/app";
import { AUTH_PASSWORD_MIN_LENGTH } from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { PrimaryButton } from "@/components/ui/primary-button";

function authSubtitle(mode: AuthMode) {
  switch (mode) {
    case "signup":
      return "create your account";
    case "forgot":
      return "reset your password";
    case "reset":
      return "choose a new password";
    default:
      return "welcome back";
  }
}

export function AuthScreen({
  onAuthenticated,
  passwordRecovery = false,
}: {
  onAuthenticated: (userId: string) => Promise<void>;
  passwordRecovery?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const welcomeToOpacity = useRef(new Animated.Value(0)).current;
  const welcomeToTranslateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (passwordRecovery) {
      setMode("reset");
      setError(null);
      setMessage(null);
      setPassword("");
      setConfirmPassword("");
    }
  }, [passwordRecovery]);

  useEffect(() => {
    const fadeDuration = mode === "signup" ? 520 : 320;

    Animated.parallel([
      Animated.timing(welcomeToOpacity, {
        toValue: mode === "signup" ? 1 : 0,
        duration: fadeDuration,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeToTranslateY, {
        toValue: mode === "signup" ? 0 : 6,
        duration: fadeDuration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode, welcomeToOpacity, welcomeToTranslateY]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "forgot") {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail.includes("@")) {
          throw new Error("enter a valid email address");
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: getAuthEmailRedirectUrl("auth"),
        });
        if (resetError) throw resetError;
        setMessage("check your email for a reset link");
        return;
      }

      if (mode === "reset") {
        if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
          throw new Error(`password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters`);
        }
        if (password !== confirmPassword) {
          throw new Error("passwords do not match");
        }

        const { data, error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        if (data.user) await onAuthenticated(data.user.id);
        return;
      }

      if (mode === "signup") {
        if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
          throw new Error(`password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters`);
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: getAuthEmailRedirectUrl("auth") },
        });
        if (signUpError) throw signUpError;
        setEmail("");
        setPassword("");
        setMessage("check your email to confirm your account");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      if (data.user) await onAuthenticated(data.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled =
    loading ||
    (mode === "forgot"
      ? !email.trim()
      : mode === "reset"
        ? password.length < AUTH_PASSWORD_MIN_LENGTH || confirmPassword.length < AUTH_PASSWORD_MIN_LENGTH
        : !email.trim() || password.length < AUTH_PASSWORD_MIN_LENGTH);

  const submitLabel = loading
    ? "please wait..."
    : mode === "login"
      ? "log in"
      : mode === "signup"
        ? "sign up"
        : mode === "forgot"
          ? "send reset link"
          : "save new password";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.centered}
      >
        <View style={styles.authCard}>
          <View style={styles.authLogoWrap}>
            <Animated.Text
              pointerEvents="none"
              style={[
                styles.authWelcomeTo,
                {
                  opacity: welcomeToOpacity,
                  transform: [{ translateY: welcomeToTranslateY }],
                },
              ]}
            >
              welcome to
            </Animated.Text>
            <Text style={styles.logo}>jam.</Text>
          </View>
          <Text style={styles.subtitle}>{authSubtitle(mode)}</Text>

          {message && <Text style={styles.notice}>{message}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          {mode !== "reset" ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="email"
              placeholderTextColor="#71717a"
              style={styles.input}
            />
          ) : null}

          {mode === "login" || mode === "signup" || mode === "reset" ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={mode === "reset" ? "new password" : "password"}
              placeholderTextColor="#71717a"
              style={styles.input}
            />
          ) : null}

          {mode === "reset" ? (
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="confirm password"
              placeholderTextColor="#71717a"
              style={styles.input}
            />
          ) : null}

          {mode === "login" ? (
            <Pressable onPress={() => switchMode("forgot")} hitSlop={8}>
              <Text style={styles.forgotPasswordText}>forgot password?</Text>
            </Pressable>
          ) : null}

          <PrimaryButton label={submitLabel} disabled={submitDisabled} onPress={submit} />

          {mode === "login" ? (
            <Pressable onPress={() => switchMode("signup")}>
              <Text style={styles.switchText}>new here? sign up</Text>
            </Pressable>
          ) : null}

          {mode === "signup" ? (
            <Pressable onPress={() => switchMode("login")}>
              <Text style={styles.switchText}>already have an account? log in</Text>
            </Pressable>
          ) : null}

          {mode === "forgot" ? (
            <Pressable onPress={() => switchMode("login")}>
              <Text style={styles.switchText}>back to log in</Text>
            </Pressable>
          ) : null}

          {mode === "reset" && !passwordRecovery ? (
            <Pressable onPress={() => switchMode("login")}>
              <Text style={styles.switchText}>back to log in</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
