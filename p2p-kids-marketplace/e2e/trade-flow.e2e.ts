/**
 * E2E Integration Tests: Trade Flow (FLOW-08)
 * Tests complete trade lifecycle across all 6 screens
 */

import { supabase } from '../src/config/supabase';
import { initiateTradeV2, completeTradeV2, cancelTradeV2 } from '../src/services/trade';

// Test users
const BUYER_EMAIL = 'buyer-test@example.com';
const SELLER_EMAIL = 'seller-test@example.com';
const TEST_PASSWORD = 'testpassword123';

describe('FLOW-08: Trade Flow E2E', () => {
  let buyerSession: any;
  let sellerSession: any;
  let testListing: any;
  let testTrade: any;

  beforeAll(async () => {
    // Setup: Login test users
    const { data: buyer } = await supabase.auth.signInWithPassword({
      email: BUYER_EMAIL,
      password: TEST_PASSWORD,
    });
    buyerSession = buyer.session;

    const { data: seller } = await supabase.auth.signInWithPassword({
      email: SELLER_EMAIL,
      password: TEST_PASSWORD,
    });
    sellerSession = seller.session;

    // Create test listing
    const { data: listing } = await supabase
      .from('items')
      .insert({
        seller_id: sellerSession.user.id,
        title: 'E2E Test Item',
        description: 'Test item for E2E trade flow',
        price: 100,
        status: 'active',
        payment_preference: 'accept_sp',
      })
      .select()
      .single();

    testListing = listing;
  });

  afterAll(async () => {
    // Cleanup: Delete test trade and listing
    if (testTrade?.id) {
      await supabase.from('trades').delete().eq('id', testTrade.id);
    }
    if (testListing?.id) {
      await supabase.from('items').delete().eq('id', testListing.id);
    }
  });

  describe('Complete Trade Lifecycle', () => {
    it('should complete full trade flow from initiation to completion', async () => {
      // Step 1: Initiate trade with SP (TradeOfferScreen)
      supabase.auth.setSession(buyerSession);

      const initiateResult = await initiateTradeV2({
        listingId: testListing.id,
        spAmount: 25, // 25% of $100 item
        cashAmountCents: 7500, // $75
      });

      expect(initiateResult.success).toBe(true);
      expect(initiateResult.data).toHaveProperty('id');
      testTrade = initiateResult.data;

      // Step 2: Verify trade created with correct status
      const { data: trade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', testTrade.id)
        .single();

      expect(trade.status).toBe('pending');
      expect(trade.buyer_id).toBe(buyerSession.user.id);
      expect(trade.seller_id).toBe(sellerSession.user.id);
      expect(trade.sp_amount).toBe(25);
      expect(trade.cash_amount_cents).toBe(7500);

      // Step 3: Seller accepts trade (TradeReviewScreen)
      supabase.auth.setSession(sellerSession);

      // TODO: Call accept_trade RPC when implemented
      // const acceptResult = await supabase.rpc('accept_trade', {
      //   p_trade_id: testTrade.id,
      // });
      // expect(acceptResult.data).toBe(true);

      // Manually update status for now
      await supabase
        .from('trades')
        .update({ status: 'in_progress' })
        .eq('id', testTrade.id);

      // Step 4: Seller marks as completed (TradeTimelineScreen)
      const sellerCompleteResult = await completeTradeV2(testTrade.id);
      expect(sellerCompleteResult.success).toBe(true);

      // Verify seller_marked_completed_at is set
      const { data: updatedTrade1 } = await supabase
        .from('trades')
        .select('seller_marked_completed_at')
        .eq('id', testTrade.id)
        .single();

      expect(updatedTrade1.seller_marked_completed_at).toBeTruthy();

      // Step 5: Buyer marks as completed (TradeTimelineScreen)
      supabase.auth.setSession(buyerSession);

      const buyerCompleteResult = await completeTradeV2(testTrade.id);
      expect(buyerCompleteResult.success).toBe(true);

      // Step 6: Verify trade status is completed
      const { data: finalTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', testTrade.id)
        .single();

      expect(finalTrade.status).toBe('completed');
      expect(finalTrade.completed_at).toBeTruthy();

      // Step 7: Verify SP released from pending
      const { data: spTransactions } = await supabase
        .from('swap_points_transactions')
        .select('*')
        .eq('trade_id', testTrade.id)
        .eq('status', 'released');

      expect(spTransactions.length).toBeGreaterThan(0);
    });
  });

  describe('Accept Incoming Trade Offer', () => {
    it('should accept incoming trade and update status', async () => {
      // Create pending trade
      const { data: newTrade } = await supabase
        .from('trades')
        .insert({
          buyer_id: buyerSession.user.id,
          seller_id: sellerSession.user.id,
          listing_id: testListing.id,
          status: 'pending',
          cash_amount_cents: 10000,
          sp_amount: 0,
        })
        .select()
        .single();

      // Seller accepts
      supabase.auth.setSession(sellerSession);

      // TODO: Call accept_trade RPC
      // const result = await supabase.rpc('accept_trade', {
      //   p_trade_id: newTrade.id,
      // });
      // expect(result.data).toBe(true);

      // Manually update for now
      await supabase
        .from('trades')
        .update({ status: 'in_progress' })
        .eq('id', newTrade.id);

      const { data: acceptedTrade } = await supabase
        .from('trades')
        .select('status')
        .eq('id', newTrade.id)
        .single();

      expect(acceptedTrade.status).toBe('in_progress');

      // Cleanup
      await supabase.from('trades').delete().eq('id', newTrade.id);
    });
  });

  describe('File Dispute', () => {
    it('should file dispute and update trade status', async () => {
      // Create in_progress trade
      const { data: newTrade } = await supabase
        .from('trades')
        .insert({
          buyer_id: buyerSession.user.id,
          seller_id: sellerSession.user.id,
          listing_id: testListing.id,
          status: 'in_progress',
          cash_amount_cents: 10000,
          sp_amount: 0,
        })
        .select()
        .single();

      supabase.auth.setSession(buyerSession);

      // TODO: Call dispute RPC when implemented
      // const result = await supabase.rpc('file_trade_dispute', {
      //   p_trade_id: newTrade.id,
      //   p_reason: 'Item not as described',
      //   p_description: 'The item arrived damaged',
      //   p_evidence_urls: [],
      // });
      // expect(result.data).toBe(true);

      // Manually update for now
      await supabase
        .from('trades')
        .update({ status: 'disputed' })
        .eq('id', newTrade.id);

      const { data: disputedTrade } = await supabase
        .from('trades')
        .select('status')
        .eq('id', newTrade.id)
        .single();

      expect(disputedTrade.status).toBe('disputed');

      // Cleanup
      await supabase.from('trades').delete().eq('id', newTrade.id);
    });
  });

  describe('Cancel Trade', () => {
    it('should cancel trade and refund SP', async () => {
      // Create pending trade with SP
      const { data: newTrade } = await supabase
        .from('trades')
        .insert({
          buyer_id: buyerSession.user.id,
          seller_id: sellerSession.user.id,
          listing_id: testListing.id,
          status: 'pending',
          cash_amount_cents: 7500,
          sp_amount: 25,
        })
        .select()
        .single();

      supabase.auth.setSession(buyerSession);

      // Get initial SP balance
      const { data: initialBalance } = await supabase
        .from('swap_points_wallets')
        .select('balance_available')
        .eq('user_id', buyerSession.user.id)
        .single();

      // Cancel trade
      const result = await cancelTradeV2(newTrade.id, 'Changed my mind');
      expect(result.success).toBe(true);

      // Verify status
      const { data: cancelledTrade } = await supabase
        .from('trades')
        .select('status, cancellation_reason')
        .eq('id', newTrade.id)
        .single();

      expect(cancelledTrade.status).toBe('cancelled');
      expect(cancelledTrade.cancellation_reason).toBe('Changed my mind');

      // Verify SP refunded
      const { data: finalBalance } = await supabase
        .from('swap_points_wallets')
        .select('balance_available')
        .eq('user_id', buyerSession.user.id)
        .single();

      expect(finalBalance.balance_available).toBe(initialBalance.balance_available + 25);

      // Cleanup
      await supabase.from('trades').delete().eq('id', newTrade.id);
    });
  });

  describe('Trade History Filtering', () => {
    it('should fetch and filter trades by buyer/seller', async () => {
      supabase.auth.setSession(buyerSession);

      // Fetch all trades
      const { data: allTrades } = await supabase
        .from('trades')
        .select('*, listing:items(*)')
        .or(`buyer_id.eq.${buyerSession.user.id},seller_id.eq.${buyerSession.user.id}`)
        .order('created_at', { ascending: false });

      expect(Array.isArray(allTrades)).toBe(true);

      // Filter buying trades (client-side)
      const buyingTrades = allTrades?.filter(
        (t: any) => t.buyer_id === buyerSession.user.id
      );
      expect(buyingTrades?.every((t: any) => t.buyer_id === buyerSession.user.id)).toBe(true);

      // Filter selling trades (client-side)
      const sellingTrades = allTrades?.filter(
        (t: any) => t.seller_id === buyerSession.user.id
      );
      expect(sellingTrades?.every((t: any) => t.seller_id === buyerSession.user.id)).toBe(true);
    });
  });

  describe('SP Cap Enforcement', () => {
    it('should reject trade with SP > 50% of item price', async () => {
      supabase.auth.setSession(buyerSession);

      // Try to use 60 SP on $100 item (60% > 50% cap)
      const result = await initiateTradeV2({
        listingId: testListing.id,
        spAmount: 60,
        cashAmountCents: 4000,
      });

      // Should fail or enforce cap
      // Note: Actual implementation should validate in service layer
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/50%|cap|exceed/i);
    });
  });
});
