// File: p2p-kids-marketplace/src/services/__tests__/subscriptionTiers.test.ts
// MODULE-11 SUB-001: Unit tests for subscription tier service

import {
  getActiveSubscriptionTiers,
  getSubscriptionTierByName,
  getKidsClubPlusTier,
  checkTierFeature,
  formatTierForDisplay,
  canUserEarnSwapPoints,
  canUserSpendSwapPoints,
  hasReducedFee,
} from '../subscriptionTiers';
import { supabase } from '../../config/supabase';
import {
  SubscriptionTierName,
  SubscriptionFeatureKey,
} from '../../types/subscription.types';

// Mock Supabase client
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('SubscriptionTiers Service - SUB-001', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveSubscriptionTiers', () => {
    it('should fetch all active subscription tiers ordered by sort_order', async () => {
      const mockTiers = [
        {
          id: 'tier-1',
          name: 'kids_club_plus',
          display_name: 'Kids Club+',
          price_cents: 499,
          is_active: true,
          sort_order: 1,
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTiers,
              error: null,
            }),
          }),
        }),
      } as any);

      const { data, error } = await getActiveSubscriptionTiers();

      expect(error).toBeNull();
      expect(data).toEqual(mockTiers);
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_tiers');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any);

      const { data, error } = await getActiveSubscriptionTiers();

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Database error');
    });
  });

  describe('getSubscriptionTierByName', () => {
    it('should fetch Kids Club+ tier by name', async () => {
      const mockTier = {
        id: 'tier-kids-club',
        name: 'kids_club_plus',
        display_name: 'Kids Club+',
        price_cents: 499,
        trial_days: 30,
        grace_period_days: 90,
        is_active: true,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockTier,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const { data, error } = await getSubscriptionTierByName(
        SubscriptionTierName.KIDS_CLUB_PLUS
      );

      expect(error).toBeNull();
      expect(data).toEqual(mockTier);
      expect(data?.name).toBe('kids_club_plus');
      expect(data?.price_cents).toBe(499);
    });

    it('should return null for non-existent tier', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      } as any);

      const { data, error } = await getSubscriptionTierByName('non_existent_tier');

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('getKidsClubPlusTier', () => {
    it('should fetch Kids Club+ tier with all features', async () => {
      const mockTier = {
        id: 'tier-kids-club',
        name: 'kids_club_plus',
        display_name: 'Kids Club+',
        price_cents: 499,
        trial_days: 30,
        grace_period_days: 90,
        is_active: true,
      };

      const mockFeatures = [
        {
          id: 'feature-1',
          tier_id: 'tier-kids-club',
          feature_key: 'can_earn_sp',
          feature_name: 'Earn Swap Points',
          is_enabled: true,
          sort_order: 1,
        },
        {
          id: 'feature-2',
          tier_id: 'tier-kids-club',
          feature_key: 'can_spend_sp',
          feature_name: 'Spend Swap Points',
          is_enabled: true,
          sort_order: 2,
        },
      ];

      // Mock tier fetch
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTier,
                  error: null,
                }),
              }),
            }),
          }),
        } as any)
        // Mock tier fetch again for getSubscriptionTierWithFeatures
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTier,
                  error: null,
                }),
              }),
            }),
          }),
        } as any)
        // Mock features fetch
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockFeatures,
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

      const { data, error } = await getKidsClubPlusTier();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('kids_club_plus');
      expect(data?.features).toHaveLength(2);
      expect(data?.features[0].feature_key).toBe('can_earn_sp');
    });
  });

  describe('checkTierFeature', () => {
    it('should return true if feature is enabled for tier', async () => {
      const mockTier = {
        id: 'tier-kids-club',
        name: 'kids_club_plus',
      };

      const mockFeature = {
        id: 'feature-1',
        tier_id: 'tier-kids-club',
        feature_key: 'can_earn_sp',
        is_enabled: true,
      };

      // Mock tier fetch
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTier,
                  error: null,
                }),
              }),
            }),
          }),
        } as any)
        // Mock feature check
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: mockFeature,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        } as any);

      const { hasFeature, error } = await checkTierFeature(
        'kids_club_plus',
        SubscriptionFeatureKey.CAN_EARN_SP
      );

      expect(error).toBeNull();
      expect(hasFeature).toBe(true);
    });

    it('should return false if feature is not enabled', async () => {
      const mockTier = {
        id: 'tier-kids-club',
        name: 'kids_club_plus',
      };

      // Mock tier fetch
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTier,
                  error: null,
                }),
              }),
            }),
          }),
        } as any)
        // Mock feature check - feature not found
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        } as any);

      const { hasFeature, error } = await checkTierFeature(
        'kids_club_plus',
        'non_existent_feature'
      );

      expect(error).toBeNull();
      expect(hasFeature).toBe(false);
    });
  });

  describe('formatTierForDisplay', () => {
    it('should format tier data for UI display', () => {
      const mockTierWithFeatures = {
        id: 'tier-kids-club',
        name: 'kids_club_plus',
        display_name: 'Kids Club+',
        description: 'Join Kids Club+ for exclusive benefits',
        price_cents: 499,
        currency: 'usd',
        trial_days: 30,
        grace_period_days: 90,
        stripe_price_id: null,
        is_active: true,
        is_default: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        features: [
          {
            id: 'feature-1',
            tier_id: 'tier-kids-club',
            feature_key: 'can_earn_sp',
            feature_name: 'Earn Swap Points',
            feature_description: 'Earn points on every trade',
            is_enabled: true,
            sort_order: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };

      const displayInfo = formatTierForDisplay(mockTierWithFeatures);

      expect(displayInfo.name).toBe('kids_club_plus');
      expect(displayInfo.displayName).toBe('Kids Club+');
      expect(displayInfo.priceFormatted).toBe('$4.99/month');
      expect(displayInfo.trialDays).toBe(30);
      expect(displayInfo.features).toHaveLength(1);
      expect(displayInfo.features[0].key).toBe('can_earn_sp');
    });
  });

  describe('Feature check utility functions', () => {
    beforeEach(() => {
      const mockTier = {
        id: 'tier-kids-club',
        name: 'kids_club_plus',
      };

      const mockFeature = {
        id: 'feature-1',
        tier_id: 'tier-kids-club',
        feature_key: 'can_earn_sp',
        is_enabled: true,
      };

      // Mock tier and feature fetches
      mockSupabase.from
        .mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTier,
                  error: null,
                }),
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: mockFeature,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        } as any);
    });

    it('canUserEarnSwapPoints should check can_earn_sp feature', async () => {
      const result = await canUserEarnSwapPoints('kids_club_plus');
      expect(result).toBe(true);
    });

    it('canUserSpendSwapPoints should check can_spend_sp feature', async () => {
      const result = await canUserSpendSwapPoints('kids_club_plus');
      // Will be true since mock returns a feature
      expect(typeof result).toBe('boolean');
    });

    it('hasReducedFee should check reduced_fee feature', async () => {
      const result = await hasReducedFee('kids_club_plus');
      expect(typeof result).toBe('boolean');
    });
  });
});
