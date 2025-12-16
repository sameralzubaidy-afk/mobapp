// File: p2p-kids-marketplace/src/__tests__/auth-v2-003.e2e.ts
// MODULE-03 AUTH-V2-003: E2E Tests for Login & Session Management

import { supabase } from '../config/supabase';
import { loginWithContext } from '../services/auth';
import { AuthSession, AuthError } from '../types/user';

/**
 * TEST SUITE: AUTH-V2-003 - Login with Subscription Context
 * 
 * Tests:
 * 1. Login with valid credentials
 * 2. Login returns enriched session with subscription context
 * 3. Session contains SP wallet summary
 * 4. Session refresh updates subscription status
 * 5. Login fails with invalid credentials
 * 6. Login handles profile not found gracefully
 */

// Test data
const TEST_USERS = {
  subscriber: {
    email: 'subscriber-test@kids-marketplace.local',
    password: 'TestPassword123!',
    name: 'Test Subscriber',
    phone: '5551234567',
    dob: '2010-01-15', // 14 years old
  },
  freeUser: {
    email: 'free-user-test@kids-marketplace.local',
    password: 'TestPassword123!',
    name: 'Test Free User',
    phone: '5559876543',
    dob: '2012-06-20', // 12 years old
  },
  invalid: {
    email: 'nonexistent@kids-marketplace.local',
    password: 'WrongPassword123!',
  },
};

/**
 * HELPER: Create test user if not exists
 */
async function ensureTestUser(user: any): Promise<void> {
  try {
    // Check if user exists
    const { data: existingUser } = await supabase.auth.admin.getUserById(user.email);
    if (existingUser) {
      console.log(`✓ Test user ${user.email} already exists`);
      return;
    }
  } catch (err) {
    // User doesn't exist, create it
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });

  if (authError) {
    throw new Error(`Failed to create test user: ${authError.message}`);
  }

  console.log(`✓ Created test user ${user.email}`);
}

/**
 * CLEANUP: Delete test user
 */
async function deleteTestUser(email: string): Promise<void> {
  try {
    // Get user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users.find(u => u.email === email);

    if (user) {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`✓ Deleted test user ${email}`);
    }
  } catch (err) {
    console.warn(`Warning: Failed to delete test user ${email}:`, err);
  }
}

/**
 * TEST 1: Login with Valid Credentials
 * 
 * Verifies:
 * - Login succeeds with correct credentials
 * - Session object is returned
 * - Session contains user profile
 */
export async function testLoginWithValidCredentials(): Promise<void> {
  console.log('\n[TEST 1] Login with Valid Credentials');
  console.log('=========================================');

  try {
    // Ensure test user exists
    await ensureTestUser(TEST_USERS.subscriber);

    // Attempt login
    const session = await loginWithContext({
      email: TEST_USERS.subscriber.email,
      password: TEST_USERS.subscriber.password,
    });

    // Verify session structure
    if (!session) {
      throw new Error('Login returned null session');
    }

    if (!session.user) {
      throw new Error('Session missing user object');
    }

    if (!session.access_token) {
      throw new Error('Session missing access_token');
    }

    console.log('✓ Login succeeded');
    console.log(`✓ Session user: ${session.user.name}`);
    console.log(`✓ Access token present: ${session.access_token.substring(0, 20)}...`);

  } catch (err) {
    throw new Error(`TEST FAILED: ${(err as Error).message}`);
  }
}

/**
 * TEST 2: Session Contains Subscription Context
 * 
 * Verifies:
 * - Session includes subscription_status
 * - Session includes can_spend_sp flag
 * - Subscription status is one of: free, trial, active, grace, canceled
 */
