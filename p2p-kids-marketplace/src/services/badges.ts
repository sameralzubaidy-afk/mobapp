// filepath: p2p-kids-marketplace/src/services/badges.ts

import { supabase } from '../config/supabase';
import { 
  UserBadge, 
  Badge, 
  BadgeConfigHistory, 
  BadgeAuditLog 
} from '../types/badge';

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
    .eq('is_archived', false)
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

// =============================================================================
// Admin Configuration Functions
// =============================================================================

/**
 * Manually award a badge to a user (admin only)
 */
export async function manualAwardBadge(
  userId: string,
  badgeId: string,
  reason?: string
): Promise<{ success: boolean; message: string; badge_id?: string; badge_name?: string }> {
  const { data, error } = await supabase.rpc('manual_award_badge', {
    p_user_id: userId,
    p_badge_id: badgeId,
    p_reason: reason || null,
  });

  if (error) {
    console.error('[manualAwardBadge] Error:', error);
    throw new Error(error.message || 'Failed to manually award badge');
  }

  return data as { success: boolean; message: string; badge_id?: string; badge_name?: string };
}

/**
 * Manually revoke a badge from a user (admin only)
 */
export async function manualRevokeBadge(
  userId: string,
  badgeId: string,
  reason?: string
): Promise<{ success: boolean; message: string; badge_id?: string; badge_name?: string }> {
  const { data, error } = await supabase.rpc('manual_revoke_badge', {
    p_user_id: userId,
    p_badge_id: badgeId,
    p_reason: reason || null,
  });

  if (error) {
    console.error('[manualRevokeBadge] Error:', error);
    throw new Error(error.message || 'Failed to manually revoke badge');
  }

  return data as { success: boolean; message: string; badge_id?: string; badge_name?: string };
}

/**
 * Get badge configuration history (admin only)
 */
export async function getBadgeConfigHistory(
  badgeId?: string,
  limit: number = 50
): Promise<BadgeConfigHistory[]> {
  const { data, error } = await supabase.rpc('get_badge_config_history', {
    p_badge_id: badgeId || null,
    p_limit: limit,
  });

  if (error) {
    console.error('[getBadgeConfigHistory] Error:', error);
    throw new Error(error.message || 'Failed to fetch badge config history');
  }

  return (data || []) as BadgeConfigHistory[];
}

/**
 * Get badge audit logs (admin only)
 */
export async function getBadgeAuditLogs(options?: {
  userId?: string;
  badgeId?: string;
  actionType?: string;
  limit?: number;
}): Promise<BadgeAuditLog[]> {
  const { data, error } = await supabase.rpc('get_badge_audit_logs', {
    p_user_id: options?.userId || null,
    p_badge_id: options?.badgeId || null,
    p_action_type: options?.actionType || null,
    p_limit: options?.limit || 100,
  });

  if (error) {
    console.error('[getBadgeAuditLogs] Error:', error);
    throw new Error(error.message || 'Failed to fetch badge audit logs');
  }

  return (data || []) as BadgeAuditLog[];
}
