# TradeFlowV2 Test Assessment & Fix Plan

**Date:** 2026-06-02  
**Status:** CRITICAL — False Positive Tests  
**Impact:** 102 test cases marked as "PASSED" but not actually validating UI flows

---

## Problem Summary

The automated Maestro tests are reporting 102 passed cases, but upon inspection:

1. **Tests use `optional: true` extensively** — assertions pass even when elements don't exist
2. **Tests navigate screens but don't perform actions** — no button taps, no form fills, no flow completion
3. **TestID mismatches** — tests reference IDs that don't exist in the actual UI code
4. **No state validation** — tests don't verify cart counts, SP balances, trade statuses, etc.

### Root Cause

The Maestro tests were generated as **navigation smoke tests** rather than **feature flow tests** matching the manual testing requirements.

---

## Evidence

### Example 1: Cart Flow (TC-M01 through TC-M15)

**Manual Test Requirement (TC-M01):**
```
1. Browse to an item
2. Tap [Add to Cart]
3. Verify cart shows 1 item
4. Verify cart badge shows "1"
5. Navigate to cart
6. Verify item appears with correct title/price
```

**Actual Maestro Test (cart-flow.yaml):**
```yaml
# Just checks if button exists (optional)
- runFlow:
    when:
      visible:
        id: "add-to-cart-button"
    commands:
      - assertVisible:
          id: "add-to-cart-button"  # ← doesn't tap it!
```

**Result:** Test passes without adding anything to cart.

---

### Example 2: Full Trade Flow (TC-A01)

**Manual Test Requirement:**
```
1. Login as buyer
2. Open Cash Only listing
3. Tap [Request to Buy]
4. Review offer
5. Tap [Submit Offer]
6. Login as seller
7. Accept offer
8. Login as buyer
9. Tap [I Got It]
10. Confirm completion
```

**Actual Maestro Test (module-15.1.2-full-trade-flow-v2.yaml):**
```yaml
# Just navigates and checks optional elements
- runFlow:
    when:
      visible:
        id: "make-offer-button"
    commands:
      - assertVisible:
          id: "make-offer-button"  # ← doesn't tap!
          optional: true  # ← passes even if button doesn't exist!
```

**Result:** Test passes without creating any trade.

---

### Example 3: TestID Mismatches

**Maestro tests look for:**
- `listing-card-0` 
- `make-offer-button`
- `send-offer-button`

**Actual UI code has:**
- `search-result-{listing.id}` (DiscoverScreen)
- `add-to-cart-button` (ItemDetailScreen)
- `view-cart-button` (ItemDetailScreen)
- NO `make-offer-button` — the "Request to Buy" button has NO testID!

---

## Impact Assessment

| Test Group | Cases | Actually Tested | Gap |
|---|---|---|---|
| A — Core Happy Paths | 4 | 0 | 100% |
| B — Offer Lifecycle | 5 | 0 | 100% |
| C — SP Behavior | 8 | 0 | 100% |
| D — Auto-Complete & Timers | 5 | 0 | 100% |
| E — Dispute Flow | 4 | 0 (UI only) | ~80% (admin part works) |
| F — Payout | 3 | 0 | 100% |
| G — Notifications | 1 | 0 | 100% |
| H — Completion CTAs | 4 | 0 | 100% |
| I — Safety UX | 5 | 0 | 100% |
| J — Seller Cancel Consequences | 5 | 0 | 100% |
| K — Value Stack & Fees | 3 | 0 | 100% |
| L — Bundle Flows | 8 | 0 | 100% |
| M — Cart | 14 | ~2 (nav only) | ~85% |
| N — Cart Admin | 2 | 2 | 0% ✅ |
| O — Tax End User | 7 | 0 | 100% |
| P — Tax Admin | 8 | 8 | 0% ✅ |
| Q — Reviews & Ratings | 17 | 3 (admin only) | ~82% |
| R — Refund & Cancellation | 13 | 0 | 100% |
| **TOTAL** | **102** | **~15** | **~85%** |

