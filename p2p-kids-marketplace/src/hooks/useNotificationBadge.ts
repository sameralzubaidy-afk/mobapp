// File: p2p-kids-marketplace/src/hooks/useNotificationBadge.ts
// MODULE-14 TASK NOTIF-V2-006: Hook to track unread notification count for badge display

import { useEffect, useState, useCallback } from 'react';
import {
  getUnreadNotificationCount,
  subscribeToNotifications,
} from '@/services/referralNotifications';

interface UseNotificationBadgeResult {
  unreadCount: number;
  refresh: () => Promise<void>;
}

/**
 * Returns the current unread notification count and subscribes to realtime updates.
 * Intended for use in BottomNavBar and dashboard headers.
 */
export function useNotificationBadge(userId: string | undefined): UseNotificationBadgeResult {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    const result = await getUnreadNotificationCount(userId);
    if (result.success && typeof result.count === 'number') {
      setUnreadCount(result.count);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (!userId) return;
    refresh();
  }, [userId, refresh]);

  // Subscribe to realtime inserts to increment badge immediately
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToNotifications(userId, () => {
      setUnreadCount((prev) => prev + 1);
    });
    return unsubscribe;
  }, [userId]);

  return { unreadCount, refresh };
}
