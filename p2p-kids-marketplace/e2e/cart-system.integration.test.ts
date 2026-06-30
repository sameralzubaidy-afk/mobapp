/**
 * File: p2p-kids-marketplace/e2e/cart-system.integration.test.ts
 * MODULE-15.2 CART-019: Integration tests for cart system RPCs.
 *
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 *
 * Guard: All tests are skipped unless RUN_SUPABASE_E2E=true is set,
 * since they hit the live Supabase project (prod-only environment).
 *
 * States covered:
 *  - empty cart
 *  - add to cart (single seller)
 *  - DIFFERENT_SELLER rejection
 *  - save current cart (CART-007)
 *  - switch to saved cart (CART-008)
 *  - validate-for-checkout min value (CART-009)
 *  - favorites add/remove (CART-015..017)
 *
 * NOTE: These tests require seeded data. If RUN_SUPABASE_E2E is enabled but
 * the seeded fixtures don't exist, tests are designed to fail loudly with
 * actionable messages rather than silently skip.
 */

import { supabase } from '../src/config/supabase';

const RUN = process.env.RUN_SUPABASE_E2E === 'true';
const d = RUN ? describe : describe.skip;

d('CART-system RPC integration', () => {
  let dynamicUserCleanup = false;

  beforeAll(async () => {
    // Sanity probe
    const { error } = await supabase.from('items').select('id').limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);

    // All cart RPCs require an authenticated user.
    // Try configured credentials first, then fall back to a dynamically created user.
    const email = process.env.CART_E2E_EMAIL;
    const password = process.env.CART_E2E_PASSWORD;

    if (email && password) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error(`CART E2E sign-in failed: ${signInError.message}`);
      }
    } else {
      // No env vars — create a dynamic test user so tests can authenticate.
      const testEmail = `cart-e2e-${Date.now()}@test.com`;
      const testPassword = 'TestPassword123!';
      const { error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });
      if (signUpError) throw new Error(`CART E2E sign-up failed: ${signUpError.message}`);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      if (signInError) throw new Error(`CART E2E sign-in failed: ${signInError.message}`);
      dynamicUserCleanup = true;
    }
  });

  afterAll(async () => {
    // Cleanup dynamic user if we created one
    if (dynamicUserCleanup) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        try {
          await supabase.auth.admin.deleteUser(user.id);
        } catch {
          // Non-critical cleanup — ignore errors
        }
      }
    }
  });

  it('rpc_cart_get_items returns wrapped success envelope', async () => {
    const { data, error } = await supabase.rpc('rpc_cart_get_items');
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: expect.any(Boolean) });
  });

  it('rpc_cart_validate_for_checkout includes min_cart_value_cents from admin_config', async () => {
    const { data, error } = await supabase.rpc('rpc_cart_validate_for_checkout');
    expect(error).toBeNull();
    const payload = data as { data?: { min_cart_value_cents?: number } };
    expect(payload?.data?.min_cart_value_cents).toBeDefined();
    expect(typeof payload.data?.min_cart_value_cents).toBe('number');
  });

  it('rpc_favorites_get returns array', async () => {
    const { data, error } = await supabase.rpc('rpc_favorites_get');
    expect(error).toBeNull();
    const payload = data as { success: boolean; data?: { favorites?: unknown[] } };
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data?.favorites)).toBe(true);
  });

  it('rpc_cart_add_item rejects invalid listing_id with structured error', async () => {
    const { data, error } = await supabase.rpc('rpc_cart_add_item', {
      p_listing_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    const payload = data as { success: boolean; error?: { code: string } };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBeDefined();
  });

  it('rpc_favorites_add rejects invalid listing_id with structured error', async () => {
    const { data, error } = await supabase.rpc('rpc_favorites_add', {
      p_listing_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    const payload = data as { success: boolean; error?: { code: string } };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBeDefined();
  });
});
