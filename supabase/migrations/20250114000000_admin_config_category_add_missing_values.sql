-- File: supabase/migrations/20250114000000_admin_config_category_add_missing_values.sql
-- Mode B: idempotent rerunnable migration
--
-- FIX-Task-40 — base-schema repair (continuation of FIX-Task-38), so the
-- migration chain can be replayed from an empty database (`supabase db reset`).
--
-- WHY THIS IS ITS OWN MIGRATION
--   `public.admin_config_category` is created by
--   `20250113_create_admin_config.sql` with nine labels:
--     subscription, swap_points, fees, sms, email, moderation, safety,
--     analytics, feature_flags
--   Later migrations add `referral` (20260207000000) and `health`
--   (20260809000002), but three labels the live database carries are added
--   NOWHERE in the chain: `payout_fees`, `trade`, `tax`.
--
--   Every migration that seeds a config row in one of those categories tries to
--   add the label itself and then USE it in the same file, which PostgreSQL
--   rejects with SQLSTATE 55P04 ("unsafe use of new value ... New enum values
--   must be committed before they can be used"). Files that merely *use* the
--   label fail with 22P02 ("invalid input value for enum").
--
--   Committing the labels here — in their own transaction, before any consumer
--   runs — turns each consumer's own `ADD VALUE IF NOT EXISTS` into a no-op and
--   makes the subsequent use legal.
--
-- Live label set (14, verified against the live database):
--   subscription, swap_points, fees, sms, email, moderation, safety, analytics,
--   feature_flags, payout_fees, referral, trade, tax, health
--
-- Placement: immediately after `20250113_create_admin_config.sql` (which creates
-- the enum) and before every consumer.

ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'payout_fees';
ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'trade';
ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'tax';

-- =====================================================================
-- Verification (run one statement at a time):
--   SELECT e.enumlabel
--   FROM pg_enum e
--   JOIN pg_type t ON t.oid = e.enumtypid
--   WHERE t.typname = 'admin_config_category'
--   ORDER BY e.enumsortorder;
--   -- Expected: 14 labels, including payout_fees, trade, tax
-- =====================================================================
