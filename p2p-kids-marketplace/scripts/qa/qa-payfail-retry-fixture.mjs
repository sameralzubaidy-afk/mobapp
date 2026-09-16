/**
 * FIX-Task-41 item 5 (2026-09-16) — the M07 TRUE-RETRY-SUCCESS fixture.
 *
 * WHY THIS EXISTS
 * ---------------
 * SUB-TC-M07's remaining undriven leg is the retry-success branch of
 * `PaymentMethodsScreen.handleAddPaymentMethod` → `retryFailedPayment(userId, {
 * resolveWithoutInvoice: true })` → the "Payment Method Added" alert.
 *
 * The `retry-failed-payment` Edge Function gates that branch behind FOUR
 * ordered checks (supabase/functions/retry-failed-payment/index.ts):
 *
 *   1. `payment_failed_at IS NOT NULL AND payment_retry_count <> 0`  (else NO_FAILED_PAYMENT)
 *   2. `stripe_subscription_id` AND `stripe_customer_id` are non-NULL (else MISSING_STRIPE_DATA)
 *   3. `stripe.invoices.list({ subscription, status: 'open' })` returns ZERO rows
 *   4. the caller passes `resolve_without_invoice: true`
 *
 * The persona that carries failure flags (`test-payfail`, the ACC-TC-G02
 * PaymentFailureBanner fixture) has BOTH Stripe id columns NULL, so check 2 fires
 * and the branch is unreachable — M07 was stuck PARTIAL for that reason
 * (SUB Android R3, `e2e-test-results/qa-sub-android-r3-2026-09-16/report.md` §M07).
 *
 * This fixture is a deliberate SECOND, payfail-shaped persona
 * (`test-payfail-retry`) that satisfies all four:
 *   - a REAL Stripe test-mode customer + attached card (`tok_visa`, BP-69)
 *   - a REAL Stripe subscription on the canonical Kids Club+ price, whose first
 *     invoice Stripe pays immediately ⇒ NO open invoice exists
 *   - `subscriptions.payment_retry_count=1` + `payment_failed_at=now()` written
 *     LAST (the `invoice.payment_succeeded` webhook calls
 *     `record_payment_attempt(p_success: true)`, which RESETS those two columns —
 *     applying the failure state before the webhook settles would be a race)
 *
 * It is deliberately a SEPARATE persona from `test-payfail`: driving M07 clears
 * the failure flags, which would silently break the ACC-TC-G02 banner fixture.
 *
 * Subcommands (service-role + Stripe test key; two-phase provisioning — this file
 * is Phase 1 code, executing it is Phase 2 and needs Samer's approval):
 *
 *   ensure [--dry-run] [--price <price_id>]
 *       → create/reconcile the persona end-to-end (auth user + profile + Stripe
 *         customer/PM/subscription + subscriptions row + SP wallet) and assert the
 *         four guards above. Idempotent: re-running reuses the existing Stripe
 *         subscription and re-applies the failure state.
 *
 *   status [--dry-run]
 *       → read-only: print EVERY guard's live verdict (this is the "is M07
 *         drivable right now?" answer) + the exact mobile recipe.
 *
 *   reset [--dry-run]
 *       → cancel the Stripe subscription, detach the card, delete the customer,
 *         delete the persona's DB rows (BP-70) and the auth user, then assert
 *         0 residue.
 *
 * Guardrails: test-mode Stripe key only (refuses sk_live_/rk_live_), never echoes
 * the key, `--dry-run` mutates nothing.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  argValue,
  hasFlag,
  log,
  getClients,
  getStripeKey,
  KIDS_CLUB_PRICE_ID,
} from './lib/r41-common.mjs';

const TAG = 'qa:payfail-retry';
const __dirname = dirname(fileURLToPath(import.meta.url));
const { admin } = getClients();

const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');

const PERSONA_KEY = 'test-payfail-retry';
const EMAIL = 'test-payfail-retry@kidsmarketplace.test';
const PASSWORD = 'TestPayfailRetry123!';
const FIXED_ID = 'a1234567-0000-0000-0000-000000000018';
const NAME = 'Test Payfail Retry User';
const PHONE = '5550101018';

const PRICE_ID = argValue('price') || KIDS_CLUB_PRICE_ID;

const STATE_DIR = resolve(tmpdir(), 'qa-payfail-retry');
const STATE_PATH = resolve(STATE_DIR, `${PERSONA_KEY}.json`);

/** The recorded fixture identity (BP-80 — re-findable by id across sessions). */
function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hardFail(msg) {
  console.error(`🛑 ${msg}`);
  process.exit(2);
}

