// File: p2p-kids-marketplace/src/hooks/useOtpResendCountdown.ts
// FIX-Task-6 (QA Task 43m, 2026-09-08): shared "Resend OTP code" countdown hook.
//
// Every OTP surface needs the same resend-control behavior: after a code is
// sent (60s cooldown) OR after an OTPRateLimitError, Resend is disabled and a
// live countdown ticks down from retryAfterSeconds; when it reaches zero the
// Resend control becomes enabled again. This hook owns that lifecycle so the
// signup PhoneVerificationScreen, EditProfileScreen, and any future OTP surface
// share one implementation instead of each re-declaring a countdown state +
// 1s tick effect (the divergence that let the signup screen drift in the first
// place).
//
// Display formatting is intentionally NOT owned here — screens format the raw
// seconds with the shared formatOtpCountdown util (e.g. "59s" vs "1h") so the
// countdown value stays pure.

import { useCallback, useEffect, useState } from 'react';

export interface OtpResendCountdown {
  /** Remaining seconds until Resend re-enables (0 = ready). */
  countdown: number;
  /** True when Resend may be tapped (countdown reached zero). */
  canResend: boolean;
  /** Arm the countdown for `seconds` (used for both the 60s cooldown and the
   *  OTPRateLimitError retry window). */
  startCountdown: (seconds: number) => void;
  /** Reset to 0 immediately (e.g. on modal close / successful verify). */
  clearCountdown: () => void;
}

/**
 * Live Resend countdown shared by OTP send surfaces. Counts down 1s at a time
 * while `countdown > 0`; `canResend` flips true exactly when it hits zero.
 */
export function useOtpResendCountdown(): OtpResendCountdown {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const startCountdown = useCallback((seconds: number) => {
    const safe = Math.round(seconds);
    setCountdown(Number.isFinite(safe) && safe > 0 ? safe : 0);
  }, []);

  const clearCountdown = useCallback(() => {
    setCountdown(0);
  }, []);

  return {
    countdown,
    canResend: countdown <= 0,
    startCountdown,
    clearCountdown,
  };
}
