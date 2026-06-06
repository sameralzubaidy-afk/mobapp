import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://drntwgporzabmxdqykrp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss';

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
