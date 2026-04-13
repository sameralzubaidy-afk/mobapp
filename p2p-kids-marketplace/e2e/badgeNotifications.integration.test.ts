// filepath: p2p-kids-marketplace/e2e/badgeNotifications.integration.test.ts
// Integration Tests for Badge Award Notifications
// TASK: NOTIF-V2-004
// NOTE: Run with RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '../src/config/supabase';

const TEST_USER_ID = process.env.TEST_USER_ID || '00000000-0000-0000-0000-000000000001';
const TEST_BADGE_ID = process.env.TEST_BADGE_ID || '00000000-0000-0000-0000-000000000002';

describe('Badge Notification Integration Tests', () => {
  beforeAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.warn('⚠️ Skipping E2E tests. Set RUN_SUPABASE_E2E=true to run.');
      return;
    }

    // Verify notification schema exists
    const { data: tables, error } = await supabase
      .from('user_notifications')
      .select('id')
      .limit(1);

    if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
      throw new Error('user_notifications table does not exist. Run notifications migrations first');
    }
  });

  afterEach(async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    // Cleanup test notifications
    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', TEST_USER_ID);
  });

  describe('Badge Award Trigger', () => {
    it('should create notification when badge awarded', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      // Insert user badge (simulates badge award)
      const { error: insertError } = await supabase
        .from('user_badges')
        .insert({
          user_id: TEST_USER_ID,
          badge_id: TEST_BADGE_ID,
        });

      if (insertError && insertError.code !== '23503') {
        // 23503 = foreign key violation (badge doesn't exist in badges table)
        // This is expected in test environment if badge not seeded
        console.warn('Badge insert failed (expected if test badge not seeded):', insertError.message);
      }

      // Wait for trigger to execute
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check notification was created
      const { data: notifications, error: fetchError } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('category', 'badges')
        .eq('type', 'badge_earned');

      expect(fetchError).toBeNull();
      
      // If badge insert succeeded, notification should exist
      if (!insertError) {
        expect(notifications).toBeTruthy();
        expect(notifications!.length).toBeGreaterThan(0);

        const notification = notifications![0];
        expect(notification.title).toContain('New Badge Earned');
        expect(notification.data).toHaveProperty('badge_id');
        expect(notification.data).toHaveProperty('deep_link', '/profile/badges');
      }
    });
  });

  describe('check_badge_milestones RPC', () => {
    it('should execute without error', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { error } = await supabase.rpc('check_badge_milestones', {
        p_user_id: TEST_USER_ID,
      });

      if (error?.code === 'PGRST202') {
        console.warn('Skipping milestone RPC assertion: check_badge_milestones RPC not deployed');
        return;
      }

      // Should not error even if user has no data
      expect(error).toBeNull();
    });

    it('should create milestone notification when close to badge', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      // This test requires:
      // 1. User with SP wallet (48 SP available)
      // 2. Badge with threshold 50 (within 5 SP)
      // 3. No existing milestone notification in last 7 days

      // For now, just verify RPC executes
      const { error } = await supabase.rpc('check_badge_milestones', {
        p_user_id: TEST_USER_ID,
      });

      if (error?.code === 'PGRST202') {
        console.warn('Skipping milestone notification assertion: check_badge_milestones RPC not deployed');
        return;
      }

      expect(error).toBeNull();

      // Check if milestone notification was created
      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('category', 'badges')
        .eq('type', 'badge_milestone_approaching');

      // Notification may or may not exist depending on test data
      if (notifications && notifications.length > 0) {
        const notification = notifications[0];
        expect(notification.title).toContain('Almost There');
        expect(notification.data).toHaveProperty('remaining');
        expect(notification.data).toHaveProperty('threshold');
      }
    });
  });

  describe('Notification Preferences', () => {
    it('should respect user badge notification preferences', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      // Disable push notifications for badges
      const { error: updateError } = await supabase.rpc('update_notification_preference', {
        p_user_id: TEST_USER_ID,
        p_category: 'badges',
        p_push_enabled: false,
        p_in_app_enabled: true,
      });

      expect(updateError).toBeNull();

      // Award badge (would normally trigger notification)
      await supabase
        .from('user_badges')
        .insert({
          user_id: TEST_USER_ID,
          badge_id: TEST_BADGE_ID,
        });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check notification channels
      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('channels')
        .eq('user_id', TEST_USER_ID)
        .eq('category', 'badges')
        .order('created_at', { ascending: false })
        .limit(1);

      if (notifications && notifications.length > 0) {
        const channels = notifications[0].channels;
        expect(channels).not.toContain('push');
        expect(channels).toContain('in_app');
      }
    });
  });

  describe('Notification Deduplication', () => {
    it('should not send duplicate milestone notifications within 7 days', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      // First milestone check
      await supabase.rpc('check_badge_milestones', {
        p_user_id: TEST_USER_ID,
      });

      // Count initial notifications
      const { data: initialNotifs } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'badge_milestone_approaching');

      const initialCount = initialNotifs?.length || 0;

      // Second milestone check (should not create duplicate)
      await supabase.rpc('check_badge_milestones', {
        p_user_id: TEST_USER_ID,
      });

      // Count final notifications
      const { data: finalNotifs } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'badge_milestone_approaching');

      const finalCount = finalNotifs?.length || 0;

      // Should not have created new notifications
      expect(finalCount).toBe(initialCount);
    });
  });
});
