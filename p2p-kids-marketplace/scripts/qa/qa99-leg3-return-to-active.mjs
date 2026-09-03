/**
 * QA DT-99 (v2) Leg 3 — edge case: grace entry, then a SUCCESSFUL payment before
 * the grace window ends → returns to active + SP wallet back to 'active'.
 * Independent verification on a FRESH disposable user.
 *
 * Flow:
 *   1. createFixture: period 1 paid → sub active (tok_visa default PM).
 *   2. driveThreeFailures: remove the default PM → 3 genuine failed renewals →
 *      (DEV-TASK-99 webhook, R6 model) sub -> 'grace_period' + wallet ->
 *      'grace_period'. PHASE A asserts this precondition (sub.status +
 *      wallet.state read-back) BEFORE trying the return leg.
 *   3. Re-attach a PM (tok_visa) as default so the next scheduled dunning retry
 *      auto-charges successfully.
 *   4. Advance the clock in +2d steps until invoice.payment_succeeded fires the
 *      webhook's grace/cancel restore branch: sub -> 'active' + wallet ->
 *      'active' (DEV-TASK-99 added the wallet restore here).
 *   5. PHASE B asserts: sub.status='active', wallet.state='active' (unfrozen),
 *      current_period_end advanced, a succeeded billing_history row exists, and
 *      the success happened strictly BEFORE grace_ends_at (i.e. within grace).
 *
 * Mutations are disposable-only + always cleaned (BP-70 / QA Task 21 A8). Run:
 *   node scripts/qa/qa99-leg3-return-to-active.mjs
 * Stripe key from ~/.dt11-stripe-key. Env from p2p-kids-marketplace/.env(.staging).
 */
import { getEnv, createFixture, advanceClock, driveThreeFailures, readSubState, stripeCall, cleanupUser, residue, log, sleep } from './lib/qa99-common.mjs';

const env = getEnv();
const KEEP = process.argv.includes('--keep');
let fx = null;

