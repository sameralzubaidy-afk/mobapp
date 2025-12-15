import { supabase } from './client';
import type { Session, User } from '@supabase/supabase-js';
import { generateReferralCode, processReferralCode } from '../referral';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  phone: string;
  dob?: string; // YYYY-MM-DD
  referralCode?: string;
}

export interface SignInData {
  email?: string;
  password?: string;
}

/**
 * Sign up a new user with email/password and create their profile in the database
 */
export const signUp = async (data: SignUpData): Promise<{ user: User | null; error: any | null }> => {
  try {
    // Step 1: Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          phone: data.phone,
          dob: data.dob,
        },
      },
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      return { user: null, error: authError };
    }

    if (!authData.user) {
      return { user: null, error: new Error('No user returned from signup') };
    }

    // Step 2: Verify profile was created by database trigger
    // The database trigger (on_auth_user_created) should auto-create the profile
    console.log('Checking if profile was created by database trigger for user:', authData.user.id);

    // Small delay to allow trigger to execute
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify profile exists
    const { data: profileData, error: profileCheckError } = await supabase
      .from('profiles')
      .select('user_id, name')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileCheckError) {
      console.error('Profile check error:', profileCheckError);
    }

    if (!profileData) {
      console.warn('Profile not created by trigger, attempting manual creation...');
      
      // Generate unique referral code for new user
      const userReferralCode = await generateReferralCode();

      // Fallback: Create profile manually if trigger failed
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          name: data.name,
          dob: data.dob || null,
          phone_verified: false,
          referral_code: userReferralCode,
        });

      if (profileError) {
        // Check if it's a duplicate error (someone else created it)
        if (profileError.code === '23505') {
          console.log('Profile already exists (race condition)');
        } else {
          console.error('Manual profile creation failed:', profileError);
          return {
            user: null,
            error: new Error('Failed to create user profile. Please contact support.')
          };
        }
      } else {
        console.log('Profile created manually with referral code:', userReferralCode);
      }
    } else {
      console.log('Profile found:', profileData);
      
      // Ensure referral code exists
      if (!profileData.referral_code) {
        const userReferralCode = await generateReferralCode();
        await supabase
          .from('profiles')
          .update({ referral_code: userReferralCode })
          .eq('user_id', authData.user.id);
      }
    }

    // Process referral code if provided
    if (data.referralCode && data.referralCode.trim()) {
      await processReferralCode(authData.user.id, data.referralCode);
    }

    return { user: authData.user, error: null };
  } catch (e: any) {
    console.error('Signup exception:', e);
    return { user: null, error: e };
  }
};

export const signIn = async (
  data: SignInData
): Promise<{ user: User | null; session: Session | null; error: any | null }> => {
  try {
    const { data: resp, error } = await supabase.auth.signInWithPassword({
      email: data.email || '',
      password: data.password || '',
    } as any);
    return { user: resp?.user ?? null, session: resp?.session ?? null, error: error ?? null };
  } catch (e: any) {
    return { user: null, session: null, error: e as any };
  }
};

/**
 * AUTH-007: Sign out user and clear all app state
 * Clears Supabase session, app state, and local storage
 */
export const signOut = async (): Promise<{ error: any | null }> => {
  try {
    // Clear Supabase auth session
    const { error } = await supabase.auth.signOut();
    
    // TODO: Clear additional app state when context/redux is implemented
    // Examples:
    // - Clear user profile from context/redux store
    // - Clear cached data (listings, messages, etc.)
    // - Clear any pending notifications
    // - Revoke push notification tokens
    
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as any };
  }
};

export const getSession = async (): Promise<{ session: Session | null; error: any | null }> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session ?? null, error: error ?? null };
  } catch (e: any) {
    return { session: null, error: e as any };
  }
};

export const getCurrentUser = async (): Promise<{ user: User | null; error: any | null }> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user ?? null, error: error ?? null };
  } catch (e: any) {
    return { user: null, error: e as any };
  }
};

export const resetPassword = async (email: string): Promise<{ error: any | null }> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as any };
  }
};

export const updatePassword = async (
  newPassword: string
): Promise<{ error: any | null }> => {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword } as any);
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as any };
  }
};

export const updateUserMetadata = async (
  metadata: Record<string, any>
): Promise<{ user: User | null; error: any | null }> => {
  try {
    const { data, error } = await supabase.auth.updateUser({ data: metadata } as any);
    return { user: data.user ?? null, error: error ?? null };
  } catch (e: any) {
    return { user: null, error: e as any };
  }
};

export const onAuthStateChange = (
  callback: (event: string, session: Session | null) => void
) => {
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    // pass session (Session | null) directly
    callback(event, session);
  });

  return () => sub?.subscription.unsubscribe();
};

