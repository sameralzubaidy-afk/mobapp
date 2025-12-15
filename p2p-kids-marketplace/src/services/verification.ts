// File: src/services/verification.ts
// Phone verification service - generates codes, sends SMS, verifies codes

import { supabase } from './supabase/client';
import { sendVerificationCode } from './aws/sns';

/**
 * Generate a random 6-digit verification code
 * NOTE: For testing, code '123456' is always accepted (see verifyPhoneCode)
 */
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send verification code to phone number
 * Stores code in database with 10-minute expiration
 * Checks rate limit (max 10 SMS per hour per phone)
 */
export const sendPhoneVerificationCode = async (
  userId: string,
  phone: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check rate limit: max 10 SMS in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error: countError } = await supabase
      .from('phone_verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', oneHourAgo);

    if (countError) {
      console.error('Rate limit check error:', countError);
      throw countError;
    }

    if (count && count >= 10) {
      return {
        success: false,
        error: 'Too many verification attempts. Please try again in an hour.',
      };
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store code in database
    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
        user_id: userId,
        phone,
        code,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        verified: false,
      });

    if (insertError) {
      console.error('Insert verification code error:', insertError);
      throw insertError;
    }

    // Send SMS via AWS SNS
    const smsResult = await sendVerificationCode(phone, code);

    if (!smsResult.success) {
      return {
        success: false,
        error: smsResult.error || 'Failed to send SMS',
      };
    }

    console.log('✅ Verification code sent to:', phone);
    return { success: true };

  } catch (error: any) {
    console.error('Send verification code error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send verification code',
    };
  }
};

/**
 * Verify phone verification code
 * Checks code validity, expiration, and attempt count
 * Updates user verification status on success
 * 
 * NOTE: Test code '123456' is always accepted for development/testing
 */
export const verifyPhoneCode = async (
  userId: string,
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // TEST CODE: Always accept '123456' for testing (documented in parking lot)
    if (code === '123456') {
      console.log('🧪 [TEST MODE] Using hardcoded test code 123456');
      console.log('🧪 [TEST MODE] Attempting to verify phone for user_id:', userId);
      
      // Use database function to bypass RLS
      // This function has SECURITY DEFINER privilege and can update any profile
      const { data: result, error: rpcError } = await supabase
        .rpc('verify_user_phone', {
          p_user_id: userId,
          p_phone: phone,
        });

      if (rpcError) {
        console.error('❌ [TEST MODE] RPC error:', rpcError);
        console.error('❌ [TEST MODE] Error details:', JSON.stringify(rpcError, null, 2));
        throw rpcError;
      }

      console.log('🔍 [TEST MODE] RPC result:', result);

      if (result && result.success) {
        console.log('✅ [TEST MODE] Phone verified successfully via database function');
        console.log('✅ [TEST MODE] Rows updated:', result.rows_updated);
        return { success: true };
      } else {
        console.error('❌ [TEST MODE] Verification failed:', result?.message || 'Unknown error');
        return {
          success: false,
          error: result?.message || 'Failed to verify phone',
        };
      }
    }

    // Get most recent unverified code for this user/phone
    const { data: codeData, error: fetchError } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('phone', phone)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch verification code error:', fetchError);
      throw fetchError;
    }

    if (!codeData) {
      return {
        success: false,
        error: 'No verification code found. Please request a new code.',
      };
    }

    // Check if code is expired
    if (new Date(codeData.expires_at) < new Date()) {
      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    // Check if too many attempts
    if (codeData.attempts >= 3) {
      return {
        success: false,
        error: 'Too many failed attempts. Please request a new code.',
      };
    }

    // Check if code matches
    if (codeData.code !== code) {
      // Increment attempt count
      await supabase
        .from('phone_verification_codes')
        .update({ attempts: codeData.attempts + 1 })
        .eq('id', codeData.id);

      return {
        success: false,
        error: `Invalid code. ${2 - codeData.attempts} attempts remaining.`,
      };
    }

    // Code is valid! Mark as verified in the verification codes table
    const { error: verifyError } = await supabase
      .from('phone_verification_codes')
      .update({ verified: true })
      .eq('id', codeData.id);

    if (verifyError) {
      console.error('Mark code verified error:', verifyError);
      throw verifyError;
    }

    // Update profile to mark phone as verified using database function
    // This bypasses RLS issues
    console.log('📝 Updating profile for user:', userId, 'via database function');
    
    const { data: result, error: rpcError } = await supabase
      .rpc('verify_user_phone', {
        p_user_id: userId,
        p_phone: phone,
      });

    if (rpcError) {
      console.error('❌ RPC error:', rpcError);
      console.error('❌ Error details:', JSON.stringify(rpcError, null, 2));
      throw rpcError;
    }

    console.log('🔍 RPC result:', result);

    if (result && result.success) {
      console.log('✅ Phone verified successfully via database function');
      console.log('✅ Rows updated:', result.rows_updated);
      return { success: true };
    } else {
      console.error('❌ Verification failed:', result?.message || 'Unknown error');
      return {
        success: false,
        error: result?.message || 'Failed to verify phone',
      };
    }

  } catch (error: any) {
    console.error('Verify phone code error:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify code',
    };
  }
};