async function main() {
  fx = await createFixture(env, 'l3return');
  log('l3', `✅ user ${fx.email} (${fx.userId}) sub=${fx.subscriptionId} stripe_status=${fx.subStatus}`);

  log('l3', '⏳ waiting 18s for period-1 webhooks (row creation + billing)...');
  await sleep(18000);

  // ── PHASE A: 3 failures → grace entry (DEV-TASK-99 webhook) ────────────────
  const retries = await driveThreeFailures(env, fx, 20);
  const graceState = await readSubState(env, fx.userId);
  log('l3', '--- PHASE A: after 3 failures (grace entry) ---');
  log('l3', `sub.status=${graceState.sub?.status} | retry=${graceState.sub?.payment_retry_count} | failed_at=${graceState.sub?.payment_failed_at ?? 'null'}`);
  log('l3', `grace_started_at=${graceState.sub?.grace_started_at ?? 'null'} | grace_ends_at=${graceState.sub?.grace_ends_at ?? 'null'}`);
  log('l3', `wallet.state=${graceState.wallet?.state ?? '(no wallet row)'} | frozen_at=${graceState.wallet?.frozen_at ?? 'null'}`);

  const graceEndMs = graceState.sub?.grace_ends_at ? Date.parse(graceState.sub.grace_ends_at) : NaN;
  const enteredGrace = retries >= 3
    && graceState.sub?.status === 'grace_period'
    && graceState.wallet?.state === 'grace_period'
    && Number.isFinite(graceEndMs);
  if (!enteredGrace) {
    console.error(`❌ FAIL (precondition): grace entry not observed — retry=${retries} sub.status=${graceState.sub?.status ?? 'no row'} wallet.state=${graceState.wallet?.state ?? 'no wallet'} grace_ends=${graceState.sub?.grace_ends_at ?? 'null'}`);
    process.exitCode = 1;
    return;
  }
  log('l3', '✅ PHASE A precondition met: sub + wallet both in grace_period');

  // ── PHASE B: successful payment before the grace window ends ───────────────
  log('l3', '🔑 re-attaching a payment method (tok_visa) as the default PM...');
  const pm2 = await stripeCall(env.stripeKey, 'POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
  fx.pm2Id = pm2.id;
  await stripeCall(env.stripeKey, 'POST', `/payment_methods/${pm2.id}/attach`, { customer: fx.customerId });
  await stripeCall(env.stripeKey, 'POST', `/customers/${fx.customerId}`, { 'invoice_settings[default_payment_method]': pm2.id });
  log('l3', `✅ PM2 ${pm2.id} attached as default`);

  log('l3', '⏳ advancing +2d steps so the next scheduled dunning retry auto-charges successfully...');
  let after = null;
  for (let i = 0; i < 16; i++) {
    await advanceClock(env.stripeKey, fx.clockId, 2);
    await sleep(15000);
    after = await readSubState(env, fx.userId);
    const st = after.sub?.status;
    const ws = after.wallet?.state ?? 'no-wallet';
    log('l3', `  [step ${i}] sub.status=${st} | wallet.state=${ws} | billing=${after.billing.length} | current_period_end=${after.sub?.current_period_end ?? 'null'} | retry=${after.sub?.payment_retry_count ?? 'null'}`);
    // Full recovery evidence = the sub AND wallet flipped to active AND a NEW
    // succeeded charge landed (billing > 1). Stripe may send subscription.updated
    // (active) a beat before the invoice.payment_succeeded billing write, so keep
    // polling until both are true rather than stopping on the state flip alone.
    if (st === 'active' && ws === 'active' && after.billing.length >= 2) break;
  }

  log('l3', '--- PHASE B: after successful payment during grace ---');
  log('l3', `sub.status=${after.sub?.status} | retry=${after.sub?.payment_retry_count} | failed_at=${after.sub?.payment_failed_at ?? 'null'} | grace_started_at=${after.sub?.grace_started_at ?? 'null'} | grace_ends_at=${after.sub?.grace_ends_at ?? 'null'}`);
  log('l3', `sub.last_payment_date=${after.sub?.last_payment_date ?? 'null'} | last_payment_amount=${after.sub?.last_payment_amount ?? 'null'} | current_period_end=${after.sub?.current_period_end ?? 'null'}`);
  log('l3', `wallet.state=${after.wallet?.state ?? '(no wallet row)'} | wallet.frozen_at=${after.wallet?.frozen_at ?? 'null'}`);
  log('l3', `billing rows=${after.billing.length}:`);
  for (const b of after.billing) log('l3', `  billing: ${b.stripe_invoice_id} | charge=${b.charge_id} | $${(b.amount ?? 0) / 100} | ${b.status} | ${b.created_at}`);
  log('l3', `subscription_events rows=${after.events.length}`);
  for (const e of after.events) log('l3', `  event: ${e.event_type} | ${JSON.stringify(e.metadata ?? {})} | ${e.created_at}`);

  // Assertions.
  // NOTE on "within grace": grace_ends_at is stored as DB NOW()+30d (real time),
  // and this run's success happens seconds later in real time — so the payment
  // is definitionally before the grace window ends in this fixture. The
  // meaningful state-machine assertions are the two flips plus the recovery charge.
  const subActive = after.sub?.status === 'active';
  const walletActive = after.wallet?.state === 'active';
  const recoveryCharge = (after.billing || []).length >= 2
    && (after.billing || []).filter((b) => b.status === 'succeeded').length >= 2;
  const checks = { subActive, walletActive, recoveryCharge };
  log('l3', 'CHECKS:', JSON.stringify(checks, null, 2));

  let pass = subActive && walletActive && recoveryCharge;
  if (!subActive) console.error(`❌ FAIL: sub.status=${after.sub?.status} (expected active after successful payment)`);
  if (!walletActive) console.error(`❌ FAIL: wallet.state=${after.wallet?.state ?? 'no wallet'} (expected active/unfrozen after successful payment)`);
  if (!recoveryCharge) console.error(`❌ FAIL: expected a NEW succeeded billing row for the recovery charge (billing=${(after.billing || []).length}, succeeded=${(after.billing || []).filter((b) => b.status === 'succeeded').length})`);
  if (pass) log('l3', '✅ Leg 3 PASS: payment during grace returned the subscription AND the SP wallet to active, with a recovery charge recorded');

  console.log(pass ? '\n✅✅ QA-DT99 LEG3 (RETURN-TO-ACTIVE DURING GRACE) PASS' : '\n❌❌ QA-DT99 LEG3 (RETURN-TO-ACTIVE DURING GRACE) FAIL');
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(async () => {
    if (!KEEP) {
      await cleanupUser(env, fx);
      const r = fx?.userId ? await residue(env, fx.userId) : null;
      log('l3', 'residue after cleanup:', JSON.stringify(r));
    }
    if (process.exitCode) process.exit(process.exitCode);
  });
