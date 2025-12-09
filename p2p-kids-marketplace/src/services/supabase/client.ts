import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Create a single top-level exported client — either a real client when env is present
// or a safe no-op stub when environment variables are not set.
let _supabase: any = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Supabase client will not be available.');

  const noop = () => ({ data: null, error: { message: 'Supabase not configured' } });

  // Chainable stub so calls like supabase.from('users').select('id').limit(1) don't throw
  const chainableQuery = () => {
    const q: any = {
      select: (..._args: any[]) => q,
      insert: async (..._args: any[]) => noop(),
      update: async (..._args: any[]) => noop(),
      delete: async (..._args: any[]) => noop(),
      limit: (..._args: any[]) => q,
      single: async (..._args: any[]) => noop(),
      order: (..._args: any[]) => q,
      range: (..._args: any[]) => q,
      eq: (..._args: any[]) => q,
      // helpful for some usages that call .select().then(...) etc.
      then: async (resolve: any) => resolve(noop()),
    };
    return q;
  };

  _supabase = {
    from: (_: string) => chainableQuery(),
    storage: {
      from: (_bucket: string) => ({
        upload: async () => ({ data: null, error: new Error('Supabase not configured') }),
        getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
        list: async () => ({ data: null, error: new Error('Supabase not configured') }),
        remove: async () => ({ data: null, error: new Error('Supabase not configured') }),
      }),
    },
    auth: {
      signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: new Error('Supabase not configured') }),
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: (_: string) => ({ subscribe: async () => ({}), unsubscribe: async () => {} }),
    removeChannel: async () => {},
    removeAllChannels: async () => {},
  } as unknown as ReturnType<typeof createClient>;

} else {
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = _supabase as ReturnType<typeof createClient>;
