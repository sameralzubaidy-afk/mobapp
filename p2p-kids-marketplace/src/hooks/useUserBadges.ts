// File: p2p-kids-marketplace/src/hooks/useUserBadges.ts
// TASK BADGES-V2-009: Real-time subscription for user badges
// TASK NOTIF-V2-004: Badge celebration modal integration

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';
import { UserBadge } from '@/types/badge';
import {
  sendBadgeAwardPushNotification,
  checkBadgeMilestones,
  getBadgeNotifications,
  markBadgeNotificationRead,
  parseBadgeNotificationData,
} from '@/services/badgeNotifications';

interface UseUserBadgesResult {
  badges: UserBadge[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  newBadgeAwarded: UserBadge | null;
  clearNewBadge: () => void;
  showCelebration: boolean;
  setShowCelebration: (show: boolean) => void;
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBadgeAwarded, setNewBadgeAwarded] = useState<UserBadge | null>(null);
  const channelRef = useRef<any>(null);
  const hasInitializedBadgeSnapshotRef = useRef(false);
  const hasCheckedPendingCelebrationRef = useRef(false);
  const latestBadgeIdRef = useRef<string | null>(null);
  const handledBadgeIdsRef = useRef<Set<string>>(new Set());
  const currentCelebrationBadgeIdRef = useRef<string | null>(null);
  const currentCelebrationNotificationIdRef = useRef<string | null>(null);

  const handleNewBadgeAwarded = useCallback(
    (badge: UserBadge, options?: { runSideEffects?: boolean }) => {
      if (!badge?.id || handledBadgeIdsRef.current.has(badge.id)) {
        return;
      }

      const runSideEffects = options?.runSideEffects ?? true;

      handledBadgeIdsRef.current.add(badge.id);
      currentCelebrationBadgeIdRef.current = badge.badge_id || badge.badge?.id || null;

      setBadges((prev) => {
        const exists = prev.some((b) => b.id === badge.id);
        return exists ? prev : [badge, ...prev];
      });

      setNewBadgeAwarded(badge);
      setShowCelebration(true);

      if (runSideEffects && userId && badge.badge) {
        sendBadgeAwardPushNotification(userId, badge.badge).catch((err) => {
          console.warn('Failed to send badge push notification:', err);
        });
      }

      if (runSideEffects && userId) {
        checkBadgeMilestones(userId).catch((err) => {
          console.warn('Failed to check badge milestones:', err);
        });
      }
    },
    [userId]
  );

  const checkPendingCelebration = useCallback(
    async (fetchedBadges: UserBadge[]) => {
      if (!userId || hasCheckedPendingCelebrationRef.current) {
        return;
      }

      hasCheckedPendingCelebrationRef.current = true;

      try {
        const { data: notifications, error: notificationsError } = await getBadgeNotifications(userId);

        if (notificationsError || !notifications?.length) {
          return;
        }

        const pendingBadgeEarned = notifications.find(
          (notification) => notification.type === 'badge_earned'
        );

        if (!pendingBadgeEarned) {
          return;
        }

        const parsedData = parseBadgeNotificationData(pendingBadgeEarned);
        if (!parsedData?.badge_id) {
          return;
        }

        let badgeToCelebrate = fetchedBadges.find(
          (badge) => badge.badge_id === parsedData.badge_id || badge.badge?.id === parsedData.badge_id
        );

        if (!badgeToCelebrate) {
          const { data: fallbackBadge } = await supabase
            .from('user_badges')
            .select('*, badge:badges(*)')
            .eq('user_id', userId)
            .eq('badge_id', parsedData.badge_id)
            .order('awarded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackBadge) {
            badgeToCelebrate = fallbackBadge as UserBadge;
          }
        }

        if (!badgeToCelebrate) {
          badgeToCelebrate = {
            id: `notification-${pendingBadgeEarned.id}`,
            user_id: userId,
            badge_id: parsedData.badge_id,
            awarded_at: pendingBadgeEarned.created_at || new Date().toISOString(),
            badge: {
              id: parsedData.badge_id,
              name: parsedData.badge_name || 'New Badge',
              description: parsedData.badge_description || '',
              category: 'special',
              icon_url: parsedData.badge_icon || undefined,
              threshold: 0,
              created_at: pendingBadgeEarned.created_at || new Date().toISOString(),
              is_active: true,
              sort_order: 0,
            },
          };
        }

        currentCelebrationNotificationIdRef.current = pendingBadgeEarned.id;
        handleNewBadgeAwarded(badgeToCelebrate, { runSideEffects: false });
      } catch (err) {
        console.warn('Failed checking pending badge celebration:', err);
      }
    },
    [userId, handleNewBadgeAwarded]
  );

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

