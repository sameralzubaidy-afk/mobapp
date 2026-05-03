// File: src/__tests__/services/accountService.test.ts
// TASK: AUTH-V3-004 — AccountService Unit Tests
// Source: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md v1.0

import {
  checkAccountExists,
  linkSocialAccount,
  unlinkSocialAccount,
  getLinkedProviders,
  countLoginMethods,
} from '../../services/accountService';
import { supabase } from '../../config/supabase';
import { EmailMismatchError, LastLoginMethodError } from '../../types/auth-v3-errors';
import type { ProviderProfile } from '../../types/auth-v3';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getUserIdentities: jest.fn(),
      signInWithPassword: jest.fn(),
      linkIdentity: jest.fn(),
      unlinkIdentity: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('AccountService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAccountExists', () => {
    it('should return exists=false when RPC returns no data', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { exists: false },
        error: null,
      });

      const result = await checkAccountExists('nonexistent@example.com');

      expect(result).toEqual({ exists: false });
      expect(supabase.rpc).toHaveBeenCalledWith('check_account_exists_by_email', {
        p_email: 'nonexistent@example.com',
      });
    });

    it('should return account details when exists', async () => {
      const mockUserId = 'user-123';
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          exists: true,
          user_id: mockUserId,
          providers: ['google', 'facebook'],
          has_password: true,
        },
        error: null,
      });

      const result = await checkAccountExists('existing@example.com');

      expect(result).toEqual({
        exists: true,
        userId: mockUserId,
        providers: ['google', 'facebook'],
        hasPassword: true,
      });
    });

    it('should use fallback when RPC not found', async () => {
      // RPC fails
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'function check_account_exists_by_email does not exist' },
      });

      // Fallback: getUser returns current user
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            app_metadata: { has_password: true },
          },
        },
        error: null,
      });

      // getUserIdentities returns providers
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ provider: 'google' }],
        },
        error: null,
      });

      // from() chain for user_linked_providers
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { provider: 'google', provider_email: 'user@gmail.com', created_at: '2026-04-01' },
          ],
          error: null,
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await checkAccountExists('user@example.com');

      expect(result.exists).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    it('should return exists=false for different email in fallback', async () => {
      // RPC fails
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC not found' },
      });

      // Current user has different email
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'different@example.com',
          },
        },
        error: null,
      });

      const result = await checkAccountExists('search@example.com');

      expect(result).toEqual({ exists: false });
    });
  });

  describe('linkSocialAccount', () => {
    const mockProviderProfile: ProviderProfile = {
      name: 'John Doe',
      email: 'john@example.com',
      avatar: 'https://example.com/avatar.jpg',
      provider: 'google',
      providerUserId: 'google-123',
    };

    it('should successfully link account with password re-auth', async () => {
      // getUser returns user with password
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'john@example.com',
          },
        },
        error: null,
      });

      // can_set_password RPC returns false (has password)
      (supabase.rpc as jest.Mock).mockImplementation((name, params) => {
        if (name === 'can_set_password') {
          return Promise.resolve({ data: false, error: null });
        }
        // link_social_account RPC
        if (name === 'link_social_account') {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      // signInWithPassword succeeds
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });

      // linkIdentity succeeds
      (supabase.auth.linkIdentity as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      // getLinkedProviders returns updated list
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ provider: 'google' }],
        },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { provider: 'google', provider_email: 'john@gmail.com', created_at: '2026-04-21' },
          ],
          error: null,
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await linkSocialAccount(
        mockProviderProfile.provider,
        mockProviderProfile,
        'password123'
      );

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('google');
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
      });
      expect(supabase.auth.linkIdentity).toHaveBeenCalled();
    });

    it('should throw EmailMismatchError when provider email does not match account email', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'different@example.com', // Different email
          },
        },
        error: null,
      });

      await expect(
        linkSocialAccount(mockProviderProfile.provider, mockProviderProfile, 'password123')
      ).rejects.toThrow(EmailMismatchError);
    });

    it('should throw error when password re-auth fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'john@example.com',
          },
        },
        error: null,
      });

      // Has password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false,
        error: null,
      });

      // Password re-auth fails
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      await expect(
        linkSocialAccount(mockProviderProfile.provider, mockProviderProfile, 'wrongpassword')
      ).rejects.toThrow('Password re-authentication failed');
    });

    it('should require password when account has password', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'john@example.com',
          },
        },
        error: null,
      });

      // Has password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false, // can_set_password returns false => has password
        error: null,
      });

      await expect(
        linkSocialAccount(mockProviderProfile.provider, mockProviderProfile) // No password provided
      ).rejects.toThrow('Password re-authentication required');
    });

    it('should handle RPC email mismatch error', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'john@example.com',
          },
        },
        error: null,
      });

      // No password
      (supabase.rpc as jest.Mock).mockImplementation((name) => {
        if (name === 'can_set_password') {
          return Promise.resolve({ data: true, error: null });
        }
        // link_social_account RPC fails with email mismatch
        if (name === 'link_social_account') {
          return Promise.resolve({
            data: null,
            error: { message: 'EmailMismatchError: john@example.com vs other@example.com' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      (supabase.auth.linkIdentity as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(
        linkSocialAccount(mockProviderProfile.provider, mockProviderProfile)
      ).rejects.toThrow(EmailMismatchError);
    });
  });

  describe('unlinkSocialAccount', () => {
    it('should successfully unlink when multiple methods exist', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        },
        error: null,
      });

      // countLoginMethods returns 2 (google + password)
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ id: 'identity-1', provider: 'google' }],
        },
        error: null,
      });

      // Has password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false, // can_set_password returns false => has password
        error: null,
      });

      // unlinkIdentity succeeds
      (supabase.auth.unlinkIdentity as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      // Audit log write
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      const mockFrom = {
        insert: mockInsert,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await unlinkSocialAccount('google');

      expect(supabase.auth.unlinkIdentity).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw LastLoginMethodError when it is the only method', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        },
        error: null,
      });

      // countLoginMethods returns 1 (only google, no password)
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ id: 'identity-1', provider: 'google' }],
        },
        error: null,
      });

      // No password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true, // can_set_password returns true => no password
        error: null,
      });

      await expect(unlinkSocialAccount('google')).rejects.toThrow(LastLoginMethodError);

      // unlinkIdentity should NOT be called
      expect(supabase.auth.unlinkIdentity).not.toHaveBeenCalled();
    });

    it('should throw error when identity not found', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        },
        error: null,
      });

      // Multiple identities, but not the one we're trying to unlink
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ id: 'identity-1', provider: 'facebook' }],
        },
        error: null,
      });

      // Has password (count = 2)
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false,
        error: null,
      });

      await expect(unlinkSocialAccount('google')).rejects.toThrow(
        'No google identity found to unlink'
      );
    });
  });

  describe('getLinkedProviders', () => {
    it('should return linked providers ordered by linkedAt', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
          },
        },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { provider: 'google', provider_email: 'user@gmail.com', created_at: '2026-04-01' },
            { provider: 'facebook', provider_email: 'user@fb.com', created_at: '2026-04-15' },
          ],
          error: null,
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await getLinkedProviders();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        provider: 'google',
        providerEmail: 'user@gmail.com',
        linkedAt: '2026-04-01',
      });
      expect(result[1]).toEqual({
        provider: 'facebook',
        providerEmail: 'user@fb.com',
        linkedAt: '2026-04-15',
      });
      expect(mockFrom.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should return empty array when not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const result = await getLinkedProviders();

      expect(result).toEqual([]);
    });

    it('should return empty array when no providers linked', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
          },
        },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await getLinkedProviders();

      expect(result).toEqual([]);
    });
  });

  describe('countLoginMethods', () => {
    it('should count identities + password', async () => {
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ provider: 'google' }, { provider: 'facebook' }],
        },
        error: null,
      });

      // Has password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false, // can_set_password returns false => has password
        error: null,
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
          },
        },
        error: null,
      });

      const count = await countLoginMethods('user-123');

      expect(count).toBe(3); // 2 identities + 1 password
    });

    it('should count only identities when no password', async () => {
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [{ provider: 'google' }],
        },
        error: null,
      });

      // No password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true, // can_set_password returns true => no password
        error: null,
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
          },
        },
        error: null,
      });

      const count = await countLoginMethods('user-123');

      expect(count).toBe(1); // 1 identity only
    });

    it('should return 0 when no identities and no password', async () => {
      (supabase.auth.getUserIdentities as jest.Mock).mockResolvedValue({
        data: {
          identities: [],
        },
        error: null,
      });

      // No password
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
          },
        },
        error: null,
      });

      const count = await countLoginMethods('user-123');

      expect(count).toBe(0);
    });
  });
});
