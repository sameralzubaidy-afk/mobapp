/**
 * DEV-TASK-51 (2026-08-29) — Item 6: bundle fixture generator.
 * DEV-TASK-77 (2026-08-31) — Item 7b: make bundles SP-eligible.
 *
 * Replaces the current 3×(open item + re-list elements + tap add) UI cycle per
 * bundle case with ONE call: create N same-seller items and preload a given
 * buyer's cart in a single step.
 *
 * What it does (all service-role, no UI):
 *   1. Resolves the buyer + seller personas (fixed UUIDs from
 *      scripts/seed-staging-data.ts).
 *   2. Creates N `available` + `approved` listings owned by the seller
 *      (honoring the available⇒approved invariant).
 *   3. Inserts all N into the buyer's ACTIVE cart as one bundle
 *      (single bundle_id, single cart_id) — the same shape the app's cart RPC
 *      produces, so CartCheckout / create-trade-offer treat it as a real bundle.
 *
 * DEV-TASK-77 item 7b (T06 fix): items now get a REAL category (Toys/Sports/
 * Books/Electronics) and `item_payment_preference: 'accept_sp'`, so the bundle
 * is genuinely SP-eligible at checkout (the per-item SP input renders). Before
 * this change category_id was NULL, which made CartCheckout skip the SP state
 * entirely (spState undefined → no SP input), blocking the 3-item Accept-SP
 * bundle scenario (T06).
 *
 * Run (from p2p-kids-marketplace/):
 *   npm run qa:create-bundle-fixture -- --buyer test-buyer --seller test-seller --count 3
 *   npm run qa:create-bundle-fixture -- --count 2                # defaults: buyer test-buyer, seller test-seller
 *   npm run qa:create-bundle-fixture -- --dry-run --count 3      # preview only
 *
 * Notes:
 *   - Buyer/seller are expected to be in the same node (the default pair is —
 *     test-buyer + test-seller are both in Norwalk Central) so the fixture is
 *     actually usable through checkout. Use `npm run qa:reset-offer-fixtures`
 *     to clear stale carts/offers before assembling a new case.
 *   - Item titles are prefixed `QA Bundle Fixture` so they are easy to spot /
 *     clean up. Re-running creates NEW items (no dedup by title) — call the
 *     reset script or delete them between cases if you need a clean slate.
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
  console.log('[qa:create-bundle-fixture]', ...a);
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
  const cartId = randomUUID();
  const price = 15 + Math.floor(Math.random() * 20); // $15–$34 each

  // DEV-TASK-77 item 7b: resolve a real category so the items are SP-eligible at
  // checkout (a NULL category_id makes CartCheckout skip the per-item SP state).
  // Rotate through the standing seed categories so a multi-item bundle doesn't
  // hit the same category's SP cap for every item.
  const CATEGORY_NAMES = ['Toys', 'Sports', 'Books', 'Electronics'];
  const { data: catRows, error: catError } = await admin
    .from('categories')
    .select('id, name')
    .in('name', CATEGORY_NAMES);
  if (catError || !catRows || catRows.length === 0) {
    console.error(
      `❌ Could not resolve categories for SP-eligible items: ${
        catError?.message ?? 'no category rows found'
      }`
    );
    process.exit(1);
  }
  const catIdByName = Object.fromEntries(catRows.map((c) => [c.name, c.id]));
  const categoryIds = CATEGORY_NAMES.map((n) => catIdByName[n]).filter(Boolean);
  if (categoryIds.length === 0) {
    console.error('❌ No valid category ids resolved — aborting.');
    process.exit(1);
  }

  if (DRY_RUN) {
    log(`DRY-RUN — would create ${COUNT} items for ${SELLER} and add them to ${BUYER}'s active cart as one bundle (bundle_id=${bundleId}).`);
    return;
  }

  // 1. Create N items for the seller (available + approved invariant).
  const itemIds = [];
  for (let i = 1; i <= COUNT; i += 1) {
    const { data, error } = await admin
      .from('items')
      .insert({
        seller_id: seller.id,
        title: `QA Bundle Fixture ${i} of ${COUNT} (${now.slice(0, 10)})`,
        description: `Dev Task 51 bundle fixture item ${i} of ${COUNT} for ${SELLER} (${BUYER} cart).`,
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

  // 2. Preload the buyer's ACTIVE cart with all N as one bundle.
  const rows = itemIds.map((listingId) => ({
    user_id: buyer.id,
    listing_id: listingId,
    seller_id: seller.id,
    bundle_id: bundleId,
    cart_id: cartId,
    cart_status: 'active',
    item_title: `QA Bundle Fixture ${listingId.slice(0, 6)}`,
    item_price_cents: price * 100,
    item_image_url: null,
    item_payment_preference: 'accept_sp',
    updated_at: now,
  }));

  const { error: cartError } = await admin.from('cart_items').insert(rows);
  if (cartError) {
    console.error(`❌ Failed to preload cart: ${cartError.message}`);
    process.exit(1);
  }
  log(`✅ Preloaded ${rows.length} cart item(s) into ${BUYER}'s active cart (cart_id=${cartId}).`);

  // 3. Verify — read back the cart.
  const { data: cart, error: readError } = await admin
    .from('cart_items')
    .select('id, listing_id, bundle_id, cart_id, cart_status')
    .eq('user_id', buyer.id)
    .eq('cart_status', 'active');

  if (readError) {
    log(`⚠️  Cart read-back failed: ${readError.message}`);
  } else {
    log(`✅ VERIFY — ${BUYER} active cart has ${cart?.length ?? 0} item(s).`);
  }

  log('✅ BUNDLE FIXTURE READY.');
  log(`   Item ids: ${itemIds.join(', ')}`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || err);
  process.exit(1);
});
