// File: p2p-kids-marketplace/src/hooks/useLinkedProviders.ts
// MODULE-03 AUTH-V3-008: React Query hook for linked providers management

import { useCallback, useEffect, useState } from 'react';
import {
  getLinkedProviders,
  linkSocialAccount,
  unlinkSocialAccount,
  countLoginMethods,
} from '@/services/accountService';
import type { OAuthProvider, LinkedProvider, ProviderProfile } from '@/types/auth-v3';

/**
 * React Query hook for managing linked social providers
 * Provides list, link, and unlink mutations with automatic cache updates
 */
export function useLinkedProviders(userId: string) {
  const [providers, setProviders] = useState<LinkedProvider[]>([]);
  const [loginMethodCount, setLoginMethodCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [linkError, setLinkError] = useState<Error | null>(null);
  const [unlinkError, setUnlinkError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [linkedProviders, methodCount] = await Promise.all([
        getLinkedProviders(),
        countLoginMethods(userId),
      ]);

      setProviders(linkedProviders);
      setLoginMethodCount(methodCount);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load linked providers'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const linkProvider = useCallback(
    async ({
      provider,
      providerProfile,
      password,
    }: {
      provider: OAuthProvider;
      providerProfile: ProviderProfile;
      password?: string;
    }) => {
      setIsLinking(true);
      setLinkError(null);

      try {
        await linkSocialAccount(provider, providerProfile, password);
        await refetch();
      } catch (err) {
        setLinkError(err instanceof Error ? err : new Error('Failed to link provider'));
      } finally {
        setIsLinking(false);
      }
    },
    [refetch]
  );

  const unlinkProvider = useCallback(
    async (provider: OAuthProvider) => {
      setIsUnlinking(true);
      setUnlinkError(null);

      try {
        await unlinkSocialAccount(provider);
        await refetch();
      } catch (err) {
        setUnlinkError(err instanceof Error ? err : new Error('Failed to unlink provider'));
      } finally {
        setIsUnlinking(false);
      }
    },
    [refetch]
  );

  return {
    providers,
    loginMethodCount,
    isLoading,
    error,
    refetch,
    linkProvider,
    unlinkProvider,
    isLinking,
    isUnlinking,
    linkError,
    unlinkError,
  };
}
