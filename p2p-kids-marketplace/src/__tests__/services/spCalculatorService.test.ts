// FILE: p2p-kids-marketplace/src/__tests__/services/spCalculatorService.test.ts
// MODULE-18 V1 EDU-003: Unit tests for SP calculator service

import { calculateSP, getBonusCategories } from '../../services/spCalculatorService';
import * as categoryService from '../../services/categoryService';
import * as adminConfigService from '../../services/adminConfig';
import * as subscriptionService from '../../services/subscription';
import { supabase } from '../../config/supabase';

// Mock category service (MODULE-12 V3)
jest.mock('../../services/categoryService');
jest.mock('../../services/adminConfig');
jest.mock('../../services/subscription');
// Mock supabase (repo convention: educationAnalyticsService.test.ts does the same)
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('spCalculatorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminConfigService.getAdminConfig as jest.Mock).mockResolvedValue({
      transaction_fee_non_subscriber_cents: 299,
    });
    // Default: no signed-in user -> non-subscriber fee (keeps legacy tests stable).
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  describe('calculateSP', () => {
    const mockCategory = {
      id: 'cat-1',
      name: 'LEGO',
      icon: '🧱',
      is_active: true,
      sp_earning_multiplier: 1.3,
      sp_spending_cap_percent: 70,
      display_order: 1,
      item_count: 10,
    };

    it('should calculate sell mode SP correctly', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26, // Math.round(20 * 1.3)
        max_spend_sp: 14, // Math.floor(20 * 70 / 100)
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result).toEqual({
        mode: 'sell',
        price: 20,
        category_id: 'cat-1',
        category_name: 'LEGO',
        earn_sp: 26,
        multiplier: 1.3,
        is_bonus: true, // 1.3 > 1.10
      });

      expect(categoryService.calculateCategorySP).toHaveBeenCalledWith('cat-1', 20);
    });

    it('should calculate buy mode SP correctly', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'buy', 10);

      expect(result).toEqual({
        mode: 'buy',
        price: 20,
        category_id: 'cat-1',
        category_name: 'LEGO',
        max_sp_usable: 14,
        sp_spending_cap_percent: 70,
        sp_to_use: 10,
        cash_paid: 10, // 20 - 10
        fee: 2.99, // Flat fee per SYSTEM_REQUIREMENTS_V2.md
        total_cost: 12.99, // 10 + 2.99
        is_bonus: true,
      });
    });

    it('should default buy mode SP usage to max_sp_usable for preview', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'buy');

      expect(result).toEqual({
        mode: 'buy',
        price: 20,
        category_id: 'cat-1',
        category_name: 'LEGO',
        max_sp_usable: 14,
        sp_spending_cap_percent: 70,
        sp_to_use: 14,
        cash_paid: 6,
        fee: 2.99, // Flat fee per SYSTEM_REQUIREMENTS_V2.md
        total_cost: 8.99, // 6 + 2.99
        is_bonus: true,
      });
    });

    it('should use the non-subscriber fee when the user is not logged in', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });
      (adminConfigService.getAdminConfig as jest.Mock).mockResolvedValue({
        transaction_fee_subscriber_cents: 99,
        transaction_fee_non_subscriber_cents: 2000,
      });
      // No signed-in user -> isSubscriber stays false, non-subscriber fee applies.
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await calculateSP(20, 'cat-1', 'buy', 10);

      expect(result).toMatchObject({
        mode: 'buy',
        fee: 20, // $20.00 non-subscriber flat fee
      });
      expect(subscriptionService.getSubscriptionSummary).not.toHaveBeenCalled();
    });

    it('should use the subscriber fee for a Kids Club+ member', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });
      (adminConfigService.getAdminConfig as jest.Mock).mockResolvedValue({
        transaction_fee_subscriber_cents: 99,
        transaction_fee_non_subscriber_cents: 2000,
      });
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'subscriber-user' } },
        error: null,
      });
      (subscriptionService.getSubscriptionSummary as jest.Mock).mockResolvedValue({
        status: 'active',
        is_subscriber: true,
      });

      const result = await calculateSP(20, 'cat-1', 'buy', 10);

      expect(result).toMatchObject({
        mode: 'buy',
        fee: 0.99, // $0.99 subscriber flat fee, NOT the $20.00 non-subscriber figure
      });
      expect(subscriptionService.getSubscriptionSummary).toHaveBeenCalledWith('subscriber-user');
    });

    it('should use the non-subscriber fee for a free user', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });
      (adminConfigService.getAdminConfig as jest.Mock).mockResolvedValue({
        transaction_fee_subscriber_cents: 99,
        transaction_fee_non_subscriber_cents: 2000,
      });
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'free-user' } },
        error: null,
      });
      (subscriptionService.getSubscriptionSummary as jest.Mock).mockResolvedValue({
        status: 'free',
        is_subscriber: false,
      });

      const result = await calculateSP(20, 'cat-1', 'buy', 10);

      expect(result).toMatchObject({
        mode: 'buy',
        fee: 20, // $20.00 non-subscriber flat fee for free users
      });
    });

    it('should fall back to the non-subscriber fee when the tier lookup fails', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });
      (adminConfigService.getAdminConfig as jest.Mock).mockResolvedValue({
        transaction_fee_subscriber_cents: 99,
        transaction_fee_non_subscriber_cents: 2000,
      });
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      (subscriptionService.getSubscriptionSummary as jest.Mock).mockRejectedValue(
        new Error('subscription lookup failed')
      );

      const result = await calculateSP(20, 'cat-1', 'buy', 10);

      // The preview must still render — a tier-lookup failure must not nuke it.
      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        mode: 'buy',
        fee: 20,
      });
    });

    it('should return null for inactive category', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue({
        ...mockCategory,
        is_active: false,
      });

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result).toBeNull();
    });

    it('should return null for missing category', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(null);

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result).toBeNull();
    });

    it('should handle baseline multiplier (1.10) as not bonus', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue({
        ...mockCategory,
        sp_earning_multiplier: 1.1,
      });
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 22,
        max_spend_sp: 14,
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result?.is_bonus).toBe(false); // 1.1 is NOT > 1.1
    });
  });

  describe('getBonusCategories', () => {
    it('should delegate to MODULE-12 V3 getBonusCategories', async () => {
      const mockBonusCategories = [
        {
          id: 'cat-1',
          name: 'LEGO',
          icon: '🧱',
          is_active: true,
          sp_earning_multiplier: 1.3,
          sp_spending_cap_percent: 70,
        },
        {
          id: 'cat-2',
          name: 'Books',
          icon: '📚',
          is_active: true,
          sp_earning_multiplier: 1.2,
          sp_spending_cap_percent: 70,
        },
      ];

      (categoryService.getBonusCategories as jest.Mock).mockResolvedValue(mockBonusCategories);

      const result = await getBonusCategories();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].sp_earning_multiplier).toBe(1.3);
      expect(categoryService.getBonusCategories).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      (categoryService.getBonusCategories as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await getBonusCategories();

      expect(result).toEqual([]);
    });
  });
});
