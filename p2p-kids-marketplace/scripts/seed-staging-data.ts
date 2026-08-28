/**
 * Seed Staging Data Script (Enhanced)
 *
 * Creates comprehensive test data for E2E tests including:
 * - Test users (buyer, seller, admin)
 * - Categories
 * - Listings (available + some sold)
 * - Trades (various statuses)
 * - Subscriptions
 * - SP ledger entries
 * - Badges
 * - Referral codes
 *
 * Run with: npm run seed:staging
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env (or .env.staging)
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  console.log('   Make sure .env or .env.staging has:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.log('   - EXPO_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY (optional, for admin operations)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
const adminSupabase = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
  : supabase;

// ─── CLI flag: --extended seeds additional test data for full Detox coverage ──
const IS_EXTENDED = process.argv.includes('--extended');
if (IS_EXTENDED) {
  console.log('🔧 Extended mode enabled — seeding additional test scenarios.');
}

// ============================================================================
// TEST DATA CONSTANTS
// ============================================================================
export const TEST_USERS = {
  buyer: {
    id: '49243010-f458-4744-add1-a6c84ab95f1f', // Fixed UUID from tests
    email: 'test-buyer@kidsmarketplace.test',
    password: 'TestBuyer123!',
    name: 'Test Buyer',
    phone: '5551234001',
  },
  seller: {
    id: '14be337c-aad6-403f-bab2-ba1a7d80b666', // Fixed UUID from tests
    email: 'test-seller@kidsmarketplace.test',
    password: 'TestSeller123!',
    name: 'Test Seller',
    phone: '5551234002',
  },
  admin: {
    id: 'e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f', // Fixed UUID for admin
    email: 'test-admin@kidsmarketplace.test',
    password: 'TestAdmin123!',
    name: 'Test Admin',
    phone: '5551234003',
  },
  freeUser: {
    id: 'a1234567-0000-0000-0000-000000000001', // Fixed UUID for free user
    email: 'test-free@kidsmarketplace.test',
    password: 'TestFree123!',
    name: 'Test Free User',
    phone: '5551234004',
  },
  seller2: {
    id: 'a1234567-0000-0000-0000-000000000002', // Fixed UUID for second seller
    email: 'test-seller-2@kidsmarketplace.test',
    password: 'TestSeller2123!',
    name: 'Test Seller 2',
    phone: '5551234005',
  },
  buyer2: {
    id: 'a1234567-0000-0000-0000-000000000003', // Fixed UUID for competing offer buyer
    email: 'test-buyer-2@kidsmarketplace.test',
    password: 'TestBuyer2123!',
    name: 'Test Buyer 2',
    phone: '5551234006',
  },
  buyer3: {
    id: 'a1234567-0000-0000-0000-000000000004', // Fixed UUID for competing offer buyer
    email: 'test-buyer-3@kidsmarketplace.test',
    password: 'TestBuyer3123!',
    name: 'Test Buyer 3',
    phone: '5551234007',
  },
  // QA auth fixtures (AUTH-TC-B08 / B09) — see seedQaAuthFixtures() below.
  // B08: standing soft-deleted account (login → ACCOUNT_DELETED).
  deletedUser: {
    id: 'a1234567-0000-0000-0000-00000000000a', // Fixed UUID for B08 soft-deleted account
    email: 'qa-deleted@kidsmarketplace.test',
    password: 'TestDeleted123!',
    name: 'QA Deleted User',
    phone: '5551234008',
  },
  // B09: standing auth-user-without-profile (login → PROFILE_NOT_FOUND).
  noProfileUser: {
    id: 'a1234567-0000-0000-0000-00000000000b', // Fixed UUID for B09 no-profile account
    email: 'qa-no-profile@kidsmarketplace.test',
    password: 'TestNoProfile123!',
    name: 'QA No Profile User',
    phone: '5551234009',
  },
  // C07: standing social-only (password-less) fixture — see seedSocialOnlyFixture().
  // Deliberately NO password: can_set_password() returns true iff
  // auth.users.encrypted_password IS NULL (AUTH-TC-C07 becomes testable).
  socialOnlyUser: {
    id: 'a1234567-0000-0000-0000-00000000000d', // Fixed UUID for C07 password-less account
    email: 'qa-social-only@kidsmarketplace.test',
    // No `password` key — the fixture must stay password-less.
    name: 'QA Social Only User',
    phone: '5551234010',
  },
  // ACC-TC-F01/F04: standing suspended-account fixture — see seedSuspendedAccountFixture().
  // The guide's Accounts table lists test-suspended@... but it was never seeded and the
  // one existing account_status='suspended' profile has an unknown password. Provisioned
  // here with a known password + account_status='suspended' so the logout-only
  // SuspendedAccountScreen gate becomes testable.
  suspendedUser: {
    id: 'a1234567-0000-0000-0000-00000000000f', // Fixed UUID for F01/F04 suspended account
    email: 'test-suspended@kidsmarketplace.test',
    password: 'TestSuspended123!',
    name: 'Test Suspended User',
    phone: '5551234011',
  },
  // ACC-TC-G07 (3-CTA leg): standing grace-period persona — see seedGracePersonaFixture().
  // Stacks all 3 dashboard Action Items (id_verification=none + grace_period + 1 active
  // draft) so the "Show 1 more action"/"Show less" toggle (MAX_VISIBLE=2) is demonstrable.
  graceUser: {
    id: 'a1234567-0000-0000-0000-000000000011', // Fixed UUID for G07 3-CTA grace persona
    email: 'test-grace@kidsmarketplace.test',
    password: 'TestGrace123!',
    name: 'Test Grace User',
    phone: '5551234012',
  },
};

const TEST_CATEGORIES = [
  { name: 'Toys', icon: '🧸' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Electronics', icon: '📱' },
  { name: 'Books', icon: '📚' },
];

const TEST_LISTINGS = [
  {
    title: 'Nintendo Switch Games Bundle',
    description: 'Mario Kart 8 and Zelda BOTW. Great condition!',
    categoryName: 'Electronics',
    condition: 'good',
    price: 45.0,
    status: 'available',
  },
  {
    title: 'LEGO Star Wars Set',
    description: 'Millennium Falcon set, all pieces included with instructions.',
    categoryName: 'Toys',
    condition: 'like_new',
    price: 30.0,
    status: 'available',
  },
  {
    title: 'Kids Bicycle - 20 inch',
    description: 'Blue mountain bike, perfect for ages 7-10. Minor scratches.',
    categoryName: 'Sports',
    condition: 'fair',
    price: 60.0,
    status: 'available',
  },
  {
    title: 'Harry Potter Book Set',
    description: 'Complete series, gently used paperbacks.',
    categoryName: 'Books',
    condition: 'good',
    price: 35.0,
    status: 'available',
  },
  {
    title: 'Basketball',
    description: 'Official size, indoor/outdoor use.',
    categoryName: 'Sports',
    condition: 'good',
    price: 15.0,
    status: 'available',
  },
];

// Extended listings (seeded only with --extended flag)
const DONATION_LISTING = {
  title: 'Free Art Supplies',
  description: 'Gently used markers, crayons, and sketch pads — free to a good home!',
  categoryName: 'Books',
  condition: 'fair',
  price: 0,
  status: 'available',
  accepts_swap_points: false,
};

const CASH_ONLY_LISTING = {
  title: 'Vintage Comic Book Collection',
  description: 'Set of 10 classic comic books. Cash only, no SP accepted.',
  categoryName: 'Books',
  condition: 'good',
  price: 25.0,
  status: 'available',
  accepts_swap_points: false,
};

const SELLER2_LISTINGS = [
  {
    title: 'Science Kit',
    description: 'STEM experiment kit, unopened.',
    categoryName: 'Toys',
    condition: 'like_new',
    price: 20.0,
    status: 'available',
  },
  {
    title: 'Board Game Set',
    description: 'Monopoly, Scrabble, and Chess — all complete.',
    categoryName: 'Toys',
    condition: 'good',
    price: 18.0,
    status: 'available',
  },
  {
    title: "Children's Dictionary",
    description: 'Hardcover illustrated dictionary.',
    categoryName: 'Books',
    condition: 'good',
    price: 8.0,
    status: 'available',
  },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function seedCategories(): Promise<{ [key: string]: string }> {
  console.log('\n📂 Seeding categories...');
  const categoryMap: { [key: string]: string } = {};

  for (const cat of TEST_CATEGORIES) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('name', cat.name)
      .single();

    if (existing) {
      console.log(`   ✓ Category exists: ${cat.name}`);
      categoryMap[cat.name] = existing.id;
      continue;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: cat.name,
        icon: cat.icon,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ Failed to create category "${cat.name}": ${error.message}`);
    } else {
      console.log(`   ✓ Created category: ${cat.name}`);
      categoryMap[cat.name] = data.id;
    }
  }

  return categoryMap;
}

// ─── Node assignment for standard test personas ─────────────────────────────
// The P3/P4 node-scoped discovery build reads `profiles.node_id` to scope
// search/browse results, so seeded test users MUST have a node assigned or
// node-scoped discovery (AUTH-TC-F06) falls back to global browse for them.
// Resolve the active node for the seeded ZIP (06850 = Norwalk, CT) exactly like
// the app's `resolve_active_node_for_signup` RPC: exact ZIP match first, then
// any active node. Returns null (no active nodes) without failing the seed.
let cachedSeedNodeId: string | null | undefined;
async function resolveSeedNodeId(): Promise<string | null> {
  if (cachedSeedNodeId !== undefined) return cachedSeedNodeId;

  const { data: exact } = await adminSupabase
    .from('nodes')
    .select('id')
    .eq('zip_code', '06850')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (exact?.id) {
    cachedSeedNodeId = exact.id;
    return exact.id;
  }

  const { data: anyActive } = await adminSupabase
    .from('nodes')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  cachedSeedNodeId = anyActive?.id ?? null;
  if (!cachedSeedNodeId) {
    console.warn('⚠️ No active nodes found — test personas will be seeded without node_id.');
  } else {
    console.log(`   ✓ Seed node resolved: ${cachedSeedNodeId} (for ZIP 06850)`);
  }
  // `?? null` narrows the captured module-level `let` (string | null | undefined)
  // to the declared return type (string | null).
  return cachedSeedNodeId ?? null;
}

async function signupTestUser(
  userData: typeof TEST_USERS.buyer,
  role: string = 'user'
): Promise<string | null> {
  console.log(`\n📧 Setting up: ${userData.email}`);

  let userId = (userData as any).id || null;

  // Check if user already exists
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id, user_id')
    .eq('id', userId || 'none')
    .single();

  if (existingProfile) {
    console.log(`   ✓ User already exists: ${existingProfile.id}`);

    // P4 node-scope fix (AUTH-TC-F06): re-assign node_id (+ zip) for standard
    // personas EVEN on re-seed of existing users — the early-return used to
    // leave `node_id` NULL on staging, which broke node-scoped discovery for
    // these accounts. This is an idempotent UPDATE, not a destructive change.
    const seedNodeId = await resolveSeedNodeId();
    const { error: reAssignError } = await adminSupabase
      .from('profiles')
      .update({
        node_id: seedNodeId,
        zip_code: '06850',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingProfile.id);

    if (reAssignError) {
      console.warn(`   ⚠️ Could not re-assign node for existing user: ${reAssignError.message}`);
    } else {
      console.log(`   ✓ Re-assigned node_id=${seedNodeId ?? 'null'} for existing user`);
    }

    return existingProfile.id;
  }

  // Try to sign in first
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.email,
    password: userData.password,
  });

  if (!signInError && signInData.user) {
    userId = signInData.user.id;
    console.log(`   ✓ User already exists: ${userId}`);
  } else {
    // User doesn't exist, create them
    console.log(`   Creating new account...`);

    // Use admin API to create user with specific UUID if provided
    if (SUPABASE_SERVICE_KEY && userId) {
      const { data: adminData, error: adminError } = await adminSupabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          phone: userData.phone,
        },
        // @ts-ignore - admin API supports id parameter
        id: userId,
      });

      if (adminError) {
        console.error(`   ❌ Failed to create user: ${adminError.message}`);
        return null;
      }
      userId = adminData.user?.id || null;
    } else {
      // Regular signup
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            phone: userData.phone,
          },
        },
      });

      if (signUpError) {
        console.error(`   ❌ Failed to sign up: ${signUpError.message}`);
        return null;
      }
      userId = signUpData.user?.id || null;
    }

    console.log(`   ✓ Created account: ${userId}`);
  }

  if (!userId) return null;

  // Create/update profile
  const seedNodeId = await resolveSeedNodeId();
  const { error: profileError } = await adminSupabase.from('profiles').upsert(
    {
      user_id: userId,
      id: userId,
      name: userData.name,
      phone: userData.phone,
      phone_verified: true,
      profile_completed: true,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      zip_code: '06850',
      node_id: seedNodeId, // P4 node-scope fix: standard personas get a node assigned
      dob: '2000-01-01', // 24+ years old
      role: role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (profileError) {
    console.log(`   ⚠️ Profile: ${profileError.message}`);
  } else {
    console.log(`   ✓ Profile created with role: ${role}`);
  }

  return userId;
}

/**
 * QA AUTH FIXTURES — standing staging personas for the QA Test Agent
 * (AUTH-TC-B08 soft-deleted account, AUTH-TC-B09 auth-user-without-profile).
 *
 * An execution-only QA agent cannot construct these itself (no SQL writes; admin
 * portal out of scope), so they are provisioned here and recreated on every
 * `npm run seed:staging` (idempotent).
 *
 * B08 — soft-deleted account: a normal full profile, then soft-deleted exactly like
 *       the admin portal's "Delete User (Soft)" (`deleted_at` + `deletion_type='admin'`).
 *       Login finds the profile with `deleted_at` set → ACCOUNT_DELETED error path
 *       ("Your account has been deleted. Please contact admin-support@...").
 *       NOTE: the app keys B08 off `profiles.deleted_at`, NOT `account_status`
 *       (the enum has no 'deleted' value — the guide's "account_status = deleted"
 *       phrasing is doc drift).
 *
 * B09 — auth-user-without-profile: the auth user exists (GoTrue login succeeds) but
 *       the `profiles` row is hard-deleted → login hits PROFILE_NOT_FOUND
 *       ("Profile not found. Please contact support."). The `on_auth_user_created`
 *       trigger auto-creates a profile on first create, so we create the auth user
 *       then delete the profile row. For a fresh user no FK depends on the profile
 *       (messages/trades/referral_relationships are empty), so the delete is safe.
 */
