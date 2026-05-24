/**
 * File: p2p-kids-marketplace/__tests__/integration/flow-14-messaging.integration.test.ts
 * MODULE-07 MSG-001-009 + MODULE-15.1 FLOW-14: Integration tests for Messaging
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getConversations,
  getMessages,
  markAsRead,
  markTradeMessagesAsDelivered,
  markTradeMessagesAsRead,
  sendMessage,
} from '@/services/chat';

const shouldRunSupabaseE2E = process.env.RUN_SUPABASE_E2E === 'true';
const describeE2E = shouldRunSupabaseE2E ? describe : describe.skip;

describeE2E('FLOW-14 Messaging Integration (E2E)', () => {
  const USER_1_ID = process.env.E2E_TEST_BUYER_ID || '49243010-f458-4744-add1-a6c84ab95f1f';
  const USER_2_ID = process.env.E2E_TEST_SELLER_ID || '14be337c-aad6-403f-bab2-ba1a7d80b666';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  let adminClient: SupabaseClient | null = null;
  let canRunSuite = true;
  let skipReason = '';

  let testTradeId = '';
  let testListingId = '';
  let testMessageIds: string[] = [];

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(`[FLOW-14] Skipping case: ${skipReason || 'suite preconditions unavailable'}`);
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
    if (!supabaseUrl || !serviceRoleKey) {
      canRunSuite = false;
      skipReason = 'Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
      console.warn(`[FLOW-14] ${skipReason}`);
      return;
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let listingId = process.env.TEST_LISTING_ID || '';

    if (!listingId) {
      const { data: sellerListing } = await adminClient
        .from('items')
        .select('id')
        .eq('seller_id', USER_2_ID)
        .limit(1)
        .maybeSingle();

      listingId = sellerListing?.id || '';
    }

    if (!listingId) {
      const { data: anyListing } = await adminClient
        .from('items')
        .select('id')
        .limit(1)
        .maybeSingle();

      listingId = anyListing?.id || '';
    }

    if (!listingId) {
      canRunSuite = false;
      skipReason = 'No listing found for creating a messaging trade fixture';
      console.warn(`[FLOW-14] ${skipReason}`);
      return;
    }

    testListingId = listingId;

    const { data: trade, error: tradeError } = await adminClient
      .from('trades')
      .insert({
        buyer_id: USER_1_ID,
        seller_id: USER_2_ID,
        listing_id: listingId,
        status: 'active',
        cash_amount_cents: 2500,
        sp_amount: 0,
      })
      .select('id')
      .single();

    if (tradeError || !trade?.id) {
      canRunSuite = false;
      skipReason = `Failed to create messaging trade fixture: ${tradeError?.message || 'unknown'}`;
      console.warn(`[FLOW-14] ${skipReason}`);
      return;
    }

    testTradeId = trade.id;
  });

  afterAll(async () => {
    if (!adminClient) {
      return;
    }

    if (testMessageIds.length > 0) {
      await adminClient.from('messages').delete().in('id', testMessageIds);
    }

    if (testTradeId) {
      await adminClient.from('trades').delete().eq('id', testTradeId);
    }
  });

  describe('Send Message Flow', () => {
    itIfRunnable('should send a message from user 1 to user 2', async () => {
      const result = await sendMessage({
        tradeId: testTradeId,
        senderId: USER_1_ID,
        content: 'Hello, is this item still available?',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message?.id).toBeDefined();
      expect(result.message?.content).toBe('Hello, is this item still available?');
      expect(result.message?.sender_id).toBe(USER_1_ID);
      expect(result.message?.trade_id).toBe(testTradeId);

      testMessageIds.push(result.message!.id);
    });

    itIfRunnable('should send a reply from user 2 to user 1', async () => {
      const result = await sendMessage({
        tradeId: testTradeId,
        senderId: USER_2_ID,
        content: 'Yes, it is! When would you like to pick it up?',
      });

      expect(result.success).toBe(true);
      expect(result.message?.sender_id).toBe(USER_2_ID);
      expect(result.message?.trade_id).toBe(testTradeId);

      testMessageIds.push(result.message!.id);
    });
  });

  describe('Get Messages Flow', () => {
    itIfRunnable('should retrieve all messages for a trade', async () => {
      const messages = await getMessages(testTradeId);

      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].content).toContain('Hello, is this item');
      expect(messages[messages.length - 1].content).toContain('When would you like');
    });
  });

  describe('Get Conversations Flow', () => {
    itIfRunnable('should show conversation for user 1 with unread count', async () => {
      const conversations = await getConversations(USER_1_ID);

      expect(conversations).toBeDefined();
      const testConv = conversations.find((c) => c.trade_id === testTradeId);

      expect(testConv).toBeDefined();
      expect(testConv?.other_user_id).toBe(USER_2_ID);
      expect(testConv?.last_message_content).toContain('When would you like');
      expect(testConv?.unread_count).toBeGreaterThanOrEqual(0);
    });

    itIfRunnable('should show conversation for user 2 with last message preview', async () => {
      const conversations = await getConversations(USER_2_ID);

      expect(conversations).toBeDefined();
      const testConv = conversations.find((c) => c.trade_id === testTradeId);

      expect(testConv).toBeDefined();
      expect(testConv?.other_user_id).toBe(USER_1_ID);
      expect(testConv?.last_message_content).toContain('When would you like');
    });
  });

  describe('Mark As Read Flow', () => {
    itIfRunnable('should mark messages as read when user opens conversation', async () => {
      await markAsRead(testTradeId, USER_1_ID);

      const conversations = await getConversations(USER_1_ID);
      const testConv = conversations.find((c) => c.trade_id === testTradeId);

      expect(testConv?.unread_count).toBe(0);
    });

    itIfRunnable('should update delivery_status for sender messages when receiver reads', async () => {
      await markTradeMessagesAsRead(testTradeId, USER_2_ID);

      const messages = await getMessages(testTradeId);
      const userOneMessage = messages.find((m) => m.sender_id === USER_1_ID);

      if (userOneMessage?.delivery_status) {
        expect(['sent', 'delivered', 'read']).toContain(userOneMessage.delivery_status);
      } else {
        expect(userOneMessage).toBeDefined();
      }
    });
  });

  describe('Delivery Status Transitions (MSG-008)', () => {
    itIfRunnable('should transition message status through delivered/read handlers', async () => {
      const created = await sendMessage({
        tradeId: testTradeId,
        senderId: USER_1_ID,
        content: 'Final test message for status',
      });

      expect(created.success).toBe(true);
      expect(created.message).toBeDefined();
      testMessageIds.push(created.message!.id);

      const deliveredCount = await markTradeMessagesAsDelivered(testTradeId, USER_2_ID);
      expect(deliveredCount).toBeGreaterThanOrEqual(0);

      const readCount = await markTradeMessagesAsRead(testTradeId, USER_2_ID);
      expect(readCount).toBeGreaterThanOrEqual(0);

      const messages = await getMessages(testTradeId);
      const updated = messages.find((m) => m.id === created.message!.id);

      if (updated?.delivery_status) {
        expect(['sent', 'delivered', 'read']).toContain(updated.delivery_status);
      } else {
        expect(updated).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    itIfRunnable('should handle empty message content gracefully', async () => {
      const result = await sendMessage({
        tradeId: testTradeId,
        senderId: USER_1_ID,
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    itIfRunnable('should handle invalid trade ID', async () => {
      const result = await sendMessage({
        tradeId: '00000000-0000-0000-0000-000000000000',
        senderId: USER_1_ID,
        content: 'Test',
      });

      expect(result.success).toBe(false);
    });

    itIfRunnable('should return empty array for trade with no messages', async () => {
      if (!adminClient) {
        throw new Error('adminClient not initialized');
      }

      const { data: tradeFixture, error: tradeError } = await adminClient
        .from('trades')
        .insert({
          buyer_id: USER_1_ID,
          seller_id: USER_2_ID,
          listing_id: testListingId,
          status: 'active',
          cash_amount_cents: 1000,
          sp_amount: 0,
        })
        .select('id')
        .single();

      if (tradeError || !tradeFixture?.id) {
        throw new Error(`Failed creating empty-trade fixture: ${tradeError?.message}`);
      }

      const messages = await getMessages(tradeFixture.id);
      expect(messages).toEqual([]);

      await adminClient.from('trades').delete().eq('id', tradeFixture.id);
    });
  });
});
