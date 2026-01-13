// File: p2p-kids-marketplace/src/services/auth.ts
// MODULE-03 AUTH-V2: Authentication Service

import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import {
  AuthSession,
  LoginInput,
  UserProfile,
  AuthError,
} from '../types/user';

/**
 * AUTH-V2-001: User Signup (No Trial Activation)
 * 
 * Trial subscription is offered AFTER profile completion.
 * This flow only creates the auth user and basic profile.
 */
export async function signup(input: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  dob?: string | null;
  referralCode?: string;
}): Promise<{ user: SupabaseUser | null; error: AuthError | null }> {
  // This function already exists in the old service
  // Delegate to existing signUp function if available
  // For now, just create the auth user without trial
  
  const { email, password, name, phone, dob } = input;

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          phone: phone,
          dob: dob,
        },
      },
    });

    if (authError) {
      throw new AuthError(
        authError.message,
        authError.name || 'SIGNUP_FAILED',
        authError
      );
    }

    return { user: authData.user, error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { user: null, error };
    }
    const err = error as Error;
    return { 
      user: null, 
      error: new AuthError(err.message || 'Signup failed', 'SIGNUP_ERROR', err) 
    };
  }
}

/**
 * AUTH-V2-001B: User Signup with Initial Free Subscription
 * 
 * Creates auth user, profile, and FREE subscription.
 * Trial subscription is offered on SubscriptionChoiceScreen AFTER profile completion.
 * If user chooses trial on SubscriptionChoiceScreen, upgrade_free_subscription_to_trial() is called.
 * 
 * This approach ensures:
 * 1. Users who select FREE tier get exactly that (no trial trial)
 * 2. Users who select TRIAL get upgraded via upgrade_free_subscription_to_trial() RPC
 * 3. Session reflects the correct subscription status from the start
 */
export async function signupWithTrial(input: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  dob?: string | null;
  referralCode?: string;
}): Promise<{ user: SupabaseUser | null; error: AuthError | null }> {
  const { email, password, name, phone, dob } = input;

  try {
    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          phone: phone,
          dob: dob,
        },
      },
    });

    if (authError) {
      throw new AuthError(
        authError.message,
        authError.name || 'SIGNUP_FAILED',
        authError
      );
    }

    if (!authData.user) {
      throw new AuthError(
        'Signup succeeded but no user returned',
        'SIGNUP_NO_USER',
        { message: 'Auth returned empty user object' }
      );
    }

    const userId = authData.user.id;

    // Step 2: Profile is auto-created by trigger on auth.users
    // The handle_new_user() trigger handles this
    // Just verify the profile exists
    let profileExists = false;
    for (let i = 0; i < 3; i++) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profile) {
        profileExists = true;
        break;
      }
      // Brief wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (!profileExists) {
      console.warn('Profile creation trigger may have failed for user:', userId);
    }

    // Step 3: Create FREE subscription (not trial yet)
    // User will choose Free or Trial on SubscriptionChoiceScreen
    // If they choose trial, it will be upgraded by enrollInTrialSubscription
    const { data: subscription, error: subError } = await supabase.rpc(
      'create_free_subscription',
      { p_user_id: userId }
    );

    if (subError) {
      console.warn('Free subscription creation warning:', subError);
      // Don't fail signup if subscription creation fails - just log warning
      // User will be asked to choose tier anyway
    }

    // Step 4: Initialize SP wallet (MODULE-09)
    const { data: wallet, error: walletError } = await supabase.rpc(
      'initialize_sp_wallet',
      { p_user_id: userId }
    );

    if (walletError) {
      console.warn('SP wallet initialization warning:', walletError);
      // Don't fail signup if wallet fails - just log warning
    }

    // Step 5: Link subscription and wallet to profile (if both created successfully)
    if (subscription && wallet) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_id: (subscription as { id: string }).id,
          sp_wallet_id: (wallet as { id: string }).id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('user_id', userId);

      if (updateError) {
        console.warn('Profile link update warning:', updateError);
        // Don't fail signup if update fails
      }
    }

    return { user: authData.user, error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { user: null, error };
    }
    const err = error as Error;
    return { 
      user: null, 
      error: new AuthError(
        err.message || 'Signup failed',
        'SIGNUP_ERROR',
        err
      ) 
    };
  }
}

