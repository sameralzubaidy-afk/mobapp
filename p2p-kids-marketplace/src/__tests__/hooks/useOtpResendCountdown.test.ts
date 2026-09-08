// File: p2p-kids-marketplace/src/__tests__/hooks/useOtpResendCountdown.test.ts
// FIX-Task-6 (QA Task 43m): lifecycle tests for the shared OTP Resend countdown
// hook (used by both the signup PhoneVerificationScreen and EditProfileScreen).

import { renderHook, act } from '@testing-library/react-native';
import { useOtpResendCountdown } from '../../hooks/useOtpResendCountdown';

describe('useOtpResendCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts idle: countdown 0 and Resend allowed', () => {
    const { result } = renderHook(() => useOtpResendCountdown());
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('arms a countdown and disables Resend', () => {
    const { result } = renderHook(() => useOtpResendCountdown());

    act(() => {
      result.current.startCountdown(60);
    });

    expect(result.current.countdown).toBe(60);
    expect(result.current.canResend).toBe(false);
  });

  it('ticks down 1s at a time and re-enables Resend at zero', () => {
    const { result } = renderHook(() => useOtpResendCountdown());

    act(() => {
      result.current.startCountdown(3);
    });
    expect(result.current.countdown).toBe(3);
    expect(result.current.canResend).toBe(false);

    // Tick 1s at a time in separate acts so each setTimeout-driven state update
    // is flushed and the effect re-schedules the next tick (same pattern as the
    // usePhoneVerification countdown test).
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(2);
    expect(result.current.canResend).toBe(false);

    for (let i = 0; i < 2; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('clears an armed countdown to 0 (Resend allowed)', () => {
    const { result } = renderHook(() => useOtpResendCountdown());

    act(() => {
      result.current.startCountdown(3600);
    });
    expect(result.current.canResend).toBe(false);

    act(() => {
      result.current.clearCountdown();
    });
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('clamps non-positive / invalid start values to 0', () => {
    const { result } = renderHook(() => useOtpResendCountdown());

    act(() => {
      result.current.startCountdown(-10);
    });
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);

    act(() => {
      result.current.startCountdown(Number.NaN);
    });
    expect(result.current.countdown).toBe(0);
  });
});
