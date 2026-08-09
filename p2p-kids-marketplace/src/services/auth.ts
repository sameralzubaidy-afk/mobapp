// File: p2p-kids-marketplace/src/services/auth.ts
// MODULE-03 AUTH-V2: Authentication Service

import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { AuthSession, LoginInput, UserProfile, AuthError } from '../types/user';
import { ReferralCodeServiceV2 } from './referralCodeV2';

type SignupPolicyType = 'terms_of_service' | 'privacy_policy';

const SIGNUP_POLICY_TYPES: SignupPolicyType[] = ['terms_of_service', 'privacy_policy'];

interface PublishedPolicyLookupResult {
  id: string;
}

async function recordSignupPolicyAcceptances(userId: string): Promise<void> {
  for (const policyType of SIGNUP_POLICY_TYPES) {
    const { data: policyRows, error: policyError } = await supabase.rpc('get_current_policy', {
      p_policy_type: policyType,
    });

    if (policyError) {
      throw new AuthError(
        `Failed to load current ${policyType} policy: ${policyError.message}`,
        'POLICY_LOOKUP_FAILED',
        policyError
      );
    }

    const currentPolicy = Array.isArray(policyRows)
      ? (policyRows[0] as PublishedPolicyLookupResult | undefined)
      : undefined;

    // If there is no published policy of this type, nothing to record.
    if (!currentPolicy?.id) {
      continue;
    }

    const { error: acceptanceError } = await supabase.rpc('record_policy_acceptance', {
      p_user_id: userId,
      p_policy_id: currentPolicy.id,
      p_ip_address: null,
      p_user_agent: null,
    });

    if (acceptanceError) {
      throw new AuthError(
        `Failed to record ${policyType} acceptance: ${acceptanceError.message}`,
        'POLICY_ACCEPTANCE_FAILED',
        acceptanceError
      );
    }
  }
}

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

  const { email, password, name, phone, dob, referralCode } = input;

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          phone: phone,
          dob: dob,
          ...(referralCode && referralCode.trim()
            ? { referral_code: referralCode.trim().toLowerCase() }
            : {}),
        },
      },
    });

    if (authError) {
      throw new AuthError(authError.message, authError.name || 'SIGNUP_FAILED', authError);
    }

    if (authData.user) {
      await recordSignupPolicyAcceptances(authData.user.id);
    }

    return { user: authData.user, error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { user: null, error };
    }
    const err = error as Error;
    return {
      user: null,
      error: new AuthError(err.message || 'Signup failed', 'SIGNUP_ERROR', err),
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
          ...(referralCode && referralCode.trim()
            ? { referral_code: referralCode.trim().toLowerCase() }
            : {}),
        },
      },
    });

    if (authError) {
      throw new AuthError(authError.message, authError.name || 'SIGNUP_FAILED', authError);
    }

    if (!authData.user) {
      throw new AuthError('Signup succeeded but no user returned', 'SIGNUP_NO_USER', {
        message: 'Auth returned empty user object',
      });
    }

    const userId = authData.user.id;

    // UX rule: creating an account implies agreement to published Terms and Privacy policies.
    await recordSignupPolicyAcceptances(userId);

    // Step 2: Profile is auto-created by trigger on auth.users
    // The handle_new_user() trigger handles this.
    // We let the app apply the referral code next to handle errors gracefully.

    // Step 3: Apply referral code if provided
    if (referralCode && referralCode.trim()) {
      console.log('Applying referral code:', referralCode);
      try {
        const result = await ReferralCodeServiceV2.applyReferralCode(userId, referralCode.trim());
        if (!result.success) {
          const errorMsg = result.error || 'Unknown referral code error';
          if (errorMsg.toLowerCase().includes('already applied')) {
            // This is OK, referral was already applied
            console.log('Referral code already applied:', errorMsg);
          } else {
            // TC-005: Log warning but DO NOT throw - signup continues despite invalid code
            console.warn(
              '[signupWithTrial] Referral application failed but continuing signup:',
              errorMsg
            );
          }
        } else {
          console.log('Referral code applied successfully');
        }
      } catch (error) {
        // TC-005: Log warning but DO NOT throw - signup continues despite invalid code
        console.warn('[signupWithTrial] Error applying referral code, continuing signup:', error);
      }
    }

    // Step 4: Create FREE subscription (not trial yet)
    // User will choose Free or Trial on SubscriptionChoiceScreen
    // If they choose trial, it will be upgraded by enrollInTrialSubscription
    const { error: subError } = await supabase.rpc('create_free_subscription', {
      p_user_id: userId,
    });

    if (subError) {
      console.warn('Free subscription creation warning:', subError);
      // Don't fail signup if subscription creation fails - just log warning
      // User will be asked to choose tier anyway
    }

    // Step 5: DO NOT initialize SP wallet during signup
    // It will be created on-demand when needed or during trial enrollment
    // This prevents cascading failures if wallet creation has issues

    return { user: authData.user, error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { user: null, error };
    }
    const err = error as Error;
    return {
      user: null,
      error: new AuthError(err.message || 'Signup failed', 'SIGNUP_ERROR', err),
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
    const { data: wallet, error: walletError } = await supabase.rpc('initialize_sp_wallet', {
      p_user_id: userId,
    });

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
export async function loginWithContext(input: LoginInput): Promise<AuthSession> {
  const { email, password } = input;

  try {
    // Step 1: Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw new AuthError(authError.message, authError.name || 'LOGIN_FAILED', authError);
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
      throw new AuthError('User profile not found', 'PROFILE_NOT_FOUND', profileError);
    }

    if ((profile as UserProfile & { deleted_at?: string | null }).deleted_at) {
      await supabase.auth.signOut({ scope: 'global' });
      throw new AuthError(
        'Your account has been deleted. Please contact admin-support@kidsmarketplace.app.',
        'ACCOUNT_DELETED'
      );
    }

    // Step 3: Fetch subscription summary (MODULE-11)
    const { data: subData } = await supabase.rpc('get_subscription_summary', {
      p_user_id: userId,
    });

    // RPC may return: 1) array of rows (old TABLE return), 2) single JSONB object (new JSONB return)
    const subSummaryRaw = (Array.isArray(subData) ? subData[0] : subData) as Record<
      string,
      unknown
    > | null;
    const subscriptionSummary = subSummaryRaw || {
      status: 'none',
      can_spend_sp: false,
    };

    // Normalize booleans and default status value for UI consistency
    if (subscriptionSummary && typeof subscriptionSummary.can_spend_sp === 'string') {
      subscriptionSummary.can_spend_sp =
        subscriptionSummary.can_spend_sp === 'true' || subscriptionSummary.can_spend_sp === 't';
    }
    subscriptionSummary.status = (subscriptionSummary.status as string) || 'free';

    // Step 4: Fetch SP wallet summary (MODULE-09)
    const { data: walletData } = await supabase.rpc('get_user_sp_wallet_summary', {
      p_user_id: userId,
    });

    const walletDataRaw = (Array.isArray(walletData) ? walletData[0] : walletData) as Record<
      string,
      unknown
    > | null;
    const walletSummary = walletDataRaw || {
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      reserved_points: 0,
      wallet_state: 'inactive', // ADMIN-V2-003
    };

    const normalizedUserId =
      ((profile as UserProfile).user_id || (profile as UserProfile).id || userId) as string;

    // Step 5: Build enriched session
    const session: AuthSession = {
      user: {
        ...(profile as UserProfile),
        id: normalizedUserId,
        user_id: normalizedUserId,
        display_name:
          (profile as any).name ||
          (profile as any).display_name ||
          (profile as any).full_name ||
          '',
      },
      access_token: authData.session!.access_token,
      refresh_token: authData.session!.refresh_token,
      subscription_status: subscriptionSummary.status as
        | 'free'
        | 'trial'
        | 'active'
        | 'grace'
        | 'canceled',
      can_spend_sp: !!subscriptionSummary.can_spend_sp,
      available_points: (walletSummary.available_points as number) || 0,
      pending_points: (walletSummary.pending_points as number) || 0,
      lifetime_earned: (walletSummary.lifetime_earned as number) || 0,
      lifetime_spent: (walletSummary.lifetime_spent as number) || 0,
      reserved_points: (walletSummary.reserved_points as number) || 0,
      wallet_state:
        (walletSummary.wallet_state as
          | 'active'
          | 'frozen'
          | 'suspended'
          | 'grace_period'
          | 'inactive') || 'inactive', // ADMIN-V2-003
    };

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('Login failed with unexpected error', 'LOGIN_FAILED', error);
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    throw new AuthError('Logout failed', 'LOGOUT_FAILED', error);
  }
}

