// File: supabase/functions/auth-email-change/index.ts
// Dev Task B02 (ACC-TC-B02): Email change requires re-verification (Option A).
//
// User-initiated email change with a 6-digit verification code emailed to the
// NEW address. The OLD email stays active (auth.users.email + profiles.email
// are untouched) until the code is verified; then the new email is applied via
// the admin API and the pending request is sealed.
//
// POST /functions/v1/auth-email-change   (Bearer: user JWT)
//   request: { action: 'request', newEmail: string }
//   resend:  { action: 'resend' }
//   verify:  { action: 'verify', code: string }
//
// Auth: user JWT verified via admin.auth.getUser(token) (mirrors auth-update-phone).
// DB writes go through the SECURITY DEFINER RPCs created by
// 20260825000001_email_change_verification.sql; the code is stored only as a
// bcrypt hash (reuses public.hash_otp_code from 20260820000001).
// Email delivery reuses the existing send-email function (new 'change_email'
// type, isCritical = true so it always sends and skips the unsubscribe-token
// path).

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || SERVICE_ROLE_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

// QA/test dev gate (server-controlled, never trusted from the client): when
// DEV_EMAIL_CODE_FIXED=true the emailed code is the fixed 123456 so QA can
// verify ACC-TC-B02 on staging without reading the email. OFF in production.
const DEV_EMAIL_CODE_FIXED = Deno.env.get('DEV_EMAIL_CODE_FIXED') === 'true';
const FIXED_DEV_CODE = '123456';

