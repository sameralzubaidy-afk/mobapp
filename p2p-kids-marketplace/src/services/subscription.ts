/**
 * File: p2p-kids-marketplace/src/services/subscription.ts
 * MODULE-11 Subscription Service (TASK SUB-002 Implementation)
 * 
 * Enhanced subscription service with full MODULE-11 V2.1 support:
 * - Complete subscription status tracking
 * - Grace period management
 * - Payment retry logic
 * - Cancellation and pause support
 * - Tier linkage
 */

import { supabase } from '../config/supabase';

/**
 * Subscription status enum (V2.1)
 * Maps to complete subscription lifecycle states
 */
export type SubscriptionStatus = 
  | 'free'           // No subscription (free user)
  | 'trial'          // Active 30-day trial period
  | 'active'         // Active paid subscription (Kids Club+)
  | 'paused'         // Subscription paused (retention feature - keeps access)
  | 'cancelled'      // Canceled - still has access until period end
  | 'grace_period'   // Grace period - SP wallet frozen, 90-day countdown
  | 'grace'          // Legacy alias for grace_period
  | 'canceled'       // Legacy spelling
  | 'expired';       // Subscription expired - SP permanently deleted

/**
 * Enhanced subscription summary (V2.1)
 * Complete status information for feature gating and UI display
 */
export interface SubscriptionSummary {
  // Core status
  status: SubscriptionStatus;
  is_subscriber: boolean;  // Whether user has active subscription benefits (trial, active, paused)
  
  // Feature gates
  can_earn_sp: boolean;   // Can earn Swap Points from sales
  can_spend_sp: boolean;  // Can spend Swap Points on purchases
  transaction_fee_cents: number; // Transaction fee in cents (99 or 299)
  
  // Tier info
  subscription_tier_id: string | null;
  tier_name: string | null; // e.g., 'Kids Club+'
  
  // Dates
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  next_billing_date: string | null;
  cancelled_at: string | null;
  paused_until: string | null;
  
  // Flags
  has_used_trial: boolean;
  auto_renew_enabled: boolean;
  payment_retry_count: number;
  
  // Stripe IDs
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
}

/**
 * Complete subscription details from RPC
 */
export interface SubscriptionDetails {
  id: string;
  user_id: string;
  tier_id: string | null;
  status: SubscriptionStatus;
  has_used_trial: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  grace_started_at: string | null;
  grace_ends_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  paused_until: string | null;
  auto_renew_enabled: boolean;
  payment_retry_count: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
}

function normalizeSubscriptionStatus(rawStatus: unknown): SubscriptionStatus {
  if (rawStatus === 'canceled') return 'cancelled';
  if (rawStatus === 'grace') return 'grace_period';
  if (
    rawStatus === 'free' ||
    rawStatus === 'trial' ||
    rawStatus === 'active' ||
    rawStatus === 'paused' ||
    rawStatus === 'cancelled' ||
    rawStatus === 'grace_period' ||
    rawStatus === 'expired'
  ) {
    return rawStatus;
  }

  return 'free';
}

/**
 * Get complete subscription summary for a user (V2.1)
 * 
 * MODULE-11 TASK SUB-002 implementation using enhanced subscriptions table
 * Includes all status fields, grace period, cancellation, and billing info
 * 
 * @param userId - User ID to check subscription for
 * @returns SubscriptionSummary with all feature flags and status details
 */
