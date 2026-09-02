// File: p2p-kids-marketplace/src/services/deepLink.ts
// MODULE-14 TASK NOTIF-V2-008: Notification Deep Linking Service
// Centralized deep link parsing and navigation logic for ALL notification types

import { RootStackParamList } from '@/navigation/types';

/**
 * Notification deep link data structure
 * Matches notification.data field from database
 */
export interface NotificationDeepLinkData {
  deep_link?: string;
  deepLink?: string;
  type?: string;
  event?: string;
  trade_id?: string;
  tradeId?: string;
  listing_id?: string;
  listingId?: string;
  item_id?: string;
  itemId?: string;
  notification_id?: string;
  notificationId?: string;
  badge_id?: string;
  badgeId?: string;
  user_id?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Parsed deep link result
 */
export interface DeepLinkTarget {
  /** Target route name from RootStackParamList */
  route: keyof RootStackParamList;
  /** Route params (if any) */
  params?: Record<string, any>;
  /** Navigation action: 'navigate' (push) or 'reset' (replace stack) */
  action: 'navigate' | 'reset';
}

/**
 * Deep link route map
 * Maps notification paths and types to app routes
 */
const DEEP_LINK_ROUTES: Record<string, keyof RootStackParamList> = {
  // SP & Wallet
  '/wallet': 'SpWallet',
  '/sp-wallet': 'SpWallet',
  SpWallet: 'SpWallet',
  SpWalletScreen: 'SpWallet',

  // Subscription
  '/subscription': 'ManageKidsClub',
  '/profile/subscription': 'ManageKidsClub',
  // DEPRECATED (Dev Task 86, 2026-09-02): SubscriptionPaymentScreen is deprecated
  // (web-first join); this legacy mapping is kept only so old push payloads/deep
  // links still resolve instead of 404ing.
  '/subscription/payment': 'SubscriptionPayment',
  '/subscription/status': 'SubscriptionStatus',
  '/subscription/overview': 'KidsClubOverview',
  ManageKidsClub: 'ManageKidsClub',
  SubscriptionPayment: 'SubscriptionPayment',
  SubscriptionStatus: 'SubscriptionStatus',
  KidsClubOverview: 'KidsClubOverview',

  // Badges & Leaderboard
  '/badges': 'Badges',
  '/profile/badges': 'Badges',
  '/leaderboard': 'Leaderboard',
  Badges: 'Badges',
  Leaderboard: 'Leaderboard',

  // ID Verification
  '/id-verification': 'IDVerificationUpload',
  '/id-verification-upload': 'IDVerificationUpload',
  idverificationupload: 'IDVerificationUpload',

  // Trades
  '/trades': 'TradeList',
  '/trade': 'TradeList',
  TradeList: 'TradeList',

  // Messaging
  '/chat': 'Chat',
  '/messages': 'Chat',
  Chat: 'Chat',

  // Listings & Discovery
  '/discover': 'Discover',
  '/browse': 'Discover',
  '/my-listings': 'MyListings',
  Discover: 'Discover',
  MyListings: 'MyListings',

  // Referrals
  '/referral': 'ReferralDashboard',
  '/referrals': 'ReferralDashboard',
  ReferralDashboard: 'ReferralDashboard',

  // Profile & Settings
  '/profile': 'Profile',
  '/settings': 'Settings',
  Profile: 'Profile',
  Settings: 'Settings',

  // Notifications
  '/notifications': 'Notifications',
  Notifications: 'Notifications',

  // Payouts
  '/payout-settings': 'PayoutSettings',
  PayoutSettings: 'PayoutSettings',

  // Admin
  '/admin': 'AdminDashboard',
  AdminDashboard: 'AdminDashboard',

  // Home/Dashboard
  '/home': 'Home',
  '/dashboard': 'Home',
  Home: 'Home',
};

/**
 * Notification type to route map
 * For notifications without explicit deep_link, derive route from type/event
 */
const TYPE_TO_ROUTE_MAP: Record<
  string,
  { route: keyof RootStackParamList; action: 'navigate' | 'reset' }
> = {
  // SP Events
  sp_earned: { route: 'SpWallet', action: 'navigate' },
  sp_spent: { route: 'SpWallet', action: 'navigate' },
  sp_balance_low: { route: 'Discover', action: 'navigate' },
  sp_wallet_frozen: { route: 'ManageKidsClub', action: 'navigate' },
  sp_released: { route: 'SpWallet', action: 'navigate' },
  sp_refunded: { route: 'SpWallet', action: 'navigate' },

  // Subscription Events
  trial_starting: { route: 'KidsClubOverview', action: 'navigate' },
  trial_expiring_7d: { route: 'ManageKidsClub', action: 'navigate' },
  trial_expiring_3d: { route: 'ManageKidsClub', action: 'navigate' },
  trial_expiring_1d: { route: 'ManageKidsClub', action: 'navigate' },
  trial_expired: { route: 'ManageKidsClub', action: 'navigate' },
  subscription_renewed: { route: 'ManageKidsClub', action: 'navigate' },
  subscription_cancelled: { route: 'ManageKidsClub', action: 'navigate' },
  subscription_reactivated: { route: 'ManageKidsClub', action: 'navigate' },
  payment_failed: { route: 'ManageKidsClub', action: 'navigate' },
  grace_period_ending: { route: 'ManageKidsClub', action: 'navigate' },

  // Badge Events
  badge_awarded: { route: 'Badges', action: 'navigate' },
  badge_milestone: { route: 'Badges', action: 'navigate' },
  leaderboard_rank_up: { route: 'Leaderboard', action: 'navigate' },

  // ID Badge Verification Events
  id_badge_submission: { route: 'IDVerificationUpload', action: 'navigate' },
  id_badge_approved: { route: 'IDVerificationUpload', action: 'navigate' },
  id_badge_rejected: { route: 'IDVerificationUpload', action: 'navigate' },
  id_verification_submission: { route: 'IDVerificationUpload', action: 'navigate' },
  id_verification_approved: { route: 'IDVerificationUpload', action: 'navigate' },
  id_verification_rejected: { route: 'IDVerificationUpload', action: 'navigate' },

  // Payout Events
  payout_requires_action: { route: 'PayoutSettings', action: 'navigate' },
  payout_sent: { route: 'PayoutSettings', action: 'navigate' },
  payout_failed: { route: 'PayoutSettings', action: 'navigate' },

  // Trade Events
  trade_request: { route: 'TradeList', action: 'navigate' },
  trade_completion_requested: { route: 'TradeList', action: 'navigate' },
  trade_accepted: { route: 'TradeList', action: 'navigate' },
  offer_accepted: { route: 'TradeTimeline', action: 'navigate' },
  trade_declined: { route: 'TradeList', action: 'navigate' },
  trade_completed: { route: 'TradeList', action: 'navigate' },
  trade_cancelled: { route: 'TradeList', action: 'navigate' },
  trade_message: { route: 'Chat', action: 'navigate' },
  ac_reminder_24h: { route: 'TradeTimeline', action: 'navigate' },
  ac_reminder_2h: { route: 'TradeTimeline', action: 'navigate' },
  // DEV-TASK-48 (G04): offer reminders should open the seller Review Offer screen
  offer_reminder_6h: { route: 'ReviewOffer', action: 'navigate' },
  offer_reminder_1h: { route: 'ReviewOffer', action: 'navigate' },

  // Message Events (MODULE-14 NOTIF-V2-007 - Message notifications)
  message: { route: 'Chat', action: 'navigate' },
  new_message: { route: 'Chat', action: 'navigate' },

  // Review Events
  review_received: { route: 'Profile', action: 'navigate' },
  review_reminder: { route: 'TradeList', action: 'navigate' },

  // Listing moderation events
  item_flagged: { route: 'ListingSafetyReview', action: 'navigate' },
  item_rejected: { route: 'ListingSafetyReview', action: 'navigate' },
  item_needs_edits: { route: 'ListingSafetyReview', action: 'navigate' },
  listing_approved: { route: 'ListingDetail', action: 'navigate' },

  // Referral Events
  referral_signup: { route: 'ReferralDashboard', action: 'navigate' },
  referral_reward: { route: 'ReferralDashboard', action: 'navigate' },

  // System Events
  notification_center: { route: 'Notifications', action: 'navigate' },
  system_announcement: { route: 'Home', action: 'navigate' },
  feature_announcement: { route: 'Home', action: 'navigate' },
  onboarding_reminder: { route: 'Home', action: 'reset' },
};

/**
 * Parse notification data and resolve to app route
 * Handles all notification types, deep_link paths, and route params
 *
 * @param data - Notification data from push notification or in-app notification
 * @returns DeepLinkTarget with route, params, and action, or null if invalid/no navigation needed
 */
export function parseNotificationDeepLink(
  data: NotificationDeepLinkData | null | undefined
): DeepLinkTarget | null {
  if (!data) {
    return null;
  }

  // Extract normalized fields
  const deepLinkPath =
    (typeof data.deep_link === 'string' ? data.deep_link : null) ||
    (typeof data.deepLink === 'string' ? data.deepLink : null);
  const type = typeof data.type === 'string' ? data.type : null;
  const event = typeof data.event === 'string' ? data.event : null;
  // DEV-TASK-48 (G04): in-app offer-reminder rows carry only `event_type` in data
  // (no `type`/`event`), so fall back to it for route resolution.
  const eventType = typeof data.event_type === 'string' ? data.event_type : null;

  // Extract entity IDs for parameterized routes
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawTradeId =
    (typeof data.trade_id === 'string' ? data.trade_id : null) ||
    (typeof data.tradeId === 'string' ? data.tradeId : null);
  // Only accept valid UUID trade IDs — prevents "invalid input syntax for type uuid" errors
  const tradeId = rawTradeId && UUID_RE.test(rawTradeId) ? rawTradeId : null;
  const listingId =
    (typeof data.listing_id === 'string' ? data.listing_id : null) ||
    (typeof data.listingId === 'string' ? data.listingId : null) ||
    (typeof data.item_id === 'string' ? data.item_id : null) ||
    (typeof data.itemId === 'string' ? data.itemId : null);
  const notificationId =
    (typeof data.notification_id === 'string' ? data.notification_id : null) ||
    (typeof data.notificationId === 'string' ? data.notificationId : null);
  const userId =
    (typeof data.user_id === 'string' ? data.user_id : null) ||
    (typeof data.userId === 'string' ? data.userId : null);

  let target: DeepLinkTarget | null = null;

  // Priority 1: Explicit deep_link path with params (e.g., "/trade/123")
  if (deepLinkPath) {
    const parsedPath = parseDeepLinkPath(deepLinkPath);
    if (parsedPath) {
      target = parsedPath;
    }
  }

  // Priority 2: Notification type or event mapping
  if (!target && (type || event || eventType)) {
    const typeKey = type || event || eventType;
    if (typeKey && TYPE_TO_ROUTE_MAP[typeKey]) {
      const { route, action } = TYPE_TO_ROUTE_MAP[typeKey];
      target = { route, action, params: {} };
    }
  }

  // No valid target found
  if (!target) {
    return null;
  }

  const notificationType = type || event || eventType;

  // Enrich target with entity-specific params
  if (tradeId) {
    // Incoming offers + offer reminders should open the seller review flow directly.
    if (
      notificationType === 'trade_request' ||
      notificationType === 'offer_reminder_6h' ||
      notificationType === 'offer_reminder_1h'
    ) {
      target.route = 'ReviewOffer';
      target.params = { tradeId };
    } else if (target.route === 'TradeList') {
      // If we have a specific trade ID, navigate to detail instead
      target.route = 'TradeDetail';
      target.params = { tradeId };
    } else if (target.route === 'TradeDetail' || target.route === 'TradeTimeline') {
      target.params = { ...(target.params || {}), tradeId };
    } else if (target.route === 'Chat') {
      // Message notifications: navigate directly to chat with tradeId
      target.params = { tradeId };
    }
  }

  if (listingId) {
    if (target.route === 'Discover') {
      // If we have a specific listing ID, navigate to detail instead
      target.route = 'ListingDetail';
      target.params = { listing_id: listingId };
    } else if (target.route === 'EditListing') {
      target.params = { ...(target.params || {}), listing_id: listingId };
    } else if (target.route === 'ListingSafetyReview') {
      target.params = { ...(target.params || {}), listing_id: listingId };
    } else if (target.route === 'ListingDetail') {
      target.params = { ...(target.params || {}), listing_id: listingId };
    }
  }

  if (notificationId && target.route === 'Notifications') {
    // Navigate to notification detail if ID provided
    target.route = 'NotificationDetail';
    target.params = { notificationId };
  }

  if (userId && target.route === 'Profile') {
    target.params = { ...(target.params || {}), userId };
  }

  // Fallback: if target needs a tradeId but none was found, downgrade to TradeList
  if (!tradeId && (target.route === 'TradeDetail' || target.route === 'TradeTimeline')) {
    target.route = 'TradeList';
    target.params = {};
  }

  // Handle trade_request payloads where tradeId exists only in deep_link path.
  if (notificationType === 'trade_request' && target.route === 'TradeDetail') {
    const targetTradeId =
      typeof target.params?.tradeId === 'string' ? (target.params.tradeId as string) : null;

    if (targetTradeId) {
      target.route = 'ReviewOffer';
      target.params = { tradeId: targetTradeId };
    }
  }

  return target;
}

/**
 * Parse deep link path string (e.g., "/trade/123" or "/profile/badges")
 * Returns route and params if valid, null otherwise
 */
function parseDeepLinkPath(path: string): DeepLinkTarget | null {
  if (!path) {
    return null;
  }

  const normalized = path.trim().toLowerCase();

  // Check exact match first
  if (DEEP_LINK_ROUTES[normalized]) {
    return {
      route: DEEP_LINK_ROUTES[normalized],
      action: 'navigate',
    };
  }

  // Check for parameterized paths (e.g., "/trade/123")
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  // Handle "/trade/:id" pattern
  if (segments[0] === 'trade' && segments.length === 2) {
    return {
      route: 'TradeDetail',
      params: { tradeId: segments[1] },
      action: 'navigate',
    };
  }

  // Handle "/listing/:id" pattern
  if (segments[0] === 'listing' && segments.length === 2) {
    return {
      route: 'ListingDetail',
      params: { listing_id: segments[1] },
      action: 'navigate',
    };
  }

  // Handle "/notification/:id" pattern
  if (segments[0] === 'notification' && segments.length === 2) {
    return {
      route: 'NotificationDetail',
      params: { notificationId: segments[1] },
      action: 'navigate',
    };
  }

  // Fallback: check if base path is a route
  const basePath = `/${segments[0]}`;
  if (DEEP_LINK_ROUTES[basePath]) {
    return {
      route: DEEP_LINK_ROUTES[basePath],
      action: 'navigate',
    };
  }

  return null;
}

/**
 * Get fallback route when deep link is invalid or not resolvable
 * Returns Home screen as safe fallback
 */
export function getFallbackRoute(): DeepLinkTarget {
  return {
    route: 'Home',
    action: 'reset',
  };
}

/**
 * Validate if a route exists in current navigation state
 * Prevents navigation errors when routes are not mounted
 */
export function canNavigateToRoute(routeName: string, navigationState: any): boolean {
  if (!navigationState) {
    return false;
  }

  const routeNames = (navigationState as { routeNames?: string[] })?.routeNames ?? [];
  return routeNames.includes(routeName);
}

/**
 * Build deep link URL for sharing
 * Used for generating shareable notification links (e.g., referral notifications)
 */
export function buildDeepLinkUrl(
  route: keyof RootStackParamList,
  params?: Record<string, any>
): string {
  const baseUrl = 'p2pkidsmarketplace://';

  // Map route to path
  const routeToPath: Partial<Record<keyof RootStackParamList, string>> = {
    SpWallet: 'wallet',
    ManageKidsClub: 'subscription',
    Badges: 'badges',
    TradeList: 'trades',
    TradeDetail: 'trade',
    ListingDetail: 'listing',
    NotificationDetail: 'notification',
    ReferralDashboard: 'referral',
    Profile: 'profile',
    IDVerificationUpload: 'id-verification-upload',
    Notifications: 'notifications',
    Home: 'home',
  };

  const path = routeToPath[route] || route.toLowerCase();

  // Add params to path if needed
  if (params) {
    if (params.tradeId && route === 'TradeDetail') {
      return `${baseUrl}${path}/${params.tradeId}`;
    }
    if (params.listing_id && route === 'ListingDetail') {
      return `${baseUrl}${path}/${params.listing_id}`;
    }
    if (params.notificationId && route === 'NotificationDetail') {
      return `${baseUrl}${path}/${params.notificationId}`;
    }
  }

  return `${baseUrl}${path}`;
}

/**
 * Log deep link navigation for debugging and analytics
 */
export function logDeepLinkNavigation(
  source: 'push' | 'in_app' | 'cold_start',
  data: NotificationDeepLinkData,
  target: DeepLinkTarget | null
): void {
  if (__DEV__) {
    console.log('[DeepLink]', {
      source,
      type: data.type,
      deepLink: data.deep_link || data.deepLink,
      target: target
        ? { route: target.route, params: target.params, action: target.action }
        : 'no_target',
    });
  }

  // TODO(ANALYTICS): Send to Firebase Analytics
  // analytics().logEvent('notification_deep_link', {
  //   source,
  //   notification_type: data.type,
  //   target_route: target?.route,
  // });
}
