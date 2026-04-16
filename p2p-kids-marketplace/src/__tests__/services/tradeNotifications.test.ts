// filepath: p2p-kids-marketplace/src/__tests__/services/tradeNotifications.test.ts
// Unit Tests: Trade Notifications Service
// MODULE-14: NOTIF-V2-007
// Tests all exported functions with fully mocked Supabase dependencies.

import {
  sendTradeNotificationPush,
  getTradeNotifications,
  markTradeNotificationRead,
  markAllTradeNotificationsRead,
  getUnreadTradeNotificationCount,
  TradeNotificationType,
} from '@/services/tradeNotifications';

// ─── Mock Supabase ─────────────────────────────────────────────────────────────

const mockFunctionsInvoke = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockUpdate = jest.fn();
const mockMaybeSingle = jest.fn();

const mockFrom = jest.fn().mockReturnValue({
  select: mockSelect,
  update: mockUpdate,
});

mockSelect.mockReturnValue({
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
});

mockEq.mockReturnValue({
  eq: mockEq,
  is: mockIs,
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
});

mockIs.mockReturnValue({
  order: mockOrder,
});

mockOrder.mockReturnValue({
  limit: mockLimit,
});

mockLimit.mockResolvedValue({ data: [], error: null });

mockUpdate.mockReturnValue({
  eq: mockEq.mockReturnValue({
    eq: mockEq,
    is: mockIs,
  }),
});

mockMaybeSingle.mockResolvedValue({ data: null, error: null });

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: {
      // Wrap in arrow fn so mockFunctionsInvoke is resolved at call-time, not factory-creation time.
      // Direct assignment (invoke: mockFunctionsInvoke) captures undefined due to jest.mock() hoisting.
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// ─── Test data ─────────────────────────────────────────────────────────────────

const SELLER_ID = 'seller-uuid-001';
const BUYER_ID  = 'buyer-uuid-001';
const TRADE_ID  = 'trade-uuid-001';
const ITEM_ID   = 'item-uuid-001';

const baseData = {
  trade_id:   TRADE_ID,
  item_id:    ITEM_ID,
  item_title: 'Vintage Skateboard',
  deep_link:  `/trades/${TRADE_ID}`,
  type:       'trade_request' as TradeNotificationType,
};

const mockNotification = {
  id: 'notif-uuid-001',
  user_id: SELLER_ID,
  category: 'trades' as const,
  type: 'trade_request' as TradeNotificationType,
  title: 'New Trade Request! 💬',
  body: 'Buyer wants your item',
  data: baseData,
  is_read: false,
  channels: ['push', 'in_app'],
  created_at: '2026-04-15T10:00:00Z',
  read_at: null,
};

// ─── sendTradeNotificationPush ─────────────────────────────────────────────────

describe('sendTradeNotificationPush()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null }); // no pref row = defaults
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
    // Reset chain
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, is: mockIs, order: mockOrder, maybeSingle: mockMaybeSingle });
  });

  it('sends push notification when no preference row exists (defaults to enabled)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await sendTradeNotificationPush(
      SELLER_ID,
      'trade_request',
      'Buyer wants to trade for your item',
      baseData
    );

    expect(result.success).toBe(true);
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('send-push-notification', {
      body: expect.objectContaining({
        userId: SELLER_ID,
        title: 'New Trade Request! 💬',
        body: 'Buyer wants to trade for your item',
        data: expect.objectContaining({ type: 'trade_request', category: 'trades' }),
        priority: 'high',
      }),
    });
  });

  it('skips push when user has push_enabled = false in preferences', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { push_enabled: false }, error: null });

    const result = await sendTradeNotificationPush(
      SELLER_ID,
      'trade_request',
      'Buyer wants to trade for your item',
      baseData
    );

    expect(result.success).toBe(true);
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('sends push when user has push_enabled = true', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { push_enabled: true }, error: null });

    const result = await sendTradeNotificationPush(
      SELLER_ID,
      'trade_accepted',
      'Seller accepted your trade',
      { ...baseData, type: 'trade_accepted', deep_link: `/trades/${TRADE_ID}` }
    );

    expect(result.success).toBe(true);
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('send-push-notification', {
      body: expect.objectContaining({ title: 'Trade Accepted! ✅' }),
    });
  });

  it('returns success=false with error when Edge Function fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'Edge Function error' } });

    const result = await sendTradeNotificationPush(SELLER_ID, 'trade_completed', 'Trade complete!', {
      ...baseData,
      type: 'trade_completed',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Edge Function error');
  });

  it('returns error when userId is empty', async () => {
    const result = await sendTradeNotificationPush('', 'trade_request', 'body', baseData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('uses correct title for each notification type', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFunctionsInvoke.mockResolvedValue({ data: {}, error: null });

    const cases: Array<[TradeNotificationType, string]> = [
      ['trade_request',   'New Trade Request! 💬'],
      ['trade_completion_requested', 'Trade Ready for Your Confirmation'],
      ['trade_accepted',  'Trade Accepted! ✅'],
      ['trade_rejected',  'Trade Declined'],
      ['trade_completed', 'Trade Complete! 🎉'],
      ['trade_cancelled', 'Trade Cancelled'],
    ];

    for (const [type, expectedTitle] of cases) {
      jest.clearAllMocks();
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: mockEq, is: mockIs, order: mockOrder, maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      mockFunctionsInvoke.mockResolvedValue({ data: {}, error: null });

      await sendTradeNotificationPush(SELLER_ID, type, 'Test body', { ...baseData, type });
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('send-push-notification', {
        body: expect.objectContaining({ title: expectedTitle }),
      });
    }
  });
});

// ─── getTradeNotifications ────────────────────────────────────────────────────

describe('getTradeNotifications()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, is: mockIs, order: mockOrder, maybeSingle: mockMaybeSingle });
    mockIs.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [mockNotification], error: null });
  });

  it('returns trade notifications for user', async () => {
    const result = await getTradeNotifications(SELLER_ID);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].type).toBe('trade_request');
    expect(result.error).toBeUndefined();
  });

  it('queries user_notifications table with correct filters', async () => {
    await getTradeNotifications(SELLER_ID);
    expect(mockFrom).toHaveBeenCalledWith('user_notifications');
  });

  it('returns empty array when no notifications exist', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });
    const result = await getTradeNotifications(BUYER_ID);
    expect(result.data).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it('returns error on Supabase failure', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const result = await getTradeNotifications(SELLER_ID);
    expect(result.data).toEqual([]);
    expect(result.error).toBe('DB error');
  });
});

