/**
 * Seed Staging Data Script (Enhanced)
 * 
 * Creates comprehensive test data for E2E tests including:
 * - Test users (buyer, seller, admin)
 * - Categories
 * - Listings (available + some sold)
 * - Trades (various statuses)
 * - Subscriptions
 * - SP ledger entries
 * - Badges
 * - Referral codes
 * 
 * Run with: npm run seed:staging
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
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  console.log('   Make sure .env or .env.staging has:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.log('   - EXPO_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY (optional, for admin operations)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
const adminSupabase = SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
  : supabase;

// ============================================================================
// TEST DATA CONSTANTS
// ============================================================================
export const TEST_USERS = {
  buyer: {
    id: '49243010-f458-4744-add1-a6c84ab95f1f', // Fixed UUID from tests
    email: 'test-buyer@kidsmarketplace.test',
    password: 'TestBuyer123!',
    name: 'Test Buyer',
    phone: '5551234001',
  },
  seller: {
    id: '14be337c-aad6-403f-bab2-ba1a7d80b666', // Fixed UUID from tests
    email: 'test-seller@kidsmarketplace.test', 
    password: 'TestSeller123!',
    name: 'Test Seller',
    phone: '5551234002',
  },
  admin: {
    email: 'test-admin@kidsmarketplace.test',
    password: 'TestAdmin123!',
    name: 'Test Admin',
    phone: '5551234003',
  },
};

const TEST_CATEGORIES = [
  { name: 'Toys', icon: '🧸' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Electronics', icon: '📱' },
  { name: 'Books', icon: '📚' },
];

const TEST_LISTINGS = [
  {
    title: 'Nintendo Switch Games Bundle',
    description: 'Mario Kart 8 and Zelda BOTW. Great condition!',
    categoryName: 'Electronics',
    condition: 'good',
    price: 45.00,
    status: 'available',
  },
  {
    title: 'LEGO Star Wars Set',
    description: 'Millennium Falcon set, all pieces included with instructions.',
    categoryName: 'Toys',
    condition: 'like_new',
    price: 30.00,
    status: 'available',
  },
  {
    title: 'Kids Bicycle - 20 inch',
    description: 'Blue mountain bike, perfect for ages 7-10. Minor scratches.',
    categoryName: 'Sports',
    condition: 'fair',
    price: 60.00,
    status: 'available',
  },
  {
    title: 'Harry Potter Book Set',
    description: 'Complete series, gently used paperbacks.',
    categoryName: 'Books',
    condition: 'good',
    price: 35.00,
    status: 'available',
  },
  {
    title: 'Basketball',
    description: 'Official size, indoor/outdoor use.',
    categoryName: 'Sports',
    condition: 'good',
    price: 15.00,
    status: 'available',
  },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function seedCategories(): Promise<{ [key: string]: string }> {
  console.log('\n📂 Seeding categories...');
  const categoryMap: { [key: string]: string } = {};

  for (const cat of TEST_CATEGORIES) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('name', cat.name)
      .single();

    if (existing) {
      console.log(`   ✓ Category exists: ${cat.name}`);
      categoryMap[cat.name] = existing.id;
      continue;
    }

    const { data, error } = await supabase.from('categories').insert({
      name: cat.name,
      icon: cat.icon,
    }).select('id').single();

    if (error) {
      console.error(`   ❌ Failed to create category "${cat.name}": ${error.message}`);
    } else {
      console.log(`   ✓ Created category: ${cat.name}`);
      categoryMap[cat.name] = data.id;
    }
  }

  return categoryMap;
}

async function signupTestUser(userData: typeof TEST_USERS.buyer, role: string = 'user'): Promise<string | null> {
  console.log(`\n📧 Setting up: ${userData.email}`);
  
  let userId = (userData as any).id || null;
  
  // Check if user already exists
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id, user_id')
    .eq('id', userId || 'none')
    .single();

  if (existingProfile) {
    console.log(`   ✓ User already exists: ${existingProfile.id}`);
    return existingProfile.id;
  }

  // Try to sign in first
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.email,
    password: userData.password,
  });

  if (!signInError && signInData.user) {
    userId = signInData.user.id;
    console.log(`   ✓ User already exists: ${userId}`);
  } else {
    // User doesn't exist, create them
    console.log(`   Creating new account...`);
    
    // Use admin API to create user with specific UUID if provided
    if (SUPABASE_SERVICE_KEY && userId) {
      const { data: adminData, error: adminError } = await adminSupabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          phone: userData.phone,
        },
        // @ts-ignore - admin API supports id parameter
        id: userId,
      });

      if (adminError) {
        console.error(`   ❌ Failed to create user: ${adminError.message}`);
        return null;
      }
      userId = adminData.user?.id || null;
    } else {
      // Regular signup
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            phone: userData.phone,
          }
        }
      });

      if (signUpError) {
        console.error(`   ❌ Failed to sign up: ${signUpError.message}`);
        return null;
      }
      userId = signUpData.user?.id || null;
    }

    console.log(`   ✓ Created account: ${userId}`);
  }

  if (!userId) return null;

  // Create/update profile
  const { error: profileError } = await adminSupabase.from('profiles').upsert({
    user_id: userId,
    id: userId,
    name: userData.name,
    phone: userData.phone,
    phone_verified: true,
    profile_completed: true,
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    zip_code: '06850',
    dob: '2000-01-01', // 24+ years old
    role: role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (profileError) {
    console.log(`   ⚠️ Profile: ${profileError.message}`);
  } else {
    console.log(`   ✓ Profile created with role: ${role}`);
  }

  return userId;
}

async function seedListings(sellerId: string, sellerSession: any, categoryMap: { [key: string]: string }): Promise<string[]> {
  console.log('\n📦 Seeding test listings...');
  const listingIds: string[] = [];

  // Use admin client to bypass RLS
  for (const listing of TEST_LISTINGS) {
    // Check if listing already exists
    let existingRes = await adminSupabase
      .from('items')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('title', listing.title)
      .maybeSingle();

    // Back-compat: older schemas used user_id
    if (existingRes.error && existingRes.error.message?.includes('seller_id')) {
      existingRes = await adminSupabase
        .from('items')
        .select('id')
        .eq('user_id', sellerId)
        .eq('title', listing.title)
        .maybeSingle();
    }

    const existing = existingRes.data;

    if (existing) {
      console.log(`   ✓ Listing exists: ${listing.title}`);
      listingIds.push(existing.id);
      continue;
    }

    // Prefer current schema (seller_id + DECIMAL price). Fall back to legacy (user_id + price_cents).
    const now = new Date().toISOString();

    let insertRes = await adminSupabase
      .from('items')
      .insert({
        seller_id: sellerId,
        title: listing.title,
        description: listing.description,
        category_id: categoryMap[listing.categoryName] || null,
        condition: listing.condition,
        price: listing.price,
        status: listing.status,
        accepts_swap_points: true,
        seller_subscription_status_at_creation: 'trial',
        eligible_for_starter_pack: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (insertRes.error && insertRes.error.message?.includes('seller_id')) {
      insertRes = await adminSupabase
        .from('items')
        .insert({
          user_id: sellerId,
          title: listing.title,
          description: listing.description,
          category_id: categoryMap[listing.categoryName] || null,
          condition: listing.condition,
          price_cents: Math.round(listing.price * 100),
          status: listing.status,
          accepts_swap_points: true,
          created_at: now,
        })
        .select('id')
        .single();
    }

    const data = insertRes.data as any;
    const error = insertRes.error as any;

    if (error) {
      console.error(`   ❌ Failed to create listing "${listing.title}": ${error.message}`);
    } else {
      console.log(`   ✓ Created listing: ${listing.title}`);
      listingIds.push(data.id);
    }
  }

  return listingIds;
}

async function seedTrade(buyerId: string, sellerId: string, listingId: string): Promise<void> {
  console.log('\n🤝 Seeding test trade...');

  // Check if trade already exists
  const { data: existing } = await adminSupabase
    .from('trades')
    .select('id, status')
    .eq('buyer_id', buyerId)
    .eq('listing_id', listingId)
    .in('status', ['pending', 'accepted', 'in_progress'])
    .maybeSingle();

  if (existing) {
    console.log(`   ✓ Active trade exists: ${existing.id} (${existing.status})`);
    return;
  }

  // Prefer current schema (buyer_transaction_fee_cents). Fall back to legacy (transaction_fee_cents).
  const now = new Date().toISOString();

  let insertRes = await adminSupabase
    .from('trades')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      status: 'pending',
      cash_amount_cents: 4500, // $45.00
      sp_amount: 0,
      buyer_transaction_fee_cents: 99,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (insertRes.error && insertRes.error.message?.includes('buyer_transaction_fee_cents')) {
    insertRes = await adminSupabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        status: 'pending',
        cash_amount_cents: 4500, // $45.00
        sp_amount: 0,
        transaction_fee_cents: 99,
        created_at: now,
      })
      .select('id')
      .single();
  }

  const data = insertRes.data as any;
  const error = insertRes.error as any;

  if (error) {
    console.error(`   ❌ Failed to create trade: ${error.message}`);
  } else {
    console.log(`   ✓ Created pending trade: ${data.id}`);
  }
}

async function seedSubscriptions(buyerId: string, sellerId: string): Promise<void> {
  console.log('\n💳 Seeding subscriptions...');

  const users = [
    { id: buyerId, name: 'buyer' },
    { id: sellerId, name: 'seller' },
  ];

  for (const user of users) {
    const { data: existing } = await adminSupabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ Subscription exists for ${user.name}`);
      continue;
    }

    const { error } = await adminSupabase.from('subscriptions').insert({
      user_id: user.id,
      status: 'trial',
      trial_start_date: new Date().toISOString(),
      trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create subscription for ${user.name}: ${error.message}`);
    } else {
      console.log(`   ✓ Created trial subscription for ${user.name}`);
    }
  }
}

async function seedSPLedger(buyerId: string, sellerId: string): Promise<void> {
  console.log('\n💰 Seeding SP ledger entries...');

  const entries = [
    { user_id: buyerId, sp_amount: 50, reason: 'Signup bonus', transaction_type: 'earned' },
    { user_id: buyerId, sp_amount: 25, reason: 'Completed trade', transaction_type: 'earned' },
    { user_id: sellerId, sp_amount: 100, reason: 'Seller earnings', transaction_type: 'earned' },
    { user_id: sellerId, sp_amount: 30, reason: 'Referral bonus', transaction_type: 'earned' },
  ];

  for (const entry of entries) {
    const { data: existing } = await adminSupabase
      .from('sp_ledger')
      .select('id')
      .eq('user_id', entry.user_id)
      .eq('reason', entry.reason)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ SP entry exists: ${entry.reason}`);
      continue;
    }

    const { error } = await adminSupabase.from('sp_ledger').insert({
      user_id: entry.user_id,
      sp_amount: entry.sp_amount,
      reason: entry.reason,
      transaction_type: entry.transaction_type,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create SP entry "${entry.reason}": ${error.message}`);
    } else {
      console.log(`   ✓ Created SP entry: ${entry.reason} (+${entry.sp_amount} SP)`);
    }
  }
}

async function seedBadges(): Promise<void> {
  console.log('\n🏆 Seeding badges...');

  const badges = [
    { name: 'First Trade', category: 'trade', threshold: 1, description: 'Complete your first trade', icon_url: '🎉' },
    { name: 'SP Earner - Bronze', category: 'sp_earning', threshold: 10, description: 'Earn 10 SP', icon_url: '🥉' },
    { name: 'SP Earner - Silver', category: 'sp_earning', threshold: 50, description: 'Earn 50 SP', icon_url: '🥈' },
    { name: 'SP Earner - Gold', category: 'sp_earning', threshold: 100, description: 'Earn 100 SP', icon_url: '🥇' },
    { name: 'Trade Master', category: 'trade', threshold: 10, description: 'Complete 10 trades', icon_url: '⭐' },
  ];

  for (const badge of badges) {
    const { data: existing } = await adminSupabase
      .from('badges')
      .select('id')
      .eq('name', badge.name)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ Badge exists: ${badge.name}`);
      continue;
    }

    const { error } = await adminSupabase.from('badges').insert({
      name: badge.name,
      category: badge.category,
      threshold: badge.threshold,
      description: badge.description,
      icon_url: badge.icon_url,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create badge "${badge.name}": ${error.message}`);
    } else {
      console.log(`   ✓ Created badge: ${badge.name}`);
    }
  }
}

async function seedReferralCodes(buyerId: string, sellerId: string): Promise<void> {
  console.log('\n🔗 Seeding referral codes...');

  const users = [
    { id: buyerId, name: 'buyer', code: 'buyerref' },
    { id: sellerId, name: 'seller', code: 'sellrref' },
  ];

  for (const user of users) {
    const { data: existing } = await adminSupabase
      .from('referral_codes')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ Referral code exists for ${user.name}`);
      continue;
    }

    const { error } = await adminSupabase.from('referral_codes').insert({
      user_id: user.id,
      code: user.code,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create referral code for ${user.name}: ${error.message}`);
    } else {
      console.log(`   ✓ Created referral code for ${user.name}: ${user.code}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('🌱 SEED STAGING DATA (ENHANCED)');
  console.log('================================');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Admin: ${SUPABASE_SERVICE_KEY ? 'Yes' : 'No (limited functionality)'}`);
  console.log('');

  try {
    // 1. Seed categories
    const categoryMap = await seedCategories();

    // 2. Create test users (buyer, seller, admin)
    const buyerId = await signupTestUser(TEST_USERS.buyer, 'user');
    const sellerId = await signupTestUser(TEST_USERS.seller, 'user');
    const adminId = await signupTestUser(TEST_USERS.admin, 'admin');

    if (!buyerId || !sellerId) {
      console.error('\n❌ Failed to create test users. Aborting.');
      process.exit(1);
    }

    // Get fresh sessions for both users
    const { data: buyerSession } = await supabase.auth.signInWithPassword({
      email: TEST_USERS.buyer.email,
      password: TEST_USERS.buyer.password,
    });

    const { data: sellerSession } = await supabase.auth.signInWithPassword({
      email: TEST_USERS.seller.email,
      password: TEST_USERS.seller.password,
    });

    if (!buyerSession || !sellerSession) {
      console.error('\n❌ Failed to get sessions for test users.');
      process.exit(1);
    }

    // 3. Create listings for seller
    const listingIds = await seedListings(sellerId, sellerSession, categoryMap);

    // 4. Create a trade between buyer and seller
    if (listingIds.length > 0) {
      await seedTrade(buyerId, sellerId, listingIds[0]);
    }

    // 5. Create subscriptions
    await seedSubscriptions(buyerId, sellerId);

    // 6. Create SP ledger entries
    await seedSPLedger(buyerId, sellerId);

    // 7. Create badges
    await seedBadges();

    // 8. Create referral codes
    await seedReferralCodes(buyerId, sellerId);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ STAGING DATA SEEDED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📋 TEST CREDENTIALS:');
    console.log('--------------------');
    console.log(`BUYER:  ${TEST_USERS.buyer.email} / ${TEST_USERS.buyer.password}`);
    console.log(`        UUID: ${buyerId}`);
    console.log(`SELLER: ${TEST_USERS.seller.email} / ${TEST_USERS.seller.password}`);
    console.log(`        UUID: ${sellerId}`);
    if (adminId) {
      console.log(`ADMIN:  ${TEST_USERS.admin.email} / ${TEST_USERS.admin.password}`);
      console.log(`        UUID: ${adminId}`);
    }
    console.log('\n📊 SEEDED DATA:');
    console.log('--------------------');
    console.log(`✓ ${TEST_CATEGORIES.length} categories`);
    console.log(`✓ ${listingIds.length} listings (all available)`);
    console.log(`✓ 1 pending trade`);
    console.log(`✓ 2 trial subscriptions`);
    console.log(`✓ 4 SP ledger entries (buyer: 75 SP, seller: 130 SP)`);
    console.log(`✓ 5 badge definitions`);
    console.log(`✓ 2 referral codes`);
    console.log('\n🧪 QUICK TEST FLOWS:');
    console.log('1. Login as BUYER → Browse → See 5 listings from seller');
    console.log('2. Login as SELLER → My Listings → See pending trade');
    console.log('3. Complete the trade flow between both accounts');
    console.log('4. Check SP balances and badges');
    console.log('\n📱 Now you can:');
    console.log('   npm run test:all     # Run all E2E tests with staging data');
    console.log('   npm run test:auth    # Test auth flows');
    console.log('   npm run test:trades  # Test trade flows');
    console.log('   npm run test:badges  # Test badge awarding');
    console.log('');
    console.log('💡 TIP: Tests expect these exact UUIDs:');
    console.log(`   Buyer:  ${TEST_USERS.buyer.id}`);
    console.log(`   Seller: ${TEST_USERS.seller.id}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
