/**
 * File: p2p-kids-marketplace/src/__tests__/integration/trade-payment.integration.test.ts
 * TASK TRADE-V2-003: Integration tests for trade-payment Edge Function
 * 
 * Tests atomic transaction behavior:
 * - Stripe PaymentIntent + SP debit success
 * - Stripe failure → no SP debit
 * - SP debit failure → Stripe refund
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabase } from '../../config/supabase';

// Test configuration
const TEST_CONFIG = {
  buyerId: process.env.TEST_SUBSCRIBER_BUYER_ID || 'test-buyer',
  sellerId: process.env.TEST_SELLER_ID || 'test-seller',
  itemId: process.env.TEST_ITEM_ID || 'test-item',
  stripeTestCards: {
    success: 'pm_card_visa',
    declined: 'pm_card_chargeDeclined',
    insufficientFunds: 'pm_card_chargeCustomerFail',
  },
};

describe('Trade Payment Integration Tests (TRADE-V2-003)', () => {
  let testTradeId: string;
  let initialSpBalance: number;

  beforeAll(async () => {
    // Verify Supabase connection
    const { error } = await supabase.from('trades').select('count').limit(1);
    if (error) {
      console.error('⚠️ Supabase connection failed:', error);
      throw new Error('Cannot run integration tests: Supabase not accessible');
    }
    console.log('✅ Supabase connection verified for integration tests');

    // Get initial SP balance
    const { data: wallet } = await supabase.rpc('get_user_sp_wallet_summary', {
      p_user_id: TEST_CONFIG.buyerId,
    });
    initialSpBalance = wallet?.available_points || 0;
    console.log(`Initial SP balance: ${initialSpBalance}`);
  });

  afterAll(async () => {
    // Cleanup: cancel any test trades
    if (testTradeId) {
      await supabase.functions.invoke('cancel-trade', {
        body: { tradeId: testTradeId, reason: 'Test cleanup' },
      });
    }
  });

  describe('INT-01: Successful Atomic Transaction (Stripe + SP)', () => {
    it('should process Stripe payment and debit SP atomically', async () => {
      // ARRANGE: Create a trade with SP discount
      const { data: trade, error: createError } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.buyerId,
          seller_id: TEST_CONFIG.sellerId,
          status: 'pending',
          sp_amount: 5, // Use 5 SP
          cash_amount_cents: 2000, // $20 cash
          buyer_transaction_fee_cents: 99, // Subscriber fee
          buyer_subscription_status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;
      testTradeId = trade.id;

      // ACT: Process payment with Stripe success card
      const { data: paymentResult, error: paymentError } = await supabase.functions.invoke(
        'trade-payment',
        {
          body: {
            tradeId: testTradeId,
            paymentMethodId: TEST_CONFIG.stripeTestCards.success,
          },
        }
      );

      // ASSERT: Payment succeeded
      expect(paymentError).toBeNull();
      expect(paymentResult?.success).toBe(true);
      expect(paymentResult?.tradeId).toBe(testTradeId);

      // ASSERT: Trade status updated to in_progress
      const { data: updatedTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', testTradeId)
        .single();

      expect(updatedTrade?.status).toBe('in_progress');
      expect(updatedTrade?.stripe_payment_intent_id).toBeDefined();
      expect(updatedTrade?.sp_debit_ledger_entry_id).toBeDefined();

      // ASSERT: SP was debited
      const { data: newWallet } = await supabase.rpc('get_user_sp_wallet_summary', {
        p_user_id: TEST_CONFIG.buyerId,
      });
      expect(newWallet?.available_points).toBe(initialSpBalance - 5);

      // ASSERT: SP ledger entry created
      const { data: ledgerEntry } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('id', updatedTrade.sp_debit_ledger_entry_id)
        .single();

      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.amount).toBe(-5);
      expect(ledgerEntry?.transaction_type).toBe('trade_purchase');
      expect(ledgerEntry?.source_id).toBe(testTradeId);
    });
  });

  describe('INT-02: Stripe Failure → No SP Debit', () => {
    it('should not debit SP if Stripe payment fails', async () => {
      // ARRANGE: Create a trade
      const { data: trade, error: createError } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.buyerId,
          seller_id: TEST_CONFIG.sellerId,
          status: 'pending',
          sp_amount: 3,
          cash_amount_cents: 1500,
          buyer_transaction_fee_cents: 99,
          buyer_subscription_status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;
      const failTradeId = trade.id;

      // Get SP balance before attempt
      const { data: walletBefore } = await supabase.rpc('get_user_sp_wallet_summary', {
        p_user_id: TEST_CONFIG.buyerId,
      });
      const spBalanceBefore = walletBefore?.available_points || 0;

      // ACT: Process payment with declined card
      const { data: paymentResult, error: paymentError } = await supabase.functions.invoke(
        'trade-payment',
        {
          body: {
            tradeId: failTradeId,
            paymentMethodId: TEST_CONFIG.stripeTestCards.declined,
          },
        }
      );

      // ASSERT: Payment failed
      expect(paymentResult?.success).toBe(false);
      expect(paymentResult?.error).toBeDefined();

      // ASSERT: Trade status is payment_failed
      const { data: updatedTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', failTradeId)
        .single();

      expect(updatedTrade?.status).toBe('payment_failed');
      expect(updatedTrade?.sp_debit_ledger_entry_id).toBeNull();

      // ASSERT: SP balance unchanged
      const { data: walletAfter } = await supabase.rpc('get_user_sp_wallet_summary', {
        p_user_id: TEST_CONFIG.buyerId,
      });
      expect(walletAfter?.available_points).toBe(spBalanceBefore);

      // Cleanup
      await supabase.from('trades').delete().eq('id', failTradeId);
    });
  });

  describe('INT-03: SP Debit Failure → Trade Failed', () => {
    it('should mark trade as failed if SP debit fails (insufficient balance)', async () => {
      // ARRANGE: Create a trade with SP amount > available balance
      const { data: wallet } = await supabase.rpc('get_user_sp_wallet_summary', {
        p_user_id: TEST_CONFIG.buyerId,
      });
      const excessiveSpAmount = (wallet?.available_points || 0) + 100;

      const { data: trade, error: createError } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.buyerId,
          seller_id: TEST_CONFIG.sellerId,
          status: 'pending',
          sp_amount: excessiveSpAmount, // More than available
          cash_amount_cents: 500,
          buyer_transaction_fee_cents: 99,
          buyer_subscription_status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;
      const invalidTradeId = trade.id;

      // ACT: Process payment
      const { data: paymentResult } = await supabase.functions.invoke('trade-payment', {
        body: {
          tradeId: invalidTradeId,
          paymentMethodId: TEST_CONFIG.stripeTestCards.success,
        },
      });

      // ASSERT: Payment should fail due to insufficient SP
      expect(paymentResult?.success).toBe(false);
      expect(paymentResult?.error).toMatch(/insufficient|balance/i);

      // ASSERT: Trade status should be payment_failed
      const { data: updatedTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', invalidTradeId)
        .single();

      expect(updatedTrade?.status).toBe('payment_failed');

      // Cleanup
      await supabase.from('trades').delete().eq('id', invalidTradeId);
    });
  });

  describe('INT-04: Idempotency Test', () => {
    it('should not duplicate Stripe charges or SP debits on retry', async () => {
      // ARRANGE: Create a trade
      const { data: trade } = await supabase
        .from('trades')
        .insert({
          listing_id: TEST_CONFIG.itemId,
          buyer_id: TEST_CONFIG.buyerId,
          seller_id: TEST_CONFIG.sellerId,
          status: 'pending',
          sp_amount: 2,
          cash_amount_cents: 1000,
          buyer_transaction_fee_cents: 99,
        })
        .select()
        .single();

      const idempotentTradeId = trade.id;

      // ACT: Process payment twice
      const result1 = await supabase.functions.invoke('trade-payment', {
        body: {
          tradeId: idempotentTradeId,
          paymentMethodId: TEST_CONFIG.stripeTestCards.success,
        },
      });

      const result2 = await supabase.functions.invoke('trade-payment', {
        body: {
          tradeId: idempotentTradeId,
          paymentMethodId: TEST_CONFIG.stripeTestCards.success,
        },
      });

      // ASSERT: Second call should be rejected (trade not in pending state)
      expect(result1.data?.success).toBe(true);
      expect(result2.data?.success).toBe(false);
      expect(result2.data?.error).toMatch(/not in pending/i);

      // ASSERT: Only one Stripe charge and one SP debit
      const { data: finalTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', idempotentTradeId)
        .single();

      expect(finalTrade?.stripe_payment_intent_id).toBeDefined();

      // Count SP ledger entries for this trade
      const { data: ledgerEntries } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('source_id', idempotentTradeId);

      expect(ledgerEntries?.length).toBe(1); // Only one debit entry

      // Cleanup
      await supabase.functions.invoke('cancel-trade', {
        body: { tradeId: idempotentTradeId, reason: 'Test cleanup' },
      });
    });
  });
});