export async function getSubscriptionSummary(userId: string): Promise<SubscriptionSummary> {
  try {
    // Call enhanced RPC function from TASK SUB-002
    const { data, error } = await supabase.rpc(
      'get_subscription_status',
      { p_user_id: userId }
    );

    if (error) {
      console.error('[subscription] ❌ Error calling get_subscription_status:', error.message);
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    // Handle no subscription found (free user)
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.log('[subscription] ℹ️ No subscription found for user', userId, '- treating as free user');
      return createFreeTierSummary();
    }

    // Extract subscription details
    const sub = Array.isArray(data) ? data[0] : data;
    
    if (!sub || typeof sub !== 'object' || !sub.status) {
      console.warn('[subscription] ⚠️ Invalid subscription data, treating as free user');
      return createFreeTierSummary();
    }

    // Determine subscriber status (active benefits)
    const status = normalizeSubscriptionStatus(sub.status);

    // Business rule: cancelled users remain active subscribers until period end,
    // then transition to grace_period/expired via backend lifecycle jobs.
    const isSubscriber = ['trial', 'active', 'paused', 'cancelled'].includes(status);
    
    // SP feature gates (trial, active, paused can use SP; grace_period cannot)
    const canEarnSpend = ['trial', 'active', 'paused', 'cancelled'].includes(status);
    
    // Transaction fee: Read dynamically from admin_config via RPC (V2.1 enhancement)
    // This allows admins to adjust fees without code changes
    let transactionFeeCents = 299; // Default fallback
    try {
      transactionFeeCents = await getTransactionFee(userId);
    } catch (err) {
      // If dynamic fee fetch fails, use fallback based on subscriber status
      console.warn('[subscription] ⚠️ Failed to fetch dynamic fee, using fallback:', err);
      transactionFeeCents = isSubscriber ? 99 : 299;
    }
    
    // Determine expiration date based on status
    let expiresAt = sub.trial_ends_at || sub.current_period_end || null;
    
    return {
      status,
      is_subscriber: isSubscriber,
      can_earn_sp: canEarnSpend,
      can_spend_sp: canEarnSpend,
      transaction_fee_cents: transactionFeeCents,
      subscription_tier_id: sub.tier_id || null,
      tier_name: isSubscriber ? 'Kids Club+' : 'Free',
      subscription_expires_at: expiresAt,
      trial_ends_at: sub.trial_ends_at || null,
      grace_ends_at: sub.grace_ends_at || null,
      next_billing_date: sub.next_billing_date || null,
      cancelled_at: sub.cancelled_at || null,
      paused_until: sub.paused_until || null,
      has_used_trial: Boolean(sub.has_used_trial),
      auto_renew_enabled: Boolean(sub.auto_renew_enabled),
      payment_retry_count: sub.payment_retry_count || 0,
      stripe_customer_id: sub.stripe_customer_id || null,
      stripe_subscription_id: sub.stripe_subscription_id || null,
      stripe_payment_method_id: sub.stripe_payment_method_id || null,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ getSubscriptionSummary failed:', err.message);
    // Return free tier on error to avoid blocking the flow
    return createFreeTierSummary();
  }
}

/**
 * Create default free tier summary
 * Used as fallback when no subscription exists or on error
 * Note: Transaction fee is dynamically fetched from admin_config via getTransactionFee()
 */
function createFreeTierSummary(): SubscriptionSummary {
  return {
    status: 'free',
    is_subscriber: false,
    can_earn_sp: false,
    can_spend_sp: false,
    transaction_fee_cents: 299, // Fallback: $2.99 for non-subscribers (overridden by dynamic fetch)
    subscription_tier_id: null,
    tier_name: 'Free',
    subscription_expires_at: null,
    trial_ends_at: null,
    grace_ends_at: null,
    next_billing_date: null,
    cancelled_at: null,
    paused_until: null,
    has_used_trial: false,
    auto_renew_enabled: true,
    payment_retry_count: 0,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_payment_method_id: null,
  };
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

/**
 * Check if user is eligible for free trial (V2.1)
 * One trial per user lifetime
 * 
 * @param userId - User ID to check
 * @returns true if user has not used their trial yet
 */
export async function isTrialEligible(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(
      'is_user_trial_eligible',
      { p_user_id: userId }
    );
    
    if (error) {
      console.error('[subscription] ❌ Error checking trial eligibility:', error.message);
      return false; // Default to not eligible on error
    }
    
    return Boolean(data);
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ isTrialEligible failed:', err.message);
    return false;
  }
}

/**
 * Get transaction fee for a user based on subscription status (V2.1)
 * $0.99 for Kids Club+ subscribers (trial, active, paused)
 * $2.99 for non-subscribers (free, grace_period, expired, cancelled)
 * 
 * @param userId - User ID
 * @returns Transaction fee in cents
 */
export async function getTransactionFee(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc(
      'get_user_transaction_fee',
      { p_user_id: userId }
    );
    
    if (error) {
      console.error('[subscription] ❌ Error getting transaction fee:', error.message);
      return 299; // Default to non-subscriber fee on error
    }
    
    return data || 299;
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ getTransactionFee failed:', err.message);
    return 299;
  }
}

