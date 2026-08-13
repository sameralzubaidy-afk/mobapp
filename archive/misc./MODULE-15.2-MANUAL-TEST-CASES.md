# MODULE-15.2 — Cart System Manual Test Cases

**Scope:** CART-001 → CART-020
**Targets:** iOS Simulator + Android Emulator only
**Preconditions:**
- App built from `p2p-kids-marketplace/`
- Supabase prod project `drntwgporzabmxdqykrp` (PR1 migrations applied)
- Test users seeded: `test_subscriber@example.com` (Kids Club+) and `test_seller_a@example.com` / `test_seller_b@example.com` (sellers with active listings in same node)
- `admin_config.cart_min_value_cents = 2000` (= $20)
- `admin_config.cart_max_saved_carts = 3`
- `admin_config.cart_saved_expiry_days = 7`

---

## TC-01: Empty cart state

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `test_subscriber` | Lands on Home |
| 2 | Tap Cart tab | Cart screen opens |
| 3 | Observe | Empty state visible; testID `cart-empty-state`; `favorites-link` visible |

---

## TC-02: Add first item to cart (single seller)

| Step | Action | Expected |
|---|---|---|
| 1 | Open a listing from seller A | Item detail loads |
| 2 | Tap "Add to Cart" (testID `add-to-cart-button`) | Alert "Added to Cart" |
| 3 | Open Cart tab | Item appears with price + checkout button (`cart-checkout-button`) |

---

## TC-03: DIFFERENT_SELLER modal (CART-004)

| Step | Action | Expected |
|---|---|---|
| 1 | With seller A's item already in cart, open a listing from seller B | Item detail loads |
| 2 | Tap "Add to Cart" | Alert "Different Seller" with 3 actions: "Save current cart" / "Clear current cart" / "Cancel" |
| 3 | Tap "Cancel" | No state change; cart still has seller A's item |
| 4 | Repeat step 2 → tap "Clear current cart" | Cart cleared, then seller B's item added |

---

## TC-04: Save current cart (CART-007)

| Step | Action | Expected |
|---|---|---|
| 1 | With at least 1 item in active cart, open Cart tab | Cart visible |
| 2 | Tap "Save current cart" (testID `save-current-cart-button`) | Active cart promoted to saved; active cart becomes empty |
| 3 | Observe | "Saved carts" section appears with 1 row |

---

## TC-05: Switch to saved cart (CART-008)

| Step | Action | Expected |
|---|---|---|
| 1 | With 1 saved cart and an empty (or different) active cart, open Cart | Both sections visible |
| 2 | Tap "Switch" on saved cart row | Saved cart becomes active; previously active cart (if any items) is moved to saved |

---

## TC-06: Saved cart limit (3 max)

| Step | Action | Expected |
|---|---|---|
| 1 | Create 3 saved carts using TC-04 repeatedly | 3 saved cart rows visible |
| 2 | Attempt a 4th save | Alert: "You can only save up to 3 carts" (code `SAVED_CART_LIMIT_REACHED`) |

---

## TC-07: Delete saved cart

| Step | Action | Expected |
|---|---|---|
| 1 | Open Cart with ≥1 saved cart | Saved carts visible |
| 2 | Tap "Delete" on a saved cart row | Row removed; saved cart count decreases |

---

## TC-08: Min cart value blocks checkout (CART-009)

| Step | Action | Expected |
|---|---|---|
| 1 | Build a cart with subtotal < $20 | Min-value notice visible (`cart-min-value-notice`) |
| 2 | Tap Checkout | Alert "below $20.00" / `MIN_CART_VALUE_NOT_MET` |
| 3 | Add another item to push subtotal ≥ $20 | Notice hidden; checkout proceeds |

---

## TC-09: Favorite an item (CART-016)

| Step | Action | Expected |
|---|---|---|
| 1 | Open a listing | Detail loads with empty heart |
| 2 | Tap heart icon | Heart toggles to filled; analytics event `favorite_added` |
| 3 | Re-open the same listing | Heart shows filled state (synced via `isFavorited`) |

---

## TC-10: Favorites list & remove (CART-017)

| Step | Action | Expected |
|---|---|---|
| 1 | From Cart screen tap `favorites-link` | Favorites screen opens |
| 2 | Observe list | Favorited items listed with price + seller name |
| 3 | Tap "Remove" on a row (testID `favorite-remove-{id}`) | Item disappears from list; analytics event `favorite_removed` |
| 4 | Tap "Add to cart" on another row | Item added respecting single-seller rule |

---

## TC-11: Realtime cart sync

| Step | Action | Expected |
|---|---|---|
| 1 | Open Cart on iOS sim, leave open | Cart visible |
| 2 | From a second device/web session as same user, add an item via RPC | Item appears within ~2s without manual refresh |

---

## TC-12: Subscriber-only SP (sanity)

| Step | Action | Expected |
|---|---|---|
| 1 | Login as free user | Cart works for cash-only items |
| 2 | Observe SP UI | SP slider/balance hidden or zero |
| 3 | Login as subscriber | SP UI present per existing trade-flow specs |

---

## Run targets

```bash
# Unit (host)
cd p2p-kids-marketplace && npm run test:unit

# Integration (host, hits prod Supabase — read-only/structured-error checks)
cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true npm run test:e2e -- e2e/cart-system.integration.test.ts

# Maestro on simulator
cd p2p-kids-marketplace && npm run test:maestro:ios -- .maestro/cart-flow.yaml
cd p2p-kids-marketplace && npm run test:maestro:android -- .maestro/cart-flow.yaml
```
