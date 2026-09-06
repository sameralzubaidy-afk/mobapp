#!/usr/bin/env node
/**
 * DEV-TASK-126 (item 8) — Server-side Stripe Express TEST-mode completion
 * fixture (2026-09-06).
 *
 * QA/test-infrastructure ONLY. Eliminates the hosted-browser onboarding drive
 * (the dominant remaining cost in QA Task 37/38 G01-class rounds) by completing
 * a Stripe Express TEST account's verification requirements through the Stripe
 * API directly:
 *
 *   - controller[requirement_collection]=application  → the PLATFORM collects
 *     requirements (a Custom-type controlled account), which is the one thing
 *     that lets the platform accept TOS server-side. Confirmed against the
 *     Stripe API docs (accounts/create): `tos_acceptance` "can only be updated
 *     for accounts where controller.requirement_collection is application" —
 *     the default Express (controller=stripe) forbids platform TOS acceptance,
 *     which is exactly why hosted onboarding exists. ⇒ The hosted browser step
 *     is FULLY eliminated for TEST-mode completion (no remaining hosted step).
 *   - SSN `0000` (canonical test value — the 8888 prefill is rejected at the
 *     name precheck).
 *   - Phone set explicitly at create (no hosted "re-touch" needed).
 *   - Test-mode bank-account token (external_account) + MCC + individual email.
 *   - tos_acceptance { date, ip, user_agent } passed server-side.
 *
 * Guardrail (hard): the whole application-collected controller model is a
 * TEST-only QA construction with different LIVE-mode pricing/TOS obligations —
 * this fixture REFUSES to run unless the Stripe key is an `sk_test_...` key.
 *
 * Persona: defaults to the DT-118 disposable payout persona
 * (qa-payout-seller@kidsmarketplace.test / TestPayout123! /
 * a1234567-0000-0000-0000-0000000000f2) — the same persona qa:payout-fixture
 * and the DT-124 verify script own. Override with --persona <short|email|uuid>.
 *
 * Subcommands (service-role + Stripe test key from ~/.dt11-stripe-key;
 * --dry-run is fully read-only):
 *   create [--persona ...] [--replace] [--dry-run]
 *       → REAL Stripe Express TEST account completed 100% server-side
 *         (details_submitted + payouts_enabled + currently_due=[]) and a
 *         verified PRIMARY seller_payout_methods row pointing at it. Leaves the
 *         verified account/method in place for a QA on-device session
 *         (G01-class: "already onboarded" method card + real withdrawal).
 *         Idempotent — a persona that already has a verified REAL account is a
 *         no-op unless --replace. Fake/DB-only method rows (acct_dt118_*) are
 *         always replaced.
 *
 *       TEST-MODE capability note (LIVE-VERIFIED 2026-09-06): the proven shape
 *       (DT-124) is `transfers` ONLY — the transfers capability goes ACTIVE and
 *       the account reaches details_submitted=true + payouts_enabled=true +
 *       charges_enabled=true + currently_due=[]. DO NOT request
 *       `card_payments` alongside transfers: it strands TEST mode in
 *       disabled_reason=requirements.pending_verification (payouts_enabled
 *       false) — verified live on the first verify run.
 *   withdraw-test --amount <cents> [--persona ...] [--keep-balance] [--dry-run]
 *       → Proves a REAL test withdrawal fires against the created account:
 *         funds a controlled balance, drives request_seller_payout (persona
 *         JWT), polls the dispatch → REAL Stripe transfer, confirms it on
 *         Stripe. Default restores the persona balance to 0 + deletes the
 *         manual payout row (account/method KEPT for QA).
 *   verify [--dry-run]
 *       → THE one-command live-verification arc: create → withdraw-test →
 *         reset. Proves a fresh account reaches payouts_enabled + currently_due
 *         =[] with NO hosted browser, and a real withdrawal fires against it.
 *         Leaves the persona at its 0-method / 0-balance baseline.
 *   status [--persona ...]
 *       → read-only: persona method rows + live Stripe account state.
 *   reset [--persona ...] [--dry-run]
 *       → full cleanup back to baseline: Stripe account DELETE + method rows +
 *         manual payout rows + balance recomputed to real (persona auth user
 *         is kept — standing persona).
 *
 * Env: p2p-kids-marketplace/.env/.env.staging (SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY + ANON). Stripe test key: ~/.dt11-stripe-key
 * (never echoed). Run (from p2p-kids-marketplace):
 *   npm run qa:express-complete -- verify
 */
