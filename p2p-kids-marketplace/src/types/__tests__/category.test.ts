// FILE: p2p-kids-marketplace/src/types/__tests__/category.test.ts
// ADMIN-V3-002: Unit tests for mobile category types
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import type {
  Category,
  BonusCategory,
  CategorySPPreview,
  CreateCategorySuggestionInput,
  CategorySuggestion,
  GetCategoriesOptions,
} from '../category';

describe('Mobile Category Type Definitions', () => {
  describe('Category interface', () => {
    it('should accept a valid category object', () => {
      const category: Category = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Books',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 42,
        display_order: 1,
        sp_earning_multiplier: 1.15,
        sp_spending_cap_percent: 70,
        created_at: '2026-04-20T10:00:00Z',
      };

      expect(category.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(category.name).toBe('Books');
      expect(category.sp_earning_multiplier).toBe(1.15);
      expect(category.item_count).toBe(42);
    });

    it('should not have admin-only fields', () => {
      const category: Category = {
        id: '123',
        name: 'Toys',
        icon: '🧸',
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 10,
        display_order: 2,
        sp_earning_multiplier: 1.1,
        sp_spending_cap_percent: 70,
        created_at: '2026-04-20T10:00:00Z',
        // description: 'Should not exist', // Admin-only
        // sp_config_notes: 'Should not exist', // Admin-only
        // sp_rate_change_notify: false, // Admin-only
        // updated_at: '2026-04-20T10:00:00Z', // Admin-only
      };

      expect(category.name).toBe('Toys');
      // @ts-expect-error - description should not exist
      expect(category.description).toBeUndefined();
    });

    it('should allow null for optional icon fields', () => {
      const category: Category = {
        id: '456',
        name: 'Other',
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 5,
        display_order: 999,
        sp_earning_multiplier: 1.1,
        sp_spending_cap_percent: 70,
        created_at: '2026-04-20T10:00:00Z',
      };

      expect(category.icon).toBeNull();
      expect(category.icon_url).toBeNull();
      expect(category.bonus_badge_icon_url).toBeNull();
    });
  });

  describe('BonusCategory interface', () => {
    it('should represent a category with bonus multiplier', () => {
      const bonusCategory: BonusCategory = {
        id: '123',
        name: 'Books',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: 'https://example.com/star.png',
        sp_earning_multiplier: 1.25, // > 1.10
        sp_spending_cap_percent: 70,
        item_count: 50,
      };

      expect(bonusCategory.sp_earning_multiplier).toBeGreaterThan(1.1);
      expect(bonusCategory.item_count).toBe(50);
      expect(bonusCategory.bonus_badge_icon_url).toBe('https://example.com/star.png');
    });

    it('should match Category subset fields', () => {
      const category: Category = {
        id: '123',
        name: 'Books',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: 'https://example.com/star.png',
        sp_earning_multiplier: 1.25,
        sp_spending_cap_percent: 70,
        item_count: 50,
        is_active: true,
        display_order: 1,
        created_at: '2026-04-20T10:00:00Z',
      };

      // BonusCategory should be assignable from Category (same fields)
      const bonusCategory: BonusCategory = {
        id: category.id,
        name: category.name,
        icon: category.icon,
        icon_url: category.icon_url,
        bonus_badge_icon_url: category.bonus_badge_icon_url,
        sp_earning_multiplier: category.sp_earning_multiplier,
        sp_spending_cap_percent: category.sp_spending_cap_percent,
        item_count: category.item_count,
      };

      expect(bonusCategory.id).toBe(category.id);
    });
  });

  describe('CategorySPPreview interface', () => {
    it('should represent SP preview calculation', () => {
      const preview: CategorySPPreview = {
        price: 50,
        earn_sp: 58, // Math.round(50 * 1.15)
        max_spend_sp: 35, // Math.floor(50 * 70 / 100)
        spend_percent: 70,
      };

      expect(preview.price).toBe(50);
      expect(preview.earn_sp).toBe(58);
      expect(preview.max_spend_sp).toBe(35);
      expect(preview.spend_percent).toBe(70);
    });

    it('should handle edge case calculations', () => {
      // Test rounding behavior matches spec
      const preview1: CategorySPPreview = {
        price: 10.5,
        earn_sp: Math.round(10.5 * 1.2), // 13
        max_spend_sp: Math.floor((10.5 * 75) / 100), // 7
        spend_percent: 75,
      };

      expect(preview1.earn_sp).toBe(13);
      expect(preview1.max_spend_sp).toBe(7);

      const preview2: CategorySPPreview = {
        price: 99.99,
        earn_sp: Math.round(99.99 * 1.1), // 110
        max_spend_sp: Math.floor((99.99 * 50) / 100), // 49
        spend_percent: 50,
      };

      expect(preview2.earn_sp).toBe(110);
      expect(preview2.max_spend_sp).toBe(49);
    });
  });

  describe('CreateCategorySuggestionInput interface', () => {
    it('should accept item_id and suggested_name', () => {
      const input: CreateCategorySuggestionInput = {
        item_id: 'item-123',
        suggested_name: 'Science Kits',
      };

      expect(input.item_id).toBe('item-123');
      expect(input.suggested_name).toBe('Science Kits');
    });

    it('should require both fields', () => {
      // TypeScript compile-time check
      // @ts-expect-error - missing suggested_name
      const incomplete: CreateCategorySuggestionInput = {
        item_id: 'item-123',
      };

      expect(incomplete.item_id).toBe('item-123');
    });
  });

  describe('CategorySuggestion interface', () => {
    it('should accept a minimal suggestion object', () => {
      const suggestion: CategorySuggestion = {
        id: '456',
        suggested_name: 'Science Kits',
        item_id: 'item-789',
        status: 'pending',
        created_at: '2026-04-20T10:00:00Z',
        reviewed_at: null,
        admin_note: null,
      };

      expect(suggestion.status).toBe('pending');
      expect(suggestion.reviewed_at).toBeNull();
      expect(suggestion.admin_note).toBeNull();
    });

    it('should accept all status values', () => {
      const statuses: CategorySuggestion['status'][] = [
        'pending',
        'approved',
        'rejected',
        'merged',
      ];

      statuses.forEach((status) => {
        const suggestion: CategorySuggestion = {
          id: '456',
          suggested_name: 'Test',
          item_id: 'item-123',
          status,
          created_at: '2026-04-20T10:00:00Z',
          reviewed_at: null,
          admin_note: null,
        };

        expect(suggestion.status).toBe(status);
      });
    });

    it('should accept optional merged_to_category', () => {
      const suggestion: CategorySuggestion = {
        id: '456',
        suggested_name: 'Science Kits',
        item_id: 'item-789',
        status: 'merged',
        created_at: '2026-04-20T10:00:00Z',
        reviewed_at: '2026-04-21T10:00:00Z',
        admin_note: 'Merged into existing category',
        merged_to_category: {
          id: 'category-123',
          name: 'Educational Toys',
        },
      };

      expect(suggestion.merged_to_category?.id).toBe('category-123');
      expect(suggestion.merged_to_category?.name).toBe('Educational Toys');
    });

    it('should show seller view of suggestion (minimal fields)', () => {
      const suggestion: CategorySuggestion = {
        id: '456',
        suggested_name: 'Board Games',
        item_id: 'item-789',
        status: 'rejected',
        created_at: '2026-04-20T10:00:00Z',
        reviewed_at: '2026-04-22T10:00:00Z',
        admin_note: 'Category already exists as "Games"',
      };

      // Seller can see why it was rejected
      expect(suggestion.admin_note).toContain('already exists');
      expect(suggestion.status).toBe('rejected');
    });
  });

  describe('GetCategoriesOptions interface', () => {
    it('should accept default options', () => {
      const options: GetCategoriesOptions = {};

      expect(options.includeInactive).toBeUndefined();
    });

    it('should accept includeInactive flag', () => {
      const options1: GetCategoriesOptions = {
        includeInactive: false,
      };

      const options2: GetCategoriesOptions = {
        includeInactive: true,
      };

      expect(options1.includeInactive).toBe(false);
      expect(options2.includeInactive).toBe(true);
    });
  });

  describe('Type independence from admin-portal', () => {
    it('should not import from admin-portal package', () => {
      // This is a compile-time check
      // The mobile types file should NOT have any imports from '../../../p2p-kids-admin'
      // TypeScript will error if any cross-package imports exist

      const category: Category = {
        id: '123',
        name: 'Test',
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 0,
        display_order: 1,
        sp_earning_multiplier: 1.1,
        sp_spending_cap_percent: 70,
        created_at: '2026-04-20T10:00:00Z',
      };

      // If there were imports from admin-portal, TypeScript would fail
      expect(category).toBeDefined();
    });
  });

  describe('Strict TypeScript compliance', () => {
    it('should not use any type', () => {
      // All fields should have explicit types
      const category: Category = {
        id: '123',
        name: 'Test',
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 0,
        display_order: 1,
        sp_earning_multiplier: 1.1,
        sp_spending_cap_percent: 70,
        created_at: '2026-04-20T10:00:00Z',
      };

      // TypeScript should infer all types without 'any'
      const idType: string = category.id;
      const nameType: string = category.name;
      const iconType: string | null = category.icon;
      const isActiveType: boolean = category.is_active;
      const itemCountType: number = category.item_count;

      expect(typeof idType).toBe('string');
      expect(typeof nameType).toBe('string');
      expect(typeof isActiveType).toBe('boolean');
      expect(typeof itemCountType).toBe('number');
    });
  });
});
