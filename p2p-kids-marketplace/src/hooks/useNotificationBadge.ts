// File: p2p-kids-marketplace/src/hooks/useNotificationBadge.ts
// MODULE-14 TASK NOTIF-V2-006: Hook to track unread notification count for badge display

import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import {
  getUnreadNotificationCount,
  subscribeToNotifications,
} from '@/services/referralNotifications';
import { registerNotificationBadgeRefresh } from '@/services/notificationBadgeRefreshRegistry';
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
        // FIX-Task-66 item 2 diagnostic: a stable log line proving the count read
        // actually succeeded. When the badge is stale, this line tells you whether
        // the read failed silently (value deliberately kept) or never ran.
        if (__DEV__) {
          console.log(`[useNotificationBadge] refresh ok count=${result.count}`);
        }
      } else if (__DEV__) {
        console.warn(
          '[useNotificationBadge] refresh returned no usable count — keeping previous value:',
          result?.error
        );
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

  // FIX-Task-66 item 2 (2026-09-18): let a mutation surface force a re-read.
  // Notification Center's "Mark all read" calls `requestNotificationBadgeRefresh()`
  // after the write resolves; this registers the instance's own refresh so EVERY
  // mounted header badge updates (each AppHeader owns a separate hook instance).
  // Registered per instance on purpose — a single-slot registry would refresh only
  // the most recently mounted header and leave the header you navigate back to stale.
  useEffect(() => {
    if (!isValidUserId(userId)) {
      return;
    }

    return registerNotificationBadgeRefresh(refresh);
  }, [userId, refresh]);

  // FIX-Task-66 item 2: refetch-on-foreground safety net. A missed Realtime event,
  // or a count read that failed while the app was backgrounded, self-heals when the
  // user returns instead of persisting until the next mount / app restart. We use
  // AppState rather than useFocusEffect so this hook stays usable outside a
  // navigator (it is also consumed by the Discover-only header).
  useEffect(() => {
    if (!isValidUserId(userId)) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
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
      (payload: { new?: { id?: string } }) => {
        if (isDisposed) return;
        // FIX-Task-66 item 2 diagnostic: proves whether the UPDATE event is actually
        // delivered. If this line never appears while a notification is marked read
        // (here or in another session), the real cause is Realtime delivery (b) — not
        // just the missing app-side refresh (a).
        if (__DEV__) {
          console.log(
            `[useNotificationBadge] realtime UPDATE delivered id=${
              payload?.new?.id ?? 'unknown'
            } — refreshing`
          );
        }
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
