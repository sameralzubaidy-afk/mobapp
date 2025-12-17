// File: p2p-kids-marketplace/src/contexts/AuthContext.tsx
// MODULE-03 AUTH-V2-003: Authentication Context with Session Management

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { supabase } from '../config/supabase';
import { AuthSession, AuthError } from '../types/user';
import { loginWithContext } from '../services/auth';

/**
 * Authentication context type
 */
export interface AuthContextType {
  // Session state
  session: AuthSession | null;
  isLoading: boolean;
  isSignout: boolean;
  error: AuthError | null;

  // Session management
  setSession: (session: AuthSession | null) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;

  // Subscription change listener
  subscribeToSessionChanges: (callback: (session: AuthSession | null) => void) => () => void;
}

/**
 * Create auth context
 */
export const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isSignout: false,
  error: null,
  setSession: () => {},
  refreshSession: async () => {},
  logout: async () => {},
  subscribeToSessionChanges: () => () => {},
});

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AUTH-V2-003: AuthProvider Component
 *
 * Provides:
 * - Session state (user, subscription status, SP balance)
 * - Session refresh logic (fetches latest subscription + SP data)
 * - Real-time subscription updates (Realtime listeners)
 * - Logout with cleanup
 *
 * Features:
 * - Automatic session restore on app resume
 * - Real-time subscription status sync
 * - Real-time SP wallet sync
 * - Error boundary with retry logic
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Session state
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [isSignout, setIsSignout] = useState(false);

  // Realtime subscription references
  const subscriptionRef = useRef<any>(null);
  const walletRef = useRef<any>(null);

  // Session change listeners (for external components to react to session updates)
  const sessionChangeListenersRef = useRef<Set<(session: AuthSession | null) => void>>(
    new Set()
  );

  /**
   * Subscribe to session changes
   * Returns unsubscribe function
   */
  const subscribeToSessionChanges = useCallback(
    (callback: (session: AuthSession | null) => void) => {
      sessionChangeListenersRef.current.add(callback);

      // Return unsubscribe function
      return () => {
        sessionChangeListenersRef.current.delete(callback);
      };
    },
    []
  );

  /**
   * Notify all session change listeners
   */
  const notifySessionChanges = useCallback((newSession: AuthSession | null) => {
    sessionChangeListenersRef.current.forEach(listener => listener(newSession));
  }, []);

  /**
   * Set session with listener notification
   */
  const setSession = useCallback((newSession: AuthSession | null) => {
    setSessionState(newSession);
    notifySessionChanges(newSession);
  }, [notifySessionChanges]);

  /**
   * Refresh session: Re-fetch subscription + SP wallet context
   *
   * Called after:
   * - Initial app load
   * - App resume (foreground)
   * - Manual refresh request
   * - Subscription/wallet Realtime changes
   */
  const refreshSession = useCallback(async () => {
    if (!session) return;

    try {
      setError(null);

      // Re-fetch subscription summary from MODULE-11
      const { data: subData, error: subError } = await (supabase.rpc(
        'get_subscription_summary',
        { p_user_id: session.user.id }
      ) as any);

      if (subError) throw subError;

      const subscriptionSummary = (subData as any[])?.[0] || {
        status: 'free',
        can_spend_sp: false,
      };

      // Re-fetch SP wallet summary from MODULE-09
      const { data: walletData, error: walletError } = await (supabase.rpc(
        'get_user_sp_wallet_summary',
        { p_user_id: session.user.id }
      ) as any);

      if (walletError) throw walletError;

      const walletSummary = (walletData as any[])?.[0] || {
        available_points: 0,
        pending_points: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
      };

      // Update session with refreshed context
      const updatedSession: AuthSession = {
        ...session,
        subscription_status: subscriptionSummary.status,
        can_spend_sp: subscriptionSummary.can_spend_sp,
        available_points: walletSummary.available_points,
        pending_points: walletSummary.pending_points,
        lifetime_earned: walletSummary.lifetime_earned,
        lifetime_spent: walletSummary.lifetime_spent,
      };

      setSession(updatedSession);
      console.log('[AUTH] Session refreshed:', {
        subscription_status: updatedSession.subscription_status,
        available_points: updatedSession.available_points,
      });
    } catch (err) {
      console.error('[AUTH] Session refresh failed:', err);
      const authError = err instanceof AuthError
        ? err
        : new AuthError('Session refresh failed', 'REFRESH_FAILED', err);
      setError(authError);
    }
  }, [setSession]);

  /**
   * Setup real-time subscription listener
   * Listens to subscriptions table for changes
   */
  const setupSubscriptionListener = useCallback(() => {
    if (!session) return;

    try {
      // Clean up old subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      // Listen to subscriptions table for this user
      subscriptionRef.current = supabase
        .channel(`subscriptions:user_id=eq.${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${session.user.id}`,
          },
          payload => {
            console.log('[AUTH] Subscription changed:', payload);
            // Refresh session when subscription changes
            refreshSession();
          }
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            // Listener is now active - don't log to reduce noise
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[AUTH] Subscription channel error');
          }
        });
    } catch (err) {
      console.error('[AUTH] Failed to setup subscription listener:', err);
    }
  }, [session, refreshSession]);

  /**
   * Setup real-time SP wallet listener
   * Listens to sp_wallets table for changes
   */
  const setupWalletListener = useCallback(() => {
    if (!session) return;

    try {
      // Clean up old wallet subscription
      if (walletRef.current) {
        walletRef.current.unsubscribe();
      }

      // Listen to sp_wallets table for this user
      walletRef.current = supabase
        .channel(`sp_wallets:user_id=eq.${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sp_wallets',
            filter: `user_id=eq.${session.user.id}`,
          },
          payload => {
            console.log('[AUTH] SP Wallet changed:', payload);
            // Refresh session when wallet changes
            refreshSession();
          }
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            // Listener is now active - don't log to reduce noise
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[AUTH] Wallet channel error');
          }
        });
    } catch (err) {
      console.error('[AUTH] Failed to setup wallet listener:', err);
    }
  }, [session, refreshSession]);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      setIsSignout(true);

      // Clean up real-time listeners
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (walletRef.current) {
        walletRef.current.unsubscribe();
      }

      // Sign out from Supabase
      const { error: signoutError } = await supabase.auth.signOut();

      if (signoutError) {
        throw new AuthError('Logout failed', 'LOGOUT_FAILED', signoutError);
      }

      // Clear session
      setSession(null);
      setError(null);
      console.log('[AUTH] Logout successful');
    } catch (err) {
      console.error('[AUTH] Logout error:', err);
      const authError = err instanceof AuthError
        ? err
        : new AuthError('Logout failed', 'LOGOUT_ERROR', err);
      setError(authError);
    } finally {
      setIsSignout(false);
    }
  }, [setSession]);

  /**
   * Initialize auth state on app load
   * Restores session from Supabase if user is authenticated
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Get current session from Supabase with timeout protection
        // Android can hang on this call if network is slow - timeout after 5s
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        );

        const { data: sessionData, error: sessionError } =
          await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (sessionError) {
          throw new AuthError(
            'Failed to restore session',
            'RESTORE_SESSION_ERROR',
            sessionError
          );
        }

        if (sessionData.session?.user) {
          // User is authenticated - restore session from profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single();

          if (!profileError && profileData) {
            // Create a minimal session from stored profile
            const authSession: AuthSession = {
              user: {
                id: sessionData.session.user.id,
                email: sessionData.session.user.email || '',
                name: profileData.full_name || '',
                avatar: profileData.avatar_url || undefined,
              },
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token || '',
              subscription_status: profileData.subscription_tier || 'free',
              can_spend_sp: profileData.subscription_tier === 'active' || profileData.subscription_tier === 'trial',
              available_points: 0,
              pending_points: 0,
              lifetime_earned: 0,
              lifetime_spent: 0,
            };
            setSession(authSession);
            console.log('[AUTH] Session restored for user:', authSession.user.id);
          } else {
            // Profile not found, clear session
            setSession(null);
          }
        } else {
          // No active session
          setSession(null);
        }
      } catch (err: any) {
        // Ignore expected auth errors during init (e.g., no session on first load)
        if (err?.code === 'INVALID_CREDENTIALS' || err?.message?.includes('Invalid login credentials')) {
          console.log('[AUTH] No active session on startup (expected)');
          setSession(null);
        } else {
          console.error('[AUTH] Failed to initialize auth:', err);
          const authError = err instanceof AuthError
            ? err
            : new AuthError('Auth initialization failed', 'INIT_FAILED', err);
          setError(authError);
          setSession(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Setup real-time listeners when session is established
   * DISABLED: Causing infinite loops - will use manual refresh instead
   * 
   * Added: Auto-refresh when onboarding completes (detects profile updates)
   */
  useEffect(() => {
    if (!session) return;

    // Setup a listener for profile changes (onboarding completion, profile updates)
    let profileRef: any = null;
    try {
      profileRef = supabase
        .channel(`profiles:user_id=eq.${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            console.log('[AUTH] Profile changed:', payload);
            // Refresh session when profile changes (e.g., onboarding_completed, subscription_tier)
            refreshSession();
          }
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            console.log('[AUTH] Profile listener subscribed');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[AUTH] Profile channel error');
          }
        });
    } catch (err) {
      console.error('[AUTH] Failed to setup profile listener:', err);
    }

    return () => {
      if (profileRef) {
        profileRef.unsubscribe();
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (walletRef.current) {
        walletRef.current.unsubscribe();
      }
    };
  }, [session, refreshSession]);

  /**
   * Handle app state changes (resume/background)
   * Refresh session when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };

    function handleAppStateChange(state: string) {
      if (state === 'active' && session) {
        console.log('[AUTH] App resumed - refreshing session');
        refreshSession();
      }
    }
  }, [session, refreshSession]);

  const value: AuthContextType = {
    session,
    isLoading,
    isSignout,
    error,
    setSession,
    refreshSession,
    logout,
    subscribeToSessionChanges,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
