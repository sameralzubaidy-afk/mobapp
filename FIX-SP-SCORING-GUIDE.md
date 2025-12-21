# 🔴 CRITICAL FIX: SP Prioritization Scoring in Recommendations

## Issue Summary
**Users experiencing:**
- Items with `accepts_swap_points=true` are NOT sorted first for subscribers
- ALL items show `Score: 10.0` (no SP bonus being applied)
- SP-eligible items not getting higher priority than expected

**Root Cause:** The `get_recommendations` RPC function is not correctly prioritizing SP-eligible items for subscribers.

---

## What Was Wrong

### 1. **Affordability Bonus Calculation Error**
```sql
-- ❌ WRONG (dividing by 100)
WHEN v_can_spend_sp 
  AND i.price <= (v_user_sp_balance::NUMERIC / 100)  -- BUG: unnecessary /100
THEN 50
```

**Issue:** SP balance is already in points (e.g., `0`, `100`, `500`). Dividing by 100 makes the comparison wrong:
- Balance: 0 points
- 0 / 100 = 0
- Price $20 > 0, so affordability bonus fails

### 2. **Missing SECURITY DEFINER**
```sql
-- ❌ WRONG (missing security context)
LANGUAGE plpgsql
STABLE
AS $$
```

**Issue:** Without `SECURITY DEFINER`, the function runs as the calling user, which may have restricted RLS access.

### 3. **Subscription Status Lookup Issues**
```sql
-- ❌ POTENTIAL ISSUE (no LIMIT, error handling too verbose)
SELECT s.status
INTO v_subscription_tier
FROM subscriptions s
WHERE s.user_id = p_user_id;  -- Could return NULL or multiple rows
```

### 4. **Scoring Logic Unclear**
The original comments didn't make it clear that the SP bonus MUST apply regardless of wallet balance for new subscribers.

---

## The Fix

### ✅ Corrected Scoring Logic

```sql
-- Subscription Status Lookup (Clear & Simple)
SELECT s.status
INTO v_subscription_tier
FROM subscriptions s
WHERE s.user_id = p_user_id
LIMIT 1;  -- Take first result if multiple exist

v_subscription_tier := COALESCE(v_subscription_tier, 'free');
v_can_spend_sp := (v_subscription_tier IN ('trial', 'active', 'grace'));

-- Scoring Calculation
CASE 
  WHEN i.accepts_swap_points AND v_can_spend_sp 
  THEN 100  -- ✅ +100 for SP-eligible items (subscribers only)
  ELSE 0
END +
CASE 
  WHEN v_can_spend_sp 
    AND v_user_sp_balance > 0  -- ✅ Only if balance > 0
    AND i.price <= v_user_sp_balance::NUMERIC  -- ✅ Direct comparison (no /100)
  THEN 50
  ELSE 0
END +
10  -- ✅ Base score for all items
```

### Expected Scores:

| User Type | Item Type | Has Balance | Price | Score | Example |
|-----------|-----------|-------------|-------|-------|---------|
| Subscriber (trial) | SP-eligible | 0 | $20 | **110** | ✅ FIXED |
| Subscriber (trial) | SP-eligible | 100 | $20 | **160** | Affordable |
| Subscriber (trial) | Cash-only | 0 | $20 | **10** | Not SP |
| Free user | SP-eligible | N/A | $20 | **10** | No bonus |
| Free user | Cash-only | N/A | $20 | **10** | No bonus |

---

## How to Apply the Fix

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** (left sidebar)

### Step 2: Copy the Fix
Copy the entire content of:
```
APPLY-SCORING-FIX-DIRECT.sql
```

### Step 3: Execute in Supabase
1. Paste the SQL into the SQL Editor
2. Click **▶ Run** (or press Cmd+Enter on Mac / Ctrl+Enter on Windows)
3. Wait for completion
4. You should see: "CREATE FUNCTION" response

### Step 4: Verify the Fix
Run this test query in the same SQL Editor:

```sql
-- Test with a known subscriber user
SELECT 
  id,
  title,
  accepts_swap_points,
  price,
  score
FROM get_recommendations('5861bf0e-a925-4f2e-8e36-5db45e10608d'::UUID, 10)
ORDER BY score DESC
LIMIT 10;
```

**Expected Results:**
- First 5-10 rows: `accepts_swap_points=true`, `score >= 110`
- Remaining rows: `accepts_swap_points=false`, `score=10`

---

## Testing in the App

### Tier 0: Quick Manual Test (5 minutes)

**With Subscriber Account (Already in app):**
1. Open the app
2. Go to **Home Tab** → **Recommendations Carousel**
3. **Expected:**
   - Top items show "✓ SP Eligible" badge
   - Items without badge appear lower in carousel
   - Carousel scrolls to show SP items first

