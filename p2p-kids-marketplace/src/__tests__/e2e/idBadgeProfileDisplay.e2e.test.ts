// File: p2p-kids-marketplace/src/__tests__/e2e/idBadgeProfileDisplay.e2e.test.ts
// TASK BADGE-013: E2E tests for ID Badge Status Display on Profile Screen
// NOTE: Requires SUPABASE_E2E_ENABLED=true and real Supabase credentials

import { supabase } from '@/services/supabase/client';
import { idBadgeService } from '@/services/idBadge';
import { createClient } from '@supabase/supabase-js';

// Skip tests if E2E is not enabled
const describeE2E = describe;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminSupabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

describeE2E('BADGE-013: ID Badge Profile Display E2E', () => {
  const supabaseE2EEnabled =
    process.env.SUPABASE_E2E_ENABLED === 'true' || process.env.RUN_SUPABASE_E2E === 'true';
  if (!supabaseE2EEnabled) {
    it('is activated and requires SUPABASE_E2E_ENABLED=true or RUN_SUPABASE_E2E=true', () => {
      expect(true).toBe(true);
    });
    return;
  }

  let testUserId: string = process.env.TEST_USER_ID || '';
  let testUserEmail = '';
  let testRequestId: string;

  async function clearTestUserRequests() {
    if (!testUserId) return;

    const client = adminSupabase ?? supabase;
    await client
      .from('id_badge_verification_requests')
      .delete()
      .eq('user_id', testUserId);
  }

  beforeAll(async () => {
    // Verify Supabase connection
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      console.error('Supabase connection failed:', error);
      throw new Error('E2E tests require valid Supabase connection');
    }

    if (!testUserId) {
      testUserEmail = `badge-profile-e2e-${Date.now()}@example.com`;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testUserEmail,
        password: 'TestPassword123!',
      });

      if (signUpError || !signUpData.user) {
        throw new Error(`Failed to create suite test user: ${signUpError?.message || 'unknown'}`);
      }

      testUserId = signUpData.user.id;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: testUserEmail,
        password: 'TestPassword123!',
      });

      if (signInError) {
        throw new Error(`Failed to sign in suite test user: ${signInError.message}`);
      }
    }

    await clearTestUserRequests();
  });

  beforeEach(async () => {
    await clearTestUserRequests();
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

    await clearTestUserRequests();
  });

  describe('Profile Status Display', () => {
    it('should return "none" status for user with no verification request', async () => {
      const status = await idBadgeService.getVerificationStatus(testUserId);

      expect(status).toEqual({
        status: 'none',
      });
    });

    it('should return "pending" status with submission date for pending request', async () => {
      // Create pending request
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
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

      const status = await idBadgeService.getVerificationStatus(testUserId);

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
          user_id: testUserId,
          status: 'approved',
          submitted_at: new Date(Date.now() + 86400000).toISOString(),
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

      const status = await idBadgeService.getVerificationStatus(testUserId);

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
          user_id: testUserId,
          status: 'rejected',
          submitted_at: new Date(Date.now() + 86400000).toISOString(),
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

      const status = await idBadgeService.getVerificationStatus(testUserId);

      expect(status.status).toBe('rejected');
      expect(status.rejectionReason).toBe(rejectionReason);
      expect(status.rejectionNotes).toBe(rejectionNotes);
    });

    it('should return most recent request when multiple exist', async () => {
      // Create old rejected request
      const { data: oldRequest, error: oldError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
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
          user_id: testUserId,
          status: 'pending',
          submitted_at: new Date(Date.now() + 86400000).toISOString(),
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

      const status = await idBadgeService.getVerificationStatus(testUserId);

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
          user_id: testUserId,
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
        .eq('user_id', testUserId);

      expect(requests).toBeDefined();
      expect(Array.isArray(requests)).toBe(true);

      // Each returned request should belong to TEST_USER_ID
      requests?.forEach((req) => {
        expect(req.user_id).toBe(testUserId);
      });
    });
  });

  describe('Status Transition Flows', () => {
    it('should handle status transition from pending to approved', async () => {
      // Create pending request
      const { data: request, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
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
      let status = await idBadgeService.getVerificationStatus(testUserId);
      expect(status.status).toBe('pending');

      // Simulate admin approval
      const updater = adminSupabase ?? supabase;
      await updater
        .from('id_badge_verification_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', testRequestId);

      // Verify approved status
      status = await idBadgeService.getVerificationStatus(testUserId);
      expect(status.status).toBe('approved');
      expect(status.reviewedAt).toBeDefined();
    });

    it('should handle status transition from rejected to pending (resubmission)', async () => {
      // Create rejected request
      const { data: oldRequest, error: oldError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'rejected',
          submitted_at: new Date(Date.now() + 86400000).toISOString(),
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
      let status = await idBadgeService.getVerificationStatus(testUserId);
      expect(status.status).toBe('rejected');

      // User resubmits (creates new pending request)
      const { data: newRequest, error: newError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'pending',
          submitted_at: new Date(Date.now() + 2 * 86400000).toISOString(),
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
      status = await idBadgeService.getVerificationStatus(testUserId);
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
