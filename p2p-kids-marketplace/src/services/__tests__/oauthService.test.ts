// File: src/services/__tests__/oauthService.test.ts
// Unit tests for OAuth Service (AUTH-V3-003)
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN

import * as SecureStore from 'expo-secure-store';
import {
  initiateSocialLogin,
  handleOAuthCallback,
  extractProviderProfile,
  isProviderLinked,
} from '../oauthService';
import { supabase } from '../supabase/client';
import { OAuthStateMismatchError, ProviderUnavailableError } from '@/types/auth-v3-errors';

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'p2pkidsmarketplace://oauth-callback'),
  parse: jest.fn(),
}));
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockSupabase = supabase as any;

describe('OAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateSocialLogin', () => {
    it('should generate state token and return OAuth URL for Google', async () => {
      const mockOAuthUrl = 'https://accounts.google.com/oauth?state=supabase-state-123';

      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: mockOAuthUrl },
        error: null,
      });

      const result = await initiateSocialLogin('google');

      expect(result.url).toBe(mockOAuthUrl);
      expect(result.state).toBe('supabase-state-123');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'oauth_state_google',
        expect.stringContaining(result.state)
      );
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('oauth-callback'),
          scopes: 'openid email profile',
          queryParams: { prompt: 'select_account' },
          skipBrowserRedirect: true,
        },
      });
    });

    it('should use correct scopes for Facebook', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://facebook.com/oauth?state=fb-state-1' },
        error: null,
      });

      await initiateSocialLogin('facebook');

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'facebook',
          options: expect.objectContaining({
            scopes: 'public_profile,email',
            skipBrowserRedirect: true,
          }),
        })
      );
    });

    it('should use correct scopes for Apple', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://appleid.apple.com/oauth?state=apple-state-1' },
        error: null,
      });

      await initiateSocialLogin('apple');

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'apple',
          options: expect.objectContaining({
            scopes: 'name email',
            skipBrowserRedirect: true,
          }),
        })
      );
    });

    it('should throw ProviderUnavailableError on 503 error', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: null,
        error: { message: '503 Service Unavailable' },
      });

      await expect(initiateSocialLogin('google')).rejects.toThrow(ProviderUnavailableError);
    });

    it('should throw error if OAuth URL not returned', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: null,
      });

      await expect(initiateSocialLogin('google')).rejects.toThrow('OAuth URL not returned');
    });

    it('should continue when provider URL has no state param', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/oauth' },
        error: null,
      });

      const result = await initiateSocialLogin('google');

      expect(result.url).toBe('https://accounts.google.com/oauth');
      expect(result.state).toBe('');
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('handleOAuthCallback', () => {
    it('should return null on user cancel (access_denied)', async () => {
      const result = await handleOAuthCallback(null, 'some-state', 'google', 'access_denied');

      expect(result).toBeNull();
      expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should throw OAuthStateMismatchError if no state provided but local state exists', async () => {
      const storedSession = {
        state: 'stored-state',
        provider: 'google',
        createdAt: new Date().toISOString(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(storedSession));

      await expect(handleOAuthCallback('auth-code', null, 'google')).rejects.toThrow(
        OAuthStateMismatchError
      );
    });

    it('should throw OAuthStateMismatchError if stored state does not match', async () => {
      const storedSession = {
        state: 'stored-state',
        provider: 'google',
        createdAt: new Date().toISOString(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(storedSession));

      await expect(handleOAuthCallback('auth-code', 'different-state', 'google')).rejects.toThrow(
        OAuthStateMismatchError
      );
    });

    it('should return success result on valid callback', async () => {
      const mockState = 'matching-state';
      const storedSession = {
        state: mockState,
        provider: 'google',
        createdAt: new Date().toISOString(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(storedSession));
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
              user_metadata: {
                given_name: 'John',
                family_name: 'Doe',
                picture: 'https://example.com/avatar.jpg',
              },
              identities: [
                {
                  identity_data: {
                    sub: 'google-123',
                    email: 'test@example.com',
                  },
                },
              ],
              created_at: '2024-01-01T00:00:00Z',
              last_sign_in_at: '2024-01-01T00:00:00Z',
            },
            access_token: 'mock-token',
          },
        },
        error: null,
      });

      const result = await handleOAuthCallback('auth-code', mockState, 'google');

      expect(result).toMatchObject({
        success: true,
        userId: 'user-123',
        sessionToken: 'mock-token',
      });
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('oauth_state_google');
    });

    it('should handle expired state (> 30 minutes old)', async () => {
      const oldDate = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      const storedSession = {
        state: 'old-state',
        provider: 'google',
        createdAt: oldDate.toISOString(),
      };

      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(storedSession));

      await expect(handleOAuthCallback('auth-code', 'old-state', 'google')).rejects.toThrow(
        OAuthStateMismatchError
      );
    });

    it('should succeed without local state validation when no stored state exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-456',
              email: 'no-state@example.com',
              user_metadata: {
                given_name: 'No',
                family_name: 'State',
              },
              identities: [
                {
                  identity_data: {
                    sub: 'google-456',
                    email: 'no-state@example.com',
                  },
                },
              ],
              created_at: '2024-01-01T00:00:00Z',
              last_sign_in_at: '2024-01-01T00:00:00Z',
            },
            access_token: 'token-no-state',
          },
        },
        error: null,
      });

      const result = await handleOAuthCallback(null, null, 'google');

      expect(result).toMatchObject({
        success: true,
        userId: 'user-456',
        sessionToken: 'token-no-state',
      });
    });
  });

  describe('extractProviderProfile', () => {
    it('should extract Google profile correctly', () => {
      const profile = extractProviderProfile(
        'google',
        {
          given_name: 'John',
          family_name: 'Doe',
          picture: 'https://example.com/avatar.jpg',
          email: 'john@example.com',
        },
        { sub: 'google-123' }
      );

      expect(profile).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        avatar: 'https://example.com/avatar.jpg',
        provider: 'google',
        providerUserId: 'google-123',
      });
    });

    it('should extract Facebook profile correctly with nested picture', () => {
      const profile = extractProviderProfile(
        'facebook',
        {
          name: 'Jane Doe',
          picture: {
            data: {
              url: 'https://example.com/avatar.jpg',
            },
          },
          email: 'jane@example.com',
        },
        { id: 'facebook-456' }
      );

      expect(profile).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com',
        avatar: 'https://example.com/avatar.jpg',
        provider: 'facebook',
        providerUserId: 'facebook-456',
      });
    });

    it('should extract Apple profile correctly (first sign-in with name)', () => {
      const profile = extractProviderProfile(
        'apple',
        {
          firstName: 'Sam',
          lastName: 'Lee',
          email: 'sam@example.com',
        },
        { sub: 'apple-789' }
      );

      expect(profile).toEqual({
        name: 'Sam Lee',
        email: 'sam@example.com',
        avatar: undefined,
        provider: 'apple',
        providerUserId: 'apple-789',
      });
    });

    it('should extract Apple profile correctly (subsequent sign-in without name)', () => {
      const profile = extractProviderProfile(
        'apple',
        {
          email: 'sam@example.com',
          // firstName/lastName not present on 2nd sign-in
        },
        { sub: 'apple-789' }
      );

      expect(profile).toEqual({
        name: '',
        email: 'sam@example.com',
        avatar: undefined,
        provider: 'apple',
        providerUserId: 'apple-789',
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const profile = extractProviderProfile(
        'google',
        {
          email: 'test@example.com',
          // No name or picture
        },
        { sub: 'google-999' }
      );

      expect(profile).toEqual({
        name: '',
        email: 'test@example.com',
        avatar: undefined,
        provider: 'google',
        providerUserId: 'google-999',
      });
    });
  });

  describe('isProviderLinked', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
      });
    });

    it('should return true if provider is linked', async () => {
      const mockQuery = mockSupabase.from();
      mockQuery.maybeSingle.mockResolvedValue({
        data: { provider: 'google' },
        error: null,
      });

      const result = await isProviderLinked('user-123', 'google');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_linked_providers');
    });

    it('should return false if provider is not linked', async () => {
      const mockQuery = mockSupabase.from();
      mockQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await isProviderLinked('user-123', 'facebook');

      expect(result).toBe(false);
    });

    it('should return false on query error', async () => {
      const mockQuery = mockSupabase.from();
      mockQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await isProviderLinked('user-123', 'apple');

      expect(result).toBe(false);
    });
  });
});
