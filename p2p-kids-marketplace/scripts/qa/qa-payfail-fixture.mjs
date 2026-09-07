/**
 * 2026-09-07 — standing TEST-PAYFAIL persona fixture (`test-payfail`) for
 * ACC-TC-G02's payment-failure dashboard banner (PaymentFailureBanner).
 *
 * WHY THIS EXISTS: no persona on staging has a `subscriptions.payment_retry_count
 * >= 1`, so UserDashboardScreen's PaymentFailureBanner (an independent top
 * banner, ACC-TC-G02) could never be visually confirmed on-device. The ACC
 * guide's Accounts table names no payment-failure actor; the legacy bash
 * scripts (scripts/simulate-payment-failure*.js) target an unregistered
 * `test-payment-failure@example.com`. This is the deliberate, first-class
 * standing fixture.
 *
 * What drives the banner (mobile source of truth): UserDashboardScreen renders
 * <PaymentFailureBanner subscription={subscriptionSummary}/>; the summary comes
 * from the get_subscription_status RPC, which returns payment_retry_count but
 * NOT payment_failed_at — so usePaymentFailure's `isRecentFailure` falls back
 * to true whenever payment_retry_count > 0. => the banner renders whenever
 * `subscriptions.payment_retry_count >= 1` (status-independent). Message tiers
 * by retry count: 1 = "Retry 1 of 3", 2 = "Retry 2 of 3", >=3 = "at risk"
 * (or "paused" when status=grace). We keep status='active' (a realistic
 * mid-failure renewal) + a future current_period_end + auto_renew true, and
 * ALSO set payment_failed_at = NOW() so screens that read the table row
 * directly (SubscriptionStatusScreen) are realistic too.
 *
 * Subcommands (all service-role, STAGING — dev-team run with Samer's approval;
 * two-phase provisioning: this file is Phase 1 code; executing it is Phase 2):
 *
 *   ensure [--retry-count 1] [--dry-run]
 *       → create-or-reconcile the standing persona `test-payfail` to
 *         status='active' with payment_retry_count = N (default 1 → the
 *         medium "Retry 1 of 3" banner), payment_failed_at = now, and a
 *         future billing period. Re-running ensure is idempotent and
 *         re-applies the requested retry count. Full completed profile so
 *         qa-login-as lands on Home; SP wallet left active.
 *
 *   status [--dry-run]
 *       → read-only: show the persona's subscription payment-failure state and
 *         which PaymentFailureBanner tier it will render.
 *
 *   reset [--dry-run]
 *       → delete ALL test-payfail persona rows (BP-70 order: child tables
 *         first, then the auth user). 0-residue self-check.
 *
 * Env: .env/.env.staging (service role). Persona ids mirror r41-common.mjs
 * PERSONAS + qaPersonas.ts. No Stripe key needed.
 */
import { getClients, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');

const PERSONA_KEY = 'test-payfail';
const EMAIL = 'test-payfail@kidsmarketplace.test';
const PASSWORD = 'TestPayfail123!';
const FIXED_ID = 'a1234567-0000-0000-0000-000000000016';
const NAME = 'Test Payment Failure User';

/** PaymentFailureBanner urgency tier a retry count renders (usePaymentFailure). */
function bannerLabel(retryCount) {
  if (retryCount >= 3) return `at-risk (>=3 — "Your subscription is at risk" / paused copy if grace)`;
  if (retryCount === 2) return `high (retry 2 of 3 — "We couldn't charge your card again…")`;
  return `medium (retry 1 of 3 — "Retry 1 of 3 • next retry in 3 days")`;
}

function usage() {
  console.log(`qa:payfail — standing test-payfail persona fixture (ACC-TC-G02 PaymentFailureBanner)

  ensure [--retry-count 1] [--dry-run]
      → status='active' + payment_retry_count = N (default 1 → medium banner;
        pass 2 or 3 for the higher-urgency tiers) + payment_failed_at = now +
        future billing period. Idempotent.
  status [--dry-run]
      → read-only print of the persona's payment-failure state + banner tier.
  reset [--dry-run]
      → BP-70 delete of all test-payfail rows + the auth user (clean revert).
`);
}

function parseRetryCount() {
  const raw = argValue('retry-count');
  const n = raw == null ? 1 : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 3) {
    console.error(`❌ --retry-count must be an integer in 1..3 (got '${raw}')`);
    process.exit(2);
  }
  return n;
}

/**
 * Active node for the persona (mirrors r41-trial-fixture.resolveNodeId).
 */
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

async function findUserIdByEmail() {
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return (list?.users ?? []).find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())?.id ?? null;
}

