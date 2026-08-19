// File: p2p-kids-marketplace/scripts/provision-c04-collision-fixture.ts
// PURPOSE: Staging-only NON-UI fixture for AUTH-TC-C04 (existing-email account-link prompt).
//
// WHY THIS EXISTS (plain English):
//   AUTH-TC-C04 needs a "collision": a Google/Facebook sign-in that lands on a DIFFERENT
//   user id than the user who owns the provider email. `kidsp2p@gmail.com` is a single
//   social-only account (Google + Facebook identities, no password), so every OAuth
//   sign-in resolves to the SAME user — the AccountLinkingPrompt (userId-mismatch branch)
//   can never fire. A second account with the same email cannot be created via UI (GoTrue
//   422). This script builds the collision using standard `supabase.auth.admin` operations:
//     1. Gives `kidsp2p@gmail.com` (user A) a KNOWN PASSWORD  → RPC returns has_password:true
//        so C04 runs in password-re-auth mode.
//     2. Creates a fresh fixture user (user B) that will HOLD the Facebook identity.
//   The Facebook identity is then MOVED A→B by the operator via a single SQL UPDATE on
//   `auth.identities` (supabase-js cannot write the `auth` schema; GoTrue has no
//   "transfer identity" admin endpoint — this is the only mechanism). After the move:
//     - Facebook sign-in  → GoTrue resolves the FB identity → user B → profile.email =
//       'kidsp2p@gmail.com' → checkAccountExists() finds user A (owns the email, has a
//       password) → A !== B → AccountLinkingPrompt fires.  ✅
//     - Google sign-in    → still resolves to user A (Google identity kept) → C01 intact. ✅
//
// SAFETY:
//   - Staging-only by convention: requires SUPABASE_SERVICE_ROLE_KEY and prints the target
//     URL before doing anything; does not touch production.
//   - Idempotent: re-running only fills gaps (password already set / B already exists are
//     no-ops).
//   - The identity move is NOT performed here (it is a separate, explicitly-approved SQL
//     step) — this script verifies + prints it.
//   - No src/ app code is touched. This is a dev-tooling script only (like seed-staging-data.ts).
//
// RUN (from p2p-kids-marketplace/):
//   npm run seed:c04-fixture
//
// After running, the operator must apply the printed SQL (move facebook identity A→B),
// then re-run this script to confirm the end-state.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env (or .env.staging) — same bootstrap as seed-staging-data.ts
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  console.log('   Make sure p2p-kids-marketplace/.env (or .env.staging) has:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.log('   - EXPO_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY (required — admin operations)');
  process.exit(1);
}

console.log('🚧 C04 COLLISION FIXTURE PROVISIONING (staging-only)');
console.log('=====================================================');
console.log(`Target: ${SUPABASE_URL}`);
console.log('');

const adminSupabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE CONSTANTS (single source of truth — mirror in qa-test-accounts.md)
// ─────────────────────────────────────────────────────────────────────────────
// User A — the canonical external OAuth test account (kidsp2p@gmail.com).
const USER_A_ID = '27699457-3d25-4c82-bb75-5ad10fd60228';
const USER_A_EMAIL = 'kidsp2p@gmail.com';
// A NEW fixture password for A (documented, non-sensitive test credential). Makes A
// password-capable so C04 exercises the password re-auth path (has_password: true).
const USER_A_NEW_PASSWORD = 'TestC04Link123!';

// User B — collision holder that will own the moved Facebook identity.
// Fixed UUID following the repo fixture convention (…00a = B08, …00b = B09, …00c = C04).
const USER_B_ID = 'a1234567-0000-0000-0000-00000000000c';
const USER_B_EMAIL = 'qa-c04-account-link@kidsmarketplace.test';
const USER_B_PASSWORD = 'TestC04Link123!';
const USER_B_NAME = 'QA C04 Account Link';

// The Facebook identity currently on A (verified live 2026-08-19) — the row to move A→B.
const FACEBOOK_IDENTITY_ID = '2920f416-dfce-478f-a001-c9b0f58fae54';
const FACEBOOK_PROVIDER_ID = '122126097519161744';

async function getHasPassword(userId: string): Promise<boolean | null> {
  // The check_account_exists_by_email RPC (SECURITY DEFINER) is granted to service_role —
  // service-role client can call it to read {exists, user_id, providers, has_password}.
  const { data, error } = await adminSupabase.rpc('check_account_exists_by_email', {
    p_email: USER_A_EMAIL,
  });
  if (error) {
    console.warn(`   ⚠️  Could not call check_account_exists_by_email: ${error.message}`);
    return null;
  }
  // RPC returns jsonb; supabase-js returns it parsed.
  const rpc = (data ?? {}) as { exists?: boolean; user_id?: string; has_password?: boolean };
  if (rpc.user_id === userId) {
    return Boolean(rpc.has_password);
  }
  return null;
}

