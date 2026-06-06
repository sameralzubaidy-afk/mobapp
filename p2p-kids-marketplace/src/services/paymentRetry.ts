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

  const candidate = err as Record<string, unknown>;

  const directCode = typeof candidate.code === 'string' ? candidate.code : null;
  const directMessage = typeof candidate.message === 'string' ? candidate.message : null;

  // Try to extract error from supabase.functions.invoke response
  // The error object may have different shapes depending on environment:
  // 1. FunctionsHttpError with context (Response object) - production / dev
  // 2. { context: { data } } - Expo Go / dev with relay
  // 3. { message, code } - direct error
  try {
    const context = candidate.context;

    // Case 1: context is a Response object (FunctionsHttpError)
    if (context && typeof context === 'object' && 'json' in (context as any)) {
      try {
        const response = context as Response;
        const body = await response.json() as Record<string, unknown>;
        // Edge functions return { success: false, error: { code, message } }
        const errorObj = body.error as Record<string, unknown> | undefined;
        if (errorObj && typeof errorObj === 'object') {
          const code = typeof errorObj.code === 'string' ? errorObj.code : null;
          const message = typeof errorObj.message === 'string' ? errorObj.message : null;
          if (code || message) {
            return { code: code || fallback.code, message: message || fallback.message };
          }
        }
        // Fallback: check top-level code/message
        const topCode = typeof body.code === 'string' ? body.code : null;
        const topMessage = typeof body.message === 'string' ? body.message : null;
        if (topCode || topMessage) {
          return { code: topCode || fallback.code, message: topMessage || fallback.message };
        }
      } catch {
        // Response.json() failed, try text()
        try {
          const response = context as Response;
          const text = await response.text();
          if (text) {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const errorObj = parsed.error as Record<string, unknown> | undefined;
            if (errorObj && typeof errorObj === 'object') {
              const code = typeof errorObj.code === 'string' ? errorObj.code : null;
              const message = typeof errorObj.message === 'string' ? errorObj.message : null;
              if (code || message) {
                return { code: code || fallback.code, message: message || fallback.message };
              }
            }
            const topCode = typeof parsed.code === 'string' ? parsed.code : null;
            const topMessage = typeof parsed.message === 'string' ? parsed.message : null;
            if (topCode || topMessage) {
              return { code: topCode || fallback.code, message: topMessage || fallback.message };
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // Case 2: context.data (Expo Go relay shape)
    if (context && typeof context === 'object') {
      const ctx = context as Record<string, unknown>;
      const contextData = ctx.data;
      if (contextData && typeof contextData === 'object') {
        const dataObj = contextData as Record<string, unknown>;
        const payloadError = dataObj.error as Record<string, unknown> | undefined;
        if (payloadError && typeof payloadError === 'object') {
          const code = typeof payloadError.code === 'string' ? payloadError.code : null;
          const message = typeof payloadError.message === 'string' ? payloadError.message : null;
          if (code || message) {
            return { code: code || fallback.code, message: message || fallback.message };
          }
        }
        const payloadCode = typeof dataObj.code === 'string' ? dataObj.code : null;
        const payloadMessage = typeof dataObj.message === 'string' ? dataObj.message : null;
        if (payloadCode || payloadMessage) {
          return { code: payloadCode || fallback.code, message: payloadMessage || fallback.message };
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
      } else if (parsedError.code === 'NO_FAILED_PAYMENT') {
        console.log('[paymentRetry] No failed payment to retry (normal when adding new payment method)');
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
