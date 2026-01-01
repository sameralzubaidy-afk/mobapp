/**
 * Edge Function: Payout Settings Redirect
 * Handles Stripe redirect after onboarding
 * Works on mobile (opens app) and web (shows styled page with button)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve((req: Request) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'success';

    console.log('[payout-settings-redirect] Status:', status);

    // Determine redirect target based on status
    let deepLink = 'p2pkidsmarketplace://payout-settings';
    let message = 'Your Stripe payout account has been set up successfully!';
    
    if (status === 'success') {
      deepLink += '?success=true';
    } else if (status === 'refresh') {
      deepLink += '?refresh=true';
      message = 'Your Stripe setup session has expired. Please try again.';
    }

    console.log('[payout-settings-redirect] Redirect to:', deepLink);

    // HTML page that:
    // 1. Attempts to open the app via deep link
    // 2. Shows a styled page with button as fallback for web
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup Complete</title>
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
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.icon { font-size: 64px; margin-bottom: 20px; }
h1 { color: #10b981; font-size: 24px; margin-bottom: 12px; font-weight: 600; }
p { color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
.btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 14px 28px;
  border-radius: 50px;
  text-decoration: none;
  font-weight: 600;
  font-size: 16px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4); }
.loading { display: none; color: #999; font-size: 14px; margin-top: 15px; }
.loading.show { display: block; }
</style>
</head>
<body>
<div class="card">
<div class="icon">✅</div>
<h1>Setup Complete!</h1>
<p>${message}</p>
<a href="${deepLink}" class="btn" id="appBtn">Open Kids Marketplace App</a>
<div class="loading" id="loading">Opening app...</div>
</div>

<script>
(function() {
  const deepLink = '${deepLink}';
  const appBtn = document.getElementById('appBtn');
  const loading = document.getElementById('loading');
  
  // Try to open the app immediately
  loading.classList.add('show');
  
  // Use iframe trick to open deep link without navigation
  const iframe = document.createElement('iframe');
  iframe.src = deepLink;
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  
  // Also try direct window.location as fallback
  setTimeout(function() {
    try {
      window.location = deepLink;
    } catch (e) {
      // Ignore errors
    }
  }, 500);
  
  // After 3 seconds, hide loading message (app either opened or won't open)
  setTimeout(function() {
    loading.classList.remove('show');
  }, 3000);
  
  // Make button clickable
  appBtn.addEventListener('click', function(e) {
    e.preventDefault();
    window.location = deepLink;
  });
})();
</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    console.error('[payout-settings-redirect] Error:', error?.message);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal error' }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});
