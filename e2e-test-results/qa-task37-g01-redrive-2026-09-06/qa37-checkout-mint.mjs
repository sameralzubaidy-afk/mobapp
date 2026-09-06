// QA Task 37 Batch C — mint a real hosted Stripe Checkout session for the
// disposable user (D05 recipe) via the create-checkout-session EF.
// Prints the checkout URL. Read-only + creates a checkout session (no charge).
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', 'p2p-kids-marketplace', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3] || 'TestPass123';

if (!EMAIL || !SUPABASE_URL || !ANON_KEY) {
  console.error('usage: node qa37-checkout-mint.mjs <email> [password]');
  process.exit(2);
}

const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const tokenJson = await tokenRes.json().catch(() => ({}));
const accessToken = tokenJson.access_token;
if (!accessToken) {
  console.error('GoTrue token grant failed:', JSON.stringify(tokenJson));
  process.exit(1);
}

const efRes = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ email: EMAIL }),
});
const efJson = await efRes.json().catch(() => ({}));
console.log('checkout EF HTTP', efRes.status);
console.log(JSON.stringify(efJson, null, 2));
if (efJson.success && efJson.url) {
  const { execSync } = await import('node:child_process');
  try {
    execSync(`xcrun simctl openurl booted '${efJson.url}'`, { stdio: 'inherit' });
    console.log('Opened checkout URL in the simulator.');
  } catch (e) {
    console.error('openurl failed:', String(e).slice(0, 300));
  }
}
