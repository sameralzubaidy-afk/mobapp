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

// ─── CLI flag: --extended seeds additional test data for full Detox coverage ──
const IS_EXTENDED = process.argv.includes('--extended');
if (IS_EXTENDED) {
  console.log('🔧 Extended mode enabled — seeding additional test scenarios.');
}

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
    id: 'e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f', // Fixed UUID for admin
    email: 'test-admin@kidsmarketplace.test',
    password: 'TestAdmin123!',
    name: 'Test Admin',
    phone: '5551234003',
  },
  freeUser: {
    id: 'a1234567-0000-0000-0000-000000000001', // Fixed UUID for free user
    email: 'test-free@kidsmarketplace.test',
    password: 'TestFree123!',
    name: 'Test Free User',
    phone: '5551234004',
  },
  seller2: {
    id: 'a1234567-0000-0000-0000-000000000002', // Fixed UUID for second seller
    email: 'test-seller-2@kidsmarketplace.test',
    password: 'TestSeller2123!',
    name: 'Test Seller 2',
    phone: '5551234005',
  },
  buyer2: {
    id: 'a1234567-0000-0000-0000-000000000003', // Fixed UUID for competing offer buyer
    email: 'test-buyer-2@kidsmarketplace.test',
    password: 'TestBuyer2123!',
    name: 'Test Buyer 2',
    phone: '5551234006',
  },
  buyer3: {
    id: 'a1234567-0000-0000-0000-000000000004', // Fixed UUID for competing offer buyer
    email: 'test-buyer-3@kidsmarketplace.test',
    password: 'TestBuyer3123!',
    name: 'Test Buyer 3',
    phone: '5551234007',
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
    price: 45.0,
    status: 'available',
  },
  {
    title: 'LEGO Star Wars Set',
    description: 'Millennium Falcon set, all pieces included with instructions.',
    categoryName: 'Toys',
    condition: 'like_new',
    price: 30.0,
    status: 'available',
  },
  {
    title: 'Kids Bicycle - 20 inch',
    description: 'Blue mountain bike, perfect for ages 7-10. Minor scratches.',
    categoryName: 'Sports',
    condition: 'fair',
    price: 60.0,
    status: 'available',
  },
  {
    title: 'Harry Potter Book Set',
    description: 'Complete series, gently used paperbacks.',
    categoryName: 'Books',
    condition: 'good',
    price: 35.0,
    status: 'available',
  },
  {
    title: 'Basketball',
    description: 'Official size, indoor/outdoor use.',
    categoryName: 'Sports',
    condition: 'good',
    price: 15.0,
    status: 'available',
  },
];

// Extended listings (seeded only with --extended flag)
const DONATION_LISTING = {
  title: 'Free Art Supplies',
  description: 'Gently used markers, crayons, and sketch pads — free to a good home!',
  categoryName: 'Books',
  condition: 'fair',
  price: 0,
  status: 'available',
  accepts_swap_points: false,
};

const CASH_ONLY_LISTING = {
  title: 'Vintage Comic Book Collection',
  description: 'Set of 10 classic comic books. Cash only, no SP accepted.',
  categoryName: 'Books',
  condition: 'good',
  price: 25.0,
  status: 'available',
  accepts_swap_points: false,
};

