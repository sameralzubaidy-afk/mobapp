/**
 * DT-54 verification harness (service-role fixture + EF calls as test-buyer + reads).
 *
 * Reproduces Dev Task 52's finding with the DEPLOYED create-trade-offer:
 *   - STALE bundle repro: 3× $26 items, charge_one_fee_per_bundle=true, fee NOT
 *     embedded in cash (cash_amount_cents=2600, transaction_fee_cents=149 per item).
 *     Expect post-fix: trades.cash_amount_cents=2600 each (was 2451), Stripe pre-auth
 *     totals 7800+149+3×tax (NOT short by $4.47).
 *   - STANDARD bundle control (fee embedded): identical money to stale repro.
 *   - SINGLE-item control (fee embedded): cash_amount_cents=2600, fee=149.
 *   - SP-blended single-item control (sp=4): cash_amount_cents=2200 (2600−400), sp=4.
 *
 * Writes fixture ids to temp/dt54-fixtures.json for cleanup.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) { console.error('Missing env'); process.exit(2); }

const keyPath = join(homedir(), '.dt11-stripe-key');
const STRIPE_KEY = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const BUYER = { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test', password: 'TestBuyer123!' };
const SELLER_ID = '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller
// SP-blended control uses test-seller-3 (a1234567-...-12) so it does NOT collide
// with the 3-per-seller pending-offer cap test-buyer accumulates on test-seller
// from the stale + standard bundles + single control.
const SELLER_3_ID = 'a1234567-0000-0000-0000-000000000012';
const PM = 'pm_1To5Vb4I6kCJlvXoCUYo0CI3'; // test-buyer MASTERCARD 4444 (verified valid)
const PRICE_CENTS = 2600;
const FLAT_FEE = 149; // active_member flat fee (verified via fn_get_buyer_fee_for_checkout)

const log = (...a) => console.log('[dt54]', ...a);
let passCount = 0;
let failCount = 0;
function check(label, cond, detail) {
  if (cond) { passCount += 1; log(`✅ ${label}`, detail ?? ''); }
  else { failCount += 1; log(`❌ ${label}`, detail ?? ''); }
}

async function createItems(count, sellerId = SELLER_ID) {
  const now = new Date().toISOString();
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const { data, error } = await admin.from('items').insert({
      seller_id: sellerId,
      title: `QA DT54 Fixture ${now.slice(11, 19)} ${i + 1}`,
      description: `Dev Task 54 disposable cash-portion verification item ${i + 1}.`,
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
    ids.push(data.id);
  }
  return ids;
}

async function exchangeJwt() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email: BUYER.email, password: BUYER.password }),
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

async function readTrades(itemIds) {
  const { data } = await admin
    .from('trades')
    .select('id, listing_id, cash_amount_cents, buyer_transaction_fee_cents, sp_amount, tax_amount_cents, stripe_payment_intent_id, status, bundle_id')
    .in('listing_id', itemIds);
  return data ?? [];
}

/** Bundle-path Stripe holds are created in Phase 2 (EdgeRuntime.waitUntil) AFTER the
 *  response is sent — poll until every cash trade has its PI (or timeout). */
async function waitForPis(itemIds, timeoutMs = 40000) {
  const start = Date.now();
  let trades = await readTrades(itemIds);
  while (Date.now() - start < timeoutMs) {
    const missing = trades.filter((t) => (t.cash_amount_cents ?? 0) > 0 && !t.stripe_payment_intent_id);
    if (missing.length === 0) return trades;
    await new Promise((r) => setTimeout(r, 1000));
    trades = await readTrades(itemIds);
  }
  log('WARN: Phase-2 PIs still pending after timeout for', trades.filter((t) => (t.cash_amount_cents ?? 0) > 0 && !t.stripe_payment_intent_id).map((t) => t.id));
  return trades;
}

