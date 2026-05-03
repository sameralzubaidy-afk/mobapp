// File: p2p-kids-marketplace/src/services/phoneService.ts
// Phone verification service using Twilio SMS + hashed OTPs + rate limiting
// Consolidates logic from phone.ts and verification.ts with AUTH-V3-006 requirements

import { supabase } from './supabase/client';

/**
 * Error codes for phone verification operations
 */
export enum PhoneVerificationErrorCode {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_INVALID = 'OTP_INVALID',
  OTP_MAX_ATTEMPTS = 'OTP_MAX_ATTEMPTS',
  SEND_FAILED = 'SEND_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * OTP rate limit error with retry timing
 */
export class OTPRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number
  ) {
    super(message);
    this.name = 'OTPRateLimitError';
  }
}

/**
 * OTP expired error
 */
export class OTPExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OTPExpiredError';
  }
}

/**
 * Check if phone verification is required for a user
 *
 * @param userId - User ID to check
 * @returns true if phone_verified_at is NULL, false otherwise
 *
 * @example
 * ```ts
 * const required = await isPhoneRequired(user.id);
 * if (required) {
 *   // Show phone verification modal
 * }
 * ```
 */
export async function isPhoneRequired(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('phone_verified_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[phoneService] isPhoneRequired query error:', error);
      return true; // Graceful fallback: assume verification required
    }

    return data?.phone_verified_at === null || data?.phone_verified_at === undefined;
  } catch (err) {
    console.error('[phoneService] isPhoneRequired exception:', err);
    return true; // Graceful fallback
  }
}

/**
 * Send phone verification code via Twilio SMS
 *
 * Process:
 * 1. Calls send-phone-otp Edge Function (contains Twilio secrets)
 * 2. Edge Function enforces rate limits:
 *    - 3 per phone per hour
 *    - 5 per user per day
 * 3. Edge Function generates 6-digit code, hashes with bcrypt, stores in DB
 * 4. Edge Function sends SMS via Twilio
 *
 * @param phone - Phone number in E.164 format (e.g., +12345678900)
 * @returns Success status
 *
 * @throws {OTPRateLimitError} If rate limit exceeded (contains retryAfterSeconds)
 * @throws {Error} If send failed
 *
 * @example
 * ```ts
 * try {
 *   await sendPhoneVerificationCode('+12025551234');
 *   // Show "Code sent" message
 * } catch (err) {
 *   if (err instanceof OTPRateLimitError) {
 *     console.log(`Try again in ${err.retryAfterSeconds} seconds`);
 *   }
 * }
 * ```
 */
export async function sendPhoneVerificationCode(phone: string): Promise<void> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // Call Edge Function to generate + send OTP
    const { data, error } = await supabase.functions.invoke('send-phone-otp', {
      body: { phone, user_id: user.id },
    });

    if (error) {
      console.error('[phoneService] send-phone-otp invoke error:', error);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }

    // Check response for errors
    if (data?.error) {
      // Rate limit error
      if (data.code === PhoneVerificationErrorCode.RATE_LIMIT_EXCEEDED) {
        throw new OTPRateLimitError(
          data.error,
          data.retryAfterSeconds || 3600 // Default 1 hour
        );
      }

      // Other errors
      throw new Error(data.error);
    }

    console.log('[phoneService] Verification code sent to', phone);
  } catch (err) {
    const error = err as Error;
    console.error('[phoneService] sendPhoneVerificationCode failed:', error);

    // Re-throw OTPRateLimitError as-is
    if (error instanceof OTPRateLimitError) {
      throw error;
    }

    // Wrap other errors
    throw new Error(error.message || 'Failed to send verification code');
  }
}

