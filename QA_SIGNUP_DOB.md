Signup DOB QA

1. Run migration: apply `supabase/migrations/20251214000001_add_profiles_dob_and_trigger_update.sql` in Supabase SQL Editor.

2. Test sign up with DOB under 18:
   - Signup in app with `dob` set to a date that makes user 17 years old.
   - Expected: Alert shows "Sorry, you must be 18 years old to register." and account not created.

3. Test sign up with DOB 18+:
   - Signup in app with DOB 20 years ago.
   - Expected: Signup proceeds and profile has `dob` populated and `phone_verified=false`.

4. Verify in DB:
```sql
SELECT p.user_id, p.name, p.dob, p.phone_verified, au.email
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
ORDER BY p.created_at DESC
LIMIT 5;
```

5. Manual verify DOB update function:
```sql
-- Use function check from migration file
SELECT * FROM check_phone_verification_status((SELECT user_id FROM profiles ORDER BY created_at DESC LIMIT 1));
```
