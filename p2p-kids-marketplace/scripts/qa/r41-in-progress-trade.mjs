/**
 * DEV-TASK-110 / QA Task 31-M FG-1 (2026-09-04) — sanctioned in-progress
 * single (non-bundle) trade fixture builder.
 *
 * WHY THIS EXISTS (FG-1 in e2e-test-results/qa-task31m-adm-mobile-impact-2026-09-04):
 * no sanctioned in-progress trade exists among the standing QA personas right
 * now (all test trades are completed/cancelled). That blocks:
 *   - dispute-resolution mobile reflection  — ADM-TC-I03 / I04 / X06 (needs a
 *     buyer-owned in_progress trade with dispute_status='none' so
 *     `qa:r41-dispute open` can drive the REAL open-dispute EF), and
 *   - changed-value trade-timing enforcement — ADM-TC-F03 / F05 / F06 / F08
 *     (needs an in_progress trade whose pickup/auto-complete deadline reflects
 *     the CURRENT configured timing so QA can change config → re-create →
 *     observe the new value on the mobile timeline).
 *
 * Subcommands:
 *
 *   find [--buyer test-buyer] [--seller test-seller]
 *       → read-only: list the sanctioned fixture in_progress trades between the
 *         pair (notes LIKE 'fixture:qa_r41_inprog_trade:%'), newest first, with
 *         dispute_status so QA can pick the trade to dispute.
 *
 *   create [--buyer test-buyer] [--seller test-seller]
 *          [--with-auto-complete] [--dry-run]
 *       → creates ONE disposable item (available, approved) for the seller and
 *         ONE in_progress non-bundle trade buyer→seller on it. Tagged so `reset`
 *         can find it later. sp_amount=0 + no payment intent + (by default)
 *         auto_complete_at NULL ⇒ no SP/Stripe/auto-complete side effects.
 *         With --with-auto-complete, auto_complete_at is set to
 *         now() + pickup_window_hours (fallback auto_complete_hours, then 72h) —
 *         mirroring fn_set_auto_complete_at — so the mobile pickup/auto-complete
 *         countdown reflects the CURRENT admin_config timing (F-group
 *         changed-value legs). Also sets offer_expires_at? No — offer expiry only
 *         applies to 'pending' offers; this trade is already in_progress.
 *
 *   reset [--dry-run]
 *       → deletes ALL tagged fixture trades (plus the trade_event /
 *         trade_notification_log rows an open-dispute EF may have added) and
 *         their disposable items. Leaves every non-fixture trade untouched.
 *
 * All writes are service-role on STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1). --dry-run is fully read-only.
 *
 * Direct insert is safe (verified against triggers, same rationale as
 * create-in-progress-bundle-fixture.mjs): INSERT triggers on trades handle this
 * row gracefully; trigger_set_auto_complete_at is BEFORE UPDATE OF status, so it
 * does NOT fire on INSERT (auto_complete_at must be set explicitly when wanted);
 * the auto-complete cron (status='in_progress' AND auto_complete_at IS NOT NULL)
 * never touches a NULL-auto_complete_at fixture trade.
 *
 * Env: .env/.env.staging (service role). Persona ids mirror r41-common.mjs.
 */
