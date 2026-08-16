/**
 * Script: Apply discovery migration to Supabase
 * Usage: node apply-discovery-migration.js
 */

const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationFile = path.join(__dirname, 'supabase/migrations/20251224000001_add_category_text_search_rpc.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

// Extract just the function definition (ignore comments and verification queries)
const functionSQL = migrationSQL
  .split('-- VERIFICATION')[0] // Remove verification section
  .trim();

console.log('✅ Migration SQL ready');
console.log('');
console.log('To apply this migration:');
console.log('');
console.log('1. Open Supabase Dashboard → SQL Editor');
console.log('2. Create a new query');
console.log('3. Copy and paste the SQL below:');
console.log('');
console.log('--- START SQL ---');
console.log(functionSQL);
console.log('--- END SQL ---');
console.log('');
console.log('4. Click "Execute" button');
console.log('');
console.log('To verify the function was created:');
console.log('SELECT routine_name FROM information_schema.routines WHERE routine_schema = \'public\' AND routine_name = \'search_listings_by_category_and_query\';');
console.log('');
