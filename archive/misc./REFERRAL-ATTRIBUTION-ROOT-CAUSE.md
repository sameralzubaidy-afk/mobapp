# Referral Attribution Bug - Root Cause Analysis

## Problem
New users signing up with valid referral codes end up with:
- `profiles.referral_code` = NULL (should have their own generated code)
- `profiles.referred_by` = NULL (should have the referrer's user_id)

## Root Cause Identified

### Timeline of Events
1. **T=0**: User signs up via `supabase.auth.signUp()` with metadata including `referral_code: 'abc123'`
2. **T=1**: Supabase inserts into `auth.users`
3. **T=2**: Trigger `on_auth_user_created` fires → `handle_new_user()` executes:
   - Generates referral code via `create_referral_code()`
   - Inserts profile with `referral_code = 'xyz789'` and applies referral metadata
   - Updates `profiles.referred_by = <referrer_user_id>`
   - Profile now has BOTH fields set correctly ✅
4. **T=3**: Mobile app calls `setupUserProfile()` during onboarding
5. **T=4**: `setupUserProfile()` calls `.upsert()` on profiles table with a payload that **does NOT include `referral_code` or `referred_by`**
6. **T=5**: PostgreSQL updates the profile, setting both fields to NULL ❌

### The Smoking Gun

File: `p2p-kids-marketplace/src/services/profile.ts`, line ~98:

```typescript
const dbProfileData: Record<string, any> = {
  user_id: userId,
  name: profileData.display_name,
  email: profileData.email || null,
  phone: profileData.phone || null,
  avatar_url: profileData.avatar_url || null,
  bio: profileData.bio || null,
  zip_code: profileData.zip_code,
  node_id: assignedNodeId,
  profile_completed: true,
  onboarding_completed: true,
  phone_verified: true,
  phone_verified_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  // ❌ MISSING: referral_code
  // ❌ MISSING: referred_by
};

const { error: insertError } = await supabase
  .from('profiles')
  .upsert(dbProfileData, { 
    onConflict: 'user_id',
    ignoreDuplicates: false  // ⚠️ This OVERWRITES existing fields
  })
```

**When `ignoreDuplicates: false` is used with upsert**, PostgreSQL performs an `UPDATE SET <all_fields>` for conflicting rows. Since `referral_code` and `referred_by` are not in the payload, they get set to NULL.

## Fix Strategy

### Option 1: Never overwrite referral fields (RECOMMENDED)
Modify `setupUserProfile()` to preserve existing referral fields:

```typescript
// First fetch existing profile to preserve referral fields
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('referral_code, referred_by')
  .eq('user_id', userId)
  .single();

const dbProfileData: Record<string, any> = {
  // ... existing fields ...
  
  // Preserve referral fields if they exist
  referral_code: existingProfile?.referral_code || null,
  referred_by: existingProfile?.referred_by || null,
};
```

### Option 2: Use .update() instead of .upsert()
Since the profile already exists (created by trigger), use `.update()`:

```typescript
const { error: updateError } = await supabase
  .from('profiles')
  .update({
    name: profileData.display_name,
    // ... other fields ...
    // DON'T include referral_code or referred_by
  })
  .eq('user_id', userId);
```

### Option 3: PostgreSQL-level protection (defense in depth)
Add a generated column or constraint that prevents NULL updates:

```sql
-- Make sure these columns can't be overwritten to NULL once set
ALTER TABLE public.profiles 
  ADD CONSTRAINT protect_referral_code 
  CHECK (referral_code IS NOT NULL OR user_id NOT IN (
    SELECT user_id FROM public.referral_codes
  ));
```

## Recommended Fix

Use **Option 1** because:
- It's explicit and clear in the code
- It preserves all existing referral data
- It's defensive (won't break if trigger fails)
- It follows the principle: "Never modify what you don't own"

## Additional Improvements

1. **Add debug logging** (already created in migration `20260204000002`)
2. **Add Tier 1 test** to verify profile updates don't clobber referral fields
3. **Document field ownership** in profile service:
   ```typescript
   // PROTECTED FIELDS (managed by auth trigger, DO NOT UPDATE):
   // - referral_code (set on signup)
   // - referred_by (set on signup if referral code provided)
   ```

## Files to Modify

1. **Mobile app**: `p2p-kids-marketplace/src/services/profile.ts`
   - `setupUserProfile()` function
   - `updateUserProfile()` function (also uses update without protection)

2. **Database**: `supabase/migrations/20260204000002_fix_referral_with_logging.sql`
   - Already created with comprehensive logging

3. **Tests**: Add regression test to smoke suite
   - Verify signup → complete profile → referral fields intact
