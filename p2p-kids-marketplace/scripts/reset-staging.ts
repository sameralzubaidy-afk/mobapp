/**
 * Reset Staging Data Script
 *
 * Cleans up test data from staging environment for fresh testing.
 * Run with: npm run reset:staging
 *
 * ⚠️ WARNING: This deletes data! Only use on staging, never on production.
 *
 * Deletes:
 * - Test users (test-buyer@, test-seller@)
 * - Their profiles, listings, trades
 * - Test node data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env (or .env.staging)
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('   Make sure .env file has:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('   Run: cp .env.staging .env');
  process.exit(1);
}

// Safety check - don't run on production
if (SUPABASE_URL.includes('supabase.co') && !SUPABASE_URL.includes('staging')) {
  console.error('❌ SAFETY: This appears to be a production URL!');
  console.error('   Only run reset on staging environments.');
  console.error('   URL must contain "staging" or be a local URL.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Test email patterns to delete
const TEST_EMAIL_PATTERNS = ['test-buyer@kidsmarketplace.test', 'test-seller@kidsmarketplace.test'];

const TEST_NODE_ID = 'test-staging-node';

async function resetStagingData(): Promise<void> {
  console.log('🧹 RESET STAGING DATA');
  console.log('=====================');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  // Get test user IDs
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const testUsers =
    allUsers?.users?.filter((u) => TEST_EMAIL_PATTERNS.some((pattern) => u.email === pattern)) ||
    [];

  const testUserIds = testUsers.map((u) => u.id);
  console.log(`Found ${testUsers.length} test users to clean up`);

  if (testUserIds.length > 0) {
    // Delete trades involving test users
    console.log('\n🗑️ Deleting trades...');
    const { error: tradesError, count: tradesCount } = await supabase
      .from('trades')
      .delete({ count: 'exact' })
      .or(`buyer_id.in.(${testUserIds.join(',')}),seller_id.in.(${testUserIds.join(',')})`);

    if (tradesError) {
      console.log(`   ⚠️ Trades: ${tradesError.message}`);
    } else {
      console.log(`   ✓ Deleted ${tradesCount || 0} trades`);
    }

    // Delete listings from test users
    console.log('\n🗑️ Deleting listings...');
    const { error: listingsError, count: listingsCount } = await supabase
      .from('listings')
      .delete({ count: 'exact' })
      .in('seller_id', testUserIds);

    if (listingsError) {
      console.log(`   ⚠️ Listings: ${listingsError.message}`);
    } else {
      console.log(`   ✓ Deleted ${listingsCount || 0} listings`);
    }

    // Delete messages involving test users
    console.log('\n🗑️ Deleting messages...');
    const { error: msgsError } = await supabase
      .from('messages')
      .delete()
      .or(`sender_id.in.(${testUserIds.join(',')}),receiver_id.in.(${testUserIds.join(',')})`);

    if (msgsError) {
      console.log(`   ⚠️ Messages: ${msgsError.message}`);
    } else {
      console.log(`   ✓ Deleted messages`);
    }

    // Delete profiles
    console.log('\n🗑️ Deleting profiles...');
    const { error: profilesError, count: profilesCount } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .in('user_id', testUserIds);

    if (profilesError) {
      console.log(`   ⚠️ Profiles: ${profilesError.message}`);
    } else {
      console.log(`   ✓ Deleted ${profilesCount || 0} profiles`);
    }

    // Delete auth users
    console.log('\n🗑️ Deleting auth users...');
    for (const user of testUsers) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.log(`   ⚠️ User ${user.email}: ${error.message}`);
      } else {
        console.log(`   ✓ Deleted user: ${user.email}`);
      }
    }
  }

  // Optionally delete test node (comment out if you want to keep it)
  // console.log('\n🗑️ Deleting test node...');
  // await supabase.from('zip_codes').delete().eq('node_id', TEST_NODE_ID);
  // await supabase.from('nodes').delete().eq('id', TEST_NODE_ID);

  console.log('\n' + '='.repeat(50));
  console.log('✅ STAGING DATA RESET COMPLETE');
  console.log('='.repeat(50));
  console.log('\nRun `npm run seed:staging` to recreate test data.');
  console.log('');
}

// Confirmation prompt
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (!args.includes('--force') && !args.includes('-f')) {
    console.log('⚠️  This will DELETE test data from staging!');
    console.log('   Add --force or -f to confirm.');
    console.log('');
    console.log('   Example: npm run reset:staging -- --force');
    process.exit(0);
  }

  await resetStagingData();
}

main().catch(console.error);
