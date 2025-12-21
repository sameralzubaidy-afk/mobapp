#!/usr/bin/env node
/**
 * Script to manually apply the user-avatars storage bucket migration
 * Run this if automatic migration fails
 * 
 * Usage: node apply-storage-migration.js
 */

const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20241214000005_create_user_avatars_bucket.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 Migration SQL to apply:');
console.log('=' .repeat(80));
console.log(migrationSQL);
console.log('=' .repeat(80));
console.log('');
console.log('🔧 To apply this migration:');
console.log('');
console.log('1. Go to your Supabase Dashboard:');
console.log('   https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/editor');
console.log('');
console.log('2. Click "SQL Editor" in the left sidebar');
console.log('');
console.log('3. Click "New Query"');
console.log('');
console.log('4. Copy the SQL above and paste it into the editor');
console.log('');
console.log('5. Click "Run" button');
console.log('');
console.log('6. Verify success - you should see:');
console.log('   ✅ storage.buckets: 1 row inserted');
console.log('   ✅ storage.objects policies: 4 policies created');
console.log('');
console.log('7. Test avatar upload in the app');
console.log('');
