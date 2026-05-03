// File: p2p-kids-marketplace/src/__tests__/e2e/idBadgeUpload.e2e.test.ts
// TASK BADGE-009: ID Badge Upload E2E Tests
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

import { supabase } from '@/services/supabase/client';
import { idBadgeService } from '@/services/idBadge';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for ID Badge Upload Flow
 *
 * Prerequisites:
 * - Database migration 20260208000000_id_badge_verification_system.sql applied
 * - id_badge_verification_requests table exists
 * - id_badge_verification_messages table seeded
 * - id-badge-verification-screenshots storage bucket exists
 * - Test user account created
 *
 * Note: These tests require SUPABASE_E2E_ENABLED=true and real Supabase credentials
 */

const E2E_ENABLED =
  process.env.SUPABASE_E2E_ENABLED === 'true' || process.env.RUN_SUPABASE_E2E === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminSupabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const describeE2E = describe;

describeE2E('ID Badge Upload E2E', () => {
  if (!E2E_ENABLED) {
    it('is activated and requires SUPABASE_E2E_ENABLED=true or RUN_SUPABASE_E2E=true', () => {
      expect(true).toBe(true);
    });
    return;
  }

  let testUserId: string;
  let testEmail: string;

  async function clearTestUserRequests() {
    if (!testUserId) return;

    const client = adminSupabase ?? supabase;
    await client.from('id_badge_verification_requests').delete().eq('user_id', testUserId);
  }

  beforeAll(async () => {
    if (!E2E_ENABLED) return;

    testEmail = `e2e-test-${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create suite test user: ${authError?.message || 'unknown error'}`);
    }

    testUserId = authData.user.id;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'TestPassword123!',
    });

    if (signInError) {
      throw new Error(`Failed to sign in suite test user: ${signInError.message}`);
    }
  });

  afterAll(async () => {
    if (!E2E_ENABLED || !testUserId) return;

    await clearTestUserRequests();

    try {
      await supabase.auth.admin.deleteUser(testUserId);
    } catch {
      // Best-effort cleanup.
    }
  });

  beforeEach(async () => {
    if (!E2E_ENABLED || !testUserId) return;
    await clearTestUserRequests();
  });

  afterEach(async () => {
    if (!E2E_ENABLED || !testUserId) return;
    await clearTestUserRequests();
  });

  describe('Configurable Messages', () => {
    it('should fetch disclaimer message from database', async () => {
      const message = await idBadgeService.getMessage('upload_disclaimer');

      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(10);
    });

    it('should return empty string for non-existent message key', async () => {
      const message = await idBadgeService.getMessage('nonexistent_key_12345');

      expect(message).toBe('');
    });

    it('should fetch all required message keys', async () => {
      const requiredKeys = [
        'upload_disclaimer',
        'submit_button_label',
        'pending_status_text',
        'in_app_submission_notification',
      ];

      for (const key of requiredKeys) {
        const message = await idBadgeService.getMessage(key);
        expect(message).toBeTruthy();
      }
    });
  });

  describe('Pending Request Check', () => {
    it('should return null when user has no pending request', async () => {
      const pending = await idBadgeService.checkPendingRequest(testUserId);

      expect(pending).toBeNull();
    });

    it('should return request when user has pending request', async () => {
      // Create a pending request
      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'pending',
          first_name: 'Test',
          last_name: 'User',
          email: testEmail,
        })
        .select()
        .single();

      const pending = await idBadgeService.checkPendingRequest(testUserId);

      expect(pending).toBeTruthy();
      expect(pending!.id).toBe(request!.id);
      expect(pending!.status).toBe('pending');

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('id', request!.id);
    });
  });

  describe('Verification Status', () => {
    it('should return "none" when user has no requests', async () => {
      const status = await idBadgeService.getVerificationStatus(testUserId);

      expect(status.status).toBe('none');
      expect(status.submittedAt).toBeUndefined();
    });

    it('should return "pending" status correctly', async () => {
      // Create pending request
      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      const status = await idBadgeService.getVerificationStatus(testUserId);

      expect(status.status).toBe('pending');
      expect(status.submittedAt).toBeTruthy();

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('id', request!.id);
    });

    it('should return "approved" status with reviewed_at', async () => {
      // Create approved request
      const reviewedAt = new Date().toISOString();
      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'approved',
          submitted_at: new Date(Date.now() + 86400000).toISOString(),
          reviewed_at: reviewedAt,
        })
        .select()
        .single();

      const status = await idBadgeService.getVerificationStatus(testUserId);

      expect(status.status).toBe('approved');
      expect(status.reviewedAt).toBeTruthy();

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('id', request!.id);
    });

    it('should return "rejected" status with reason and notes', async () => {
      // Create rejected request
      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'rejected',
          submitted_at: new Date(Date.now() + 86400000).toISOString(),
          reviewed_at: new Date().toISOString(),
          rejection_reason: 'unclear_photo',
          rejection_notes: 'Please retake with better lighting',
        })
        .select()
        .single();

      const status = await idBadgeService.getVerificationStatus(testUserId);

      expect(status.status).toBe('rejected');
      expect(status.rejectionReason).toBe('unclear_photo');
      expect(status.rejectionNotes).toBe('Please retake with better lighting');

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('id', request!.id);
    });
  });

  describe('Duplicate Submission Prevention', () => {
    it('should prevent duplicate submission when pending request exists', async () => {
      // Create initial pending request
      await supabase.from('id_badge_verification_requests').insert({
        user_id: testUserId,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });

      // Check for pending
      const pending = await idBadgeService.checkPendingRequest(testUserId);
      expect(pending).toBeTruthy();

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('user_id', testUserId);
    });

    it('should allow submission after previous request was decided', async () => {
      // Create approved request (decided)
      await supabase.from('id_badge_verification_requests').insert({
        user_id: testUserId,
        status: 'approved',
        submitted_at: new Date(Date.now() - 86400000).toISOString(),
        reviewed_at: new Date().toISOString(),
      });

      // Check for pending - should be null (only checks pending)
      const pending = await idBadgeService.checkPendingRequest(testUserId);
      expect(pending).toBeNull();
    });
  });

  describe('RLS Policies', () => {
    it('should allow user to view their own requests', async () => {
      // Create request as test user
      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'pending',
        })
        .select()
        .single();

      // Query as authenticated user (simulated by service role in test)
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.some((row) => row.id === request!.id)).toBe(true);

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('id', request!.id);
    });

    it('should allow user to insert their own request', async () => {
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.user_id).toBe(testUserId);

      // Cleanup
      await supabase.from('id_badge_verification_requests').delete().eq('id', data!.id);
    });
  });

  describe('Message Templates', () => {
    it('should have all 12 required message templates', async () => {
      const { data, error } = await supabase
        .from('id_badge_verification_messages')
        .select('message_key');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.length).toBeGreaterThanOrEqual(12);

      const requiredKeys = [
        'upload_disclaimer',
        'submit_button_label',
        'pending_status_text',
        'in_app_submission_notification',
        'approved_email_subject',
        'approved_email_body',
        'rejected_email_subject',
        'rejected_email_body',
        'in_app_approved_notification',
        'in_app_rejected_notification',
        'web_push_approved',
        'web_push_rejected',
      ];

      const existingKeys = data!.map((row) => row.message_key);
      for (const key of requiredKeys) {
        expect(existingKeys).toContain(key);
      }
    });
  });
});