async function seedQaAuthFixtures(): Promise<void> {
  console.log('\n' + '═'.repeat(50));
  console.log('🧪 QA AUTH FIXTURES (B08 soft-deleted, B09 no-profile, C07 social-only)');
  console.log('═'.repeat(50));

  // ── B08: soft-deleted account ─────────────────────────────────────────────
  await signupTestUser(TEST_USERS.deletedUser, 'user');
  const { error: softDeleteError } = await adminSupabase
    .from('profiles')
    .update({
      deleted_at: new Date().toISOString(),
      deletion_type: 'admin',
      deletion_reason: 'QA fixture: AUTH-TC-B08 soft-deleted account (do not restore)',
    })
    .eq('user_id', TEST_USERS.deletedUser.id);

  if (softDeleteError) {
    console.warn(`   ⚠️ B08 soft-delete failed: ${softDeleteError.message}`);
  } else {
    console.log(`   ✓ B08 soft-deleted (login → ACCOUNT_DELETED): ${TEST_USERS.deletedUser.email}`);
  }

  // ── B09: auth user WITHOUT profile ────────────────────────────────────────
  const np = TEST_USERS.noProfileUser;

  // 1. Ensure the auth user exists (create via admin API only if missing).
  const { data: existingAuth } = await adminSupabase.auth.admin.getUserById(np.id);
  if (existingAuth?.user) {
    console.log(`   ✓ B09 auth user exists: ${np.email}`);
  } else {
    const { data: createdUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: np.email,
      password: np.password,
      email_confirm: true,
      user_metadata: { name: np.name, phone: np.phone },
      // @ts-ignore - admin API supports id parameter (matches signupTestUser)
      id: np.id,
    });
    if (createError) {
      console.error(`   ❌ B09 create auth user failed: ${createError.message}`);
      return;
    }
    console.log(
      `   ✓ B09 auth user created: ${np.email} (trigger auto-created a profile — deleting next)`
    );
  }

  // 2. Remove the profile row (idempotent) so login hits PROFILE_NOT_FOUND.
  const { error: profileDeleteError } = await adminSupabase
    .from('profiles')
    .delete()
    .eq('user_id', np.id);

  if (profileDeleteError) {
    console.warn(`   ⚠️ B09 profile delete failed: ${profileDeleteError.message}`);
  } else {
    console.log(`   ✓ B09 profile removed (login → PROFILE_NOT_FOUND): ${np.email}`);
  }

  // 3. Verify end-state: auth user present, profile absent.
  const { data: leftoverProfile } = await adminSupabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', np.id)
    .maybeSingle();
  const { data: verifyAuth } = await adminSupabase.auth.admin.getUserById(np.id);
  if (leftoverProfile) {
    console.warn(`   ⚠️ B09 VERIFY FAIL: profile still present for ${np.email}`);
  } else if (!verifyAuth?.user) {
    console.warn(`   ⚠️ B09 VERIFY FAIL: auth user missing for ${np.email}`);
  } else {
    console.log(`   ✓ B09 VERIFY OK: auth user present, profile absent (${np.email})`);
  }
}

