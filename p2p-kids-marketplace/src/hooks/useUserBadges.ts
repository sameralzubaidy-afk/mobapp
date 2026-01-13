// File: p2p-kids-marketplace/src/hooks/useUserBadges.ts
// TASK BADGES-V2-009: Real-time subscription for user badges

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';
import { UserBadge } from '@/types/badge';

interface UseUserBadgesResult {
  badges: UserBadge[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  newBadgeAwarded: UserBadge | null;
  clearNewBadge: () => void;
}

/**
 * Hook to fetch user badges and subscribe to real-time updates
 * 
 * Features:
 * - Fetches user's badges on mount
 * - Subscribes to real-time INSERT events on user_badges table
 * - Exposes newBadgeAwarded for celebration modals
 * - Automatically refreshes badges when new badge is awarded
 * 
 * Usage:
 * ```tsx
 * const { badges, loading, newBadgeAwarded, clearNewBadge } = useUserBadges(userId);
 * 
 * useEffect(() => {
 *   if (newBadgeAwarded) {
 *     showCelebrationModal(newBadgeAwarded);
 *     clearNewBadge();
 *   }
 * }, [newBadgeAwarded]);
 * ```
 */
export const useUserBadges = (userId: string | undefined): UseUserBadgesResult => {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBadgeAwarded, setNewBadgeAwarded] = useState<UserBadge | null>(null);
  const channelRef = useRef<any>(null);

  const loadBadges = useCallback(async () => {
    if (!userId) {
      setBadges([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBadges(data as UserBadge[]);
    } catch (err: any) {
      console.error('Error loading user badges:', err);
      setError(err.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Initial load
    loadBadges();

    // Setup real-time subscription
    const channelName = `user_badges_${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('🎉 New badge awarded via real-time:', payload);

          // Fetch the newly awarded badge with full details
          try {
            const { data: newBadge, error: fetchError } = await supabase
              .from('user_badges')
              .select('*, badge:badges(*)')
              .eq('id', payload.new.id)
              .single();

            if (fetchError) {
              console.error('Error fetching new badge details:', fetchError);
              // Fallback: reload all badges
              await loadBadges();
              return;
            }

            // Add to badges list
            setBadges((prev) => [newBadge as UserBadge, ...prev]);

            // Set newBadgeAwarded for celebration modal
            setNewBadgeAwarded(newBadge as UserBadge);
          } catch (err) {
            console.error('Error handling new badge:', err);
            // Fallback: reload all badges
            await loadBadges();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, loadBadges]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadBadges();
  }, [loadBadges]);

  const clearNewBadge = useCallback(() => {
    setNewBadgeAwarded(null);
  }, []);

  return {
    badges,
    loading,
    error,
    refresh,
    newBadgeAwarded,
    clearNewBadge,
  };
};
