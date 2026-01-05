/**
 * File: p2p-kids-marketplace/src/__tests__/services/chat.test.ts
 * MODULE-07 MSG-001: Unit tests for chat service
 */

import { sendMessage, getMessages } from '@/services/chat';
import { supabase } from '@/config/supabase';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('chat.ts - sendMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send a valid text message', async () => {
    const mockMessage = {
      id: 'msg-123',
      trade_id: 'trade-123',
      sender_id: 'user-123',
      content: 'Hello world',
      message_type: 'text',
      created_at: new Date().toISOString(),
      profiles: {
        name: 'Test User',
        display_name: 'TestUser',
      },
    };

    const mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockMessage, error: null }),
      }),
    });

    (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

    const result = await sendMessage({
      tradeId: 'trade-123',
      senderId: 'user-123',
      content: 'Hello world',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message?.content).toBe('Hello world');
    expect(mockInsert).toHaveBeenCalledWith({
      trade_id: 'trade-123',
      sender_id: 'user-123',
      content: 'Hello world',
      message_type: 'text',
    });
  });

  it('should reject empty content', async () => {
    const result = await sendMessage({
      tradeId: 'trade-123',
      senderId: 'user-123',
      content: '   ',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });

  it('should reject content exceeding 2000 characters', async () => {
    const longContent = 'a'.repeat(2001);

    const result = await sendMessage({
      tradeId: 'trade-123',
      senderId: 'user-123',
      content: longContent,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds 2000 characters');
  });

  it('should handle database errors gracefully', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    });

    (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

    const result = await sendMessage({
      tradeId: 'trade-123',
      senderId: 'user-123',
      content: 'Test message',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });
});

describe('chat.ts - getMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch messages for a trade', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        trade_id: 'trade-123',
        sender_id: 'user-1',
        content: 'First message',
        message_type: 'text',
        created_at: '2026-01-01T10:00:00Z',
        profiles: { name: 'User One', display_name: 'UserOne' },
      },
      {
        id: 'msg-2',
        trade_id: 'trade-123',
        sender_id: 'user-2',
        content: 'Second message',
        message_type: 'text',
        created_at: '2026-01-01T10:01:00Z',
        profiles: { name: 'User Two', display_name: 'UserTwo' },
      },
    ];

    const mockOrder = jest.fn().mockResolvedValue({
      data: mockMessages,
      error: null,
    });

    const mockIs = jest.fn().mockReturnValue({ order: mockOrder });
    const mockEq = jest.fn().mockReturnValue({ is: mockIs });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const messages = await getMessages('trade-123');

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('First message');
    expect(messages[1].content).toBe('Second message');
    expect(mockEq).toHaveBeenCalledWith('trade_id', 'trade-123');
    expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('should return empty array on database error', async () => {
    const mockOrder = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const mockIs = jest.fn().mockReturnValue({ order: mockOrder });
    const mockEq = jest.fn().mockReturnValue({ is: mockIs });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const messages = await getMessages('trade-123');

    expect(messages).toEqual([]);
  });

  it('should return empty array for missing tradeId', async () => {
    const messages = await getMessages('');

    expect(messages).toEqual([]);
  });
});
