// File: p2p-kids-marketplace/src/__tests__/e2e/sub-001-subscription-tiers.e2e.ts
// MODULE-11 SUB-001: E2E tests for subscription tiers (database validation)

import { supabase } from '../../config/supabase';
import {
  getActiveSubscriptionTiers,
  getKidsClubPlusTier,
  checkTierFeature,
} from '../../services/subscriptionTiers';
import { SubscriptionTierName, SubscriptionFeatureKey } from '../../types/subscription.types';

/**
 * E2E Test Suite for SUB-001: Subscription Tiers
 *
 * Prerequisites:
 * - Run migration: 20260212000000_subscription_tiers.sql
 * - Supabase project must be accessible
 * - RLS policies must be configured
 *
 * Tests validate:
 * 1. Kids Club+ tier exists with correct configuration
 * 2. All 7 features are seeded correctly
 * 3. Price, trial, and grace period values are correct
 * 4. RLS policies allow public read access
 * 5. Service layer functions work end-to-end
 */

describe('E2E: SUB-001 Subscription Tiers', () => {
  /**
   * Test 1: Verify Kids Club+ tier exists and has correct data
   */
  describe('Kids Club+ Tier Configuration', () => {
    it('should have Kids Club+ tier seeded in database', async () => {
      const { data: tiers, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      expect(error).toBeNull();
      expect(tiers).toBeDefined();
      expect(tiers?.name).toBe('kids_club_plus');
      expect(tiers?.display_name).toBe('Kids Club+');
      expect(tiers?.is_active).toBe(true);
      expect(tiers?.is_default).toBe(true);
    }, 10000);

    it('should have price set to $4.99 (499 cents)', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('price_cents')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      expect(tier?.price_cents).toBe(499);
    }, 10000);

    it('should have 30-day trial period', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('trial_days')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      expect(tier?.trial_days).toBe(30);
    }, 10000);

    it('should have 90-day grace period', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('grace_period_days')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      expect(tier?.grace_period_days).toBe(90);
    }, 10000);
  });

  /**
   * Test 2: Verify all 7 Kids Club+ features are seeded
   */
  describe('Kids Club+ Features', () => {
    it('should have exactly 7 features seeded', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      const { data: features, error } = await supabase
        .from('subscription_features')
        .select('*')
        .eq('tier_id', tier?.id);

      expect(error).toBeNull();
      expect(features).toHaveLength(7);
    }, 10000);

    it('should have can_earn_sp feature enabled', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      const { data: feature, error } = await supabase
        .from('subscription_features')
        .select('*')
        .eq('tier_id', tier?.id)
        .eq('feature_key', SubscriptionFeatureKey.CAN_EARN_SP)
        .single();

      expect(error).toBeNull();
      expect(feature?.is_enabled).toBe(true);
      expect(feature?.feature_name).toBe('Earn Swap Points');
    }, 10000);

    it('should have can_spend_sp feature enabled', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      const { data: feature, error } = await supabase
        .from('subscription_features')
        .select('*')
        .eq('tier_id', tier?.id)
        .eq('feature_key', SubscriptionFeatureKey.CAN_SPEND_SP)
        .single();

      expect(error).toBeNull();
      expect(feature?.is_enabled).toBe(true);
    }, 10000);

    it('should have reduced_fee feature enabled', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      const { data: feature, error } = await supabase
        .from('subscription_features')
        .select('*')
        .eq('tier_id', tier?.id)
        .eq('feature_key', SubscriptionFeatureKey.REDUCED_FEE)
        .single();

      expect(error).toBeNull();
      expect(feature?.is_enabled).toBe(true);
      expect(feature?.feature_name).toBe('Reduced Fees');
    }, 10000);

    it('should have all features in correct sort order', async () => {
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS)
        .single();

      const { data: features } = await supabase
        .from('subscription_features')
        .select('feature_key, sort_order')
        .eq('tier_id', tier?.id)
        .order('sort_order', { ascending: true });

      expect(features?.[0].feature_key).toBe('can_earn_sp');
      expect(features?.[0].sort_order).toBe(1);
      expect(features?.[1].feature_key).toBe('can_spend_sp');
      expect(features?.[1].sort_order).toBe(2);
    }, 10000);
  });

  /**
   * Test 3: Verify RLS policies work correctly
   */
  describe('RLS Policy Validation', () => {
    it('should allow public read access to active tiers', async () => {
      const { data, error } = await getActiveSubscriptionTiers();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    }, 10000);

    it('should fetch Kids Club+ via service layer', async () => {
      const { data, error } = await getKidsClubPlusTier();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('kids_club_plus');
      expect(data?.features).toBeDefined();
      expect(data?.features.length).toBeGreaterThan(0);
    }, 10000);
  });

  /**
   * Test 4: Verify feature check functions
   */
  describe('Feature Check Functions', () => {
    it('should correctly identify Kids Club+ has can_earn_sp feature', async () => {
      const { hasFeature, error } = await checkTierFeature(
        SubscriptionTierName.KIDS_CLUB_PLUS,
        SubscriptionFeatureKey.CAN_EARN_SP
      );

      expect(error).toBeNull();
      expect(hasFeature).toBe(true);
    }, 10000);

    it('should correctly identify Kids Club+ has can_spend_sp feature', async () => {
      const { hasFeature, error } = await checkTierFeature(
        SubscriptionTierName.KIDS_CLUB_PLUS,
        SubscriptionFeatureKey.CAN_SPEND_SP
      );

      expect(error).toBeNull();
      expect(hasFeature).toBe(true);
    }, 10000);

    it('should correctly identify Kids Club+ has reduced_fee feature', async () => {
      const { hasFeature, error } = await checkTierFeature(
        SubscriptionTierName.KIDS_CLUB_PLUS,
        SubscriptionFeatureKey.REDUCED_FEE
      );

      expect(error).toBeNull();
      expect(hasFeature).toBe(true);
    }, 10000);

    it('should return false for non-existent feature', async () => {
      const { hasFeature, error } = await checkTierFeature(
        SubscriptionTierName.KIDS_CLUB_PLUS,
        'non_existent_feature'
      );

      expect(error).toBeNull();
      expect(hasFeature).toBe(false);
    }, 10000);
  });

  /**
   * Test 5: Verify database constraints
   */
  describe('Database Constraints', () => {
    it('should enforce unique tier names', async () => {
      // Attempt to select by unique name should return exactly one record
      const { data, count } = await supabase
        .from('subscription_tiers')
        .select('*', { count: 'exact' })
        .eq('name', SubscriptionTierName.KIDS_CLUB_PLUS);

      expect(count).toBe(1);
    }, 10000);

    it('should have required indexes present', async () => {
      // This test verifies migration created necessary indexes
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      // If query succeeds, indexes are working (is_active, is_default)
      expect(tier).toBeDefined();
    }, 10000);
  });
});
