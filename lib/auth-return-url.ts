/**
 * Allowed deep-link targets for the HTTPS auth bridge (`/auth/native`).
 * Rejects http(s) and other schemes so tokens in the query/hash cannot be
 * forwarded to an attacker origin (open redirect).
 */
export const DEFAULT_AUTH_RETURN_URL = "jam://auth";

const ALLOWED_PROTOCOL =
  /^(jam|exp|exps|exp\+[a-z0-9._-]+)$/i;

export function sanitizeAuthReturnUrl(raw: string | null | undefined): string {
  if (raw == null) return DEFAULT_AUTH_RETURN_URL;

  let candidate = raw.trim();
  if (!candidate) return DEFAULT_AUTH_RETURN_URL;

  // One decode pass for values that arrived URL-encoded in ?return=
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return DEFAULT_AUTH_RETURN_URL;
  }

  candidate = candidate.trim();
  if (!candidate || /[\r\n\0]/.test(candidate)) {
    return DEFAULT_AUTH_RETURN_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return DEFAULT_AUTH_RETURN_URL;
  }

  const protocol = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (!ALLOWED_PROTOCOL.test(protocol)) {
    return DEFAULT_AUTH_RETURN_URL;
  }

  // user:pass@host can confuse some openers; never needed for our deep links
  if (parsed.username || parsed.password) {
    return DEFAULT_AUTH_RETURN_URL;
  }

  return candidate;
}
