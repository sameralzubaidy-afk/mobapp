// QA Task 37 — invoke the app's own sync-stripe-connect-status EF as
// qa-payout-seller (GoTrue password grant) to diagnose why the method row
// isn't reflecting the now-verified Stripe account. Prints the raw response.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', 'p2p-kids-marketplace', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const EMAIL = 'qa-payout-seller@kidsmarketplace.test';
const PASSWORD = 'TestPayout123!';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL/ANON in p2p-kids-marketplace/.env');
  process.exit(2);
}

// GoTrue password grant -> persona JWT
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

// Call the sync EF exactly like the app does
const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/sync-stripe-connect-status`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({}),
});
const syncJson = await syncRes.json().catch(() => ({}));
console.log('sync EF HTTP', syncRes.status);
console.log(JSON.stringify(syncJson, null, 2));
