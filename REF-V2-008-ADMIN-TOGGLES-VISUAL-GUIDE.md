# Admin Referral Configuration - Visual Guide

## Page Layout After Fix

```
┌─────────────────────────────────────────────────────────────────┐
│ REFERRAL PROGRAM CONFIGURATION                                  │
│ Configure SP bonus rewards settings for the referral program.    │
│                                                                   │
│ [✓] Successfully updated referral_first_trade_enabled            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FIRST TRADE BONUSES                                              │
│ Awarded when the person you referred completes their first       │
│ successful trade.                                                │
│                                                                  │
│ ┌─────────────────┐    ┌──────────────────┐                    │
│ │ Referrer SP:    │    │ Referee SP:      │                    │
│ │ [___25___] [Save]    │ [___10___] [Save] │                    │
│ └─────────────────┘    └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FIRST APPROVED LISTING BONUSES                                   │
│ Awarded when the person you referred has their very first item   │
│ approved by an admin.                                            │
│                                                                  │
│ ┌─────────────────┐    ┌──────────────────┐                    │
│ │ Referrer SP:    │    │ Referee SP:      │                    │
│ │ [___25___] [Save]    │ [___10___] [Save] │                    │
│ └─────────────────┘    └──────────────────┘                    │
│                                                                  │
│ ┌──────────────────┐                                            │
│ │ Starter Pack:    │                                            │
│ │ [___10___] [Save]                                             │
│ └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⭐ FEATURE TOGGLES ⭐                                             │
│ Enable or disable specific referral bonus rewards independently. │
│                                                                  │
│ ☑️  🎯 First Trade Bonus Active                                 │
│     Award SP when referee completes their first successful      │
│     trade.                                                      │
│                                                                  │
│ ☑️  📝 First Approved Listing Bonus Active                      │
│     Award SP when referee's first item is approved by admin.    │
│                                                                  │
│ ☑️  🌐 Entire Referral Program Active                           │
│     Toggle entire referral system on or off globally. When      │
│     disabled, both trade and listing bonuses are paused.        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  IMPORTANT NOTE                                                │
│ Bonus values are fetched at the time of awarding. Changes take  │
│ effect immediately for any rewards not yet processed by the     │
│ system triggers.                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Before & After Comparison

### BEFORE ❌
```
FEATURE TOGGLE
────────────────────────────────
☑️  Referral Program Active
    Toggle entire referral system on or off globally.
```

### AFTER ✅
```
FEATURE TOGGLES
────────────────────────────────────────────────────────
☑️  🎯 First Trade Bonus Active
    Award SP when referee completes their first successful trade.

☑️  📝 First Approved Listing Bonus Active
    Award SP when referee's first item is approved by admin.

┌─────────────────────────────────────────────────────┐
├─ Separator ─────────────────────────────────────── ┤
☑️  🌐 Entire Referral Program Active
    Toggle entire referral system on or off globally.
    When disabled, both trade and listing bonuses are paused.
