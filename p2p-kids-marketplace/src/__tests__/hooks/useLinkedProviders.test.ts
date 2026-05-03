// File: p2p-kids-marketplace/src/__tests__/hooks/useLinkedProviders.test.ts
// MODULE-03 AUTH-V3-008: Unit tests for useLinkedProviders hook

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLinkedProviders } from '../../hooks/useLinkedProviders';
import * as accountService from '../../services/accountService';
import type { OAuthProvider, LinkedProvider } from '../../types/auth-v3';

// Mock services
jest.mock('../../services/accountService');

const mockGetLinkedProviders = accountService.getLinkedProviders as jest.MockedFunction<
  typeof accountService.getLinkedProviders
>;
const mockLinkSocialAccount = accountService.linkSocialAccount as jest.MockedFunction<
  typeof accountService.linkSocialAccount
>;
const mockUnlinkSocialAccount = accountService.unlinkSocialAccount as jest.MockedFunction<
  typeof accountService.unlinkSocialAccount
>;
const mockCountLoginMethods = accountService.countLoginMethods as jest.MockedFunction<
  typeof accountService.countLoginMethods
>;

describe('useLinkedProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch linked providers on mount', async () => {
    const mockProviders: LinkedProvider[] = [
      {
        provider: 'google' as OAuthProvider,
        providerEmail: 'user@gmail.com',
        linkedAt: '2026-05-01T10:00:00Z',
      },
    ];

    mockGetLinkedProviders.mockResolvedValue(mockProviders);
    mockCountLoginMethods.mockResolvedValue(2);

    const { result } = renderHook(() => useLinkedProviders('user-123'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.providers).toEqual(mockProviders);
    expect(result.current.loginMethodCount).toBe(2);
  });

  it('should link a provider successfully', async () => {
    const mockProviders: LinkedProvider[] = [];
    const updatedProviders: LinkedProvider[] = [
      {
        provider: 'facebook' as OAuthProvider,
        providerEmail: 'user@fb.com',
        linkedAt: '2026-05-03T12:00:00Z',
      },
    ];

    mockGetLinkedProviders.mockResolvedValueOnce(mockProviders).mockResolvedValueOnce(updatedProviders);
    mockLinkSocialAccount.mockResolvedValue(updatedProviders);
    mockCountLoginMethods.mockResolvedValue(1);

    const { result } = renderHook(() => useLinkedProviders('user-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Trigger link mutation
    await act(async () => {
      await result.current.linkProvider({
        provider: 'facebook' as OAuthProvider,
        providerProfile: {
          name: 'Test User',
          email: 'user@fb.com',
          provider: 'facebook' as OAuthProvider,
          providerUserId: 'fb-123',
        },
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isLinking).toBe(false);
    });

    expect(mockLinkSocialAccount).toHaveBeenCalledWith(
      'facebook',
      expect.objectContaining({ email: 'user@fb.com' }),
      'password123'
    );
  });

  it('should unlink a provider successfully', async () => {
    const mockProviders: LinkedProvider[] = [
      {
        provider: 'google' as OAuthProvider,
        providerEmail: 'user@gmail.com',
        linkedAt: '2026-05-01T10:00:00Z',
      },
    ];

    mockGetLinkedProviders.mockResolvedValueOnce(mockProviders).mockResolvedValueOnce([]);
    mockUnlinkSocialAccount.mockResolvedValue([]);
    mockCountLoginMethods.mockResolvedValue(2);

    const { result } = renderHook(() => useLinkedProviders('user-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Trigger unlink mutation
    await act(async () => {
      await result.current.unlinkProvider('google' as OAuthProvider);
    });

    await waitFor(() => {
      expect(result.current.isUnlinking).toBe(false);
    });

    expect(mockUnlinkSocialAccount).toHaveBeenCalledWith('google');
  });

  it('should refetch data after linking', async () => {
    const mockProviders: LinkedProvider[] = [];
    mockGetLinkedProviders.mockResolvedValue(mockProviders);
    mockLinkSocialAccount.mockResolvedValue([]);
    mockCountLoginMethods.mockResolvedValue(1);

    const { result } = renderHook(() => useLinkedProviders('user-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.linkProvider({
        provider: 'apple' as OAuthProvider,
        providerProfile: {
          name: 'Test User',
          email: 'user@apple.com',
          provider: 'apple' as OAuthProvider,
          providerUserId: 'apple-123',
        },
      });
    });

    expect(mockGetLinkedProviders).toHaveBeenCalledTimes(2);
  });
});
