// File: p2p-kids-marketplace/src/__tests__/e2e/referral-rewards-v2.e2e.ts
// MODULE-11 REF-V2-002: E2E tests for Referral SP Rewards
// Tests the complete flow: referee completes first trade → SP rewards granted

import { supabase } from '../../config/supabase';
import { ReferralRewardsService } from '../../services/referralRewards';

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

describe('REF-V2-002: Referral SP Rewards E2E', () => {
  // IMPORTANT: Replace these with actual test user IDs from your Supabase prod
  const REFERRER_USER_ID = process.env.TEST_REFERRER_USER_ID || 'REPLACE_WITH_ACTUAL_ID';
  const REFEREE_USER_ID = process.env.TEST_REFEREE_USER_ID || 'REPLACE_WITH_ACTUAL_ID';
  const TEST_LISTING_ID = process.env.TEST_LISTING_ID || 'REPLACE_WITH_ACTUAL_ID';

  let referralId: string;
  let tradeId: string;

  beforeAll(async () => {
    // Verify environment is ready
    if (REFERRER_USER_ID === 'REPLACE_WITH_ACTUAL_ID') {
      throw new Error('E2E tests require real test user IDs. Set TEST_REFERRER_USER_ID env var.');
    }

    // Get referral ID
    const { data: referralData } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_user_id', REFERRER_USER_ID)
      .eq('referred_user_id', REFEREE_USER_ID)
      .eq('status', 'pending')
      .single();

    if (!referralData) {
      throw new Error('Pending referral not found. Create referral relationship first.');
    }

    referralId = referralData.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test trade (optional)
    if (tradeId) {
      await supabase.from('trades').delete().eq('id', tradeId);
    }
  });

  test('SETUP: Verify initial state', async () => {
    // 1. Verify both users have subscriptions
    const subCheck = await ReferralRewardsService.verifyBothUsersSubscribed(
      REFERRER_USER_ID,
      REFEREE_USER_ID
    );
    expect(subCheck.both_subscribed).toBe(true);

    // 2. Verify referral is pending
    const eligibility = await ReferralRewardsService.checkEligibility(REFEREE_USER_ID);
    expect(eligibility.is_referee).toBe(true);
    expect(eligibility.rewards_pending).toBe(true);
    expect(eligibility.referral_status).toBe('pending');

    // 3. Verify referee has no completed trades yet
    const isFirstTrade = await ReferralRewardsService.isFirstCompletedTrade(REFEREE_USER_ID);
    expect(isFirstTrade).toBe(false); // Should be false because no completed trades exist
  });

  test('STEP 1: Create trade for referee', async () => {
    // Create a trade where referee is the buyer
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        listing_id: TEST_LISTING_ID,
        buyer_id: REFEREE_USER_ID,
        seller_id: REFERRER_USER_ID, // Just for test setup
        status: 'pending',
        total_price_cents: 1000,
        buyer_fee_cents: 100,
        seller_fee_cents: 50,
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
    const { error: updateError } = await supabase
      .from('trades')
      .update({ status: 'completed' })
      .eq('id', tradeId);

    expect(updateError).toBeNull();

    // Wait for trigger to process (async)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify referral status updated to 'completed'
    const { data: referralData } = await supabase
      .from('referrals')
      .select('status, bonus_points, bonus_points_referrer')
      .eq('id', referralId)
      .single();

    expect(referralData?.status).toBe('completed');
    expect(referralData?.bonus_points_referrer).toBe(25);
    expect(referralData?.bonus_points).toBe(10);
  });

  test('STEP 3: Verify SP ledger entries created', async () => {
    // Check referrer SP ledger
    const { data: referrerLedger } = await supabase
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
    const { data: refereeLedger } = await supabase
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
    const { data: referrerWallet } = await supabase
      .from('sp_wallets')
      .select('available_balance, lifetime_earned')
      .eq('user_id', REFERRER_USER_ID)
      .single();

    expect(referrerWallet).toBeDefined();
    expect(referrerWallet!.available_balance).toBeGreaterThanOrEqual(25);
    expect(referrerWallet!.lifetime_earned).toBeGreaterThanOrEqual(25);

    // Check referee wallet
    const { data: refereeWallet } = await supabase
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
    const { data: beforeReferrerWallet } = await supabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFERRER_USER_ID)
      .single();

    const { data: beforeRefereeWallet } = await supabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFEREE_USER_ID)
      .single();

    // Create and complete a second trade
    const { data: trade2 } = await supabase
      .from('trades')
      .insert({
        listing_id: TEST_LISTING_ID,
        buyer_id: REFEREE_USER_ID,
        seller_id: REFERRER_USER_ID,
        status: 'completed',
        total_price_cents: 2000,
        buyer_fee_cents: 200,
        seller_fee_cents: 100,
      })
      .select()
      .single();

    // Wait for any potential trigger processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify wallet balances did NOT increase
    const { data: afterReferrerWallet } = await supabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFERRER_USER_ID)
      .single();

    const { data: afterRefereeWallet } = await supabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('user_id', REFEREE_USER_ID)
      .single();

    expect(afterReferrerWallet!.available_balance).toBe(beforeReferrerWallet!.available_balance);
    expect(afterRefereeWallet!.available_balance).toBe(beforeRefereeWallet!.available_balance);

    // Cleanup second trade
    await supabase.from('trades').delete().eq('id', trade2!.id);
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