```

---

## Toggle Behavior Matrix

| Toggle | Trade Bonus Awarded | Listing Bonus Awarded | Notes |
|--------|--------------------|-----------------------|-------|
| ☑️ Trade ON<br>☑️ Listing ON<br>☑️ Program ON | ✅ YES | ✅ YES | Full system active |
| ☑️ Trade OFF<br>☑️ Listing ON<br>☑️ Program ON | ❌ NO | ✅ YES | Only listing bonuses awarded |
| ☑️ Trade ON<br>☑️ Listing OFF<br>☑️ Program ON | ✅ YES | ❌ NO | Only trade bonuses awarded |
| ☑️ Trade OFF<br>☑️ Listing OFF<br>☑️ Program ON | ❌ NO | ❌ NO | Both disabled, no rewards |
| ☑️ Trade ON<br>☑️ Listing ON<br>☐ Program OFF | ❌ NO | ❌ NO | Master switch overrides both |

---

## User Actions

### Action 1: Enable First Trade Bonus
```
1. Admin sees toggle: ☐ 🎯 First Trade Bonus Active (currently OFF)
2. Admin clicks toggle checkbox
3. Visual feedback: ☑️ 🎯 First Trade Bonus Active (now ON)
4. Success message appears: "Successfully updated referral_first_trade_enabled"
5. Message fades after 3 seconds
6. Referee completing first trade now earns SP ✅
```

### Action 2: Disable First Listing Bonus
```
1. Admin sees toggle: ☑️ 📝 First Approved Listing Bonus Active (currently ON)
2. Admin clicks toggle checkbox
3. Visual feedback: ☐ 📝 First Approved Listing Bonus Active (now OFF)
4. Success message appears: "Successfully updated referral_first_listing_enabled"
5. Message fades after 3 seconds
6. Referee's first approved listing no longer earns SP ❌
```

### Action 3: Toggle Master Switch
```
1. Admin sees toggle: ☑️ 🌐 Entire Referral Program Active (currently ON)
2. Admin clicks toggle checkbox (to temporarily disable all referrals)
3. Visual feedback: ☐ 🌐 Entire Referral Program Active (now OFF)
4. Success message appears: "Successfully updated referral_program_enabled"
5. Message fades after 3 seconds
6. NO referral bonuses awarded (trade or listing) until re-enabled ❌
```

---

## Data Flow Diagram

```
┌──────────────────────┐
│  Admin UI Toggle     │ ← Checkbox click
│  (configuration-tab) │
└──────────┬───────────┘
           │
           ├─ setState(firstTradeEnabled)
           │
           └─ handleSave('referral_first_trade_enabled', 'true')
                       │
                       ▼
           ┌───────────────────────────────────┐
           │  SPConfigService.update()         │
           │  PATCH /api/admin/sp-config       │
           │  { key, value, adminSecret }      │
           └──────────┬──────────────────────────┘
                      │
                      ▼
           ┌───────────────────────────────────┐
           │  Admin API Endpoint               │
           │  /api/admin/sp-config             │
           │  Validates admin secret           │
           └──────────┬──────────────────────────┘
                      │
                      ▼
           ┌───────────────────────────────────┐
           │  Supabase Database Update         │
           │  UPDATE sp_config                 │
           │  WHERE config_key = '...'         │
           │  SET config_value = '...'         │
           └──────────┬──────────────────────────┘
                      │
                      ▼
           ┌───────────────────────────────────┐
           │  Success Response                 │
           │  Returns 200 OK                   │
           └──────────┬──────────────────────────┘
                      │
                      ▼
           ┌───────────────────────────────────┐
           │  Admin UI Shows Success Message   │
           │  "Successfully updated..."        │
           └──────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Later: Mobile App Uses Updated Config               │
│                                                     │
│ When referee completes first trade:                │
│ 1. Check config: is_first_trade_enabled?          │
│ 2. If true → Award SP                             │
│ 3. If false → Skip reward                         │
│                                                    │
│ When referee lists first item:                     │
│ 1. Check config: is_first_listing_enabled?        │
│ 2. If true → Award SP                             │
│ 3. If false → Skip reward                         │
└─────────────────────────────────────────────────────┘
```

---

## Technical Notes for Support

### Toggle State Storage
- **Where**: `sp_config` table in Supabase
- **Keys**: 
  - `referral_first_trade_enabled` (new)
  - `referral_first_listing_enabled` (existing)
  - `referral_program_enabled` (existing)
- **Value Type**: `boolean` (stored as string 'true' or 'false')
- **Category**: `referral`

### How Toggles Are Used in RPC Functions
```sql
-- In award_referral_sp() RPC:
SELECT (config_value)::BOOLEAN INTO v_feature_enabled
FROM sp_config
WHERE config_key = 'referral_first_trade_enabled';

IF NOT v_feature_enabled THEN
  RETURN error('First trade bonus feature is disabled');
END IF;

-- Award SP only if enabled...

-- In award_listing_referral_sp() RPC:
SELECT (config_value)::BOOLEAN INTO v_feature_enabled
FROM sp_config
WHERE config_key = 'referral_first_listing_enabled';

IF NOT v_feature_enabled THEN
  RETURN error('First listing bonus feature is disabled');
END IF;

-- Award SP only if enabled...
```

### Error Scenarios
| Scenario | User Sees | Backend Returns |
|----------|-----------|-----------------|
| Toggle checkbox, no network | No message (silently fails) | No response |
| Toggle checkbox, admin secret invalid | Error message displayed | 401 Unauthorized |
| Toggle checkbox, no permission | Error message displayed | 403 Forbidden |
| Toggle checkbox, database down | Error message displayed | 500 Server Error |
| Toggle checkbox, success | Success message (3 sec fade) | 200 OK |
