// File: p2p-kids-marketplace/src/services/sp/earning.ts
// MODULE-09 SP-002: SP Earning Service
// Handles starter pack, referral rewards, challenge rewards, and refunds

import { supabase } from '@/config/supabase';

export interface EarnResult {
  success: boolean;
  sp_awarded?: number;
  error?: string;
  batch_id?: string;
  ledger_entry_id?: string;
  expires_at?: string;
}

/**
 * Issue Starter Pack to new subscriber after first listing approval
 * One-time award per user, requires Kids Club+ subscription
 */
export async function issueStarterPack(
  userId: string,
  listingId: string
): Promise<EarnResult> {
  try {
    const { data, error } = await supabase.rpc('issue_starter_pack', {
      p_user_id: userId,
      p_listing_id: listingId,
    });

    if (error) {
      console.error('Issue starter pack error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // RPC returns JSONB, parse it
    const result = data as {
      success: boolean;
      sp_awarded?: number;
      error?: string;
      batch_id?: string;
      ledger_entry_id?: string;
      expires_at?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to issue starter pack',
      };
    }

    return {
      success: true,
      sp_awarded: result.sp_awarded,
      batch_id: result.batch_id,
      ledger_entry_id: result.ledger_entry_id,
      expires_at: result.expires_at,
    };
  } catch (error) {
    console.error('Issue starter pack exception:', error);
    return {
      success: false,
      error: (error as Error).message || 'Unknown error',
    };
  }
}

/**
 * Award referral rewards (SP) to both referrer and referee
 * Requires both users to have Kids Club+ subscription
 * Can also award cash bonuses if configured
 */
export async function awardReferralReward(
  referrerId: string,
  refereeId: string,
  referralId: string
): Promise<EarnResult> {
  try {
    const { data, error } = await supabase.rpc('award_referral_sp', {
      p_referrer_id: referrerId,
      p_referee_id: refereeId,
      p_referral_id: referralId,
    });

    if (error) {
      console.error('Award referral reward error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const result = data as {
      success: boolean;
      referrer_sp_awarded?: number;
      referee_sp_awarded?: number;
      error?: string;
      referrer_batch_id?: string;
      referee_batch_id?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to award referral reward',
      };
    }

    return {
      success: true,
      sp_awarded: (result.referrer_sp_awarded || 0) + (result.referee_sp_awarded || 0),
      batch_id: result.referrer_batch_id || result.referee_batch_id,
    };
  } catch (error) {
    console.error('Award referral reward exception:', error);
    return {
      success: false,
      error: (error as Error).message || 'Unknown error',
    };
  }
}

/**
 * Award SP for challenge completion
 * Requires Kids Club+ subscription
 * Idempotent: prevents duplicate rewards for same challenge
 */
export async function awardChallengeReward(
  userId: string,
  challengeId: string,
  spAmount: number
): Promise<EarnResult> {
  try {
    if (spAmount <= 0) {
      return {
        success: false,
        error: 'Invalid SP amount',
      };
    }

    const { data, error } = await supabase.rpc('award_challenge_sp', {
      p_user_id: userId,
      p_challenge_id: challengeId,
      p_sp_amount: spAmount,
    });

    if (error) {
      console.error('Award challenge reward error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const result = data as {
      success: boolean;
      sp_awarded?: number;
      error?: string;
      batch_id?: string;
      ledger_entry_id?: string;
      expires_at?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to award challenge reward',
      };
    }

    return {
      success: true,
      sp_awarded: result.sp_awarded,
      batch_id: result.batch_id,
      ledger_entry_id: result.ledger_entry_id,
      expires_at: result.expires_at,
    };
  } catch (error) {
    console.error('Award challenge reward exception:', error);
    return {
      success: false,
      error: (error as Error).message || 'Unknown error',
    };
  }
}

/**
 * Refund SP for cancelled trade
 * Creates new SP batch with fresh expiration date
 * Idempotent: prevents duplicate refunds for same trade
 */
export async function refundSpForCancelledTrade(
  userId: string,
  tradeId: string,
  spAmount: number
): Promise<EarnResult> {
  try {
    if (spAmount <= 0) {
      return {
        success: false,
        error: 'Invalid SP amount',
      };
    }

    const { data, error } = await supabase.rpc('refund_sp_for_cancelled_trade', {
      p_user_id: userId,
      p_trade_id: tradeId,
      p_sp_amount: spAmount,
    });

    if (error) {
      console.error('Refund SP error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const result = data as {
      success: boolean;
      sp_refunded?: number;
      error?: string;
      batch_id?: string;
      ledger_entry_id?: string;
      expires_at?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to refund SP',
      };
    }

    return {
      success: true,
      sp_awarded: result.sp_refunded,
      batch_id: result.batch_id,
      ledger_entry_id: result.ledger_entry_id,
      expires_at: result.expires_at,
    };
  } catch (error) {
    console.error('Refund SP exception:', error);
    return {
      success: false,
      error: (error as Error).message || 'Unknown error',
    };
  }
}

/**
 * Check if user has already received starter pack
 * Used to prevent UI from showing "claim starter pack" button incorrectly
 */
export async function hasReceivedStarterPack(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sp_wallets')
      .select('starter_pack_issued')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Check starter pack error:', error);
      return false;
    }

    return data?.starter_pack_issued || false;
  } catch (error) {
    console.error('Check starter pack exception:', error);
    return false;
  }
}

/**
 * Get fraud prevention limits from config
 */
export async function getFraudLimits(): Promise<{
  maxReferralsPerDay: number;
  maxChallengeSpPerDay: number;
}> {
  try {
    const { data, error } = await supabase
      .from('sp_config')
      .select('config_key, config_value')
      .in('config_key', ['max_referral_rewards_per_day', 'challenge_max_sp_per_day']);

    if (error) {
      console.error('Get fraud limits error:', error);
      return { maxReferralsPerDay: 10, maxChallengeSpPerDay: 500 };
    }

    const limits = {
      maxReferralsPerDay: 10,
      maxChallengeSpPerDay: 500,
    };

    data?.forEach((row) => {
      if (row.config_key === 'max_referral_rewards_per_day') {
        limits.maxReferralsPerDay = parseInt(row.config_value, 10);
      } else if (row.config_key === 'challenge_max_sp_per_day') {
        limits.maxChallengeSpPerDay = parseInt(row.config_value, 10);
      }
    });

    return limits;
  } catch (error) {
    console.error('Get fraud limits exception:', error);
    return { maxReferralsPerDay: 10, maxChallengeSpPerDay: 500 };
  }
}
