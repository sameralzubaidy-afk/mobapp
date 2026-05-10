# MODULE-15.2: CART SYSTEM BACKEND

**Version:** 1.0  
**Last Updated:** May 8, 2026  
**Status:** Ready for Implementation  
**Dependencies:** MODULE-03 (Authentication V2), MODULE-04 (Item Listing), MODULE-15.1 (UI Redesign - Cart Screens)

---

## OVERVIEW

### Cart System Purpose
Implement a robust, database-backed cart system that allows buyers to:
- Add multiple items to cart (one seller at a time)
- Save carts for later (up to 3 saved carts)
- Receive realtime updates when items become unavailable
- View and manage favorited items
- Checkout with minimum cart value enforcement

### Key Features
- **Single-Seller Cart**: Active cart can only contain items from one seller (enforced at add-to-cart)
- **Saved Carts**: Switch between sellers by saving current cart and starting new one
- **Favorites List**: Separate from cart — bookmark items for later viewing
- **Realtime Sync**: Items removed/sold are instantly reflected in cart
- **Admin-Configurable Minimum**: Minimum cart value set via `admin_config` table
- **SP Pre-Calculation**: Cart shows max available SP per item (actual selection in checkout)

---

## CART STRATEGY: OPTION A+ (SINGLE-SELLER WITH SAVED CARTS)

### How It Works

```
User browses Item 1 from Seller A
  ↓
Tap "Add to Cart"
  ↓
Cart created for Seller A (active cart)

User browses Item 2 from Seller A
  ↓
Tap "Add to Cart"
  ↓
Item added to existing cart ✅

User browses Item 3 from Seller B
  ↓
Tap "Add to Cart"
  ↓
System detects different seller
  ↓
Shows modal: "You have 2 items from Sarah in your cart. What would you like to do?"
  
  [Save & Start New Cart] - Moves current cart to "Saved", creates new cart for Seller B
  [Replace Cart] - Clears current cart, adds Item 3 from Seller B
  [Cancel] - Returns to item detail

User taps "Save & Start New Cart"
  ↓
Sarah's cart moved to saved_carts (status = 'saved')
New active cart created with Item 3 from Seller B
```

### Saved Carts Rules
- Max 1 active cart + 3 saved carts per user
- Auto-expire after 7 days
- Tap "Switch Cart" to swap active ↔ saved
- When switching: current active → saved, selected saved → active

---

## V2 ARCHITECTURE

### Database Schema

**Tables:**
1. `cart_items` - Active and saved cart items
2. `favorites` - User's favorited items (separate from cart)

**RPC Functions:**
1. `rpc_cart_add_item()` - Add item to cart with seller validation
2. `rpc_cart_remove_item()` - Remove item from cart
3. `rpc_cart_clear()` - Clear entire cart
4. `rpc_cart_save_current()` - Save active cart for later
5. `rpc_cart_switch_to_saved()` - Switch to a saved cart
6. `rpc_cart_get_items()` - Get cart items with enriched data
7. `rpc_cart_validate_for_checkout()` - Pre-checkout validation
8. `rpc_favorites_add()` - Add item to favorites
9. `rpc_favorites_remove()` - Remove from favorites
10. `rpc_favorites_get()` - Get user's favorited items

**Realtime Subscriptions:**
- Subscribe to `items` table changes for items in cart
- Auto-update cart UI when item becomes unavailable

---

## CRITICAL RULES (MANDATORY)

### Cart Validation Rules
- **MUST** enforce single-seller per active cart (block add if different seller)
- **MUST** prevent user from adding their own items to cart
- **MUST** verify item is available (`status = 'active'`)
- **MUST** verify item is in buyer's node
- **MUST** prevent duplicate items in same cart
- **MUST** validate item still exists before checkout
- **MUST NOT** allow cart item quantities (each item appears once)

### Saved Carts Rules
- **MUST** limit to 3 saved carts per user (enforce via trigger)
- **MUST** auto-expire saved carts after 7 days
- **MUST** move oldest saved cart to deleted when creating 4th saved cart (LRU eviction)
- **MUST** preserve cart items when saving (no data loss)

### Minimum Cart Value
- **MUST** read minimum from `admin_config.min_cart_value_cents` (default 2000 = $20.00)
- **MUST** enforce at checkout, NOT at add-to-cart (better UX)
- **MUST** show soft warning in cart UI when below minimum
- **MUST** block checkout button when below minimum

### SP Pre-Calculation Rules
- **MUST** calculate `max_sp_available` for each cart item (50% of item price)
- **MUST** check seller's payment preference (`payment_preference != 'cash_only'`)
- **MUST** check buyer's subscription status (SP only for Kids Club+)
- **MUST NOT** store SP selection in cart (handled in checkout screen)

### Favorites Rules
- **MUST** allow unlimited favorites (no cap)
- **MUST** prevent duplicate favorites per user
- **MUST** soft-delete favorites (keep history for analytics)
- **MUST** show item availability status in favorites list

### Realtime Update Rules
- **MUST** subscribe to `items:id=in.(...)` for items in cart
- **MUST** update cart UI immediately when item sold/deleted
- **MUST** show inline warning: "This item is no longer available"
- **MUST** auto-remove unavailable items after 24 hours

---

## AGENT-OPTIMIZED PROMPT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT TASKED WITH IMPLEMENTING MODULE-15.2 (CART SYSTEM BACKEND).

CONTEXT:
- Part of MVP launch for Kids P2P Marketplace.
- Cart UI already built in MODULE-15.1 (CartScreen.tsx, BundleBuilderScreen.tsx).
- Integrates with existing items, profiles, and admin_config tables.
- Uses Postgres RPC functions (NOT Edge Functions) for performance.

YOUR INSTRUCTIONS:
1. Read this entire module specification carefully.
2. For each task (CART-001, etc.), implement EXACTLY as specified.
3. Create all database objects in migration files with proper RLS policies.
4. Use Postgres RPC functions with p_ prefixed parameters, v_ prefixed variables.
5. Implement TypeScript services in src/services/cart.ts and src/services/favorites.ts.
6. Add comprehensive validation and error handling.
7. Include realtime subscription logic in mobile screens.

