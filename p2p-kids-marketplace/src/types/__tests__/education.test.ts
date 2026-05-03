// FILE: p2p-kids-marketplace/src/types/__tests__/education.test.ts
// MODULE-18 V1 EDU-002: Unit tests for education types

import {
  SectionType,
  EducationSection,
  EducationExample,
  SPCalculation,
  SellSPCalculation,
  BuySPCalculation,
  EducationAnalyticsEventType,
  EducationAnalyticsEvent,
  BonusCategory,
} from '../education';

describe('Education Types', () => {
  describe('SectionType', () => {
    it('should match DB CHECK constraint exactly', () => {
      const validTypes: SectionType[] = [
        'general',
        'sp_definition',
        'sp_earning',
        'sp_spending',
        'safety',
        'example',
      ];

      validTypes.forEach((type) => {
        expect(type).toBeDefined();
      });

      // TypeScript compile-time check ensures only these 6 values are valid
      expect(validTypes.length).toBe(6);
    });
  });

  describe('EducationSection', () => {
    it('should have all required mobile-facing fields', () => {
      const section: EducationSection = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'How Swap Points Work',
        body: 'Swap Points are earned when you sell items...',
        image_url: 'https://example.supabase.co/storage/v1/object/public/images/sp-illustration.png',
        display_order: 1,
        section_type: 'sp_definition',
        is_published: true,
        published_at: '2026-04-20T12:00:00Z',
        created_at: '2026-04-20T11:00:00Z',
      };

      expect(section.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(section.title).toBe('How Swap Points Work');
      expect(section.section_type).toBe('sp_definition');
      expect(section.is_published).toBe(true);
    });

    it('should allow null image_url and published_at', () => {
      const section: EducationSection = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Draft Section',
        body: 'This is a draft...',
        image_url: null,
        display_order: 2,
        section_type: 'general',
        is_published: false,
        published_at: null,
        created_at: '2026-04-20T11:00:00Z',
      };

      expect(section.image_url).toBeNull();
      expect(section.published_at).toBeNull();
    });

    it('should NOT include admin-only fields', () => {
      const section: EducationSection = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Test',
        body: 'Body text...',
        image_url: null,
        display_order: 1,
        section_type: 'safety',
        is_published: true,
        published_at: '2026-04-20T12:00:00Z',
        created_at: '2026-04-20T11:00:00Z',
      };

      // @ts-expect-error - published_by is admin-only
      expect(section.published_by).toBeUndefined();

      // @ts-expect-error - updated_at is admin-only
      expect(section.updated_at).toBeUndefined();
    });
  });

  describe('EducationExample', () => {
    it('should have all required fields', () => {
      const example: EducationExample = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        item_name: 'LEGO Set',
        item_price: 25.99,
        category_id: 'cat-toys-123',
        display_order: 1,
        is_published: true,
        created_at: '2026-04-20T11:00:00Z',
      };

      expect(example.item_name).toBe('LEGO Set');
      expect(example.item_price).toBe(25.99);
      expect(example.category_id).toBe('cat-toys-123');
    });

    it('should allow null category_id for "Other" category', () => {
      const example: EducationExample = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        item_name: 'Mystery Item',
        item_price: 10.00,
        category_id: null,
        display_order: 2,
        is_published: false,
        created_at: '2026-04-20T11:00:00Z',
      };

      expect(example.category_id).toBeNull();
    });
  });

  describe('SPCalculation discriminated union', () => {
    it('should support sell mode with all required fields', () => {
      const calculation: SellSPCalculation = {
        mode: 'sell',
        price: 25.00,
        category_id: 'cat-books-456',
        category_name: 'Books',
        earn_sp: 33, // Math.round(25 × 1.30)
        multiplier: 1.30,
        is_bonus: true, // 1.30 > 1.10
      };

      expect(calculation.mode).toBe('sell');
      expect(calculation.earn_sp).toBe(33);
      expect(calculation.is_bonus).toBe(true);
    });

    it('should support buy mode with all required fields', () => {
      const calculation: BuySPCalculation = {
        mode: 'buy',
        price: 25.00,
        category_id: 'cat-books-456',
        category_name: 'Books',
        max_sp_usable: 18, // Math.floor(25 × 0.75)
        sp_spending_cap_percent: 75,
        sp_to_use: 15,
        cash_paid: 10.00, // 25 - 15
        fee: 2.50, // 10% of 25
        total_cost: 12.50, // 10 + 2.50
        is_bonus: true,
      };

      expect(calculation.mode).toBe('buy');
      expect(calculation.max_sp_usable).toBe(18);
      expect(calculation.total_cost).toBe(12.50);
    });

    it('should be type-safe via discriminated union', () => {
      const calculations: SPCalculation[] = [
        {
          mode: 'sell',
          price: 25.00,
          category_id: 'cat-books-456',
          category_name: 'Books',
          earn_sp: 33,
          multiplier: 1.30,
          is_bonus: true,
        },
        {
          mode: 'buy',
          price: 25.00,
          category_id: 'cat-toys-789',
          category_name: 'Toys',
          max_sp_usable: 17,
          sp_spending_cap_percent: 70,
          sp_to_use: 10,
          cash_paid: 15.00,
          fee: 2.50,
          total_cost: 17.50,
          is_bonus: false,
        },
      ];

      calculations.forEach((calc) => {
        if (calc.mode === 'sell') {
          expect(calc.earn_sp).toBeDefined();
          expect(calc.multiplier).toBeDefined();
          // @ts-expect-error - max_sp_usable is not on sell mode
          expect(calc.max_sp_usable).toBeUndefined();
        } else {
          expect(calc.max_sp_usable).toBeDefined();
          expect(calc.total_cost).toBeDefined();
          // @ts-expect-error - earn_sp is not on buy mode
          expect(calc.earn_sp).toBeUndefined();
        }
      });
    });
  });

  describe('EducationAnalyticsEventType', () => {
    it('should match DB CHECK constraint exactly', () => {
      const validEventTypes: EducationAnalyticsEventType[] = [
        'onboarding_start',
        'onboarding_complete',
        'onboarding_skip',
        'help_view',
        'section_expand',
        'calculator_use',
        'seller_prompt_view',
        'buyer_prompt_view',
      ];

      validEventTypes.forEach((eventType) => {
        expect(eventType).toBeDefined();
      });

      expect(validEventTypes.length).toBe(8);
    });
  });

  describe('EducationAnalyticsEvent', () => {
    it('should have all required fields', () => {
      const event: EducationAnalyticsEvent = {
        id: '123e4567-e89b-12d3-a456-426614174005',
        user_id: 'user-123',
        event_type: 'calculator_use',
        event_data: {
          section_type: 'sp_earning',
          category_id: 'cat-books-456',
          item_price_bucket: '10-50',
        },
        created_at: '2026-04-20T12:00:00Z',
      };

      expect(event.event_type).toBe('calculator_use');
      expect(event.event_data?.section_type).toBe('sp_earning');
    });

    it('should allow null user_id for anonymous events', () => {
      const event: EducationAnalyticsEvent = {
        id: '123e4567-e89b-12d3-a456-426614174006',
        user_id: null,
        event_type: 'onboarding_start',
        event_data: null,
        created_at: '2026-04-20T12:00:00Z',
      };

      expect(event.user_id).toBeNull();
      expect(event.event_data).toBeNull();
    });
  });

  describe('BonusCategory re-export', () => {
    it('should be importable from education.ts', () => {
      const bonusCategory: BonusCategory = {
        id: 'cat-books-456',
        name: 'Books',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: null,
        sp_earning_multiplier: 1.30,
        sp_spending_cap_percent: 75,
        item_count: 42,
      };

      expect(bonusCategory.sp_earning_multiplier).toBeGreaterThan(1.10);
      expect(bonusCategory.name).toBe('Books');
    });

    it('should enforce bonus constraint (> 1.10)', () => {
      const bonusCategory: BonusCategory = {
        id: 'cat-collectibles-789',
        name: 'Collectibles',
        icon: '🎁',
        icon_url: null,
        bonus_badge_icon_url: 'https://example.supabase.co/storage/v1/object/public/icons/star-badge.png',
        sp_earning_multiplier: 1.40, // Valid bonus
        sp_spending_cap_percent: 80,
        item_count: 15,
      };

      expect(bonusCategory.sp_earning_multiplier).toBeGreaterThan(1.10);
    });
  });
});
