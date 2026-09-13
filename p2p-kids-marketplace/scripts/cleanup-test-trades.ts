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
import type { SupabaseClient } from '@supabase/supabase-js';
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

/**
 * FIX-Task-24 item 4 (2026-09-12) — void the tax record for every trade this script
 * just cancelled.
 *
 * WHY: cancelling with a raw status UPDATE (what this script does) skips the tax
 * lifecycle the app's own cancel path performs, so a cancelled trade could keep
 * `tax_status='quoted'` forever and inflate `pending_tax_cents` in period reports
 * (25 such rows were found on staging). A cancelled trade can never have collectible
 * tax, so voiding is always the correct cleanup.
 *
 * The canonical logic stays in the DB — this only CALLS `rpc_void_tax_for_trade`
 * (which also zeroes stale refund fields, DT71). Expected non-void results:
 *   'noop'        = no tax record on that trade (exempt / tax-disabled fixture)
 *   INVALID_STATE = record not voidable (typically already voided)
 */
async function voidTaxForTrades(
  db: SupabaseClient,
  tradeIds: string[]
): Promise<{ voided: number; noop: number; skipped: number; failed: number }> {
  const result = { voided: 0, noop: 0, skipped: 0, failed: 0 };

  for (const tradeId of tradeIds) {
    const shortId = String(tradeId).slice(0, 8);
    try {
      const { data, error } = await db.rpc('rpc_void_tax_for_trade', {
        p_trade_id: tradeId,
        p_reason: 'qa_harness_cancelled',
      });

      if (error) {
        result.failed += 1;
        console.log(`   ⚠️  Tax void failed for ${shortId}…: ${error.message}`);
        continue;
      }
      if (data?.success === false) {
        if (data?.error?.code === 'INVALID_STATE') {
          result.skipped += 1;
        } else {
          result.failed += 1;
          console.log(`   ⚠️  Tax void error for ${shortId}…: ${data?.error?.code || 'unknown'}`);
        }
        continue;
      }
      if (data?.data?.action === 'noop') {
        result.noop += 1;
        continue;
      }
      result.voided += 1;
    } catch (err) {
      result.failed += 1;
      console.log(`   ⚠️  Tax void threw for ${shortId}…: ${(err as Error)?.message || err}`);
    }
  }

  return result;
}

// ─── Test accounts (match seed-staging-data.ts) ──────────────────────────
const BUYER_ID = '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer
const SELLER_ID = '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller

// Test personas that add to carts (fixed UUIDs from seed-staging-data.ts —
// signupTestUser creates auth users with these exact ids via admin.createUser).
// Dev Task 44 item 5: the reset also clears their cart_items so a run never
// starts with months-old stale cart rows (QA had to remove them via the UI).
const CART_USER_IDS = [
  BUYER_ID, // test-buyer
  'a1234567-0000-0000-0000-000000000001', // test-free
  'a1234567-0000-0000-0000-000000000003', // test-buyer-2
  'a1234567-0000-0000-0000-000000000004', // test-buyer-3
];

async function main() {
  console.log('🧹 CLEANUP TEST TRADES');
  console.log(`   Target: ${SUPABASE_URL}`);
  console.log('');

  // Dev Task 44 item 5: clear stale cart_items for test personas FIRST so it
  // runs even when there are no pending trades to clean up. Service role
  // bypasses RLS; `.select('id')` returns the deleted rows so we can count.
  const { data: deletedCarts, error: cartError } = await admin
    .from('cart_items')
    .delete()
    .select('id')
    .in('user_id', CART_USER_IDS);

  if (cartError) {
    console.error(`   ⚠️  Failed to clear cart items: ${cartError.message}`);
  } else {
    const count = deletedCarts?.length ?? 0;
    if (count > 0) {
      console.log(`   🧺 Cleared ${count} stale cart item(s) for test personas.`);
    } else {
      console.log('   🧺 No stale cart items for test personas.');
    }
  }

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

  // FIX-Task-24 item 4 (2026-09-12): the raw cancel above never touches the tax
  // ledger, so void it here — otherwise each run leaves `tax_status='quoted'`
  // residue behind on a cancelled trade (harness residue, not a product defect).
  const tax = await voidTaxForTrades(admin, tradeIds);
  console.log(
    `   🧾 Tax void: ${tax.voided} voided · ${tax.noop} no tax record · ${tax.skipped} already voided/unvoidable · ${tax.failed} failed`
  );
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
