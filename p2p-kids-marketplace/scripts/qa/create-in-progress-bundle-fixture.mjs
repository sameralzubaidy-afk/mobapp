/**
 * DEV-TASK-77 (2026-08-31) — Item 7a: non-terminal bundle fixture generator.
 *
 * W09/W10 (admin "Force Cancel Entire Bundle") were BLOCKED in QA Task 15 because
 * no staging bundle has a non-terminal trade (all existing bundles were fully
 * terminal, so the Force Cancel button never rendered). This script provisions a
 * real bundle with ONE trade held in `in_progress` (the rest `completed`), which
 * makes the button render and gives the admin force-cancel path something to do.
 *
 * What it does (all service-role, no UI):
 *   1. Resolves buyer + seller personas (fixed UUIDs from
 *      scripts/seed-staging-data.ts).
 *   2. Creates N `available` + `approved` same-seller listings (real category,
 *      Accept-SP) honoring the available⇒approved invariant.
 *   3. Inserts N trades sharing ONE bundle_id: the first is `in_progress`, the
 *      rest are `completed`. sp_amount=0 + no payment intent, so the admin
 *      force-cancel RPC (admin_force_cancel_trade_db) has no SP/Stripe side
 *      effects to unwind — a clean cancel path.
 *
 * Why direct insert is safe (verified against triggers):
 *   - INSERT triggers on trades: trade_request_notification, set_offer_expires_at,
 *     reserve_sp_on_offer (no-op at sp_amount=0), coppa_check (test-buyer is 18+),
 *     sync_buyer_fee_state, analytics_trade_created, payments_sync_from_trade —
 *     all handle this insert gracefully.
 *   - `auto_complete_at` is left NULL, so the auto-complete cron
 *     (WHERE status='in_progress' AND auto_complete_at IS NOT NULL) never
 *     completes the fixture trade.
 *   - The admin force-cancel EF→RPC path (admin_force_cancel_trade_db) only
 *     refunds SP when sp_debit_ledger_entry_id is set, and only voids Stripe when
 *     stripe_payment_intent_id is set — both NULL here.
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:create-in-progress-bundle-fixture -- --buyer test-buyer --seller test-seller --count 2
 *   npm run qa:create-in-progress-bundle-fixture -- --count 3   # 1 in_progress + N-1 completed
 *   npm run qa:create-in-progress-bundle-fixture -- --dry-run --count 2
 *
 * After running, the admin portal bundle page is at:
 *   http://localhost:3001/trades/bundles/<bundleId>
 *
 * Notes:
 *   - Buyer/seller must be in the same node (default pair test-buyer/test-seller
 *     both in Norwalk Central).
 *   - Clean up with the reset script or by deleting the printed trade/listing ids.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging') });

const DRY_RUN = process.argv.includes('--dry-run');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const BUYER = argValue('buyer') || 'test-buyer';
const SELLER = argValue('seller') || 'test-seller';
const COUNT = Math.max(1, Math.min(10, Number(argValue('count') || 3)));

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Persona registry (fixed UUIDs match TEST_USERS in seed-staging-data.ts). */
const PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test' },
  'test-seller': { id: '14be337c-aad6-403f-bab2-ba1a7d80b666', email: 'test-seller@kidsmarketplace.test' },
  'test-seller-2': { id: 'a1234567-0000-0000-0000-000000000002', email: 'test-seller-2@kidsmarketplace.test' },
  'test-seller-3': { id: 'a1234567-0000-0000-0000-000000000012', email: 'test-seller-3@kidsmarketplace.test' },
};

function log(...a) {
  console.log('[qa:create-in-progress-bundle]', ...a);
}

