/**
 * SP Calculation Verification Script
 * 
 * Purpose: Verify that frontend preview matches backend calculation
 * Run after deploying the SP mismatch fix
 * 
 * Usage:
 *   node verify-sp-calculation.mjs <trade_id>
 * 
 * Or to test the calculation logic:
 *   node verify-sp-calculation.mjs --test
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Calculate expected SP for seller based on buyer's offer
 */
function calculateExpectedSP(buyerSP, itemPriceCents, categoryMultiplier) {
  if (buyerSP > 0) {
    // Buyer used SP: multiply buyer's SP by category multiplier
    return Math.floor(buyerSP * categoryMultiplier);
  } else if (itemPriceCents > 0) {
    // Buyer paid all cash: multiply price by category multiplier
    return Math.floor((itemPriceCents / 100) * categoryMultiplier);
  }
  return 0;
}

/**
 * Verify a specific trade's SP calculation
 */
async function verifyTrade(tradeId) {
  console.log(`\n🔍 Verifying trade: ${tradeId}\n`);

  // Fetch trade with item and category data
  const { data: trade, error } = await supabase
    .from('trades')
    .select(`
      id,
      status,
      sp_amount,
      sp_category_multiplier,
      sp_earned_at_completion,
      listing:items (
        price,
        category_id,
        categories:category_id (
          name,
          sp_earning_multiplier
        )
      )
    `)
    .eq('id', tradeId)
    .single();

  if (error || !trade) {
    console.error('❌ Trade not found:', error?.message);
    return false;
  }

  const buyerSP = trade.sp_amount || 0;
  const itemPrice = trade.listing?.price || 0;
  const itemPriceCents = Math.round(itemPrice * 100);
  const categoryMultiplier = trade.listing?.categories?.sp_earning_multiplier || 1.0;
  const storedMultiplier = trade.sp_category_multiplier;
  const actualSellerSP = trade.sp_earned_at_completion || 0;

  // Calculate what seller SHOULD have earned
  const expectedSP = calculateExpectedSP(buyerSP, itemPriceCents, categoryMultiplier);

  // Display results
  console.log('📊 Trade Details:');
  console.log(`   Trade ID: ${trade.id}`);
  console.log(`   Status: ${trade.status}`);
  console.log(`   Category: ${trade.listing?.categories?.name || 'Unknown'}`);
  console.log(`   Item Price: $${itemPrice.toFixed(2)}`);
  console.log('');
  
  console.log('🔢 SP Calculation:');
  console.log(`   Buyer SP Offered: ${buyerSP} SP`);
  console.log(`   Category Multiplier (from DB): ${categoryMultiplier}×`);
  console.log(`   Stored Multiplier (in trade): ${storedMultiplier || 'NULL'}×`);
  console.log('');

  if (buyerSP > 0) {
    console.log(`   Formula: FLOOR(${buyerSP} × ${storedMultiplier || categoryMultiplier}) = ${expectedSP} SP`);
  } else {
    console.log(`   Formula: FLOOR($${itemPrice} × ${storedMultiplier || categoryMultiplier}) = ${expectedSP} SP`);
  }
  console.log('');

  console.log('✨ Results:');
  console.log(`   Expected Seller SP: ${expectedSP} SP`);
  
  if (trade.status === 'completed') {
    console.log(`   Actual Seller SP: ${actualSellerSP} SP`);
    console.log('');

    const isMatch = actualSellerSP === expectedSP;
    const diff = actualSellerSP - expectedSP;

    if (isMatch) {
      console.log('✅ MATCH - SP calculation is correct!');
    } else {
      console.log(`❌ MISMATCH - Difference: ${diff > 0 ? '+' : ''}${diff} SP`);
      
      if (!storedMultiplier) {
        console.log('⚠️  Likely cause: Trade created BEFORE fix (sp_category_multiplier was NULL)');
      }
    }
  } else {
    console.log(`   Trade Status: ${trade.status} (not completed yet)`);
    console.log('   Actual SP: N/A (will be calculated on completion)');
    console.log('');
    
    if (!storedMultiplier) {
      console.log('⚠️  WARNING: sp_category_multiplier is NULL');
      console.log('   This trade was created BEFORE the fix.');
      console.log('   When completed, it will use fallback logic to fetch multiplier from categories table.');
    } else {
      console.log('✅ sp_category_multiplier is stored correctly');
      console.log('   This trade will use the correct multiplier on completion.');
    }
  }

  return true;
}

/**
 * Find and verify recent trades
 */
