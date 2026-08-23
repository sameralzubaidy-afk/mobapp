import { supabase } from './supabase/client';
import { captureException } from './errorReporter';

const DEV_BYPASS_CODE = '123456';

const updatePhoneOnProfileFallback = async (userId: string, phone: string) => {
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ phone, phone_verified: true, phone_verified_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (profileErr) {
    return { success: false as const, error: profileErr };
  }

  return {
    success: true as const,
    message: 'Phone verified and saved to profile (auth phone not updated)',
  };
};

/**
 * Request a phone verification code for a user and phone
 * Inserts a new row into phone_verification_codes and (in real env) sends an SMS
 */
export const requestPhoneVerification = async (
  userId: string,
  phone: string
): Promise<{ success: boolean; code?: string; error?: Error | object }> => {
  try {
    // Hardcode verification code to '123456' for manual testing purposes
    const code = '123456';

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { error } = await supabase.from('phone_verification_codes').insert({
      user_id: userId,
      phone,
      code,
      expires_at: expiresAt,
      attempts: 0,
      verified: false,
    });

    if (error) {
      if (__DEV__) {
        console.warn('requestPhoneVerification insert error (dev bypass):', error);
        console.warn(
          `[DEV BYPASS] Proceeding without DB insert. Use code ${DEV_BYPASS_CODE} for ${phone}`
        );
        return { success: true, code: DEV_BYPASS_CODE };
      }
      captureException(error, {
        tags: { service: 'phone', action: 'request_insert_error' },
      });
      return { success: false, error };
    }

    // TODO: Integrate SMS provider (Twilio) to send `code` to `phone`.
    console.warn(`📱 [TEST MODE] Verification code for ${phone}: ${code}`);

    return { success: true, code };
  } catch (error) {
    const err = error as Error;
    captureException(err, {
      tags: { service: 'phone', action: 'request_exception' },
    });
    return { success: false, error: err };
  }
};

/**
 * Verify a phone code using the stored function verify_phone_code RPC
 * If verification succeeds, update auth.user.phone to the verified phone number
 */
export const verifyPhoneCode = async (
  userId: string,
  code: string,
  fallbackPhone?: string
): Promise<{ success: boolean; message?: string; error?: Error | object }> => {
  try {
    if (__DEV__ && code === DEV_BYPASS_CODE) {
      let phone = fallbackPhone;

      if (!phone) {
        const { data: latestCodeRow } = await supabase
          .from('phone_verification_codes')
          .select('phone')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        phone = latestCodeRow?.phone;
      }

      if (!phone) {
        return { success: true, message: 'Phone verified in dev mode' };
      }

      try {
        const invokeRes = await supabase.functions.invoke('auth-update-phone', {
          body: { user_id: userId, phone },
        });

        const { data: fnData, error: fnError } = invokeRes;
        if (fnError) {
          console.warn(
            'auth-update-phone invoke SDK error (dev bypass); using profile fallback:',
            fnError
          );
          const fallback = await updatePhoneOnProfileFallback(userId, phone);
          if (!fallback.success) {
            captureException(fallback.error, {
              tags: { service: 'phone', action: 'dev_bypass_fallback_sdk' },
            });
            return { success: false, error: fallback.error };
          }
          return { success: true, message: fallback.message };
        }

        if (fnData && (fnData.error || fnData?.status >= 400)) {
          console.warn(
            'auth-update-phone returned non-2xx in dev bypass; using profile fallback:',
            fnData
          );
          const fallback = await updatePhoneOnProfileFallback(userId, phone);
          if (!fallback.success) {
            captureException(fallback.error, {
              tags: { service: 'phone', action: 'dev_bypass_fallback_non2xx' },
            });
            return { success: false, error: fallback.error };
          }
          return { success: true, message: fallback.message };
        }

        return { success: true, message: 'Phone verified in dev mode and updated' };
      } catch (error) {
        const err = error as Error;
        console.warn('Dev bypass auth-update-phone exception; using profile fallback:', err);
        const fallback = await updatePhoneOnProfileFallback(userId, phone);
        if (!fallback.success) {
          captureException(fallback.error, {
            tags: { service: 'phone', action: 'dev_bypass_fallback_exception' },
          });
          return { success: false, error: fallback.error };
        }
        return { success: true, message: fallback.message };
      }
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('verify_phone_code', {
      p_user_id: userId,
      p_code: code,
    });
    if (rpcError) {
      captureException(rpcError, {
        tags: { service: 'phone', action: 'verify_phone_code_rpc' },
      });
      // Handle ambiguous column error specifically with helpful message
      if (rpcError.code === '42702') {
        return {
          success: false,
          error: new Error(
            'Server function ambiguity error: please run the verify_phone_code migration to fix the function on the database.'
          ),
        };
      }
      return { success: false, error: rpcError };
    }

    // rpcResult is expected to be an array/record with success flag and message
    const result = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as {
      success: boolean;
      message?: string;
    } | null;
    if (!result || !result.success) {
      return { success: false, message: result?.message || 'Verification failed' };
    }

    // Find the verified phone code row to get the phone number
    const { data: vrow, error: verror } = await supabase
      .from('phone_verification_codes')
      .select('phone')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verror) {
      captureException(verror, {
        tags: { service: 'phone', action: 'fetch_verified_row' },
      });
      return { success: false, error: verror };
    }

    const phone = vrow?.phone;
    if (!phone) {
      return { success: false, message: 'Verified phone not found' };
    }

    // Update auth user phone via Edge Function (service role) to avoid SMS provider requirements
    try {
      const invokeRes = await supabase.functions.invoke('auth-update-phone', {
        body: { user_id: userId, phone },
      });
      // supabase.functions.invoke may return { data, error } where error is SDK-level; and/or the function returns a JSON with error

      const { data: fnData, error: fnError } = invokeRes;
      if (fnError) {
        captureException(fnError, {
          tags: { service: 'phone', action: 'update_phone_invoke_sdk' },
        });
        return { success: false, error: fnError };
      }
      // If the function returned a body with an error
      if (fnData && (fnData.error || fnData?.status >= 400)) {
        captureException(fnData, {
          tags: { service: 'phone', action: 'update_phone_fn_error' },
        });
        // If function is not configured (missing service role key), fall back to updating the `profiles` table
        const msg = fnData.error || fnData;
        const errorMessage =
          typeof msg === 'string'
            ? msg
            : msg?.error && typeof msg.error === 'string'
              ? msg.error
              : '';

        if (
          errorMessage.includes('missing service role key') ||
          errorMessage.includes('service role')
        ) {
          console.warn(
            'auth-update-phone function not configured; falling back to updating profiles table'
          );
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({ phone, phone_verified: true, phone_verified_at: new Date().toISOString() })
            .eq('user_id', userId);
          if (profileErr) {
            captureException(profileErr, {
              tags: { service: 'phone', action: 'fallback_profile_update' },
            });
            return { success: false, error: profileErr };
          }
          return {
            success: true,
            message: 'Phone verified and saved to profile (auth not updated: service role missing)',
          };
        }
        return { success: false, error: fnData.error || fnData };
      }
      return { success: true, message: 'Phone verified and updated' };
    } catch (error) {
      const err = error as Error;
      captureException(err, {
        tags: { service: 'phone', action: 'update_phone_invoke_exception' },
      });
      return { success: false, error: err };
    }
  } catch (error) {
    const err = error as Error;
    captureException(err, {
      tags: { service: 'phone', action: 'verify_phone_code_exception' },
    });
    return { success: false, error: err };
  }
};