/**
 * Check trial eligibility with reason (SUB-003 E2E)
 * Returns structured eligibility data for UI
 */
export async function checkTrialEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.rpc('is_user_trial_eligible', { p_user_id: userId });
    
    if (error) {
      console.error('[subscription] ❌ Error checking trial eligibility RPC:', error.message);
      return { eligible: false, reason: error.message };
    }
    
    if (data === true) {
      return { eligible: true };
    } else {
      return { 
        eligible: false, 
        reason: 'Trial already used or user not eligible for Kids Club+ trial' 
      };
    }
  } catch (error) {
    console.error('[subscription] ❌ checkTrialEligibility failed:', error);
    return { eligible: false, reason: (error as Error).message || 'Eligibility check failed' };
  }
}

/**
 * Enroll User in Kids Club+ Trial
 * Activates the trial subscription and initializes the SP wallet.
 */
export async function enrollInTrialSubscription(userId: string): Promise<{
  success: boolean;
  subscription: any;
  error?: { message: string; code?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('create_trial_subscription', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[enrollInTrialSubscription] ❌ RPC error:', error);
      return { 
        success: false, 
        subscription: null,
        error: { message: error.message, code: error.code } 
      };
    }

    return { 
      success: true, 
      subscription: data 
    };
  } catch (error) {
    console.error('[enrollInTrialSubscription] ❌ Unexpected error:', error);
    return { 
      success: false, 
      subscription: null,
      error: { message: (error as Error).message } 
    };
  }
}

/**
 * Get complete subscription details for a user (V2.1)
 * Returns full SubscriptionDetails object with all fields
 * 
 * @param userId - User ID
 * @returns SubscriptionDetails or null if not found
 */