async function verifyRecentTrades() {
  console.log('\n📋 Checking recent trades...\n');

  const { data: trades, error } = await supabase
    .from('trades')
    .select(`
      id,
      status,
      sp_amount,
      sp_category_multiplier,
      sp_earned_at_completion,
      created_at,
      listing:items (
        price,
        category_id,
        categories:category_id (
          name,
          sp_earning_multiplier
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !trades || trades.length === 0) {
    console.log('❌ No trades found or error:', error?.message);
    return;
  }

  console.log(`Found ${trades.length} recent trades:\n`);

  let matchCount = 0;
  let mismatchCount = 0;
  let pendingCount = 0;
  let hasMultiplierCount = 0;

  for (const trade of trades) {
    const buyerSP = trade.sp_amount || 0;
    const itemPrice = trade.listing?.price || 0;
    const itemPriceCents = Math.round(itemPrice * 100);
    const categoryMultiplier = trade.listing?.categories?.sp_earning_multiplier || 1.0;
    const storedMultiplier = trade.sp_category_multiplier;
    const actualSellerSP = trade.sp_earned_at_completion || 0;

    const expectedSP = calculateExpectedSP(buyerSP, itemPriceCents, categoryMultiplier);

    if (storedMultiplier) hasMultiplierCount++;

    let status = '';
    if (trade.status === 'completed') {
      if (actualSellerSP === expectedSP) {
        status = '✅ MATCH';
        matchCount++;
      } else {
        status = `❌ MISMATCH (${actualSellerSP} ≠ ${expectedSP})`;
        mismatchCount++;
      }
    } else {
      status = storedMultiplier ? '⏳ Pending (has multiplier)' : '⚠️  Pending (no multiplier)';
      pendingCount++;
    }

    console.log(`${trade.id.substring(0, 8)}... | ${trade.status.padEnd(12)} | ${buyerSP} SP → ${expectedSP} SP | ${status}`);
  }

  console.log('\n📊 Summary:');
  console.log(`   Total Trades: ${trades.length}`);
  console.log(`   Matches: ${matchCount}`);
  console.log(`   Mismatches: ${mismatchCount}`);
  console.log(`   Pending: ${pendingCount}`);
  console.log(`   Has Multiplier Stored: ${hasMultiplierCount}/${trades.length}`);
  console.log('');

  if (mismatchCount > 0) {
    console.log('⚠️  Found mismatches - these are likely trades completed BEFORE the fix.');
  }
  
  if (hasMultiplierCount === trades.length) {
    console.log('✅ All recent trades have sp_category_multiplier stored - fix is working!');
  } else if (hasMultiplierCount > 0) {
    console.log(`⚠️  Only ${hasMultiplierCount}/${trades.length} trades have multiplier stored.`);
    console.log('   Older trades will use fallback logic when they complete.');
  } else {
    console.log('❌ No trades have sp_category_multiplier stored!');
    console.log('   The Edge Function fix may not be deployed yet.');
  }
}

/**
 * Run unit tests on calculation logic
 */
function runTests() {
  console.log('\n🧪 Running calculation tests...\n');

  const tests = [
    {
      name: 'Buyer uses SP (35 SP × 1.10)',
      buyerSP: 35,
      itemPriceCents: 1500,
      multiplier: 1.10,
      expected: 38,
    },
    {
      name: 'Buyer uses SP (30 SP × 1.10)',
      buyerSP: 30,
      itemPriceCents: 5000,
      multiplier: 1.10,
      expected: 33,
    },
    {
      name: 'All cash ($50 × 1.10)',
      buyerSP: 0,
      itemPriceCents: 5000,
      multiplier: 1.10,
      expected: 55,
    },
    {
      name: 'All cash ($15 × 1.10)',
      buyerSP: 0,
      itemPriceCents: 1500,
      multiplier: 1.10,
      expected: 16, // FLOOR(15 × 1.10) = FLOOR(16.5) = 16
    },
    {
      name: 'No multiplier (30 SP × 1.0)',
      buyerSP: 30,
      itemPriceCents: 5000,
      multiplier: 1.0,
      expected: 30,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = calculateExpectedSP(test.buyerSP, test.itemPriceCents, test.multiplier);
    const status = result === test.expected ? '✅' : '❌';
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }

    console.log(`${status} ${test.name}`);
    console.log(`   Expected: ${test.expected} SP, Got: ${result} SP`);
    
    if (result !== test.expected) {
      console.log(`   ⚠️  FAILED`);
    }
    console.log('');
  }

  console.log(`📊 Test Results: ${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
SP Calculation Verification Script

Usage:
  node verify-sp-calculation.mjs <trade_id>   Verify a specific trade
  node verify-sp-calculation.mjs --test       Run unit tests
  node verify-sp-calculation.mjs --recent     Check recent trades
  node verify-sp-calculation.mjs --help       Show this help

Environment Variables Required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
    `);
    return;
  }

  if (args[0] === '--test') {
    const success = runTests();
    process.exit(success ? 0 : 1);
  } else if (args[0] === '--recent') {
    await verifyRecentTrades();
  } else {
    const tradeId = args[0];
    await verifyTrade(tradeId);
  }
}

main().catch(console.error);
