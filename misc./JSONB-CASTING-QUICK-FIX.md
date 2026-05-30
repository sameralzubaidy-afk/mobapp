# ⚡ Quick Fix - JSONB Casting Error

## Error
```
[ReferralRewards] Get config error: "cannot cast jsonb string to type boolean"
```

## Root Cause
- `sp_config.config_value` is JSONB type
- Code tried to cast JSONB directly to INTEGER/BOOLEAN
- PostgreSQL doesn't allow direct JSONB → scalar type casting

## Quick Fix
```sql
-- WRONG ❌
(config_value::INTEGER)
(config_value::BOOLEAN)

-- RIGHT ✅
(config_value #>> '{}')::INTEGER
(config_value #>> '{}')::BOOLEAN
```

**The `#>>'{}'` operator extracts JSONB to text, then cast to desired type.**

---

## What Was Fixed

### Migration 1: Seed Config Values
- Added `::jsonb` cast when inserting boolean values
- Ensures JSONB format from the start

### Migration 2: RPC Functions (4 fixes)
1. `get_referral_config_values()` - Fixed INTEGER casts
2. `apply_referral_code()` - Fixed INTEGER casts  
3. `get_referral_listing_config()` - Fixed INTEGER and BOOLEAN casts
4. `handle_referral_rewards_on_trade_completion()` - Fixed INTEGER cast

---

## Deploy

```bash
# Apply migrations
supabase migration up

# Verify
supabase migration list

# Test
# → Open app, check console, no errors should appear
```

---

## Verification Query

```sql
SELECT * FROM get_referral_listing_config();
```

Should return successfully with INT, INT, BOOLEAN columns (no casting error).

---

## Status
✅ Fixed
✅ Ready for deployment
✅ All 4 RPC functions updated
✅ All migrations are idempotent

