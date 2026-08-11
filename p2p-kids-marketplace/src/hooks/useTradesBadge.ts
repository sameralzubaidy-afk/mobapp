/**
 * File: p2p-kids-marketplace/src/hooks/useTradesBadge.ts
 *
 * Tracks the count of ACTIVE trades for the Trades tab badge.
 *
 * "Active" is defined as any trade status that is NOT a terminal state
 * (completed / cancelled) — i.e. pending, payment_processing, payment_failed,
 * in_progress. This matches:
 *   - the spec: "anything not yet completed/cancelled/archived"
 *   - the live trades_status_check constraint (which still allows
 *     payment_processing on staging)
 * Completed and cancelled trades never count toward this badge.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getActiveTradeCount } from '@/services/trade';
import { supabase } from '@/config/supabase';

export interface UseTradesBadgeResult {
  activeCount: number;
  refresh: () => Promise<void>;
}

/**
 * Returns the count of active (non-terminal) trades and keeps it fresh:
 * - initial fetch on mount / when the user changes
 * - re-fetch when the app returns to the foreground
 * - Realtime refresh on trades INSERT/UPDATE (BP-23)
 */
export function useTradesBadge(userId: string | undefined): UseTradesBadgeResult {
  const [activeCount, setActiveCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActiveCount(0);
      return;
    }
    try {
      const count = await getActiveTradeCount(userId);
      setActiveCount(count);
    } catch (error) {
      console.warn('[useTradesBadge] Failed to refresh active trade count:', error);
    }
  }, [userId]);

  // Initial fetch on mount / when user changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch when app comes to foreground (status may have changed elsewhere)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  // Real-time subscription: refresh on trade INSERT/UPDATE so the badge stays
  // live while the app is open (BP-23)
  useEffect(() => {
    if (!userId) return;

    let channel: any;
    try {
      // Defensive: tests / restricted envs may not expose a working channel.
      if (typeof supabase.channel !== 'function') return;
      channel = supabase.channel(`trades-badge-${userId}`);
      if (!channel || typeof channel.on !== 'function') return;
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trades' },
        () => refresh()
      );
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trades' },
        () => refresh()
      );
      channel.subscribe();
    } catch (error) {
      console.warn('[useTradesBadge] Realtime setup failed:', error);
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

  return { activeCount, refresh };
}
