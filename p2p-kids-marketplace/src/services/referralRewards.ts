// File: p2p-kids-marketplace/src/services/referralRewards.ts
// MODULE-11 REF-V2-002: SP Bonus Rewards Service
// Wraps the award_referral_sp RPC function (migration 094)

import { supabase } from '../config/supabase';

export interface ReferralRewardResult {
  success: boolean;
  error?: string;
  referrer_sp_awarded?: number;
  referee_sp_awarded?: number;
  referrer_batch_id?: string;
  referee_batch_id?: string;
}

export interface ReferralEligibility {
  is_referee: boolean;
  referrer_id: string | null;
  rewards_pending: boolean;
  referral_status: 'pending' | 'completed' | 'claimed' | 'expired' | null;
}

/**
 * ReferralRewardsService
 * 
 * PURPOSE: 
 * - Provides TypeScript interface to award_referral_sp RPC (existing in migration 094)
 * - The RPC is automatically called by trigger when referee completes first trade
 * - This service is for manual admin operations and checking eligibility
 * 
 * BUSINESS RULES (from MODULE-11 V2):
 * - Referrer earns 25 SP (configurable via sp_config)
 * - Referee earns 10 SP (configurable via sp_config)
 * - BOTH users MUST have trial/active subscription
 * - Rewards granted ONLY on referee's FIRST completed trade
 * - Idempotent (no duplicate rewards)
 * - Referral status changes from 'pending' → 'completed'
 * 
 * DATABASE DEPENDENCIES:
 * - award_referral_sp() RPC (migration 094)
 * - process_referral_bonus_on_trade_v2() trigger (migration 20260201000000)
 * - sp_config table (referral_reward_referrer_sp, referral_reward_referee_sp)
 * - referrals table
 * - sp_wallets, sp_ledger, sp_batches tables
 */
export class ReferralRewardsService {
  /**
   * Manually grant referral rewards (admin function)
   * 
   * NOTE: This is typically called automatically by the trigger.
   * Use this only for manual admin operations or testing.
   * 
   * @param referrerId - User ID of the referrer
   * @param refereeId - User ID of the referee (the one completing first trade)
   * @param referralId - Referral record ID for idempotency
   * @returns Result object with success status and SP amounts
   */
  static async grantRewards(
    referrerId: string,
    refereeId: string,
    referralId: string
  ): Promise<ReferralRewardResult> {
    try {
      const { data, error } = await supabase.rpc('award_referral_sp', {
        p_referrer_id: referrerId,
        p_referee_id: refereeId,
        p_referral_id: referralId,
      });

      if (error) {
        console.error('[ReferralRewards] RPC error:', error);
        return { success: false, error: error.message };
      }

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid RPC response' };
      }

      const result = data as Record<string, unknown>;

      if (!result.success) {
        return {
          success: false,
          error: (result.error as string) || 'Unknown error',
        };
      }

      return {
        success: true,
        referrer_sp_awarded: (result.referrer_sp_awarded as number) || 0,
        referee_sp_awarded: (result.referee_sp_awarded as number) || 0,
        referrer_batch_id: result.referrer_batch_id as string,
        referee_batch_id: result.referee_batch_id as string,
      };
    } catch (err) {
      console.error('[ReferralRewards] Grant rewards error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if user is eligible for referral rewards
   * 
   * @param userId - User ID to check (referee)
   * @returns Eligibility status with referrer info
   */
  static async checkEligibility(userId: string): Promise<ReferralEligibility> {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('referrer_user_id, status')
        .eq('referred_user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[ReferralRewards] Check eligibility error:', error);
        return {
          is_referee: false,
          referrer_id: null,
          rewards_pending: false,
          referral_status: null,
        };
      }

      if (!data) {
        return {
          is_referee: false,
          referrer_id: null,
          rewards_pending: false,
          referral_status: null,
        };
      }

      return {
        is_referee: true,
        referrer_id: data.referrer_user_id,
        rewards_pending: data.status === 'pending',
        referral_status: data.status as 'pending' | 'completed' | 'claimed' | 'expired',
      };
    } catch (err) {
      console.error('[ReferralRewards] Check eligibility error:', err);
      return {
        is_referee: false,
        referrer_id: null,
        rewards_pending: false,
        referral_status: null,
      };
    }
  }

  /**
   * Check if this is the user's first completed trade
   * 
   * @param userId - User ID to check
   * @returns True if this is their first completed trade
   */
  static async isFirstCompletedTrade(userId: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'completed');

      if (error) {
        console.error('[ReferralRewards] Check first trade error:', error);
        return false;
      }

      return count === 1; // Exactly 1 completed trade = first trade
    } catch (err) {
      console.error('[ReferralRewards] Check first trade error:', err);
      return false;
    }
  }

  /**
   * Get configured SP reward amounts from admin config
   * 
   * @returns Object with referrer and referee SP amounts
   */
  static async getConfiguredRewardAmounts(): Promise<{
    referrer_sp: number;
    referee_sp: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('sp_config')
        .select('config_key, config_value')
        .in('config_key', ['referral_reward_referrer_sp', 'referral_reward_referee_sp']);

      if (error || !data) {
        // Return defaults if config not found
        return { referrer_sp: 25, referee_sp: 10 };
      }

      const referrerConfig = data.find(c => c.config_key === 'referral_reward_referrer_sp');
      const refereeConfig = data.find(c => c.config_key === 'referral_reward_referee_sp');

      return {
        referrer_sp: referrerConfig ? parseInt(referrerConfig.config_value) : 25,
        referee_sp: refereeConfig ? parseInt(refereeConfig.config_value) : 10,
      };
    } catch (err) {
      console.error('[ReferralRewards] Get config error:', err);
      return { referrer_sp: 25, referee_sp: 10 };
    }
  }

  /**
   * Verify both users have active/trial subscription
   * 
   * @param referrerId - Referrer user ID
   * @param refereeId - Referee user ID
   * @returns True if both have active/trial subscription
   */
  static async verifyBothUsersSubscribed(
    referrerId: string,
    refereeId: string
  ): Promise<{ both_subscribed: boolean; referrer_status: string | null; referee_status: string | null }> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id, status, trial_end_date, current_period_end')
        .in('user_id', [referrerId, refereeId])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ReferralRewards] Verify subscription error:', error);
        return { both_subscribed: false, referrer_status: null, referee_status: null };
      }

      const referrerSub = data?.find(s => s.user_id === referrerId);
      const refereeSub = data?.find(s => s.user_id === refereeId);

      const isActive = (sub: typeof referrerSub) => {
        if (!sub) return false;
        return ['active', 'trial', 'trialing', 'grace'].includes(sub.status);
      };

      return {
        both_subscribed: isActive(referrerSub) && isActive(refereeSub),
        referrer_status: referrerSub?.status || null,
        referee_status: refereeSub?.status || null,
      };
    } catch (err) {
      console.error('[ReferralRewards] Verify subscription error:', err);
      return { both_subscribed: false, referrer_status: null, referee_status: null };
    }
  }
}
