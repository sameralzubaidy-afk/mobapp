// File: p2p-kids-marketplace/src/__tests__/e2e/referral-notifications.e2e.ts
// E2E tests for referral notification flow

import { supabase } from '@/services/supabase/client';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  getReferralNotifications,
} from '@/services/referralNotifications';

/**
 * E2E Test Suite for Referral Notifications (REF-V2-005)
 * 
 * Prerequisites:
 * - Supabase connection configured
 * - Test users created with valid subscriptions
 * - Referral codes generated for test users
 * 
 * Test Flow:
 * 1. User A (referrer) has referral code
 * 2. User B (referee) signs up with User A's code
 * 3. Verify User A receives "Invite Accepted" notification
 * 4. User B completes first trade
 * 5. Verify both users receive rewards notifications
 * 6. Test notification read status updates
 * 7. Verify referral-specific notification filtering
 */

describe('Referral Notifications E2E', () => {
  // Test user IDs (replace with actual test user IDs from your DB)
  const TEST_REFERRER_ID = process.env.TEST_REFERRER_USER_ID || 'referrer-test-uuid';
  const TEST_REFEREE_ID = process.env.TEST_REFEREE_USER_ID || 'referee-test-uuid';

  // Skip tests if test user IDs not configured
  const testEnabled = process.env.TEST_REFERRER_USER_ID && process.env.TEST_REFEREE_USER_ID;

  beforeAll(() => {
    if (!testEnabled) {
      console.warn('⚠️ E2E tests skipped: TEST_REFERRER_USER_ID and TEST_REFEREE_USER_ID not set');
    }
  });

  describe('Test Case 1: Invite Accepted Notification', () => {
    it('should send notification when referee signs up with referral code', async () => {
      if (!testEnabled) {
        return;
      }

      // Simulate referral creation (would normally happen during signup)
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: TEST_REFERRER_ID,
          referee_id: TEST_REFEREE_ID,
          referral_code: 'testcode123',
          status: 'pending',
        })
        .select()
        .single();

      expect(referralError).toBeNull();
      expect(referral).toBeDefined();

      // Wait for trigger to fire (notifications are created via trigger)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify notification was created for referrer
      const result = await getReferralNotifications(TEST_REFERRER_ID, 10);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const inviteAcceptedNotif = result.data?.find(
        (n) => n.type === 'referral_invite_accepted' && n.data.referee_id === TEST_REFEREE_ID
      );

      expect(inviteAcceptedNotif).toBeDefined();
      expect(inviteAcceptedNotif?.title).toContain('Invite Was Accepted');
      expect(inviteAcceptedNotif?.is_read).toBe(false);
      expect(inviteAcceptedNotif?.data.deep_link).toBe('ReferralDashboard');
    });
  });

  describe('Test Case 2: Rewards Granted Notification', () => {
    it('should send notifications when referee completes first trade', async () => {
      if (!testEnabled) {
        return;
      }

      // Find pending referral
      const { data: referral } = await supabase
        .from('referrals')
        .select('*')
        .eq('referee_id', TEST_REFEREE_ID)
        .eq('status', 'pending')
        .single();

      if (!referral) {
        console.warn('⚠️ No pending referral found for test');
        return;
      }

      // Simulate referral completion (would normally happen via grant_referral_rewards RPC)
      const { error: updateError } = await supabase
        .from('referrals')
        .update({
          status: 'completed',
          reward_granted_at: new Date().toISOString(),
        })
        .eq('id', referral.id);

      expect(updateError).toBeNull();

      // Wait for triggers to fire
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify referrer received rewards notification
      const referrerResult = await getReferralNotifications(TEST_REFERRER_ID, 10);
      expect(referrerResult.success).toBe(true);

      const referrerRewardsNotif = referrerResult.data?.find(
        (n) => n.type === 'referral_rewards_granted' && n.data.referral_id === referral.id
      );

      expect(referrerRewardsNotif).toBeDefined();
      expect(referrerRewardsNotif?.title).toContain('SP');
      expect(referrerRewardsNotif?.body).toContain('earned');
      expect(referrerRewardsNotif?.data.deep_link).toBe('ReferralDashboard');

      // Verify referee received welcome bonus notification
      const refereeResult = await getReferralNotifications(TEST_REFEREE_ID, 10);
      expect(refereeResult.success).toBe(true);

      const refereeWelcomeNotif = refereeResult.data?.find(
        (n) => n.type === 'referral_welcome_bonus' && n.data.referral_id === referral.id
      );

      expect(refereeWelcomeNotif).toBeDefined();
      expect(refereeWelcomeNotif?.title).toContain('Welcome Bonus');
      expect(refereeWelcomeNotif?.body).toContain('SP');
      expect(refereeWelcomeNotif?.data.deep_link).toBe('SpWallet');
    });
  });

  describe('Test Case 3: Notification Read Status', () => {
    it('should update notification read status correctly', async () => {
      if (!testEnabled) {
        return;
      }

      // Get unread notifications
      const notificationsResult = await getUserNotifications(TEST_REFERRER_ID, 10);
      expect(notificationsResult.success).toBe(true);

      const unreadNotif = notificationsResult.data?.find((n) => !n.is_read);

      if (!unreadNotif) {
        console.warn('⚠️ No unread notifications found for test');
        return;
      }

      // Get initial unread count
      const initialCount = await getUnreadNotificationCount(TEST_REFERRER_ID);
      expect(initialCount.success).toBe(true);
      const initialUnreadCount = initialCount.count || 0;

      // Mark notification as read
      const markResult = await markNotificationAsRead(unreadNotif.id, TEST_REFERRER_ID);
      expect(markResult.success).toBe(true);

      // Verify unread count decreased
      const newCount = await getUnreadNotificationCount(TEST_REFERRER_ID);
      expect(newCount.success).toBe(true);
      expect(newCount.count).toBe(initialUnreadCount - 1);

      // Verify notification marked as read
      const updatedNotificationsResult = await getUserNotifications(TEST_REFERRER_ID, 10);
      const updatedNotif = updatedNotificationsResult.data?.find((n) => n.id === unreadNotif.id);

      expect(updatedNotif?.is_read).toBe(true);
      expect(updatedNotif?.read_at).not.toBeNull();
    });
  });

  describe('Test Case 4: Referral Notification Filtering', () => {
    it('should filter referral-specific notifications correctly', async () => {
      if (!testEnabled) {
        return;
      }

      // Get all notifications
      const allNotificationsResult = await getUserNotifications(TEST_REFERRER_ID, 50);
      expect(allNotificationsResult.success).toBe(true);

      // Get referral-specific notifications
      const referralNotificationsResult = await getReferralNotifications(TEST_REFERRER_ID, 50);
      expect(referralNotificationsResult.success).toBe(true);

      // Verify all returned notifications are referral-related
      const referralTypes = [
        'referral_invite_accepted',
        'referral_rewards_granted',
        'referral_welcome_bonus',
        'referral_custom',
      ];

      referralNotificationsResult.data?.forEach((notif) => {
        expect(referralTypes).toContain(notif.type);
      });

      // Verify count is less than or equal to total notifications
      const referralCount = referralNotificationsResult.data?.length || 0;
      const totalCount = allNotificationsResult.data?.length || 0;
      expect(referralCount).toBeLessThanOrEqual(totalCount);
    });
  });

  describe('Test Case 5: Notification Data Integrity', () => {
    it('should have correct data structure in notifications', async () => {
      if (!testEnabled) {
        return;
      }

      const result = await getReferralNotifications(TEST_REFERRER_ID, 5);
      expect(result.success).toBe(true);

      result.data?.forEach((notif) => {
        // Verify required fields
        expect(notif.id).toBeDefined();
        expect(notif.user_id).toBe(TEST_REFERRER_ID);
        expect(notif.title).toBeDefined();
        expect(notif.body).toBeDefined();
        expect(notif.category).toBe('system');
        expect(notif.created_at).toBeDefined();

        // Verify channels array
        expect(Array.isArray(notif.channels)).toBe(true);
        expect(notif.channels).toContain('push');
        expect(notif.channels).toContain('in_app');

        // Verify data object has deep_link
        expect(notif.data).toBeDefined();
        expect(notif.data.deep_link).toBeDefined();
        expect(['ReferralDashboard', 'SpWallet']).toContain(notif.data.deep_link);
      });
    });
  });

  // Cleanup after tests
  afterAll(async () => {
    if (!testEnabled) {
      return;
    }

    // Clean up test notifications (optional)
    console.log('✅ E2E tests completed. Consider cleaning up test data if needed.');
  });
});

/**
 * Manual Test Instructions:
 * 
 * 1. Set environment variables:
 *    export TEST_REFERRER_USER_ID="uuid-of-test-referrer"
 *    export TEST_REFEREE_USER_ID="uuid-of-test-referee"
 * 
 * 2. Run tests:
 *    npm test -- referral-notifications.e2e.ts
 * 
 * 3. Expected Results:
 *    - All tests pass
 *    - Notifications created in user_notifications table
 *    - Triggers fire automatically on referral events
 *    - Read status updates correctly
 * 
 * 4. Verify in Supabase SQL Editor:
 *    SELECT * FROM user_notifications WHERE user_id = 'your-test-user-id' ORDER BY created_at DESC;
 */
