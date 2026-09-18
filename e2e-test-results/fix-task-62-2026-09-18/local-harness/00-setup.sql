-- =============================================================================
-- FIX-Task-62 — LOCAL harness, part 1 of 2 (SETUP + PRE-SEED).
--
-- NOT a repo migration; never apply to staging. It lets the FIX-Task-62 migration
-- be EXECUTED and asserted against a throwaway local PostgreSQL database before it
-- reaches staging.
--
-- Run order:
--   createdb fix62_scratch
--   psql -d fix62_scratch -v ON_ERROR_STOP=1 -f 00-setup.sql
--   psql -d fix62_scratch -v ON_ERROR_STOP=1 -f ../../supabase/migrations/20260918000010_fix_task_62_requeue_action_required_payouts.sql
--   psql -d fix62_scratch -v ON_ERROR_STOP=1 -f ../../supabase/migrations/20260918000011_fix_task_62_backfill_payout_amount_cents.sql
--   psql -d fix62_scratch -v ON_ERROR_STOP=1 -f ../../supabase/migrations/20260918000012_fix_task_62_gate_requeue_behind_flag.sql
--   psql -d fix62_scratch -v ON_ERROR_STOP=1 -f ../../supabase/migrations/20260918000013_fix_task_62_d2_presumed_settled_guard.sql
--   psql -d fix62_scratch -v ON_ERROR_STOP=1 -f 10-tests.sql
--   psql -d fix62_scratch -c "SELECT test_id, verdict, expectation, observed FROM public.fix62_results ORDER BY test_id;"
--
-- It creates the MINIMUM surface the migration touches, mirroring the real column
-- shapes and the two CHECK constraints that are part of the behaviour under test:
--   * the roles the migration's REVOKE/GRANT name
--   * public.trades           — the driver table (pass 2 keys off it)
--   * public.seller_payouts   — incl. the real `net_amount_calculation_valid` CHECK
--                               and the `trade_id ... ON DELETE SET NULL` FK that
--                               Fix E exists for
--   * public.seller_payout_methods — incl. the real unique partial index
--   * public.seller_balance   — so pass 1's credit and pass 2's neutrality are both observable
--   * public.financial_audit_log + fn_log_financial_audit — the D2 review flag's target
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

CREATE TABLE public.trades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id          UUID NOT NULL,
  buyer_id           UUID,
  status             TEXT NOT NULL,
  dispute_status     TEXT,
  payout_status      TEXT,
  payout_release_at  TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  payout_amount_cents INTEGER,
  cash_amount_cents  INTEGER,
  updated_at         TIMESTAMPTZ DEFAULT now()   -- migration 11 stamps this
);

CREATE TABLE public.seller_payout_methods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  method_type       TEXT NOT NULL DEFAULT 'stripe_connect',
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_account_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- The REAL index from 20260916000045_seller_payouts.sql — part of the behaviour.
CREATE UNIQUE INDEX seller_payout_methods_one_primary_idx
  ON public.seller_payout_methods (user_id)
  WHERE is_primary = TRUE;

CREATE TABLE public.seller_payouts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL,
  trade_id              UUID REFERENCES public.trades(id) ON DELETE SET NULL,  -- Fix E's root cause
  payout_method_id      UUID,
  currency              TEXT NOT NULL DEFAULT 'usd',
  gross_amount_cents    INTEGER NOT NULL DEFAULT 0 CHECK (gross_amount_cents >= 0),
  platform_fee_cents    INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  payout_fee_cents      INTEGER NOT NULL DEFAULT 0 CHECK (payout_fee_cents >= 0),
  net_amount_cents      INTEGER NOT NULL DEFAULT 0 CHECK (net_amount_cents >= 0),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                          'requires_action', 'pending', 'processing', 'completed', 'failed')),
  provider              TEXT CHECK (provider IN ('stripe', 'paypal', 'ach')),
  provider_reference_id TEXT,
  idempotency_key       TEXT UNIQUE,
  initiated_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT net_amount_calculation_valid
    CHECK (net_amount_cents = (gross_amount_cents - platform_fee_cents - payout_fee_cents))
);

