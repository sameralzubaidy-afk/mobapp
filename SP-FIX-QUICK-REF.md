# SP Mismatch Fix - Quick Reference

## What Was Broken
User sees **38 SP** in preview but only **35 SP** appears in wallet after trade completion.

## Root Cause
The `create-trade-offer` Edge Function wasn't storing the category's SP multiplier, so the backend trigger used a default multiplier of 1.0 instead of the correct 1.10.

**Formula difference:**
- Frontend: `FLOOR(35 × 1.10) = 38 SP` ✅
- Backend: `FLOOR(35 × 1.0) = 35 SP` ❌

## Files Fixed

### 1. `supabase/functions/create-trade-offer/index.ts`
- ✅ Now fetches `categories.sp_earning_multiplier` when loading item
- ✅ Stores it as `sp_category_multiplier` in trades table
- ✅ Line 118: Added category join in SELECT
- ✅ Line 271: Added `sp_category_multiplier` to INSERT

### 2. `supabase/migrations/20260607000002_hotfix_format_specifiers.sql`
- ✅ Smart fallback: tries `trades.sp_category_multiplier` first
- ✅ If NULL, fetches from `items → categories.sp_earning_multiplier`
- ✅ Final fallback: 1.0
- ✅ Handles both new trades (with multiplier) and old trades (without)

## Deploy Commands

```bash
# 1. Deploy Edge Function
supabase functions deploy create-trade-offer

# 2. Apply Migration
supabase db push
# OR paste migration into Supabase SQL Editor and run

# 3. (Optional) Backfill existing pending trades
# See SP-MISMATCH-FIX-GUIDE.md Step 3
```

## Verify Fix

```bash
# Run verification script
node verify-sp-calculation.mjs --recent

# Or check specific trade
node verify-sp-calculation.mjs <trade_id>

# Or run unit tests
node verify-sp-calculation.mjs --test
```

## Test in Simulator

1. Create a new offer (buyer offers 30 SP for $50 item in Animation category)
2. Review Offer screen should show: "33 SP releasing in 3 days"
3. Accept offer and complete trade
4. SP History should show: "+33 SP" (matches preview) ✅

## Verification Query

```sql
-- Check that new trades have multiplier stored
SELECT 
  id,
  status,
  sp_category_multiplier,
  created_at
FROM trades
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Should show sp_category_multiplier = 1.10 (or category's value)
```

## What This Fixes

✅ **New offers**: Will always match preview  
⚠️ **Old pending offers**: Will use fallback (still correct)  
❌ **Already completed**: Cannot be retroactively fixed

## Safe to Deploy?

YES - Backward compatible, no breaking changes.

## Questions?

See full guide: `SP-MISMATCH-FIX-GUIDE.md`
