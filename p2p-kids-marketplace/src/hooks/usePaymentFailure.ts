/**
 * File: p2p-kids-marketplace/src/hooks/usePaymentFailure.ts
 * MODULE-11 TASK SUB-018: Payment Failure Handling
 *
 * Hook to detect and manage payment failure states for subscription
 * Provides payment failure info and actions to resolve
 */

import { useState, useEffect, useCallback } from 'react';
import { useSubscription } from './useSubscription';
import { SubscriptionSummary } from '@/services/subscription';

export interface PaymentFailureInfo {
  hasFailure: boolean;
  retryCount: number;
  failedAt: string | null;
  isRecentFailure: boolean; // Within last 24 hours
  isMaxRetriesReached: boolean; // 3 or more failures
  message: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

interface UsePaymentFailureReturn {
  failureInfo: PaymentFailureInfo;
  loading: boolean;
  dismissBanner: () => void;
  bannerDismissed: boolean;
}

interface UsePaymentFailureOptions {
  subscriptionOverride?: SubscriptionSummary | null;
  loadingOverride?: boolean;
}

const MAX_RETRIES = 3;
const RECENT_THRESHOLD_HOURS = 24;

/**
 * Hook to check payment failure status and provide contextual info
 * @returns Payment failure information and banner control
 */
export function usePaymentFailure(options?: UsePaymentFailureOptions): UsePaymentFailureReturn {
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const effectiveSubscription = options?.subscriptionOverride ?? subscription;
  const effectiveLoading = options?.loadingOverride ?? subscriptionLoading;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Parse payment failure info from subscription
  const failureInfo: PaymentFailureInfo = useCallback(() => {
    const retryCount = effectiveSubscription?.payment_retry_count ?? 0;
    const failedAt = effectiveSubscription?.payment_failed_at ?? null;
    const subscriptionStatus = effectiveSubscription?.status ?? 'free';
    const isGraceStatus = subscriptionStatus === 'grace' || subscriptionStatus === 'grace_period';
    const hasFailure = retryCount > 0;

    // Check if failure is recent (within 24 hours)
    let isRecentFailure = false;
    if (failedAt) {
      try {
        const failureTime = new Date(failedAt).getTime();
        const now = Date.now();
        const hoursSinceFailure = (now - failureTime) / (1000 * 60 * 60);
        isRecentFailure = hoursSinceFailure <= RECENT_THRESHOLD_HOURS;
      } catch (err) {
        console.warn('[usePaymentFailure] Failed to parse payment_failed_at:', err);
      }
    } else if (retryCount > 0) {
      // Backward-compatible fallback:
      // Some environments return payment_retry_count but omit payment_failed_at in RPC payload.
      // Keep the banner visible when failures exist so users can still recover their subscription.
      isRecentFailure = true;
    }

    const isMaxRetriesReached = retryCount >= MAX_RETRIES;

    // Determine message based on retry count
    let message = '';
    let urgencyLevel: 'low' | 'medium' | 'high' = 'low';

    if (!hasFailure) {
      message = '';
    } else if (isMaxRetriesReached && isGraceStatus) {
      message = 'Your Kids Club+ access has been paused. Re-subscribe to restore Swap Points.';
      urgencyLevel = 'high';
    } else if (isMaxRetriesReached) {
      message =
        'Payment declined again. Your subscription is at risk. Please update your payment method.';
      urgencyLevel = 'high';
    } else if (retryCount === 2) {
      message =
        'Payment declined again. Your subscription is at risk. Please update your payment method.';
      urgencyLevel = 'high';
    } else if (retryCount === 1) {
      message =
        'Your payment was declined. Please update your payment method to keep your subscription active.';
      urgencyLevel = 'medium';
    }

    return {
      hasFailure,
      retryCount,
      failedAt,
      isRecentFailure,
      isMaxRetriesReached,
      message,
      urgencyLevel,
    };
  }, [effectiveSubscription])();

  // Reset banner dismissal when failure info changes
  useEffect(() => {
    if (failureInfo.hasFailure && failureInfo.isRecentFailure) {
      setBannerDismissed(false);
    }
  }, [failureInfo.hasFailure, failureInfo.isRecentFailure, failureInfo.retryCount]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  return {
    failureInfo,
    loading: effectiveLoading,
    dismissBanner,
    bannerDismissed,
  };
}
