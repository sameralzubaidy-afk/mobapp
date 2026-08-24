// File: p2p-kids-marketplace/scripts/provision-linked-provider-fixture.ts
// PURPOSE: Staging-only standing fixture for ACC-TC-C03 (unlink provider + last-method guard).
//
// WHY THIS EXISTS (plain English):
//   No staging persona has a genuinely linked social provider, so ACC-TC-C03's
//   "Unlink" flow can never be reached (every provider shows "Not linked").
//   This script provisions `qa-linked-provider@kidsmarketplace.test` — an auth
//   user WITH a password (so the QA agent can log in via email/password) and ONE
//   genuinely linked Google identity (INSERTed into `auth.identities` by the
//   operator via SQL — supabase-js cannot write the `auth` schema; GoTrue has no
//   "add identity" admin endpoint). With password + google the user has 2 login
//   methods, so unlinking Google is ALLOWED and the unlink confirmation + success
//   alert are fully testable on-device.
//
//   LAST-METHOD GUARD (C03 step 2): the "Cannot Unlink — you must keep at least
//   one login method" alert fires only when countLoginMethods() <= 1, i.e. a
//   SOCIAL-ONLY persona (no password + exactly one provider). A password-bearing
//   user can never reach it (the password always counts as a method). The natural
//   guard fixture is the existing C07 social-only user (`qa-social-only@...`,
//   password-less) once a REAL provider identity is operator-attached to it
//   (count = 1). That login leg is documented in /memories/repo/qa-test-accounts.md
//   (same mechanism as C07's own login leg) — no C04 fixture is touched.
//
// SAFETY:
//   - Staging-only by convention: requires SUPABASE_SERVICE_ROLE_KEY and prints
//     the target URL before doing anything; does not touch production.
//   - Idempotent: re-running only fills gaps (user already exists / profile
//     already completed are no-ops).
//   - The identity INSERT is NOT performed here (it is a separate, explicitly-
//     approved SQL step) — this script verifies + prints it.
//   - No src/ app code is touched. This is a dev-tooling script only (like
//     provision-c04-collision-fixture.ts / seed-staging-data.ts).
//
// RUN (from p2p-kids-marketplace/):
//   npm run seed:linked-provider-fixture
//
// After running, the operator must apply the printed SQL (INSERT the Google
// identity into auth.identities), then re-run this script to confirm the end-state.

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

console.log('🚧 LINKED-PROVIDER FIXTURE PROVISIONING (staging-only)');
console.log('========================================================');
console.log(`Target: ${SUPABASE_URL}`);
console.log('');

const adminSupabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE CONSTANTS (single source of truth — mirror in qa-test-accounts.md)
// ─────────────────────────────────────────────────────────────────────────────
// Standing fixture for ACC-TC-C03 (unlink flow). Fixed UUID following the repo
// fixture convention (…00a = B08, …00b = B09, …00c = C04, …00d = C07).
const FIXTURE_ID = 'a1234567-0000-0000-0000-00000000000e';
const FIXTURE_EMAIL = 'qa-linked-provider@kidsmarketplace.test';
const FIXTURE_PASSWORD = 'TestLinked123!';
const FIXTURE_NAME = 'QA Linked Provider';
const FIXTURE_PHONE = '5551234010';
const FIXTURE_ZIP = '06850'; // Norwalk, CT — the documented active-node ZIP

// Synthetic Google provider id (unique per (provider_id, provider) index). Must
// NOT collide with a real Google account id if a real identity is ever attached.
const GOOGLE_PROVIDER_ID = 'qa-linked-provider-google';

async function resolveSeedNodeId(): Promise<string | null> {
  const { data: exact } = await adminSupabase
    .from('nodes')
    .select('id')
    .eq('zip_code', FIXTURE_ZIP)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (exact?.id) {
    return exact.id;
  }

  const { data: anyActive } = await adminSupabase
    .from('nodes')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!anyActive?.id) {
    console.warn('⚠️ No active nodes found — profile will be seeded without node_id.');
  }
  return anyActive?.id ?? null;
}

