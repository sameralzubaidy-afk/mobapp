/**
 * DEV-TASK-88 live re-verification (2026-09-02) — REAL renewal through the fixed
 * webhook, driven by a Stripe TEST CLOCK on a DISPOSABLE subscription.
 *
 * Why a test clock: past renewals for test-buyer fired BEFORE `invoice.payment_succeeded`
 * was subscribed, and Stripe never replays. To prove the fix end-to-end we must produce a
 * NEW genuine `invoice.payment_succeeded` and confirm the deployed webhook now:
 *   (1) advances subscriptions.current_period_end / next_billing_date (from the renewal
 *       invoice line period — Stripe reports NULL current_period_* on this account), and
 *   (2) writes a billing_history row.
 *
 * Flow:
 *   1. Disposable staging user (service role, admin.createUser).
 *   2. Create subscriptions row for that user bound to a NEW Stripe customer (customer-id
 *      set first so the webhook can resolve by customer before the sub id is known).
 *   3. Create a Stripe test clock + customer on the clock + PM (tok_visa, BP-69) + a
 *      monthly $5.99 subscription (no trial).
 *      -> Stripe's FIRST invoice is paid immediately -> invoice.payment_succeeded #1
 *         (this already exercises the period-advance from a NULL stored end).
 *   4. Persist stripe_subscription_id on the DB row (best effort, may already be set).
 *   5. Advance the test clock ~35 days -> SECOND invoice (a REAL renewal) -> paid ->
 *      invoice.payment_succeeded #2 -> webhook advances current_period_end forward.
 *   6. Read back: current_period_end advanced (≈ +2 months from anchor) and >= 2
 *      billing_history rows exist.
 *   7. Cleanup (BP-70): delete staging user (profiles by user_id), cancel Stripe sub,
 *      delete customer + PM + test clock, delete the subscriptions/billing rows.
 *
 * Mutations are all disposable + cleaned; run read-only plan with --dry-run.
 * Reads test key from ~/.dt11-stripe-key (never echoed). Staging env from p2p-kids-marketplace/.env.
 * Run: node scripts/qa/dev-task-88-renewal-verify.mjs [--dry-run]
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const KEEP = process.argv.includes('--keep');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !STRIPE_KEY) {
  console.error('Missing env: SUPABASE_URL / SERVICE_ROLE / ANON / STRIPE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
const PRICE_ID = process.env.DT88_PRICE_ID || 'price_1To5Vf4I6kCJlvXoemJISYx1'; // $5.99/mo Kids Club+ admin-backed price (test-buyer's sub uses it)

function log(...a) { console.log(`[dt88-renewal]`, ...a); }
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let userId = null;
let email = null;
let customerId = null;
let subscriptionId = null;
let clockId = null;
let pmId = null;

async function cleanup() {
  if (DRY_RUN || KEEP) return;
  log('🧹 cleanup...');
  try {
    if (subscriptionId) await stripeCall('POST', `/subscriptions/${subscriptionId}`, { cancel_at_period_end: 'true' }).catch(() => {});
    if (customerId) {
      const subs = await stripeCall('GET', `/subscriptions?customer=${customerId}&limit=10`).catch(() => ({ data: [] }));
      for (const s of subs.data || []) await stripeCall('POST', `/subscriptions/${s.id}`, { cancel_at_period_end: 'true' }).catch(() => {});
      await stripeCall('DELETE', `/customers/${customerId}`).catch(() => {});
    }
    if (pmId) await stripeCall('POST', `/payment_methods/${pmId}/detach`).catch(() => {});
    // Stripe test clocks are deleted with DELETE on the clock resource (POST .../delete is a 404).
    if (clockId) {
      const res = await fetch(`https://api.stripe.com/v1/test_helpers/test_clocks/${clockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${STRIPE_KEY}` },
      }).catch(() => null);
      if (res && !res.ok) console.warn('stripe cleanup: test clock delete failed', res.status);
    }
  } catch (e) { console.warn('stripe cleanup err', e.message); }
  try {
    if (userId) {
      const del = async (table) => {
        const { error } = await admin.from(table).delete().eq('user_id', userId);
        if (error) console.warn(`db cleanup ${table} err`, error.message);
      };
      await del('subscriptions');
      await del('billing_history');
      // BP-70: profiles.id !== user_id — delete by user_id
      const { error: pErr } = await admin.from('profiles').delete().eq('user_id', userId);
      if (pErr) console.warn('db cleanup profiles err', pErr.message);
      const { error: uErr } = await admin.auth.admin.deleteUser(userId);
      if (uErr) console.warn('db cleanup deleteUser err', uErr.message);
    }
  } catch (e) { console.warn('db cleanup err', e.message); }
  log('✅ cleanup done');
}

async function main() {
  email = `qa.dt88.renew.${Date.now()}@kidsmarketplace.test`;
  const password = 'TestPass123!';

  if (DRY_RUN) {
    log('DRY-RUN — no mutations. Would: create user, Stripe test clock + customer + PM + monthly sub on ' + PRICE_ID + ', advance clock ~35d, assert period advance + billing rows, then cleanup.');
    return;
  }

  // 1. Disposable user
  const { data: { user }, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: 'DT88 Renewal Fixture' },
  });
  if (userErr) throw new Error(`admin.createUser: ${userErr.message}`);
  userId = user.id;
  log(`✅ user ${email} (${userId})`);

  // 2. Stripe test clock
  const clock = await stripeCall('POST', '/test_helpers/test_clocks', { frozen_time: String(Math.floor(Date.now() / 1000)) });
  clockId = clock.id;
  log(`✅ test clock ${clockId}`);

  // 3. Customer ON the clock (metadata form-encoded: metadata[user_id]=...)
  const customer = await stripeCall('POST', '/customers', {
    test_clock: clockId,
    email,
    'metadata[user_id]': userId,
    'metadata[source]': 'dt88-renewal-verify',
  });
  customerId = customer.id;
  log(`✅ customer ${customerId}`);

  // 3b. PM (tok_visa) + attach + default
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
  pmId = pm.id;
  await stripeCall('POST', `/payment_methods/${pmId}/attach`, { customer: customerId });
  await stripeCall('POST', `/customers/${customerId}`, { 'invoice_settings[default_payment_method]': pmId });

  // 3c. DB subscriptions row bound by CUSTOMER id first (webhook resolves by customer fallback)
  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      stripe_customer_id: customerId,
      stripe_payment_method_id: pmId,
    },
    { onConflict: 'user_id' },
  );
  log(`✅ subscriptions row (customer-bound) for ${userId}`);

  // 4. Create monthly subscription (NO trial) — first invoice is paid immediately
  const sub = await stripeCall('POST', '/subscriptions', {
    customer: customerId,
    'items[0][price]': PRICE_ID,
    'items[0][quantity]': '1',
    collection_method: 'charge_automatically',
    'payment_settings[save_default_payment_method]': 'off',
    'metadata[user_id]': userId,
    'metadata[source]': 'dt88-renewal-verify',
  });
  subscriptionId = sub.id;
  log(`✅ subscription ${sub.id} status=${sub.status} first invoice fired`);

  // persist sub id on DB row (best effort)
  {
    const { error: persistErr } = await admin.from('subscriptions')
      .update({ stripe_subscription_id: sub.id, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (persistErr) console.warn('persist sub id err', persistErr.message);
  }
  log('✅ stripe_subscription_id persisted');

  // wait for webhook #1 (first paid invoice) to be delivered+processed
  log('⏳ waiting 8s for webhook #1 (first invoice.payment_succeeded)...');
  await sleep(8000);

  // snapshot period end after first invoice
  const { data: snap1 } = await admin.from('subscriptions')
    .select('current_period_start, current_period_end, next_billing_date, status').eq('user_id', userId).maybeSingle();
  log('AFTER FIRST INVOICE:', JSON.stringify(snap1 ?? null));

  // 5. Advance the clock ~35 days -> REAL renewal (second invoice)
  log('⏳ advancing test clock +35 days...');
  const adv = await stripeCall('POST', `/test_helpers/test_clocks/${clockId}/advance`, { frozen_time: String(Math.floor(Date.now() / 1000) + 35 * 24 * 3600) });
  log('clock advanced ->', adv.status, 'frozen_time', adv.frozen_time ? new Date(adv.frozen_time * 1000).toISOString() : '(n/a)');

  log('⏳ waiting 12s for webhook #2 (renewal invoice.payment_succeeded)...');
  await sleep(12000);

  // 6. Read back: period window + billing rows
  const { data: snap2 } = await admin.from('subscriptions')
    .select('current_period_start, current_period_end, next_billing_date, status').eq('user_id', userId).maybeSingle();
  log('AFTER RENEWAL:', JSON.stringify(snap2 ?? null));

  const { data: billing } = await admin.from('billing_history')
    .select('charge_id, amount, status, created_at').eq('user_id', userId).order('created_at', { ascending: true });
  log(`billing_history rows: ${(billing || []).length}`);
  for (const b of billing || []) log(`  - ${b.charge_id} | $${(b.amount ?? 0) / 100} | ${b.status}`);

  // Assert
  let pass = true;
  if (!snap2?.current_period_end) { console.error('❌ FAIL: current_period_end not set after renewal'); pass = false; }
  else {
    const end1Ms = snap1?.current_period_end ? Date.parse(snap1.current_period_end) : NaN;
    const end2Ms = Date.parse(snap2.current_period_end);
    const nowMs = Date.now();
    const isForward = !Number.isFinite(end1Ms) || end2Ms > end1Ms;
    const isFuture = end2Ms > nowMs;
    log(`period end after renewal: ${snap2.current_period_end} | forward=${isForward} future=${isFuture}`);
    if (!isForward || !isFuture) { console.error('❌ FAIL: current_period_end did not advance to a future date'); pass = false; }
  }
  const billingCount = (billing || []).length;
  if (billingCount < 2) { console.error(`❌ FAIL: expected >=2 billing_history rows, got ${billingCount}`); pass = false; }
  else { log(`✅ PASS: ${billingCount} billing rows (first invoice + renewal)`); }

  console.log(pass ? '\n✅✅ DT-88 RENEWAL VERIFY PASS' : '\n❌❌ DT-88 RENEWAL VERIFY FAIL');
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(() => cleanup().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  }));
