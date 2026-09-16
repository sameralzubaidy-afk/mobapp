-- File: supabase/migrations/20241213000003_base_schema_repair_node_ids_and_trades.sql
-- Mode B: idempotent rerunnable migration
--
-- FIX-Task-38 — base-schema repair, so the migration chain can be replayed from
-- an empty database (`supabase db reset`).
--
-- Two pieces of the live schema are not created by any migration in this repo:
--
--   1. `public.trades` — 64 statements across the chain read or alter it, but no
--      migration has ever contained its CREATE TABLE (verified against the
--      working tree AND the full git history; the only occurrence was inside a
--      partial schema dump, `archive/misc./temp.sql`, which is not a migration).
--
--   2. Node identity columns. `20241213000001_add_auth_module_tables.sql` creates
--      `public.nodes.id`, `public.profiles.node_id` and
--      `public.zip_codes.node_id` as TEXT, but the live schema stores them as
--      uuid and no migration ever converts them. As a result
--      `20251217000002_create_items_table_node_filtering.sql` — the ONLY migration
--      that creates `public.items` — fails with
--      "operator does not exist: text = uuid" on `p.node_id = gn.id`, which in
--      turn blocks the 34 statements that depend on `items`.
--
-- Both repairs sit here, immediately after `20241213000001` (which creates
-- `nodes`, `profiles` and `zip_codes`) and BEFORE the `profiles_with_auth` view
-- is created by `20241214000003`, so the ALTER COLUMN TYPE calls do not have to
-- fight a dependent view.

-- =====================================================================
-- SECTION 1 — node identity columns become uuid
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nodes'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    -- Drop the two FKs that reference nodes(id) before retyping either side.
    ALTER TABLE public.profiles  DROP CONSTRAINT IF EXISTS fk_profiles_node_id;
    ALTER TABLE public.zip_codes DROP CONSTRAINT IF EXISTS zip_codes_node_id_fkey;

    ALTER TABLE public.zip_codes ALTER COLUMN node_id DROP NOT NULL;

    ALTER TABLE public.nodes     ALTER COLUMN id      TYPE uuid USING id::uuid;
    ALTER TABLE public.zip_codes ALTER COLUMN node_id TYPE uuid USING node_id::uuid;
    ALTER TABLE public.profiles  ALTER COLUMN node_id TYPE uuid
      USING NULLIF(node_id, '')::uuid;

    ALTER TABLE public.zip_codes ALTER COLUMN node_id SET NOT NULL;

    ALTER TABLE public.zip_codes ADD CONSTRAINT zip_codes_node_id_fkey
      FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE RESTRICT;
    ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_node_id
      FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL;

    RAISE NOTICE 'FIX-Task-38: node identity columns converted to uuid';
  END IF;
END $$;

-- =====================================================================
-- SECTION 2 — pg_cron must exist before anything uses the cron schema
-- =====================================================================
-- 35 statements in the chain read or write `cron.job` / `cron.job_run_details`,
-- and `cron` is NOT part of the local Supabase base schema (only three late
-- migrations create the extension). Creating it here makes the chain
-- self-sufficient. Idempotent: a no-op wherever it is already installed.
--
-- FIX-Task-40: `CREATE EXTENSION IF NOT EXISTS pg_cron` alone is NOT safe here.
-- `084_add_pg_cron_send_message_emails.sql` and
-- `20251226_add_pg_cron_and_auto_complete.sql` both sort EARLIER than this file
-- and, as their first step, run `CREATE SCHEMA IF NOT EXISTS cron` as a fallback
-- for environments where pg_cron cannot be installed. pg_cron's own install
-- script then runs a bare `CREATE SCHEMA cron`, so with that empty placeholder
-- present the extension can never be installed — the statement aborts the whole
-- file with `schema "cron" already exists`, which silently removes `public.trades`
-- and cascades into ~77 other files.
--
-- So: drop the placeholder first, but only when it is genuinely empty, so a
-- populated `cron` schema (a real pg_cron install) can never be lost.
DO $$
DECLARE
  v_placeholder_is_empty boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  IF to_regnamespace('cron') IS NOT NULL THEN
    SELECT NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'cron'::regnamespace)
       AND NOT EXISTS (SELECT 1 FROM pg_proc  WHERE pronamespace = 'cron'::regnamespace)
       AND NOT EXISTS (SELECT 1 FROM pg_type  WHERE typnamespace  = 'cron'::regnamespace)
      INTO v_placeholder_is_empty;

    IF v_placeholder_is_empty THEN
      DROP SCHEMA cron;
      RAISE NOTICE 'FIX-Task-40: dropped the empty cron placeholder left by 084';
    END IF;
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FIX-Task-40: pg_cron could not be installed (%); cron.* callers will fail on this database', SQLERRM;
  END;
END $$;

-- =====================================================================
-- SECTION 3 — public.trades base table (live shape, 95 columns)
-- =====================================================================
-- Columns only. Foreign keys, CHECK constraints, indexes and RLS policies are
-- added by the migrations that already do so later in the chain.

