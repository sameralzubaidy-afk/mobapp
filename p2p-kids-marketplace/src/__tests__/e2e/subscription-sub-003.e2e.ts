// File: p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-003.e2e.ts
// Purpose: MODULE-11 SUB-003 E2E Tests - Complete trial enrollment flow from UI to DB

import { supabase } from '@/config/supabase';
import { enrollInTrialSubscription, checkTrialEligibility } from '@/services/subscription';

describe('MODULE-11 SUB-003 E2E: Start 30-Day Free Trial', () => {
  const TEST_USER_EMAIL = `sub003-e2e-${Date.now()}@test.com`;
  const TEST_USER_PASSWORD = 'TestPassword123!';
  let testUserId: string;

  beforeAll(async () => {
    console.log('🧪 SUB-003 E2E Test: Setup');
    
    // Create test user (simulate signup)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (authError) {
      console.error('❌ Test user creation failed:', authError);
      throw authError;
    }

    testUserId = authData.user!.id;
    console.log('✅ Test user created:', testUserId);

    // Create free subscription (simulates what happens after signup)
    await supabase.from('subscriptions').insert({
      user_id: testUserId,
      status: 'free',
      trial_used_at: null,
    });
  });

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
      const eligibility = await checkTrialEligibility(testUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBeUndefined();
    });

    it('should return eligible=false after trial is used', async () => {
      // Start trial
      await enrollInTrialSubscription(testUserId);

      // Check eligibility again
      const eligibility = await checkTrialEligibility(testUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('already used');
    });
  });

  describe('Trial Enrollment Flow (UI Service Layer)', () => {
    it('should enroll user in trial via enrollInTrialSubscription service', async () => {
      // This simulates what happens when user clicks "Try Kids Club+ Free" button
      const result = await enrollInTrialSubscription(testUserId);

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription!.status).toBe('trial');

      // Verify subscription in DB
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', testUserId)
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
    });

    it('should fail gracefully when attempting second trial enrollment', async () => {
      // First trial
      await enrollInTrialSubscription(testUserId);

      // Cancel and revert to free (simulate user cancelling trial)
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'free',
          trial_start_date: null,
          trial_end_date: null,
        })
        .eq('user_id', testUserId);

      // Attempt second trial
      const result = await enrollInTrialSubscription(testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('TRIAL_ALREADY_USED');
    });
  });

  describe('Database Consistency', () => {
    it('should maintain referential integrity with sp_wallets table', async () => {
      // Enroll in trial
      await enrollInTrialSubscription(testUserId);

      // Verify SP wallet exists for user
      const { data: wallet, error } = await supabase
        .from('sp_wallets')
        .select('*')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(wallet).toBeDefined();
      expect(wallet!.status).toBe('active'); // Should be active for trial users
    });

    it('should respect admin config for trial duration', async () => {
      // Query admin config
      const { data: config } = await supabase
        .from('admin_config')
        .select('value')
        .eq('category', 'trial_subscription')
        .eq('key', 'duration_days')
        .single();

      const expectedDuration = config ? parseInt(config.value as string, 10) : 30;

      // Create new test user
      const newUserId = `${Date.now()}-config-test`;
      await supabase.from('subscriptions').insert({
        user_id: newUserId,
        status: 'free',
        trial_used_at: null,
      });

      // Enroll in trial
      await enrollInTrialSubscription(newUserId);

      // Verify duration matches config
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('trial_start_date, trial_end_date')
        .eq('user_id', newUserId)
        .single();

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
      // Enroll in trial
      await enrollInTrialSubscription(testUserId);

      // Simulate sending day 23 reminder
      await supabase
        .from('subscriptions')
        .update({ trial_reminder_day_23_sent: true })
        .eq('user_id', testUserId);

      // Verify flag updated
      const { data: sub1 } = await supabase
        .from('subscriptions')
        .select('trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
        .eq('user_id', testUserId)
        .single();

      expect(sub1!.trial_reminder_day_23_sent).toBe(true);
      expect(sub1!.trial_reminder_day_28_sent).toBe(false);
      expect(sub1!.trial_reminder_day_29_sent).toBe(false);

      // Simulate sending day 28 reminder
      await supabase
        .from('subscriptions')
        .update({ trial_reminder_day_28_sent: true })
        .eq('user_id', testUserId);

      // Verify both flags
      const { data: sub2 } = await supabase
        .from('subscriptions')
        .select('trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
        .eq('user_id', testUserId)
        .single();

      expect(sub2!.trial_reminder_day_23_sent).toBe(true);
      expect(sub2!.trial_reminder_day_28_sent).toBe(true);
      expect(sub2!.trial_reminder_day_29_sent).toBe(false);
    });
  });
});
