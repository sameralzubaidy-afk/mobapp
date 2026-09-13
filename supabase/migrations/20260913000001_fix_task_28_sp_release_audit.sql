-- =============================================================================
-- FIX-Task-28 item 2 (2026-09-13) — SP releases must be journaled in the N2
-- audit trail on EVERY path that actually moves Swap Points.
--
-- MODE: B (idempotent, rerunnable — CREATE OR REPLACE only, no data mutation)
--
-- ROOT CAUSE
-- ----------
-- The pending -> available SP release is driven by `rpc_release_pending_sp()`
-- (cron/Edge) and the earn-at-completion credit by
-- `fn_release_all_sp_on_complete()` (trade status -> completed trigger).
-- Neither writes a `financial_audit_log` row. The ONLY `sp_released` writer was
-- `supabase/functions/complete-trade/index.ts:321`, and only when
-- `trades.sp_amount > 0`.
--
-- Consequences:
--   1. N2-C04's assertion ("exactly 1 sp_released audit row with
--      idempotency_key = 'sp_release_<trade_id>'") was UNSATISFIABLE through the
--      guide's RPC-only steps, because those steps never touch that Edge
--      Function.
--   2. N2-C07's chain ("every payment/SP/fee/tax transition is logged") was
--      incomplete for any trade completed by the auto-complete path.
--
-- FIX
-- ---
-- Write the audit row from BOTH DB-side paths, using the SAME idempotency key
-- as the Edge Function (`sp_release_<trade_id>`).
--
-- WHY ONE SHARED KEY (important — do not "improve" this into two keys):
--   `fn_log_financial_audit` inserts with `ON CONFLICT (idempotency_key) DO
--   NOTHING` (20260810000006:80-116). Sharing the key means each trade ends up
--   with EXACTLY ONE `sp_released` row no matter which path reaches it first.
--   Two distinct keys would produce two `sp_released` rows for trades that run
--   both paths, which would break N2-C07's "each transition appears exactly
--   once" requirement. `actor_id` is NULL for these system/cron writes, which is
--   the documented convention for automated transitions.
--
-- `complete-trade/index.ts` is deliberately NOT changed: it already uses this
-- key, so it simply wins the race when the buyer drives "I Got It" manually.
--
-- What this file does NOT change: no wallet math, no trade state, no
-- notification copy — only the missing audit writes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) rpc_release_pending_sp — pending -> available (cron / release-pending-sp EF)
--
-- Full live body from 20260528000005_auto_complete_cron.sql:60-126, with the
-- per-trade audit write added (see the FIX-TASK-28-ITEM2 marker below).
--
-- The audit call sits INSIDE the statement that counts the released trades, and
-- the count is taken with `count(audit_logged)` rather than `count(*)`, so the
-- volatile audit function can never be pruned from the plan. `trades_update`
-- yields exactly one row per ready trade and `ready_trades.id` is the trades
-- primary key, so the JOIN stays 1:1 and `released_count` is unchanged.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_release_pending_sp(
  p_batch_size integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count integer := 0;
BEGIN
  WITH ready_trades AS (
    SELECT t.id, t.seller_id, COALESCE(t.sp_earned_at_completion, 0) AS sp_points
    FROM public.trades t
    WHERE t.status = 'completed'
      AND t.pending_sp_release_at IS NOT NULL
      AND t.pending_sp_release_at <= now()
      AND t.sp_released_at IS NULL
      AND COALESCE(t.sp_earned_at_completion, 0) > 0
    ORDER BY t.pending_sp_release_at ASC
    LIMIT p_batch_size
  ),
  grouped_points AS (
    SELECT rt.seller_id, SUM(rt.sp_points)::integer AS total_points
    FROM ready_trades rt
    GROUP BY rt.seller_id
  ),
  wallet_updates AS (
    UPDATE public.sp_wallets w
    SET
      pending_balance = GREATEST(0, w.pending_balance - gp.total_points),
      available_balance = w.available_balance + gp.total_points,
      updated_at = now()
    FROM grouped_points gp
    WHERE w.user_id = gp.seller_id
    RETURNING w.user_id
  ),
  trades_update AS (
    UPDATE public.trades t
    SET
      sp_released_at = now(),
      updated_at = now()
    FROM ready_trades rt
    WHERE t.id = rt.id
    RETURNING t.id
  ),
  notification_insert AS (
    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    SELECT
      gp.seller_id,
      'sp_events',
      'sp_released',
      'Swap Points Released',
      format('%s SP moved from pending to available balance.', gp.total_points),
      jsonb_build_object('sp_released', gp.total_points, 'processed_at', now())
    FROM grouped_points gp
    RETURNING 1
  )
  SELECT count(audit_logged) INTO v_released_count
  FROM (
    SELECT
      tu.id,
      -- FIX-TASK-28-ITEM2: journal the pending -> available move. Keyed
      -- 'sp_release_<trade_id>' — the same key complete-trade/index.ts uses, so
      -- a trade gets exactly ONE sp_released row (ON CONFLICT DO NOTHING).
      public.fn_log_financial_audit(
        'sp_released',
        'trade',
        tu.id,
        NULL,
        jsonb_build_object('stage', 'pending'),
        jsonb_build_object('stage', 'available', 'sp_points', rt.sp_points),
        rt.sp_points,
        'sp_release_' || tu.id::text,
        NULL
      ) AS audit_logged
    FROM trades_update tu
    JOIN ready_trades rt ON rt.id = tu.id
  ) released;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'processed_at', now()
  );
