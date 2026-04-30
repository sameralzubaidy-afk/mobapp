# TASK LISTING-V3-011: SP Earnings Preview for Single & Bulk Listing

**Module:** MODULE-04 ITEM LISTING V3  
**Version:** 3.0  
**Status:** Ready for Implementation  
**Created:** April 29, 2026  
**Dependencies:** LISTING-V3-005 (ItemCreateScreen), LISTING-V3-006 (BulkListingCreateScreen), MODULE-12 V3 (Category SP multipliers), ADMIN-V3-007 (PriceSuggestionCard component exists but not integrated)  
**Priority:** High  
**Duration:** 4 hours  
**Traceability:** BRD US-SUB-002 "If 'Accept SP' selected, see estimated SP earnings"

---

## PROBLEM STATEMENT

**Gap Identified:** LISTING-V3-005 is marked complete, but sellers have **no visibility** into how much SP they'll earn when listing items. The `PriceSuggestionCard` component (built in ADMIN-V3-007) has SP preview logic, but it's **not integrated** into either:
- `ItemCreateScreen.tsx` (single item flow)
- `BulkListingCreateScreen.tsx` / `BulkItemCard.tsx` (bulk flow)

This violates BRD requirement US-SUB-002: *"If 'Accept SP' selected, see estimated SP earnings"*.

**Business Impact:**
- Sellers don't understand SP value proposition → low adoption of "Accept SP" payment preference
- Free users don't see conversion incentive (can't see what they're missing)
- Missed opportunity to educate sellers on category-specific SP multipliers (1.05x - 1.40x)

---

## SOLUTION OVERVIEW

Integrate **real-time SP earnings preview** into both single and bulk listing flows using:
1. **Client-side optimistic calculation** (no API calls - cache category multipliers in AsyncStorage)
2. **Always-visible estimates** (even for free users - drives upgrades)
3. **Clear educational tooltips** ("What is SP?" + disclaimers)
4. **Bulk aggregate summary** (total SP across all items)

### Key UX Decisions (Approved)

| Decision Point | Solution |
|----------------|----------|
| **Visibility** | Show to ALL sellers (Option B) - drives conversions |
| **Calculation Trigger** | Real-time with 300ms debounce (single), per-item + total (bulk) |
| **Category Required?** | Yes - show placeholder "Select category to see estimate" until picked |
| **Free User Handling** | Grayed-out estimate + "🔒 Upgrade to earn SP" CTA (Option A) |
| **"What is SP?" Link** | Tooltip with "Learn More" link to SP education screen (Option C) |
| **"Other" Category** | Show 1.10x default + disclaimer "may change after admin approval" (Option A) |
| **Disclaimer** | Small (i) icon with tooltip (Option B) |
| **Performance** | Client-side math using cached multipliers - NO API calls (Option 7) |
| **Bulk Total** | Summary card above item list (Option B) |
| **Caching** | AsyncStorage, 24h TTL (Option C) |

---

## SCOPE

### In Scope
- **SPEarningsPreview** component (new) - reusable card for single items
- **BulkSPSummaryCard** component (new) - aggregate total for bulk flow
- **useCategorySPCache** hook (new) - AsyncStorage caching with 24h TTL
- Modify `ItemCreateScreen.tsx` to show SP preview when category + price set
- Modify `BulkItemCard.tsx` to show per-item SP estimate
- Modify `BulkListingCreateScreen.tsx` to show aggregate summary card
- "What is SP?" tooltip + "Learn More" navigation
- Free user upgrade CTA integration
- Unit tests for calculation logic + cache hook

### Out of Scope
- Server-side `calculateCategorySP` API calls (replaced by client-side calc)
- SP education screen content (link to existing screen or placeholder)
- Changing `PriceSuggestionCard` behavior (keep as-is for future pricing tiers feature)
- Historical SP earnings tracking (post-MVP)

---

## FILES TO CREATE

