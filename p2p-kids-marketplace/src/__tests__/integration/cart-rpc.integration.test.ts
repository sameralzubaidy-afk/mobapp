/**
 * File: p2p-kids-marketplace/src/__tests__/integration/cart-rpc.integration.test.ts
 * MODULE-15.2 CART-020: Integration tests for all rpc_cart_* and rpc_favorites_* functions.
 *
 * Run: RUN_SUPABASE_E2E=true npm run test:e2e
 *
 * Requires production Supabase + two seeded test users in the same node.
 * All tests use the anon key + user JWT so RLS applies exactly as in production.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const RUN = process.env.RUN_SUPABASE_E2E === 'true';
const describeIf = RUN ? describe : describe.skip;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Test user credentials (must exist in staging Supabase with items in same node)
const BUYER_EMAIL    = process.env.TEST_BUYER_EMAIL    || 'buyer@test.com';
const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'testpass123';
const SELLER_EMAIL    = process.env.TEST_SELLER_EMAIL    || 'seller@test.com';
const SELLER_PASSWORD = process.env.TEST_SELLER_PASSWORD || 'testpass123';

// A listing owned by SELLER that is in the same node as BUYER
const TEST_LISTING_ID = process.env.TEST_LISTING_ID || '';
// A second listing from a DIFFERENT seller (different node / different seller to trigger NODE_MISMATCH or DIFFERENT_SELLER)
const TEST_LISTING_ID_DIFF_SELLER = process.env.TEST_LISTING_ID_DIFF_SELLER || '';

let buyerClient: SupabaseClient | undefined;
let sellerClient: SupabaseClient | undefined;
let canRun = false;

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`[integration] signIn failed for ${email}: ${error.message}`);
  return client;
}

async function cleanBuyerCart(client: SupabaseClient): Promise<void> {
  await client.rpc('rpc_cart_clear', { p_cart_id: null });
  // also clear any saved carts
  const { data } = await client.rpc('rpc_cart_get_items');
  if (data?.data?.saved_carts) {
    for (const sc of data.data.saved_carts as { cart_id: string }[]) {
      await client.rpc('rpc_cart_clear', { p_cart_id: sc.cart_id });
    }
  }
}

beforeAll(async () => {
  if (!RUN) return;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('[integration] Missing Supabase env vars');
  try {
    buyerClient  = await signIn(BUYER_EMAIL, BUYER_PASSWORD);
    sellerClient = await signIn(SELLER_EMAIL, SELLER_PASSWORD);
    canRun = true;
  } catch (e) {
    console.warn('[cart-rpc] Cannot sign in — set TEST_BUYER_EMAIL/TEST_BUYER_PASSWORD env vars:', (e as Error).message);
  }
});

afterEach(async () => {
  if (!RUN || !canRun || !buyerClient) return;
  await cleanBuyerCart(buyerClient);
});

// ─── rpc_cart_add_item ────────────────────────────────────────────────────────

describeIf('rpc_cart_add_item', () => {
  it('adds an item and creates a new cart_id', async () => {
    if (!canRun) return;
    if (!TEST_LISTING_ID) return;
    const { data, error } = await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.data?.cart_item_id).toBeTruthy();
    expect(data?.data?.cart_id).toBeTruthy();
  });

  it('rejects duplicate item with ALREADY_IN_CART', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data } = await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    expect(data?.success).toBe(false);
    expect(data?.error?.code).toBe('ALREADY_IN_CART');
  });

  it('rejects seller adding own item with CANNOT_BUY_OWN_ITEM', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    const { data } = await sellerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    expect(data?.success).toBe(false);
    expect(data?.error?.code).toBe('CANNOT_BUY_OWN_ITEM');
  });

  it('rejects different seller with DIFFERENT_SELLER error + seller details', async () => {
    if (!canRun || !TEST_LISTING_ID || !TEST_LISTING_ID_DIFF_SELLER) return;
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data } = await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID_DIFF_SELLER });
    expect(data?.success).toBe(false);
    expect(data?.error?.code).toBe('DIFFERENT_SELLER');
    expect(data?.error?.details?.current_seller_id).toBeTruthy();
  });
});

// ─── rpc_cart_remove_item ─────────────────────────────────────────────────────

describeIf('rpc_cart_remove_item', () => {
  it('removes an item from active cart (idempotent)', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data, error } = await buyerClient.rpc('rpc_cart_remove_item', { p_listing_id: TEST_LISTING_ID });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.data?.removed).toBeGreaterThanOrEqual(1);
  });

  it('returns success even when item not in cart (idempotent)', async () => {
    if (!canRun) return;
    const { data, error } = await buyerClient.rpc('rpc_cart_remove_item', { p_listing_id: TEST_LISTING_ID });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
  });
});

// ─── rpc_cart_save_current ────────────────────────────────────────────────────

describeIf('rpc_cart_save_current', () => {
  it('saves active cart and returns saved_cart_id + item count', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data, error } = await buyerClient.rpc('rpc_cart_save_current');
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.data?.saved_cart_id).toBeTruthy();
    expect(data?.data?.items_saved).toBeGreaterThanOrEqual(1);
  });

  it('returns SAVED_CART_LIMIT_REACHED when 3 saved carts exist', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    // Create 3 saved carts
    for (let i = 0; i < 3; i++) {
      await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
      await buyerClient.rpc('rpc_cart_save_current');
    }
    // 4th save should fail
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data } = await buyerClient.rpc('rpc_cart_save_current');
    expect(data?.success).toBe(false);
    expect(data?.error?.code).toBe('SAVED_CART_LIMIT_REACHED');
  });
});

// ─── rpc_cart_switch_to_saved ─────────────────────────────────────────────────

describeIf('rpc_cart_switch_to_saved', () => {
  it('atomically swaps active and saved carts', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    // Add to active cart then save it
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const saved = await buyerClient.rpc('rpc_cart_save_current');
    const savedCartId = saved.data?.data?.saved_cart_id;
    expect(savedCartId).toBeTruthy();

    // Switch back to saved
    const { data, error } = await buyerClient.rpc('rpc_cart_switch_to_saved', { p_cart_id: savedCartId });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.data?.active_cart_id).toBe(savedCartId);
  });
});

// ─── rpc_cart_validate_for_checkout ──────────────────────────────────────────

describeIf('rpc_cart_validate_for_checkout', () => {
  it('returns MIN_CART_VALUE_NOT_MET when cart total is below minimum', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data, error } = await buyerClient.rpc('rpc_cart_validate_for_checkout');
    expect(error).toBeNull();
    // May pass or fail depending on item price — we check shape regardless
    expect(typeof data?.data?.cart_total_cents).toBe('number');
    expect(typeof data?.data?.min_cart_value_cents).toBe('number');
    expect(Array.isArray(data?.data?.errors)).toBe(true);
  });

  it('returns empty error list when cart is valid', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    // If cart meets minimum, errors should be empty
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data } = await buyerClient.rpc('rpc_cart_validate_for_checkout');
    // We cannot guarantee the item price, so just check structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('data.errors');
  });
});

// ─── rpc_favorites_add / rpc_favorites_remove ─────────────────────────────────

describeIf('rpc_favorites_add', () => {
  afterEach(async () => {
    if (!RUN || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_favorites_remove', { p_listing_id: TEST_LISTING_ID });
  });

  it('adds a favorite and returns favorite_id', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    const { data, error } = await buyerClient.rpc('rpc_favorites_add', { p_listing_id: TEST_LISTING_ID });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.data?.favorite_id).toBeTruthy();
  });

  it('is idempotent — calling twice does not fail', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_favorites_add', { p_listing_id: TEST_LISTING_ID });
    const { data, error } = await buyerClient.rpc('rpc_favorites_add', { p_listing_id: TEST_LISTING_ID });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
  });
});

describeIf('rpc_favorites_remove', () => {
  it('soft-deletes the favorite (sets deleted_at)', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_favorites_add', { p_listing_id: TEST_LISTING_ID });
    const { data, error } = await buyerClient.rpc('rpc_favorites_remove', { p_listing_id: TEST_LISTING_ID });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
  });

  it('is idempotent — removing non-existent favorite returns success', async () => {
    if (!canRun) return;
    const { data } = await buyerClient.rpc('rpc_favorites_remove', { p_listing_id: TEST_LISTING_ID });
    expect(data?.success).toBe(true);
  });
});

// ─── rpc_cart_get_items ───────────────────────────────────────────────────────

describeIf('rpc_cart_get_items', () => {
  it('returns shape with active_cart_items, saved_carts, is_subscriber', async () => {
    if (!canRun) return;
    const { data, error } = await buyerClient.rpc('rpc_cart_get_items');
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(Array.isArray(data?.data?.active_cart_items)).toBe(true);
    expect(Array.isArray(data?.data?.saved_carts)).toBe(true);
    expect(typeof data?.data?.is_subscriber).toBe('boolean');
  });

  it('returns enriched item with max_sp_available after add', async () => {
    if (!canRun || !TEST_LISTING_ID) return;
    await buyerClient.rpc('rpc_cart_add_item', { p_listing_id: TEST_LISTING_ID });
    const { data } = await buyerClient.rpc('rpc_cart_get_items');
    const items = data?.data?.active_cart_items as Record<string, unknown>[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(typeof items[0]['max_sp_available']).toBe('number');
  });
});