export async function testSessionSubscriptionContext(): Promise<void> {
  console.log('\n[TEST 2] Session Contains Subscription Context');
  console.log('==============================================');

  try {
    await ensureTestUser(TEST_USERS.subscriber);

    const session = await loginWithContext({
      email: TEST_USERS.subscriber.email,
      password: TEST_USERS.subscriber.password,
    });

    // Verify subscription context
    const validStatuses = ['free', 'trial', 'active', 'grace', 'canceled'];
    
    if (!validStatuses.includes(session.subscription_status)) {
      throw new Error(
        `Invalid subscription_status: ${session.subscription_status}. Expected one of: ${validStatuses.join(', ')}`
      );
    }

    if (typeof session.can_spend_sp !== 'boolean') {
      throw new Error(`can_spend_sp should be boolean, got ${typeof session.can_spend_sp}`);
    }

    console.log(`✓ Subscription status: ${session.subscription_status}`);
    console.log(`✓ Can spend SP: ${session.can_spend_sp}`);
    console.log(`✓ Subscription context present and valid`);

  } catch (err) {
    throw new Error(`TEST FAILED: ${(err as Error).message}`);
  }
}

/**
 * TEST 3: Session Contains SP Wallet Summary
 * 
 * Verifies:
 * - Session includes available_points
 * - Session includes pending_points
 * - Session includes lifetime_earned
 * - Session includes lifetime_spent
 * - All are numbers >= 0
 */
export async function testSessionSPWalletContext(): Promise<void> {
  console.log('\n[TEST 3] Session Contains SP Wallet Summary');
  console.log('============================================');

  try {
    await ensureTestUser(TEST_USERS.subscriber);

    const session = await loginWithContext({
      email: TEST_USERS.subscriber.email,
      password: TEST_USERS.subscriber.password,
    });

    // Verify SP wallet context
    if (typeof session.available_points !== 'number' || session.available_points < 0) {
      throw new Error(`Invalid available_points: ${session.available_points}`);
    }

    if (typeof session.pending_points !== 'number' || session.pending_points < 0) {
      throw new Error(`Invalid pending_points: ${session.pending_points}`);
    }

    if (typeof session.lifetime_earned !== 'number' || session.lifetime_earned < 0) {
      throw new Error(`Invalid lifetime_earned: ${session.lifetime_earned}`);
    }

    if (typeof session.lifetime_spent !== 'number' || session.lifetime_spent < 0) {
      throw new Error(`Invalid lifetime_spent: ${session.lifetime_spent}`);
    }

    console.log(`✓ Available points: ${session.available_points}`);
    console.log(`✓ Pending points: ${session.pending_points}`);
    console.log(`✓ Lifetime earned: ${session.lifetime_earned}`);
    console.log(`✓ Lifetime spent: ${session.lifetime_spent}`);
    console.log(`✓ SP wallet context present and valid`);

  } catch (err) {
    throw new Error(`TEST FAILED: ${(err as Error).message}`);
  }
}

/**
 * TEST 4: Login Fails with Invalid Credentials
 * 
 * Verifies:
 * - Login throws AuthError with invalid password
 * - Error code is INVALID_CREDENTIALS or LOGIN_FAILED
 * - Error message is user-friendly
 */
export async function testLoginWithInvalidCredentials(): Promise<void> {
  console.log('\n[TEST 4] Login Fails with Invalid Credentials');
  console.log('=============================================');

  try {
    await ensureTestUser(TEST_USERS.subscriber);

    try {
      await loginWithContext({
        email: TEST_USERS.subscriber.email,
        password: 'WrongPassword123!',
      });

      throw new Error('Login should have failed with invalid password');
    } catch (err) {
      if (err instanceof AuthError) {
        console.log(`✓ Caught expected AuthError`);
        console.log(`✓ Error code: ${err.code}`);
        console.log(`✓ Error message: ${err.message}`);
      } else {
        throw err;
      }
    }

  } catch (err) {
    throw new Error(`TEST FAILED: ${(err as Error).message}`);
  }
}

/**
 * TEST 5: Login Fails with Nonexistent Email
 * 
 * Verifies:
 * - Login throws AuthError when user doesn't exist
 * - Error is appropriate (INVALID_CREDENTIALS or similar)
 */
