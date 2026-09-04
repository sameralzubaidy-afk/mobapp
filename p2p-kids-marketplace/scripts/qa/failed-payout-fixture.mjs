/**
 * DEV-TASK-109 (2026-09-04) — Item 3: sanctioned failed-`seller_payouts` fixture.
 *
 * QA Task 31 flagged that NO sanctioned path exists to stage a FAILED payout row
 * for testing X07 (Action Center inline retry) and K03 (payouts-page retry) —
 * raw financial-table inserts are not sanctioned, and staging had 0 failed rows
 * so the Retry affordances could never be exercised end-to-end.
 *
 * This mirrors the r41-dispute-fixture.mjs / qa:set-sp-balance pattern: a
 * dev-authored, service-role fixture that stages ONE `seller_payouts` row in
 * status='failed' on a standing seller's completed trade, surfaces it in the
 * admin Failed-Payouts view, and resets cleanly back to no-failed-rows.
 *
 * Subcommands:
 *
 *   find --seller test-seller
 *       → read-only: list the seller's COMPLETED trades that do NOT already have
 *         a seller_payouts row (a valid target for `stage`). Newest first.
 *
 *   stage --seller test-seller [--trade-id <uuid>] [--amount-cents 1500]
 *         [--platform-fee-cents 0] [--payout-fee-cents 0] [--reason "…"]
 *         [--force] [--dry-run]
 *       → inserts ONE seller_payouts row (status='failed', provider='stripe',
 *         net = gross − platform − payout per the CHECK). Idempotency-key tagged
 *         `qa_dt109_failed_<uuid8>` so `reset` can always find exactly the rows
 *         this fixture created. Requires a completed trade owned by the seller
 *         with no existing payout (auto-picks the newest unless --trade-id).
 *         --force allows staging a second row even if the trade already has one
 *         (e.g. the I03 leftover pending payout on fe3924ee).
 *
 *   list [--status failed]
 *       → read-only: show payout rows (default failed) so QA can confirm the
 *         admin view / Action Center will surface them.
 *
 *   reset --seller test-seller [--dry-run]
 *       → deletes ONLY the rows this fixture created (idempotency_key LIKE
 *         'qa_dt109_failed_%'), returning the DB to no-failed-rows.
 *
 * All writes are against STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1). --dry-run is read-only.
 *
 * Env: .env / .env.staging (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Persona ids mirror r41-common.mjs PERSONAS.
 */
