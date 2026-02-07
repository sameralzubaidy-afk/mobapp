# Parked referral migrations (2026-02-04)

These SQL files were originally drafted as iterative fixes for the referral system.

They were **moved out of** `supabase/migrations/` to ensure staging/prod deploys are **deterministic and safe**.

## Why parked

- Multiple files redefined the same RPCs (`public.apply_referral_code`, `public.handle_new_user`, `public.create_referral_code`). The *last* migration wins, but earlier ones could still introduce risky behavior.
- Some drafts granted client-side execute access to `public.create_referral_code(p_user_id uuid)` without enforcing `auth.uid() = p_user_id`. In combination with `SECURITY DEFINER` and/or `SET row_security = off`, that can allow a logged-in user to mutate other users’ referral codes.

## Canonical staging fix

The staging deploy path for the referral attribution bug is:

- `supabase/migrations/20260204000006_referrals_fail_safe_apply_and_legacy_lookup.sql`
- `supabase/migrations/20260204000007_referrals_secure_apply_referral_code.sql`

Those migrations:
- Persist the typed referral code to `profiles.referred_by_code`
- Ensure `profiles.referred_by` is set
- Add a fail-safe `profiles` AFTER INSERT trigger that applies referral metadata even if the `auth.users` trigger was missing
- Lock down EXECUTE privileges on `public.apply_referral_code` (no anon/public execution)
