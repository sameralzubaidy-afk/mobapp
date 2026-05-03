/**
 * File: p2p-kids-marketplace/src/services/subscriptions/trialConversion.ts
 * MODULE-11 TASK SUB-005: Trial Conversion & Downgrade Rules
 *
 * Service for monitoring trial status and handling trial expiration
 */

import { supabase } from '../../config/supabase';

export interface TrialStatus {
  status: 'trial' | 'active' | 'grace_period' | 'free' | string;
  trial_ends_at: string | null;
  days_remaining: number | null;
  has_payment_method: boolean;
  can_convert: boolean;
}

/**
 * Get trial status for current user
 * Returns trial status and days remaining
 */
export async function getTrialStatus(): Promise<TrialStatus | null> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[trialConversion] Auth error:', authError);
      return null;
    }

    // Get subscription with trial info
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, trial_end_date, stripe_payment_method_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[trialConversion] Error fetching subscription:', error);
      return null;
    }

    // User doesn't have a subscription - return null (not an error)
    if (!subscription) {
      return null;
    }

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      const now = new Date();
      const diffMs = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      status: subscription.status,
      trial_ends_at: subscription.trial_end_date,
      days_remaining: daysRemaining,
      has_payment_method: !!subscription.stripe_payment_method_id,
      can_convert: subscription.status === 'trial' && !!subscription.stripe_payment_method_id,
    };
  } catch (error) {
    console.error('[trialConversion] Unexpected error:', error);
    return null;
  }
}

/**
 * Check if user's trial has expired
 * Returns true if trial status and trial_ends_at < now
 */
export async function hasTrialExpired(): Promise<boolean> {
  try {
    const trialStatus = await getTrialStatus();

    if (!trialStatus) {
      return false;
    }

    if (trialStatus.status !== 'trial') {
      return false;
    }

    if (!trialStatus.trial_ends_at) {
      return false;
    }

    const trialEnd = new Date(trialStatus.trial_ends_at);
    const now = new Date();

    return trialEnd < now;
  } catch (error) {
    console.error('[trialConversion] Error checking trial expiration:', error);
    return false;
  }
}

/**
 * Manually trigger trial conversion (for testing)
 * This calls the Edge Function to process the current user's trial
 */
export async function triggerTrialConversion(): Promise<{
  success: boolean;
  error?: string;
  result?: any;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Call the trial-conversion Edge Function
    const { data, error } = await supabase.functions.invoke('trial-conversion', {
      body: { user_id: user.id },
    });

    if (error) {
      console.error('[trialConversion] Error invoking conversion:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      result: data,
    };
  } catch (error) {
    console.error('[trialConversion] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
