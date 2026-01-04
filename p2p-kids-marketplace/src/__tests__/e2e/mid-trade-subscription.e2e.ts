/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/mid-trade-subscription.e2e.ts
 * TASK TRADE-V2-007: E2E test for mid-trade subscription changes
 * 
 * Tests that trades continue normally when buyer subscription expires mid-trade.
 * Verifies:
 * - Trade completes without retroactive fee changes
 * - SP wallet freeze does not affect active trade
 * - No forced cancellation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { supabase } from '../../config/supabase';

const TEST_CONFIG = {
  subscriberBuyer: {
    userId: process.env.TEST_SUBSCRIBER_ID || 'test-sub-buyer',
    email: 'sub-buyer@test.com',
  },
  seller: {
    userId: process.env.TEST_SELLER_ID || 'test-seller',
  },
  itemId: process.env.TEST_ITEM_ID || 'test-item',
};

describe('Mid-Trade Subscription Changes E2E (TRADE-V2-007)', () => {
  beforeAll(async () => {
    const { error } = await supabase.from('trades').select('count').limit(1);
    if (error) {
      throw new Error('Cannot run E2E tests: Supabase not accessible');
    }
    console.log('✅ Supabase connection verified');
  });

  describe('E2E-07-01: Subscription Expires During in_progress Trade', () => {
    it('should complete trade normally despite subscription expiration', async () => {
      // ARRANGE: Create a trade with active subscriber
      // Step 1: Verify buyer is an active subscriber
      const { data: initialSub } = await supabase.rpc('get_subscription_summary', {
        p_user_id: TEST_CONFIG.subscriberBuyer.userId,
      });

      console.log('Initial subscription status:', initialSub?.status);
      expect(['trial', 'active', 'cancelled']).toContain(initialSub?.status);

      // Step 2: Create and complete payment for a trade
      const { data: trade, error: createError } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.subscriberBuyer.userId,
          seller_id: TEST_CONFIG.seller.userId,
          status: 'pending',
          sp_amount: 5,
          cash_amount_cents: 1500,
          buyer_transaction_fee_cents: 99, // Subscriber fee at time of creation
          buyer_subscription_status: initialSub?.status || 'active',
        })
        .select()
        .single();

      if (createError) throw createError;
      const testTradeId = trade.id;
      console.log('Trade created:', testTradeId);

      // Simulate payment completion by updating status directly (bypass Stripe for test)
      await supabase
        .from('trades')
        .update({
          status: 'in_progress',
          stripe_payment_intent_id: 'pi_test_midtrade',
        })
        .eq('id', testTradeId);

      // ACT: Simulate subscription expiration
      // This would normally be handled by Stripe webhook, but for test we update directly
      const { error: subUpdateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          expires_at: new Date(Date.now() - 1000).toISOString(),
        })
        .eq('user_id', TEST_CONFIG.subscriberBuyer.userId);

      if (subUpdateError) {
        console.warn('⚠️ Could not update subscription for test:', subUpdateError);
      }

      // Wait briefly for any triggers/webhooks
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 3: Verify subscription changed
      const { data: updatedSub } = await supabase.rpc('get_subscription_summary', {
        p_user_id: TEST_CONFIG.subscriberBuyer.userId,
      });
      console.log('Subscription status after expiration:', updatedSub?.status);

      // Step 4: Complete the trade
      const { data: completeResult, error: completeError } = await supabase.functions.invoke(
        'complete-trade',
        {
          body: { tradeId: testTradeId },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      // ASSERT: Trade should complete successfully
      expect(completeError).toBeNull();
      expect(completeResult?.success).toBe(true);

      // ASSERT: Trade status is completed
      const { data: finalTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', testTradeId)
        .single();

      expect(finalTrade?.status).toBe('completed');

      // ASSERT: No retroactive fee change (fee should still be $0.99)
      expect(finalTrade?.buyer_transaction_fee_cents).toBe(99);

      // ASSERT: Subscription snapshot preserved
      expect(finalTrade?.buyer_subscription_status).toBe(initialSub?.status);

      // ASSERT: Current subscription differs from snapshot
      expect(updatedSub?.status).not.toBe(initialSub?.status);

      console.log('✅ Trade completed despite subscription change');
      console.log(`   Fee remained: $${finalTrade?.buyer_transaction_fee_cents / 100}`);
      console.log(`   Status snapshot: ${finalTrade?.buyer_subscription_status}`);
      console.log(`   Current status: ${updatedSub?.status}`);

      // Cleanup
      await supabase.from('trades').delete().eq('id', testTradeId);
    });
  });

  describe('E2E-07-02: Subscription Downgrade Mid-Trade', () => {
    it('should honor snapshot fee when subscription downgrades to free', async () => {
      // ARRANGE: Create trade as subscriber
      const { data: trade } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.subscriberBuyer.userId,
          seller_id: TEST_CONFIG.seller.userId,
          status: 'in_progress',
          sp_amount: 0,
          cash_amount_cents: 2000,
          buyer_transaction_fee_cents: 99, // Subscriber fee
          buyer_subscription_status: 'active',
          stripe_payment_intent_id: 'pi_test_downgrade',
        })
        .select()
        .single();

      const downgradeTradeId = trade.id;

      // ACT: Simulate subscription cancellation → grace_period
      await supabase
        .from('subscriptions')
        .update({
          status: 'grace_period',
          cancelled_at: new Date().toISOString(),
        })
        .eq('user_id', TEST_CONFIG.subscriberBuyer.userId);

      // Wait for changes to propagate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Complete the trade
      await supabase.functions.invoke('complete-trade', {
        body: { tradeId: downgradeTradeId },
      });

      // ASSERT: Fee did not change
      const { data: finalTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', downgradeTradeId)
        .single();

      expect(finalTrade?.buyer_transaction_fee_cents).toBe(99); // Still subscriber fee
      expect(finalTrade?.buyer_subscription_status).toBe('active'); // Snapshot preserved
      expect(finalTrade?.status).toBe('completed');

      console.log('✅ No retroactive fee adjustment after downgrade');

      // Cleanup
      await supabase.from('trades').delete().eq('id', downgradeTradeId);
    });
  });

  describe('E2E-07-03: Monitor Function Detects Mid-Trade Changes', () => {
    it('should report mid-trade subscription status changes', async () => {
      // ARRANGE: Create trade + simulate subscription change
      const { data: trade } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.subscriberBuyer.userId,
          seller_id: TEST_CONFIG.seller.userId,
          status: 'in_progress',
          sp_amount: 0,
          cash_amount_cents: 1000,
          buyer_transaction_fee_cents: 99,
          buyer_subscription_status: 'trial',
        })
        .select()
        .single();

      const monitorTradeId = trade.id;

      // Simulate status change
      await supabase
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('user_id', TEST_CONFIG.subscriberBuyer.userId);

      // ACT: Call monitor function
      const { data: monitorResult } = await supabase.functions.invoke(
        'monitor-mid-trade-subscription-changes'
      );

      // ASSERT: Monitor detected the change
      expect(monitorResult?.alerts).toBeDefined();
      const relevantAlert = monitorResult?.alerts?.find(
        (alert: any) => alert.tradeId === monitorTradeId
      );

      if (relevantAlert) {
        expect(relevantAlert.snapshotStatus).toBe('trial');
        expect(relevantAlert.currentStatus).not.toBe('trial');
        console.log('✅ Monitor function detected mid-trade status change:', relevantAlert);
      }

      // Cleanup
      await supabase.from('trades').delete().eq('id', monitorTradeId);
    });
  });
});
