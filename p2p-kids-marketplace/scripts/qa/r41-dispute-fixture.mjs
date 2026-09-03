/**
 * DEV-TASK-R41 (2026-09-03) — MSG-TC-H05/H06 dispute fixture builder.
 *
 * H05 ("Trade dispute: mark under review") and H06 ("resolve complete / refund")
 * need a REAL buyer-reported dispute (a genuine in_progress trade + the buyer's
 * report action) on a standing persona pair, because the admin dispute queue is
 * confirmed working but empty.
 *
 * Subcommands:
 *
 *   find --buyer test-buyer --seller test-seller
 *       → read-only: list in_progress trades between the pair that can still be
 *         reported (dispute_status 'none'), newest first.
 *
 *   open --buyer test-buyer --seller test-seller [--trade-id <uuid>]
 *        [--reason "Item not as described"] [--notes "…"] [--dry-run]
 *       → drives the REAL buyer-report path: GoTrue password grant for the buyer
 *         JWT → POST to the `open-dispute` Edge Function (TFV2-011) with
 *         { trade_id, reason, description } → dispute_status becomes 'reported'
 *         (the state H05's "Mark Under Review" acts on). Requires an in_progress
 *         trade owned by the buyer; run `find` first. A checkout decline etc. is
 *         NOT the same path — this is the real dispute write.
 *
 *   reset --trade-id <uuid> [--dry-run]
 *       → admin service-role restore: dispute_status back to 'none' + clear the
 *         dispute columns + remove the trade_event / seller notification rows
 *         created by the open-dispute EF (only when currently 'reported').
 *
 * All writes are against STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1). --dry-run is read-only.
 *
 * Env: .env/.env.staging. Persona ids mirror ef-repro.mjs.
 */
import { getClients, personaOrThrow, resolveUserId, argValue, hasFlag, log, exchangeJwt, postEdgeFunction } from './lib/r41-common.mjs';

const { url, anon, admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');
const BUYER = argValue('buyer') || 'test-buyer';
const SELLER = argValue('seller') || 'test-seller';
const TRADE_ID = argValue('trade-id');
const REASON = argValue('reason') || 'Item was not as described in the listing.';
const NOTES = argValue('notes') || 'QA fixture: buyer reports a problem with this trade (H05/H06).';

const buyerP = personaOrThrow(BUYER);
const sellerP = personaOrThrow(SELLER);

function usage() {
  console.log(`qa:r41-dispute — H05/H06 dispute fixture builder

  find --buyer test-buyer --seller test-seller
  open --buyer test-buyer --seller test-seller [--trade-id <uuid>] [--reason "…"] [--notes "…"] [--dry-run]
  reset --trade-id <uuid> [--dry-run]
`);
}

async function findReportableTrades(buyerId, sellerId) {
  const { data, error } = await admin
    .from('trades')
    .select('id, listing_id, status, dispute_status, bundle_id, cash_amount_cents, created_at')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.error(`❌ trades read failed: ${error.message}`); process.exit(1); }
  return (data || []).filter((t) => !t.dispute_status || t.dispute_status === 'none');
}

async function cmdFind(buyerId, sellerId) {
  const trades = await findReportableTrades(buyerId, sellerId);
  if (trades.length === 0) {
    console.error(`\n❌ No in_progress, unreported trade between ${BUYER} and ${SELLER}.`);
    console.error('   Needed before H05/H06: a real in_progress trade (seeded pending offers are NOT in_progress).');
    console.error('   Options: drive a real offer→accept via the app (or qa:ef-repro + accept), then re-run `open`.');
    process.exit(1);
  }
  console.log(`\nReportable in_progress trades (${BUYER} → ${SELLER}):`);
  for (const t of trades) {
    console.log(`  ${t.id}  bundle=${t.bundle_id ? 'yes' : 'no'}  cash=$${((t.cash_amount_cents ?? 0) / 100).toFixed(2)}  created=${t.created_at}`);
  }
  console.log('\nPick one (prefer a non-bundle single trade) and run:');
  console.log(`  npm run qa:r41-dispute -- open --trade-id <uuid>`);
}

