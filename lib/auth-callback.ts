export type EmailConfirmationCallback = {
  tokenHash: string | null;
  implicit: boolean;
};

export function readEmailConfirmationCallback(): EmailConfirmationCallback | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = url.searchParams.get("type") ?? hash.get("type");
  const tokenHash = url.searchParams.get("token_hash");

  if (tokenHash && type === "email") {
    return { tokenHash, implicit: false };
  }

  if (hash.get("access_token") && (type === "signup" || type === "email")) {
    return { tokenHash: null, implicit: true };
  }

  return null;
}

/** Captured on first client import, before Supabase clears the URL hash. */
export const emailConfirmationCallback = readEmailConfirmationCallback();
