/**
 * DEV-TASK-51 (2026-08-29) — Item 1: QA offer-fixture reset script.
 *
 * The #1 cost driver in the last TRD run: stale pending offers + stale cart
 * rows accumulated across sessions and caused `MAX_PENDING_OFFERS` and
 * "already in active trade" collisions, each costing a diagnosis-and-cleanup
 * cycle. This script resets the QA buyer personas' offer/cart fixtures in ONE
 * call, and is safely re-runnable at the start of ANY QA session touching
 * offers or bundles.
 *
 * What it does (all service-role, no UI):
 *   1. Deletes every `cart_items` row for the QA buyer personas
 *      (test-buyer, test-free, test-buyer-2, test-buyer-3) — stale bundle carts
 *      from previous runs never leak into a fresh one.
 *   2. Cancels every pending / payment_failed trade where the BUYER is one of
 *      the QA buyer personas (any seller). The direct status UPDATE fires the
 *      same DB triggers the app's cancel path uses (e.g. `fn_release_sp_on_cancel`),
 *      so reserved SP / ledger / notification side effects run correctly.
 *   3. Resets the affected listings back to `available` so they can be re-used.
 *
 * This is the buyer-side counterpart to `npm run cleanup:trades` (which covers
 * test-buyer-as-buyer + test-seller-as-seller for the per-seller cap tests).
 * It intentionally clears ALL QA buyers so a run can never start mid-collision.
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:reset-offer-fixtures            # full reset for all QA buyers
 *   npm run qa:reset-offer-fixtures -- --persona test-buyer   # one persona
 *   npm run qa:reset-offer-fixtures -- --dry-run              # preview only
 *
 * Env: reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from p2p-kids-marketplace/.env
 *      (or .env.staging), same convention as the other QA/seed scripts.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load project env (order matters: .env.staging is loaded second so it can
// override — mirrors cleanup-test-trades.ts).
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_PERSONA = (() => {
  const idx = process.argv.indexOf('--persona');
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * QA buyer personas whose offer/cart fixtures get reset. Fixed UUIDs match
 * `TEST_USERS` in scripts/seed-staging-data.ts (auth users are created with
 * these exact ids via admin.createUser).
 */
const QA_BUYER_PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test' },
};

function log(...a) {
  console.log('[qa:reset-offer-fixtures]', ...a);
}

async function main() {
  let personas = Object.entries(QA_BUYER_PERSONAS);
  if (ONLY_PERSONA) {
    if (!QA_BUYER_PERSONAS[ONLY_PERSONA]) {
      console.error(`❌ Unknown persona '${ONLY_PERSONA}'. Known: ${Object.keys(QA_BUYER_PERSONAS).join(', ')}`);
      process.exit(2);
    }
    personas = [[ONLY_PERSONA, QA_BUYER_PERSONAS[ONLY_PERSONA]]];
  }

  const buyerIds = personas.map(([, p]) => p.id);
  log(`Target: ${SUPABASE_URL}`);
  log(`Personas: ${personas.map(([n]) => n).join(', ')}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  // ── 1. Clear stale cart_items for the QA buyers ──────────────────────────
  // DRY-RUN SAFE: count first (SELECT) and only DELETE when not dry-running —
  // a dry-run must never mutate (this was a real bug on first version).
  const { count: cartCount, error: cartCountError } = await admin
    .from('cart_items')
    .select('id', { count: 'exact', head: true })
    .in('user_id', buyerIds);

  if (cartCountError) {
    log(`⚠️  Failed to read cart items: ${cartCountError.message}`);
  } else {
    log(cartCount && cartCount > 0 ? `🧺 ${cartCount} stale cart item(s) found.` : '🧺 No stale cart items.');
  }

  if (!DRY_RUN) {
    const { data: deletedCarts, error: cartError } = await admin
      .from('cart_items')
      .delete()
      .select('id')
      .in('user_id', buyerIds);

    if (cartError) {
      log(`⚠️  Failed to clear cart items: ${cartError.message}`);
    } else {
      const count = deletedCarts?.length ?? 0;
      log(count > 0 ? `🧺 Cleared ${count} stale cart item(s).` : '🧺 No stale cart items.');
    }
  }

  // ── 2. Fetch pending / payment_failed trades for the QA buyers ───────────
  const { data: trades, error: fetchError } = await admin
    .from('trades')
    .select('id, listing_id, status, buyer_id, seller_id')
    .in('buyer_id', buyerIds)
    .in('status', ['pending', 'payment_failed']);

  if (fetchError) {
    console.error(`❌ Failed to fetch trades: ${fetchError.message}`);
    process.exit(1);
  }

  if (!trades || trades.length === 0) {
    log('✅ No pending offers to cancel.');
    if (DRY_RUN) {
      log('DRY-RUN complete — nothing to do beyond cart clear.');
    } else {
      log('✅ RESET COMPLETE.');
    }
    return;
  }

  log(`📋 Found ${trades.length} pending offer(s):`);
  const tradeIds = [];
  const listingIds = new Set();
  for (const t of trades) {
    log(
      `   - ${t.id.slice(0, 8)}…  listing: ${String(t.listing_id).slice(0, 8)}…  buyer: ${String(t.buyer_id).slice(0, 8)}…  status: ${t.status}`
    );
    tradeIds.push(t.id);
    listingIds.add(t.listing_id);
  }

  if (DRY_RUN) {
    log(`DRY-RUN complete — would cancel ${tradeIds.length} offer(s) + reset ${listingIds.size} listing(s).`);
    return;
  }

  // ── 3. Cancel the offers (direct UPDATE fires the release triggers) ──────
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
    console.error(`❌ Failed to cancel trades: ${updateError.message}`);
    process.exit(1);
  }
  log(`✅ Cancelled ${tradeIds.length} offer(s).`);

  // ── 4. Reset affected listings back to available ────────────────────────
  const { error: resetError } = await admin
    .from('items')
    .update({ status: 'available', updated_at: new Date().toISOString() })
    .in('id', [...listingIds])
    .in('status', ['pending', 'sold', 'unavailable', 'paused']);

  if (resetError) {
    log(`⚠️  Failed to reset some listings: ${resetError.message}`);
  } else {
    log(`✅ Reset ${listingIds.size} listing(s) to available.`);
  }

  log('✅ RESET COMPLETE.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});