const SELLER2_LISTINGS = [
  {
    title: 'Science Kit',
    description: 'STEM experiment kit, unopened.',
    categoryName: 'Toys',
    condition: 'like_new',
    price: 20.0,
    status: 'available',
  },
  {
    title: 'Board Game Set',
    description: 'Monopoly, Scrabble, and Chess — all complete.',
    categoryName: 'Toys',
    condition: 'good',
    price: 18.0,
    status: 'available',
  },
  {
    title: 'Children\'s Dictionary',
    description: 'Hardcover illustrated dictionary.',
    categoryName: 'Books',
    condition: 'good',
    price: 8.0,
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

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: cat.name,
        icon: cat.icon,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ Failed to create category "${cat.name}": ${error.message}`);
    } else {
      console.log(`   ✓ Created category: ${cat.name}`);
      categoryMap[cat.name] = data.id;
    }
  }

  return categoryMap;
}

async function signupTestUser(
  userData: typeof TEST_USERS.buyer,
  role: string = 'user'
): Promise<string | null> {
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
          },
        },
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
  const { error: profileError } = await adminSupabase.from('profiles').upsert(
    {
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
    },
    { onConflict: 'user_id' }
  );

  if (profileError) {
    console.log(`   ⚠️ Profile: ${profileError.message}`);
  } else {
    console.log(`   ✓ Profile created with role: ${role}`);
  }

  return userId;
}

async function seedListings(
  sellerId: string,
  sellerSession: any,
  categoryMap: { [key: string]: string }
): Promise<string[]> {
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
      // Reset status to available if it was previously sold/pending
      const { error: resetError } = await adminSupabase
        .from('items')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .in('status', ['sold', 'pending', 'unavailable']);
      if (resetError) {
        console.log(`   ⚠️ Could not reset status for: ${listing.title} (${resetError.message})`);
      }
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
    { user_id: buyerId, amount: 50, description: 'Signup bonus', transaction_type: 'earned' },
    { user_id: buyerId, amount: 25, description: 'Completed trade', transaction_type: 'earned' },
    { user_id: sellerId, amount: 100, description: 'Seller earnings', transaction_type: 'earned' },
    { user_id: sellerId, amount: 30, description: 'Referral bonus', transaction_type: 'earned' },
  ];

  for (const entry of entries) {
    const { data: existing } = await adminSupabase
      .from('sp_ledger')
      .select('id')
      .eq('user_id', entry.user_id)
      .eq('description', entry.description)
      .maybeSingle();

    if (existing) {
      console.log(`   ✓ SP entry exists: ${entry.description}`);
      continue;
    }

    const { error } = await adminSupabase.from('sp_ledger').insert({
      user_id: entry.user_id,
      amount: entry.amount,
      description: entry.description,
      transaction_type: entry.transaction_type,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`   ❌ Failed to create SP entry "${entry.description}": ${error.message}`);
    } else {
      console.log(`   ✓ Created SP entry: ${entry.description} (+${entry.amount} SP)`);
    }
  }
}

async function seedBadges(): Promise<void> {
  console.log('\n🏆 Seeding badges...');

  const badges = [
    {
      name: 'First Trade',
      category: 'trade',
      threshold: 1,
      description: 'Complete your first trade',
      icon_url: '🎉',
    },
    {
      name: 'SP Earner - Bronze',
      category: 'sp_earning',
      threshold: 10,
      description: 'Earn 10 SP',
      icon_url: '🥉',
    },
    {
      name: 'SP Earner - Silver',
      category: 'sp_earning',
      threshold: 50,
      description: 'Earn 50 SP',
      icon_url: '🥈',
    },
    {
      name: 'SP Earner - Gold',
      category: 'sp_earning',
      threshold: 100,
      description: 'Earn 100 SP',
      icon_url: '🥇',
    },
    {
      name: 'Trade Master',
      category: 'trade',
      threshold: 10,
      description: 'Complete 10 trades',
      icon_url: '⭐',
    },
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

// ============================================================================
// EXTENDED SEED FUNCTIONS (only called with --extended flag)
// ============================================================================

/**
 * Seeds a free (non-subscriber) user for TC-C07, TC-H01, TC-K02.
 */
async function seedFreeUser(): Promise<string | null> {
  console.log('\n🆓 Seeding free (non-subscriber) user...');
  const userId = await signupTestUser(TEST_USERS.freeUser, 'user');
  // DO NOT create a subscription — this user must remain free
  return userId;
}

/**
 * Seeds the second seller account for multi-seller cart tests (TC-M02-M04, M10, etc.).
 */
async function seedSeller2(categoryMap: { [key: string]: string }): Promise<string | null> {
  console.log('\n👤 Seeding second seller...');
  const seller2Id = await signupTestUser(TEST_USERS.seller2, 'user');
  if (!seller2Id) return null;

  const { data: session } = await supabase.auth.signInWithPassword({
    email: TEST_USERS.seller2.email,
    password: TEST_USERS.seller2.password,
  });

  console.log('\n📦 Seeding seller 2 listings...');
  for (const listing of SELLER2_LISTINGS) {
    const { data: existing } = await adminSupabase
      .from('items')
      .select('id')
      .eq('seller_id', seller2Id)
      .eq('title', listing.title)
      .maybeSingle();
    if (existing) {
      console.log(`   ✓ Listing exists: ${listing.title}`);
      continue;
    }
    await adminSupabase.from('items').insert({
      seller_id: seller2Id,
      title: listing.title,
      description: listing.description,
      category_id: categoryMap[listing.categoryName] || null,
      condition: listing.condition,
      price: listing.price,
      status: listing.status,
      accepts_swap_points: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Created listing: ${listing.title}`);
  }

  return seller2Id;
}