PERFORMANCE TARGETS:
- Add to cart: < 300ms
- Remove from cart: < 200ms
- Get cart items: < 500ms
- Validate for checkout: < 400ms
- Realtime update latency: < 1s

ERROR HANDLING RULES:
- Different seller detected: Return structured error with current seller name
- Item unavailable: Return specific unavailability reason (sold/deleted/node_mismatch)
- Cart limit reached: Return clear message with eviction strategy
- All RPC functions must return JSONB with {success: boolean, data?: any, error?: {code, message}}

==================================================
NEXT TASK: CART-001 (Database Schema - cart_items)
==================================================
*/
```

---

## IMPLEMENTATION TASKS

---

## PHASE 1: DATABASE FOUNDATION

---

### TASK CART-001: Cart Items Table Schema

**Duration:** 3 hours  
**Priority:** Critical (P0)  
**Dependencies:** None

#### Description
Create `cart_items` table to store both active and saved cart items. Support single-seller enforcement, saved carts, and item quantity (always 1 for unique items).

#### Acceptance Criteria
- [ ] `cart_items` table created with all required fields
- [ ] RLS policies enforce user can only see/modify own cart items
- [ ] Trigger enforces max 1 active cart + 3 saved carts per user
- [ ] Trigger auto-expires saved carts older than 7 days
- [ ] Foreign keys to `profiles`, `items` with CASCADE behavior
- [ ] Indexes on `user_id`, `cart_id`, `listing_id`, `status`

---

#### Database Migration

**File:** `supabase/migrations/20260508000001_create_cart_items_table.sql`

```sql
-- ============================================================================
-- MODULE-15.2: Cart Items Table
-- Purpose: Store active and saved cart items for single-seller cart system
-- ============================================================================

-- Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Cart
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL, -- Groups items into carts (active or saved)
  cart_status text NOT NULL DEFAULT 'active' CHECK (cart_status IN ('active', 'saved', 'deleted')),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Item Details
  listing_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  
  -- Snapshot fields (cached at add-to-cart time)
  item_title text NOT NULL,
  item_price_cents integer NOT NULL,
  item_image_url text,
  item_payment_preference text NOT NULL, -- 'cash_only', 'accept_sp', 'donate'
  
  -- Timestamps
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, listing_id, cart_status) -- Prevent duplicate items in active/saved carts
);

-- Indexes
CREATE INDEX idx_cart_items_user_id ON public.cart_items(user_id);
CREATE INDEX idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX idx_cart_items_listing_id ON public.cart_items(listing_id);
CREATE INDEX idx_cart_items_status ON public.cart_items(cart_status);
CREATE INDEX idx_cart_items_user_cart ON public.cart_items(user_id, cart_id);

-- Auto-update updated_at trigger
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own cart items
CREATE POLICY "cart_items_select_own" ON public.cart_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own cart items
CREATE POLICY "cart_items_insert_own" ON public.cart_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own cart items
CREATE POLICY "cart_items_update_own" ON public.cart_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own cart items
CREATE POLICY "cart_items_delete_own" ON public.cart_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Service role bypasses RLS
CREATE POLICY "cart_items_service_role" ON public.cart_items
  FOR ALL TO service_role
  USING (true);

-- ============================================================================
-- Validation Trigger: Enforce Cart Limits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_cart_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_active_cart_count integer;
  v_saved_cart_count integer;
  v_oldest_saved_cart_id uuid;
BEGIN
  -- Only enforce on INSERT or UPDATE to 'saved' status
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.cart_status = 'saved')) THEN
    
    -- Count active carts for this user
    SELECT COUNT(DISTINCT cart_id) INTO v_active_cart_count
    FROM public.cart_items
    WHERE user_id = NEW.user_id AND cart_status = 'active';
    
    -- Enforce max 1 active cart
    IF NEW.cart_status = 'active' AND v_active_cart_count > 1 THEN
      RAISE EXCEPTION 'User can only have 1 active cart at a time';
    END IF;
    
    -- Count saved carts for this user
    SELECT COUNT(DISTINCT cart_id) INTO v_saved_cart_count
    FROM public.cart_items
    WHERE user_id = NEW.user_id AND cart_status = 'saved';
    
    -- If exceeding 3 saved carts, delete oldest
    IF NEW.cart_status = 'saved' AND v_saved_cart_count >= 3 THEN
      -- Find oldest saved cart
      SELECT cart_id INTO v_oldest_saved_cart_id
      FROM public.cart_items
      WHERE user_id = NEW.user_id AND cart_status = 'saved'
      GROUP BY cart_id
      ORDER BY MIN(added_at) ASC
      LIMIT 1;
      
      -- Mark oldest saved cart as deleted
      UPDATE public.cart_items
      SET cart_status = 'deleted', updated_at = now()
      WHERE user_id = NEW.user_id AND cart_id = v_oldest_saved_cart_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cart_items_enforce_limits
  AFTER INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cart_limits();

-- ============================================================================
-- Cleanup Trigger: Auto-Expire Old Saved Carts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_old_saved_carts()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark saved carts older than 7 days as deleted
  UPDATE public.cart_items
  SET cart_status = 'deleted', updated_at = now()
  WHERE cart_status = 'saved'
    AND added_at < (now() - interval '7 days');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cart_items_expire_old
  AFTER INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.expire_old_saved_carts();
```

---

#### Verification Queries

```sql
-- Verify table exists with correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'cart_items' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'cart_items';

-- Verify policies exist
SELECT policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'cart_items' AND schemaname = 'public';

-- Verify triggers exist
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'cart_items' AND trigger_schema = 'public';

-- Test: Add cart item (replace with real UUIDs)
INSERT INTO public.cart_items (
  user_id, cart_id, seller_id, listing_id,
  item_title, item_price_cents, item_payment_preference
) VALUES (
  'user-uuid-here'::uuid,
  gen_random_uuid(),
  'seller-uuid-here'::uuid,
  'listing-uuid-here'::uuid,
  'Test Item',
  2500,
  'accept_sp'
);

