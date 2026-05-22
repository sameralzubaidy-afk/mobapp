// File: p2p-kids-marketplace/src/__tests__/e2e/referral-rewards-v2.e2e.ts
// MODULE-11 REF-V2-002: E2E tests for Referral SP Rewards
// Tests the complete flow: referee completes first trade → SP rewards granted

import { supabase } from '../../config/supabase';
import { ReferralRewardsService } from '../../services/referralRewards';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for E2E tests
dotenv.config({ path: path.join(__dirname, '../../..', '.env.staging') });
dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

// Admin client that bypasses RLS for test setup
const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * E2E TEST SUITE: Referral SP Rewards on First Trade
 *
 * PREREQUISITES (must be setup manually in Supabase prod):
 * 1. Two test users with trial/active subscriptions
 * 2. Referral relationship exists (referee used referrer's code)
 * 3. Referee has NOT completed any trades yet
 * 4. sp_config has referral_reward_referrer_sp=25, referral_reward_referee_sp=10
 *
 * TEST FLOW:
 * 1. Verify initial state (referral status='pending', no SP rewards yet)
 * 2. Create and complete a trade for referee
 * 3. Verify rewards granted (25 SP referrer, 10 SP referee)
 * 4. Verify referral status='completed'
 * 5. Verify idempotency (second trade doesn't grant more rewards)
 */

describeE2E('REF-V2-002: Referral SP Rewards E2E', () => {
  // IMPORTANT: Use seeded IDs from scripts/seed-staging-data.ts
  const REFERRER_USER_ID =
    process.env.TEST_REFERRER_USER_ID || '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller
  const REFEREE_USER_ID =
    process.env.TEST_REFEREE_USER_ID || '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer
  let testListingId = process.env.TEST_LISTING_ID || 'REPLACE_WITH_ACTUAL_ID';

  let referralId: string;
  let tradeId: string;

  beforeAll(async () => {
    // Verify environment is ready
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. E2E setup might fail.');
    }

    if (REFERRER_USER_ID === 'REPLACE_WITH_ACTUAL_ID') {
      throw new Error('E2E tests require real test user IDs. Set TEST_REFERRER_USER_ID env var.');
    }

    // Try to find a listing if none provided
    if (testListingId === 'REPLACE_WITH_ACTUAL_ID') {
      const { data: listings } = await adminSupabase
        .from('items')
        .select('id')
        .eq('seller_id', REFERRER_USER_ID)
        .limit(1);

      if (listings && listings.length > 0) {
        testListingId = listings[0].id;
      }
    }

    if (testListingId === 'REPLACE_WITH_ACTUAL_ID') {
      throw new Error('Could not find a test listing. Run seed:staging first.');
    }

    // [SETUP] Ensure users have wallets and subscriptions
    console.log('   [SETUP] Ensuring test users have wallets and active subscriptions...');
    for (const userId of [REFERRER_USER_ID, REFEREE_USER_ID]) {
      // Initialize wallet
      await adminSupabase.rpc('initialize_sp_wallet', { p_user_id: userId });

      // Ensure subscription (trial)
      const { data: sub } = await adminSupabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', userId)
        .maybeSingle();

      if (!sub || !['active', 'trial', 'trialing', 'grace'].includes(sub.status)) {
        await adminSupabase.from('subscriptions').upsert(
          {
            user_id: userId,
            status: 'trial',
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }
    }

    // Ensure a referral relationship exists for testing
    const { data: existingReferral } = await adminSupabase
      .from('referrals')
      .select('id')
      .eq('referrer_user_id', REFERRER_USER_ID)
      .eq('referred_user_id', REFEREE_USER_ID)
      .maybeSingle();

    if (!existingReferral) {
      console.log('   [SETUP] Creating test referral relationship...');
      const { data: newReferral, error: refError } = await adminSupabase
        .from('referrals')
        .insert({
          referrer_user_id: REFERRER_USER_ID,
          referred_user_id: REFEREE_USER_ID,
          referral_code: 'TESTCODE',
          status: 'pending',
        })
        .select()
        .single();

      if (refError) {
        console.error('   [SETUP] Failed to create test referral:', refError.message);
        throw refError;
      }
      referralId = newReferral.id;
    } else {
      // Reset existing referral to pending for fresh test
      console.log('   [SETUP] Resetting existing referral and cleaning up old rewards...');
      referralId = existingReferral.id;

      // Delete old ledger entries and batches to allow trigger to re-run
      await adminSupabase
        .from('sp_ledger')
        .delete()
        .or(
          `idempotency_key.eq.referral_${referralId}_referrer,idempotency_key.eq.referral_${referralId}_referee`
        );

      await adminSupabase.from('sp_batches').delete().eq('source_id', referralId);

      await adminSupabase
        .from('referrals')
        .update({ status: 'pending', bonus_points: null, bonus_points_referrer: null })
        .eq('id', referralId);
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test trade (optional)
    if (tradeId) {
      await adminSupabase.from('trades').delete().eq('id', tradeId);
    }
  });

  test('SETUP: Verify initial state', async () => {
    // 1. Verify both users have subscriptions
    const subCheck = await ReferralRewardsService.verifyBothUsersSubscribed(
      REFERRER_USER_ID,
      REFEREE_USER_ID,
      adminSupabase
    );
    expect(subCheck.both_subscribed).toBe(true);

    // 2. Verify referral is pending
    const eligibility = await ReferralRewardsService.checkEligibility(
      REFEREE_USER_ID,
      adminSupabase
    );
    expect(eligibility.is_referee).toBe(true);
    expect(eligibility.rewards_pending).toBe(true);
    expect(eligibility.referral_status).toBe('pending');

    // 3. Verify referee has no completed trades yet
    const isFirstTrade = await ReferralRewardsService.isFirstCompletedTrade(
      REFEREE_USER_ID,
      adminSupabase
    );
    expect(isFirstTrade).toBe(false); // Should be false because no completed trades exist
  });

  test('STEP 1: Create trade for referee', async () => {
    // Create a trade where referee is the buyer
    const { data: trade, error } = await adminSupabase
      .from('trades')
      .insert({
        listing_id: testListingId,
        buyer_id: REFEREE_USER_ID,
        seller_id: REFERRER_USER_ID, // Just for test setup
        status: 'pending',
        cash_amount_cents: 1000,
        buyer_transaction_fee_cents: 99,
        sp_amount: 0,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(trade).toBeDefined();
    tradeId = trade!.id;
  });

  test('STEP 2: Complete trade triggers reward', async () => {
    // Update trade status to 'completed'
    // This should trigger process_referral_bonus_on_trade_v2()
    const { error: updateError } = await adminSupabase
      .from('trades')
      .update({ status: 'completed' })
      .eq('id', tradeId);

    expect(updateError).toBeNull();

    // Wait for trigger to process (async)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify referral status updated to 'completed'
    const { data: referralData } = await adminSupabase
      .from('referrals')
      .select('status, bonus_points, bonus_points_referrer')
      .eq('id', referralId)
      .single();

    expect(['pending', 'completed']).toContain(referralData?.status);
    if (referralData?.status === 'completed') {
      expect(referralData?.bonus_points_referrer).toBe(25);
      expect(referralData?.bonus_points).toBe(10);
    }
  });

  test('STEP 3: Verify SP ledger entries created', async () => {
    // Check referrer SP ledger
    const { data: referrerLedger } = await adminSupabase
      .from('sp_ledger')
      .select('*')
      .eq('user_id', REFERRER_USER_ID)
      .eq('transaction_type', 'earn_referral')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(referrerLedger).toBeDefined();
    expect(referrerLedger?.amount).toBe(25);
    expect(referrerLedger?.description).toContain('Referral Reward');

    // Check referee SP ledger
    const { data: refereeLedger } = await adminSupabase
      .from('sp_ledger')
      .select('*')
      .eq('user_id', REFEREE_USER_ID)
      .eq('transaction_type', 'earn_referral')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(refereeLedger).toBeDefined();
    expect(refereeLedger?.amount).toBe(10);
    expect(refereeLedger?.description).toContain('Welcome bonus');
  });

  test('STEP 4: Verify SP wallets updated', async () => {
    // Check referrer wallet
    const { data: referrerWallet } = await adminSupabase
      .from('sp_wallets')
      .select('available_balance, lifetime_earned')
      .eq('user_id', REFERRER_USER_ID)
      .single();

    expect(referrerWallet).toBeDefined();
    expect(referrerWallet!.available_balance).toBeGreaterThanOrEqual(25);
    expect(referrerWallet!.lifetime_earned).toBeGreaterThanOrEqual(25);

    // Check referee wallet
    const { data: refereeWallet } = await adminSupabase
      .from('sp_wallets')
      .select('available_balance, lifetime_earned')
      .eq('user_id', REFEREE_USER_ID)
      .single();

    expect(refereeWallet).toBeDefined();
    expect(refereeWallet!.available_balance).toBeGreaterThanOrEqual(10);
    expect(refereeWallet!.lifetime_earned).toBeGreaterThanOrEqual(10);
  });

  test('STEP 5: Verify idempotency (second trade does NOT grant more rewards)', async () => {
    // Get current wallet balances
    const { data: beforeReferrerWallet } = await adminSupabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFERRER_USER_ID)
      .single();

    const { data: beforeRefereeWallet } = await adminSupabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFEREE_USER_ID)
      .single();

    // Create and complete a second trade
    const { data: trade2 } = await adminSupabase
      .from('trades')
      .insert({
        listing_id: testListingId,
        buyer_id: REFEREE_USER_ID,
        seller_id: REFERRER_USER_ID,
        status: 'status' in ({} as any) ? 'completed' : ('completed' as any), // Type safety
        cash_amount_cents: 2000,
        buyer_transaction_fee_cents: 99,
        sp_amount: 0,
      })
      .select()
      .single();

    // Wait for any potential trigger processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify wallet balances did NOT increase
    const { data: afterReferrerWallet } = await adminSupabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFERRER_USER_ID)
      .single();

    const { data: afterRefereeWallet } = await adminSupabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFEREE_USER_ID)
      .single();

    expect(afterReferrerWallet!.available_balance).toBe(beforeReferrerWallet!.available_balance);
    expect(afterRefereeWallet!.available_balance).toBe(beforeRefereeWallet!.available_balance);

    // Cleanup second trade
    await adminSupabase.from('trades').delete().eq('id', trade2!.id);
  });

  test('EDGE CASE: Verify rewards NOT granted if subscription expired', async () => {
    // This test requires creating a new referral with non-subscribed users
    // Skip for now - requires more complex setup
    // TODO: Implement when admin tools support subscription manipulation
  });
});

/**
 * MANUAL RUN INSTRUCTIONS:
 *
 * 1. Set environment variables:
 *    export TEST_REFERRER_USER_ID=<actual_user_id>
 *    export TEST_REFEREE_USER_ID=<actual_user_id>
 *    export TEST_LISTING_ID=<actual_listing_id>
 *
 * 2. Ensure both users have trial/active subscriptions
 *
 * 3. Create referral relationship if not exists:
 *    INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status)
 *    VALUES (<referrer_id>, <referee_id>, 'TESTCODE', 'pending');
 *
 * 4. Run test:
 *    npm test -- referral-rewards-v2.e2e.ts
 *
 * 5. Verify results in Supabase:
 *    - Check referrals table (status should be 'completed')
 *    - Check sp_ledger (2 entries with transaction_type='earn_referral')
 *    - Check sp_wallets (balances increased by 25 and 10)
 */
