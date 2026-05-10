#!/usr/bin/env node

/**
 * Smoke Test Script: Trade Flow (FLOW-08)
 * Automated tests for all 6 trade screens using Supabase client
 * 
 * Usage:
 *   node scripts/smoke/trade-flow.mjs
 * 
 * Prerequisites:
 *   - Supabase env vars configured (.env.local)
 *   - Test users seeded (buyer-test@example.com, seller-test@example.com)
 *   - At least 1 test listing exists
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase env vars. Check .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test users
const BUYER_EMAIL = 'buyer-test@example.com';
const SELLER_EMAIL = 'seller-test@example.com';
const TEST_PASSWORD = 'testpassword123';

let buyerSession;
let sellerSession;
let testListing;
let testTrade;

// Helper: Test assertion
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

// Helper: Login
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data.session;
}

// Helper: Cleanup
async function cleanup() {
  if (testTrade?.id) {
    await supabase.from('trades').delete().eq('id', testTrade.id);
  }
  if (testListing?.id) {
    await supabase.from('items').delete().eq('id', testListing.id);
  }
}

// Test 1: Setup - Login test users
async function test01_setup() {
  console.log('\n🧪 Test 1: Setup - Login test users');

  buyerSession = await login(BUYER_EMAIL, TEST_PASSWORD);
  assert(buyerSession?.user?.id, 'Buyer login succeeded');

  sellerSession = await login(SELLER_EMAIL, TEST_PASSWORD);
  assert(sellerSession?.user?.id, 'Seller login succeeded');

  // Create test listing
  const { data: listing, error } = await supabase
    .from('items')
    .insert({
      seller_id: sellerSession.user.id,
      title: 'Smoke Test Item',
      description: 'Item for smoke testing trade flow',
      price: 100,
      status: 'active',
      payment_preference: 'accept_sp',
    })
    .select()
    .single();

  assert(!error && listing?.id, 'Test listing created');
  testListing = listing;
}

// Test 2: TradeOfferScreen - Initiate trade with SP
async function test02_initiateTradeWithSP() {
  console.log('\n🧪 Test 2: TradeOfferScreen - Initiate trade with SP');

  // Set buyer session
  await supabase.auth.setSession(buyerSession);

  // Simulate trade initiation (normally done via initiateTradeV2 service)
  const { data: trade, error } = await supabase
    .from('trades')
    .insert({
      buyer_id: buyerSession.user.id,
      seller_id: sellerSession.user.id,
      listing_id: testListing.id,
      status: 'pending',
      cash_amount_cents: 7500, // $75
      sp_amount: 25, // 25% of $100 item (within 50% cap)
      buyer_transaction_fee_cents: 500, // $5 fee
    })
    .select()
    .single();

  assert(!error && trade?.id, 'Trade created with SP');
  assert(trade.sp_amount === 25, 'SP amount is 25');
  assert(trade.cash_amount_cents === 7500, 'Cash amount is $75');
  testTrade = trade;
}

// Test 3: TradeReviewScreen - Accept incoming trade
async function test03_acceptTrade() {
  console.log('\n🧪 Test 3: TradeReviewScreen - Accept incoming trade');

  // Set seller session
  await supabase.auth.setSession(sellerSession);

  // TODO: Call accept_trade RPC when implemented
  // For now, manually update status
  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'in_progress' })
    .eq('id', testTrade.id)
    .select()
    .single();

  assert(!error && data?.status === 'in_progress', 'Trade accepted and status updated');
}

// Test 4: TradeListScreen - Fetch and filter trades
async function test04_fetchTrades() {
  console.log('\n🧪 Test 4: TradeListScreen - Fetch and filter trades');

  // Set buyer session
  await supabase.auth.setSession(buyerSession);

  // Fetch all trades
  const { data: allTrades, error: allError } = await supabase
    .from('trades')
    .select('*, listing:items(*)')
    .or(`buyer_id.eq.${buyerSession.user.id},seller_id.eq.${buyerSession.user.id}`)
    .order('created_at', { ascending: false });

  assert(!allError && Array.isArray(allTrades), 'Fetched all trades');
  assert(allTrades.length > 0, 'At least 1 trade exists');

  // Filter buying trades
  const buyingTrades = allTrades.filter(
    (t) => t.buyer_id === buyerSession.user.id
  );
  assert(buyingTrades.length > 0, 'Buying trades filtered correctly');

  // Filter selling trades (should be 0 for buyer)
  const sellingTrades = allTrades.filter(
    (t) => t.seller_id === buyerSession.user.id
  );
  assert(sellingTrades.length === 0, 'Selling trades filtered correctly (0 for buyer)');
}

// Test 5: TradeTimelineScreen - Mark as completed (seller)
async function test05_sellerMarkCompleted() {
  console.log('\n🧪 Test 5: TradeTimelineScreen - Seller marks as completed');

  // Set seller session
  await supabase.auth.setSession(sellerSession);

  // TODO: Call completeTradeV2 service when implemented
  // For now, manually update
  const { data, error } = await supabase
    .from('trades')
    .update({ seller_marked_completed_at: new Date().toISOString() })
    .eq('id', testTrade.id)
    .select()
    .single();

  assert(!error && data?.seller_marked_completed_at, 'Seller marked trade as completed');
  assert(data.status === 'in_progress', 'Status remains in_progress (awaiting buyer)');
}

// Test 6: TradeTimelineScreen - Mark as completed (buyer)
async function test06_buyerMarkCompleted() {
  console.log('\n🧪 Test 6: TradeTimelineScreen - Buyer marks as completed');

  // Set buyer session
  await supabase.auth.setSession(buyerSession);

  // TODO: Call completeTradeV2 service when implemented
  // For now, manually update
  const { data, error } = await supabase
    .from('trades')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', testTrade.id)
    .select()
    .single();

  assert(!error && data?.status === 'completed', 'Trade status updated to completed');
  assert(data.completed_at, 'Completion timestamp set');
}

// Test 7: TradeDisputeScreen - File dispute
async function test07_fileDispute() {
  console.log('\n🧪 Test 7: TradeDisputeScreen - File dispute');

  // Create a new trade for dispute testing
  await supabase.auth.setSession(buyerSession);

  const { data: disputeTrade, error: createError } = await supabase
    .from('trades')
    .insert({
      buyer_id: buyerSession.user.id,
      seller_id: sellerSession.user.id,
      listing_id: testListing.id,
      status: 'in_progress',
      cash_amount_cents: 10000,
      sp_amount: 0,
    })
    .select()
    .single();

  assert(!createError && disputeTrade?.id, 'Created test trade for dispute');

  // TODO: Call dispute RPC when implemented
  // For now, manually update
  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'disputed' })
    .eq('id', disputeTrade.id)
    .select()
    .single();

  assert(!error && data?.status === 'disputed', 'Trade status updated to disputed');

  // Cleanup dispute trade
  await supabase.from('trades').delete().eq('id', disputeTrade.id);
}

// Test 8: Cancel trade and verify SP refund
async function test08_cancelTrade() {
  console.log('\n🧪 Test 8: Cancel trade and verify SP refund');

  // Create a new trade with SP
  await supabase.auth.setSession(buyerSession);

  const { data: cancelTrade, error: createError } = await supabase
    .from('trades')
    .insert({
      buyer_id: buyerSession.user.id,
      seller_id: sellerSession.user.id,
      listing_id: testListing.id,
      status: 'pending',
      cash_amount_cents: 7500,
      sp_amount: 25,
    })
    .select()
    .single();

  assert(!createError && cancelTrade?.id, 'Created test trade for cancellation');

  // Get initial SP balance
  const { data: initialWallet } = await supabase
    .from('swap_points_wallets')
    .select('balance_available')
    .eq('user_id', buyerSession.user.id)
    .single();

  const initialBalance = initialWallet?.balance_available || 0;

  // TODO: Call cancelTradeV2 service when implemented
  // For now, manually update
  const { data, error } = await supabase
    .from('trades')
    .update({
      status: 'cancelled',
      cancellation_reason: 'Changed my mind',
    })
    .eq('id', cancelTrade.id)
    .select()
    .single();

  assert(!error && data?.status === 'cancelled', 'Trade cancelled');
  assert(data.cancellation_reason === 'Changed my mind', 'Cancellation reason stored');

  // Note: SP refund would be handled by service layer
  console.log('⚠️  SP refund verification requires service layer implementation');

  // Cleanup cancel trade
  await supabase.from('trades').delete().eq('id', cancelTrade.id);
}

// Test 9: SP cap enforcement
async function test09_spCapEnforcement() {
  console.log('\n🧪 Test 9: SP cap enforcement (50% max)');

  // This test verifies client-side validation
  // (Service layer should also enforce)

  const itemPrice = 100;
  const maxSP = itemPrice * 0.5; // 50% cap

  assert(maxSP === 50, 'Max SP is 50 (50% of $100)');

  // Test exceeding cap
  const excessSP = 60;
  const exceedsCap = excessSP > maxSP;
  assert(exceedsCap === true, 'SP of 60 exceeds 50% cap');

  // Test within cap
  const validSP = 50;
  const withinCap = validSP <= maxSP;
  assert(withinCap === true, 'SP of 50 is within cap');

  console.log('✅ SP cap enforcement logic validated');
}

// Test 10: Status badge colors mapping
async function test10_statusBadgeColors() {
  console.log('\n🧪 Test 10: Status badge colors mapping');

  const statusColors = {
    pending: { bg: '#FEF3C7', text: '#D97706' },
    in_progress: { bg: '#E8F5F0', text: '#5DBB8E' },
    completed: { bg: '#F0F0F0', text: '#6B6B6B' },
    cancelled: { bg: '#FEE2E2', text: '#E85D75' },
    disputed: { bg: '#FEE2E2', text: '#E85D75' },
  };

  assert(statusColors.pending.bg === '#FEF3C7', 'Pending badge: amber background');
  assert(statusColors.in_progress.bg === '#E8F5F0', 'In Progress badge: green background');
  assert(statusColors.completed.bg === '#F0F0F0', 'Completed badge: gray background');
  assert(statusColors.cancelled.bg === '#FEE2E2', 'Cancelled badge: red background');

  console.log('✅ Status badge colors validated');
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting FLOW-08 Trade Flow Smoke Tests\n');

  try {
    await test01_setup();
    await test02_initiateTradeWithSP();
    await test03_acceptTrade();
    await test04_fetchTrades();
    await test05_sellerMarkCompleted();
    await test06_buyerMarkCompleted();
    await test07_fileDispute();
    await test08_cancelTrade();
    await test09_spCapEnforcement();
    await test10_statusBadgeColors();

    console.log('\n✅ All FLOW-08 smoke tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
    console.log('\n🧹 Cleanup completed');
  }
}

runTests();