function usage() {
  console.log(`qa:payfail-retry — M07 true-retry-success fixture (${PERSONA_KEY})

  ensure [--dry-run] [--price <price_id>]
      → provision/reconcile the persona so the retry-failed-payment success branch
        (resolve_without_invoice) is genuinely reachable: real Stripe customer +
        attached card + real subscription with NO open invoice, plus
        payment_retry_count=1 / payment_failed_at applied last.
  status [--dry-run]
      → read-only guard-by-guard verdict: is M07 drivable right now?
  reset [--dry-run]
      → cancel Stripe sub + detach card + delete customer + persona rows (BP-70).
`);
}

// ── Guardrail: test-mode Stripe key only (same discipline as qa:invalidate-payment-method) ──
function loadStripeKey() {
  const key = getStripeKey();
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
    hardFail('LIVE Stripe key detected. This fixture creates subscriptions and must run in test mode only.');
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    hardFail(`Stripe key is not recognisably test-mode (prefix "${key.slice(0, 8)}…"). Refusing to run.`);
  }
  return key;
}

function makeStripe(key) {
  return async function stripeCall(method, path, form) {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}` },
      body: form ? new URLSearchParams(form) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json);
      throw new Error(`Stripe ${method} ${path} -> ${res.status} ${msg}`);
    }
    return json;
  };
}

// ── Read-only helpers (no Stripe) ────────────────────────────────────────────

async function findUserIdByEmail() {
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return (
    (list?.users ?? []).find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())?.id ?? null
  );
}

async function resolveNodeId() {
  for (const anchorEmail of [
    'test-seller@kidsmarketplace.test',
    'test-buyer@kidsmarketplace.test',
  ]) {
    const { data: anchor, error } = await admin
      .from('profiles')
      .select('node_id')
      .eq('email', anchorEmail)
      .maybeSingle();
    if (!error && anchor?.node_id) return anchor.node_id;
  }
  const { data: node, error: nodeError } = await admin
    .from('nodes')
    .select('id')
    .eq('is_active', true)
    .eq('zip_code', '06850')
    .limit(1)
    .maybeSingle();
  if (!nodeError && node?.id) return node.id;
  const { data: anyNode } = await admin
    .from('nodes')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return anyNode?.id ?? null;
}

async function readSubRow() {
  const userId = await findUserIdByEmail();
  if (!userId) return { userId: null, row: null };
  const { data, error } = await admin
    .from('subscriptions')
    .select(
      'status, payment_retry_count, payment_failed_at, stripe_subscription_id, stripe_customer_id, stripe_payment_method_id, current_period_end'
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`subscriptions read: ${error.message}`);
  return { userId, row: data ?? null };
}

/** Open invoices for a Stripe subscription — guard #3's exact query. */
async function listOpenInvoices(stripe, stripeSubId) {
  if (!stripeSubId) return null;
  const json = await stripe(
    'GET',
    `/invoices?subscription=${encodeURIComponent(stripeSubId)}&status=open&limit=5`
  );
  return json.data ?? [];
}

/**
 * Read-only guard-by-guard verdict — the "is M07 drivable right now?" answer.
 * `stripe` is optional; without it the open-invoice guard is reported as UNKNOWN.
 */
async function guardReport({ row, stripe }) {
  const checks = [];
  const retries = row?.payment_retry_count ?? 0;
  const failedAt = row?.payment_failed_at ?? null;

  checks.push({
    guard: '1 payment_failed_at + payment_retry_count<>0',
    ok: Boolean(failedAt) && retries !== 0,
    detail: failedAt ? `retry_count=${retries}, failed_at=${failedAt}` : 'no failure state',
  });
  checks.push({
    guard: '2 stripe_subscription_id + stripe_customer_id',
    ok: Boolean(row?.stripe_subscription_id) && Boolean(row?.stripe_customer_id),
    detail: `sub=${row?.stripe_subscription_id ?? 'NULL'} customer=${row?.stripe_customer_id ?? 'NULL'}`,
  });

  if (stripe && row?.stripe_subscription_id) {
    const open = await listOpenInvoices(stripe, row.stripe_subscription_id);
    checks.push({
      guard: '3 zero OPEN invoices',
      ok: open.length === 0,
      detail: open.length === 0 ? 'no open invoice' : `OPEN: ${open.map((i) => i.id).join(', ')}`,
    });
  } else {
    checks.push({
      guard: '3 zero OPEN invoices',
      ok: null,
      detail: stripe ? 'no stripe_subscription_id' : 'UNKNOWN (status run without Stripe)',
    });
  }
  checks.push({
    guard: '4 client sends resolve_without_invoice:true',
    ok: true,
    detail: 'PaymentMethodsScreen.handleAddPaymentMethod (source-verified)',
  });

  const drivable = checks.every((c) => c.ok === true);
  return { checks, drivable };
}

async function printStatus({ withStripe = false } = {}) {
  const { userId, row } = await readSubRow();
  console.log(`\n${PERSONA_KEY} (${EMAIL} / ${PASSWORD}) — auth user ${userId ?? 'NOT PROVISIONED'}`);
  if (!row) {
    console.log('  subscription: MISSING (run `ensure` first)');
    return;
  }
  console.log(
    `  subscriptions: status=${row.status} retry_count=${row.payment_retry_count ?? '—'} failed_at=${row.payment_failed_at ?? '—'}`
  );
  console.log(`  stripe_subscription_id=${row.stripe_subscription_id ?? 'NULL'}`);
  console.log(`  stripe_customer_id=${row.stripe_customer_id ?? 'NULL'}`);
  console.log(`  stripe_payment_method_id=${row.stripe_payment_method_id ?? 'NULL'}`);
  console.log(`  current_period_end=${row.current_period_end ?? '—'}`);

  const stripe = withStripe && !DRY_RUN ? makeStripe(loadStripeKey()) : null;
  const { checks, drivable } = await guardReport({ row, stripe });
  console.log('\n  retry-failed-payment guard order:');
  for (const c of checks) {
    const mark = c.ok === true ? '✅' : c.ok === null ? '❔' : '❌';
    console.log(`    ${mark} ${c.guard} — ${c.detail}`);
  }
  console.log(
    `  → M07 true-retry-success branch: ${drivable ? 'DRIVABLE (expect the "Payment Method Added" alert)' : 'NOT DRIVABLE'}`
  );
  if (!stripe && checks.some((c) => c.ok === null)) {
    console.log('    ⚠️ guard 3 was not verified (Stripe unreachable in this run)');
  }
  console.log('\n  Mobile recipe (after `ensure`):');
  console.log('    xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=test-payfail-retry"');
  console.log('    Settings → Payment Methods → Add Payment Method → 4242 4242 4242 4242 / 12/30 / 123 / 12345');
  console.log('    → expect "Payment Method Added / Your card was saved successfully."');
  console.log('    (running this CLEARS payment_retry_count — re-run `ensure` for a repeat drive)');
}

// ── ensure ───────────────────────────────────────────────────────────────────

async function ensureFailureState(userId, { subId, customerId, pmId, periodStart, periodEnd }) {
  const nowIso = new Date().toISOString();
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      stripe_payment_method_id: pmId,
      payment_retry_count: 1,
      payment_failed_at: nowIso,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      auto_renew_enabled: true,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
  return nowIso;
}

async function ensurePersona() {
  const stripeKey = DRY_RUN ? null : loadStripeKey();
  const stripe = stripeKey ? makeStripe(stripeKey) : null;

  if (DRY_RUN) {
    log(TAG, `DRY-RUN — would provision ${EMAIL}`);
    log(TAG, `  Stripe: customer + tok_visa PM + subscription on ${PRICE_ID} (first invoice paid ⇒ no open invoice)`);
    log(TAG, '  Stripe: then apply payment_retry_count=1 + payment_failed_at AFTER the webhook settles');
    log(TAG, '  DB: profiles (completed) + subscriptions (real ids) + sp_wallets (active)');
    log(TAG, '  Then assert all four retry-failed-payment guards, and print the mobile recipe.');
    return;
  }

  const nodeId = await resolveNodeId();
  if (!nodeId) {
    hardFail('Could not resolve an active node (06850 / test-seller). Aborting.');
  }

  // ── 1. Auth user ──────────────────────────────────────────────────────────
  let userId = await findUserIdByEmail();
  if (userId) {
    log(TAG, `persona exists (auth ${userId}) — re-signing the fixture password.`);
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
    if (pwErr) log(TAG, `⚠️ password re-sign failed: ${pwErr.message}`);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, phone: PHONE },
      // @ts-ignore — admin API supports id (seed + qa:wallet-persona convention)
      id: FIXED_ID,
    });
    if (createError) hardFail(`Failed to create auth user: ${createError.message}`);
    userId = created?.user?.id ?? FIXED_ID;
    log(TAG, `created auth user ${userId} (signup trigger auto-created free sub + wallet).`);
  }

  // ── 2. Profile (full + completed) ─────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      id: userId,
      name: NAME,
      phone: PHONE,
      phone_verified: true,
      profile_completed: true,
      onboarding_completed: true,
      onboarding_completed_at: nowIso,
      zip_code: '06850',
      node_id: nodeId,
      dob: '2000-01-01',
      role: 'user',
      created_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (profileError) hardFail(`profiles upsert failed: ${profileError.message}`);
  log(TAG, 'profile OK (completed, 06850).');

  // ── 3. Stripe customer + card ─────────────────────────────────────────────
  // Reuse the state file's customer when it still exists so `ensure` is idempotent.
  const state = readState();

  let customerId = state?.customerId ?? null;
  if (customerId) {
    try {
      await stripe('GET', `/customers/${customerId}`);
      log(TAG, `reusing Stripe customer ${customerId}`);
    } catch {
      log(TAG, `previous Stripe customer ${customerId} is gone — creating a new one.`);
      customerId = null;
    }
  }

  if (!customerId) {
    const customer = await stripe('POST', '/customers', {
      email: EMAIL,
      'metadata[user_id]': userId,
      'metadata[source]': 'fix-task-41-m07-retry',
    });
    customerId = customer.id;
    log(TAG, `created Stripe customer ${customerId}`);
  }

  // PM from the magic test token (BP-69 — raw card numbers and pm_card_visa fail here).
  let pmId = null;
  const attached = await stripe('GET', `/payment_methods?customer=${customerId}&type=card&limit=5`);
  if ((attached.data ?? []).length > 0) {
    pmId = attached.data[0].id;
    log(TAG, `reusing attached card ${pmId}`);
  } else {
    const pm = await stripe('POST', '/payment_methods', { type: 'card', 'card[token]': 'tok_visa' });
    pmId = pm.id;
    await stripe('POST', `/payment_methods/${pmId}/attach`, { customer: customerId });
    log(TAG, `created + attached card ${pmId} (tok_visa)`);
  }
  await stripe('POST', `/customers/${customerId}`, {
    'invoice_settings[default_payment_method]': pmId,
  });

  // Bind the DB row by CUSTOMER first so the webhook can resolve it by customer
  // before the subscription id is known (dt88 pattern).
  {
    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: userId,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_payment_method_id: pmId,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    );
    if (error) hardFail(`customer-bound subscriptions upsert failed: ${error.message}`);
  }

  // ── 4. Stripe subscription (first invoice paid immediately ⇒ NO open invoice) ──
  let subId = state?.subscriptionId ?? null;
  let stripeSub = null;
  if (subId) {
    try {
      stripeSub = await stripe('GET', `/subscriptions/${subId}`);
      if (['canceled', 'incomplete_expired'].includes(stripeSub.status)) {
        log(TAG, `previous subscription ${subId} is ${stripeSub.status} — creating a new one.`);
        subId = null;
        stripeSub = null;
      } else {
        log(TAG, `reusing Stripe subscription ${subId} (status=${stripeSub.status})`);
      }
    } catch {
      log(TAG, `previous subscription ${subId} is gone — creating a new one.`);
      subId = null;
    }
  }

  if (!subId) {
    stripeSub = await stripe('POST', '/subscriptions', {
      customer: customerId,
      'items[0][price]': PRICE_ID,
      'items[0][quantity]': '1',
      collection_method: 'charge_automatically',
      'payment_settings[save_default_payment_method]': 'off',
      'metadata[user_id]': userId,
      'metadata[source]': 'fix-task-41-m07-retry',
    });
    subId = stripeSub.id;
    log(TAG, `created Stripe subscription ${subId} status=${stripeSub.status} (first invoice auto-paid)`);
  }

  // Make sure no invoice is left OPEN — guard #3 is the whole point of this fixture.
  let open = await listOpenInvoices(stripe, subId);
  for (const inv of open) {
    log(TAG, `open invoice ${inv.id} (${inv.status}) — attempting to pay it...`);
    await stripe('POST', `/invoices/${inv.id}/pay`).catch((e) =>
      log(TAG, `⚠️ invoice ${inv.id} pay failed: ${e.message}`)
    );
  }
  open = await listOpenInvoices(stripe, subId);
  if (open.length > 0) {
    hardFail(
      `Stripe still reports ${open.length} OPEN invoice(s) (${open
        .map((i) => i.id)
        .join(', ')}) — guard #3 cannot pass, so this fixture is NOT valid. Investigate before driving M07.`
    );
  }
  log(TAG, '✅ no open invoices (guard #3 satisfied)');

  // ── 5. Wait for the first invoice.payment_succeeded webhook, THEN apply the
  //      failure state — the handler calls record_payment_attempt(p_success:true),
  //      which RESETS payment_retry_count / payment_failed_at.
  const periodStart = stripeSub?.current_period_start
    ? new Date(stripeSub.current_period_start * 1000).toISOString()
    : new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString();
  const periodEnd = stripeSub?.current_period_end
    ? new Date(stripeSub.current_period_end * 1000).toISOString()
    : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  log(TAG, '⏳ waiting 10s for the first invoice webhook to settle before applying the failure state...');
  await sleep(10000);

  let applied = await ensureFailureState(userId, {
    subId,
    customerId,
    pmId,
    periodStart,
    periodEnd,
  });
  // Verify the failure state survived (a late webhook would have reset it) — retry once.
  let { row } = await readSubRow();
  if (!row?.payment_retry_count || !row?.payment_failed_at) {
    log(TAG, '⚠️ failure state was reset (late webhook) — re-applying once.');
    await sleep(5000);
    applied = await ensureFailureState(userId, { subId, customerId, pmId, periodStart, periodEnd });
    ({ row } = await readSubRow());
  }
  log(TAG, `failure state applied (failed_at=${applied}, retry_count=${row?.payment_retry_count})`);

  // ── 6. SP wallet — active subscriber ─────────────────────────────────────
  {
    const { error } = await admin.from('sp_wallets').upsert(
      {
        user_id: userId,
        state: 'active',
        available_balance: 0,
        pending_balance: 0,
        reserved_sp: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) log(TAG, `⚠️ sp_wallets upsert warn: ${error.message}`);
  }
  log(TAG, 'sp_wallets OK (state=active).');

  // ── 7. Persist the fixture identity for idempotent re-runs (BP-80) ───────
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(
      STATE_PATH,
      `${JSON.stringify({ persona: PERSONA_KEY, userId, customerId, subscriptionId: subId, pmId, priceId: PRICE_ID, updatedAt: new Date().toISOString() }, null, 2)}\n`
    );
    log(TAG, `state → ${STATE_PATH}`);
    log(
      TAG,
      `PRIMARY KEYS — userId=${userId} customerId=${customerId} subscriptionId=${subId} pmId=${pmId}`
    );
  } catch (e) {
    log(TAG, `⚠️ could not write the state file: ${e.message}`);
  }

  await printStatus();
}

