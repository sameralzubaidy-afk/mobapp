-- File: supabase/migrations/20260830000001_dev_task_41_trade_row_sp_accounting_and_copy.sql
-- Mode B: Idempotent Rerunnable Migration
--
-- DEV-TASK-41 (2026-08-28) — QA Task 4 report findings:
--   9)  Trade-row SP accounting fields are not populated on completion:
--       seller_sp_earned / final_sp_amount (and seller_sp_bonus) stay 0/NULL on
--       completed SP trades even though the wallet + ledger are correctly
--       credited. fn_release_all_sp_on_complete only set sp_earned_at_completion
--       / pending_sp_release_at. Populate the trade row so it matches the actual
--       ledger/wallet state (QA P2).
--   11) Copy nits (QA P3):
--       (a) fn_release_sp_on_cancel ledger description hardcodes "(expired)"
--           even when the cause is a competing-offer decline — make it
--           reason-aware.
--       (b) Auto-complete notification says "is complete!" — the guide expects
--           "was automatically marked complete" — branch the completed copy on a
--           new auto_completed_at column (stamped by rpc_process_auto_complete).
--
-- Change classification: A (DB/migration/RPC/triggers) + F (money/state display).
-- Required tiers: Tier 0 (typecheck/lint — unaffected), Tier 1 (real
-- completion + auto-complete fast-clock), Tier 2 (DB rebuild + verification
-- queries below).

-- =============================================================================
-- BLOCK 1 — Schema: add auto_completed_at to trades
-- =============================================================================
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS auto_completed_at timestamptz;

COMMENT ON COLUMN public.trades.auto_completed_at IS
  'Dev Task 41: set by rpc_process_auto_complete when the trade auto-completes on '
  'the pickup window; lets the notification trigger use the guide''s '
  '"automatically marked complete" copy instead of the manual-completion copy.';

-- =============================================================================
-- BLOCK 2 — fn_release_all_sp_on_complete: populate trade-row SP accounting
-- =============================================================================
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
      format('Trade completion: %s SP platform earning', v_platform_sp),
      NEW.id, now()
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
-- BLOCK 3 — rpc_process_auto_complete: stamp auto_completed_at
--   (Preserves the full DT-39 payout side-effects: mark sold -> set
--    payout_amount_cents -> create seller_payouts row; payout errors never block
--    auto-completion.)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_process_auto_complete(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_trade RECORD;
  v_net_cash_cents integer;
  v_payout_result jsonb;
BEGIN
  FOR v_trade IN
    SELECT t.id, t.seller_id, t.listing_id, t.cash_amount_cents, t.seller_transaction_fee_cents
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at <= now()
      AND (t.extension_status IS DISTINCT FROM 'requested')
      AND (
        t.disputed_at IS NULL
        OR t.dispute_resolution IS NOT NULL
      )
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Flip to completed. Dev Task 41 item 11: stamp auto_completed_at so the
    -- notification trigger uses the guide's "automatically marked complete" copy.
    UPDATE public.trades t
    SET status = 'completed',
        completed_at = COALESCE(t.completed_at, now()),
        updated_at = now(),
        last_status_change_at = now(),
        auto_completed_at = COALESCE(t.auto_completed_at, now())
    WHERE t.id = v_trade.id;

    v_updated_count := v_updated_count + 1;

    -- DT-39: mirror complete_trade_v2's completion side-effects.
    UPDATE public.items i SET status = 'sold', updated_at = now() WHERE i.id = v_trade.listing_id;

    v_net_cash_cents := GREATEST(0,
      COALESCE(v_trade.cash_amount_cents, 0) - COALESCE(v_trade.seller_transaction_fee_cents, 0));

    UPDATE public.trades t
    SET payout_amount_cents = v_net_cash_cents,
        updated_at = now()
    WHERE t.id = v_trade.id;

    BEGIN
      IF v_net_cash_cents > 0 THEN
        SELECT public.create_seller_payout_on_trade_completion(
          v_trade.id,
          v_trade.seller_id,
          v_net_cash_cents
        ) INTO v_payout_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF to_regclass('public.debug_logs') IS NOT NULL THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'rpc_process_auto_complete',
          'payout creation failed for trade ' || v_trade.id::text || ': ' || SQLERRM,
          jsonb_build_object('trade_id', v_trade.id::text, 'net_cash_cents', v_net_cash_cents)
        );
      END IF;
      RAISE WARNING 'rpc_process_auto_complete: payout creation failed for trade %: %', v_trade.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'auto_completed_count', v_updated_count,
    'processed_at', now()
  );
