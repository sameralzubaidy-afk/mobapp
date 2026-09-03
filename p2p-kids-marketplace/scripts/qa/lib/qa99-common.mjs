/**
 * QA DT-99 (v2) INDEPENDENT verification (2026-09-03) — shared helpers.
 *
 * Throwaway test tooling only (QA execution discipline). Models the proven
 * DEV-TASK-R41 L02 failing-renewal recipe (dev-task-r41-l02-failing-renewal.mjs):
 * disposable auth user + Stripe test clock + customer(metadata user_id) +
 * tok_visa PM + monthly Kids Club+ sub, then clock sweeps to drive real
 * webhook events. Exports:
 *   - stripeCall / advanceClock (429-aware) / sleep
 *   - driveToGrace(...)  — full leg-1 cycle → 3 failures → sub+wallet grace
 *   - readSubState(...)  — subscriptions / billing_history / sp_wallets /
 *                          user_notifications / subscription_events read-back
 *   - cleanupUser(...)   — BP-70: cancel subs, delete customer, detach PM,
 *                          delete clock, service-role row deletes, auth delete
 * Mutations are disposable-only + always cleaned (BP-70 / QA Task 21 A8).
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env.staging') });

export const PRICE_ID = process.env.R41_PRICE_ID || 'price_1UBLkH4I6kCJlvXoq9xsDhuG';

export function getEnv() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const stripeKey = (() => {
    try { return readFileSync(resolve(homedir(), '.dt11-stripe-key'), 'utf8').trim(); }
    catch { return ''; }
  })();
  if (!url || !serviceRole || !stripeKey) {
    console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / Stripe key (~/.dt11-stripe-key)');
    process.exit(2);
  }
  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  return { url, anon, serviceRole, admin, stripeKey };
}

export function log(tag, ...a) { console.log(`[${tag}]`, ...a); }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function stripeCall(stripeKey, method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${stripeKey}` },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

/** Advance a Stripe test clock to base + days, tolerating Stripe's 429 "advancement underway". */
export async function advanceClock(stripeKey, clockId, days, attempts = 20) {
  const clockState = await stripeCall(stripeKey, 'GET', `/test_helpers/test_clocks/${clockId}`);
  const base = clockState.frozen_time || Math.floor(Date.now() / 1000);
  for (let a = 0; a < attempts; a++) {
    try {
      await stripeCall(stripeKey, 'POST', `/test_helpers/test_clocks/${clockId}/advance`, {
        frozen_time: String(base + days * 86400),
      });
      return;
    } catch (e) {
      if (/429|advancement underway/i.test(e.message) && a < attempts - 1) {
        await sleep(10000);
        continue;
      }
      throw e;
    }
  }
}

/**
 * Create a disposable user + Stripe test clock + customer + tok_visa default PM +
 * monthly sub (period 1 paid → active). Returns all handles for cleanup.
 */
