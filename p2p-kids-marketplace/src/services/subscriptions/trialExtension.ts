/**
 * File: p2p-kids-marketplace/src/services/subscriptions/trialExtension.ts
 * MODULE-11 SUB-EXT-001: Trial Extension Service
 *
 * Allows users to extend their trial period by referring friends.
 * Each successful referral adds days to the trial (configurable via admin_config).
 */

import { supabase } from '../../config/supabase';

/**
 * Trial extension result interface
 */
export interface TrialExtensionResult {
  success: boolean;
  error?: string;
  new_trial_end?: string;
  extensions_used?: number;
  extensions_remaining?: number;
  days_added?: number;
}

/**
 * Extend a user's trial period by referring a friend
 *
 * Business Rules:
 * - User must have an active trial (status: 'trial', 'trialing', or 'trial_ending')
 * - Max 3 extensions per user (configurable in admin_config)
 * - Each extension adds 7 days (configurable in admin_config)
 * - Extensions stack (3 extensions = 21 days total)
 * - All extensions are logged to subscription_events for audit trail
 *
 * @param userId - The user who is earning the trial extension (referrer)
 * @param referralUserId - The user who was referred (completed onboarding)
 * @returns Promise<TrialExtensionResult>
 *
 * @example
 * ```typescript
 * const result = await extendTrial('user-123', 'referred-456');
 * if (result.success) {
 *   console.log(`Trial extended! New end date: ${result.new_trial_end}`);
 *   console.log(`Extensions used: ${result.extensions_used}/${result.extensions_used + result.extensions_remaining}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */
export async function extendTrial(
  userId: string,
  referralUserId: string
): Promise<TrialExtensionResult> {
  try {
    console.log(
      '[trialExtension] 📅 Extending trial for user:',
      userId,
      'via referral:',
      referralUserId
    );

    // Call RPC function
    const { data, error } = await supabase.rpc('extend_trial_period', {
      p_user_id: userId,
      p_referral_user_id: referralUserId,
    });

    if (error) {
      console.error('[trialExtension] ❌ RPC error:', error.message);
      return {
        success: false,
        error: `Failed to extend trial: ${error.message}`,
      };
    }

    // RPC returns JSONB, TypeScript sees it as 'unknown' or 'any'
    // Cast to our result type
    const result = data as TrialExtensionResult;

    if (!result.success) {
      console.warn('[trialExtension] ⚠️ Extension rejected:', result.error);
      return result;
    }

    console.log('[trialExtension] ✅ Trial extended successfully:', {
      new_trial_end: result.new_trial_end,
      extensions_used: result.extensions_used,
      extensions_remaining: result.extensions_remaining,
      days_added: result.days_added,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    console.error('[trialExtension] ❌ Unexpected error:', err.message);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
    };
  }
}

/**
 * Get trial extension stats for a user
 *
 * @param userId - User ID to check
 * @returns Promise with extensions_used and extensions_remaining
 */
export async function getTrialExtensionStats(userId: string): Promise<{
  extensions_used: number;
  extensions_remaining: number;
  max_extensions: number;
} | null> {
  try {
    // Get user's current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('referral_extensions_used')
      .eq('user_id', userId)
      .single();

    if (subError) {
      console.error('[trialExtension] ❌ Failed to fetch subscription:', subError.message);
      return null;
    }

    // Get max extensions from admin_config
    const { data: maxConfig, error: configError } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'max_referral_extensions')
      .single();

    if (configError) {
      console.error(
        '[trialExtension] ❌ Failed to fetch max extensions config:',
        configError.message
      );
      return null;
    }

    const maxExtensions = parseInt(maxConfig.value, 10);
    const used = subscription.referral_extensions_used || 0;

    return {
      extensions_used: used,
      extensions_remaining: Math.max(0, maxExtensions - used),
      max_extensions: maxExtensions,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[trialExtension] ❌ Error fetching trial extension stats:', err.message);
    return null;
  }
}

/**
 * Get trial extension history for a user
 * Useful for displaying extension timeline in profile/settings
 *
 * @param userId - User ID
 * @returns Array of trial extension events
 */
export async function getTrialExtensionHistory(userId: string): Promise<
  Array<{
    id: string;
    event_type: string;
    metadata: {
      referral_user_id?: string;
      days_added?: number;
      new_trial_end?: string;
      extensions_used?: number;
      extensions_remaining?: number;
    };
    created_at: string;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('subscription_events')
      .select('id, event_type, metadata, created_at')
      .eq('user_id', userId)
      .eq('event_type', 'trial_extended')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[trialExtension] ❌ Failed to fetch extension history:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    const err = error as Error;
    console.error('[trialExtension] ❌ Error fetching extension history:', err.message);
    return [];
  }
}