END;
$$;

-- Preserve the original grant (service_role — cron/EF invocation).
GRANT EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer) TO service_role;

-- =============================================================================
-- BLOCK 4 — send_trade_status_notification: auto-complete copy branch
-- =============================================================================
CREATE OR REPLACE FUNCTION public.send_trade_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_item_title       TEXT;
  v_buyer_name       TEXT;
  v_seller_name      TEXT;
  v_listing_id_text  TEXT;
  v_seller_marked_before TEXT;
  v_seller_marked_after  TEXT;
BEGIN
  v_seller_marked_before := to_jsonb(OLD)->>'seller_marked_completed_at';
  v_seller_marked_after := to_jsonb(NEW)->>'seller_marked_completed_at';

  IF NEW.status = OLD.status
     AND COALESCE(v_seller_marked_before, '') = COALESCE(v_seller_marked_after, '') THEN
    RETURN NEW;
  END IF;

  v_listing_id_text := COALESCE(to_jsonb(NEW)->>'listing_id', to_jsonb(NEW)->>'item_id');

  SELECT i.title INTO v_item_title FROM public.items i WHERE i.id::text = v_listing_id_text;
  SELECT COALESCE(p.name, 'Buyer') INTO v_buyer_name FROM public.profiles p WHERE p.user_id = NEW.buyer_id;
  SELECT COALESCE(p.name, 'Seller') INTO v_seller_name FROM public.profiles p WHERE p.user_id = NEW.seller_id;

  IF v_seller_marked_before IS NULL
     AND v_seller_marked_after IS NOT NULL
     AND NEW.status <> 'completed' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_completion_requested',
      'Trade Ready for Your Confirmation',
      COALESCE(v_seller_name, 'The seller') || ' marked your trade for "' || COALESCE(v_item_title, 'item') || '" as complete. Please confirm once received.',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
        'type', 'trade_completion_requested'
      )
    );
  END IF;

  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_accepted',
      'Trade Accepted! ✅',
      COALESCE(v_seller_name, 'The seller') || ' accepted your trade request for "' || COALESCE(v_item_title, 'item') || '"',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
        'type', 'trade_accepted'
      )
    );
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_rejected',
      'Trade Declined',
      COALESCE(v_seller_name, 'The seller') || ' declined your trade request for "' || COALESCE(v_item_title, 'item') || '"',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/browse',
        'type', 'trade_rejected'
      )
    );
  ELSIF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    -- Dev Task 41 item 11: auto-completed trades use the guide's copy
    -- ("was automatically marked complete"); manual completions keep the
    -- original "is complete!" copy.
    IF NEW.auto_completed_at IS NOT NULL THEN
      PERFORM public.create_trade_notification(
        NEW.buyer_id,
        'trade_completed',
        'Trade Complete! 🎉',
        'Your trade for "' || COALESCE(v_item_title, 'item') || '" was automatically marked complete.',
        jsonb_build_object(
          'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
          'type', 'trade_completed'
        )
      );
      IF NEW.seller_id <> NEW.buyer_id THEN
        PERFORM public.create_trade_notification(
          NEW.seller_id,
          'trade_completed',
          'Trade Complete! 🎉',
          'Your trade with ' || COALESCE(v_buyer_name, 'the buyer') || ' for "' || COALESCE(v_item_title, 'item') || '" was automatically marked complete.',
          jsonb_build_object(
            'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
            'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
            'type', 'trade_completed'
          )
        );
      END IF;
    ELSE
      PERFORM public.create_trade_notification(
        NEW.buyer_id,
        'trade_completed',
        'Trade Complete! 🎉',
        'Your trade for "' || COALESCE(v_item_title, 'item') || '" is complete! Don''t forget to leave a review.',
        jsonb_build_object(
          'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
          'type', 'trade_completed'
        )
      );
      IF NEW.seller_id <> NEW.buyer_id THEN
        PERFORM public.create_trade_notification(
          NEW.seller_id,
          'trade_completed',
          'Trade Complete! 🎉',
          'Your trade with ' || COALESCE(v_buyer_name, 'the buyer') || ' for "' || COALESCE(v_item_title, 'item') || '" is complete!',
          jsonb_build_object(
            'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
            'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
            'type', 'trade_completed'
          )
        );
      END IF;
    END IF;
  ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    -- R15 (2026-08-10): extension-cancel outcomes are notified explicitly by the
    -- trade-extension EF / process-extension-timeouts cron. Skip the generic
    -- 'trade_cancelled' to avoid a duplicate notification.
    IF NEW.cancellation_reason IN ('extension_denied', 'extension_timeout', 'extension_reauth_failed') THEN
      NULL;
    ELSE
      PERFORM public.create_trade_notification(
        NEW.buyer_id,
        'trade_cancelled',
        'Trade Cancelled',
        'The trade for "' || COALESCE(v_item_title, 'item') || '" has been cancelled.',
        jsonb_build_object(
          'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades',
          'type', 'trade_cancelled'
        )
      );
      IF NEW.seller_id <> NEW.buyer_id THEN
        PERFORM public.create_trade_notification(
          NEW.seller_id,
          'trade_cancelled',
          'Trade Cancelled',
          'The trade for "' || COALESCE(v_item_title, 'item') || '" has been cancelled.',
          jsonb_build_object(
            'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
            'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades',
            'type', 'trade_cancelled'
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  IF to_regclass('public.debug_logs') IS NOT NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'send_trade_status_notification',
      'ERROR',
      jsonb_build_object(
        'trade_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status,
        'error', SQLERRM, 'state', SQLSTATE
      )
    );
  END IF;
  RAISE WARNING '[send_trade_status_notification] Error for trade %: % (SQLSTATE: %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- BLOCK 5 — fn_release_sp_on_cancel: reason-aware refund description
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_release_sp_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance_before integer;
  v_balance_after integer;
  v_refund_description text;
BEGIN
  -- Only process cancellations
  IF NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Dev Task 41 item 11: reflect the REAL cause in the ledger description.
  -- Canonical cancellation_reason literals per DT-31 / DT-34: 'Offer expired',
  -- 'offer_expired_competing', 'seller_declined', 'Another offer accepted'.
  v_refund_description := CASE
    WHEN NEW.cancellation_reason = 'offer_expired_competing'
      OR NEW.cancellation_reason = 'Another offer accepted'
      THEN 'SP refunded because a competing offer was accepted'
    WHEN NEW.cancellation_reason IN ('Offer expired', 'offer_expired')
      THEN 'SP refunded for expired offer'
    WHEN NEW.cancellation_reason = 'seller_declined'
      THEN 'SP refunded because the seller declined your offer'
    WHEN NEW.cancellation_reason = 'buyer_cancelled'
      THEN 'SP refunded for cancelled offer'
    ELSE 'SP refunded for cancelled offer'
  END;

  -- Skip if no SP was reserved
  IF COALESCE(OLD.sp_amount, 0) <= 0 OR OLD.sp_reserved_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if already released
  IF OLD.sp_released_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get buyer's wallet with lock
  SELECT w.id, w.available_balance
  INTO v_wallet_id, v_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = OLD.buyer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE WARNING 'SP wallet not found for buyer % in cancelled trade %', OLD.buyer_id, OLD.id;
    RETURN NEW;
  END IF;

  v_balance_after := v_balance_before + OLD.sp_amount;

  -- Release SP back to available balance
  UPDATE public.sp_wallets w
  SET
    available_balance = v_balance_after,
    reserved_sp = GREATEST(0, w.reserved_sp - OLD.sp_amount),
    updated_at = now()
  WHERE w.id = v_wallet_id;

  -- ⭐ CRITICAL FIX: Create ledger entry for the SP refund
  INSERT INTO public.sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_transaction_id,
    created_at
  ) VALUES (
    v_wallet_id,
    OLD.buyer_id,
    'earn_refund',
    OLD.sp_amount,
    v_balance_before,
    v_balance_after,
    v_refund_description,
    OLD.id,
    now()
  );

  -- Mark SP as released
  UPDATE public.trades t
  SET sp_released_at = COALESCE(t.sp_released_at, now()),
      updated_at = now()
  WHERE t.id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_release_sp_on_cancel IS
  'Releases reserved SP back to buyer when trade is cancelled and creates audit ledger entry';

