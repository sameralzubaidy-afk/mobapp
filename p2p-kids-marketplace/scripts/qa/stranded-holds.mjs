#!/usr/bin/env node
/**
 * FIX-Task-34 (2026-09-14) — `qa:stranded-holds`: find every recent trade whose
 * buyer authorization is still held at Stripe even though the trade is over.
 *
 * WHY THIS EXISTS
 * A cancelled / expired / declined offer must RELEASE its buyer authorization.
 * FIX-Task-33's audit found one stranded hold ($17.89 on trade `67ba29fc...`)
 * and could only reason about it one trade at a time, from a by-trade read. That
 * is the wrong granularity for the question QA actually has to answer — "are the
 * holds restored?" — which is a SWEEP, not a spot check. Known writers that can
 * strand a hold:
 *   1. an app path that cancels the trade but never calls Stripe (the
 *      FIX-Task-32 `competing-offer-cancel` class),
 *   2. the QA harness `reset-offer-fixtures.mjs`, which cancels by RAW status
 *      update + `rpc_void_tax_for_trade` and never touches Stripe (FIX-Task-33 F4),
 *   3. a one-off DATA REPAIR — a DB-only fix cannot cancel a PaymentIntent
 *      (FIX-Task-33 F1).
 *
 * DEFINITION (deliberately strict, so the verdict is falsifiable)
 *   A trade is ALLOWED to hold buyer money only while it is `pending` (a live
 *   offer) or `in_progress` (accepted, awaiting capture at completion).
 *
 *   For every OTHER state, an uncaptured authorization is classified by AGE,
 *   because Stripe's uncaptured-authorization window (≈7 days, card-dependent)
 *   decides whether the hold is still real:
 *     STRANDED   amount_capturable > 0 AND PI age <= `--capturable-days` (7)
 *                ⇒ a live hold on a dead trade. Actionable now.
 *     STALE      amount_capturable > 0 AND PI age >  `--capturable-days`
 *                ⇒ Stripe still reports `requires_capture`, but the network
 *                  authorization has lapsed, so no funds are actually held.
 *                  Reported for completeness, NOT as a live-hold alarm.
 *     NO_CAPTURE the trade is `completed` yet the PI is uncaptured
 *                ⇒ reported separately: this is not a stranded HOLD, it is the
 *                  opposite failure (money never collected). Different bug class,
 *                  so it must never inflate the stranded-hold count.
 *
 * This distinction matters: the raw `amount_capturable > 0` count across this
 * account's history is large and mostly stale, and reporting it as "N stranded
 * holds" would be a false alarm that buries the one live case.
 *
 * NOTE ON `payments.derived_state`: it is a TRIGGER MIRROR of `trades.status`
 * (R100), so it is never used here. Only Stripe answers "is the hold still on?".
 *
 * READ-ONLY by construction: reads via ./lib/stripe-read.mjs (GET-only) and the
 * PostgREST client. This tool never cancels anything — it only reports.
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:stranded-holds                              # last 60 days
 *   npm run qa:stranded-holds -- --days 180
 *   npm run qa:stranded-holds -- --capturable-days 7
 *   npm run qa:stranded-holds -- --json                    # machine-readable
 *   STRIPE_QA_BREAK_GLASS=1 npm run qa:stranded-holds      # labelled secret-key path
 *
 * EXIT CODES  0 = no live stranded holds | 1 = live stranded hold(s) found | 2 = setup/key.
 */
import { getClients } from './lib/r41-common.mjs';
import { getReadKey, stripeGet, piFacts, usd, explainStripeError } from './lib/stripe-read.mjs';

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const AS_JSON = hasFlag('json');
const DAYS = Number(flagValue('days') || 60);
const LIMIT = Number(flagValue('limit') || 500);
/** Stripe's uncaptured-authorization window — a PI older than this can no longer
 *  be captured, so `amount_capturable > 0` is no longer evidence of a live hold. */
const CAPTURABLE_DAYS = Number(flagValue('capturable-days') || 7);

/** Trade states that are ALLOWED to hold buyer money. */
const HOLD_EXPECTED_STATUSES = new Set(['pending', 'in_progress']);

/** Strip anything that looks like a key so an error can never leak one. */
const redact = (s) => String(s).replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_***');

function log(...a) {
  if (!AS_JSON) console.log(...a);
}

