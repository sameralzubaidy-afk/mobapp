#!/usr/bin/env node
// File: p2p-kids-marketplace/scripts/create-test-users.js
// CLI tool to create test users for development
// Usage: node scripts/create-test-users.js [count]

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL_DOMAIN = '@testpass.dev';
const DEFAULT_PASSWORD = 'TestPass123!';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SERVICE_ROLE_KEY);
  console.error('\n💡 Make sure to source .env.local first:');
  console.error('   export $(cat .env.local | xargs)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Test user templates
const USER_TEMPLATES = [
  { firstName: 'Alex', lastName: 'River', tier: 'free' },
  { firstName: 'Sam', lastName: 'Green', tier: 'kids_club_plus' },
  { firstName: 'Jamie', lastName: 'Lee', tier: 'kids_club_pro' },
  { firstName: 'Taylor', lastName: 'Brooks', tier: 'free' },
  { firstName: 'Riley', lastName: 'Fox', tier: 'kids_club_plus' },
  { firstName: 'Jordan', lastName: 'Stone', tier: 'free' },
  { firstName: 'Casey', lastName: 'Blue', tier: 'kids_club_pro' },
  { firstName: 'Morgan', lastName: 'Sky', tier: 'free' },
];

function generateTestEmail(index, firstName) {
  const timestamp = Date.now();
  return `${firstName.toLowerCase()}${index}-${timestamp}${TEST_EMAIL_DOMAIN}`;
}

function generateTestPhone(index) {
  const paddedIndex = String(index).padStart(4, '0');
  return `+1555000${paddedIndex}`;
}

async function createTestUser(template, index) {
  const email = generateTestEmail(index, template.firstName);
  const phone = generateTestPhone(index);
  const displayName = `${template.firstName} ${template.lastName.charAt(0)}`;
  const dob = `198${index % 4}-0${(index % 9) + 1}-15`; // Vary DOB (N4: all 18+ per hard registration gate)

  console.log(`\n🧪 Creating user ${index}:`);
  console.log(`   Name: ${template.firstName} ${template.lastName}`);
  console.log(`   Email: ${email}`);
  console.log(`   Phone: ${phone}`);
  console.log(`   Tier: ${template.tier}`);

  try {
    // Create user with confirmed email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        first_name: template.firstName,
        last_name: template.lastName,
        phone,
        dob,
      },
    });

    if (authError || !authData.user) {
      throw new Error(`Auth creation failed: ${authError?.message}`);
    }

    const userId = authData.user.id;
    console.log(`   ✅ Auth user created: ${userId}`);

    // Update profile with tier and complete data
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: template.firstName,
        last_name: template.lastName,
        display_name: displayName,
        phone_number: phone,
        date_of_birth: dob,
        subscription_tier: template.tier,
      })
      .eq('user_id', userId);

    if (profileError) {
      console.warn(`   ⚠️ Profile update warning: ${profileError.message}`);
    } else {
      console.log(`   ✅ Profile updated`);
    }

    // Auto-verify phone
    const { error: verifyError } = await supabase
      .from('phone_verification_codes')
      .insert({
        user_id: userId,
        phone,
        code: '123456',
        verified: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    if (verifyError) {
      console.warn(`   ⚠️ Phone verify warning: ${verifyError.message}`);
    }

    // Call verify_user_phone RPC
    const { error: rpcError } = await supabase.rpc('verify_user_phone', {
      p_user_id: userId,
      p_phone: phone,
    });

    if (rpcError) {
      console.warn(`   ⚠️ RPC verify warning: ${rpcError.message}`);
    } else {
      console.log(`   ✅ Phone verified`);
    }

    return {
      userId,
      email,
      password: DEFAULT_PASSWORD,
      firstName: template.firstName,
      lastName: template.lastName,
      phone,
      tier: template.tier,
    };
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return null;
  }
}

async function cleanupTestUsers() {
  console.log('\n🧹 Cleaning up existing test users...');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, email')
    .ilike('email', `%${TEST_EMAIL_DOMAIN}`);

  if (error) {
    console.error('❌ Failed to find test users:', error.message);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('✅ No existing test users found');
    return;
  }

  console.log(`Found ${profiles.length} test users to delete`);

  let deleted = 0;
  for (const profile of profiles) {
    try {
      await supabase.auth.admin.deleteUser(profile.user_id);
      deleted++;
      console.log(`   ✅ Deleted: ${profile.email}`);
    } catch (err) {
      console.error(`   ❌ Failed to delete ${profile.email}`);
    }
  }

  console.log(`✅ Cleanup complete: ${deleted}/${profiles.length} deleted\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0], 10) || 3;
  const shouldCleanup = args.includes('--cleanup') || args.includes('-c');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Pass It Up - Test User Generator');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Creating ${count} test users...`);
  console.log(`Password for all users: ${DEFAULT_PASSWORD}`);
  console.log(`Email domain: ${TEST_EMAIL_DOMAIN}`);

  if (shouldCleanup) {
    await cleanupTestUsers();
  }

  const results = [];

  for (let i = 0; i < count; i++) {
    const template = USER_TEMPLATES[i % USER_TEMPLATES.length];
    const result = await createTestUser(template, i + 1);
    if (result) {
      results.push(result);
    }
    
    // Brief delay to avoid rate limits
    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`✅ Created ${results.length}/${count} test users successfully`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (results.length > 0) {
    console.log('📋 Test User Credentials:\n');
    console.log('```');
    results.forEach((user, index) => {
      console.log(`User ${index + 1}: ${user.firstName} ${user.lastName} (${user.tier})`);
      console.log(`  Email:    ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Phone:    ${user.phone}`);
      console.log(`  User ID:  ${user.userId}`);
      console.log('');
    });
    console.log('```\n');

    console.log('💡 Usage:');
    console.log('   1. Copy any email/password above');
    console.log('   2. Login to the app');
    console.log('   3. Phone is already verified (no OTP needed)');
    console.log('   4. Profile is complete with subscription tier\n');
  }

  console.log('🧹 To cleanup all test users later, run:');
  console.log('   node scripts/create-test-users.js 0 --cleanup\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
