# MODULE-02 DATABASE SCHEMA VERIFICATION & FIXES

**Date:** December 13, 2025  
**Status:** ✅ MIGRATION FILES CREATED  
**Action:** Apply migrations to Supabase before implementing Module 02

---

## Summary of Changes

Two new migration files have been created to add all missing tables, columns, and functions required for Module 02 (Authentication & User Management):

1. **`20241213000001_add_auth_module_tables.sql`** - Core auth tables
2. **`20241213000002_add_referral_system_tables.sql`** - Referral and session management

---

## Migration 01: Core Authentication Tables

### Tables Created/Updated

#### ✅ **users Table** - New columns added:
- `phone_verified` (BOOLEAN) - Phone verification status
- `phone_verified_at` (TIMESTAMPTZ) - When phone was verified
- `referral_code` (TEXT, UNIQUE) - User's referral code
- `name` (TEXT) - User's full name
- `avatar_url` (TEXT) - Avatar image URL
- `bio` (TEXT) - User bio
- `city` (TEXT) - City of residence
- `state` (TEXT) - State of residence
- `zip_code` (TEXT) - ZIP code
- `node_id` (TEXT) - Assigned geographic node
- `onboarding_completed` (BOOLEAN) - Onboarding flag
- `profile_completed` (BOOLEAN) - Profile completion flag

#### ✅ **phone_verification_codes** - NEW TABLE
```
Columns:
  - id (UUID, PRIMARY KEY)
  - user_id (UUID) - References auth.users
  - phone (TEXT) - Phone number being verified
  - code (TEXT) - 6-digit verification code
  - expires_at (TIMESTAMPTZ) - Code expiration time
  - attempts (INTEGER) - Failed attempt counter (max 3)
  - verified (BOOLEAN) - Verification status
  - created_at (TIMESTAMPTZ)

Indexes:
  - idx_phone_verification_codes_user_id
  - idx_phone_verification_codes_phone
  - idx_phone_verification_codes_created_at
  - idx_phone_verification_codes_expires_at

RLS Policies:
  ✓ Users can view their own codes
  ✓ System can insert/update codes
  ✓ Users can delete after verification
```

#### ✅ **profiles** - NEW TABLE (Public profile data)
```
Columns:
  - id (UUID, PRIMARY KEY)
  - user_id (UUID, UNIQUE) - References auth.users
  - name (TEXT) - Full name
  - avatar_url (TEXT) - Avatar URL
  - bio (TEXT) - User bio
  - city (TEXT) - City
  - state (TEXT) - State
  - zip_code (TEXT) - ZIP code
  - node_id (TEXT) - Assigned node
  - profile_completed (BOOLEAN)
  - onboarding_completed (BOOLEAN)
  - phone_verified (BOOLEAN)
  - phone_verified_at (TIMESTAMPTZ)
  - referral_code (TEXT, UNIQUE)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)

Indexes:
  - idx_profiles_user_id
  - idx_profiles_referral_code
  - idx_profiles_node_id
  - idx_profiles_created_at

RLS Policies:
  ✓ Public profiles viewable (read-only for others)
  ✓ Users can update own profile
  ✓ Users can insert own profile

Triggers:
  ✓ Auto-update updated_at on modification
```

#### ✅ **nodes** - NEW TABLE (Geographic nodes)
```
Columns:
  - id (TEXT, PRIMARY KEY) - e.g., 'norwalk_ct'
  - name (TEXT) - Node display name
  - status (TEXT) - 'active' | 'waitlist' | 'inactive'
  - launch_date (DATE)
  - latitude (DECIMAL)
  - longitude (DECIMAL)
  - created_at (TIMESTAMPTZ)
```

#### ✅ **zip_codes** - NEW TABLE (ZIP to node mapping)
```
Columns:
  - zip (TEXT, PRIMARY KEY)
  - node_id (TEXT) - References nodes
  - city (TEXT)
  - state (TEXT)
  - latitude (DECIMAL)
  - longitude (DECIMAL)
  - created_at (TIMESTAMPTZ)

Indexes:
  - idx_zip_codes_node_id
  - idx_zip_codes_city_state
```

#### ✅ **waitlist** - NEW TABLE (For inactive nodes)
```
Columns:
  - id (UUID, PRIMARY KEY)
  - email (TEXT) - Email address
  - phone (TEXT) - Phone number
  - zip (TEXT) - ZIP code
  - kids_count (INTEGER) - Number of kids
  - kids_ages (TEXT[]) - Array of kid ages
  - created_at (TIMESTAMPTZ)
  - notified_at (TIMESTAMPTZ) - When node launched
  - converted_user_id (UUID) - If converted to user

Indexes:
  - idx_waitlist_email
  - idx_waitlist_phone
  - idx_waitlist_zip
  - idx_waitlist_created_at

RLS Policies:
  ✓ Anyone can join waitlist
  ✓ Admins can view all entries
```

### Functions Created

#### ✅ **generate_referral_code()**
- Generates unique 8-character alphanumeric codes
- Checks for uniqueness in database
- Returns valid code for use

