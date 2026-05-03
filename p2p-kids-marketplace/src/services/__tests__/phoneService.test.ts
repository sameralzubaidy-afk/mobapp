// File: p2p-kids-marketplace/src/services/__tests__/phoneService.test.ts
// Unit tests for phoneService (AUTH-V3-006)

import {
  isPhoneRequired,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  OTPRateLimitError,
  OTPExpiredError,
  PhoneVerificationErrorCode,
  getPhoneErrorMessage,
} from '../phoneService';
import { supabase } from '../supabase/client';

// Mock Supabase
jest.mock('../supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('phoneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPhoneRequired', () => {
    it('should return true when phone_verified_at is NULL', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { phone_verified_at: null },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFrom as any);

      const result = await isPhoneRequired('user-123');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should return false when phone_verified_at is set', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { phone_verified_at: '2026-05-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFrom as any);

      const result = await isPhoneRequired('user-123');

      expect(result).toBe(false);
    });

    it('should return true on query error (graceful fallback)', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockFrom as any);

      const result = await isPhoneRequired('user-123');

      expect(result).toBe(true);
    });

    it('should return true on exception (graceful fallback)', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await isPhoneRequired('user-123');

      expect(result).toBe(true);
    });
  });

  describe('sendPhoneVerificationCode', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);
    });

    it('should send verification code successfully', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      } as any);

      await sendPhoneVerificationCode('+12025551234');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-phone-otp', {
        body: { phone: '+12025551234', user_id: 'user-123' },
      });
    });

    it('should throw OTPRateLimitError when rate limit exceeded', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: 3600,
        },
        error: null,
      } as any);

      await expect(sendPhoneVerificationCode('+12025551234')).rejects.toThrow(OTPRateLimitError);

      try {
        await sendPhoneVerificationCode('+12025551234');
      } catch (err) {
        expect(err).toBeInstanceOf(OTPRateLimitError);
        expect((err as OTPRateLimitError).retryAfterSeconds).toBe(3600);
      }
    });

    it('should throw error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(sendPhoneVerificationCode('+12025551234')).rejects.toThrow('Not authenticated');
    });

    it('should throw error on Edge Function invoke failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Function invocation failed' },
      } as any);

      await expect(sendPhoneVerificationCode('+12025551234')).rejects.toThrow(
        'Failed to send verification code'
      );
    });

    it('should throw error on Edge Function returning error', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { error: 'Twilio configuration missing' },
        error: null,
      } as any);

      await expect(sendPhoneVerificationCode('+12025551234')).rejects.toThrow(
        'Twilio configuration missing'
      );
    });
  });

  describe('verifyPhoneCode', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockVerificationRecord = {
      id: 'ver-123',
      user_id: 'user-123',
      phone: '+12025551234',
      code_hash: '$2b$10$hashedcode',
      attempts: 0,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);
    });

    it('should verify code successfully', async () => {
      // Mock fetch verification record
      const mockFrom1 = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockVerificationRecord,
          error: null,
        }),
      };

      // Mock RPC verify
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: true, message: 'Code verified' },
        error: null,
      });

      // Mock profile update
      const mockFrom2 = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      // Mock audit log insert
      const mockFrom3 = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockFrom1 as any)
        .mockReturnValueOnce(mockFrom2 as any)
        .mockReturnValueOnce(mockFrom3 as any);

      await verifyPhoneCode('+12025551234', '123456');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('verify_otp_code', {
        p_verification_id: 'ver-123',
        p_code: '123456',
      });
    });

    it('should throw OTPExpiredError when code not found', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFrom as any);

      await expect(verifyPhoneCode('+12025551234', '123456')).rejects.toThrow(OTPExpiredError);
    });

    it('should throw error when max attempts exceeded', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { ...mockVerificationRecord, attempts: 3 },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFrom as any);

      await expect(verifyPhoneCode('+12025551234', '123456')).rejects.toThrow(
        'Maximum verification attempts exceeded'
      );
    });

    it('should throw error on invalid code', async () => {
      const mockFrom1 = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockVerificationRecord,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(mockFrom1 as any);

      // RPC returns false
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: false, message: 'Invalid code' },
        error: null,
      });

      await expect(verifyPhoneCode('+12025551234', '999999')).rejects.toThrow('Invalid code');
    });

    it('should throw error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(verifyPhoneCode('+12025551234', '123456')).rejects.toThrow('Not authenticated');
    });
  });

  describe('getPhoneErrorMessage', () => {
    it('should return appropriate messages for each error code', () => {
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.RATE_LIMIT_EXCEEDED)).toContain(
        'Too many'
      );
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.OTP_EXPIRED)).toContain('expired');
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.OTP_INVALID)).toContain('Invalid');
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.OTP_MAX_ATTEMPTS)).toContain(
        'Maximum'
      );
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.SEND_FAILED)).toContain('send');
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.VERIFICATION_FAILED)).toContain(
        'failed'
      );
      expect(getPhoneErrorMessage(PhoneVerificationErrorCode.NOT_FOUND)).toContain('not found');
    });
  });
});
