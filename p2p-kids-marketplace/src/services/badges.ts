// filepath: p2p-kids-marketplace/src/services/badges.ts

import { supabase } from '../config/supabase';
import { UserBadge, Badge } from '../types/badge';

/**
 * Fetches all badges earned by a user
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });

  if (error) {
    console.error('Error fetching user badges:', error);
    throw new Error(error.message || 'Failed to fetch user badges');
  }

  return data as UserBadge[];
}

/**
 * Fetches all available badge definitions
 */
export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching all badges:', error);
    throw new Error(error.message || 'Failed to fetch badges');
  }

  return data as Badge[];
}

/**
 * Leaderboard entry interface
 */
export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  badge_count: number;
}

/**
 * Fetches badge leaderboard (top users by badge count)
 * @param limit Number of top users to return (default: 10)
 */
export async function getBadgeLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  console.log('[getBadgeLeaderboard] Calling RPC with limit:', limit);
  
  const { data, error } = await supabase.rpc('get_badge_leaderboard', {
    p_limit: limit,
  });

  console.log('[getBadgeLeaderboard] RPC Response:', {
    data,
    error,
    dataType: typeof data,
    isArray: Array.isArray(data),
    dataLength: Array.isArray(data) ? data.length : 'not-array',
  });

  if (error) {
    console.error('[getBadgeLeaderboard] RPC Error:', error);
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  // Handle null or undefined data
  if (!data) {
    console.warn('[getBadgeLeaderboard] RPC returned null/undefined data');
    return [];
  }

  // Ensure we're returning an array
  const result = Array.isArray(data) ? data : [];
  console.log('[getBadgeLeaderboard] Returning leaderboard with', result.length, 'entries');
  
  return result as LeaderboardEntry[];
}
