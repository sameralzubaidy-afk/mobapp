/**
 * FIX-Task-32 (2026-09-14) — assertion-only regression verifier.
 *
 * WHY THIS EXISTS
 * ---------------
 * The competing-offer hold leak recurred TWICE (FIX-Task-24 repaired 52 rows of
 * DATA without touching the writer, so the next QA round reproduced it). The unit
 * tests in `supabase/functions/_shared/competing-offer-cancel.test.ts` guard the
 * writer's LOGIC; this script guards the END STATE, which is what QA actually
 * observes. It is READ-ONLY: it asserts and reports, and never mutates.
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:fix32-verify
 *   npm run qa:fix32-verify -- --listing <listing_id>   # narrow to one listing
 *
 * Exit code 0 = every invariant holds; 1 = at least one invariant is violated
 * (the failing check + the offending rows are printed).
 *
 * Invariants (each maps to a FIX-Task-32 item):
 *   I1  item 1  — no CANCELLED trade has a voidable tax record (`quoted` /
 *                 `capture_failed`); a cancelled trade can never collect tax.
 *   I2  item 4a — no COMPLETED trade has a voidable tax record ($80.63 residual).
 *   I3  item 2  — no CANCELLED trade has `cancelled_at IS NULL`.
 *   I4  item 3  — no `payments` row is marked `cancelled` while carrying a
 *                 refunded amount (money was never captured ⇒ never refunded).
 *   I5  item 4b — the F2 live proof trade's tax record is `voided`.
 *   I6  item 1  — for `--listing <id>`: every cancelled rival on that listing has
 *                 `cancelled_at` set AND a voided (or absent) tax record.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Trade id QA left in place as F2's live proof (R03, 2026-09-13). */
const F2_PROOF_TRADE_ID = '67ba29fc-cf01-4713-8e8b-21e3fc460701';

const argValue = (name) => {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
};