/**
 * AUTH-V2-002: Enroll User in Kids Club+ Trial After Profile Completion
 * 
 * This function is called AFTER user completes their profile setup.
 * It activates the trial subscription and initializes the SP wallet.
 * 
 * Admin can control trial enrollment via admin_config table:
 * - trial_subscription.enabled: true/false to turn trial on/off
 * - trial_subscription.duration_days: configurable trial duration (default 30)
 * 
 * @param userId - User ID to enroll
 * @returns Object with subscription, wallet, and optional error
 */
export async function enrollInTrialSubscription(userId: string): Promise<{
  subscription: any;
  wallet: any;
  error?: AuthError;
}> {
  try {

    // NOTE: This function is invoked after profile completion.
    // Avoid creating profiles here; it complicates testability and can hide trigger failures.

    // Step 1: Check if trial enrollment is enabled (admin config)
    const { data: trialEnabled, error: trialEnabledError } = await supabase.rpc(
      'is_trial_enabled',
      {}
    );

    if (trialEnabledError) {
      throw new AuthError(
        `Failed to check trial status: ${trialEnabledError.message}`,
        'TRIAL_STATUS_CHECK_FAILED',
        trialEnabledError
      );
    }

    if (!trialEnabled) {
        return {
        subscription: null,
        wallet: null,
        error: new AuthError('Trial enrollment is currently disabled', 'TRIAL_DISABLED'),
      };
    }

    // Step 2: Create (or get) trial subscription
    const { data: subscription, error: subError } = await supabase.rpc(
      'create_trial_subscription',
      { p_user_id: userId }
    );

    if (subError) {
      console.error('[enrollInTrialSubscription] ❌ Subscription RPC error:', subError);
      throw new AuthError(
        `Failed to create trial subscription: ${subError.message}`,
        'SUBSCRIPTION_CREATION_FAILED',
        subError
      );
    }

    // Step 3: Initialize (or get) SP wallet
    const { data: wallet, error: walletError } = await supabase.rpc(
      'initialize_sp_wallet',
      { p_user_id: userId }
    );

    if (walletError) {
      console.error('[enrollInTrialSubscription] ❌ Wallet RPC error:', walletError);
      throw new AuthError(
        `Failed to initialize SP wallet: ${walletError.message}`,
        'WALLET_CREATION_FAILED',
        walletError
      );
    }

    // Step 4: Best-effort profile linking (do not block enrollment on this)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_id: (subscription as { id: string })?.id,
        sp_wallet_id: (wallet as { id: string })?.id,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('user_id', userId);

    if (updateError) {
      console.warn('[enrollInTrialSubscription] Warning updating profile links:', updateError);
    }

    return { subscription, wallet };
  } catch (error) {
    if (error instanceof AuthError) {
      return { subscription: null, wallet: null, error };
    }
    const err = error as Error;
    return {
      subscription: null,
      wallet: null,
      error: new AuthError('Trial enrollment failed', 'TRIAL_ENROLLMENT_FAILED', err),
    };
  }
}

/**
 * AUTH-V2-003: Login with Subscription Context
 * 
 * Enriches login session with:
 * - Subscription status (from MODULE-11)
 * - SP wallet summary (from MODULE-09)
 */
