-- File: supabase/migrations/20260913000000_base_schema_repair_deferred_constraints.sql
-- Mode B: idempotent rerunnable migration
--
-- FIX-Task-40 — base-schema repair, deferred half.
--
-- The base-objects repair (20241213000004) has to run early — it creates tables
-- that many later migrations read.  Three of its foreign keys, two of its
-- triggers and two of its RLS policies cannot be declared at that point, because
-- they depend on objects the chain creates later:
--
--   users.subscription_tier_id      -> subscription_tiers   (20260212000000)
--   faq_votes.faq_item_id           -> faq_items            (310_faq_tables.sql)
--   auto_complete_results.run_id    -> auto_complete_runs   (20251226_add_pg_cron_and_auto_complete.sql)
--   trigger update_users_updated_at -> update_updated_at_column()
--   trigger sync_points_balance_after_insert -> sync_points_balance()
--   admin_audit_logs policies       -> user_has_role()
--
-- Declaring them here keeps the early repair free of forward references (so it
-- applies on the first pass instead of being deferred, which would cascade
-- deferrals through every table it creates) while still producing a schema that
-- matches the live database.
--
-- Everything below is guarded, so a replay that already has the constraint,
-- trigger or policy is a no-op.

-- =====================================================================
-- SECTION 1 — deferred foreign keys
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('public.subscription_tiers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_users_subscription_tier_id'
         AND conrelid = 'public.users'::regclass
     ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT fk_users_subscription_tier_id
      FOREIGN KEY (subscription_tier_id) REFERENCES public.subscription_tiers(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.faq_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'faq_votes_faq_item_id_fkey'
         AND conrelid = 'public.faq_votes'::regclass
     ) THEN
    ALTER TABLE public.faq_votes
      ADD CONSTRAINT faq_votes_faq_item_id_fkey
      FOREIGN KEY (faq_item_id) REFERENCES public.faq_items(id)
      ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.auto_complete_runs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'auto_complete_results_run_id_fkey'
         AND conrelid = 'public.auto_complete_results'::regclass
     ) THEN
    ALTER TABLE public.auto_complete_results
      ADD CONSTRAINT auto_complete_results_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES public.auto_complete_runs(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================================
-- SECTION 2 — deferred triggers
-- =====================================================================
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS sync_points_balance_after_insert ON public.points_transactions;
CREATE TRIGGER sync_points_balance_after_insert
  AFTER INSERT ON public.points_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_points_balance();

-- =====================================================================
-- SECTION 3 — deferred admin_audit_logs policies (need user_has_role)
-- =====================================================================
DROP POLICY IF EXISTS admin_audit_logs_select_admin ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_select_admin ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'::text));

DROP POLICY IF EXISTS admin_audit_logs_insert_self_or_admin ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_insert_self_or_admin ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((actor_id = auth.uid()) OR public.user_has_role(auth.uid(), 'admin'::text));

-- =====================================================================
-- Verification (one statement at a time):
--   select conname, conrelid::regclass from pg_constraint
--   where conname in ('fk_users_subscription_tier_id','faq_votes_faq_item_id_fkey',
--                     'auto_complete_results_run_id_fkey');
--   -- Expected: 3 rows
--
--   select tgname, tgrelid::regclass from pg_trigger
--   where tgname in ('update_users_updated_at','sync_points_balance_after_insert')
--     and not tgisinternal;
--   -- Expected: 2 rows
-- =====================================================================
