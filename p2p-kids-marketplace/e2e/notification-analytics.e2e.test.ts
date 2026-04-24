/**
 * FILE: p2p-kids-marketplace/e2e/notification-analytics.e2e.test.ts
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
 * TASK: E2E Tests for Notification Analytics
 * 
 * Integration tests against staging Supabase
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('Notification Analytics E2E', () => {
  let supabase: SupabaseClient;
  let testNotificationId: string;
  let testUserId: string | null = null;
  let skipReason = '';

  beforeAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.log('Skipping E2E tests (RUN_SUPABASE_E2E not set)');
      return;
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (error || !profile?.user_id) {
      skipReason = 'No profile-linked user found for notification analytics E2E.';
      console.warn(`[notification-analytics.e2e] ${skipReason}`);
      return;
    }

    testUserId = profile.user_id;
  });

  const shouldSkipCase = (): boolean => {
    if (!process.env.RUN_SUPABASE_E2E) {
      return true;
    }

    if (!testUserId) {
      console.warn(
        `[notification-analytics.e2e] Skipping test case: ${skipReason || 'missing test user context'}`
      );
      return true;
    }

    return false;
  };

  beforeEach(async () => {
    if (shouldSkipCase()) return;

    // Create a test notification
    const { data, error } = await supabase
      .from('user_notifications')
      .insert({
        user_id: testUserId,
        category: 'system',
        type: 'test_notification',
        title: 'Test Analytics',
        body: 'Test notification for analytics',
        variant: 'control',
      })
      .select()
      .single();

    if (error) throw error;
    testNotificationId = data.id;
  });

  afterEach(async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    // Clean up test notification
    if (testNotificationId) {
      await supabase
        .from('user_notifications')
        .delete()
        .eq('id', testNotificationId);
    }
  });

  it('should track delivered event', async () => {
    if (shouldSkipCase()) return;

    const { data, error } = await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'delivered',
      p_event_data: { timestamp: new Date().toISOString() },
    });

    expect(error).toBeNull();
    expect(data).toEqual({ success: true, event_id: expect.any(String) });

    // Verify event was created
    const { data: events } = await supabase
      .from('notification_events')
      .select('*')
      .eq('notification_id', testNotificationId)
      .eq('event_type', 'delivered');

    expect(events).toHaveLength(1);
    expect(events![0].event_type).toBe('delivered');
  });

  it('should track opened event and mark notification as read', async () => {
    if (shouldSkipCase()) return;

    const { data, error } = await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'opened',
      p_event_data: { timestamp: new Date().toISOString() },
    });

    expect(error).toBeNull();
    expect(data).toEqual({ success: true, event_id: expect.any(String) });

    // Verify notification is marked as read
    const { data: notification } = await supabase
      .from('user_notifications')
      .select('is_read, read_at')
      .eq('id', testNotificationId)
      .single();

    expect(notification!.is_read).toBe(true);
    expect(notification!.read_at).not.toBeNull();
  });

  it('should track clicked event with deep link', async () => {
    if (shouldSkipCase()) return;

    const deepLink = 'app://trade/123';

    const { data, error } = await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'clicked',
      p_event_data: { deep_link: deepLink, timestamp: new Date().toISOString() },
    });

    expect(error).toBeNull();
    expect(data).toEqual({ success: true, event_id: expect.any(String) });

    // Verify event data contains deep link
    const { data: events } = await supabase
      .from('notification_events')
      .select('*')
      .eq('notification_id', testNotificationId)
      .eq('event_type', 'clicked')
      .single();

    expect(events!.event_data.deep_link).toBe(deepLink);
  });

  it('should track failed event with error message', async () => {
    if (shouldSkipCase()) return;

    const errorMessage = 'Invalid push token';

    const { data, error } = await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'failed',
      p_event_data: { error: errorMessage, timestamp: new Date().toISOString() },
    });

    expect(error).toBeNull();

    // Verify event data contains error
    const { data: events } = await supabase
      .from('notification_events')
      .select('*')
      .eq('notification_id', testNotificationId)
      .eq('event_type', 'failed')
      .single();

    expect(events!.event_data.error).toBe(errorMessage);
  });

  it('should return analytics for date range', async () => {
    if (shouldSkipCase()) return;

    // Track some events
    await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'delivered',
      p_event_data: {},
    });

    await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'opened',
      p_event_data: {},
    });

    // Fetch analytics
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const { data, error } = await supabase.rpc('get_notification_analytics', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
      p_category: null,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      total_sent: expect.any(Number),
      date_range: expect.any(Object),
      by_category: expect.any(Array),
      by_type: expect.any(Array),
    });
    expect(data.total_sent).toBeGreaterThan(0);
  });

  it('should filter analytics by category', async () => {
    if (shouldSkipCase()) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const { data, error } = await supabase.rpc('get_notification_analytics', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
      p_category: 'system',
    });

    expect(error).toBeNull();
    expect(data.by_category.every((cat: any) => cat.category === 'system')).toBe(true);
  });

  it('should return A/B test performance', async () => {
    if (shouldSkipCase()) return;

    let variantNotificationId: string | null = null;

    // Seed at least one additional variant and events so RPC can aggregate non-null variants.
    const { data: variantNotification, error: variantInsertError } = await supabase
      .from('user_notifications')
      .insert({
        user_id: testUserId,
        category: 'system',
        type: 'test_notification',
        title: 'Test Analytics Variant B',
        body: 'Test notification for analytics variant B',
        variant: 'variant_b',
      })
      .select()
      .single();

    if (variantInsertError) {
      throw variantInsertError;
    }

    variantNotificationId = variantNotification.id;

    await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'delivered',
      p_event_data: { seeded_for: 'ab_test' },
    });

    await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'opened',
      p_event_data: { seeded_for: 'ab_test' },
    });

    await supabase.rpc('track_notification_event', {
      p_notification_id: variantNotificationId,
      p_event_type: 'delivered',
      p_event_data: { seeded_for: 'ab_test' },
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    try {
      const { data, error } = await supabase.rpc('get_ab_test_performance', {
        p_notification_type: 'test_notification',
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        notification_type: 'test_notification',
      });
      expect(Array.isArray(data?.variants)).toBe(true);
    } finally {
      if (variantNotificationId) {
        await supabase.from('user_notifications').delete().eq('id', variantNotificationId);
      }
    }
  });

  it('should reject invalid event types', async () => {
    if (shouldSkipCase()) return;

    const { data, error } = await supabase.rpc('track_notification_event', {
      p_notification_id: testNotificationId,
      p_event_type: 'invalid_type',
      p_event_data: {},
    });

    expect(data).toMatchObject({ success: false, error: 'Invalid event type' });
  });

  it('should calculate delivery and open rates consistently', async () => {
    if (shouldSkipCase()) return;

    // Create 10 notifications, deliver 8, open 5
    const notifications: string[] = [];
    const rateTestType = `rate_test_${Date.now()}`;

    try {
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from('user_notifications')
          .insert({
            user_id: testUserId,
            category: 'system',
            type: rateTestType,
            title: `Test ${i}`,
            body: 'Test',
            variant: 'control',
          })
          .select()
          .single();
        notifications.push(data!.id);
      }

      // Deliver 8
      for (let i = 0; i < 8; i++) {
        await supabase.rpc('track_notification_event', {
          p_notification_id: notifications[i],
          p_event_type: 'delivered',
          p_event_data: {},
        });
      }

      // Open 5
      for (let i = 0; i < 5; i++) {
        await supabase.rpc('track_notification_event', {
          p_notification_id: notifications[i],
          p_event_type: 'opened',
          p_event_data: {},
        });
      }

      // Use a bounded window to include freshly inserted notifications reliably.
      const now = Date.now();
      const { data } = await supabase.rpc('get_notification_analytics', {
        p_start_date: new Date(now - 10 * 60 * 1000).toISOString(),
        p_end_date: new Date(now + 10 * 60 * 1000).toISOString(),
        p_category: 'system',
      });

      expect(Array.isArray(data?.by_type)).toBe(true);

      const systemStats =
        data.by_type.find((t: any) => t.type === rateTestType && t.variant === 'control') ||
        data.by_type.find((t: any) => t.type === rateTestType);

      expect(systemStats).toBeDefined();

      const total = Number(systemStats.total);
      const delivered = Number(systemStats.delivered);
      const opened = Number(systemStats.opened);
      const deliveryRate = Number(systemStats.delivery_rate);
      const openRate = Number(systemStats.open_rate);

      const expectedDeliveryRate = total > 0 ? (delivered / total) * 100 : 0;
      const expectedOpenRate = delivered > 0 ? (opened / delivered) * 100 : 0;

      expect(deliveryRate).toBeCloseTo(expectedDeliveryRate, 1);
      expect(openRate).toBeCloseTo(expectedOpenRate, 1);
    } finally {
      // Clean up
      for (const id of notifications) {
        await supabase.from('user_notifications').delete().eq('id', id);
      }
    }
  });
});