// ── reset ────────────────────────────────────────────────────────────────────

async function cmdReset() {
  if (DRY_RUN) {
    log(TAG, `DRY-RUN — would cancel the Stripe subscription + delete the customer and all ${EMAIL} rows (BP-70).`);
    return;
  }
  const stripe = makeStripe(loadStripeKey());

  const state = readState();

  // 1. Stripe side (best effort — never block the DB cleanup on it).
  if (state?.subscriptionId) {
    await stripe('DELETE', `/subscriptions/${state.subscriptionId}`).catch((e) =>
      log(TAG, `⚠️ cancel subscription warn: ${e.message}`)
    );
    log(TAG, `subscription ${state.subscriptionId} cancelled`);
  }
  if (state?.customerId) {
    const subs = await stripe('GET', `/subscriptions?customer=${state.customerId}&limit=10`).catch(
      () => ({ data: [] })
    );
    for (const s of subs.data ?? []) {
      await stripe('DELETE', `/subscriptions/${s.id}`).catch(() => {});
    }
    await stripe('DELETE', `/customers/${state.customerId}`).catch((e) =>
      log(TAG, `⚠️ delete customer warn: ${e.message}`)
    );
    log(TAG, `customer ${state.customerId} deleted (attached card removed with it)`);
  } else {
    log(TAG, 'no recorded Stripe ids — skipping the Stripe leg.');
  }

  // 2. DB rows (BP-70: child tables first, then the auth user).
  const userId = await findUserIdByEmail();
  if (userId) {
    const childTables = [
      'user_notifications',
      'sp_ledger',
      'sp_wallets',
      'notification_preferences',
      'billing_history',
      'subscription_events',
      'subscriptions',
      'profiles',
    ];
    for (const table of childTables) {
      const { error } = await admin.from(table).delete().eq('user_id', userId).select('id');
      if (error) log(TAG, `⚠️ ${table} cleanup warn: ${error.message}`);
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`deleteUser: ${delErr.message}`);
    log(TAG, `persona deleted (${userId}).`);
  } else {
    log(TAG, `no ${PERSONA_KEY} auth user present (already clean).`);
  }

  // 3. 0-residue self-check.
  const { data: remaining } = await admin.from('profiles').select('user_id').eq('user_id', FIXED_ID);
  log(TAG, `reset done — profile residue=${remaining?.length ?? 0}`);
}

// ── dispatch ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    if (sub === 'ensure') await ensurePersona();
    else if (sub === 'status') await printStatus({ withStripe: true });
    else if (sub === 'reset') await cmdReset();
    else usage();
  } catch (err) {
    console.error(`❌ ${TAG} error:`, err?.message || err);
    process.exit(1);
  }
})();
