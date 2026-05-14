#!/usr/bin/env node
/**
 * Test script to diagnose waitlist data issue
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('=== Waitlist Diagnostic Test ===\n');

  // Check session
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    console.log('❌ Session error:', sessionError.message);
    return;
  }
  if (!sessionData.session) {
    console.log('❌ No session found - user not logged in');
    return;
  }

  console.log('✅ Logged in as:', sessionData.session.user.email);
  console.log('User ID:', sessionData.session.user.id);
  console.log('User metadata:', JSON.stringify(sessionData.session.user.user_metadata, null, 2));
  console.log('');

  // Try to fetch from zip_waitlist with anon key
  const { data: waitlist, error: wErr } = await client
    .from('zip_waitlist')
    .select('*');

  if (wErr) {
    console.log('❌ Waitlist query error:', wErr.message);
    console.log('Error details:', JSON.stringify(wErr, null, 2));
  } else {
    console.log('✅ Waitlist query successful');
    console.log('Entries found:', waitlist?.length || 0);
    if (waitlist && waitlist.length > 0) {
      console.log('First entry:', JSON.stringify(waitlist[0], null, 2));
    }
  }

  // Check if user has admin role
  const { data: userData, error: userErr } = await client
    .from('profiles')
    .select('role')
    .eq('user_id', sessionData.session.user.id)
    .single();

  if (userErr) {
    console.log('\n❌ Profile query error:', userErr.message);
  } else {
    console.log('\n✅ User role:', userData?.role || 'none');
  }
}

main().catch(console.error);
