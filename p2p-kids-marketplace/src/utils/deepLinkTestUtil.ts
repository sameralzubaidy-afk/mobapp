// File: p2p-kids-marketplace/src/utils/deepLinkTestUtil.ts
// MODULE-14 TASK NOTIF-V2-008: Deep Link Testing Utility
// Utility functions for testing notification deep linking in all app states

import * as Notifications from 'expo-notifications';
import { parseNotificationDeepLink, type NotificationDeepLinkData } from '@/services/deepLink';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Test notification data builder
 * Simplifies creating test notification payloads for different scenarios
 */
export class NotificationTestBuilder {
  private data: NotificationDeepLinkData = {};

  constructor() {
    this.reset();
  }

  reset(): this {
    this.data = {};
    return this;
  }

  setType(type: string): this {
    this.data.type = type;
    return this;
  }

  setEvent(event: string): this {
    this.data.event = event;
    return this;
  }

  setDeepLink(deepLink: string): this {
    this.data.deep_link = deepLink;
    return this;
  }

  setTradeId(tradeId: string): this {
    this.data.trade_id = tradeId;
    this.data.tradeId = tradeId;
    return this;
  }

  setListingId(listingId: string): this {
    this.data.listing_id = listingId;
    this.data.listingId = listingId;
    return this;
  }

  setNotificationId(notificationId: string): this {
    this.data.notification_id = notificationId;
    this.data.notificationId = notificationId;
    return this;
  }

  setUserId(userId: string): this {
    this.data.user_id = userId;
    this.data.userId = userId;
    return this;
  }

  setCustomData(key: string, value: unknown): this {
    this.data[key] = value;
    return this;
  }

  build(): NotificationDeepLinkData {
    return { ...this.data };
  }

  /**
   * Parse the built data to see where it would navigate
   */
  parse() {
    return parseNotificationDeepLink(this.data);
  }
}

/**
 * Test notification scenarios for common notification types
 */
export const TEST_SCENARIOS = {
  // SP Events
  spEarned: () =>
    new NotificationTestBuilder().setType('sp_earned').setDeepLink('/sp-wallet').build(),

  spSpent: () => new NotificationTestBuilder().setType('sp_spent').setDeepLink('/sp-wallet').build(),

  spBalanceLow: () =>
    new NotificationTestBuilder().setType('sp_balance_low').setDeepLink('/discover').build(),

  spWalletFrozen: () =>
    new NotificationTestBuilder()
      .setType('sp_wallet_frozen')
      .setDeepLink('/subscription')
      .build(),

  // Subscription Events
  trialExpiring: () =>
    new NotificationTestBuilder()
      .setType('trial_expiring_3d')
      .setDeepLink('/subscription')
      .build(),

  subscriptionRenewed: () =>
    new NotificationTestBuilder()
      .setEvent('subscription_renewed')
      .setDeepLink('/subscription')
      .build(),

  paymentFailed: () =>
    new NotificationTestBuilder()
      .setEvent('payment_failed')
      .setDeepLink('/subscription')
      .build(),

  // Badge Events
  badgeAwarded: () =>
    new NotificationTestBuilder().setType('badge_awarded').setDeepLink('/badges').build(),

  leaderboardRankUp: () =>
    new NotificationTestBuilder()
      .setType('leaderboard_rank_up')
      .setDeepLink('/leaderboard')
      .build(),

  // Trade Events
  tradeRequest: (tradeId = 'test-trade-123') =>
    new NotificationTestBuilder()
      .setType('trade_request')
      .setTradeId(tradeId)
      .setDeepLink(`/trade/${tradeId}`)
      .build(),

  tradeAccepted: (tradeId = 'test-trade-123') =>
    new NotificationTestBuilder()
      .setType('trade_accepted')
      .setTradeId(tradeId)
      .setDeepLink(`/trade/${tradeId}`)
      .build(),

  tradeCompleted: (tradeId = 'test-trade-123') =>
    new NotificationTestBuilder()
      .setType('trade_completed')
      .setTradeId(tradeId)
      .setDeepLink(`/trade/${tradeId}`)
      .build(),

  // Listing Events
  listingDetail: (listingId = 'test-listing-123') =>
    new NotificationTestBuilder()
      .setListingId(listingId)
      .setDeepLink(`/listing/${listingId}`)
      .build(),

  // Referral Events
  referralSignup: () =>
    new NotificationTestBuilder()
      .setType('referral_signup')
      .setDeepLink('/referral')
      .build(),

  // System Events
  systemAnnouncement: () =>
    new NotificationTestBuilder()
      .setType('system_announcement')
      .setDeepLink('/home')
      .build(),

  // Invalid scenarios (for fallback testing)
  invalidDeepLink: () => new NotificationTestBuilder().setDeepLink('/invalid/route').build(),

  noDeepLink: () => new NotificationTestBuilder().setType('unknown_type').build(),
};