async function ensurePersona(retryCount) {
  if (DRY_RUN) {
    log(PERSONA_KEY, `DRY-RUN — would provision ${EMAIL} as status='active', payment_retry_count=${retryCount} → ${bannerLabel(retryCount)}`);
    return;
  }
  const nodeId = await resolveNodeId();
  if (!nodeId) {
    console.error('❌ Could not resolve an active node (06850 / test-seller). Aborting.');
    process.exit(2);
  }

  // 1. Auth user (fixed id; re-sign password if the email already exists so the
  //    qa-login-as credentials are always known-good).
  let userId = await findUserIdByEmail();
  if (userId) {
    log(PERSONA_KEY, `persona exists (auth ${userId}) — re-signing fixture password + re-applying payment-failure state.`);
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
    if (pwErr) log(PERSONA_KEY, `⚠️ password re-sign failed: ${pwErr.message}`);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, phone: '5550101016' },
      // @ts-ignore — admin API supports id (seed + qa:wallet-persona convention)
      id: FIXED_ID,
    });
    if (createError) {
      console.error(`❌ Failed to create auth user: ${createError.message}`);
      process.exit(1);
    }
    userId = created?.user?.id ?? FIXED_ID;
    log(PERSONA_KEY, `created auth user ${userId} (signup trigger auto-created free sub + wallet — reconciling next).`);
  }

  const nowIso = new Date().toISOString();
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const periodStartIso = new Date(now - 23 * dayMs).toISOString();
  const periodEndIso = new Date(now + 5 * dayMs).toISOString(); // ~5 days left in the billing period

  // 2. Profile — full + completed (mirrors r41-trial ensure).
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      id: userId,
      name: NAME,
      phone: '5550101016',
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
  if (profileError) {
    console.error(`❌ profiles upsert failed: ${profileError.message}`);
    process.exit(1);
  }
  log(PERSONA_KEY, 'profile OK (completed, Norwalk Central 06850).');

  // 3. Subscription — status='active' with a live payment-failure state. The
  //    signup trigger's auto-created 'free' row is replaced via onConflict.
  //    payment_retry_count CHECK is 0..3; status CHECK has no 'past_due', so a
  //    realistic mid-failure renewal stays status='active'.
  const { error: subError } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      payment_retry_count: retryCount,
      payment_failed_at: nowIso,
      current_period_start: periodStartIso,
      current_period_end: periodEndIso,
      auto_renew_enabled: true,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (subError) {
    console.error(`❌ subscriptions upsert failed: ${subError.message}`);
    process.exit(1);
  }
  log(PERSONA_KEY, `subscription OK (status='active', payment_retry_count=${retryCount}, payment_failed_at=${nowIso}) → ${bannerLabel(retryCount)}.`);

  // 4. SP wallet — active subscriber, so leave the wallet live.
  const { error: walletError } = await admin.from('sp_wallets').upsert(
    {
      user_id: userId,
      state: 'active',
      available_balance: 0,
      pending_balance: 0,
      reserved_sp: 0,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (walletError) {
    console.error(`❌ sp_wallets upsert failed: ${walletError.message}`);
    process.exit(1);
  }
  log(PERSONA_KEY, 'sp_wallets OK (state=active).');

  await printStatus(userId);
}

async function printStatus(userId) {
  if (!userId) {
    console.error(`❌ ${EMAIL} not provisioned yet — run: npm run qa:payfail -- ensure`);
    process.exit(1);
  }
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('status, payment_retry_count, payment_failed_at, current_period_end, auto_renew_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  console.log(`\ntest-payfail persona (${EMAIL} / ${PASSWORD}) — auth user id ${userId}`);
  if (!subRow) {
    console.log('  subscription: MISSING (run `ensure` first)');
    return;
  }
  const retries = subRow.payment_retry_count ?? 0;
  const banner = retries >= 1 ? bannerLabel(retries) : '(retry_count 0 — no PaymentFailureBanner)';
  console.log(`  subscription.status=${subRow.status} payment_retry_count=${retries} payment_failed_at=${subRow.payment_failed_at ?? '—'}`);
  console.log(`  current_period_end=${subRow.current_period_end ?? '—'} auto_renew_enabled=${subRow.auto_renew_enabled ?? '—'}`);
  console.log(`  → PaymentFailureBanner renders: ${banner}`);
  console.log('  Mobile:');
  console.log('    xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=test-payfail"');
  console.log('    (then open the Home/Dashboard tab)');
}

async function cmdEnsure() {
  const retries = parseRetryCount();
  await ensurePersona(retries);
}

async function cmdStatus() {
  const userId = await findUserIdByEmail();
  await printStatus(userId);
}

async function cmdReset() {
  if (DRY_RUN) {
    log(PERSONA_KEY, 'DRY-RUN — would delete test-payfail persona rows (BP-70) + the auth user');
    return;
  }
  // 1. Persona (re)locate by email (may or may not exist yet).
  const userId = await findUserIdByEmail();
  if (userId) {
    // BP-70: delete child rows by user_id first, then the auth user.
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
      if (error) console.warn(`[${PERSONA_KEY}] ${table} cleanup warn: ${error.message}`);
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`deleteUser: ${delErr.message}`);
    log(PERSONA_KEY, `persona deleted (${userId}).`);
  } else {
    log(PERSONA_KEY, 'No test-payfail auth user present (already clean).');
  }
  // 2. 0-residue self-check.
  const { data: remaining } = await admin.from('profiles').select('user_id').eq('user_id', FIXED_ID);
  log(PERSONA_KEY, `reset done — profile residue=${remaining?.length ?? 0}`);
}

(async () => {
  try {
    if (sub === 'ensure') await cmdEnsure();
    else if (sub === 'status') await cmdStatus();
    else if (sub === 'reset') await cmdReset();
    else usage();
  } catch (err) {
    console.error(`❌ qa:payfail error:`, err?.message || err);
    process.exit(1);
  }
})();
