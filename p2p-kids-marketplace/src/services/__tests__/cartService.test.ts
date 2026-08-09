/**
 * File: p2p-kids-marketplace/src/services/__tests__/cartService.test.ts
 * MODULE-15.2 CART-019: Unit tests for cartService (RPC-based).
 *
 * Mocks supabase.rpc() to validate that each exported function:
 *   1. Calls the correct rpc_cart_* function with correct params
 *   2. Maps RPC payload to typed CartResult correctly
 *   3. Surfaces RPC errors as structured failures
 */

import {
  getCartItems,
  addToCart,
  removeFromCart,
  removeListingFromCart,
  clearCart,
  saveCurrentCart,
  switchToSavedCart,
  validateCartForCheckout,
  buildCheckoutWarning,
  buildSkippedItemsCopy,
} from '../cartService';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'user-123' } },
});

const mockChainable = {
  eq: jest.fn(),
  maybeSingle: jest.fn(),
  select: jest.fn(),
};
mockChainable.select.mockReturnValue(mockChainable);
mockChainable.eq.mockReturnValue(mockChainable);
mockChainable.maybeSingle.mockResolvedValue({ data: { listing_id: 'L-1' }, error: null });

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    rpc: (fn: string, params?: unknown) => mockRpc(fn, params),
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    }),
    removeChannel: () => undefined,
    from: () => mockChainable,
  },
}));

