import { supabase } from './client';
import type { Session, User } from '@supabase/supabase-js';

export interface SignUpData {
  email?: string;
  password?: string;
  phone?: string;
}

export interface SignInData {
  email?: string;
  password?: string;
}

export const signUp = async (data: SignUpData): Promise<{ user: User | null; error: any | null }> => {
  try {
    const { data: resp, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      phone: data.phone,
    } as any);
    return { user: resp?.user ?? null, error: error ?? null };
  } catch (e: any) {
    return { user: null, error: e as any };
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

export const signOut = async (): Promise<{ error: any | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
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

