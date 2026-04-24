// File: p2p-kids-marketplace/src/__tests__/e2e/deepLink.integration.test.ts
// MODULE-14 TASK NOTIF-V2-008: Deep Link Integration Tests

import * as Notifications from 'expo-notifications';
import { parseNotificationDeepLink, type NotificationDeepLinkData } from '@/services/deepLink';

/**
 * Integration tests for deep linking
 * These tests run against real notification data structures
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e -- deepLink
 */

describe('Deep Link Integration Tests', () => {
  beforeAll(() => {
    // Setup notification permissions for testing
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Deep Link Flow', () => {
    it('should handle SP earned notification from database to navigation', () => {
      // Simulate notification data from Supabase notification table
      const dbNotification = {
        id: 'notif-sp-earned-001',
        user_id: 'user-123',
        category: 'sp_events',
        type: 'sp_earned',
        title: 'You earned 50 SP!',
        body: 'You earned 50 SP for completing a trade',
        data: {
          type: 'sp_earned',
          deep_link: '/sp-wallet',
          sp_amount: 50,
          reason: 'trade_completed',
        },
        channels: ['push', 'in_app'],
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Parse deep link
      const target = parseNotificationDeepLink(dbNotification.data as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('SpWallet');
      expect(target?.action).toBe('navigate');
    });

    it('should handle trade request notification with tradeId', () => {
      const dbNotification = {
        id: 'notif-trade-req-001',
        type: 'trade_request',
        title: 'New Trade Request',
        body: 'Alice wants to trade with you',
        data: {
          type: 'trade_request',
          deep_link: '/trade/trade-abc-123',
          trade_id: 'trade-abc-123',
          sender_name: 'Alice',
        },
      };

      const target = parseNotificationDeepLink(dbNotification.data as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('TradeDetail');
      expect(target?.params?.tradeId).toBe('trade-abc-123');
    });

    it('should handle subscription renewal notification', () => {
      const dbNotification = {
        type: 'subscription',
        event: 'subscription_renewed',
        data: {
          event: 'subscription_renewed',
          deep_link: '/subscription',
          subscription_tier: 'kids_club_plus',
        },
      };

      const target = parseNotificationDeepLink(dbNotification.data as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('ManageKidsClub');
    });

    it('should handle badge awarded notification', () => {
      const dbNotification = {
        type: 'badge_awarded',
        data: {
          type: 'badge_awarded',
          deep_link: '/badges',
          badge_id: 'saver_100',
          badge_name: 'Saver 100',
        },
      };

      const target = parseNotificationDeepLink(dbNotification.data as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('Badges');
    });
  });

  describe('App State Scenarios', () => {
    it('should handle cold-start notification (app killed)', async () => {
      // Simulate notification that opened the app from killed state
      const coldStartNotification = {
        notification: {
          request: {
            content: {
              title: 'Trade Accepted!',
              body: 'Bob accepted your trade request',
              data: {
                type: 'trade_accepted',
                trade_id: 'trade-xyz-456',
                deep_link: '/trade/trade-xyz-456',
              },
            },
          },
        },
      };

      const data = coldStartNotification.notification.request.content
        .data as NotificationDeepLinkData;
      const target = parseNotificationDeepLink(data);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('TradeDetail');
      expect(target?.params?.tradeId).toBe('trade-xyz-456');
    });

    it('should handle background notification tap', () => {
      // Simulate notification tap while app in background
      const backgroundNotification = {
        notification: {
          request: {
            content: {
              data: {
                type: 'sp_balance_low',
                deep_link: '/discover',
              },
            },
          },
        },
      };

      const data = backgroundNotification.notification.request.content
        .data as NotificationDeepLinkData;
      const target = parseNotificationDeepLink(data);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('Discover');
    });

    it('should handle in-app notification tap (foreground)', () => {
      // Simulate in-app notification center tap
      const inAppNotification = {
        data: {
          type: 'referral_signup',
          deep_link: '/referral',
          referral_code: 'REF123',
          referee_name: 'Charlie',
        },
      };

      const target = parseNotificationDeepLink(inAppNotification.data as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('ReferralDashboard');
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should fallback gracefully for corrupted notification data', () => {
      const corruptedData = {
        // Missing type and deep_link
        some_random_field: 'value',
      };

      const target = parseNotificationDeepLink(corruptedData as NotificationDeepLinkData);

      expect(target).toBeNull(); // Should gracefully return null
    });

    it('should handle malformed deep link paths', () => {
      const malformedData = {
        deep_link: '///invalid///path///',
      };

      const target = parseNotificationDeepLink(malformedData as NotificationDeepLinkData);

      expect(target).toBeNull();
    });

    it('should handle notification with both snake_case and camelCase fields', () => {
      // Database might have both formats
      const mixedCaseData = {
        type: 'trade_completed',
        deep_link: '/trade/trade-mixed-123',
        trade_id: 'trade-mixed-123',
        tradeId: 'trade-mixed-456', // Duplicate field, snake_case should win
      };

      const target = parseNotificationDeepLink(mixedCaseData as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('TradeDetail');
      expect(target?.params?.tradeId).toBe('trade-mixed-123'); // trade_id has priority
    });

    it('should handle very long tradeId values', () => {
      const longIdData = {
        type: 'trade_request',
        trade_id: 'a'.repeat(200), // Very long ID
      };

      const target = parseNotificationDeepLink(longIdData as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('TradeDetail');
      expect(target?.params?.tradeId).toBe('a'.repeat(200));
    });
  });

  describe('Notification Data Validation', () => {
    it('should handle notification with extra unknown fields', () => {
      const dataWithExtras = {
        type: 'sp_earned',
        deep_link: '/sp-wallet',
        // Extra fields that should be ignored
        unknown_field_1: 'value1',
        unknown_field_2: 123,
        unknown_field_3: { nested: 'object' },
      };

      const target = parseNotificationDeepLink(dataWithExtras as NotificationDeepLinkData);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('SpWallet');
    });

    it('should handle notification with null values', () => {
      const dataWithNulls = {
        type: 'badge_awarded',
        deep_link: '/badges',
        trade_id: null,
        listing_id: null,
      };

      const target = parseNotificationDeepLink(dataWithNulls as any);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('Badges');
      expect(target?.params ?? {}).toEqual({});
    });
  });

  describe('Platform-Specific Scenarios', () => {
    it('should handle iOS push notification format', () => {
      // iOS notifications may have different structure
      const iosNotification = {
        notification: {
          request: {
            content: {
              title: 'Trial Ending Tomorrow',
              body: 'Your Kids Club+ trial ends in 1 day',
              data: {
                type: 'trial_expiring_1d',
                deep_link: '/subscription',
                aps: {
                  // iOS-specific fields
                  alert: {
                    title: 'Trial Ending Tomorrow',
                    body: 'Your Kids Club+ trial ends in 1 day',
                  },
                  sound: 'default',
                },
              },
            },
          },
        },
      };

      const data = iosNotification.notification.request.content.data as NotificationDeepLinkData;
      const target = parseNotificationDeepLink(data);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('ManageKidsClub');
    });

    it('should handle Android push notification format', () => {
      // Android notifications may have different structure
      const androidNotification = {
        notification: {
          request: {
            content: {
              title: 'Leaderboard Update',
              body: 'You moved up to #5!',
              data: {
                type: 'leaderboard_rank_up',
                deep_link: '/leaderboard',
                // Android-specific fields
                channelId: 'badges',
                priority: 'high',
              },
            },
          },
        },
      };

      const data = androidNotification.notification.request.content
        .data as NotificationDeepLinkData;
      const target = parseNotificationDeepLink(data);

      expect(target).not.toBeNull();
      expect(target?.route).toBe('Leaderboard');
    });
  });

  describe('Real-World Notification Scenarios', () => {
    it('should handle notification chain: Trade → Payment → SP Earned', async () => {
      // Scenario 1: Trade accepted
      const tradeAccepted = {
        type: 'trade_accepted',
        trade_id: 'trade-real-001',
        deep_link: '/trade/trade-real-001',
      };

      let target = parseNotificationDeepLink(tradeAccepted);
      expect(target?.route).toBe('TradeDetail');

      // Scenario 2: After payment, user gets SP earned notification
      const spEarned = {
        type: 'sp_earned',
        deep_link: '/sp-wallet',
        sp_amount: 75,
        related_trade_id: 'trade-real-001',
      };

      target = parseNotificationDeepLink(spEarned as NotificationDeepLinkData);
      expect(target?.route).toBe('SpWallet');
    });

    it('should handle subscription flow: Trial → Expiring → Expired → Renewed', async () => {
      // Day 1: Trial starting
      let data: NotificationDeepLinkData = {
        type: 'trial_starting',
        deep_link: '/subscription',
      };
      let target = parseNotificationDeepLink(data);
      expect(target?.route).toMatch(/KidsClubOverview|ManageKidsClub/);

      // Day 23: Trial expiring in 7 days
      data = { type: 'trial_expiring_7d', deep_link: '/subscription' };
      target = parseNotificationDeepLink(data);
      expect(target?.route).toBe('ManageKidsClub');

      // Day 30: Trial expired
      data = { type: 'trial_expired', deep_link: '/subscription' };
      target = parseNotificationDeepLink(data);
      expect(target?.route).toBe('ManageKidsClub');

      // Day 31: Subscription renewed
      data = { event: 'subscription_renewed', deep_link: '/subscription' };
      target = parseNotificationDeepLink(data);
      expect(target?.route).toBe('ManageKidsClub');
    });

    it('should handle badge progression: Milestone → Awarded → Leaderboard', async () => {
      // Step 1: Badge milestone approaching
      let data: NotificationDeepLinkData = {
        type: 'badge_milestone',
        deep_link: '/badges',
        badge_id: 'saver_100',
        progress: 95,
        target: 100,
      };
      let target = parseNotificationDeepLink(data);
      expect(target?.route).toBe('Badges');

      // Step 2: Badge awarded
      data = {
        type: 'badge_awarded',
        deep_link: '/badges',
        badge_id: 'saver_100',
      };
      target = parseNotificationDeepLink(data);
      expect(target?.route).toBe('Badges');

      // Step 3: Leaderboard rank up
      data = {
        type: 'leaderboard_rank_up',
        deep_link: '/leaderboard',
        new_rank: 10,
        old_rank: 15,
      };
      target = parseNotificationDeepLink(data);
      expect(target?.route).toBe('Leaderboard');
    });
  });
});
