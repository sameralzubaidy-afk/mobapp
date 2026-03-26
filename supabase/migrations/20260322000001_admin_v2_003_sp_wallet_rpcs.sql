-- Migration: ADMIN-V2-003 SP Wallet Admin Operations
-- Mode B: Idempotent rerunnable migration
-- Task: TASK ADMIN-V2-003 (MODULE-12-ADMIN-V2.md)
-- Dependencies: sp_wallets (20251215100000), sp_ledger (061_sp_ledger_and_trade_rpcs),
--               admin_audit_logs (20251227_admin_trade_tools)

-- =============================================================================
-- BLOCK 1 — Schema: Add service-role RLS policy for admin access to sp tables
-- service role bypasses RLS but explicit policies are good for clarity.
-- =============================================================================

-- Admin/service role can read all sp_wallets (needed for admin portal)
DROP POLICY IF EXISTS "Service role can access all sp_wallets" ON public.sp_wallets;
CREATE POLICY "Service role can access all sp_wallets"
  ON public.sp_wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin/service role can access all sp_ledger entries
DROP POLICY IF EXISTS "Service role can access all sp_ledger" ON public.sp_ledger;
CREATE POLICY "Service role can access all sp_ledger"
  ON public.sp_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- BLOCK 2 — RPC Functions
-- =============================================================================

-- RPC 1: admin_adjust_sp_wallet
-- Adjusts a user's SP wallet balance (add or deduct) with mandatory reason.
-- Positive p_amount = add SP (earn_admin_grant)
-- Negative p_amount = deduct SP (admin_deduct)
-- All parameters prefixed with p_, local variables with v_ (per SQL convention).
CREATE OR REPLACE FUNCTION public.admin_adjust_sp_wallet(
  p_user_id      UUID,
  p_amount       INTEGER,   -- positive = add, negative = deduct
  p_reason       TEXT,      -- mandatory reason for adjustment
  p_admin_notes  TEXT DEFAULT NULL,
  p_actor_id     UUID DEFAULT NULL   -- admin's auth.users.id (nullable for service role)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id       UUID;
  v_balance_before  INTEGER;
  v_balance_after   INTEGER;
  v_tx_type         TEXT;
  v_ledger_id       UUID;
  v_idempotency_key TEXT;
BEGIN
  -- Validate inputs
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount cannot be zero');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is mandatory for SP adjustments');
  END IF;

  -- Get wallet
  SELECT w.id, w.available_balance
    INTO v_wallet_id, v_balance_before
    FROM public.sp_wallets w
   WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP wallet not found for user');
  END IF;

  -- Check negative-balance prevention
  IF p_amount < 0 AND (v_balance_before + p_amount) < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Insufficient balance: cannot deduct ' || ABS(p_amount) || ' SP (current: ' || v_balance_before || ')'
    );
  END IF;

  -- Determine transaction type and lifetime counters
  IF p_amount > 0 THEN
    v_tx_type := 'earn_admin_grant';
  ELSE
    v_tx_type := 'admin_deduct';
  END IF;

  v_balance_after := v_balance_before + p_amount;

  -- Update wallet atomically
  -- Note: SET clause must not use table alias in PostgreSQL
  UPDATE public.sp_wallets
     SET available_balance  = v_balance_after,
         lifetime_earned    = CASE WHEN p_amount > 0 THEN lifetime_earned + p_amount ELSE lifetime_earned END,
         lifetime_spent     = CASE WHEN p_amount < 0 THEN lifetime_spent + ABS(p_amount) ELSE lifetime_spent END,
         last_activity_at   = NOW(),
         updated_at         = NOW()
   WHERE id = v_wallet_id;

  -- Create ledger entry
  -- Use EXTRACT(EPOCH FROM NOW()) to get Unix timestamp before casting to BIGINT
  v_idempotency_key := 'admin_adj_' || v_wallet_id::TEXT || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

  INSERT INTO public.sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    admin_id,
    admin_note,
    idempotency_key,
    metadata
  ) VALUES (
    v_wallet_id,
    p_user_id,
    v_tx_type,
    p_amount,
    v_balance_before,
    v_balance_after,
    COALESCE(p_reason, 'Admin adjustment'),
    p_actor_id,
    p_admin_notes,
    v_idempotency_key,
    jsonb_build_object(
      'adjustment_reason', p_reason,
      'admin_notes',       p_admin_notes,
      'actor_id',          p_actor_id
    )
  )
  RETURNING id INTO v_ledger_id;

  -- Audit log (admin_audit_logs allows nullable actor_id)
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action_type,
    entity_type,
    entity_id,
    reason,
    payload
  ) VALUES (
    p_actor_id,
    'sp_adjustment',
    'sp_wallet',
    v_wallet_id::TEXT,
    p_reason,
    jsonb_build_object(
      'user_id',        p_user_id,
      'amount',         p_amount,
      'balance_before', v_balance_before,
      'balance_after',  v_balance_after,
      'ledger_id',      v_ledger_id
    )
  );

  RETURN jsonb_build_object(
    'success',         true,
    'wallet_id',       v_wallet_id,
    'new_balance',     v_balance_after,
    'ledger_entry_id', v_ledger_id
  );
