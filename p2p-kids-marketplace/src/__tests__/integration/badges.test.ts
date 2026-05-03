/**
 * File: p2p-kids-marketplace/src/__tests__/integration/badges.test.ts
 * MODULE-08 BADGES-V2-001: Integration tests for badges
 *
 * Note: These tests expect Supabase tables to be available.
 * If running in a test environment without real DB, it safely skips or uses mocks.
 */

import { getUserBadges, getAllBadges } from '../../services/badges';
import { supabase } from '../../config/supabase';

describe('Badges Integration Tests', () => {
  // We use a real-ish test if SUPABASE_URL is set, else we skip or mock
  const isLiveTest = !!process.env.SUPABASE_URL;

  if (!isLiveTest) {
    it('skipping live integration tests (SUPABASE_URL not set)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // Example UUID

  it('should fetch at least one badge definition from seeded data', async () => {
    const badges = await getAllBadges();
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.some((b) => b.name === 'SP Earner - Bronze')).toBe(true);
  });

  it('should handle fetching badges for a user with no badges', async () => {
    const userBadges = await getUserBadges(testUserId);
    expect(Array.isArray(userBadges)).toBe(true);
  });
});
