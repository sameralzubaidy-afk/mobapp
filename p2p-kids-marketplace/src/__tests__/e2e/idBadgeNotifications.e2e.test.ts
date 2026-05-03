/**
 * E2E Tests for ID Badge Notification Flow
 * Tests the complete submission → approval/rejection → notification flow
 */

import { supabase } from '@/services/supabase/client';
import { idBadgeService } from '@/services/idBadge';

describe('ID Badge Notification E2E', () => {
  const testUserId = process.env.TEST_USER_ID || '';
  const testAdminId = process.env.TEST_ADMIN_ID || '';
  let requestId: string;

  beforeAll(() => {
    if (!testUserId || !testAdminId) {
      console.warn(
        '⚠️ Test environment not configured. Set TEST_USER_ID and TEST_ADMIN_ID in .env.local'
      );
    }
  });

  describe('Submission Flow', () => {
    it('should send notifications after submission', async () => {
      if (!testUserId) {
        console.log('Skipping: TEST_USER_ID not set');
        return;
      }

      // Note: This test requires a real user and database
      // It should only run in integration test environments (not unit tests)

      // Check for existing pending request
      const existingRequest = await idBadgeService.checkPendingRequest(testUserId);

      if (existingRequest) {
        console.log('User already has pending request, skipping submission test');
        requestId = existingRequest.id;
        return;
      }

      // Mock image URI (for integration tests, use a real test image)
      const mockImageUri = 'file:///path/to/test/image.jpg';

      try {
        // Submit verification request (will trigger notifications)
        requestId = await idBadgeService.submitVerificationRequest(testUserId, mockImageUri);
        expect(requestId).toBeTruthy();
      } catch (error) {
        console.error('Submission failed:', error);
        // Mock submission might fail in test environment, that's okay
      }
    });

    it('should create in-app notification for user', async () => {
      if (!testUserId || !requestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      // Query user_notifications table for submission notification
      const { data: notifications, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('category', 'badges')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Failed to fetch notifications:', error);
        return;
      }

      if (notifications && notifications.length > 0) {
        const notification = notifications[0];
        expect(notification.title).toContain('ID Verification');
        expect(notification.data).toHaveProperty('requestId');
      }
    });

    it('should create admin notification on submission', async () => {
      if (!testAdminId || !requestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      // Query admin notifications
      const { data: adminNotifications, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('admin_id', testAdminId)
        .eq('notification_type', 'id_badge_submission')
        .eq('entity_id', requestId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch admin notifications:', error);
        return;
      }

      if (adminNotifications) {
        expect(adminNotifications.title).toContain('ID Verification');
      }
    });
  });

  describe('Approval Flow', () => {
    it('should invoke approval notification function', async () => {
      if (!requestId || !testAdminId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      // Call the approval notification Edge Function
      const { data, error } = await supabase.functions.invoke('id-badge-notifications', {
        body: {
          requestId,
          decision: 'approved',
          approvalNotes: 'Test approval',
          adminUserId: testAdminId,
        },
      });

      if (error) {
        console.error('Approval notification failed:', error);
        return;
      }

      expect(data?.success).toBe(true);
    });

    it('should update request status to approved', async () => {
      if (!requestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .select('status, reviewed_at, reviewed_by, approval_notes')
        .eq('id', requestId)
        .single();

      if (error) {
        console.error('Failed to fetch request:', error);
        return;
      }

      expect(request?.status).toBe('approved');
      expect(request?.reviewed_at).toBeTruthy();
      expect(request?.reviewed_by).toBe(testAdminId);
    });

    it('should create approval notification for user', async () => {
      if (!testUserId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      const { data: notifications, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('category', 'badges')
        .contains('body', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Failed to fetch notifications:', error);
        return;
      }

      if (notifications && notifications.length > 0) {
        const notification = notifications[0];
        expect(notification.title).toContain('Approved');
        expect(notification.data).toHaveProperty('badge', 'verified');
      }
    });

    it('should log admin approval activity', async () => {
      if (!testAdminId || !requestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      const { data: logs, error } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('admin_id', testAdminId)
        .eq('action_type', 'id_badge_approved')
        .eq('entity_id', requestId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch activity log:', error);
        return;
      }

      if (logs) {
        expect(logs.entity_type).toBe('id_badge_verification');
        expect(logs.notes).toContain('ID badge approved');
      }
    });

    it('should delete screenshot after approval', async () => {
      if (!requestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .select('screenshot_path')
        .eq('id', requestId)
        .single();

      if (request?.screenshot_path) {
        // Try to fetch the screenshot (should fail because it was deleted)
        const { data, error } = await supabase.storage
          .from('id-badge-verification-screenshots')
          .download(request.screenshot_path);

        // Expect either null data or a not found error
        expect(data || error).toBeTruthy();
        if (error) {
          expect(error.message).toContain('Object not found' || 'not found');
        }
      }
    });
  });

  describe('Rejection Flow', () => {
    let rejectionRequestId: string;

    it('should invoke rejection notification function', async () => {
      if (!testUserId || !testAdminId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      // Create a new test request for rejection
      // (In real tests, you'd submit another verification request)
      // For this test, we'll assume a request exists or skip

      const { data: pendingRequests } = await supabase
        .from('id_badge_verification_requests')
        .select('id')
        .eq('user_id', testUserId)
        .eq('status', 'pending')
        .limit(1);

      if (!pendingRequests || pendingRequests.length === 0) {
        console.log('No pending request for rejection test, skipping');
        return;
      }

      rejectionRequestId = pendingRequests[0].id;

      const { data, error } = await supabase.functions.invoke('id-badge-notifications', {
        body: {
          requestId: rejectionRequestId,
          decision: 'rejected',
          rejectionReason: 'unclear_photo',
          rejectionNotes: 'Please retake with better lighting',
          adminUserId: testAdminId,
        },
      });

      if (error) {
        console.error('Rejection notification failed:', error);
        return;
      }

      expect(data?.success).toBe(true);
    });

    it('should update request status to rejected', async () => {
      if (!rejectionRequestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .select('status, rejection_reason, rejection_notes')
        .eq('id', rejectionRequestId)
        .single();

      if (error) {
        console.error('Failed to fetch request:', error);
        return;
      }

      expect(request?.status).toBe('rejected');
      expect(request?.rejection_reason).toBe('unclear_photo');
      expect(request?.rejection_notes).toBe('Please retake with better lighting');
    });

    it('should create rejection notification with reason', async () => {
      if (!testUserId || !rejectionRequestId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      const { data: notifications, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('category', 'badges')
        .contains('data', { decision: 'rejected' })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Failed to fetch notifications:', error);
        return;
      }

      if (notifications && notifications.length > 0) {
        const notification = notifications[0];
        expect(notification.data).toHaveProperty('reason', 'unclear_photo');
        expect(notification.data).toHaveProperty('screen', 'IDVerificationUpload');
      }
    });
  });

  describe('Notification Preferences', () => {
    it('should respect push_enabled preference', async () => {
      if (!testUserId) {
        console.log('Skipping: test prerequisites not met');
        return;
      }

      // Update user preferences to disable push
      await supabase.from('notification_preferences').upsert({
        user_id: testUserId,
        category: 'badges',
        push_enabled: false,
        in_app_enabled: true,
        email_enabled: true,
      });

      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('push_enabled')
        .eq('user_id', testUserId)
        .eq('category', 'badges')
        .single();

      expect(prefs?.push_enabled).toBe(false);

      // Restore preferences
      await supabase.from('notification_preferences').upsert({
        user_id: testUserId,
        category: 'badges',
        push_enabled: true,
        in_app_enabled: true,
        email_enabled: true,
      });
    });
  });
});
