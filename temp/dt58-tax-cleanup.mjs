/**
 * DT-58 cleanup — removes ALL disposable create-trade-offer tax fixtures.
 * Handles BOTH runs: reads temp/dt58-tax-fixtures.json (the latest/after run) plus the
 * hardcoded ORPHANED before-run artifacts (the verify script overwrote the file between
 * the before and after runs). Idempotent — missing rows are skipped.
 * BP-70: delete child rows + `profiles` by `user_id` (profiles.id != user_id), then
 * `admin.auth.admin.deleteUser`. Cancels Stripe holds and deletes test customers.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('Missing env'); process.exit(2); }
const keyPath = join(homedir(), '.dt11-stripe-key');
const STRIPE_KEY = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null;
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16' }) : null;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const log = (...a) => console.log('[dt58-tax-cleanup]', ...a);
let removed = 0;

// Merge the latest fixtures file with the orphaned BEFORE-run artifacts (overwritten file).
let f = {};
const fixturesPath = resolve(__dirname, 'dt58-tax-fixtures.json');
if (existsSync(fixturesPath)) { try { f = JSON.parse(readFileSync(fixturesPath, 'utf8')); } catch { /* ignore */ } }

// Orphaned BEFORE-run artifacts (captured from the before-run output; the file was
// overwritten by the after run before cleanup ran).
const BEFORE = {
  buyerId: 'f478c88a-c301-432c-90cf-7f50605145f2',
  sellerNoNodeId: '865aca79-17fb-4c24-a60f-bec8dd7535c0',
  sellerWithNodeId: '5a04a711-7e39-4fdf-a4a5-7dd81a0284bb',
  itemNoNodeId: '9b879ed5-dbe4-4640-b36a-c5c878dd0802',
  itemNormalId: null,
  tradeIds: ['4a857ba3-7253-4839-a558-5203f496fd23'],
  piIds: [], // resolved from the trade row below
  pmId: null,
  customerId: null, // resolved from the buyer's subscriptions row below
};

const tradeIds = [...new Set([...(f.tradeIds ?? []), ...BEFORE.tradeIds])];
const userIds = [...new Set([f.buyerId, f.sellerNoNodeId, f.sellerWithNodeId, BEFORE.buyerId, BEFORE.sellerNoNodeId, BEFORE.sellerWithNodeId].filter(Boolean))];
const itemIds = [...new Set([f.itemNoNodeId, f.itemNormalId, BEFORE.itemNoNodeId, BEFORE.itemNormalId].filter(Boolean))];

// Resolve unknown PIs from their trade rows before deletion.
for (const tid of tradeIds) {
  if (!tid) continue;
  const { data: tr } = await admin.from('trades').select('stripe_payment_intent_id, seller_id').eq('id', tid).maybeSingle();
  if (tr?.stripe_payment_intent_id) {
    const piSet = new Set([...(f.piIds ?? []), ...BEFORE.piIds]);
    piSet.add(tr.stripe_payment_intent_id);
    f.piIds = [...piSet];
  }
}

// Resolve unknown customers from the buyers' subscriptions rows.
for (const uid of [f.buyerId, BEFORE.buyerId]) {
  if (!uid) continue;
  const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', uid).maybeSingle();
  if (sub?.stripe_customer_id) {
    const cust = new Set([f.customerId, BEFORE.customerId].filter(Boolean));
    cust.add(sub.stripe_customer_id);
    f.customerId = [...cust];
  }
}

const del = async (table, col, vals) => {
  for (const v of (vals ?? []).filter(Boolean)) {
    const { error } = await admin.from(table).delete().eq(col, v);
    if (error) log(`⚠️ delete ${table}.${col}=${v}:`, error.message); else removed += 1;
  }
};

// DB: tax_records + trade_events → trades → items
await del('tax_records', 'trade_id', tradeIds);
await del('trade_events', 'trade_id', tradeIds);
await del('trades', 'id', tradeIds);
await del('items', 'id', itemIds);

// Users: child rows + profiles by user_id, then auth deleteUser (BP-70)
for (const uid of userIds) {
  await del('subscriptions', 'user_id', [uid]);
  await del('sp_wallets', 'user_id', [uid]);
  await del('notification_preferences', 'user_id', [uid]);
  await del('profiles', 'user_id', [uid]);
}
for (const uid of userIds) {
  try { await admin.auth.admin.deleteUser(uid); removed += 1; }
  catch (e) { log(`⚠️ deleteUser ${uid}:`, e?.message ?? e); }
}

// Stripe: cancel holds, then delete customers (removes attached PMs)
if (stripe) {
  const custs = Array.isArray(f.customerId) ? f.customerId : [f.customerId];
  for (const piId of (f.piIds ?? []).filter(Boolean)) {
    try { await stripe.paymentIntents.cancel(piId); removed += 1; }
    catch (e) { log(`⚠️ cancel PI ${piId}:`, e?.message ?? e); }
  }
  for (const cid of custs.filter(Boolean)) {
    try { await stripe.customers.del(cid); removed += 1; }
    catch (e) { log(`⚠️ delete customer ${cid}:`, e?.message ?? e); }
  }
}

log(`cleanup complete — ${removed} artifacts removed (users=${userIds.length}, trades=${tradeIds.length}, items=${itemIds.length}, pis=${(f.piIds ?? []).length})`);