| File | Type | Purpose |
|------|------|---------|
| `p2p-kids-marketplace/src/components/listing/SPEarningsPreview.tsx` | NEW | Single-item SP estimate card |
| `p2p-kids-marketplace/src/components/bulk/BulkSPSummaryCard.tsx` | NEW | Bulk aggregate SP total card |
| `p2p-kids-marketplace/src/hooks/useCategorySPCache.ts` | NEW | AsyncStorage cache hook for category multipliers |
| `p2p-kids-marketplace/src/utils/spCalculations.ts` | NEW | Pure functions for SP math |
| `p2p-kids-marketplace/src/components/modals/SPInfoTooltip.tsx` | NEW | "What is SP?" tooltip component |

## FILES TO MODIFY

| File | Changes |
|------|---------|
| `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` | Add `<SPEarningsPreview>` after price input |
| `p2p-kids-marketplace/src/components/bulk/BulkItemCard.tsx` | Add `<SPEarningsPreview>` in payment preference section |
| `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx` | Add `<BulkSPSummaryCard>` above item list |
| `p2p-kids-marketplace/src/types/listing.ts` | Add `CategorySPMultiplier`, `SPEstimate` types |

---

## DETAILED REQUIREMENTS

### 1. SPEarningsPreview Component

**File:** `p2p-kids-marketplace/src/components/listing/SPEarningsPreview.tsx`

**Props:**
```typescript
interface SPEarningsPreviewProps {
  categoryId: string | null;
  price: number;
  isSubscriber: boolean;
  onLearnMore?: () => void;
  testID?: string;
}
```

**Behavior:**
- If `categoryId === null`: Show placeholder "💡 Select a category to see estimated SP earnings"
- If `categoryId === 'other'`: Show default 1.10x with disclaimer "⚠️ Base rate - may change after admin approval"
- If `price === 0` or `price === null`: Show "Enter price above to see estimate"
- If `isSubscriber === false`: Show estimate **grayed out** with:
  - Text: "🔒 You'll earn ~{X} SP (Upgrade to Kids Club+ to unlock)"
  - Upgrade button below estimate
- If `isSubscriber === true`: Show normal estimate with green checkmark
- Always show (i) icon next to "SP" label → taps open `<SPInfoTooltip>`

**Formula (client-side):**
```typescript
const earnedSP = Math.round(price * categoryMultiplier);
// No API call - multiplier fetched from AsyncStorage cache
```

**Visual States:**

```
┌─────────────────────────────────────────┐
│ 💡 Select a category to see estimated  │
│    SP earnings                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Swap Points Estimate ⓘ                 │
│ ✅ You'll earn: ~35 SP                  │
│ *Estimated based on list price          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Swap Points Estimate ⓘ                 │
│ 🔒 You'll earn: ~35 SP                  │
│ (Upgrade to Kids Club+ to unlock)      │
│ [Upgrade Now]                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Swap Points Estimate ⓘ                 │
│ ⚠️ You'll earn: ~33 SP (1.10x base)     │
│ Rate may change after admin approval   │
└─────────────────────────────────────────┘
```

**Accessibility:**
- (i) icon: `accessibilityLabel="What are Swap Points? Tap to learn more"`
- Upgrade button: `accessibilityLabel="Upgrade to Kids Club Plus to earn Swap Points"`
- Gray state announces: "Swap Points locked. Upgrade required."

---

### 2. BulkSPSummaryCard Component

**File:** `p2p-kids-marketplace/src/components/bulk/BulkSPSummaryCard.tsx`

**Props:**
```typescript
interface BulkSPSummaryCardProps {
  items: BulkItem[];
  isSubscriber: boolean;
  onLearnMore?: () => void;
  testID?: string;
}
```

**Calculation:**
```typescript
const totalSP = items
  .filter(item => item.includeInPublish && item.category_id && item.price > 0)
  .reduce((sum, item) => {
    const multiplier = getCachedMultiplier(item.category_id) || 1.10;
    return sum + Math.round(item.price * multiplier);
  }, 0);
```