export async function loginWithContext(
  input: LoginInput
): Promise<AuthSession> {
  const { email, password } = input;

  try {
    // Step 1: Authenticate with Supabase
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      throw new AuthError(
        authError.message,
        authError.name || 'LOGIN_FAILED',
        authError
      );
    }

    if (!authData.user) {
      throw new AuthError('Login failed: No user returned', 'LOGIN_FAILED');
    }

    const userId = authData.user.id;

    // Step 2: Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new AuthError(
        'User profile not found',
        'PROFILE_NOT_FOUND',
        profileError
      );
    }

    // Step 3: Fetch subscription summary (MODULE-11)
    const { data: subData } = await supabase.rpc('get_subscription_summary', {
      p_user_id: userId,
    });

    // RPC may return: 1) array of rows (old TABLE return), 2) single JSONB object (new JSONB return)
    const subSummaryRaw = (Array.isArray(subData) ? subData[0] : subData) as Record<string, unknown> | null;
    const subscriptionSummary = subSummaryRaw || {
      status: 'none',
      can_spend_sp: false,
    };

    // Normalize booleans and default status value for UI consistency
    if (subscriptionSummary && typeof subscriptionSummary.can_spend_sp === 'string') {
      subscriptionSummary.can_spend_sp =
        subscriptionSummary.can_spend_sp === 'true' ||
        subscriptionSummary.can_spend_sp === 't';
    }
    subscriptionSummary.status = (subscriptionSummary.status as string) || 'free';

    // Step 4: Fetch SP wallet summary (MODULE-09)
    const { data: walletData } = await supabase.rpc(
      'get_user_sp_wallet_summary',
      {
        p_user_id: userId,
      }
    );

    const walletDataRaw = (Array.isArray(walletData) ? walletData[0] : walletData) as Record<string, unknown> | null;
    const walletSummary = walletDataRaw || {
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    };

    // Step 5: Build enriched session
    const session: AuthSession = {
      user: profile as UserProfile,
      access_token: authData.session!.access_token,
      refresh_token: authData.session!.refresh_token,
      subscription_status: subscriptionSummary.status as 'free' | 'trial' | 'active' | 'grace' | 'canceled',
      can_spend_sp: !!subscriptionSummary.can_spend_sp,
      available_points: (walletSummary.available_points as number) || 0,
      pending_points: (walletSummary.pending_points as number) || 0,
      lifetime_earned: (walletSummary.lifetime_earned as number) || 0,
      lifetime_spent: (walletSummary.lifetime_spent as number) || 0,
    };

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      'Login failed with unexpected error',
      'LOGIN_FAILED',
      error
    );
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new AuthError(
      'Logout failed',
      'LOGOUT_FAILED',
      error
    );
  }
}

/**
 * Get current session
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return null;
  }

  try {
    const userId = session.user.id;

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return null;
    }

    // Fetch subscription summary
    const { data: subData } = await supabase.rpc('get_subscription_summary', {
      p_user_id: userId,
    });

    const subSummaryRaw = (Array.isArray(subData) ? subData[0] : subData) as Record<string, unknown> | null;
    const subscriptionSummary = subSummaryRaw || {
      status: 'none',
      can_spend_sp: false,
    };

    // Normalize booleans and default status value
    if (subscriptionSummary && typeof subscriptionSummary.can_spend_sp === 'string') {
      subscriptionSummary.can_spend_sp = subscriptionSummary.can_spend_sp === 'true' || subscriptionSummary.can_spend_sp === 't';
    }
    subscriptionSummary.status = subscriptionSummary.status || 'free';

    // Fetch SP wallet summary
    const { data: walletData } = await supabase.rpc(
      'get_user_sp_wallet_summary',
      {
        p_user_id: userId,
      }
    );

    const walletDataRaw = (Array.isArray(walletData) ? walletData[0] : walletData) as Record<string, unknown> | null;
    const walletSummary = walletDataRaw || {
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    };

    return {
      user: profile as UserProfile,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      subscription_status: (subscriptionSummary.status as 'free' | 'trial' | 'active' | 'grace' | 'canceled') || 'free',
      can_spend_sp: !!subscriptionSummary.can_spend_sp,
      available_points: (walletSummary.available_points as number) || 0,
      pending_points: (walletSummary.pending_points as number) || 0,
      lifetime_earned: (walletSummary.lifetime_earned as number) || 0,
      lifetime_spent: (walletSummary.lifetime_spent as number) || 0,
    };
  } catch (error) {
    console.error('Failed to build session:', error);
    return null;
  }
}