-- Test: Verify cart limits trigger (should fail after 4th saved cart)
```

---

### TASK CART-002: Favorites Table Schema

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** None

#### Description
Create `favorites` table to store user's bookmarked items. Separate from cart — allows unlimited favorites with soft-delete support.

#### Acceptance Criteria
- [ ] `favorites` table created with user_id, listing_id, timestamps
- [ ] RLS policies enforce user can only see/modify own favorites
- [ ] Unique constraint prevents duplicate favorites
- [ ] Soft-delete support (deleted_at timestamp)
- [ ] Indexes on user_id, listing_id, created_at

---

#### Database Migration

**File:** `supabase/migrations/20260508000002_create_favorites_table.sql`

```sql
-- ============================================================================
-- MODULE-15.2: Favorites Table
-- Purpose: Store user's favorited items (bookmarks) separate from cart
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Item
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, -- Soft delete
  
  -- Constraints
  UNIQUE(user_id, listing_id)
);

-- Indexes
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_listing_id ON public.favorites(listing_id);
CREATE INDEX idx_favorites_created_at ON public.favorites(created_at DESC);
CREATE INDEX idx_favorites_active ON public.favorites(user_id, listing_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "favorites_select_own" ON public.favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own favorites
CREATE POLICY "favorites_insert_own" ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update (soft delete) their own favorites
CREATE POLICY "favorites_update_own" ON public.favorites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role bypasses RLS
CREATE POLICY "favorites_service_role" ON public.favorites
  FOR ALL TO service_role
  USING (true);
```

---

#### Verification Queries

```sql
-- Verify table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'favorites' AND table_schema = 'public';

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'favorites';

-- Test: Add favorite
INSERT INTO public.favorites (user_id, listing_id)
VALUES ('user-uuid'::uuid, 'listing-uuid'::uuid);

-- Test: Prevent duplicate (should fail)
INSERT INTO public.favorites (user_id, listing_id)
VALUES ('user-uuid'::uuid, 'listing-uuid'::uuid);
```

---

## PHASE 2: RPC FUNCTIONS (CART OPERATIONS)

---

### TASK CART-003: RPC Function - Add Item to Cart

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** CART-001

#### Description
Implement `rpc_cart_add_item()` with comprehensive validation:
- Verify item exists and is available
- Verify item in buyer's node
- Verify buyer is not the seller
- Enforce single-seller per cart
- Return enriched cart item data

---

#### RPC Function

**File:** `supabase/migrations/20260508000003_rpc_cart_add_item.sql`

```sql
-- ============================================================================
-- RPC: Add Item to Cart with Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cart_add_item(
  p_listing_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_listing record;
  v_buyer_node_id uuid;
  v_active_cart_id uuid;
  v_active_cart_seller_id uuid;
  v_new_cart_item record;
  v_max_sp_available numeric;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'UNAUTHENTICATED', 'message', 'User must be logged in')
    );
  END IF;
  
  -- Fetch listing details
  SELECT i.id, i.user_id as seller_id, i.title, i.price_cents, 
         i.image_urls[1] as image_url, i.payment_preference, i.status, i.node_id
  INTO v_listing
  FROM public.items i
  WHERE i.id = p_listing_id;
  
  -- Validation 1: Item exists
  IF v_listing.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'ITEM_NOT_FOUND', 'message', 'Item does not exist')
    );
  END IF;
  
  -- Validation 2: Item is available
  IF v_listing.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'ITEM_UNAVAILABLE', 'message', 'Item is no longer available')
    );
  END IF;
  
  -- Validation 3: Buyer is not the seller
  IF v_listing.seller_id = v_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'CANNOT_BUY_OWN_ITEM', 'message', 'You cannot add your own items to cart')
    );
  END IF;
  
  -- Validation 4: Item in buyer's node
  SELECT p.active_node_id INTO v_buyer_node_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id;
  
  IF v_listing.node_id != v_buyer_node_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NODE_MISMATCH', 'message', 'Item is not available in your area')
    );
  END IF;
  
  -- Validation 5: Check for duplicate in active cart
  IF EXISTS (
    SELECT 1 FROM public.cart_items ci
    WHERE ci.user_id = v_user_id 
      AND ci.listing_id = p_listing_id 
      AND ci.cart_status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'ALREADY_IN_CART', 'message', 'Item is already in your cart')
    );
  END IF;
  
  -- Get or create active cart
  SELECT ci.cart_id, ci.seller_id INTO v_active_cart_id, v_active_cart_seller_id
  FROM public.cart_items ci
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active'
  LIMIT 1;
  
  -- Validation 6: Enforce single-seller cart
  IF v_active_cart_id IS NOT NULL AND v_active_cart_seller_id != v_listing.seller_id THEN
    -- Get seller name for error message
    DECLARE
      v_current_seller_name text;
    BEGIN
      SELECT p.display_name INTO v_current_seller_name
      FROM public.profiles p
      WHERE p.id = v_active_cart_seller_id;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
          'code', 'DIFFERENT_SELLER',
          'message', 'Your cart contains items from ' || COALESCE(v_current_seller_name, 'another seller'),
          'current_seller_id', v_active_cart_seller_id,
          'current_seller_name', v_current_seller_name
        )
      );
    END;
  END IF;
  
  -- Create new cart if needed
  IF v_active_cart_id IS NULL THEN
    v_active_cart_id := gen_random_uuid();
  END IF;
  
  -- Calculate max SP available (50% of price, only if seller accepts SP and buyer is subscriber)
  v_max_sp_available := 0;
  IF v_listing.payment_preference IN ('accept_sp', 'donate') THEN
    -- Check if buyer is subscriber (simplified - extend with real subscription check)
    v_max_sp_available := (v_listing.price_cents / 2.0);
  END IF;
  
  -- Insert cart item
  INSERT INTO public.cart_items (
    user_id, cart_id, cart_status, seller_id, listing_id,
    item_title, item_price_cents, item_image_url, item_payment_preference
  ) VALUES (
    v_user_id, v_active_cart_id, 'active', v_listing.seller_id, p_listing_id,
    v_listing.title, v_listing.price_cents, v_listing.image_url, v_listing.payment_preference
  )
  RETURNING * INTO v_new_cart_item;
  
  -- Return success with enriched data
  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'cart_item', row_to_json(v_new_cart_item),
      'max_sp_available', v_max_sp_available,
      'cart_id', v_active_cart_id
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

