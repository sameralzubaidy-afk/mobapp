/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-002.e2e.ts
 * MODULE-11 TASK SUB-002: E2E Tests for Subscription Table & RPC Functions
 *
 * Prerequisites:
 * - Run migration 20260213000000_enhance_subscriptions_sub_002.sql
 * - Run migration 20260213000001_subscription_rpcs_sub_002.sql
 * - Have subscription_tiers table seeded (from TASK SUB-001)
 *
 * Tests verify:
 * - Subscription table schema enhancements
 * - RPC functions work correctly
 * - Status transitions and grace period logic
 * - Feature gates (SP earn/spend)
 * - Transaction fee calculation
 */

import { supabase } from '../../config/supabase';

const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

function isAuthRateLimitError(message?: string): boolean {
  return Boolean(message && /request rate limit reached/i.test(message));
}

describeE2E('MODULE-11 TASK SUB-002 E2E: Subscription Table & Status Management', () => {
  let testUserId: string;
  let testSubscriptionId: string;
  let tierIdKidsClubPlus: string;
  let canRunSuite = true;
  let skipReason = '';

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(
        `[SUB-002 E2E] Skipping case: ${skipReason || 'suite preconditions unavailable'}`
      );
      return true;
    }

    return false;
  };

  const itIfRunnable = (name: string, fn: () => Promise<void> | void) => {
    it(name, async () => {
      if (shouldSkipCase()) {
        return;
      }
      await fn();
    });
  };

  beforeAll(async () => {
    // Create a test user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `test-sub002-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    });

    if (authError || !authData.user) {
      if (isAuthRateLimitError(authError?.message)) {
        canRunSuite = false;
        skipReason = `Supabase auth rate limit while creating SUB-002 test user: ${authError?.message}`;
        console.warn(`[SUB-002 E2E] ${skipReason}`);
        return;
      }
      throw new Error(`Failed to create test user: ${authError?.message || 'unknown'}`);
    }

    testUserId = authData.user.id;

    // Get Kids Club+ tier ID
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id')
      .eq('name', 'kids_club_plus')
      .single();

    if (tierError || !tierData) {
      throw new Error(`Kids Club+ tier not found. Run SUB-001 migration first.`);
    }

    tierIdKidsClubPlus = tierData.id;

    // Cleanup any existing subscriptions for this user (just in case)
    await supabase.from('subscriptions').delete().eq('user_id', testUserId);

    // Create a initial subscription row
    await supabase.from('subscriptions').insert({
      user_id: testUserId,
      tier_id: tierIdKidsClubPlus,
      status: 'free',
      has_used_trial: false,
    });
  });

  afterAll(async () => {
    // Cleanup: Delete test subscription and user
    if (testSubscriptionId) {
      await supabase.from('subscriptions').delete().eq('id', testSubscriptionId);
    }

    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  async function updateSubscriptionRow(patch: Record<string, any>) {
    return supabase.from('subscriptions').update(patch).eq('user_id', testUserId);
  }

  describe('Schema Verification', () => {
    itIfRunnable('should have all new columns added by SUB-002 migration', async () => {
      const { data, error } = await supabase.from('subscriptions').select('*').limit(1);

      expect(error).toBeNull();

      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

      // Verify new V2.1 columns exist
      const expectedColumns = [
        'tier_id',
        'monthly_price_cents',
        'last_payment_date',
        'last_payment_amount',
        'next_billing_date',
        'payment_failed_at',
        'payment_retry_count',
        'auto_renew_enabled',
        'cancelled_at',
        'cancel_reason',
        'cancel_at_period_end',
        'paused_until',
        'grace_started_at',
        'grace_ends_at',
        'has_used_trial',
        'stripe_payment_method_id',
        'trial_reminder_day_23_sent',
        'trial_reminder_day_28_sent',
        'trial_reminder_day_29_sent',
      ];

      for (const col of expectedColumns) {
        expect(columns).toContain(col);
      }
    });

    itIfRunnable('should allow creating subscription with new V2.1 fields', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: testUserId,
            tier_id: tierIdKidsClubPlus,
            status: 'trial',
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            has_used_trial: true,
            auto_renew_enabled: true,
            payment_retry_count: 0,
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.tier_id).toBe(tierIdKidsClubPlus);
      expect(data.status).toBe('trial');
      expect(data.has_used_trial).toBe(true);
      expect(data.auto_renew_enabled).toBe(true);
      expect(data.payment_retry_count).toBe(0);

      testSubscriptionId = data.id;
    });
  });

  describe('RPC Function: get_subscription_status', () => {
    itIfRunnable('should return complete subscription status', async () => {
      const { data, error } = await supabase.rpc('get_subscription_status', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const sub = data[0];
      expect(sub.user_id).toBe(testUserId);
      expect(sub.tier_id).toBe(tierIdKidsClubPlus);
      expect(sub.status).toBe('trial');
      expect(sub.has_used_trial).toBe(true);
      expect(sub.auto_renew_enabled).toBe(true);
      expect(sub.payment_retry_count).toBe(0);
    });

    itIfRunnable('should return empty array for user with no subscription', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const { data, error } = await supabase.rpc('get_subscription_status', {
        p_user_id: fakeUserId,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('RPC Function: can_user_earn_sp', () => {
    itIfRunnable('should return true for trial user', async () => {
      const { error: setupError } = await updateSubscriptionRow({
        tier_id: tierIdKidsClubPlus,
        status: 'trial',
        has_used_trial: true,
      });
      expect(setupError).toBeNull();

      const { data, error } = await supabase.rpc('can_user_earn_sp', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(true); // Trial users can earn SP
    });

    itIfRunnable('should return false after user enters grace_period', async () => {
      // Update to grace_period status using RPC
      const { error: updateError } = await updateSubscriptionRow({
        status: 'grace_period',
        grace_started_at: new Date().toISOString(),
        grace_ends_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('can_user_earn_sp', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(false); // Grace period users cannot earn SP

      // Restore to trial for other tests
      await updateSubscriptionRow({
        status: 'trial',
        grace_started_at: null,
        grace_ends_at: null,
      });
    });
  });

  describe('RPC Function: can_user_spend_sp', () => {
    itIfRunnable('should return true for trial user', async () => {
      const { error: setupError } = await updateSubscriptionRow({ status: 'trial' });
      expect(setupError).toBeNull();

      const { data, error } = await supabase.rpc('can_user_spend_sp', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(true); // Trial users can spend SP
    });

    itIfRunnable('should return false for grace_period user', async () => {
      const { error: updateError } = await updateSubscriptionRow({
        status: 'grace_period',
      });
      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('can_user_spend_sp', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(false); // Grace period users cannot spend SP

      // Restore to trial
      await updateSubscriptionRow({ status: 'trial' });
    });
  });

  describe('RPC Function: get_user_transaction_fee', () => {
    itIfRunnable('should return $0.99 (99 cents) for trial user', async () => {
      const { data, error } = await supabase.rpc('get_user_transaction_fee', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(99); // Trial user fee
    });

    itIfRunnable('should return $2.99 (299 cents) for free user', async () => {
      // Update to expired status using RPC
      const { error: updateError } = await updateSubscriptionRow({
        status: 'expired',
      });
      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('get_user_transaction_fee', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(299); // Non-subscriber fee

      // Restore to trial
      await updateSubscriptionRow({ status: 'trial' });
    });

    itIfRunnable('should return $0.99 for paused user (keeps access)', async () => {
      // Update to paused status using RPC
      const { error: updateError } = await updateSubscriptionRow({
        status: 'paused',
      });
      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('get_user_transaction_fee', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(99); // Paused users still get subscriber fee

      // Restore to trial
      await updateSubscriptionRow({ status: 'trial' });
    });
  });

  describe('RPC Function: is_user_trial_eligible', () => {
    itIfRunnable('should return false for user who has used trial', async () => {
      const { error: setupError } = await updateSubscriptionRow({
        has_used_trial: true,
      });
      expect(setupError).toBeNull();

      const { data, error } = await supabase.rpc('is_user_trial_eligible', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(false); // User has has_used_trial = true
    });

    itIfRunnable('should return true for user who has not used trial', async () => {
      // Update to has_used_trial = false using RPC
      const { error: updateError } = await updateSubscriptionRow({
        status: 'free',
        has_used_trial: false,
      });
      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('is_user_trial_eligible', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      // Restore to has_used_trial = true
      await updateSubscriptionRow({
        status: 'trial',
        has_used_trial: true,
      });
    });
  });

  describe('RPC Function: record_payment_attempt', () => {
    itIfRunnable('should record successful payment and reset retry count', async () => {
      // First set retry count to 2 using RPC
      await updateSubscriptionRow({ payment_retry_count: 2 });

      // Record successful payment
      const { data, error } = await supabase.rpc('record_payment_attempt', {
        p_user_id: testUserId,
        p_success: true,
        p_amount: 499, // $4.99
        p_charge_id: 'ch_test_123',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.payment_succeeded).toBe(true);
      expect(data.retry_count_reset).toBe(true);

      // Verify retry count was reset
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('payment_retry_count, last_payment_amount')
        .eq('user_id', testUserId)
        .single();

      expect(subData.payment_retry_count).toBe(0);
      expect(subData.last_payment_amount).toBe(499);
    });

    itIfRunnable('should increment retry count on failed payment', async () => {
      // Record failed payment attempt
      const { data, error } = await supabase.rpc('record_payment_attempt', {
        p_user_id: testUserId,
        p_success: false,
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.payment_failed).toBe(true);
      expect(data.retry_count).toBe(1);
      expect(data.max_retries_reached).toBe(false);

      // Verify retry count incremented
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('payment_retry_count, payment_failed_at')
        .eq('user_id', testUserId)
        .single();

      expect(subData.payment_retry_count).toBe(1);
      expect(subData.payment_failed_at).not.toBeNull();

      // Reset for other tests using RPC
      await updateSubscriptionRow({ payment_retry_count: 0 });
    });

    itIfRunnable('should flag max retries reached after 3 failures', async () => {
      // Set retry count to 2 using RPC
      await updateSubscriptionRow({ payment_retry_count: 2 });

      // Record 3rd failed payment
      const { data, error } = await supabase.rpc('record_payment_attempt', {
        p_user_id: testUserId,
        p_success: false,
      });

      expect(error).toBeNull();
      expect(data.retry_count).toBe(3);
      expect(data.max_retries_reached).toBe(true); // Should trigger grace period

      // Reset
      await updateSubscriptionRow({ payment_retry_count: 0 });
    });
  });

  describe('Status Transitions', () => {
    itIfRunnable('should handle trial -> active transition', async () => {
      const stripeSubId = `sub_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const { error: updateError } = await updateSubscriptionRow({
        status: 'active',
        stripe_subscription_id: stripeSubId,
        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('get_subscription_status', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      const sub = data[0];
      expect(sub.status).toBe('active');
      expect(sub.stripe_subscription_id).toBe(stripeSubId);
    });

    itIfRunnable('should handle cancellation with grace period', async () => {
      const now = new Date();
      const graceEnds = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const { error: updateError } = await updateSubscriptionRow({
        status: 'grace_period',
        cancelled_at: now.toISOString(),
        cancel_reason: 'Testing grace period',
        grace_started_at: now.toISOString(),
        grace_ends_at: graceEnds.toISOString(),
        auto_renew_enabled: false,
      });

      expect(updateError).toBeNull();

      const { data, error } = await supabase.rpc('get_subscription_status', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      const sub = data[0];
      expect(sub.status).toBe('grace_period');
      expect(sub.cancelled_at).not.toBeNull();
      expect(sub.grace_ends_at).not.toBeNull();
      expect(sub.auto_renew_enabled).toBe(false);
    });
  });
});
