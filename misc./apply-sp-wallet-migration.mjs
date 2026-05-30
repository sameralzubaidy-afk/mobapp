// One-shot script: apply ADMIN-V2-003 SP wallet RPCs migration
// Run: node apply-sp-wallet-migration.mjs
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://drntwgporzabmxdqykrp.supabase.co';

// Read service role key from .env.local
const envContent = readFileSync('./p2p-kids-admin/.env.local', 'utf8');
const match = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
if (!match) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY not found in p2p-kids-admin/.env.local');
  process.exit(1);
}
const SERVICE_ROLE_KEY = match[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Read the migration SQL
const sql = readFileSync('./supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql', 'utf8');

// Split by semicolons-with-newlines to execute statement by statement
// (Supabase .rpc() with a raw-SQL helper is not available in client library,
//  so we use the REST API /sql endpoint which is available in supabase-js v2.39+)
try {
  // Supabase JS v2.39+ exposes supabase.from().select() but not raw SQL.
  // Use the Management API /v1/projects/.../database/query endpoint.
  const projectRef = 'drntwgporzabmxdqykrp';

  // Try Supabase Management API SQL endpoint (requires service_role scope)
  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  if (!mgmtRes.ok) {
    const errBody = await mgmtRes.text();
    console.error('Management API failed:', mgmtRes.status, errBody.slice(0, 400));

    // Fallback: try calling via Supabase SQL admin API path used by dashboard
    const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });
    if (!fallbackRes.ok) {
      const fb = await fallbackRes.text();
      console.error('run_sql fallback also failed:', fallbackRes.status, fb.slice(0, 400));
      console.log('\n⚠️  Automatic migration failed. Please run the SQL manually:');
      console.log('1. Go to https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new');
      console.log('2. Paste and run: supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql');
      process.exit(1);
    }
    const fbData = await fallbackRes.json();
    console.log('✅  run_sql fallback succeeded:', JSON.stringify(fbData).slice(0, 200));
  } else {
    const result = await mgmtRes.json();
    console.log('✅  Migration applied successfully!');
    console.log('Result:', JSON.stringify(result).slice(0, 300));
  }
} catch (err) {
  console.error('❌  Unexpected error:', err.message);
  console.log('\n📋  Please apply the migration manually:');
  console.log('1. Go to https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new');
  console.log('2. Copy and run: supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql');
  process.exit(1);
}