/**
 * Send test notification to current device
 * Can test different app states: foreground, background, killed
 * 
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Notification data (deep link info)
 * @param delaySeconds - Delay before sending (for testing background/killed states)
 */
export async function sendTestNotification(
  title: string,
  body: string,
  data: NotificationDeepLinkData,
  delaySeconds = 0
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    // Request permissions if not granted
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return {
        success: false,
        error: 'Notification permissions not granted',
      };
    }

    const trigger =
      delaySeconds > 0 ? { seconds: delaySeconds } : { seconds: 1, repeats: false };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as Record<string, unknown>,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
    });

    return {
      success: true,
      notificationId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Test all deep link scenarios
 * Returns results for each scenario with expected vs actual route
 * 
 * Useful for automated testing or debugging
 */
export function testAllScenarios(): {
  scenario: string;
  data: NotificationDeepLinkData;
  expectedRoute: keyof RootStackParamList | 'Home (fallback)';
  actualRoute: keyof RootStackParamList | null;
  params?: Record<string, any>;
  passed: boolean;
}[] {
  const results: {
    scenario: string;
    data: NotificationDeepLinkData;
    expectedRoute: keyof RootStackParamList | 'Home (fallback)';
    actualRoute: keyof RootStackParamList | null;
    params?: Record<string, any>;
    passed: boolean;
  }[] = [];

  // SP Events
  results.push({
    scenario: 'SP Earned',
    data: TEST_SCENARIOS.spEarned(),
    expectedRoute: 'SpWallet',
    actualRoute: parseNotificationDeepLink(TEST_SCENARIOS.spEarned())?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.spEarned())?.params,
    passed: parseNotificationDeepLink(TEST_SCENARIOS.spEarned())?.route === 'SpWallet',
  });

  results.push({
    scenario: 'SP Balance Low',
    data: TEST_SCENARIOS.spBalanceLow(),
    expectedRoute: 'BrowseItems',
    actualRoute: parseNotificationDeepLink(TEST_SCENARIOS.spBalanceLow())?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.spBalanceLow())?.params,
    passed: parseNotificationDeepLink(TEST_SCENARIOS.spBalanceLow())?.route === 'BrowseItems',
  });

  // Subscription Events
  results.push({
    scenario: 'Trial Expiring',
    data: TEST_SCENARIOS.trialExpiring(),
    expectedRoute: 'ManageKidsClub',
    actualRoute: parseNotificationDeepLink(TEST_SCENARIOS.trialExpiring())?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.trialExpiring())?.params,
    passed: parseNotificationDeepLink(TEST_SCENARIOS.trialExpiring())?.route === 'ManageKidsClub',
  });

  // Badge Events
  results.push({
    scenario: 'Badge Awarded',
    data: TEST_SCENARIOS.badgeAwarded(),
    expectedRoute: 'Badges',
    actualRoute: parseNotificationDeepLink(TEST_SCENARIOS.badgeAwarded())?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.badgeAwarded())?.params,
    passed: parseNotificationDeepLink(TEST_SCENARIOS.badgeAwarded())?.route === 'Badges',
  });

  // Trade Events with params
  results.push({
    scenario: 'Trade Request (with ID)',
    data: TEST_SCENARIOS.tradeRequest('trade-abc-123'),
    expectedRoute: 'TradeDetail',
    actualRoute:
      parseNotificationDeepLink(TEST_SCENARIOS.tradeRequest('trade-abc-123'))?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.tradeRequest('trade-abc-123'))?.params,
    passed:
      parseNotificationDeepLink(TEST_SCENARIOS.tradeRequest('trade-abc-123'))?.route ===
        'TradeDetail' &&
      parseNotificationDeepLink(TEST_SCENARIOS.tradeRequest('trade-abc-123'))?.params?.tradeId ===
        'trade-abc-123',
  });

  // Invalid scenarios (should fallback to Home)
  results.push({
    scenario: 'Invalid Deep Link',
    data: TEST_SCENARIOS.invalidDeepLink(),
    expectedRoute: 'Home (fallback)',
    actualRoute: parseNotificationDeepLink(TEST_SCENARIOS.invalidDeepLink())?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.invalidDeepLink())?.params,
    passed: parseNotificationDeepLink(TEST_SCENARIOS.invalidDeepLink()) === null,
  });

  results.push({
    scenario: 'No Deep Link',
    data: TEST_SCENARIOS.noDeepLink(),
    expectedRoute: 'Home (fallback)',
    actualRoute: parseNotificationDeepLink(TEST_SCENARIOS.noDeepLink())?.route ?? null,
    params: parseNotificationDeepLink(TEST_SCENARIOS.noDeepLink())?.params,
    passed: parseNotificationDeepLink(TEST_SCENARIOS.noDeepLink()) === null,
  });

  return results;
}

