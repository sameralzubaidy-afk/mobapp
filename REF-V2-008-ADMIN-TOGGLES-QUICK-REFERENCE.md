# REF-V2-008: Admin Toggles - Quick Reference

## 🚀 Quick Start (5 Minutes)

### Step 1: Apply Database Migration (1 min)
```sql
-- Copy contents of:
-- supabase/migrations/20260205000002_add_referral_trade_feature_toggle.sql

-- Then in Supabase SQL Editor, paste and click "Run"
-- Should see: "Query returned successfully"
```

### Step 2: Rebuild Admin Portal (2 min)
```bash
cd p2p-kids-admin
npm run type-check  # Must pass
npm run lint        # Must pass
npm run build       # Should succeed
npm start
```

### Step 3: Test in Browser (2 min)
1. Open admin portal
2. Go to **Referrals > Configuration**
3. Scroll to **Feature Toggles** section
4. Click each toggle and verify:
   - ✅ Visual feedback (checked/unchecked)
   - ✅ Success message appears
   - ✅ Refresh page - state persists

---

## 📊 Configuration Keys

| Key | Type | Default | Location | Purpose |
|-----|------|---------|----------|---------|
| `referral_first_trade_enabled` | boolean | `true` | Admin UI ⭐ | Enable/disable trade bonuses |
| `referral_first_listing_enabled` | boolean | `true` | Admin UI ⭐ | Enable/disable listing bonuses |
| `referral_program_enabled` | boolean | `true` | Admin UI | Master kill switch |
| `referral_reward_referrer_sp` | number | 50 | Admin UI | Trade bonus amount for referrer |
| `referral_reward_referee_sp` | number | 25 | Admin UI | Trade bonus amount for referee |
| `referral_reward_referrer_listing_sp` | number | 25 | Admin UI | Listing bonus for referrer |
| `referral_reward_referee_listing_sp` | number | 10 | Admin UI | Listing bonus for referee |

---

## 🎯 What Each Toggle Does

### Toggle 1: 🎯 First Trade Bonus Active
```
WHEN ENABLED ✅
├─ Referrer gets SP when referee completes first trade
└─ Referee gets SP when they complete first trade

WHEN DISABLED ❌
├─ Referrer gets NO SP from trade bonus
└─ Referee gets NO SP from trade bonus
└─ Listing bonuses unaffected
```

### Toggle 2: 📝 First Approved Listing Bonus Active
```
WHEN ENABLED ✅
├─ Referrer gets SP when referee's first listing is approved
└─ Referee gets SP when their first listing is approved

WHEN DISABLED ❌
├─ Referrer gets NO SP from listing bonus
└─ Referee gets NO SP from listing bonus
└─ Trade bonuses unaffected
```

### Toggle 3: 🌐 Entire Referral Program Active
```
WHEN ENABLED ✅
├─ Both trade AND listing bonuses can be awarded
└─ Follows individual toggle states

WHEN DISABLED ❌
├─ NO referral bonuses awarded (trade OR listing)
└─ Overrides both individual toggles (master switch)
```

---

## 🧮 Truth Table

| Trade | Listing | Program | Result |
|-------|---------|---------|--------|
| ✅ | ✅ | ✅ | Both awarded |
| ❌ | ✅ | ✅ | Only listing |
| ✅ | ❌ | ✅ | Only trade |
| ❌ | ❌ | ✅ | None awarded |
| ✅ | ✅ | ❌ | **None awarded** (master overrides) |
| ❌ | ❌ | ❌ | None awarded |

---

## 📂 File Structure

```
supabase/
├─ migrations/
│  └─ 20260205000002_add_referral_trade_feature_toggle.sql ⭐ NEW
│     └─ Adds 'referral_first_trade_enabled' to sp_config

p2p-kids-admin/
└─ src/app/referrals/
   └─ configuration-tab.tsx ⭐ UPDATED
      ├─ Added state: firstTradeEnabled, firstListingEnabled
      ├─ Updated loadConfig() to fetch both toggles
      └─ Added Feature Toggles section with 3 toggles
```

---

## ⚡ Common Tasks

### Task 1: Disable Trade Bonuses Temporarily
```bash
# Admin clicks toggle OFF:
# ☐ 🎯 First Trade Bonus Active

# Verify in database:
SELECT config_value FROM public.sp_config 
WHERE config_key = 'referral_first_trade_enabled';
# Returns: 'false'

# Result: No trade bonuses awarded until re-enabled
```

### Task 2: Enable Only Listing Bonuses
```bash
# Admin:
# ☐ 🎯 First Trade Bonus Active    (OFF)
# ☑️ 📝 First Approved Listing Bonus (ON)

# Result: Only listing bonuses awarded
```

### Task 3: Emergency Shutdown (Disable All)
```bash
# Admin clicks:
# ☐ 🌐 Entire Referral Program Active

# Result: NO bonuses awarded (all paused)
# Individual toggles don't matter - master switch overrides
```

