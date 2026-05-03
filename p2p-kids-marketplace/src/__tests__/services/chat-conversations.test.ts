/**
 * File: p2p-kids-marketplace/src/__tests__/services/chat-conversations.test.ts
 * MODULE-07 MSG-002: Unit tests for conversation list functionality
 */

import { getConversations, getUnreadCount } from '@/services/chat';
import { supabase } from '@/config/supabase';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('chat.ts - getConversations', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Default mock implementation to prevent "TypeError: Cannot read properties of undefined"
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  it('should fetch user conversations with last message', async () => {
    const mockTrades = [
      {
        id: 'trade-1',
        buyer_id: 'user-1',
        seller_id: 'user-2',
        listing: {
          id: 'item-1',
          title: 'Test Item',
          price: 25.0,
        },
      },
    ];

    const mockLastMessage = {
      content: 'Hello, is this still available?',
      created_at: '2024-01-15T10:00:00Z',
      sender_id: 'user-1',
    };

    const mockProfile = {
      name: 'John Doe',
    };

    (supabase.from as jest.Mock).mockImplementation((table) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      if (table === 'trades') {
        chain.order.mockResolvedValue({ data: mockTrades, error: null });
      } else if (table === 'messages') {
        chain.single.mockResolvedValue({ data: mockLastMessage, error: null });
        chain.gte.mockResolvedValue({ data: [], error: null });
      } else if (table === 'profiles') {
        chain.single.mockResolvedValue({ data: mockProfile, error: null });
      } else {
        chain.single.mockResolvedValue({ data: null, error: null });
        chain.order.mockResolvedValue({ data: [], error: null });
      }

      return chain;
    });

    const conversations = await getConversations('user-1');

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      id: 'trade-1',
      other_user_name: 'John Doe',
      listing_title: 'Test Item',
      listing_price: 25.0,
      last_message_content: 'Hello, is this still available?',
    });
  });

  it('should handle empty trades list', async () => {
    (supabase.from as jest.Mock).mockImplementation((table) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      return chain;
    });

    const conversations = await getConversations('user-1');
    expect(conversations).toEqual([]);
  });

  it('should filter out trades without messages', async () => {
    const mockTrades = [
      {
        id: 'trade-1',
        buyer_id: 'user-1',
        seller_id: 'user-2',
        listing: { title: 'Item 1', price: 10 },
      },
    ];

    (supabase.from as jest.Mock).mockImplementation((table) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      if (table === 'trades') {
        chain.order.mockResolvedValue({ data: mockTrades, error: null });
      } else if (table === 'messages') {
        chain.single.mockResolvedValue({ data: null, error: null });
      }

      return chain;
    });

    const conversations = await getConversations('user-1');
    expect(conversations).toEqual([]);
  });
});

describe('chat.ts - getUnreadCount', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should calculate unread count correctly', async () => {
    const mockTrade = {
      buyer_id: 'user-1',
      seller_id: 'user-2',
    };

    const mockUnreadMessages = [
      { id: 'msg-1', created_at: '2024-01-15T10:30:00Z' },
      { id: 'msg-2', created_at: '2024-01-15T10:45:00Z' },
    ];

    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue('2024-01-15T10:00:00Z');

    (supabase.from as jest.Mock).mockImplementation((table) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      if (table === 'trades') {
        chain.single.mockResolvedValue({ data: mockTrade, error: null });
      } else if (table === 'messages') {
        chain.gte.mockResolvedValue({ data: mockUnreadMessages, error: null });
      }

      return chain;
    });

    const count = await getUnreadCount('trade-123', 'user-1');
    expect(count).toBe(2);
  });

  it('should return 0 for missing trade', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const count = await getUnreadCount('invalid-trade', 'user-1');
    expect(count).toBe(0);
  });
});