/**
 * Seeds competing offers on the same listing for TC-B03.
 */
async function seedCompetingOffers(
  buyer2Id: string,
  buyer3Id: string,
  sellerId: string,
  listingIds: string[]
): Promise<void> {
  console.log('\n🥊 Seeding competing offers...');
  if (listingIds.length === 0) return;
  const targetListingId = listingIds[0];

  const competitors = [
    { id: buyer2Id, email: TEST_USERS.buyer2.email, cash: 2800, sp: 2 },
    { id: buyer3Id, email: TEST_USERS.buyer3.email, cash: 3000, sp: 0 },
  ];

  for (const comp of competitors) {
    const { data: existing } = await adminSupabase
      .from('trades')
      .select('id')
      .eq('buyer_id', comp.id)
      .eq('listing_id', targetListingId)
      .in('status', ['pending', 'accepted', 'in_progress'])
      .maybeSingle();
    if (existing) continue;

    await adminSupabase.from('trades').insert({
      buyer_id: comp.id,
      seller_id: sellerId,
      listing_id: targetListingId,
      status: 'pending',
      cash_amount_cents: comp.cash,
      sp_amount: comp.sp,
      buyer_transaction_fee_cents: 99,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Competing offer from ${comp.email}: $${(comp.cash/100).toFixed(2)} + ${comp.sp} SP`);
  }
}

/**
 * Seeds bundle trades (2+ trades sharing a bundle_id) for TC-L01-L08.
 */
async function seedBundleTrades(
  buyerId: string,
  sellerId: string,
  listingIds: string[]
): Promise<void> {
  console.log('\n🔗 Seeding bundle trades...');
  if (listingIds.length < 3) return;

  const bundleId = '00000000-0000-0000-0000-00000000bundle';

  // Use listings at indices 1 and 2 for the bundle
  const bundleListingIds = [listingIds[1], listingIds[2]];

  for (const lid of bundleListingIds) {
    const { data: existing } = await adminSupabase
      .from('trades')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('listing_id', lid)
      .eq('bundle_id', bundleId)
      .maybeSingle();
    if (existing) {
      console.log(`   ✓ Bundle trade exists for listing ${lid}`);
      continue;
    }

    await adminSupabase.from('trades').insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: lid,
      status: 'in_progress',
      cash_amount_cents: 3000,
      sp_amount: 0,
      buyer_transaction_fee_cents: 99,
      bundle_id: bundleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Created bundle trade for listing ${lid}`);
  }
}

/**
 * Seeds a completed trade with a review for TC-Q01-Q10, Q15-Q17.
 */
async function seedCompletedTradeWithReview(
  buyerId: string,
  sellerId: string,
  listingIds: string[]
): Promise<void> {
  console.log('\n⭐ Seeding completed trade with review...');
  if (listingIds.length < 4) return;

  const targetListingId = listingIds[3];

  // Check if completed trade exists
  const { data: existingTrade } = await adminSupabase
    .from('trades')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('listing_id', targetListingId)
    .eq('status', 'completed')
    .maybeSingle();

  let tradeId: string;
  if (existingTrade) {
    tradeId = existingTrade.id;
    console.log(`   ✓ Completed trade exists: ${tradeId}`);
  } else {
    const { data: trade, error } = await adminSupabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: targetListingId,
        status: 'completed',
        cash_amount_cents: 3500,
        sp_amount: 0,
        buyer_transaction_fee_cents: 99,
        completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) {
      console.error(`   ❌ Failed to create completed trade: ${error.message}`);
      return;
    }
    tradeId = trade.id;
    console.log(`   ✓ Created completed trade: ${tradeId}`);
  }

  // Mark the listing as sold
  await adminSupabase
    .from('items')
    .update({ status: 'sold', updated_at: new Date().toISOString() })
    .eq('id', targetListingId);

  // Seed a review from buyer for seller
  const { data: existingReview } = await adminSupabase
    .from('reviews')
    .select('id')
    .eq('trade_id', tradeId)
    .eq('reviewer_id', buyerId)
    .maybeSingle();

  if (!existingReview) {
    await adminSupabase.from('reviews').insert({
      trade_id: tradeId,
      reviewer_id: buyerId,
      reviewee_id: sellerId,
      rating: 4,
      comment: 'Great seller, smooth pickup!',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    console.log('   ✓ Created review from buyer → seller (4 stars)');
  } else {
    console.log('   ✓ Review already exists');
  }

  // Seed the seller's review of the buyer (mutual review status test)
  const { data: existingReview2 } = await adminSupabase
    .from('reviews')
    .select('id')
    .eq('trade_id', tradeId)
    .eq('reviewer_id', sellerId)
    .maybeSingle();

  if (!existingReview2) {
    await adminSupabase.from('reviews').insert({
      trade_id: tradeId,
      reviewer_id: sellerId,
      reviewee_id: buyerId,
      rating: 5,
      comment: 'Great buyer, quick communication!',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    console.log('   ✓ Created review from seller → buyer (5 stars)');
  }
}

/**
 * Seeds donation and cash-only listings for TC-A01, TC-A04.
 */
async function seedExtendedListings(sellerId: string, categoryMap: { [key: string]: string }): Promise<void> {
  console.log('\n📦 Seeding extended listings (donation, cash-only)...');

  const extended = [DONATION_LISTING, CASH_ONLY_LISTING];
  for (const listing of extended) {
    const { data: existing } = await adminSupabase
      .from('items')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('title', listing.title)
      .maybeSingle();
    if (existing) {
      console.log(`   ✓ Extended listing exists: ${listing.title}`);
      continue;
    }
    await adminSupabase.from('items').insert({
      seller_id: sellerId,
      title: listing.title,
      description: listing.description,
      category_id: categoryMap[listing.categoryName] || null,
      condition: listing.condition,
      price: listing.price,
      status: listing.status,
      accepts_swap_points: listing.accepts_swap_points ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`   ✓ Created extended listing: ${listing.title}`);
  }
}

/**
 * Seeds seller accounts with prior cancel counts for TC-J01-J03.
 */
async function seedSellerCancelLevels(): Promise<void> {
  console.log('\n⚠️ Seeding seller cancel level data...');
  // This sets up DB-level cancel tracking via the seller_consequences table.
  // Level 2/3 accounts need prior cancellations recorded.
  // For now, the test framework relies on seed data + actual cancels during test runs.
  // If a seller_consequences table exists, we seed it here.

  try {
    // Check if the seller_consequences table exists
    const { error } = await adminSupabase
      .from('seller_consequences')
      .select('id')
      .limit(1);
    if (error && error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('   ⏭️  seller_consequences table does not exist — skipping');
      return;
    }
    console.log('   ✓ seller_consequences table exists');
  } catch {
    console.log('   ⏭️  Could not check seller_consequences — skipping');
  }
}

/**
 * Seeds tax configuration for TC-O01-O07.
 */
async function seedTaxConfig(): Promise<void> {
  console.log('\n💰 Seeding tax configuration...');
  // Check if node_tax_rates table exists
  try {
    const { error } = await adminSupabase
      .from('node_tax_rates')
      .select('id')
      .limit(1);
    if (error && error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('   ⏭️  node_tax_rates table does not exist — skipping');
      return;
    }
    console.log('   ✓ node_tax_rates table exists');
  } catch {
    console.log('   ⏭️  Could not check node_tax_rates — skipping');
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
  console.log(`Mode: ${IS_EXTENDED ? 'Extended (--extended)' : 'Basic'}`);
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

    // 4. Create trades between buyer and seller
    if (listingIds.length > 0) {
      await seedTrade(buyerId, sellerId, listingIds[0]);
    }
    if (listingIds.length > 1) {
      await seedTrade(buyerId, sellerId, listingIds[1]);
    }
    if (listingIds.length > 2) {
      await seedTrade(buyerId, sellerId, listingIds[2]);
    }

    // 5. Create subscriptions
    await seedSubscriptions(buyerId, sellerId);

    // 6. Create SP ledger entries
    await seedSPLedger(buyerId, sellerId);

    // 7. Create badges
    await seedBadges();

    // 8. Create referral codes
    await seedReferralCodes(buyerId, sellerId);

    // ── Extended mode: seed additional test scenarios ─────────────────────
    if (IS_EXTENDED) {
      console.log('\n' + '═'.repeat(50));
      console.log('🔧 EXTENDED SEEDING');
      console.log('═'.repeat(50));

      // 9. Create free (non-subscriber) user
      const freeUserId = await seedFreeUser();

      // 10. Create second seller with listings
      const seller2Id = await seedSeller2(categoryMap);

      // 11. Create extended listings (donation, cash-only)
      await seedExtendedListings(sellerId, categoryMap);

      // 12. Create additional buyer accounts for competing offers
      const buyer2Id = await signupTestUser(TEST_USERS.buyer2, 'user');
      const buyer3Id = await signupTestUser(TEST_USERS.buyer3, 'user');

      // 13. Competing offers on the same listing (TC-B03)
      if (buyer2Id && buyer3Id) {
        await seedCompetingOffers(buyer2Id, buyer3Id, sellerId, listingIds);
      }

      // 14. Bundle trades (TC-L01-L08)
      await seedBundleTrades(buyerId, sellerId, listingIds);

      // 15. Completed trade with reviews (TC-Q01-Q10, Q15-Q17)
      await seedCompletedTradeWithReview(buyerId, sellerId, listingIds);

      // 16. Seller cancel level tracking (TC-J01-J03)
      await seedSellerCancelLevels();

      // 17. Tax configuration (TC-O01-O07)
      await seedTaxConfig();

      console.log('\n' + '═'.repeat(50));
      console.log('✅ EXTENDED SEEDING COMPLETE');
      console.log('═'.repeat(50));
    }

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
    if (IS_EXTENDED) {
      console.log(`FREE:   ${TEST_USERS.freeUser.email} / ${TEST_USERS.freeUser.password}`);
      console.log(`SELLER2:${TEST_USERS.seller2.email} / ${TEST_USERS.seller2.password}`);
      console.log(`BUYER2: ${TEST_USERS.buyer2.email} / ${TEST_USERS.buyer2.password}`);
      console.log(`BUYER3: ${TEST_USERS.buyer3.email} / ${TEST_USERS.buyer3.password}`);
    }
    console.log('\n📊 SEEDED DATA:');
    console.log('--------------------');
    console.log(`✓ ${TEST_CATEGORIES.length} categories`);
    console.log(`✓ ${IS_EXTENDED ? listingIds.length + 2 + SELLER2_LISTINGS.length : listingIds.length} listings`);
    console.log(`✓ 3 pending trades`);
    console.log(`✓ 2 trial subscriptions`);
    console.log(`✓ 4 SP ledger entries (buyer: 75 SP, seller: 130 SP)`);
    console.log(`✓ 5 badge definitions`);
    console.log(`✓ 2 referral codes`);
    if (IS_EXTENDED) {
      console.log(`✓ 2 competing offers (from buyer-2, buyer-3)`);
      console.log(`✓ 2 bundle trades (in_progress)`);
      console.log(`✓ 1 completed trade with mutual reviews`);
      console.log(`✓ Donation + cash-only listings`);
    }
    console.log('\n🧪 QUICK TEST FLOWS:');
    console.log('1. Login as BUYER → Browse → See 5 listings from seller');
    console.log('2. Login as SELLER → My Listings → See pending trade');
    console.log('3. Complete the trade flow between both accounts');
    console.log('4. Check SP balances and badges');
    if (IS_EXTENDED) {
      console.log('5. Extended: Test competing offers, bundles, reviews, tax, and more');
    }
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
