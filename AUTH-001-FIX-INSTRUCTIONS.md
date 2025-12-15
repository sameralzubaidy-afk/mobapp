# AUTH-001 Signup Flow - Critical Fixes Required

## 🔴 Issue 1: Wrong Supabase API Keys

### Problem
Your `.env.local` had a **Stripe publishable key** in place of the Supabase anon key:
```
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jB2O2EoLoNrZxFdVVqxrZQ_GbOuv3HB  ❌ Stripe key!
```

This caused **ALL signups to be rejected** with error:
```
AuthApiError: Email address "sam@gmail.com" is invalid
```

### Fix Required
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/settings/api)
2. Copy the **anon** public key (starts with `eyJ...`)
3. Copy the **service_role** secret key (starts with `eyJ...`)
4. Update `.env.local` files:

**p2p-kids-marketplace/.env.local:**
```env
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste_anon_key_here>
SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_here>
```

**p2p-kids-admin/.env.local:**
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste_anon_key_here>
SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_here>
```

---

## 🔴 Issue 2: Database Migration Not Applied

### Problem
The migration `20241214000001_add_profile_creation_trigger.sql` was created but **never applied** to the database.

Result:
- ✅ Users created in `auth.users` table (you see phone verification)
- ❌ No profiles created in `public.profiles` table
- ❌ Database trigger doesn't exist to auto-create profiles

### Fix Required
1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql)
2. Click "New Query"
3. Copy the contents of `supabase/migrations/20241214000001_add_profile_creation_trigger.sql`
4. Paste and click "Run"

**What this migration does:**
- Updates RLS policies to allow profile inserts during signup
- Creates database trigger to auto-create profile when auth user is created
- Adds backup function for manual profile creation

---

## 🔴 Issue 3: Profile Creation Disabled in Code

### Problem
We temporarily disabled profile creation in `auth.ts` to avoid RLS errors.

### Fix Required
After applying the migration above, re-enable profile creation:

**File:** `p2p-kids-marketplace/src/services/supabase/auth.ts`

**Find this section (around line 42):**
```typescript
// Step 2: Create user profile in database (profiles table)
// TODO: RLS policy needs to be updated to allow profile inserts during signup
// For now, we'll skip profile creation and rely on database trigger
// The trigger should create the profile automatically when auth user is created
console.log('Skipping profile creation - should be handled by database trigger');
/*
const { error: profileError } = await supabase
  .from('profiles')
  .insert({
    user_id: authData.user.id,
    name: data.name,
    phone_verified: false,
  });
...
*/
```

**Replace with:**
```typescript
// Step 2: Wait for database trigger to create profile (or verify it exists)
// The database trigger should have created the profile automatically
console.log('Profile should be created by database trigger for user:', authData.user.id);

// Optional: Add a small delay and verify profile was created
await new Promise(resolve => setTimeout(resolve, 100));

const { data: profileData, error: profileCheckError } = await supabase
  .from('profiles')
  .select('user_id')
  .eq('user_id', authData.user.id)
  .single();

if (profileCheckError || !profileData) {
  console.warn('Profile may not have been created by trigger, creating manually...');
  
  // Fallback: try to create profile manually
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: authData.user.id,
      name: data.name,
      phone_verified: false,
    });

  if (profileError && profileError.code !== '23505') { // Ignore duplicate errors
    console.error('Profile creation error:', profileError);
    return {
      user: null,
      error: new Error('Failed to create user profile. Please contact support.')
    };
  }
}
```

---

## Testing After Fixes

### 1. Restart the app
```bash
cd p2p-kids-marketplace
npx expo start --clear
```

### 2. Test signup with a new email
- Use format: `test+<timestamp>@gmail.com` (to avoid duplicates)
- Example: `test+1702566000@gmail.com`

### 3. Verify in Supabase Dashboard
- Check `auth.users` table: [View Auth Users](https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/auth/users)
- Check `public.profiles` table: [View Profiles](https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/editor)

### Expected Results
✅ User appears in both `auth.users` and `public.profiles`
✅ Profile has correct `user_id`, `name`, and `phone_verified=false`
✅ Signup navigates to phone verification screen

---

## Summary of Root Causes

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Email "invalid" error | Wrong API key (Stripe key instead of Supabase anon key) | ALL signups rejected by server |
| No profile records | Migration not applied + profile creation disabled | Profiles never created |
| Users in auth but not profiles | Database trigger doesn't exist yet | Manual profile creation needed |

## Priority Order
1. **FIRST**: Fix API keys in `.env.local` (both apps)
2. **SECOND**: Apply database migration in Supabase dashboard
3. **THIRD**: Re-enable/update profile creation in `auth.ts`
4. **FOURTH**: Test signup flow end-to-end

---

## Questions?
If issues persist after these fixes, check:
- Supabase Dashboard → Logs → Auth logs for detailed error messages
- RLS policies on `profiles` table are correct
- Database trigger `on_auth_user_created` exists and is active
