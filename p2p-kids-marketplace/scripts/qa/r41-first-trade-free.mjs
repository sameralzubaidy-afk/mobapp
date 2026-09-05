/**
 * DEV-TASK-113 (2026-09-05) item 4 — sanctioned "genuinely-first-trade FREE
 * persona" fixture (F08's remaining leg; R41-class dedicated fixture).
 *
 * WHY THIS EXISTS (qa-task31m-r3 finding / Known Gaps): no standing fixture
 * exists for a free user's GENUINELY FIRST completed trade, so
 * `buyer_fee_first_trade_cents` (flat 149 baseline) can never be verified to
 * apply on a fresh persona, nor that a SECOND trade on the same persona reverts
 * to the normal (%/fixed) fee. All standing buyer personas (test-buyer, -2, -3,
 * test-free) have already traded (fee_state moved first_trade → subsequent).
 *
 * The fee is snapshotted at OFFER time by the server-authoritative resolver
 * `public.fn_get_buyer_fee_for_checkout(p_user_id, p_cash_portion_cents)` and
 * stored on the trade (`buyer_transaction_fee_cents` + `buyer_fee_state`). It
 * depends on profiles.fee_state / completed_trade_count (both default
 * `no_completed_trade` / 0 on a fresh user) and on the user having NO
 * `trial|active` subscription (the signup trigger's `status='free'` row is
 * fine). Completion consumes first-trade eligibility via
 * `trg_sync_buyer_fee_state_on_trade` (status → 'completed' increments
 * completed_trade_count and sets consumed_first_trade_eligibility).
 *
 * Subcommands:
 *
 *   create [--dry-run]
 *       → idempotently provisions a STANDING free persona `qa-first-trade`
 *         (fixed UUID, zero trade history, NO trial/active subscription, saved
 *         Stripe test card MASTERCARD •••• 4444) + ONE tagged Accept-SP item on
 *         test-seller for QA to make an offer on. Prints persona + item ids.
 *
 *   verify-fee [--cash <cents>] [--dry-run]
 *       → read-only: prints the persona's profiles.fee_state /
 *         completed_trade_count and the fee `fn_get_buyer_fee_for_checkout`
 *         resolves (expect flat `buyer_fee_first_trade_cents` = 149 while the
 *         persona has never completed a trade).
 *
 *   drive-offer [--item <listing_id>] [--dry-run]
 *       → headless REAL offer: exchanges a JWT for qa-first-trade and POSTs to
 *         the create-trade-offer Edge Function (body `{ item_id,
 *         cash_amount_cents, payment_method_id }` using the persona's saved PM)
 *         → reads back the created trade's `buyer_transaction_fee_cents` +
 *         `buyer_fee_state` (expect 149 / no_completed_trade) → tags the trade
 *         for reset → best-effort voids the Stripe PI so no auth hold lingers.
 *         The capture → complete → second-offer legs are QA-driven on-device
 *         (or a follow-on `complete` helper in a later session) because a full
 *         headless capture/complete is out of scope (D3, owner 2026-09-05).
 *
 *   reset [--dry-run]
 *       → deletes ALL qa-first-trade persona rows (BP-70 order: child tables
 *         first, then the auth user) + the tagged fixture item/trades. Leaves
 *         every non-fixture row untouched. 0-residue self-check.
 *
 * All writes are service-role on STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1 code — NOT executed this
 * session). --dry-run is fully read-only on every subcommand.
 *
 * Env: .env/.env.staging (service role) + Stripe key ~/.dt11-stripe-key.
 * Persona ids mirror r41-common.mjs PERSONAS.
 */
import {
  getClients,
  getStripeKey,
  personaOrThrow,
  argValue,
  hasFlag,
  log,
  exchangeJwt,
  postEdgeFunction,
} from './lib/r41-common.mjs';

