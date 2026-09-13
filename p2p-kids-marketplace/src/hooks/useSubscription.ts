/**
 * File: p2p-kids-marketplace/src/hooks/useSubscription.ts
 * Hook for fetching and managing subscription data
 * MODULE-11 TASK SUB-010
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { getSubscriptionSummary, SubscriptionSummary } from '../services/subscription';
import { useAuth } from './useAuth';

/**
 * FIX-Task-28 item 1 (2026-09-13): user-facing copy for the "we could not verify
 * your plan" state. Exported so screens assert on one canonical string.
 */
export const SUBSCRIPTION_UNVERIFIED_MESSAGE =
  "We couldn't verify your subscription. Please try again.";

interface UseSubscriptionReturn {
  subscription: SubscriptionSummary | null;
  /**
   * FIX-Task-28 item 1 (2026-09-13): TRUE when the latest subscription read could
   * not be verified (transient network failure or unusable payload).
   *
   * When this is true and `subscription` is null we have NEVER confirmed a plan for
   * this account, so the UI must show an explicit "couldn't verify" state (with a
   * retry) rather than the free-tier upsell. When this is true and `subscription` is
   * non-null, the value shown is the last CONFIRMED summary (stale but true).
   */
  unverified: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches and provides current subscription data for the authenticated user
 * @returns Subscription data, loading state, error, and refetch function
 */
export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // FIX-Task-28 item 1 (2026-09-13): the last summary the backend CONFIRMED, kept
  // so a later transient failure falls back to it instead of degrading a paying
  // subscriber to the free tier. Module-scoped to this hook instance, so it is
  // cleared whenever the signed-in account changes.
  const lastVerifiedRef = useRef<SubscriptionSummary | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    const userId = user?.id ?? null;

    // A different account must never inherit the previous account's last-known plan.
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      lastVerifiedRef.current = null;
      setSubscription(null);
      setUnverified(false);
    }

    if (!userId) {
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const summary = await getSubscriptionSummary(userId);

      if (summary.unverified) {
        // FIX-Task-28 item 1: an unread plan is NOT a free plan. Show the last
        // CONFIRMED summary if we have one; otherwise surface the explicit
        // "couldn't verify" state (`subscription` stays null) so no screen can
        // render this as a confirmed Free plan or a Kids Club+ membership.
        setUnverified(true);
        setSubscription(lastVerifiedRef.current);
        setError(new Error(SUBSCRIPTION_UNVERIFIED_MESSAGE));
        return;
      }

      lastVerifiedRef.current = summary;
      setUnverified(false);
      setSubscription(summary);
    } catch (err) {
      console.error('[useSubscription] Error fetching subscription:', err);
      // Same rule for a thrown error: keep the last truth, never fabricate free tier.
      setUnverified(true);
      setSubscription(lastVerifiedRef.current);
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // R7 (Step 6 — status sync): refetch whenever the app returns to the
  // foreground, so a subscription completed on the web (passitup.com) is
  // reflected the moment the parent reopens the app, without manual refresh.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchSubscription();
      }
    });
    return () => subscription.remove();
  }, [fetchSubscription]);

  return {
    subscription,
    unverified,
    loading,
    error,
    refetch: fetchSubscription,
  };
}