import { getClients, personaOrThrow, resolveUserId, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const BUYER = argValue('buyer') || 'test-buyer';
const SELLER = argValue('seller') || 'test-seller';
const DRY_RUN = hasFlag('--dry-run');
const WITH_AUTO_COMPLETE = hasFlag('--with-auto-complete');

const buyerP = personaOrThrow(BUYER);
const sellerP = personaOrThrow(SELLER);

// Tag used to make every fixture row identifiable for a clean `reset`. A real
// trade never carries this prefix in notes, so reset cannot hit load-bearing data.
const TAG_PREFIX = 'fixture:qa_r41_inprog_trade:';

const CATEGORY_NAMES = ['Toys', 'Sports', 'Books', 'Electronics'];

function usage() {
  console.log(`qa:r41-in-progress-trade — FG-1 sanctioned in_progress single-trade fixture

  find [--buyer test-buyer] [--seller test-seller]
  create [--buyer test-buyer] [--seller test-seller] [--with-auto-complete] [--dry-run]
  reset [--dry-run]
`);
}

async function resolveCategories() {
  const { data, error } = await admin
    .from('categories')
    .select('id, name')
    .in('name', CATEGORY_NAMES);
  if (error || !data || data.length === 0) {
    console.error(`❌ Could not resolve categories: ${error?.message ?? 'no rows'}`);
    process.exit(1);
  }
  const byName = Object.fromEntries(data.map((c) => [c.name, c.id]));
  return CATEGORY_NAMES.map((n) => byName[n]).filter(Boolean);
}

/** Mirror fn_set_auto_complete_at's fallback chain for the countdown value. */
async function resolvePickupWindowHours() {
  for (const key of ['pickup_window_hours', 'auto_complete_hours']) {
    const { data, error } = await admin
      .from('admin_config')
      .select('value')
      .eq('key', key)
      .eq('is_active', true)
      .maybeSingle();
    if (!error && data && data.value !== null && data.value !== undefined && data.value !== '') {
      const n = Number(data.value);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return 72; // fn_set_auto_complete_at default fallback
}

async function findFixtureTrades(buyerId, sellerId) {
  const { data, error } = await admin
    .from('trades')
    .select('id, listing_id, buyer_id, seller_id, status, dispute_status, bundle_id, cash_amount_cents, auto_complete_at, notes, created_at')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .ilike('notes', `${TAG_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.error(`❌ trades read failed: ${error.message}`); process.exit(1); }
  return data || [];
}

async function cmdFind(buyerId, sellerId) {
  const trades = await findFixtureTrades(buyerId, sellerId);
  if (trades.length === 0) {
    console.log(`\nNo sanctioned fixture in_progress trade between ${BUYER} and ${SELLER} right now.`);
    console.log('  Create one:  npm run qa:r41-in-progress-trade -- create');
    console.log('  Then dispute it:  npm run qa:r41-dispute -- open --trade-id <uuid>');
    return;
  }
  console.log(`\nSanctioned fixture in_progress trades (${BUYER} → ${SELLER}):`);
  for (const t of trades) {
    console.log(`  ${t.id}  status=${t.status} dispute=${t.dispute_status ?? 'none'}  cash=$${((t.cash_amount_cents ?? 0) / 100).toFixed(2)}  auto_complete_at=${t.auto_complete_at ?? '(none)'}  created=${t.created_at}`);
  }
}

async function cmdCreate(buyerId, sellerId) {
  if (DRY_RUN) {
    log('r41-in-progress-trade', `DRY-RUN — would create 1 item for ${SELLER} + 1 in_progress trade ${BUYER}→${SELLER}${WITH_AUTO_COMPLETE ? ' (with auto_complete_at from config)' : ''}`);
    return;
  }

  const marker = Math.random().toString(16).slice(2, 10); // 8-hex, matches r41 idempotency style
  const now = new Date().toISOString();
  const createdBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // staged ~1h ago
  const categoryIds = await resolveCategories();
  const price = 18 + Math.floor(Math.random() * 10); // $18–$27

  // 1. Disposable item for the seller (available + approved invariant).
  const { data: item, error: itemErr } = await admin
    .from('items')
    .insert({
      seller_id: sellerId,
      title: `QA InProgress Trade Fixture (${now.slice(0, 10)})`,
      description: `QA Task 31-M FG-1 disposable in-progress trade item (marker ${marker}). Delete via qa:r41-in-progress-trade reset.`,
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
  if (itemErr) { console.error(`❌ item create failed: ${itemErr.message}`); process.exit(1); }

  // 2. One in_progress non-bundle trade on it.
  const autoCompleteAt = WITH_AUTO_COMPLETE
    ? new Date(Date.now() + (await resolvePickupWindowHours()) * 3600 * 1000).toISOString()
    : null;

  const { data: trade, error: tradeErr } = await admin
    .from('trades')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: item.id,
      status: 'in_progress',
      cash_amount_cents: price * 100,
      sp_amount: 0,
      buyer_transaction_fee_cents: 0,
      tax_amount_cents: 0,
      created_at: createdBefore,
      updated_at: now,
      last_status_change_at: now,
      // NULL auto_complete_at (default) keeps the auto-complete cron away; set
      // via --with-auto-complete for F-group pickup/auto-complete countdown legs.
      auto_complete_at: autoCompleteAt,
      notes: `${TAG_PREFIX}${marker}`,
    })
    .select('id')
    .single();
  if (tradeErr) { console.error(`❌ trade create failed: ${tradeErr.message}`); process.exit(1); }

  log('r41-in-progress-trade', `✅ Created item ${item.id} + in_progress trade ${trade.id}`);
  log('r41-in-progress-trade', `  dispute_status defaults to 'none' → report it:  npm run qa:r41-dispute -- open --trade-id ${trade.id}`);
  log('r41-in-progress-trade', `  clean up after the case:                    npm run qa:r41-in-progress-trade -- reset`);
  if (autoCompleteAt) log('r41-in-progress-trade', `  auto_complete_at = ${autoCompleteAt} (pickup window reflects current admin_config)`);

  // 3. Verify — read the trade back so the row is confirmed live (not assumed).
  const { data: rb, error: rbErr } = await admin
    .from('trades')
    .select('id, status, dispute_status, auto_complete_at, notes')
    .eq('id', trade.id)
    .maybeSingle();
  if (rbErr || !rb) {
    log('r41-in-progress-trade', `⚠️  read-back failed: ${rbErr?.message ?? 'no row'} (harmless to the fixture)`);
  } else {
    log('r41-in-progress-trade', `✅ VERIFY — read-back: status=${rb.status} dispute=${rb.dispute_status} notes=${rb.notes}`);
  }
}

async function cmdReset() {
  const { data: tagged, error: listErr } = await admin
    .from('trades')
    .select('id, listing_id, status, dispute_status, notes')
    .ilike('notes', `${TAG_PREFIX}%`)
    .limit(100);
  if (listErr) { console.error(`❌ tagged-trade lookup failed: ${listErr.message}`); process.exit(1); }
  const trades = tagged || [];
  if (trades.length === 0) {
    log('r41-in-progress-trade', 'No tagged fixture trades to reset (clean).');
    return;
  }
  if (DRY_RUN) {
    log('r41-in-progress-trade', `DRY-RUN — would delete ${trades.length} tagged trade(s) + their items:`);
    for (const t of trades) console.log(`  trade ${t.id}  item ${t.listing_id}  status=${t.status}  dispute=${t.dispute_status ?? 'none'}`);
    return;
  }

  let deleted = 0;
  for (const t of trades) {
    const tid = t.id;
    // Side rows a real open-dispute EF (or the auto-complete / status triggers)
    // may have written for this trade — delete first, non-blocking. Deleting the
    // trade itself does not cascade these everywhere.
    const { error: evErr } = await admin.from('trade_events').delete().eq('trade_id', tid);
    if (evErr) console.warn(`[r41-in-progress-trade] trade_events cleanup warn: ${evErr.message}`);
    const { error: nlErr } = await admin.from('trade_notification_log').delete().eq('trade_id', tid);
    if (nlErr) console.warn(`[r41-in-progress-trade] trade_notification_log cleanup warn: ${nlErr.message}`);
    const { error: tdErr } = await admin.from('trades').delete().eq('id', tid);
    if (tdErr) {
      console.error(`❌ trade delete failed for ${tid}: ${tdErr.message}`);
      continue;
    }
    deleted += 1;
    // Disposable item — drop images first, then the row. Non-fatal on FK residue
    // (e.g. a stray cart row), which is reported so QA knows cleanup was partial.
    const { error: imgErr } = await admin.from('item_images').delete().eq('item_id', t.listing_id);
    if (imgErr) console.warn(`[r41-in-progress-trade] item_images cleanup warn: ${imgErr.message}`);
    const { error: itErr } = await admin.from('items').delete().eq('id', t.listing_id);
    if (itErr) console.warn(`[r41-in-progress-trade] item cleanup warn (non-fatal): ${itErr.message}`);
    log('r41-in-progress-trade', `  ✔ deleted trade ${tid}`);
  }
  log('r41-in-progress-trade', `✅ reset complete: ${deleted}/${trades.length} tagged trade(s) removed`);
}

async function main() {
  const buyerId = await resolveUserId(admin, BUYER);
  const sellerId = await resolveUserId(admin, SELLER);
  if (!buyerId || !sellerId || buyerId === sellerId) {
    console.error(`❌ Buyer and seller must be different known personas (got buyer=${buyerId} seller=${sellerId}).`);
    process.exit(2);
  }
  log('r41-in-progress-trade', `buyer=${BUYER} (${buyerId}) seller=${SELLER} (${sellerId}) sub=${sub}${DRY_RUN ? ' DRY-RUN' : ''}`);
  if (sub === 'find') return cmdFind(buyerId, sellerId);
  if (sub === 'create') return cmdCreate(buyerId, sellerId);
  if (sub === 'reset') return cmdReset();
  usage();
  process.exit(2);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
