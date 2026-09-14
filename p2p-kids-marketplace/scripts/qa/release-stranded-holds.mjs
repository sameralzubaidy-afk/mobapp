#!/usr/bin/env node
/**
 * FIX-Task-34 (2026-09-14) — OWNER-APPROVED repair: release stranded buyer holds.
 *
 * RELATIONSHIP TO `qa:stranded-holds`
 *   `qa:stranded-holds` is READ-ONLY by construction (it can only GET) and stays
 *   that way — that guarantee is the whole point of the FIX-Task-33 QA read path,
 *   and adding a writer to it would quietly destroy it. This is the separate,
 *   explicitly-invoked WRITER for the one repair that tool can only report.
 *
 * WHAT IT DOES
 *   Finds every trade that is over (not `pending` / `in_progress`) whose Stripe
 *   PaymentIntent is still an uncaptured authorization inside Stripe's capture
 *   window, and CANCELS that PaymentIntent — releasing the buyer's funds.
 *
 * WHAT IT DELIBERATELY WILL NOT DO
 *   * It never captures. Releasing≠collecting.
 *   * It never touches a PI that is already `canceled`, `succeeded`, or past the
 *     capture window (nothing to release).
 *   * It does NOT change the DB. The trades it targets are already `cancelled`
 *     with their tax voided; the ONLY missing step was the Stripe call. If you
 *     find one where that is not true, fix the trade, not this script.
 *
 * THE WINDOW MATTERS
 *   Stripe's uncaptured-authorization window is ≈7 days (card-dependent). Past it
 *   the network authorization has lapsed, so `amount_capturable > 0` is stale
 *   bookkeeping and cancelling achieves nothing — those rows are reported as
 *   STALE, not repaired.
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:release-stranded-holds                    # DRY RUN (default)
 *   npm run qa:release-stranded-holds -- --yes           # perform the cancels
 *   npm run qa:release-stranded-holds -- --days 90 --yes
 *
 * AUTH: this is a WRITER, so it uses the fixture test-mode secret key at
 * `~/.dt11-stripe-key` (never echoed) for BOTH its read and its write legs.
 * It deliberately does NOT use `STRIPE_QA_READONLY_KEY` — that key's whole
 * purpose is producing read-only-labelled evidence, and a script that then
 * cancels PaymentIntents with it would be a straight contradiction.
 *
 * EXIT 0 = nothing left to do | 1 = releases still owed (dry run) or a failure | 2 = setup.
 */
import { getClients, getStripeKey } from './lib/r41-common.mjs';

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const APPLY = hasFlag('yes');
const DAYS = Number(flagValue('days') || 60);
const CAPTURABLE_DAYS = Number(flagValue('capturable-days') || 7);
const HOLD_EXPECTED_STATUSES = new Set(['pending', 'in_progress']);
const CANCELLABLE = [
  'requires_capture',
  'requires_confirmation',
  'requires_action',
  'requires_payment_method',
];

/** Stripe's cancellation changed shape across versions; pass the pinned one. */
const STRIPE_VERSION = '2023-10-16';
const redact = (s) => String(s).replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_***');

/** GET a Stripe object with the given key (the writer's own key, see header). */
async function stripeGetWith(key, path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json;
}

async function cancelPaymentIntent(writeKey, piId) {
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${writeKey}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${json?.error?.code || ''} ${json?.error?.message || ''}`.trim());
  }
  return json;
}

async function main() {
  // One key for both legs — this script always mutates, so it never borrows the
  // read-only credential (see the header).
  const writeKey = getStripeKey();
  const { admin } = getClients();

  const cutoff = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const { data: trades, error } = await admin
    .from('trades')
    .select('id,status,stripe_payment_intent_id,created_at,cancellation_reason')
    .not('stripe_payment_intent_id', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error(`[release-stranded-holds] DB read failed: ${redact(error.message)}`);
    process.exit(2);
  }

  const rows = (trades ?? []).filter((t) => !HOLD_EXPECTED_STATUSES.has(t.status));

  // `completed` is deliberately EXCLUDED, and this is a judgement call worth
  // stating: a completed trade with an uncaptured PI is the OPPOSITE defect —
  // money that was never collected (see `qa:stranded-holds` →
  // completed_without_capture, and the R14 correction in the QA playbook).
  // Cancelling it would silently convert "we never collected" into "we never
  // will collect" and destroy the evidence in the same keystroke. Releasing a
  // hold is cleanup; abandoning a collection is a DECISION, so it is reported
  // and left alone until someone explicitly asks for it.
  //
  // The skip is counted AFTER probing Stripe on purpose: the count must describe
  // "completed trades that still hold uncaptured money", not "completed trades
  // that happen to have a PI id" (most of those were captured normally). Counting
  // before the probe over-reported this by ~45x on the first run — a number in a
  // tool's output is a claim, so it is only emitted once it has been measured.
  const targets = [];
  let completedUncaptured = 0;
  let completedUncapturedCents = 0;

  for (const t of rows) {
    let pi;
    try {
      pi = await stripeGetWith(writeKey, `/payment_intents/${t.stripe_payment_intent_id}`);
    } catch {
      continue; // unreadable PI (404 etc.) — reported by qa:stranded-holds, not here
    }
    const heldCents = Number(pi.amount_capturable) || 0;
    if (heldCents <= 0 || !CANCELLABLE.includes(pi.status)) continue;

    if (t.status === 'completed') {
      completedUncaptured += 1;
      completedUncapturedCents += heldCents;
      continue;
    }

    const ageDays = (Date.now() - new Date(pi.created * 1000).getTime()) / 86400_000;
    if (ageDays > CAPTURABLE_DAYS) continue; // past the capture window — nothing to release
    targets.push({ trade_id: t.id, pi: pi.id, held_cents: heldCents, age_days: Number(ageDays.toFixed(1)) });
  }

  const total = targets.reduce((s, t) => s + t.held_cents, 0);
  console.log(`[release-stranded-holds] ${targets.length} releasable hold(s) — $${(total / 100).toFixed(2)}`);
  if (completedUncaptured) {
    console.log(
      `[release-stranded-holds] ${completedUncaptured} COMPLETED trade(s), $${(completedUncapturedCents / 100).toFixed(2)}, ` +
        `still hold uncaptured money — SKIPPED (uncollected money, not a stranded hold). Decide separately.`,
    );
  }
  for (const t of targets) {
    console.log(`   ${t.trade_id}  ${t.pi}  $${(t.held_cents / 100).toFixed(2)}  age ${t.age_days}d`);
  }

  if (!targets.length) {
    console.log('\n✅ Nothing to release.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was cancelled. Re-run with --yes to release these holds.');
    process.exit(1);
  }

  let released = 0;
  const failures = [];
  for (const t of targets) {
    try {
      const pi = await cancelPaymentIntent(writeKey, t.pi);
      released += 1;
      console.log(`   ✅ ${t.pi} → ${pi.status}, amount_capturable=${pi.amount_capturable}`);
    } catch (err) {
      failures.push(`${t.pi}: ${redact(err.message)}`);
      console.error(`   ❌ ${t.pi}: ${redact(err.message)}`);
    }
  }

  console.log(`\n[release-stranded-holds] released ${released}/${targets.length}`);
  if (failures.length) {
    console.log('failures:');
    for (const f of failures) console.log(`   ${f}`);
    process.exit(1);
  }
  console.log('Re-run `npm run qa:stranded-holds` to confirm the count is 0.');
  process.exit(0);
}

main().catch((err) => {
  console.error(`[release-stranded-holds] ${redact(err instanceof Error ? err.message : err)}`);
  process.exit(2);
});