#### ✅ **get_nearest_node(user_lat, user_lng, status)**
- Finds nearest active node by coordinates
- Uses simple distance formula
- Returns node_id, name, and distance

#### ✅ **assign_node_by_zip(zip_code)**
- Maps ZIP code to node_id
- Returns NULL if ZIP not found

#### ✅ **verify_phone_code(user_id, code)**
- Verifies phone verification code
- Checks code validity and expiration
- Updates user profile on success
- Returns success/error message

#### ✅ **increment_verification_attempts(user_id, code)**
- Increments failed attempt counter
- Prevents brute-force attacks

---

## Migration 02: Referral & Session Management

### Tables Created

#### ✅ **referrals** - NEW TABLE (Referral tracking)
```
Columns:
  - id (UUID, PRIMARY KEY)
  - referrer_user_id (UUID) - References auth.users
  - referred_user_id (UUID) - References auth.users
  - referral_code (TEXT) - Code used
  - status (TEXT) - 'pending' | 'claimed' | 'expired'
  - bonus_points (INTEGER) - Bonus for referred user
  - bonus_claimed_at (TIMESTAMPTZ)
  - bonus_points_referrer (INTEGER) - Bonus for referrer
  - bonus_claimed_referrer_at (TIMESTAMPTZ)
  - created_at (TIMESTAMPTZ)
  - claimed_at (TIMESTAMPTZ)

Constraint:
  - UNIQUE(referrer_user_id, referred_user_id)

Indexes:
  - idx_referrals_referrer_user_id
  - idx_referrals_referred_user_id
  - idx_referrals_referral_code
  - idx_referrals_status
  - idx_referrals_created_at

RLS Policies:
  ✓ Users can view their own referrals
```

#### ✅ **auth_sessions** - NEW TABLE (Device session tracking)
```
Columns:
  - id (UUID, PRIMARY KEY)
  - user_id (UUID) - References auth.users
  - device_id (TEXT) - Device identifier
  - device_name (TEXT) - Device name (iPhone, etc.)
  - device_type (TEXT) - 'ios' | 'android' | 'web'
  - ip_address (INET) - IP address
  - user_agent (TEXT) - User agent string
  - status (TEXT) - 'active' | 'revoked' | 'expired'
  - created_at (TIMESTAMPTZ)
  - last_seen (TIMESTAMPTZ)
  - expires_at (TIMESTAMPTZ) - Default: 90 days
  - revoked_at (TIMESTAMPTZ)

Constraint:
  - UNIQUE(user_id, device_id)

Indexes:
  - idx_auth_sessions_user_id
  - idx_auth_sessions_device_id
  - idx_auth_sessions_status
  - idx_auth_sessions_expires_at

RLS Policies:
  ✓ Users can view their own sessions
  ✓ Users can revoke their own sessions
```

#### ✅ **sms_rate_limit_log** - NEW TABLE (SMS tracking)
```
Columns:
  - id (UUID, PRIMARY KEY)
  - phone (TEXT) - Phone number
  - user_id (UUID) - References auth.users (optional)
  - sms_type (TEXT) - 'verification_code' | 'password_reset' | 'notification'
  - sent_at (TIMESTAMPTZ) - When SMS was sent
  - status (TEXT) - 'sent' | 'failed'

Indexes:
  - idx_sms_rate_limit_log_phone
  - idx_sms_rate_limit_log_user_id
  - idx_sms_rate_limit_log_sent_at
  - idx_sms_rate_limit_log_sms_type
```

#### ✅ **password_reset_tokens** - NEW TABLE (Password reset tracking)
```
Columns:
  - id (UUID, PRIMARY KEY)
  - user_id (UUID) - References auth.users
  - token (TEXT, UNIQUE) - Reset token
  - used (BOOLEAN) - Whether token was used
  - used_at (TIMESTAMPTZ) - When used
  - expires_at (TIMESTAMPTZ) - Token expiration
  - created_at (TIMESTAMPTZ)

Indexes:
  - idx_password_reset_tokens_user_id
  - idx_password_reset_tokens_token
  - idx_password_reset_tokens_expires_at

RLS Policies:
  ✓ Users can view their own tokens
```

### Functions Created

#### ✅ **process_referral_bonus(referred_user_id, referral_code, bonus_amount)**
- Awards bonus points to both referrer and referred user
- Creates referral record with status 'claimed'
- Returns success/error

#### ✅ **mark_referral_claimed(referred_user_id, referral_code)**
- Marks referral as claimed after onboarding
- Updates status from 'pending' to 'claimed'

#### ✅ **revoke_session(user_id, device_id)**
- Revokes a specific device session
- Sets status to 'revoked' and records time

#### ✅ **check_sms_rate_limit(phone, max_per_hour)**
- Checks if phone has exceeded SMS limit
- Counts SMS sent in last hour
- Returns allowed boolean and counts

---

## What This Fixes

### ❌ **Was Missing:**
1. Phone verification table and code management
2. Profile completion and onboarding tracking
3. Referral code generation and tracking
4. Node assignment logic
5. Session management (for logout from specific devices)
6. SMS rate limiting log
7. Password reset tokens

