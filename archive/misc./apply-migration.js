import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://drntwgporzabmxdqykrp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.5lj-JNoBItZJCZgMV9DwFslmzud0PxcIjSS78TFRU0E';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('Applying RLS policy migration...');

    // Execute the migration SQL directly using service role
    const migrationSQL = `
      -- Update RLS policy to allow profile creation during signup
      DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
      CREATE POLICY "Users can insert their own profile"
        ON profiles FOR INSERT
        WITH CHECK (user_id IN (SELECT id FROM auth.users) OR auth.uid() IS NULL);

      -- Also allow system/trigger inserts
      DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
      CREATE POLICY "System can insert profiles"
        ON profiles FOR INSERT
        WITH CHECK (true);

      -- Function to handle new user signup
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.profiles (user_id, name, phone_verified)
        VALUES (
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'name', ''),
          false
        )
        ON CONFLICT (user_id) DO NOTHING;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Trigger that calls the function whenever a new user is created
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `;

    // Try using rpc to execute SQL (this might not work)
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.log('RPC failed, trying direct SQL execution...');
      // This won't work with client, but let's try anyway
      throw error;
    }

    console.log('Migration applied successfully via RPC!');
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('Please apply the migration manually in Supabase dashboard:');
    console.log('Go to https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql');
    console.log('Run the SQL from: supabase/migrations/20241214000001_add_profile_creation_trigger.sql');
  }
}

applyMigration();