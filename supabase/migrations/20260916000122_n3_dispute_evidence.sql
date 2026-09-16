-- ============================================================================
-- N3 — Dispute Evidence Packaging (Cross-Cutting)
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   When a buyer files a chargeback, Stripe fires `charge.dispute.created`. The
--   stripe-webhook Edge Function now automatically packages dispute evidence:
--   the buyer/seller messaging history (uploaded as a Stripe File for
--   `evidence.customer_communication`), the trade's actual completion timestamp
--   (`evidence.service_date`), the pickup location (`evidence.shipping_address`),
--   and a plain-text trade summary (`evidence.uncategorized_text`) — then calls
--   POST /v1/disputes/{DISPUTE_ID} with `submit=false` so the evidence is
--   STAGED (pre-filled in the Stripe Dashboard for an admin's final
--   glance-and-submit), never auto-submitted (locked decision 2026-08-10:
--   packaging logic is unproven at scale during the Westport pilot).
--
--   This migration is the DB write path for that packaging step. It extends the
--   R4 `dispute_costs` ledger (one row per Stripe dispute, idempotency key =
--   dispute_id) with additive, nullable evidence columns and an idempotent RPC
--   `rpc_record_dispute_evidence` so webhook replays can never double-upload a
--   Stripe file or double-stage evidence. No existing columns are changed.
--
--   RULES applied: SQL-0 (Mode B), SQL-2 (columns before the RPC), BP-1/RLS
--   (dispute_costs already service-role-only from R4 — unchanged), BP-5
--   (SECURITY DEFINER + search_path), BP-9 (schema -> function -> grants),
--   HP-4 (CHECK invariant on evidence_status), HP-5 (single idempotent RPC),
--   p_/v_ naming, qualified columns, BP-46 (every v_ declared), BP-50
--   (unique timestamp 20260810000011 — verified no collision).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: Schema — additive, nullable evidence columns on dispute_costs
--   (SQL-8: nullable/additive; existing rows and R4 code are unaffected).
-- ---------------------------------------------------------------------------
ALTER TABLE public.dispute_costs
  ADD COLUMN IF NOT EXISTS evidence_status TEXT NOT NULL DEFAULT 'none'
    CHECK (evidence_status IN ('none','staged','failed','skipped')),
  ADD COLUMN IF NOT EXISTS evidence_staged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_file_id TEXT,
  ADD COLUMN IF NOT EXISTS evidence_error TEXT,
  ADD COLUMN IF NOT EXISTS evidence_json JSONB;

-- ---------------------------------------------------------------------------
-- BLOCK 2: rpc_record_dispute_evidence — idempotent write path for the
--          stripe-webhook N3 packaging step (HP-5: one RPC, no scattered
--          updates; replay-safe like rpc_record_dispute_event).
--          SECURITY DEFINER (BP-5): the service-role EF writes through this so
--          the state transition is centralized and auditable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_record_dispute_evidence(
  p_dispute_id TEXT,
  p_status TEXT,
  p_file_id TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_evidence JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_current_status TEXT;
BEGIN
  IF p_dispute_id IS NULL OR p_dispute_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_dispute_id is required');
  END IF;

  SELECT d.id, d.evidence_status
    INTO v_id, v_current_status
    FROM public.dispute_costs d
   WHERE d.dispute_id = p_dispute_id;

  IF v_id IS NULL THEN
    -- Accounting row not created yet (e.g. replay raced ahead of the R4
    -- handler). Cost/state ownership stays with rpc_record_dispute_event;
    -- this RPC only annotates evidence, so it cannot invent a ledger row.
    RETURN jsonb_build_object(
      'success', false,
      'error', 'dispute_costs row not found',
      'dispute_id', p_dispute_id
    );
  END IF;

  -- Terminal staged state is never regressed by a late/replayed event
  -- (mirrors the R4 terminal-state guard: won/lost/withdrawn never -> open).
  IF v_current_status = 'staged' AND p_status <> 'staged' THEN
    RETURN jsonb_build_object('success', true, 'status', v_current_status, 'skipped', 'already_staged');
  END IF;

  UPDATE public.dispute_costs d SET
    evidence_status    = p_status,
    evidence_staged_at = CASE WHEN p_status = 'staged'
                              THEN COALESCE(d.evidence_staged_at, now())
                              ELSE d.evidence_staged_at END,
    evidence_file_id   = COALESCE(p_file_id, d.evidence_file_id),
    evidence_error     = CASE WHEN p_status = 'failed' THEN p_error ELSE NULL END,
    evidence_json      = COALESCE(p_evidence, d.evidence_json),
    updated_at         = now()
  WHERE d.id = v_id;

  RETURN jsonb_build_object('success', true, 'status', p_status, 'dispute_id', p_dispute_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- BLOCK 3: Grants (mirrors R4 — service-role only; webhook EF uses the
--          service-role client, so this is defense-in-depth).
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.rpc_record_dispute_evidence(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 4: Verification queries (BP-10 / SQL-3 — copy into the SQL editor to
--          confirm the migration landed; run one statement at a time).
--
-- 1) Columns present:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'dispute_costs'
--      AND column_name IN ('evidence_status','evidence_staged_at',
--                          'evidence_file_id','evidence_error','evidence_json')
--    ORDER BY column_name;
--    Expect exactly 5 rows.
--
-- 2) RPC exists + signature:
--    SELECT p.proname, pg_get_function_identity_arguments(p.oid)
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'rpc_record_dispute_evidence';
--    Expect: rpc_record_dispute_evidence | p_dispute_id text, p_status text,
--            p_file_id text, p_error text, p_evidence jsonb
--
-- 3) Sanity: a non-existent dispute returns an actionable error (no crash):
--    SELECT public.rpc_record_dispute_evidence('dp_does_not_exist', 'staged');
--    Expect: {"success": false, "error": "dispute_costs row not found", ...}
--
-- COMMON FAILURE MODES:
--   * Ambiguous column names — all references are qualified with d. aliases.
--   * RLS scope — dispute_costs is service-role-only; the webhook EF runs with
--     the service-role client, so RLS never filters the update. The RPC is
--     SECURITY DEFINER so even a non-role caller cannot bypass the guard.
--   * Replays — repeated 'staged' calls are no-ops; a late 'failed' cannot
--     regress a 'staged' row (terminal-state guard above).
-- ============================================================================