**Visual:**
```
┌───────────────────────────────────────────────┐
│ 📊 Bulk Listing SP Summary                   │
├───────────────────────────────────────────────┤
│ Total items: 8                                │
│ Total estimated SP: ~240 SP ⓘ                │
│                                               │
│ Per-item breakdown:                           │
│ • Toys (4 items):      ~120 SP (1.20x)       │
│ • Clothes (3 items):   ~90 SP (1.10x)        │
│ • Books (1 item):      ~30 SP (1.30x)        │
│                                               │
│ 🔒 Upgrade to Kids Club+ to earn these points│
│ [Upgrade Now]                                 │
└───────────────────────────────────────────────┘
```

**Subscriber version** (no lock, no CTA):
```
┌───────────────────────────────────────────────┐
│ 📊 Bulk Listing SP Summary                   │
├───────────────────────────────────────────────┤
│ ✅ You'll earn ~240 SP when these items sell │
│                                               │
│ • Toys (4 items):      ~120 SP (1.20x)       │
│ • Clothes (3 items):   ~90 SP (1.10x)        │
│ • Books (1 item):      ~30 SP (1.30x)        │
└───────────────────────────────────────────────┘
```

**Placement:** Directly above item list, below photo grouping controls

---

### 3. useCategorySPCache Hook

**File:** `p2p-kids-marketplace/src/hooks/useCategorySPCache.ts`

**Purpose:** Fetch category SP multipliers once, cache in AsyncStorage for 24h, refresh on mount if stale

**API:**
```typescript
interface CategorySPMultiplier {
  category_id: string;
  category_name: string;
  sp_earning_multiplier: number;
  last_updated: string; // ISO timestamp
}

export function useCategorySPCache() {
  const [multipliers, setMultipliers] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Returns multiplier for categoryId, or 1.10 default
  const getMultiplier = (categoryId: string | null): number => {
    if (!categoryId) return 1.10;
    return multipliers.get(categoryId) || 1.10;
  };

  // Force refresh from API
  const refresh = async () => { ... };

  return { multipliers, loading, error, getMultiplier, refresh };
}
```

**Storage Key:** `@kids_marketplace:category_sp_multipliers`

**Cache Logic:**
1. On mount: Read from AsyncStorage
2. If missing OR `last_updated > 24h ago`: Fetch from `getCategoriesWithCounts()` 
3. Store as `{ data: CategorySPMultiplier[], cachedAt: ISO_timestamp }`
4. Parse into `Map<categoryId, multiplier>` for O(1) lookup

**Error Handling:**
- Network failure → use stale cache if available, show warning toast
- No cache + network fail → default all to 1.10x, show error banner

---

### 4. SP Calculation Utilities

**File:** `p2p-kids-marketplace/src/utils/spCalculations.ts`

