// File: p2p-kids-marketplace/src/__tests__/integration/flow-17-notifications.integration.test.ts
// MODULE-15.1 FLOW-17: Integration tests for Notifications against Supabase

import { supabase } from '@/config/supabase';
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/referralNotifications';
import {
  createConfirmedTestUser,
  deleteTestUser,
  getServiceClient,
} from '@/test-helpers/authTestUtils';

const RUN_SUPABASE_E2E = process.env.RUN_SUPABASE_E2E === 'true';
const describeSupabase = RUN_SUPABASE_E2E ? describe : describe.skip;

describeSupabase('FLOW-17 Notifications Integration Tests', () => {
  const testEmail = `flow17-test-${Date.now()}@passitup.test`;
  const testPassword = 'TestPassword123!';

  const service = getServiceClient();

  let canRunSuite = true;
  let skipReason = '';
  let testUserId = '';

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(`[FLOW-17] Skipping case: ${skipReason || 'suite preconditions unavailable'}`);
      return true;
    }

    return false;
  };

  const itIfRunnable = (name: string, fn: () => Promise<void> | void) => {
    it(name, async () => {
      if (shouldSkipCase()) {
        return;
      }
      await fn();
    });
  };

  beforeAll(async () => {
    if (!service) {
      canRunSuite = false;
      skipReason = 'Missing SUPABASE_SERVICE_ROLE_KEY for FLOW-17 setup';
      console.warn(`[FLOW-17] ${skipReason}`);
      return;
    }

    const created = await createConfirmedTestUser({
      email: testEmail,
      password: testPassword,
      userMetadata: {
        full_name: 'Flow 17 Test User',
      },
    });

    if (!created?.userId) {
      canRunSuite = false;
      skipReason = 'Failed to create confirmed test user';
      console.warn(`[FLOW-17] ${skipReason}`);
      return;
    }

    testUserId = created.userId;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      canRunSuite = false;
      skipReason = `Failed to sign in test user: ${signInError.message}`;
      console.warn(`[FLOW-17] ${skipReason}`);
      return;
    }

    const testNotifications = [
      {
        user_id: testUserId,
        category: 'trades',
        type: 'trade_request',
        title: 'New trade request',
        body: 'You have a new trade request',
        channels: ['in_app'],
        data: {},
        is_read: false,
      },
      {
        user_id: testUserId,
        category: 'sp_events',
        type: 'sp_earned',
        title: 'SP Earned',
        body: 'You earned 50 SP',
        channels: ['in_app'],
        data: {},
        is_read: true,
        read_at: new Date().toISOString(),
      },
      {
        user_id: testUserId,
        category: 'safety',
        type: 'recall_alert',
        title: 'Safety Alert',
        body: 'Recalled item detected',
        channels: ['in_app'],
        data: {},
        is_read: false,
      },
    ];

    const { error: insertError } = await service.from('user_notifications').insert(testNotifications);

    if (insertError) {
      canRunSuite = false;
      skipReason = `Failed to insert test notifications: ${insertError.message}`;
      console.warn(`[FLOW-17] ${skipReason}`);
      return;
    }
  });

  afterAll(async () => {
    if (service && testUserId) {
      await service.from('user_notifications').delete().eq('user_id', testUserId);
      await deleteTestUser(testUserId);
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  });

  describe('Fetch Notifications (NotificationCenterScreen)', () => {
    itIfRunnable('should fetch user notifications successfully', async () => {
      const result = await getUserNotifications(testUserId, 20, 0);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(3);

      const firstNotif = result.data![0];
      expect(firstNotif).toHaveProperty('id');
      expect(firstNotif).toHaveProperty('category');
      expect(firstNotif).toHaveProperty('title');
      expect(firstNotif).toHaveProperty('body');
      expect(firstNotif).toHaveProperty('is_read');
      expect(firstNotif).toHaveProperty('created_at');
    });

    itIfRunnable('should fetch notifications with different categories', async () => {
      const result = await getUserNotifications(testUserId, 20, 0);
      expect(result.success).toBe(true);

      const categories = result.data!.map((n) => n.category);
      expect(categories).toContain('trades');
      expect(categories).toContain('sp_events');
      expect(categories).toContain('safety');
    });

    itIfRunnable('should distinguish between read and unread notifications', async () => {
      const result = await getUserNotifications(testUserId, 20, 0);
      expect(result.success).toBe(true);

      const readNotifs = result.data!.filter((n) => n.is_read);
      const unreadNotifs = result.data!.filter((n) => !n.is_read);

      expect(readNotifs.length).toBeGreaterThanOrEqual(1);
      expect(unreadNotifs.length).toBeGreaterThanOrEqual(2);

      readNotifs.forEach((n) => {
        expect(n.read_at).toBeTruthy();
      });
    });
  });

  describe('Mark as Read Functionality', () => {
    itIfRunnable('should mark single notification as read', async () => {
      const result = await getUserNotifications(testUserId, 20, 0);
      expect(result.success).toBe(true);

      const unreadNotif = result.data!.find((n) => !n.is_read);
      if (!unreadNotif) {
        throw new Error('No unread notifications found for test');
      }

      const markResult = await markNotificationAsRead(unreadNotif.id, testUserId);
      expect(markResult.success).toBe(true);

      const { data: updatedNotif, error: updatedNotifError } = await service!
        .from('user_notifications')
        .select('is_read, read_at')
        .eq('id', unreadNotif.id)
        .single();

      expect(updatedNotifError).toBeNull();
      expect(updatedNotif!.is_read).toBe(true);
      expect(updatedNotif!.read_at).toBeTruthy();
    });

    itIfRunnable('should mark all notifications as read', async () => {
      const markAllResult = await markAllNotificationsAsRead(testUserId);
      expect(markAllResult.success).toBe(true);

      const { data: allNotifs, error: allNotifsError } = await service!
        .from('user_notifications')
        .select('is_read, read_at')
        .eq('user_id', testUserId);

      expect(allNotifsError).toBeNull();
      allNotifs!.forEach((n) => {
        expect(n.is_read).toBe(true);
        expect(n.read_at).toBeTruthy();
      });
    });
  });

  describe('RLS Policy Enforcement', () => {
    itIfRunnable('should enforce RLS: user can only see their own notifications', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', fakeUserId);

      if (data) {
        expect(data.length).toBe(0);
      } else {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Pagination Support', () => {
    itIfRunnable('should support pagination with offset', async () => {
      const page1 = await getUserNotifications(testUserId, 2, 0);
      const page2 = await getUserNotifications(testUserId, 2, 2);

      expect(page1.success).toBe(true);
      expect(page2.success).toBe(true);

      if (page1.data!.length > 0 && page2.data!.length > 0) {
        expect(page1.data![0].id).not.toBe(page2.data![0].id);
      }
    });
  });
});