-- =============================================================================
-- BLOCK 6 — Reattach triggers (idempotent; DROP + CREATE points existing
--           triggers at the CREATE OR REPLACE bodies above)
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_release_all_sp_on_complete ON public.trades;
CREATE TRIGGER trigger_release_all_sp_on_complete
AFTER UPDATE ON public.trades
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
EXECUTE FUNCTION public.fn_release_all_sp_on_complete();

DROP TRIGGER IF EXISTS trade_status_notification ON public.trades;
CREATE TRIGGER trade_status_notification
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.send_trade_status_notification();

DROP TRIGGER IF EXISTS trigger_release_sp_on_cancel ON public.trades;
CREATE TRIGGER trigger_release_sp_on_cancel
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_release_sp_on_cancel();

-- =============================================================================
-- BLOCK 7 — Backfill existing completed SP trades
--   Populate seller_sp_earned / final_sp_amount / seller_sp_bonus /
--   sp_transferred_at on completed SP trades whose ledger already has an
--   earn_reward row. Guard: only where the columns are still 0/NULL — a re-run
--   is a no-op. seller_sp_bonus is derived (total - buyer sp), clamped at 0.
-- =============================================================================
DO $$
DECLARE
  v_backfilled integer := 0;
BEGIN
  UPDATE public.trades t
  SET seller_sp_earned = COALESCE(l.total_sp, 0),
      final_sp_amount = COALESCE(l.total_sp, 0),
      seller_sp_bonus = GREATEST(0, COALESCE(l.total_sp, 0) - COALESCE(t.sp_amount, 0)),
      sp_transferred_at = COALESCE(t.completed_at, now()),
      updated_at = now()
  FROM (
    SELECT l.related_transaction_id AS trade_id,
           SUM(l.amount)::integer AS total_sp
    FROM public.sp_ledger l
    WHERE l.transaction_type = 'earn_reward'
    GROUP BY l.related_transaction_id
  ) l
  WHERE t.id = l.trade_id
    AND t.status = 'completed'
    AND COALESCE(t.sp_amount, 0) > 0
    AND COALESCE(t.seller_sp_earned, 0) = 0
    AND COALESCE(l.total_sp, 0) > 0;

  GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  RAISE NOTICE 'Dev Task 41 backfill: % completed SP trade rows populated', v_backfilled;
