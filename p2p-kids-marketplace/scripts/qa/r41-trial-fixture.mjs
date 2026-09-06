/**
 * DEV-TASK-120 (2026-09-06) item 1 — standing TEST-TRIAL persona fixture
 * (`test-trial`) for ContinueKidsClub's trial-≤7d / trial->7d branches
 * (SUB-TC-N06 + the D06 trial-reminder legs; R41-class dedicated fixture).
 *
 * WHY THIS EXISTS: no persona on staging has `subscriptions.status='trial'`
 * with a `trial_end_date` within 7 days, so the ContinueKidsClubScreen trial
 * countdown branches were only source-audited (DT-119), never visually
 * confirmed on-device. The SUB guide's Accounts table has named
 * `test-trial@kidsmarketplace.test` ("Trial user — Kids Club+ Trial") but that
 * actor was never provisioned.
 *
 * The app reads the trial state straight off `subscriptions` via RLS
 * (`getTrialStatus()` selects status + trial_end_date):
 *   - status='trial' → isTrialSubscription (title "Continue Kids Club+", web CTA)
 *   - days_remaining = ceil((trial_end_date − now)/day)
 *       • 1..7  → trial-≤7d branch: warning urgency badge "N days left in trial"
 *       • >7    → trial->7d branch: NO countdown badge (plain upsell)
 *   (a trial user never sees the "{trialDays} free days • no charge today" pill —
 *    showDefaultTrialBadge = !isTrialSubscription — that is a non-trial benefit.)
 *
 * Mobile verification (QA, after `ensure`): qa-login-as the persona then open
 * the deep-link route:
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=test-trial"
 *   xcrun simctl openurl booted "p2pkidsmarketplace://continue-kids-club"
 * (ContinueKidsClub is registered in the React-Nav linking config at
 * `continue-kids-club` — see AppNavigator.tsx.)
 *
 * Subcommands (all service-role, STAGING — dev-team run with Samer's approval;
 * two-phase provisioning: this file is Phase 1 code; executing it is Phase 2):
 *
 *   ensure [--days-remaining 5] [--dry-run]
 *       → create-or-reconcile the standing persona `test-trial` to
 *         status='trial' with trial_end_date = now + N days.
 *         Default N=5 (trial-≤7d branch). Pass e.g. --days-remaining 14 to
 *         switch to the trial->7d branch. Re-running ensure is idempotent and
 *         re-applies the requested window (deterministic "clean stage").
 *         Full completed profile so qa-login-as lands on Home; SP wallet left
 *         active (trial = subscriber-shaped). No Stripe PM is required — the
 *         ContinueKidsClub render reads only status + trial_end_date.
 *
 *   status [--dry-run]
 *       → read-only: show the persona's subscription trial state and which
 *         ContinueKidsClub branch (≤7d vs >7d) it will render.
 *
 *   reset [--dry-run]
 *       → delete ALL test-trial persona rows (BP-70 order: child tables first,
 *         then the auth user). 0-residue self-check. Leaves every non-fixture
 *         row untouched.
 *
 * Env: .env/.env.staging (service role). Persona ids mirror r41-common.mjs
 * PERSONAS + qaPersonas.ts. No Stripe key needed.
 */
import { getClients, argValue, hasFlag, log } from './lib/r41-common.mjs';

const { admin } = getClients();
const sub = process.argv[2] || 'help';
const DRY_RUN = hasFlag('--dry-run');

const PERSONA_KEY = 'test-trial';
const EMAIL = 'test-trial@kidsmarketplace.test';
const PASSWORD = 'TestTrial123!';
const FIXED_ID = 'a1234567-0000-0000-0000-000000000015';
const NAME = 'Test Trial User';

// Canonical trial length (days) used to backdate trial_started_at so the row
// reads as a mid-trial membership; the rendered branch only depends on
// trial_end_date. Matches admin_config trial_days baseline (30).
const TRIAL_LENGTH_DAYS = 30;

function usage() {
  console.log(`qa:r41-trial — standing test-trial persona fixture (SUB-TC-N06 ContinueKidsClub trial branches)

  ensure [--days-remaining 5] [--dry-run]
      → status='trial' + trial_end_date = now + N days (default 5 → trial-≤7d;
        pass e.g. 14 for the trial->7d branch). Idempotent.
  status [--dry-run]
      → read-only print of the persona's trial state + the branch it renders.
  reset [--dry-run]
      → BP-70 delete of all test-trial rows + the auth user (clean revert).
`);
}