async function step1SetPasswordOnA(): Promise<void> {
  console.log('🔑 Step 1 — ensure user A (kidsp2p@gmail.com) has a known password');
  const hasPassword = await getHasPassword(USER_A_ID);

  if (hasPassword === true) {
    console.log('   ✓ A already has a password (has_password: true) — no-op.');
    return;
  }

  const { data, error } = await adminSupabase.auth.admin.updateUserById(USER_A_ID, {
    password: USER_A_NEW_PASSWORD,
  });
  if (error) {
    console.error(`   ❌ Failed to set password on A: ${error.message}`);
    process.exit(1);
  }
  console.log(`   ✓ Password set on A (${USER_A_EMAIL}). New fixture password: ${USER_A_NEW_PASSWORD}`);
  console.log(`     → has_password will now read true in checkAccountExists (C04 re-auth mode).`);
  void data;
}

async function step2CreateUserB(): Promise<void> {
  console.log('\n👤 Step 2 — ensure user B (collision holder) exists');
  const { data: existing } = await adminSupabase.auth.admin.getUserById(USER_B_ID);
  if (existing?.user) {
    console.log(`   ✓ B already exists: ${USER_B_EMAIL} (${USER_B_ID})`);
    return;
  }

  const { data: created, error } = await adminSupabase.auth.admin.createUser({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
    email_confirm: true, // confirmed email → GoTrue will NOT overwrite B's email from the
    // moved identity on OAuth login (email-conflict safety).
    user_metadata: { name: USER_B_NAME },
    // @ts-ignore - admin API supports id parameter (matches seed-staging-data.ts)
    id: USER_B_ID,
  });
  if (error) {
    console.error(`   ❌ Failed to create B: ${error.message}`);
    process.exit(1);
  }
  console.log(`   ✓ Created B: ${USER_B_EMAIL} (${USER_B_ID}) — confirmed, password ${USER_B_PASSWORD}`);
  void created;
}

function printMoveSql(): void {
  console.log('\n🔄 Step 3 — MOVE the Facebook identity A → B (operator-applied SQL)');
  console.log('   supabase-js cannot write auth.identities; GoTrue has no transfer endpoint.');
  console.log('   Apply the following on staging (project drntwgporzabmxdqykrp), then re-run this script:');
  console.log('');
  console.log('   UPDATE auth.identities');
  console.log(`   SET user_id = '${USER_B_ID}'`);
  console.log(`   WHERE id = '${FACEBOOK_IDENTITY_ID}'`);
  console.log(`     AND user_id = '${USER_A_ID}'`);
  console.log(`     AND provider = 'facebook';`);
  console.log('');
  console.log('   (Changes ONLY user_id; provider_id, email and identity_data are preserved.');
  console.log('    Unique index (provider_id, provider) is unaffected. Rollback = same UPDATE');
  console.log('    with user_id set back to USER_A_ID.)');
}

async function verifyEndState(): Promise<void> {
  console.log('\n✅ Step 4 — verify end-state');
  // 1. A: owns the email, has a password.
  const rpcA = await adminSupabase.rpc('check_account_exists_by_email', {
    p_email: USER_A_EMAIL,
  });
  if (rpcA.error) {
    console.warn(`   ⚠️  verify: RPC error ${rpcA.error.message}`);
  } else {
    const r = (rpcA.data ?? {}) as { exists?: boolean; user_id?: string; has_password?: boolean; providers?: string[] };
    console.log(`   A lookup (${USER_A_EMAIL}):`, JSON.stringify(r));
    const ok =
      r.exists === true && r.user_id === USER_A_ID && r.has_password === true;
    console.log(ok ? '   ✓ A: exists + owns email + has_password (C04 precondition MET)' : '   ✗ A: NOT yet in intended state');
  }

  // 2. Identity ownership via GoTrue admin (returns user identities).
  const [aUser, bUser] = await Promise.all([
    adminSupabase.auth.admin.getUserById(USER_A_ID),
    adminSupabase.auth.admin.getUserById(USER_B_ID),
  ]);
  const aProviders = (aUser.data?.user?.identities ?? []).map((i: { provider: string }) => i.provider);
  const bProviders = (bUser.data?.user?.identities ?? []).map((i: { provider: string }) => i.provider);
  console.log(`   A identities: [${aProviders.join(', ') || 'none'}]`);
  console.log(`   B identities: [${bProviders.join(', ') || 'none'}]`);
  const moved = !aProviders.includes('facebook') && bProviders.includes('facebook');
  console.log(
    moved
      ? '   ✓ Facebook identity moved A → B (C04 collision SHAPE complete)'
      : '   ⏳ Facebook identity NOT yet moved — apply Step 3 SQL then re-run.'
  );

  console.log('\n📋 QA reproduction (after Step 3): Login → tap Facebook → complete OAuth with the');
  console.log('   facebook-oauth-test-user (kidsp2p@gmail.com) → expect AccountLinkingPrompt');
  console.log('   "An account with kidsp2p@gmail.com already exists" + password re-auth.');
}

async function main(): Promise<void> {
  await step1SetPasswordOnA();
  await step2CreateUserB();
  printMoveSql();
  await verifyEndState();
  console.log('\n🏁 Done. (Identity move is a separate operator step — see Step 3.)');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
