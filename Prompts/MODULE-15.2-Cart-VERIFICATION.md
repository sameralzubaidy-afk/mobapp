# MODULE 15.2 VERIFICATION CHECKLIST: CART SYSTEM BACKEND

**Module:** Cart System Backend  
**Version:** 1.0  
**Total Tasks:** 20 (CART-001 → CART-020)  
**Spec Source:** `Prompts/MODULE-15.2-cart-system.md`  
**Status:** Ready for Verification

---

## PURPOSE

This checklist verifies that MODULE 15.2 (Cart System Backend) has been fully implemented per spec, with:
1. All database migrations applied and schema validated
2. All 10 RPC functions deployed, tested, and performant
3. TypeScript cart and favorites services built to spec
4. Mobile screens (CartScreen, ItemDetailScreen, FavoritesListScreen) integrated
5. Realtime subscriptions wired and updating correctly
6. Admin config for minimum cart value enforced
7. Analytics events firing for all cart actions
8. Unit tests and integration tests passing
9. All critical validation rules enforced end-to-end

---

## CRITICAL RULES — MUST VERIFY BEFORE SIGN-OFF

> Any ❌ here = BLOCK. Do not sign off until all pass.

| Rule | Requirement | Where to Check |
|---|---|---|
| **R-01** | Single-seller per active cart — block add if different seller | `rpc_cart_add_item`, `cartService.addToCart()` |
| **R-02** | Max 1 active + 3 saved carts per user | `enforce_cart_limits` trigger, `rpc_cart_save_current` |
| **R-03** | LRU eviction warning modal for 4th saved cart — NOT silent eviction | `CartScreen`, `rpc_cart_save_current` |
| **R-04** | Minimum cart value enforced at CHECKOUT (not add-to-cart) | `rpc_cart_validate_for_checkout`, `CartScreen` |
| **R-05** | Buyer cannot add own items to cart | `rpc_cart_add_item` (CANNOT_BUY_OWN_ITEM guard) |
| **R-06** | Item must be in buyer's active node | `rpc_cart_add_item` (NODE_MISMATCH guard) |
| **R-07** | No duplicate items in same cart | `rpc_cart_add_item` (ALREADY_IN_CART guard), DB UNIQUE constraint |
| **R-08** | Saved carts auto-expire after 7 days | `enforce_cart_limits` trigger / scheduled cleanup |
| **R-09** | SP pre-calculation at 50% max — NOT stored in cart | `rpc_cart_add_item`, `rpc_cart_get_items` |
| **R-10** | Realtime unavailability shown inline — NOT silent removal | `CartScreen` realtime subscription |

---

## PERFORMANCE TARGETS — MUST VERIFY

| Operation | Target | Test Method |
|---|---|---|
| Add to cart | < 300ms | RPC direct call with timing |
| Remove from cart | < 200ms | RPC direct call with timing |
| Get cart items | < 500ms | RPC direct call with timing |
| Validate for checkout | < 400ms | RPC direct call with timing |
| Realtime update latency | < 1 second | Supabase subscription test |

---

## PHASE 1: DATABASE FOUNDATION

---

### CART-001: Cart Items Table Schema

**Migration:** `supabase/migrations/20260508000001_create_cart_items_table.sql`

#### Table Structure
- [ ] `cart_items` table exists with all required columns: `id`, `user_id`, `cart_id`, `cart_status`, `seller_id`, `listing_id`, `item_title`, `item_price_cents`, `item_image_url`, `item_payment_preference`, `added_at`, `updated_at`
- [ ] `cart_status` CHECK constraint enforces `IN ('active', 'saved', 'deleted')`
- [ ] `UNIQUE(user_id, listing_id, cart_status)` constraint exists (prevents duplicate items per cart state)
- [ ] Foreign key: `user_id → auth.users(id) ON DELETE CASCADE`
- [ ] Foreign key: `seller_id → profiles(id) ON DELETE CASCADE`
- [ ] Foreign key: `listing_id → items(id) ON DELETE CASCADE`
- [ ] `updated_at` auto-update trigger attached