### ✅ **Now Included:**
1. Complete phone verification flow with code expiration and attempt limiting
2. Profile table with all user metadata
3. Referral system with bonus tracking
4. Node management with ZIP code mapping
5. Device session tracking for security
6. SMS rate limit enforcement capabilities
7. Password reset token management

---

## Next Steps: Apply Migrations to Supabase

### Option 1: Using Supabase CLI (Recommended)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Link your Supabase project if not already linked
supabase link --project-id YOUR_PROJECT_ID

# Apply migrations
supabase db push

# Regenerate TypeScript types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > p2p-kids-marketplace/src/types/database.types.ts
```

### Option 2: Manual Application in Supabase Studio
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `20241213000001_add_auth_module_tables.sql`
3. Run in SQL editor
4. Copy contents of `20241213000002_add_referral_system_tables.sql`
5. Run in SQL editor
6. Go to SQL → Migrations to track them

### Option 3: Using Database Seed File
If you have a `seed.sql` file, append these migrations there.

---

## Verification Checklist

After applying migrations, verify:

- [ ] `profiles` table exists with all 18 columns
- [ ] `phone_verification_codes` table exists
- [ ] `nodes` table created (empty, ready for seeding)
- [ ] `zip_codes` table created (empty, ready for seeding)
- [ ] `waitlist` table exists
- [ ] `referrals` table exists
- [ ] `auth_sessions` table exists
- [ ] `sms_rate_limit_log` table exists
- [ ] `password_reset_tokens` table exists
- [ ] All RLS policies created
- [ ] All indexes created for performance
- [ ] All functions created and testable
- [ ] TypeScript types regenerated (`database.types.ts`)

---

## Data Seeding Required

Before proceeding with Module 02 implementation, you'll need to seed:

### 1. **Nodes** (Required)
```sql
INSERT INTO nodes (id, name, status, latitude, longitude, launch_date) VALUES
  ('norwalk_ct', 'Norwalk, Connecticut', 'active', 41.1380, -73.4055, NOW()::DATE),
  ('little_falls_nj', 'Little Falls, New Jersey', 'active', 40.8516, -74.2170, NOW()::DATE);
```

### 2. **ZIP Codes** (Required)
```sql
-- Norwalk, CT area ZIPs
INSERT INTO zip_codes (zip, node_id, city, state, latitude, longitude) VALUES
  ('06850', 'norwalk_ct', 'Norwalk', 'CT', 41.1436, -73.4084),
  ('06851', 'norwalk_ct', 'Norwalk', 'CT', 41.1380, -73.4055),
  -- ... more ZIPs

-- Little Falls, NJ area ZIPs
INSERT INTO zip_codes (zip, node_id, city, state, latitude, longitude) VALUES
  ('07424', 'little_falls_nj', 'Little Falls', 'NJ', 40.8516, -74.2170),
  -- ... more ZIPs
```

### 3. **Admin Config** (Optional but recommended)
```sql
INSERT INTO admin_config (key, value, description) VALUES
  ('sms_rate_limit_per_hour', '10', 'Max SMS per hour per phone'),
  ('max_login_attempts', '5', 'Max failed login attempts'),
  ('password_reset_expiry_minutes', '15', 'Reset token expiry'),
  ('referral_bonus_points', '50', 'Points for referral bonus'),
  ('referral_window_days', '60', 'Days to claim referral');
```

---

## Important Notes

### ⚠️ **Two Separate Profile Tables**
- `auth.users` - Managed by Supabase Auth (email, phone, password)
- `public.profiles` - User-created data (name, bio, avatar, node assignment)

**Recommendation:** Use `profiles` table for most user data. Keep `auth.users` for authentication only.

### ⚠️ **PostGIS Not Enabled**
- Current `get_nearest_node()` uses simple distance formula
- If you need accurate Haversine distance, enable PostGIS:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  -- Then update get_nearest_node() to use ST_Distance()
  ```

### ⚠️ **Cleanup Jobs Not Automated**
- Expired tokens, sessions, and referrals require periodic cleanup
- Use Supabase `pg_cron` or Edge Functions to schedule:
  - Daily cleanup of expired password reset tokens
  - Daily cleanup of expired auth sessions
  - Daily expiration of unclaimed referrals (60-day window)

---

## Ready for Module 02 Implementation

✅ **All database schema gaps have been closed.**

### Move to Next Phase:
After applying these migrations and running verification checks, proceed with:

1. **AUTH-001**: Implement Supabase Auth Signup Flow
2. **AUTH-002**: Implement Phone Verification via AWS SNS
3. **AUTH-003**: Implement SMS Rate Limiting
4. **AUTH-005**: User Profile Creation
5. ... (continue with module tasks)

---

**Status:** ✅ READY TO APPLY MIGRATIONS

**Files Created:**
- `/supabase/migrations/20241213000001_add_auth_module_tables.sql`
- `/supabase/migrations/20241213000002_add_referral_system_tables.sql`
