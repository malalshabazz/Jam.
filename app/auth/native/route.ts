import {
  DEFAULT_AUTH_RETURN_URL,
  sanitizeAuthReturnUrl,
} from "@/lib/auth-return-url";

/**
 * HTTPS bridge for Supabase auth emails (password reset, confirm, etc.).
 * Supabase redirects here with tokens in the query/hash; this page forwards
 * into the native app via the `return` deep link (jam:// or exp:// only).
 */
export function GET(request: Request) {
  const incoming = new URL(request.url);
  const safeReturn = sanitizeAuthReturnUrl(incoming.searchParams.get("return"));
  // Safe to embed: JSON.stringify escapes quotes/newlines for a JS string literal.
  const safeReturnLiteral = JSON.stringify(safeReturn);
  const defaultReturnLiteral = JSON.stringify(DEFAULT_AUTH_RETURN_URL);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Jam…</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #09090b;
      color: #fafafa;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      padding: 24px;
    }
    main {
      width: min(100%, 360px);
      display: grid;
      gap: 14px;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 40px;
      letter-spacing: -1.5px;
    }
    p {
      margin: 0;
      color: #a1a1aa;
      line-height: 1.45;
      font-size: 15px;
    }
    a, button {
      appearance: none;
      border: 0;
      border-radius: 12px;
      background: #fafafa;
      color: #09090b;
      font-size: 16px;
      font-weight: 700;
      padding: 14px 16px;
      text-decoration: none;
      cursor: pointer;
    }
    .hint {
      font-size: 13px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <main>
    <h1>jam.</h1>
    <p id="status">Opening the app…</p>
    <a id="open" href="#">Open Jam</a>
    <p id="help" class="hint" hidden>
      If nothing happens, open Jam first (Expo Go or the app), then tap Open Jam again.
      Email links work most reliably in a development or production build — not always in Expo Go.
    </p>
  </main>
  <script>
    (function () {
      var ALLOWED = /^(jam|exp|exps|exp\\+[a-z0-9._-]+)$/i;
      var DEFAULT_RETURN = ${defaultReturnLiteral};

      function sanitizeReturn(raw) {
        if (raw == null) return DEFAULT_RETURN;
        var candidate = String(raw).trim();
        if (!candidate) return DEFAULT_RETURN;
        try {
          candidate = decodeURIComponent(candidate);
        } catch (e) {
          return DEFAULT_RETURN;
        }
        candidate = candidate.trim();
        if (!candidate || /[\\r\\n\\0]/.test(candidate)) return DEFAULT_RETURN;
        var parsed;
        try {
          parsed = new URL(candidate);
        } catch (e) {
          return DEFAULT_RETURN;
        }
        var protocol = parsed.protocol.replace(/:$/, "").toLowerCase();
        if (!ALLOWED.test(protocol)) return DEFAULT_RETURN;
        if (parsed.username || parsed.password) return DEFAULT_RETURN;
        return candidate;
      }

      // Prefer server-sanitized return; re-check client-side as defense in depth.
      var returnTo = sanitizeReturn(${safeReturnLiteral});
      var params = new URLSearchParams(window.location.search);
      params.delete("return");
      var qs = params.toString();
      var hash = window.location.hash || "";
      var join = returnTo.indexOf("?") >= 0 ? "&" : "?";
      var deepLink = returnTo + (qs ? join + qs : "") + hash;

      var open = document.getElementById("open");
      open.setAttribute("href", deepLink);
      open.addEventListener("click", function (event) {
        event.preventDefault();
        window.location.href = deepLink;
      });

      window.location.href = deepLink;

      setTimeout(function () {
        document.getElementById("status").textContent = "If Jam didn’t open, tap below.";
        document.getElementById("help").hidden = false;
      }, 1000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