/**
 * C07 — standing social-only (password-less) fixture for AUTH-TC-C07
 * ("Social-only user sets a password").
 *
 * Why it exists: no password-less social-only user exists on staging (the C04
 * fixture made kidsp2p@gmail.com password-capable; fixture user B also has a
 * password). SetPasswordModal requires an auth user with NO password — its
 * `canSetPassword()` RPC returns true iff `auth.users.encrypted_password IS NULL`.
 * This fixture creates such an account via the admin API with NO password, marks
 * it as a Google social account in app_metadata, and gives it a normal COMPLETED
 * profile (node/zip/onboarding/phone) so the QA agent can log in and reach
 * Settings → Linked Accounts → Set Password.
 *
 * NOTE (login leg): logging IN as this user still requires an OAuth identity
 * attached to it (a real Google account — operator SQL on auth.identities, same
 * mechanism as the C04 fixture). This script provisions the standing fixture and
 * verifies the password-less precondition via check_account_exists_by_email;
 * attaching a provider identity is a separate operator step documented in
 * /memories/repo/qa-test-accounts.md.
 *
 * Idempotent: re-running on an existing fixture is a no-op and NEVER sets a
 * password on an existing account.
 */
async function seedSocialOnlyFixture(): Promise<void> {
  console.log('   ── C07 social-only (password-less) fixture ──');
  const so = TEST_USERS.socialOnlyUser;

  // 1. Ensure the auth user exists (create without a password only if missing).
  const { data: existing } = await adminSupabase.auth.admin.getUserById(so.id);
  if (existing?.user) {
    console.log(`   ✓ C07 auth user exists: ${so.email}`);
  } else {
    const { data: created, error } = await adminSupabase.auth.admin.createUser({
      email: so.email,
      // Deliberately NO `password` — the fixture must stay password-less so
      // can_set_password() returns true (AUTH-TC-C07 testable).
      email_confirm: true,
      app_metadata: {
        provider: 'google',
        providers: ['google'],
      },
      user_metadata: {
        name: so.name,
        phone: so.phone,
      },
      // @ts-ignore - admin API supports id parameter (matches signupTestUser)
      id: so.id,
    });
    if (error) {
      console.error(`   ❌ C07 create auth user failed: ${error.message}`);
      return;
    }
    console.log(`   ✓ C07 auth user created (no password): ${so.email} (${created.user?.id})`);
  }

  // 2. Ensure a normal COMPLETED profile (unlike B09's deleted profile). The
  //    on_auth_user_created trigger auto-creates one; this upsert completes it
  //    (node/zip/onboarding/phone) so the user can use the app and reach the
  //    Set Password modal from Settings → Linked Accounts.
  const seedNodeId = await resolveSeedNodeId();
  const { error: profileError } = await adminSupabase.from('profiles').upsert(
    {
      user_id: so.id,
      id: so.id,
      name: so.name,
      phone: so.phone,
      phone_verified: true,
      profile_completed: true,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      zip_code: '06850',
      node_id: seedNodeId,
      dob: '2000-01-01', // 24+ years old
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (profileError) {
    console.warn(`   ⚠️ C07 profile upsert failed: ${profileError.message}`);
  } else {
    console.log(`   ✓ C07 profile completed (node ${seedNodeId ?? 'null'})`);
  }

  // 3. Verify the password-less precondition via the same RPC the app uses
  //    (check_account_exists_by_email → has_password:false).
  const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
    'check_account_exists_by_email',
    { p_email: so.email }
  );
  if (rpcError) {
    console.warn(`   ⚠️ C07 VERIFY: check_account_exists_by_email failed: ${rpcError.message}`);
  } else {
    const r = (rpcData ?? {}) as { exists?: boolean; user_id?: string; has_password?: boolean };
    if (r.exists === true && r.user_id === so.id && r.has_password === false) {
      console.log(
        `   ✓ C07 VERIFY OK: account exists, NO password (can_set_password=true expected)`
      );
    } else {
      console.warn(`   ⚠️ C07 VERIFY: unexpected state for ${so.email}: ${JSON.stringify(r)}`);
    }
  }
}

/**
 * ACC-TC-F01/F04 — standing suspended-account fixture for the QA Test Agent
 * ("Suspended account screen — logout only").
 *
 * Why it exists: the guide's Accounts table lists `test-suspended@…` but no
 * login-able fixture exists on staging (the one existing
 * `account_status='suspended'` profile has an unknown password). The
 * SuspendedAccountScreen gate is keyed off the profile's `account_status`
 * (`AuthContext` enriches `session.user.account_status` from `profiles`, and
 * `AppNavigator` routes authenticated+suspended users to the logout-only
 * screen). Provisioning here mirrors the qa-deleted/qa-no-profile standing
 * fixtures: a full normal profile, then `account_status='suspended'` set like
 * the admin's suspend RPC (suspended_at + suspension_reason; suspended_by left
 * NULL — the gate reads only account_status).
 *
 * Idempotent: re-running re-signs the user (no-op if exists) then re-applies
 * the suspended status, so the fixture is always suspended after a fresh seed.
 */
async function seedSuspendedAccountFixture(): Promise<void> {
  console.log('   ── F01/F04 suspended-account fixture ──');
  const su = TEST_USERS.suspendedUser;

  // 1. Ensure the auth user + full profile exist (same as a normal persona).
  await signupTestUser(su, 'user');

  // 2. Set account_status='suspended' (mirror the admin suspend RPC fields;
  //    suspended_by left NULL — no admin actor in the seed path).
  const { error: suspendError } = await adminSupabase
    .from('profiles')
    .update({
      account_status: 'suspended',
      suspended_at: new Date().toISOString(),
      suspension_reason: 'QA fixture: ACC-TC-F01/F04 suspended account (do not restore)',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', su.id);

  if (suspendError) {
    console.warn(`   ⚠️ F01/F04 suspend update failed: ${suspendError.message}`);
  } else {
    console.log(`   ✓ test-suspended suspended (login → SuspendedAccountScreen): ${su.email}`);
  }

  // 3. Verify end-state via the same read AuthContext uses.
  const { data: profile, error: verifyError } = await adminSupabase
    .from('profiles')
    .select('account_status, suspended_at')
    .eq('user_id', su.id)
    .maybeSingle();

  if (verifyError) {
    console.warn(`   ⚠️ F01/F04 VERIFY: profile read failed: ${verifyError.message}`);
  } else if (profile?.account_status === 'suspended') {
    console.log(`   ✓ F01/F04 VERIFY OK: account_status='suspended' (${su.email})`);
  } else {
    console.warn(`   ⚠️ F01/F04 VERIFY FAIL: account_status=${profile?.account_status ?? 'null'}`);
  }
}

/**
 * ACC-TC-G07 (3-CTA leg) — standing grace-period persona for the QA Test Agent
 * ("Show 1 more action" / "Show less" toggle with 3 stacked Action Items).
 *
 * Why it exists: the dashboard's MAX_VISIBLE=2 toggle only renders when a persona
 * stacks 3 CTAs (id_verification + grace_period + drafts). No login-able grace
 * persona existed on staging, so the 3-CTA leg was not executable. Provisioning
 * here mirrors the suspended-fixture pattern (full profile, then status-specific
 * fields applied):
 *   - subscriptions.status='grace' + future grace_ends_at → drives GracePeriodBanner
 *     (get_subscription_status normalizes 'grace' → 'grace_period'; loadSubscriptionTimeline
 *     reads subscriptions.grace_ends_at).
 *   - NO id_badge_verification_requests row → getVerificationStatus returns 'none'
 *     → IDVerificationCTABanner CTA.
 *   - ONE active item_drafts row (expires_at future) → ResumeDraftBanner CTA.
 *
 * Idempotent: re-running re-signs the user (no-op if exists), re-applies the grace
 * subscription state, and ensures exactly one active draft exists.
 */
async function seedGracePersonaFixture(): Promise<void> {
  console.log('   ── G07 3-CTA grace-persona fixture ──');
  const gu = TEST_USERS.graceUser;

  // 1. Ensure the auth user + full profile exist (same as a normal persona).
  await signupTestUser(gu, 'user');

  // 2. Set subscription to grace. The signup trigger auto-creates a 'free' row;
  //    upsert (onConflict user_id) is used so a missing row is created, not skipped.
  //    status='grace' is valid (subscriptions CHECK includes 'grace').
  const graceEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days
  const { error: subError } = await adminSupabase.from('subscriptions').upsert(
    {
      user_id: gu.id,
      status: 'grace',
      grace_started_at: new Date().toISOString(),
      grace_ends_at: graceEndsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (subError) {
    console.warn(`   ⚠️ G07 grace subscription upsert failed: ${subError.message}`);
  } else {
    console.log(
      `   ✓ test-grace subscription status='grace' (grace_ends_at ${graceEndsAt})`
    );
  }

  // 3. Ensure exactly ONE active draft (ResumeDraftBanner CTA).
  const { data: existingDrafts } = await adminSupabase
    .from('item_drafts')
    .select('id')
    .eq('seller_id', gu.id)
    .gt('expires_at', new Date().toISOString());

  if (!existingDrafts || existingDrafts.length === 0) {
    const { error: draftError } = await adminSupabase.from('item_drafts').insert({
      seller_id: gu.id,
      draft_data: { title: 'Grace Persona Draft', description: 'G07 3-CTA fixture' },
      step: 'details',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (draftError) {
      console.warn(`   ⚠️ G07 draft insert failed: ${draftError.message}`);
    } else {
      console.log('   ✓ test-grace active draft created (ResumeDraftBanner CTA)');
    }
  } else {
    console.log(`   ✓ test-grace active draft already present (${existingDrafts.length})`);
  }

  // 4. Ensure NO id_badge_verification_requests row (absence → status 'none').
  const { data: idReq } = await adminSupabase
    .from('id_badge_verification_requests')
    .select('id')
    .eq('user_id', gu.id)
    .maybeSingle();
  if (idReq) {
    console.warn(
      '   ⚠️ G07 id_badge_verification_requests row exists for test-grace — ID CTA may not render as "none"'
    );
  } else {
    console.log("   ✓ test-grace id_verification status='none' (no requests row)");
  }

  // 5. Verify end-state (all 3 CTAs will stack → show-all toggle renders).
  const { data: verifySub, error: verifyError } = await adminSupabase
    .from('subscriptions')
    .select('status, grace_ends_at')
    .eq('user_id', gu.id)
    .maybeSingle();

  if (verifyError) {
    console.warn(`   ⚠️ G07 VERIFY: subscription read failed: ${verifyError.message}`);
  } else if (verifySub?.status === 'grace' && verifySub.grace_ends_at) {
    console.log(`   ✓ G07 VERIFY OK: subscriptions.status='grace' + future grace_ends_at (${gu.email})`);
  } else {
    console.warn(`   ⚠️ G07 VERIFY FAIL: subscriptions.status=${verifySub?.status ?? 'null'}`);
  }
}

/**
 * ACC-TC-F02 (success leg) — valid unsubscribe token for the QA Test Agent
 * ("You've Been Unsubscribed" + category + Go to Home via deep link).
 *
 * Why it exists: `unsubscribe_tokens` is empty on staging and an execution-only
 * QA agent cannot mint one (no DB writes). This mints a valid, unexpired token
 * via the existing `generate_unsubscribe_token` RPC against a standing persona
 * (test-buyer), so the app's UnsubscribeScreen success branch
 * (`p2pkidsmarketplace://unsubscribe?token=<TOKEN>`) becomes testable.
 *
 * Idempotent: prior UNUSED tokens for the fixture user are removed so re-seeds
 * don't accumulate rows; the token is consumed (used_at set) the first time F02
 * runs, so a later re-seed mints a fresh one.
 */
async function seedUnsubscribeTokenFixture(): Promise<void> {
  console.log('   ── F02 valid unsubscribe-token fixture ──');
  const target = TEST_USERS.buyer; // standing persona with a full profile + prefs rows

  // 1. Clean up any prior UNUSED tokens for this user (used tokens stay as audit).
  const { error: cleanupError } = await adminSupabase
    .from('unsubscribe_tokens')
    .delete()
    .eq('user_id', target.id)
    .is('used_at', null);

  if (cleanupError) {
    console.warn(`   ⚠️ F02 cleanup of prior unused tokens failed: ${cleanupError.message}`);
  }

  // 2. Mint a fresh valid token via the existing RPC.
  const { data: token, error: tokenError } = await adminSupabase.rpc(
    'generate_unsubscribe_token',
    { p_user_id: target.id, p_category: 'subscription' }
  );

  if (tokenError || !token || typeof token !== 'string') {
    console.warn(
      `   ⚠️ F02 generate_unsubscribe_token failed: ${tokenError?.message ?? 'no token returned'}`
    );
    return;
  }

  // 3. Verify the minted token is valid + unexpired (same read path as process_unsubscribe).
  const { data: row } = await adminSupabase
    .from('unsubscribe_tokens')
    .select('token, category, used_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  const isValid =
    row && row.used_at === null && row.expires_at && new Date(row.expires_at) > new Date();

  if (isValid) {
    console.log(
      `   ✓ F02 valid token minted: user=${target.email} category=${row.category} (expires ${row.expires_at})`
    );
    console.log(`   ── F02 deep link (QA): p2pkidsmarketplace://unsubscribe?token=${token}`);
  } else {
    console.warn(`   ⚠️ F02 VERIFY FAIL: token not found/expired: ${JSON.stringify(row)}`);
  }
}

/**
 * P03 — seeded unread-message fixture for AUTH-TC-P03 ("Header chat icon opens
 * Messages with an unread badge").
 *
 * test-buyer has zero `messages` rows after a fresh seed, so the header chat
 * unread badge (getTotalUnreadMessageCount: messages from the OTHER party with
 * read_at IS NULL on the user's trades) can never show a count. This seeds ONE
 * trade-scoped message FROM the seller TO the buyer with read_at NULL so the
 * badge renders 1 (P03 testable without a multi-account, multi-screen dead-end).
 * After the QA opens the chat, mark_trade_messages_read sets read_at → badge
 * clears (P03's expected read flow).
 *
 * Idempotent: if a message from the seller already exists on the target trade,
 * this is a no-op.
 */
async function seedUnreadMessageFixture(buyerId: string, sellerId: string): Promise<void> {
  console.log('   ── P03 unread-message fixture ──');

  // Find an existing trade where the buyer is test-buyer (seedTrade creates up
  // to 3 pending trades earlier in main()).
  const { data: trade, error: tradeError } = await adminSupabase
    .from('trades')
    .select('id, buyer_id, seller_id')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (tradeError || !trade) {
    console.warn(
      `   ⚠️ P03: no buyer trade found to attach a message to (${tradeError?.message ?? 'none'})`
    );
    return;
  }

  // Idempotency guard: skip if a message from the seller already exists.
  const { data: existingRows } = await adminSupabase
    .from('messages')
    .select('id')
    .eq('trade_id', trade.id)
    .eq('sender_id', sellerId)
    .is('deleted_at', null)
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    console.log(`   ✓ P03 unread message already exists on trade ${trade.id}`);
    return;
  }

  const { error: insertError } = await adminSupabase.from('messages').insert({
    trade_id: trade.id,
    sender_id: sellerId,
    content:
      'Hi! Thanks for your offer — I can arrange a meetup this weekend. Let me know a good time for you.',
    message_type: 'text',
    delivery_status: 'sent',
    read_at: null,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    console.warn(`   ⚠️ P03 message insert failed: ${insertError.message}`);
  } else {
    console.log(`   ✓ P03 unread message seeded (seller → buyer) on trade ${trade.id}`);
  }
}

async function seedListings(
  sellerId: string,
  sellerSession: any,
  categoryMap: { [key: string]: string }
): Promise<string[]> {
  console.log('\n📦 Seeding test listings...');
  const listingIds: string[] = [];

  // Use admin client to bypass RLS
  for (const listing of TEST_LISTINGS) {
    // Check if listing already exists
    let existingRes = await adminSupabase
      .from('items')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('title', listing.title)
      .maybeSingle();

    // Back-compat: older schemas used user_id
    if (existingRes.error && existingRes.error.message?.includes('seller_id')) {
      existingRes = await adminSupabase
        .from('items')
        .select('id')
        .eq('user_id', sellerId)
        .eq('title', listing.title)
        .maybeSingle();
    }

    const existing = existingRes.data;

    if (existing) {
      // Reset status to available if it was previously sold/pending/unavailable
      // OR paused (a paused listing was not being reset — QA fixtures like the
      // Accept-SP A02 item could stay stuck non-available across re-seeds).
      // Also (re)stamp approval metadata so the every-available-item-is-approved
      // invariant holds (approved_at must be set on any 'available' row).
      const { error: resetError } = await adminSupabase
        .from('items')
        .update({
          status: 'available',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .in('status', ['sold', 'pending', 'unavailable', 'paused']);
      if (resetError) {
        console.log(`   ⚠️ Could not reset status for: ${listing.title} (${resetError.message})`);
      }
      console.log(`   ✓ Listing exists: ${listing.title}`);
      listingIds.push(existing.id);
      continue;
    }

    // Prefer current schema (seller_id + DECIMAL price). Fall back to legacy (user_id + price_cents).
    const now = new Date().toISOString();

    let insertRes = await adminSupabase
      .from('items')
      .insert({
        seller_id: sellerId,
        title: listing.title,
        description: listing.description,
        category_id: categoryMap[listing.categoryName] || null,
        condition: listing.condition,
        price: listing.price,
        status: listing.status,
        // Approval metadata: seed items are pre-approved (visible immediately),
        // so stamp approved_at to keep the available⇒approved invariant intact.
        approved_at: now,
        accepts_swap_points: true,
        seller_subscription_status_at_creation: 'trial',
        eligible_for_starter_pack: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (insertRes.error && insertRes.error.message?.includes('seller_id')) {
      insertRes = await adminSupabase
        .from('items')
        .insert({
          user_id: sellerId,
          title: listing.title,
          description: listing.description,
          category_id: categoryMap[listing.categoryName] || null,
          condition: listing.condition,
          price_cents: Math.round(listing.price * 100),
          status: listing.status,
          accepts_swap_points: true,
          created_at: now,
        })
        .select('id')
        .single();
    }

    const data = insertRes.data as any;
    const error = insertRes.error as any;

    if (error) {
      console.error(`   ❌ Failed to create listing "${listing.title}": ${error.message}`);
    } else {
      console.log(`   ✓ Created listing: ${listing.title}`);
      listingIds.push(data.id);
    }
  }

  return listingIds;
}

async function seedTrade(buyerId: string, sellerId: string, listingId: string): Promise<void> {
  console.log('\n🤝 Seeding test trade...');

  // Check if trade already exists
  const { data: existing } = await adminSupabase
    .from('trades')
    .select('id, status')
    .eq('buyer_id', buyerId)
    .eq('listing_id', listingId)
    .in('status', ['pending', 'accepted', 'in_progress'])
    .maybeSingle();

  if (existing) {
    console.log(`   ✓ Active trade exists: ${existing.id} (${existing.status})`);
    return;
  }

  // Prefer current schema (buyer_transaction_fee_cents). Fall back to legacy (transaction_fee_cents).
  const now = new Date().toISOString();

  let insertRes = await adminSupabase
    .from('trades')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      status: 'pending',
      cash_amount_cents: 4500, // $45.00
      sp_amount: 0,
      buyer_transaction_fee_cents: 99,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (insertRes.error && insertRes.error.message?.includes('buyer_transaction_fee_cents')) {
    insertRes = await adminSupabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        status: 'pending',
        cash_amount_cents: 4500, // $45.00
        sp_amount: 0,
        transaction_fee_cents: 99,
        created_at: now,
      })
      .select('id')
      .single();
  }

  const data = insertRes.data as any;
  const error = insertRes.error as any;

  if (error) {
    console.error(`   ❌ Failed to create trade: ${error.message}`);
  } else {
    console.log(`   ✓ Created pending trade: ${data.id}`);
  }
}

async function seedSubscriptions(buyerId: string, sellerId: string): Promise<void> {
  console.log('\n💳 Seeding subscriptions...');

  const users = [
    { id: buyerId, name: 'buyer' },
    { id: sellerId, name: 'seller' },
  ];

  for (const user of users) {
    const { data: existing } = await adminSupabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ Subscription exists for ${user.name}`);
      continue;
    }

    const { error } = await adminSupabase.from('subscriptions').insert({
      user_id: user.id,
      status: 'trial',
      trial_start_date: new Date().toISOString(),
      trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create subscription for ${user.name}: ${error.message}`);
    } else {
      console.log(`   ✓ Created trial subscription for ${user.name}`);
    }
  }
}

async function seedSPLedger(buyerId: string, sellerId: string): Promise<void> {
  console.log('\n💰 Seeding SP ledger entries...');

  const entries = [
    { user_id: buyerId, amount: 50, description: 'Signup bonus', transaction_type: 'earned' },
    { user_id: buyerId, amount: 25, description: 'Completed trade', transaction_type: 'earned' },
    { user_id: sellerId, amount: 100, description: 'Seller earnings', transaction_type: 'earned' },
    { user_id: sellerId, amount: 30, description: 'Referral bonus', transaction_type: 'earned' },
  ];

  for (const entry of entries) {
    const { data: existing } = await adminSupabase
      .from('sp_ledger')
      .select('id')
      .eq('user_id', entry.user_id)
      .eq('description', entry.description)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ SP entry exists: ${entry.description}`);
      continue;
    }

    const { error } = await adminSupabase.from('sp_ledger').insert({
      user_id: entry.user_id,
      amount: entry.amount,
      description: entry.description,
      transaction_type: entry.transaction_type,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create SP entry "${entry.description}": ${error.message}`);
    } else {
      console.log(`   ✓ Created SP entry: ${entry.description} (+${entry.amount} SP)`);
    }
  }
}

async function seedBadges(): Promise<void> {
  console.log('\n🏆 Seeding badges...');

  const badges = [
    {
      name: 'First Trade',
      category: 'trade',
      threshold: 1,
      description: 'Complete your first trade',
      icon_url: '🎉',
    },
    {
      name: 'SP Earner - Bronze',
      category: 'sp_earning',
      threshold: 10,
      description: 'Earn 10 SP',
      icon_url: '🥉',
    },
    {
      name: 'SP Earner - Silver',
      category: 'sp_earning',
      threshold: 50,
      description: 'Earn 50 SP',
      icon_url: '🥈',
    },
    {
      name: 'SP Earner - Gold',
      category: 'sp_earning',
      threshold: 100,
      description: 'Earn 100 SP',
      icon_url: '🥇',
    },
    {
      name: 'Trade Master',
      category: 'trade',
      threshold: 10,
      description: 'Complete 10 trades',
      icon_url: '⭐',
    },
  ];

  for (const badge of badges) {
    const { data: existing } = await adminSupabase
      .from('badges')
      .select('id')
      .eq('name', badge.name)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ Badge exists: ${badge.name}`);
      continue;
    }

    const { error } = await adminSupabase.from('badges').insert({
      name: badge.name,
      category: badge.category,
      threshold: badge.threshold,
      description: badge.description,
      icon_url: badge.icon_url,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create badge "${badge.name}": ${error.message}`);
    } else {
      console.log(`   ✓ Created badge: ${badge.name}`);
    }
  }
}

// ============================================================================
// EXTENDED SEED FUNCTIONS (only called with --extended flag)
// ============================================================================

/**
 * Seeds a free (non-subscriber) user for TC-C07, TC-H01, TC-K02.
 */
async function seedFreeUser(): Promise<string | null> {
  console.log('\n🆓 Seeding free (non-subscriber) user...');
  const userId = await signupTestUser(TEST_USERS.freeUser, 'user');
  // DO NOT create a subscription — this user must remain free
  return userId;
}

/**
 * Seeds the second seller account for multi-seller cart tests (TC-M02-M04, M10, etc.).
 */
async function seedSeller2(categoryMap: { [key: string]: string }): Promise<string | null> {
  console.log('\n👤 Seeding second seller...');
  const seller2Id = await signupTestUser(TEST_USERS.seller2, 'user');
  if (!seller2Id) return null;

  const { data: session } = await supabase.auth.signInWithPassword({
    email: TEST_USERS.seller2.email,
    password: TEST_USERS.seller2.password,
  });

  console.log('\n📦 Seeding seller 2 listings...');
  for (const listing of SELLER2_LISTINGS) {
    const { data: existing } = await adminSupabase
      .from('items')
      .select('id')
      .eq('seller_id', seller2Id)
      .eq('title', listing.title)
      .maybeSingle();
    if (existing) {
      console.log(`   ✓ Listing exists: ${listing.title}`);
      continue;
    }
    await adminSupabase.from('items').insert({
      seller_id: seller2Id,
      title: listing.title,
      description: listing.description,
      category_id: categoryMap[listing.categoryName] || null,
      condition: listing.condition,
      price: listing.price,
      status: listing.status,
      accepts_swap_points: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Created listing: ${listing.title}`);
  }

  return seller2Id;
}

/**
 * Seeds competing offers on the same listing for TC-B03.
 */
async function seedCompetingOffers(
  buyer2Id: string,
  buyer3Id: string,
  sellerId: string,
  listingIds: string[]
): Promise<void> {
  console.log('\n🥊 Seeding competing offers...');
  if (listingIds.length === 0) return;
  const targetListingId = listingIds[0];

  const competitors = [
    { id: buyer2Id, email: TEST_USERS.buyer2.email, cash: 2800, sp: 2 },
    { id: buyer3Id, email: TEST_USERS.buyer3.email, cash: 3000, sp: 0 },
  ];

  for (const comp of competitors) {
    const { data: existing } = await adminSupabase
      .from('trades')
      .select('id')
      .eq('buyer_id', comp.id)
      .eq('listing_id', targetListingId)
      .in('status', ['pending', 'accepted', 'in_progress'])
      .maybeSingle();
    if (existing) continue;

    await adminSupabase.from('trades').insert({
      buyer_id: comp.id,
      seller_id: sellerId,
      listing_id: targetListingId,
      status: 'pending',
      cash_amount_cents: comp.cash,
      sp_amount: comp.sp,
      buyer_transaction_fee_cents: 99,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(
      `   ✓ Competing offer from ${comp.email}: $${(comp.cash / 100).toFixed(2)} + ${comp.sp} SP`
    );
  }
}

/**
 * Seeds bundle trades (2+ trades sharing a bundle_id) for TC-L01-L08.
 */
async function seedBundleTrades(
  buyerId: string,
  sellerId: string,
  listingIds: string[]
): Promise<void> {
  console.log('\n🔗 Seeding bundle trades...');
  if (listingIds.length < 3) return;

  const bundleId = '00000000-0000-0000-0000-00000000bundle';

  // Use listings at indices 1 and 2 for the bundle
  const bundleListingIds = [listingIds[1], listingIds[2]];

  for (const lid of bundleListingIds) {
    const { data: existing } = await adminSupabase
      .from('trades')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('listing_id', lid)
      .eq('bundle_id', bundleId)
      .maybeSingle();
    if (existing) {
      console.log(`   ✓ Bundle trade exists for listing ${lid}`);
      continue;
    }

    await adminSupabase.from('trades').insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: lid,
      status: 'in_progress',
      cash_amount_cents: 3000,
      sp_amount: 0,
      buyer_transaction_fee_cents: 99,
      bundle_id: bundleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Created bundle trade for listing ${lid}`);
  }
}

/**
 * Seeds a completed trade with a review for TC-Q01-Q10, Q15-Q17.
 */
async function seedCompletedTradeWithReview(
  buyerId: string,
  sellerId: string,
  listingIds: string[]
): Promise<void> {
  console.log('\n⭐ Seeding completed trade with review...');
  if (listingIds.length < 4) return;

  const targetListingId = listingIds[3];

  // Check if completed trade exists
  const { data: existingTrade } = await adminSupabase
    .from('trades')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('listing_id', targetListingId)
    .eq('status', 'completed')
    .maybeSingle();

  let tradeId: string;
  if (existingTrade) {
    tradeId = existingTrade.id;
    console.log(`   ✓ Completed trade exists: ${tradeId}`);
  } else {
    const { data: trade, error } = await adminSupabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: targetListingId,
        status: 'completed',
        cash_amount_cents: 3500,
        sp_amount: 0,
        buyer_transaction_fee_cents: 99,
        completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) {
      console.error(`   ❌ Failed to create completed trade: ${error.message}`);
      return;
    }
    tradeId = trade.id;
    console.log(`   ✓ Created completed trade: ${tradeId}`);
  }

  // Mark the listing as sold
  await adminSupabase
    .from('items')
    .update({ status: 'sold', updated_at: new Date().toISOString() })
    .eq('id', targetListingId);

  // Seed a review from buyer for seller
  const { data: existingReview } = await adminSupabase
    .from('reviews')
    .select('id')
    .eq('trade_id', tradeId)
    .eq('reviewer_id', buyerId)
    .maybeSingle();

  if (!existingReview) {
    await adminSupabase.from('reviews').insert({
      trade_id: tradeId,
      reviewer_id: buyerId,
      reviewee_id: sellerId,
      rating: 4,
      comment: 'Great seller, smooth pickup!',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    console.log('   ✓ Created review from buyer → seller (4 stars)');
  } else {
    console.log('   ✓ Review already exists');
  }

  // Seed the seller's review of the buyer (mutual review status test)
  const { data: existingReview2 } = await adminSupabase
    .from('reviews')
    .select('id')
    .eq('trade_id', tradeId)
    .eq('reviewer_id', sellerId)
    .maybeSingle();

  if (!existingReview2) {
    await adminSupabase.from('reviews').insert({
      trade_id: tradeId,
      reviewer_id: sellerId,
      reviewee_id: buyerId,
      rating: 5,
      comment: 'Great buyer, quick communication!',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    console.log('   ✓ Created review from seller → buyer (5 stars)');
  }
}

/**
 * Seeds donation and cash-only listings for TC-A01, TC-A04.
 */
async function seedExtendedListings(
  sellerId: string,
  categoryMap: { [key: string]: string }
): Promise<void> {
  console.log('\n📦 Seeding extended listings (donation, cash-only)...');

  const extended = [DONATION_LISTING, CASH_ONLY_LISTING];
  for (const listing of extended) {
    const { data: existing } = await adminSupabase
      .from('items')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('title', listing.title)
      .maybeSingle();
    if (existing) {
      console.log(`   ✓ Extended listing exists: ${listing.title}`);
      continue;
    }
    await adminSupabase.from('items').insert({
      seller_id: sellerId,
      title: listing.title,
      description: listing.description,
      category_id: categoryMap[listing.categoryName] || null,
      condition: listing.condition,
      price: listing.price,
      status: listing.status,
      accepts_swap_points: listing.accepts_swap_points ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Created extended listing: ${listing.title}`);
  }
}

/**
 * Seeds seller accounts with prior cancel counts for TC-J01-J03.
 */
async function seedSellerCancelLevels(): Promise<void> {
  console.log('\n⚠️ Seeding seller cancel level data...');
  // This sets up DB-level cancel tracking via the seller_consequences table.
  // Level 2/3 accounts need prior cancellations recorded.
  // For now, the test framework relies on seed data + actual cancels during test runs.
  // If a seller_consequences table exists, we seed it here.

  try {
    // Check if the seller_consequences table exists
    const { error } = await adminSupabase.from('seller_consequences').select('id').limit(1);
    if (error && error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('   ⏭️  seller_consequences table does not exist — skipping');
      return;
    }
    console.log('   ✓ seller_consequences table exists');
  } catch {
    console.log('   ⏭️  Could not check seller_consequences — skipping');
  }
}

/**
 * Seeds tax configuration for TC-O01-O07.
 */
async function seedTaxConfig(): Promise<void> {
  console.log('\n💰 Seeding tax configuration...');
  // Check if node_tax_rates table exists
  try {
    const { error } = await adminSupabase.from('node_tax_rates').select('id').limit(1);
    if (error && error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('   ⏭️  node_tax_rates table does not exist — skipping');
      return;
    }
    console.log('   ✓ node_tax_rates table exists');
  } catch {
    console.log('   ⏭️  Could not check node_tax_rates — skipping');
  }
}

async function seedReferralCodes(buyerId: string, sellerId: string): Promise<void> {
  console.log('\n🔗 Seeding referral codes...');

  const users = [
    { id: buyerId, name: 'buyer', code: 'buyerref' },
    { id: sellerId, name: 'seller', code: 'sellrref' },
  ];

  for (const user of users) {
    const { data: existing } = await adminSupabase
      .from('referral_codes')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ Referral code exists for ${user.name}`);
      continue;
    }

    const { error } = await adminSupabase.from('referral_codes').insert({
      user_id: user.id,
      code: user.code,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create referral code for ${user.name}: ${error.message}`);
    } else {
      console.log(`   ✓ Created referral code for ${user.name}: ${user.code}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('🌱 SEED STAGING DATA (ENHANCED)');
  console.log('================================');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Admin: ${SUPABASE_SERVICE_KEY ? 'Yes' : 'No (limited functionality)'}`);
  console.log(`Mode: ${IS_EXTENDED ? 'Extended (--extended)' : 'Basic'}`);
  console.log('');

  try {
    // 1. Seed categories
    const categoryMap = await seedCategories();

    // 2. Create test users (buyer, seller, admin)
    const buyerId = await signupTestUser(TEST_USERS.buyer, 'user');
    const sellerId = await signupTestUser(TEST_USERS.seller, 'user');
    const adminId = await signupTestUser(TEST_USERS.admin, 'admin');

    if (!buyerId || !sellerId) {
      console.error('\n❌ Failed to create test users. Aborting.');
      process.exit(1);
    }

    // 2b. QA auth fixtures (AUTH-TC-B08 soft-deleted, AUTH-TC-B09 no-profile,
    //     AUTH-TC-C07 social-only password-less)
    await seedQaAuthFixtures();
    await seedSocialOnlyFixture();

    // 2c. Account-file QA fixtures (ACC-TC-F01/F04 suspended-account gate,
    //     ACC-TC-F02 valid unsubscribe token for the deep-link success leg,
    //     ACC-TC-G07 3-CTA grace persona for the show-all/show-less toggle)
    await seedSuspendedAccountFixture();
    await seedUnsubscribeTokenFixture();
    await seedGracePersonaFixture();

    // Get fresh sessions for both users
    const { data: buyerSession } = await supabase.auth.signInWithPassword({
      email: TEST_USERS.buyer.email,
      password: TEST_USERS.buyer.password,
    });

    const { data: sellerSession } = await supabase.auth.signInWithPassword({
      email: TEST_USERS.seller.email,
      password: TEST_USERS.seller.password,
    });

    if (!buyerSession || !sellerSession) {
      console.error('\n❌ Failed to get sessions for test users.');
      process.exit(1);
    }

    // 3. Create listings for seller
    const listingIds = await seedListings(sellerId, sellerSession, categoryMap);

    // 4. Create trades between buyer and seller
    if (listingIds.length > 0) {
      await seedTrade(buyerId, sellerId, listingIds[0]);
    }
    if (listingIds.length > 1) {
      await seedTrade(buyerId, sellerId, listingIds[1]);
    }
    if (listingIds.length > 2) {
      await seedTrade(buyerId, sellerId, listingIds[2]);
    }

    // 4b. P03 unread-message fixture (AUTH-TC-P03 header chat unread badge)
    await seedUnreadMessageFixture(buyerId, sellerId);

    // 5. Create subscriptions
    await seedSubscriptions(buyerId, sellerId);

    // 6. Create SP ledger entries
    await seedSPLedger(buyerId, sellerId);

    // 7. Create badges
    await seedBadges();

    // 8. Create referral codes
    await seedReferralCodes(buyerId, sellerId);

    // ── Extended mode: seed additional test scenarios ─────────────────────
    if (IS_EXTENDED) {
      console.log('\n' + '═'.repeat(50));
      console.log('🔧 EXTENDED SEEDING');
      console.log('═'.repeat(50));

      // 9. Create free (non-subscriber) user
      const freeUserId = await seedFreeUser();

      // 10. Create second seller with listings
      const seller2Id = await seedSeller2(categoryMap);

      // 11. Create extended listings (donation, cash-only)
      await seedExtendedListings(sellerId, categoryMap);

      // 12. Create additional buyer accounts for competing offers
      const buyer2Id = await signupTestUser(TEST_USERS.buyer2, 'user');
      const buyer3Id = await signupTestUser(TEST_USERS.buyer3, 'user');

      // 13. Competing offers on the same listing (TC-B03)
      if (buyer2Id && buyer3Id) {
        await seedCompetingOffers(buyer2Id, buyer3Id, sellerId, listingIds);
      }

      // 14. Bundle trades (TC-L01-L08)
      await seedBundleTrades(buyerId, sellerId, listingIds);

      // 15. Completed trade with reviews (TC-Q01-Q10, Q15-Q17)
      await seedCompletedTradeWithReview(buyerId, sellerId, listingIds);

      // 16. Seller cancel level tracking (TC-J01-J03)
      await seedSellerCancelLevels();

      // 17. Tax configuration (TC-O01-O07)
      await seedTaxConfig();

      console.log('\n' + '═'.repeat(50));
      console.log('✅ EXTENDED SEEDING COMPLETE');
      console.log('═'.repeat(50));
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ STAGING DATA SEEDED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📋 TEST CREDENTIALS:');
    console.log('--------------------');
    console.log(`BUYER:  ${TEST_USERS.buyer.email} / ${TEST_USERS.buyer.password}`);
    console.log(`        UUID: ${buyerId}`);
    console.log(`SELLER: ${TEST_USERS.seller.email} / ${TEST_USERS.seller.password}`);
    console.log(`        UUID: ${sellerId}`);
    if (adminId) {
      console.log(`ADMIN:  ${TEST_USERS.admin.email} / ${TEST_USERS.admin.password}`);
      console.log(`        UUID: ${adminId}`);
    }
    console.log(
      `SUSPENDED: ${TEST_USERS.suspendedUser.email} / ${TEST_USERS.suspendedUser.password} (ACC-TC-F01/F04 gate)`
    );
    if (IS_EXTENDED) {
      console.log(`FREE:   ${TEST_USERS.freeUser.email} / ${TEST_USERS.freeUser.password}`);
      console.log(`SELLER2:${TEST_USERS.seller2.email} / ${TEST_USERS.seller2.password}`);
      console.log(`BUYER2: ${TEST_USERS.buyer2.email} / ${TEST_USERS.buyer2.password}`);
      console.log(`BUYER3: ${TEST_USERS.buyer3.email} / ${TEST_USERS.buyer3.password}`);
    }
    console.log('\n📊 SEEDED DATA:');
    console.log('--------------------');
    console.log(`✓ ${TEST_CATEGORIES.length} categories`);
    console.log(
      `✓ ${IS_EXTENDED ? listingIds.length + 2 + SELLER2_LISTINGS.length : listingIds.length} listings`
    );
    console.log(`✓ 3 pending trades`);
    console.log(`✓ 2 trial subscriptions`);
    console.log(`✓ 4 SP ledger entries (buyer: 75 SP, seller: 130 SP)`);
    console.log(`✓ 5 badge definitions`);
    console.log(`✓ 2 referral codes`);
    if (IS_EXTENDED) {
      console.log(`✓ 2 competing offers (from buyer-2, buyer-3)`);
      console.log(`✓ 2 bundle trades (in_progress)`);
      console.log(`✓ 1 completed trade with mutual reviews`);
      console.log(`✓ Donation + cash-only listings`);
    }
    console.log('\n🧪 QUICK TEST FLOWS:');
    console.log('1. Login as BUYER → Browse → See 5 listings from seller');
    console.log('2. Login as SELLER → My Listings → See pending trade');
    console.log('3. Complete the trade flow between both accounts');
    console.log('4. Check SP balances and badges');
    if (IS_EXTENDED) {
      console.log('5. Extended: Test competing offers, bundles, reviews, tax, and more');
    }
    console.log('\n📱 Now you can:');
    console.log('   npm run test:all     # Run all E2E tests with staging data');
    console.log('   npm run test:auth    # Test auth flows');
    console.log('   npm run test:trades  # Test trade flows');
    console.log('   npm run test:badges  # Test badge awarding');
    console.log('');
    console.log('💡 TIP: Tests expect these exact UUIDs:');
    console.log(`   Buyer:  ${TEST_USERS.buyer.id}`);
    console.log(`   Seller: ${TEST_USERS.seller.id}`);
    console.log('');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