#### Indexes
- [ ] `idx_cart_items_user_id` on `user_id`
- [ ] `idx_cart_items_cart_id` on `cart_id`
- [ ] `idx_cart_items_listing_id` on `listing_id`
- [ ] `idx_cart_items_status` on `cart_status`
- [ ] `idx_cart_items_user_cart` on `(user_id, cart_id)`

#### RLS Policies
- [ ] RLS enabled on `cart_items`
- [ ] `cart_items_select_own` — authenticated user can SELECT own rows (`user_id = auth.uid()`)
- [ ] `cart_items_insert_own` — authenticated user can INSERT with `user_id = auth.uid()`
- [ ] `cart_items_update_own` — authenticated user can UPDATE own rows
- [ ] `cart_items_delete_own` — authenticated user can DELETE own rows
- [ ] `cart_items_service_role` — service role bypasses all RLS

#### Cart Limits Trigger
- [ ] `enforce_cart_limits()` trigger function exists
- [ ] Fires BEFORE INSERT on `cart_items`
- [ ] Raises exception when user already has 1 active cart and inserting another `active` item for a different `cart_id`
- [ ] Raises exception when user has 3 saved carts and inserting a 4th `saved` cart item
- [ ] Does NOT silently evict — returns error that surfaces to application layer

**Verification SQL:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cart_items' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'cart_items';

SELECT indexname FROM pg_indexes
WHERE tablename = 'cart_items';
```

---

### CART-002: Favorites Table Schema

**Migration:** `supabase/migrations/20260508000002_create_favorites_table.sql`

#### Table Structure
- [ ] `favorites` table exists with columns: `id`, `user_id`, `listing_id`, `created_at`, `deleted_at`
- [ ] `UNIQUE(user_id, listing_id)` constraint exists (prevents duplicate favorites)
- [ ] Foreign key: `user_id → auth.users(id) ON DELETE CASCADE`
- [ ] Foreign key: `listing_id → items(id) ON DELETE CASCADE`
- [ ] `deleted_at` column supports soft-delete pattern (nullable TIMESTAMPTZ)

#### Indexes
- [ ] `idx_favorites_user_id` on `user_id`
- [ ] `idx_favorites_listing_id` on `listing_id`
- [ ] `idx_favorites_created_at` on `created_at DESC`
- [ ] `idx_favorites_active` partial index on `(user_id, listing_id) WHERE deleted_at IS NULL`

#### RLS Policies
- [ ] RLS enabled on `favorites`
- [ ] `favorites_select_own` — authenticated user can SELECT own rows
- [ ] `favorites_insert_own` — authenticated user can INSERT own rows
- [ ] `favorites_update_own` — authenticated user can UPDATE (soft delete) own rows
- [ ] `favorites_service_role` — service role bypasses all RLS

**Verification SQL:**
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'favorites' AND table_schema = 'public';

SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'favorites';
```

---

## PHASE 2: RPC FUNCTIONS

---

### CART-003: RPC Function — Add Item to Cart

**Migration:** `supabase/migrations/20260508000003_rpc_cart_add_item.sql`

#### Function Existence & Signature
- [ ] `rpc_cart_add_item(p_listing_id uuid)` function exists
- [ ] Uses `SECURITY DEFINER` and calls `auth.uid()` internally
- [ ] Returns `JSONB` with `{success: boolean, data?: {...}, error?: {code, message}}`