/**
 * Verify phone verification code
 *
 * Process:
 * 1. SELECTs latest unexpired row for (phone, user_id)
 * 2. Compares code using pgcrypto: crypt(code, code_hash) = code_hash
 * 3. Increments attempts counter
 * 4. On success:
 *    - UPDATEs user_profiles.phone_verified_at = now()
 *    - UPDATEs user_profiles.phone_verification_method = 'sms'
 *    - Writes audit_log entry
 *
 * @param phone - Phone number that was verified
 * @param code - 6-digit verification code
 * @returns Success status
 *
 * @throws {OTPExpiredError} If code expired
 * @throws {Error} If code invalid or max attempts exceeded
 *
 * @example
 * ```ts
 * try {
 *   await verifyPhoneCode('+12025551234', '123456');
 *   // Phone verified successfully
 * } catch (err) {
 *   if (err instanceof OTPExpiredError) {
 *     console.log('Code expired, request new one');
 *   } else {
 *     console.log('Invalid code');
 *   }
 * }
 * ```
 */
export async function verifyPhoneCode(phone: string, code: string): Promise<void> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // 1. Get latest unexpired verification code for this phone + user
    const { data: verificationRecord, error: fetchError } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone', phone)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[phoneService] Failed to fetch verification code:', fetchError);
      throw new Error('Verification failed');
    }

    if (!verificationRecord) {
      throw new OTPExpiredError('Verification code expired or not found');
    }

    // 2. Check max attempts (3 max)
    if (verificationRecord.attempts >= 3) {
      throw new Error('Maximum verification attempts exceeded');
    }

    // 3. Verify code using pgcrypto crypt comparison
    // Note: The Edge Function stores code_hash using crypt(code, gen_salt('bf'))
    // To verify, we use: crypt(input_code, stored_hash) = stored_hash
    const { data: cryptResult, error: cryptError } = await supabase.rpc('verify_otp_code', {
      p_verification_id: verificationRecord.id,
      p_code: code,
    });

    if (cryptError) {
      console.error('[phoneService] verify_otp_code RPC error:', cryptError);

      // Increment attempts even on RPC error
      await supabase
        .from('phone_verification_codes')
        .update({ attempts: verificationRecord.attempts + 1 })
        .eq('id', verificationRecord.id);

      throw new Error('Verification failed');
    }

    // cryptResult should be { success: boolean, message?: string }
    const result = cryptResult as { success: boolean; message?: string };

    if (!result?.success) {
      throw new Error(result?.message || 'Invalid verification code');
    }

    // 4. On success: Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        phone_verified_at: new Date().toISOString(),
        phone_verification_method: 'sms',
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[phoneService] Failed to update profile:', profileError);
      throw new Error('Failed to save verification status');
    }

    // 5. Write audit log
    await supabase.from('admin_audit_logs').insert({
      user_id: user.id,
      action: 'phone_verified',
      details: {
        phone,
        method: 'sms',
        verified_at: new Date().toISOString(),
      },
    });

    console.log('[phoneService] Phone verified successfully:', phone);
  } catch (err) {
    const error = err as Error;
    console.error('[phoneService] verifyPhoneCode failed:', error);

    // Re-throw specific errors
    if (error instanceof OTPExpiredError) {
      throw error;
    }

    // Wrap generic errors
    throw new Error(error.message || 'Verification failed');
  }
}

/**
 * Get user-friendly error messages for phone verification errors
 */
export function getPhoneErrorMessage(code: PhoneVerificationErrorCode): string {
  switch (code) {
    case PhoneVerificationErrorCode.RATE_LIMIT_EXCEEDED:
      return 'Too many attempts. Please try again later';
    case PhoneVerificationErrorCode.OTP_EXPIRED:
      return 'Verification code expired. Please request a new one';
    case PhoneVerificationErrorCode.OTP_INVALID:
      return 'Invalid verification code';
    case PhoneVerificationErrorCode.OTP_MAX_ATTEMPTS:
      return 'Maximum attempts exceeded. Please request a new code';
    case PhoneVerificationErrorCode.SEND_FAILED:
      return 'Failed to send verification code. Please try again';
    case PhoneVerificationErrorCode.VERIFICATION_FAILED:
      return 'Verification failed. Please try again';
    case PhoneVerificationErrorCode.NOT_FOUND:
      return 'Verification code not found';
    default:
      return 'Verification error';
  }
}
