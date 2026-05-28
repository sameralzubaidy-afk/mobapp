/**
 * FILE: p2p-kids-marketplace/src/services/paymentRetry.ts
 * MODULE-11 TASK SUB-018: Payment Failure Retry Service
 *
 * Service for handling payment failure retry logic
 */

import { supabase } from '../config/supabase';

interface ParsedRetryError {
  code: string;
  message: string;
}

async function parseRetryError(err: unknown): Promise<ParsedRetryError> {
  const fallback: ParsedRetryError = {
    code: 'EDGE_FUNCTION_ERROR',
    message: err instanceof Error ? err.message : 'Unknown error occurred',
  };

  if (!err || typeof err !== 'object') {
    return fallback;
  }

  const candidate = err as {
    message?: unknown;
    code?: unknown;
    context?: {
      clone?: () => { text: () => Promise<string> };
      text?: () => Promise<string>;
    };
  };

  const directCode = typeof candidate.code === 'string' ? candidate.code : null;
  const directMessage = typeof candidate.message === 'string' ? candidate.message : null;

  try {
    const responseLike = candidate.context;
    if (responseLike) {
      let payloadText: string | null = null;

      if (typeof responseLike.clone === 'function') {
        payloadText = await responseLike.clone().text();
      } else if (typeof responseLike.text === 'function') {
        payloadText = await responseLike.text();
      }

      if (payloadText) {
        const parsed = JSON.parse(payloadText) as {
          error?: { code?: string; message?: string };
          code?: string;
          message?: string;
        };

        const payloadCode = parsed.error?.code || parsed.code;
        const payloadMessage = parsed.error?.message || parsed.message;

        if (payloadCode || payloadMessage) {
          return {
            code: payloadCode || directCode || fallback.code,
            message: payloadMessage || directMessage || fallback.message,
          };
        }
      }
    }
  } catch {
    // Ignore parse failures and return fallback details.
  }

  return {
    code: directCode || fallback.code,
    message: directMessage || fallback.message,
  };
}

export interface RetryPaymentResult {
  success: boolean;
  message: string;
  subscription?: {
    status: string;
    payment_retry_count: number;
    current_period_end: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface RetryPaymentOptions {
  resolveWithoutInvoice?: boolean;
}

/**
 * Retry a failed payment for the authenticated user
 * Calls the retry-failed-payment Edge Function
 *
 * @param userId - User ID (for authorization validation)
 * @returns Result indicating success/failure and updated subscription state
 */
export async function retryFailedPayment(
  userId: string,
  options?: RetryPaymentOptions
): Promise<RetryPaymentResult> {
  try {
    const { data, error } = await supabase.functions.invoke('retry-failed-payment', {
      body: {
        user_id: userId,
        ...(options?.resolveWithoutInvoice ? { resolve_without_invoice: true } : {}),
      },
    });

    if (error) {
      const parsedError = await parseRetryError(error);

      if (parsedError.code === 'NO_OPEN_INVOICE') {
        console.log('[paymentRetry] No open invoice available for immediate retry');
      } else if (parsedError.code === 'NOT_FOUND') {
        console.log(
          '[paymentRetry] retry-failed-payment function is not deployed in this environment'
        );
      } else {
        console.error('[paymentRetry] Edge Function error:', parsedError);
      }

      return {
        success: false,
        message: parsedError.message,
        error: {
          code: parsedError.code,
          message: parsedError.message,
        },
      };
    }

    return data as RetryPaymentResult;
  } catch (err) {
    const parsedError = await parseRetryError(err);
    const hasHttpContext =
      !!err && typeof err === 'object' && 'context' in (err as Record<string, unknown>);
    const normalizedCode =
      parsedError.code === 'EDGE_FUNCTION_ERROR' && !hasHttpContext
        ? 'UNKNOWN_ERROR'
        : parsedError.code;

    console.error('[paymentRetry] Unexpected error:', parsedError);
    return {
      success: false,
      message: parsedError.message,
      error: {
        code: normalizedCode || 'UNKNOWN_ERROR',
        message: parsedError.message,
      },
    };
  }
}

/**
 * Send payment failure notification to user
 * Called after each failed payment attempt
 *
 * @param userId - User ID to notify
 * @param retryCount - Current retry count (1, 2, or 3)
 * @returns Success status
 */
export async function sendPaymentFailureNotification(
  userId: string,
  retryCount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: _data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title: 'Payment Failed',
        body: getNotificationBodyForRetryCount(retryCount),
        data: {
          type: 'payment_failure',
          retry_count: retryCount.toString(),
          action: 'update_payment_method',
        },
      },
    });

    if (error) {
      console.error('[paymentRetry] Failed to send notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[paymentRetry] Notification error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get notification body text based on retry count
 */
function getNotificationBodyForRetryCount(retryCount: number): string {
  switch (retryCount) {
    case 1:
      return 'Your payment was declined. Please update your payment method to keep your subscription active.';
    case 2:
      return 'Your subscription payment was declined again. Please update your card or it will be paused.';
    case 3:
      return 'Your Kids Club+ access has been paused. Re-subscribe to restore your Swap Points.';
    default:
      return 'There was an issue with your subscription payment. Please update your payment method.';
  }
}