CREATE TABLE public.seller_balance (
  user_id                 UUID PRIMARY KEY,
  available_balance_cents INTEGER NOT NULL DEFAULT 0,
  pending_balance_cents   INTEGER NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.fix62_results (
  test_id     TEXT,
  expectation TEXT,
  observed    TEXT,
  verdict     TEXT
);

-- FIX-Task-62 (D2): the kill-switch surface. `admin_config` + `fn_admin_config_int`
-- are what the gated migration reads, so the harness must provide them or the
-- migration would fail locally for an unrepresentative reason.
CREATE TABLE public.admin_config (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  category   TEXT NOT NULL DEFAULT 'feature_flags',
  data_type  TEXT NOT NULL DEFAULT 'string',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_admin_config_int(p_key TEXT, p_default INTEGER DEFAULT 0)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_val TEXT;
BEGIN
  SELECT ac.value INTO v_val
  FROM public.admin_config ac
  WHERE ac.key = p_key AND ac.is_active = TRUE
  LIMIT 1;

  IF v_val IS NULL OR btrim(v_val) = '' THEN
    RETURN p_default;
  END IF;

  BEGIN
    RETURN v_val::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RETURN p_default;
  END;
END;
$$;

-- FIX-Task-62 (D2): the audit journal the new `payout_requeue_skipped` review flag
-- is written to. Mirrors the REAL shape from `20260916000118_n2_idempotency_audit.sql`
-- (column list, the inline `mutation_type` CHECK — which the migration DROPs and
-- re-ADDs by its default name `financial_audit_log_mutation_type_check` — and the
-- `idempotency_key` UNIQUE that makes the writer ON CONFLICT-safe).
-- Deliberate omissions, neither of which the D2 guard depends on: the `nodes` FK
-- (that table is out of scope here) and the `trg_fill_financial_audit_node_id`
-- trigger (it only fills node_id; the D2 guard never reads it).
CREATE TABLE public.financial_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mutation_type   TEXT NOT NULL CHECK (mutation_type IN (
                    'offer_created', 'payment_intent_created', 'payment_captured',
                    'payment_capture_failed', 'payment_cancelled', 'refund_issued',
                    'refund_voided', 'payout_initiated', 'payout_paid',
                    'payout_requires_action', 'payout_failed', 'payout_scheduled',
                    'sp_reserved', 'sp_restored', 'sp_released', 'sp_issued',
                    'sp_deducted', 'sp_frozen', 'sp_unfrozen', 'sp_expired',
                    'buyer_fee_charged', 'seller_fee_deducted',
                    'tax_quoted', 'tax_collected', 'tax_voided', 'tax_refunded',
                    'trade_cancelled', 'trade_completed',
                    -- These four are LIVE-ONLY: no migration file in the chain lists
                    -- them (read from `pg_get_constraintdef` on staging 2026-09-18).
                    -- They are the witnesses that the migration's allow-list
                    -- extension is ADDITIVE — reconstructing the list from a file
                    -- would drop them and the ADD would fail 23514 (see T15).
                    'trade_extension_reauth', 'extension_requested',
                    'dispute_evidence_staged')),
  entity_type     TEXT,
  entity_id       UUID,
  actor_id        UUID,
  before_state    JSONB DEFAULT '{}'::jsonb,
  after_state     JSONB DEFAULT '{}'::jsonb,
  amount_cents    INTEGER,
  idempotency_key TEXT UNIQUE,
  node_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_log_financial_audit(
  p_mutation_type   TEXT,
  p_entity_type     TEXT,
  p_entity_id       UUID,
  p_actor_id        UUID    DEFAULT NULL,
  p_before_state    JSONB   DEFAULT NULL,
  p_after_state     JSONB   DEFAULT NULL,
  p_amount_cents    INTEGER DEFAULT NULL,
  p_idempotency_key TEXT    DEFAULT NULL,
  p_node_id         UUID    DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  INSERT INTO public.financial_audit_log (
    mutation_type, entity_type, entity_id, actor_id,
    before_state, after_state, amount_cents, idempotency_key, node_id
  )
  VALUES (
    p_mutation_type, p_entity_type, p_entity_id, p_actor_id,
    COALESCE(p_before_state, '{}'::jsonb), COALESCE(p_after_state, '{}'::jsonb),
    p_amount_cents, p_idempotency_key, p_node_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;

-- =============================================================================
-- PRE-SEED — rows that must exist BEFORE the migration runs, so the Fix E
-- backfill can be asserted (a backfill cannot be tested on rows inserted after it).
-- =============================================================================

-- Orphan #1 — a real orphan: the trade was deleted, leaving trade_id NULL while the
-- payout is still parked (this is the live shape of 4 staging rows, identifiable by
-- an idempotency key of the form trade:<uuid>:seller:<uuid>).
INSERT INTO public.seller_payouts
  (id, user_id, trade_id, status, gross_amount_cents, net_amount_cents, idempotency_key)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001',
   NULL, 'requires_action', 1800, 1800,
   'trade:deadbeef-0000-0000-0000-000000000001:seller:aaaaaaaa-0000-0000-0000-000000000001');

-- Orphan #2 — a LEGITIMATE trade-less MANUAL withdrawal awaiting
-- `dispatch-manual-payouts` (status 'processing'). The backfill must NOT touch it.
INSERT INTO public.seller_payouts
  (id, user_id, trade_id, status, gross_amount_cents, net_amount_cents, provider)
VALUES
  ('22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-0000-0000-0000-000000000002',
   NULL, 'processing', 2500, 2500, 'stripe');
