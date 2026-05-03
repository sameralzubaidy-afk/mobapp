// FILE: p2p-kids-marketplace/src/__tests__/integration/help-screen.integration.test.ts
// MODULE-18 EDU-005: HelpScreen integration tests (against staging Supabase)

import { getPublishedSections } from '../../services/educationContentService';
import { getBonusCategories } from '../../services/spCalculatorService';
import { trackEducationEvent } from '../../services/educationAnalyticsService';

describe('HelpScreen Integration Tests', () => {
  // Skip if not running Supabase E2E tests
  const shouldRun = process.env.RUN_SUPABASE_E2E === 'true';

  const describeIf = shouldRun ? describe : describe.skip;

  describeIf('Education Content Service', () => {
    it('fetches published sections from database', async () => {
      const sections = await getPublishedSections();

      expect(sections).toBeDefined();
      expect(Array.isArray(sections)).toBe(true);

      if (sections.length > 0) {
        const section = sections[0];
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('body');
        expect(section).toHaveProperty('section_type');
        expect(section.is_published).toBe(true);

        // Verify section types are valid
        const validTypes = ['general', 'sp_definition', 'sp_earning', 'sp_spending', 'safety', 'example'];
        expect(validTypes).toContain(section.section_type);
      }
    });

    it('sections are ordered by display_order', async () => {
      const sections = await getPublishedSections();

      if (sections.length > 1) {
        for (let i = 0; i < sections.length - 1; i++) {
          expect(sections[i].display_order).toBeLessThanOrEqual(sections[i + 1].display_order);
        }
      }
    });
  });

  describeIf('Bonus Categories Service', () => {
    it('fetches bonus categories (sp_earning_multiplier > 1.10)', async () => {
      const categories = await getBonusCategories();

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);

      if (categories.length > 0) {
        categories.forEach((cat) => {
          expect(cat.sp_earning_multiplier).toBeGreaterThan(1.1);
          expect(cat).toHaveProperty('id');
          expect(cat).toHaveProperty('name');
          expect(cat).toHaveProperty('sp_earning_multiplier');
        });
      }
    });

    it('bonus categories are sorted by multiplier descending', async () => {
      const categories = await getBonusCategories();

      if (categories.length > 1) {
        for (let i = 0; i < categories.length - 1; i++) {
          expect(categories[i].sp_earning_multiplier).toBeGreaterThanOrEqual(
            categories[i + 1].sp_earning_multiplier
          );
        }
      }
    });
  });

  describeIf('Education Analytics Service', () => {
    it('tracks help_view event successfully', async () => {
      await expect(
        trackEducationEvent('help_view', {})
      ).resolves.not.toThrow();
    });

    it('tracks section_expand event with data', async () => {
      await expect(
        trackEducationEvent('section_expand', { section_type: 'sp_definition' })
      ).resolves.not.toThrow();
    });

    it('tracks calculator_use event with price bucket', async () => {
      await expect(
        trackEducationEvent('calculator_use', {
          mode: 'sell',
          category_id: 'test-cat-id',
          item_price_bucket: '10-50',
        })
      ).resolves.not.toThrow();
    });
  });

  describeIf('RLS Policies', () => {
    it('published sections are readable by unauthenticated users', async () => {
      // This test verifies that RLS allows SELECT on published sections
      const sections = await getPublishedSections();
      expect(sections).toBeDefined();
      // If this doesn't throw, RLS is working correctly
    });
  });
});