/**
 * Print test results to console (useful for dev debugging)
 */
export function printTestResults(): void {
  const results = testAllScenarios();
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log('\n========================================');
  console.log('DEEP LINK TEST RESULTS');
  console.log('========================================\n');

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.scenario}`);
    console.log(`  Expected: ${result.expectedRoute}`);
    console.log(`  Actual:   ${result.actualRoute ?? 'null (no route)'}`);
    if (result.params && Object.keys(result.params).length > 0) {
      console.log(`  Params:  `, result.params);
    }
    console.log('');
  });

  console.log('========================================');
  console.log(`SUMMARY: ${passed}/${total} tests passed`);
  console.log('========================================\n');
}

/**
 * Quick test helper for manual testing in React Native debugger
 * 
 * Usage in app (for debugging):
 * ```typescript
 * import { quickTest } from '@/utils/deepLinkTestUtil';
 * 
 * // Test SP earned notification
 * quickTest('sp_earned');
 * 
 * // Test trade request notification
 * quickTest('trade_request', 'my-trade-id');
 * ```
 */
export async function quickTest(
  scenarioKey: keyof typeof TEST_SCENARIOS,
  ...args: any[]
): Promise<void> {
  const scenario = TEST_SCENARIOS[scenarioKey];
  if (!scenario) {
    console.error(`❌ Unknown scenario: ${scenarioKey}`);
    return;
  }

  const data = (scenario as any)(...args);
  const target = parseNotificationDeepLink(data);

  console.log(`\n🧪 Testing: ${scenarioKey}`);
  console.log('Data:', data);
  console.log('Target:', target);

  // Send test notification after 3 seconds (gives time to background app)
  const result = await sendTestNotification(
    `Test: ${scenarioKey}`,
    'Tap to test deep linking',
    data,
    3
  );

  if (result.success) {
    console.log(`✅ Notification scheduled (ID: ${result.notificationId})`);
    console.log('⏱️  Background the app in 3 seconds to test background/killed state');
  } else {
    console.error(`❌ Failed to send test notification: ${result.error}`);
  }
}

/**
 * Test navigation stack management
 * Verifies that navigate vs reset actions work correctly
 */
export function testStackManagement() {
  const scenarios = [
    {
      name: 'Onboarding Reminder (should RESET)',
      data: new NotificationTestBuilder()
        .setType('onboarding_reminder')
        .setDeepLink('/home')
        .build(),
      expectedAction: 'reset',
    },
    {
      name: 'SP Earned (should NAVIGATE)',
      data: TEST_SCENARIOS.spEarned(),
      expectedAction: 'navigate',
    },
    {
      name: 'Trade Request (should NAVIGATE)',
      data: TEST_SCENARIOS.tradeRequest(),
      expectedAction: 'navigate',
    },
  ];

  console.log('\n========================================');
  console.log('STACK MANAGEMENT TEST');
  console.log('========================================\n');

  scenarios.forEach((scenario) => {
    const target = parseNotificationDeepLink(scenario.data);
    const actualAction = target?.action ?? 'unknown';
    const passed = actualAction === scenario.expectedAction;

    console.log(`${passed ? '✅' : '❌'} ${scenario.name}`);
    console.log(`  Expected: ${scenario.expectedAction}`);
    console.log(`  Actual:   ${actualAction}`);
    console.log('');
  });

  console.log('========================================\n');
}
