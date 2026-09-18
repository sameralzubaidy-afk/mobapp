-- =============================================================================
-- FIX-Task-62 — Part 2 of 2: anonymous (anon-role) policy alignment
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B — every statement is
--       DROP POLICY IF EXISTS / DROP + CREATE, so re-running is a no-op).
--
-- NUMBERING (reserved 2026091805000x block — do NOT renumber to 20260918000011):
--   A separate payout workstream was writing `20260918000010_*` / `20260918000011_*`
--   files into this same working tree while this task ran. A migration filename is an
--   order key (BP-99), and two files sharing one is an undefined-order hazard, so the two
--   FIX-Task-62 migrations were moved into a reserved block instead.
-- =============================================================================
--
-- THE DEFECT (and its direction)
-- ------------------------------
-- The FIX-Task-60 fidelity gate classified staging as LOOSER than the migration
-- chain on a whole class of table rules: 13 `*_anon_*` policies granting the
-- UNAUTHENTICATED role read AND write on user data, plus three rules whose predicate
-- the chain had already tightened. Staging carries them because
-- `20260916000158_prod_p1_stage_security_lockdown.sql` (the chain's dropper for 12 of
-- the 13) was evidently never applied there.
--
-- Per BP-100 a staging-looser residual is an OWNER DECISION, not a silent backfill.
-- The decision was taken on 2026-09-18 (FIX-Task-62): tighten staging to match the
-- hardened chain. This file is that decision, written as ONE idempotent migration
-- rather than by re-running the two legacy lockdown files, so the intent is
-- reviewable in a single place and nothing unrelated (the legacy files also revoke
-- RPC grants and restrict `admin_config`) is dragged in by accident.
--
-- DIRECTION DISCIPLINE — what is deliberately NOT touched
-- ------------------------------------------------------
--   * `admin_config` — its anon SELECT is LOAD-BEARING. The public marketing /
--     subscription web app reads pricing and trial copy with the anon key
--     (p2p-kids-web/lib/publicConfig.ts:52), and that is by design. The legacy
--     lockdown file would have restricted it to service_role; this migration must not.
--   * `support_messages` — the mobile app has a real GUEST path
--     (`ContactSupportScreen.tsx` — `isGuest = !session`, then an insert), so its
--     anonymous INSERT policy stays.
--   * Row-level *ownership* policies for signed-in users are unchanged: this file only
--     removes the `anon` role from surfaces no anonymous consumer reads, and narrows
--     three predicates to the chain's stricter form.
--
-- CALLER ANALYSIS (why anonymous access is not needed anywhere below)
-- ------------------------------------------------------------------
--   * Mobile app — every discovery/listing/messaging/profile read happens on the
--     shared client after sign-in (`AppNavigator` gates the app on a session;
--     `DiscoverScreen.tsx:1276` returns early without one). The only genuine
--     no-session write path is `support_messages` (excluded above).
--   * p2p-kids-web — reads `admin_config` only (excluded above).
--   * Edge Functions / admin portal — service_role or the admin's user JWT, neither of
--     which is affected by removing `anon` rules.
--   * Test suites — the integration/E2E suites that touch these tables are built on
--     "anon key + user JWT" (a SIGNED-IN session), never on the anonymous role.
--
-- ROLLBACK (one-line reverse per group)
-- -------------------------------------
--   * Re-create the 13 `*_anon_*` rules by re-applying
--     `20260916000093_ultimate_test_alignment_fix.sql:803-857`.
--     (`items_anon_select` has no chain creator — its body is in the FIX-Task-60
--     fidelity report, `e2e-test-results/fix-task-60-2026-09-18/fidelity-exceptions.md`.)
--   * `profiles` read — re-create `"Public profiles are viewable"` and
--     `"Service role can read all profiles"` from
--     `20260113000001_fix_sandbox_rls_policies.sql:28-37`.
--   * `badges` — re-create `"Admins can update badges"` with `USING (true)` from
--     `20260113000002_fix_trades_rls_for_sandbox.sql:48-49`.
--   * `user_badges` — recreate with role `public`.
--   * `profiles` insert — restore the staging predicate
--     `(user_id IN (SELECT id FROM auth.users) OR auth.uid() IS NULL)`.
--
-- COMMON FAILURE MODES
-- --------------------
--   * On a REBUILT database the 13 anon rules mostly do not exist (the chain already
--     drops 12 of them at `20260916000158`), so those statements are no-ops there.
--     That is expected: this file's real work on a rebuilt DB is the two `profiles`
--     read policies and the three predicate tightenings, and its real work on staging
--     is all five groups.
--   * Do NOT add a `DROP POLICY` for anything named in the "deliberately NOT touched"
--     list above.
-- =============================================================================

-- =============================================================================
-- BLOCK 1 — Remove the anonymous-role rules on user data (13 + 8 siblings)
-- =============================================================================
-- 12 of the 13 already have a chain dropper (`20260916000158:16-45`); they are listed
-- here so the staging apply reaches the same state. `items_anon_select` is the odd one
-- out: it exists ONLY on staging and has neither a creator nor a dropper anywhere in
-- the chain, so this is the only place it can be closed.
--
-- The sp_wallets / sp_ledger anon rules are included as a sibling sweep (the same
-- class, the same legacy origin) — a no-op where they are already gone.

