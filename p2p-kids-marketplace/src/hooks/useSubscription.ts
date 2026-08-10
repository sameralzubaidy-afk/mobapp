/**
 * File: p2p-kids-marketplace/src/hooks/useSubscription.ts
 * Hook for fetching and managing subscription data
 * MODULE-11 TASK SUB-010
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { getSubscriptionSummary, SubscriptionSummary } from '../services/subscription';
import { useAuth } from './useAuth';

interface UseSubscriptionReturn {
  subscription: SubscriptionSummary | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const summary = await getSubscriptionSummary(user.id);
      setSubscription(summary);
    } catch (err) {
      console.error('[useSubscription] Error fetching subscription:', err);
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
    loading,
    error,
    refetch: fetchSubscription,
  };
}
