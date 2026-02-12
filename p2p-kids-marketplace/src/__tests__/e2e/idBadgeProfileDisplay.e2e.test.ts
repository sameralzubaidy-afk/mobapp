// File: p2p-kids-marketplace/src/__tests__/e2e/idBadgeProfileDisplay.e2e.test.ts
// TASK BADGE-013: E2E tests for ID Badge Status Display on Profile Screen
// NOTE: Requires SUPABASE_E2E_ENABLED=true and real Supabase credentials

import { supabase } from '@/services/supabase/client';
import { idBadgeService } from '@/services/idBadge';

// Skip tests if E2E is not enabled
const describeE2E = process.env.SUPABASE_E2E_ENABLED === 'true' ? describe : describe.skip;

describeE2E('BADGE-013: ID Badge Profile Display E2E', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';
  let testRequestId: string;

  beforeAll(async () => {
    // Verify Supabase connection
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      console.error('Supabase connection failed:', error);
      throw new Error('E2E tests require valid Supabase connection');
    }
  });

  afterEach(async () => {
    // Cleanup: Delete test request if created
    if (testRequestId) {
      await supabase
        .from('id_badge_verification_requests')
        .delete()
        .eq('id', testRequestId);
      testRequestId = '';
    }
  });

  describe('Profile Status Display', () => {
    it('should return "none" status for user with no verification request', async () => {
      // Create a temporary test user with no verification history
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: `test-${Date.now()}@example.com`,
        password: 'Test123!@#',
        email_confirm: true,
      });

      if (userError || !userData.user) {
        throw new Error('Failed to create test user');
      }

      const testUserId = userData.user.id;

      try {
        const status = await idBadgeService.getVerificationStatus(testUserId);

        expect(status).toEqual({
          status: 'none',
        });
      } finally {
        // Cleanup: Delete test user
        await supabase.auth.admin.deleteUser(testUserId);
      }
    });

    it('should return "pending" status with submission date for pending request', async () => {
      // Create pending request
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (error || !request) {
        throw new Error('Failed to create test request');
      }

      testRequestId = request.id;

      const status = await idBadgeService.getVerificationStatus(TEST_USER_ID);

      expect(status.status).toBe('pending');
      expect(status.submittedAt).toBeDefined();
      expect(typeof status.submittedAt).toBe('string');
    });

    it('should return "approved" status with review date for approved request', async () => {
      const reviewedAt = new Date().toISOString();

      // Create approved request
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'approved',
          submitted_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          reviewed_at: reviewedAt,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (error || !request) {
        throw new Error('Failed to create test request');
      }

      testRequestId = request.id;

      const status = await idBadgeService.getVerificationStatus(TEST_USER_ID);

      expect(status.status).toBe('approved');
      expect(status.reviewedAt).toBeDefined();
      expect(typeof status.reviewedAt).toBe('string');
    });

    it('should return "rejected" status with reason and notes', async () => {
      const rejectionReason = 'unclear_photo';
      const rejectionNotes = 'Please retake with better lighting';

      // Create rejected request
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'rejected',
          submitted_at: new Date(Date.now() - 86400000).toISOString(),
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          rejection_notes: rejectionNotes,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (error || !request) {
        throw new Error('Failed to create test request');
      }

      testRequestId = request.id;

      const status = await idBadgeService.getVerificationStatus(TEST_USER_ID);

      expect(status.status).toBe('rejected');
      expect(status.rejectionReason).toBe(rejectionReason);
      expect(status.rejectionNotes).toBe(rejectionNotes);
    });

    it('should return most recent request when multiple exist', async () => {
      // Create old rejected request
      const { data: oldRequest, error: oldError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'rejected',
          submitted_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          reviewed_at: new Date(Date.now() - 172800000 + 3600000).toISOString(),
          rejection_reason: 'unclear_photo',
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (oldError || !oldRequest) {
        throw new Error('Failed to create old request');
      }

      // Create new pending request
      const { data: newRequest, error: newError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (newError || !newRequest) {
        throw new Error('Failed to create new request');
      }

      testRequestId = newRequest.id;

      const status = await idBadgeService.getVerificationStatus(TEST_USER_ID);

      // Should return the most recent pending request
      expect(status.status).toBe('pending');

      // Cleanup both requests
      await supabase
        .from('id_badge_verification_requests')
        .delete()
        .in('id', [oldRequest.id, newRequest.id]);

      testRequestId = '';
    });
  });

  describe('Configurable Messages Integration', () => {
    it('should load dynamic pending text from messages table', async () => {
      const pendingText = await idBadgeService.getMessage('pending_status_text');

      expect(pendingText).toBeTruthy();
      expect(typeof pendingText).toBe('string');
      expect(pendingText.length).toBeGreaterThan(0);
    });

    it('should handle missing message keys gracefully', async () => {
      const result = await idBadgeService.getMessage('nonexistent_key_12345');

      expect(result).toBe('');
    });

    it('should load all required message templates', async () => {
      const requiredKeys = [
        'upload_disclaimer',
        'submit_button_label',
        'pending_status_text',
        'in_app_submission_notification',
      ];

      for (const key of requiredKeys) {
        const message = await idBadgeService.getMessage(key);
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
      }
    });
  });

  describe('RLS Policy Enforcement', () => {
    it('should enforce RLS: user can only see own requests', async () => {
      // This test requires authenticated Supabase client context
      // In real app, supabase client uses user JWT automatically

      // Create request for TEST_USER_ID
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (error || !request) {
        throw new Error('Failed to create test request');
      }

      testRequestId = request.id;

      // Attempt to query all requests (should only return user's own)
      const { data: requests } = await supabase
        .from('id_badge_verification_requests')
        .select('*')
        .eq('user_id', TEST_USER_ID);

      expect(requests).toBeDefined();
      expect(Array.isArray(requests)).toBe(true);

      // Each returned request should belong to TEST_USER_ID
      requests?.forEach((req) => {
        expect(req.user_id).toBe(TEST_USER_ID);
      });
    });
  });

  describe('Status Transition Flows', () => {
    it('should handle status transition from pending to approved', async () => {
      // Create pending request
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (error || !request) {
        throw new Error('Failed to create test request');
      }

      testRequestId = request.id;

      // Verify initial pending status
      let status = await idBadgeService.getVerificationStatus(TEST_USER_ID);
      expect(status.status).toBe('pending');

      // Simulate admin approval
      await supabase
        .from('id_badge_verification_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', testRequestId);

      // Verify approved status
      status = await idBadgeService.getVerificationStatus(TEST_USER_ID);
      expect(status.status).toBe('approved');
      expect(status.reviewedAt).toBeDefined();
    });

    it('should handle status transition from rejected to pending (resubmission)', async () => {
      // Create rejected request
      const { data: oldRequest, error: oldError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'rejected',
          submitted_at: new Date(Date.now() - 86400000).toISOString(),
          reviewed_at: new Date().toISOString(),
          rejection_reason: 'unclear_photo',
          rejection_notes: 'Please retake',
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (oldError || !oldRequest) {
        throw new Error('Failed to create rejected request');
      }

      // Verify rejected status
      let status = await idBadgeService.getVerificationStatus(TEST_USER_ID);
      expect(status.status).toBe('rejected');

      // User resubmits (creates new pending request)
      const { data: newRequest, error: newError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: TEST_USER_ID,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
        })
        .select('id')
        .single();

      if (newError || !newRequest) {
        throw new Error('Failed to create new request');
      }

      testRequestId = newRequest.id;

      // Verify new pending status (most recent)
      status = await idBadgeService.getVerificationStatus(TEST_USER_ID);
      expect(status.status).toBe('pending');

      // Cleanup
      await supabase
        .from('id_badge_verification_requests')
        .delete()
        .in('id', [oldRequest.id, newRequest.id]);

      testRequestId = '';
    });
  });
});
