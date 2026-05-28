/**
 * File: p2p-kids-marketplace/src/services/cartService.ts
 * MODULE-15.2 (CART-011..014): Cart service refactored to call DB RPCs.
 *
 * Backward-compatible exports preserved for trade-flow callers:
 *   - getCartItems(): CartWithDetails (items + sellerId + bundleId + subtotal)
 *   - addToCart({ listingId, sellerId, bundleId })
 *   - removeFromCart(cartItemId)
 *   - clearCart()
 *   - checkoutCart(...)
 *
 * New exports for MODULE-15.2:
 *   - getCartFull(): rich payload (active + saved carts + is_subscriber + max_sp_available)
 *   - saveCurrentCart()
 *   - switchToSavedCart(cartId)
 *   - validateCartForCheckout()
 *   - subscribeToCartChanges(userId, onChange)
 */

import { supabase } from '@/config/supabase';
import { getPlatformFeeCents } from '@/services/adminConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  listingId: string;
  sellerId: string;
  bundleId: string;
  addedAt: string;
  title?: string;
  price?: number;       // dollars (backward compat)
  imageUrl?: string;
  // CART-006 extras
  priceCents?: number;
  liveStatus?: string;
  acceptsSP?: boolean;
  sellerName?: string;
  maxSpAvailableCents?: number;
  cartId?: string;
  paymentPreference?: string;
}

export interface SavedCartSummary {
  cartId: string;
  sellerId: string | null;
  sellerName: string | null;
  itemCount: number;
  totalPriceCents: number;
  lastUpdated: string;
}

export interface CartWithDetails {
  items: CartItem[];
  sellerId: string | null;
  bundleId: string | null;
  subtotal: number;
  // CART-006 extras
  savedCarts?: SavedCartSummary[];
  isSubscriber?: boolean;
}

export interface CartValidationResult {
  ok: boolean;
  cartTotalCents: number;
  itemCount: number;
  sellerCount: number;
  minCartValueCents: number;
  errors: { code: string; message: string; details?: unknown }[];
}

export type CartResult<T> =
  | { success: true;  data: T; warning?: string }
  | { success: false; error: { code: string; message: string; details?: unknown }; warning?: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function unwrapRpc<T>(data: unknown, fnName: string): CartResult<T> {
  const payload = data as { success?: boolean; data?: T; error?: { code: string; message: string; details?: unknown } } | null;
  if (!payload) {
    return { success: false, error: { code: 'EMPTY_RESPONSE', message: `${fnName} returned no payload` } };
  }
  if (payload.success) {
    return { success: true, data: payload.data as T };
  }
  return {
    success: false,
    error: payload.error ?? { code: 'UNKNOWN_RPC_ERROR', message: `${fnName} failed` },
  };
}

// ─── CART-006: getCartItems (backward-compatible + extended) ───────────────────

export async function getCartItems(): Promise<CartResult<CartWithDetails>> {
  const { data, error } = await supabase.rpc('rpc_cart_get_items');
  if (error) {
    console.error('[cartService.getCartItems]', error);
    return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  }
  const wrapped = unwrapRpc<{
    active_cart_items: Record<string, unknown>[];
    saved_carts: Record<string, unknown>[];
    is_subscriber: boolean;
  }>(data, 'rpc_cart_get_items');
  if (!wrapped.success) return wrapped as CartResult<CartWithDetails>;

  const activeRows = wrapped.data.active_cart_items ?? [];
  const items: CartItem[] = activeRows.map((r) => {
    const priceCents = (r['live_price_cents'] as number) ?? (r['snapshot_price_cents'] as number) ?? 0;
    return {
      id:                  r['cart_item_id'] as string,
      listingId:           r['listing_id'] as string,
      sellerId:            r['seller_id'] as string,
      bundleId:            r['cart_id'] as string,
      cartId:              r['cart_id'] as string,
      addedAt:             r['added_at'] as string,
      title:               (r['live_title'] as string) ?? (r['snapshot_title'] as string),
      price:               priceCents / 100,
      priceCents,
      imageUrl:            (r['snapshot_image_url'] as string) ?? undefined,
      liveStatus:          r['live_status'] as string,
      acceptsSP:           r['live_accepts_sp'] as boolean,
      sellerName:          r['seller_name'] as string | undefined,
      maxSpAvailableCents: (r['max_sp_available'] as number) ?? 0,
      paymentPreference:   r['snapshot_payment_preference'] as string | undefined,
    };
  });

  const subtotal = items.reduce((sum, it) => sum + (it.price ?? 0), 0);
  const sellerId = items.length > 0 ? items[0].sellerId : null;
  const bundleId = items.length > 0 ? items[0].bundleId : null;

  const savedCarts: SavedCartSummary[] = (wrapped.data.saved_carts ?? []).map((s) => ({
    cartId:          s['cart_id'] as string,
    sellerId:        (s['seller_id'] as string) ?? null,
    sellerName:      (s['seller_name'] as string) ?? null,
    itemCount:       (s['item_count'] as number) ?? 0,
    totalPriceCents: (s['total_price_cents'] as number) ?? 0,
    lastUpdated:     s['last_updated'] as string,
  }));

  return {
    success: true,
    data: {
      items,
      sellerId,
      bundleId,
      subtotal,
      savedCarts,
      isSubscriber: wrapped.data.is_subscriber,
    },
  };
}

// ─── CART-003: addToCart ──────────────────────────────────────────────────────

export async function addToCart(params: {
  listingId: string;
  sellerId?: string;   // unused — server derives; kept for backward compat
  bundleId?: string;   // unused — server derives; kept for backward compat
}): Promise<CartResult<CartItem>> {
  const { data, error } = await supabase.rpc('rpc_cart_add_item', { p_listing_id: params.listingId });
  if (error) {
    console.error('[cartService.addToCart]', error);
    return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  }
  const wrapped = unwrapRpc<{ cart_item_id: string; cart_id: string; cart_item_count: number }>(
    data, 'rpc_cart_add_item');
  if (!wrapped.success) return wrapped as CartResult<CartItem>;

  return {
    success: true,
    data: {
      id:        wrapped.data.cart_item_id,
      listingId: params.listingId,
      sellerId:  params.sellerId ?? '',
      bundleId:  wrapped.data.cart_id,
      cartId:    wrapped.data.cart_id,
      addedAt:   new Date().toISOString(),
    },
  };
}

// ─── CART-004: removeFromCart (preserved: accepts cart_item_id) ───────────────

export async function removeFromCart(cartItemId: string): Promise<CartResult<{ removed: boolean }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: { code: 'UNAUTHENTICATED', message: 'User not logged in' } };

  // Look up listing_id from cart_items, then call RPC for idempotent behavior + trigger consistency
  const { data: row, error: fetchErr } = await supabase
    .from('cart_items')
    .select('listing_id')
    .eq('id', cartItemId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[cartService.removeFromCart] lookup', fetchErr);
    return { success: false, error: { code: 'LOOKUP_FAILED', message: fetchErr.message } };
  }
  if (!row) {
    return { success: true, data: { removed: false } };
  }

  const { data, error } = await supabase.rpc('rpc_cart_remove_item', { p_listing_id: row.listing_id });
  if (error) {
    console.error('[cartService.removeFromCart]', error);
    return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  }
  const wrapped = unwrapRpc<{ removed: number }>(data, 'rpc_cart_remove_item');
  if (!wrapped.success) return wrapped as CartResult<{ removed: boolean }>;
  return { success: true, data: { removed: wrapped.data.removed > 0 } };
}

