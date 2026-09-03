/**
 * DEV-TASK-R41 (2026-09-03) — SUB-TC-L02 live failing-renewal leg.
 *
 * SUB-TC-L02 ("Payment-failed webhook moves subscription into retry / grace
 * state") stayed PARTIAL because a live failing renewal was never driven (a
 * checkout decline ≠ a renewal-invoice failure). This script drives a GENUINE
 * 3-failure renewal cycle on a DISPOSABLE user via Stripe test-clock, so
 * `record_payment_attempt` / grace entry / SP-wallet sync fire FOR REAL (not
 * just confirmed in source).
 *
 * DEV-TASK-99 / R6 model (owner decision 2026-08-09): on the 3rd failure the
 * webhook now transitions subscription.status -> 'grace_period' (with grace
 * dates) and sp_wallets.state -> 'grace_period' (can spend existing SP, cannot
 * earn) via update_subscription_status + rpc_set_sp_wallet_state (the old
 * `triggerSpFreeze` HTTP seam to SP_SUBSCRIPTION_LAPSE_URL was never deployed
 * and has been replaced). The wallet is NOT 'frozen' at grace entry — the
 * grace-period cron freezes it only after the window ends.
 *
 * Recipe (established QA Task 21/22 + DT94, verified fast-clock technique still
 * applies post-DT89/94 webhook changes — the webhook EF at v50 is what DT94's
 * live repro + QA Task 21 used to advance current_period_end and write billing
 * rows on 2026-09-03):
 *   1. Disposable auth user (never a standing persona).
 *   2. Stripe test clock frozen at now; customer ON the clock, metadata user_id.
 *   3. PM tok_visa (BP-69) attached + default → FIRST invoice paid → sub active.
 *   4. Monthly sub on the Kids Club+ price (price_1UBLkH4I6kCJlvXoq9xsDhuG).
 *   5. REMOVE the default PM (the QA Task 21/22 "no saved PM" failing-renewal
 *      precondition) so the NEXT renewal auto-charge genuinely fails.
 *   6. Advance the clock to the period-2 billing anchor, then in +1-day steps,
 *      reading back subscriptions.payment_retry_count after each until it hits
 *      the 3-failure max → the webhook's `record_payment_attempt(max=true)` path
 *      + critical `payment_failed` notification + grace entry (sub ->
 *      grace_period, wallet -> grace_period) should fire.
 *   7. Read back: subscriptions (status, payment_retry_count, payment_failed_at,
 *      grace fields), billing_history, user_notifications (critical payment-
 *      failed rows), sp_wallets.state.
 *
 * Mutations are all disposable + cleaned (BP-70 / QA Task 21 A8 discipline).
 * Stripe key from ~/.dt11-stripe-key. Env from p2p-kids-marketplace/.env.
 *
 * Run (dev team, with Samer's approval — Phase 2):
 *   npm run qa:r41-l02-failing-renewal            # full cycle
 *   npm run qa:r41-l02-failing-renewal -- --advances 3 --dry-run
 *
 * NOTE: Stripe's invoice retry schedule is account-specific; if the 3-failure
 * cycle does not fully complete within the advance window, the script reports
 * exactly how far `payment_retry_count` got (retry ≥ 1 still exercises the real
 * record_payment_attempt path) rather than fabricating a result.
 */
import { getClients, getStripeKey, log, argValue, hasFlag, sleep } from './lib/r41-common.mjs';

const { admin } = getClients();
const STRIPE_KEY = getStripeKey();
const PRICE_ID = process.env.R41_PRICE_ID || 'price_1UBLkH4I6kCJlvXoq9xsDhuG';
const DRY_RUN = hasFlag('--dry-run');
const KEEP = hasFlag('--keep');
const ADVANCES = Number(argValue('advances') || '15');