async function main() {
  if (!PERSONAS[BUYER] || !PERSONAS[SELLER]) {
    console.error(`❌ Unknown persona. Known: ${Object.keys(PERSONAS).join(', ')}`);
    process.exit(2);
  }
  if (BUYER === SELLER) {
    console.error('❌ Buyer and seller must be different personas.');
    process.exit(2);
  }

  const buyer = PERSONAS[BUYER];
  const seller = PERSONAS[SELLER];
  log(`Target: ${SUPABASE_URL}`);
  log(`Buyer: ${BUYER} (${buyer.id})  Seller: ${SELLER} (${seller.id})  Count: ${COUNT}`);
  if (DRY_RUN) log('DRY-RUN — no mutations will be made.');

  const now = new Date().toISOString();
  const bundleId = randomUUID();
  const price = 15 + Math.floor(Math.random() * 20); // $15–$34 each

  // Resolve real categories so listings are valid (mirrors create-bundle-fixture).
  const CATEGORY_NAMES = ['Toys', 'Sports', 'Books', 'Electronics'];
  const { data: catRows, error: catError } = await admin
    .from('categories')
    .select('id, name')
    .in('name', CATEGORY_NAMES);
  if (catError || !catRows || catRows.length === 0) {
    console.error(`❌ Could not resolve categories: ${catError?.message ?? 'no rows'}`);
    process.exit(1);
  }
  const catIdByName = Object.fromEntries(catRows.map((c) => [c.name, c.id]));
  const categoryIds = CATEGORY_NAMES.map((n) => catIdByName[n]).filter(Boolean);

  if (DRY_RUN) {
    log(
      `DRY-RUN — would create ${COUNT} items for ${SELLER}, then ${COUNT} trades on one bundle ` +
        `(bundle_id=${bundleId}): first in_progress, rest completed. Admin page: /trades/bundles/${bundleId}`
    );
    return;
  }

  // 1. Create N items for the seller (available + approved invariant).
  const itemIds = [];
  for (let i = 1; i <= COUNT; i += 1) {
    const { data, error } = await admin
      .from('items')
      .insert({
        seller_id: seller.id,
        title: `QA InProgress Bundle Fixture ${i} of ${COUNT} (${now.slice(0, 10)})`,
        description: `Dev Task 77 non-terminal bundle fixture item ${i} of ${COUNT}.`,
        category_id: categoryIds[(i - 1) % categoryIds.length],
        condition: 'good',
        price,
        status: 'available',
        accepts_swap_points: true,
        approved_at: now,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`❌ Failed to create item ${i}: ${error.message}`);
      process.exit(1);
    }
    itemIds.push(data.id);
  }
  log(`✅ Created ${itemIds.length} item(s) for ${SELLER}.`);

  // 2. Insert trades on ONE bundle: first in_progress, rest completed.
  const createdBefore = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tradeIds = [];
  for (let i = 0; i < COUNT; i += 1) {
    const isInProgress = i === 0;
    const { data, error } = await admin
      .from('trades')
      .insert({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: itemIds[i],
        bundle_id: bundleId,
        status: isInProgress ? 'in_progress' : 'completed',
        cash_amount_cents: price * 100,
        sp_amount: 0,
        buyer_transaction_fee_cents: 0,
        tax_amount_cents: 0,
        created_at: createdBefore,
        updated_at: now,
        last_status_change_at: now,
        // Leave auto_complete_at NULL on the in_progress trade so the auto-
        // complete cron (filters auto_complete_at IS NOT NULL) never completes it.
        notes: 'fixture:W09-non-terminal-bundle',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`❌ Failed to create trade ${i + 1}: ${error.message}`);
      process.exit(1);
    }
    tradeIds.push(data.id);
  }
  log(
    `✅ Created ${COUNT} trade(s): 1 × in_progress + ${COUNT - 1} × completed on bundle ${bundleId}`
  );

  // 3. Verify — read back the bundle from the admin view. NOTE: the view's
  // trade-id column is `id` (verified via information_schema, 2026-08-31), NOT
  // `trade_id` — using the wrong name makes the read-back fail (harmless to the
  // fixture, but the verify step should succeed).
  const { data: bundleView, error: viewError } = await admin
    .from('admin_trades_view')
    .select('id, status, bundle_id')
    .eq('bundle_id', bundleId);
  if (viewError) {
    log(`⚠️  admin_trades_view read-back failed: ${viewError.message}`);
  } else {
    log(`✅ VERIFY — admin_trades_view shows ${bundleView?.length ?? 0} trade(s) for the bundle.`);
  }

  log('✅ NON-TERMINAL BUNDLE FIXTURE READY.');
  log(`   Admin bundle page: http://localhost:3001/trades/bundles/${bundleId}`);
  log(`   Bundle id: ${bundleId}`);
  log(`   Trade ids: ${tradeIds.join(', ')}`);
  log(`   Item ids:  ${itemIds.join(', ')}`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});
