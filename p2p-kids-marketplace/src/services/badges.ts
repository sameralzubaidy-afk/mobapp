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