END;
$$;

-- =============================================================================

-- RPC 2: admin_toggle_sp_wallet_status
-- Changes the status of an SP wallet (active / frozen / suspended).
CREATE OR REPLACE FUNCTION public.admin_toggle_sp_wallet_status(
  p_user_id    UUID,
  p_new_status TEXT,      -- 'active' | 'frozen' | 'suspended'
  p_admin_notes TEXT DEFAULT NULL,
  p_actor_id   UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id  UUID;
  v_old_status TEXT;
BEGIN
  -- Validate new status value
  IF p_new_status NOT IN ('active', 'frozen', 'suspended') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invalid status. Must be one of: active, frozen, suspended'
    );
  END IF;

  -- Get wallet
  SELECT w.id, w.state
    INTO v_wallet_id, v_old_status
    FROM public.sp_wallets w
   WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP wallet not found for user');
  END IF;

  -- Update state (column renamed from status → state in migration 093)
  UPDATE public.sp_wallets
     SET state      = p_new_status,
         updated_at = NOW()
   WHERE id = v_wallet_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action_type,
    entity_type,
    entity_id,
    reason,
    payload
  ) VALUES (
    p_actor_id,
    'sp_wallet_status_change',
    'sp_wallet',
    v_wallet_id::TEXT,
    COALESCE(p_admin_notes, 'Status changed by admin'),
    jsonb_build_object(
      'user_id',    p_user_id,
      'old_status', v_old_status,
      'new_status', p_new_status
    )
  );

  RETURN jsonb_build_object(
    'success',    true,
    'wallet_id',  v_wallet_id,
    'old_status', v_old_status,
    'new_status', p_new_status
  );
END;
$$;

-- =============================================================================

