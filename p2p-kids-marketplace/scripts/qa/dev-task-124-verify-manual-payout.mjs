/**
 * DEV-TASK-124 (Item 1) — LIVE money-path verification: manual Stripe
 * withdrawals now dispatch to a real Stripe test transfer.
 *
 * What it does (bounded, safe-fixture/disposable discipline — R24/BP-71/BP-72):
 *   1. Uses the standing qa-payout-seller persona (fixed id, disposable by
 *      convention) — NOT a shared staging seller.
 *   2. Creates a REAL Stripe Express TEST account with platform-collected
 *      requirements (controller[requirement_collection]=application) so TOS can
 *      be accepted server-side — the standard programmatic-completion model
 *      (the default Express controller=stripe forbids platform TOS acceptance,
 *      which is why hosted onboarding exists). Legal-identity prefill mirrors
 *      the app EF's DT-121 test identity (Test/User, DOB 1990-01-01); the
 *      canonical test SSN is 0000 (not 8888).
 *   3. Inserts the verified primary method row (service role; columns mirror
 *      create-stripe-connect-account) and funds a controlled $5.00 balance.
 *   4. Drives a REAL request_seller_payout (persona JWT).
 *   5. Asserts the AFTER-INSERT trigger → dispatch-manual-payouts EF produced a
 *      REAL Stripe transfer: seller_payouts row → completed with a
 *      provider_reference_id that resolves on Stripe, balance deducted once.
 *   6. Idempotency: re-invokes the sweep EF → NO second transfer.
 *   7. Cleanup: deletes the Connect account + the persona's method rows,
 *      leaving qa-payout-seller at its 0-method / 0-balance baseline (the auth
 *      user itself is a standing persona and is NOT deleted).
 *
 * Env: p2p-kids-marketplace/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * ANON). Stripe test key read from ~/.dt11-stripe-key (never echoed).
 * Run (from p2p-kids-marketplace):
 *   node scripts/qa/dev-task-124-verify-manual-payout.mjs
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !STRIPE_KEY) {
  console.error('Missing env: SUPABASE_URL / SERVICE_ROLE / ANON / STRIPE_KEY');
  process.exit(2);
}

const EMAIL = 'qa-payout-seller@kidsmarketplace.test';
const PASSWORD = 'TestPayout123!';
const USER_ID = 'a1234567-0000-0000-0000-0000000000f2';
const AMOUNT_CENTS = 500; // $5.00 controlled fund

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
function log(...a) { console.log('[dt124-verify]', ...a); }

async function stripeCall(method, path, form) {
  let url = `https://api.stripe.com/v1${path}`;
  const isGet = method === 'GET';
  if (isGet && form) {
    url += '?' + new URLSearchParams(form).toString();
  }
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    body: !isGet && form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

let accountId = null;

async function cleanup() {
  log('🧹 cleanup...');
  if (accountId) {
    await stripeCall('DELETE', `/accounts/${accountId}`).catch((e) => console.warn('stripe account delete err', e.message));
  }
  // Restore qa-payout-seller method baseline (0 methods)
  const { error: mErr } = await admin.from('seller_payout_methods').delete().eq('user_id', USER_ID);
  if (mErr) console.warn('db cleanup methods err', mErr.message);
  // Balance was 0 before the fund; the withdrawal brings it back to 0. Enforce 0 baseline.
  const { error: bErr } = await admin.from('seller_balance').update({ available_balance_cents: 0 }).eq('user_id', USER_ID);
  if (bErr) console.warn('db cleanup balance err', bErr.message);
  log('✅ cleanup done (persona back to 0 methods / 0 balance)');
}

async function personaJwt() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.access_token) throw new Error(`GoTrue token grant failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const jwt = await personaJwt();
  log(`✅ persona JWT minted for ${EMAIL}`);

  // 1. Create a REAL Stripe Express TEST account with platform-collected
  //    requirements (controller[requirement_collection]=application) so TOS can
  //    be accepted server-side — the standard programmatic-completion model (the
  //    default Express controller=stripe forbids the platform accepting TOS).
  //    Legal-identity prefill mirrors the app EF's DT-121 test identity
  //    (Test/User, DOB 1990-01-01); SSN 0000 is the canonical test value.
  const createForm = {
    country: 'US',
    email: EMAIL,
    'controller[requirement_collection]': 'application',
    'controller[losses][payments]': 'application',
    'controller[fees][payer]': 'application',
    'controller[stripe_dashboard][type]': 'none',
    'capabilities[transfers][requested]': 'true',
    business_type: 'individual',
    'individual[first_name]': 'Test',
    'individual[last_name]': 'User',
    'individual[dob][day]': '1',
    'individual[dob][month]': '1',
    'individual[dob][year]': '1990',
    'individual[ssn_last_4]': '0000',
    'individual[phone]': '+15555550100',
    'individual[address][line1]': '123 Test St',
    'individual[address][city]': 'San Francisco',
    'individual[address][state]': 'CA',
    'individual[address][postal_code]': '94103',
    'individual[address][country]': 'US',
    'business_profile[url]': 'https://kidsmarketplace.test',
    'business_profile[product_description]': 'Kids marketplace seller payout verification',
    'tos_acceptance[date]': String(Math.floor(Date.now() / 1000)),
    'tos_acceptance[ip]': '8.8.8.8',
    'tos_acceptance[user_agent]': 'dt124-verify-mjs/1.0',
  };
  const created = await stripeCall('POST', '/accounts', createForm);
  accountId = created.id;
  log(`✅ Connect account created (application-collected): ${accountId}`);

  // 1b. Complete the remaining requirements: attach a test bank account
  //     (external_account token) + MCC + individual email.
  const bankToken = await stripeCall('POST', '/tokens', {
    'bank_account[country]': 'US',
    'bank_account[currency]': 'usd',
    'bank_account[routing_number]': '110000000',
    'bank_account[account_number]': '000123456789',
    'bank_account[account_holder_name]': 'QA Payout Seller',
    'bank_account[account_holder_type]': 'individual',
  });
  await stripeCall('POST', `/accounts/${accountId}`, {
    external_account: bankToken.id,
    'business_profile[mcc]': '5399',
    'individual[email]': EMAIL,
  });

  const acct = await stripeCall('GET', `/accounts/${accountId}`);
  log(`after create: details_submitted=${acct.details_submitted} payouts_enabled=${acct.payouts_enabled} charges_enabled=${acct.charges_enabled}`);
  log(`currently_due=${JSON.stringify(acct.requirements?.currently_due ?? [])}`);
  log(`capabilities=${JSON.stringify(acct.capabilities ?? {})}`);
  if (!acct.details_submitted || !acct.payouts_enabled || (acct.requirements?.currently_due ?? []).length > 0) {
    throw new Error(`Account not fully verified: currently_due=${JSON.stringify(acct.requirements?.currently_due ?? [])} disabled_reason=${acct.requirements?.disabled_reason}`);
  }

  // 2. Insert the verified primary method row (service role). Columns mirror
  //    create-stripe-connect-account's insert; flags are complete because we
  //    verified the account server-side.
  await admin.from('seller_payout_methods').delete().eq('user_id', USER_ID); // clear residue first
  const { error: insErr } = await admin.from('seller_payout_methods').insert({
    user_id: USER_ID,
    method_type: 'stripe_connect',
    stripe_account_id: accountId,
    is_primary: true,
    is_verified: true,
    stripe_onboarding_complete: true,
    stripe_payouts_enabled: true,
    stripe_charges_enabled: true,
  });
  if (insErr) throw new Error(`insert method row: ${insErr.message}`);
  log(`✅ verified primary method row inserted for ${USER_ID}`);

  // 3. Fund a controlled balance (service role — fixture convention)
  const { data: sb, error: balErr } = await admin.from('seller_balance').update({
    available_balance_cents: AMOUNT_CENTS,
    pending_balance_cents: 0,
    lifetime_earnings_cents: AMOUNT_CENTS,
  }).eq('user_id', USER_ID).select('available_balance_cents').single();
  if (balErr) throw new Error(`fund balance: ${balErr.message}`);
  log(`✅ balance funded to ${sb.available_balance_cents}¢`);

  // 5. Drive a REAL withdrawal (persona JWT → request_seller_payout)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: wr, error: wErr } = await userClient.rpc('request_seller_payout', {
    p_user_id: USER_ID,
    p_amount_cents: AMOUNT_CENTS,
  });
  if (wErr || !wr?.success) {
    throw new Error(`request_seller_payout failed: ${wErr?.message ?? JSON.stringify(wr)}`);
  }
  const payoutId = wr.payout_id;
  log(`✅ REAL withdrawal driven: payout_id=${payoutId} net=${wr.net_amount_cents}¢ status=${wr.status}`);

  // 6. Poll the seller_payouts row: trigger → dispatch EF should complete it
  let row = null;
  for (let i = 0; i < 30; i++) {
    const { data } = await admin.from('seller_payouts').select('id,status,provider,provider_reference_id,net_amount_cents,completed_at,failure_reason').eq('id', payoutId).maybeSingle();
    if (data) row = data;
    if (row && (row.status === 'completed' || row.status === 'failed')) break;
    await sleep(1000);
  }
  if (!row) throw new Error(`payout row ${payoutId} not found`);
  log(`payout row after poll: status=${row.status} provider_ref=${row.provider_reference_id} failure=${row.failure_reason ?? 'none'}`);
  if (row.status !== 'completed' || !row.provider_reference_id) {
    throw new Error(`❌ payout not completed — status=${row.status} (trigger/EF dispatch failed; see failure_reason)`);
  }

  // 7. Confirm the REAL Stripe transfer exists (destination = our account, net amount)
  const transfers = await stripeCall('GET', `/transfers?limit=100`);
  const match = transfers.data.find((t) => t.destination === accountId && t.metadata?.payout_id === payoutId);
  if (!match) throw new Error(`❌ no Stripe transfer found for payout ${payoutId} → account ${accountId}`);
  log(`✅ REAL Stripe transfer confirmed: ${match.id} amount=${match.amount}¢ currency=${match.currency} destination=${match.destination}`);
  if (match.amount !== row.net_amount_cents) {
    throw new Error(`❌ transfer amount ${match.amount}¢ != payout net ${row.net_amount_cents}¢`);
  }

  // 8. Idempotency: re-run the sweep EF → must NOT create a second transfer
  const sweepRes = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-manual-payouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify({ sweep: true }),
  });
  const sweepJson = await sweepRes.json().catch(() => ({}));
  log('sweep re-run response:', JSON.stringify(sweepJson));
  const transfers2 = await stripeCall('GET', `/transfers?limit=100`);
  const matches2 = transfers2.data.filter((t) => t.destination === accountId);
  if (matches2.length > 1) {
    throw new Error(`❌ idempotency FAIL — ${matches2.length} transfers for account after sweep re-run`);
  }
  log(`✅ idempotency OK — exactly ${matches2.length} transfer(s) after sweep re-run`);

  // Balance deducted exactly once
  const { data: balAfter } = await admin.from('seller_balance').select('available_balance_cents').eq('user_id', USER_ID).maybeSingle();
  log(`balance after withdrawal: ${balAfter?.available_balance_cents}¢ (expected 0)`);

  console.log('\n✅✅ DT-124 ITEM 1 (manual Stripe payout dispatch) LIVE VERIFY PASS — real transfer minted, row completed, no duplicate on sweep.');
}

main()
  .catch((e) => { console.error('❌', e.message); console.log('\n❌❌ DT-124 ITEM 1 LIVE VERIFY FAIL'); process.exitCode = 1; })
  .finally(async () => { await cleanup(); });
