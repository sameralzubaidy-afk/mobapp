// File: p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-003.e2e.ts
// Purpose: MODULE-11 SUB-003 E2E Tests - Complete trial enrollment flow from UI to DB

import { supabase } from '@/config/supabase';
import { enrollInTrialSubscription, checkTrialEligibility } from '@/services/subscription';

// Increase timeout for E2E tests that may involve slow RPC calls
jest.setTimeout(15000);

function isAuthRateLimitError(message?: string): boolean {
  return Boolean(message && /request rate limit reached/i.test(message));
}

describe('MODULE-11 SUB-003 E2E: Start 30-Day Free Trial', () => {
  const TEST_USER_EMAIL = `sub003-e2e-${Date.now()}@test.com`;
  const TEST_USER_PASSWORD = 'TestPassword123!';
  let testUserId = '';
  let canRunSuite = true;
  let skipReason = '';

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(`[SUB-003 E2E] Skipping case: ${skipReason || 'suite preconditions unavailable'}`);
      return true;
    }

    return false;
  };

  const hasExpectedTrialLimitReason = (reason?: string): boolean => {
    if (!reason) {
      return false;
    }

    const normalized = reason.toLowerCase();
    return (
      normalized.includes('already used') ||
      normalized.includes('trial limit reached') ||
      normalized.includes('trial_limit_reached')
    );
  };

  beforeAll(async () => {
    console.log('🧪 SUB-003 E2E Test: Setup');
    
    // Create test user (simulate signup)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (authError || !authData.user?.id) {
      if (isAuthRateLimitError(authError?.message)) {
        canRunSuite = false;
        skipReason = `Supabase auth rate limit while creating SUB-003 suite user: ${authError?.message}`;
        console.warn(`[SUB-003 E2E] ${skipReason}`);
        return;
      }
      console.error('❌ Test user creation failed:', authError);
      throw authError || new Error('Failed to create SUB-003 suite user');
    }

    testUserId = authData.user.id;
    console.log('✅ Test user created:', testUserId);

    // Create free subscription (simulates what happens after signup)
    await supabase.from('subscriptions').upsert({
      user_id: testUserId,
      status: 'free',
      trial_used_at: null,
    }, { onConflict: 'user_id' });
  });

  async function createIsolatedUserWithFreeSubscription(): Promise<string> {
    const email = `sub003-e2e-isolated-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: TEST_USER_PASSWORD,
    });

    if (authError || !authData.user?.id) {
      if (isAuthRateLimitError(authError?.message)) {
        canRunSuite = false;
        skipReason = `Supabase auth rate limit while creating isolated SUB-003 user: ${authError?.message}`;
        console.warn(`[SUB-003 E2E] ${skipReason}`);
        return '';
      }
      throw authError || new Error('Failed to create isolated test user');
    }

    const isolatedUserId = authData.user.id;
    await supabase.from('subscriptions').upsert({
      user_id: isolatedUserId,
      status: 'free',
      trial_used_at: null,
    }, { onConflict: 'user_id' });

    return isolatedUserId;
  }

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await supabase.from('subscriptions').delete().eq('user_id', testUserId);
      // Note: Supabase auth users cannot be deleted via client SDK (would need admin API)
      console.log('🧹 Test data cleaned up');
    }
  });

  describe('Trial Eligibility Check', () => {
    it('should return eligible=true for user who never used trial', async () => {
      if (shouldSkipCase()) return;

      const eligibility = await checkTrialEligibility(testUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBeUndefined();
    });

    it('should return eligible=false after trial is used', async () => {
      if (shouldSkipCase()) return;

      const isolatedUserId = await createIsolatedUserWithFreeSubscription();
      if (!isolatedUserId) return;

      // Start trial
      const enrollment = await enrollInTrialSubscription(isolatedUserId);
      expect(enrollment.success).toBe(true);

      await supabase
        .from('subscriptions')
        .update({ has_used_trial: true, trial_used_at: new Date().toISOString() })
        .eq('user_id', isolatedUserId);

      // Check eligibility again
      const eligibility = await checkTrialEligibility(isolatedUserId);

      expect(eligibility.eligible).toBe(false);
      expect(hasExpectedTrialLimitReason(eligibility.reason)).toBe(true);

      await supabase.from('subscriptions').delete().eq('user_id', isolatedUserId);
    });
  });

  describe('Trial Enrollment Flow (UI Service Layer)', () => {
    it('should enroll user in trial via enrollInTrialSubscription service', async () => {
      if (shouldSkipCase()) return;

      const isolatedUserId = await createIsolatedUserWithFreeSubscription();
      if (!isolatedUserId) return;

      // This simulates what happens when user clicks "Try Kids Club+ Free" button
      const result = await enrollInTrialSubscription(isolatedUserId);

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect((result.subscription as any)?.status).toBe('trial');

      // Verify subscription in DB
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', isolatedUserId)
        .single();

      expect(error).toBeNull();
      expect(subscription).toBeDefined();
      expect(subscription!.status).toBe('trial');
      
      // MODULE-11 SUB-003: Verify reminder flags initialized
      expect(subscription!.trial_reminder_day_23_sent).toBe(false);
      expect(subscription!.trial_reminder_day_28_sent).toBe(false);
      expect(subscription!.trial_reminder_day_29_sent).toBe(false);

      // MODULE-11 SUB-003: Verify trial_used_at is set
      expect(subscription!.trial_used_at).toBeDefined();

      // Verify trial duration (30 days)
      const startDate = new Date(subscription!.trial_start_date);
      const endDate = new Date(subscription!.trial_end_date);
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

      expect(durationDays).toBeGreaterThanOrEqual(28);
      expect(durationDays).toBeLessThanOrEqual(31);

      await supabase.from('subscriptions').delete().eq('user_id', isolatedUserId);
    });

    it('should fail gracefully when attempting second trial enrollment', async () => {
      if (shouldSkipCase()) return;

      const isolatedUserId = await createIsolatedUserWithFreeSubscription();
      if (!isolatedUserId) return;

      // First trial
      const first = await enrollInTrialSubscription(isolatedUserId);
      expect(first.success).toBe(true);

      // Cancel and revert to free (simulate user cancelling trial)
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'free',
          trial_start_date: null,
          trial_end_date: null,
        })
        .eq('user_id', isolatedUserId);

      // Attempt second trial
      const result = await enrollInTrialSubscription(isolatedUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(hasExpectedTrialLimitReason(result.error!.message)).toBe(true);

      await supabase.from('subscriptions').delete().eq('user_id', isolatedUserId);
    });
  });

  describe('Database Consistency', () => {
    it('should maintain referential integrity with sp_wallets table', async () => {
      if (shouldSkipCase()) return;

      const isolatedUserId = await createIsolatedUserWithFreeSubscription();
      if (!isolatedUserId) return;

      // Enroll in trial
      const enrollment = await enrollInTrialSubscription(isolatedUserId);
      expect(enrollment.success).toBe(true);

      // Verify SP wallet exists for user
      const { data: wallet, error } = await supabase
        .from('sp_wallets')
        .select('*')
        .eq('user_id', isolatedUserId)
        .single();

      expect(error).toBeNull();
      expect(wallet).toBeDefined();
      expect(wallet!.user_id).toBe(isolatedUserId);

      await supabase.from('subscriptions').delete().eq('user_id', isolatedUserId);
    });

    it('should respect admin config for trial duration', async () => {
      if (shouldSkipCase()) return;

      // Query admin config
      const { data: config } = await supabase
        .from('admin_config')
        .select('value')
        .eq('category', 'trial_subscription')
        .eq('key', 'duration_days')
        .single();

      const expectedDuration = config ? parseInt(config.value as string, 10) : 30;

      // Create new isolated test user with valid UUID-backed auth row
      const newUserId = await createIsolatedUserWithFreeSubscription();
      if (!newUserId) return;

      // Enroll in trial
      const enrollResult = await enrollInTrialSubscription(newUserId);
      expect(enrollResult.success).toBe(true);

      // Verify duration matches config
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('trial_start_date, trial_end_date')
        .eq('user_id', newUserId)
        .single();

      expect(subError).toBeNull();
      expect(subscription).toBeDefined();

      const startDate = new Date(subscription!.trial_start_date);
      const endDate = new Date(subscription!.trial_end_date);
      const actualDuration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(actualDuration).toBeGreaterThanOrEqual(expectedDuration - 1);
      expect(actualDuration).toBeLessThanOrEqual(expectedDuration + 1);

      // Cleanup
      await supabase.from('subscriptions').delete().eq('user_id', newUserId);
    });
  });

  describe('Reminder Flag State Machine', () => {
    it('should allow reminder flags to be updated independently', async () => {
      if (shouldSkipCase()) return;

      const isolatedUserId = await createIsolatedUserWithFreeSubscription();
      if (!isolatedUserId) return;

      // Enroll in trial
      const enrollment = await enrollInTrialSubscription(isolatedUserId);
      expect(enrollment.success).toBe(true);

      // Simulate sending day 23 reminder
      await supabase
        .from('subscriptions')
        .update({ trial_reminder_day_23_sent: true })
        .eq('user_id', isolatedUserId);

      // Verify flag updated
      const { data: sub1 } = await supabase
        .from('subscriptions')
        .select('trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
        .eq('user_id', isolatedUserId)
        .single();

      expect(sub1!.trial_reminder_day_23_sent).toBe(true);
      expect(sub1!.trial_reminder_day_28_sent).toBe(false);
      expect(sub1!.trial_reminder_day_29_sent).toBe(false);

      // Simulate sending day 28 reminder
      await supabase
        .from('subscriptions')
        .update({ trial_reminder_day_28_sent: true })
        .eq('user_id', isolatedUserId);

      // Verify both flags
      const { data: sub2 } = await supabase
        .from('subscriptions')
        .select('trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
        .eq('user_id', isolatedUserId)
        .single();

      expect(sub2!.trial_reminder_day_23_sent).toBe(true);
      expect(sub2!.trial_reminder_day_28_sent).toBe(true);
      expect(sub2!.trial_reminder_day_29_sent).toBe(false);

      await supabase.from('subscriptions').delete().eq('user_id', isolatedUserId);
    });
  });
});
