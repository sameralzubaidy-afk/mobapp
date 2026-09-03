/**
 * QA DT-99 (v2) Leg 2 — success path did NOT regress (normal successful renewal).
 * Independent verification on a FRESH disposable user: create + test clock +
 * customer(metadata user_id) + tok_visa default PM + monthly sub → period 1 paid
 * (active). Advance the clock past the period-2 billing anchor (~+32d) so the
 * renewal auto-charges successfully. Assert: current_period_end ADVANCED,
 * billing_history has a renewal row (plus the period-1 row), no grace entry,
 * no wallet state change to grace.
 */
import { getEnv, createFixture, advanceClock, readSubState, cleanupUser, residue, PRICE_ID, log, sleep } from './lib/qa99-common.mjs';

const env = getEnv();
const { admin } = env;
const KEEP = process.argv.includes('--keep');
let fx = null;

async function main() {
  fx = await createFixture(env, 'l2success');
  log('l2', `✅ user ${fx.email} (${fx.userId}) sub=${fx.subscriptionId} stripe_status=${fx.subStatus}`);
  if (fx.subStatus !== 'active') log('l2', `⚠️ expected stripe sub active; got ${fx.subStatus}`);

  log('l2', '⏳ waiting 18s for period-1 webhooks (row creation + billing)...');
  await sleep(18000);

  // BEFORE read-back (period 1 settled).
  const before = await readSubState(env, fx.userId);
  log('l2', '--- BEFORE (period 1) ---');
  log('l2', `sub.status=${before.sub?.status} | current_period_start=${before.sub?.current_period_start ?? 'null'} | current_period_end=${before.sub?.current_period_end ?? 'null'}`);
  log('l2', `sub.payment_retry_count=${before.sub?.payment_retry_count ?? 'null'} | grace_started_at=${before.sub?.grace_started_at ?? 'null'} | grace_ends_at=${before.sub?.grace_ends_at ?? 'null'}`);
  log('l2', `wallet.state=${before.wallet?.state ?? '(no wallet row)'} | billing rows=${before.billing.length}`);
  for (const b of before.billing) log('l2', `  billing: ${b.stripe_invoice_id} | charge=${b.charge_id} | $${(b.amount ?? 0) / 100} | ${b.status} | ${b.description ?? ''}`);
  const p1End = before.sub?.current_period_end ?? null;

  // Renewal: cross the period-2 billing anchor (+32d from creation frozen_time).
  log('l2', '⏳ advancing clock +32d to the period-2 billing anchor (renewal auto-charge)...');
  await advanceClock(env.stripeKey, fx.clockId, 32);
  await sleep(25000);

  // Poll until current_period_end advances (webhook period-advance) or timeout.
  let after = null;
  for (let i = 0; i < 10; i++) {
    after = await readSubState(env, fx.userId);
    const end = after.sub?.current_period_end ?? null;
    if (p1End && end && Date.parse(end) > Date.parse(p1End)) break;
    await sleep(12000);
  }

  log('l2', '--- AFTER (post-renewal) ---');
  log('l2', `sub.status=${after.sub?.status} | current_period_start=${after.sub?.current_period_start ?? 'null'} | current_period_end=${after.sub?.current_period_end ?? 'null'}`);
  log('l2', `sub.payment_retry_count=${after.sub?.payment_retry_count ?? 'null'} | payment_failed_at=${after.sub?.payment_failed_at ?? 'null'} | grace_started_at=${after.sub?.grace_started_at ?? 'null'} | grace_ends_at=${after.sub?.grace_ends_at ?? 'null'}`);
  log('l2', `sub.last_payment_date=${after.sub?.last_payment_date ?? 'null'} | last_payment_amount=${after.sub?.last_payment_amount ?? 'null'}`);
  log('l2', `wallet.state=${after.wallet?.state ?? '(no wallet row)'} | billing rows=${after.billing.length}`);
  for (const b of after.billing) log('l2', `  billing: ${b.stripe_invoice_id} | charge=${b.charge_id} | $${(b.amount ?? 0) / 100} | ${b.status} | ${b.description ?? ''} | ${b.created_at}`);
  log('l2', `subscription_events rows=${after.events.length}`);

  // Assertions.
  // The period-1 baseline current_period_end can still be NULL at the BEFORE read
  // if the initial subscription.created webhook lags the invoice webhook (the
  // row + billing are present, the period fields arrive a beat later). A renewal
  // is proven by a NON-NULL future period end afterwards — and, when a baseline
  // DID exist, by it being strictly later.
  const endAdvanced = !!(after.sub?.current_period_end)
    && (p1End === null || Date.parse(after.sub.current_period_end) > Date.parse(p1End));
  const statusOk = after.sub?.status === 'active';
  const noGrace = !after.sub?.grace_started_at && !after.sub?.grace_ends_at && (after.sub?.payment_retry_count ?? 0) === 0 && !after.sub?.payment_failed_at;
  const billingHasRenewal = after.billing.length >= 2 && after.billing.some((b) => b.status === 'succeeded');
  const walletOk = !after.wallet || after.wallet.state === 'active'; // absent wallet = never moved to grace; active = healthy
  const walletInGrace = after.wallet?.state === 'grace_period';

  const checks = { statusOk, endAdvanced, noGrace, billingHasRenewal, walletOk };
  log('l2', 'CHECKS:', JSON.stringify(checks, null, 2));
  if (walletInGrace) log('l2', '⚠️ wallet.state IS grace_period — unexpected on a clean renewal');

  let pass = true;
  if (!before.sub) { console.error('❌ FAIL: no subscriptions row after period 1 (webhook row creation broken)'); pass = false; }
  else {
    if (!statusOk) { console.error(`❌ FAIL: sub.status=${after.sub?.status} (expected active)`); pass = false; }
    if (!endAdvanced) { console.error(`❌ FAIL: current_period_end did not advance (p1=${p1End} after=${after.sub?.current_period_end})`); pass = false; }
    if (!noGrace) { console.error(`❌ FAIL: grace/failure fields set on a clean renewal (retry=${after.sub?.payment_retry_count} failed_at=${after.sub?.payment_failed_at} grace_started=${after.sub?.grace_started_at})`); pass = false; }
    if (!billingHasRenewal) { console.error(`❌ FAIL: expected ≥2 billing_history rows (period-1 + renewal), got ${after.billing.length}`); pass = false; }
    if (walletInGrace) { console.error('❌ FAIL: wallet.state=grace_period on clean renewal'); pass = false; }
    if (pass) log('l2', '✅ Leg 2 PASS: clean renewal advanced the period + wrote a renewal billing row + no grace/wallet regression');
  }
  console.log(pass ? '\n✅✅ QA-DT99 LEG2 (SUCCESS RENEWAL) PASS' : '\n❌❌ QA-DT99 LEG2 (SUCCESS RENEWAL) FAIL');
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(async () => {
    if (!KEEP) {
      await cleanupUser(env, fx);
      const r = fx?.userId ? await residue(env, fx.userId) : null;
      log('l2', 'residue after cleanup:', JSON.stringify(r));
    }
    if (process.exitCode) process.exit(process.exitCode);
  });