// Helper: remove by listing_id directly
export async function removeListingFromCart(listingId: string): Promise<CartResult<{ removed: boolean }>> {
  const { data, error } = await supabase.rpc('rpc_cart_remove_item', { p_listing_id: listingId });
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const wrapped = unwrapRpc<{ removed: number }>(data, 'rpc_cart_remove_item');
  if (!wrapped.success) return wrapped as CartResult<{ removed: boolean }>;
  return { success: true, data: { removed: wrapped.data.removed > 0 } };
}

// ─── CART-005: clearCart ──────────────────────────────────────────────────────

export async function clearCart(cartId?: string): Promise<CartResult<{ cleared: boolean; clearedItems: number }>> {
  const { data, error } = await supabase.rpc('rpc_cart_clear', { p_cart_id: cartId ?? null });
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const wrapped = unwrapRpc<{ cleared_items: number }>(data, 'rpc_cart_clear');
  if (!wrapped.success) return wrapped as CartResult<{ cleared: boolean; clearedItems: number }>;
  return { success: true, data: { cleared: true, clearedItems: wrapped.data.cleared_items } };
}

// ─── CART-007: saveCurrentCart ────────────────────────────────────────────────

export async function saveCurrentCart(): Promise<CartResult<{ savedCartId: string; itemsSaved: number }>> {
  const { data, error } = await supabase.rpc('rpc_cart_save_current');
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const wrapped = unwrapRpc<{ saved_cart_id: string; items_saved: number }>(data, 'rpc_cart_save_current');
  if (!wrapped.success) return wrapped as CartResult<{ savedCartId: string; itemsSaved: number }>;
  return { success: true, data: { savedCartId: wrapped.data.saved_cart_id, itemsSaved: wrapped.data.items_saved } };
}

// ─── CART-008: switchToSavedCart ──────────────────────────────────────────────

export async function switchToSavedCart(cartId: string): Promise<CartResult<{ activeCartId: string; previouslyActiveCartId: string | null }>> {
  const { data, error } = await supabase.rpc('rpc_cart_switch_to_saved', { p_cart_id: cartId });
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const wrapped = unwrapRpc<{ active_cart_id: string; previously_active_cart_id: string | null }>(
    data, 'rpc_cart_switch_to_saved');
  if (!wrapped.success) return wrapped as CartResult<{ activeCartId: string; previouslyActiveCartId: string | null }>;
  return {
    success: true,
    data: {
      activeCartId:           wrapped.data.active_cart_id,
      previouslyActiveCartId: wrapped.data.previously_active_cart_id,
    },
  };
}