END;
$$;

-- =============================================================================
-- BLOCK 8 — Verification queries (run ONE per call)
-- =============================================================================
-- 1) Column exists:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'trades' AND column_name = 'auto_completed_at';
--    Expected: 1 row.
--
-- 2) Completion function sets the trade-row accounting fields:
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_release_all_sp_on_complete';
--    Expected: prosrc contains 'seller_sp_earned = v_total_sp' and
--    'final_sp_amount = v_total_sp'.
--
-- 3) Auto-complete stamps the flag + uses the auto-complete copy:
--    SELECT prosrc FROM pg_proc WHERE proname = 'rpc_process_auto_complete';
--    Expected: prosrc contains 'auto_completed_at = COALESCE(t.auto_completed_at, now())'.
--    SELECT prosrc FROM pg_proc WHERE proname = 'send_trade_status_notification';
--    Expected: prosrc contains 'was automatically marked complete'.
--
-- 4) Refund description is reason-aware:
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_release_sp_on_cancel';
--    Expected: prosrc contains 'offer_expired_competing' and NOT 'cancelled offer (expired)'.
--
-- 5) Triggers attached:
--    SELECT trigger_name FROM information_schema.triggers
--    WHERE event_object_table = 'trades'
--      AND trigger_name IN ('trigger_release_all_sp_on_complete','trade_status_notification','trigger_release_sp_on_cancel');
--    Expected: 3 rows.
--
-- 6) Backfill result (live data):
--    SELECT count(*) FROM public.trades t
--    WHERE t.status = 'completed' AND COALESCE(t.sp_amount,0) > 0
--      AND t.sp_earned_at_completion IS NOT NULL AND t.sp_earned_at_completion > 0
--      AND COALESCE(t.seller_sp_earned,0) = 0;
--    Expected: 0 (no completed SP trade lacks its accounting fields).