#### Verification Queries

```sql
-- Test: Add item to cart (success)
SELECT public.rpc_cart_add_item('listing-uuid'::uuid);

-- Test: Add same item again (should fail with ALREADY_IN_CART)
SELECT public.rpc_cart_add_item('listing-uuid'::uuid);

-- Test: Add item from different seller (should fail with DIFFERENT_SELLER)
SELECT public.rpc_cart_add_item('different-seller-listing-uuid'::uuid);

-- Test: Add own item (should fail with CANNOT_BUY_OWN_ITEM)
```

---

### TASK CART-004: RPC Function - Remove Item from Cart

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** CART-001

#### Description
Implement `rpc_cart_remove_item()` to remove a cart item. Auto-delete cart if last item removed.

---

#### RPC Function

**File:** `supabase/migrations/20260508000004_rpc_cart_remove_item.sql`

```sql
-- ============================================================================
-- RPC: Remove Item from Cart
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cart_remove_item(
  p_cart_item_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_cart_id uuid;
  v_deleted_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  -- Get cart_id before deletion
  SELECT ci.cart_id INTO v_cart_id
  FROM public.cart_items ci
  WHERE ci.id = p_cart_item_id AND ci.user_id = v_user_id;
  
  IF v_cart_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'ITEM_NOT_FOUND'));
  END IF;
  
  -- Delete cart item
  DELETE FROM public.cart_items
  WHERE id = p_cart_item_id AND user_id = v_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Check if cart is now empty and delete entire cart
  DELETE FROM public.cart_items
  WHERE cart_id = v_cart_id 
    AND user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci2 
      WHERE ci2.cart_id = v_cart_id AND ci2.user_id = v_user_id
    );
  
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('deleted_count', v_deleted_count));
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### TASK CART-005: RPC Function - Clear Cart

**Duration:** 1 hour  
**Priority:** Medium (P2)  
**Dependencies:** CART-001

#### Description
Implement `rpc_cart_clear()` to remove all items from active cart.

---

#### RPC Function

**File:** `supabase/migrations/20260508000005_rpc_cart_clear.sql`

```sql
CREATE OR REPLACE FUNCTION public.rpc_cart_clear()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_deleted_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  DELETE FROM public.cart_items
  WHERE user_id = v_user_id AND cart_status = 'active';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('deleted_count', v_deleted_count));
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### TASK CART-006: RPC Function - Get Cart Items

**Duration:** 3 hours  
**Priority:** Critical (P0)  
**Dependencies:** CART-001

#### Description
Implement `rpc_cart_get_items()` to return active cart items with:
- Enriched item data (current price, availability, image)
- Seller details
- Max SP available per item
- Cart totals (subtotal, item count)

---

#### RPC Function

**File:** `supabase/migrations/20260508000006_rpc_cart_get_items.sql`

```sql
-- ============================================================================
-- RPC: Get Cart Items with Enriched Data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cart_get_items()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_cart_items jsonb;
  v_seller_info jsonb;
  v_subtotal_cents integer;
  v_item_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  -- Get cart items with current item data
  SELECT jsonb_agg(
    jsonb_build_object(
      'cart_item_id', ci.id,
      'listing_id', ci.listing_id,
      'title', i.title,
      'price_cents', i.price_cents,
      'image_url', i.image_urls[1],
      'status', i.status,
      'payment_preference', i.payment_preference,
      'condition', i.condition,
      'added_at', ci.added_at,
      'is_available', (i.status = 'active'),
      'price_changed', (ci.item_price_cents != i.price_cents),
      'max_sp_available', CASE 
        WHEN i.payment_preference IN ('accept_sp', 'donate') THEN (i.price_cents / 2.0)
        ELSE 0
      END
    )
  ) INTO v_cart_items
  FROM public.cart_items ci
  JOIN public.items i ON i.id = ci.listing_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active';
  
  -- Get seller info
  SELECT jsonb_build_object(
    'seller_id', p.id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url
  ) INTO v_seller_info
  FROM public.cart_items ci
  JOIN public.profiles p ON p.id = ci.seller_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active'
  LIMIT 1;
  
  -- Calculate totals
  SELECT SUM(i.price_cents), COUNT(*)
  INTO v_subtotal_cents, v_item_count
  FROM public.cart_items ci
  JOIN public.items i ON i.id = ci.listing_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active' AND i.status = 'active';
  
  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'cart_items', COALESCE(v_cart_items, '[]'::jsonb),
      'seller', v_seller_info,
      'subtotal_cents', COALESCE(v_subtotal_cents, 0),
      'item_count', COALESCE(v_item_count, 0)
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### TASK CART-007: RPC Function - Save Current Cart

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** CART-001

#### Description
Implement `rpc_cart_save_current()` to move active cart to saved status. Enforces 3 saved cart limit via trigger.

---

#### RPC Function

**File:** `supabase/migrations/20260508000007_rpc_cart_save_current.sql`

```sql
CREATE OR REPLACE FUNCTION public.rpc_cart_save_current()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_active_cart_id uuid;
  v_updated_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  -- Get active cart ID
  SELECT DISTINCT ci.cart_id INTO v_active_cart_id
  FROM public.cart_items ci
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active'
  LIMIT 1;
  
  IF v_active_cart_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NO_ACTIVE_CART', 'message', 'No active cart to save'));
  END IF;
  
  -- Update cart status to saved
  UPDATE public.cart_items
  SET cart_status = 'saved', updated_at = now()
  WHERE user_id = v_user_id AND cart_id = v_active_cart_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('saved_cart_id', v_active_cart_id, 'items_saved', v_updated_count));
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### TASK CART-008: RPC Function - Switch to Saved Cart

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** CART-001, CART-007

