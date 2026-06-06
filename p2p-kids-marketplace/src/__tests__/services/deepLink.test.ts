// File: p2p-kids-marketplace/src/__tests__/services/deepLink.test.ts
// MODULE-14 TASK NOTIF-V2-008: Deep Link Service Unit Tests

import {
  parseNotificationDeepLink,
  getFallbackRoute,
  canNavigateToRoute,
  buildDeepLinkUrl,
  type NotificationDeepLinkData,
} from '@/services/deepLink';

describe('DeepLink Service', () => {
  describe('parseNotificationDeepLink', () => {
    // ── SP Events ──────────────────────────────────────────────────────────
    describe('SP Events', () => {
      it('should parse sp_earned notification to SpWallet', () => {
        const data: NotificationDeepLinkData = {
          type: 'sp_earned',
          deep_link: '/sp-wallet',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('SpWallet');
        expect(result?.action).toBe('navigate');
      });

      it('should parse sp_spent notification to SpWallet', () => {
        const data: NotificationDeepLinkData = {
          type: 'sp_spent',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('SpWallet');
      });

      it('should parse sp_balance_low to Discover', () => {
        const data: NotificationDeepLinkData = {
          type: 'sp_balance_low',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Discover');
      });

      it('should parse sp_wallet_frozen to ManageKidsClub', () => {
        const data: NotificationDeepLinkData = {
          type: 'sp_wallet_frozen',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ManageKidsClub');
      });
    });

    // ── Subscription Events ──────────────────────────────────────────────────
    describe('Subscription Events', () => {
      const subscriptionTypes = [
        'trial_starting',
        'trial_expiring_7d',
        'trial_expiring_3d',
        'trial_expiring_1d',
        'trial_expired',
        'subscription_cancelled',
        'payment_failed',
        'grace_period_ending',
      ];

      subscriptionTypes.forEach((type) => {
        it(`should parse ${type} to ManageKidsClub or KidsClubOverview`, () => {
          const data: NotificationDeepLinkData = { type };
          const result = parseNotificationDeepLink(data);

          expect(result).not.toBeNull();
          expect(['ManageKidsClub', 'KidsClubOverview']).toContain(result?.route);
        });
      });

      it('should parse subscription event type to ManageKidsClub', () => {
        const data: NotificationDeepLinkData = {
          event: 'subscription_renewed',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ManageKidsClub');
      });

      it('should parse /subscription deep link to ManageKidsClub', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/subscription',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ManageKidsClub');
      });
    });

    // ── Badge Events ──────────────────────────────────────────────────────────
    describe('Badge Events', () => {
      it('should parse badge_awarded to Badges', () => {
        const data: NotificationDeepLinkData = {
          type: 'badge_awarded',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Badges');
      });

      it('should parse badge_milestone to Badges', () => {
        const data: NotificationDeepLinkData = {
          type: 'badge_milestone',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Badges');
      });

      it('should parse leaderboard_rank_up to Leaderboard', () => {
        const data: NotificationDeepLinkData = {
          type: 'leaderboard_rank_up',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Leaderboard');
      });

      it('should parse /badges deep link to Badges', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/badges',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Badges');
      });
    });

    // ── ID Verification Events ───────────────────────────────────────────────
    describe('ID Verification Events', () => {
      it('should parse id_badge_submission to IDVerificationUpload', () => {
        const data: NotificationDeepLinkData = {
          type: 'id_badge_submission',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('IDVerificationUpload');
        expect(result?.action).toBe('navigate');
      });

      it('should parse id_badge_approved to IDVerificationUpload', () => {
        const data: NotificationDeepLinkData = {
          type: 'id_badge_approved',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('IDVerificationUpload');
      });

      it('should parse id_badge_rejected to IDVerificationUpload', () => {
        const data: NotificationDeepLinkData = {
          type: 'id_badge_rejected',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('IDVerificationUpload');
      });

      it('should parse /id-verification-upload deep link to IDVerificationUpload', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/id-verification-upload',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('IDVerificationUpload');
      });
    });

    // ── Trade Events ──────────────────────────────────────────────────────────
    describe('Trade Events', () => {
      it('should parse trade_request to TradeList without tradeId', () => {
        const data: NotificationDeepLinkData = {
          type: 'trade_request',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('TradeList');
      });

      it('should parse trade_request to TradeReview with tradeId', () => {
        const data: NotificationDeepLinkData = {
          type: 'trade_request',
          trade_id: 'trade-123',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ReviewOffer');
        expect(result?.params).toEqual({ tradeId: 'trade-123' });
      });

      it('should prefer ReviewOffer for trade_request even with /trade/:id deep link', () => {
        const data: NotificationDeepLinkData = {
          type: 'trade_request',
          deep_link: '/trade/trade-xyz-789',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ReviewOffer');
        expect(result?.params).toEqual({ tradeId: 'trade-xyz-789' });
      });

      it('should parse trade_accepted with tradeId param', () => {
        const data: NotificationDeepLinkData = {
          type: 'trade_accepted',
          tradeId: 'trade-abc',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('TradeDetail');
        expect(result?.params?.tradeId).toBe('trade-abc');
      });

      it('should parse /trade/:id path to TradeDetail with params', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/trade/trade-xyz-789',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('TradeDetail');
        expect(result?.params?.tradeId).toBe('trade-xyz-789');
      });
    });

    // ── Listing Events ──────────────────────────────────────────────────────────
    describe('Listing Events', () => {
      it('should parse /listing/:id path to ListingDetail with params', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/listing/listing-456',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ListingDetail');
        expect(result?.params?.listing_id).toBe('listing-456');
      });

      it('should upgrade BrowseItems to ListingDetail when listing_id provided', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/browse',
          listing_id: 'listing-789',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ListingDetail');
        expect(result?.params?.listing_id).toBe('listing-789');
      });
    });

    // ── Referral Events ──────────────────────────────────────────────────────────
    describe('Referral Events', () => {
      it('should parse referral_signup to ReferralDashboard', () => {
        const data: NotificationDeepLinkData = {
          type: 'referral_signup',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ReferralDashboard');
      });

      it('should parse /referral deep link to ReferralDashboard', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/referral',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ReferralDashboard');
      });
    });

    // ── System Events ──────────────────────────────────────────────────────────
    describe('System Events', () => {
      it('should parse notification_center to Notifications', () => {
        const data: NotificationDeepLinkData = {
          type: 'notification_center',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Notifications');
      });

      it('should parse system_announcement to Home', () => {
        const data: NotificationDeepLinkData = {
          type: 'system_announcement',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Home');
      });

      it('should parse /notification/:id to NotificationDetail', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/notification/notif-123',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('NotificationDetail');
        expect(result?.params?.notificationId).toBe('notif-123');
      });
    });

    // ── Fallback Cases ──────────────────────────────────────────────────────────
    describe('Fallback Cases', () => {
      it('should return null for empty data', () => {
        const result = parseNotificationDeepLink(null);
        expect(result).toBeNull();
      });

      it('should return null for undefined data', () => {
        const result = parseNotificationDeepLink(undefined);
        expect(result).toBeNull();
      });

      it('should return null for invalid deep link', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/invalid/route/path',
        };

        const result = parseNotificationDeepLink(data);
        expect(result).toBeNull();
      });

      it('should return null for unknown notification type', () => {
        const data: NotificationDeepLinkData = {
          type: 'unknown_notification_type',
        };

        const result = parseNotificationDeepLink(data);
        expect(result).toBeNull();
      });

      it('should return null for empty object', () => {
        const data: NotificationDeepLinkData = {};

        const result = parseNotificationDeepLink(data);
        expect(result).toBeNull();
      });
    });

    // ── Deep Link Priority ──────────────────────────────────────────────────────
    describe('Deep Link Priority', () => {
      it('should prioritize deep_link over type', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/badges',
          type: 'sp_earned', // Would normally go to SpWallet
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('Badges'); // deep_link wins
      });

      it('should use type when deep_link is missing', () => {
        const data: NotificationDeepLinkData = {
          type: 'sp_earned',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('SpWallet');
      });
    });

    // ── Case Insensitivity ──────────────────────────────────────────────────────
    describe('Case Insensitivity', () => {
      it('should handle uppercase deep links', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/WALLET',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('SpWallet');
      });

      it('should handle mixed case deep links', () => {
        const data: NotificationDeepLinkData = {
          deep_link: '/Subscription',
        };

        const result = parseNotificationDeepLink(data);

        expect(result).not.toBeNull();
        expect(result?.route).toBe('ManageKidsClub');
      });
    });

    // ── Navigation Actions ──────────────────────────────────────────────────────
    describe('Navigation Actions', () => {
      it('should use "navigate" action for most notifications', () => {
        const data: NotificationDeepLinkData = {
          type: 'sp_earned',
        };

        const result = parseNotificationDeepLink(data);

        expect(result?.action).toBe('navigate');
      });

      it('should use "reset" action for onboarding_reminder', () => {
        const data: NotificationDeepLinkData = {
          type: 'onboarding_reminder',
        };

        const result = parseNotificationDeepLink(data);

        expect(result?.action).toBe('reset');
      });
    });
  });

  // ── getFallbackRoute ──────────────────────────────────────────────────────
  describe('getFallbackRoute', () => {
    it('should return Home as fallback route', () => {
      const fallback = getFallbackRoute();

      expect(fallback.route).toBe('Home');
      expect(fallback.action).toBe('reset');
    });
  });

  // ── canNavigateToRoute ──────────────────────────────────────────────────────
  describe('canNavigateToRoute', () => {
    it('should return true when route exists in navigation state', () => {
      const mockState = {
        routeNames: ['Home', 'SpWallet', 'Badges', 'ManageKidsClub'],
      };

      expect(canNavigateToRoute('SpWallet', mockState)).toBe(true);
      expect(canNavigateToRoute('Badges', mockState)).toBe(true);
    });

    it('should return false when route does not exist in navigation state', () => {
      const mockState = {
        routeNames: ['Home'],
      };

      expect(canNavigateToRoute('SpWallet', mockState)).toBe(false);
      expect(canNavigateToRoute('AdminDashboard', mockState)).toBe(false);
    });

    it('should return false for null navigation state', () => {
      expect(canNavigateToRoute('Home', null)).toBe(false);
    });

    it('should return false for undefined navigation state', () => {
      expect(canNavigateToRoute('Home', undefined)).toBe(false);
    });

    it('should return false when routeNames is missing', () => {
      const mockState = {};

      expect(canNavigateToRoute('Home', mockState)).toBe(false);
    });
  });

  // ── buildDeepLinkUrl ──────────────────────────────────────────────────────
  describe('buildDeepLinkUrl', () => {
    it('should build URL for simple routes', () => {
      expect(buildDeepLinkUrl('SpWallet')).toBe('p2pkidsmarketplace://wallet');
      expect(buildDeepLinkUrl('Badges')).toBe('p2pkidsmarketplace://badges');
      expect(buildDeepLinkUrl('Home')).toBe('p2pkidsmarketplace://home');
    });

    it('should build URL with params for TradeDetail', () => {
      const url = buildDeepLinkUrl('TradeDetail', { tradeId: 'trade-123' });
      expect(url).toBe('p2pkidsmarketplace://trade/trade-123');
    });

    it('should build URL with params for ListingDetail', () => {
      const url = buildDeepLinkUrl('ListingDetail', { listing_id: 'listing-456' });
      expect(url).toBe('p2pkidsmarketplace://listing/listing-456');
    });

    it('should build URL with params for NotificationDetail', () => {
      const url = buildDeepLinkUrl('NotificationDetail', { notificationId: 'notif-789' });
      expect(url).toBe('p2pkidsmarketplace://notification/notif-789');
    });

    it('should fallback to route name for unmapped routes', () => {
      const url = buildDeepLinkUrl('Settings' as any);
      expect(url).toBe('p2pkidsmarketplace://settings');
    });
  });
});
