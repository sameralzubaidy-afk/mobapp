// File: p2p-kids-marketplace/src/services/emailChange.ts
// Dev Task B02 (ACC-TC-B02): email re-verification on change (Option A).
//
// Talks to the auth-email-change Edge Function. The OLD email stays active on
// auth.users + profiles until the 6-digit code emailed to the NEW address is
// verified; only then does the Edge Function apply the change.
//
// Actions:
//   requestEmailChange(newEmail)  -> mint a pending request + email the code
//   resendEmailChangeCode()       -> re-arm the latest pending request + re-email
//   verifyEmailChangeCode(code)   -> check the code; on success the EF applies
//                                    the new email and returns it

import { supabase } from './supabase/client';
import { captureException } from './errorReporter';

export type EmailChangeErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_EMAIL'
  | 'SAME_EMAIL'
  | 'EMAIL_IN_USE'
  | 'CODE_REQUIRED'
  | 'INVALID_CODE'
  | 'CODE_EXPIRED'
  | 'MAX_ATTEMPTS'
  | 'NO_PENDING_REQUEST'
  | 'EMAIL_SEND_FAILED'
  | 'EMAIL_APPLY_FAILED'
  | 'INTERNAL';

export type EmailChangeResult = {
  success: boolean;
  newEmail?: string;
  message?: string;
  error?: { code: EmailChangeErrorCode | string; message: string };
};

type EdgeFunctionErrorPayload = {
  error?: { code?: string; message?: string } | string;
  message?: string;
};

/**
 * FunctionsHttpError carries the real response body in `.context` (a Response).
 * Its `.message` is a generic "non-2xx status code" string — always parse the
 * context JSON (BP-39).
 */
async function parseEdgeFunctionErrorPayload(
  error: unknown
): Promise<EdgeFunctionErrorPayload | null> {
  const context = (
    error as {
      context?: { clone?: () => { json?: () => Promise<unknown> } };
    }
  )?.context;

  if (!context?.clone) {
    return null;
  }

  try {
    const payload = await context.clone().json?.();
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    return payload as EdgeFunctionErrorPayload;
  } catch {
    return null;
  }
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

async function invokeEmailChange(body: Record<string, unknown>): Promise<EmailChangeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('auth-email-change', { body });

    if (error) {
      const payload = await parseEdgeFunctionErrorPayload(error);
      const err = payload?.error;
      if (typeof err === 'object' && err && err.message) {
        return {
          success: false,
          error: { code: err.code || 'INTERNAL', message: err.message },
        };
      }
      return {
        success: false,
        error: { code: 'INTERNAL', message: payload?.message || GENERIC_ERROR },
      };
    }

    if (!data || (data as { success?: boolean }).success !== true) {
      return { success: false, error: { code: 'INTERNAL', message: GENERIC_ERROR } };
    }

    const d = data as { message?: string; newEmail?: string };
    return {
      success: true,
      message: d.message,
      newEmail: d.newEmail,
    };
  } catch (err) {
    captureException(err, {
      tags: { service: 'emailChange', action: 'invoke' },
      extra: { body: JSON.stringify(body) },
    });
    const message = err instanceof Error ? err.message : GENERIC_ERROR;
    return { success: false, error: { code: 'INTERNAL', message } };
  }
}

/** Start an email change: emails a 6-digit code to the new address. */
export const requestEmailChange = (newEmail: string): Promise<EmailChangeResult> =>
  invokeEmailChange({ action: 'request', newEmail });

/** Re-send the code for the latest pending email change. */
export const resendEmailChangeCode = (): Promise<EmailChangeResult> =>
  invokeEmailChange({ action: 'resend' });

/** Verify the code; on success the Edge Function applies the new email. */
export const verifyEmailChangeCode = (code: string): Promise<EmailChangeResult> =>
  invokeEmailChange({ action: 'verify', code });