```typescript
/**
 * Calculate SP earnings for a single item
 * @param price Item price in dollars
 * @param multiplier Category SP multiplier (1.05 - 1.40)
 * @returns Rounded SP amount
 */
export function calculateEarnedSP(price: number, multiplier: number): number {
  if (price <= 0 || multiplier < 1.05 || multiplier > 1.40) return 0;
  return Math.round(price * multiplier);
}

/**
 * Calculate max SP buyer can spend (not needed for seller preview, but included for completeness)
 * @param price Item price in dollars
 * @param spendingCapPercent Category spending cap (50-80%)
 * @returns Floored SP amount
 */
export function calculateMaxSpendSP(price: number, spendingCapPercent: number): number {
  if (price <= 0 || spendingCapPercent < 50 || spendingCapPercent > 80) return 0;
  return Math.floor(price * (spendingCapPercent / 100));
}

/**
 * Aggregate SP for bulk listing
 */
export function calculateBulkTotalSP(
  items: Array<{ price: number; category_id: string }>,
  multipliers: Map<string, number>
): number {
  return items.reduce((sum, item) => {
    const mult = multipliers.get(item.category_id) || 1.10;
    return sum + calculateEarnedSP(item.price, mult);
  }, 0);
}

/**
 * Group items by category for bulk summary breakdown
 */
export function groupBulkItemsByCategory(
  items: Array<{ category_id: string; category_name: string; price: number }>,
  multipliers: Map<string, number>
): Array<{ categoryName: string; itemCount: number; totalSP: number; multiplier: number }> {
  const grouped = new Map<string, { name: string; count: number; total: number; mult: number }>();
  
  items.forEach(item => {
    const mult = multipliers.get(item.category_id) || 1.10;
    const sp = calculateEarnedSP(item.price, mult);
    
    if (!grouped.has(item.category_id)) {
      grouped.set(item.category_id, { 
        name: item.category_name, 
        count: 0, 
        total: 0, 
        mult 
      });
    }
    
    const group = grouped.get(item.category_id)!;
    group.count++;
    group.total += sp;
  });
  
  return Array.from(grouped.values())
    .map(g => ({ 
      categoryName: g.name, 
      itemCount: g.count, 
      totalSP: g.total, 
      multiplier: g.mult 
    }))
    .sort((a, b) => b.totalSP - a.totalSP); // Highest SP first
}
```

**Unit Tests Required:**
- `calculateEarnedSP(50, 1.20)` → `60`
- `calculateEarnedSP(33.33, 1.10)` → `37` (rounded)
- `calculateEarnedSP(0, 1.10)` → `0` (invalid price)
- `calculateEarnedSP(50, 0.9)` → `0` (invalid multiplier)
- `groupBulkItemsByCategory` with mixed categories → correct aggregation

---

### 5. SPInfoTooltip Component

**File:** `p2p-kids-marketplace/src/components/modals/SPInfoTooltip.tsx`

**Props:**
```typescript
interface SPInfoTooltipProps {
  visible: boolean;
  onClose: () => void;
  onLearnMore?: () => void; // Navigates to SP education screen
}
```

**Content:**
```
┌──────────────────────────────────────┐
│ What are Swap Points (SP)?          │
├──────────────────────────────────────┤
│ SP are rewards you earn when you    │
│ sell items. Different categories    │
│ earn different rates (1.05x-1.40x). │
│                                      │
│ Example:                             │
│ Sell a book for $30 → earn ~39 SP   │
│ (Books category has 1.30x rate)     │
│                                      │
│ ⚠️ Estimates based on list price.   │
│ Actual SP earned when item sells.   │
│                                      │
│ [Learn More]  [Close]                │
└──────────────────────────────────────┘
```

**Triggered by:** Tapping (i) icon in `<SPEarningsPreview>` or `<BulkSPSummaryCard>`

---

## INTEGRATION POINTS

### ItemCreateScreen.tsx

**Location:** After price input, before "Payment Preference" section

**Pseudocode:**
```tsx
const { getMultiplier, loading: cacheLoading } = useCategorySPCache();
const [showSPTooltip, setShowSPTooltip] = useState(false);

// ... existing code ...

{/* Price Input */}
<TextInput ... />

{/* NEW: SP Earnings Preview */}
{!cacheLoading && (
  <SPEarningsPreview
    categoryId={selectedCategory?.id || null}
    price={parseFloat(priceInput) || 0}
    isSubscriber={canAcceptSP}
    onLearnMore={() => setShowSPTooltip(true)}
    testID="single-sp-preview"
  />
)}

{/* Payment Preference (existing) */}
<View style={styles.spSection}>
  ...
</View>

{/* Tooltip Modal */}
<SPInfoTooltip
  visible={showSPTooltip}
  onClose={() => setShowSPTooltip(false)}
  onLearnMore={() => {
    setShowSPTooltip(false);
    navigation.navigate('SPEducation'); // Placeholder - create screen or link to FAQ
  }}
/>
```

---

### BulkItemCard.tsx

**Location:** In "Payment Preference" section, after toggle

