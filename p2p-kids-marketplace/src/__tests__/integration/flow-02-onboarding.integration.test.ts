// FILE: src/__tests__/integration/flow-02-onboarding.integration.test.ts
// MODULE-15.1 FLOW-02 integration checks (Supabase E2E gated)

import {
  markOnboardingComplete,
  markOnboardingSkipped,
  shouldShowOnboarding,
  trackEducationEvent,
} from '@/services/educationAnalyticsService';

describe('FLOW-02 Onboarding Integration', () => {
  const describeIfE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

  describeIfE2E('education analytics service', () => {
    it('tracks onboarding_view event without throwing', async () => {
      await expect(
        trackEducationEvent('onboarding_start', { source: 'flow-02-integration' })
      ).resolves.not.toThrow();
    });

    it('returns boolean onboarding visibility state', async () => {
      const value = await shouldShowOnboarding('00000000-0000-0000-0000-000000000000');
      expect(typeof value).toBe('boolean');
    });

    it('completion/skipped markers return boolean responses', async () => {
      const completeResult = await markOnboardingComplete('00000000-0000-0000-0000-000000000000');
      const skipResult = await markOnboardingSkipped('00000000-0000-0000-0000-000000000000');

      expect(typeof completeResult).toBe('boolean');
      expect(typeof skipResult).toBe('boolean');
    });
  });
});
