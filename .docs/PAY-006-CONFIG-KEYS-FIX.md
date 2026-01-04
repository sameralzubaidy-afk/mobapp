# PAY-006: Admin Config Keys Fix

## Issue #4: Missing Admin Configuration Keys

**Error:** `FunctionsHttpError: Edge Function returned a non-2xx status code`

**Root Cause:** `get_admin_payout_config` function was looking for config keys that don't exist

**What was wrong:**
```sql
-- BROKEN: Keys don't exist in admin_config table
SELECT value INTO v_stripe_fixed FROM admin_config WHERE key = 'stripe_payout_fee_fixed_cents'...
SELECT value INTO v_stripe_pct FROM admin_config WHERE key = 'stripe_payout_fee_percentage'...
```

**What was fixed:**
```sql
-- FIXED: Use correct key names from migration 074
SELECT value INTO v_stripe_fixed FROM admin_config WHERE key = 'payout_fee_stripe_fixed_cents'...
SELECT value INTO v_stripe_pct FROM admin_config WHERE key = 'payout_fee_stripe_percentage'...
```

## Required Migrations

The payout system requires these migrations to be run in order:

1. **073_seller_payouts.sql** - Creates `seller_payout_methods` and `seller_payouts` tables
2. **074_admin_payout_fee_config.sql** - Adds payout fee config keys to `admin_config`
3. **075_add_minimum_withdrawal_to_admin_config.sql** - Adds minimum withdrawal config
4. **077_add_auto_payout_admin_config.sql** - Adds auto-payout toggle
5. **078_payout_router_integration.sql** - Creates payout functions (FIXED)

## Config Keys Required

| Key | Migration | Default Value | Description |
|-----|-----------|---------------|-------------|
| `enable_automatic_seller_payout` | 077 | `false` | Enable auto-payout on trade completion |
| `minimum_withdrawal_amount_cents` | 075 | `500` | Minimum withdrawal ($5.00) |
| `payout_fee_stripe_fixed_cents` | 074 | `25` | Stripe fixed fee ($0.25) |
| `payout_fee_stripe_percentage` | 074 | `0.25` | Stripe percentage (0.25%) |
| `payout_fee_paypal_percentage` | 074 | `2.0` | PayPal percentage (2%) |
| `payout_fee_paypal_cap_cents` | 074 | `2000` | PayPal cap ($20.00) |

## Testing

**Test Script:** `.docs/PAY-006-COMPREHENSIVE-SETUP-TEST.sql`

**Verification Steps:**
1. Check all tables exist (seller_payout_methods, seller_payouts, admin_config)
2. Check all functions exist (get_admin_payout_config, etc.)
3. Check all config keys exist with proper values
4. Test `get_admin_payout_config()` returns valid data
5. Test fee calculations work correctly

## Migration Status

**File:** `supabase/migrations/078_payout_router_integration.sql`
**Status:** ✅ FIXED - Config key names corrected
**Function:** `get_admin_payout_config()`
**Impact:** Function now finds existing config keys instead of returning NULL

## Confidence: 🟢 HIGH

- Config keys verified to exist in migrations 074, 075, 077 ✅
- Key names matched exactly against admin_config table ✅
- Function now uses correct key names ✅
- No syntax errors in updated code ✅