**Real coverage:** ~15% (only admin portal tests + basic navigation checks work correctly)

---

## What Needs to Be Fixed

### Phase 1: Add Missing TestIDs to UI Components (BLOCKING)

The following critical buttons have NO testIDs:

**ItemDetailScreen.tsx:**
```typescript
// Line ~747 — Request to Buy button
<Pressable
  style={styles.buyNowButton}
  onPress={handleRequestToBuy}
  testID="request-to-buy-button"  // ← ADD THIS
>

// Line ~747 (SP path) — Use SP button
<Pressable
  style={[styles.buyNowButton, styles.useSPButton]}
  onPress={handleUseSP}
  testID="use-sp-button"  // ← ADD THIS
>

// Favorite/heart icon (line ~432)
<Pressable
  onPress={handleToggleFavorite}
  testID="favorite-button"  // ← ADD THIS
>

// Share button (line ~441)
<Pressable
  onPress={handleShare}
  testID="share-button"  // ← ADD THIS
>
```

**TradeOfferScreen.tsx:**
```typescript
// Submit offer button
<Button
  onPress={handleSendOffer}
  testID="submit-offer-button"  // ← ADD THIS
>

// SP amount slider/input
<TextInput
  value={spAmount}
  testID="sp-amount-input"  // ← ADD THIS
>
```

**DiscoverScreen.tsx:**
```typescript
// Fix listing card testID to match tests
<Pressable
  testID={`listing-card-${index}`}  // ← CHANGE from search-result-{id}
  onPress={() => handleListingPress(item)}
>
```

**TradeListScreen.tsx (needs to be checked):**
```typescript
// Trade row items
<Pressable
  testID={`trade-row-${trade.id}`}  // ← ADD THIS
>

// Buying/Selling tabs
<Pressable testID="tab-buying">
<Pressable testID="tab-selling">
```

**TradeDetailScreen.tsx (needs to be checked):**
```typescript
// I Got It button
<Button testID="confirm-receipt-button">

// Report Problem button  
<Button testID="report-problem-button">

// Cancel Trade button
<Button testID="cancel-trade-button">

// Seller Accept button
<Button testID="seller-accept-button">

// Seller Decline button
<Button testID="seller-decline-button">
```

---

### Phase 2: Rewrite Maestro Tests to Perform Actual Flows

Remove all `optional: true` and implement real step-by-step flows.

**Example: TC-A01 (Cash Only Happy Path)**

```yaml
# FLOW: tc-a01-cash-only-happy-path
appId: com.sameralzubaidi.p2pmarketplace
---
- launchApp
- runFlow: helpers/tfv2-login-buyer.yaml

# Navigate to discover
- tapOn:
    id: "tab-discover"
- waitForAnimationToEnd

# Tap on first Cash Only listing
- tapOn:
    id: "listing-card-0"
- waitForAnimationToEnd

# Verify Cash Only badge visible
- assertVisible:
    text: "Cash Only"

# Verify single Request to Buy button
- assertVisible:
    id: "request-to-buy-button"

# Verify NO Use SP button for Cash Only
- assertNotVisible:
    id: "use-sp-button"

# Tap Request to Buy
- tapOn:
    id: "request-to-buy-button"
- waitForAnimationToEnd

# Should navigate to offer review screen
- assertVisible:
    text: "Review Offer"
    
# Tap Submit Offer
- tapOn:
    id: "submit-offer-button"
- waitForAnimationToEnd

# Verify confirmation toast
- assertVisible:
    text: "Offer submitted"

# Navigate to trades
- tapOn:
    id: "tab-trades"
- waitForAnimationToEnd

# Verify trade appears in Buying tab
- tapOn:
    id: "tab-buying"
- waitForAnimationToEnd
- assertVisible:
    id: "trade-row-"  # First trade row

# NOW SWITCH TO SELLER ACCOUNT
- stopApp
- launchApp
- runFlow: helpers/tfv2-login-seller.yaml

# Navigate to offers tab
- tapOn:
    id: "tab-trades"
- tapOn:
    id: "tab-selling"
- waitForAnimationToEnd

# Tap on pending offer
- tapOn:
    id: "trade-row-"
- waitForAnimationToEnd

# Verify Review Offer screen
- assertVisible:
    text: "Review Offer"

# Tap Accept
- tapOn:
    id: "seller-accept-button"
- waitForAnimationToEnd

# Verify accepted confirmation
- assertVisible:
    text: "Offer accepted"

# SWITCH BACK TO BUYER
- stopApp
- launchApp
- runFlow: helpers/tfv2-login-buyer.yaml

# Open the in-progress trade
- tapOn:
    id: "tab-trades"
- tapOn:
    id: "tab-buying"
- tapOn:
    id: "trade-row-"
- waitForAnimationToEnd

# Verify In Progress state
- assertVisible:
    text: "In Progress"

# Tap I Got It
- tapOn:
    id: "confirm-receipt-button"
- waitForAnimationToEnd

# Confirm the confirmation modal
- tapOn:
    text: "Confirm"
- waitForAnimationToEnd

# Verify completion screen
- assertVisible:
    text: "Trade Complete"

# Verify Rate Seller button
- assertVisible:
    text: "Rate Seller"
```

