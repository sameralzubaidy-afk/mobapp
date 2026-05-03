// File: p2p-kids-marketplace/src/services/__tests__/passwordService.test.ts
// Unit tests for passwordService (AUTH-V3-006)

import {
  canSetPassword,
  validatePasswordStrength,
  setPasswordForSocialUser,
  PasswordErrorCode,
  getPasswordErrorMessage,
} from '../passwordService';
import { supabase } from '../supabase/client';

// Mock Supabase
jest.mock('../supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('passwordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canSetPassword', () => {
    it('should return true when RPC returns true (no password set)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const result = await canSetPassword('user-123');

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('can_set_password', {
        p_user_id: 'user-123',
      });
    });

    it('should return false when RPC returns false (password exists)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: false,
        error: null,
      });

      const result = await canSetPassword('user-123');

      expect(result).toBe(false);
    });

    it('should return false on RPC error (graceful fallback)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', code: '500' },
      });

      const result = await canSetPassword('user-123');

      expect(result).toBe(false);
    });

    it('should return false on exception (graceful fallback)', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await canSetPassword('user-123');

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should return valid for strong password', () => {
      const result = validatePasswordStrength('MySecurePass123');

      expect(result.valid).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('should reject password < 8 characters', () => {
      const result = validatePasswordStrength('Short1');

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(PasswordErrorCode.TOO_SHORT);
    });

    it('should reject password without letters', () => {
      const result = validatePasswordStrength('12345678');

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(PasswordErrorCode.NO_LETTER);
    });

    it('should reject password without digits', () => {
      const result = validatePasswordStrength('NoDigitsHere');

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(PasswordErrorCode.NO_DIGIT);
    });

    it('should reject common password (case-insensitive)', () => {
      const result1 = validatePasswordStrength('password');
      const result2 = validatePasswordStrength('PASSWORD');
      const result3 = validatePasswordStrength('Password');

      expect(result1.valid).toBe(false);
      expect(result1.reasons).toContain(PasswordErrorCode.COMMON_PASSWORD);

      expect(result2.valid).toBe(false);
      expect(result2.reasons).toContain(PasswordErrorCode.COMMON_PASSWORD);

      expect(result3.valid).toBe(false);
      expect(result3.reasons).toContain(PasswordErrorCode.COMMON_PASSWORD);
    });

    it('should reject password123 (common password)', () => {
      const result = validatePasswordStrength('password123');

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(PasswordErrorCode.COMMON_PASSWORD);
    });

    it('should accumulate multiple validation errors', () => {
      const result = validatePasswordStrength('pass');

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(PasswordErrorCode.TOO_SHORT);
      expect(result.reasons).toContain(PasswordErrorCode.NO_DIGIT);
    });

    it('should accept strong password not in blocklist', () => {
      const result = validatePasswordStrength('MyUniquePass123!');

      expect(result.valid).toBe(true);
      expect(result.reasons).toEqual([]);
    });
  });

  describe('setPasswordForSocialUser', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);
    });

    it('should set password successfully for eligible user', async () => {
      // canSetPassword returns true
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      // updateUser succeeds
      mockSupabase.auth.updateUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      } as any);

      const result = await setPasswordForSocialUser('MySecurePass123');

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'MySecurePass123',
      });
    });

    it('should reject if user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      const result = await setPasswordForSocialUser('MySecurePass123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not authenticated');
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should reject if user already has password', async () => {
      // canSetPassword returns false
      mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await setPasswordForSocialUser('MySecurePass123');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.NOT_ALLOWED);
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should reject weak password (too short)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await setPasswordForSocialUser('Short1');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.TOO_SHORT);
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should reject weak password (no letters)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await setPasswordForSocialUser('12345678');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.NO_LETTER);
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should reject weak password (no digits)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await setPasswordForSocialUser('NoDigitsHere');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.NO_DIGIT);
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should reject common password', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await setPasswordForSocialUser('password123');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.COMMON_PASSWORD);
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should handle updateUser failure', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      mockSupabase.auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Update failed', code: '500' },
      } as any);

      const result = await setPasswordForSocialUser('MySecurePass123');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.UPDATE_FAILED);
      expect(result.error).toContain('Update failed');
    });

    it('should handle exceptions gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });
      mockSupabase.auth.updateUser.mockRejectedValueOnce(new Error('Network error'));

      const result = await setPasswordForSocialUser('MySecurePass123');

      expect(result.success).toBe(false);
      expect(result.code).toBe(PasswordErrorCode.UPDATE_FAILED);
    });
  });

  describe('getPasswordErrorMessage', () => {
    it('should return appropriate messages for each error code', () => {
      expect(getPasswordErrorMessage(PasswordErrorCode.TOO_SHORT)).toContain('8 characters');
      expect(getPasswordErrorMessage(PasswordErrorCode.NO_LETTER)).toContain('letter');
      expect(getPasswordErrorMessage(PasswordErrorCode.NO_DIGIT)).toContain('digit');
      expect(getPasswordErrorMessage(PasswordErrorCode.COMMON_PASSWORD)).toContain('common');
      expect(getPasswordErrorMessage(PasswordErrorCode.NOT_ALLOWED)).toContain('already');
      expect(getPasswordErrorMessage(PasswordErrorCode.UPDATE_FAILED)).toContain('Failed');
    });
  });
});
