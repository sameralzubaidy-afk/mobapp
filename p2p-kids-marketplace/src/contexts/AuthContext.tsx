// File: p2p-kids-marketplace/src/contexts/AuthContext.tsx
// MODULE-03 AUTH-V2-003: Authentication Context with Session Management

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../config/supabase';
import { AuthSession, AuthError, SubscriptionStatus } from '../types/user';
import { loginWithContext } from '../services/auth';
import { useUserStore } from '../stores/userStore';

const SUPABASE_CONFIGURED = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
const TEST_SESSION_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Authentication context type
 */
export interface AuthContextType {
  // Session state
  session: AuthSession | null;
  user?: AuthSession['user'] | null;
  isLoading: boolean;
  isSignout: boolean;
  error: AuthError | null;

  // Session management
  setSession: (session: AuthSession | null) => void;
  refreshSession: (silent?: boolean) => Promise<void>;
  logout: () => Promise<void>;

  // Subscription change listener
  subscribeToSessionChanges: (callback: (session: AuthSession | null) => void) => () => void;
}

/**
 * Create auth context
 */
export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
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
  // Default to `false` so UI doesn't get stuck on an endless spinner
  // if initialization hangs on certain Android environments.
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [isSignout, setIsSignout] = useState(false);
  const { setUser, clearUser } = useUserStore();

  // Realtime subscription references
  const subscriptionRef = useRef<any>(null);
  const walletRef = useRef<any>(null);
  const profileRef = useRef<any>(null);

  const removeRealtimeChannel = useCallback((channelRef: React.MutableRefObject<any>) => {
    const channel = channelRef.current;
    channelRef.current = null;

    if (!channel) return;

    void channel.unsubscribe();
    void supabase.removeChannel(channel);
  }, []);

  // Session change listeners (for external components to react to session updates)
  const sessionChangeListenersRef = useRef<Set<(session: AuthSession | null) => void>>(new Set());

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
    sessionChangeListenersRef.current.forEach((listener) => listener(newSession));
  }, []);

  /**
   * Set session with listener notification
   */
  const setSession = useCallback(
    (newSession: AuthSession | null) => {
      setSessionState(newSession);
      notifySessionChanges(newSession);

      // Sync with userStore
      if (newSession?.user) {
        setUser({
          id: newSession.user.user_id, // Use user_id which is the auth.users.id
          email: newSession.user.email || '', // email is optional in profile but required in userStore
          name: newSession.user.name || '',
          avatar_url: newSession.user.avatar_url || null,
          node_id: newSession.user.node_id || null,
          node: newSession.user.node || null,
        });
      } else {
        clearUser();
      }
    },
    [notifySessionChanges, setUser, clearUser]
  );

  /**
   * Refresh session: Re-fetch session from Supabase + subscription + SP wallet context
   *
   * Called after:
   * - Initial app load
   * - App resume (foreground)
   * - Manual refresh request (e.g., after onboarding completion)
   * - Subscription/wallet Realtime changes
   */
  const refreshSession = useCallback(
    async (silent: boolean = true) => {
      try {
        if (!SUPABASE_CONFIGURED) {
          if (session?.user?.user_id === TEST_SESSION_USER_ID) {
            return;
          }
          setSession(null);
          return;
        }

        if (!silent) setIsLoading(true);
        setError(null);

        // First, get the current Supabase auth session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AUTH] Failed to get session:', sessionError);
          throw sessionError;
        }

        if (!sessionData.session?.user) {
          if (session?.user?.user_id === TEST_SESSION_USER_ID) {
            return;
          }
          // No active session - clear context
          setSession(null);
          return;
        }

        // User is authenticated - fetch their profile with latest data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, node:nodes(*)')
          .eq('user_id', sessionData.session.user.id)
          .single();

        if (profileError || !profileData) {
          console.error('[AUTH] Failed to fetch profile:', profileError);
          setSession(null);
          return;
        }

        if (profileData.deleted_at) {
          console.warn('[AUTH] Soft-deleted account detected during refresh; signing out');
          await supabase.auth.signOut();
          setSession(null);
          return;
        }

        // Re-fetch subscription summary from MODULE-11
        const { data: subData, error: subError } = await (supabase.rpc('get_subscription_summary', {
          p_user_id: sessionData.session.user.id,
        }) as any);

        type RawSubscriptionSummary = {
          status?: string;
          can_spend_sp?: boolean | string | null;
        };

        const mapStatus = (raw?: string): SubscriptionStatus => {
          switch (raw?.toLowerCase()) {
            case 'trialing':
            case 'trial_ending':
            case 'trial':
              return 'trial';
            case 'free':
              return 'free';
            case 'active':
              return 'active';
            case 'grace_period':
            case 'grace':
              return 'grace';
            case 'cancelled':
            case 'canceled':
            case 'expired':
              return 'canceled';
            default:
              return 'free';
          }
        };

        let subscriptionSummary: RawSubscriptionSummary | null = null;

        if (subError) {
          console.warn('[AUTH] get_subscription_summary warning:', subError);
        } else if (Array.isArray(subData) && subData.length > 0) {
          subscriptionSummary = subData[0];
        } else if (Array.isArray(subData) && subData.length === 0) {
          subscriptionSummary = { status: 'free', can_spend_sp: false };
        } else if (subData && !Array.isArray(subData)) {
          subscriptionSummary = subData;
        } else {
          subscriptionSummary = { status: 'free', can_spend_sp: false };
        }

        const normalizedSubscriptionSummary = (() => {
          const base = subscriptionSummary ?? { status: 'free', can_spend_sp: false };
          const canSpend =
            typeof base.can_spend_sp === 'string'
              ? base.can_spend_sp === 'true' || base.can_spend_sp === 't'
              : Boolean(base.can_spend_sp);

          return {
            status: mapStatus(base.status),
            can_spend_sp: canSpend,
          };
        })();

        // Re-fetch SP wallet summary from MODULE-09
        const { data: walletData, error: walletError } = await (supabase.rpc(
          'get_user_sp_wallet_summary',
          { p_user_id: sessionData.session.user.id }
        ) as any);

        if (walletError) {
          console.warn('[AUTH] ⚠️ get_user_sp_wallet_summary error:', walletError);
        }

        // Handle different return types
        let walletSummary = {
          available_points: 0,
          pending_points: 0,
          lifetime_earned: 0,
          lifetime_spent: 0,
          wallet_state: 'inactive' as 'active' | 'frozen' | 'suspended' | 'grace_period' | 'inactive', // ADMIN-V2-003
        };

        if (Array.isArray(walletData) && walletData.length > 0) {
          walletSummary = walletData[0];
        } else if (walletData && !Array.isArray(walletData)) {
          walletSummary = walletData;
        }

        // Create updated session with FULL profile data
        const updatedSession: AuthSession = {
          user: {
            id: profileData.user_id || profileData.id,
            user_id: profileData.user_id || profileData.id,
            email: sessionData.session.user.email || '',
            name: profileData.name || profileData.full_name || '',
            display_name: profileData.name || profileData.full_name || '',
            avatar_url: profileData.avatar_url || undefined,
            bio: profileData.bio,
            city: profileData.city,
            state: profileData.state,
            zip_code: profileData.zip_code,
            node_id: profileData.node_id,
            node: profileData.node || undefined,
            profile_completed: profileData.profile_completed || false,
            onboarding_completed: profileData.onboarding_completed || false,
            phone_verified: profileData.phone_verified || false,
            phone_verified_at: profileData.phone_verified_at,
            account_status: profileData.account_status || 'active',
            suspended_at: profileData.suspended_at || null,
            suspension_reason: profileData.suspension_reason || null,
            subscription_id: profileData.subscription_id,
            sp_wallet_id: profileData.sp_wallet_id,
            onboarding_completed_at: profileData.onboarding_completed_at,
            parental_consent_verified: profileData.parental_consent_verified || false,
            age: profileData.age,
            referral_code: profileData.referral_code,
            created_at: profileData.created_at,
            updated_at: profileData.updated_at,
          },
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token || '',
          subscription_status: normalizedSubscriptionSummary.status,
          can_spend_sp: normalizedSubscriptionSummary.can_spend_sp,
          available_points: (walletSummary.available_points as number) || 0,
          pending_points: (walletSummary.pending_points as number) || 0,
          lifetime_earned: (walletSummary.lifetime_earned as number) || 0,
          lifetime_spent: (walletSummary.lifetime_spent as number) || 0,
          wallet_state: walletSummary.wallet_state || 'inactive', // ADMIN-V2-003
        };

        setSession(updatedSession);
      } catch (err) {
        console.error('[AUTH] Session refresh failed:', err);
        const authError =
          err instanceof AuthError
            ? err
            : new AuthError('Session refresh failed', 'REFRESH_FAILED', err);
        setError(authError);
      } finally {
        setIsLoading(false);
      }
    },
    [session?.user?.user_id, setSession]
  );
  /**
   * Setup real-time subscription listener
   * Listens to subscriptions table for changes
   */
  const setupSubscriptionListener = useCallback((userId: string) => {
    if (!userId) return;

    try {
      // Clean up old subscription before creating a fresh channel.
      removeRealtimeChannel(subscriptionRef);

      // Listen to subscriptions table for this user
      const channel = supabase
        .channel(`auth-subscriptions:${userId}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[AUTH] Subscription changed:', payload);
            // Refresh session when subscription changes
            refreshSession();
          }
        );

      subscriptionRef.current = channel;

      channel.subscribe((status) => {
          // Ignore status updates from stale channels already replaced/removed.
          if (subscriptionRef.current !== channel) return;

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[AUTH] Subscription channel status:', status);
          }
        });
    } catch (err) {
      console.error('[AUTH] Failed to setup subscription listener:', err);
    }
  }, [refreshSession, removeRealtimeChannel]);

  /**
   * Setup real-time SP wallet listener
   * Listens to sp_wallets table for changes
   */
  const setupWalletListener = useCallback((userId: string) => {
    if (!userId) return;

    try {
      // Clean up old wallet subscription before creating a fresh channel.
      removeRealtimeChannel(walletRef);

      // Listen to sp_wallets table for this user
      const channel = supabase
        .channel(`auth-wallet:${userId}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sp_wallets',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[AUTH] SP Wallet changed:', payload);
            // Refresh session when wallet changes
            refreshSession();
          }
        );

      walletRef.current = channel;

      channel.subscribe((status) => {
          // Ignore status updates from stale channels already replaced/removed.
          if (walletRef.current !== channel) return;

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[AUTH] Wallet channel status:', status);
          }
        });
    } catch (err) {
      console.error('[AUTH] Failed to setup wallet listener:', err);
    }
  }, [refreshSession, removeRealtimeChannel]);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      setIsSignout(true);

      // Clean up real-time listeners
      removeRealtimeChannel(profileRef);
      removeRealtimeChannel(subscriptionRef);
      removeRealtimeChannel(walletRef);

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
      const authError =
        err instanceof AuthError ? err : new AuthError('Logout failed', 'LOGOUT_ERROR', err);
      setError(authError);
    } finally {
      setIsSignout(false);
    }
  }, [setSession, removeRealtimeChannel]);

  /**
   * Initialize auth state on app load
   * Restores session from Supabase if user is authenticated
   */
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      console.warn('[AUTH] Supabase env not set; skipping auth initialization');
      setSession(null);
      setIsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    const initializeAuth = async () => {
      console.log('[AUTH] 🏁 Initializing auth state...');
      const withTimeout = async <T,>(
        promise: Promise<T>,
        ms: number,
        label: string
      ): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`${label} timeout after ${ms}ms`));
          }, ms);
        });

        try {
          return (await Promise.race([promise, timeoutPromise])) as T;
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      };

      const initTimeout = setTimeout(() => {
        if (isLoadingRef.current) {
          console.warn('[AUTH] ⚠️ Initialization taking too long, forcing loading to false');
          isLoadingRef.current = false;
          setIsLoading(false);
        }
      }, 10000); // 10s safety valve

      try {
        isLoadingRef.current = true;
        setIsLoading(true);
        // mark startup step
        try {
          require('@/utils/startupDebug').setStartupStep('fetching session');
        } catch (_) {}

        // Get current session from Supabase with timeout protection
        console.log('[AUTH] 🔍 Fetching session...');
        const { data: sessionData, error: sessionError } = (await withTimeout(
          supabase.auth.getSession(),
          5000,
          'Session fetch'
        )) as any;

        if (sessionError) {
          console.error('[AUTH] ❌ Session fetch error:', sessionError);
          throw new AuthError('Failed to restore session', 'RESTORE_SESSION_ERROR', sessionError);
        }

        if (sessionData.session?.user) {
          try {
            require('@/utils/startupDebug').setStartupStep('fetching profile');
          } catch (_) {}
          console.log('[AUTH] 👤 User found in session:', sessionData.session.user.id);

          // User is authenticated - restore session from profile
          console.log('[AUTH] 🔍 Fetching profile...');
          const { data: profileData, error: profileError } = (await withTimeout(
            supabase
              .from('profiles')
              .select('*, node:nodes(*)')
              .eq('user_id', sessionData.session.user.id)
              .single(),
            6000,
            'Profile fetch'
          )) as any;

          if (!profileError && profileData) {
            if (profileData.deleted_at) {
              console.warn('[AUTH] Soft-deleted account detected on startup; signing out');
              await supabase.auth.signOut();
              setSession(null);
              return;
            }

            try {
              require('@/utils/startupDebug').setStartupStep('fetching subscription');
            } catch (_) {}
            console.log('[AUTH] ✅ Profile found');

            // Also fetch subscription status from subscriptions table (source of truth)
            console.log('[AUTH] 🔍 Fetching subscription status...');
            const { data: subscriptionData } = (await withTimeout(
              supabase
                .from('subscriptions')
                .select('status,trial_end_date,current_period_end')
                .eq('user_id', sessionData.session.user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
              6000,
              'Subscription fetch'
            )) as any;

            const subscriptionStatus = subscriptionData?.status || 'free';
            
            // Also fetch SP wallet summary (now includes wallet_state)
            console.log('[AUTH] 🔍 Fetching SP wallet summary...');
            const { data: walletData, error: walletFetchError } = (await withTimeout(
              supabase.rpc('get_user_sp_wallet_summary', {
                p_user_id: sessionData.session.user.id,
              }),
              6000,
              'Wallet summary fetch'
            )) as any;

            if (walletFetchError) {
              console.warn('[AUTH] ⚠️ Wallet fetch error:', walletFetchError);
            } else {
              console.log('[AUTH] ✅ Wallet data received:', walletData);
            }

            let walletSummary = {
              available_points: 0,
              pending_points: 0,
              lifetime_earned: 0,
              lifetime_spent: 0,
              wallet_state: 'inactive' as 'active' | 'frozen' | 'suspended' | 'grace_period' | 'inactive', // ADMIN-V2-003: default state
            };

            if (Array.isArray(walletData) && walletData.length > 0) {
              walletSummary = walletData[0];
              console.log('[AUTH] 📊 Wallet summary from array:', walletSummary);
            } else if (walletData && !Array.isArray(walletData)) {
              walletSummary = walletData;
              console.log('[AUTH] 📊 Wallet summary from object:', walletSummary);
            } else {
              console.warn('[AUTH] ⚠️ No wallet data received, using defaults');
            }

            // ADMIN-V2-003: can_spend_sp now checks BOTH subscription AND wallet state
            const canSpendSP = 
              (subscriptionStatus === 'trial' || subscriptionStatus === 'active') &&
              (walletSummary.wallet_state === 'active');
            
            console.log('[AUTH] 💰 SP spending eligibility:', {
              subscriptionStatus,
              wallet_state: walletSummary.wallet_state,
              canSpendSP,
            });

            // Create a session with FULL profile data (including onboarding_completed)
            const authSession: AuthSession = {
              user: {
                id: profileData.user_id || profileData.id,
                user_id: profileData.user_id || profileData.id,
                email: sessionData.session.user.email || '',
                name: profileData.name || profileData.full_name || '',
                display_name: profileData.name || profileData.full_name || '',
                avatar_url: profileData.avatar_url || undefined,
                bio: profileData.bio,
                city: profileData.city,
                state: profileData.state,
                zip_code: profileData.zip_code,
                node_id: profileData.node_id,
                node: profileData.node || undefined,
                profile_completed: profileData.profile_completed || false,
                onboarding_completed: profileData.onboarding_completed || false,
                phone_verified: profileData.phone_verified || false,
                phone_verified_at: profileData.phone_verified_at,
                account_status: profileData.account_status || 'active',
                suspended_at: profileData.suspended_at || null,
                suspension_reason: profileData.suspension_reason || null,
                subscription_id: profileData.subscription_id,
                sp_wallet_id: profileData.sp_wallet_id,
                onboarding_completed_at: profileData.onboarding_completed_at,
                parental_consent_verified: profileData.parental_consent_verified || false,
                age: profileData.age,
                referral_code: profileData.referral_code,
                created_at: profileData.created_at,
                updated_at: profileData.updated_at,
              },
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token || '',
              subscription_status: subscriptionStatus,
              can_spend_sp: canSpendSP,
              available_points: (walletSummary.available_points as number) || 0,
              pending_points: (walletSummary.pending_points as number) || 0,
              lifetime_earned: (walletSummary.lifetime_earned as number) || 0,
              lifetime_spent: (walletSummary.lifetime_spent as number) || 0,
              wallet_state: walletSummary.wallet_state || 'inactive', // ADMIN-V2-003
            };
            setSession(authSession);
            try {
              require('@/utils/startupDebug').setStartupStep('session restored');
            } catch (_) {}
            console.log('[AUTH] 🎉 Session restored successfully');
          } else {
            console.warn('[AUTH] ⚠️ Profile not found for authenticated user');
            setSession(null);
          }
        } else {
          try {
            require('@/utils/startupDebug').setStartupStep('no active session');
          } catch (_) {}
          console.log('[AUTH] ℹ️ No active session found');
          setSession(null);
        }
      } catch (err: any) {
        // Ignore expected auth errors during init (e.g., no session on first load)
        if (
          err?.code === 'INVALID_CREDENTIALS' ||
          err?.message?.includes('Invalid login credentials')
        ) {
          console.log('[AUTH] ℹ️ No active session on startup (expected)');
          setSession(null);
        } else {
          console.error('[AUTH] ❌ Failed to initialize auth:', err);
          const authError =
            err instanceof AuthError
              ? err
              : new AuthError('Auth initialization failed', 'INIT_FAILED', err);
          setError(authError);
          setSession(null);
        }
      } finally {
        console.log('[AUTH] ✅ Initialization complete');
        clearTimeout(initTimeout);
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Setup real-time listeners when session is established
   * Re-enabled: Added individual listeners for wallet and subscription
   *
   * Added: Auto-refresh when wallet, subscription, or profile changes
   */
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // 1. Profile listener (onboarding completion, node changes)
    try {
      removeRealtimeChannel(profileRef);

      const channel = supabase
        .channel(`auth-profiles:${userId}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[AUTH] Profile changed:', payload);
            refreshSession();
          }
        );

      profileRef.current = channel;

      channel.subscribe((status) => {
        if (profileRef.current !== channel) return;

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[AUTH] Profile channel status:', status);
        }
      });
    } catch (err) {
      console.error('[AUTH] Failed to setup profile listener:', err);
    }

    // 2. Wallet listener (SP balance updates from trades/sales)
    setupWalletListener(userId);

    // 3. Subscription listener (Status changes)
    setupSubscriptionListener(userId);

    return () => {
      removeRealtimeChannel(profileRef);
      removeRealtimeChannel(walletRef);
      removeRealtimeChannel(subscriptionRef);
    };
  }, [session?.user?.id, refreshSession, setupWalletListener, setupSubscriptionListener, removeRealtimeChannel]);

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
    user: session?.user || null,
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
