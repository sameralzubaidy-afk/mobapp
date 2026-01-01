function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildRedirectHtml(params: {
  title: string;
  message: string;
  deepLink: string;
}): string {
  const title = escapeHtml(params.title);
  const message = escapeHtml(params.message);
  const deepLink = escapeHtml(params.deepLink);

  // Keep this simple and compatible with Safari/Chrome in-app browsers.
  // We attempt to open the deep link automatically, but always show a button.
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .card {
        background: white;
        border-radius: 20px;
        padding: 40px;
        max-width: 420px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.30);
      }
      .icon { font-size: 56px; margin-bottom: 16px; }
      h1 { color: #10b981; font-size: 22px; margin-bottom: 10px; font-weight: 700; }
      p { color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 22px; }
      .btn {
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 14px 22px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        font-size: 16px;
      }
      .hint { margin-top: 14px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✅</div>
      <h1>Stripe setup complete</h1>
      <p>${message}</p>
      <a class="btn" href="${deepLink}">Open Kids Marketplace App</a>
      <div class="hint">If the app doesn’t open automatically, tap the button.</div>
    </div>
  </body>
</html>`;
}

function pickDeepLink(params: {
  requestedDeepLink: string | null;
  status: string;
}): string {
  const fallbackBase = 'p2pkidsmarketplace://payout-settings';
  const fallback =
    params.status === 'refresh'
      ? `${fallbackBase}?refresh=true`
      : `${fallbackBase}?success=true`;

  if (!params.requestedDeepLink) return fallback;

  // Hard safety checks so we don't become an open-redirect to arbitrary schemes.
  const candidate = params.requestedDeepLink.trim();
  if (candidate.length === 0 || candidate.length > 2048) return fallback;

  // Allow only known-safe schemes we expect during dev/prod:
  // - exp/exps: Expo Go
  // - p2pkidsmarketplace: standalone builds
  // - https: (optional fallback)
  try {
    const parsed = new URL(candidate);
    const allowed = new Set(['exp:', 'exps:', 'p2pkidsmarketplace:', 'https:']);
    if (!allowed.has(parsed.protocol)) return fallback;
  } catch {
    return fallback;
  }

  return candidate;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Routes:
    //  - /stripe-redirect?status=success|refresh
    //  - /stripe-redirect-refresh (legacy)
    const pathname = url.pathname;
    const statusParam = url.searchParams.get('status');
    const inferredStatus = pathname.includes('refresh') ? 'refresh' : 'success';
    const status = statusParam || inferredStatus;

    // Optional: app can pass a deep link that works in the current runtime.
    // In Expo Go, this should be an exp:// or exps:// URL.
    // In standalone, this can be p2pkidsmarketplace://.
    const requestedDeepLink = url.searchParams.get('dl');
    const deepLink = pickDeepLink({ requestedDeepLink, status });

    const message =
      status === 'refresh'
        ? 'Your Stripe setup session expired. Return to the app to try again.'
        : 'Your Stripe payout account is connected. Return to the app to continue.';

    const html = buildRedirectHtml({
      title: 'Stripe Setup',
      message,
      deepLink,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  },
};