export async function getSubscriptionDetails(userId: string): Promise<SubscriptionDetails | null> {
  try {
    const { data, error } = await supabase.rpc(
      'get_subscription_status',
      { p_user_id: userId }
    );

    if (error) {
      console.error('[subscription] ❌ Error getting subscription details:', error.message);
      return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    const sub = Array.isArray(data) ? data[0] : data;
    return sub as SubscriptionDetails;
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ getSubscriptionDetails failed:', err.message);
    return null;
  }
}

/**
 * Result of a subscription cancellation request
 * MODULE-11 TASK SUB-008
 */
export interface CancelSubscriptionResult {
  success: boolean;
  new_status?: 'cancelled' | 'grace_period' | 'free';
  message: string;
  current_period_end?: string;
  grace_period_ends_at?: string;
}

/**
 * Cancel the current user's Kids Club+ subscription
 * MODULE-11 TASK SUB-008: User-Initiated Cancellation Flow
 *
 * For 'active' users: Sets Stripe cancel_at_period_end, keeps benefits until period end
 * For 'trial' users with SP activity: Immediate move to grace_period
 * For 'trial' users without SP activity: Move to free
 *
 * @param cancelReason - Reason for cancellation (for analytics)
 * @returns CancelSubscriptionResult with new status and messaging
 */
export async function cancelSubscription(
  cancelReason?: string
): Promise<CancelSubscriptionResult> {
  try {
    console.log('[subscription] 📤 Requesting subscription cancellation...');

    // Get current session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[subscription] ❌ No active session for cancellation');
      return {
        success: false,
        message: 'You must be logged in to cancel your subscription',
      };
    }

    let accessToken = session.access_token;
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= nowEpoch + 60) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        console.error('[subscription] ❌ Session refresh failed before cancellation');
        return {
          success: false,
          message: 'Your session expired. Please log in again and retry.',
        };
      }
      accessToken = refreshData.session.access_token;
    }

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    // Call the cancel-subscription Edge Function
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { cancel_reason: cancelReason || 'User requested cancellation' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(anonKey ? { apikey: anonKey } : {}),
      },
    });

    if (error) {
      console.error('[subscription] ❌ Edge Function error:', error.message);

      let detailedMessage = error.message || 'Failed to cancel subscription. Please try again.';
      const errorContext = (error as any)?.context;
      if (errorContext && typeof errorContext.json === 'function') {
        try {
          const errorPayload = await errorContext.json();
          if (errorPayload?.details) {
            detailedMessage = `${errorPayload.error || 'Cancellation failed'}: ${errorPayload.details}`;
          } else if (errorPayload?.error) {
            detailedMessage = String(errorPayload.error);
          }
        } catch (parseError) {
          console.warn('[subscription] Could not parse edge error payload:', parseError);
        }
      }

      return {
        success: false,
        message: detailedMessage,
      };
    }

    if (!data) {
      console.error('[subscription] ❌ No data returned from Edge Function');
      return {
        success: false,
        message: 'Unexpected error during cancellation. Please try again.',
      };
    }

    // Parse response
    if (data.success) {
      console.log('[subscription] ✅ Cancellation successful:', data.new_status);
      return {
        success: true,
        new_status: data.new_status,
        message: data.message || 'Your subscription has been cancelled.',
        current_period_end: data.current_period_end,
        grace_period_ends_at: data.grace_period_ends_at,
      };
    } else {
      console.error('[subscription] ❌ Cancellation failed:', data.error);
      return {
        success: false,
        message: data.error || 'Failed to cancel subscription. Please try again.',
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ cancelSubscription error:', err.message);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * MODULE-11 TASK SUB-016: Renew Subscription from Grace Period
 * 
 * Allows users in grace_period or expired status to re-subscribe.
 * Uses saved payment method if available, otherwise requires payment_method_id.
 * Calls MODULE-09 SP unfreeze handler on success.
 * 
 * @param paymentMethodId - Optional new payment method ID (uses saved if omitted)
 * @returns ResubscribeResult with success status and details
 */
export interface ResubscribeResult {
  success: boolean;
  message: string;
  subscription_status?: SubscriptionStatus;
  next_billing_date?: string;
  error?: string;
}

export async function resubscribe(paymentMethodId?: string): Promise<ResubscribeResult> {
  try {
    console.log('[subscription] 📤 Requesting subscription renewal...');

    // Get current session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[subscription] ❌ No active session for renewal');
      return {
        success: false,
        message: 'You must be logged in to renew your subscription',
      };
    }

    let accessToken = session.access_token;
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= nowEpoch + 60) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        console.error('[subscription] ❌ Session refresh failed before renewal');
        return {
          success: false,
          message: 'Your session expired. Please log in again and retry.',
        };
      }
      accessToken = refreshData.session.access_token;
    }

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    // Call the renew-subscription Edge Function
    const { data, error } = await supabase.functions.invoke('renew-subscription', {
      body: paymentMethodId ? { payment_method_id: paymentMethodId } : {},
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(anonKey ? { apikey: anonKey } : {}),
      },
    });

    if (error) {
      console.error('[subscription] ❌ Renewal Edge Function error:', error.message);

      let detailedMessage = error.message || 'Failed to renew subscription. Please try again.';
      let errorCode: string | undefined;
      const errorContext = (error as any)?.context;
      if (errorContext && typeof errorContext.json === 'function') {
        try {
          const errorPayload = await errorContext.json();
          if (errorPayload?.error) {
            detailedMessage = String(errorPayload.error);
          }
          if (errorPayload?.code) {
            errorCode = String(errorPayload.code);
          }
        } catch (parseError) {
          console.warn('[subscription] Could not parse renewal edge error payload:', parseError);
        }
      }

      return {
        success: false,
        message: detailedMessage,
        error: errorCode || error.message,
      };
    }

    if (!data) {
      console.error('[subscription] ❌ No data returned from renewal Edge Function');
      return {
        success: false,
        message: 'Unexpected error during renewal. Please try again.',
      };
    }

    if (data.success) {
      console.log('[subscription] ✅ Renewal successful');
      return {
        success: true,
        message: data.message || 'Your subscription has been renewed!',
        subscription_status: data.subscription_status,
        next_billing_date: data.next_billing_date,
      };
    } else {
      console.error('[subscription] ❌ Renewal failed:', data.error);
      return {
        success: false,
        message: data.error || 'Failed to renew subscription. Please try again.',
        error: data.code,
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ resubscribe error:', err.message);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: err.message,
    };
  }
}