#### Description
Implement `rpc_cart_switch_to_saved()` to swap active cart with a saved cart.

---

#### RPC Function

**File:** `supabase/migrations/20260508000008_rpc_cart_switch_to_saved.sql`

```sql
CREATE OR REPLACE FUNCTION public.rpc_cart_switch_to_saved(
  p_saved_cart_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_current_active_cart_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  -- Get current active cart
  SELECT DISTINCT ci.cart_id INTO v_current_active_cart_id
  FROM public.cart_items ci
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active';
  
  -- Start transaction
  BEGIN
    -- Save current active cart (if exists)
    IF v_current_active_cart_id IS NOT NULL THEN
      UPDATE public.cart_items
      SET cart_status = 'saved', updated_at = now()
      WHERE user_id = v_user_id AND cart_id = v_current_active_cart_id;
    END IF;
    
    -- Activate selected saved cart
    UPDATE public.cart_items
    SET cart_status = 'active', updated_at = now()
    WHERE user_id = v_user_id AND cart_id = p_saved_cart_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saved cart not found';
    END IF;
  END;
  
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('new_active_cart_id', p_saved_cart_id));
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### TASK CART-009: RPC Function - Validate for Checkout

**Duration:** 3 hours  
**Priority:** Critical (P0)  
**Dependencies:** CART-001, admin_config table

#### Description
Implement `rpc_cart_validate_for_checkout()` to validate cart before checkout:
- All items still available
- Items in buyer's node
- Meets minimum cart value
- No seller's own items

---

#### RPC Function

**File:** `supabase/migrations/20260508000009_rpc_cart_validate_for_checkout.sql`

```sql
CREATE OR REPLACE FUNCTION public.rpc_cart_validate_for_checkout()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_min_cart_value_cents integer;
  v_subtotal_cents integer;
  v_unavailable_items jsonb;
  v_validation_errors jsonb := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  -- Get minimum cart value from admin config
  SELECT COALESCE(
    (config_values->>'min_cart_value_cents')::integer,
    2000 -- Default $20.00
  ) INTO v_min_cart_value_cents
  FROM public.admin_config
  WHERE config_key = 'cart_settings'
  LIMIT 1;
  
  -- Calculate current subtotal
  SELECT SUM(i.price_cents) INTO v_subtotal_cents
  FROM public.cart_items ci
  JOIN public.items i ON i.id = ci.listing_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active' AND i.status = 'active';
  
  v_subtotal_cents := COALESCE(v_subtotal_cents, 0);
  
  -- Check minimum cart value
  IF v_subtotal_cents < v_min_cart_value_cents THEN
    v_validation_errors := v_validation_errors || jsonb_build_object(
      'code', 'BELOW_MINIMUM',
      'message', format('Cart total ($%.2f) is below minimum ($%.2f)', v_subtotal_cents / 100.0, v_min_cart_value_cents / 100.0),
      'min_required_cents', v_min_cart_value_cents,
      'current_subtotal_cents', v_subtotal_cents
    );
  END IF;
  
  -- Check for unavailable items
  SELECT jsonb_agg(
    jsonb_build_object('listing_id', ci.listing_id, 'title', ci.item_title, 'reason', 
      CASE 
        WHEN i.id IS NULL THEN 'deleted'
        WHEN i.status != 'active' THEN i.status
        ELSE 'unknown'
      END
    )
  ) INTO v_unavailable_items
  FROM public.cart_items ci
  LEFT JOIN public.items i ON i.id = ci.listing_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active'
    AND (i.id IS NULL OR i.status != 'active');
  
  IF v_unavailable_items IS NOT NULL THEN
    v_validation_errors := v_validation_errors || jsonb_build_object(
      'code', 'ITEMS_UNAVAILABLE',
      'message', 'Some items in your cart are no longer available',
      'unavailable_items', v_unavailable_items
    );
  END IF;
  
  -- Return validation result
  IF jsonb_array_length(v_validation_errors) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('valid', true, 'subtotal_cents', v_subtotal_cents)
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'VALIDATION_FAILED', 'errors', v_validation_errors)
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## PHASE 3: RPC FUNCTIONS (FAVORITES)

---

### TASK CART-010: RPC Functions - Favorites Add/Remove/Get

**Duration:** 3 hours  
**Priority:** High (P1)  
**Dependencies:** CART-002

#### Description
Implement favorites RPC functions:
- `rpc_favorites_add()` - Add item to favorites
- `rpc_favorites_remove()` - Soft-delete favorite
- `rpc_favorites_get()` - Get user's favorites with item data

---

#### RPC Functions

**File:** `supabase/migrations/20260508000010_rpc_favorites.sql`

```sql
-- ============================================================================
-- RPC: Add Item to Favorites
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_favorites_add(
  p_listing_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_favorite_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  -- Insert or reactivate favorite
  INSERT INTO public.favorites (user_id, listing_id)
  VALUES (v_user_id, p_listing_id)
  ON CONFLICT (user_id, listing_id) DO UPDATE
  SET deleted_at = NULL -- Reactivate if soft-deleted
  RETURNING id INTO v_favorite_id;
  
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('favorite_id', v_favorite_id));
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Remove Item from Favorites (Soft Delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_favorites_remove(
  p_listing_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  UPDATE public.favorites
  SET deleted_at = now()
  WHERE user_id = v_user_id AND listing_id = p_listing_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND'));
  END IF;
  
  RETURN jsonb_build_object('success', true);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Get User's Favorites with Item Data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_favorites_get()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_favorites jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'UNAUTHENTICATED'));
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'favorite_id', f.id,
      'listing_id', i.id,
      'title', i.title,
      'price_cents', i.price_cents,
      'image_url', i.image_urls[1],
      'status', i.status,
      'condition', i.condition,
      'seller_id', i.user_id,
      'seller_name', p.display_name,
      'is_available', (i.status = 'active'),
      'favorited_at', f.created_at
    )
    ORDER BY f.created_at DESC
  ) INTO v_favorites
  FROM public.favorites f
  JOIN public.items i ON i.id = f.listing_id
  JOIN public.profiles p ON p.id = i.user_id
  WHERE f.user_id = v_user_id AND f.deleted_at IS NULL;
  
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('favorites', COALESCE(v_favorites, '[]'::jsonb)));
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## PHASE 4: TYPESCRIPT SERVICES

---

### TASK CART-011: TypeScript Cart Service

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** CART-003 to CART-009

#### Description
Create `src/services/cart.ts` TypeScript service with methods calling RPC functions. Include proper error handling and type safety.

---

#### TypeScript Service

**File:** `p2p-kids-marketplace/src/services/cart.ts`

```typescript
/**
 * Cart Service - Backend operations for cart management
 * Uses Postgres RPC functions for cart operations
 */

