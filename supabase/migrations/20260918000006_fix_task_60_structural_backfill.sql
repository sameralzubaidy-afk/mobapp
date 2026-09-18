-- ============================================================================
-- FIX-Task-60 — structural backfill: objects staging has that the chain never created
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- ============================================================================
--
-- Every object below exists on the LIVE staging schema but had no creator in the
-- migration chain, so a from-scratch rebuild silently produced a smaller/weaker
-- schema than the one that actually runs. Definitions are copied from the staging
-- fingerprints (supabase/migrations/tools/fp*.sql output, captured 2026-09-16), so
-- nothing here is invented.
--
-- Grouped by domain (FIX-Task-43's recommendation: land this as coherent groups
-- rather than one sweeping change):
--   §1 nodes        — geo types + the index/trigger that depend on them
--   §2 trades       — money-path indexes, integrity FKs, updated_at trigger
--   §3 items/profiles/badges — node_id integrity FKs
--   §4 referrals    — code-length / self-referral rules, auto-code triggers
--   §5 subscriptions— tier + per-user entitlement columns
--   §6 email_logs   — delivery-tracking columns and indexes
--   §7 misc columns — moderation, safety, FAQ, cron bookkeeping
--   §8 nullability  — align NOT NULL with the live schema
--
-- NOT included (deliberate, documented in the FIX-Task-60 report):
--   * `email_logs_status_check` — a second, redundant CHECK on email_logs.status
--     that stages narrower than the chain's own `email_status_check`; backfilling it
--     would only NARROW the accepted set. Verdict: staging cruft, remove on staging.
--   * the two `referrals` policies that reference the LEGACY `referrer_id` /
--     `referee_id` columns — dead rules that modern code never satisfies.
--   * the 13 staging-only `*_anon_*` policies — a staging SECURITY issue, not a
--     gap in the chain (see the report).

-- ============================================================================
-- §1 nodes — geo column types, spatial index, updated_at trigger
-- ============================================================================
-- The staged `idx_nodes_location` is `gist (st_makepoint(longitude, latitude))`.
-- With NUMERIC columns that expression renders as
-- `st_makepoint((longitude)::double precision, (latitude)::double precision)`,
-- which is a DIFFERENT definition — so the column type is what makes the index
-- reproducible at all. Staging stores both as DOUBLE PRECISION.

ALTER TABLE public.nodes ALTER COLUMN latitude  TYPE DOUBLE PRECISION USING latitude::DOUBLE PRECISION;
ALTER TABLE public.nodes ALTER COLUMN longitude TYPE DOUBLE PRECISION USING longitude::DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_nodes_location ON public.nodes USING gist (st_makepoint(longitude, latitude));

DROP TRIGGER IF EXISTS update_nodes_updated_at ON public.nodes;
CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- §2 trades — indexes, FKs, trigger
-- ============================================================================
-- NOTE: `idx_trades_item_id` is an index on `listing_id` — the trades->items FK
-- column is `listing_id` (BP-73); the index name is legacy.