      const fetchedBadges = (data || []) as UserBadge[];
      setBadges(fetchedBadges);

      const latestBadge = fetchedBadges[0] || null;

      if (!hasInitializedBadgeSnapshotRef.current) {
        hasInitializedBadgeSnapshotRef.current = true;
        latestBadgeIdRef.current = latestBadge?.id || null;
        await checkPendingCelebration(fetchedBadges);
      } else if (latestBadge?.id && latestBadge.id !== latestBadgeIdRef.current) {
        latestBadgeIdRef.current = latestBadge.id;
        handleNewBadgeAwarded(latestBadge);
      }
    } catch (err: any) {
      console.error('Error loading user badges:', err);
      setError(err.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  }, [userId, handleNewBadgeAwarded, checkPendingCelebration]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadBadges();
  }, [loadBadges]);

  const clearNewBadge = useCallback(() => {
    const notificationId = currentCelebrationNotificationIdRef.current;
    const badgeId = currentCelebrationBadgeIdRef.current;

    if (userId && badgeId) {
      if (notificationId) {
        markBadgeNotificationRead(notificationId).catch((err) => {
          console.warn('Failed to mark badge notification as read:', err);
        });
      } else {
        getBadgeNotifications(userId)
          .then(({ data }) => {
            const matchingNotification = (data || []).find((notification) => {
              if (notification.type !== 'badge_earned') return false;
              const parsed = parseBadgeNotificationData(notification);
              return parsed?.badge_id === badgeId;
            });

            if (matchingNotification?.id) {
              markBadgeNotificationRead(matchingNotification.id).catch((err) => {
                console.warn('Failed to mark resolved badge notification as read:', err);
              });
            }
          })
          .catch((err) => {
            console.warn('Failed to resolve badge notification to mark as read:', err);
          });
      }
    }

    currentCelebrationNotificationIdRef.current = null;
    currentCelebrationBadgeIdRef.current = null;
    setNewBadgeAwarded(null);
    setShowCelebration(false);
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

            handleNewBadgeAwarded(newBadge as UserBadge);
          } catch (err) {
            console.error('Error handling new badge:', err);
            // Fallback: reload all badges
            await loadBadges();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    const handledBadgeIds = handledBadgeIdsRef.current;

    // Fallback polling path: handles environments where realtime events are delayed/missed.
    const pollInterval = setInterval(() => {
      loadBadges().catch((err) => {
        console.warn('Badge polling refresh failed:', err);
      });
    }, 4000);

    // Cleanup
    return () => {
      setShowCelebration(false);
      clearInterval(pollInterval);
      hasInitializedBadgeSnapshotRef.current = false;
      hasCheckedPendingCelebrationRef.current = false;
      latestBadgeIdRef.current = null;
      currentCelebrationBadgeIdRef.current = null;
      currentCelebrationNotificationIdRef.current = null;
      handledBadgeIds.clear();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, loadBadges, handleNewBadgeAwarded]);

  return {
    badges,
    loading,
    error,
    refresh,
    newBadgeAwarded,
    clearNewBadge,
    showCelebration,
    setShowCelebration,
  };
};
