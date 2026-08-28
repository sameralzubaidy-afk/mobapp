/**
 * Cleanup Test Trades Script
 *
 * Cancels all pending/payment_failed trades created by the test buyer
 * and resets the affected items back to 'available' status.
 *
 * This ensures each test run starts with a clean slate — no stale
 * pending offers block re-testing the same listings.
 *
 * Run with: npm run cleanup:trades
 * Or inline: npx ts-node scripts/cleanup-test-trades.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('   Make sure .env or .env.staging has:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

// ─── Test accounts (match seed-staging-data.ts) ──────────────────────────
const BUYER_ID = '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer
const SELLER_ID = '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller

async function main() {
  console.log('🧹 CLEANUP TEST TRADES');
  console.log(`   Target: ${SUPABASE_URL}`);
  console.log('');

  // Dev Task 25 (item 7): clear ALL pending offers for the standard fixture
  // pair. Per-seller cap tests (TRD-TC-B05 series) count every pending offer
  // against test-seller regardless of which buyer submitted it (test-buyer,
  // test-buyer-2, test-buyer-3), so this must clear pending trades where the
  // BUYER is test-buyer OR the SELLER is test-seller — otherwise cap slots stay
  // occupied across runs and block the next cap-related batch.
  const { data: trades, error: fetchError } = await admin
    .from('trades')
    .select('id, listing_id, status, buyer_id')
    .or(`buyer_id.eq.${BUYER_ID},seller_id.eq.${SELLER_ID}`)
    .in('status', ['pending', 'payment_failed']);

  if (fetchError) {
    console.error(`   ❌ Failed to fetch trades: ${fetchError.message}`);
    process.exit(1);
  }

  if (!trades || trades.length === 0) {
    console.log('   ✅ No pending trades to clean up.\n');
    return;
  }

  console.log(`   📋 Found ${trades.length} pending trade(s):`);
  const listingIds: string[] = [];
  const tradeIds: string[] = [];

  for (const t of trades) {
    console.log(
      `      - ${t.id.slice(0, 8)}…  listing: ${t.listing_id.slice(0, 8)}…  buyer: ${t.buyer_id.slice(0, 8)}…  status: ${t.status}`
    );
    tradeIds.push(t.id);
    listingIds.push(t.listing_id);
  }
  console.log('');

  // 2. Cancel the trades by updating status to 'cancelled'
  //    Using direct UPDATE with the service role key to bypass RLS
  const { error: updateError } = await admin
    .from('trades')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'buyer_cancelled',
      updated_at: new Date().toISOString(),
    })
    .in('id', tradeIds);

  if (updateError) {
    console.error(`   ❌ Failed to cancel trades: ${updateError.message}`);
    process.exit(1);
  }
  console.log(`   ✅ Cancelled ${tradeIds.length} trade(s).`);
  console.log('');

  // 3. Reset affected listings back to 'available'
  const { error: resetError } = await admin
    .from('items')
    .update({ status: 'available', updated_at: new Date().toISOString() })
    .in('id', listingIds)
    .in('status', ['pending', 'sold']);

  if (resetError) {
    console.error(`   ⚠️  Failed to reset some listings: ${resetError.message}`);
  } else {
    console.log(`   ✅ Reset ${listingIds.length} listing(s) to available.`);
  }
  console.log('');

  console.log('🧹 CLEANUP COMPLETE');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
