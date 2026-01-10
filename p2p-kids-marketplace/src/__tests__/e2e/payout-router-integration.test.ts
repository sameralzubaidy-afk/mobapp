/**
 * PAY-006 E2E Integration Test
 * Tests payout router integration with trade completion trigger
 * File: p2p-kids-marketplace/src/__tests__/e2e/payout-router-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAdminPayoutConfig, getPendingPayoutsBalance } from '../../services/payoutRouter';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const shouldRunE2E = process.env.RUN_SUPABASE_E2E === 'true' && Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const d = shouldRunE2E ? describe : describe.skip;

d('PAY-006: Payout Router + Trade Completion Trigger (E2E)', () => {
  let supabase: SupabaseClient;
  let testSeller: any;
  let testBuyer: any;
  let testTrade: any;
  let testPayoutMethod: any;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Setup: Create test users, payout method, and trade
    // Note: This assumes you have test user creation utilities
    // For production tests, use seeded test data from test-users.json

    // Test user IDs (replace with actual test user IDs from your seed data)
    const SELLER_ID = 'test-seller-uuid';
    const BUYER_ID = 'test-buyer-uuid';

    testSeller = { id: SELLER_ID };
    testBuyer = { id: BUYER_ID };

    // Create a verified Stripe payout method for seller
    const { data: method, error: methodError } = await supabase
      .from('seller_payout_methods')
      .insert({
        user_id: SELLER_ID,
        method_type: 'stripe_connect',
        stripe_account_id: 'acct_test_auto',
        is_primary: true,
        is_verified: true,
        stripe_onboarding_complete: true,
        stripe_payouts_enabled: true
      })
      .select()
      .single();

    expect(methodError).toBeNull();
    testPayoutMethod = method;

    // Create a test trade in 'in_progress' status
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        buyer_id: BUYER_ID,
        seller_id: SELLER_ID,
        listing_id: 'test-item-uuid',
        cash_amount_cents: 4500, // $45 cash
        sp_amount: 5, // 5 SP used
        buyer_transaction_fee_cents: 99,
        status: 'in_progress',
        buyer_subscription_status: 'active',
        stripe_payment_intent_id: 'pi_test_auto_payout'
      })
      .select()
      .single();

    expect(tradeError).toBeNull();
    testTrade = trade;
  });

  afterAll(async () => {
    // Cleanup: Delete test records
    if (testTrade) {
      await supabase.from('trades').delete().eq('id', testTrade.id);
    }
    if (testPayoutMethod) {
      await supabase.from('seller_payout_methods').delete().eq('id', testPayoutMethod.id);
    }
  });

  describe('Scenario 1: Auto-payout ENABLED with verified method', () => {
    it('should create payout in PROCESSING status on trade completion', async () => {
      // Step 1: Enable auto-payout in admin config
      await supabase.rpc('upsert_admin_config_setting', {
        p_key: 'enable_automatic_seller_payout',
        p_value: 'true',
        p_category: 'fees',
        p_data_type: 'boolean'
      });

      // Step 2: Verify admin config
      const config = await getAdminPayoutConfig();
      expect(config.enable_automatic_seller_payout).toBe(true);

      // Step 3: Complete the trade
      const { data: sellerMark, error: sellerMarkError } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: testTrade.id,
        p_user_id: testSeller.id
      });

      expect(sellerMarkError).toBeNull();
      expect(sellerMark.success).toBe(true);
      expect(sellerMark.status).toBe('in_progress');

      // Buyer confirms completion (finalizes trade + triggers payout)
      const { data, error } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: testTrade.id,
        p_user_id: testBuyer.id
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.payout_result).toBeDefined();
      expect(data.payout_result.success).toBe(true);
      expect(data.payout_result.status).toBe('processing');
      expect(data.payout_result.auto_payout_enabled).toBe(true);
      expect(data.payout_result.has_verified_method).toBe(true);
      expect(data.payout_result.provider).toBe('stripe');

      // Step 4: Verify payout record was created
      const { data: payout, error: payoutError } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('trade_id', testTrade.id)
        .single();

      expect(payoutError).toBeNull();
      expect(payout).toBeDefined();
      expect(payout.status).toBe('processing');
      expect(payout.gross_amount_cents).toBe(4500); // Cash amount from trade
      expect(payout.platform_fee_cents).toBe(0); // Platform fee is $0
      expect(payout.payout_fee_cents).toBeGreaterThan(0); // Stripe fee calculated
      expect(payout.net_amount_cents).toBeLessThan(4500); // Net after fee
      expect(payout.provider).toBe('stripe');
      expect(payout.initiated_at).not.toBeNull();
    });

    it('should be idempotent - duplicate completion calls should not create duplicate payouts', async () => {
      // Complete trade again (should reuse existing payout)
      const { data, error } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: testTrade.id,
        p_user_id: testBuyer.id
      });

      // Trade is already completed, so this should fail or return existing
      // Depending on your RPC logic, adjust assertion
      if (data?.payout_result) {
        expect(data.payout_result.is_new).toBe(false);
      }

      // Verify only one payout exists
      const { data: payouts, error: payoutsError } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('trade_id', testTrade.id);

      expect(payoutsError).toBeNull();
      expect(payouts).toHaveLength(1);
    });
  });

  describe('Scenario 2: Auto-payout DISABLED (manual withdrawal mode)', () => {
    let pendingTrade: any;

    beforeAll(async () => {
      // Create another test trade
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          buyer_id: testBuyer.id,
          seller_id: testSeller.id,
          listing_id: 'test-item-manual-uuid',
          cash_amount_cents: 3000,
          sp_amount: 0,
          buyer_transaction_fee_cents: 99,
          status: 'in_progress',
          buyer_subscription_status: 'free',
          stripe_payment_intent_id: 'pi_test_manual_payout'
        })
        .select()
        .single();

      expect(error).toBeNull();
      pendingTrade = trade;
    });

    afterAll(async () => {
      if (pendingTrade) {
        await supabase.from('trades').delete().eq('id', pendingTrade.id);
      }
    });

    it('should NOT create a payout record when auto-payout disabled (manual withdrawal mode)', async () => {
      // Step 1: Disable auto-payout
      await supabase.rpc('upsert_admin_config_setting', {
        p_key: 'enable_automatic_seller_payout',
        p_value: 'false',
        p_category: 'fees',
        p_data_type: 'boolean'
      });

      const config = await getAdminPayoutConfig();
      expect(config.enable_automatic_seller_payout).toBe(false);

      // Step 2: Complete trade
      const { data: sellerMark, error: sellerMarkError } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: pendingTrade.id,
        p_user_id: testSeller.id
      });

      expect(sellerMarkError).toBeNull();
      expect(sellerMark.success).toBe(true);
      expect(sellerMark.status).toBe('in_progress');

      const { data, error } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: pendingTrade.id,
        p_user_id: testBuyer.id
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.payout_result.auto_payout_enabled).toBe(false);

      // Step 3: Verify payout record
      const { data: payout, error: payoutError } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('trade_id', pendingTrade.id)
        .single();

      expect(payoutError).not.toBeNull();
      expect(payout).toBeNull();
    });

    it('should allow seller to check pending balance', async () => {
      const pendingBalance = await getPendingPayoutsBalance(testSeller.id);
      
      // Should include the pending payout from previous test
      expect(pendingBalance).toBeGreaterThanOrEqual(3000);
    });
  });

  describe('Scenario 3: Auto-payout ENABLED but NO verified method', () => {
    let noMethodTrade: any;
    let tempSeller: any;

    beforeAll(async () => {
      // Create a seller without a payout method
      const TEMP_SELLER_ID = 'test-seller-no-method-uuid';
      tempSeller = { id: TEMP_SELLER_ID };

      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          buyer_id: testBuyer.id,
          seller_id: TEMP_SELLER_ID,
          listing_id: 'test-item-no-method-uuid',
          cash_amount_cents: 2000,
          sp_amount: 0,
          buyer_transaction_fee_cents: 299,
          status: 'in_progress',
          buyer_subscription_status: 'free',
          stripe_payment_intent_id: 'pi_test_no_method'
        })
        .select()
        .single();

      expect(error).toBeNull();
      noMethodTrade = trade;
    });

    afterAll(async () => {
      if (noMethodTrade) {
        await supabase.from('trades').delete().eq('id', noMethodTrade.id);
      }
    });

    it('should create payout in REQUIRES_ACTION status', async () => {
      // Ensure auto-payout is enabled
      await supabase.rpc('upsert_admin_config_setting', {
        p_key: 'enable_automatic_seller_payout',
        p_value: 'true',
        p_category: 'fees',
        p_data_type: 'boolean'
      });

      // Complete trade
      const { data: sellerMark, error: sellerMarkError } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: noMethodTrade.id,
        p_user_id: tempSeller.id
      });

      expect(sellerMarkError).toBeNull();
      expect(sellerMark.success).toBe(true);
      expect(sellerMark.status).toBe('in_progress');

      const { data, error } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: noMethodTrade.id,
        p_user_id: testBuyer.id
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.payout_result.status).toBe('requires_action');
      expect(data.payout_result.has_verified_method).toBe(false);

      // Verify payout record
      const { data: payout } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('trade_id', noMethodTrade.id)
        .single();

      expect(payout.status).toBe('requires_action');
      expect(payout.payout_method_id).toBeNull();
    });
  });

  describe('RPC: calculate_payout_fee_cents', () => {
    it('should calculate Stripe fee correctly', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'stripe_connect',
        p_amount_cents: 10000
      });

      expect(error).toBeNull();
      expect(data).toBe(50); // 0.25% + $0.25 = 25 + 25 = 50 cents
    });

    it('should calculate PayPal fee correctly', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'paypal',
        p_amount_cents: 5000
      });

      expect(error).toBeNull();
      expect(data).toBe(100); // 2% = 100 cents
    });

    it('should cap PayPal fee at $20', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'paypal',
        p_amount_cents: 200000
      });

      expect(error).toBeNull();
      expect(data).toBe(2000); // Capped at $20
    });
  });
});
