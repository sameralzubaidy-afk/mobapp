/**
 * DEV-TASK-33 (2026-08-28) — Item 1 verification harness:
 * "NO_STRIPE_CUSTOMER on first cash offer (free-tier buyers)"
 *
 * Proves that the lazy Stripe-customer fix in `create-trade-offer` works end-to-end:
 * a free-tier buyer whose `subscriptions` row carries a saved PaymentMethod id but
 * a NULL `stripe_customer_id` can now submit a first cash offer successfully — the
 * Edge Function lazily creates the Stripe customer, persists it, attaches the PM,
 * and creates the offer (instead of returning NO_STRIPE_CUSTOMER).
 *
 * Flow:
 *   1. Create a disposable free-tier user (admin.createUser — service role).
 *   2. Create a Stripe TEST PaymentMethod from the magic token `tok_visa` (BP-69).
 *   3. Upsert `subscriptions`: stripe_payment_method_id = PM, stripe_customer_id = NULL
 *      (the exact NO_STRIPE_CUSTOMER precondition).
 *   4. Pick an available item (not owned by the fixture user).
 *   5. Sign in via GoTrue password grant -> JWT.
 *   6. Invoke `create-trade-offer` with a cash amount + the PM id.
 *   7. Assert success (NOT NO_STRIPE_CUSTOMER) AND that `subscriptions.stripe_customer_id`
 *      is now populated; confirm the Stripe customer exists and the PM is attached to it.
 *   8. Cleanup (BP-70): cancel the PI hold, delete trades/profiles by user_id, detach+delete
 *      the PM, admin.deleteUser. Pass `--keep` to skip cleanup for inspection.
 *
 * Run:  node scripts/verify-dt33-lazy-customer.mjs [--keep]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const KEEP = process.argv.includes('--keep');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Stripe test secret — read from the session-local key file (never committed).
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !STRIPE_KEY) {
  console.error('❌ Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANON / STRIPE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

function log(...a) { console.log(`[dt33]`, ...a); }
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
let pmId = null;
let customerId = null;
let tradeId = null;
let paymentIntentId = null;
const email = `qa.dt33.lazy.${Date.now()}@kidsmarketplace.test`;
const password = 'TestPass123!';
const results = [];

try {
  // 1. Disposable free-tier user
  // supabase-js returns { data: { user } } — destructure the inner user (a prior
  // `{ data: user }` gave the wrapper object, so `.id` was undefined).
  const { data: { user }, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'DT33 Lazy Customer Fixture' },
  });
  if (userErr) throw new Error(`admin.createUser failed: ${userErr.message}`);
  userId = user.id;
  log(`✅ fixture user created: ${email} (${userId})`);

  // 2. Stripe TEST PM from magic token (BP-69)
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
  pmId = pm.id;
  log(`✅ Stripe test PM created: ${pmId}`);

  // 3. Precondition: subscriptions has PM id but NO customer id
  const { error: subErr } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_payment_method_id: pmId,
      stripe_customer_id: null,
      status: 'free',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (subErr) throw new Error(`subscriptions upsert failed: ${subErr.message}`);
  const { data: subBefore } = await admin.from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id').eq('user_id', userId).maybeSingle();
  log(`✅ precondition set — subscriptions: customer=${subBefore?.stripe_customer_id ?? 'NULL'} pm=${subBefore?.stripe_payment_method_id}`);
  if (subBefore?.stripe_customer_id) throw new Error('Precondition violated: customer id already set');

  // 4. Pick an available item with a valid seller profile
  let item = null;
  for (let attempt = 0; attempt < 5 && !item; attempt++) {
    const { data: cand } = await admin.from('items')
      .select('id, price, seller_id, title, status')
      .eq('status', 'available')
      .neq('seller_id', userId)
      .limit(5);
    for (const c of cand || []) {
      const { data: prof } = await admin.from('profiles')
        .select('user_id').or(`user_id.eq.${c.seller_id},id.eq.${c.seller_id}`).limit(1).maybeSingle();
      if (prof) { item = { ...c, sellerProfileUserId: prof.user_id }; break; }
    }
  }
  if (!item) throw new Error('No available item with a valid seller profile found');
  log(`✅ target item: "${item.title}" id=${item.id} price=$${(item.price / 100).toFixed(2)} seller=${item.seller_id}`);

  // 5. Sign in -> JWT
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`GoTrue sign-in failed: ${tokenRes.status} ${JSON.stringify(tokenJson)}`);
  }
  const accessToken = tokenJson.access_token;
  log('✅ signed in, JWT minted');

  // 6. Invoke create-trade-offer (cash offer, sp=0)
  const itemPriceCents = Math.round(item.price * 100);
  const efRes = await fetch(`${SUPABASE_URL}/functions/v1/create-trade-offer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      item_id: item.id,
      sp_amount: 0,
      payment_method_id: pmId,
      cash_amount_cents: itemPriceCents,
      transaction_fee_cents: 0,
      buyer_subscription_status: 'free',
      tax_amount_cents: 0,
    }),
  });
  const efJson = await efRes.json().catch(() => ({}));
  log(`✅ create-trade-offer HTTP ${efRes.status}: ${JSON.stringify(efJson)}`);

  if (!efJson.success || !efJson.trade_id) {
    throw new Error(`Offer did NOT succeed (code=${efJson?.error?.code ?? 'n/a'}, msg=${efJson?.error?.message ?? efJson?.error ?? 'n/a'})`);
  }
  tradeId = efJson.trade_id;
  results.push(['offer succeeded (no NO_STRIPE_CUSTOMER)', true]);

  // 7a. DB: subscriptions.stripe_customer_id must now be populated
  const { data: subAfter } = await admin.from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id').eq('user_id', userId).maybeSingle();
  customerId = subAfter?.stripe_customer_id ?? null;
  results.push(['subscriptions.stripe_customer_id backfilled', !!customerId && customerId !== 'null']);
  log(`✅ subscriptions AFTER: customer=${customerId} pm=${subAfter?.stripe_payment_method_id}`);

  // 7b. Stripe: customer exists + PM attached to it
  if (customerId) {
    const cust = await stripeCall('GET', `/customers/${customerId}`);
    const pmState = await stripeCall('GET', `/payment_methods/${pmId}`);
    results.push(['Stripe customer exists', cust.id === customerId]);
    results.push(['PM attached to the lazy-created customer', pmState.customer === customerId]);
    log(`✅ Stripe customer ${cust.id} exists; PM attached to ${pmState.customer}`);
  }

  // 7c. Trade row exists with a PaymentIntent hold
  const { data: trade } = await admin.from('trades')
    .select('id, status, stripe_payment_intent_id, cash_amount_cents').eq('id', tradeId).maybeSingle();
  paymentIntentId = trade?.stripe_payment_intent_id ?? null;
  results.push(['trade created (pending)', trade?.status === 'pending']);
  results.push(['Stripe hold (PaymentIntent) attached', !!paymentIntentId]);
  if (trade) log(`✅ trade ${trade.id} status=${trade.status} pi=${paymentIntentId} cash=${trade.cash_amount_cents}c`);
} catch (err) {
  log('❌ ERROR:', err.message);
  process.exitCode = 1;
} finally {
  // 8. Cleanup (BP-70) unless --keep
  if (KEEP) {
    log('⚠️ --keep set — SKIPPING cleanup (fixture left for inspection)');
  } else {
    log('— cleaning up disposable fixture —');
    if (paymentIntentId) {
      try { await stripeCall('POST', `/payment_intents/${paymentIntentId}/cancel`); log(`✅ cancelled PI hold ${paymentIntentId}`); }
      catch (e) { log(`⚠️ cancel PI failed: ${e.message}`); }
    }
    if (pmId) {
      try { await stripeCall('POST', `/payment_methods/${pmId}/detach`); log(`✅ detached PM ${pmId}`); }
      catch (e) { log(`⚠️ detach PM failed: ${e.message}`); }
    }
    if (userId) {
      // supabase-js builders return a Promise-like without `.catch` — use await + result destructure.
      const safeDel = async (table, column, value) => {
        try {
          const { error } = await admin.from(table).delete().eq(column, value);
          return error ? `ERR ${error.message}` : 'ok';
        } catch (e) { return `ERR ${e.message}`; }
      };
      if (tradeId) log(`✅ trades deleted: ${await safeDel('trades', 'id', tradeId)}`);
      log(`✅ profiles deleted (by user_id): ${await safeDel('profiles', 'user_id', userId)}`);
      await safeDel('subscriptions', 'user_id', userId);
      await safeDel('sp_wallets', 'user_id', userId);
      await safeDel('notification_preferences', 'user_id', userId);
      if (tradeId) {
        await safeDel('tax_records', 'trade_id', tradeId);
        await safeDel('trade_events', 'trade_id', tradeId);
        await safeDel('financial_audit_log', 'entity_id', tradeId);
      }
      const delUser = await admin.auth.admin.deleteUser(userId);
      log(`✅ auth user deleted: ${delUser.error ? 'ERR ' + delUser.error.message : 'ok'}`);
    }
  }
  log('— verification summary —');
  if (results.length) {
    for (const [name, ok] of results) log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
    const allPass = results.every(([, ok]) => ok);
    log(allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
    if (!allPass) process.exitCode = 1;
  }
}
