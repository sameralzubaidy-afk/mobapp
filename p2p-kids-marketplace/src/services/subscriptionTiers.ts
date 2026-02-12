// File: p2p-kids-marketplace/src/services/subscriptionTiers.ts
// MODULE-11 SUB-001: Service layer for subscription tier management

import { supabase } from '../config/supabase';
import {
  SubscriptionTier,
  SubscriptionFeature,
  SubscriptionTierWithFeatures,
  SubscriptionTierName,
  SubscriptionFeatureKey,
  TierDisplayInfo,
} from '../types/subscription.types';

/**
 * SUB-001: Fetch all active subscription tiers
 * Used for pricing/marketing displays
 */
export async function getActiveSubscriptionTiers(): Promise<{
  data: SubscriptionTier[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('getActiveSubscriptionTiers error:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as SubscriptionTier[], error: null };
  } catch (err) {
    console.error('getActiveSubscriptionTiers exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * SUB-001: Fetch a specific tier by name
 * @param tierName - Internal tier name (e.g., 'kids_club_plus')
 */
export async function getSubscriptionTierByName(
  tierName: string
): Promise<{
  data: SubscriptionTier | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('name', tierName)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('getSubscriptionTierByName error:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as SubscriptionTier, error: null };
  } catch (err) {
    console.error('getSubscriptionTierByName exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * SUB-001: Fetch a tier with all its features
 * @param tierId - UUID of the tier
 */
export async function getSubscriptionTierWithFeatures(
  tierId: string
): Promise<{
  data: SubscriptionTierWithFeatures | null;
  error: Error | null;
}> {
  try {
    // Fetch tier
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', tierId)
      .eq('is_active', true)
      .single();

    if (tierError) {
      console.error('getSubscriptionTierWithFeatures tier error:', tierError);
      return { data: null, error: new Error(tierError.message) };
    }

    // Fetch features
    const { data: features, error: featuresError } = await supabase
      .from('subscription_features')
      .select('*')
      .eq('tier_id', tierId)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (featuresError) {
      console.error('getSubscriptionTierWithFeatures features error:', featuresError);
      return { data: null, error: new Error(featuresError.message) };
    }

    const tierWithFeatures: SubscriptionTierWithFeatures = {
      ...(tier as SubscriptionTier),
      features: (features as SubscriptionFeature[]) || [],
    };

    return { data: tierWithFeatures, error: null };
  } catch (err) {
    console.error('getSubscriptionTierWithFeatures exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * SUB-001: Get Kids Club+ tier with features (convenience function)
 * Primary tier for MVP
 */
export async function getKidsClubPlusTier(): Promise<{
  data: SubscriptionTierWithFeatures | null;
  error: Error | null;
}> {
  try {
    const { data: tier, error: tierError } = await getSubscriptionTierByName(
      SubscriptionTierName.KIDS_CLUB_PLUS
    );

    if (tierError || !tier) {
      return { data: null, error: tierError || new Error('Kids Club+ tier not found') };
    }

    return await getSubscriptionTierWithFeatures(tier.id);
  } catch (err) {
    console.error('getKidsClubPlusTier exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * SUB-001: Check if a specific feature is enabled for a tier
 * @param tierName - Internal tier name
 * @param featureKey - Feature key to check
 */
export async function checkTierFeature(
  tierName: string,
  featureKey: string
): Promise<{
  hasFeature: boolean;
  error: Error | null;
}> {
  try {
    const { data: tier, error: tierError } = await getSubscriptionTierByName(tierName);

    if (tierError || !tier) {
      return { hasFeature: false, error: tierError || new Error('Tier not found') };
    }

    const { data: feature, error: featureError } = await supabase
      .from('subscription_features')
      .select('*')
      .eq('tier_id', tier.id)
      .eq('feature_key', featureKey)
      .eq('is_enabled', true)
      .maybeSingle();

    if (featureError) {
      console.error('checkTierFeature error:', featureError);
      return { hasFeature: false, error: new Error(featureError.message) };
    }

    return { hasFeature: !!feature, error: null };
  } catch (err) {
    console.error('checkTierFeature exception:', err);
    return { hasFeature: false, error: err as Error };
  }
}

/**
 * SUB-001: Format tier information for UI display
 * Converts database format to user-friendly display format
 */
export function formatTierForDisplay(tier: SubscriptionTierWithFeatures): TierDisplayInfo {
  const priceFormatted = `$${(tier.price_cents / 100).toFixed(2)}/month`;

  return {
    name: tier.name,
    displayName: tier.display_name,
    description: tier.description || '',
    priceFormatted,
    trialDays: tier.trial_days,
    features: tier.features.map((f) => ({
      key: f.feature_key,
      name: f.feature_name,
      description: f.feature_description || '',
    })),
  };
}

/**
 * SUB-001: Get the default tier (for new user assignments)
 * Returns the tier marked as is_default = true
 */
export async function getDefaultTier(): Promise<{
  data: SubscriptionTier | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('getDefaultTier error:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as SubscriptionTier, error: null };
  } catch (err) {
    console.error('getDefaultTier exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * SUB-001: Utility to check if a user has Kids Club+ benefits
 * Based on feature key checks
 */
export async function canUserEarnSwapPoints(tierName: string): Promise<boolean> {
  const { hasFeature } = await checkTierFeature(tierName, SubscriptionFeatureKey.CAN_EARN_SP);
  return hasFeature;
}

export async function canUserSpendSwapPoints(tierName: string): Promise<boolean> {
  const { hasFeature } = await checkTierFeature(tierName, SubscriptionFeatureKey.CAN_SPEND_SP);
  return hasFeature;
}

export async function canUserDonateItems(tierName: string): Promise<boolean> {
  const { hasFeature } = await checkTierFeature(tierName, SubscriptionFeatureKey.CAN_DONATE);
  return hasFeature;
}

export async function hasReducedFee(tierName: string): Promise<boolean> {
  const { hasFeature } = await checkTierFeature(tierName, SubscriptionFeatureKey.REDUCED_FEE);
  return hasFeature;
}
