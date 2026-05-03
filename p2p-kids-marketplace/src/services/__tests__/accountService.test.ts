import { supabase } from '@/config/supabase';
import {
  checkAccountExists,
  linkSocialAccount,
  unlinkSocialAccount,
  getLinkedProviders,
} from '../accountService';
import { EmailMismatchError, LastLoginMethodError } from '@/types/auth-v3-errors';
import type { ProviderProfile } from '@/types/auth-v3';

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getUserIdentities: jest.fn(),
      signInWithPassword: jest.fn(),
      linkIdentity: jest.fn(),
      unlinkIdentity: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as any;

function mockProvidersViewQuery(data: any, error: any = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error }),
  };
}

describe('AccountService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
  };

  const mockProviderProfile: ProviderProfile = {
    name: 'User Example',
    email: 'user@example.com',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'google',
    providerUserId: 'google-uid-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.auth.getUserIdentities.mockResolvedValue({
      data: { identities: [{ id: 'identity-1', provider: 'google' }] },
      error: null,
    });

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.auth.linkIdentity.mockResolvedValue({
      data: {},
      error: null,
    });

    mockSupabase.auth.unlinkIdentity.mockResolvedValue({
      data: {},
      error: null,
    });

    mockSupabase.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_account_exists_by_email') {
        return Promise.resolve({ data: { exists: false }, error: null });
      }
      if (fn === 'can_set_password') {
        // true = can set password => user has no password
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'admin_audit_logs') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'user_linked_providers') {
        return mockProvidersViewQuery([
          {
            provider: 'google',
            provider_email: 'user@example.com',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    });
  });

  describe('checkAccountExists', () => {
    it('returns exists=false when RPC says no account', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { exists: false },
        error: null,
      });

      const result = await checkAccountExists('new@example.com');

      expect(result).toEqual({ exists: false });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_account_exists_by_email', {
        p_email: 'new@example.com',
      });
    });

    it('returns account details when RPC says account exists', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          exists: true,
          user_id: 'user-123',
          providers: ['google', 'facebook'],
          has_password: true,
        },
        error: null,
      });

      const result = await checkAccountExists('existing@example.com');

      expect(result).toEqual({
        exists: true,
        userId: 'user-123',
        providers: ['google', 'facebook'],
        hasPassword: true,
      });
    });

    it('uses fallback path when RPC fails and current user email matches', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'function does not exist' },
      });

      mockSupabase.rpc.mockImplementationOnce((fn: string) => {
        if (fn === 'can_set_password') {
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result = await checkAccountExists('user@example.com');

      expect(result.exists).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.providers).toEqual(['google']);
      expect(result.hasPassword).toBe(true);
    });
  });

  describe('linkSocialAccount', () => {
    it('links provider and returns updated linked providers', async () => {
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'can_set_password') {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === 'link_social_account') {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result = await linkSocialAccount('google', mockProviderProfile);

      expect(mockSupabase.auth.linkIdentity).toHaveBeenCalledWith({ provider: 'google' });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('link_social_account', {
        p_provider_name: 'google',
        p_provider_user_id: 'google-uid-123',
        p_provider_email: 'user@example.com',
        p_provider_data: {
          name: 'User Example',
          avatar: 'https://example.com/avatar.jpg',
        },
      });
      expect(result).toEqual([
        {
          provider: 'google',
          providerEmail: 'user@example.com',
          linkedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('throws EmailMismatchError when provider email differs from account email', async () => {
      const mismatched: ProviderProfile = {
        ...mockProviderProfile,
        email: 'other@example.com',
      };

      await expect(linkSocialAccount('google', mismatched)).rejects.toThrow(EmailMismatchError);
    });
  });

  describe('unlinkSocialAccount', () => {
    it('unlinks provider when user has more than one login method', async () => {
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'can_set_password') {
          // false => has password => at least 2 methods (password + google)
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result = await unlinkSocialAccount('google');

      expect(mockSupabase.auth.unlinkIdentity).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      );
      expect(result).toEqual([
        {
          provider: 'google',
          providerEmail: 'user@example.com',
          linkedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('throws LastLoginMethodError when it is the only login method', async () => {
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'can_set_password') {
          // true => no password; with one identity this is last login method
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      await expect(unlinkSocialAccount('google')).rejects.toThrow(LastLoginMethodError);
      expect(mockSupabase.auth.unlinkIdentity).not.toHaveBeenCalled();
    });
  });

  describe('getLinkedProviders', () => {
    it('returns [] when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const result = await getLinkedProviders();

      expect(result).toEqual([]);
    });

    it('maps providers from view rows', async () => {
      mockSupabase.from.mockImplementationOnce(() =>
        mockProvidersViewQuery([
          {
            provider: 'google',
            provider_email: 'g@example.com',
            created_at: '2026-01-01T00:00:00.000Z',
          },
          {
            provider: 'facebook',
            provider_email: 'fb@example.com',
            created_at: '2026-01-02T00:00:00.000Z',
          },
        ])
      );

      const result = await getLinkedProviders();

      expect(result).toEqual([
        {
          provider: 'google',
          providerEmail: 'g@example.com',
          linkedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          provider: 'facebook',
          providerEmail: 'fb@example.com',
          linkedAt: '2026-01-02T00:00:00.000Z',
        },
      ]);
    });
  });
});
