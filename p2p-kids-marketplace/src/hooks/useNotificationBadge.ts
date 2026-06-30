// File: p2p-kids-marketplace/src/hooks/useNotificationBadge.ts
// MODULE-14 TASK NOTIF-V2-006: Hook to track unread notification count for badge display

import { useEffect, useState, useCallback } from 'react';
import Constants from 'expo-constants';
import {
  getUnreadNotificationCount,
  subscribeToNotifications,
} from '@/services/referralNotifications';
import { supabase } from '@/config/supabase';

interface UseNotificationBadgeResult {
  unreadCount: number;
  refresh: () => Promise<void>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUserId(userId: string | undefined): boolean {
  return Boolean(userId && UUID_PATTERN.test(userId));
}

/**
 * Returns the current unread notification count and subscribes to realtime updates.
 * Intended for use in BottomNavBar and dashboard headers.
 */
export function useNotificationBadge(userId: string | undefined): UseNotificationBadgeResult {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isValidUserId(userId)) {
      setUnreadCount(0);
      return;
    }

    try {
      if (typeof getUnreadNotificationCount !== 'function') {
        setUnreadCount(0);
        return;
      }

      const result = await getUnreadNotificationCount(userId!);
      if (result?.success && typeof result.count === 'number') {
        setUnreadCount(result.count);
      }
    } catch (error) {
      console.warn('[useNotificationBadge] Failed to refresh unread count:', error);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (!isValidUserId(userId)) {
      setUnreadCount(0);
      return;
    }
    refresh();
  }, [userId, refresh]);

  // Subscribe to realtime inserts to increment badge immediately
  useEffect(() => {
    if (!isValidUserId(userId)) {
      return;
    }
    const unsubscribe = subscribeToNotifications(userId!, () => {
      setUnreadCount((prev) => prev + 1);
    });
    return unsubscribe;
  }, [userId]);

  // Subscribe to realtime updates (mark as read) to refresh badge count immediately
  useEffect(() => {
    if (!isValidUserId(userId)) {
      return;
    }

    if (Constants.appOwnership === 'expo') {
      // Realtime in Expo Go is unreliable; rely on manual refresh instead
      return;
    }

    const channelTopic = `badge-updates:${userId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const channel = supabase.channel(channelTopic);
    let isDisposed = false;

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        if (isDisposed) return;
        refresh();
      }
    );

    channel.subscribe((status: string) => {
      if (isDisposed) return;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[useNotificationBadge] Realtime update channel status:', status, channelTopic);
      }
    });

    return () => {
      isDisposed = true;
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { unreadCount, refresh };
}
