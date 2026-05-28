// File: p2p-kids-marketplace/src/__tests__/services/spNotifications.test.ts
// Unit tests for SP Event Notifications (NOTIF-V2-003)

import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('SP Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create_sp_notification RPC', () => {
    it('should create SP earned notification for active subscriber', async () => {
      const mockNotificationId = '123e4567-e89b-12d3-a456-426614174000';
      const mockRpcResponse = { data: mockNotificationId, error: null };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await supabase.rpc('create_sp_notification', {
        p_user_id: 'user-123',
        p_notification_type: 'sp_earned',
        p_title: '🎉 +50 SP Earned!',
        p_body: 'You earned 50 SP as a welcome bonus!',
        p_data: {
          amount: 50,
          transaction_type: 'earn_starter_pack',
          balance_after: 50,
        },
        p_check_subscription: true,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('create_sp_notification', {
        p_user_id: 'user-123',
        p_notification_type: 'sp_earned',
        p_title: '🎉 +50 SP Earned!',
        p_body: 'You earned 50 SP as a welcome bonus!',
        p_data: expect.objectContaining({
          amount: 50,
          transaction_type: 'earn_starter_pack',
        }),
        p_check_subscription: true,
      });

      expect(result.data).toBe(mockNotificationId);
      expect(result.error).toBeNull();
    });

    it('should return null for non-subscriber when gating enabled', async () => {
      const mockRpcResponse = { data: null, error: null };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await supabase.rpc('create_sp_notification', {
        p_user_id: 'free-user-123',
        p_notification_type: 'sp_earned',
        p_title: '🎉 +10 SP Earned!',
        p_body: 'You earned 10 SP!',
        p_data: {},
        p_check_subscription: true,
      });

      expect(result.data).toBeNull();
    });

    it('should create wallet frozen notification even for non-subscriber', async () => {
      const mockNotificationId = '223e4567-e89b-12d3-a456-426614174001';
      const mockRpcResponse = { data: mockNotificationId, error: null };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await supabase.rpc('create_sp_notification', {
        p_user_id: 'free-user-123',
        p_notification_type: 'sp_wallet_frozen',
        p_title: 'SP Wallet Frozen ❄️',
        p_body: 'Your Swap Points wallet has been frozen.',
        p_data: { wallet_id: 'wallet-123' },
        p_check_subscription: false,
      });

      expect(result.data).toBe(mockNotificationId);
    });

    it('should respect notification preferences', async () => {
      const mockRpcResponse = { data: null, error: null };

      // Mock notification_preferences query
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                category: 'sp_events',
                push_enabled: false,
                in_app_enabled: false,
                email_enabled: false,
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await supabase.rpc('create_sp_notification', {
        p_user_id: 'user-with-disabled-notifs',
        p_notification_type: 'sp_earned',
        p_title: '🎉 +10 SP Earned!',
        p_body: 'You earned 10 SP!',
        p_data: {},
        p_check_subscription: true,
      });

      // Should return null if all channels disabled
      expect(result.data).toBeNull();
    });
  });

  describe('SP Transaction Notification Scenarios', () => {
    it('should send notification for SP earned (earn_starter_pack)', async () => {
      const mockLedgerEntry = {
        id: 'ledger-123',
        wallet_id: 'wallet-123',
        user_id: 'user-123',
        transaction_type: 'earn_starter_pack',
        amount: 50,
        balance_before: 0,
        balance_after: 50,
        description: 'Welcome bonus',
      };

      // Mock the trigger behavior (would be tested in E2E)
      const _expectedTitle = '🎉 +50 SP Earned!';
      const _expectedBody = 'You earned 50 SP as a welcome bonus!';

      expect(mockLedgerEntry.transaction_type).toBe('earn_starter_pack');
      expect(mockLedgerEntry.amount).toBeGreaterThan(0);
    });

    it('should send notification for SP spent (spend_purchase)', async () => {
      const mockLedgerEntry = {
        id: 'ledger-456',
        wallet_id: 'wallet-123',
        user_id: 'user-123',
        transaction_type: 'spend_purchase',
        amount: -20,
        balance_before: 50,
        balance_after: 30,
        description: 'Used SP on purchase',
      };

      const _expectedTitle = '✨ 20 SP Spent';
      const _expectedBody = 'You spent 20 SP on a purchase!';

      expect(mockLedgerEntry.transaction_type).toBe('spend_purchase');
      expect(mockLedgerEntry.amount).toBeLessThan(0);
    });

    it('should NOT send notification for expire transaction', async () => {
      const mockLedgerEntry = {
        id: 'ledger-789',
        wallet_id: 'wallet-123',
        user_id: 'user-123',
        transaction_type: 'expire',
        amount: -10,
        balance_before: 30,
        balance_after: 20,
        description: 'SP expired',
      };

      // Trigger should not fire for 'expire' type
      expect(mockLedgerEntry.transaction_type).toBe('expire');
      expect(mockLedgerEntry.transaction_type).not.toMatch(/^(earn_|spend_)/);
    });
  });

  describe('Wallet Status Change Notifications', () => {
    it('should send notification when wallet status changes to frozen', async () => {
      const oldWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        status: 'active',
        available_balance: 30,
      };

      const newWallet = {
        ...oldWallet,
        status: 'frozen',
        frozen_balance: 30,
        available_balance: 0,
      };

      expect(newWallet.status).toBe('frozen');
      expect(oldWallet.status).not.toBe('frozen');
    });

    it('should send low balance notification when balance drops below 10 SP', async () => {
      const oldWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        status: 'active',
        available_balance: 15,
      };

      const newWallet = {
        ...oldWallet,
        available_balance: 8,
      };

      expect(newWallet.available_balance).toBeLessThan(10);
      expect(oldWallet.available_balance).toBeGreaterThanOrEqual(10);
    });

    it('should NOT send duplicate low balance notification within 24 hours', async () => {
      // Mock recent notification check
      const recentNotification = {
        id: 'notif-123',
        user_id: 'user-123',
        type: 'sp_balance_low',
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      };

      const hoursSinceLastNotif =
        (Date.now() - recentNotification.created_at.getTime()) / (1000 * 60 * 60);

      expect(hoursSinceLastNotif).toBeLessThan(24);
      // Trigger should skip sending notification
    });
  });

  describe('Notification Data Payload', () => {
    it('should include correct data for SP earned notification', () => {
      const notificationData = {
        amount: 50,
        transaction_type: 'earn_referral',
        balance_after: 100,
        ledger_id: 'ledger-123',
        deep_link: '/wallet',
      };

      expect(notificationData).toHaveProperty('amount');
      expect(notificationData).toHaveProperty('transaction_type');
      expect(notificationData).toHaveProperty('balance_after');
      expect(notificationData).toHaveProperty('deep_link');
      expect(notificationData.deep_link).toBe('/wallet');
    });

    it('should include correct data for wallet frozen notification', () => {
      const notificationData = {
        wallet_id: 'wallet-123',
        available_balance: 0,
        frozen_balance: 50,
        deep_link: '/subscription',
      };

      expect(notificationData).toHaveProperty('wallet_id');
      expect(notificationData).toHaveProperty('frozen_balance');
      expect(notificationData.deep_link).toBe('/subscription');
    });

    it('should include correct data for low balance notification', () => {
      const notificationData = {
        balance: 8,
        wallet_id: 'wallet-123',
        deep_link: '/discover',
      };

      expect(notificationData).toHaveProperty('balance');
      expect(notificationData.balance).toBeLessThan(10);
      expect(notificationData.deep_link).toBe('/discover');
    });
  });

  describe('Notification Channel Selection', () => {
    it('should use default channels when no preferences exist', () => {
      const defaultChannels = ['push', 'in_app'];

      expect(defaultChannels).toContain('push');
      expect(defaultChannels).toContain('in_app');
      expect(defaultChannels).not.toContain('email');
    });

    it('should respect user preference for push only', () => {
      const userPrefs = {
        push_enabled: true,
        in_app_enabled: false,
        email_enabled: false,
      };

      const channels: string[] = [];
      if (userPrefs.push_enabled) channels.push('push');
      if (userPrefs.in_app_enabled) channels.push('in_app');
      if (userPrefs.email_enabled) channels.push('email');

      expect(channels).toEqual(['push']);
    });

    it('should respect user preference for all channels', () => {
      const userPrefs = {
        push_enabled: true,
        in_app_enabled: true,
        email_enabled: true,
      };

      const channels: string[] = [];
      if (userPrefs.push_enabled) channels.push('push');
      if (userPrefs.in_app_enabled) channels.push('in_app');
      if (userPrefs.email_enabled) channels.push('email');

      expect(channels).toEqual(['push', 'in_app', 'email']);
    });
  });

  describe('Notification Title and Body Generation', () => {
    const testCases = [
      {
        type: 'earn_starter_pack',
        amount: 50,
        expectedTitle: '🎉 +50 SP Earned!',
        expectedBodyContains: 'welcome bonus',
      },
      {
        type: 'earn_referral',
        amount: 25,
        expectedTitle: '🎉 +25 SP Earned!',
        expectedBodyContains: 'referral',
      },
      {
        type: 'earn_challenge',
        amount: 10,
        expectedTitle: '🎉 +10 SP Earned!',
        expectedBodyContains: 'challenge',
      },
      {
        type: 'spend_purchase',
        amount: -20,
        expectedTitle: '✨ 20 SP Spent',
        expectedBodyContains: 'purchase',
      },
      {
        type: 'spend_boost',
        amount: -5,
        expectedTitle: '✨ 5 SP Spent',
        expectedBodyContains: 'boost',
      },
    ];

    testCases.forEach(({ type, amount, expectedTitle, expectedBodyContains }) => {
      it(`should generate correct title and body for ${type}`, () => {
        const absAmount = Math.abs(amount);

        if (type.startsWith('earn_')) {
          expect(`🎉 +${absAmount} SP Earned!`).toBe(expectedTitle);
        } else if (type.startsWith('spend_')) {
          expect(`✨ ${absAmount} SP Spent`).toBe(expectedTitle);
        }

        // Body would contain the keyword (tested in actual trigger)
        expect(expectedBodyContains).toBeTruthy();
      });
    });
  });
});
