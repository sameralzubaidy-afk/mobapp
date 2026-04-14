// File: src/services/__tests__/pushDelivery.test.ts

import { sendPushNotification, sendTestPushNotification } from '../pushDelivery';
import { supabase } from '../../config/supabase';

jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('pushDelivery', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPushTokenId = '123e4567-e89b-12d3-a456-426614174010';

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.rpc as jest.Mock).mockImplementation((fnName: string) => {
      switch (fnName) {
        case 'check_push_rate_limit':
          return Promise.resolve({ data: true, error: null });
        case 'is_in_quiet_hours':
          return Promise.resolve({ data: false, error: null });
        case 'is_duplicate_notification':
          return Promise.resolve({ data: false, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'push_tokens') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [{ id: mockPushTokenId, token: 'ExponentPushToken[test-token]' }],
            error: null,
          }),
        };
      }

      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        tickets: [{ status: 'ok', id: 'ticket-1' }],
      },
      error: null,
    });
  });

  it('sends notification successfully', async () => {
    const result = await sendPushNotification({
      userId: mockUserId,
      title: 'Title',
      body: 'Body',
      type: 'test_type',
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(true);
    expect(result.ticketId).toBe('ticket-1');
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'send-push-notification',
      expect.any(Object)
    );
  });

  it('blocks duplicate notifications', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((fnName: string) => {
      if (fnName === 'is_duplicate_notification') {
        return Promise.resolve({ data: true, error: null });
      }
      if (fnName === 'check_push_rate_limit') {
        return Promise.resolve({ data: true, error: null });
      }
      if (fnName === 'is_in_quiet_hours') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await sendPushNotification({
      userId: mockUserId,
      title: 'Title',
      body: 'Body',
      type: 'test_type',
      fingerprint: 'dup-key',
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('enforces rate limits', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((fnName: string) => {
      if (fnName === 'check_push_rate_limit') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: false, error: null });
    });

    const result = await sendPushNotification({
      userId: mockUserId,
      title: 'Title',
      body: 'Body',
      type: 'test_type',
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.rateLimited).toBe(true);
  });

  it('respects quiet hours', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((fnName: string) => {
      if (fnName === 'check_push_rate_limit') {
        return Promise.resolve({ data: true, error: null });
      }
      if (fnName === 'is_in_quiet_hours') {
        return Promise.resolve({ data: true, error: null });
      }
      if (fnName === 'is_duplicate_notification') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await sendPushNotification({
      userId: mockUserId,
      title: 'Title',
      body: 'Body',
      type: 'test_type',
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.inQuietHours).toBe(true);
  });

  it('returns error when no push tokens exist', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'push_tokens') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    });

    const result = await sendPushNotification({
      userId: mockUserId,
      title: 'Title',
      body: 'Body',
      type: 'test_type',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No push tokens registered');
  });

  it('sendTestPushNotification delegates to push sender', async () => {
    const result = await sendTestPushNotification(mockUserId);
    expect(result.success).toBe(true);
    expect(supabase.functions.invoke).toHaveBeenCalled();
  });
});
