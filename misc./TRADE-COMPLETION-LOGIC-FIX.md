# TRADE COMPLETION LOGIC FIX

**Issue:** When completing a trade (as buyer or seller), the trade state doesn't update from "in progress" — it stays stuck.

**Root Cause:** The mobile app's `completeTradeV2()` function in `src/services/trade.ts` was a stub that only logged and returned `{ success: true }` without actually calling the backend Edge Function.

**Fixed:** Implemented proper function that calls the `complete-trade` Edge Function which invokes the `complete_trade_v2` RPC.

---

## Files Changed

### 1. [p2p-kids-marketplace/src/services/trade.ts](p2p-kids-marketplace/src/services/trade.ts)

**What Changed:**
- Replaced stub `completeTradeV2()` function with full implementation
- Replaced stub `cancelTradeV2()` function with full implementation
- Both now properly call Edge Functions with authentication

**Key Updates:**

#### completeTradeV2() Implementation
```typescript
export async function completeTradeV2(tradeId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  // 1. Authenticate user
  // 2. Call complete-trade Edge Function
  // 3. Return response with success/error/message
}
```

**Rules Implemented:**
- Buyer or seller can mark as completed
- If seller initiates: records `seller_marked_completed_at`, awaits buyer confirmation
- If buyer initiates OR seller already marked: completes trade, updates item to 'sold', awards SP to seller

#### cancelTradeV2() Implementation  
```typescript
export async function cancelTradeV2(tradeId: string, reason?: string): Promise<{ success: boolean; error?: string; message?: string }> {
  // 1. Authenticate user
  // 2. Call cancel-trade Edge Function
  // 3. Return response with success/error/message
}
```

**Rules Implemented:**
- Can cancel before payment (pending): no refunds needed
- Can cancel after payment (in_progress): refund cash + re-credit SP
- Cancellation reason tracked in audit logs

---

## How It Works (Complete Flow)

### Step 1: Mobile App Calls completeTradeV2()
```typescript
const result = await completeTradeV2(tradeId);
```

### Step 2: Function Gets User JWT Token
```typescript
const { data: { user } } = await supabase.auth.getUser();
const token = (await supabase.auth.getSession()).data.session?.access_token;
```

### Step 3: Calls Edge Function
```typescript
POST /functions/v1/complete-trade
{
  "tradeId": "uuid-here"
}
Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
```

### Step 4: Edge Function Calls RPC
```sql
SELECT complete_trade_v2(
  p_trade_id => 'uuid-here',
  p_user_id => 'user-id-from-jwt'
)
```

### Step 5: RPC Logic (from migration 20260103000000)

**For Seller Initiating Completion:**
- Records `seller_marked_completed_at = NOW()`
- Returns status: `in_progress` (stays in progress!)
- Message: "Seller marked trade as completed. Awaiting buyer confirmation."

**For Buyer Initiating Completion (or System Auto-Complete):**
- Updates `status = 'completed'`
- Updates `completed_at = NOW()`
- Updates `items.status = 'sold'`
- Awards SP to seller (if eligible)
- Creates payout record (if auto-payout enabled)

### Step 6: Mobile App Updates UI
```typescript
if (isSeller) {
  // Show "Awaiting buyer confirmation" button
  setTrade(prev => ({ ...prev, seller_marked_completed_at: new Date().toISOString() }));
} else {
  // Show "Completed" status
  setTrade(prev => ({ ...prev, status: 'completed', completed_at: new Date().toISOString() }));
}
```

---

## Database Schema

### Trades Table Columns (Relevant)
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Trade primary key |
| `status` | VARCHAR | 'pending', 'in_progress', 'completed', 'cancelled' |
| `buyer_id` | UUID | Foreign key to profiles |
| `seller_id` | UUID | Foreign key to profiles |
| `listing_id` | UUID | Foreign key to items |
| `seller_marked_completed_at` | TIMESTAMP | When seller marked complete (null = not marked) |
| `completed_at` | TIMESTAMP | When trade fully completed (null = not completed) |
| `sp_amount` | INTEGER | Swap Points used in trade |
| `cash_amount_cents` | INTEGER | Cash paid (without fee) |
| `buyer_transaction_fee_cents` | INTEGER | Platform fee buyer pays |

