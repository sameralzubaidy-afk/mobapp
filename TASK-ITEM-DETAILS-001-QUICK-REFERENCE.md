# QUICK REFERENCE: Item Details Screen Changes

## 3 Key Changes Made

### ✅ 1. Contact Seller → Messaging Integration
**When user clicks "💬 Contact Seller":**
- Checks if active trade exists
- If YES: Opens Chat screen with trade ID
- If NO: Shows alert "Start a Trade First"

**Code Location:** `ItemDetailScreen.tsx:202-240`

### ✅ 2. Seller Name Masking (No Active Trade)
**Display Logic:**
- Active trade? Show seller name: "🔒 Seller Info Hidden"
- Avatar placeholder shows seller initial if unmasked, "?" if masked

**Code Location:** `ItemDetailScreen.tsx:311-314`

### ✅ 3. Seller Rating Always Visible
**Rating Display:**
- Always shown: "⭐ 4.5 (12 reviews)" or "No rating yet"
- Independent of trade status
- Loaded from reviews table

**Code Location:** `ItemDetailScreen.tsx:469-479`

---

## Files Changed

| File | Function | Status |
|------|----------|--------|
| `src/services/trade.ts` | Added `hasActiveTradeBetween()` & `getSellerRating()` | ✅ |
| `src/screens/home/ItemDetailScreen.tsx` | Complete seller section refactor | ✅ |

---

## UI Changes

### OLD Seller Section:
```
👤 Seller
[Avatar] Seller Name
         Contact Seller →
```

### NEW Seller Section:
```
👤 Seller Info
[Avatar] Seller Name (or 🔒 Hidden)
         ⭐ 4.5 (12 reviews)
         [💬 Contact] [👤 View Profile]
         "Start a trade to see seller details"
```

---

## State Variables Added

```tsx
const [hasActiveTrade, setHasActiveTrade] = useState(false);
const [sellerRating, setSellerRating] = useState<SellerRatingInfo | null>(null);
const [loadingSellerInfo, setLoadingSellerInfo] = useState(false);
```

---

## Test Commands

```bash
# Verify no TypeScript errors
cd p2p-kids-marketplace
npm run type-check

# Verify no lint errors
npm run lint

# Check trade.ts exports
grep "export async function has\|export async function getS" src/services/trade.ts
```

---

## Flow Diagram

```
User opens item details
├─ Load listing data
├─ Load buyer subscription
└─ Load trade status & rating
   ├─ hasActiveTradeBetween(buyer, seller) → true/false
   └─ getSellerRating(seller) → { avg, count }

Seller section rendering:
├─ IF no active trade:
│  ├─ Show: "🔒 Seller Info Hidden"
│  ├─ Show: Rating (always)
│  └─ Buttons say "Start a Trade First"
│
└─ IF active trade exists:
   ├─ Show: Seller name
   ├─ Show: Rating
   └─ Contact/Profile buttons work

Click "Contact Seller" (if active trade):
├─ Query trades table for trade ID
├─ Get first (pending or in_progress)
└─ Navigate to Chat(tradeId)
```

---

## Seller Info Masking Rules

| Condition | Name Shown? | Rating Shown? | Buttons Enabled? |
|-----------|------------|---------------|-----------------|
| Not logged in | ❌ | ✅ | ❌ |
| No active trade | ❌ | ✅ | ❌ (alert) |
| Active trade | ✅ | ✅ | ✅ |
| Viewing own item | N/A | N/A | N/A |

---

## Expected Behavior After Changes

### Scenario 1: Browse Item (No Trade)
1. Open item details
2. Seller name shows "🔒 Seller Info Hidden"
3. Seller rating shows "⭐ 4.5 (12 reviews)"
4. Click "Contact Seller" → Alert: "Start a Trade First"

### Scenario 2: After Initiating Trade
1. User initiates trade on item
2. Navigate back to item details
3. Seller name now shows actual name
4. Seller rating still visible
5. Click "Contact Seller" → Opens Chat screen

### Scenario 3: Seller with No Reviews
1. Item from new seller
2. Seller name masked/shown based on trade status
3. Rating shows "No rating yet"
4. All functionality works normally

---

## Import References

**In ItemDetailScreen.tsx:**
```tsx
import { hasActiveTradeBetween, getSellerRating } from '@/services/trade';
import { supabase } from '@/config/supabase';
```

**Functions from trade.ts:**
```tsx
// Returns true if active trade exists
hasActiveTradeBetween(buyerId: string, sellerId: string)

// Returns rating info with average and count
getSellerRating(sellerId: string)
```

---

## Notes for Testing

1. **Use 2+ test accounts** to verify trade logic
2. **Mobile testing:** Test on both iOS simulator and Android emulator
3. **Edge cases:**
   - Very new seller (0 reviews)
   - Seller with many reviews (100+)
   - Self-purchase attempt (viewing own item)
4. **Performance:** Rating loads asynchronously (shows loading indicator)
5. **Error handling:** If rating load fails, shows nothing (graceful fallback)

---

**Document Version:** 1.0  
**Date:** January 18, 2026  
**Status:** READY FOR TESTING
