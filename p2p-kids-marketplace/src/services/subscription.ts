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
  | 'none'           // No subscription (free user)
  | 'trial'          // Active trial period
  | 'active'         // Active paid subscription
  | 'grace_period'   // Canceled but still within grace period
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
    
    // Fetch user's subscription from subscriptions table with fresh query (no caching)
    // Only query columns that actually exist
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
      return {
        status: 'none',
        is_subscriber: false,
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      };
    }

    const sub = subscription[0];

    // Check if user has an active or trial subscription
    if (sub && sub.status && (sub.status === 'active' || sub.status === 'trial')) {
      return {
        status: sub.status as SubscriptionStatus,
        is_subscriber: true,
        can_earn_sp: true,
        can_spend_sp: true,
        subscription_tier_id: null, // No tier_id column in schema yet
        subscription_expires_at: sub.trial_end_date || sub.current_period_end || null,
      };
    } else {
      // Free user or no subscription: no SP access
      return {
        status: 'none',
        is_subscriber: false,
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ getSubscriptionSummary failed:', err.message);
    // Return free user status on error to avoid blocking the flow
    return {
      status: 'none',
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
