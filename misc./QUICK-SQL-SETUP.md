# 🚀 30-Second Setup Guide

**You need to run 2 files. That's it.**

---

## File 1: Setup SQL

**Location:** `MODULE-03-AUTH-V2-SETUP.sql`

**Action:**
1. Open Supabase Dashboard
2. Go to **SQL Editor** 
3. Click **New Query**
4. Open file: `MODULE-03-AUTH-V2-SETUP.sql`
5. Copy ALL contents
6. Paste into SQL Editor
7. Click **Run** (or Cmd+Enter)
8. ⏱️ Wait ~30 seconds
9. ✅ Done!

---

## File 2: Verify Success

**Location:** `MODULE-03-AUTH-V2-VERIFY.sql`

**Action:**
Copy and run these 3 key verification queries:

### Query 1: Check Tables Exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('subscriptions', 'sp_wallets', 'admin_config')
ORDER BY table_name;
```
**Expected:** 3 rows

### Query 2: Check Functions Exist
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'create_trial_subscription', 'initialize_sp_wallet',
  'get_subscription_summary', 'get_user_sp_wallet_summary',
  'is_trial_enabled', 'get_trial_duration_days'
)
ORDER BY routine_name;
```
**Expected:** 6 rows

### Query 3: Check Admin Config
```sql
SELECT config_key, enabled FROM admin_config ORDER BY config_key;
```
**Expected:**
```
feature_flags       | true
swap_points_config  | true
trial_subscription  | true
```

---

## ✅ If All Pass

**You're ready to test!**

Next:
- Run tests: `yarn test`
- Test signup flow in app
- Test trial enrollment

---

## ❌ If Something Fails

### Error: "Table already exists"
→ OK, continue. Just run again.

### Error: "profiles table not found"  
→ Run this first:
```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  name TEXT, avatar_url TEXT, bio TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```
Then run the setup SQL again.

### Functions not found
→ Run PART 4 of setup SQL again

---

## 📊 What Gets Created

| Type | Count | Names |
|------|-------|-------|
| Tables | 3 | subscriptions, sp_wallets, admin_config |
| Functions | 6 | create_trial_subscription, initialize_sp_wallet, etc. |
| Columns (profiles) | 5 | subscription_id, sp_wallet_id, age, etc. |
| RLS Policies | 6 | User and admin policies |
| Indexes | 10+ | For performance |

---

## ⏱️ Total Time

| Step | Time |
|------|------|
| Run setup SQL | 30 seconds |
| Run verification | 1 minute |
| **Total** | **~90 seconds** |

---

**That's it!** You now have everything needed for MODULE-03 AUTH-V2 testing.