async function step1CreateUser(): Promise<void> {
  console.log('👤 Step 1 — ensure the auth user exists (email/password login)');
  const { data: existing } = await adminSupabase.auth.admin.getUserById(FIXTURE_ID);
  if (existing?.user) {
    console.log(`   ✓ Fixture user already exists: ${FIXTURE_EMAIL} (${FIXTURE_ID})`);
    return;
  }

  const { data: created, error } = await adminSupabase.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    email_confirm: true, // confirmed email — the QA can log in via email/password
    user_metadata: { name: FIXTURE_NAME, phone: FIXTURE_PHONE },
    // @ts-ignore - admin API supports id parameter (matches seed-staging-data.ts)
    id: FIXTURE_ID,
  });
  if (error) {
    console.error(`   ❌ Failed to create fixture user: ${error.message}`);
    process.exit(1);
  }
  console.log(`   ✓ Created: ${FIXTURE_EMAIL} (${created.user?.id}) — password ${FIXTURE_PASSWORD}`);
}

async function step2CompleteProfile(): Promise<void> {
  console.log('\n👤 Step 2 — complete the profile (node/zip/onboarding/phone)');
  const seedNodeId = await resolveSeedNodeId();
  const { error } = await adminSupabase.from('profiles').upsert(
    {
      user_id: FIXTURE_ID,
      id: FIXTURE_ID,
      name: FIXTURE_NAME,
      phone: FIXTURE_PHONE,
      phone_verified: true,
      profile_completed: true,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      zip_code: FIXTURE_ZIP,
      node_id: seedNodeId,
      dob: '2000-01-01', // 24+ years old
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.warn(`   ⚠️ Profile upsert failed: ${error.message}`);
  } else {
    console.log(`   ✓ Profile completed (node ${seedNodeId ?? 'null'})`);
  }
}

function printIdentityInsertSql(): void {
  console.log('\n🔗 Step 3 — INSERT the Google identity (operator-applied SQL)');
  console.log('   supabase-js cannot write auth.identities; GoTrue has no "add identity" admin');
  console.log('   endpoint. Apply the following on staging (project drntwgporzabmxdqykrp), then');
  console.log('   re-run this script:');
  console.log('');
  console.log('   INSERT INTO auth.identities (');
  console.log('     id, user_id, provider_id, identity_data, provider,');
  console.log('     last_sign_in_at, created_at, updated_at');
  console.log('   ) VALUES (');
  console.log('     gen_random_uuid(),');
  console.log(`     '${FIXTURE_ID}',`);
  console.log(`     '${GOOGLE_PROVIDER_ID}',`);
  console.log(`     jsonb_build_object(`);
  console.log(`       'sub', '${GOOGLE_PROVIDER_ID}',`);
  console.log(`       'email', '${FIXTURE_EMAIL}',`);
  console.log(`       'email_verified', true,`);
  console.log(`       'name', '${FIXTURE_NAME}'`);
  console.log('     ),');
  console.log("     'google',");
  console.log('     now(), now(), now()');
  console.log('   )');
  console.log(`   ON CONFLICT (provider_id, provider) DO NOTHING;`);
  console.log('');
  console.log('   (The user_linked_providers view + getLinkedProviders() read this row directly;');
  console.log('    the email must match the fixture email so the Link flow shows it as the');
  console.log('    account email. Rollback = DELETE FROM auth.identities WHERE user_id =');
  console.log(`    '${FIXTURE_ID}' AND provider = 'google';)`);
}

async function verifyEndState(): Promise<void> {
  console.log('\n✅ Step 4 — verify end-state');
  const { data: userData } = await adminSupabase.auth.admin.getUserById(FIXTURE_ID);
  const identities = userData?.user?.identities ?? [];
  const providers = identities.map((i: { provider: string }) => i.provider);
  console.log(`   Fixture identities: [${providers.join(', ') || 'none'}]`);

  const { data: profileData } = await adminSupabase
    .from('profiles')
    .select('user_id, profile_completed, onboarding_completed, phone_verified')
    .eq('user_id', FIXTURE_ID)
    .maybeSingle();

  const profileOk =
    !!profileData && profileData.profile_completed === true && profileData.onboarding_completed === true;

  if (!providers.includes('google')) {
    console.log('   ⏳ Google identity NOT yet attached — apply Step 3 SQL then re-run.');
  } else if (!profileOk) {
    console.log('   ⚠️  Profile not completed — check Step 2.');
  } else {
    console.log(
      '   ✓ VERIFY OK: google identity attached + profile completed (C03 unlink flow testable).'
    );
  }
}

async function main(): Promise<void> {
  await step1CreateUser();
  await step2CompleteProfile();
  printIdentityInsertSql();
  await verifyEndState();
  console.log('\n🏁 Done. (Identity INSERT is a separate operator step — see Step 3.)');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