import { createClient } from '@supabase/supabase-js';
import {
  getClients,
  getStripeKey,
  resolveUserId,
  PERSONAS,
  argValue,
  hasFlag,
  log,
  exchangeJwt,
  sleep,
} from './lib/r41-common.mjs';

const { url, anon, admin } = getClients();
const stripeKey = getStripeKey();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');
const KEEP_BALANCE = hasFlag('--keep-balance');
const REPLACE = hasFlag('--replace');

// ---------------------------------------------------------------------------
// Persona resolution
// ---------------------------------------------------------------------------
// Default = DT-118 disposable payout persona (mirrors payout-fixture constants).
const DEFAULT_PERSONA = {
  key: 'qa-payout-seller',
  email: 'qa-payout-seller@kidsmarketplace.test',
  password: 'TestPayout123!',
  id: 'a1234567-0000-0000-0000-0000000000f2',
  name: 'QA Payout Seller',
};

const FAKE_ACCT_PREFIXES = ['acct_dt118_', 'acct_dt124_', 'acct_fixture_'];

function isRealAcct(acctId) {
  return (
    Boolean(acctId) &&
    acctId.startsWith('acct_') &&
    !FAKE_ACCT_PREFIXES.some((p) => acctId.startsWith(p))
  );
}

function personaRef() {
  return argValue('persona') || DEFAULT_PERSONA.key;
}

/** Resolve a --persona reference to { ref, id, email, password?, name? }. */
async function resolvePersona(ref) {
  if (ref === DEFAULT_PERSONA.key) return { ...DEFAULT_PERSONA, ref };
  const known = PERSONAS[ref];
  if (known) return { ref, id: known.id, email: known.email, password: known.password, name: ref };
  if (ref.includes('@')) {
    const id = await resolveUserId(admin, ref);
    return { ref, id, email: ref, password: null, name: null };
  }
  // Raw uuid — try to enrich with the auth email for the Stripe account.
  try {
    const { data } = await admin.auth.admin.getUserById(ref);
    return {
      ref,
      id: ref,
      email: data?.user?.email ?? null,
      password: null,
      name: data?.user?.user_metadata?.name ?? null,
    };
  } catch {
    return { ref, id: ref, email: null, password: null, name: null };
  }
}

// ---------------------------------------------------------------------------
// Stripe helpers (mirrors DT-124 verify / start-state)
// ---------------------------------------------------------------------------
async function stripeCall(method, path, form) {
  let target = `https://api.stripe.com/v1${path}`;
  const isGet = method === 'GET';
  if (isGet && form) target += '?' + new URLSearchParams(form).toString();
  const res = await fetch(target, {
    method,
    headers: { Authorization: `Bearer ${stripeKey}` },
    body: !isGet && form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      `Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`
    );
  return json;
}

function requireTestKey() {
  if (!stripeKey.startsWith('sk_test_')) {
    console.error('❌ REFUSING TO RUN: Stripe key is not a test key (sk_test_...).');
    console.error(
      '   The application-collected controller model is a TEST-only QA construction with'
    );
    console.error(
      '   different LIVE-mode pricing + TOS obligations. This fixture is TEST-mode only.'
    );
    process.exit(2);
  }
}

function acctState(acct) {
  return {
    details_submitted: acct.details_submitted,
    payouts_enabled: acct.payouts_enabled,
    charges_enabled: acct.charges_enabled,
    currently_due: acct.requirements?.currently_due ?? [],
    eventually_due: acct.requirements?.eventually_due ?? [],
    disabled_reason: acct.requirements?.disabled_reason ?? null,
    capabilities: acct.capabilities ?? {},
  };
}

function fmtAcct(s) {
  return `submitted=${s.details_submitted} payouts=${s.payouts_enabled} charges=${s.charges_enabled} due=${JSON.stringify(s.currently_due)} disabled=${s.disabled_reason ?? 'none'}`;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
async function personaMethods(userId) {
  const { data, error } = await admin
    .from('seller_payout_methods')
    .select(
      'id, method_type, is_primary, is_verified, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled, stripe_charges_enabled'
    )
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });
  if (error) throw new Error(`seller_payout_methods read: ${error.message}`);
  return data ?? [];
}

