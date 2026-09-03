/**
 * DEV-TASK-94 item 1 reproduction (2026-09-03) — initial billing_history row.
 *
 * QA Task 22: a real hosted-Checkout purchase wrote `subscriptions` + one
 * `subscription_events` row but ZERO `billing_history` rows and NULL
 * `last_payment_date`/`last_payment_amount`, even though deployed webhook v49
 * wires `recordInitialBillingRow` into both row-creating handlers
 * (checkout.session.completed + customer.subscription.created).
 *
 * This repro drives the `customer.subscription.created` row-creating path with
 * a REAL Stripe subscription (test clock, no trial) on a DISPOSABLE user, and
 * deliberately does NOT pre-create the DB `subscriptions` row — so the webhook
 * must INSERT the row (old_status === null) and then call recordInitialBillingRow
 * for the first paid invoice. If that helper fails, billing_history stays empty
 * even though subscriptions + subscription_events wrote — reproducing the bug
 * in ~1/10th of the hosted-Checkout effort (the two row-creating handlers share
 * the identical upsertWebSubscription -> old_status gate -> recordInitialBillingRow
 * code).
 *
 * Read-backs: subscriptions (status/period/last_payment_*), billing_history,
 * subscription_events — reported before cleanup.
 *
 * Mutations are all disposable + cleaned (BP-70 / QA Task 21 A8 discipline).
 * Reads Stripe test key from ~/.dt11-stripe-key (never echoed). Staging env
 * from p2p-kids-marketplace/.env.
 *
 * Run: node scripts/qa/dev-task-94-initial-billing-repro.mjs [--keep] [--dry-run]
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
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !STRIPE_KEY) {
  console.error('Missing env: SUPABASE_URL / SERVICE_ROLE / STRIPE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
// $5.99/mo Kids Club+ — the price linked to subscription_tiers.kids_club_plus (DT-90), same as real checkout.
const PRICE_ID = process.env.DT94_PRICE_ID || 'price_1UBLkH4I6kCJlvXoq9xsDhuG';

function log(...a) { console.log(`[dt94-initial-billing]`, ...a); }
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
      await del('subscription_events');
      await del('user_notifications');
      const { error: pErr } = await admin.from('profiles').delete().eq('user_id', userId);
      if (pErr) console.warn('db cleanup profiles err', pErr.message);
      const { error: uErr } = await admin.auth.admin.deleteUser(userId);
      if (uErr) console.warn('db cleanup deleteUser err', uErr.message);
    }
  } catch (e) { console.warn('db cleanup err', e.message); }
  log('✅ cleanup done');
}

async function main() {
  if (DRY_RUN) {
    log('DRY-RUN — no mutations. Would: create disposable user, Stripe test clock + customer(metadata user_id) + PM + monthly sub on ' + PRICE_ID + ' (NO pre-created DB subscriptions row), wait for webhooks, read back subscriptions/billing_history/subscription_events, then cleanup.');
    return;
  }

  // 1. Disposable user (service role)
  const email = `qa.dt94.billing.${Date.now()}@kidsmarketplace.test`;
  const password = 'TestPass123!';
  const { data: { user }, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: 'DT94 Billing Repro' },
  });
  if (userErr) throw new Error(`admin.createUser: ${userErr.message}`);
  userId = user.id;
  log(`✅ user ${email} (${userId})`);

  // 2. Stripe test clock (frozen now)
  const clock = await stripeCall('POST', '/test_helpers/test_clocks', { frozen_time: String(Math.floor(Date.now() / 1000)) });
  clockId = clock.id;
  log(`✅ test clock ${clockId}`);

  // 3. Customer ON the clock, metadata user_id (lets handleSubscriptionCreated resolve the user)
  const customer = await stripeCall('POST', '/customers', {
    test_clock: clockId,
    email,
    'metadata[user_id]': userId,
    'metadata[source]': 'dt94-initial-billing-repro',
  });
  customerId = customer.id;
  log(`✅ customer ${customerId}`);

  // 3b. PM tok_visa (BP-69) + attach + default (so the first invoice auto-charges)
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
  pmId = pm.id;
  await stripeCall('POST', `/payment_methods/${pmId}/attach`, { customer: customerId });
  await stripeCall('POST', `/customers/${customerId}`, { 'invoice_settings[default_payment_method]': pmId });

  // NOTE: deliberately NO pre-created DB subscriptions row — the webhook's
  // customer.subscription.created must INSERT it (old_status === null) and then
  // call recordInitialBillingRow for the first paid invoice.

  // 4. Create the monthly subscription (NO trial) — first invoice paid immediately
  const sub = await stripeCall('POST', '/subscriptions', {
    customer: customerId,
    'items[0][price]': PRICE_ID,
    'items[0][quantity]': '1',
    collection_method: 'charge_automatically',
    'payment_settings[save_default_payment_method]': 'off',
    'metadata[user_id]': userId,
    'metadata[source]': 'dt94-initial-billing-repro',
  });
  subscriptionId = sub.id;
  log(`✅ subscription ${sub.id} status=${sub.status} latest_invoice=${sub.latest_invoice}`);

  // 5. Wait for webhooks (customer.subscription.created + invoice.payment_succeeded)
  log('⏳ waiting 15s for webhooks to deliver + process...');
  await sleep(15000);

  // 6. Read back — this is the decisive evidence
  const { data: subRow } = await admin.from('subscriptions')
    .select('id, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, last_payment_date, last_payment_amount, payment_retry_count')
    .eq('user_id', userId).maybeSingle();
  log('SUBSCRIPTIONS ROW:', JSON.stringify(subRow ?? null, null, 2));

  const { data: billing } = await admin.from('billing_history')
    .select('charge_id, stripe_invoice_id, amount, status, created_at')
    .eq('user_id', userId).order('created_at', { ascending: true });
  log(`billing_history rows: ${(billing || []).length}`);
  for (const b of billing || []) log(`  - charge_id=${b.charge_id} | invoice=${b.stripe_invoice_id} | $${(b.amount ?? 0) / 100} | ${b.status}`);

  const { data: events } = await admin.from('subscription_events')
    .select('event_type, metadata, created_at').eq('user_id', userId).order('created_at', { ascending: true });
  log(`subscription_events rows: ${(events || []).length}`);
  for (const ev of events || []) log(`  - ${ev.event_type} | ${JSON.stringify(ev.metadata)}`);

  // 7. Assert: the DT92 target is billing_history >= 1 row for the initial charge.
  let pass = true;
  if (!subRow) { console.error('❌ FAIL: subscriptions row was never created by the webhook'); pass = false; }
  else {
    const billingCount = (billing || []).length;
    if (billingCount < 1) {
      console.error(`❌ FAIL: webhook created subscriptions row (status=${subRow.status}) but ZERO billing_history rows`);
      pass = false;
    } else {
      log(`✅ PASS: ${billingCount} billing_history row(s) present for the initial charge`);
    }
    log(`last_payment_date=${subRow.last_payment_date} last_payment_amount=${subRow.last_payment_amount}`);
  }

  console.log(pass ? '\n✅✅ DT-94 INITIAL-BILLING REPRO PASS (billing row observed live)' : '\n❌❌ DT-94 INITIAL-BILLING REPRO FAIL (billing row missing)');
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(() => cleanup().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  }));
