-- File: supabase/migrations/20241213000004_base_schema_repair_missing_base_objects.sql
-- Mode B: idempotent rerunnable migration
--
-- FIX-Task-40 — base-schema repair, part 2 of 3 (continuation of FIX-Task-38).
--
-- WHY THIS MIGRATION EXISTS
--   The chain cannot be replayed from an empty database because a large part of
--   the live schema was created directly against the database (SQL editor / MCP)
--   and never committed as a migration.  A staging-vs-replay fingerprint diff
--   found 30 tables, 82 functions and 124 RLS policies present in the live
--   database that no migration in this repo ever creates.
--
--   Most of those are cascades — their creator exists but is itself blocked — and
--   are fixed by repairing the creator.  This migration covers only the objects
--   with NO creator anywhere in the chain, verified against the full working tree
--   with a case-insensitive search that also matches `CREATE OR REPLACE`:
--
--     tables    : users, favorites, points_transactions, swap_points_ledger,
--                 moderation_queue, boost_listings, faq_votes,
--                 auto_complete_results, cron_manual_runs, trade_push_log,
--                 admin_audit_logs, v_config_value, v_referrer_sp
--     column    : profiles.role
--
--   Column types, nullability, defaults, primary keys, unique constraints,
--   indexes, RLS flags and policy expressions were taken from the LIVE database
--   (pg_catalog / information_schema), not hand-written.
--
-- DELIBERATELY NOT CREATED
--   `_orphan_image_snapshot_20260829` — a one-off manual snapshot table, not part
--   of the schema.  Excluded from the fidelity comparison, not recreated.
--
-- DEFERRED TO A LATER REPAIR (see 20260913000000_base_schema_repair_deferred_fks.sql)
--   * foreign keys whose parent table is created later in the chain
--     (subscription_tiers, faq_items, auto_complete_runs);
--   * the two `admin_audit_logs` policies that call `user_has_role(...)`, which is
--     created later in the chain;
--   * the `update_users_updated_at` / `sync_points_balance_after_insert` triggers.