#### Validation Guards (all must be present and return correct error codes)
- [ ] **UNAUTHENTICATED** — returns error if `auth.uid()` is null
- [ ] **ITEM_NOT_FOUND** — returns error if listing doesn't exist
- [ ] **ITEM_UNAVAILABLE** — returns error if `items.status != 'active'`
- [ ] **CANNOT_BUY_OWN_ITEM** — returns error if `seller_id = auth.uid()`
- [ ] **NODE_MISMATCH** — returns error if item's `node_id != buyer's active_node_id`
- [ ] **ALREADY_IN_CART** — returns error if item already in active cart
- [ ] **DIFFERENT_SELLER** — returns structured error with `current_seller_id` + `current_seller_name` when cart has items from different seller

#### Business Logic
- [ ] Creates new `cart_id` (UUID) when user has no active cart
- [ ] Reuses existing `cart_id` when adding to existing active cart
- [ ] `max_sp_available` calculated as 50% of `item_price_cents` (only when `payment_preference IN ('accept_sp', 'donate')`)
- [ ] `max_sp_available` = 0 for `cash_only` items
- [ ] Returns enriched cart item data including `max_sp_available` and `cart_id`

**Verification SQL:**
```sql
SELECT routine_name, routine_type FROM information_schema.routines
WHERE routine_name = 'rpc_cart_add_item' AND routine_schema = 'public';

-- Test: Add item (should succeed)
SELECT public.rpc_cart_add_item('valid-listing-uuid'::uuid);