const LISTING_ID = argValue('listing');
const VOIDABLE = ['quoted', 'capture_failed'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
      '   Add them to p2p-kids-marketplace/.env (or .env.staging) and re-run.'
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, passed, detail, rows) {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}  ${name} — ${detail}`);
  if (!passed && rows?.length) {
    console.log('   offending rows:');
    for (const row of rows.slice(0, 10)) console.log('   ', JSON.stringify(row));
    if (rows.length > 10) console.log(`    … and ${rows.length - 10} more`);
  }
}

/**
 * Trades whose tax record is still voidable.
 *
 * Drives the read from the SMALL side first: voidable tax records are a handful of
 * rows, while `trades` holds thousands — an `.in('trade_id', <every cancelled
 * trade>)` filter builds a URL long enough for PostgREST to answer 400 Bad Request.
 */
async function tradesWithVoidableTax(status) {
  const { data: taxRows, error: taxErr } = await admin
    .from('tax_records')
    .select('id, trade_id, tax_status, tax_amount_cents, captured_at, voided_at')
    .in('tax_status', VOIDABLE);
  if (taxErr) throw new Error(`tax_records read failed: ${taxErr.message}`);
  if (!taxRows || taxRows.length === 0) return [];

  const tradeIds = [...new Set(taxRows.map((r) => r.trade_id))];
  const { data: trades, error: tradeErr } = await admin
    .from('trades')
    .select('id, status, cancellation_reason, cancelled_at, listing_id')
    .in('id', tradeIds)
    .eq('status', status);
  if (tradeErr) throw new Error(`trades read failed: ${tradeErr.message}`);

  const wanted = new Set((trades ?? []).map((t) => t.id));
  return taxRows
    .filter((r) => wanted.has(r.trade_id))
    .map((r) => ({ ...r, ...(trades ?? []).find((t) => t.id === r.trade_id) }));
}

async function main() {
  console.log('FIX-Task-32 regression verifier (READ-ONLY)\n');

  // I1 — cancelled trades must not carry collectible tax
  const cancelledQuoted = await tradesWithVoidableTax('cancelled');
  check(
    'I1  cancelled trades with voidable tax (item 1)',
    cancelledQuoted.length === 0,
    `${cancelledQuoted.length} found (expected 0)`,
    cancelledQuoted
  );

  // I2 — completed trades must not carry an uncollected tax record
  const completedQuoted = await tradesWithVoidableTax('completed');
  check(
    'I2  completed trades with voidable tax (item 4a)',
    completedQuoted.length === 0,
    `${completedQuoted.length} found (expected 0)`,
    completedQuoted
  );

  // I3 — every cancelled trade carries a cancellation timestamp
  const { data: nullCancelledAt, error: nullErr } = await admin
    .from('trades')
    .select('id, cancellation_reason, updated_at, created_at')
    .eq('status', 'cancelled')
    .is('cancelled_at', null);
  if (nullErr) throw new Error(`trades read failed: ${nullErr.message}`);
  check(
    'I3  cancelled trades with NULL cancelled_at (item 2)',
    (nullCancelledAt ?? []).length === 0,
    `${(nullCancelledAt ?? []).length} found (expected 0)`,
    nullCancelledAt ?? []
  );

  // I4 — a cancelled payment must never carry a refund
  const { data: cancelledPaid, error: paidErr } = await admin
    .from('payments')
    .select('id, trade_id, derived_state, refunded_cents, refunded_tax_cents, refunded_at')
    .eq('derived_state', 'cancelled')
    .gt('refunded_cents', 0);
  if (paidErr) throw new Error(`payments read failed: ${paidErr.message}`);
  check(
    'I4  cancelled payments carrying refunded amounts (item 3)',
    (cancelledPaid ?? []).length === 0,
    `${(cancelledPaid ?? []).length} found (expected 0)`,
    cancelledPaid ?? []
  );

  // I5 — the F2 proof trade's tax record ends voided
  const { data: proof, error: proofErr } = await admin
    .from('tax_records')
    .select('trade_id, tax_status, voided_at')
    .eq('trade_id', F2_PROOF_TRADE_ID)
    .maybeSingle();
  if (proofErr) throw new Error(`tax_records read failed: ${proofErr.message}`);
  check(
    'I5  F2 proof trade tax record is voided (item 4b)',
    proof?.tax_status === 'voided',
    proof
      ? `tax_status=${proof.tax_status}, voided_at=${proof.voided_at}`
      : 'no tax record for that trade (nothing to void — acceptable)',
    []
  );

  // I6 — optional per-listing check (the live competing-offer drive)
  if (LISTING_ID) {
    const { data: rivals, error: rivalErr } = await admin
      .from('trades')
      .select('id, status, cancellation_reason, cancelled_at')
      .eq('listing_id', LISTING_ID)
      .eq('status', 'cancelled');
    if (rivalErr) throw new Error(`trades read failed: ${rivalErr.message}`);

    const rivalIds = (rivals ?? []).map((r) => r.id);
    let unvoided = [];
    if (rivalIds.length > 0) {
      const { data: rivalTax, error: rivalTaxErr } = await admin
        .from('tax_records')
        .select('trade_id, tax_status')
        .in('trade_id', rivalIds)
        .in('tax_status', VOIDABLE);
      if (rivalTaxErr) throw new Error(`tax_records read failed: ${rivalTaxErr.message}`);
      unvoided = rivalTax ?? [];
    }

    const missingStamp = (rivals ?? []).filter((r) => !r.cancelled_at);
    const ok = unvoided.length === 0 && missingStamp.length === 0;
    check(
      `I6  listing ${LISTING_ID}: cancelled rivals stamped + tax voided (item 1)`,
      ok,
      `${rivalIds.length} cancelled rival(s); voidable tax=${unvoided.length}, missing cancelled_at=${missingStamp.length}`,
      [...unvoided, ...missingStamp]
    );
  } else {
    console.log('ℹ️  I6 skipped — pass --listing <listing_id> to check a live drive.');
  }

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n${failed.length === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failed.length} CHECK(S) FAILED`} ` +
      `(${results.length - failed.length}/${results.length})`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ verifier crashed:', err?.message ?? err);
  process.exit(1);
});
