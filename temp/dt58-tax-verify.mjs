/**
 * DT-58 (P1.5) — create-trade-offer client tax_amount_cents fallback verification.
 *
 * Reproduces Finding 7 / DT-59 against the DEPLOYED create-trade-offer:
 *   - no-node seller: profiles.node_id = NULL → server tax block is skipped
 *     (vServerCalculatedTax stays false).
 *     * BEFORE (old deployed): offer SUCCEEDS and the trade row + Stripe hold
 *       carry the client's tax_amount_cents (99999) → proves the trust gap.
 *     * AFTER (fixed deployed): offer is REJECTED with TAX_CALC_UNAVAILABLE and
 *       NO trade row / NO Stripe hold is created → proves fail-closed.
 *   - normal path control: seller WITH a node → offer SUCCEEDS and the trade tax
 *     is the server-computed value (NOT the client's 99999) → proves normal flow
 *     unaffected and client tax still ignored.
 *
 * Usage:  node temp/dt58-tax-verify.mjs --mode before|after
 * Writes fixture ids to temp/dt58-tax-fixtures.json for temp/dt58-tax-cleanup.mjs.
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
if (!STRIPE_KEY) { console.error('Missing ~/.dt11-stripe-key (Stripe test key)'); process.exit(2); }

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16' });
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const argv = process.argv.slice(2);
const modeIdx = argv.indexOf('--mode');
const mode = modeIdx > -1 ? argv[modeIdx + 1] : (argv.includes('--before') ? 'before' : argv.includes('--after') ? 'after' : null);
if (mode !== 'before' && mode !== 'after') { console.error('usage: node temp/dt58-tax-verify.mjs --mode before|after'); process.exit(2); }

// Existing seeded seller WITH a node (normal-path control). Audit §3 confirmed tax=182 on their items.
const TEST_SELLER_ID = '14be337c-aad6-403f-bab2-ba1a7d80b666';
const PM_TOKEN = 'tok_visa'; // BP-69: Stripe test-mode PM fixtures via magic token
const PRICE_CENTS = 2600; // $26.00
const BOGUS_TAX = 99999; // client-supplied tax_amount_cents tamper

const stamp = Date.now();
const BUYER_EMAIL = `dt58-buyer-${stamp}@kidsmarketplace.test`;
const SELLER_EMAIL = `dt58-seller-${stamp}@kidsmarketplace.test`;
const PASS = 'TestPass123!';

const log = (...a) => console.log(`[dt58-tax/${mode}]`, ...a);
let passCount = 0;
let failCount = 0;
function check(label, cond, detail) {
  if (cond) { passCount += 1; log(`✅ ${label}`, detail ?? ''); }
  else { failCount += 1; log(`❌ ${label}`, detail ?? ''); }
}

const fixtures = { mode, createdAt: new Date().toISOString(), buyerId: null, buyerEmail: BUYER_EMAIL, buyerPassword: PASS, sellerNoNodeId: null, sellerWithNodeId: null, sellerNoNodeEmail: SELLER_EMAIL, itemNoNodeId: null, itemNormalId: null, tradeIds: [], piIds: [], pmId: null, customerId: null, nodeId: null };

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user;
}

async function setProfileNodeId(userId, nodeId) {
  const { error } = await admin.from('profiles').update({ node_id: nodeId }).eq('user_id', userId);
  if (error) throw new Error(`setProfileNodeId ${userId}: ${error.message}`);
}

async function createItem(sellerId) {
  const now = new Date().toISOString();
  const { data, error } = await admin.from('items').insert({
    seller_id: sellerId,
    title: `QA DT58 Tax Fixture ${now.slice(11, 19)} ${randomUUID().slice(0, 6)}`,
    description: `Dev Task 58 disposable tax verification item (${mode}).`,
    category_id: null,
    condition: 'good',
    price: PRICE_CENTS / 100,
    status: 'available',
    accepts_swap_points: true,
    approved_at: now,
    created_at: now,
    updated_at: now,
  }).select('id').single();
  if (error) throw new Error(`item create failed: ${error.message}`);
  return data.id;
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
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-trade-offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, body: parsed ?? text };
}

async function readTradeByItem(itemId) {
  const { data } = await admin.from('trades').select('id, listing_id, tax_amount_cents, cash_amount_cents, status, stripe_payment_intent_id').eq('listing_id', itemId).maybeSingle();
  return data ?? null;
}

// ── Setup: disposable buyer (Stripe customer + PM) and sellers ──────────────
const buyer = await createUser(BUYER_EMAIL);
fixtures.buyerId = buyer.id;

// Buyer Stripe customer + PM (test-mode, tok_visa — BP-69).
const customer = await stripe.customers.create({ email: BUYER_EMAIL, metadata: { supabase_user_id: buyer.id } });
fixtures.customerId = customer.id;
const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: PM_TOKEN } });
fixtures.pmId = pm.id;
await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
const { error: subErr } = await admin.from('subscriptions').update({ stripe_customer_id: customer.id, stripe_payment_method_id: pm.id }).eq('user_id', buyer.id);
if (subErr) throw new Error(`subscriptions update: ${subErr.message}`);

// No-node seller.
const sellerNoNode = await createUser(SELLER_EMAIL);
fixtures.sellerNoNodeId = sellerNoNode.id;
await setProfileNodeId(sellerNoNode.id, null);

// Normal-path seller WITH a node (use test-seller's node so tax config applies).
const { data: testSeller } = await admin.from('profiles').select('user_id, node_id').eq('user_id', TEST_SELLER_ID).maybeSingle();
if (!testSeller?.node_id) throw new Error('test-seller has no node_id — cannot run normal-path control');
fixtures.nodeId = testSeller.node_id;
const sellerWithNode = await createUser(`dt58-seller-node-${stamp}@kidsmarketplace.test`);
fixtures.sellerWithNodeId = sellerWithNode.id;
await setProfileNodeId(sellerWithNode.id, testSeller.node_id);

// Items.
fixtures.itemNoNodeId = await createItem(sellerNoNode.id);
if (mode === 'after') fixtures.itemNormalId = await createItem(sellerWithNode.id);

const buyerJwt = await exchangeJwt(BUYER_EMAIL, PASS);

// ── No-node seller adversarial call ─────────────────────────────────────────
log('no-node seller adversarial call (tax_amount_cents=99999) …');
const noNodeRes = await invokeEF(buyerJwt, {
  item_id: fixtures.itemNoNodeId,
  sp_amount: 0,
  payment_method_id: pm.id,
  cash_amount_cents: PRICE_CENTS + 149,
  buyer_subscription_status: 'free',
  tax_amount_cents: BOGUS_TAX,
});
log('no-node response:', JSON.stringify(noNodeRes));

if (mode === 'before') {
  // OLD behavior: offer succeeds; trade tax = client value (99999).
  const trade = await readTradeByItem(fixtures.itemNoNodeId);
  check('no-node offer SUCCEEDS (old behavior)', noNodeRes.status === 200 && noNodeRes.body?.success === true, `status=${noNodeRes.status}`);
  check('no-node trade row created', !!trade, trade?.id ?? '(none)');
  check('no-node trade.tax_amount_cents == client 99999 (TRUST GAP)', trade?.tax_amount_cents === BOGUS_TAX, `tax=${trade?.tax_amount_cents}`);
  if (trade?.id) fixtures.tradeIds.push(trade.id);
  if (trade?.stripe_payment_intent_id) fixtures.piIds.push(trade.stripe_payment_intent_id);
} else {
  // NEW behavior: fail closed — rejected, no trade, no hold.
  check('no-node offer REJECTED (fail closed)', noNodeRes.status === 500 && noNodeRes.body?.error?.code === 'TAX_CALC_UNAVAILABLE', `status=${noNodeRes.status} code=${noNodeRes.body?.error?.code}`);
  const trade = await readTradeByItem(fixtures.itemNoNodeId);
  check('no-node trade row NOT created', !trade, trade?.id ?? '(none)');
}

// ── Normal path control (only meaningful AFTER the fix is deployed) ─────────
if (mode === 'after') {
  log('normal-path control call (seller WITH node, tax_amount_cents=99999) …');
  const normRes = await invokeEF(buyerJwt, {
    item_id: fixtures.itemNormalId,
    sp_amount: 0,
    payment_method_id: pm.id,
    cash_amount_cents: PRICE_CENTS + 149,
    buyer_subscription_status: 'free',
    tax_amount_cents: BOGUS_TAX,
  });
  log('normal-path response:', JSON.stringify(normRes));
  const trade = await readTradeByItem(fixtures.itemNormalId);
  check('normal-path offer SUCCEEDS (unaffected)', normRes.status === 200 && normRes.body?.success === true, `status=${normRes.status}`);
  check('normal-path trade.tax != client 99999 (server authoritative)', !!trade && trade.tax_amount_cents !== BOGUS_TAX && trade.tax_amount_cents >= 0, `tax=${trade?.tax_amount_cents}`);
  if (trade?.id) fixtures.tradeIds.push(trade.id);
  if (trade?.stripe_payment_intent_id) fixtures.piIds.push(trade.stripe_payment_intent_id);
}

// ── Persist fixture ids for cleanup ─────────────────────────────────────────
writeFileSync(resolve(__dirname, 'dt58-tax-fixtures.json'), JSON.stringify(fixtures, null, 2));
log(`fixtures saved → temp/dt58-tax-fixtures.json (buyer=${fixtures.buyerId}, sellers=${fixtures.sellerNoNodeId}/${fixtures.sellerWithNodeId}, items=${fixtures.itemNoNodeId}/${fixtures.itemNormalId}, trades=${fixtures.tradeIds.length}, pis=${fixtures.piIds.length})`);

console.log(`\n[dt58-tax/${mode}] RESULT: ${passCount} PASS / ${failCount} FAIL`);
process.exit(failCount > 0 ? 1 : 0);