import { supabase } from '@/config/supabase';

// ============================================================================
// Types
// ============================================================================

export interface CartItem {
  cart_item_id: string;
  listing_id: string;
  title: string;
  price_cents: number;
  image_url: string;
  status: string;
  payment_preference: 'cash_only' | 'accept_sp' | 'donate';
  condition: string;
  added_at: string;
  is_available: boolean;
  price_changed: boolean;
  max_sp_available: number;
}

export interface CartData {
  cart_items: CartItem[];
  seller: {
    seller_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  subtotal_cents: number;
  item_count: number;
}

export interface ValidationError {
  code: string;
  message: string;
  min_required_cents?: number;
  current_subtotal_cents?: number;
  unavailable_items?: Array<{ listing_id: string; title: string; reason: string }>;
}

// ============================================================================
// Cart Operations
// ============================================================================

/**
 * Add item to cart
 * Validates: item availability, node match, single seller enforcement
 */
export async function addItemToCart(listingId: string): Promise<{
  success: boolean;
  data?: { cart_item: any; max_sp_available: number; cart_id: string };
  error?: { code: string; message: string; current_seller_id?: string; current_seller_name?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_add_item', {
      p_listing_id: listingId,
    });

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] addItemToCart error:', error);
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add item to cart',
      },
    };
  }
}

/**
 * Remove item from cart
 */
export async function removeItemFromCart(cartItemId: string): Promise<{
  success: boolean;
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_remove_item', {
      p_cart_item_id: cartItemId,
    });

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] removeItemFromCart error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to remove item' },
    };
  }
}

/**
 * Clear entire active cart
 */
export async function clearCart(): Promise<{
  success: boolean;
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_clear');

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] clearCart error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to clear cart' },
    };
  }
}

/**
 * Get active cart items with enriched data
 */
export async function getCartItems(): Promise<{
  success: boolean;
  data?: CartData;
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_get_items');

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] getCartItems error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to load cart' },
    };
  }
}

/**
 * Save current active cart for later
 */
export async function saveCurrentCart(): Promise<{
  success: boolean;
  data?: { saved_cart_id: string; items_saved: number };
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_save_current');

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] saveCurrentCart error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to save cart' },
    };
  }
}

/**
 * Switch to a saved cart (makes it active)
 */
export async function switchToSavedCart(savedCartId: string): Promise<{
  success: boolean;
  data?: { new_active_cart_id: string };
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_switch_to_saved', {
      p_saved_cart_id: savedCartId,
    });

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] switchToSavedCart error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to switch cart' },
    };
  }
}

/**
 * Validate cart before checkout
 * Returns validation errors or success
 */
export async function validateCartForCheckout(): Promise<{
  success: boolean;
  data?: { valid: boolean; subtotal_cents: number };
  error?: { code: string; errors?: ValidationError[] };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_cart_validate_for_checkout');

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[CartService] validateCartForCheckout error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR' },
    };
  }
}
```

---

### TASK CART-012: TypeScript Favorites Service

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** CART-010

#### Description
Create `src/services/favorites.ts` TypeScript service for favorites operations.

---

#### TypeScript Service

**File:** `p2p-kids-marketplace/src/services/favorites.ts`

```typescript
/**
 * Favorites Service - Backend operations for favorites/bookmarks
 */

import { supabase } from '@/config/supabase';

export interface FavoriteItem {
  favorite_id: string;
  listing_id: string;
  title: string;
  price_cents: number;
  image_url: string;
  status: string;
  condition: string;
  seller_id: string;
  seller_name: string;
  is_available: boolean;
  favorited_at: string;
}

/**
 * Add item to favorites
 */
export async function addToFavorites(listingId: string): Promise<{
  success: boolean;
  data?: { favorite_id: string };
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_favorites_add', {
      p_listing_id: listingId,
    });

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[FavoritesService] addToFavorites error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to add favorite' },
    };
  }
}

/**
 * Remove item from favorites
 */
export async function removeFromFavorites(listingId: string): Promise<{
  success: boolean;
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_favorites_remove', {
      p_listing_id: listingId,
    });

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[FavoritesService] removeFromFavorites error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to remove favorite' },
    };
  }
}

/**
 * Get user's favorited items
 */
export async function getFavorites(): Promise<{
  success: boolean;
  data?: { favorites: FavoriteItem[] };
  error?: { code: string; message?: string };
}> {
  try {
    const { data, error } = await supabase.rpc('rpc_favorites_get');

    if (error) throw error;
    return data as any;
  } catch (error) {
    console.error('[FavoritesService] getFavorites error:', error);
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Failed to load favorites' },
    };
  }
}
```

---

## PHASE 5: MOBILE INTEGRATION

---

### TASK CART-013: Integrate Cart Service into CartScreen

**Duration:** 3 hours  
**Priority:** Critical (P0)  
**Dependencies:** CART-011

#### Description
Update `CartScreen.tsx` to:
- Call `getCartItems()` on mount
- Wire up remove/clear actions
- Show minimum cart value warning
- Handle validation before checkout

**Files to modify:**
- `p2p-kids-marketplace/src/screens/cart/CartScreen.tsx`

**Changes:**
```typescript
// Add imports
import { getCartItems, removeItemFromCart, clearCart } from '@/services/cart';

