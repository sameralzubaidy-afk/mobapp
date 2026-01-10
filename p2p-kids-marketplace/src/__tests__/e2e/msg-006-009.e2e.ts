/**
 * End-to-End Tests: MSG-006 through MSG-009
 *
 * NOTE: This suite is mocked (no network / no real Supabase).
 */

import {
  sendMessage,
  markTradeMessagesAsDelivered,
  markTradeMessagesAsRead,
  broadcastTypingStatus,
  subscribeToTypingStatus,
} from '@/services/chat';
import type { Message } from '@/services/chat';
import { supabase } from '@/config/supabase';

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

describe('E2E: MSG-006-009 Complete Messaging Flow', () => {
  let mockTrade: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrade = {
      id: 'trade-e2e-123',
      buyer_id: 'buyer-user-001',
      seller_id: 'seller-user-002',
      listing_id: 'listing-xyz',
      status: 'active',
    };
  });

  it('[MSG-008] send -> delivered -> read (RPC calls)', async () => {
    const buyerId = 'buyer-user-001';

    const newMessage: Message = {
      id: 'msg-002',
      trade_id: mockTrade.id,
      sender_id: buyerId,
      content: 'Yes, still available!',
      message_type: 'text',
      created_at: new Date().toISOString(),
      delivery_status: 'sent',
      delivered_at: null,
      read_at: null,
    };

    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValueOnce({ data: newMessage, error: null }),
    });

    const sendResult = await sendMessage({
      tradeId: mockTrade.id,
      senderId: buyerId,
      content: newMessage.content,
    });

    expect(sendResult.success).toBe(true);

    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { success: true, updated_count: 1 },
      error: null,
    });
    await markTradeMessagesAsDelivered(mockTrade.id, buyerId);

    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { success: true, updated_count: 1 },
      error: null,
    });
    await markTradeMessagesAsRead(mockTrade.id, buyerId);

    expect(supabase.rpc).toHaveBeenCalledWith(
      'mark_trade_messages_delivered',
      expect.any(Object)
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'mark_trade_messages_read',
      expect.any(Object)
    );
  });

  it('[MSG-009] typing indicator channel + unsubscribe', async () => {
    const tradeId = mockTrade.id;
    const typerId = 'seller-user-002';

    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValueOnce('SUBSCRIBED'),
      unsubscribe: jest.fn(),
      track: jest.fn(),
      send: jest.fn(),
    };

    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

    const unsubscribe = subscribeToTypingStatus(tradeId, jest.fn());
    await broadcastTypingStatus(tradeId, typerId, true);
    await broadcastTypingStatus(tradeId, typerId, false);

    expect(supabase.channel).toHaveBeenCalledWith(
      expect.stringContaining('presence-trade-'),
      expect.any(Object)
    );

    unsubscribe();
    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });
});