interface JsonError {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function jsonError(code: string, message: string, status: number, details?: Record<string, unknown>): Response {
  const body: JsonError = { success: false, error: { code, message, ...(details ? { details } : {}) } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function generateCode(): string {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const num = Array.from(array).reduce((acc, val) => acc * 256 + val, 0);
  return ((num % 900000) + 100000).toString(); // 100000-999999
}

/**
 * Send the verification email through the existing send-email function.
 * isCritical = true + no category => always sends, no preference check,
 * no unsubscribe-token path (avoids the known generate_unsubscribe_token
 * search_path defect on staging).
 */
async function sendVerificationEmail(
  to: string,
  userId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        type: 'change_email',
        to,
        userId,
        isCritical: true,
        data: { code, newEmail: to },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error || `send-email responded ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Best-effort security alert to the OLD email after a successful change.
 * Non-blocking — a failure here never fails the email-change completion.
 */
async function sendOldEmailSecurityAlert(
  oldEmail: string,
  userId: string,
  newEmail: string
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        type: 'security_alert',
        to: oldEmail,
        userId,
        isCritical: true,
        data: {
          alertType: 'email_changed',
          alertMessage: `Your account email was changed to ${newEmail}. If this wasn't you, contact support.`,
        },
      }),
    });
  } catch (err) {
    console.error('[auth-email-change] Old-email security alert failed (non-blocking):', err);
  }
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return jsonError('SERVER_NOT_CONFIGURED', 'Server not configured: missing service role key', 500);
    }

    // ---- Authenticate the caller via their JWT (mirrors auth-update-phone) ----
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace(/Bearer\s+/i, '').trim();
    if (!token) {
      return jsonError('UNAUTHORIZED', 'Missing authorization token', 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonError('UNAUTHORIZED', 'Invalid or expired session', 401);
    }
    const userId = authData.user.id;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    // =============================================================
    // ACTION: request — mint a pending email change + email the code
    // =============================================================
    if (action === 'request') {
      const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(newEmail)) {
        return jsonError('INVALID_EMAIL', 'Please enter a valid email address.', 400);
      }
      const currentEmail = (authData.user.email || '').toLowerCase();
      if (newEmail === currentEmail) {
        return jsonError('SAME_EMAIL', 'That is already your account email.', 400);
      }

      // Uniqueness: no other user may already have this email.
      const { data: existing } = await admin
        .schema('auth')
        .from('users')
        .select('id')
        .eq('email', newEmail)
        .maybeSingle();
      if (existing && existing.id !== userId) {
        return jsonError('EMAIL_IN_USE', 'That email is already used by another account.', 409);
      }

      const code = DEV_EMAIL_CODE_FIXED ? FIXED_DEV_CODE : generateCode();

      const { data: codeHash, error: hashError } = await admin.rpc('hash_otp_code', { p_code: code });
      if (hashError || !codeHash) {
        console.error('[auth-email-change] hash_otp_code failed:', hashError);
        return jsonError('INTERNAL', 'We couldn\'t secure your verification code. Please try again.', 500);
      }

      const { data: requestId, error: requestError } = await admin.rpc('create_email_change_request', {
        p_user_id: userId,
        p_new_email: newEmail,
        p_code_hash: codeHash,
      });
      if (requestError) {
        console.error('[auth-email-change] create_email_change_request failed:', requestError);
        return jsonError('INTERNAL', 'We couldn\'t start your email change. Please try again.', 500);
      }

      const email = await sendVerificationEmail(newEmail, userId, code);
      if (!email.ok) {
        console.error('[auth-email-change] verification email send failed:', email.error);
        return jsonError('EMAIL_SEND_FAILED', 'We sent the code but couldn\'t deliver it. Please try again.', 500);
      }

      console.log('[auth-email-change] request created', { userId, requestId });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Verification code sent to your new email.',
          requestId,
          newEmail,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================================
    // ACTION: resend — re-arm the latest pending request + re-email
    // =============================================================
    if (action === 'resend') {
      const code = DEV_EMAIL_CODE_FIXED ? FIXED_DEV_CODE : generateCode();
      const { data: codeHash, error: hashError } = await admin.rpc('hash_otp_code', { p_code: code });
      if (hashError || !codeHash) {
        console.error('[auth-email-change] resend hash_otp_code failed:', hashError);
        return jsonError('INTERNAL', 'We couldn\'t secure your verification code. Please try again.', 500);
      }

      const { data: resendResult, error: resendError } = await admin.rpc('resend_email_change_code', {
        p_user_id: userId,
        p_code_hash: codeHash,
      });
      if (resendError || !resendResult?.success) {
        const msg = resendResult?.error === 'NO_PENDING_REQUEST'
          ? 'There\'s no pending email change to resend. Please change your email again.'
          : 'We couldn\'t resend your code. Please try again.';
        return jsonError(resendResult?.error === 'NO_PENDING_REQUEST' ? 'NO_PENDING_REQUEST' : 'INTERNAL', msg, 400);
      }

      const email = await sendVerificationEmail(resendResult.new_email, userId, code);
      if (!email.ok) {
        console.error('[auth-email-change] resend email send failed:', email.error);
        return jsonError('EMAIL_SEND_FAILED', 'We couldn\'t deliver the code. Please try again.', 500);
      }

      console.log('[auth-email-change] code resent', { userId });
      return new Response(
        JSON.stringify({ success: true, message: 'A new verification code was sent.', newEmail: resendResult.new_email }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================================
    // ACTION: verify — check the code, then apply the new email
    // =============================================================
    if (action === 'verify') {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!CODE_RE.test(code)) {
        return jsonError('CODE_REQUIRED', 'Please enter the 6-digit code.', 400);
      }

      const { data: verifyResult, error: verifyError } = await admin.rpc('verify_email_change_code', {
        p_user_id: userId,
        p_code: code,
      });
      if (verifyError) {
        console.error('[auth-email-change] verify_email_change_code failed:', verifyError);
        return jsonError('INTERNAL', 'We couldn\'t verify that code. Please try again.', 500);
      }

      if (!verifyResult?.success) {
        const message = verifyResult?.message || 'Verification failed. Please try again.';
        const map: Record<string, { code: string; status: number }> = {
          'No active verification request. Request a new code.': { code: 'NO_PENDING_REQUEST', status: 400 },
          'This code has expired. Request a new one.': { code: 'CODE_EXPIRED', status: 400 },
          'Too many attempts. Request a new code.': { code: 'MAX_ATTEMPTS', status: 400 },
          'That code didn\'t match. Check it and try again.': { code: 'INVALID_CODE', status: 400 },
        };
        const mapped = map[message] || { code: 'INVALID_CODE', status: 400 };
        return jsonError(mapped.code, message, mapped.status);
      }

      const newEmail = verifyResult.new_email;
      if (!newEmail) {
        return jsonError('INTERNAL', 'Verification succeeded but no target email was found. Please try again.', 500);
      }

      const oldEmail = (authData.user.email || '').toLowerCase();

      // 1. Apply the new email via the admin API (confirmed — we verified it ourselves).
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });
      if (updateError) {
        console.error('[auth-email-change] admin.updateUserById failed:', updateError);
        return jsonError('EMAIL_APPLY_FAILED', 'We verified your code but couldn\'t update your email. Please try again.', 500);
      }

      // 2. Sync the profile email.
      const { error: profileError } = await admin
        .from('profiles')
        .update({ email: newEmail })
        .eq('user_id', userId);
      if (profileError) {
        console.warn('[auth-email-change] profiles.email sync failed (non-blocking):', profileError);
      }

      // 3. Seal all pending requests so the verified row cannot be replayed.
      const { error: completeError } = await admin.rpc('complete_email_change', {
        p_user_id: userId,
        p_new_email: newEmail,
      });
      if (completeError) {
        console.warn('[auth-email-change] complete_email_change failed (non-blocking):', completeError);
      }

      // 4. Best-effort security alert to the old address.
      await sendOldEmailSecurityAlert(oldEmail, userId, newEmail);

      console.log('[auth-email-change] email changed', { userId, newEmail });
      return new Response(
        JSON.stringify({ success: true, message: 'Your email has been updated.', newEmail }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return jsonError('INVALID_ACTION', 'Unknown action. Use request, resend, or verify.', 400);
  } catch (err) {
    console.error('[auth-email-change] exception:', err);
    return jsonError('INTERNAL', 'Something went wrong. Please try again.', 500);
  }
});