async function readPi(piId) {
  if (!STRIPE_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  return res.ok ? res.json() : { error: `Stripe ${res.status}` };
}

async function main() {
  log(`Target ${SUPABASE_URL}  buyer=${BUYER.email}  pm=${PM}`);
  const walletBefore = (await admin.from('sp_wallets').select('available_balance, reserved_sp, pending_balance').eq('user_id', BUYER.id).maybeSingle()).data;

  // 1. Fixtures: 3 stale-bundle items + 3 standard-bundle items + 1 single + 1 SP single
  const itemsStale = await createItems(3);
  const itemsStd = await createItems(3);
  const itemSingle = (await createItems(1))[0];
  const itemSp = (await createItems(1, SELLER_3_ID))[0];
  log(`fixtures: stale=${itemsStale.join(',')} std=${itemsStd.join(',')} single=${itemSingle} sp=${itemSp}`);

  const jwt = await exchangeJwt();
  log('JWT ok');

  const calls = [];
  const makeBatch = (ids, feeEmbedded) => ({
    items: ids.map((id, idx) => {
      const fee = feeEmbedded ? (idx === 0 ? FLAT_FEE : 0) : FLAT_FEE;
      const cash = feeEmbedded ? (idx === 0 ? PRICE_CENTS + FLAT_FEE : PRICE_CENTS) : PRICE_CENTS;
      return { item_id: id, cash_amount_cents: cash, sp_amount: 0, transaction_fee_cents: fee, tax_amount_cents: 0 };
    }),
    payment_method_id: PM,
    buyer_subscription_status: 'active',
    bundle_id: randomUUID(),
    submission_nonce: randomUUID(),
  });

  // CALL 1 — STALE bundle (fee NOT embedded in cash; client reports fee separately)
  const staleBody = makeBatch(itemsStale, false);
  calls.push({ name: 'STALE bundle (fee not embedded)', items: itemsStale, body: staleBody });

  // CALL 2 — STANDARD bundle (fee embedded like the real app: cash includes fee on item 0)
  const stdBody = makeBatch(itemsStd, true);
  calls.push({ name: 'STANDARD bundle (fee embedded)', items: itemsStd, body: stdBody });

  // CALL 3 — SINGLE item (fee embedded)
  const singleBody = {
    item_id: itemSingle,
    cash_amount_cents: PRICE_CENTS + FLAT_FEE,
    sp_amount: 0,
    transaction_fee_cents: FLAT_FEE,
    tax_amount_cents: 0,
    payment_method_id: PM,
    buyer_subscription_status: 'active',
    submission_nonce: randomUUID(),
  };
  calls.push({ name: 'SINGLE item (fee embedded)', items: [itemSingle], body: singleBody });

  // CALL 4 — SP-blended single item (sp=4, fee embedded)
  const spBody = {
    item_id: itemSp,
    cash_amount_cents: PRICE_CENTS - 400 + FLAT_FEE, // 2249
    sp_amount: 4,
    transaction_fee_cents: FLAT_FEE,
    tax_amount_cents: 0,
    payment_method_id: PM,
    buyer_subscription_status: 'active',
    submission_nonce: randomUUID(),
  };
  calls.push({ name: 'SP-blended single item (sp=4)', items: [itemSp], body: spBody });

  const results = [];
  for (const c of calls) {
    log(`\n=== ${c.name} ===`);
    log('POST body:', JSON.stringify(c.body));
    const { status, body } = await invokeEF(jwt, c.body);
    log(`HTTP ${status}:`, JSON.stringify(body));
    if (status !== 200 || !body?.success) {
      check(`${c.name} → HTTP 200 + success`, false, JSON.stringify(body));
      continue;
    }
    // Wait for Phase-2 background Stripe holds to attach PIs to the trades.
    const trades = await waitForPis(c.items);
    results.push({ name: c.name, items: c.items, trades });
    log(`created trades: ${trades.length} (PIs attached: ${trades.filter((t) => t.stripe_payment_intent_id).length})`);
  }

  // ── Assertions ──────────────────────────────────────────────────────────
  log('\n===== ASSERTIONS =====');

  const stale = results.find((r) => r.name.startsWith('STALE'));
  if (stale) {
    const t = stale.trades;
    // PostgREST returns in() rows in arbitrary order — match to the REQUEST order.
    const byId = Object.fromEntries(t.map((r) => [r.listing_id, r]));
    const ordered = stale.items.map((id) => byId[id]);
    check('STALE: 3 trades created', t.length === 3, `got ${t.length}`);
    const cashOk = ordered.length === 3 && ordered.every((r) => r?.cash_amount_cents === PRICE_CENTS);
    check('STALE: cash_amount_cents = 2600 per item (was 2451)', cashOk,
      ordered.map((r) => `${r?.cash_amount_cents}`).join(','));
    const feeOk = ordered[0]?.buyer_transaction_fee_cents === FLAT_FEE && ordered[1]?.buyer_transaction_fee_cents === 0 && ordered[2]?.buyer_transaction_fee_cents === 0;
    check('STALE: one fee (149) on item 0, 0 on items 1-2', feeOk,
      ordered.map((r) => `${r?.buyer_transaction_fee_cents}`).join(','));
  }

  const std = results.find((r) => r.name.startsWith('STANDARD'));
  if (std) {
    const t = std.trades;
    const byId = Object.fromEntries(t.map((r) => [r.listing_id, r]));
    const ordered = std.items.map((id) => byId[id]);
    check('STANDARD: 3 trades created', t.length === 3, `got ${t.length}`);
    const cashOk = ordered.length === 3 && ordered.every((r) => r?.cash_amount_cents === PRICE_CENTS);
    check('STANDARD: cash_amount_cents = 2600 per item (identical to STALE)', cashOk,
      ordered.map((r) => `${r?.cash_amount_cents}`).join(','));
    const feeOk = ordered[0]?.buyer_transaction_fee_cents === FLAT_FEE && ordered[1]?.buyer_transaction_fee_cents === 0 && ordered[2]?.buyer_transaction_fee_cents === 0;
    check('STANDARD: fee distribution [149,0,0] (identical to STALE)', feeOk,
      ordered.map((r) => `${r?.buyer_transaction_fee_cents}`).join(','));
    if (stale) {
      const byIdStale = Object.fromEntries(stale.trades.map((r) => [r.listing_id, r]));
      const same = stale.items.every((id, i) =>
        byIdStale[id]?.cash_amount_cents === ordered[i]?.cash_amount_cents &&
        byIdStale[id]?.buyer_transaction_fee_cents === ordered[i]?.buyer_transaction_fee_cents
      );
      check('STANDARD vs STALE: identical money (no behavior change for honest clients)', same, '');
    }
  }

  const single = results.find((r) => r.name.startsWith('SINGLE'));
  if (single) {
    const t = single.trades[0];
    check('SINGLE: 1 trade created', single.trades.length === 1, '');
    check('SINGLE: cash_amount_cents = 2600', t?.cash_amount_cents === PRICE_CENTS, `got ${t?.cash_amount_cents}`);
    check('SINGLE: fee = 149', t?.buyer_transaction_fee_cents === FLAT_FEE, `got ${t?.buyer_transaction_fee_cents}`);
  }

  const sp = results.find((r) => r.name.startsWith('SP-blended'));
  if (sp) {
    const t = sp.trades[0];
    check('SP: 1 trade created', sp.trades.length === 1, '');
    check('SP: cash_amount_cents = 2200 (2600 − 4×100)', t?.cash_amount_cents === 2200, `got ${t?.cash_amount_cents}`);
    check('SP: sp_amount = 4', t?.sp_amount === 4, `got ${t?.sp_amount}`);
    check('SP: fee = 149', t?.buyer_transaction_fee_cents === FLAT_FEE, `got ${t?.buyer_transaction_fee_cents}`);
  }

  // ── Stripe pre-auth totals ──────────────────────────────────────────────
  log('\n===== STRIPE PRE-AUTH =====');
  let stalePiTotal = 0;
  let staleCashCentsSum = 0;
  if (stale) {
    for (const tr of stale.trades) {
      staleCashCentsSum += tr.cash_amount_cents;
      if (tr.stripe_payment_intent_id) {
        const pi = await readPi(tr.stripe_payment_intent_id);
        stalePiTotal += pi?.amount ?? 0;
        log(`PI ${tr.stripe_payment_intent_id}: amount=${pi?.amount} status=${pi?.status} tradeCash=${tr.cash_amount_cents} tradeFee=${tr.buyer_transaction_fee_cents} tax=${tr.tax_amount_cents}`);
      } else {
        log(`trade ${tr.id}: NO PI (stripe_payment_intent_id null)`);
      }
    }
    const staleFeeSum = stale.trades.reduce((s, r) => s + r.buyer_transaction_fee_cents, 0);
    const staleTaxSum = stale.trades.reduce((s, r) => s + (r.tax_amount_cents ?? 0), 0);
    const expectedPiTotal = staleCashCentsSum + staleFeeSum + staleTaxSum;
    check('STALE: Stripe pre-auth totals = 7800 + 149 + 3×tax (not short by $4.47)',
      stalePiTotal === expectedPiTotal && stalePiTotal === 7800 + 149 + staleTaxSum,
      `PI total=${stalePiTotal} expected=${expectedPiTotal} (cash=${staleCashCentsSum} fee=${staleFeeSum} tax=${staleTaxSum})`);
    // Pre-fix the recorded cash was 2451/item → PIs would total 3×2451 + fee + tax = 7502 + tax.
    const buggyTotal = 3 * 2451 + staleFeeSum + staleTaxSum;
    check('STALE: PI total differs from the pre-fix short total (would be 7502+tax)',
      stalePiTotal !== buggyTotal, `buggy would be ${buggyTotal}`);
  }

  // ── Save fixture state for cleanup ──────────────────────────────────────
  const allTradeIds = results.flatMap((r) => r.trades.map((t) => ({ id: t.id, listing_id: t.listing_id, pi: t.stripe_payment_intent_id })));
  const allItemIds = [...itemsStale, ...itemsStd, itemSingle, itemSp];
  const fixture = {
    item_ids: allItemIds,
    trade_ids: allTradeIds,
    bundle_ids: calls.map((c) => c.body.bundle_id).filter(Boolean),
    wallet_before: walletBefore ?? null,
    buyer_id: BUYER.id,
    seller_id: SELLER_ID,
    pm: PM,
    created_at: new Date().toISOString(),
  };
  writeFileSync(join(__dirname, 'dt54-fixtures.json'), JSON.stringify(fixture, null, 2));
  log(`\nfixture state saved → temp/dt54-fixtures.json (items=${allItemIds.length}, trades=${allTradeIds.length})`);

  log(`\n===== RESULT: ${passCount} pass, ${failCount} fail =====`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error('[dt54] FATAL', e); process.exit(1); });