/**
 * Get current session
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

    if ((profile as UserProfile & { deleted_at?: string | null }).deleted_at) {
      await supabase.auth.signOut({ scope: 'global' });
      return null;
    }

    // Fetch subscription summary
    const { data: subData } = await supabase.rpc('get_subscription_summary', {
      p_user_id: userId,
    });

    const subSummaryRaw = (Array.isArray(subData) ? subData[0] : subData) as Record<
      string,
      unknown
    > | null;
    const subscriptionSummary = subSummaryRaw || {
      status: 'none',
      can_spend_sp: false,
    };

    // Normalize booleans and default status value
    if (subscriptionSummary && typeof subscriptionSummary.can_spend_sp === 'string') {
      subscriptionSummary.can_spend_sp =
        subscriptionSummary.can_spend_sp === 'true' || subscriptionSummary.can_spend_sp === 't';
    }
    subscriptionSummary.status = subscriptionSummary.status || 'free';

    // Fetch SP wallet summary
    const { data: walletData } = await supabase.rpc('get_user_sp_wallet_summary', {
      p_user_id: userId,
    });

    const walletDataRaw = (Array.isArray(walletData) ? walletData[0] : walletData) as Record<
      string,
      unknown
    > | null;
    const walletSummary = walletDataRaw || {
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      reserved_points: 0,
      wallet_state: 'inactive', // ADMIN-V2-003
    };

    return {
      user: {
        ...(profile as UserProfile),
        display_name:
          (profile as any).name ||
          (profile as any).display_name ||
          (profile as any).full_name ||
          '',
      },
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      subscription_status:
        (subscriptionSummary.status as 'free' | 'trial' | 'active' | 'grace' | 'canceled') ||
        'free',
      can_spend_sp: !!subscriptionSummary.can_spend_sp,
      available_points: (walletSummary.available_points as number) || 0,
      pending_points: (walletSummary.pending_points as number) || 0,
      lifetime_earned: (walletSummary.lifetime_earned as number) || 0,
      lifetime_spent: (walletSummary.lifetime_spent as number) || 0,
      reserved_points: (walletSummary.reserved_points as number) || 0,
      wallet_state:
        (walletSummary.wallet_state as
          | 'active'
          | 'frozen'
          | 'suspended'
          | 'grace_period'
          | 'inactive') || 'inactive', // ADMIN-V2-003
    };
  } catch (error) {
    console.error('Failed to build session:', error);
    return null;
  }
}