-- Test: Add own item (should return CANNOT_BUY_OWN_ITEM)
SELECT public.rpc_cart_add_item('own-listing-uuid'::uuid);
```

---

### CART-004: RPC Function — Remove Item from Cart

**Migration:** `supabase/migrations/20260508000004_rpc_cart_remove_item.sql`

- [ ] `rpc_cart_remove_item(p_listing_id uuid)` function exists
- [ ] Only removes from ACTIVE cart (not saved carts)
- [ ] Returns `{success: true}` even if item wasn't in cart (idempotent)
- [ ] Uses `auth.uid()` — user can only remove from own cart
- [ ] Performance: < 200ms

---

### CART-005: RPC Function — Clear Cart

**Migration:** `supabase/migrations/20260508000005_rpc_cart_clear.sql`

- [ ] `rpc_cart_clear(p_cart_id uuid)` function exists
- [ ] Marks all items in cart as `cart_status = 'deleted'` (soft delete — NOT hard delete)
- [ ] Validates caller owns the cart (`user_id = auth.uid()`)
- [ ] Returns `{success: true, data: {deleted_count}}`

---

### CART-006: RPC Function — Get Cart Items

**Migration:** `supabase/migrations/20260508000006_rpc_cart_get_items.sql`

- [ ] `rpc_cart_get_items()` function exists (no parameters — uses `auth.uid()`)
- [ ] Returns ALL active cart items with enriched data from `items` table
- [ ] Includes fields: `cart_id`, `listing_id`, `item_title`, `item_price_cents`, `item_image_url`, `current_item_status`, `seller_id`, `seller_name`, `max_sp_available`, `added_at`
- [ ] `current_item_status` reflects LIVE status from `items` table (not just snapshot)
- [ ] Items marked as unavailable are still returned (for UI warning display) — NOT silently dropped
- [ ] Also returns `saved_carts` array with summary per saved cart (cart_id, seller_name, item_count, total_value)
- [ ] Performance: < 500ms

---

### CART-007: RPC Function — Save Current Cart

**Migration:** `supabase/migrations/20260508000007_rpc_cart_save_current.sql`

- [ ] `rpc_cart_save_current()` function exists
- [ ] Transitions active cart items from `cart_status = 'active'` → `'saved'`
- [ ] **Returns error (not silently evicts) when user already has 3 saved carts**
- [ ] Error code `SAVED_CART_LIMIT_REACHED` with count of existing saved carts
- [ ] Returns `{success: true, data: {cart_id, item_count}}` on success

---

### CART-008: RPC Function — Switch to Saved Cart

**Migration:** `supabase/migrations/20260508000008_rpc_cart_switch.sql`

- [ ] `rpc_cart_switch_to_saved(p_saved_cart_id uuid)` function exists
- [ ] Atomically: current active → saved, target saved → active (single transaction)
- [ ] Validates `p_saved_cart_id` belongs to calling user
- [ ] Validates target cart has `cart_status = 'saved'`
- [ ] Returns `{success: true, data: {new_active_cart_id, old_active_cart_id}}`

---

### CART-009: RPC Function — Validate for Checkout

**Migration:** `supabase/migrations/20260508000009_rpc_cart_validate.sql`

- [ ] `rpc_cart_validate_for_checkout()` function exists
- [ ] Checks cart total >= `admin_config.min_cart_value_cents` (default 2000 = $20.00)
- [ ] Validates ALL cart items still have `items.status = 'active'`
- [ ] Validates seller still exists and is active
- [ ] Returns `{success: boolean, data: {is_valid, total_cents, min_cart_value_cents, unavailable_items[], validation_errors[]}}`
- [ ] Performance: < 400ms

---

### CART-010: RPC Functions — Favorites Add / Remove / Get

**Migration:** `supabase/migrations/20260508000010_rpc_favorites.sql`

#### rpc_favorites_add
- [ ] `rpc_favorites_add(p_listing_id uuid)` exists
- [ ] Validates item exists before adding
- [ ] On duplicate: returns success (idempotent — un-soft-deletes if previously deleted)
- [ ] Returns `{success: true, data: {favorite_id}}`

#### rpc_favorites_remove
- [ ] `rpc_favorites_remove(p_listing_id uuid)` exists
- [ ] Sets `deleted_at = NOW()` (soft delete)
- [ ] Idempotent — returns success even if not favorited

#### rpc_favorites_get
- [ ] `rpc_favorites_get()` exists
- [ ] Returns active favorites (WHERE `deleted_at IS NULL`)
- [ ] Includes live `current_item_status` from `items` table (sold, active, deleted)
- [ ] Includes item snapshot fields: title, price_cents, image_url, seller_name
- [ ] Ordered by `created_at DESC`

---

## PHASE 3: TYPESCRIPT SERVICES

---

### CART-011: TypeScript Cart Service

**File:** `src/services/cart.ts`

#### Core Service Functions
- [ ] `addToCart(listingId: string): Promise<CartResult>` — calls `rpc_cart_add_item`
- [ ] `removeFromCart(listingId: string): Promise<void>` — calls `rpc_cart_remove_item`
- [ ] `clearCart(cartId: string): Promise<void>` — calls `rpc_cart_clear`
- [ ] `getCartItems(): Promise<CartData>` — calls `rpc_cart_get_items`
- [ ] `saveCurrentCart(): Promise<SaveCartResult>` — calls `rpc_cart_save_current`
- [ ] `switchToSavedCart(savedCartId: string): Promise<void>` — calls `rpc_cart_switch_to_saved`
- [ ] `validateForCheckout(): Promise<CheckoutValidation>` — calls `rpc_cart_validate_for_checkout`

#### Error Handling
- [ ] `DIFFERENT_SELLER` error surfaces `currentSellerName` for UI modal display
- [ ] `SAVED_CART_LIMIT_REACHED` error surfaces `savedCartCount` for eviction modal
- [ ] `ITEM_UNAVAILABLE` error surfaces reason for inline cart warning
- [ ] All RPC errors mapped to typed `CartError` type with `code` + `message`

#### TypeScript Types
- [ ] `CartItem` interface includes all fields from `rpc_cart_get_items`
- [ ] `CartData` interface includes `activeCart: CartItem[]`, `savedCarts: SavedCartSummary[]`
- [ ] `CartError` interface with `code: CartErrorCode` (discriminated union)
- [ ] `CheckoutValidation` interface with `isValid`, `totalCents`, `unavailableItems`

---

### CART-012: TypeScript Favorites Service

**File:** `src/services/favorites.ts`

- [ ] `addFavorite(listingId: string): Promise<void>`
- [ ] `removeFavorite(listingId: string): Promise<void>`
- [ ] `getFavorites(): Promise<FavoriteItem[]>`
- [ ] `FavoriteItem` type includes `listing_id`, `item_title`, `item_price_cents`, `item_image_url`, `current_item_status`, `seller_name`
- [ ] Toggle helper: `toggleFavorite(listingId, isCurrentlyFavorited)` calls add or remove accordingly

---

## PHASE 4: MOBILE INTEGRATION

---

### CART-013: CartScreen Integration

**File:** `src/screens/CartScreen.tsx`

- [ ] Calls `cartService.getCartItems()` on mount
- [ ] Shows active cart items with live availability status
- [ ] Shows soft warning inline for unavailable items: "This item is no longer available"
- [ ] Shows checkout button **disabled** when total < `min_cart_value_cents`
- [ ] Shows warning banner when below minimum: "Add $X more to checkout"
- [ ] **Saved Carts section** renders all saved carts with item count and seller name
- [ ] "Switch Cart" button triggers `cartService.switchToSavedCart()` and reloads cart
- [ ] **Different-seller modal** shown when `DIFFERENT_SELLER` error returned — offers "Save & Start New" OR "Replace Cart" options
- [ ] **4th saved cart modal** shown when `SAVED_CART_LIMIT_REACHED` — shows which cart will be evicted (oldest), requires explicit user confirmation
- [ ] Checkout button routes to `CheckoutScreen` with `cartId` param

---

### CART-014: "Add to Cart" Button on ItemDetailScreen

**File:** `src/screens/ItemDetailScreen.tsx`

- [ ] "Add to Cart" button visible on all non-own active listings
- [ ] Button calls `cartService.addToCart(listingId)`
- [ ] On `DIFFERENT_SELLER` error: shows modal with current seller name and options
- [ ] On `ALREADY_IN_CART` error: button changes to "View Cart" state
- [ ] On `ITEM_UNAVAILABLE` error: shows inline error message
- [ ] On success: button changes to "View Cart" state with cart count badge update
- [ ] Does NOT show "Add to Cart" for seller's own listings

---

### CART-015: Favorites List Screen

**File:** `src/screens/FavoritesListScreen.tsx`

- [ ] Screen displays all active favorites from `favoritesService.getFavorites()`
- [ ] Each item shows: image, title, price, seller name, availability badge
- [ ] Unavailable items (sold/deleted) shown with greyed overlay and "Sold" badge
- [ ] Heart/bookmark toggle calls `favoritesService.toggleFavorite()`
- [ ] "Add to Cart" button on each available item routes through same `addToCart` flow
- [ ] Empty state shown when no favorites
- [ ] Pull-to-refresh reloads favorites list
- [ ] Navigation: accessible from Profile tab / bottom nav

---

### CART-016: Realtime Cart Subscriptions

**File:** `src/screens/CartScreen.tsx` (subscription logic)

- [ ] Subscribes to `items` table changes for all `listing_id` values in active cart
- [ ] Filter: `items:id=in.(id1,id2,...)` Supabase realtime channel
- [ ] On `UPDATE` event: updates item availability status in cart UI immediately
- [ ] On `DELETE` event: marks item as deleted/unavailable in cart UI
- [ ] Shows inline warning: "This item is no longer available" without removing the row
- [ ] Subscription cleaned up on component unmount (`return () => supabase.removeChannel(channel)`)
- [ ] Re-subscribes when cart items change (new item added or removed)

---

## PHASE 5: ADMIN CONFIG & ANALYTICS

---

### CART-017: Admin Config — Minimum Cart Value

**Migration / Admin File:** `supabase/migrations/20260508000017_admin_config_cart.sql`, `p2p-kids-admin/src/app/settings/page.tsx`

- [ ] `admin_config.min_cart_value_cents INTEGER NOT NULL DEFAULT 2000` column exists
- [ ] CHECK constraint: `min_cart_value_cents >= 0`
- [ ] Admin settings UI shows "Minimum Cart Value ($)" field
- [ ] Admin can update value in cents (displayed as dollars in UI: 2000 → "$20.00")
- [ ] `rpc_cart_validate_for_checkout` reads this value live (no caching)

---

### CART-018: Analytics Events — Cart Actions

**File:** `src/services/analytics.ts` (or integrated into cart service)

- [ ] `cart_item_added` event fires with `{listing_id, seller_id, item_price_cents, cart_total_items}`
- [ ] `cart_item_removed` event fires with `{listing_id, reason}`
- [ ] `cart_saved` event fires when cart moved to saved state
- [ ] `cart_switched` event fires when switching between saved carts
- [ ] `cart_checkout_initiated` event fires when checkout starts (cart was valid)
- [ ] `cart_checkout_blocked` event fires when checkout blocked (includes reason: below_min / unavailable_item)
- [ ] `favorite_added` event fires with `{listing_id}`
- [ ] `favorite_removed` event fires with `{listing_id}`

---

## PHASE 6: TESTING

---

### CART-019: Unit Tests — Cart Service

**File:** `src/__tests__/cart.service.test.ts`

- [ ] Test file exists and all tests pass (`npm test -- --testPathPattern=cart.service`)
- [ ] `addToCart` — success case: item added, correct data returned
- [ ] `addToCart` — DIFFERENT_SELLER error: modal data returned correctly
- [ ] `addToCart` — CANNOT_BUY_OWN_ITEM error: error code returned
- [ ] `addToCart` — ITEM_UNAVAILABLE error: error code returned
- [ ] `getCartItems` — returns cart with availability status per item
- [ ] `validateForCheckout` — below minimum: returns `isValid: false` with correct amounts
- [ ] `validateForCheckout` — unavailable item: returns list of unavailable items
- [ ] `saveCurrentCart` — 3 saved carts: returns SAVED_CART_LIMIT_REACHED
- [ ] All service functions have TypeScript types that pass `tsc --noEmit`

---

### CART-020: Integration Tests — Cart RPC Functions

**File:** `src/__tests__/cart-rpc.integration.test.ts`

- [ ] Test file exists and all tests pass
- [ ] `rpc_cart_add_item` — full flow: create cart, add item, verify DB state
- [ ] `rpc_cart_add_item` — single-seller enforcement: second seller rejected with correct error
- [ ] `rpc_cart_add_item` — duplicate prevention: same item twice → ALREADY_IN_CART
- [ ] `rpc_cart_save_current` — saves cart, creates new active cart correctly
- [ ] `rpc_cart_switch_to_saved` — atomic swap: active ↔ saved correctly
- [ ] `rpc_cart_validate_for_checkout` — min value enforcement works
- [ ] `rpc_favorites_add` — idempotent: calling twice doesn't fail
- [ ] `rpc_favorites_remove` — soft delete: `deleted_at` set, not hard deleted

---

## SIGN-OFF CHECKLIST

Before marking MODULE 15.2 complete, verify ALL of the following:

### Database
- [ ] All 2 migrations applied to live Supabase project (`drntwgporzabmxdqykrp`)
- [ ] RLS enabled on `cart_items` and `favorites`
- [ ] All RPC functions deployed (10 functions total)
- [ ] `enforce_cart_limits` trigger active

### Critical Business Rules
- [ ] Single-seller per cart enforced at RPC level (R-01)
- [ ] Max 3 saved carts + eviction modal implemented (R-02, R-03)
- [ ] Min cart value enforced at checkout only (R-04)
- [ ] Own-item add blocked (R-05)
- [ ] Node isolation enforced (R-06)
- [ ] Duplicate prevention active (R-07)

### Mobile
- [ ] CartScreen shows saved carts panel
- [ ] "Add to Cart" works from ItemDetailScreen
- [ ] FavoritesListScreen accessible
- [ ] Realtime updates work end-to-end

### Quality Gates
- [ ] TypeScript: `npx tsc --noEmit` passes with zero errors
- [ ] ESLint: `npx eslint src/` passes
- [ ] Unit tests: all CART-019 tests pass
- [ ] Integration tests: all CART-020 tests pass
- [ ] Performance targets met for all 5 operations

---

**Verification Sign-off**

| Area | Verifier | Date | Status |
|------|----------|------|--------|
| Database migrations | | | ⬜ |
| RPC functions | | | ⬜ |
| TypeScript services | | | ⬜ |
| Mobile screens | | | ⬜ |
| Realtime subscriptions | | | ⬜ |
| Tests passing | | | ⬜ |
| Performance targets | | | ⬜ |