async function stripeCall(method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

let userId = null;
let customerId = null;
let subscriptionId = null;
let clockId = null;
let pmId = null;

async function cleanup() {
  if (DRY_RUN || KEEP) return;
  log('r41-l02', '🧹 cleanup...');
  try {
    if (subscriptionId) await stripeCall('POST', `/subscriptions/${subscriptionId}`, { cancel_at_period_end: 'true' }).catch(() => {});
    if (customerId) {
      const subs = await stripeCall('GET', `/subscriptions?customer=${customerId}&limit=10`).catch(() => ({ data: [] }));
      for (const s of subs.data || []) await stripeCall('POST', `/subscriptions/${s.id}`, { cancel_at_period_end: 'true' }).catch(() => {});
      await stripeCall('DELETE', `/customers/${customerId}`).catch(() => {});
    }
    if (pmId) await stripeCall('POST', `/payment_methods/${pmId}/detach`).catch(() => {});
    if (clockId) {
      await fetch(`https://api.stripe.com/v1/test_helpers/test_clocks/${clockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${STRIPE_KEY}` },
      }).catch(() => null);
    }
  } catch (e) { console.warn('stripe cleanup err', e.message); }
  try {
    if (userId) {
      // NOTE: supabase-js builders are thenables but have NO .catch() — always
      // await and check `{ error }` (a .catch() on a builder throws TypeError).
      for (const table of ['subscriptions', 'billing_history', 'subscription_events', 'user_notifications']) {
        const { error } = await admin.from(table).delete().eq('user_id', userId);
        if (error) console.warn(`db cleanup ${table} err`, error.message);
      }
      const { error: pErr } = await admin.from('profiles').delete().eq('user_id', userId);
      if (pErr) console.warn('db cleanup profiles err', pErr.message);
      const { error: uErr } = await admin.auth.admin.deleteUser(userId);
      if (uErr) console.warn('db cleanup deleteUser err', uErr.message);
    }
  } catch (e) { console.warn('db cleanup err', e.message); }
  log('r41-l02', '✅ cleanup done');
}

async function readState() {
  const { data: subRow } = await admin.from('subscriptions')
    .select('status, payment_retry_count, payment_failed_at, grace_started_at, grace_ends_at, last_payment_date, current_period_end, stripe_subscription_id')
    .eq('user_id', userId).maybeSingle();
  const { data: wallet } = await admin.from('sp_wallets')
    .select('state, frozen_at').eq('user_id', userId).maybeSingle();
  const { data: notifs } = await admin.from('user_notifications')
    .select('type, title, data').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
  return { subRow, wallet, notifs };
}

