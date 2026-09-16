#!/usr/bin/env node
/**
 * FIX-Task-35 item 10 (2026-09-14) — `qa:capture-uncollected-pis`: OWNER-APPROVED
 * repair for trades marked `completed` whose buyer PaymentIntent was never captured.
 *
 * THE STANDING POLICY THIS IMPLEMENTS
 *   "For trades found 'completed' with an uncaptured PaymentIntent: CAPTURE NOW if
 *    the PI is still capturable; REVERSE THE COMPLETION (revert status, cancel any
 *    scheduled payout) if the authorization already expired."
 *
 *   This script only performs the FIRST half. It deliberately cannot flip a trade
 *   back to `in_progress` — un-completing a trade that the app already told both
 *   parties is finished, with SP released and a payout row queued, is an owner
 *   decision that needs its own reversal plan, not a --yes flag. Expired cases are
 *   therefore REPORTED as `NEEDS_REVERSAL`, not acted on.
 *
 * WHY THE HOLD IS STILL THERE
 *   The QA playbook's R14 fast-clock recipe completed trades by calling
 *   `rpc_process_auto_complete`, which only flips the DB status — the Stripe capture
 *   lives in the `process-auto-complete` Edge Function (FIX-Task-34 extra finding B).
 *   The result is a trade that reads `completed` everywhere, has a `seller_payouts`
 *   row, and whose PI still says `requires_capture` with `amount_received = 0`.
 *
 * WHY THE DB CANNOT BE TRUSTED TO ANSWER THIS
 *   `payments.derived_state` and `payments.captured_at` are trigger-written MIRRORS
 *   of `trades.status` (R100). Verified live: both trades below read
 *   `derived_state='succeeded'` with a stamped `captured_at` while Stripe was still
 *   holding an uncaptured authorization. Only Stripe answers this question.
 *
 * WHAT IT WRITES (FIX-Task-36 item 2 / approved further-consideration 2B)
 *   For each capture: the Stripe PI is captured, the tax record is moved out of
 *   `quoted` (`rpc_mark_tax_collected`), and a `financial_audit_log` row is written
 *   with the SAME idempotency keys the product Edge Function uses
 *   (`capture_<tradeId>` / `tax_collected_<tradeId>`) — so the journal stays
 *   complete and a re-run can never double-log. `after_state.source` reads
 *   `qa_capture_remediation`, which honestly distinguishes these rows from a
 *   normal product auto-complete.
 *
 * AUTH: a WRITER, so it uses the fixture test-mode secret key at
 * `~/.dt11-stripe-key` (never echoed) — not `STRIPE_QA_READONLY_KEY`.
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:capture-uncollected-pis                       # DRY RUN (default)
 *   npm run qa:capture-uncollected-pis -- --yes              # perform the captures
 *   npm run qa:capture-uncollected-pis -- --days 400 --yes
 *   npm run qa:capture-uncollected-pis -- --trade <uuid> --yes
 *
 * EXIT 0 = nothing actionable | 1 = captures owed / a failure / a reversal owed | 2 = setup.
 */
import { getClients, getStripeKey } from './lib/r41-common.mjs';

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const APPLY = hasFlag('yes');
const DAYS = Number(flagValue('days') || 400);
const ONLY_TRADE = flagValue('trade');
const CAPTURABLE_DAYS = Number(flagValue('capturable-days') || 7);
const STRIPE_VERSION = '2023-10-16';
/** The only PI state that can still be captured. */
const CAPTURABLE_STATUS = 'requires_capture';

const redact = (s) => String(s).replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_***');