async function cmdOpen(buyerId, sellerId) {
  let tradeId = TRADE_ID;
  if (!tradeId) {
    const trades = await findReportableTrades(buyerId, sellerId);
    if (trades.length === 0) {
      console.error(`❌ No in_progress, unreported trade between ${BUYER} and ${SELLER}. Run \`find\` first and create an in_progress trade if none exists.`);
      process.exit(1);
    }
    tradeId = trades[0].id; // newest
  } else {
    const { data: t, error } = await admin.from('trades').select('id, buyer_id, status, dispute_status').eq('id', tradeId).maybeSingle();
    if (error) { console.error(`❌ trade read failed: ${error.message}`); process.exit(1); }
    if (!t) { console.error(`❌ No trade ${tradeId}`); process.exit(1); }
    if (t.buyer_id !== buyerId) { console.error(`❌ Trade ${tradeId} is not owned by buyer ${BUYER}`); process.exit(1); }
    if (t.status !== 'in_progress') { console.error(`❌ Trade ${tradeId} status=${t.status} (must be in_progress to report)`); process.exit(1); }
    if (t.dispute_status && t.dispute_status !== 'none') { console.error(`❌ Trade ${tradeId} already disputed (dispute_status=${t.dispute_status})`); process.exit(1); }
  }

  if (DRY_RUN) {
    log('r41-dispute', `DRY-RUN — would POST open-dispute { trade_id:${tradeId}, reason, description } as buyer ${BUYER} JWT`);
    return;
  }

  // Real buyer-report path: buyer JWT → open-dispute EF.
  const jwt = await exchangeJwt(url, anon, buyerP.email, buyerP.password);
  const resp = await postEdgeFunction(url, anon, 'open-dispute', jwt, {
    trade_id: tradeId,
    reason: REASON,
    description: NOTES,
  });
  log('r41-dispute', `open-dispute -> HTTP ${resp.status}`, JSON.stringify(resp.json ?? resp.body));
  if (!resp.ok || resp.json?.success !== true) {
    console.error(`❌ open-dispute did not succeed: ${JSON.stringify(resp.json ?? resp.status)}`);
    process.exit(1);
  }
  log('r41-dispute', `✅ dispute_status='reported' on trade ${tradeId}`);
  log('r41-dispute', 'QA: admin portal → Disputes queue → find the trade → H05 "Mark Under Review" → H06 resolve legs.');
}

async function cmdReset() {
  if (!TRADE_ID) { console.error('❌ reset requires --trade-id <uuid>'); process.exit(2); }
  const { data: t, error } = await admin.from('trades').select('id, dispute_status, dispute_reason, dispute_notes, dispute_opened_at').eq('id', TRADE_ID).maybeSingle();
  if (error) { console.error(`❌ trade read failed: ${error.message}`); process.exit(1); }
  if (!t) { console.error(`❌ No trade ${TRADE_ID}`); process.exit(1); }
  if (t.dispute_status !== 'reported') {
    log('r41-dispute', `trade ${TRADE_ID} dispute_status=${t.dispute_status} — nothing to reset (only resets 'reported')`);
    return;
  }
  if (DRY_RUN) { log('r41-dispute', `DRY-RUN — would clear dispute columns + rows for trade ${TRADE_ID}`); return; }
  const { error: upErr } = await admin.from('trades').update({
    dispute_status: 'none',
    dispute_reason: null,
    dispute_notes: null,
    dispute_opened_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', TRADE_ID);
  if (upErr) { console.error(`❌ dispute reset failed: ${upErr.message}`); process.exit(1); }
  await admin.from('trade_events').delete().eq('trade_id', TRADE_ID).eq('event_type', 'trade_disputed').catch(() => {});
  await admin.from('trade_notification_log').delete().eq('trade_id', TRADE_ID).eq('notification_type', 'trade_dispute_opened').catch(() => {});
  log('r41-dispute', `✅ trade ${TRADE_ID} dispute reset to 'none'`);
}

async function main() {
  const buyerId = await resolveUserId(admin, BUYER);
  const sellerId = await resolveUserId(admin, SELLER);
  log('r41-dispute', `buyer=${BUYER} (${buyerId}) seller=${SELLER} (${sellerId}) sub=${sub}${DRY_RUN ? ' DRY-RUN' : ''}`);
  if (sub === 'find') return cmdFind(buyerId, sellerId);
  if (sub === 'open') return cmdOpen(buyerId, sellerId);
  if (sub === 'reset') return cmdReset();
  usage();
  process.exit(2);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