---

### Phase 3: Add State Validation Queries

Tests should verify database/wallet state changes:

```yaml
# After offer submission, verify SP reserved
- runScript: |
    # Query buyer's SP wallet via Edge Function
    # Assert reserved_sp increased by offer amount

# After completion, verify SP released to seller
- runScript: |
    # Query seller's SP wallet
    # Assert pending_sp increased
```

*(Maestro doesn't support DB queries natively, so this would need a helper Edge Function or local script wrapper)*

---

## Recommended Fix Strategy

### Option A: Incremental Fix (3–5 days)
1. **Day 1:** Add missing testIDs to all screens (Phase 1)
2. **Day 2-3:** Rewrite top 20 critical test flows (Groups A, B, C, M, R)
3. **Day 4:** Add wallet/state validation helpers
4. **Day 5:** Full regression run + fix failures

### Option B: Parallel Workstreams (2–3 days with 2 engineers)
- **Engineer 1:** Phase 1 testIDs (all screens in parallel)
- **Engineer 2:** Phase 2 test rewrites (start with scaffolds, fill in as testIDs land)
- **Day 3:** Integration + regression

### Option C: Hybrid (recommended for QA handoff)
1. **Immediate (2 hours):** Add testIDs to ItemDetailScreen, TradeOfferScreen, DiscoverScreen, CartScreen
2. **Next (4 hours):** Rewrite 5 smoke flows (TC-A01, TC-M01, TC-C07, TC-K01, TC-O01)
3. **Then (1 day):** Expand to all Group A-C-M flows
4. **Final (1 day):** Full coverage + documentation

---

## Success Criteria

After fix, each test must:
1. ✅ Perform the actual UI interaction (tap buttons, fill forms)
2. ✅ Use ONLY non-optional assertions (fail if element missing)
3. ✅ Verify state changes (cart count, SP balance, trade status)
4. ✅ Match the manual test case step-by-step
5. ✅ Run on a clean slate (idempotent seed data)

**Target:** 85+ real test cases passing (excluding manual-only cases like push delivery, clock control)

---

## Next Steps

**Decision required from Samer:**

Which option (A, B, or C) should we proceed with?

If Option C (recommended):
1. I will immediately add testIDs to the 4 critical screens
2. Rewrite 5 smoke flows as proof-of-concept
3. Share before/after comparison for approval
4. Then proceed with full implementation

**Estimated timeline:**
- Option A: 5 days
- Option B: 3 days (requires 2 engineers)
- Option C: 3 days (1 engineer, incremental handoff)