**Pseudocode:**
```tsx
{/* Existing payment preference toggle */}
<Switch ... />

{/* NEW: Per-item SP preview */}
{item.category_id && item.price > 0 && (
  <SPEarningsPreview
    categoryId={item.category_id}
    price={item.price}
    isSubscriber={canAcceptSP}
    onLearnMore={() => setShowSPTooltip(true)}
    testID={`bulk-item-${item.id}-sp-preview`}
  />
)}
```

---

### BulkListingCreateScreen.tsx

**Location:** Above `PhotoGroupingView` / item list, below header

**Pseudocode:**
```tsx
const { getMultiplier } = useCategorySPCache();

// Recalculate whenever items change
const bulkItems = useMemo(() => 
  groupedItems
    .filter(i => i.includeInPublish)
    .map(i => ({
      category_id: i.category_id,
      category_name: i.category_name,
      price: i.price
    })),
  [groupedItems]
);

return (
  <ScrollView>
    {/* Existing photo grouping controls */}
    
    {/* NEW: Bulk SP Summary Card */}
    {bulkItems.length > 0 && (
      <BulkSPSummaryCard
        items={bulkItems}
        isSubscriber={canAcceptSP}
        onLearnMore={() => setShowSPTooltip(true)}
        testID="bulk-sp-summary"
      />
    )}
    
    {/* Existing item list */}
    <PhotoGroupingView ... />
  </ScrollView>
);
```

---

## ACCEPTANCE CRITERIA

### Functional Requirements
- [ ] Single item listing shows SP estimate when category + price set
- [ ] Bulk listing shows per-item SP in each `BulkItemCard`
- [ ] Bulk listing shows aggregate summary card above item list
- [ ] Free users see grayed-out estimates with "🔒 Upgrade" CTA
- [ ] Subscribers see normal (non-grayed) estimates with ✅ icon
- [ ] "Other" category shows 1.10x default with disclaimer
- [ ] Tapping (i) icon opens tooltip with SP explanation
- [ ] Tapping "Learn More" navigates to SP education screen (or placeholder)
- [ ] Category multipliers cached in AsyncStorage for 24h
- [ ] Cache auto-refreshes on mount if stale (> 24h old)
- [ ] Network failure uses stale cache with warning (no crash)
- [ ] Missing cache defaults to 1.10x for all categories

### Performance Requirements
- [ ] SP calculation completes in < 10ms (client-side math)
- [ ] No API calls during typing/category changes (cache hit)
- [ ] Cache load on mount < 100ms (read from AsyncStorage)
- [ ] Bulk summary recalculates in < 50ms for 15 items

### UI/UX Requirements
- [ ] SP preview updates within 300ms of price change (debounced)
- [ ] Tooltip opens/closes with smooth animation (200ms fade)
- [ ] Disclaimer (i) icon touch target ≥ 44×44pt
- [ ] Upgrade button clearly visible for free users
- [ ] Bulk summary card visually distinct (border, background color)
- [ ] Per-category breakdown sorted by highest SP first

### Accessibility Requirements
- [ ] (i) icon has `accessibilityLabel="What are Swap Points?"`
- [ ] Upgrade button announces "Upgrade to earn Swap Points"
- [ ] SP values announced with VoiceOver (e.g., "35 Swap Points")
- [ ] Tooltip modal traps focus, Esc closes, focus returns to trigger
- [ ] Grayed-out state announces "locked, upgrade required"

### Testing Requirements
- [ ] Unit tests for `spCalculations.ts` (5 test cases minimum)
- [ ] Unit tests for `useCategorySPCache` (cache hit/miss/stale/network fail)
- [ ] Component tests for `SPEarningsPreview` (4 states: loading, no category, free user, subscriber)
- [ ] Component tests for `BulkSPSummaryCard` (empty, single category, multi-category)
- [ ] Integration test: Mock category fetch → verify cache write → verify cache read on re-mount
- [ ] Maestro flow: Create item → select category → enter price → verify SP estimate visible

