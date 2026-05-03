/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/chat-realtime.e2e.test.tsx
 * MODULE-07 MSG-001: E2E tests for real-time chat functionality
 */

import {
  subscribeToMessages,
  unsubscribeFromMessages,
  broadcastTypingStatus,
  subscribeToTypingStatus,
} from '@/services/chat';
import { supabase } from '@/config/supabase';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    channel: jest.fn(),
  },
}));

describe('Real-time Chat E2E', () => {
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
      track: jest.fn().mockResolvedValue(undefined),
      presenceState: jest.fn().mockReturnValue({}),
    };
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
  });

  describe('Message Subscription', () => {
    it('should subscribe to messages for a trade', () => {
      const tradeId = 'trade-123';
      const onMessage = jest.fn();

      const channel = subscribeToMessages(tradeId, onMessage);

      expect(supabase.channel).toHaveBeenCalledWith(`trade:${tradeId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trade_id=eq.${tradeId}`,
        }),
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle new message events', async () => {
      const tradeId = 'trade-123';
      const onMessage = jest.fn();
      let messageHandler: Function;

      mockChannel.on.mockImplementation((event: string, config: any, handler: Function) => {
        if (event === 'postgres_changes') {
          messageHandler = handler;
        }
        return mockChannel;
      });

      // Mock message fetch for the new message
      const mockMessageData = {
        id: 'msg-123',
        trade_id: tradeId,
        sender_id: 'user-456',
        content: 'Hello world',
        created_at: '2024-01-15T10:00:00Z',
        sender: { first_name: 'John', profile_image_url: null },
      };

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMessageData,
              error: null,
            }),
          }),
        }),
      });

      // Temporarily override supabase.from for this test
      const originalFrom = supabase.from;
      (supabase as any).from = mockFrom;

      subscribeToMessages(tradeId, onMessage);

      // Simulate new message event
      await messageHandler({
        new: { id: 'msg-123', trade_id: tradeId },
      });

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-123',
          content: 'Hello world',
          sender: mockMessageData.sender,
        })
      );

      // Restore original from method
      (supabase as any).from = originalFrom;
    });

    it('should unsubscribe from messages', () => {
      const channel = subscribeToMessages('trade-123', jest.fn());

      unsubscribeFromMessages(channel);

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Typing Indicators', () => {
    it('should broadcast typing status', async () => {
      const tradeId = 'trade-123';
      const userId = 'user-456';
      const isTyping = true;

      await broadcastTypingStatus(tradeId, userId, isTyping);

      expect(supabase.channel).toHaveBeenCalledWith(
        `presence-trade-${tradeId}`,
        expect.objectContaining({
          config: {
            presence: { key: 'typing' },
          },
        })
      );
    });

    it('should subscribe to typing status changes', () => {
      const tradeId = 'trade-123';
      const onTypingChange = jest.fn();

      const unsubscribe = subscribeToTypingStatus(tradeId, onTypingChange);

      expect(supabase.channel).toHaveBeenCalledWith(
        `presence-trade-${tradeId}`,
        expect.objectContaining({
          config: {
            presence: { key: 'typing' },
          },
        })
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'sync' },
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'join' },
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'leave' },
        expect.any(Function)
      );

      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle presence sync events', () => {
      const tradeId = 'trade-123';
      const onTypingChange = jest.fn();
      let syncHandler: Function;

      mockChannel.on.mockImplementation((event: string, options: any, handler?: Function) => {
        const actualHandler = handler || options;
        if (event === 'presence' && options.event === 'sync') {
          syncHandler = actualHandler;
        }
        return mockChannel;
      });

      mockChannel.presenceState.mockReturnValue({
        'user-456': [
          {
            user_id: 'user-456',
            is_typing: true,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      subscribeToTypingStatus(tradeId, onTypingChange);

      // Simulate presence sync
      syncHandler();

      expect(onTypingChange).toHaveBeenCalledWith('user-456', true);
    });

    it('should handle presence join events', () => {
      const tradeId = 'trade-123';
      const onTypingChange = jest.fn();
      let joinHandler: Function;

      mockChannel.on.mockImplementation((event: string, options: any, handler?: Function) => {
        const actualHandler = handler || options;
        if (event === 'presence' && options.event === 'join') {
          joinHandler = actualHandler;
        }
        return mockChannel;
      });

      subscribeToTypingStatus(tradeId, onTypingChange);

      // Simulate user joining and typing
      joinHandler({
        key: 'user-789',
        newPresences: [
          {
            user_id: 'user-789',
            is_typing: true,
          },
        ],
      });

      expect(onTypingChange).toHaveBeenCalledWith('user-789', true);
    });

    it('should handle presence leave events', () => {
      const tradeId = 'trade-123';
      const onTypingChange = jest.fn();
      let leaveHandler: Function;

      mockChannel.on.mockImplementation((event: string, options: any, handler?: Function) => {
        const actualHandler = handler || options;
        if (event === 'presence' && options.event === 'leave') {
          leaveHandler = actualHandler;
        }
        return mockChannel;
      });

      subscribeToTypingStatus(tradeId, onTypingChange);

      // Simulate user leaving (stops typing)
      leaveHandler({
        key: 'user-789',
        leftPresences: [
          {
            user_id: 'user-789',
            is_typing: false,
          },
        ],
      });

      expect(onTypingChange).toHaveBeenCalledWith('user-789', false);
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription errors gracefully', () => {
      // Return the channel but simulate a status callback with error
      mockChannel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('CHANNEL_ERROR', new Error('Connection failed'));
        return mockChannel;
      });

      expect(() => subscribeToMessages('trade-123', jest.fn())).not.toThrow();
    });

    it('should handle typing broadcast errors gracefully', async () => {
      mockChannel.track.mockImplementation(() => {
        throw new Error('Presence failed');
      });

      await expect(broadcastTypingStatus('trade-123', 'user-456', true)).resolves.not.toThrow();
    });
  });
});
