/**
 * File: p2p-kids-marketplace/src/services/subscription.ts
 * MODULE-11 Subscription Service (Stub for MODULE-04 dependency)
 * 
 * TODO(MODULE-11): This is a temporary stub to unblock MODULE-04.
 * Full implementation will come from MODULE-11-SUBSCRIPTIONS-V2.md
 * 
 * For now, provides basic subscription checks for listing creation.
 */

import { supabase } from '../config/supabase';

/**
 * Subscription status enum
 * Maps to subscription lifecycle states
 */
export type SubscriptionStatus = 
  | 'free'           // No subscription (free user)
  | 'trial'          // Active trial period
  | 'active'         // Active paid subscription
  | 'grace'          // Canceled but still within grace period
  | 'canceled'       // Canceled and no longer in grace period
  | 'expired';       // Subscription expired

/**
 * Subscription summary returned by getSubscriptionSummary
 * Used to check feature access for SP-related features
 */
export interface SubscriptionSummary {
  status: SubscriptionStatus;
  is_subscriber: boolean;  // Whether user is currently subscribed (trial or active)
  can_earn_sp: boolean;   // Can earn Swap Points from sales
  can_spend_sp: boolean;  // Can spend Swap Points on purchases
  subscription_tier_id: string | null;
  subscription_expires_at: string | null;
}

/**
 * Get subscription summary for a user
 * 
 * TODO(MODULE-11): Replace with full subscription RPC when MODULE-11 is implemented.
 * Current implementation checks subscriptions table for active/trial status
 * 
 * @param userId - User ID to check subscription for
 * @returns SubscriptionSummary with feature flags
 */
export async function getSubscriptionSummary(userId: string): Promise<SubscriptionSummary> {
  try {
    // 1. Try to fetch from RPC first (consistent with AuthContext)
    const { data: subData, error: subError } = await supabase.rpc(
      'get_subscription_summary',
      { p_user_id: userId }
    );

    if (!subError && subData) {
      const summary = Array.isArray(subData) ? subData[0] : subData;

      if (!summary || typeof summary !== 'object') {
        console.warn(
          '[subscription] ⚠️ get_subscription_summary returned no data, falling back to free status'
        );
      } else if (!summary.status) {
        console.warn(
          '[subscription] ⚠️ get_subscription_summary missing status field, falling back to free status'
        );
      } else {
        const status = summary.status as SubscriptionStatus;
        const canSpend = Boolean(summary.can_spend_sp);
        const isActive = ['active', 'trial', 'grace'].includes(status);

        return {
          status,
          is_subscriber: isActive,
          can_earn_sp: canSpend,
          can_spend_sp: canSpend,
          subscription_tier_id: null,
          subscription_expires_at: summary.trial_end_date || summary.current_period_end || null,
        };
      }
    }

    // 2. Fallback to direct query if RPC fails or is missing
    console.warn('[subscription] ⚠️ Falling back to direct query for getSubscriptionSummary');
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('user_id,status,created_at,updated_at,trial_end_date,current_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[subscription] ❌ Error fetching user subscription:', error.message);
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    // Check if subscription array is empty or null
    if (!subscription || subscription.length === 0) {
      // No subscription found - free user
      console.log('[subscription] ℹ️ No subscription found for user', userId, '- treating as free user');
      return {
        status: 'free',
        is_subscriber: false,
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      };
    }

    const sub = subscription[0];
    
    // Guard against undefined sub (should not happen, but defensive)
    if (!sub || typeof sub !== 'object') {
      console.warn('[subscription] ⚠️ Invalid subscription record retrieved, treating as free user');
      return {
        status: 'free',
        is_subscriber: false,
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      };
    }

    // Guard against missing status field
    if (!sub.status) {
      console.warn('[subscription] ⚠️ Subscription record missing status field, treating as free user');
      return {
        status: 'free',
        is_subscriber: false,
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      };
    }

    // Check if user has an active or trial subscription (include grace)
    const isActive = ['active', 'trial', 'grace'].includes(sub.status);
    
    return {
      status: sub.status as SubscriptionStatus,
      is_subscriber: isActive,
      can_earn_sp: isActive,
      can_spend_sp: isActive,
      subscription_tier_id: null, 
      subscription_expires_at: sub.trial_end_date || sub.current_period_end || null,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ getSubscriptionSummary failed:', err.message);
    // Return free user status on error to avoid blocking the flow
    return {
      status: 'free',
      is_subscriber: false,
      can_earn_sp: false,
      can_spend_sp: false,
      subscription_tier_id: null,
      subscription_expires_at: null,
    };
  }
}

/**
 * Check if user can accept Swap Points on listings
 * Convenience wrapper for listing creation flow
 * 
 * @param userId - User ID to check
 * @returns true if user can enable accepts_swap_points on their listings
 */
export async function canAcceptSwapPoints(userId: string): Promise<boolean> {
  const summary = await getSubscriptionSummary(userId);
  return summary.can_spend_sp; // Only subscribers can accept SP payments
}

/**
 * Get user's subscription status string
 * Used for audit trail (seller_subscription_status_at_creation)
 * 
 * @param userId - User ID
 * @returns Subscription status string for audit
 */
export async function getSubscriptionStatusString(userId: string): Promise<string> {
  const summary = await getSubscriptionSummary(userId);
  return summary.status;
}