### Task 4: Restore Full Service
```bash
# Admin clicks:
# ☑️ 🌐 Entire Referral Program Active
# ☑️ 🎯 First Trade Bonus Active
# ☑️ 📝 First Approved Listing Bonus Active

# Result: All bonuses awarded as normal
```

---

## 🔍 Debugging Guide

### Symptom: Toggles Don't Appear
**Cause**: Admin UI not rebuilt
**Fix**:
```bash
cd p2p-kids-admin && npm run build && npm start
# Wait 5 sec, refresh (Cmd+Shift+R)
```

### Symptom: Toggle Doesn't Save
**Cause**: Admin secret not configured
**Fix**:
```bash
# Check .env.local has:
NEXT_PUBLIC_ADMIN_UI_SECRET=<actual-secret>

# Restart:
npm start

# Try again
```

### Symptom: Migration Already Exists Error
**Cause**: Migration already ran
**Fix**: This is OK! Run verification:
```sql
SELECT config_value FROM public.sp_config 
WHERE config_key = 'referral_first_trade_enabled';
-- Should return 'true'
```

### Symptom: Toggle State Wrong After Refresh
**Cause**: Database value corrupted or loadConfig not running
**Fix**:
```sql
-- Reset to defaults:
UPDATE public.sp_config 
SET config_value = 'true' 
WHERE config_key IN ('referral_first_trade_enabled', 'referral_first_listing_enabled');

-- Verify:
SELECT config_key, config_value 
FROM public.sp_config 
WHERE config_key IN ('referral_first_trade_enabled', 'referral_first_listing_enabled');
```

---

## 📊 Monitoring

### Check Current State
```sql
SELECT config_key, config_value, updated_at 
FROM public.sp_config 
WHERE category = 'referral' AND value_type = 'boolean'
ORDER BY updated_at DESC;
```

### See Recent Changes
```sql
SELECT config_key, config_value, updated_at 
FROM public.sp_config 
WHERE category = 'referral' AND value_type = 'boolean'
AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;
```

### Check Bonuses Are Being Awarded
```sql
-- Bonuses awarded in last hour
SELECT 
  sp_type,
  COUNT(*) as count,
  MIN(created_at) as first,
  MAX(created_at) as last
FROM sp_ledger 
WHERE sp_type IN ('referral_trade', 'referral_listing')
AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY sp_type
ORDER BY sp_type;
```

---

## 🚨 Emergency Procedures

### If All Referral Bonuses Need Pausing
```sql
-- Single command:
UPDATE public.sp_config 
SET config_value = 'false' 
WHERE config_key = 'referral_program_enabled';

-- Verify:
SELECT config_value FROM public.sp_config 
WHERE config_key = 'referral_program_enabled';
-- Returns: 'false'
```

### If Trade Bonuses Have Bug
```sql
-- Disable only trade bonuses:
UPDATE public.sp_config 
SET config_value = 'false' 
WHERE config_key = 'referral_first_trade_enabled';

-- Listing bonuses still awarded
```

### If Listing Bonuses Have Bug
```sql
-- Disable only listing bonuses:
UPDATE public.sp_config 
SET config_value = 'false' 
WHERE config_key = 'referral_first_listing_enabled';

-- Trade bonuses still awarded
```

### Restore Normal Operation
```sql
UPDATE public.sp_config 
SET config_value = 'true' 
WHERE config_key IN (
  'referral_program_enabled',
  'referral_first_trade_enabled', 
  'referral_first_listing_enabled'
);
```

---

## 📞 Support Links

- **Implementation Guide**: REF-V2-008-ADMIN-TOGGLES-IMPLEMENTATION.md
- **Visual Diagrams**: REF-V2-008-ADMIN-TOGGLES-VISUAL-GUIDE.md
- **Deployment Steps**: REF-V2-008-ADMIN-TOGGLES-DEPLOYMENT-CHECKLIST.md
- **Detailed Changes**: REF-V2-008-ADMIN-TOGGLES-CHANGE-SUMMARY.md

---

## ✅ Verification Checklist

Before considering deployment complete:

```bash
# 1. Database
□ Migration applied
□ Config keys exist
□ Default values are 'true'

# 2. Admin UI
□ Toggles appear on Configuration tab
□ Toggles save to database
□ Toggles persist after refresh
□ Success messages display
□ Error handling works

# 3. Mobile App
□ Mobile dashboard shows correct amounts
□ Share message includes active bonuses
□ Referral flow respects toggles

# 4. Code Quality
□ TypeScript: 0 errors
□ ESLint: 0 errors
□ No duplicate exports
□ No console warnings
```

---

**Last Updated**: February 5, 2026
**Status**: READY FOR DEPLOYMENT ✅
**Version**: 1.0
