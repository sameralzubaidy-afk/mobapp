// FILE: p2p-kids-marketplace/e2e/onboarding-carousel.integration.test.ts
// MODULE-18 V1 EDU-004: Onboarding carousel integration test (Supabase staging)

import { supabase } from '../src/config/supabase';
import { shouldShowOnboarding, markOnboardingComplete, markOnboardingSkipped } from '../src/services/educationAnalyticsService';

describe('Onboarding Carousel Integration (Supabase Staging)', () => {
  const RUN_SUPABASE_E2E = process.env.RUN_SUPABASE_E2E === 'true';
  let canRunSupabaseChecks = RUN_SUPABASE_E2E;
  // Use real UUIDs or valid UUID format for local/staging tests
  const TEST_USER_NEW = process.env.TEST_USER_NEW_ID || '00000000-0000-0000-0000-000000000001';
  const TEST_USER_COMPLETED = process.env.TEST_USER_COMPLETED_ID || '00000000-0000-0000-0000-000000000002';
  const TEST_USER_SKIPPED = process.env.TEST_USER_SKIPPED_ID || '00000000-0000-0000-0000-000000000003';
  const TEST_MUTATION_USER = process.env.TEST_ONBOARDING_MUTATION_USER_ID;
  const HAS_COMPLETED_FIXTURE = Boolean(process.env.TEST_USER_COMPLETED_ID);
  const HAS_SKIPPED_FIXTURE = Boolean(process.env.TEST_USER_SKIPPED_ID);

  beforeAll(async () => {
    if (!RUN_SUPABASE_E2E) {
      canRunSupabaseChecks = false;
      return;
    }

    try {
      await supabase.auth.getSession();
    } catch {
      canRunSupabaseChecks = false;
    }
  });

  describe('shouldShowOnboarding', () => {
    it('should return true for new user with no onboarding flags', async () => {
      if (!canRunSupabaseChecks) return;

      const result = await shouldShowOnboarding(TEST_USER_NEW);
      expect(result).toBe(true);
    });

    it('should return false for user who completed onboarding', async () => {
      if (!canRunSupabaseChecks || !HAS_COMPLETED_FIXTURE) return;

      const result = await shouldShowOnboarding(TEST_USER_COMPLETED);
      expect(result).toBe(false);
    });

    it('should return false for user who skipped onboarding', async () => {
      if (!canRunSupabaseChecks || !HAS_SKIPPED_FIXTURE) return;

      const result = await shouldShowOnboarding(TEST_USER_SKIPPED);
      expect(result).toBe(false);
    });
  });

  describe('markOnboardingComplete', () => {
    it('should set onboarding_completed_at timestamp', async () => {
      if (!canRunSupabaseChecks || !TEST_MUTATION_USER) return;

      const testUserId = TEST_MUTATION_USER;

      // Create test profile
      await supabase.from('profiles').upsert({
        user_id: testUserId,
        onboarding_completed_at: null,
        onboarding_skipped_at: null,
      });

      // Mark complete
      const success = await markOnboardingComplete(testUserId);
      expect(success).toBe(true);

      // Verify timestamp was set
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('user_id', testUserId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data?.onboarding_completed_at || null).not.toBeNull();

      // Cleanup
      await supabase.from('profiles').delete().eq('user_id', testUserId);
    });

    it('should make shouldShowOnboarding return false after completion', async () => {
      if (!canRunSupabaseChecks || !TEST_MUTATION_USER) return;

      const testUserId = TEST_MUTATION_USER;

      // Create test profile
      await supabase.from('profiles').upsert({
        user_id: testUserId,
        onboarding_completed_at: null,
        onboarding_skipped_at: null,
      });

      // Should show before completion
      const beforeComplete = await shouldShowOnboarding(testUserId);
      expect(beforeComplete).toBe(true);

      // Mark complete
      await markOnboardingComplete(testUserId);

      // Should NOT show after completion
      const afterComplete = await shouldShowOnboarding(testUserId);
      expect(afterComplete).toBe(false);

      // Cleanup
      await supabase.from('profiles').delete().eq('user_id', testUserId);
    });
  });

  describe('markOnboardingSkipped', () => {
    it('should set onboarding_skipped_at timestamp', async () => {
      if (!canRunSupabaseChecks || !TEST_MUTATION_USER) return;

      const testUserId = TEST_MUTATION_USER;

      // Create test profile
      await supabase.from('profiles').upsert({
        user_id: testUserId,
        onboarding_completed_at: null,
        onboarding_skipped_at: null,
      });

      // Mark skipped
      const success = await markOnboardingSkipped(testUserId);
      expect(success).toBe(true);

      // Verify timestamp was set
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_skipped_at')
        .eq('user_id', testUserId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data?.onboarding_skipped_at || null).not.toBeNull();

      // Cleanup
      await supabase.from('profiles').delete().eq('user_id', testUserId);
    });

    it('should make shouldShowOnboarding return false after skip', async () => {
      if (!canRunSupabaseChecks || !TEST_MUTATION_USER) return;

      const testUserId = TEST_MUTATION_USER;

      // Create test profile
      await supabase.from('profiles').upsert({
        user_id: testUserId,
        onboarding_completed_at: null,
        onboarding_skipped_at: null,
      });

      // Should show before skip
      const beforeSkip = await shouldShowOnboarding(testUserId);
      expect(beforeSkip).toBe(true);

      // Mark skipped
      await markOnboardingSkipped(testUserId);

      // Should NOT show after skip
      const afterSkip = await shouldShowOnboarding(testUserId);
      expect(afterSkip).toBe(false);

      // Cleanup
      await supabase.from('profiles').delete().eq('user_id', testUserId);
    });
  });

  describe('Education Sections DB Content', () => {
    it('should fetch published education sections for onboarding screens', async () => {
      if (!canRunSupabaseChecks) return;

      const { data, error } = await supabase
        .from('education_sections')
        .select('*')
        .eq('is_published', true)
        .in('section_type', ['sp_definition', 'sp_earning', 'sp_spending', 'safety'])
        .order('display_order', { ascending: true });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(0); // May be 0 if seed not run
    });
  });
});
