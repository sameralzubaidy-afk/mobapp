/**
 * DEV-TASK-72 verification prep (temp, disposable): preload test-buyer's ACTIVE
 * cart with TWO real test-seller listings as one bundle so the Trade Basket
 * (more-from-seller banner + bundle CTA) and the bundle checkout (SP input with
 * the unified "You can use up to N SP" ceiling) can be screenshotted before/after.
 *
 * Mirrors the insert shape of the sanctioned `qa:create-bundle-fixture` script
 * (single bundle_id, single cart_id, active cart_items rows). Item 1 = the most
 * expensive available Accept-SP categorized listing (so the SP cap input renders
 * in checkout); item 2 = one more available listing from the same seller.
 *
 * Non-destructive + reversible: run `npm run qa:reset-offer-fixtures` (or clear
 * the basket in-app) to restore the cleared-cart baseline.
 *
 * Run (from workspace root): node temp/dt72-cart-preload.mjs
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const p2pRoot = resolve(__dirname, '..', 'p2p-kids-marketplace');
dotenv.config({ path: resolve(p2pRoot, '.env') });
dotenv.config({ path: resolve(p2pRoot, '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUYER_ID = '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer
const SELLER_ID = '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller

function log(...a) { console.log('[dt72-cart-preload]', ...a); }

const now = new Date().toISOString();

// 1. Find item 1: most expensive available Accept-SP listing WITH a category.
const { data: spItems, error: spErr } = await admin
  .from('items')
  .select('id, title, price, accepts_swap_points, category_id, status')
  .eq('seller_id', SELLER_ID)
  .eq('status', 'available')
  .eq('accepts_swap_points', true)
  .not('category_id', 'is', null)
  .order('price', { ascending: false })
  .limit(5);
if (spErr) { console.error('❌ items query failed:', spErr.message); process.exit(1); }
if (!spItems || spItems.length === 0) {
  console.error('❌ No Accept-SP categorized available listing for test-seller. Seed a fixture first.');
  process.exit(1);
}
const item1 = spItems[0];
log(`Item 1 (Accept-SP): ${item1.title} $${item1.price} id=${item1.id} category=${item1.category_id}`);

// 2. Find item 2: another available listing from the same seller (any payment pref).
const { data: otherItems, error: otherErr } = await admin
  .from('items')
  .select('id, title, price, accepts_swap_points, status')
  .eq('seller_id', SELLER_ID)
  .eq('status', 'available')
  .neq('id', item1.id)
  .order('price', { ascending: false })
  .limit(5);
if (otherErr) { console.error('❌ items query 2 failed:', otherErr.message); process.exit(1); }
if (!otherItems || otherItems.length === 0) {
  console.error('❌ No second available listing for test-seller.');
  process.exit(1);
}
const item2 = otherItems[0];
log(`Item 2: ${item2.title} $${item2.price} id=${item2.id}`);

// 3. Insert both into test-buyer's active cart as one bundle.
const bundleId = randomUUID();
const cartId = randomUUID();
const rows = [item1, item2].map((it) => ({
  user_id: BUYER_ID,
  listing_id: it.id,
  seller_id: SELLER_ID,
  bundle_id: bundleId,
  cart_id: cartId,
  cart_status: 'active',
  item_title: it.title,
  item_price_cents: Math.round(it.price * 100),
  item_image_url: null,
  item_payment_preference: it.accepts_swap_points ? 'accept_sp' : 'cash_only',
  updated_at: now,
}));

const { error: insErr } = await admin.from('cart_items').insert(rows);
if (insErr) { console.error('❌ cart insert failed:', insErr.message); process.exit(1); }
log(`✅ Preloaded ${rows.length} item(s) into test-buyer's active cart (bundle_id=${bundleId})`);

// 4. Verify via the same RPC the app uses.
const { data: ver, error: verErr } = await admin.rpc('rpc_cart_get_items', { p_user_id: BUYER_ID });
if (verErr) {
  log(`⚠️  read-back RPC failed: ${verErr.message}`);
} else {
  const arr = Array.isArray(ver) ? ver : [ver];
  log(`✅ VERIFY — active cart has ${arr?.length ?? 0} item(s):`);
  for (const r of arr ?? []) {
    log(`   - ${r?.item_title} live_accepts_sp=${r?.live_accepts_sp} price=${r?.item_price_cents}`);
  }
}
log('✅ CART READY for before/after screenshots.');