const { url, anon, admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');

const PERSONA_KEY = 'qa-first-trade';
const PERSONA = {
  id: 'a1234567-0000-0000-0000-000000000014',
  email: 'qa-first-trade@kidsmarketplace.test',
  password: 'TestFirstTrade123!',
  name: 'QA First Trade (free)',
};
const SELLER = personaOrThrow('test-seller');

const TAG_PREFIX = 'fixture:qa_r41_first_trade:';
const CARD_TOKEN = 'tok_mastercard'; // MASTERCARD •••• 4444 (BP-69 — the confirmed-valid test card)
const CATEGORY_NAMES = ['Toys', 'Sports', 'Books', 'Electronics'];

function usage() {
  console.log(`qa:r41-first-trade — free genuinely-first-trade persona fixture (F08 leg)

  create [--dry-run]
  verify-fee [--cash <cents>] [--dry-run]
  drive-offer [--item <listing_id>] [--dry-run]
  reset [--dry-run]
`);
}

function stripeCall(method, path, form) {
  const stripeKey = getStripeKey();
  return fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${stripeKey}` },
    body: form ? new URLSearchParams(form) : undefined,
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
    return json;
  });
}

async function findOrCreatePersona() {
  // Look up by email first; create with a fixed UUID when missing.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const existing = (list?.users ?? []).find((u) => u.email === PERSONA.email);
  if (existing) {
    log('r41-first-trade', `✅ persona exists (auth ${existing.id})`);
    return existing.id;
  }
  if (DRY_RUN) {
    log('r41-first-trade', `DRY-RUN — would create persona ${PERSONA.email} (${PERSONA.id})`);
    return PERSONA.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    id: PERSONA.id,
    email: PERSONA.email,
    password: PERSONA.password,
    email_confirm: true,
    user_metadata: { name: PERSONA.name },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const userId = data?.user?.id ?? PERSONA.id;
  // Ensure the profile is complete (signup trigger created it) and phone-verified
  // so the real offer EF path is not gated. NEVER touch fee_state /
  // completed_trade_count — a fresh persona must keep the defaults.
  await admin.from('profiles').upsert(
    {
      user_id: userId,
      name: PERSONA.name,
      phone: '5550101014',
      phone_verified: true,
      profile_completed: true,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      role: 'user',
    },
    { onConflict: 'user_id' }
  );
  log('r41-first-trade', `✅ persona created (${userId}) + profile ensured (free tier by trigger — NO trial/active sub)`);
  return userId;
}

/** Attach a valid Stripe test card and persist it (mirrors ensure-valid-cards.mjs). */
async function ensureSavedCard(userId) {
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_payment_method_id, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (subErr) throw new Error(`subscriptions read: ${subErr.message}`);
  if (sub?.status === 'trial' || sub?.status === 'active') {
    throw new Error(`Persona must be FREE, but subscriptions.status='${sub.status}' — aborting (would make it an active-member, not first-trade-free).`);
  }
  if (DRY_RUN) {
    log('r41-first-trade', 'DRY-RUN — would attach MASTERCARD •••• 4444 + persist stripe_payment_method_id');
    return;
  }
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': CARD_TOKEN });
  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const cust = await stripeCall('POST', '/customers', {
      email: PERSONA.email,
      description: `${PERSONA_KEY} (DEV-TASK-113 first-trade fixture)`,
    });
    customerId = cust.id;
  }
  await stripeCall('POST', `/payment_methods/${pm.id}/attach`, { customer: customerId });
  const { error: updErr } = await admin
    .from('subscriptions')
    .update({ stripe_payment_method_id: pm.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (updErr) throw new Error(`subscriptions update: ${updErr.message}`);
  log('r41-first-trade', `✅ saved card ${pm.id} (MASTERCARD •••• 4444) attached to customer ${customerId}`);
  return pm.id;
}

async function resolveCategories() {
  const { data, error } = await admin
    .from('categories')
    .select('id, name')
    .in('name', CATEGORY_NAMES);
  if (error || !data || data.length === 0) throw new Error(`categories: ${error?.message ?? 'no rows'}`);
  const byName = Object.fromEntries(data.map((c) => [c.name, c.id]));
  return CATEGORY_NAMES.map((n) => byName[n]).filter(Boolean);
}

async function cmdCreate() {
  const buyerId = await findOrCreatePersona();
  await ensureSavedCard(buyerId);
  if (DRY_RUN) {
    log('r41-first-trade', 'DRY-RUN — would create 1 tagged Accept-SP item on test-seller');
    return;
  }
  const marker = Math.random().toString(16).slice(2, 10);
  const now = new Date().toISOString();
  const categoryIds = await resolveCategories();
  const price = 25; // $25 cash item — offer fee snapshot = flat buyer_fee_first_trade_cents (149)
  const { data: item, error: itemErr } = await admin
    .from('items')
    .insert({
      seller_id: SELLER.id,
      title: `QA First-Trade Fixture (${now.slice(0, 10)})`,
      description: `DEV-TASK-113 F08 first-trade free-persona item (marker ${marker}). Delete via qa:r41-first-trade reset.`,
      category_id: categoryIds[0],
      condition: 'good',
      price,
      status: 'available',
      accepts_swap_points: true,
      approved_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (itemErr) throw new Error(`item create: ${itemErr.message}`);
  log('r41-first-trade', `✅ item ${item.id} ($${price.toFixed(2)}, Accept-SP) created for test-seller`);
  log('r41-first-trade', `  Make an offer on-device as qa-first-trade (${PERSONA.email} / ${PERSONA.password}), or:`);
  log('r41-first-trade', `  npm run qa:r41-first-trade -- drive-offer --item ${item.id}`);
  log('r41-first-trade', `  verify fee resolution:  npm run qa:r41-first-trade -- verify-fee`);
}

async function cmdVerifyFee() {
  const userId = await findOrCreatePersona();
  const cashCents = Math.max(0, Number(argValue('cash')) || 2500);
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('fee_state, completed_trade_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (profErr) throw new Error(`profiles read: ${profErr.message}`);
  // Table-returning RPC -> array (BP-62): unwrap data[0].
  const { data: feeRes, error: feeErr } = await admin.rpc('fn_get_buyer_fee_for_checkout', {
    p_user_id: userId,
    p_cash_portion_cents: cashCents,
  });
  if (feeErr) throw new Error(`fn_get_buyer_fee_for_checkout: ${feeErr.message}`);
  const row = Array.isArray(feeRes) ? feeRes[0] : feeRes;
  log('r41-first-trade', `profiles.fee_state=${prof?.fee_state ?? '(unset)'} completed_trade_count=${prof?.completed_trade_count ?? 0}`);
  log('r41-first-trade', `fn_get_buyer_fee_for_checkout(user, ${cashCents}c) -> fee_cents=${row?.fee_cents} fee_state=${row?.fee_state}`);
  const expected = 149; // admin_config buyer_fee_first_trade_cents baseline
  if (row?.fee_cents === expected) {
    log('r41-first-trade', `✅ first-trade flat fee confirmed: ${expected} cents (buyer_fee_first_trade_cents baseline).`);
  } else {
    log('r41-first-trade', `⚠️ fee_cents=${row?.fee_cents} — expected ${expected}. Verify admin_config 'buyer_fee_first_trade_cents' before proceeding.`);
  }
}

async function cmdDriveOffer() {
  const userId = await findOrCreatePersona();
  const itemId = argValue('item');
  if (!itemId) {
    console.error('❌ --item <listing_id> is required (create one first).');
    process.exit(2);
  }
  if (DRY_RUN) {
    log('r41-first-trade', 'DRY-RUN — would POST a real create-trade-offer for qa-first-trade');
    return;
  }
  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, seller_id, price, status')
    .eq('id', itemId)
    .maybeSingle();
  if (itemErr || !item) throw new Error(`item read: ${itemErr?.message ?? 'not found'}`);
  if (item.seller_id === userId) throw new Error('Cannot offer on your own listing.');
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('stripe_payment_method_id')
    .eq('user_id', userId)
    .maybeSingle();
  const pmId = sub?.stripe_payment_method_id;
  if (!pmId) throw new Error('No saved payment method on qa-first-trade — run `create` first.');

  const jwt = await exchangeJwt(url, anon, PERSONA.email, PERSONA.password);
  const body = {
    item_id: item.id,
    cash_amount_cents: Math.round(Number(item.price) * 100),
    payment_method_id: pmId,
  };
  log('r41-first-trade', `POST create-trade-offer body: ${JSON.stringify(body)}`);
  const resp = await postEdgeFunction(url, anon, 'create-trade-offer', jwt, body);
  log('r41-first-trade', `create-trade-offer -> HTTP ${resp.status}: ${JSON.stringify(resp.json)}`);
  if (!resp.ok) throw new Error(`create-trade-offer failed: ${resp.status} ${JSON.stringify(resp.json)}`);

  // Read back the fee snapshot the EF stored on the trade.
  const tradeId = resp.json?.trade_id ?? resp.json?.data?.trade_id ?? null;
  if (!tradeId) {
    log('r41-first-trade', '⚠️ no trade_id in response — nothing further to verify. Clean up any PI manually.');
    return;
  }
  const { data: trade, error: tradeErr } = await admin
    .from('trades')
    .select('id, status, buyer_transaction_fee_cents, buyer_fee_state, stripe_payment_intent_id, notes')
    .eq('id', tradeId)
    .maybeSingle();
  if (tradeErr || !trade) throw new Error(`trade read-back: ${tradeErr?.message ?? 'not found'}`);
  log('r41-first-trade', `✅ trade ${trade.id} status=${trade.status} buyer_transaction_fee_cents=${trade.buyer_transaction_fee_cents} buyer_fee_state=${trade.buyer_fee_state}`);
  if (trade.buyer_transaction_fee_cents === 149) {
    log('r41-first-trade', '✅ first-trade flat fee applied at offer (149 = buyer_fee_first_trade_cents).');
  } else {
    log('r41-first-trade', `⚠️ expected 149, got ${trade.buyer_transaction_fee_cents} — inspect before completing.`);
  }

  // Tag the trade so `reset` finds it, then best-effort void the auth hold so no
  // real Stripe authorization lingers (Phase-1 hygiene; capture/complete is the
  // QA on-device leg).
  const marker = Math.random().toString(16).slice(2, 10);
  await admin.from('trades').update({ notes: `${TAG_PREFIX}${marker}` }).eq('id', trade.id);
  if (trade.stripe_payment_intent_id) {
    try {
      const pi = await stripeCall('POST', `/payment_intents/${trade.stripe_payment_intent_id}/cancel`, {});
      log('r41-first-trade', `✅ voided auth hold ${pi.id} (status=${pi.status}).`);
    } catch (err) {
      log('r41-first-trade', `⚠️ PI cancel failed (best-effort): ${err?.message}`);
    }
  }
  log('r41-first-trade', `  Complete the FIRST trade on-device as qa-first-trade, then make a SECOND offer — it must revert to the normal fee. Reset: npm run qa:r41-first-trade -- reset`);
}

async function cmdReset() {
  if (DRY_RUN) {
    log('r41-first-trade', 'DRY-RUN — would delete qa-first-trade persona rows (BP-70) + tagged fixture trades/items');
    return;
  }
  // 1. Persona (re)locate by email (may or may not exist yet).
  let userId = null;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!listErr) {
    const hit = (list?.users ?? []).find((u) => u.email === PERSONA.email);
    if (hit) userId = hit.id;
  }
  if (userId) {
    // BP-70: delete child rows by user_id first, then the auth user.
    const childTables = [
      'user_notifications',
      'sp_wallets',
      'sp_ledger',
      'notification_preferences',
      'billing_history',
      'subscription_events',
      'subscriptions',
      'profiles',
    ];
    for (const table of childTables) {
      const { error } = await admin.from(table).delete().eq('user_id', userId).select('id');
      if (error) console.warn(`[r41-first-trade] ${table} cleanup warn: ${error.message}`);
    }
    // Tagged trades as buyer + their item (drive-offer leg) — trade-before-item.
    const { data: tagged } = await admin
      .from('trades')
      .select('id, listing_id, notes')
      .ilike('notes', `${TAG_PREFIX}%`)
      .limit(50);
    for (const t of tagged || []) {
      await admin.from('trade_events').delete().eq('trade_id', t.id);
      await admin.from('trade_notification_log').delete().eq('trade_id', t.id);
      await admin.from('trades').delete().eq('id', t.id);
      if (t.listing_id) await admin.from('items').delete().eq('id', t.listing_id);
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`deleteUser: ${delErr.message}`);
    log('r41-first-trade', `✅ persona deleted (${userId}).`);
  } else {
    log('r41-first-trade', 'No qa-first-trade auth user present (already clean).');
  }
  // 2. Item fixture created on test-seller (find + delete).
  const { data: items } = await admin
    .from('items')
    .select('id, seller_id, description')
    .eq('seller_id', SELLER.id)
    .ilike('description', '%DEV-TASK-113 F08 first-trade free-persona item%')
    .limit(20);
  for (const it of items || []) {
    await admin.from('item_images').delete().eq('item_id', it.id);
    await admin.from('items').delete().eq('id', it.id);
  }
  // 3. 0-residue self-check.
  const { data: remaining } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', PERSONA.id);
  const remainingItems = (items || []).length;
  log('r41-first-trade', `✅ reset done — profile residue=${remaining?.length ?? 0}, fixture items deleted=${remainingItems}`);
}

(async () => {
  try {
    if (sub === 'create') await cmdCreate();
    else if (sub === 'verify-fee') await cmdVerifyFee();
    else if (sub === 'drive-offer') await cmdDriveOffer();
    else if (sub === 'reset') await cmdReset();
    else usage();
  } catch (err) {
    console.error('❌ r41-first-trade error:', err?.message || err);
    process.exit(1);
  }
})();
