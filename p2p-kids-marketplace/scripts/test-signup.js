import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env vars not set in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = process.env.TEST_EMAIL || 'sam@gmail.com';
  const password = process.env.TEST_PASSWORD || 'Password1';
  console.log('Attempting signup with', email);
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password, 
    options: { 
      data: { 
        name: 'Sam',
        dob: '1990-01-01'  // 18+ years old
      } 
    } 
  });
  console.log('Response:', { data });
  if (error) {
    console.error('Auth signup error:', error);
    try {
      console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.error('Unable to stringify error:', e);
    }
  }
}

run().catch((e) => console.error(e));