// File: p2p-kids-marketplace/src/utils/testNotifications.ts
// Utilities for testing push notifications in development

import { sendLocalNotification, scheduleNotification } from '@/services/notifications';

/**
 * Send a simple test notification immediately
 * Use this to verify local notifications are working
 */
export const testLocalNotification = async () => {
  try {
    await sendLocalNotification(
      'Test Notification',
      'This is a test notification from P2P Kids Marketplace',
      { testData: 'hello', type: 'test' }
    );
    console.log('✅ Test local notification sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send test notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Test new message notification
 */
export const testMessageNotification = async () => {
  try {
    await sendLocalNotification(
      '💬 New Message',
      'Sarah commented on your trade request',
      { type: 'message', chatId: 'test-chat-123', senderId: 'test-user-456' }
    );
    console.log('✅ Message notification test sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send message notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Test trade request notification
 */
export const testTradeRequestNotification = async () => {
  try {
    await sendLocalNotification(
      '🤝 New Trade Request',
      'Someone wants to trade for your Nintendo Switch',
      { type: 'trade_request', itemId: 'item-123', tradeId: 'trade-456' }
    );
    console.log('✅ Trade request notification test sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send trade request notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Test item update notification (e.g., seller added more items)
 */
export const testItemUpdateNotification = async () => {
  try {
    await sendLocalNotification(
      '📦 Item Update',
      'A seller you follow added 3 new items',
      { type: 'item_update', sellerId: 'seller-789' }
    );
    console.log('✅ Item update notification test sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send item update notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Test swap points notification
 */
export const testSwapPointsNotification = async () => {
  try {
    await sendLocalNotification(
      '⭐ Swap Points Earned',
      'You earned 50 Swap Points from your recent trade!',
      { type: 'swap_points', points: 50, reason: 'trade_completed' }
    );
    console.log('✅ Swap Points notification test sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send Swap Points notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Test review notification
 */
export const testReviewNotification = async () => {
  try {
    await sendLocalNotification(
      '⭐ New Review',
      'Sarah left you a 5-star review',
      { type: 'review', reviewId: 'review-123', rating: 5 }
    );
    console.log('✅ Review notification test sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send review notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Test delayed notification (scheduled for 5 seconds from now)
 */
export const testScheduledNotification = async () => {
  try {
    await scheduleNotification(
      '⏱️ Scheduled Notification',
      'This notification was scheduled for 5 seconds after request',
      5,
      { type: 'scheduled_test', delaySeconds: 5 }
    );
    console.log('✅ Scheduled notification test sent (will appear in 5 seconds)');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to schedule notification:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Run all notification tests in sequence
 * Useful for comprehensive testing in development
 */
export const testAllNotifications = async () => {
  console.log('🧪 Starting comprehensive notification tests...\n');

  const results: { success: boolean; error?: string }[] = [];

  console.log('1. Testing basic local notification...');
  results.push(await testLocalNotification());
  console.log('');

  console.log('2. Testing message notification...');
  results.push(await testMessageNotification());
  console.log('');

  console.log('3. Testing trade request notification...');
  results.push(await testTradeRequestNotification());
  console.log('');

  console.log('4. Testing item update notification...');
  results.push(await testItemUpdateNotification());
  console.log('');

  console.log('5. Testing Swap Points notification...');
  results.push(await testSwapPointsNotification());
  console.log('');

  console.log('6. Testing review notification...');
  results.push(await testReviewNotification());
  console.log('');

  console.log('7. Testing scheduled notification (will appear in 5 seconds)...');
  results.push(await testScheduledNotification());

  const successCount = results.filter((r) => r.success).length;
  console.log(`\n✅ Tests complete: ${successCount}/${results.length} passed`);

  return {
    success: successCount === results.length,
    passed: successCount,
    total: results.length,
    results,
  };
};

/**
 * Generate a notification test report showing what works
 */
export const generateNotificationTestReport = () => {
  return `
=== PUSH NOTIFICATIONS TEST REPORT ===

Expo Notifications Setup Checklist:
[ ] expo-notifications installed via npm
[ ] app.json configured with notification settings
[ ] Notification service (notifications.ts) created
[ ] push_tokens table created in Supabase
[ ] RLS policies applied for push_tokens table
[ ] send-push-notification Edge Function deployed
[ ] NotificationSetup component integrated in onboarding
[ ] useNotificationObserver hook called in App.tsx
[ ] Environment variable EXPO_PUBLIC_EAS_PROJECT_ID set
[ ] Test notifications working on physical device

Testing Instructions:
1. Run the app on a physical iOS or Android device
2. Import testNotifications.ts in your development screen
3. Call testLocalNotification() to test basic notifications
4. Call testAllNotifications() to run comprehensive tests
5. Verify notifications appear with expected content
6. Test notification taps and navigation handling

Common Issues:
- "Push notifications only work on physical devices" → Use actual device, not simulator
- No permissions dialog → May be already granted; check Settings
- Notifications not showing → Check app.json plugin configuration
- No sound/vibration → Verify notification channel settings for Android

Remote Notifications (Future):
Once backend sends notifications via Edge Function:
1. Verify push token is saved to database after registration
2. Backend queries push_tokens table and sends via Expo API
3. Notifications route user to correct screen based on data.type

For more info:
- Expo docs: https://docs.expo.dev/push-notifications/overview/
- Module: Prompts/MODULE-01-INFRASTRUCTURE.md TASK INFRA-011
`;
};
