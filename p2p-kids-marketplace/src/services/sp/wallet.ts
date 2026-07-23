// File: p2p-kids-marketplace/src/services/sp/wallet.ts
// MODULE-09 SP-001: SP Wallet Service
// Handles wallet operations, balance queries, and ledger history

import { supabase } from '@/config/supabase';

export interface SPWallet {
  id: string;
  user_id: string;
  available_balance: number;
  reserved_sp: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  lifetime_expired: number;
  state: 'active' | 'frozen' | 'grace_period';
  frozen_at?: string;
  grace_period_ends_at?: string;
  starter_pack_issued: boolean;
  starter_pack_issued_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SPBatch {
  id: string;
  wallet_id: string;
  user_id: string;
  initial_sp: number;
  remaining_sp: number;
  source_type: string;
  source_id?: string;
  expires_at: string;
  is_expired: boolean;
  created_at: string;
}

export interface SPLedgerEntry {
  id: string;
  wallet_id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

/**
 * Get user's SP wallet (creates if not exists)
 */
export async function getWallet(userId: string): Promise<SPWallet | null> {
  try {
    // First try to get existing wallet
    const { data: wallet, error } = await supabase
      .from('sp_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No wallet exists, create one
      const { data: newWallet, error: createError } = await supabase
        .from('sp_wallets')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) throw createError;
      return newWallet;
    } else if (error) {
      throw error;
    }

    return wallet;
  } catch (error) {
    console.error('Get wallet error:', error);
    return null;
  }
}

/**
 * Get user's SP balance (quick check)
 */
export async function getBalance(userId: string): Promise<number> {
  const wallet = await getWallet(userId);
  return wallet?.available_balance || 0;
}

/**
 * Check if user can spend SP (has active subscription)
 */
export async function canSpendSP(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .single();

    if (!subscription) {
      return { allowed: false, reason: 'Kids Club+ subscription required to use Swap Points' };
    }

    // Check wallet state
    const wallet = await getWallet(userId);
    if (!wallet) {
      return { allowed: false, reason: 'SP wallet not found' };
    }

    if (wallet.state === 'frozen') {
      return { allowed: false, reason: 'SP wallet is frozen. Please renew your subscription.' };
    }

    if (wallet.state === 'grace_period') {
      return {
        allowed: false,
        reason: 'SP wallet is in grace period. Renew subscription to access your SP.',
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Check SP spend eligibility error:', error);
    return { allowed: false, reason: 'Unable to verify SP eligibility' };
  }
}

/**
 * Get SP ledger history for user
 */
export async function getLedgerHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<SPLedgerEntry[]> {
  try {
    const { data, error } = await supabase
      .from('sp_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get ledger history error:', error);
    return [];
  }
}

/**
 * Get SP batches expiring soon
 */
export async function getExpiringBatches(
  userId: string,
  withinDays: number = 30
): Promise<SPBatch[]> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    const { data, error } = await supabase
      .from('sp_batches')
      .select('*')
      .eq('user_id', userId)
      .gt('remaining_sp', 0)
      .eq('is_expired', false)
      .lte('expires_at', futureDate.toISOString())
      .order('expires_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get expiring batches error:', error);
    return [];
  }
}

/**
 * Get SP configuration value
 */
export async function getSPConfig(key: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('get_sp_config', { p_key: key });

    if (error) throw error;

    // Return the JSONB value directly
    return data;
  } catch (error) {
    console.error(`Get SP config error for key ${key}:`, error);
    return null;
  }
}

/**
 * Represents a pending SP release from a completed trade
 */
export interface PendingSPRelease {
  trade_id: string;
  item_title: string | null;
  sp_amount: number;
  pending_sp_release_at: string;
}

/**
 * Get pending SP releases for the user as a seller (SP earned from trades
 * that are in the 3-day pending release window).
 */
export async function getPendingSPReleases(userId: string): Promise<PendingSPRelease[]> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select(`
        id,
        sp_earned_at_completion,
        pending_sp_release_at,
        listing:listing_id ( title )
      `)
      .eq('seller_id', userId)
      .eq('status', 'completed')
      .not('sp_earned_at_completion', 'is', null)
      .gt('sp_earned_at_completion', 0)
      .not('pending_sp_release_at', 'is', null)
      .is('sp_released_at', null)
      .order('pending_sp_release_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      trade_id: row.id,
      item_title: row.listing?.title ?? null,
      sp_amount: row.sp_earned_at_completion ?? 0,
      pending_sp_release_at: row.pending_sp_release_at,
    }));
  } catch (error) {
    console.error('Get pending SP releases error:', error);
    return [];
  }
}

/**
 * Get wallet summary with all metrics
 */
export async function getWalletSummary(userId: string) {
  try {
    const { data, error } = await supabase.rpc('get_user_sp_wallet_summary', { p_user_id: userId });

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        available_points: 0,
        pending_points: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
        wallet_state: 'inactive',
      };
    }

    return data[0];
  } catch (error) {
    console.error('Get wallet summary error:', error);
    return {
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      wallet_state: 'error',
    };
  }
}
