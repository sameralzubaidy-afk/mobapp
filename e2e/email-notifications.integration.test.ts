/**
 * Integration Test: Email Notifications End-to-End Flow
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
 * TASK: Email Notifications - Integration Tests
 * 
 * Tests email notification flow against staging Supabase
 * Run: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { supabase } from '../../config/supabase';
import {
  sendPaymentFailureEmail,
  sendTrialExpiringEmail,
  getUserEmailStats,
} from '../emailNotifications';

// Only run if RUN_SUPABASE_E2E is set
const describeIfE2E = process.env.RUN_SUPABASE_E2E ? describe : describe.skip;

describeIfE2E('Email Notifications Integration Tests', () => {
  const testUserEmail = 'test-email-notifications@example.com';
  let testUserId: string;
  let testEmail: string;

  beforeAll(async () => {
    // Create a test user for integration testing
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testUserEmail,
      password: 'TestPassword123!',
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;
    testEmail = authData.user.email!;
    console.log(`[E2E] Created test user: ${testUserId}`);
  });

  afterAll(async () => {
    // Cleanup: Delete test user
    if (testUserId) {
      const { error } = await supabase.auth.admin.deleteUser(testUserId);
      if (error) {
        console.error(`[E2E] Failed to delete test user:`, error);
      } else {
        console.log(`[E2E] Deleted test user: ${testUserId}`);
      }
    }
  });

  describe('Payment Failure Email', () => {
    it('should send payment failure email and create log entry', async () => {
      const result = await sendPaymentFailureEmail(
        testUserId,
        testEmail,
        'sub_test_123',
        9.99,
        'Test payment failure'
      );

      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();

      // Verify email log was created
      if (result.logId) {
        const { data: log, error } = await supabase
          .from('email_logs')
          .select('*')
          .eq('id', result.logId)
          .single();

        expect(error).toBeNull();
        expect(log).toBeDefined();
        expect(log?.user_id).toBe(testUserId);
        expect(log?.template_type).toBe('payment_failed');
        expect(log?.status).toBe('sent');
      }
    });
  });

  describe('Trial Expiring Email with Preferences', () => {
    it('should respect user email preferences', async () => {
      // Disable email notifications for subscriptions
      await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'subscription',
        p_email_enabled: false,
      });

      const result = await sendTrialExpiringEmail(
        testUserId,
        testEmail,
        7,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should send email when preferences are enabled', async () => {
      // Enable email notifications for subscriptions
      await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'subscription',
        p_email_enabled: true,
      });

      const result = await sendTrialExpiringEmail(
        testUserId,
        testEmail,
        3,
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBeFalsy();
      expect(result.logId).toBeDefined();
    });
  });

  describe('Email Statistics', () => {
    it('should return accurate email statistics for user', async () => {
      const stats = await getUserEmailStats(testUserId);

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.sent).toBeGreaterThanOrEqual(0);
      expect(stats.delivered).toBeGreaterThanOrEqual(0);
      expect(stats.total).toBeGreaterThanOrEqual(stats.sent);
    });
  });

  describe('Unsubscribe Flow', () => {
    it('should generate unsubscribe token and process unsubscribe', async () => {
      // Generate unsubscribe token
      const { data: token, error: tokenError } = await supabase.rpc(
        'generate_unsubscribe_token',
        {
          p_user_id: testUserId,
          p_category: 'subscription',
        }
      );

      expect(tokenError).toBeNull();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Process unsubscribe
      const { data: result, error: unsubError } = await supabase.rpc(
        'process_unsubscribe',
        {
          p_token: token,
        }
      );

      expect(unsubError).toBeNull();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.user_id).toBe(testUserId);
      expect(result.category).toBe('subscription');

      // Verify email preference was updated
      const { data: prefs, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('email_enabled')
        .eq('user_id', testUserId)
        .eq('category', 'subscription')
        .single();

      expect(prefsError).toBeNull();
      expect(prefs?.email_enabled).toBe(false);
    });

    it('should reject invalid or expired tokens', async () => {
      const { data: result, error } = await supabase.rpc('process_unsubscribe', {
        p_token: 'invalid-token-12345',
      });

      expect(result?.success).toBe(false);
      expect(result?.error).toContain('Invalid or expired token');
    });
  });
});
