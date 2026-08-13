/**
 * File: p2p-kids-marketplace/src/hooks/useUnreadMessagesBadge.ts
 *
 * Tracks the total unread message count for the header chat icon.
 *
 * This is the SAME logic that previously drove the bottom-nav Inbox badge
 * (getTotalUnreadMessageCount + AppState foreground refresh + Realtime on
 * messages INSERT). It was extracted from PersistentTabBar so the header chat
 * icon can reuse it after the Inbox tab was removed from the bottom nav —
 * the unread-message badge is relocated, not lost.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getTotalUnreadMessageCount } from '@/services/chat';
import { supabase } from '@/config/supabase';

export interface UseUnreadMessagesBadgeResult {
  unreadCount: number;
  refresh: () => Promise<void>;
}

/**
 * Returns the total unread message count and keeps it fresh:
 * - initial fetch on mount / when the user changes
 * - re-fetch when the app returns to the foreground (user may have read messages)
 * - Realtime refresh when a new message is inserted (BP-23: the Realtime
 *   callback mirrors the mount-time refresh side effect)
 */
export function useUnreadMessagesBadge(
  userId: string | undefined
): UseUnreadMessagesBadgeResult {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getTotalUnreadMessageCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[useUnreadMessagesBadge] Failed to refresh unread count:', error);
    }
  }, [userId]);

  // Initial fetch on mount / when user changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch when app comes to foreground (user may have read messages)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  // Real-time subscription: refresh when a new message arrives
  useEffect(() => {
    if (!userId) return;

    let channel: any;
    try {
      // Defensive: tests / restricted envs may not expose a working channel.
      if (typeof supabase.channel !== 'function') return;
      channel = supabase.channel(`unread-messages-badge-${userId}`);
      if (!channel || typeof channel.on !== 'function') return;
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          // Debounce: avoid re-fetching on every bulk insert
          refresh();
        }
      );
      // MSG: also refresh when a message is marked read/delivered (read_at /
      // delivery_status change) so the header badge decrements as soon as the
      // user reads a message instead of waiting for the next foreground event.
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          refresh();
        }
      );
      channel.subscribe();
    } catch (error) {
      console.warn('[useUnreadMessagesBadge] Realtime setup failed:', error);
      return;
    }

    return () => {
      try {
        if (channel && typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(channel).catch(() => {});
        }
      } catch {
        // non-fatal during teardown
      }
    };
  }, [userId, refresh]);

  return { unreadCount, refresh };
}
