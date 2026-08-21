// File: p2p-kids-marketplace/src/__tests__/hooks/usePhoneVerification.test.ts
// MODULE-03 AUTH-V3-008: Unit tests for usePhoneVerification hook

import { renderHook, act } from '@testing-library/react-native';
import { usePhoneVerification } from '../../hooks/usePhoneVerification';
import * as phoneService from '../../services/phoneService';
import { OTPRateLimitError, OTPExpiredError } from '../../types/auth-v3-errors';

// Mock phone service
jest.mock('../../services/phoneService');

const mockSendPhoneVerificationCode = phoneService.sendPhoneVerificationCode as jest.MockedFunction<
  typeof phoneService.sendPhoneVerificationCode
>;
const mockVerifyPhoneCode = phoneService.verifyPhoneCode as jest.MockedFunction<
  typeof phoneService.verifyPhoneCode
>;

describe('usePhoneVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => usePhoneVerification());

    expect(result.current.phone).toBe('');
    expect(result.current.code).toBe('');
    expect(result.current.step).toBe('phone');
    expect(result.current.isSending).toBe(false);
    expect(result.current.isVerifying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.canResend).toBe(true);
    expect(result.current.resendCountdown).toBe(0);
  });

  it('should update phone number', () => {
    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
    });

    expect(result.current.phone).toBe('+12025551234');
    expect(result.current.error).toBeNull();
  });

  it('should update verification code', () => {
    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setCode('123456');
    });

    expect(result.current.code).toBe('123456');
    expect(result.current.error).toBeNull();
  });

  it('should send verification code successfully', async () => {
    mockSendPhoneVerificationCode.mockResolvedValue({
      success: true,
      message: 'Code sent',
    });

    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
    });

    let sendResult: boolean = false;
    await act(async () => {
      sendResult = await result.current.sendCode();
    });

    expect(sendResult).toBe(true);
    expect(result.current.step).toBe('code');
    expect(result.current.resendCountdown).toBe(60);
    expect(result.current.canResend).toBe(false);
    expect(mockSendPhoneVerificationCode).toHaveBeenCalledWith('+12025551234');
  });

  it('should handle send code validation error', async () => {
    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('123'); // Invalid phone
    });

    let sendResult: boolean = false;
    await act(async () => {
      sendResult = await result.current.sendCode();
    });

    expect(sendResult).toBe(false);
    expect(result.current.error).toBe('Please enter a valid phone number');
    expect(result.current.step).toBe('phone');
  });

  it('should handle rate limit error when sending code', async () => {
    mockSendPhoneVerificationCode.mockRejectedValue(new OTPRateLimitError(120, '3 per hour'));

    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
    });

    await act(async () => {
      await result.current.sendCode();
    });

    expect(result.current.error).toContain('Too many attempts');
    expect(result.current.resendCountdown).toBe(120);
    expect(result.current.canResend).toBe(false);
  });

  it('should verify code successfully', async () => {
    mockVerifyPhoneCode.mockResolvedValue({
      success: true,
      message: 'Verified',
    });

    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
      result.current.setCode('123456');
    });

    let verifyResult: boolean = false;
    await act(async () => {
      verifyResult = await result.current.verifyCode();
    });

    expect(verifyResult).toBe(true);
    expect(mockVerifyPhoneCode).toHaveBeenCalledWith('+12025551234', '123456');
  });

  it('should verify using an override code without waiting for state.code to flush', async () => {
    mockVerifyPhoneCode.mockResolvedValue({
      success: true,
      message: 'Verified',
    });

    const { result } = renderHook(() => usePhoneVerification());

    // No setCode() call — the override supplies the code (fixes the auto-verify
    // state race where a freshly-typed code isn't in state.code yet).
    act(() => {
      result.current.setPhone('+12025551234');
    });

    let verifyResult: boolean = false;
    await act(async () => {
      verifyResult = await result.current.verifyCode('123456');
    });

    expect(verifyResult).toBe(true);
    expect(mockVerifyPhoneCode).toHaveBeenCalledWith('+12025551234', '123456');
  });

  it('should handle verification code validation error', async () => {
    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
      result.current.setCode('123'); // Too short
    });

    let verifyResult: boolean = false;
    await act(async () => {
      verifyResult = await result.current.verifyCode();
    });

    expect(verifyResult).toBe(false);
    expect(result.current.error).toBe('Please enter the 6-digit code');
  });

  it('should handle expired code error', async () => {
    mockVerifyPhoneCode.mockRejectedValue(new OTPExpiredError('Code expired'));

    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
      result.current.setCode('123456');
    });

    await act(async () => {
      await result.current.verifyCode();
    });

    expect(result.current.error).toContain('Code expired');
    expect(result.current.step).toBe('phone');
    expect(result.current.code).toBe('');
  });

  it('should countdown resend timer', async () => {
    const { result } = renderHook(() => usePhoneVerification());

    mockSendPhoneVerificationCode.mockResolvedValue({ success: true, message: 'Sent' });

    act(() => {
      result.current.setPhone('+12025551234');
    });

    await act(async () => {
      await result.current.sendCode();
    });

    expect(result.current.resendCountdown).toBe(60);
    expect(result.current.canResend).toBe(false);

    // Fast-forward 30 seconds in 1s ticks so each setTimeout-driven state update is flushed.
    for (let i = 0; i < 30; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    expect(result.current.resendCountdown).toBe(30);
    expect(result.current.canResend).toBe(false);

    // Fast-forward remaining 30 seconds
    for (let i = 0; i < 30; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    expect(result.current.resendCountdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => usePhoneVerification());

    act(() => {
      result.current.setPhone('+12025551234');
      result.current.setCode('123456');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.phone).toBe('');
    expect(result.current.code).toBe('');
    expect(result.current.step).toBe('phone');
    expect(result.current.error).toBeNull();
    expect(result.current.resendCountdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });
});
