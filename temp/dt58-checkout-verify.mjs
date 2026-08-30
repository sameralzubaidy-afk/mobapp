/**
 * DT-58 (P2) — create-checkout-session price_id allowlist + server-derived trial verification.
 *
 * Reproduces Finding 8 / DT-60 against the DEPLOYED create-checkout-session:
 *   - rogue price_id (a VALID Stripe test price NOT in the tier allowlist):
 *     * BEFORE (old deployed): price_id is NOT validated — it reaches Stripe, and the
 *       request fails only on the unrelated `automatic_payment_methods` param bug
 *       (CHECKOUT_CREATE_FAILED). A server-side validation would have rejected it first.
 *     * AFTER (fixed deployed): 400 INVALID_PRICE_ID before any Stripe call.
 *   - trial_days override (requires DT58_VALID_PRICE_ID — a temporarily allowlisted price):
 *     send trial_days=99999 (way beyond Stripe's 730-day cap). Stripe REJECTS 99999, so:
 *     * BEFORE (client value honored): session creation FAILS (Stripe rejects 99999).
 *     * AFTER (client value ignored, server tier value used): session CREATES successfully.
 *   - default path ({ email } only):
 *     * BEFORE: CONFIG_UNAVAILABLE (no tier has a stripe_price_id).
 *     * AFTER with temp price: SUCCESS (normal path works when a price is configured).
 *
 * Usage: node temp/dt58-checkout-verify.mjs --mode before|after [--valid-price <id>]
 * Writes fixture ids to temp/dt58-checkout-fixtures.json for temp/dt58-checkout-cleanup.mjs.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) { console.error('Missing env'); process.exit(2); }
const keyPath = join(homedir(), '.dt11-stripe-key');
const STRIPE_KEY = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null;
if (!STRIPE_KEY) { console.error('Missing ~/.dt11-stripe-key'); process.exit(2); }

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16' });
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const argv = process.argv.slice(2);
const modeIdx = argv.indexOf('--mode');
const mode = modeIdx > -1 ? argv[modeIdx + 1] : (argv.includes('--before') ? 'before' : argv.includes('--after') ? 'after' : null);
if (mode !== 'before' && mode !== 'after') { console.error('usage: node temp/dt58-checkout-verify.mjs --mode before|after [--valid-price <id>]'); process.exit(2); }
const validPriceIdx = argv.indexOf('--valid-price');
const VALID_PRICE_ID = validPriceIdx > -1 ? argv[validPriceIdx + 1] : (process.env.DT58_VALID_PRICE_ID || null);

const ABSURD_TRIAL = 99999; // way beyond Stripe's 730-day trial cap — honored ⇒ Stripe rejects
const stamp = Date.now();
const USER_EMAIL = `dt58-checkout-${stamp}@kidsmarketplace.test`;
const PASS = 'TestPass123!';
const log = (...a) => console.log(`[dt58-checkout/${mode}]`, ...a);
let passCount = 0, failCount = 0;
function check(label, cond, detail) {
  if (cond) { passCount += 1; log(`✅ ${label}`, detail ?? ''); }
  else { failCount += 1; log(`❌ ${label}`, detail ?? ''); }
}
const fixtures = { mode, createdAt: new Date().toISOString(), userId: null, userEmail: USER_EMAIL, userPassword: PASS, roguePriceId: null, sessionIds: [] };

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user;
}
async function exchangeJwt(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`GoTrue grant ${res.status} ${JSON.stringify(j)}`);
  return j.access_token;
}
async function invokeEF(jwt, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, body: parsed ?? text };
}
async function sessionLinePrice(sessionId) {
  const s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
  return s.line_items?.data?.[0]?.price?.id ?? null;
}

// ── Setup ───────────────────────────────────────────────────────────────────
const user = await createUser(USER_EMAIL);
fixtures.userId = user.id;
const jwt = await exchangeJwt(USER_EMAIL, PASS);

// Rogue price: VALID Stripe test subscription price NOT in the tier allowlist.
const rogue = await stripe.prices.create({
  currency: 'usd', unit_amount: 100, recurring: { interval: 'month' },
  product_data: { name: `DT58 Rogue Price ${stamp}` },
});
fixtures.roguePriceId = rogue.id;
log('rogue price:', rogue.id, VALID_PRICE_ID ? `| valid allowlisted price: ${VALID_PRICE_ID}` : '(no valid price — trial-override test skipped)');

// ── Test 1: rogue price_id ──────────────────────────────────────────────────
log('rogue price_id call …');
// Use a valid trial here so the ONLY variable is the rogue price (isolates the price_id gap).
const rogueRes = await invokeEF(jwt, { email: USER_EMAIL, user_id: user.id, price_id: rogue.id, trial_days: 60 });
log('rogue response:', JSON.stringify(rogueRes));

if (mode === 'before') {
  // OLD: price_id unvalidated — reaches Stripe; fails only on the unrelated param bug.
  const reachedStripe = rogueRes.status === 500 && rogueRes.body?.error?.code === 'CHECKOUT_CREATE_FAILED';
  const msgIsParamBug = typeof rogueRes.body?.error?.message === 'string' && rogueRes.body.error.message.includes('automatic_payment_methods');
  check('rogue price_id NOT validated server-side (reaches Stripe)', reachedStripe && msgIsParamBug, `status=${rogueRes.status} msg=${rogueRes.body?.error?.message}`);
} else {
  check('rogue price_id REJECTED (INVALID_PRICE_ID)', rogueRes.status === 400 && rogueRes.body?.error?.code === 'INVALID_PRICE_ID', `status=${rogueRes.status} code=${rogueRes.body?.error?.code}`);
}

// ── Test 2: default path ({ email } only) ───────────────────────────────────
log('default path call ({ email } only) …');
const defRes = await invokeEF(jwt, { email: USER_EMAIL });
log('default response:', JSON.stringify(defRes));

if (mode === 'before') {
  // No tier has a stripe_price_id → CONFIG_UNAVAILABLE before reaching Stripe.
  // (If a price IS configured, the old function reaches Stripe and fails on the
  // unrelated automatic_payment_methods bug — either way it cannot complete a session.)
  const configUnavailable = defRes.status === 500 && defRes.body?.error?.code === 'CONFIG_UNAVAILABLE';
  const paramBug = defRes.status === 500 && defRes.body?.error?.code === 'CHECKOUT_CREATE_FAILED'
    && typeof defRes.body?.error?.message === 'string' && defRes.body.error.message.includes('automatic_payment_methods');
  check('default path: old function cannot complete a session (no regression)', configUnavailable || paramBug, `status=${defRes.status} code=${defRes.body?.error?.code}`);
} else {
  // Temp tier price configured → default path resolves the default tier and works.
  if (defRes.status === 200 && defRes.body?.success) {
    fixtures.sessionIds.push(defRes.body.checkout_session_id);
    const linePrice = await sessionLinePrice(defRes.body.checkout_session_id);
    check('default path SUCCEEDS with configured tier price (normal path works)', linePrice === VALID_PRICE_ID, `linePrice=${linePrice}`);
  } else {
    check('default path SUCCEEDS with configured tier price', false, `status=${defRes.status} body=${JSON.stringify(defRes.body)}`);
  }
}

// ── Test 3: trial_days override (needs a temporarily allowlisted valid price) ─
if (VALID_PRICE_ID) {
  log(`trial override call (price_id=${VALID_PRICE_ID}, trial_days=99999) …`);
  const trRes = await invokeEF(jwt, { email: USER_EMAIL, user_id: user.id, price_id: VALID_PRICE_ID, trial_days: ABSURD_TRIAL });
  log('trial response:', JSON.stringify(trRes));
  if (mode === 'before') {
    // OLD: client trial_days honored → Stripe rejects 99999 (>730 cap) → failure.
    const failedWithTrial = trRes.status === 500 && trRes.body?.error?.code === 'CHECKOUT_CREATE_FAILED'
      && typeof trRes.body?.error?.message === 'string' && /trial/i.test(trRes.body.error.message);
    check('client trial_days=99999 honored → Stripe REJECTS (trial gap)', failedWithTrial, `status=${trRes.status} msg=${trRes.body?.error?.message}`);
  } else {
    // NEW: client trial ignored, server tier value used → session creates successfully.
    if (trRes.status === 200 && trRes.body?.success) {
      fixtures.sessionIds.push(trRes.body.checkout_session_id);
      const linePrice = await sessionLinePrice(trRes.body.checkout_session_id);
      check('client trial_days=99999 OVERRIDDEN → session SUCCEEDS (server trial used)', linePrice === VALID_PRICE_ID, `linePrice=${linePrice}`);
    } else {
      check('client trial_days=99999 OVERRIDDEN → session SUCCEEDS', false, `status=${trRes.status} body=${JSON.stringify(trRes.body)}`);
    }
  }
} else {
  log('(no DT58_VALID_PRICE_ID — trial-override test skipped)');
}

// ── Persist fixtures (APPEND-merge so no run's artifacts are orphaned) ───────
const fixturesPath = resolve(__dirname, 'dt58-checkout-fixtures.json');
let ledger = { users: [], roguePrices: [], sessionIds: [] };
if (existsSync(fixturesPath)) {
  try { ledger = JSON.parse(readFileSync(fixturesPath, 'utf8')); } catch { /* fresh */ }
}
ledger.users = [...new Set([...(ledger.users ?? []), fixtures.userId].filter(Boolean))];
ledger.roguePrices = [...new Set([...(ledger.roguePrices ?? []), fixtures.roguePriceId].filter(Boolean))];
ledger.sessionIds = [...new Set([...(ledger.sessionIds ?? []), ...fixtures.sessionIds])];
writeFileSync(fixturesPath, JSON.stringify(ledger, null, 2));
log(`fixtures appended → temp/dt58-checkout-fixtures.json (users=${ledger.users.length}, roguePrices=${ledger.roguePrices.length}, sessions=${ledger.sessionIds.length})`);
console.log(`\n[dt58-checkout/${mode}] RESULT: ${passCount} PASS / ${failCount} FAIL`);
process.exit(failCount > 0 ? 1 : 0);