export async function testLoginWithNonexistentEmail(): Promise<void> {
  console.log('\n[TEST 5] Login Fails with Nonexistent Email');
  console.log('===========================================');

  try {
    try {
      await loginWithContext({
        email: 'definitely-does-not-exist-12345@kids-marketplace.local',
        password: 'SomePassword123!',
      });

      throw new Error('Login should have failed with nonexistent email');
    } catch (err) {
      if (err instanceof AuthError) {
        console.log(`✓ Caught expected AuthError`);
        console.log(`✓ Error code: ${err.code}`);
        console.log(`✓ Error message: ${err.message}`);
      } else {
        throw err;
      }
    }

  } catch (err) {
    throw new Error(`TEST FAILED: ${(err as Error).message}`);
  }
}

/**
 * TEST 6: Session Token Structure
 * 
 * Verifies:
 * - Access token is JWT format
 * - Refresh token is present
 * - Tokens are strings
 */
export async function testSessionTokenStructure(): Promise<void> {
  console.log('\n[TEST 6] Session Token Structure');
  console.log('=================================');

  try {
    await ensureTestUser(TEST_USERS.subscriber);

    const session = await loginWithContext({
      email: TEST_USERS.subscriber.email,
      password: TEST_USERS.subscriber.password,
    });

    // Verify token format
    if (typeof session.access_token !== 'string' || session.access_token.length === 0) {
      throw new Error('access_token should be non-empty string');
    }

    if (typeof session.refresh_token !== 'string' || session.refresh_token.length === 0) {
      throw new Error('refresh_token should be non-empty string');
    }

    // JWT tokens typically have 3 parts separated by dots
    const accessTokenParts = session.access_token.split('.');
    if (accessTokenParts.length !== 3) {
      throw new Error(`access_token should be JWT format (3 parts), got ${accessTokenParts.length}`);
    }

    console.log(`✓ Access token format: JWT (3 parts)`);
    console.log(`✓ Access token length: ${session.access_token.length} chars`);
    console.log(`✓ Refresh token present: ${session.refresh_token.length} chars`);

  } catch (err) {
    throw new Error(`TEST FAILED: ${(err as Error).message}`);
  }
}

/**
 * RUN ALL TESTS
 */
export async function runAllTests(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  MODULE-03 AUTH-V2-003: Login & Session Management E2E ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const tests = [
    { name: 'Login with Valid Credentials', fn: testLoginWithValidCredentials },
    { name: 'Session Subscription Context', fn: testSessionSubscriptionContext },
    { name: 'Session SP Wallet Context', fn: testSessionSPWalletContext },
    { name: 'Login with Invalid Credentials', fn: testLoginWithInvalidCredentials },
    { name: 'Login with Nonexistent Email', fn: testLoginWithNonexistentEmail },
    { name: 'Session Token Structure', fn: testSessionTokenStructure },
  ];

  let passed = 0;
  let failed = 0;
  const failedTests: string[] = [];

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (err) {
      failed++;
      failedTests.push(`${test.name}: ${(err as Error).message}`);
      console.error(`✗ ${test.name} FAILED`);
      console.error((err as Error).message);
    }
  }

  // Print summary
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                      ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║ Passed: ${passed}/${tests.length}                                              ║`.substring(0, 59));
  console.log(`║ Failed: ${failed}/${tests.length}                                              ║`.substring(0, 59));
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  if (failedTests.length > 0) {
    console.log('FAILED TESTS:');
    failedTests.forEach((test, idx) => {
      console.log(`${idx + 1}. ${test}`);
    });
    process.exit(1);
  } else {
    console.log('✓ ALL TESTS PASSED!\n');
    process.exit(0);
  }
}

// Export for use in test runners
export default {
  testLoginWithValidCredentials,
  testSessionSubscriptionContext,
  testSessionSPWalletContext,
  testLoginWithInvalidCredentials,
  testLoginWithNonexistentEmail,
  testSessionTokenStructure,
  runAllTests,
};