**With Free Account:**
1. Create/login to a free account (no trial)
2. Go to **Home Tab** → **Recommendations Carousel**
3. **Expected:**
   - All items appear with same priority (mixed order)
   - No special grouping by SP eligibility

### Tier 1: Automated Smoke Test

Run the verification query in [scripts/smoke/recommendations.mjs](../../scripts/smoke/recommendations.mjs):

```bash
cd p2p-kids-marketplace
npm run test:smoke -- --flows discovery
```

**Expected Output:**
```
✅ Subscriber recommendations: SP items score 110+
✅ Free user recommendations: All items score 10
✅ Sorting correct: Higher scores appear first
```

---

## Detailed Breakdown of Changes

### File: `supabase/migrations/20251220000003_get_recommendations_rpc.sql`

**Changes Made:**
1. Added `DROP FUNCTION IF EXISTS ...` at top (allows re-running migration)
2. Added `SECURITY DEFINER` to function declaration
3. Simplified subscription lookup (removed verbose error handling)
4. Fixed affordability bonus: removed `/100` division
5. Updated scoring documentation with clear examples
6. Changed variable defaults: `v_subscription_tier TEXT DEFAULT NULL` (not 'free')

**Key Lines:**
- Line 32: Added `SECURITY DEFINER`
- Line 42-51: New simplified subscription lookup
- Line 88-110: Corrected scoring logic
- Line 107: Changed `i.price <= (v_user_sp_balance::NUMERIC / 100)` to `i.price <= v_user_sp_balance::NUMERIC`

---

## Why This Matters

### Before Fix:
```
Subscriber with 0 SP balance:
  SP-eligible item ($20) → Score = 10 ❌ (same as cash-only)
  Cash-only item ($20) → Score = 10 ❌
```

### After Fix:
```
Subscriber with 0 SP balance:
  SP-eligible item ($20) → Score = 110 ✅ (100 bonus for SP access)
  Cash-only item ($20) → Score = 10 ✅ (no bonus)
```

This encourages subscribers to see and purchase SP-eligible items, driving engagement with the Swap Points feature.

---

## Fallback: Manual Verification (If Automated Test Fails)

If the carousel still shows incorrect ordering, run this debug query:

```sql
-- Debug: See the actual scoring calculation
SELECT 
  i.id,
  i.title,
  i.accepts_swap_points,
  i.price,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.user_id = '5861bf0e-a925-4f2e-8e36-5db45e10608d'
      AND s.status IN ('trial', 'active', 'grace')
    ) THEN 'SUBSCRIBER'
    ELSE 'FREE'
  END as user_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.user_id = '5861bf0e-a925-4f2e-8e36-5db45e10608d'
      AND s.status IN ('trial', 'active', 'grace')
    )
    THEN CASE WHEN i.accepts_swap_points THEN 100 ELSE 0 END
    ELSE 0
  END as sp_bonus,
  CASE 
    WHEN i.accepts_swap_points THEN 100 ELSE 0
  END +
  CASE 
    WHEN i.accepts_swap_points THEN 50 ELSE 0
  END +
  10 as expected_score
FROM items i
WHERE i.status = 'available'
ORDER BY expected_score DESC
LIMIT 10;
```

---

## Common Issues & Solutions

| Symptom | Root Cause | Solution |
|---------|-----------|----------|
| "Function doesn't exist" error | Migration not applied | Run APPLY-SCORING-FIX-DIRECT.sql in SQL Editor |
| Still seeing all items score 10 | Subscription lookup failing | Check subscriptions table has status='trial' |
| Items in wrong order | RLS policies blocking | Verify function has SECURITY DEFINER |
| Balance check not working | Wallet doesn't exist | New subscribers get 0 balance (correct) |

---

## Summary of Commits

```
✅ fix(discovery): correct SP prioritization scoring logic in recommendations RPC
   - Fixed affordability bonus calculation
   - Added SECURITY DEFINER
   - Simplified subscription lookup
   - Updated migration file
   
✅ fix(discovery): critical SP prioritization scoring fixes  
   - Created APPLY-SCORING-FIX-DIRECT.sql for manual execution
   - Added debug queries
   - Comprehensive documentation
```

---

## Next Steps

1. **Apply the fix** using the instructions above
2. **Test in Supabase SQL Editor** with the verification query
3. **Test in the app** with a subscriber account
4. **Run smoke tests** to verify automated checks pass
5. **Monitor** the Recommendations carousel for correct sorting

**Expected Outcome:** Subscribers now see SP-eligible items ranked first in recommendations, driving engagement with Swap Points feature.