---

## TYPE DEFINITIONS

**Add to `p2p-kids-marketplace/src/types/listing.ts`:**

```typescript
/**
 * Category SP multiplier cached from admin config
 */
export interface CategorySPMultiplier {
  category_id: string;
  category_name: string;
  sp_earning_multiplier: number; // 1.05 - 1.40
  sp_spending_cap_percent: number; // 50 - 80 (not used in seller preview, but included for completeness)
}

/**
 * Cached category multipliers with TTL
 */
export interface CategorySPCache {
  data: CategorySPMultiplier[];
  cachedAt: string; // ISO timestamp
}

/**
 * SP earnings estimate result
 */
export interface SPEstimate {
  earnedSP: number;
  multiplier: number;
  categoryName: string;
  isDefault: boolean; // true if "Other" category or fallback
}

/**
 * Bulk SP summary breakdown by category
 */
export interface BulkSPCategoryBreakdown {
  categoryName: string;
  itemCount: number;
  totalSP: number;
  multiplier: number;
}
```

---

## ERROR HANDLING

| Scenario | Behavior | User Message |
|----------|----------|--------------|
| **Network fail on initial fetch** | Use stale cache if available; else default to 1.10x | Toast: "⚠️ Using offline SP rates" |
| **No cache + network fail** | Show placeholder "Unable to load SP rates" + default 1.10x | Error banner: "SP estimates unavailable. Try again later." |
| **Invalid category_id** | Default to 1.10x | No error shown (silent fallback) |
| **Price = 0 or negative** | Show "Enter price to see estimate" | No error shown |
| **Cache corrupted (parse error)** | Clear cache, refetch | Toast: "Refreshing SP rates..." |

---

## PERFORMANCE OPTIMIZATIONS

1. **Debounce price input:** 300ms delay before recalculating SP
2. **Memoize bulk calculations:** Only recalc when `items` array reference changes
3. **Lazy load tooltip:** Don't mount until first (i) tap
4. **AsyncStorage read once:** Cache in memory after first load (Map<categoryId, multiplier>)
5. **Avoid re-renders:** Use `React.memo` on `SPEarningsPreview` and `BulkSPSummaryCard`

---

## AI PROMPT FOR CURSOR

````text
TASK: Implement LISTING-V3-011 — SP Earnings Preview for Single & Bulk Listing

CONTEXT:
- Kids P2P Marketplace mobile app (React Native + Expo)
- ItemCreateScreen (LISTING-V3-005) and BulkListingCreateScreen (LISTING-V3-006) exist
- Category SP multipliers (1.05x - 1.40x) configured in MODULE-12 V3 admin portal
- PriceSuggestionCard component exists but NOT used in current flow
- BRD requirement US-SUB-002: "If 'Accept SP' selected, see estimated SP earnings"

YOUR TASK:
Create 5 new components + 1 hook to show real-time SP earnings estimates:

1. **SPEarningsPreview.tsx** (single-item preview card)
   - Props: categoryId, price, isSubscriber, onLearnMore
   - States: no category, free user (grayed + CTA), subscriber (normal), "Other" category
   - Formula: Math.round(price * categoryMultiplier)
   - Always show (i) icon → opens tooltip

2. **BulkSPSummaryCard.tsx** (aggregate summary above bulk item list)
   - Shows total SP + per-category breakdown
   - Free user version: grayed + upgrade CTA
   - Subscriber version: green checkmark, no CTA

3. **useCategorySPCache.ts** hook
   - Fetch categories with multipliers from `getCategoriesWithCounts()`
   - Cache in AsyncStorage: key `@kids_marketplace:category_sp_multipliers`, TTL 24h
   - Return `getMultiplier(categoryId)` function (O(1) Map lookup)
   - Auto-refresh if stale on mount