-- =====================================================================
-- SECTION 1 — profiles.role
-- =====================================================================
-- Read by RLS policies across the chain (CPSC, platform policies, tax records,
-- item moderation) as `profiles.role IN ('admin','moderator')`.  The column
-- exists in the live database but no migration ever adds it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- =====================================================================
-- SECTION 2 — users
-- =====================================================================
-- The legacy user table (mirrors auth.users, carries the role and the legacy
-- points balance).  RLS policies on moderation_queue / boost_listings /
-- points_transactions read `users.role` to identify admins.
CREATE TABLE IF NOT EXISTS public.users (
  id                          uuid NOT NULL,
  display_name                text,
  email                       text,
  phone                       text,
  bio                         text,
  avatar_url                  text,
  node_id                     uuid,
  role                        text DEFAULT 'user',
  subscription_tier_id        uuid,
  swap_points_balance         integer DEFAULT 0,
  lifetime_swap_points_earned integer DEFAULT 0,
  is_banned                   boolean DEFAULT false,
  created_at                  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at                  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_users_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email   ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_node_id ON public.users USING btree (node_id);
CREATE INDEX IF NOT EXISTS idx_users_phone   ON public.users USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_users_role    ON public.users USING btree (role);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users FOR UPDATE USING (auth.uid() = id);

-- =====================================================================
-- SECTION 3 — favorites
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id         uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL,
  item_id    uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_item_id_key UNIQUE (user_id, item_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_active     ON public.favorites USING btree (user_id, item_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON public.favorites USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_item_id    ON public.favorites USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id    ON public.favorites USING btree (user_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_manage_own ON public.favorites;
CREATE POLICY favorites_manage_own ON public.favorites FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_select_own ON public.favorites;
CREATE POLICY favorites_select_own ON public.favorites FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_service_role ON public.favorites;
CREATE POLICY favorites_service_role ON public.favorites FOR ALL TO service_role USING (true);

-- =====================================================================
-- SECTION 4 — points_transactions (legacy points ledger)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id               uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL,
  amount           integer NOT NULL,
  reason           text,
  related_trade_id uuid,
  status           text DEFAULT 'pending',
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT points_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_points_transactions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_points_transactions_trade_id FOREIGN KEY (related_trade_id) REFERENCES public.trades(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON public.points_transactions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id    ON public.points_transactions USING btree (user_id);

ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS points_transactions_select_own ON public.points_transactions;
CREATE POLICY points_transactions_select_own ON public.points_transactions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS points_transactions_create_system ON public.points_transactions;
CREATE POLICY points_transactions_create_system ON public.points_transactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS points_transactions_admin_select ON public.points_transactions;
CREATE POLICY points_transactions_admin_select ON public.points_transactions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- =====================================================================
-- SECTION 5 — swap_points_ledger (legacy predecessor of sp_ledger)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.swap_points_ledger (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid,
  amount      integer NOT NULL,
  type        text NOT NULL,
  trade_id    uuid,
  status      text,
  description text,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT swap_points_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT swap_points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);

ALTER TABLE public.swap_points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS swap_points_ledger_service_role_all ON public.swap_points_ledger;
CREATE POLICY swap_points_ledger_service_role_all ON public.swap_points_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- SECTION 6 — moderation_queue
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id          uuid NOT NULL DEFAULT uuid_generate_v4(),
  item_id     uuid,
  reported_by uuid,
  reason      text,
  status      text DEFAULT 'open',
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  notes       text,
  CONSTRAINT moderation_queue_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mod_reporter FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_item_id ON public.moderation_queue USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status  ON public.moderation_queue USING btree (status);

ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_insert_report ON public.moderation_queue;
CREATE POLICY moderation_insert_report ON public.moderation_queue
  FOR INSERT WITH CHECK (reported_by = auth.uid());

DROP POLICY IF EXISTS moderation_admin_select ON public.moderation_queue;
CREATE POLICY moderation_admin_select ON public.moderation_queue
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS moderation_admin_manage ON public.moderation_queue;
CREATE POLICY moderation_admin_manage ON public.moderation_queue
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- =====================================================================
-- SECTION 7 — boost_listings
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boost_listings (
  id               uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL,
  item_id          uuid NOT NULL,
  duration_minutes integer DEFAULT 60,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT boost_listings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_boost_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER TABLE public.boost_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boost_insert ON public.boost_listings;
CREATE POLICY boost_insert ON public.boost_listings FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS boost_select_own ON public.boost_listings;
CREATE POLICY boost_select_own ON public.boost_listings FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS boost_admin_select ON public.boost_listings;
CREATE POLICY boost_admin_select ON public.boost_listings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- =====================================================================
-- SECTION 8 — faq_votes  (faq_item_id FK deferred — faq_items comes later)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.faq_votes (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  faq_item_id  uuid NOT NULL,
  user_id      uuid,
  anonymous_id text,
  vote         text NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT faq_votes_pkey PRIMARY KEY (id),
  CONSTRAINT faq_votes_vote_check CHECK (vote = ANY (ARRAY['yes'::text, 'no'::text])),
  CONSTRAINT faq_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS faq_votes_faq_item_id_idx ON public.faq_votes USING btree (faq_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS faq_votes_anon_unique ON public.faq_votes USING btree (faq_item_id, anonymous_id) WHERE (anonymous_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS faq_votes_user_unique ON public.faq_votes USING btree (faq_item_id, user_id) WHERE (user_id IS NOT NULL);

ALTER TABLE public.faq_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faq_votes_auth_read ON public.faq_votes;
CREATE POLICY faq_votes_auth_read ON public.faq_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS faq_votes_insert_all ON public.faq_votes;
CREATE POLICY faq_votes_insert_all ON public.faq_votes FOR INSERT WITH CHECK (true);

-- =====================================================================
-- SECTION 9 — auto_complete_results  (run_id FK deferred — auto_complete_runs comes later)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.auto_complete_results (
  id         bigserial NOT NULL,
  run_id     bigint,
  trade_id   uuid NOT NULL,
  success    boolean NOT NULL,
  rpc_result jsonb,
  error      text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT auto_complete_results_pkey PRIMARY KEY (id)
);

ALTER TABLE public.auto_complete_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_complete_results_service_role_all ON public.auto_complete_results;
CREATE POLICY auto_complete_results_service_role_all ON public.auto_complete_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- SECTION 10 — cron_manual_runs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cron_manual_runs (
  id             bigint NOT NULL,
  jobid          bigint NOT NULL,
  jobname        text NOT NULL,
  status         text NOT NULL DEFAULT 'succeeded',
  return_message text,
  started_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cron_manual_runs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.cron_manual_runs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 11 — trade_push_log
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.trade_push_log (
  id         uuid NOT NULL DEFAULT uuid_generate_v4(),
  trade_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  event_type text NOT NULL,
  sent_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trade_push_log_pkey PRIMARY KEY (id),
  CONSTRAINT trade_push_log_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_push_log_trade_user ON public.trade_push_log USING btree (trade_id, user_id);

ALTER TABLE public.trade_push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_push_log_service ON public.trade_push_log;
CREATE POLICY trade_push_log_service ON public.trade_push_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS trade_push_log_user_read ON public.trade_push_log;
CREATE POLICY trade_push_log_user_read ON public.trade_push_log FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =====================================================================
-- SECTION 12 — admin_audit_logs  (user_has_role policies deferred)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id    uuid,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  payload     jsonb,
  reason      text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id   ON public.admin_audit_logs USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity_id  ON public.admin_audit_logs USING btree (entity_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_logs_service_role_all ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_service_role_all ON public.admin_audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- SECTION 13 — v_config_value / v_referrer_sp
-- =====================================================================
-- Despite the name these are ordinary single-column helper TABLES in the live
-- database (pg_class.relkind = 'r'), used by cron jobs to read a config value and
-- a referral SP amount.
CREATE TABLE IF NOT EXISTS public.v_config_value (
  value text
);

ALTER TABLE public.v_config_value ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v_config_value_service_role_all ON public.v_config_value;
CREATE POLICY v_config_value_service_role_all ON public.v_config_value
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.v_referrer_sp (
  int4 integer
);

ALTER TABLE public.v_referrer_sp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v_referrer_sp_service_role_all ON public.v_referrer_sp;
CREATE POLICY v_referrer_sp_service_role_all ON public.v_referrer_sp
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- Verification (run one statement at a time):
--   select table_name, count(*) from information_schema.columns
--   where table_schema='public'
--     and table_name in ('users','favorites','points_transactions','swap_points_ledger',
--                        'moderation_queue','boost_listings','faq_votes',
--                        'auto_complete_results','cron_manual_runs','trade_push_log',
--                        'admin_audit_logs','v_config_value','v_referrer_sp')
--   group by 1 order by 1;
--   -- Expected: 14,5,7,8,8,5,6,7,6,5,8,1,1
--
--   select column_name, data_type, column_default from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='role';
--   -- Expected: role | text | 'user'::text
-- =====================================================================