export async function createFixture(env, tag) {
  const { admin, stripeKey } = env;
  const email = `qa.dt99.${tag}.${Date.now()}@kidsmarketplace.test`;
  const { data: { user }, error: uErr } = await admin.auth.admin.createUser({
    email, password: 'TestPass123!', email_confirm: true,
    user_metadata: { name: `QA DT-99 ${tag}` },
  });
  if (uErr) throw new Error(`createUser: ${uErr.message}`);
  const userId = user.id;

  const clock = await stripeCall(stripeKey, 'POST', '/test_helpers/test_clocks', {
    frozen_time: String(Math.floor(Date.now() / 1000)),
  });
  const clockId = clock.id;

  const customer = await stripeCall(stripeKey, 'POST', '/customers', {
    test_clock: clockId, email,
    'metadata[user_id]': userId, 'metadata[source]': `qa99-${tag}`,
  });
  const customerId = customer.id;

  const pm = await stripeCall(stripeKey, 'POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
  const pmId = pm.id;
  await stripeCall(stripeKey, 'POST', `/payment_methods/${pmId}/attach`, { customer: customerId });
  await stripeCall(stripeKey, 'POST', `/customers/${customerId}`, { 'invoice_settings[default_payment_method]': pmId });

  const sub = await stripeCall(stripeKey, 'POST', '/subscriptions', {
    customer: customerId,
    'items[0][price]': PRICE_ID, 'items[0][quantity]': '1',
    collection_method: 'charge_automatically',
    'payment_settings[save_default_payment_method]': 'off',
    'metadata[user_id]': userId, 'metadata[source]': `qa99-${tag}`,
  });

  return { email, userId, customerId, subscriptionId: sub.id, clockId, pmId, subStatus: sub.status };
}

/** Drive the 3-failure cycle: detach the default PM, cross the period-2 anchor, then sweep. */
export async function driveThreeFailures(env, fx, advances = 20) {
  const { stripeKey } = env;
  // Remove the default PM → the next renewal genuinely fails.
  await stripeCall(stripeKey, 'POST', `/payment_methods/${fx.pmId}/detach`).catch(() => {});
  await stripeCall(stripeKey, 'POST', `/customers/${fx.customerId}`, { 'invoice_settings[default_payment_method]': '' }).catch(() => {});
  await sleep(10000);

  // Land just past the period-2 billing anchor (+32d), let webhooks settle.
  await advanceClock(stripeKey, fx.clockId, 32);
  await sleep(20000);

  let lastRetry = 0;
  for (let i = 0; i < advances; i++) {
    if (lastRetry >= 3) break;
    await advanceClock(stripeKey, fx.clockId, 2);
    await sleep(15000);
    const s = await readSubState(env, fx.userId);
    const retry = s.sub?.payment_retry_count ?? 0;
    if (retry !== lastRetry) log('qa99', `  [sweep ${i}] payment_retry_count -> ${retry} (failed_at=${s.sub?.payment_failed_at ?? 'null'})`);
    lastRetry = retry;
    if (retry >= 3) break;
  }
  return lastRetry;
}

/** Full read-back of every table a leg asserts on. */
export async function readSubState(env, userId) {
  const { admin } = env;
  const { data: sub } = await admin.from('subscriptions')
    .select('id, status, stripe_subscription_id, stripe_customer_id, payment_retry_count, payment_failed_at, grace_started_at, grace_ends_at, last_payment_date, last_payment_amount, current_period_start, current_period_end')
    .eq('user_id', userId).maybeSingle();
  const { data: wallet } = await admin.from('sp_wallets')
    .select('state, frozen_at, grace_period_ends_at').eq('user_id', userId).maybeSingle();
  const { data: billing } = await admin.from('billing_history')
    .select('charge_id, stripe_invoice_id, amount, status, description, created_at')
    .eq('user_id', userId).order('created_at', { ascending: true });
  const { data: notifs } = await admin.from('user_notifications')
    .select('type, title, data').eq('user_id', userId).order('created_at', { ascending: true });
  const { data: events } = await admin.from('subscription_events')
    .select('event_type, metadata, created_at').eq('user_id', userId).order('created_at', { ascending: true });
  return { sub, wallet, billing: billing || [], notifs: notifs || [], events: events || [] };
}

/** BP-70 cleanup + residue self-check. Returns residue counts. */
export async function cleanupUser(env, fx, keep = false) {
  const { admin, stripeKey } = env;
  if (keep) return null;
  try {
    if (fx.subscriptionId) await stripeCall(stripeKey, 'POST', `/subscriptions/${fx.subscriptionId}`, { cancel_at_period_end: 'true' }).catch(() => {});
    if (fx.customerId) {
      const subs = await stripeCall(stripeKey, 'GET', `/subscriptions?customer=${fx.customerId}&limit=10`).catch(() => ({ data: [] }));
      for (const s of subs.data || []) await stripeCall(stripeKey, 'POST', `/subscriptions/${s.id}`, { cancel_at_period_end: 'true' }).catch(() => {});
      await stripeCall(stripeKey, 'DELETE', `/customers/${fx.customerId}`).catch(() => {});
    }
    if (fx.pmId) await stripeCall(stripeKey, 'POST', `/payment_methods/${fx.pmId}/detach`).catch(() => {});
    if (fx.pm2Id) await stripeCall(stripeKey, 'POST', `/payment_methods/${fx.pm2Id}/detach`).catch(() => {});
    if (fx.clockId) {
      const res = await fetch(`https://api.stripe.com/v1/test_helpers/test_clocks/${fx.clockId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${stripeKey}` },
      }).catch(() => null);
      if (res && !res.ok) console.warn('stripe cleanup: clock delete failed', res.status);
    }
  } catch (e) { console.warn('stripe cleanup err', e.message); }

  try {
    if (fx.userId) {
      for (const table of ['subscriptions', 'billing_history', 'subscription_events', 'user_notifications', 'profiles', 'sp_wallets']) {
        const { error } = await admin.from(table).delete().eq('user_id', fx.userId);
        if (error) console.warn(`db cleanup ${table} err`, error.message);
      }
      const { error: uErr } = await admin.auth.admin.deleteUser(fx.userId);
      if (uErr) console.warn('db cleanup deleteUser err', uErr.message);
    }
  } catch (e) { console.warn('db cleanup err', e.message); }
}

/** Residue read-back for a disposed user id (0 rows everywhere = clean). */
export async function residue(env, userId) {
  const { admin } = env;
  const out = {};
  for (const table of ['subscriptions', 'billing_history', 'subscription_events', 'user_notifications', 'profiles', 'sp_wallets']) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    out[table] = error ? `err:${error.message}` : count;
  }
  const { data: u, error: uErr } = await admin.auth.admin.listUsers();
  out.auth_users = uErr ? `err:${uErr.message}` : (u?.users ?? []).filter((x) => x.id === userId).length;
  return out;
}

export async function getJwt(env, email) {
  const { url, anon } = env;
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon },
    body: JSON.stringify({ email, password: 'TestPass123!' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GoTrue password grant -> ${res.status} ${JSON.stringify(json)}`);
  return json.access_token;
}

export async function postEdge(env, slug, jwt, body) {
  const { url, anon } = env;
  const res = await fetch(`${url}/functions/v1/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anon },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}