END;
$$;

-- Money-mutating RPC (BP-78): CREATE OR REPLACE preserves the existing ACL, so
-- re-assert the minimal grant explicitly. The release processor is service-role
-- only (cron + the release-pending-sp Edge Function).
REVOKE EXECUTE ON FUNCTION public.rpc_release_pending_sp(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_release_pending_sp(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) fn_release_all_sp_on_complete — earn into pending at completion
--
-- Full live body from 20260830000015_dev_task_62_ledger_earn_copy.sql:27+, with
-- the audit write added inside the `v_total_sp > 0` branch (see the
-- FIX-TASK-28-ITEM2 marker below). CREATE OR REPLACE keeps the existing
-- `trigger_release_all_sp_on_complete` attachment intact — no trigger change.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_release_all_sp_on_complete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_buyer_wallet_id uuid;
  v_seller_wallet_id uuid;

  v_item_price numeric;
  v_item_price_cents integer;
  v_accepts_swap_points boolean := false;

  v_buyer_sp integer := 0;
  v_platform_sp integer := 0;
  v_total_sp integer := 0;

  v_category_multiplier numeric := 1;
  v_pending_release_days integer := 3;
  v_seller_is_subscriber boolean := false;

  v_buyer_balance_before integer := 0;
  v_buyer_balance_after integer := 0;
  v_seller_pending_before integer := 0;
  v_seller_pending_after integer := 0;

  v_already_transferred boolean := false;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if SP was already transferred at acceptance time
  v_already_transferred := NEW.sp_transferred_at IS NOT NULL;

  v_buyer_sp := GREATEST(COALESCE(NEW.sp_amount, 0), 0);
  v_pending_release_days := public.fn_trade_config_int('pending_sp_release_days', 3);

  SELECT i.price, COALESCE(i.accepts_swap_points, false)
  INTO v_item_price, v_accepts_swap_points
  FROM public.items i
  WHERE i.id = NEW.listing_id;

  v_item_price_cents := COALESCE(ROUND(COALESCE(v_item_price, 0) * 100)::integer, 0);

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = NEW.seller_id
      AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1
  ) INTO v_seller_is_subscriber;

  v_category_multiplier := COALESCE(NEW.sp_category_multiplier, 0);
  IF v_category_multiplier <= 0 THEN
    v_category_multiplier := public.fn_trade_config_numeric('sp_category_multiplier', 1);
  END IF;
  IF v_category_multiplier <= 0 THEN
    v_category_multiplier := public.fn_trade_config_numeric('sp_earn_multiplier', 1);
  END IF;

  IF v_seller_is_subscriber AND v_accepts_swap_points AND v_item_price_cents > 0 THEN
    v_platform_sp := FLOOR(((v_item_price_cents::numeric / 100) * 0.25) * v_category_multiplier);
  END IF;

  IF NOT v_already_transferred THEN
    -- BUYER: Consume reserved SP (only if not transferred at acceptance)
    -- DT-19 (Fix 1): the buyer's 'spend_purchase' ledger debit is logged at
    -- RESERVE time by fn_reserve_sp_on_offer(). Do NOT re-log it here — that
    -- produced the June-2026 double-charge bug ('spend_purchase' twice per
    -- completed trade). Completion only moves reserved -> spent (wallet) and
    -- credits the seller; the buyer's single debit entry comes from reserve.
    IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
      SELECT w.id INTO v_buyer_wallet_id
      FROM public.sp_wallets w WHERE w.user_id = NEW.buyer_id FOR UPDATE;

      IF v_buyer_wallet_id IS NOT NULL THEN
        UPDATE public.sp_wallets w
        SET reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
            lifetime_spent = w.lifetime_spent + v_buyer_sp,
            updated_at = now()
        WHERE w.id = v_buyer_wallet_id;
      END IF;
    END IF;

    v_total_sp := GREATEST(v_buyer_sp + v_platform_sp, 0);
  ELSE
    v_total_sp := GREATEST(v_platform_sp, 0);
  END IF;

  -- SELLER: Release SP to pending_balance
  SELECT w.id, COALESCE(w.pending_balance, 0)
  INTO v_seller_wallet_id, v_seller_pending_before
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.seller_id
  FOR UPDATE;

  IF v_seller_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(NEW.seller_id);
    SELECT w.id, COALESCE(w.pending_balance, 0)
    INTO v_seller_wallet_id, v_seller_pending_before
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.seller_id
    FOR UPDATE;
  END IF;

  IF v_total_sp > 0 THEN
    v_seller_pending_after := v_seller_pending_before + v_total_sp;

    UPDATE public.sp_wallets w
    SET pending_balance = v_seller_pending_after,
        lifetime_earned = w.lifetime_earned + v_total_sp,
        updated_at = now()
    WHERE w.id = v_seller_wallet_id;

    -- Dev Task 41 item 9: keep the trade row in sync with the ledger/wallet —
    -- seller_sp_earned / final_sp_amount = total credited, seller_sp_bonus = the
    -- platform-funded portion, sp_transferred_at = completion (the actual
    -- transfer point; the old accept-time transfer is deprecated DT-17).
    UPDATE public.trades t
    SET sp_earned_at_completion = v_total_sp,
        pending_sp_release_at = now() + make_interval(days => v_pending_release_days),
        seller_sp_earned = v_total_sp,
        seller_sp_bonus = v_platform_sp,
        final_sp_amount = v_total_sp,
        sp_transferred_at = now(),
        updated_at = now()
    WHERE t.id = NEW.id;

    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_total_sp,
      v_seller_pending_before, v_seller_pending_after,
      -- DEV-TASK-62-ITEM4: use the FULL credited amount (buyer SP + platform
      -- bonus) so the description matches the ledger amount. Restores the
      -- pre-June-2026 accurate template (20260606000001:319). Old copy
      -- ("Trade completion: %s SP platform earning", v_platform_sp) used only
      -- the platform bonus and disagreed whenever the buyer paid SP.
      format('Trade reward: %s SP from buyer + %s SP platform bonus', v_buyer_sp, v_platform_sp),
      NEW.id, now()
    );

    -- FIX-TASK-28-ITEM2: journal the earn in the N2 audit trail. This path wrote
    -- NO financial_audit_log row before, so N2-C07's transition chain was
    -- incomplete for auto-completed trades. Same key as complete-trade/index.ts
    -- ('sp_release_<id>') + ON CONFLICT DO NOTHING = exactly one sp_released row
    -- per trade, whichever path gets there first. actor_id NULL = system actor.
    PERFORM public.fn_log_financial_audit(
      'sp_released',
      'trade',
      NEW.id,
      NULL,
      jsonb_build_object('stage', 'pending_credit', 'seller_pending_balance', v_seller_pending_before),
      jsonb_build_object(
        'stage', 'pending_credit',
        'buyer_sp', v_buyer_sp,
        'platform_sp', v_platform_sp,
        'sp_points', v_total_sp,
        'seller_pending_balance', v_seller_pending_after
      ),
      v_total_sp,
      'sp_release_' || NEW.id::text,
      NULL
    );

    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    VALUES (
      NEW.seller_id, 'sp_events', 'sp_pending_release',
      'Swap Points Pending Release',
      format('You earned %s SP from trade completion. They will be released in %s days.',
             v_total_sp, v_pending_release_days),
      jsonb_build_object(
        'trade_id', NEW.id,
        'sp_total', v_total_sp,
        'pending_release_at', now() + make_interval(days => v_pending_release_days)
      )
    );
  ELSE
    UPDATE public.trades t
    SET sp_earned_at_completion = 0,
        pending_sp_release_at = NULL,
        seller_sp_earned = 0,
        seller_sp_bonus = 0,
        final_sp_amount = 0,
        sp_transferred_at = NULL,
        updated_at = now()
    WHERE t.id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- VERIFICATION (run each statement separately — execute_sql returns only the
-- LAST statement's result set)
-- =============================================================================
--
-- V1. Both functions were replaced with the audit call present:
--   SELECT position('fn_log_financial_audit' IN pg_get_functiondef(
--            'public.rpc_release_pending_sp(integer)'::regprocedure)) > 0
--            AS release_has_audit,
--          position('fn_log_financial_audit' IN pg_get_functiondef(
--            'public.fn_release_all_sp_on_complete()'::regprocedure)) > 0
--            AS earn_has_audit;
--   -- expected: true | true
--
-- V2. The unique key that makes this idempotent still exists:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'financial_audit_log'
--     AND indexname = 'financial_audit_log_idempotency_key_key';
--   -- expected: 1 row
--
-- V3. Grants on the release RPC (BP-78 — LIVE ACL, never a migration grep):
--   SELECT COALESCE(r.rolname, 'PUBLIC') AS grantee, a.privilege_type
--   FROM pg_proc p
--   CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
--   LEFT JOIN pg_roles r ON r.oid = a.grantee
--   WHERE p.oid = 'public.rpc_release_pending_sp(integer)'::regprocedure
--   ORDER BY 1, 2;
--   -- expected: exactly one row — service_role | EXECUTE
--
-- V4. Functional proof (per N2-C04; replace <trade_id> with a completed SP trade
--     whose pending_sp_release_at has been fast-forwarded to now()):
--   SELECT public.rpc_release_pending_sp(100);   -- run this TWICE
--   SELECT count(*) FROM public.financial_audit_log
--   WHERE idempotency_key = 'sp_release_<trade_id>';          -- expected: 1
--   SELECT count(*) FROM public.financial_audit_log
--   WHERE entity_id = '<trade_id>' AND mutation_type = 'sp_released';  -- expected: 1
--   SELECT pending_balance, available_balance FROM public.sp_wallets
--   WHERE user_id = '<seller_id>';   -- credited exactly once, never twice
-- =============================================================================
