// File: p2p-kids-marketplace/src/hooks/usePhoneVerification.ts
// MODULE-03 AUTH-V3-008: React hook for phone verification with rate-limit countdown

import { useState, useEffect, useCallback } from 'react';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/phoneService';
import { OTPRateLimitError, OTPExpiredError } from '@/types/auth-v3-errors';

interface PhoneVerificationState {
  phone: string;
  code: string;
  step: 'phone' | 'code';
  isSending: boolean;
  isVerifying: boolean;
  error: string | null;
  resendCountdown: number;
  canResend: boolean;
}

/**
 * Hook for managing phone verification flow
 * Handles 2-step process: enter phone → send code → enter code → verify
 * Includes rate-limit countdown and auto-advancing code input
 */
export function usePhoneVerification() {
  const [state, setState] = useState<PhoneVerificationState>({
    phone: '',
    code: '',
    step: 'phone',
    isSending: false,
    isVerifying: false,
    error: null,
    resendCountdown: 0,
    canResend: true,
  });

  // Countdown timer for resend button
  useEffect(() => {
    if (state.resendCountdown > 0) {
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          resendCountdown: prev.resendCountdown - 1,
          canResend: prev.resendCountdown - 1 === 0,
        }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.resendCountdown]);

  const setPhone = useCallback((phone: string) => {
    setState((prev) => ({ ...prev, phone, error: null }));
  }, []);

  const setCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, code, error: null }));
  }, []);

  const sendCode = useCallback(async (): Promise<boolean> => {
    if (!state.phone || state.phone.length < 10) {
      setState((prev) => ({ ...prev, error: 'Please enter a valid phone number' }));
      return false;
    }

    setState((prev) => ({ ...prev, isSending: true, error: null }));

    try {
      const result = await sendPhoneVerificationCode(state.phone);

      const helperMessage =
        result.devBypass && result.devBypassCode
          ? `DEV mode: use code ${result.devBypassCode}`
          : null;

      setState((prev) => ({
        ...prev,
        isSending: false,
        step: 'code',
        error: helperMessage,
        resendCountdown: 60,
        canResend: false,
      }));
      return true;
    } catch (error) {
      console.error('[usePhoneVerification] sendCode error:', error);

      const rateLimitSeconds =
        error instanceof OTPRateLimitError
          ? error.retryAfterSeconds
          : typeof error === 'object' && error !== null && 'retryAfterSeconds' in error
            ? Number((error as { retryAfterSeconds?: unknown }).retryAfterSeconds) || 60
            : null;

      if (rateLimitSeconds !== null) {
        setState((prev) => ({
          ...prev,
          isSending: false,
          error: `Too many attempts. Please try again in ${rateLimitSeconds} seconds.`,
          resendCountdown: rateLimitSeconds,
          canResend: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isSending: false,
          error: 'Failed to send verification code. Please try again.',
        }));
      }
      return false;
    }
  }, [state.phone]);

  const verifyCode = useCallback(async (overrideCode?: string): Promise<boolean> => {
    // overrideCode lets a caller verify a freshly-entered code without waiting for
    // React to flush state.code (fixes the auto-verify state race in the OTP modal,
    // where handleCodeChange passes the just-typed 6-digit code but verifyCode was
    // reading a stale state.code). Backward compatible: omit it to use state.code.
    const effectiveCode = overrideCode ?? state.code;
    if (!effectiveCode || effectiveCode.length !== 6) {
      setState((prev) => ({ ...prev, error: 'Please enter the 6-digit code' }));
      return false;
    }

    setState((prev) => ({ ...prev, isVerifying: true, error: null }));

    try {
      await verifyPhoneCode(state.phone, effectiveCode);

      setState((prev) => ({ ...prev, isVerifying: false }));
      return true;
    } catch (error) {
      console.error('[usePhoneVerification] verifyCode error:', error);

      const isExpiredError =
        error instanceof OTPExpiredError ||
        (typeof error === 'object' && error !== null &&
          ((error as { code?: string }).code === 'OTP_EXPIRED' ||
            (error as { name?: string }).name === 'OTPExpiredError'));

      if (isExpiredError) {
        setState((prev) => ({
          ...prev,
          isVerifying: false,
          error: 'Code expired. Please request a new one.',
          step: 'phone',
          code: '',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isVerifying: false,
          error: 'Invalid verification code. Please try again.',
        }));
      }
      return false;
    }
  }, [state.phone, state.code]);

  const reset = useCallback(() => {
    setState({
      phone: '',
      code: '',
      step: 'phone',
      isSending: false,
      isVerifying: false,
      error: null,
      resendCountdown: 0,
      canResend: true,
    });
  }, []);

  return {
    phone: state.phone,
    code: state.code,
    step: state.step,
    isSending: state.isSending,
    isVerifying: state.isVerifying,
    error: state.error,
    resendCountdown: state.resendCountdown,
    canResend: state.canResend,
    setPhone,
    setCode,
    sendCode,
    verifyCode,
    reset,
  };
}
