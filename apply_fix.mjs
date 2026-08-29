import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// DEV-TASK-47: the service-role key was previously hardcoded here (a committed
// secret). It must now come from the environment only — fail fast if unset.
const supabaseUrl = 'https://drntwgporzabmxdqykrp.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY env var is required (DEV-TASK-47 removed the hardcoded key).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const sql = readFileSync('supabase/migrations/20260603000001_fix_search_listings_node_id_column.sql', 'utf8');
  console.log('Executing SQL fix...');
  
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('Error executing SQL:', error.message);
    // Try direct SQL via REST API
    console.log('Trying direct SQL execution...');
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object',
      },
      body: JSON.stringify({ query: sql }),
    });
    const result = await response.text();
    console.log('Result:', result);
  } else {
    console.log('Success:', data);
  }
}

main().catch(console.error);
