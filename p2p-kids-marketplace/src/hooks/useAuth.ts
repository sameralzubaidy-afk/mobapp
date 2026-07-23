// File: p2p-kids-marketplace/src/hooks/useAuth.ts
// MODULE-03 AUTH-V2-003: useAuth Hook for Auth Context Consumption

import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';

/**
 * AUTH-V2-003: useAuth Hook
 *
 * Provides access to authentication context in any component.
 *
 * Usage:
 * ```tsx
 * const { session, isLoading, logout, refreshSession } = useAuth();
 * ```
 *
 * Available properties:
 * - session: Current AuthSession (null if not logged in)
 * - isLoading: True while initializing or refreshing
 * - isSignout: True while signing out
 * - error: AuthError if any operation failed
 * - setSession: Manually set session (used internally)
 * - refreshSession: Re-fetch subscription + SP context
 * - logout: Sign out user
 * - subscribeToSessionChanges: Listen to session updates
 *
 * @throws Error if used outside AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

/**
 * Convenience hook: Is user authenticated?
 */
export const useIsAuthenticated = (): boolean => {
  const { session } = useAuth();
  return !!session;
};

/**
 * Convenience hook: Get current user
 */
export const useUser = () => {
  const { session } = useAuth();
  return session?.user ?? null;
};

/**
 * Convenience hook: Get subscription status
 */
export const useSubscriptionStatus = () => {
  const { session } = useAuth();
  return {
    status: session?.subscription_status ?? 'free',
    canSpendSP: session?.can_spend_sp ?? false,
    isTrialExpired:
      session?.subscription_status === 'free' || session?.subscription_status === 'grace',
  };
};

/**
 * Convenience hook: Get SP wallet summary
 */
export const useSPWallet = () => {
  const { session } = useAuth();
  return {
    available: session?.available_points ?? 0,
    pending: session?.pending_points ?? 0,
    reserved: session?.reserved_points ?? 0,
    lifetime_earned: session?.lifetime_earned ?? 0,
    lifetime_spent: session?.lifetime_spent ?? 0,
  };
};
