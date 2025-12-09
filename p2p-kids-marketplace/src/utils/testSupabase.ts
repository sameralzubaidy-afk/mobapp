import { supabase } from '@/services/supabase';

export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      // expected if table doesn't exist yet
      console.warn('Supabase connection may be OK but table query failed:', error.message);
      return false;
    }
    console.log('Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('Supabase connection failed', err);
    return false;
  }
};
