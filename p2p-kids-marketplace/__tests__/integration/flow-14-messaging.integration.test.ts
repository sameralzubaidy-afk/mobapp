/**
 * File: p2p-kids-marketplace/__tests__/integration/flow-14-messaging.integration.test.ts
 * MODULE-07 MSG-001-009 + MODULE-15.1 FLOW-14: E2E Integration Tests for Messaging
 *
 * Requirements:
 * - Run against staging Supabase (RUN_SUPABASE_E2E=true)
 * - Test end-to-end message flow between two users
 * - Verify delivery status transitions
 * - Verify real-time updates
 * - Verify unread counts
 * - Test with actual Supabase database
 */

import { supabase } from '@/config/supabase';
import {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  markTradeMessagesAsDelivered,
  markTradeMessagesAsRead,
} from '@/services/chat';

// Skip if not running E2E tests
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

describeE2E('FLOW-14 Messaging Integration (E2E)', () => {
  // Test user IDs (must exist in staging DB)
  const USER_1_ID = 'test-user-buyer-1'; // Replace with actual staging user ID
  const USER_2_ID = 'test-user-seller-1'; // Replace with actual staging user ID
  let testTradeId: string;
  let testMessageIds: string[] = [];

  beforeAll(async () => {
    // Create a test trade for messaging
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        buyer_id: USER_1_ID,
        seller_id: USER_2_ID,
        listing_id: 'test-listing-1', // Must exist in staging
        status: 'active',
        offer_amount: 25.00,
      })
      .select()
      .single();

    if (tradeError) {
      console.error('[E2E Setup] Failed to create test trade:', tradeError);
      throw tradeError;
    }

    testTradeId = trade.id;
    console.log(`[E2E Setup] Created test trade: ${testTradeId}`);
  });

  afterAll(async () => {
    // Cleanup: Delete test messages
    if (testMessageIds.length > 0) {
      await supabase
        .from('messages')
        .delete()
        .in('id', testMessageIds);
    }

    // Cleanup: Delete test trade
    if (testTradeId) {
      await supabase
        .from('trades')
        .delete()
        .eq('id', testTradeId);
    }

    console.log('[E2E Cleanup] Test data cleaned up');
  });

  describe('Send Message Flow', () => {
    it('should send a message from user 1 to user 2', async () => {
      const message = await sendMessage(
        testTradeId,
        USER_1_ID,
        USER_2_ID,
        'Hello, is this item still available?'
      );

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello, is this item still available?');
      expect(message.sender_id).toBe(USER_1_ID);
      expect(message.receiver_id).toBe(USER_2_ID);
      expect(message.trade_id).toBe(testTradeId);
      expect(message.delivery_status).toBe('sent');

      testMessageIds.push(message.id);
    });

    it('should send a reply from user 2 to user 1', async () => {
      const message = await sendMessage(
        testTradeId,
        USER_2_ID,
        USER_1_ID,
        'Yes, it is! When would you like to pick it up?'
      );

      expect(message).toBeDefined();
      expect(message.sender_id).toBe(USER_2_ID);
      expect(message.receiver_id).toBe(USER_1_ID);

      testMessageIds.push(message.id);
    });
  });

  describe('Get Messages Flow', () => {
    it('should retrieve all messages for a trade', async () => {
      const messages = await getMessages(testTradeId);

      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThanOrEqual(2);
      
      // Verify messages are ordered by created_at (newest first for inverted list)
      expect(messages[0].content).toContain('When would you like');
      expect(messages[1].content).toContain('Hello, is this item');
    });
  });

  describe('Get Conversations Flow', () => {
    it('should show conversation for user 1 with unread count', async () => {
      const conversations = await getConversations(USER_1_ID);

      expect(conversations).toBeDefined();
      const testConv = conversations.find(c => c.trade_id === testTradeId);
      
      expect(testConv).toBeDefined();
      expect(testConv?.other_user_id).toBe(USER_2_ID);
      expect(testConv?.last_message_content).toContain('When would you like');
      expect(testConv?.unread_count).toBeGreaterThan(0); // User 2's reply is unread
    });

    it('should show conversation for user 2 with last message preview', async () => {
      const conversations = await getConversations(USER_2_ID);

      expect(conversations).toBeDefined();
      const testConv = conversations.find(c => c.trade_id === testTradeId);
      
      expect(testConv).toBeDefined();
      expect(testConv?.other_user_id).toBe(USER_1_ID);
      expect(testConv?.last_message_content).toContain('When would you like'); // Own message
    });
  });

  describe('Mark As Read Flow', () => {
    it('should mark messages as read when user opens conversation', async () => {
      await markAsRead(testTradeId, USER_1_ID);

      // Verify unread count is now 0
      const conversations = await getConversations(USER_1_ID);
      const testConv = conversations.find(c => c.trade_id === testTradeId);
      
      expect(testConv?.unread_count).toBe(0);
    });

    it('should update delivery_status to "read" for sender messages', async () => {
      await markTradeMessagesAsRead(testTradeId, USER_1_ID);

      const messages = await getMessages(testTradeId);
      const userOneMessage = messages.find(m => m.sender_id === USER_1_ID);

      // User 1's message should be marked as "read" after user 2 reads it
      expect(userOneMessage?.delivery_status).toBe('read');
    });
  });

  describe('Delivery Status Transitions (MSG-008)', () => {
    it('should transition from sent -> delivered -> read', async () => {
      // Send a new message
      const message = await sendMessage(
        testTradeId,
        USER_1_ID,
        USER_2_ID,
        'Final test message for status'
      );

      testMessageIds.push(message.id);

      // Initial status: sent
      expect(message.delivery_status).toBe('sent');

      // Mark as delivered (when receiver's app receives it)
      await markTradeMessagesAsDelivered(testTradeId, USER_2_ID);

      let messages = await getMessages(testTradeId);
      let updatedMessage = messages.find(m => m.id === message.id);
      expect(updatedMessage?.delivery_status).toBe('delivered');

      // Mark as read (when receiver opens the conversation)
      await markTradeMessagesAsRead(testTradeId, USER_2_ID);

      messages = await getMessages(testTradeId);
      updatedMessage = messages.find(m => m.id === message.id);
      expect(updatedMessage?.delivery_status).toBe('read');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content gracefully', async () => {
      await expect(
        sendMessage(testTradeId, USER_1_ID, USER_2_ID, '')
      ).rejects.toThrow();
    });

    it('should handle invalid trade ID', async () => {
      await expect(
        sendMessage('invalid-trade-id', USER_1_ID, USER_2_ID, 'Test')
      ).rejects.toThrow();
    });

    it('should return empty array for trade with no messages', async () => {
      // Create a trade with no messages
      const { data: emptyTrade } = await supabase
        .from('trades')
        .insert({
          buyer_id: USER_1_ID,
          seller_id: USER_2_ID,
          listing_id: 'test-listing-1',
          status: 'active',
          offer_amount: 10.00,
        })
        .select()
        .single();

      const messages = await getMessages(emptyTrade!.id);
      expect(messages).toEqual([]);

      // Cleanup
      await supabase.from('trades').delete().eq('id', emptyTrade!.id);
    });
  });

  describe('SQL Requirements Check', () => {
    it('should verify messages table has required columns', async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        const message = data[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('trade_id');
        expect(message).toHaveProperty('sender_id');
        expect(message).toHaveProperty('receiver_id');
        expect(message).toHaveProperty('content');
        expect(message).toHaveProperty('message_type');
        expect(message).toHaveProperty('delivery_status');
        expect(message).toHaveProperty('created_at');
      }
    });

    it('should verify trades_with_messages view exists', async () => {
      const { data, error } = await supabase
        .from('trades_with_messages')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});
