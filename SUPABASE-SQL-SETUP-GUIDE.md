# SQL Setup Instructions for MODULE-03 AUTH-V2

## Quick Start: 3 Steps

### Step 1: Copy the Setup SQL
All SQL needed is in: **`MODULE-03-AUTH-V2-SETUP.sql`**

### Step 2: Run in Supabase SQL Editor
1. Open Supabase Dashboard → Your Project
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy **entire contents** of `MODULE-03-AUTH-V2-SETUP.sql`
5. Paste into the editor
6. Click **Run** (or Cmd+Enter)
7. Wait for completion (should take 30-60 seconds)

### Step 3: Verify Success
1. In same SQL Editor, run verification queries from: **`MODULE-03-AUTH-V2-VERIFY.sql`**
2. Check that all queries return expected results
3. ✅ If all pass → Setup is complete!

---

## Detailed Instructions

### If you get errors:

**Error: "Table already exists"**
- This is OK - the SQL uses `CREATE TABLE IF NOT EXISTS`
- Just continue running

**Error: "Function already exists"**
- This is OK - the SQL uses `CREATE OR REPLACE FUNCTION`
- Just continue running

**Error: "Relation does not exist"** 
- Likely `profiles` table doesn't exist yet
- Run this first to create basic profiles table:
```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  profile_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  referral_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

Then run the main setup SQL again.

---

## Verification Checklist

After running setup, verify in SQL Editor:

### 1️⃣ Tables Created
```sql
-- Run this:
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name IN ('subscriptions', 'sp_wallets', 'admin_config');
```

**Expected Result:**
```
subscriptions
sp_wallets
admin_config
```

### 2️⃣ Columns Added to Profiles
```sql
-- Run this:
SELECT column_name FROM information_schema.columns
WHERE table_name='profiles' AND column_name IN (
  'subscription_id', 'sp_wallet_id', 'onboarding_completed_at', 'parental_consent_verified', 'age'
);
```

**Expected Result:**
```
age
onboarding_completed_at
parental_consent_verified
sp_wallet_id
subscription_id
```

### 3️⃣ Functions Created
```sql
-- Run this:
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_type='FUNCTION'
AND routine_name IN (
  'create_trial_subscription', 'initialize_sp_wallet', 'get_subscription_summary',
  'get_user_sp_wallet_summary', 'is_trial_enabled', 'get_trial_duration_days'
);
```

**Expected Result:**
```
create_trial_subscription
get_subscription_summary
get_trial_duration_days
get_user_sp_wallet_summary
initialize_sp_wallet
is_trial_enabled
```

### 4️⃣ Admin Config Data
```sql
-- Run this:
SELECT config_key, enabled FROM admin_config ORDER BY config_key;
```

**Expected Result:**
```
feature_flags       | true
swap_points_config  | true
trial_subscription  | true
```

### 5️⃣ Test RPC Functions
```sql
-- Run these one at a time:

-- Should return: true
SELECT is_trial_enabled();

-- Should return: 30
SELECT get_trial_duration_days();
```

---

## If Verification Fails

### Issue: Functions not found
**Solution:**
1. Open Supabase console
2. Check Database → Functions
3. If missing, copy the RPC function creation SQL from `MODULE-03-AUTH-V2-SETUP.sql` (PART 4)
4. Run it again

### Issue: admin_config table empty
**Solution:**
1. Run PART 6 of `MODULE-03-AUTH-V2-SETUP.sql` again (INSERT statements)
2. Verify with: `SELECT * FROM admin_config;`

### Issue: Profile table structure wrong
**Solution:**
1. Check if `profiles` table has required columns
2. If missing columns, run basic profiles creation SQL (see above)
3. Then run the full setup again

---

## Complete SQL File Locations

- **Main Setup:** `/Users/sameralzubaidi/Desktop/kids_marketplace_app/MODULE-03-AUTH-V2-SETUP.sql`
- **Verification Queries:** `/Users/sameralzubaidi/Desktop/kids_marketplace_app/MODULE-03-AUTH-V2-VERIFY.sql`
- **Documentation:** `/Users/sameralzubaidi/Desktop/kids_marketplace_app/MODULE-03-AUTH-V2-COMPLETE-VERIFICATION.md`

---

## What Gets Created

### Tables (3)
1. **subscriptions** - User subscription records (trial/active/grace/canceled)
2. **sp_wallets** - Swap Points wallet balances and history
3. **admin_config** - Configuration table (trial settings, feature flags, etc.)

### Functions (6)
1. `create_trial_subscription(user_id)` - Create 30-day trial
2. `initialize_sp_wallet(user_id)` - Create SP wallet
3. `get_subscription_summary(user_id)` - Fetch subscription status
4. `get_user_sp_wallet_summary(user_id)` - Fetch wallet balance
5. `is_trial_enabled()` - Check if trial is enabled (admin config)
6. `get_trial_duration_days()` - Get trial duration days (admin config)

### Columns Added to profiles (5)
- `subscription_id` (UUID) - Link to subscription record
- `sp_wallet_id` (UUID) - Link to SP wallet record
- `onboarding_completed_at` (TIMESTAMPTZ) - When user finished onboarding
- `parental_consent_verified` (BOOLEAN) - COPPA compliance flag
- `age` (INTEGER) - User age (5-17 for kids marketplace)

### Policies (RLS) 
- Users can only access their own subscription, wallet, and profile data
- Admins only can view/update admin_config

### Indexes (10+)
- For fast lookups on: user_id, subscription_id, sp_wallet_id, status

---

## After Setup is Complete

1. ✅ Database ready for testing
2. ✅ Ready to run integration tests: `yarn test`
3. ✅ Ready to test signup flow in app
4. ✅ Ready to deploy to staging

---

## Troubleshooting Commands

If something goes wrong and you need to reset:

```sql
-- ⚠️ WARNING: This deletes everything - only use if needed!

-- Drop tables (will cascade to dependent data)
DROP TABLE IF EXISTS admin_config CASCADE;
DROP TABLE IF EXISTS sp_wallets CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Then run the setup SQL again
```

---

**Setup Time:** ~1 minute  
**Verification Time:** ~2 minutes  
**Total:** ~3 minutes

**Status After Setup:** ✅ Ready for testing
