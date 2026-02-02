/**
 * Clean Staging Data Script
 * 
 * Removes all test data created by seed-staging-data.ts
 * Run with: npm run clean:staging
 * 
 * WARNING: This will delete all test users, listings, trades, etc.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('   This script requires service role key to delete data.');
  console.log('   Make sure .env or .env.staging has:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

// Test user IDs to delete
const TEST_USER_IDS = [
  '49243010-f458-4744-add1-a6c84ab95f1f', // test-buyer
  '14be337c-aad6-403f-bab2-ba1a7d80b666', // test-seller
  'e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f', // test-admin
];

const TEST_EMAILS = [
  'test-buyer@kidsmarketplace.test',
  'test-seller@kidsmarketplace.test',
  'test-admin@kidsmarketplace.test',
];

async function deleteTestData(): Promise<void> {
  console.log('🧹 CLEANING STAGING DATA');
  console.log('========================');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  let totalDeleted = 0;

  // 1. Delete referrals
  console.log('\n🔗 Cleaning referrals...');
  const { error: referralsError, data: referralsData } = await adminSupabase
    .from('referrals')
    .delete()
    .in('referrer_user_id', TEST_USER_IDS)
    .select();
  
  const referralsCount = referralsData?.length || 0;
  
  if (referralsError) {
    console.error(`   ❌ Error: ${referralsError.message}`);
  } else {
    console.log(`   ✓ Deleted ${referralsCount || 0} referrals`);
    totalDeleted += referralsCount || 0;
  }

  // 2. Delete referral codes
  console.log('\n🎫 Cleaning referral codes...');
  const { error: codesError, data: codesData } = await adminSupabase
    .from('referral_codes')
    .delete()
    .in('user_id', TEST_USER_IDS)
    .select();
  
  const codesCount = codesData?.length || 0;
  
  if (codesError) {
    console.error(`   ❌ Error: ${codesError.message}`);
  } else {
    console.log(`   ✓ Deleted ${codesCount || 0} referral codes`);
    totalDeleted += codesCount || 0;
  }

  // 3. Delete user badges
  console.log('\n🏆 Cleaning user badges...');
  const { error: userBadgesError, data: userBadgesData } = await adminSupabase
    .from('user_badges')
    .delete()
    .in('user_id', TEST_USER_IDS)
    .select();
  
  const userBadgesCount = userBadgesData?.length || 0;
  
  if (userBadgesError) {
    console.error(`   ❌ Error: ${userBadgesError.message}`);
  } else {
    console.log(`   ✓ Deleted ${userBadgesCount || 0} user badges`);
    totalDeleted += userBadgesCount || 0;
  }

  // 4. Delete SP ledger entries
  console.log('\n💰 Cleaning SP ledger...');
  const { error: spError, data: spData } = await adminSupabase
    .from('sp_ledger')
    .delete()
    .in('user_id', TEST_USER_IDS)
    .select();
  
  const spCount = spData?.length || 0;
  
  if (spError) {
    console.error(`   ❌ Error: ${spError.message}`);
  } else {
    console.log(`   ✓ Deleted ${spCount || 0} SP ledger entries`);
    totalDeleted += spCount || 0;
  }

  // 5. Delete trades
  console.log('\n🤝 Cleaning trades...');
  const { error: tradesError, data: tradesData } = await adminSupabase
    .from('trades')
    .delete()
    .or(`buyer_id.in.(${TEST_USER_IDS.join(',')}),seller_id.in.(${TEST_USER_IDS.join(',')})`)
    .select();
  
  const tradesCount = tradesData?.length || 0;
  
  if (tradesError) {
    console.error(`   ❌ Error: ${tradesError.message}`);
  } else {
    console.log(`   ✓ Deleted ${tradesCount || 0} trades`);
    totalDeleted += tradesCount || 0;
  }

  // 6. Delete listings
  console.log('\n📦 Cleaning listings...');
  const { error: listingsError, data: listingsData } = await adminSupabase
    .from('items')
    .delete()
    .in('user_id', TEST_USER_IDS)
    .select();
  
  const listingsCount = listingsData?.length || 0;
  
  if (listingsError) {
    console.error(`   ❌ Error: ${listingsError.message}`);
  } else {
    console.log(`   ✓ Deleted ${listingsCount || 0} listings`);
    totalDeleted += listingsCount || 0;
  }

  // 7. Delete subscriptions
  console.log('\n💳 Cleaning subscriptions...');
  const { error: subsError, data: subsData } = await adminSupabase
    .from('subscriptions')
    .delete()
    .in('user_id', TEST_USER_IDS)
    .select();
  
  const subsCount = subsData?.length || 0;
  
  if (subsError) {
    console.error(`   ❌ Error: ${subsError.message}`);
  } else {
    console.log(`   ✓ Deleted ${subsCount || 0} subscriptions`);
    totalDeleted += subsCount || 0;
  }

  // 8. Delete profiles
  console.log('\n👤 Cleaning profiles...');
  const { error: profilesError, data: profilesData } = await adminSupabase
    .from('profiles')
    .delete()
    .in('user_id', TEST_USER_IDS)
    .select();
  
  const profilesCount = profilesData?.length || 0;
  
  if (profilesError) {
    console.error(`   ❌ Error: ${profilesError.message}`);
  } else {
    console.log(`   ✓ Deleted ${profilesCount || 0} profiles`);
    totalDeleted += profilesCount || 0;
  }

  // 9. Delete auth users (requires admin API)
  console.log('\n🔐 Cleaning auth users...');
  let authDeleted = 0;
  
  for (const userId of TEST_USER_IDS) {
    try {
      const { error } = await adminSupabase.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`   ⚠️  Could not delete user ${userId}: ${error.message}`);
      } else {
        console.log(`   ✓ Deleted auth user: ${userId}`);
        authDeleted++;
      }
    } catch (err) {
      console.warn(`   ⚠️  Failed to delete auth user ${userId}:`, (err as Error).message);
    }
  }

  // Try to delete by email as fallback
  console.log('\n📧 Cleaning auth users by email (fallback)...');
  try {
    const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
    
    if (listError) {
      console.warn(`   ⚠️  Could not list users for email fallback: ${listError.message}`);
    } else if (users) {
      for (const email of TEST_EMAILS) {
        const user = users.find(u => u.email === email);
        if (user) {
          const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
          if (deleteError) {
            console.warn(`   ⚠️  Could not delete ${email}: ${deleteError.message}`);
          } else {
            console.log(`   ✓ Deleted auth user by email: ${email}`);
            authDeleted++;
          }
        }
      }
    }
  } catch (err) {
    console.warn('   ⚠️  Email fallback failed:', (err as Error).message);
  }
  
  if (authDeleted === 0) {
    console.log('   ℹ️  No auth users deleted (may already be gone or service key issue)');
  }
  
  totalDeleted += authDeleted;

  // 10. Optionally clean test badges (commented out - you may want to keep badge definitions)
  // console.log('\n🏆 Cleaning badge definitions...');
  // const { error: badgesError } = await adminSupabase
  //   .from('badges')
  //   .delete()
  //   .in('name', ['First Trade', 'SP Earner - Bronze', 'SP Earner - Silver', 'SP Earner - Gold', 'Trade Master']);

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ STAGING DATA CLEANED');
  console.log('='.repeat(50));
  console.log(`\n📊 Total records deleted: ${totalDeleted}`);
  console.log('\n💡 You can now run:');
  console.log('   npm run seed:staging    # Create fresh test data');
  console.log('');
}

async function main(): Promise<void> {
  try {
    // Confirm before deleting
    console.log('⚠️  WARNING: This will delete all test data!');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await deleteTestData();
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();
