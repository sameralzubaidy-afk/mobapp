/**
 * File: p2p-kids-marketplace/src/hooks/useGracePeriodStatus.ts
 * Hook for calculating grace period countdown and messaging
 * MODULE-11 TASK SUB-010
 */

import { useMemo, useEffect, useState } from 'react';
import { getGracePeriodDays } from '../services/adminConfig';

interface UseGracePeriodStatusParams {
  status: string;
  grace_period_ends_at: string | null;
}

interface UseGracePeriodStatusReturn {
  isInGrace: boolean;
  daysRemaining: number;
  message: string | null;
  gracePeriodDays: number;
}

/**
 * Calculates grace period status and provides contextual messaging
 * @param status - Current subscription status
 * @param grace_period_ends_at - ISO date string for grace period end
 * @returns Grace period state and user-friendly message
 */
export function useGracePeriodStatus({
  status,
  grace_period_ends_at,
}: UseGracePeriodStatusParams): UseGracePeriodStatusReturn {
  const [gracePeriodDays, setGracePeriodDays] = useState(0);

  useEffect(() => {
    getGracePeriodDays(true).then(setGracePeriodDays).catch(console.error);
  }, []);

  return useMemo(() => {
    const isInGrace = status === 'grace_period';

    if (!isInGrace || !grace_period_ends_at) {
      return {
        isInGrace: false,
        daysRemaining: 0,
        message: null,
        gracePeriodDays,
      };
    }

    const now = new Date();
    const gracePeriodEnd = new Date(grace_period_ends_at);
    const timeDiff = gracePeriodEnd.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    const endsToday = gracePeriodEnd.toDateString() === now.toDateString();

    let message: string;
    if (daysRemaining === 0 || endsToday) {
      message = 'Your grace period ends today! Re-subscribe now to keep your Swap Points.';
    } else if (daysRemaining === 1) {
      message = 'Only 1 day left! Re-subscribe to keep your Swap Points.';
    } else if (daysRemaining <= 7) {
      message = `Only ${daysRemaining} days left! Re-subscribe to keep your Swap Points.`;
    } else {
      // FIX-Task-50 item 1 (class sweep, 2026-09-17): same claim as
      // `GracePeriodBanner` — the points are FROZEN at the end of grace (and
      // restored on resubscribe), never deleted. Kept in sync with the banner copy
      // so the two cannot drift if this hook is wired up again.
      message = `You have ${daysRemaining} days to re-subscribe, or your Swap Points will be frozen until you do.`;
    }

    return {
      isInGrace: true,
      daysRemaining,
      message,
      gracePeriodDays,
    };
  }, [status, grace_period_ends_at, gracePeriodDays]);
}
