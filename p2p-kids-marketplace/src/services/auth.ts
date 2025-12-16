// File: p2p-kids-marketplace/src/services/auth.ts
// MODULE-03 AUTH-V2: Authentication Service

import { supabase } from '../config/supabase';
import {
  AuthSession,
  LoginInput,
  UserProfile,
  SubscriptionSummary,
  SPWalletSummary,
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
  phone: string;
  dob: string;
  referralCode?: string;
}): Promise<{ user: any; error: any }> {
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
  } catch (error: any) {
    return { user: null, error };
  }
}

/**
 * AUTH-V2-001B: User Signup with Trial Enrollment
 * 
 * Combined signup + trial enrollment flow for direct signup with trial.
 * Creates auth user, initializes profile, subscription, and SP wallet.
 * This is called directly from SignupScreen.
 */
export async function signupWithTrial(input: {
  email: string;
  password: string;
  name: string;
  phone: string;
  dob: string;
  referralCode?: string;
}): Promise<{ user: any; error: any }> {
  const { email, password, name, phone, dob, referralCode } = input;

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

    // Step 3: Create trial subscription (MODULE-11)
    // Uses admin-configured duration from get_trial_duration_days()
    const { data: subscription, error: subError } = await (supabase.rpc(
      'create_trial_subscription',
      { p_user_id: userId }
    ) as any);

    if (subError) {
      console.warn('Trial subscription creation warning:', subError);
      // Don't fail signup if trial fails - just log warning
    }

    // Step 4: Initialize SP wallet (MODULE-09)
    const { data: wallet, error: walletError } = await (supabase.rpc(
      'initialize_sp_wallet',
      { p_user_id: userId }
    ) as any);

    if (walletError) {
      console.warn('SP wallet initialization warning:', walletError);
      // Don't fail signup if wallet fails - just log warning
    }

    // Step 5: Link subscription and wallet to profile (if both created successfully)
    if (subscription && wallet) {
      const { error: updateError } = await (supabase
        .from('profiles')
        .update({
          subscription_id: subscription.id,
          sp_wallet_id: wallet.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('user_id', userId) as any);

      if (updateError) {
        console.warn('Profile link update warning:', updateError);
        // Don't fail signup if update fails
      }
    }

    return { user: authData.user, error: null };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { user: null, error };
    }
    return { 
      user: null, 
      error: new AuthError(
        error.message || 'Signup failed',
        'SIGNUP_ERROR',
        error
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
  error?: any;
}> {
  try {
    // Step 1: Check if trial enrollment is enabled (admin config)
    const { data: trialEnabled } = await (supabase.rpc('is_trial_enabled', {}) as any);

    if (!trialEnabled) {
      console.log('Trial enrollment is disabled by admin');
      return { 
        subscription: null, 
        wallet: null,
        error: new AuthError(
          'Trial enrollment is not available at this time',
          'TRIAL_DISABLED',
          { message: 'Admin has disabled trial enrollment' }
        ),
      };
    }

    // Step 2: Check if subscription already exists for this user
    const { data: existingSubscription, error: fetchError } = await (supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single() as any);

    let subscription = existingSubscription;

    // Step 3: If subscription doesn't exist, create trial subscription
    if (!existingSubscription) {
      const { data: newSub, error: subError } = await (supabase.rpc(
        'create_trial_subscription',
        { p_user_id: userId }
      ) as any);

      if (subError) {
        throw new AuthError(
          `Failed to create trial subscription: ${subError.message}`,
          'SUBSCRIPTION_CREATION_FAILED',
          subError
        );
      }

      subscription = newSub;
    } else {
      console.log(`Subscription already exists for user ${userId} with status: ${existingSubscription.status}`);
      // User already has a subscription (likely from signup)
      // Return existing subscription without error
    }

    // Step 4: Check if wallet exists, if not initialize it
    const { data: existingWallet } = await (supabase
      .from('sp_wallets')
      .select('*')
      .eq('user_id', userId)
      .single() as any);

    let wallet = existingWallet;

    if (!existingWallet) {
      const { data: newWallet, error: walletError } = await (supabase.rpc(
        'initialize_sp_wallet',
        { p_user_id: userId }
      ) as any);

      if (walletError) {
        throw new AuthError(
          `Failed to initialize SP wallet: ${walletError.message}`,
          'WALLET_CREATION_FAILED',
          walletError
        );
      }

      wallet = newWallet;
    }

    // Step 5: Ensure profile is linked to subscription and wallet
    const { error: updateError } = await (supabase
      .from('profiles')
      .update({
        subscription_id: subscription?.id,
        sp_wallet_id: wallet?.id,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', userId) as any);

    if (updateError) {
      console.warn('Warning updating profile links:', updateError);
      // Don't throw - profile link update failure shouldn't block enrollment
    }

    return { subscription, wallet };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { subscription: null, wallet: null, error };
    }
    return {
      subscription: null,
      wallet: null,
      error: new AuthError(
        'Trial enrollment failed',
        'TRIAL_ENROLLMENT_FAILED',
        error
      ),
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
    }) as any;

    const subscriptionSummary = subData?.[0] || {
      status: 'free',
      can_spend_sp: false,
    };

    // Step 4: Fetch SP wallet summary (MODULE-09)
    const { data: walletData } = await supabase.rpc(
      'get_user_sp_wallet_summary',
      {
        p_user_id: userId,
      }
    ) as any;

    const walletSummary = walletData?.[0] || {
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
      subscription_status: subscriptionSummary.status,
      can_spend_sp: subscriptionSummary.can_spend_sp,
      available_points: walletSummary.available_points,
      pending_points: walletSummary.pending_points,
      lifetime_earned: walletSummary.lifetime_earned,
      lifetime_spent: walletSummary.lifetime_spent,
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
    }) as any;

    const subscriptionSummary = subData?.[0] || {
      status: 'free',
      can_spend_sp: false,
    };

    // Fetch SP wallet summary
    const { data: walletData } = await supabase.rpc(
      'get_user_sp_wallet_summary',
      {
        p_user_id: userId,
      }
    ) as any;

    const walletSummary = walletData?.[0] || {
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    };

    return {
      user: profile as UserProfile,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      subscription_status: (subscriptionSummary.status as any) || 'free',
      can_spend_sp: subscriptionSummary.can_spend_sp,
      available_points: walletSummary.available_points,
      pending_points: walletSummary.pending_points,
      lifetime_earned: walletSummary.lifetime_earned,
      lifetime_spent: walletSummary.lifetime_spent,
    };
  } catch (error) {
    console.error('Failed to build session:', error);
    return null;
  }
}