function parseDaysRemaining() {
  const raw = argValue('days-remaining');
  const n = raw == null ? 5 : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > TRIAL_LENGTH_DAYS) {
    console.error(`❌ --days-remaining must be an integer in 1..${TRIAL_LENGTH_DAYS} (got '${raw}')`);
    process.exit(2);
  }
  return n;
}

/** Which ContinueKidsClub branch a given days-remaining value renders. */
function branchLabel(daysRemaining) {
  return daysRemaining <= 7
    ? `trial-≤7d (warning urgency badge "${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in trial")`
    : `trial->7d (NO countdown badge — plain "Continue Kids Club+" upsell)`;
}

/**
 * Active node for the persona. QA renders subscription screens that don't need
 * node scoping, but a full completed profile needs a real node for the app to
 * settle on Home. Fallbacks: test-seller's node → test-buyer's node → any
 * active node (mirrors qa:wallet-persona resolveNodeId).
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

async function ensurePersona(daysRemaining) {
  if (DRY_RUN) {
    log(PERSONA_KEY, `DRY-RUN — would provision ${EMAIL} as status='trial', trial_end_date = now + ${daysRemaining}d → ${branchLabel(daysRemaining)}`);
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
    log(PERSONA_KEY, `persona exists (auth ${userId}) — re-signing fixture password + re-applying trial state.`);
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
    if (pwErr) log(PERSONA_KEY, `⚠️ password re-sign failed: ${pwErr.message}`);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, phone: '5550101015' },
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
  const trialEndIso = new Date(now + daysRemaining * dayMs).toISOString();
  const trialStartIso = new Date(now - (TRIAL_LENGTH_DAYS - daysRemaining) * dayMs).toISOString();

  // 2. Profile — full + completed (mirrors qa:wallet-persona ensure).
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      id: userId,
      name: NAME,
      phone: '5550101015',
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

  // 3. Subscription — status='trial' with the requested trial window. The
  //    signup trigger's auto-created 'free' row is replaced via onConflict.
  const { error: subError } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'trial',
      trial_started_at: trialStartIso,
      trial_end_date: trialEndIso,
      current_period_start: trialStartIso,
      current_period_end: trialEndIso,
      auto_renew_enabled: false,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (subError) {
    console.error(`❌ subscriptions upsert failed: ${subError.message}`);
    process.exit(1);
  }
  log(PERSONA_KEY, `subscription OK (status='trial', trial_end_date ${trialEndIso} → ${branchLabel(daysRemaining)}).`);

  // 4. SP wallet — trial is a subscriber status, so leave the wallet live.
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
    console.error(`❌ ${EMAIL} not provisioned yet — run: npm run qa:r41-trial -- ensure`);
    process.exit(1);
  }
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('status, trial_started_at, trial_end_date, current_period_end, auto_renew_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  console.log(`\ntest-trial persona (${EMAIL} / ${PASSWORD}) — auth user id ${userId}`);
  if (!subRow) {
    console.log('  subscription: MISSING (run `ensure` first)');
    return;
  }
  let branch = '(no trial_end_date — branch not derivable)';
  let days = null;
  if (subRow.trial_end_date) {
    days = Math.ceil((new Date(subRow.trial_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    branch = branchLabel(days);
  }
  console.log(`  subscription.status=${subRow.status} trial_started_at=${subRow.trial_started_at ?? '—'} trial_end_date=${subRow.trial_end_date ?? '—'}`);
  console.log(`  days_remaining=${days} → ContinueKidsClub renders: ${branch}`);
  console.log('  Mobile:');
  console.log('    xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=test-trial"');
  console.log('    xcrun simctl openurl booted "p2pkidsmarketplace://continue-kids-club"');
}

async function cmdEnsure() {
  const days = parseDaysRemaining();
  await ensurePersona(days);
}

async function cmdStatus() {
  const userId = await findUserIdByEmail();
  await printStatus(userId);
}

async function cmdReset() {
  if (DRY_RUN) {
    log(PERSONA_KEY, 'DRY-RUN — would delete test-trial persona rows (BP-70) + the auth user');
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
    log(PERSONA_KEY, 'No test-trial auth user present (already clean).');
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
    console.error(`❌ qa:r41-trial error:`, err?.message || err);
    process.exit(1);
  }
})();