CREATE INDEX IF NOT EXISTS idx_trades_buyer_id    ON public.trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id   ON public.trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at  ON public.trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status      ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_cancelled_at ON public.trades(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_trades_item_id     ON public.trades(listing_id);
CREATE INDEX IF NOT EXISTS idx_trades_status_created_seller_marked
  ON public.trades(status, created_at, seller_marked_completed_at);
CREATE INDEX IF NOT EXISTS idx_trades_dispute_status
  ON public.trades(dispute_status) WHERE dispute_status IN ('reported', 'under_review');
CREATE INDEX IF NOT EXISTS idx_trades_payout_status
  ON public.trades(payout_status) WHERE payout_status = 'requires_action';

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_disclaimer_policy_id_fkey;
ALTER TABLE public.trades ADD CONSTRAINT trades_disclaimer_policy_id_fkey
  FOREIGN KEY (disclaimer_policy_id) REFERENCES public.platform_policies(id) ON DELETE SET NULL;

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_dispute_resolved_by_fkey;
ALTER TABLE public.trades ADD CONSTRAINT trades_dispute_resolved_by_fkey
  FOREIGN KEY (dispute_resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS update_trades_updated_at ON public.trades;
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- §3 items / profiles / id_badge_verification_requests — node_id integrity
-- ============================================================================

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_node_id_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_node_id_fkey
  FOREIGN KEY (node_id) REFERENCES public.nodes(id);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_node_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_node_id_fkey
  FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL;

ALTER TABLE public.id_badge_verification_requests
  DROP CONSTRAINT IF EXISTS id_badge_verification_requests_node_id_fkey;
ALTER TABLE public.id_badge_verification_requests
  ADD CONSTRAINT id_badge_verification_requests_node_id_fkey
  FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL;

-- ============================================================================
-- §4 referrals — integrity rules + automatic referral-code creation
-- ============================================================================

ALTER TABLE public.referral_codes DROP CONSTRAINT IF EXISTS code_length;
ALTER TABLE public.referral_codes ADD CONSTRAINT code_length CHECK (char_length(code) = 8);

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_no_self_referral;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_no_self_referral
  CHECK (referrer_user_id <> referred_user_id);

-- The helper already exists in the chain (ensure_profile_referral_code()); staging
-- simply has triggers that call it, so a rebuilt database never auto-created a
-- user's referral code on profile creation.
DROP TRIGGER IF EXISTS trg_profiles_ensure_referral_code_ins ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_referral_code_ins
  AFTER INSERT ON public.profiles
  FOR EACH ROW WHEN (new.referral_code IS NULL)
  EXECUTE FUNCTION ensure_profile_referral_code();

DROP TRIGGER IF EXISTS trg_profiles_ensure_referral_code_upd ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_referral_code_upd
  AFTER UPDATE ON public.profiles
  FOR EACH ROW WHEN (new.referral_code IS NULL AND old.referral_code IS NULL)
  EXECUTE FUNCTION ensure_profile_referral_code();

-- ============================================================================
-- §5 subscription_tiers — entitlement columns, and the user_subscriptions view
-- ============================================================================
-- `user_subscriptions` is a VIEW over `subscriptions`, not a table. Its creator
-- (20260213000000_enhance_subscriptions_sub_002.sql) defines it as `SELECT *`, which
-- freezes the column list at creation time — and that file runs BEFORE several later
-- migrations add columns to `subscriptions`. The rebuilt view therefore had 32
-- columns while the live staging view has 34: it was missing
-- `referral_extensions_used` (position 14) and `trial_used_at` (last).
-- Re-creating it with `SELECT *` here would be wrong too — it would expose every
-- column `subscriptions` has today (~38), more than staging's 34.
-- The explicit list below mirrors the staging view exactly. It has to live at the
-- END of the chain (not in the creator) because the columns must already exist for a
-- single-pass replay; putting it in the creator made that file fail on pass 1.
-- (An earlier draft of this migration also tried `ALTER TABLE ... ADD COLUMN` on the
-- view; the replay probe rejected it: "ADD COLUMN cannot be performed on relation
-- user_subscriptions — not supported for views". BP-96 catching a wrong assumption.)
-- No object depends on the view (checked via pg_depend), so the DROP is safe.

ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS price_monthly         NUMERIC(8,2) DEFAULT 0.00;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS max_active_listings   INTEGER DEFAULT 3;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS max_boost_listings    INTEGER DEFAULT 0;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS priority_support      BOOLEAN DEFAULT false;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS early_access_features BOOLEAN DEFAULT false;

DROP VIEW IF EXISTS public.user_subscriptions;
CREATE VIEW public.user_subscriptions AS
SELECT
    id,
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    current_period_start,
    current_period_end,
    created_at,
    updated_at,
    canceled_at,
    referral_extensions_used,
    tier_id,
    monthly_price_cents,
    last_payment_date,
    last_payment_amount,
    next_billing_date,
    payment_failed_at,
    payment_retry_count,
    auto_renew_enabled,
    cancelled_at,
    cancel_reason,
    cancel_at_period_end,
    paused_until,
    grace_started_at,
    grace_ends_at,
    has_used_trial,
    stripe_payment_method_id,
    trial_reminder_day_23_sent,
    trial_reminder_day_28_sent,
    trial_reminder_day_29_sent,
    trial_used_at
FROM public.subscriptions;

COMMENT ON VIEW public.user_subscriptions IS 'Alias view for subscriptions table (matches MODULE-11 naming convention)';

-- ============================================================================
-- §6 email_logs — delivery-tracking columns and indexes
-- ============================================================================
-- `email_type` is NOT NULL with no default on staging, and `create_email_log()`
-- already writes it (from p_template_type) on the branch taken when the column
-- exists. To add it to a database that already has rows, add it nullable, backfill
-- from the same source the RPC uses, then enforce NOT NULL.

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS email_type            TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS notification_category TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS is_critical           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS metadata              JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS failed_at             TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS unsubscribe_token     TEXT
  DEFAULT encode(gen_random_bytes(32), 'hex');

-- Backfill (no-op on an empty table / a database that already has the column).
UPDATE public.email_logs SET email_type = template_type WHERE email_type IS NULL;
ALTER TABLE public.email_logs ALTER COLUMN email_type SET NOT NULL;

ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_unsubscribe_token_key;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_unsubscribe_token_key UNIQUE (unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_email_logs_email_type  ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_unsubscribe ON public.email_logs(unsubscribe_token);

-- ============================================================================
-- §7 misc columns (moderation, safety, FAQ, cron bookkeeping)
-- ============================================================================

ALTER TABLE public.ai_moderation_logs ADD COLUMN IF NOT EXISTS model      TEXT;
ALTER TABLE public.ai_moderation_logs ADD COLUMN IF NOT EXISTS result     JSONB;
ALTER TABLE public.ai_moderation_logs ADD COLUMN IF NOT EXISTS confidence NUMERIC;

ALTER TABLE public.cpsc_recalls ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.faq_items ADD COLUMN IF NOT EXISTS yes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.faq_items ADD COLUMN IF NOT EXISTS no_count  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.auto_complete_runs ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'pg_cron';
ALTER TABLE public.auto_complete_runs ADD COLUMN IF NOT EXISTS details      JSONB DEFAULT '{}'::jsonb;

-- `auto_complete_runs.id` is bigint on staging (a run-every-15-minutes log).
ALTER TABLE public.auto_complete_runs ALTER COLUMN id TYPE BIGINT;
-- staging has NO default on errors_count; the chain added one.
ALTER TABLE public.auto_complete_runs ALTER COLUMN errors_count DROP DEFAULT;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_filled_from_provider BOOLEAN DEFAULT false;

-- ============================================================================
-- §8 nullability alignment
-- ============================================================================
-- The chain is STRICTER than staging on six columns. A stricter constraint can
-- REJECT an insert the live system accepts, so these are relaxed to match staging.

ALTER TABLE public.referrals        ALTER COLUMN referrer_user_id DROP NOT NULL;
ALTER TABLE public.referrals        ALTER COLUMN referred_user_id DROP NOT NULL;
ALTER TABLE public.referrals        ALTER COLUMN referral_code     DROP NOT NULL;
ALTER TABLE public.referrals        ALTER COLUMN status            DROP NOT NULL;
ALTER TABLE public.cpsc_recalls     ALTER COLUMN recall_date       DROP NOT NULL;
ALTER TABLE public.cpsc_recalls     ALTER COLUMN recall_number     DROP NOT NULL;
ALTER TABLE public.ai_moderation_logs ALTER COLUMN item_id         DROP NOT NULL;

-- The chain is LOOSER than staging on two timestamp columns; tighten them (backfill
-- first so the SET NOT NULL cannot fail).
UPDATE public.email_logs   SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE public.email_logs ALTER COLUMN created_at SET NOT NULL;

UPDATE public.trade_events SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE public.trade_events ALTER COLUMN created_at SET NOT NULL;

-- ============================================================================
-- Verification (SQL-3)
-- ============================================================================
-- SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('trades','email_logs','nodes') ORDER BY 1;
-- SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace
--   AND conname IN ('items_node_id_fkey','profiles_node_id_fkey',
--                   'id_badge_verification_requests_node_id_fkey',
--                   'trades_disclaimer_policy_id_fkey','trades_dispute_resolved_by_fkey',
--                   'code_length','referrals_no_self_referral','email_logs_unsubscribe_token_key');
-- Expected: 8 rows.
-- SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE '%updated_at%'
--   OR tgname LIKE '%ensure_referral_code%';
-- Expected: update_nodes_updated_at, update_trades_updated_at,
--           trg_profiles_ensure_referral_code_ins, trg_profiles_ensure_referral_code_upd
-- ============================================================================
