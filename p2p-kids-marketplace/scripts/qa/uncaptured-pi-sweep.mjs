#!/usr/bin/env node
/**
 * FIX-Task-35 item 1 (2026-09-14) — `qa:uncaptured-pi-sweep`: PROVIDER-FIRST audit
 * of every uncaptured PaymentIntent in the test-mode Stripe account.
 *
 * WHY THIS IS A DIFFERENT TOOL FROM `qa:stranded-holds`
 *   `qa:stranded-holds` is DB-FIRST: it walks `trades` rows and asks Stripe about
 *   the PI id stored on each row. That is the right shape for "is this trade's
 *   hold still on?", but it has three blind spots that matter for a completeness
 *   claim:
 *
 *     1. a trade whose PI is recorded ONLY on `payments` (not on `trades`)
 *        is never probed;
 *     2. a trade that was re-offered / extended has MORE THAN ONE PI in its
 *        history, and only the newest id lives on the row — an older, still
 *        authorized PI is invisible;
 *     3. the question "how much uncaptured money exists in this account?" is a
 *        provider question, and answering it from a DB walk silently assumes the
 *        DB is complete.
 *
 *   This tool starts at Stripe: enumerate EVERY PaymentIntent, keep the ones
 *   that still have `amount_capturable > 0` (i.e. money that was never
 *   collected), then resolve each one back to a trade through BOTH the `trades`
 *   and `payments` columns. Anything it cannot resolve is reported, not dropped.
 *
 * WHAT THE VERDICTS MEAN
 *   UNCOLLECTED_MONEY   trade is `completed` and `amount_received = 0`
 *                       ⇒ the app told everyone the money moved and it did not.
 *   STRANDED_HOLD       trade is over (not `pending`/`in_progress`) and the
 *                       authorization is still inside Stripe's ~7-day window
 *                       ⇒ a live hold on a dead trade.
 *   STALE_AUTH          authorization older than the capture window — Stripe may
 *                       still say `requires_capture`, but the network auth has
 *                       lapsed, so no funds are held.
 *   LIVE_TRADE          the trade is legitimately `pending`/`in_progress` — the
 *                       hold is expected and not a defect.
 *   ORPHAN_PI           no trade/payment row references this PI at all.
 *
 * READ-ONLY by construction: it only ever issues GETs (`./lib/stripe-read.mjs`
 * refuses any other verb) and PostgREST selects.
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:uncaptured-pi-sweep                     # last 400 days
 *   npm run qa:uncaptured-pi-sweep -- --days 60
 *   npm run qa:uncaptured-pi-sweep -- --json
 *   STRIPE_QA_BREAK_GLASS=1 npm run qa:uncaptured-pi-sweep
 *
 * EXIT CODES  0 = no uncollected money / live stranded hold | 1 = found | 2 = setup.
 */
import { getClients } from './lib/r41-common.mjs';
import { getReadKey, stripeList, piFacts, usd, iso } from './lib/stripe-read.mjs';

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const AS_JSON = hasFlag('json');
const DAYS = Number(flagValue('days') || 400);
/** Hard ceiling so a runaway enumeration cannot hang a session. */
const MAX_PIS = Number(flagValue('max-pis') || 10000);
const CAPTURABLE_DAYS = Number(flagValue('capturable-days') || 7);
const HOLD_EXPECTED_STATUSES = new Set(['pending', 'in_progress']);

const redact = (s) => String(s).replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_***');
const log = (...a) => {
  if (!AS_JSON) console.log(...a);
};

/** PostgREST caps a single response at 1000 rows — page explicitly. */
async function selectAll(admin, table, columns, { pageSize = 1000 } = {}) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

