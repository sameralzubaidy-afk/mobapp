// File: p2p-kids-marketplace/e2e/IDVerification.integration.test.ts
// TASK MODULE-15.1 FLOW-21: Integration tests for ID Verification service
// Guard: only runs when RUN_SUPABASE_E2E=true
// Uses real Supabase prod client (read operations only — no mutations to prod ID records)

const RUN_E2E = process.env.RUN_SUPABASE_E2E === 'true';
const describeE2E = RUN_E2E ? describe : describe.skip;

import { idBadgeService } from '../src/services/idBadge';

// Test user IDs — these must be seeded in Supabase before running e2e tests
const TEST_USER_UNVERIFIED_ID = process.env.TEST_USER_UNVERIFIED_ID ?? '';
const TEST_USER_PENDING_ID = process.env.TEST_USER_PENDING_ID ?? '';
const TEST_USER_APPROVED_ID = process.env.TEST_USER_APPROVED_ID ?? '';

describeE2E('IDVerificationService — integration (RUN_SUPABASE_E2E=true)', () => {
  // ── getMessage ─────────────────────────────────────────────────────────────
  describe('getMessage()', () => {
    it('returns a non-empty string for upload_disclaimer key', async () => {
      const msg = await idBadgeService.getMessage('upload_disclaimer');
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for submit_button_label key', async () => {
      const msg = await idBadgeService.getMessage('submit_button_label');
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });

    it('returns a fallback string for unknown key (no crash)', async () => {
      const msg = await idBadgeService.getMessage('nonexistent_key_xyz');
      expect(typeof msg).toBe('string');
    });
  });

  // ── getVerificationStatus ──────────────────────────────────────────────────
  describe('getVerificationStatus()', () => {
    it('returns status "none" for an unverified user', async () => {
      if (!TEST_USER_UNVERIFIED_ID) return;
      const result = await idBadgeService.getVerificationStatus(TEST_USER_UNVERIFIED_ID);
      expect(result.status).toBe('none');
    });

    it('returns status "pending" for a user with a pending verification', async () => {
      if (!TEST_USER_PENDING_ID) return;
      const result = await idBadgeService.getVerificationStatus(TEST_USER_PENDING_ID);
      expect(result.status).toBe('pending');
    });

    it('returns status "approved" for a user whose ID has been verified', async () => {
      if (!TEST_USER_APPROVED_ID) return;
      const result = await idBadgeService.getVerificationStatus(TEST_USER_APPROVED_ID);
      expect(result.status).toBe('approved');
      // Approved result should have reviewedAt
      expect(result.reviewedAt).toBeDefined();
    });

    it('returns an object with the IDVerificationStatus shape', async () => {
      if (!TEST_USER_UNVERIFIED_ID) return;
      const result = await idBadgeService.getVerificationStatus(TEST_USER_UNVERIFIED_ID);
      expect(result).toMatchObject({ status: expect.any(String) });
    });
  });

  // ── checkPendingRequest ───────────────────────────────────────────────────
  describe('checkPendingRequest()', () => {
    it('returns null for a user with no pending request', async () => {
      if (!TEST_USER_UNVERIFIED_ID) return;
      const result = await idBadgeService.checkPendingRequest(TEST_USER_UNVERIFIED_ID);
      expect(result).toBeNull();
    });

    it('returns a non-null request ID for a user with a pending request', async () => {
      if (!TEST_USER_PENDING_ID) return;
      const result = await idBadgeService.checkPendingRequest(TEST_USER_PENDING_ID);
      expect(result).not.toBeNull();
    });
  });
});

// ── Unit-level smoke for service shape ──────────────────────────────────────
describe('IDVerificationService — exported contract shape', () => {
  it('exports getMessage as a function', () => {
    expect(typeof idBadgeService.getMessage).toBe('function');
  });

  it('exports getVerificationStatus as a function', () => {
    expect(typeof idBadgeService.getVerificationStatus).toBe('function');
  });

  it('exports submitVerificationRequest as a function', () => {
    expect(typeof idBadgeService.submitVerificationRequest).toBe('function');
  });

  it('exports checkPendingRequest as a function', () => {
    expect(typeof idBadgeService.checkPendingRequest).toBe('function');
  });
});
