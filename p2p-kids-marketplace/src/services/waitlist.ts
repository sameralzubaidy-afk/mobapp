// File: p2p-kids-marketplace/src/services/waitlist.ts
// Waitlist service for users in unsupported zip codes

import { supabase } from './supabase/client';

export interface WaitlistEntry {
  email: string;
  phone?: string;
  zip: string;
  kids_count?: number;
  kids_ages?: string[];
}

/**
 * Add user to waitlist for unsupported zip code area
 */
export const addToWaitlist = async (
  entry: WaitlistEntry
): Promise<{ success: boolean; error: any | null }> => {
  try {
    const { error } = await (supabase
      .from('waitlist')
      .insert({
        email: entry.email,
        phone: entry.phone || null,
        zip: entry.zip,
        kids_count: entry.kids_count || null,
        kids_ages: entry.kids_ages || null,
        created_at: new Date().toISOString(),
      }) as any);

    if (error) {
      console.error('Waitlist insert error:', error);
      return { success: false, error };
    }

    console.log('✅ Added to waitlist for zip:', entry.zip);
    return { success: true, error: null };
  } catch (error) {
    console.error('Waitlist exception:', error);
    return { success: false, error };
  }
};

/**
 * Check if user is already on waitlist for a zip code
 */
export const checkWaitlistStatus = async (
  email: string,
  zip: string
): Promise<{ exists: boolean; error: any | null }> => {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .eq('zip', zip)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('Waitlist check error:', error);
      return { exists: false, error };
    }

    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Waitlist check exception:', error);
    return { exists: false, error };
  }
};
