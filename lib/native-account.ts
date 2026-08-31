import { getAccountDeleteEndpoint, getAuthEmailRedirectUrl, supabase } from "@/lib/native-supabase";

export type AccountDetails = {
  email: string | null;
};

export async function fetchAccountDetails(): Promise<AccountDetails> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Log in again to manage your account.");

  return {
    email: user.email ?? null,
  };
}

export async function requestEmailChange(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const { error } = await supabase.auth.updateUser(
    { email: normalizedEmail },
    { emailRedirectTo: getAuthEmailRedirectUrl("auth") },
  );
  if (error) throw error;
}

export async function verifyCurrentPassword(currentPassword: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user?.email) {
    throw new Error("This account does not have an email password to verify.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (error) throw new Error("Your current password is incorrect.");
}

export async function changeAccountPassword(currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Your new password must be at least 8 characters.");
  }

  await verifyCurrentPassword(currentPassword);
  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  });
  if (error) throw error;
}

export async function deleteCurrentAccount(currentPassword: string) {
  const accountDeleteEndpoint = getAccountDeleteEndpoint();
  if (!accountDeleteEndpoint) {
    throw new Error("Account deletion is not configured.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Log in again before deleting your account.");
  }

  const response = await fetch(accountDeleteEndpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Could not delete your account.");
  }

  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}