4. **spCalculations.ts** utility
   - `calculateEarnedSP(price, multiplier)` → Math.round(price * mult)
   - `groupBulkItemsByCategory(items, multipliers)` → category breakdown array
   - Pure functions, no side effects

5. **SPInfoTooltip.tsx** modal
   - "What are Swap Points?" explanation
   - Example: "Sell book for $30 → earn ~39 SP (1.30x)"
   - Disclaimer: "Estimates based on list price"
   - [Learn More] button → navigate to SPEducation screen

INTEGRATION:
- Modify `ItemCreateScreen.tsx`: Add <SPEarningsPreview> after price input
- Modify `BulkItemCard.tsx`: Add <SPEarningsPreview> in payment preference section
- Modify `BulkListingCreateScreen.tsx`: Add <BulkSPSummaryCard> above item list

CRITICAL RULES:
- Client-side calculation ONLY (no API calls during typing)
- 300ms debounce on price input changes
- Cache multipliers in AsyncStorage for 24h
- Default to 1.10x if category not found
- Free users see grayed-out estimate + "🔒 Upgrade to earn SP" CTA
- "Other" category shows 1.10x + disclaimer "may change after admin approval"
- (i) icon tooltip accessible (44×44pt touch target)
- All text must be screen-reader friendly

OUTPUT:
- 5 new component files
- 1 new hook file
- 1 new utility file
- 3 modified screen files (add <SPEarningsPreview> / <BulkSPSummaryCard>)
- Type definitions in `types/listing.ts`
- Unit tests for `spCalculations.ts` and `useCategorySPCache.ts`

VERIFICATION:
After implementation, manually test:
1. Create single item → select "Toys" → enter $50 → verify "~60 SP" shows (1.20x)
2. Free user → verify estimate grayed + upgrade button visible
3. Select "Other" → verify "~55 SP (1.10x base)" + disclaimer
4. Tap (i) icon → tooltip opens with explanation
5. Bulk listing 3 items → verify summary card shows total + breakdown
6. Network fail → verify stale cache used, no crash
````

---

## VERIFICATION CHECKLIST (Add to MODULE-04-VERIFICATION-V3.md)

Add new section **§ 11. SP EARNINGS PREVIEW (LISTING-V3-011)**:

- [ ] `SPEarningsPreview` component renders in `ItemCreateScreen`
- [ ] SP estimate updates within 300ms of price change (debounced)
- [ ] Placeholder shown when category not selected: "Select category to see estimate"
- [ ] Free user sees grayed estimate + "🔒 Upgrade" CTA
- [ ] Subscriber sees normal estimate with ✅ checkmark
- [ ] "Other" category shows 1.10x + disclaimer "may change after admin approval"
- [ ] (i) icon opens `SPInfoTooltip` with explanation
- [ ] "Learn More" navigates to SP education screen
- [ ] `BulkItemCard` shows per-item SP estimate
- [ ] `BulkSPSummaryCard` shows aggregate total above item list
- [ ] Bulk summary shows per-category breakdown, sorted by highest SP
- [ ] Category multipliers cached in AsyncStorage (`@kids_marketplace:category_sp_multipliers`)
- [ ] Cache auto-refreshes if > 24h old
- [ ] Network failure uses stale cache (no crash)
- [ ] Missing cache defaults to 1.10x for all categories
- [ ] Unit tests pass for `spCalculations.ts` (5 test cases)
- [ ] Unit tests pass for `useCategorySPCache.ts` (cache scenarios)
- [ ] Component tests pass for `SPEarningsPreview` (4 states)
- [ ] Maestro flow: create item → verify SP estimate appears
- [ ] Accessibility: (i) icon ≥ 44×44pt, announces "What are Swap Points?"
- [ ] VoiceOver reads SP values correctly ("35 Swap Points")

---

## DEPENDENCIES

### Prerequisite Tasks (Must Be Complete)
- ✅ LISTING-V3-005 (ItemCreateScreen photo-first flow)
- ✅ LISTING-V3-006 (BulkListingCreateScreen + BulkItemCard)
- ✅ MODULE-12 V3 (Category SP multipliers configured in DB)
- ✅ ADMIN-V3-007 (CategoryService.getCategoriesWithCounts exists)