import { getClients, personaOrThrow, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');
const SELLER = argValue('seller') || 'test-seller';
const TRADE_ID = argValue('trade-id');
const AMOUNT_CENTS = Number(argValue('amount-cents') || '1500');
const PLATFORM_FEE_CENTS = Number(argValue('platform-fee-cents') || '0');
const PAYOUT_FEE_CENTS = Number(argValue('payout-fee-cents') || '0');
const REASON = argValue('reason') || 'QA fixture: staged failed payout (Dev Task 109)';
const FORCE = hasFlag('--force');
const TAG_PREFIX = 'qa_dt109_failed_';

const sellerP = personaOrThrow(SELLER);

function usage() {
  console.log(`qa:failed-payout — X07/K03 failed-payout fixture builder

  find --seller test-seller
  stage --seller test-seller [--trade-id <uuid>] [--amount-cents 1500] [--reason "…"] [--force] [--dry-run]
  list [--status failed]
  reset --seller test-seller [--dry-run]
`);
}

/** Seller's primary, verified payout method id (for the payout_method_id FK). */
async function findPrimaryPayoutMethod(userId) {
  const { data, error } = await admin
    .from('seller_payout_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();
  if (error) {
    log('failed-payout', `⚠️ seller_payout_methods read failed: ${error.message}`);
    return null;
  }
  return data?.id ?? null;
}

/** Completed trades for a seller that do NOT yet have a seller_payouts row. */
async function findCompletedTradesWithoutPayout(userId) {
  const { data, error } = await admin
    .from('trades')
    .select('id, status, cash_amount_cents, completed_at, created_at')
    .eq('seller_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error(`❌ trades read failed: ${error.message}`);
    process.exit(1);
  }

  const withPayout = new Set();
  const ids = (data || []).map((t) => t.id);
  if (ids.length > 0) {
    const { data: payRows, error: payErr } = await admin
      .from('seller_payouts')
      .select('trade_id')
      .in('trade_id', ids);
    if (payErr) {
      console.error(`❌ seller_payouts read failed: ${payErr.message}`);
      process.exit(1);
    }
    (payRows || []).forEach((r) => withPayout.add(r.trade_id));
  }
  return (data || []).filter((t) => !withPayout.has(t.id));
}

async function cmdFind(userId) {
  const trades = await findCompletedTradesWithoutPayout(userId);
  if (trades.length === 0) {
    console.log(`\nNo completed trade for ${SELLER} that lacks a payout row.`);
    console.log('If the target trade already has a payout, pass --force on `stage`.');
    return;
  }
  console.log(`\nCompleted trades w/o a payout row (${SELLER}):`);
  for (const t of trades) {
    console.log(
      `  ${t.id}  cash=$${((t.cash_amount_cents ?? 0) / 100).toFixed(2)}  completed=${t.completed_at ?? '?'}`
    );
  }
  console.log('\nPick one and run:');
  console.log('  npm run qa:failed-payout -- stage --trade-id <uuid>');
}

async function cmdStage(userId) {
  if (!Number.isInteger(AMOUNT_CENTS) || AMOUNT_CENTS < 0) {
    console.error(`❌ --amount-cents must be a non-negative integer (got '${argValue('amount-cents')}')`);
    process.exit(2);
  }
  const net = AMOUNT_CENTS - PLATFORM_FEE_CENTS - PAYOUT_FEE_CENTS;
  if (net < 0) {
    console.error('❌ net amount would be negative (net = gross − platform − payout)');
    process.exit(2);
  }

  let tradeId = TRADE_ID;
  if (!tradeId) {
    const trades = await findCompletedTradesWithoutPayout(userId);
    if (trades.length === 0) {
      console.error(`❌ No completed trade for ${SELLER} without a payout row. Run \`find\`, or pass --trade-id + --force.`);
      process.exit(1);
    }
    tradeId = trades[0].id; // newest
  } else {
    const { data: t, error } = await admin
      .from('trades')
      .select('id, seller_id, status')
      .eq('id', tradeId)
      .maybeSingle();
    if (error) {
      console.error(`❌ trade read failed: ${error.message}`);
      process.exit(1);
    }
    if (!t) {
      console.error(`❌ No trade ${tradeId}`);
      process.exit(1);
    }
    if (t.seller_id !== userId) {
      console.error(`❌ Trade ${tradeId} is not owned by seller ${SELLER}`);
      process.exit(1);
    }
    if (t.status !== 'completed') {
      console.error(`❌ Trade ${tradeId} status=${t.status} (must be completed to stage a payout)`);
      process.exit(1);
    }
    // If the trade already has a payout row, require --force.
    const { data: existing } = await admin
      .from('seller_payouts')
      .select('id, status')
      .eq('trade_id', tradeId)
      .maybeSingle();
    if (existing && !FORCE) {
      console.error(`❌ Trade ${tradeId} already has a payout row (id ${existing.id}, status ${existing.status}). Pass --force to stage an additional failed row.`);
      process.exit(1);
    }
  }

  const methodId = await findPrimaryPayoutMethod(userId);
  const idempotencyKey = `${TAG_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
  const nowIso = new Date().toISOString();

  if (DRY_RUN) {
    log(
      'failed-payout',
      `DRY-RUN — would insert seller_payouts { user_id, trade_id:${tradeId}, gross:${AMOUNT_CENTS}, platform:${PLATFORM_FEE_CENTS}, payout:${PAYOUT_FEE_CENTS}, net:${net}, status:'failed', provider:'stripe', idempotency_key:'${idempotencyKey}', failure_reason:'${REASON}' }`
    );
    return;
  }

  const { data, error } = await admin.from('seller_payouts').insert({
    user_id: userId,
    trade_id: tradeId,
    payout_method_id: methodId,
    currency: 'usd',
    gross_amount_cents: AMOUNT_CENTS,
    platform_fee_cents: PLATFORM_FEE_CENTS,
    payout_fee_cents: PAYOUT_FEE_CENTS,
    net_amount_cents: net,
    status: 'failed',
    provider: 'stripe',
    idempotency_key: idempotencyKey,
    initiated_at: nowIso,
    failure_reason: REASON,
    created_at: nowIso,
    updated_at: nowIso,
  })
    .select('id, trade_id, net_amount_cents, status, failure_reason, idempotency_key')
    .single();

  if (error) {
    console.error(`❌ seller_payouts insert failed: ${error.message}`);
    process.exit(1);
  }
  log('failed-payout', `✅ staged failed payout row ${data.id}`);
  log('failed-payout', `   trade=${data.trade_id} net=$${((data.net_amount_cents ?? 0) / 100).toFixed(2)} status=${data.status}`);
  log('failed-payout', `   Admin surfaces: /payouts/earnings?status=failed + Action Center "Failed Payouts" card`);
  log('failed-payout', `   Reset after QA: npm run qa:failed-payout -- reset --seller ${SELLER}`);
}

async function cmdList() {
  const status = argValue('status') || 'failed';
  let query = admin.from('seller_payouts').select('id, user_id, trade_id, net_amount_cents, status, failure_reason, idempotency_key, created_at');
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  query = query.order('created_at', { ascending: false }).limit(50);
  const { data, error } = await query;
  if (error) {
    console.error(`❌ seller_payouts read failed: ${error.message}`);
    process.exit(1);
  }
  const rows = data || [];
  if (rows.length === 0) {
    console.log(`\nNo ${status === 'all' ? '' : status + ' '}seller_payouts rows.`);
    return;
  }
  console.log(`\nseller_payouts (status=${status}): ${rows.length}`);
  for (const r of rows) {
    console.log(
      `  ${r.id}  user=${r.user_id}  trade=${r.trade_id ?? '—'}  net=$${((r.net_amount_cents ?? 0) / 100).toFixed(2)}  ${r.status}  ${r.failure_reason ?? ''}`
    );
  }
}

async function cmdReset(userId) {
  if (DRY_RUN) {
    log('failed-payout', `DRY-RUN — would delete fixture rows for user ${userId} (idempotency_key LIKE '${TAG_PREFIX}%')`);
    return;
  }
  const { data: toDelete, error: readError } = await admin
    .from('seller_payouts')
    .select('id, idempotency_key')
    .eq('user_id', userId)
    .like('idempotency_key', `${TAG_PREFIX}%`);
  if (readError) {
    console.error(`❌ seller_payouts read failed: ${readError.message}`);
    process.exit(1);
  }
  const ids = (toDelete || []).map((r) => r.id);
  if (ids.length === 0) {
    log('failed-payout', 'No fixture rows to reset (clean).');
    return;
  }
  const { error: delError } = await admin.from('seller_payouts').delete().in('id', ids);
  if (delError) {
    console.error(`❌ seller_payouts delete failed: ${delError.message}`);
    process.exit(1);
  }
  log('failed-payout', `✅ deleted ${ids.length} staged failed-payout row(s) for ${SELLER}`);
}

async function main() {
  const userId = sellerP.id;
  switch (sub) {
    case 'find':
      await cmdFind(userId);
      break;
    case 'stage':
      await cmdStage(userId);
      break;
    case 'list':
      await cmdList();
      break;
    case 'reset':
      await cmdReset(userId);
      break;
    default:
      usage();
      process.exit(sub === 'help' ? 0 : 2);
  }
}

main();
