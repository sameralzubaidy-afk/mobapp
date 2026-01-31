// File: p2p-kids-marketplace/src/services/referralCodeV2.ts
// MODULE-11-REFERRALS-V2 Implementation
// Enhanced referral system with V2 spec compliance

import { supabase } from './supabase/client';

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
        .from('referral_codes')
        .select('code')
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

      return data?.code || null;
    } catch (error) {
      console.error('Get referral code error:', error);
      return null;
    }
  }

  /**
   * Create referral code for user (if doesn't exist)
   */
  static async createReferralCode(userId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_referral_code', {
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Failed to create referral code: ${error.message}`);
    }

    return data.code;
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
        p_referee_id: refereeId,
        p_referral_code: referralCode.toLowerCase().trim(),
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
    // TODO: Update with your app's deep link scheme
    const baseUrl = 'kidsclub://signup';
    return `${baseUrl}?ref=${code}`;
  }

  /**
   * Get referral statistics for user
   */
  static async getReferralStats(userId: string): Promise<ReferralStats> {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', userId);

      if (error) {
        throw new Error(`Failed to get referral stats: ${error.message}`);
      }

      const total_referrals = data?.length || 0;
      const pending_referrals = data?.filter((r) => r.status === 'pending').length || 0;
      const completed_referrals = data?.filter((r) => r.status === 'completed').length || 0;
      const total_sp_earned = completed_referrals * 25; // 25 SP per completed referral (V2 spec)
      const trial_extensions_used = data?.filter((r) => r.trial_extension_applied).length || 0;

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
   * Get referral history for user
   */
  static async getReferralHistory(userId: string): Promise<Referral[]> {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get referral history: ${error.message}`);
      }

      return data || [];
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