beforeEach(() => {
  mockRpc.mockReset();
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ok<T>(data: T) {
  return { data: { success: true, data }, error: null };
}
function fail(code: string, message: string, details?: unknown) {
  return { data: { success: false, error: { code, message, details } }, error: null };
}

// ─── getCartItems ──────────────────────────────────────────────────────────────

describe('cartService.getCartItems', () => {
  it('maps active cart + saved carts + subscriber flag', async () => {
    mockRpc.mockResolvedValueOnce(
      ok({
        active_cart_items: [
          {
            cart_item_id: 'CI-1',
            listing_id: 'L-1',
            seller_id: 'S-1',
            cart_id: 'C-1',
            added_at: '2026-05-28T00:00:00Z',
            live_title: 'Trike',
            live_price_cents: 4500,
            snapshot_image_url: 'http://img/1.jpg',
            live_status: 'available',
            live_accepts_sp: true,
            seller_name: 'Alice',
            max_sp_available: 2250,
            snapshot_payment_preference: 'accepts_sp',
          },
        ],
        saved_carts: [
          {
            cart_id: 'C-saved-1',
            seller_id: 'S-2',
            seller_name: 'Bob',
            item_count: 2,
            total_price_cents: 8000,
            last_updated: '2026-05-27T00:00:00Z',
          },
        ],
        is_subscriber: true,
      })
    );

    const r = await getCartItems();
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_get_items', undefined);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.items).toHaveLength(1);
    expect(r.data.items[0]).toMatchObject({
      id: 'CI-1',
      listingId: 'L-1',
      sellerId: 'S-1',
      price: 45,
      priceCents: 4500,
      maxSpAvailableCents: 2250,
      acceptsSP: true,
    });
    expect(r.data.savedCarts).toHaveLength(1);
    expect(r.data.savedCarts?.[0]).toMatchObject({
      cartId: 'C-saved-1',
      itemCount: 2,
      totalPriceCents: 8000,
    });
    expect(r.data.isSubscriber).toBe(true);
    expect(r.data.subtotal).toBe(45);
  });

  it('returns structured error when RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const r = await getCartItems();
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('RPC_FAILED');
  });
});

// ─── addToCart ────────────────────────────────────────────────────────────────

describe('cartService.addToCart', () => {
  it('calls rpc_cart_add_item with p_listing_id', async () => {
    mockRpc.mockResolvedValueOnce(ok({ cart_item_id: 'CI-2' }));
    const r = await addToCart({ listingId: 'L-9' });
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_add_item', { p_listing_id: 'L-9' });
    expect(r.success).toBe(true);
  });

  it('surfaces DIFFERENT_SELLER error with details', async () => {
    mockRpc.mockResolvedValueOnce(
      fail('DIFFERENT_SELLER', 'Cart has items from another seller', {
        current_seller_id: 'S-1',
        current_seller_name: 'Alice',
      })
    );
    const r = await addToCart({ listingId: 'L-9' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('DIFFERENT_SELLER');
    expect((r.error.details as { current_seller_name: string }).current_seller_name).toBe('Alice');
  });

  it('surfaces ALREADY_IN_CART', async () => {
    mockRpc.mockResolvedValueOnce(fail('ALREADY_IN_CART', 'Item already in your cart'));
    const r = await addToCart({ listingId: 'L-9' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('ALREADY_IN_CART');
  });

  it('surfaces NODE_MISMATCH', async () => {
    mockRpc.mockResolvedValueOnce(fail('NODE_MISMATCH', 'Item is in a different node'));
    const r = await addToCart({ listingId: 'L-9' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('NODE_MISMATCH');
  });

  it('surfaces ITEM_UNAVAILABLE', async () => {
    mockRpc.mockResolvedValueOnce(fail('ITEM_UNAVAILABLE', 'Listing is not available'));
    const r = await addToCart({ listingId: 'L-9' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('ITEM_UNAVAILABLE');
  });

  it('surfaces CANNOT_BUY_OWN_ITEM', async () => {
    mockRpc.mockResolvedValueOnce(
      fail('CANNOT_BUY_OWN_ITEM', 'You cannot add your own listing to cart')
    );
    const r = await addToCart({ listingId: 'L-own' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('CANNOT_BUY_OWN_ITEM');
  });
});

// ─── removeFromCart / removeListingFromCart ────────────────────────────────────

describe('cartService.removeFromCart', () => {
  it('looks up listing_id by cartItemId then calls rpc_cart_remove_item', async () => {
    mockRpc.mockResolvedValueOnce(ok({ removed: 1 }));
    const r = await removeFromCart('CI-99');
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_remove_item', { p_listing_id: 'L-1' });
    expect(r.success).toBe(true);
  });
});

describe('cartService.removeListingFromCart', () => {
  it('passes listingId directly', async () => {
    mockRpc.mockResolvedValueOnce(ok({ removed: 1 }));
    const r = await removeListingFromCart('L-77');
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_remove_item', { p_listing_id: 'L-77' });
    expect(r.success).toBe(true);
  });
});

// ─── clearCart ────────────────────────────────────────────────────────────────

describe('cartService.clearCart', () => {
  it('calls rpc_cart_clear with NULL by default (active cart)', async () => {
    mockRpc.mockResolvedValueOnce(ok({ cleared: 3 }));
    await clearCart();
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_clear', { p_cart_id: null });
  });

  it('passes p_cart_id for saved cart deletion', async () => {
    mockRpc.mockResolvedValueOnce(ok({ cleared: 2 }));
    await clearCart('C-saved-1');
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_clear', { p_cart_id: 'C-saved-1' });
  });
});

// ─── saveCurrentCart ──────────────────────────────────────────────────────────

describe('cartService.saveCurrentCart', () => {
  it('calls rpc_cart_save_current and returns saved cart_id', async () => {
    mockRpc.mockResolvedValueOnce(ok({ cart_id: 'C-1' }));
    const r = await saveCurrentCart();
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_save_current', undefined);
    expect(r.success).toBe(true);
  });

  it('surfaces SAVED_CART_LIMIT_REACHED', async () => {
    mockRpc.mockResolvedValueOnce(
      fail('SAVED_CART_LIMIT_REACHED', 'You can only save up to 3 carts')
    );
    const r = await saveCurrentCart();
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('SAVED_CART_LIMIT_REACHED');
  });
});

// ─── switchToSavedCart ────────────────────────────────────────────────────────

describe('cartService.switchToSavedCart', () => {
  it('calls rpc_cart_switch_to_saved with p_cart_id', async () => {
    mockRpc.mockResolvedValueOnce(ok({ activated_cart_id: 'C-saved-1' }));
    const r = await switchToSavedCart('C-saved-1');
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_switch_to_saved', { p_cart_id: 'C-saved-1' });
    expect(r.success).toBe(true);
  });
});

// ─── validateCartForCheckout ──────────────────────────────────────────────────

describe('cartService.validateCartForCheckout', () => {
  it('returns ok=true when cart is valid', async () => {
    mockRpc.mockResolvedValueOnce(
      ok({
        ok: true,
        cart_total_cents: 5000,
        item_count: 2,
        seller_count: 1,
        min_cart_value_cents: 2000,
        errors: [],
      })
    );
    const r = await validateCartForCheckout();
    expect(mockRpc).toHaveBeenCalledWith('rpc_cart_validate_for_checkout', undefined);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.ok).toBe(true);
    expect(r.data.minCartValueCents).toBe(2000);
  });

  it('returns ok=false with MIN_CART_VALUE_NOT_MET when below threshold', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        data: {
          cart_total_cents: 1500,
          item_count: 1,
          seller_count: 1,
          min_cart_value_cents: 2000,
          errors: [{ code: 'MIN_CART_VALUE_NOT_MET', message: 'Below minimum' }],
        },
      },
      error: null,
    });
    const r = await validateCartForCheckout();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.ok).toBe(false);
    expect(r.data.errors[0].code).toBe('MIN_CART_VALUE_NOT_MET');
  });
});

// ─── buildCheckoutWarning (PARTIAL-SUCCESS, 2026-08-01) ───────────────────────
// Covers the bundle-checkout case where one or more items already have an active
// trade (in_progress / pending) and the create-trade-offer Edge Function skips them.

describe('cartService.buildCheckoutWarning', () => {
  const items = [
    { listingId: 'L-1', title: 'Trike' },
    { listingId: 'L-2', title: 'Lego Set' },
    { listingId: 'L-3', title: 'Art Kit' },
  ];

  it('returns undefined when no items were skipped', () => {
    expect(buildCheckoutWarning([], items)).toBeUndefined();
    expect(buildCheckoutWarning(undefined as unknown as never, items)).toBeUndefined();
  });

  it('maps per-item Edge Function errors to structured skipped items with titles', () => {
    const warning = buildCheckoutWarning(
      [
        {
          item_id: 'L-2',
          code: 'DUPLICATE_OFFER',
          error: 'You already have an active offer on this item',
        },
      ],
      items
    );
    expect(warning).toBeDefined();
    if (!warning) return;
    expect(warning.code).toBe('PARTIAL_SUCCESS');
    expect(warning.skippedItems).toHaveLength(1);
    expect(warning.skippedItems[0]).toMatchObject({
      listingId: 'L-2',
      title: 'Lego Set',
      code: 'DUPLICATE_OFFER',
      message: 'You already have an active offer on this item',
    });
  });

  it('handles multiple skipped items and unknown title gracefully', () => {
    const warning = buildCheckoutWarning(
      [
        { item_id: 'L-1', code: 'DUPLICATE_OFFER', error: 'active offer' },
        { item_id: 'L-3', code: 'ITEM_NOT_AVAILABLE', error: 'no longer available' },
      ],
      items
    );
    expect(warning?.skippedItems).toHaveLength(2);
    expect(warning?.skippedItems[1]).toMatchObject({
      listingId: 'L-3',
      code: 'ITEM_NOT_AVAILABLE',
    });
  });
});

// ─── buildSkippedItemsCopy (PARTIAL-SUCCESS, 2026-08-01) ──────────────────────

describe('cartService.buildSkippedItemsCopy', () => {
  it('uses the active-trade copy when all skipped items are DUPLICATE_OFFER', () => {
    const copy = buildSkippedItemsCopy({
      code: 'PARTIAL_SUCCESS',
      skippedItems: [
        { listingId: 'L-2', title: 'Lego Set', code: 'DUPLICATE_OFFER', message: 'active offer' },
      ],
    });
    expect(copy.title).toBe('Already In an Active Trade');
    expect(copy.message).toContain('already part of an active trade');
    expect(copy.message).toContain('Lego Set');
    expect(copy.message).toContain('Your other offers were submitted successfully.');
  });

  it('uses the generic copy for mixed/non-duplicate reasons', () => {
    const copy = buildSkippedItemsCopy({
      code: 'PARTIAL_SUCCESS',
      skippedItems: [
        {
          listingId: 'L-3',
          title: 'Art Kit',
          code: 'ITEM_NOT_AVAILABLE',
          message: 'no longer available',
        },
      ],
    });
    expect(copy.title).toBe("Some Items Weren't Included");
    expect(copy.message).toContain("couldn't be added to this offer");
    expect(copy.message).toContain('Art Kit');
  });

  it('truncates listed titles at 3 with a +N more line', () => {
    const copy = buildSkippedItemsCopy({
      code: 'PARTIAL_SUCCESS',
      skippedItems: [
        { listingId: 'L-1', title: 'One', code: 'DUPLICATE_OFFER', message: 'active' },
        { listingId: 'L-2', title: 'Two', code: 'DUPLICATE_OFFER', message: 'active' },
        { listingId: 'L-3', title: 'Three', code: 'DUPLICATE_OFFER', message: 'active' },
        { listingId: 'L-4', title: 'Four', code: 'DUPLICATE_OFFER', message: 'active' },
        { listingId: 'L-5', title: 'Five', code: 'DUPLICATE_OFFER', message: 'active' },
      ],
    });
    expect(copy.message).toContain('• One');
    expect(copy.message).toContain('• Three');
    expect(copy.message).toContain('+2 more');
    expect(copy.message).not.toContain('• Four');
  });
});