async function deleteStripeAccounts(userId, quiet = false) {
  const methods = await personaMethods(userId);
  let deleted = 0;
  for (const m of methods) {
    if (m.method_type !== 'stripe_connect' || !isRealAcct(m.stripe_account_id)) continue;
    await stripeCall('DELETE', `/accounts/${m.stripe_account_id}`).catch((e) => {
      if (!quiet)
        log(
          'express-complete',
          `⚠️ Stripe account delete ${m.stripe_account_id} failed: ${e.message}`
        );
    });
    deleted += 1;
    if (!quiet) log('express-complete', `🗑️  Deleted Stripe account ${m.stripe_account_id}`);
  }
  return deleted;
}

/** Restore balance to its real value via the service_role-locked recompute RPC (BP-84). */
async function reconcileBalance(userId) {
  const { data, error } = await admin.rpc('recompute_seller_balance', { p_user_id: userId });
  if (error) {
    log(
      'express-complete',
      `⚠️ recompute_seller_balance failed (${error.message}) — zeroing directly instead.`
    );
    const { error: uErr } = await admin.from('seller_balance').upsert(
      {
        user_id: userId,
        available_balance_cents: 0,
        pending_balance_cents: 0,
        lifetime_earnings_cents: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (uErr) log('express-complete', `⚠️ balance zero fallback also failed: ${uErr.message}`);
    return;
  }
  log('express-complete', `✅ balance recomputed: ${JSON.stringify(data)}`);
}

// ---------------------------------------------------------------------------
// create — REAL account, completed 100% server-side
// ---------------------------------------------------------------------------
async function cmdCreate() {
  const ref = personaRef();
  const persona = await resolvePersona(ref);
  requireTestKey();
  if (!persona.email) {
    // fetch email from auth user if missing
    const { data } = await admin.auth.admin.getUserById(persona.id).catch(() => ({ data: null }));
    persona.email = data?.user?.email ?? `user-${persona.id}@kids-marketplace.local`;
  }
  const email = persona.email;
  log('express-complete', `create: persona '${ref}' (${persona.id}) email ${email}`);

  // 0. Existing-method survey (idempotency + no-clobber safety).
  const methods = await personaMethods(persona.id);
  const sc = methods.find((m) => m.method_type === 'stripe_connect');
  if (sc && isRealAcct(sc.stripe_account_id)) {
    const live = acctState(await stripeCall('GET', `/accounts/${sc.stripe_account_id}`));
    const verified =
      live.details_submitted && live.payouts_enabled && live.currently_due.length === 0;
    if (verified && !REPLACE) {
      log(
        'express-complete',
        `✅ Persona already has a VERIFIED real account ${sc.stripe_account_id} — no-op (pass --replace to recreate).`
      );
      console.log(`   ${fmtAcct(live)}`);
      return;
    }
    if (!verified && !REPLACE) {
      console.error(
        `❌ Persona has a real but UNVERIFIED account ${sc.stripe_account_id}: ${fmtAcct(live)}`
      );
      console.error(
        `   Pass --replace to delete it and create a fresh one (this deletes the old Stripe account).`
      );
      process.exit(2);
    }
    if (REPLACE) {
      log('express-complete', `--replace: deleting existing account ${sc.stripe_account_id}`);
      if (!DRY_RUN) await stripeCall('DELETE', `/accounts/${sc.stripe_account_id}`);
    }
  }

  if (DRY_RUN) {
    log(
      'express-complete',
      `DRY-RUN — would create a REAL server-side-completed Stripe Express TEST account for ${email} and insert a verified primary method row.`
    );
    return;
  }

  // 1. Create the application-collected account (platform collects requirements
  //    ⇒ platform can accept TOS server-side). Legal identity mirrors the app
  //    EF's DT-121 TEST prefill (Test/User, DOB 1990-01-01). SSN 0000 canonical.
  const nowSec = Math.floor(Date.now() / 1000);
  const createForm = {
    country: 'US',
    email,
    'controller[requirement_collection]': 'application',
    'controller[losses][payments]': 'application',
    'controller[fees][payer]': 'application',
    'controller[stripe_dashboard][type]': 'none',
    // transfers ONLY (LIVE-VERIFIED 2026-09-06): requesting card_payments too
    // puts TEST mode into pending_verification → payouts_enabled=false. The
    // proven DT-124 shape is transfers-only → transfers ACTIVE + payouts_enabled.
    'capabilities[transfers][requested]': 'true',
    business_type: 'individual',
    'individual[first_name]': 'Test',
    'individual[last_name]': 'User',
    'individual[dob][day]': '1',
    'individual[dob][month]': '1',
    'individual[dob][year]': '1990',
    'individual[ssn_last_4]': '0000',
    'individual[phone]': '+15555550100',
    'individual[address][line1]': '123 Test St',
    'individual[address][city]': 'San Francisco',
    'individual[address][state]': 'CA',
    'individual[address][postal_code]': '94103',
    'individual[address][country]': 'US',
    'business_profile[url]': 'https://kidsmarketplace.test',
    'business_profile[product_description]': 'Kids marketplace seller payout verification',
    'tos_acceptance[date]': String(nowSec),
    'tos_acceptance[ip]': '8.8.8.8',
    'tos_acceptance[user_agent]': 'express-complete-fixture/1.0',
    'metadata[fixture]': 'express-complete',
    'metadata[persona]': persona.ref,
    'metadata[user_id]': persona.id,
  };
  const created = await stripeCall('POST', '/accounts', createForm);
  const accountId = created.id;
  log('express-complete', `✅ Connect account created (application-collected): ${accountId}`);

  try {
    // 2. Complete the remaining requirements: test-mode bank token (external
    //    account) + MCC + individual email + business website.
    const bankToken = await stripeCall('POST', '/tokens', {
      'bank_account[country]': 'US',
      'bank_account[currency]': 'usd',
      'bank_account[routing_number]': '110000000',
      'bank_account[account_number]': '000123456789',
      'bank_account[account_holder_name]': 'Test User',
      'bank_account[account_holder_type]': 'individual',
    });
    await stripeCall('POST', `/accounts/${accountId}`, {
      external_account: bankToken.id,
      'business_profile[mcc]': '5399',
      'individual[email]': email,
    });

    // 3. Read back — poll briefly for requirements to settle.
    let live = null;
    for (let i = 0; i < 12; i++) {
      live = acctState(await stripeCall('GET', `/accounts/${accountId}`));
      const done = live.payouts_enabled && live.currently_due.length === 0;
      if (done || i === 11) break;
      await sleep(1000);
    }
    log('express-complete', `after completion: ${fmtAcct(live)}`);
    const transfersActive = live.capabilities?.transfers === 'active';
    if (
      !live.details_submitted ||
      !live.payouts_enabled ||
      !transfersActive ||
      live.currently_due.length > 0
    ) {
      throw new Error(
        `Account NOT fully verified — currently_due=${JSON.stringify(live.currently_due)} disabled_reason=${live.disabled_reason} capabilities=${JSON.stringify(live.capabilities)}`
      );
    }
    if (!live.charges_enabled) {
      // Safety net only — LIVE-VERIFIED the transfers-only shape yields
      // charges_enabled=true in TEST mode (2026-09-06). If it ever reads false
      // here the account is still payout-capable (transfers active + payouts
      // enabled are asserted above); the method row records the as-reported
      // value so sync-stripe-connect-status stays honest.
      log(
        'express-complete',
        `ℹ️ charges_enabled=false (unexpected for transfers-only; not payout-blocking). transfers=${live.capabilities?.transfers} payouts_enabled=${live.payouts_enabled}.`
      );
    }

    // 4. Replace any existing method rows with the verified primary row.
    if (!DRY_RUN) {
      const { error: delErr } = await admin
        .from('seller_payout_methods')
        .delete()
        .eq('user_id', persona.id);
      if (delErr) throw new Error(`method delete: ${delErr.message}`);
      const { error: insErr } = await admin.from('seller_payout_methods').insert({
        user_id: persona.id,
        method_type: 'stripe_connect',
        stripe_account_id: accountId,
        is_primary: true,
        is_verified: true,
        stripe_onboarding_complete: true,
        stripe_payouts_enabled: live.payouts_enabled,
        stripe_charges_enabled: live.charges_enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (insErr) throw new Error(`method insert: ${insErr.message}`);
    }
    log(
      'express-complete',
      `✅ verified PRIMARY method row written for ${persona.id} -> ${accountId}`
    );
    console.log(`\n✅ EXPRESS ACCOUNT SERVER-COMPLETED (no hosted browser)`);
    console.log(`   account:      ${accountId}`);
    console.log(`   email:        ${email}`);
    console.log(`   state:        ${fmtAcct(live)}`);
    console.log(`   persona id:   ${persona.id}`);
    console.log(
      `\nNext: log the persona in on-device (Payout Settings shows the verified method) or run:`
    );
    console.log(`   npm run qa:express-complete -- withdraw-test   # real test withdrawal proof`);
    console.log(`   npm run qa:express-complete -- reset           # full cleanup`);
  } catch (e) {
    // Never leave an unverified account behind (BP-71 spirit: only ship verified state).
    log('express-complete', `❌ create failed: ${e.message}`);
    await stripeCall('DELETE', `/accounts/${accountId}`).catch(() => {});
    throw e;
  }
}

// ---------------------------------------------------------------------------
// withdraw-test — REAL withdrawal proof against the created account
// ---------------------------------------------------------------------------
async function cmdWithdrawTest() {
  const ref = personaRef();
  const persona = await resolvePersona(ref);
  requireTestKey();
  if (!persona.password) {
    console.error(`❌ withdraw-test needs persona credentials to mint a user JWT.`);
    console.error(
      `   Use the default qa-payout-seller or a registry persona (--persona test-seller etc.).`
    );
    process.exit(2);
  }
  const amount = Number(argValue('amount') ?? argValue('amount-cents') ?? '500');
  if (!Number.isInteger(amount) || amount < 200) {
    console.error(
      `❌ --amount must be an integer >= 200 cents (withdrawal floor is $2.00). Got '${amount}'.`
    );
    process.exit(2);
  }

  // 0. Must have a REAL verified stripe_connect primary method (created by `create`).
  const methods = await personaMethods(persona.id);
  const primary = methods.find((m) => m.method_type === 'stripe_connect' && m.is_primary);
  if (!primary || !isRealAcct(primary.stripe_account_id)) {
    console.error(`❌ No REAL verified stripe_connect method for ${ref}.`);
    console.error(`   Run first: npm run qa:express-complete -- create [--persona ${ref}]`);
    process.exit(2);
  }
  const accountId = primary.stripe_account_id;
  const live = acctState(await stripeCall('GET', `/accounts/${accountId}`));
  log('express-complete', `withdraw-test against ${accountId}: ${fmtAcct(live)}`);
  if (!live.payouts_enabled) {
    console.error(
      `❌ Account ${accountId} is not payout-enabled — recreate it (create --replace).`
    );
    process.exit(2);
  }

  if (DRY_RUN) {
    log(
      'express-complete',
      `DRY-RUN — would fund ${amount}¢, drive request_seller_payout as ${persona.email}, and confirm a REAL Stripe transfer to ${accountId}.`
    );
    return;
  }

  // 1. Fund a controlled balance (service-role fixture write).
  const { error: fundErr } = await admin.from('seller_balance').upsert(
    {
      user_id: persona.id,
      available_balance_cents: amount,
      pending_balance_cents: 0,
      lifetime_earnings_cents: amount,
      total_trades_completed: 0,
      total_trades_pending: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (fundErr) throw new Error(`fund balance: ${fundErr.message}`);
  log('express-complete', `✅ balance funded to ${amount}¢`);

  // 2. Drive a REAL withdrawal as the persona (mirrors the app).
  const jwt = await exchangeJwt(url, anon, persona.email, persona.password);
  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: wr, error: wErr } = await userClient.rpc('request_seller_payout', {
    p_user_id: persona.id,
    p_amount_cents: amount,
  });
  if (wErr || !wr?.success) {
    throw new Error(`request_seller_payout failed: ${wErr?.message ?? JSON.stringify(wr)}`);
  }
  const payoutId = wr.payout_id;
  log(
    'express-complete',
    `✅ REAL withdrawal driven: payout_id=${payoutId} net=${wr.net_amount_cents}¢ status=${wr.status}`
  );

  // 3. Poll the seller_payouts row → AFTER INSERT trigger → dispatch-manual-payouts
  //    EF should complete it with a real Stripe transfer.
  let row = null;
  for (let i = 0; i < 30; i++) {
    const { data } = await admin
      .from('seller_payouts')
      .select('id, status, provider, provider_reference_id, net_amount_cents, failure_reason')
      .eq('id', payoutId)
      .maybeSingle();
    if (data) row = data;
    if (row && (row.status === 'completed' || row.status === 'failed')) break;
    await sleep(1000);
  }
  if (!row) throw new Error(`payout row ${payoutId} not found`);
  log(
    'express-complete',
    `payout row: status=${row.status} provider_ref=${row.provider_reference_id ?? '—'} failure=${row.failure_reason ?? 'none'}`
  );
  if (row.status !== 'completed' || !row.provider_reference_id) {
    throw new Error(`❌ payout not completed (status=${row.status}) — dispatch trigger/EF failed.`);
  }

  // 4. Confirm the REAL Stripe transfer exists (destination = our account).
  const transfers = await stripeCall('GET', '/transfers?limit=100');
  const match = transfers.data.find(
    (t) => t.destination === accountId && t.metadata?.payout_id === payoutId
  );
  if (!match) throw new Error(`❌ no Stripe transfer found for payout ${payoutId} → ${accountId}`);
  log(
    'express-complete',
    `✅ REAL Stripe transfer confirmed: ${match.id} amount=${match.amount}¢ destination=${accountId}`
  );
  if (match.amount !== row.net_amount_cents) {
    throw new Error(`❌ transfer ${match.amount}¢ != payout net ${row.net_amount_cents}¢`);
  }

  console.log(`\n✅✅ REAL TEST WITHDRAWAL DRIVEN AGAINST SERVER-COMPLETED ACCOUNT`);
  console.log(`   account:  ${accountId}`);
  console.log(`   transfer: ${match.id} (${match.amount}¢)`);
  console.log(`   payout:   ${payoutId} (${row.status})`);

  // 5. Cleanup of THIS test's residue (balance + manual payout row) unless
  //    --keep-balance. Account + method KEPT so a QA on-device session can
  //    continue using the verified method.
  if (!KEEP_BALANCE) {
    await admin.from('seller_payouts').delete().eq('user_id', persona.id).is('trade_id', null);
    await admin.from('seller_balance').upsert(
      {
        user_id: persona.id,
        available_balance_cents: 0,
        pending_balance_cents: 0,
        lifetime_earnings_cents: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    log(
      'express-complete',
      '✅ residue cleaned (balance 0, manual payout row removed). Account/method kept for QA.'
    );
  }
}

// ---------------------------------------------------------------------------
// status / reset / verify
// ---------------------------------------------------------------------------
async function cmdStatus() {
  const ref = personaRef();
  const persona = await resolvePersona(ref);
  requireTestKey();
  const methods = await personaMethods(persona.id);
  console.log(`\n=== EXPRESS-COMPLETE STATUS: ${ref} (${persona.id}) ===`);
  if (methods.length === 0) {
    console.log('  no seller_payout_methods rows — run: npm run qa:express-complete -- create');
    return;
  }
  for (const m of methods) {
    console.log(
      `  method ${m.method_type}${m.is_primary ? ' PRIMARY' : ''} verified=${m.is_verified} onboard=${m.stripe_onboarding_complete} payouts=${m.stripe_payouts_enabled} acct=${m.stripe_account_id ?? '—'}`
    );
    if (m.method_type === 'stripe_connect' && isRealAcct(m.stripe_account_id)) {
      const live = acctState(await stripeCall('GET', `/accounts/${m.stripe_account_id}`));
      console.log(`    live Stripe: ${fmtAcct(live)}`);
    }
  }
}

async function cmdReset() {
  const ref = personaRef();
  const persona = await resolvePersona(ref);
  requireTestKey();
  const methods = await personaMethods(persona.id);
  if (DRY_RUN) {
    log(
      'express-complete',
      `DRY-RUN — would delete ${methods.filter((m) => isRealAcct(m.stripe_account_id)).length} real Stripe account(s) + all method rows + manual payout rows, then recompute balance to real for ${ref}.`
    );
    return;
  }
  await deleteStripeAccounts(persona.id);
  const { error: mErr } = await admin
    .from('seller_payout_methods')
    .delete()
    .eq('user_id', persona.id);
  if (mErr) log('express-complete', `⚠️ method delete: ${mErr.message}`);
  const { error: pErr } = await admin
    .from('seller_payouts')
    .delete()
    .eq('user_id', persona.id)
    .is('trade_id', null);
  if (pErr) log('express-complete', `⚠️ manual payout delete: ${pErr.message}`);
  await reconcileBalance(persona.id);
  log('express-complete', `✅ reset complete — ${ref} back to baseline (auth user kept).`);
}

async function cmdVerify() {
  log('express-complete', '=== VERIFY ARC: create → withdraw-test → reset ===');
  try {
    await cmdCreate();
    await cmdWithdrawTest();
  } catch (e) {
    log('express-complete', `❌ verify failed: ${e.message}`);
    try {
      await cmdReset();
      log('express-complete', '🧹 cleanup ran — persona restored to baseline.');
    } catch (r) {
      log('express-complete', `⚠️ reset-after-failure also failed: ${r.message}`);
    }
    throw e;
  }
  await cmdReset();
  console.log(
    '\n✅✅✅ EXPRESS-COMPLETE LIVE VERIFY PASS — fresh account reached payouts_enabled (no hosted browser) and a real test withdrawal fired against it. Persona restored to baseline.'
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function usage() {
  console.log(`qa:express-complete — DT-126 server-side Stripe Express TEST completion fixture

  create [--persona qa-payout-seller|test-seller|<email>|<uuid>] [--replace] [--dry-run]
  withdraw-test --amount <cents> [--persona ...] [--keep-balance] [--dry-run]
  verify [--dry-run]
  status [--persona ...]
  reset [--persona ...] [--dry-run]
`);
}

async function main() {
  switch (sub) {
    case 'create':
      return cmdCreate();
    case 'withdraw-test':
      return cmdWithdrawTest();
    case 'verify':
      return cmdVerify();
    case 'status':
      return cmdStatus();
    case 'reset':
      return cmdReset();
    default:
      usage();
      process.exit(2);
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
