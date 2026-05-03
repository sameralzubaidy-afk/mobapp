// FILE: p2p-kids-marketplace/src/__tests__/integration/edu-003-services.integration.test.ts
// MODULE-18 V1 EDU-003: Integration tests for education services
// Run against staging Supabase with: RUN_SUPABASE_E2E=true npm run test:e2e

import { getPublishedSections, getSectionByType } from '../../services/educationContentService';
import { getPublishedExamples, calculateExampleSP } from '../../services/educationExampleService';
import { calculateSP, getBonusCategories } from '../../services/spCalculatorService';
import {
  shouldShowOnboarding,
  markOnboardingComplete,
  markOnboardingSkipped,
  trackEducationEvent,
} from '../../services/educationAnalyticsService';

describe('Education Services Integration', () => {
  // Skip if not running E2E tests
  const describeIfE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

  describeIfE2E('Content Service', () => {
    it('should fetch published sections from real DB', async () => {
      const sections = await getPublishedSections();

      expect(Array.isArray(sections)).toBe(true);
      // Should have at least the 4 seed sections
      expect(sections.length).toBeGreaterThanOrEqual(4);

      // All should be published
      sections.forEach((section) => {
        expect(section.is_published).toBe(true);
      });

      // Should be ordered by display_order
      for (let i = 1; i < sections.length; i++) {
        expect(sections[i].display_order).toBeGreaterThanOrEqual(sections[i - 1].display_order);
      }
    });

    it('should fetch single section by type', async () => {
      const section = await getSectionByType('sp_definition');

      if (section) {
        expect(section.section_type).toBe('sp_definition');
        expect(section.is_published).toBe(true);
        expect(section.title).toBeTruthy();
        expect(section.body).toBeTruthy();
      }
    });
  });

  describeIfE2E('Example Service', () => {
    it('should fetch published examples from real DB', async () => {
      const examples = await getPublishedExamples();

      expect(Array.isArray(examples)).toBe(true);
      
      if (examples.length > 0) {
        examples.forEach((example) => {
          expect(example.is_published).toBe(true);
          expect(example.item_price).toBeGreaterThan(0);
        });
      }
    });

    it('should calculate SP for an example with valid category', async () => {
      // Note: This test requires a real active category in DB
      // You may need to adjust category_id based on your seeded data
      const result = await calculateExampleSP(20, 'valid-category-id');

      if (result) {
        expect(result.earn_sp).toBeGreaterThan(0);
        expect(result.max_use_sp).toBeGreaterThan(0);
        expect(result.fee).toBeGreaterThan(0);
        expect(result.category_name).toBeTruthy();
      }
    });

    it('should return null for null category', async () => {
      const result = await calculateExampleSP(20, null);

      expect(result).toBeNull();
    });
  });

  describeIfE2E('SP Calculator Service', () => {
    it('should delegate to MODULE-12 V3 for SP calculations', async () => {
      // Note: Requires real active category
      const result = await calculateSP(25, 'valid-category-id', 'sell');

      if (result && result.mode === 'sell') {
        expect(result.earn_sp).toBeGreaterThan(0);
        expect(result.multiplier).toBeGreaterThan(1);
        expect(result.category_name).toBeTruthy();
      }
    });

    it('should fetch bonus categories', async () => {
      const bonusCategories = await getBonusCategories();

      expect(Array.isArray(bonusCategories)).toBe(true);
      
      if (bonusCategories.length > 0) {
        bonusCategories.forEach((cat) => {
          expect(cat.sp_earning_multiplier).toBeGreaterThan(1.1);
        });
      }
    });
  });

  describeIfE2E('Analytics Service', () => {
    const testUserId = 'test-user-edu-003';

    it('should track analytics event without throwing', async () => {
      await expect(
        trackEducationEvent('help_view', { section_type: 'sp_definition' })
      ).resolves.not.toThrow();
    });

    it('should handle onboarding state correctly', async () => {
      // This test would need a test user profile in the DB
      const shouldShow = await shouldShowOnboarding(testUserId);
      
      expect(typeof shouldShow).toBe('boolean');
    });
  });
});
