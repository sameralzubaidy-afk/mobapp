import { supabase } from './supabase/client';
import { generateReferralCode, processReferralCode } from './supabase/auth';

// Re-export referral code functions for backward compatibility
export { generateReferralCode, processReferralCode };

export interface ReferralStats {
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_points_earned: number;
}

/**
 * Award referral bonus (5 points each) when referee completes first trade
 * Called after a trade is marked as 'completed'
 * Updates referral status to 'claimed' and creates points_transactions
 */
export const processReferralBonus = async (
  userId: string,
  tradeId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if this user has a pending referral
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('id, referrer_user_id, referred_user_id, referral_code')
      .eq('referred_user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (referralError || !referral) {
      // No pending referral - user didn't use a referral code
      return { success: false, error: 'No pending referral found' };
    }

    // Check if this is the referee's first completed trade
    const { count, error: tradeCountError } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', userId)
      .eq('status', 'completed');

    if (tradeCountError) {
      console.error('Trade count error:', tradeCountError);
      return { success: false, error: tradeCountError.message };
    }

    if (count === null || count > 1) {
      // Not the first trade
      return { success: false, error: 'Not the first completed trade' };
    }

    // Award 5 points to both referrer and referee
    const REFERRAL_BONUS = 5;

    // Create points transactions for both users
    const { error: pointsError } = await supabase.from('points_transactions').insert([
      {
        user_id: (referral as any).referrer_user_id,
        points: REFERRAL_BONUS,
        transaction_type: 'referral_bonus',
        description: `Referral bonus: ${(referral as any).referral_code}`,
        related_id: (referral as any).id,
      },
      {
        user_id: (referral as any).referred_user_id,
        points: REFERRAL_BONUS,
        transaction_type: 'referral_bonus',
        description: `Referral bonus: ${(referral as any).referral_code}`,
        related_id: (referral as any).id,
      },
    ] as any); // TODO: Fix when points_transactions type is regenerated

    if (pointsError) {
      console.error('Points transaction error:', pointsError);
      return { success: false, error: pointsError.message };
    }

    // Update referral status to claimed
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'claimed',
        bonus_points: REFERRAL_BONUS,
        bonus_claimed_at: new Date().toISOString(),
        bonus_points_referrer: REFERRAL_BONUS,
        bonus_claimed_referrer_at: new Date().toISOString(),
      } as any) // TODO: Fix when referrals type is regenerated
      .eq('id', (referral as any).id);

    if (updateError) {
      console.error('Referral update error:', updateError);
      return { success: false, error: updateError.message };
    }

    // TODO: Send push notifications to both users
    // TODO: Create in-app notifications
    // TODO: Track analytics event
    // trackEvent('referral_bonus_awarded', {
    //   referrer_id: referral.referrer_user_id,
    //   referee_id: referral.referred_user_id,
    //   bonus_points: REFERRAL_BONUS,
    //   trade_id: tradeId,
    // });

    return { success: true };
  } catch (error: any) {
    console.error('Process referral bonus error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get referral stats for a user
 * Returns count of total/pending/completed referrals and total points earned
 */
export const getReferralStats = async (userId: string): Promise<ReferralStats> => {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('status, bonus_points')
      .eq('referrer_user_id', userId);

    if (error) throw error;

    const total_referrals = data?.length || 0;
    const pending_referrals = data?.filter((r: any) => r.status === 'pending').length || 0;
    const completed_referrals = data?.filter((r: any) => r.status === 'claimed').length || 0;
    const total_points_earned = completed_referrals * 5; // 5 points per completed referral

    return {
      total_referrals,
      pending_referrals,
      completed_referrals,
      total_points_earned,
    };
  } catch (error) {
    console.error('Get referral stats error:', error);
    return {
      total_referrals: 0,
      pending_referrals: 0,
      completed_referrals: 0,
      total_points_earned: 0,
    };
  }
};
