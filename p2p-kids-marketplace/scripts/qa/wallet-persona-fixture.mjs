/**
 * DEV-TASK-109 (2026-09-04) — Item 2: standing disposable SP-wallet persona
 * (`qa-wallet`) with known, sanctioned MOBILE login credentials.
 *
 * QA Task 31-M (mobile leg) needs a disposable Kids Club+ user whose SP wallet
 * can be frozen/suspended via the admin portal, then LOGGED INTO on the mobile
 * app to verify `can_spend_sp=false` actually disables the SP slider and shows
 * the warning banner (L05/L07/L08 / B04 wallet legs). The prior DT-99 disposable
 * wallet had no documented login credentials and was never a mobile persona.
 *
 * This provisions a STANDING persona:
 *   email:    qa-wallet@kidsmarketplace.test
 *   password: TestWallet123!           (fixture value, mirrors QA_PERSONAS)
 *   tier:     Kids Club+ ACTIVE subscription (SP UI live)
 *   wallet:   sp_wallets state='active', available_balance=<amount> (default 100)
 *   profile:  full + completed (Norwalk Central node, 06850, onboarding done,
 *             phone_verified) so qa-login-as lands on Home
 *
 * Mobile login is via the standard one-call deep link:
 *   xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=qa-wallet"
 * (qa-wallet is registered in src/services/qaPersonas.ts.)
 *
 * Subcommands (all service-role, staging):
 *   ensure [--amount 100] [--dry-run]
 *       → create-or-reconcile the persona to the canonical state above
 *         (idempotent; also re-signs the known password if the user drifted).
 *   state --state active|frozen|grace_period|suspended [--dry-run]
 *       → set sp_wallets.state (deterministic reset after admin freeze/suspend
 *         legs; the actual freeze/suspend for QA is done via the /sp-wallet
 *         admin page so the audit trail is recorded).
 *   status
 *       → read-only: show profile / subscription / sp_wallet for qa-wallet.
 *
 * All writes are against STAGING — dev-team run with Samer's approval
 * (two-phase provisioning; this file is Phase 1). --dry-run is read-only.
 *
 * Env: .env / .env.staging (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Node resolution mirrors seed-staging-data.ts resolveSeedNodeId().
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const DRY_RUN = process.argv.includes('--dry-run');
const argVal = (flag) => {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
};
const sub = process.argv[2] || 'help';
const AMOUNT = Number(argVal('--amount') || '100');
const STATE = argVal('--state');

const EMAIL = 'qa-wallet@kidsmarketplace.test';
const PASSWORD = 'TestWallet123!';
const FIXED_ID = 'a1234567-0000-0000-0000-0000000000f1';
const NAME = 'QA Wallet Persona';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
  process.exit(2);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(...a) {
  console.log('[qa:wallet-persona]', ...a);
}

function usage() {
  console.log(`qa:wallet-persona — standing disposable SP-wallet persona (qa-wallet)

  ensure [--amount 100] [--dry-run]
  state --state active|frozen|grace_period|suspended [--dry-run]
  status
`);
}

/**
 * Active node for the persona. QA buys Accept-SP fixtures from test-seller, so
 * the persona MUST share test-seller's node (node-scoped Discover). Fallbacks:
 * test-buyer's node → seed's exact-06850 logic → any active node.
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

async function ensurePersona() {
  if (DRY_RUN) {
    log('DRY-RUN — would create/reconcile qa-wallet (auth user + profile + active sub + active wallet).');
    return;
  }
  const nodeId = await resolveNodeId();
  if (!nodeId) {
    console.error('❌ Could not resolve an active node (06850 / test-buyer). Aborting.');
    process.exit(2);
  }

  // 1. Auth user (fixed id; create only if email not found).
  let userId = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (list?.users ?? []).find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (existing) {
    userId = existing.id;
    log(`User exists (${userId}). Re-signing the fixture password so login creds are known-good.`);
    if (!DRY_RUN) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
      if (pwErr) log(`⚠️ password reset failed: ${pwErr.message}`);
    }
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, phone: '5551234999' },
      // @ts-ignore — admin API supports id parameter (seed convention)
      id: FIXED_ID,
    });
    if (createError) {
      console.error(`❌ Failed to create auth user: ${createError.message}`);
      process.exit(1);
    }
    userId = created?.user?.id ?? FIXED_ID;
    log(`Created auth user ${userId}`);
  }

  const nowIso = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // 2. Profile (full + completed, mirrors signupTestUser).
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      id: userId,
      name: NAME,
      phone: '5551234999',
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
  log('Profile OK (completed, Norwalk Central 06850).');

  // 3. Subscription — Kids Club+ ACTIVE (SP UI live). Upsert on user_id
  //    (signup trigger auto-creates a 'free' row; onConflict replaces it).
  const { error: subError } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      current_period_start: nowIso,
      current_period_end: periodEnd,
      auto_renew_enabled: true,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );
  if (subError) {
    console.error(`❌ subscriptions upsert failed: ${subError.message}`);
    process.exit(1);
  }
  log(`Subscription OK (status='active', period_end ${periodEnd}).`);

  // 4. SP wallet — active with the requested available balance.
  const { error: walletError } = await admin.from('sp_wallets').upsert(
    {
      user_id: userId,
      state: 'active',
      available_balance: AMOUNT,
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
  log(`Wallet OK (state='active', available=${AMOUNT}).`);

  await printStatus(userId);
}

async function setState(userId) {
  const valid = ['active', 'frozen', 'grace_period', 'suspended'];
  if (!STATE || !valid.includes(STATE)) {
    console.error(`❌ --state must be one of: ${valid.join(', ')} (got '${STATE}')`);
    process.exit(2);
  }
  if (DRY_RUN) {
    log(`DRY-RUN — would set sp_wallets.state='${STATE}' for ${EMAIL}.`);
    return;
  }
  const { error } = await admin
    .from('sp_wallets')
    .upsert({ user_id: userId, state: STATE, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    console.error(`❌ sp_wallets state update failed: ${error.message}`);
    process.exit(1);
  }
  log(`✅ sp_wallets.state='${STATE}' for ${EMAIL} (user ${userId}).`);
  console.log(`   Mobile: relaunch/remount then qa-login-as?persona=qa-wallet to see the wallet state.`);
}

async function resolveUserIdByEmail() {
  // Email is the source of truth for this persona; fall back to the fixed id
  // (guarded by email match) only if the 1000-user list scan missed it.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const hit = (data?.users ?? []).find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (hit) return hit.id;

  const { data: byId } = await admin.auth.admin.getUserById(FIXED_ID);
  if (byId?.user && byId.user.email?.toLowerCase() === EMAIL.toLowerCase()) {
    return byId.user.id;
  }
  return null;
}

async function printStatus(userId) {
  if (!userId) {
    console.error(`❌ qa-wallet not provisioned yet — run: npm run qa:wallet-persona -- ensure`);
    process.exit(1);
  }
  const { data: profile } = await admin.from('profiles').select('user_id, node_id, profile_completed, phone_verified').eq('user_id', userId).maybeSingle();
  const { data: subRow } = await admin.from('subscriptions').select('user_id, status, current_period_end').eq('user_id', userId).maybeSingle();
  const { data: wallet } = await admin.from('sp_wallets').select('user_id, state, available_balance, pending_balance, reserved_sp').eq('user_id', userId).maybeSingle();
  console.log(`\nqa-wallet persona (${EMAIL} / ${PASSWORD})`);
  console.log(`  auth user id: ${userId}`);
  console.log(`  profile: ${profile ? `node=${profile.node_id} completed=${profile.profile_completed} phone_verified=${profile.phone_verified}` : 'MISSING'}`);
  console.log(`  subscription: ${subRow ? `status=${subRow.status} period_end=${subRow.current_period_end ?? '—'}` : 'MISSING'}`);
  console.log(`  sp_wallet: ${wallet ? `state=${wallet.state} available=${wallet.available_balance} pending=${wallet.pending_balance} reserved=${wallet.reserved_sp}` : 'MISSING'}`);
  console.log('  Admin /sp-wallet search by this user id; mobile qa-login-as?persona=qa-wallet');
}

async function main() {
  switch (sub) {
    case 'ensure':
      await ensurePersona();
      break;
    case 'state': {
      const userId = await resolveUserIdByEmail();
      if (!userId) {
        console.error(`❌ qa-wallet not provisioned — run: npm run qa:wallet-persona -- ensure`);
        process.exit(1);
      }
      await setState(userId);
      break;
    }
    case 'status': {
      const userId = await resolveUserIdByEmail();
      await printStatus(userId);
      break;
    }
    default:
      usage();
      process.exit(sub === 'help' ? 0 : 2);
  }
}

main();
