/**
 * File: p2p-kids-marketplace/src/services/sp.ts
 * MODULE-09 POINTS-GAMIFICATION: Swap Points Service
 * 
 * Handles:
 * - Fetching SP wallet summary
 * - Fetching SP transaction history
 */

import { supabase } from '../config/supabase';

export interface SPWalletSummary {
  user_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

/**
 * Get user's SP wallet summary
 * 
 * @param userId - User ID
 * @returns SP wallet summary
 */
export async function getSPWalletSummary(userId: string): Promise<SPWalletSummary> {
  try {
    const result = await supabase.rpc('get_user_sp_wallet_summary', {
      p_user_id: userId,
    });

    const error = result.error;
    const data = result.data as Record<string, number> | Record<string, number>[] | null;

    if (error) {
      console.error('❌ Error fetching SP wallet summary:', error.message);
      // Return zeroed summary on error to avoid crashing
      return {
        user_id: userId,
        available_balance: 0,
        pending_balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
      };
    }

    // RPC returns an array or single object
    const summary = Array.isArray(data) ? data[0] : (data as Record<string, number> | null);

    return {
      user_id: userId,
      available_balance: summary?.available_points ?? 0,
      pending_balance: summary?.pending_points ?? 0,
      lifetime_earned: summary?.lifetime_earned ?? 0,
      lifetime_spent: summary?.lifetime_spent ?? 0,
    };
  } catch (error) {
    const err = error as Error;
    console.error('❌ getSPWalletSummary failed:', err.message);
    return {
      user_id: userId,
      available_balance: 0,
      pending_balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    };
  }
}