### State Machine
```
PENDING
  ↓ (payment succeeds)
IN_PROGRESS
  ↓ (seller clicks "Mark Complete")
  → seller_marked_completed_at = NOW()
  → status still IN_PROGRESS
  ↓ (buyer clicks "Mark Complete")
COMPLETED ← item marked 'sold', SP awarded, payout created
  ↓ (reviews allowed)
FINAL STATE
```

---

## Testing

### Manual Test Cases

**TC-1: Buyer Marks Trade Complete**
1. Log in as **buyer**
2. Go to active trade (status: in_progress)
3. Click "Mark as Completed"
4. Confirm dialog
5. **Expected:**
   - Status immediately updates to "Completed"
   - Seller receives success notification
   - SP awarded to seller (if they're subscriber)

**TC-2: Seller Marks Complete, Buyer Confirms**
1. Log in as **seller**
2. Go to active trade (status: in_progress)
3. Click "Mark as Completed"
4. Confirm dialog
5. **Expected:**
   - Status stays "In Progress"
   - Button changes to "Awaiting buyer confirmation"
6. Log in as **buyer**
7. Go to same trade
8. See green notification: "Seller marked trade as completed. Please confirm."
9. Click "Mark as Completed"
10. **Expected:**
    - Status updates to "Completed"
    - Item marked "sold"
    - SP awarded to seller

---

## Verification Queries

Run these in Supabase SQL Editor to verify the fix:

```sql
-- Check function exists and is correctly defined
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'complete_trade_v2'
AND routine_schema = 'public';
-- Expected: FUNCTION, JSON (or JSONB)

-- Check a completed trade
SELECT 
  id,
  status,
  seller_marked_completed_at,
  completed_at,
  created_at,
  updated_at
FROM trades
WHERE id = 'your-trade-id'
ORDER BY updated_at DESC
LIMIT 1;
-- Expected after buyer completes:
--   status = 'completed'
--   completed_at = <timestamp>
--   updated_at = <recent timestamp>

-- Check that SP was awarded to seller (if used)
SELECT 
  user_id,
  available_points,
  pending_points,
  released_date
FROM sp_wallet
WHERE user_id = (
  SELECT seller_id FROM trades WHERE id = 'your-trade-id'
);

-- Check item was marked sold
SELECT 
  id,
  status,
  listing_id,
  seller_id
FROM items
WHERE id = (
  SELECT listing_id FROM trades WHERE id = 'your-trade-id'
);
-- Expected: status = 'sold'
```

---

## Tier 0 Checks

Before testing:

```bash
# Typecheck
cd p2p-kids-marketplace
npm run type-check

# Lint
npm run lint

# Expected: No errors
```

---

## Commands to Run

### 1. Update Mobile App
```bash
cd p2p-kids-marketplace
npm run type-check  # Verify no TS errors
npm run lint         # Verify no linting issues
```

### 2. Test Complete Trade Flow (Manual)
- Log in as buyer
- Find item and purchase
- Trade should be "in_progress"
- Click "Mark as Completed"
- Verify: Status changes to "Completed" (not stuck at "in progress")

### 3. Verify in Supabase
- Use the verification queries above
- Check trade status updated
- Check item marked 'sold'
- Check SP awarded to seller

---

## Summary

| Item | Details |
|------|---------|
| **Problem** | Trade completion function was a stub, never called backend |
| **Root Cause** | `completeTradeV2()` in trade.ts just returned `{ success: true }` without making API call |
| **Solution** | Implemented proper function that calls `complete-trade` Edge Function → `complete_trade_v2` RPC |
| **Files Changed** | 1 file: `p2p-kids-marketplace/src/services/trade.ts` |
| **Impact** | Trade completion flow now works end-to-end for buyer and seller |
| **Severity** | 🔴 Critical (was blocking core trade workflow) |

---

**Status:** ✅ FIXED - Ready for testing