async function stripeCall(key, path, method = 'GET') {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${json?.error?.code || ''} ${json?.error?.message || ''}`.trim());
  }
  return json;
}

/**
 * Write a financial audit row, mirroring the product Edge Function's
 * `logFinancialAudit` (supabase/functions/process-auto-complete/index.ts).
 * Non-blocking: an audit failure must never abort a capture that already
 * succeeded at Stripe — it is logged and the loop continues.
 * Idempotent by `idempotencyKey`, so a re-run never double-logs.
 */
async function logFinancialAudit(admin, {
  mutationType,
  entityType,
  entityId,
  afterState,
  amountCents = null,
  idempotencyKey,
}) {
  try {
    const { error } = await admin.rpc('fn_log_financial_audit', {
      p_mutation_type: mutationType,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_actor_id: null, // system/QA remediation — no user actor
      p_before_state: {},
      p_after_state: afterState ?? {},
      p_amount_cents: amountCents,
      p_idempotency_key: idempotencyKey ?? null,
      p_node_id: null,
    });
    if (error) console.error(`      ⚠️  audit ${mutationType}: ${redact(error.message)}`);
  } catch (err) {
    console.error(`      ⚠️  audit ${mutationType}: ${redact(err instanceof Error ? err.message : err)}`);
  }
}

async function main() {
  const writeKey = getStripeKey();
  const { admin } = getClients();

  const cutoff = new Date(Date.now() - DAYS * 86400_000).toISOString();
  let query = admin
    .from('trades')
    .select('id,status,cash_amount_cents,stripe_payment_intent_id,created_at,completed_at')
    .eq('status', 'completed')
    .not('stripe_payment_intent_id', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (ONLY_TRADE) query = query.eq('id', ONLY_TRADE);

  const { data: trades, error } = await query;
  if (error) {
    console.error(`[capture-uncollected-pis] DB read failed: ${redact(error.message)}`);
    process.exit(2);
  }

  const rows = trades ?? [];
  console.log(
    `[capture-uncollected-pis] probing ${rows.length} completed trade(s) with a PI (last ${DAYS} day(s))`,
  );

  /** Actions this run wants to take, decided ONLY from Stripe state. */
  const toCapture = [];
  const needsReversal = [];
  const alreadyCollected = [];
  const unreadable = [];

  for (const t of rows) {
    let pi;
    try {
      pi = await stripeCall(writeKey, `/payment_intents/${t.stripe_payment_intent_id}`);
    } catch (err) {
      unreadable.push({ trade_id: t.id, pi: t.stripe_payment_intent_id, error: redact(err.message) });
      continue;
    }

    const heldCents = Number(pi.amount_capturable) || 0;
    const receivedCents = Number(pi.amount_received) || 0;
    const ageDays = Number(((Date.now() / 1000 - pi.created) / 86400).toFixed(1));

    if (receivedCents > 0 || heldCents === 0) {
      alreadyCollected.push({ trade_id: t.id, pi: pi.id, status: pi.status, received_cents: receivedCents });
      continue;
    }

    const base = {
      trade_id: t.id,
      pi: pi.id,
      pi_status: pi.status,
      held_cents: heldCents,
      held: `$${(heldCents / 100).toFixed(2)}`,
      cash_amount_cents: t.cash_amount_cents,
      age_days: ageDays,
    };

    if (pi.status === CAPTURABLE_STATUS && ageDays <= CAPTURABLE_DAYS) toCapture.push(base);
    else needsReversal.push({ ...base, why: pi.status !== CAPTURABLE_STATUS ? `pi_status=${pi.status}` : `age ${ageDays}d > ${CAPTURABLE_DAYS}d capture window` });
  }

  const sum = (a) => a.reduce((s, r) => s + r.held_cents, 0);

  console.log(
    `\n  already collected (DB called these 'completed', Stripe agrees) : ${alreadyCollected.length}`,
  );
  console.log(`  CAPTURABLE — policy says capture now                      : ${toCapture.length}  (${`$${(sum(toCapture) / 100).toFixed(2)}`})`);
  console.log(`  NEEDS REVERSAL — authorization already gone               : ${needsReversal.length}  (${`$${(sum(needsReversal) / 100).toFixed(2)}`})`);
  if (unreadable.length) console.log(`  UNREADABLE PI (404 etc.)                                 : ${unreadable.length}`);

  for (const r of toCapture) {
    console.log(`\n   CAPTURE  trade ${r.trade_id}\n     PI ${r.pi} ${r.pi_status} age=${r.age_days}d  held=${r.held}`);
  }
  for (const r of needsReversal) {
    console.log(`\n   REVERSE  trade ${r.trade_id}\n     PI ${r.pi} ${r.pi_status} age=${r.age_days}d  held=${r.held}  why=${r.why}`);
  }
  for (const r of unreadable) {
    console.log(`\n   UNREADABLE  trade ${r.trade_id}  PI ${r.pi}  ${r.error.split('\n')[0]}`);
  }

  if (!toCapture.length) {
    console.log('\n✅ No capturable uncollected money found.');
    process.exit(needsReversal.length ? 1 : 0);
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was captured. Re-run with --yes to capture these.');
    process.exit(1);
  }

  let captured = 0;
  const failures = [];
  for (const r of toCapture) {
    try {
      const pi = await stripeCall(writeKey, `/payment_intents/${r.pi}/capture`, 'POST');
      captured += 1;
      const chargeId = pi.latest_charge ?? null;
      console.log(`   ✅ ${r.pi} → ${pi.status}, amount_received=${pi.amount_received} (charge ${chargeId})`);

      // The same follow-up the product EFs perform after a successful capture:
      // transition the tax record out of 'quoted' so the money and the tax ledger
      // agree. Idempotent; a no-op for trades with no tax record.
      const { data, error } = await admin.rpc('rpc_mark_tax_collected', {
        p_trade_id: r.trade_id,
        p_stripe_capture_id: chargeId,
      });
      if (error) console.error(`      ⚠️  rpc_mark_tax_collected: ${redact(error.message)}`);
      else console.log(`      tax: ${JSON.stringify(data)}`);

      // FIX-Task-36 item 2 (approved further-consideration 2B) — write the SAME
      // financial-audit rows the product Edge Function writes, so the journal
      // stays complete and a later audit can see WHO collected this money. The
      // key difference is `source`, which honestly marks these rows as a QA
      // remediation rather than a normal product auto-complete.
      await logFinancialAudit(admin, {
        mutationType: 'payment_captured',
        entityType: 'trade',
        entityId: r.trade_id,
        afterState: {
          stripe_payment_intent_id: r.pi,
          stripe_charge_id: chargeId,
          source: 'qa_capture_remediation',
        },
        amountCents: r.cash_amount_cents,
        idempotencyKey: `capture_${r.trade_id}`,
      });

      // Only journal `tax_collected` when the tax ledger ACTUALLY moved (the EF
      // logs it unconditionally; here the RPC's own answer decides). A trade with
      // no tax record answers `action: 'noop'` — journaling that would put a false
      // tax-collection entry in the financial journal.
      const taxMoved = !error && data?.success !== false && data?.data?.new_status === 'collected';
      if (taxMoved) {
        await logFinancialAudit(admin, {
          mutationType: 'tax_collected',
          entityType: 'trade',
          entityId: r.trade_id,
          afterState: { stripe_charge_id: chargeId },
          idempotencyKey: `tax_collected_${r.trade_id}`,
        });
      }
    } catch (err) {
      failures.push(`${r.pi}: ${redact(err.message)}`);
      console.error(`   ❌ ${r.pi}: ${redact(err.message)}`);
    }
  }

  console.log(`\n[capture-uncollected-pis] captured ${captured}/${toCapture.length}`);
  if (failures.length) {
    console.log('failures:');
    for (const f of failures) console.log(`   ${f}`);
  }
  if (needsReversal.length) {
    console.log(
      `\n⚠️  ${needsReversal.length} trade(s) need the REVERSAL half of the policy (authorization gone).` +
        `\n    That step is NOT implemented here — un-completing a trade is an owner decision.`,
    );
  }
  process.exit(failures.length || needsReversal.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`[capture-uncollected-pis] ${redact(err instanceof Error ? err.message : err)}`);
  process.exit(2);
});
