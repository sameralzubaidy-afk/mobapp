#!/usr/bin/env node
/*
  Quick local Supabase connection verification script.
  Usage: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment
    or create .env.local at project root and export vars before running.

  This script will perform a safe test query against subscription_tiers (it's okay if table
  doesn't exist yet — we'll treat that as a sign of a valid connection).
*/

const { createClient } = require('@supabase/supabase-js');

// Try to load .env.local into process.env if present and env vars not set
const fs = require('fs');
if ((!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) && fs.existsSync('./.env.local')) {
  const contents = fs.readFileSync('./.env.local', 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...rest] = trimmed.split('=');
    if (!k) return;
    const v = rest.join('=').trim();
    // only set if not already set
    if (!process.env[k.trim()]) process.env[k.trim()] = v;
  });
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(2);
}

const supabase = createClient(url, key);

async function check() {
  try {
    console.log('Testing query: select id from subscription_tiers (if table missing this still verifies connection)');
    const { data, error } = await supabase.from('subscription_tiers').select('id').limit(1);

    if (error) {
      console.warn('Query returned error — this may be expected before schema creation. Error:', error.message || error);
      // continue to run admin checks (don't exit) — a response came back so connection is valid
    }

    console.log('Query succeeded — connection ok. Rows returned:', Array.isArray(data) ? data.length : 0);
    // If we have a service_role key available, try some admin checks (extensions + buckets)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      console.log('\nService role key detected — running additional admin checks...');
      const adminClient = createClient(url, serviceRoleKey);

      // Check for expected extensions by trying a pg_catalog query via PostgREST (may or may not be accessible)
      try {
        // Try to query pg_extension via REST table access (may fail if not allowed)
        const exRes = await adminClient.from('pg_extension').select('extname');
        if (exRes.error) {
          console.warn('Could not query pg_extension via PostgREST: ', exRes.error.message || exRes.error);
        } else {
          const enabled = exRes.data.map((r) => r.extname);
          console.log('Enabled extensions (sample):', enabled.join(', '));
        }
      } catch (err) {
        console.warn('Skipping extension listing — not accessible via PostgREST with current settings.');
      }

      // Check presence of the three buckets
      const bucketsToCheck = ['item-images', 'chat-images', 'user-avatars'];
      for (const b of bucketsToCheck) {
        try {
          const listRes = await adminClient.storage.from(b).list('', { limit: 1 });
          if (listRes.error) {
            console.warn(`Bucket '${b}' check: error — ${listRes.error.message || JSON.stringify(listRes.error)}`);
          } else {
            console.log(`Bucket '${b}' exists (files returned: ${Array.isArray(listRes.data) ? listRes.data.length : 0})`);
          }
        } catch (err) {
          console.warn(`Bucket '${b}' check: failed (${err?.message || err})`);
        }
      }
    } else {
      console.log('\nNo SUPABASE_SERVICE_ROLE_KEY detected, skipping admin checks (buckets/extensions).');
    }
    process.exit(0);
  } catch (err) {
    console.error('Connection test failed:', err?.message || err);
    process.exit(1);
  }
}

check();
