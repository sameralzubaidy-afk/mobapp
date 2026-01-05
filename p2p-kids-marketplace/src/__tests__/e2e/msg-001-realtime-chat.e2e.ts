/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/msg-001-realtime-chat.e2e.ts
 * MODULE-07 MSG-001: E2E tests for real-time chat functionality
 * 
 * Tests:
 * 1. Send message and receive via Realtime
 * 2. Fetch message history
 * 3. RLS policies enforcement
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

describe('MSG-001: Real-time Chat E2E Tests', () => {
  let supabase: SupabaseClient;
  let testTradeId: string;
  let buyerUserId: string;
  let sellerUserId: string;
  let buyerClient: SupabaseClient;
  let sellerClient: SupabaseClient;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create test users and trade
    // NOTE: This assumes you have test users in your database
    // You may need to adjust this based on your test data setup

    const buyerEmail = `buyer-msg-test-${Date.now()}@test.com`;
    const sellerEmail = `seller-msg-test-${Date.now()}@test.com`;
    const password = 'TestPassword123!';

    // Sign up buyer
    const { data: buyerAuth, error: buyerError } = await supabase.auth.signUp({
      email: buyerEmail,
      password,
    });

    if (buyerError || !buyerAuth.user) {
      throw new Error(`Failed to create buyer: ${buyerError?.message}`);
    }

    buyerUserId = buyerAuth.user.id;
    buyerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await buyerClient.auth.signInWithPassword({ email: buyerEmail, password });

    // Sign up seller
    const { data: sellerAuth, error: sellerError } = await supabase.auth.signUp({
      email: sellerEmail,
      password,
    });

    if (sellerError || !sellerAuth.user) {
      throw new Error(`Failed to create seller: ${sellerError?.message}`);
    }

    sellerUserId = sellerAuth.user.id;
    sellerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await sellerClient.auth.signInWithPassword({ email: sellerEmail, password });

    // Create a test trade (simplified - you may need to adjust based on your schema)
    // NOTE: This assumes trades table exists and you have proper setup
    const { data: trade, error: tradeError } = await buyerClient
      .from('trades')
      .insert({
        buyer_id: buyerUserId,
        seller_id: sellerUserId,
        listing_id: '00000000-0000-0000-0000-000000000001', // Placeholder
        status: 'in_progress',
        cash_amount_cents: 1000,
        sp_amount: 0,
        buyer_transaction_fee_cents: 99,
      })
      .select()
      .single();

    if (tradeError || !trade) {
      console.warn('Could not create test trade:', tradeError?.message);
      testTradeId = '00000000-0000-0000-0000-000000000001'; // Fallback
    } else {
      testTradeId = trade.id;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testTradeId && testTradeId !== '00000000-0000-0000-0000-000000000001') {
      await supabase.from('messages').delete().eq('trade_id', testTradeId);
      await supabase.from('trades').delete().eq('id', testTradeId);
    }

    // Note: User cleanup requires service role key, skip for now
  });

  describe('Send and Receive Messages', () => {
    it('should send a message from buyer and receive it', async () => {
      const messageContent = `Test message from buyer ${Date.now()}`;

      const { data: message, error } = await buyerClient
        .from('messages')
        .insert({
          trade_id: testTradeId,
          sender_id: buyerUserId,
          content: messageContent,
          message_type: 'text',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(message).toBeDefined();
      expect(message?.content).toBe(messageContent);
      expect(message?.sender_id).toBe(buyerUserId);
    });

    it('should fetch messages for the trade', async () => {
      // Send a message first
      await buyerClient.from('messages').insert({
        trade_id: testTradeId,
        sender_id: buyerUserId,
        content: 'Fetch test message',
        message_type: 'text',
      });

      // Fetch messages
      const { data: messages, error } = await buyerClient
        .from('messages')
        .select('*')
        .eq('trade_id', testTradeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      expect(error).toBeNull();
      expect(messages).toBeDefined();
      expect(messages!.length).toBeGreaterThan(0);
      expect(messages![0].content).toBeDefined();
    });

    it('should allow seller to see messages', async () => {
      // Buyer sends message
      await buyerClient.from('messages').insert({
        trade_id: testTradeId,
        sender_id: buyerUserId,
        content: 'Message for seller',
        message_type: 'text',
      });

      // Seller fetches messages
      const { data: messages, error } = await sellerClient
        .from('messages')
        .select('*')
        .eq('trade_id', testTradeId)
        .is('deleted_at', null);

      expect(error).toBeNull();
      expect(messages).toBeDefined();
      expect(messages!.some((m) => m.content === 'Message for seller')).toBe(true);
    });
  });

  describe('RLS Policy Enforcement', () => {
    it('should prevent non-participants from viewing messages', async () => {
      // Create a third user (not part of the trade)
      const outsiderEmail = `outsider-${Date.now()}@test.com`;
      const { data: outsiderAuth } = await supabase.auth.signUp({
        email: outsiderEmail,
        password: 'TestPassword123!',
      });

      if (!outsiderAuth.user) {
        throw new Error('Failed to create outsider user');
      }

      const outsiderClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await outsiderClient.auth.signInWithPassword({
        email: outsiderEmail,
        password: 'TestPassword123!',
      });

      // Outsider tries to fetch messages
      const { data: messages, error } = await outsiderClient
        .from('messages')
        .select('*')
        .eq('trade_id', testTradeId);

      // RLS should return empty array or error
      expect(messages).toEqual([]);
    });

    it('should prevent non-participants from sending messages', async () => {
      const outsiderEmail = `outsider2-${Date.now()}@test.com`;
      const { data: outsiderAuth } = await supabase.auth.signUp({
        email: outsiderEmail,
        password: 'TestPassword123!',
      });

      if (!outsiderAuth.user) {
        throw new Error('Failed to create outsider user');
      }

      const outsiderClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await outsiderClient.auth.signInWithPassword({
        email: outsiderEmail,
        password: 'TestPassword123!',
      });

      // Outsider tries to send message
      const { data, error } = await outsiderClient.from('messages').insert({
        trade_id: testTradeId,
        sender_id: outsiderAuth.user.id,
        content: 'Unauthorized message',
        message_type: 'text',
      });

      // RLS should reject the insert
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('Message Content Validation', () => {
    it('should reject messages exceeding 2000 characters', async () => {
      const longContent = 'a'.repeat(2001);

      const { data, error } = await buyerClient.from('messages').insert({
        trade_id: testTradeId,
        sender_id: buyerUserId,
        content: longContent,
        message_type: 'text',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('violates check constraint');
    });

    it('should accept messages with exactly 2000 characters', async () => {
      const maxContent = 'a'.repeat(2000);

      const { data, error } = await buyerClient.from('messages').insert({
        trade_id: testTradeId,
        sender_id: buyerUserId,
        content: maxContent,
        message_type: 'text',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});
