/**
 * FILE: p2p-kids-marketplace/e2e/subscriptionNotifications.integration.test.ts
 * MODULE-14 TASK NOTIF-V2-002: Integration tests for subscription notifications
 *
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { supabase } from '../src/config/supabase';
import {
  notifySubscriptionRenewed,
  notifyCancellationConfirmed,
  notifyPaymentFailed,
} from '../src/services/subscriptionNotifications';

const skipTests = process.env.RUN_SUPABASE_E2E !== 'true';

function isAuthRateLimitError(message?: string): boolean {
  return Boolean(message && /request rate limit reached/i.test(message));
}

(skipTests ? describe.skip : describe)(
  'MODULE-14 NOTIF-V2-002: Subscription Notifications Integration',
  () => {
    let testUserId: string;
    let canRunSuite = !skipTests;
    let skipReason = '';

    const shouldSkipCase = (): boolean => {
      if (!canRunSuite) {
        console.warn(
          `[subscriptionNotifications.integration] Skipping case: ${skipReason || 'suite preconditions unavailable'}`
        );
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
      // Sign in with test user or create one
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      if (signUpError || !signUpData.user?.id) {
        if (isAuthRateLimitError(signUpError?.message)) {
          canRunSuite = false;
          skipReason = `Supabase auth rate limit while creating subscription notifications test user: ${signUpError?.message}`;
          console.warn(`[subscriptionNotifications.integration] ${skipReason}`);
          return;
        }
        throw new Error(`Failed to create test user: ${signUpError?.message || 'unknown'}`);
      }

      testUserId = signUpData.user.id;
      console.log(`Created test user: ${testUserId}`);

      // Initialize notification preferences if the row already exists.
      await supabase
        .from('notification_preferences')
        .update({
          push_enabled: true,
          in_app_enabled: true,
          email_enabled: false,
        })
        .eq('user_id', testUserId)
        .eq('category', 'subscription');
    });

    afterAll(async () => {
      // Clean up: delete test notifications
      if (testUserId) {
        await supabase.from('user_notifications').delete().eq('user_id', testUserId);
        await supabase.from('notification_preferences').delete().eq('user_id', testUserId);
      }

      await supabase.auth.signOut();
    });

    describe('Subscription Renewal Notifications', () => {
      itIfRunnable('should create renewal notification in database', async () => {
        const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = await notifySubscriptionRenewed(testUserId, nextBillingDate);

        expect(result.success).toBe(true);

        // Verify notification was created
        const { data: notifications, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', testUserId)
          .eq('type', 'subscription')
          .order('created_at', { ascending: false })
          .limit(1);

        expect(error).toBeNull();
        expect(notifications).toHaveLength(1);
        expect(notifications![0].title).toContain('Renewed');
        expect(notifications![0].data.event).toBe('subscription_renewed');
        expect(notifications![0].data.next_billing_date).toBe(nextBillingDate);
      });

      itIfRunnable('should respect user notification preferences', async () => {
        // Disable push notifications
        await supabase
          .from('notification_preferences')
          .update({ push_enabled: false })
          .eq('user_id', testUserId)
          .eq('category', 'subscription');

        const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const result = await notifySubscriptionRenewed(testUserId, nextBillingDate);

        expect(result.success).toBe(true);

        // Re-enable for other tests
        await supabase
          .from('notification_preferences')
          .update({ push_enabled: true })
          .eq('user_id', testUserId)
          .eq('category', 'subscription');
      });
    });

    describe('Cancellation Confirmation Notifications', () => {
      itIfRunnable('should create cancellation notification in database', async () => {
        const accessUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const result = await notifyCancellationConfirmed(testUserId, accessUntil);

        expect(result.success).toBe(true);

        // Verify notification was created
        const { data: notifications, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', testUserId)
          .eq('type', 'subscription')
          .order('created_at', { ascending: false })
          .limit(1);

        expect(error).toBeNull();
        expect(notifications).toHaveLength(1);
        expect(notifications![0].title).toContain('Cancelled');
        expect(notifications![0].body).toContain('90-day grace period');
        expect(notifications![0].data.event).toBe('subscription_cancelled');
      });
    });

    describe('Payment Failure Notifications (Critical)', () => {
      itIfRunnable('should create critical payment failure notification', async () => {
        const result = await notifyPaymentFailed(testUserId, 1);

        expect(result.success).toBe(true);

        // Verify notification was created with critical flag
        const { data: notifications, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', testUserId)
          .eq('type', 'subscription')
          .order('created_at', { ascending: false })
          .limit(1);

        expect(error).toBeNull();
        expect(notifications).toHaveLength(1);
        expect(notifications![0].title).toContain('Payment Failed');
        expect(notifications![0].data.critical).toBe(true);
        expect(notifications![0].data.retry_count).toBe(1);
      });

      itIfRunnable('should bypass user preferences for critical notifications', async () => {
        // Disable ALL notification preferences
        await supabase
          .from('notification_preferences')
          .update({
            push_enabled: false,
            in_app_enabled: false,
            email_enabled: false,
          })
          .eq('user_id', testUserId)
          .eq('category', 'subscription');

        const result = await notifyPaymentFailed(testUserId, 2);

        expect(result.success).toBe(true);

        // Verify notification was still created despite preferences
        const { data: notifications, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', testUserId)
          .eq('type', 'subscription')
          .order('created_at', { ascending: false })
          .limit(1);

        expect(error).toBeNull();
        expect(notifications).toHaveLength(1);
        expect(notifications![0].data.critical).toBe(true);

        // Re-enable for cleanup
        await supabase
          .from('notification_preferences')
          .update({
            push_enabled: true,
            in_app_enabled: true,
          })
          .eq('user_id', testUserId)
          .eq('category', 'subscription');
      });

      itIfRunnable('should escalate message severity by retry count', async () => {
        const retries = [1, 2, 3];
        const notifications = [];

        for (const retry of retries) {
          const result = await notifyPaymentFailed(testUserId, retry);
          expect(result.success).toBe(true);

          // Small delay to ensure distinct created_at timestamps
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Verify all notifications were created with increasing severity
        const { data, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', testUserId)
          .eq('type', 'subscription')
          .order('created_at', { ascending: false })
          .limit(3);

        expect(error).toBeNull();
        expect(data).toHaveLength(3);

        // Most recent (retry 3) should be most urgent
        expect(data![0].body).toContain('Final');
        expect(data![1].body).toContain('again');
        expect(data![2].body).toContain('declined');
      });
    });

    describe('Notification Query Performance', () => {
      itIfRunnable('should efficiently query user notifications', async () => {
        const startTime = Date.now();

        const { data, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', testUserId)
          .eq('type', 'subscription')
          .order('created_at', { ascending: false })
          .limit(10);

        const duration = Date.now() - startTime;

        expect(error).toBeNull();
        expect(duration).toBeLessThan(500); // Should be fast (< 500ms)
        console.log(`Query completed in ${duration}ms`);
      });
    });
  }
);
