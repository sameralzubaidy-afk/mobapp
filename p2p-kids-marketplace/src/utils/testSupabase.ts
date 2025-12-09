import { supabase } from '@/services/supabase';

/**
 * Test connectivity to Supabase. Returns true when a network response is received.
 * If a table query fails because the table doesn't exist, that's still considered a
 * successful connection for our purposes (we'll log the schema-missing case).
 */
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('subscription_tiers').select('id').limit(1);

    if (error) {
      // If table missing or other Postgres error, we'll still treat this as a valid connection
      // because the server responded. Only treat network failures as false.
      console.warn('Supabase query returned an error — this may be expected before schema is created:', error.message ?? error);
      return true;
    }

    console.log('✅ Supabase connected successfully (test query returned rows count:', (data ?? []).length, ')');
    return true;
  } catch (err: any) {
    console.error('Supabase connection failed', err?.message ?? err);
    return false;
  }
};