/**
 * MODULE-11 TASK SUB-017: Get Payment Method Details
 * 
 * Retrieves saved payment method information from Stripe.
 * Returns formatted card details (brand, last 4, expiry).
 * 
 * @returns PaymentMethodInfo or null if no payment method saved
 */
export interface PaymentMethodInfo {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export async function getPaymentMethod(): Promise<PaymentMethodInfo | null> {
  try {
    console.log('[subscription] 📤 Fetching payment method...');

    // Get current session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[subscription] ❌  No active session');
      return null;
    }

    let accessToken = session.access_token;
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= nowEpoch + 60) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        console.error('[subscription] ❌ Session refresh failed');
        return null;
      }
      accessToken = refreshData.session.access_token;
    }

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    // Call the get-payment-method Edge Function
    const { data, error } = await supabase.functions.invoke('get-payment-method', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(anonKey ? { apikey: anonKey } : {}),
      },
    });

    if (error) {
      console.error('[subscription] ❌ Get payment method error:', error.message);
      return null;
    }

    if (!data || !data.payment_method) {
      console.log('[subscription] ℹ️ No payment method found');
      return null;
    }

    console.log('[subscription] ✅ Payment method retrieved');
    return data.payment_method as PaymentMethodInfo;
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ getPaymentMethod error:', err.message);
    return null;
  }
}

/**
 * MODULE-11 TASK SUB-017: Update Auto-Renew Setting
 * 
 * Toggles auto-renewal for active subscriptions.
 * Updates both Stripe and database.
 * 
 * @param autoRenewEnabled - Whether auto-renew should be enabled
 * @returns AutoRenewResult with success status and message
 */
export interface AutoRenewResult {
  success: boolean;
  message: string;
  auto_renew_enabled?: boolean;
}

export async function updateAutoRenew(autoRenewEnabled: boolean): Promise<AutoRenewResult> {
  try {
    console.log('[subscription] 📤 Updating auto-renew to:', autoRenewEnabled);

    // Get current session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[subscription] ❌ No active session');
      return {
        success: false,
        message: 'You must be logged in to update auto-renew settings',
      };
    }

    let accessToken = session.access_token;
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= nowEpoch + 60) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        console.error('[subscription] ❌ Session refresh failed');
        return {
          success: false,
          message: 'Your session expired. Please log in again and retry.',
        };
      }
      accessToken = refreshData.session.access_token;
    }

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    // Call the update-auto-renew Edge Function
    const { data, error } = await supabase.functions.invoke('update-auto-renew', {
      body: { auto_renew_enabled: autoRenewEnabled },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(anonKey ? { apikey: anonKey } : {}),
      },
    });

    if (error) {
      console.error('[subscription] ❌ Update auto-renew error:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to update auto-renew. Please try again.',
      };
    }

    if (!data) {
      console.error('[subscription] ❌ No data returned');
      return {
        success: false,
        message: 'Unexpected error updating auto-renew. Please try again.',
      };
    }

    if (data.success) {
      console.log('[subscription] ✅ Auto-renew updated successfully');
      return {
        success: true,
        message: data.message,
        auto_renew_enabled: data.auto_renew_enabled,
      };
    } else {
      console.error('[subscription] ❌ Auto-renew update failed:', data.error);
      return {
        success: false,
        message: data.error || 'Failed to update auto-renew. Please try again.',
      };
    }
  } catch (error) {
    const err = error as Error;
    console.error('[subscription] ❌ updateAutoRenew error:', err.message);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}
