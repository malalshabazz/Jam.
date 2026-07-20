/**
 * HTTPS bridge for Supabase auth emails (password reset, confirm, etc.).
 * Supabase redirects here with tokens in the query/hash; this page forwards
 * into the native app via the `return` deep link (jam:// or exp://).
 */
export function GET() {
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
      var params = new URLSearchParams(window.location.search);
      var returnTo = params.get("return") || "jam://auth";
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