async function main() {
  const ctx = getReadKey({ breakGlass: process.env.STRIPE_QA_BREAK_GLASS === '1' });
  const { admin } = getClients();

  const cutoffSec = Math.floor((Date.now() - DAYS * 86400_000) / 1000);
  log(
    `[uncaptured-pi-sweep] key_scope=${ctx.scope} (source: ${ctx.source}) — enumerating PaymentIntents created since ${iso(cutoffSec)}`,
  );

  // ── 1. Provider-first: every PI in the window, whether or not any DB row knows it.
  const pis = await stripeList(ctx, '/payment_intents', {
    params: { 'created[gte]': String(cutoffSec) },
    limit: MAX_PIS,
  });
  log(`[uncaptured-pi-sweep] ${pis.length} PaymentIntent(s) enumerated`);

  const uncaptured = pis
    .map((pi) => ({ pi, f: piFacts(pi) }))
    .filter(({ f }) => (Number(f.amount_capturable) || 0) > 0);

  // ── 2. Resolve each uncaptured PI back to a trade. Both columns, on purpose.
  const [trades, payments] = await Promise.all([
    selectAll(
      admin,
      'trades',
      'id,status,stripe_payment_intent_id,cash_amount_cents,created_at,cancellation_reason,completed_at',
    ),
    selectAll(admin, 'payments', 'trade_id,stripe_payment_intent_id'),
  ]);

  const tradeById = new Map(trades.map((t) => [t.id, t]));
  /** PI id -> trade, from BOTH reference columns (trades.stripe_* wins on conflict). */
  const tradeByPi = new Map();
  for (const p of payments) {
    if (!p.stripe_payment_intent_id) continue;
    const t = tradeById.get(p.trade_id);
    if (t) tradeByPi.set(p.stripe_payment_intent_id, t);
  }
  for (const t of trades) {
    if (t.stripe_payment_intent_id) tradeByPi.set(t.stripe_payment_intent_id, t);
  }

  const rows = [];
  for (const { pi, f } of uncaptured) {
    const heldCents = Number(f.amount_capturable) || 0;
    const ageDays = (Date.now() - new Date(f.created).getTime()) / 86400_000;

    // metadata.trade_id / metadata.item_id are written by the offer + extension
    // PIs; they are a last resort, used only when neither column matches.
    const trade =
      tradeByPi.get(f.id) ||
      (pi.metadata?.trade_id ? tradeById.get(pi.metadata.trade_id) : undefined) ||
      undefined;

    let verdict;
    if (!trade) verdict = 'ORPHAN_PI';
    else if (trade.status === 'completed' && f.amount_received === 0) verdict = 'UNCOLLECTED_MONEY';
    else if (HOLD_EXPECTED_STATUSES.has(trade.status)) verdict = 'LIVE_TRADE';
    else if (ageDays > CAPTURABLE_DAYS) verdict = 'STALE_AUTH';
    else verdict = 'STRANDED_HOLD';

    rows.push({
      verdict,
      pi: f.id,
      pi_status: f.status,
      amount_capturable_cents: heldCents,
      amount_capturable: usd(heldCents),
      amount_received_cents: Number(f.amount_received) || 0,
      pi_created: f.created,
      pi_age_days: Number(ageDays.toFixed(1)),
      pi_metadata_type: pi.metadata?.type ?? null,
      trade_id: trade?.id ?? null,
      trade_status: trade?.status ?? null,
      trade_created_at: trade?.created_at ?? null,
      trade_completed_at: trade?.completed_at ?? null,
      cancellation_reason: trade?.cancellation_reason ?? null,
    });
  }

  const byVerdict = (v) => rows.filter((r) => r.verdict === v);
  const sum = (arr) => arr.reduce((s, r) => s + r.amount_capturable_cents, 0);
  const actionable = [...byVerdict('UNCOLLECTED_MONEY'), ...byVerdict('STRANDED_HOLD')];

  const payload = {
    key_scope: ctx.scope,
    days: DAYS,
    capturable_days: CAPTURABLE_DAYS,
    pis_enumerated: pis.length,
    uncaptured_pi_count: rows.length,
    uncaptured_pi_cents: sum(rows),
    by_verdict: {
      UNCOLLECTED_MONEY: { count: byVerdict('UNCOLLECTED_MONEY').length, cents: sum(byVerdict('UNCOLLECTED_MONEY')) },
      STRANDED_HOLD: { count: byVerdict('STRANDED_HOLD').length, cents: sum(byVerdict('STRANDED_HOLD')) },
      STALE_AUTH: { count: byVerdict('STALE_AUTH').length, cents: sum(byVerdict('STALE_AUTH')) },
      LIVE_TRADE: { count: byVerdict('LIVE_TRADE').length, cents: sum(byVerdict('LIVE_TRADE')) },
      ORPHAN_PI: { count: byVerdict('ORPHAN_PI').length, cents: sum(byVerdict('ORPHAN_PI')) },
    },
    rows,
  };

  if (AS_JSON) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    log('\n--- verdict summary ---');
    for (const [k, v] of Object.entries(payload.by_verdict)) {
      log(`  ${k.padEnd(18)} ${String(v.count).padStart(4)}   ${usd(v.cents)}`);
    }
    if (!rows.length) {
      log('\n✅ No PaymentIntent in the window still has uncaptured money.');
    } else {
      for (const v of ['UNCOLLECTED_MONEY', 'STRANDED_HOLD', 'ORPHAN_PI', 'STALE_AUTH']) {
        const bucket = byVerdict(v);
        if (!bucket.length) continue;
        log(`\n--- ${v} (${bucket.length}, ${usd(sum(bucket))}) ---`);
        for (const r of bucket) {
          log(
            `  trade ${r.trade_id ?? '(none)'}  status=${r.trade_status ?? '-'}  ` +
              `PI ${r.pi}  ${r.pi_status}  held ${r.amount_capturable}  age ${r.pi_age_days}d  ` +
              `meta=${r.pi_metadata_type ?? '-'}`,
          );
        }
      }
    }
  }

  process.exit(actionable.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`[uncaptured-pi-sweep] ${redact(err instanceof Error ? err.message : err)}`);
  process.exit(2);
});
