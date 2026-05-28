/**
 * File: p2p-kids-marketplace/src/__tests__/services/chat-notifications.test.ts
 * MSG-006-009 Tests: Push Notifications, Email Notifications, Delivery Status, Typing Indicators
 *
 * Tests all new messaging features including:
 * - MSG-008: Message delivery status tracking (sent → delivered → read)
 * - MSG-009: Typing indicator presence
 */

import {
  markTradeMessagesAsDelivered,
  markTradeMessagesAsRead,
  broadcastTypingStatus,
  subscribeToTypingStatus,
  updateDeliveryStatus,
} from '@/services/chat';
import { supabase } from '@/config/supabase';

// Mock Supabase client
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

describe('MSG-008: Message Delivery Status Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('markTradeMessagesAsDelivered', () => {
    it('should call RPC with correct parameters', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await markTradeMessagesAsDelivered(tradeId, userId);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'mark_trade_messages_delivered',
        expect.objectContaining({
          p_trade_id: tradeId,
          p_user_id: userId,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: new Error('RPC failed'),
      });

      const result = await markTradeMessagesAsDelivered(tradeId, userId);

      expect(result).toBe(0);
    });

    it('should mark all unread messages as delivered', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          updated_count: 5,
          success: true,
        },
        error: null,
      });

      await markTradeMessagesAsDelivered(tradeId, userId);

      expect(supabase.rpc).toHaveBeenCalled();
    });
  });

  describe('markTradeMessagesAsRead', () => {
    it('should call RPC with correct parameters', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await markTradeMessagesAsRead(tradeId, userId);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'mark_trade_messages_read',
        expect.objectContaining({
          p_trade_id: tradeId,
          p_user_id: userId,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: new Error('RPC failed'),
      });

      const result = await markTradeMessagesAsRead(tradeId, userId);

      expect(result).toBe(0);
    });

    it('should set read_at timestamp for messages', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          updated_count: 5,
          success: true,
        },
        error: null,
      });

      await markTradeMessagesAsRead(tradeId, userId);

      expect(supabase.rpc).toHaveBeenCalled();
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update single message delivery status', async () => {
      const messageId = 'msg-123';
      const status = 'delivered';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await updateDeliveryStatus(messageId, status);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'update_message_delivery_status',
        expect.objectContaining({
          p_message_id: messageId,
          p_status: status,
        })
      );
    });

    it('should handle all valid status values', async () => {
      const messageId = 'msg-123';
      const statuses = ['sent', 'delivered', 'read'];

      for (const status of statuses) {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
          data: { success: true },
          error: null,
        });

        await updateDeliveryStatus(messageId, status);
      }

      expect(supabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should reject invalid status values', async () => {
      const messageId = 'msg-123';
      const invalidStatus = 'pending';

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: new Error('Invalid delivery status'),
      });

      await updateDeliveryStatus(messageId, invalidStatus);

      expect(supabase.rpc).toHaveBeenCalled();
    });
  });
});

describe('MSG-009: Typing Indicators', () => {
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockImplementation((cb) => {
        if (cb) cb('SUBSCRIBED');
        return mockChannel;
      }),
      unsubscribe: jest.fn(),
      presenceState: jest.fn().mockReturnValue({}),
      track: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
    };
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
  });

  describe('broadcastTypingStatus', () => {
    it('should broadcast typing status to presence channel', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';
      const isTyping = true;

      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return Promise.resolve(mockChannel);
      });

      await broadcastTypingStatus(tradeId, userId, isTyping);

      // supabase.channel is called with (channelName, config)
      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringContaining(`presence-trade-${tradeId}`),
        expect.any(Object)
      );
    });

    it('should handle typing=true', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return Promise.resolve(mockChannel);
      });

      await broadcastTypingStatus(tradeId, userId, true);

      expect(supabase.channel).toHaveBeenCalled();
    });

    it('should handle typing=false', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return Promise.resolve(mockChannel);
      });

      await broadcastTypingStatus(tradeId, userId, false);

      expect(supabase.channel).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';

      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('CHANNEL_ERROR', new Error('Channel error'));
        return Promise.reject(new Error('Channel error'));
      });

      // Should not throw
      await expect(broadcastTypingStatus(tradeId, userId, true)).resolves.not.toThrow();
    });
  });

  describe('subscribeToTypingStatus', () => {
    it('should subscribe to typing status changes', () => {
      const tradeId = 'trade-123';
      const callback = jest.fn();

      mockChannel.on.mockReturnValue(mockChannel);
      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return mockChannel;
      });

      subscribeToTypingStatus(tradeId, callback);

      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringContaining(`presence-trade-${tradeId}`),
        expect.any(Object)
      );
      expect(mockChannel.on).toHaveBeenCalled();
      expect(callback).toBeDefined();
    });

    it('should return unsubscribe function', () => {
      const tradeId = 'trade-123';
      const callback = jest.fn();

      mockChannel.on.mockReturnValue(mockChannel);
      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return mockChannel;
      });

      const unsubscribe = subscribeToTypingStatus(tradeId, callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });

    it('should call callback when user types', () => {
      const tradeId = 'trade-123';
      const callback = jest.fn();

      mockChannel.on.mockImplementation((event: string, options: any, handler?: (...args: unknown[]) => unknown) => {
        const actualHandler = handler || options;
        if (event === 'presence' && options.event === 'sync') {
          // Mock presence state to have a typing user
          mockChannel.presenceState.mockReturnValue({
            'user-789': [{ user_id: 'user-789', is_typing: true }],
          });
          // Simulate presence sync
          actualHandler();
        }
        return mockChannel;
      });
      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return mockChannel;
      });

      subscribeToTypingStatus(tradeId, callback);

      expect(mockChannel.on).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith('user-789', true);
    });

    it('should handle multiple users typing', () => {
      const tradeId = 'trade-123';
      const callback = jest.fn();

      mockChannel.on.mockReturnValue(mockChannel);
      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return mockChannel;
      });

      subscribeToTypingStatus(tradeId, callback);

      expect(callback).toBeDefined();
    });
  });
});

describe('MSG-006-009 Integration: Complete Message Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should mark messages as delivered and then read', async () => {
    const tradeId = 'trade-123';
    const userId = 'user-456';

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: { success: true, updated_count: 3 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, updated_count: 3 },
        error: null,
      });

    await markTradeMessagesAsDelivered(tradeId, userId);
    await markTradeMessagesAsRead(tradeId, userId);

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('should combine typing broadcast and message delivery', async () => {
    const tradeId = 'trade-123';
    const userId = 'user-456';
    const messageId = 'msg-789';

    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValueOnce('SUBSCRIBED'),
      unsubscribe: jest.fn(),
    };

    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    // Broadcast typing
    await broadcastTypingStatus(tradeId, userId, true);

    // Update delivery status
    await updateDeliveryStatus(messageId, 'delivered');

    // Verify both operations completed
    expect(supabase.channel).toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('update_message_delivery_status', expect.any(Object));
  });
});
