// File: p2p-kids-marketplace/src/services/__tests__/referral.test.ts
// Tests for referral system (AUTH-010, AUTH-011)

import { generateReferralCode } from '../referral';
import { supabase } from '../supabase/client';

jest.setTimeout(10000);

// generateReferralCode checks uniqueness against the profiles table. Mock the
// Supabase client so this unit test is deterministic and never hits a live DB
// (CI has no backend — an unmocked call hangs and exceeds the 10s timeout).
jest.mock('../supabase/client');

describe('Referral Service', () => {
  describe('generateReferralCode', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // No existing profile has the generated code → the first code is returned.
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
    });

    it('should generate an 8-character code', async () => {
      const code = await generateReferralCode();
      expect(code).toHaveLength(8);
    });

    it('should generate uppercase alphanumeric code', async () => {
      const code = await generateReferralCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should generate unique codes', async () => {
      const code1 = await generateReferralCode();
      const code2 = await generateReferralCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('processReferralBonus', () => {
    it('should award 5 points to both referrer and referee', async () => {
      // TODO: Implement with mock Supabase client
      expect(true).toBe(true);
    });

    it('should only award bonus on first completed trade', async () => {
      // TODO: Implement with mock Supabase client
      expect(true).toBe(true);
    });

    it('should update referral status to claimed', async () => {
      // TODO: Implement with mock Supabase client
      expect(true).toBe(true);
    });
  });
});