async function main() {
  if (DRY_RUN) {
    log('r41-l02', 'DRY-RUN — no mutations. Would: disposable user + test clock + customer(metadata user_id) + tok_visa PM + monthly sub (period 1 paid → active), then remove the default PM and advance the clock through ~3 failed renewals, reading payment_retry_count/grace/freeze/notifications.');
    return;
  }

  // 1. Disposable user
  const email = `qa.r41.l02.${Date.now()}@kidsmarketplace.test`;
  const { data: { user }, error: uErr } = await admin.auth.admin.createUser({
    email, password: 'TestPass123!', email_confirm: true,
    user_metadata: { name: 'R41 L02 Failing-Renewal' },
  });
  if (uErr) throw new Error(`createUser: ${uErr.message}`);
  userId = user.id;
  log('r41-l02', `✅ user ${email} (${userId})`);

  // 2. Test clock frozen now
  const clock = await stripeCall('POST', '/test_helpers/test_clocks', { frozen_time: String(Math.floor(Date.now() / 1000)) });
  clockId = clock.id;
  log('r41-l02', `✅ test clock ${clockId}`);

  // 3. Customer on clock, metadata-bound to the DB user
  const customer = await stripeCall('POST', '/customers', {
    test_clock: clockId, email, 'metadata[user_id]': userId, 'metadata[source]': 'r41-l02-failing-renewal',
  });
  customerId = customer.id;

  // 4. tok_visa PM (BP-69) + default → period 1 is PAID → active
  const pm = await stripeCall('POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
  pmId = pm.id;
  await stripeCall('POST', `/payment_methods/${pmId}/attach`, { customer: customerId });
  await stripeCall('POST', `/customers/${customerId}`, { 'invoice_settings[default_payment_method]': pmId });

  // 5. Monthly subscription (no trial)
  const sub = await stripeCall('POST', '/subscriptions', {
    customer: customerId,
    'items[0][price]': PRICE_ID, 'items[0][quantity]': '1',
    collection_method: 'charge_automatically',
    'payment_settings[save_default_payment_method]': 'off',
    'metadata[user_id]': userId, 'metadata[source]': 'r41-l02-failing-renewal',
  });
  subscriptionId = sub.id;
  log('r41-l02', `✅ sub ${sub.id} status=${sub.status} latest_invoice=${sub.latest_invoice}`);
  if (sub.status !== 'active') log('r41-l02', `⚠️ expected active; got ${sub.status} (check the first invoice was paid)`);

  // Wait for period-1 webhooks, then detach the default PM → the NEXT renewal fails.
  await sleep(10000);
  log('r41-l02', '🔓 removing default PM (failing-renewal precondition)...');
  await stripeCall('POST', `/payment_methods/${pmId}/detach`).catch(() => {});
  await stripeCall('POST', `/customers/${customerId}`, { 'invoice_settings[default_payment_method]': '' }).catch(() => {});

  // 6. Sweep the clock forward in steps. Each crossing of a scheduled moment
  //    fires the renewal attempt / dunning retries as `invoice.payment_failed`
  //    events. Stripe returns HTTP 429 "advancement underway" if a prior
  //    advance is still processing — wait and retry the SAME step (a thrown
  //    429 used to abort the whole run before the read-back).
  const advance = async (days, attempts = 15) => {
    const clockState = await stripeCall('GET', `/test_helpers/test_clocks/${clockId}`);
    const base = clockState.frozen_time || Math.floor(Date.now() / 1000);
    for (let a = 0; a < attempts; a++) {
      try {
        await stripeCall('POST', `/test_helpers/test_clocks/${clockId}/advance`, { frozen_time: String(base + days * 86400) });
        return;
      } catch (e) {
        if (/429|advancement underway/i.test(e.message) && a < attempts - 1) {
          log('r41-l02', `  ⏳ clock still advancing (429) — waiting 10s and retrying advance...`);
          await sleep(10000);
          continue;
        }
        throw e;
      }
    }
  };

  // First jump: land just past the period-2 billing anchor (+32d from the
  // creation frozen_time). Give the clock + webhooks time to settle.
  await advance(32);
  await sleep(20000);

  let state = await readState();
  let lastRetry = state.subRow?.payment_retry_count ?? 0;
  log('r41-l02', `after anchor jump: retry=${lastRetry} status=${state.subRow?.status ?? 'no row'} failed_at=${state.subRow?.payment_failed_at ?? 'null'}`);

  // Sweep +2d at a time so each dunning retry crossing fires individually.
  for (let i = 0; i < ADVANCES; i++) {
    if (lastRetry >= 3) break;
    await advance(2);
    await sleep(15000);
    state = await readState();
    const retry = state.subRow?.payment_retry_count ?? 0;
    if (retry !== lastRetry) {
      log('r41-l02', `  [sweep ${i}] payment_retry_count -> ${retry} (payment_failed_at=${state.subRow?.payment_failed_at ?? 'null'})`);
      lastRetry = retry;
    }
    if (retry >= 3) break;
  }

  // 7. Decisive read-back.
  // The webhook lands grace entry ~1-2s AFTER the 3rd-failure RPC (the critical
  // payment-failed notification send sits between them in the handler), so poll
  // briefly until the transition settles instead of racing it. (QA DT-99 finding:
  // the decisive read used to run ~0.7s ahead of the grace write -> false FAIL.)
  if (lastRetry >= 3) {
    for (let settle = 0; settle < 12; settle++) {
      const s = await readState();
      if (s.subRow?.status === 'grace_period' && s.wallet?.state === 'grace_period') break;
      await sleep(2000);
    }
  }
  state = await readState();
  const subRow = state.subRow;
  log('r41-l02', 'SUBSCRIPTIONS ROW:', JSON.stringify(subRow ?? null, null, 2));
  log('r41-l02', `wallet.state=${state.wallet?.state ?? 'no wallet'} frozen_at=${state.wallet?.frozen_at ?? 'null'}`);
  log('r41-l02', `user_notifications (newest 5):`);
  for (const n of state.notifs || []) log('r41-l02', `  - type=${n.type} title=${n.title} critical=${!!n.data?.critical}`);

  const retryCount = subRow?.payment_retry_count ?? 0;
  let pass = false;
  if (retryCount >= 1) {
    log('r41-l02', `✅ PASS (partial→full): live failing renewal observed — payment_retry_count=${retryCount} / 3${retryCount >= 3 ? ' → max reached (grace-entry path fired)' : ' (cycle incomplete — Stripe dunning may need more clock time or retries are scheduled beyond the advance window)'}`);
    // DEV-TASK-99 / R6: the 3rd failure must move the sub to grace_period AND the
    // wallet to 'grace_period' (spendable). 'frozen' is NOT expected here — the
    // grace-period cron freezes it only after the grace window ends.
    if (retryCount >= 3 && subRow?.status === 'grace_period' && state.wallet?.state === 'grace_period') pass = true;
    else if (retryCount >= 3) log('r41-l02', `⚠️ retry max reached but grace entry incomplete — sub.status=${subRow?.status ?? 'no row'} wallet.state=${state.wallet?.state ?? 'no wallet'} (expect grace_period/grace_period). Check the webhook grace-entry wiring (enterGracePeriodAndSyncWallet: direct subscriptions.update + rpc_set_sp_wallet_state).`);
    else log('r41-l02', `ℹ️ To complete the 3-cycle, re-run with --advances higher (Stripe schedules retries on its own dunning cadence).`);
  } else {
    console.error('❌ FAIL: no payment_failed observed (payment_retry_count stayed 0). The no-PM renewal did not emit invoice.payment_failed on this account. Investigate before trusting this recipe.');
  }
  console.log(pass ? '\n✅✅ R41-L02 FAILING-RENEWAL PASS (3-failure → grace entry + wallet grace_period observed live)' : `\nℹ️ R41-L02 result: retry_count=${retryCount}/3 (see above)`);
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(() => cleanup().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  }));
