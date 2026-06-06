#!/usr/bin/env node
/**
 * Comprehensive diagnosis of cancel-trade issue
 * Checks database state and tests RPC directly
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = 'https://drntwgporzabmxdqykrp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.5lj-JNu4xGi_mEQvZ5vwCdLF7Y5tVFhPq8NLxKQHqz8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 Checking cancel_trade_v2 RPC status...\n');

// Check if the function exists and get its source
const { data: functionDef, error: funcError } = await supabase
  .rpc('pg_get_functiondef', { 
    function_name: 'cancel_trade_v2' 
  })
  .single();

if (funcError) {
  console.log('❌ Could not query function definition:', funcError.message);
} else {
  console.log('✅ cancel_trade_v2 exists\n');
}

// Check if bundle_id column exists
const { data: columns, error: colError } = await supabase
  .from('information_schema.columns')
  .select('column_name, data_type')
  .eq('table_name', 'trades')
  .eq('column_name', 'bundle_id');

if (!colError && columns && columns.length > 0) {
  console.log('✅ bundle_id column exists in trades table');
} else {
  console.log('❌ bundle_id column NOT found in trades table');
}

// Get the specific trade to understand its state
console.log('\n📊 Trade details:');
const { data: trade, error: tradeError } = await supabase
  .from('trades')
  .select('id, status, buyer_id, seller_id, sp_debit_ledger_entry_id')
  .eq('id', '231f65ea-49f0-49a7-a0f9-1e337947affa')
  .single();

if (tradeError) {
  console.log('❌ Error fetching trade:', tradeError.message);
} else {
  console.log(JSON.stringify(trade, null, 2));
}

console.log('\n🧪 Now test the RPC directly in Supabase SQL Editor:');
console.log('---');
console.log(`SELECT cancel_trade_v2(
  '231f65ea-49f0-49a7-a0f9-1e337947affa'::uuid,
  'e9b9bd3d-5754-46ef-9a6f-bbc7848845ee'::uuid,
  'Direct RPC test'
);`);
console.log('---\n');

console.log('📋 If that fails, run this to see the current RPC source code:');
console.log('---');
console.log(`SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'cancel_trade_v2';`);
console.log('---');