-- RPC 3: admin_get_sp_wallet_detail
-- Returns wallet details + last 100 ledger entries for a given user.
CREATE OR REPLACE FUNCTION public.admin_get_sp_wallet_detail(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet     JSONB;
  v_ledger     JSONB;
  v_user_info  JSONB;
BEGIN
  -- User info from profiles (profiles table has 'name', not 'display_name' or 'first_name'/'last_name')
  SELECT jsonb_build_object(
    'email',        pr.email,
    'display_name', COALESCE(pr.name, 'Unknown')
  )
    INTO v_user_info
    FROM public.profiles pr
   WHERE pr.user_id = p_user_id;

  -- Wallet row
  SELECT jsonb_build_object(
    'id',                w.id,
    'user_id',           w.user_id,
    'state',             w.state,
    'available_balance', w.available_balance,
    'pending_balance',   w.pending_balance,
    'lifetime_earned',   w.lifetime_earned,
    'lifetime_spent',    w.lifetime_spent,
    'last_activity_at',  w.last_activity_at,
    'created_at',        w.created_at,
    'updated_at',        w.updated_at
  )
    INTO v_wallet
    FROM public.sp_wallets w
   WHERE w.user_id = p_user_id;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP wallet not found for user');
  END IF;

  -- Last 100 ledger entries
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',               l.id,
      'transaction_type', l.transaction_type,
      'amount',           l.amount,
      'balance_before',   l.balance_before,
      'balance_after',    l.balance_after,
      'description',      l.description,
      'admin_id',         l.admin_id,
      'admin_note',       l.admin_note,
      'metadata',         l.metadata,
      'created_at',       l.created_at
    )
    ORDER BY l.created_at DESC
  ), '[]'::jsonb)
    INTO v_ledger
    FROM (
      SELECT l.*
        FROM public.sp_ledger l
       WHERE l.user_id = p_user_id
       ORDER BY l.created_at DESC
       LIMIT 100
    ) l;

  RETURN jsonb_build_object(
    'success',   true,
    'user_info', COALESCE(v_user_info, '{}'::jsonb),
    'wallet',    v_wallet,
    'ledger',    v_ledger
  );
END;
$$;

-- =============================================================================

-- RPC 4: get_sp_economy_metrics
-- Returns economy-wide SP metrics for the admin dashboard.
CREATE OR REPLACE FUNCTION public.get_sp_economy_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_earned           BIGINT;
  v_total_spent            BIGINT;
  v_current_circulation    BIGINT;
  v_active_wallets         INTEGER;
  v_avg_balance            NUMERIC;
  v_admin_adj_count        INTEGER;
  v_admin_adj_total        BIGINT;
BEGIN
  -- Aggregate from sp_wallets (ground truth for current balances)
  SELECT
    COALESCE(SUM(w.lifetime_earned), 0),
    COALESCE(SUM(w.lifetime_spent), 0),
    COALESCE(SUM(w.available_balance + w.pending_balance), 0),
    COUNT(*) FILTER (WHERE w.state = 'active'),
    COALESCE(AVG(w.available_balance) FILTER (WHERE w.available_balance > 0), 0)
  INTO
    v_total_earned,
    v_total_spent,
    v_current_circulation,
    v_active_wallets,
    v_avg_balance
  FROM public.sp_wallets w;

  -- Admin adjustments in last 30 days (from audit log)
  SELECT
    COUNT(*),
    COALESCE(
      SUM(ABS((al.payload->>'amount')::INTEGER)),
      0
    )
  INTO
    v_admin_adj_count,
    v_admin_adj_total
  FROM public.admin_audit_logs al
  WHERE al.action_type = 'sp_adjustment'
    AND al.created_at >= NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'total_earned',           v_total_earned,
    'total_spent',            v_total_spent,
    'current_circulation',    v_current_circulation,
    'active_wallets',         v_active_wallets,
    'avg_balance',            ROUND(v_avg_balance, 2),
    'admin_adjustments_count', v_admin_adj_count,
    'admin_adjustments_total', v_admin_adj_total
  );
END;
$$;

-- =============================================================================
-- Verification queries (run after applying this migration):
-- =============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN (
--   'admin_adjust_sp_wallet',
--   'admin_toggle_sp_wallet_status',
--   'admin_get_sp_wallet_detail',
--   'get_sp_economy_metrics'
-- );
-- Expected: 4 rows.
--
-- SELECT public.get_sp_economy_metrics();
-- Expected: JSON object with all metric keys.
--
-- SELECT public.admin_adjust_sp_wallet(
--   '<real_user_uuid>', 10, 'Test adjustment', 'Admin test', null
-- );
-- Expected: {"success": true, "wallet_id": "...", "new_balance": ..., "ledger_entry_id": "..."}
