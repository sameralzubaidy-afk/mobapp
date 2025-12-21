// File: src/services/__tests__/auth.integration.test.ts
// MODULE-03 AUTH-V2: End-to-end integration tests for signup to trial enrollment

import { supabase } from '@/config/supabase';
import { signup, enrollInTrialSubscription, loginWithContext } from '../auth';
import { SignupInput } from '@/types/user';

/**
 * Integration Test Suite: Signup → Phone Verification → Profile → Subscription Choice → Trial
 * 
 * Tests the complete V2 onboarding flow with admin config integration
 */

describe('AUTH-V2: Complete Signup → Trial Flow', () => {
  const testUserId = 'test-user-' + Date.now();
  const testEmail = `test-${Date.now()}@example.com`;
  const testSignupInput: SignupInput = {
    email: testEmail,
    password: 'TestPassword123!',
    name: 'Test User',
    phone: '5551234567',
    dob: '2000-01-01', // 24+ years old
    referralCode: 'FRIEND2024',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Basic signup creates user without trial activation
   * Expected: User created, profile linked, but NO subscription yet
   */
  it('should create user and profile without trial activation', async () => {
    console.log('🧪 Test 1: Basic signup without trial');

    const { user, error } = await signup(testSignupInput);

    expect(error).toBeNull();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();

    // Verify profile was created
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    expect(profile).toBeDefined();
    expect(profile.phone_verified).toBe(false); // Not verified yet
    expect(profile.subscription_id).toBeNull(); // NO subscription yet (key difference from V1)
    expect(profile.sp_wallet_id).toBeNull(); // NO wallet yet

    // TODO: Phone verification step happens next
    console.log('✅ Test 1 passed: User created without trial');
  });

  /**
   * Test 2: After profile completion, user can enroll in trial
   * Expected: enrollInTrialSubscription checks admin config and activates trial
   */
  it('should enroll in trial after profile completion when admin config allows', async () => {
    console.log('🧪 Test 2: Enroll in trial after profile completion');

    // Setup: Create user
    const { user: newUser } = await signup(testSignupInput);
    const userId = newUser.id;

    // Simulate: Profile completed (set profile_completed = true)
    await supabase
      .from('profiles')
      .update({ profile_completed: true })
      .eq('user_id', userId);

    // Step 1: Check admin config (trial should be enabled by default)
    const { data: isEnabled } = await supabase.rpc('is_trial_enabled', {});
    expect(isEnabled).toBe(true);

    // Step 2: Enroll in trial
    const { subscription, wallet, error: enrollError } = await enrollInTrialSubscription(userId);

    expect(enrollError).toBeUndefined();
    expect(subscription).toBeDefined();
    expect(subscription.status).toBe('trial');
    expect(subscription.trial_start_date).toBeDefined();
    expect(subscription.trial_end_date).toBeDefined();

    expect(wallet).toBeDefined();
    expect(wallet.status).toBe('active');
    expect(wallet.available_points).toBe(0);

    // Verify profile was updated with subscription and wallet links
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    expect(updatedProfile.subscription_id).toBe(subscription.id);
    expect(updatedProfile.sp_wallet_id).toBe(wallet.id);

    console.log('✅ Test 2 passed: Trial enrollment successful with admin config integration');
  });

  /**
   * Test 3: Trial enrollment respects admin config disable flag
   * Expected: If admin disables trial, enrollInTrialSubscription returns error
   */
  it('should respect admin config trial disable flag', async () => {
    console.log('🧪 Test 3: Trial disabled by admin');

    // Setup: Create user
    const { user: newUser } = await signup(testSignupInput);
    const userId = newUser.id;

    // Simulate: Admin disables trial
    await supabase
      .from('admin_config')
      .update({
        config_value: {
          enabled: false,
          duration_days: 30,
          description: '30-day no-card trial for new Kids Club+ subscribers',
        },
      })
      .eq('config_key', 'trial_subscription');

    // Attempt to enroll in trial
    const { subscription, wallet, error: enrollError } = await enrollInTrialSubscription(userId);

    expect(enrollError).toBeDefined();
    expect(enrollError.code).toBe('TRIAL_DISABLED');
    expect(subscription).toBeNull();
    expect(wallet).toBeNull();

    // Restore admin config for other tests
    await supabase
      .from('admin_config')
      .update({
        config_value: {
          enabled: true,
          duration_days: 30,
          description: '30-day no-card trial for new Kids Club+ subscribers',
        },
      })
      .eq('config_key', 'trial_subscription');

    console.log('✅ Test 3 passed: Trial enrollment respects admin disable flag');
  });

  /**
   * Test 4: Admin can configure custom trial duration
   * Expected: enrollInTrialSubscription uses duration from admin_config
   */
  it('should use admin-configured trial duration', async () => {
    console.log('🧪 Test 4: Custom trial duration from admin config');

    // Setup: Create user
    const { user: newUser } = await signup(testSignupInput);
    const userId = newUser.id;

    // Update admin config with custom duration (14 days instead of 30)
    const customDuration = 14;
    await supabase
      .from('admin_config')
      .update({
        config_value: {
          enabled: true,
          duration_days: customDuration,
          description: '30-day no-card trial for new Kids Club+ subscribers',
        },
      })
      .eq('config_key', 'trial_subscription');

    // Enroll in trial with custom duration
    const { subscription, error: enrollError } = await enrollInTrialSubscription(userId);

    expect(enrollError).toBeUndefined();
    expect(subscription).toBeDefined();

    // Calculate expected end date
    const startDate = new Date(subscription.trial_start_date);
    const expectedEndDate = new Date(startDate.getTime() + customDuration * 24 * 60 * 60 * 1000);
    const actualEndDate = new Date(subscription.trial_end_date);

    // Should be approximately equal (within 1 minute)
    const timeDiff = Math.abs(expectedEndDate.getTime() - actualEndDate.getTime());
    expect(timeDiff).toBeLessThan(60000); // 1 minute tolerance

    // Restore default duration for other tests
    await supabase
      .from('admin_config')
      .update({
        config_value: {
          enabled: true,
          duration_days: 30,
          description: '30-day no-card trial for new Kids Club+ subscribers',
        },
      })
      .eq('config_key', 'trial_subscription');

    console.log('✅ Test 4 passed: Custom trial duration respected');
  });

  /**
   * Test 5: Cleanup - user can still log in after trial enrollment
   * Expected: loginWithContext returns enriched session with trial status
   */
  it('should return enriched session with trial status after enrollment', async () => {
    console.log('🧪 Test 5: Login with trial context');

    // Setup: Create user and enroll in trial
    const { user: newUser } = await signup(testSignupInput);
    const userId = newUser.id;

    // Mark profile complete and enroll in trial
    await supabase
      .from('profiles')
      .update({ profile_completed: true })
      .eq('user_id', userId);

    const { subscription: trialSub } = await enrollInTrialSubscription(userId);
    expect(trialSub).toBeDefined();

    // Login and verify enriched session
    const session = await loginWithContext(testEmail, testSignupInput.password);

    expect(session).toBeDefined();
    expect(session.user).toBeDefined();
    expect(session.subscription_status).toBe('trial');
    expect(session.can_spend_sp).toBe(true); // Kids Club+ trial allows SP spending
    expect(session.available_points).toBeGreaterThanOrEqual(0);

    console.log('✅ Test 5 passed: Login returns enriched trial session');
  });

  /**
   * Edge Case: Duplicate trial enrollment (idempotency check)
   * Expected: Second enrollment should fail with subscription already exists error
   */
  it('should prevent duplicate trial enrollments', async () => {
    console.log('🧪 Test 6: Duplicate enrollment prevention');

    // Setup: Create user and enroll in trial once
    const { user: newUser } = await signup(testSignupInput);
    const userId = newUser.id;

    await supabase
      .from('profiles')
      .update({ profile_completed: true })
      .eq('user_id', userId);

    const { subscription: firstSub } = await enrollInTrialSubscription(userId);
    expect(firstSub).toBeDefined();

    // Attempt second enrollment
    const { subscription: secondSub, error: secondError } = await enrollInTrialSubscription(userId);

    // Should fail with "subscription already exists" error
    expect(secondError).toBeDefined();
    expect(secondError.code).toBe('SUBSCRIPTION_CREATION_FAILED');
    expect(secondSub).toBeNull();

    console.log('✅ Test 6 passed: Duplicate enrollment prevented');
  });
});

/**
 * VERIFICATION CHECKLIST - MODULE-03-AUTH-V2
 * 
 * ✅ Test 1: Basic signup creates user without trial (V2 change from V1)
 * ✅ Test 2: enrollInTrialSubscription checks admin config
 * ✅ Test 3: Respects admin trial disable flag
 * ✅ Test 4: Uses admin-configured duration
 * ✅ Test 5: Login returns enriched session with trial status
 * ✅ Test 6: Prevents duplicate enrollments
 * 
 * NEXT STEPS:
 * - Add E2E tests for UI flow (SignupScreen → PhoneVerification → ProfileCompletion → SubscriptionChoiceScreen)
 * - Test error scenarios: network failures, RLS violations, invalid states
 * - Performance: measure signup + trial enrollment latency
 */