-- profiles
DROP POLICY IF EXISTS "profiles_anon_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_select" ON public.profiles;

-- referrals
DROP POLICY IF EXISTS "referrals_anon_insert" ON public.referrals;
DROP POLICY IF EXISTS "referrals_anon_update" ON public.referrals;
DROP POLICY IF EXISTS "referrals_anon_select" ON public.referrals;

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_anon_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_anon_update" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_anon_select" ON public.subscriptions;

-- user_notifications
DROP POLICY IF EXISTS "user_notifications_anon_insert" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_anon_update" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_anon_select" ON public.user_notifications;

-- items (staging-only; no chain creator)
DROP POLICY IF EXISTS "items_anon_select" ON public.items;

-- sp_wallets / sp_ledger (sibling sweep — dropped twice in the chain, so already gone
-- on a rebuilt DB)
DROP POLICY IF EXISTS "sp_wallets_anon_insert" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_update" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_select" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_delete" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_ledger_anon_insert" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_update" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_select" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_delete" ON public.sp_ledger;

-- =============================================================================
-- BLOCK 2 — `profiles` read: PUBLIC role -> authenticated + service_role
-- =============================================================================
-- `"Public profiles are viewable"` and `"Service role can read all profiles"` were
-- both created WITHOUT a `TO` clause (`20260113000001:28-37`), which makes them apply
-- to the PUBLIC role — i.e. `anon` included. The second one's name is misleading: it
-- grants every role, not just the service role.
--
-- The replacement keeps exactly the same visibility for signed-in users (the mobile
-- app reads seller cards with `select id, user_id, name, avatar_url`
-- — services/listing.ts:1254 — and the chat header reads `id, name, avatar_url`),
-- and removes the anonymous role, which no shipped consumer uses.
--
-- NOTE (residual, out of scope): a SIGNED-IN user can still read every column of every
-- others' profile row, because RLS is row-level and cannot restrict columns. The app
-- only ever selects 3-4 safe columns. Column-level hardening (a narrow view or RPC for
-- counterparty profiles) is a separate task, not a silent addition here.
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Service role can read all profiles" ON public.profiles;

DROP POLICY IF EXISTS "profiles_authenticated_read" ON public.profiles;
CREATE POLICY "profiles_authenticated_read"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_service_role_read" ON public.profiles;
CREATE POLICY "profiles_service_role_read"
ON public.profiles FOR SELECT
TO service_role
USING (true);

-- =============================================================================
-- BLOCK 3 — Three predicates tightened to the chain's stricter form
-- =============================================================================

-- 3a. `badges` UPDATE was `USING (true)` for every signed-in user
--     (`20260113000002:48-49`), so ANY authenticated account could rewrite badge
--     definitions. The chain's version (`20260916000087:51-58`) gates on the
--     canonical admin predicate.
DROP POLICY IF EXISTS "Admins can update badges" ON public.badges;
CREATE POLICY "Admins can update badges"
ON public.badges FOR UPDATE
TO authenticated
USING (public.user_has_role(auth.uid(), 'admin'::text))
WITH CHECK (public.user_has_role(auth.uid(), 'admin'::text));

-- 3b. `user_badges` read was role `public` (i.e. anon included). Badge showcases are a
--     signed-in surface.
DROP POLICY IF EXISTS "Service role can read all user badges" ON public.user_badges;
CREATE POLICY "Service role can read all user badges"
ON public.user_badges FOR SELECT
TO authenticated
USING (true);

-- 3c. `profiles` INSERT accepted `user_id IN (SELECT id FROM auth.users) OR
--     auth.uid() IS NULL` — an anonymous caller could create a profile row for ANY
--     account. The signup row is created by the SECURITY DEFINER `handle_new_user`
--     trigger, which runs as the table owner and is therefore not affected by RLS, and
--     the app's own `setupUserProfile` upsert carries the user's JWT — so the strict
--     `auth.uid() = user_id` form is sufficient and is the chain's intent.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- BLOCK 4 — Verification (run each statement SEPARATELY; execute_sql returns only
--           the LAST statement's result set)
-- =============================================================================
-- V1) No anon-role policies left on the user-data tables — EXPECT: 0 rows.
--
--   SELECT schemaname, tablename, policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND (policyname LIKE '%\_anon\_%' OR 'anon' = ANY (roles))
--   ORDER BY tablename, policyname;
--
-- V2) `profiles` read is scoped to authenticated/service_role — EXPECT: no PUBLIC/anon
--     role in the list.
--
--   SELECT policyname, roles, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
--   ORDER BY policyname;
--
-- V3) The three tightened predicates — EXPECT: `badges` shows the user_has_role
--     predicate, `user_badges` shows {authenticated}, `profiles` INSERT shows
--     `auth.uid() = user_id`.
--
--   SELECT tablename, policyname, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND policyname IN ('Admins can update badges',
--                        'Service role can read all user badges',
--                        'Users can insert their own profile')
--   ORDER BY tablename, policyname;
--
-- V4) REGRESSION GUARD — the two surfaces this migration must NOT have changed.
--     EXPECT: the `admin_config` anon SELECT survives, and `support_messages` keeps an
--     anonymous INSERT path.
--
--   SELECT tablename, policyname, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('admin_config', 'support_messages')
--   ORDER BY tablename, policyname;