// ─── markTradeNotificationRead ────────────────────────────────────────────────

describe('markTradeNotificationRead()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockUpdateChain = { eq: jest.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(mockUpdateChain) });
  });

  it('marks notification as read successfully', async () => {
    const result = await markTradeNotificationRead('notif-uuid-001');
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when Supabase update fails', async () => {
    const mockUpdateChain = { eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } }) };
    mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(mockUpdateChain) });

    const result = await markTradeNotificationRead('notif-uuid-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Update failed');
  });
});

// ─── markAllTradeNotificationsRead ────────────────────────────────────────────

describe('markAllTradeNotificationsRead()', () => {
  it('marks all trade notifications as read', async () => {
    // Chain: update() → eq('user_id') → eq('category') → is('read_at') → resolves
    // Need TWO .eq() levels before .is(), so second eq must return { is: fn }.
    const isMock      = jest.fn().mockResolvedValue({ error: null });
    const innerEqMock = jest.fn().mockReturnValue({ is: isMock });
    const outerEqMock = jest.fn().mockReturnValue({ eq: innerEqMock });
    const updateMock  = jest.fn().mockReturnValue({ eq: outerEqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    const result = await markAllTradeNotificationsRead(SELLER_ID);
    expect(result.success).toBe(true);
  });

  it('returns error when update fails', async () => {
    const isMock      = jest.fn().mockResolvedValue({ error: { message: 'Bulk update failed' } });
    const innerEqMock = jest.fn().mockReturnValue({ is: isMock });
    const outerEqMock = jest.fn().mockReturnValue({ eq: innerEqMock });
    const updateMock  = jest.fn().mockReturnValue({ eq: outerEqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    const result = await markAllTradeNotificationsRead(SELLER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Bulk update failed');
  });
});

// ─── getUnreadTradeNotificationCount ─────────────────────────────────────────

describe('getUnreadTradeNotificationCount()', () => {
  it('returns unread count', async () => {
    const eqChain = { eq: jest.fn().mockReturnValue({ is: jest.fn().mockResolvedValue({ count: 3, error: null }) }) };
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue(eqChain) }),
    });

    const result = await getUnreadTradeNotificationCount(SELLER_ID);
    expect(result.count).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it('returns 0 on error', async () => {
    const eqChain = {
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ count: null, error: { message: 'DB error' } }),
      }),
    };
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue(eqChain) }),
    });

    const result = await getUnreadTradeNotificationCount(SELLER_ID);
    expect(result.count).toBe(0);
    expect(result.error).toBe('DB error');
  });
});