CREATE TABLE IF NOT EXISTS public.trades (
  id                                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id                         uuid NOT NULL,
  buyer_id                           uuid NOT NULL,
  seller_id                          uuid NOT NULL,
  status                             text DEFAULT 'pending',
  payment_method                     text DEFAULT 'cash',
  sp_amount                          integer DEFAULT 0,
  cash_amount_cents                  integer,
  node_id                            uuid,
  created_at                         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                         timestamp with time zone DEFAULT now() NOT NULL,
  cash_currency                      text DEFAULT 'usd',
  buyer_subscription_status          text,
  buyer_transaction_fee_cents        integer DEFAULT 0 NOT NULL,
  stripe_payment_intent_id           text,
  sp_debit_ledger_entry_id           uuid,
  sp_credit_ledger_entry_id          uuid,
  last_status_change_at              timestamp with time zone DEFAULT now(),
  completed_at                       timestamp with time zone,
  cancelled_at                       timestamp with time zone,
  seller_marked_completed_at         timestamp with time zone,
  cancellation_reason                text,
  metadata                           jsonb DEFAULT '{}'::jsonb,
  stripe_refund_id                   text,
  buyer_marked_completed_at          timestamp with time zone,
  offer_expires_at                   timestamp with time zone,
  auto_complete_at                   timestamp with time zone,
  seller_notified_at                 timestamp with time zone,
  pending_sp_release_at              timestamp with time zone,
  disputed_at                        timestamp with time zone,
  dispute_reason                     text,
  dispute_notes                      text,
  dispute_resolution                 text,
  payment_preference_snapshot        text,
  final_sp_amount                    integer DEFAULT 0,
  total_fee_cents                    integer DEFAULT 0,
  payout_initiated_at                timestamp with time zone,
  payout_completed_at                timestamp with time zone,
  payout_failed_reason               text,
  payout_idempotency_key             text,
  bundle_size                        integer DEFAULT 1,
  sp_category_multiplier             numeric(5,2) DEFAULT 1.00,
  sp_earned_at_completion            integer DEFAULT 0,
  sp_released_at                     timestamp with time zone,
  sp_reserved_at                     timestamp with time zone,
  authorization_expires_at           timestamp with time zone,
  dispute_status                     text DEFAULT 'none' NOT NULL,
  payout_status                      text DEFAULT 'pending' NOT NULL,
  dispute_opened_at                  timestamp with time zone,
  tax_amount_cents                   integer DEFAULT 0 NOT NULL,
  taxable_amount_cents               integer DEFAULT 0 NOT NULL,
  tax_rate_applied                   numeric(5,4),
  tax_jurisdiction                   text,
  bundle_id                          uuid,
  reminder_6h_sent_at                timestamp with time zone,
  reminder_1h_sent_at                timestamp with time zone,
  dispute_resolved_at                timestamp with time zone,
  dispute_resolved_by                uuid,
  payout_amount_cents                integer,
  ac_reminder_24h_sent_at            timestamp with time zone,
  ac_reminder_2h_sent_at             timestamp with time zone,
  seller_sp_earned                   integer DEFAULT 0,
  seller_sp_bonus                    integer DEFAULT 0,
  sp_transferred_at                  timestamp with time zone,
  seller_transaction_fee_cents       integer DEFAULT 0 NOT NULL,
  pickup_reminder_1_sent_at          timestamp with time zone,
  pickup_reminder_2_sent_at          timestamp with time zone,
  payout_release_at                  timestamp with time zone,
  buyer_fee_state                    text,
  consumed_first_trade_eligibility   boolean DEFAULT false NOT NULL,
  extension_status                   text,
  extension_requested_by             uuid,
  extension_requested_at             timestamp with time zone,
  extension_request_expires_at       timestamp with time zone,
  extension_responded_by             uuid,
  extension_responded_at             timestamp with time zone,
  extension_granted_at               timestamp with time zone,
  payout_paid_at                     timestamp with time zone,
  stripe_transfer_id                 text,
  auto_completed_at                  timestamp with time zone,
  disclaimer_acknowledged            boolean DEFAULT false,
  disclaimer_policy_id               uuid,
  disclaimer_acknowledged_at         timestamp with time zone,
  stripe_payment_method_brand        text,
  stripe_payment_method_last4        text,
  notes                              text,
  cancel_requested_by                uuid,
  cancel_requested_role              text,
  cancel_request_reason              text,
  cancel_request_status              text,
  cancel_request_created_at          timestamp with time zone,
  cancel_request_expires_at          timestamp with time zone,
  cancel_request_resolved_at         timestamp with time zone,
  cancel_request_resolved_by         uuid,
  cancel_request_resolution          text
);


-- =====================================================================
-- ASSERTIONS
-- =====================================================================
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trades')  AS trades_columns,
  (SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'nodes'
      AND column_name = 'id')                                 AS nodes_id_type,
  (SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'node_id')                            AS profiles_node_id_type;