### Concurrent Tasks (Can Run in Parallel)
- None - this is a leaf task

### Blocked Tasks (Waiting on This)
- None currently

---

## TESTING STRATEGY

### Unit Tests (Jest)

**File:** `src/utils/__tests__/spCalculations.test.ts`
- Test `calculateEarnedSP` with valid inputs
- Test edge cases: zero price, negative price, invalid multiplier
- Test rounding: 33.33 × 1.10 = 37 (not 36.663)
- Test `groupBulkItemsByCategory` aggregation

**File:** `src/hooks/__tests__/useCategorySPCache.test.tsx`
- Mock AsyncStorage + API fetch
- Test cache hit (within 24h)
- Test cache miss (> 24h → refetch)
- Test network failure with stale cache
- Test network failure with no cache (defaults to 1.10x)

### Component Tests (React Testing Library)

**File:** `src/components/listing/__tests__/SPEarningsPreview.test.tsx`
- Render with no category → shows placeholder
- Render with category + price → shows estimate
- Render for free user → grayed out + CTA
- Render for subscriber → normal + checkmark
- Tap (i) icon → tooltip opens

**File:** `src/components/bulk/__tests__/BulkSPSummaryCard.test.tsx`
- Empty items → shows "No items to estimate"
- Single category → shows simple total
- Multi-category → shows breakdown sorted by SP

### Integration Test (Maestro)

**File:** `p2p-kids-marketplace/maestro/flows/sp-earnings-preview.yaml`
```yaml
appId: com.kids.marketplace
---
- launchApp
- tapOn: "Create Listing"
- assertVisible: "Select category to see estimate"
- tapOn: "Category"
- tapOn: "Toys"
- assertVisible: "Toys"
- tapOn: "Price"
- inputText: "50"
- assertVisible: "~60 SP" # Assuming Toys = 1.20x
- tapOn: "ⓘ" # Info icon
- assertVisible: "What are Swap Points?"
- tapOn: "Close"
```

---

## ROLLOUT PLAN

### Phase 1: Single Item Preview (2h)
1. Create `SPEarningsPreview.tsx` component
2. Create `useCategorySPCache.ts` hook
3. Create `spCalculations.ts` utility
4. Integrate into `ItemCreateScreen.tsx`
5. Write unit tests

### Phase 2: Bulk Preview (1.5h)
1. Create `BulkSPSummaryCard.tsx` component
2. Add per-item preview to `BulkItemCard.tsx`
3. Add summary card to `BulkListingCreateScreen.tsx`
4. Write component tests

### Phase 3: Tooltip & Polish (0.5h)
1. Create `SPInfoTooltip.tsx` modal
2. Wire "Learn More" navigation
3. Add accessibility labels
4. Maestro flow test

---

## SUCCESS METRICS (Post-Launch Tracking)

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| "Accept SP" adoption rate | TBD | +20% | % of listings with SP enabled |
| Free → Subscriber conversion (from SP preview CTA) | TBD | +5% | Upgrade attribution tracking |
| SP tooltip engagement | N/A | >30% | % of sellers who tap (i) icon |
| Average SP per listing | TBD | Baseline | Track actual SP earned vs estimates |

---

## NOTES

- **Why not use `PriceSuggestionCard`?** It's designed for pricing tier selection + SP preview together. This task focuses purely on SP education/transparency without changing pricing UX.
- **Why client-side calculation?** Performance. Server-side `calculateCategorySP` would add 200-500ms latency per keystroke.
- **Why show to free users?** Conversion driver. "See what you're missing" is more powerful than hiding features.
- **Edge case: Category deleted after caching?** Default to 1.10x silently. Admin won't delete active categories (item_count > 0 check enforced).

---

**END OF TASK LISTING-V3-011**