// ─── CART-009: validateCartForCheckout ────────────────────────────────────────

export async function validateCartForCheckout(): Promise<CartResult<CartValidationResult>> {
  const { data, error } = await supabase.rpc('rpc_cart_validate_for_checkout');
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  // This RPC returns success=false when errors exist but data is still meaningful
  const payload = data as {
    success: boolean;
    data: {
      cart_total_cents: number;
      item_count: number;
      seller_count: number;
      min_cart_value_cents: number;
      errors: { code: string; message: string; details?: unknown }[];
    };
  };
  return {
    success: true,
    data: {
      ok:                payload.success,
      cartTotalCents:    payload.data.cart_total_cents,
      itemCount:         payload.data.item_count,
      sellerCount:       payload.data.seller_count,
      minCartValueCents: payload.data.min_cart_value_cents,
      errors:            payload.data.errors ?? [],
    },
  };
}

// ─── CART-016: subscribeToCartChanges (realtime) ──────────────────────────────
// Subscribes to:
//   1. cart_items changes for this user (all events)
//   2. items table UPDATE for only the listing_ids currently in the active cart
//      (per-cart filter per spec R-10)
// Re-subscription is handled by the caller (CartScreen) when cartItems change.

export function subscribeToCartChanges(
  userId: string,
  onChange: () => void,
  listingIds?: string[],
): () => void {
  const channelName = `cart_items:user_${userId}:${(listingIds ?? []).join(',').slice(0, 64)}`;
  let channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${userId}` },
      () => onChange(),
    );

  // Only add items-table listener when we have specific listing IDs to watch
  if (listingIds && listingIds.length > 0) {
    // Supabase realtime supports `column=in.(val1,val2)` filter
    channel = channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'items',
        filter: `id=in.(${listingIds.join(',')})`,
      },
      () => onChange(),
    );
  } else {
    // Fallback: no listing IDs yet — subscribe to all items updates until cart loads
    channel = channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'items' },
      () => onChange(),
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── checkoutCart (backward compat — used by CartCheckoutScreen) ──────────────

export async function checkoutCart(params: {
  bundleId:       string;
  spAmountCents?: number;
  isSubscriber:   boolean;
  meetupNodeId?:  string;
}): Promise<CartResult<{ tradeIds: string[]; bundleId: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: { code: 'UNAUTHENTICATED', message: 'User not logged in' } };

  // CART-009: validate first
  const valid = await validateCartForCheckout();
  if (!valid.success) return valid as CartResult<{ tradeIds: string[]; bundleId: string }>;
  if (!valid.data.ok) {
    const first = valid.data.errors[0];
    return {
      success: false,
      error: {
        code: first?.code ?? 'VALIDATION_FAILED',
        message: first?.message ?? 'Cart validation failed',
        details: { errors: valid.data.errors },
      },
    };
  }

  const cartResult = await getCartItems();
  if (!cartResult.success) return cartResult as CartResult<{ tradeIds: string[]; bundleId: string }>;
  const { items, bundleId: cartBundleId } = cartResult.data;
  if (items.length === 0) {
    return { success: false, error: { code: 'EMPTY_CART', message: 'Your cart is empty' } };
  }
  const effectiveBundleId = cartBundleId ?? params.bundleId;

  // Fetch platform fee from admin_config (source of truth — no hardcoded values)
  const platformFeeCents = await getPlatformFeeCents(params.isSubscriber);

  const tradeIds: string[] = [];
  const failures: string[] = [];

  for (const item of items) {
    const itemPriceCents = item.priceCents ?? Math.round((item.price ?? 0) * 100);
    const itemSpCents = params.spAmountCents
      ? Math.floor((params.spAmountCents / items.length) / 100) * 100
      : 0;
    try {
      const { data: sess, error: authErr } = await supabase.auth.getSession();
      if (authErr || !sess.session) throw new Error('No session');
      const resp = await supabase.functions.invoke('create-trade-offer', {
        body: {
          listing_id:         item.listingId,
          offer_price_cents:  itemPriceCents,
          sp_amount_cents:    itemSpCents,
          platform_fee_cents: platformFeeCents,
          bundle_id:          effectiveBundleId,
          meetup_node_id:     params.meetupNodeId,
        },
      });
      if (resp.error || !resp.data?.success) {
        console.error('[cartService.checkoutCart] Offer failed:', resp.error ?? resp.data?.error);
        failures.push(item.listingId);
        continue;
      }
      tradeIds.push(resp.data.trade_id as string);
    } catch (e) {
      console.error('[cartService.checkoutCart] Unexpected error:', e);
      failures.push(item.listingId);
    }
  }

  if (failures.length > 0 && tradeIds.length === 0) {
    return { success: false, error: { code: 'ALL_OFFERS_FAILED', message: 'Failed to submit offers for all items' } };
  }

  await clearCart();
  return {
    success: true,
    data: { tradeIds, bundleId: effectiveBundleId },
    ...(failures.length > 0 ? { warning: `${failures.length} of ${items.length} offers failed` } : {}),
  };
}
