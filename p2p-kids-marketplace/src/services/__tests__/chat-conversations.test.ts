/**
 * Unit tests for chat.ts conversation functions
 * MODULE-07 MSG-002: Conversation List Tests
 * 
 * Tests:
 * - getConversations: Fetch all conversations with last message preview
 * - getUnreadCount: Get unread message count for a trade
 * - markAsRead: Mark messages as read (placeholder for MVP)
 */

import { getConversations, getUnreadCount, markAsRead } from '../chat';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe('chat.ts - Conversation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should return empty array when no trades exist', async () => {
      const mockFrom = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockOr = jest.fn().mockResolvedValue({ data: [], error: null });

      (supabase.from as jest.Mock).mockReturnValue({
        from: mockFrom,
        select: mockSelect,
        or: mockOr,
      });

      const result = await getConversations('user-123');

      expect(result).toEqual([]);
      expect(supabase.from).toHaveBeenCalledWith('trades');
    });

    it('should return empty array when userId is missing', async () => {
      const result = await getConversations('');

      expect(result).toEqual([]);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return conversations with last message preview', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          buyer_id: 'user-123',
          seller_id: 'user-456',
          listing: {
            id: 'item-1',
            title: 'Test Item',
            price: 25.50,
          },
          buyer: {
            id: 'user-123',
            first_name: 'Buyer',
          },
          seller: {
            id: 'user-456',
            first_name: 'Seller',
          },
        },
      ];

      const mockLastMessage = {
        content: 'Hello!',
        created_at: new Date().toISOString(),
        sender_id: 'user-456',
      };

      const mockUnreadMessages = [
        { id: 'msg-1', created_at: new Date(Date.now() - 1000).toISOString() },
        { id: 'msg-2', created_at: new Date(Date.now() - 500).toISOString() },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(new Date(0).toISOString());

      // Mock trades query (note: implementation chains .or(...).order(...))
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockTrades, error: null }),
          };
        }

        // Implementation prefers profiles.name first
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { name: 'Seller' }, error: null }),
          };
        }

        if (table === 'messages') {
          const mockMessagesChain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockLastMessage, error: null }),
            gte: jest.fn().mockResolvedValue({ data: mockUnreadMessages, error: null }),
          };
          return mockMessagesChain;
        }

        return {};
      });

      const result = await getConversations('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'Seller',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello!',
        last_message_time: mockLastMessage.created_at,
        unread_count: 2,
      });
    });

    it('should filter out trades with no messages', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          buyer_id: 'user-123',
          seller_id: 'user-456',
          listing: { id: 'item-1', title: 'Test Item', price: 25.50 },
          buyer: { id: 'user-123', first_name: 'Buyer' },
          seller: { id: 'user-456', first_name: 'Seller' },
        },
      ];

      // Mock trades query returns trade, but messages query returns null
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnThis(),
            or: jest.fn().mockResolvedValue({ data: mockTrades, error: null }),
          };
        } else if (table === 'messages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const result = await getConversations('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getUnreadCount', () => {
    it('should return 0 when tradeId or userId is missing', async () => {
      const result1 = await getUnreadCount('', 'user-123');
      const result2 = await getUnreadCount('trade-1', '');

      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return unread count for a trade', async () => {
      const mockTrade = {
        buyer_id: 'user-123',
        seller_id: 'user-456',
      };

      const base = Date.now();
      const mockUnreadMessages = [
        { id: 'msg-1', created_at: new Date(base - 3000).toISOString() },
        { id: 'msg-2', created_at: new Date(base - 2000).toISOString() },
        { id: 'msg-3', created_at: new Date(base - 1000).toISOString() },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(new Date(0).toISOString());

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockTrade, error: null }),
          };
        } else if (table === 'messages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({ data: mockUnreadMessages, error: null }),
          };
        }
        return {};
      });

      const result = await getUnreadCount('trade-1', 'user-123');

      expect(result).toBe(3);
    });

    it('should return 0 when trade not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(new Date(0).toISOString());
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const result = await getUnreadCount('trade-1', 'user-123');

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should persist last viewed timestamp for trade + user', async () => {
      await markAsRead('trade-1', 'user-123');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_viewed_user-123_trade-1',
        expect.any(String)
      );
    });
  });
});