// In loadCartItems():
const result = await getCartItems();
if (result.success && result.data) {
  setCartItems(result.data.cart_items);
  setSellerInfo(result.data.seller);
  // Show warning if below minimum
}

// In handleRemoveItem():
const result = await removeItemFromCart(itemId);
if (result.success) {
  await loadCartItems(); // Refresh
}
```

---

### TASK CART-014: Add "Add to Cart" Button to Item Detail Screen

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** CART-011

#### Description
Update item detail screen to show "Add to Cart" button. Handle different seller modal.

**Files to modify:**
- `p2p-kids-marketplace/src/screens/items/ItemDetailScreen.tsx` (or equivalent)

**Modal UI for different seller:**
```typescript
<Modal visible={showDifferentSellerModal}>
  <Text>You have {currentCartItemCount} items from {currentSellerName} in your cart.</Text>
  <Text>What would you like to do?</Text>
  
  <Button onPress={handleSaveAndStartNew}>Save & Start New Cart</Button>
  <Button onPress={handleReplaceCart}>Replace Cart</Button>
  <Button onPress={closeModal}>Cancel</Button>
</Modal>
```

---

### TASK CART-015: Create Favorites List Screen

**Duration:** 4 hours  
**Priority:** High (P1)  
**Dependencies:** CART-012

#### Description
Create new `FavoritesScreen.tsx` to display user's favorited items. Add navigation route and bottom nav icon.

---

#### Screen Implementation

**File:** `p2p-kids-marketplace/src/screens/favorites/FavoritesScreen.tsx`

```typescript
/**
 * FavoritesScreen.tsx
 * Display user's favorited/bookmarked items
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Heart, HeartStraight } from 'phosphor-react-native';
import { theme } from '@/theme';
import { getFavorites, removeFromFavorites, FavoriteItem } from '@/services/favorites';
import BottomNavBar from '@/components/organisms/BottomNavBar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const result = await getFavorites();
      if (result.success && result.data) {
        setFavorites(result.data.favorites);
      } else {
        Alert.alert('Error', 'Failed to load favorites');
      }
    } catch (error) {
      console.error('[FavoritesScreen] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (listingId: string) => {
    const result = await removeFromFavorites(listingId);
    if (result.success) {
      setFavorites(prev => prev.filter(f => f.listing_id !== listingId));
    }
  };

  const handleItemPress = (listingId: string) => {
    navigation.navigate('ItemDetail', { itemId: listingId });
  };

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => handleItemPress(item.listing_id)}
      testID={`favorite-item-${item.listing_id}`}
    >
      <Image source={{ uri: item.image_url }} style={styles.itemImage} />
      
      {!item.is_available && (
        <View style={styles.unavailableOverlay}>
          <Text style={styles.unavailableText}>No Longer Available</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.heartButton}
        onPress={() => handleRemoveFavorite(item.listing_id)}
        testID={`remove-favorite-${item.listing_id}`}
      >
        <Heart size={24} color={theme.colors.error[500]} weight="fill" />
      </TouchableOpacity>

      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemPrice}>${(item.price_cents / 100).toFixed(2)}</Text>
        <Text style={styles.itemSeller} numberOfLines={1}>
          By {item.seller_name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
        <BottomNavBar />
      </SafeAreaView>
    );
  }

  if (favorites.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Heart size={24} color={theme.textColors.primary} weight="regular" />
          <Text style={styles.headerTitle}>My Favorites</Text>
        </View>

        <View style={styles.emptyContainer}>
          <HeartStraight size={64} color={theme.colors.neutral[300]} weight="regular" />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the heart icon on items you love to save them here
          </Text>
        </View>

        <BottomNavBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Heart size={24} color={theme.textColors.primary} weight="regular" />
        <Text style={styles.headerTitle}>My Favorites</Text>
        <Text style={styles.countBadge}>{favorites.length}</Text>
      </View>

      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={item => item.favorite_id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        testID="favorites-grid"
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
    gap: theme.spacing.sm,
  },

  headerTitle: {
    ...theme.typography.h2,
    color: theme.textColors.primary,
    flex: 1,
  },

  countBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.secondary,
  },

  gridContent: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.md,
    paddingBottom: 100,
  },

  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },

  itemCard: {
    width: '48%',
    backgroundColor: theme.backgroundColors.card,
    borderRadius: 8,
    overflow: 'hidden',
    ...theme.shadows.level1,
  },

  itemImage: {
    width: '100%',
    height: 140,
    backgroundColor: theme.colors.neutral[100],
  },

  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  unavailableText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  heartButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    padding: theme.spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
  },

  itemDetails: {
    padding: theme.spacing.sm,
  },

  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: 4,
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: 2,
  },

  itemSeller: {
    fontSize: 12,
    color: theme.textColors.secondary,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    ...theme.typography.h2,
    color: theme.textColors.primary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },

  emptySubtext: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
  },
});
```

---

#### Navigation Integration

**Add to:** `p2p-kids-marketplace/src/navigation/types.ts`

```typescript
export type RootStackParamList = {
  // ... existing routes
  Favorites: undefined;
  // ...
};
```

**Add to:** `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`

```typescript
import FavoritesScreen from '@/screens/favorites/FavoritesScreen';

// In navigator:
<Stack.Screen name="Favorites" component={FavoritesScreen} />
```

**Update BottomNavBar** to include Favorites icon if not already present.

---

### TASK CART-016: Realtime Cart Subscriptions

**Duration:** 3 hours  
**Priority:** High (P1)  
**Dependencies:** CART-011, CART-013

#### Description
Add Supabase realtime subscription to `CartScreen` to detect when items become unavailable.

**Implementation:**

```typescript
// In CartScreen.tsx

useEffect(() => {
  if (cartItems.length === 0) return;

  const listingIds = cartItems.map(item => item.listing_id);

  const subscription = supabase
    .channel('cart_items_realtime')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'items',
        filter: `id=in.(${listingIds.join(',')})`,
      },
      (payload) => {
        // Handle item update (status changed, price changed)
        handleItemUpdate(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'items',
        filter: `id=in.(${listingIds.join(',')})`,
      },
      (payload) => {
        // Handle item deleted
        handleItemDeleted(payload.old.id);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [cartItems]);
```

---

## PHASE 6: ADMIN CONFIGURATION

---

### TASK CART-017: Admin Config - Minimum Cart Value

**Duration:** 2 hours  
**Priority:** Medium (P2)  
**Dependencies:** None (uses existing admin_config table)

#### Description
Add minimum cart value setting to `admin_config` table. Provide SQL to insert/update config.

---

#### Admin Config Setup

**File:** `supabase/migrations/20260508000011_admin_config_cart_settings.sql`

```sql
-- ============================================================================
-- Admin Config: Cart Settings (Minimum Cart Value)
-- ============================================================================

-- Insert or update cart settings in admin_config
INSERT INTO public.admin_config (config_key, config_values, created_by)
VALUES (
  'cart_settings',
  jsonb_build_object(
    'min_cart_value_cents', 2000,  -- $20.00 default
    'max_saved_carts', 3,
    'saved_cart_expiry_days', 7
  ),
  'system'::uuid  -- Replace with actual admin user ID
)
ON CONFLICT (config_key) DO UPDATE
SET 
  config_values = EXCLUDED.config_values,
  updated_at = now();

-- Verify
SELECT config_key, config_values 
FROM public.admin_config 
WHERE config_key = 'cart_settings';
```

**Admin Portal UI Task:**
- Add cart settings page to admin portal
- Allow editing `min_cart_value_cents` (in cents)
- Show current value in dollars
- Validate: min must be >= 500 ($5.00)

---

## PHASE 7: ANALYTICS & TESTING

---

### TASK CART-018: Analytics Events - Cart Actions

**Duration:** 2 hours  
**Priority:** Medium (P2)  
**Dependencies:** CART-011

#### Description
Add Firebase Analytics events for cart actions:
- `cart_item_added`
- `cart_item_removed`
- `cart_cleared`
- `cart_saved`
- `cart_checkout_initiated`
- `favorite_added`
- `favorite_removed`

**Implementation:**

```typescript
// In cart.ts service

import analytics from '@react-native-firebase/analytics';

export async function addItemToCart(listingId: string) {
  const result = await supabase.rpc(...);
  
  if (result.success) {
    await analytics().logEvent('cart_item_added', {
      listing_id: listingId,
      price_cents: result.data?.cart_item.item_price_cents,
      seller_id: result.data?.cart_item.seller_id,
    });
  }
  
  return result;
}
```

---

### TASK CART-019: Unit Tests - Cart Service

**Duration:** 3 hours  
**Priority:** Medium (P2)  
**Dependencies:** CART-011

#### Description
Create Jest unit tests for cart service functions.

**File:** `p2p-kids-marketplace/src/services/__tests__/cart.test.ts`

**Test cases:**
- Add item to cart (success)
- Add item with different seller (error)
- Add duplicate item (error)
- Remove item from cart
- Clear cart
- Validate cart below minimum
- Validate cart with unavailable items

---

### TASK CART-020: Integration Tests - Cart RPC Functions

**Duration:** 4 hours  
**Priority:** Medium (P2)  
**Dependencies:** CART-003 to CART-009

#### Description
Create integration tests for RPC functions using test database.

**File:** `p2p-kids-marketplace/src/__tests__/integration/cart-rpc.test.ts`

**Test flow:**
1. Seed test user, nodes, items
2. Call `rpc_cart_add_item()`
3. Verify cart_items row created
4. Call `rpc_cart_get_items()`
5. Verify response structure
6. Call `rpc_cart_validate_for_checkout()`
7. Verify validation logic

---

## COMPLETION CHECKLIST

Before marking MODULE-15.2 as complete, verify:

### Database
- [ ] `cart_items` table created with RLS policies
- [ ] `favorites` table created with RLS policies
- [ ] All 10 RPC functions created and tested
- [ ] Triggers for cart limits and expiration working
- [ ] Admin config for minimum cart value set

### TypeScript Services
- [ ] `cart.ts` service implements all cart operations
- [ ] `favorites.ts` service implements favorites operations
- [ ] Proper error handling and type safety
- [ ] Analytics events integrated

### Mobile Integration
- [ ] CartScreen loads cart items from backend
- [ ] Add/remove/clear cart actions work
- [ ] Item detail screen has "Add to Cart" button
- [ ] Different seller modal implemented
- [ ] FavoritesScreen created with navigation route
- [ ] Realtime cart updates working

### Validation & UX
- [ ] Single-seller enforcement works
- [ ] Minimum cart value enforced at checkout
- [ ] Saved carts limit (3) enforced
- [ ] Unavailable items shown in cart with warning
- [ ] Price change warnings displayed

### Testing
- [ ] Unit tests for cart service pass
- [ ] Integration tests for RPC functions pass
- [ ] Manual testing on iOS/Android simulators
- [ ] E2E test for add-to-cart → checkout flow

---

## DEFERRED TO POST-MVP

The following features are intentionally deferred:

1. **Bundle Listings (Seller-Created)** → See PARKING-LOT.md
2. **Multi-Seller Cart with Separate Checkouts** → Simplified to single-seller + saved carts
3. **Cart Item Quantities** → Deferred (unique items only for MVP)
4. **Guest Cart Support** → Auth required before cart access
5. **Cart Reminders (Push Notifications)** → Post-MVP analytics/retention feature

---

## SUCCESS METRICS

Post-launch metrics to track:

- **Cart Conversion Rate**: % of users who add to cart and complete checkout
- **Saved Cart Usage**: % of users who use saved carts feature
- **Different Seller Friction**: How often different seller modal appears
- **Favorites Engagement**: % of users who favorite items, conversion rate from favorites
- **Cart Abandonment Rate**: % of carts that don't result in checkout
- **Average Cart Value**: Mean subtotal of completed checkouts
- **Minimum Value Impact**: % of checkouts blocked by minimum cart value

---

**END OF MODULE-15.2: CART SYSTEM BACKEND**