async function main() {
  // Fails fast with an actionable message (exit 2) when no usable key exists.
  const ctx = getReadKey({ breakGlass: process.env.STRIPE_QA_BREAK_GLASS === '1' });

  const { admin } = getClients();
  const cutoff = new Date(Date.now() - DAYS * 86400_000).toISOString();

  const { data: trades, error } = await admin
    .from('trades')
    .select('id,status,cash_amount_cents,stripe_payment_intent_id,created_at,offer_expires_at,cancellation_reason')
    .not('stripe_payment_intent_id', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error(`[stranded-holds] DB read failed: ${redact(error.message)}`);
    process.exit(2);
  }

  const rows = trades ?? [];
  log(
    `[stranded-holds] key_scope=${ctx.scope} (source: ${ctx.source}) — probing ${rows.length} trade(s) with a PI created in the last ${DAYS} day(s)`,
  );

  const stranded = []; // live hold on a dead trade  -> actionable
  const stale = []; // uncaptured but past the capture window -> informational
  const noCapture = []; // completed trade never captured -> different bug class
  const noted = [];

  for (const t of rows) {
    let pi;
    try {
      pi = await stripeGet(ctx, `/payment_intents/${t.stripe_payment_intent_id}`);
    } catch (err) {
      // A 404 is a data-integrity note, not a stranded hold — record and move on.
      noted.push({ trade_id: t.id, pi_id: t.stripe_payment_intent_id, note: redact(err.message) });
      continue;
    }

    const f = piFacts(pi);
    const heldCents = Number(f.amount_capturable) || 0;
    if (HOLD_EXPECTED_STATUSES.has(t.status) || heldCents <= 0) continue;

    const ageDays = (Date.now() - new Date(f.created).getTime()) / 86400_000;
    const row = {
      trade_id: t.id,
      trade_status: t.status,
      cancellation_reason: t.cancellation_reason,
      trade_created_at: t.created_at,
      pi: f.id,
      pi_status: f.status,
      pi_created: f.created,
      pi_age_days: Number(ageDays.toFixed(1)),
      held_cents: heldCents,
      held: usd(heldCents),
      captured_cents: f.amount_received,
    };

    if (t.status === 'completed' && f.amount_received === 0) noCapture.push(row);
    else if (ageDays <= CAPTURABLE_DAYS) stranded.push(row);
    else stale.push(row);
  }

  const sum = (arr) => arr.reduce((s, r) => s + r.held_cents, 0);

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          key_scope: ctx.scope,
          days: DAYS,
          capturable_days: CAPTURABLE_DAYS,
          trades_probed: rows.length,
          stranded_count: stranded.length,
          stranded_cents: sum(stranded),
          stranded,
          stale_count: stale.length,
          stale_cents: sum(stale),
          stale,
          completed_without_capture_count: noCapture.length,
          completed_without_capture_cents: sum(noCapture),
          completed_without_capture: noCapture,
          notes: noted,
        },
        null,
        2,
      ),
    );
  } else {
    if (noted.length) {
      console.log(`\n--- ${noted.length} PI read note(s) (not stranded holds) ---`);
      for (const n of noted) console.log(`  ${n.trade_id}  ${n.pi_id}: ${n.note.split('\n')[0]}`);
    }

    if (!stranded.length) {
      console.log(
        `\n✅ No LIVE stranded holds. Every over-trade PI created within ${CAPTURABLE_DAYS} day(s) reads amount_capturable = 0.`,
      );
    } else {
      console.log(`\n❌ ${stranded.length} LIVE STRANDED HOLD(S) — ${usd(sum(stranded))}:`);
      for (const s of stranded) {
        console.log(
          `\n  trade  ${s.trade_id}\n    status ${s.trade_status} (${s.cancellation_reason ?? 'no reason'}) at ${s.trade_created_at}` +
            `\n    PI     ${s.pi}  status=${s.pi_status}  age=${s.pi_age_days}d  HOLD ${s.held}  captured ${usd(s.captured_cents)}`,
        );
      }
      console.log(
        `\n  REMEDIATION: cancel each PI above (a Stripe WRITE — needs owner approval),\n` +
          `  and fix the WRITER that stranded it (never only the row).`,
      );
    }

    if (stale.length) {
      console.log(
        `\nℹ️  ${stale.length} STALE uncaptured PI(s) — ${usd(sum(stale))} — older than the ${CAPTURABLE_DAYS}-day capture window.` +
          `\n    Stripe still reports requires_capture, but the network authorization has lapsed (no funds held).`,
      );
    }

    if (noCapture.length) {
      console.log(
        `\n⚠️  ${noCapture.length} COMPLETED trade(s) with an UNCAPTURED PI — ${usd(sum(noCapture))}.` +
          `\n    Not a stranded hold — the opposite: money never collected for a completed trade. Separate bug class.`,
      );
      for (const s of noCapture) console.log(`      ${s.trade_id}  ${s.pi}  ${s.held}  (age ${s.pi_age_days}d)`);
    }
  }

  process.exit(stranded.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`[stranded-holds] ${redact(err instanceof Error ? err.message : err)}`);
  process.exit(2);
});
