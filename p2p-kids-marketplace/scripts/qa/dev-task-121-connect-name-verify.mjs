/**
 * DEV-TASK-121 (2026-09-06) — live check: create-stripe-connect-account now
 * pre-fills a fixed plausible legal identity in TEST mode (individual
 * first_name/last_name) so a fresh Express account can sail through Stripe's
 * test-mode verification without the government-ID document detour.
 *
 * What it does (EF-level, bounded — the hosted Express walk is the G01 follow-up):
 *   1. Disposable staging user (service role admin.createUser).
 *   2. Mint a real user JWT (GoTrue password grant) and call the DEPLOYED
 *      create-stripe-connect-account EF exactly like the app does.
 *   3. Read the resulting Stripe account back via the API and assert the
 *      individual first/last names are the plausible pre-filled test identity
 *      ('Test' / 'User') — NOT a display-name jam, which is what failed Stripe's
 *      name+SSN precheck and forced document verification in QA Task-36.
 *   4. Cleanup (BP-70 / R41): DELETE the Stripe account, the seller_payout_methods
 *      row, profiles (by user_id) and the auth user.
 *
 * Reads the Stripe test key from ~/.dt11-stripe-key (never echoed). Staging env
 * from p2p-kids-marketplace/.env.
 * Run: node scripts/qa/dev-task-121-connect-name-verify.mjs [--keep]
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const KEEP = process.argv.includes('--keep');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !STRIPE_KEY) {
  console.error('Missing env: SUPABASE_URL / SERVICE_ROLE / ANON / STRIPE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});
function log(...a) { console.log('[dt121-connect-name]', ...a); }

async function stripeCall(method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

let userId = null;
let accountId = null;

async function cleanup() {
  if (KEEP) return;
  log('🧹 cleanup...');
  if (accountId) {
    await stripeCall('DELETE', `/accounts/${accountId}`).catch((e) => console.warn('stripe account delete err', e.message));
  }
  if (userId) {
    const del = async (table) => {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) console.warn(`db cleanup ${table} err`, error.message);
    };
    await del('seller_payout_methods');
    // BP-70: profiles.id !== user_id — delete by user_id
    const { error: pErr } = await admin.from('profiles').delete().eq('user_id', userId);
    if (pErr) console.warn('db cleanup profiles err', pErr.message);
    const { error: uErr } = await admin.auth.admin.deleteUser(userId);
    if (uErr) console.warn('db cleanup deleteUser err', uErr.message);
  }
  log('✅ cleanup done');
}

async function main() {
  const email = `qa.dt121.connect.${Date.now()}@kidsmarketplace.test`;
  const password = 'TestPass123!';

  // 1. Disposable user
  const { data: { user }, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: 'QA Payout Seller' },
  });
  if (userErr) throw new Error(`admin.createUser: ${userErr.message}`);
  userId = user.id;
  log(`✅ user ${email} (${userId}) — profile display name intentionally 'QA Payout Seller' to prove it is NOT jammed into the legal name`);

  // 2. Real user JWT (GoTrue password grant)
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  const accessToken = tokenJson.access_token;
  if (!accessToken) throw new Error(`GoTrue token grant failed: ${JSON.stringify(tokenJson)}`);

  // 3. Call the DEPLOYED create-stripe-connect-account EF (same request the app sends)
  const efRes = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-connect-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ userId }),
  });
  const efJson = await efRes.json().catch(() => ({}));
  log('EF response:', JSON.stringify(efJson));
  if (!efRes.ok || !efJson.success) throw new Error(`create-stripe-connect-account failed: ${JSON.stringify(efJson)}`);
  accountId = efJson.stripeAccountId;
  log(`✅ Connect account created: ${accountId}`);

  // 4. Read the account back and assert the plausible test identity
  const acct = await stripeCall('GET', `/accounts/${accountId}`);
  log(`individual.first_name='${acct.individual?.first_name ?? '(unset)'}' last_name='${acct.individual?.last_name ?? '(unset)'}'`);
  log(`business_type=${acct.business_type} charges_enabled=${acct.charges_enabled} payouts_enabled=${acct.payouts_enabled}`);
  log(`requirements.currently_due=${JSON.stringify(acct.requirements?.currently_due ?? [])}`);

  const fn = acct.individual?.first_name;
  const ln = acct.individual?.last_name;
  const plausible = fn === 'Test' && ln === 'User';
  const notJammed = fn !== 'QA Payout Seller' && ln !== 'Seller';

  if (plausible && notJammed) {
    log('✅ PASS: individual legal name is the plausible pre-filled test identity (Test/User), NOT the display name (QA Payout Seller/Seller).');
    console.log('\n✅✅ DT-121 CONNECT NAME VERIFY PASS');
  } else {
    console.error(`❌ FAIL: got first='${fn}' last='${ln}' (expected Test/User, not QA Payout Seller/Seller)`);
    console.log('\n❌❌ DT-121 CONNECT NAME VERIFY FAIL');
    process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(async () => { await cleanup(); });
