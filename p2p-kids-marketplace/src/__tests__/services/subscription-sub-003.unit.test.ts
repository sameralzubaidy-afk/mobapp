// File: p2p-kids-marketplace/src/__tests__/services/subscription-sub-003.unit.test.ts
// Purpose: MODULE-11 SUB-003 Unit Tests - Trial eligibility and reminder flag initialization

import { supabase } from '@/config/supabase';

describe('MODULE-11 SUB-003: Free Trial Eligibility & Reminder Flags', () => {
  const TEST_USER_PREFIX = 'sub-003-test-';
  let testUserId: string;

  beforeAll(async () => {
    // Use service role client for test setup
    console.log('🧪 SUB-003 Unit Test: Setup');
  });

  afterEach(async () => {
    // Cleanup: delete test subscription if created
    if (testUserId) {
      await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', testUserId);
    }
  });

  describe('Trial Eligibility - One Trial Per User', () => {
    it('should create trial subscription for first-time user with reminder flags initialized', async () => {
      // Generate unique test user ID
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-first-trial`;

      // Call RPC to create trial subscription
      const { data, error } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      // Assert: should succeed
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.status).toBe('trial');
      expect(data.user_id).toBe(testUserId);

      // MODULE-11 SUB-003: Verify reminder flags initialized to FALSE
      expect(data.trial_reminder_day_23_sent).toBe(false);
      expect(data.trial_reminder_day_28_sent).toBe(false);
      expect(data.trial_reminder_day_29_sent).toBe(false);

      // MODULE-11 SUB-003: Verify trial_used_at is set
      expect(data.trial_used_at).toBeDefined();
      expect(new Date(data.trial_used_at).getTime()).toBeLessThanOrEqual(Date.now());

      // Verify trial dates are set correctly (30 days default)
      expect(data.trial_start_date).toBeDefined();
      expect(data.trial_end_date).toBeDefined();

      const startDate = new Date(data.trial_start_date);
      const endDate = new Date(data.trial_end_date);
      const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Should be 30 days (or admin-configured duration)
      expect(durationDays).toBeGreaterThanOrEqual(28); // Allow some buffer for timing
      expect(durationDays).toBeLessThanOrEqual(31);
    });

    it('should reject second trial attempt for user who already used trial', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-second-trial`;

      // First trial: should succeed
      const { data: firstTrial, error: firstError } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(firstError).toBeNull();
      expect(firstTrial.status).toBe('trial');

      // Cancel trial (simulate user cancelling)
      await supabase
        .from('subscriptions')
        .update({ status: 'free', trial_start_date: null, trial_end_date: null })
        .eq('user_id', testUserId);

      // Second trial: should fail with TRIAL_ALREADY_USED error
      const { data: secondTrial, error: secondError } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      // Assert: should fail
      expect(secondError).toBeDefined();
      expect(secondError!.message).toContain('TRIAL_ALREADY_USED');
      expect(secondTrial).toBeNull();
    });

    it('should allow upgrade from free to trial if trial never used', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-upgrade`;

      // Create free subscription first
      await supabase.from('subscriptions').insert({
        user_id: testUserId,
        status: 'free',
        trial_used_at: null, // Never used trial
      });

      // Upgrade to trial
      const { data, error } = await supabase
        .rpc('upgrade_free_subscription_to_trial', { p_user_id: testUserId });

      // Assert: should succeed
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.status).toBe('trial');

      // MODULE-11 SUB-003: Verify reminder flags
      expect(data.trial_reminder_day_23_sent).toBe(false);
      expect(data.trial_reminder_day_28_sent).toBe(false);
      expect(data.trial_reminder_day_29_sent).toBe(false);
      expect(data.trial_used_at).toBeDefined();
    });

    it('should be idempotent - calling create_trial_subscription on existing trial returns same subscription', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-idempotent`;

      // First call
      const { data: first, error: firstError } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(firstError).toBeNull();
      const firstTrialId = first.id;
      const firstTrialUsedAt = first.trial_used_at;

      // Second call (should be idempotent)
      const { data: second, error: secondError } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(secondError).toBeNull();
      expect(second.id).toBe(firstTrialId); // Same subscription
      expect(second.status).toBe('trial');
      expect(second.trial_used_at).toBe(firstTrialUsedAt); // Unchanged
    });
  });

  describe('Reminder Flags Initialization', () => {
    it('should initialize all reminder flags to FALSE on new trial', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-reminder-init`;

      const { data, error } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(error).toBeNull();

      // Directly query subscriptions table to verify flags
      const { data: subscription, error: queryError } = await supabase
        .from('subscriptions')
        .select('trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
        .eq('user_id', testUserId)
        .single();

      expect(queryError).toBeNull();
      expect(subscription).toBeDefined();

      // MODULE-11 SUB-003: All flags must be FALSE initially
      expect(subscription!.trial_reminder_day_23_sent).toBe(false);
      expect(subscription!.trial_reminder_day_28_sent).toBe(false);
      expect(subscription!.trial_reminder_day_29_sent).toBe(false);
    });

    it('should preserve existing reminder flags when calling idempotent function', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-reminder-preserve`;

      // Create trial
      await supabase.rpc('create_trial_subscription', { p_user_id: testUserId });

      // Manually update one flag (simulate reminder sent)
      await supabase
        .from('subscriptions')
        .update({ trial_reminder_day_23_sent: true })
        .eq('user_id', testUserId);

      // Call RPC again (should be idempotent)
      const { data, error } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(error).toBeNull();

      // Re-query to verify flag was preserved
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
        .eq('user_id', testUserId)
        .single();

      // Day 23 flag should still be true (not reset)
      expect(subscription!.trial_reminder_day_23_sent).toBe(true);
      expect(subscription!.trial_reminder_day_28_sent).toBe(false);
      expect(subscription!.trial_reminder_day_29_sent).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle expired subscription attempting to start new trial', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-expired`;

      // Create expired subscription with trial_used_at set (trial was used before)
      await supabase.from('subscriptions').insert({
        user_id: testUserId,
        status: 'expired',
        trial_used_at: new Date('2025-01-01').toISOString(), // Already used trial
        trial_start_date: new Date('2025-01-01').toISOString(),
        trial_end_date: new Date('2025-01-31').toISOString(),
      });

      // Attempt to create new trial (should fail)
      const { data, error } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(error).toBeDefined();
      expect(error!.message).toContain('TRIAL_ALREADY_USED');
    });

    it('should succeed for expired subscription if trial was NEVER used (trial_used_at is NULL)', async () => {
      testUserId = `${TEST_USER_PREFIX}${Date.now()}-expired-new`;

      // Create expired subscription WITHOUT trial_used_at (never used trial)
      await supabase.from('subscriptions').insert({
        user_id: testUserId,
        status: 'expired',
        trial_used_at: null, // Important: never used trial
      });

      // Should succeed (first-time trial)
      const { data, error } = await supabase
        .rpc('create_trial_subscription', { p_user_id: testUserId });

      expect(error).toBeNull();
      expect(data.status).toBe('trial');
      expect(data.trial_used_at).toBeDefined();
    });
  });
});
