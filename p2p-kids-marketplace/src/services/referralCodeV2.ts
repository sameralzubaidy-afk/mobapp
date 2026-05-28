// File: p2p-kids-marketplace/src/services/referralCodeV2.ts
// MODULE-11-REFERRALS-V2 Implementation
// Enhanced referral system with V2 spec compliance

import { supabase } from './supabase/client';
import { ReferralRewardsService } from './referralRewards';

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referred_user_name?: string; // New field for UI
  referral_code: string;
  status: 'pending' | 'completed' | 'expired';
  reward_granted_at: string | null;
  trial_extension_applied: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface ReferralStats {
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_sp_earned: number;
  trial_extensions_used: number;
}

export class ReferralCodeServiceV2 {
  /**
   * Get user's referral code
   */
  static async getReferralCode(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No code exists, create one
          return await this.createReferralCode(userId);
        }
        throw new Error(`Failed to get referral code: ${error.message}`);
      }

      return data?.referral_code || null;
    } catch (error) {
      console.error('Get referral code error:', error);
      return null;
    }
  }

  /**
   * Create referral code for user (if doesn't exist)
   */
  static async createReferralCode(userId: string): Promise<string> {
    try {
      // Fallback to table update first as it's more direct
      const code = Math.random().toString(36).substring(2, 10).toLowerCase();

      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('user_id', userId);

      if (!error) return code;

      // Fallback to RPC if update fails
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_referral_code', {
        p_user_id: userId,
      });

      if (rpcError) throw rpcError;
      return rpcData.code || rpcData;
    } catch (error) {
      const err = error as Error;
      console.error('Create referral code error:', err);
      throw new Error(`Failed to create referral code: ${err.message}`);
    }
  }

  /**
   * Check if a referral code exists (used for validation before signup)
   */
  static async checkCodeExists(code: string): Promise<boolean> {
    try {
      if (!code || code.trim().length === 0) return false;

      const { data, error } = await supabase.rpc('check_referral_code_exists', {
        p_code: code.trim().toLowerCase(),
      });

      if (error) {
        // Fallback to direct query if RPC missing
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('referral_code', code.trim().toLowerCase())
          .limit(1);

        if (profileError) return false;
        return profileData && profileData.length > 0;
      }

      return !!data;
    } catch (error) {
      console.error('Check referral code exists error:', error);
      return false;
    }
  }

  /**
   * Apply referral code for new user
   */
  static async applyReferralCode(
    refereeId: string,
    referralCode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('apply_referral_code', {
        p_user_id: refereeId,
        p_code: referralCode.toLowerCase().trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return data;
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }

  /**
   * Get shareable referral link (deep link format)
   */
  static getReferralLink(code: string): string {
    const baseUrl = 'kidsclub://signup';
    return `${baseUrl}?ref=${code}`;
  }

  /**
   * Get referral statistics for user
   */
  static async getReferralStats(userId: string): Promise<ReferralStats> {
    try {
      const [referralsResult, config] = await Promise.all([
        supabase.from('referrals').select('*').eq('referrer_user_id', userId),
        ReferralRewardsService.getConfiguredRewardAmounts(),
      ]);

      if (referralsResult.error) {
        throw new Error(`Failed to get referral stats: ${referralsResult.error.message}`);
      }

      const data = referralsResult.data;
      type ReferralRow = { status: string; trial_extension_applied: boolean | null };
      const total_referrals = data?.length || 0;
      const pending_referrals = data?.filter((r: ReferralRow) => r.status === 'pending').length || 0;
      const completed_referrals = data?.filter((r: ReferralRow) => r.status === 'completed').length || 0;

      const total_sp_earned = completed_referrals * config.referrer_sp;
      const trial_extensions_used = data?.filter((r: ReferralRow) => r.trial_extension_applied).length || 0;

      return {
        total_referrals,
        pending_referrals,
        completed_referrals,
        total_sp_earned,
        trial_extensions_used,
      };
    } catch (error) {
      console.error('Get referral stats error:', error);
      return {
        total_referrals: 0,
        pending_referrals: 0,
        completed_referrals: 0,
        total_sp_earned: 0,
        trial_extensions_used: 0,
      };
    }
  }

  /**
   * Get referral history for user with joined profile names
   */
  static async getReferralHistory(userId: string): Promise<Referral[]> {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select(
          `
          *,
          profiles:profiles!referrals_referred_profile_fkey (
            name
          )
        `
        )
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        const { data: rawData, error: rawError } = await supabase
          .from('referrals')
          .select('*')
          .eq('referrer_user_id', userId)
          .order('created_at', { ascending: false });

        if (rawError) throw rawError;
        return rawData || [];
      }

      return (data || []).map((referral: any) => ({
        ...referral,
        referred_user_name: referral.profiles?.name || null,
      }));
    } catch (error) {
      console.error('Get referral history error:', error);
      return [];
    }
  }

  /**
   * Check if user is eligible for referral rewards
   */
  static async checkEligibility(userId: string): Promise<{
    is_referee: boolean;
    referrer_id: string | null;
    rewards_pending: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('referrer_user_id, status')
        .eq('referred_user_id', userId)
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (error || !data) {
        return {
          is_referee: false,
          referrer_id: null,
          rewards_pending: false,
        };
      }

      return {
        is_referee: true,
        referrer_id: data.referrer_user_id,
        rewards_pending: true,
      };
    } catch (error) {
      console.error('Check referral eligibility error:', error);
      return {
        is_referee: false,
        referrer_id: null,
        rewards_pending: false,
      };
    }
  }
}

// Re-export for backward compatibility
export const getReferralStats = ReferralCodeServiceV2.getReferralStats;
export const processReferralCode = ReferralCodeServiceV2.applyReferralCode;
export const generateReferralCode = ReferralCodeServiceV2.createReferralCode;
