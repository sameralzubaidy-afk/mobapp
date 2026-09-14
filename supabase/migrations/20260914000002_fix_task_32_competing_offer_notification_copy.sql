-- File: supabase/migrations/20260914000002_fix_task_32_competing_offer_notification_copy.sql
--
-- FIX-Task-32 item 6 (2026-09-14) — the LOSING buyer's cancellation notification
-- hid the reason, while the very same event's `sp_ledger` row was already
-- reason-aware.
--
-- WHY (QA Task — TRD Closing R03, 2026-09-13, finding F5):
--   When a seller accepts one of two competing offers, the rival trade is
--   cancelled with `cancellation_reason='offer_expired_competing'`. The buyer got
--   the generic "The trade for \"<item>\" has been cancelled." — no indication that
--   a competing offer won — even though `fn_release_sp_on_cancel` (same file
--   20260830000001, BLOCK 5) already writes the reason-aware ledger description
--   'SP refunded because a competing offer was accepted' for the identical event.
--   The reason-aware wording existed and simply was not used on the user-facing
--   surface. The losing buyer's copy is the ONLY signal they get that their offer
--   lost rather than being withdrawn.
--
-- FIX:
--   The 'cancelled' arm of `send_trade_status_notification()` gains an
--   `offer_expired_competing` sub-branch:
--     * BUYER (loser)    -> reason-aware copy naming the SP return, with the SP
--                           sentence shown only when SP was actually reserved
--                           (cash-only offers carry no SP).
--     * SELLER (winner)  -> owner option C (2026-09-14): a winner-facing line
--                           confirming the other offer was cancelled and that
--                           buyer's Swap Points were returned.
--   Every other branch (completion-requested / accepted / rejected / completed /
--   generic cancelled / extension-cancel skip) is preserved VERBATIM.
--
-- Body otherwise identical to 20260830000001_dev_task_41_trade_row_sp_accounting_and_copy.sql
-- (BLOCK 4, L299-501). The ONLY change is inside the `NEW.status = 'cancelled'`
-- arm. `fn_release_sp_on_cancel` and every other object in that migration are
-- NOT touched.
--
-- Mode B — idempotent rerunnable (CREATE OR REPLACE, no signature change).
--
-- BLOCK 1: send_trade_status_notification (cancelled arm gains the competing case)
-- BLOCK 2: verification queries (run ONE statement at a time — the SQL Editor /
--          execute_sql returns only the LAST statement's result set)

BEGIN;

-- =============================================================================
-- BLOCK 1 — send_trade_status_notification
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

    -- ─────────────────────────────────────────────────────────────────────────
    -- FIX-Task-32 item 6 (2026-09-14): competing-offer loss is REASON-AWARE.
    --
    -- The rival trade is cancelled by the accepting seller's flow with the
    -- machine literal 'offer_expired_competing' (transactions-update accept
    -- branch / transactions-accept-bundle). The buyer's only signal that their
    -- offer LOST must not be the generic "has been cancelled" line — matching the
    -- reason-aware description `fn_release_sp_on_cancel` already writes to the
    -- SP ledger for this exact event ('SP refunded because a competing offer was
    -- accepted').
    --
    -- The SP sentence is conditional: a cash-only rival offer reserves no SP, and
    -- telling that buyer "Your 0 SP have been returned." would be wrong.
    -- ─────────────────────────────────────────────────────────────────────────
    ELSIF NEW.cancellation_reason = 'offer_expired_competing' THEN
      PERFORM public.create_trade_notification(
        NEW.buyer_id,
        'trade_cancelled',
        'Offer Not Accepted',
        'Your offer for "' || COALESCE(v_item_title, 'item') || '" wasn''t accepted — another buyer''s offer was accepted.'
          || CASE WHEN COALESCE(NEW.sp_amount, 0) > 0
                  THEN ' Your ' || COALESCE(NEW.sp_amount, 0)::text || ' SP have been returned.'
                  ELSE '' END,
        jsonb_build_object(
          'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades',
          'type', 'trade_cancelled'
        )
      );
      IF NEW.seller_id <> NEW.buyer_id THEN
        -- Owner option C (2026-09-14): the seller (the winner) gets a
        -- winner-facing line instead of the generic cancellation copy. Like the
        -- buyer's line, the SP clause appears ONLY when the rival actually
        -- reserved Swap Points — never claim SP were returned when none were.
        PERFORM public.create_trade_notification(
          NEW.seller_id,
          'trade_cancelled',
          'Another Offer Cancelled',
          'You accepted another buyer''s offer on "' || COALESCE(v_item_title, 'item') || '". The other offer was cancelled.'
            || CASE WHEN COALESCE(NEW.sp_amount, 0) > 0
                    THEN ' That buyer''s ' || COALESCE(NEW.sp_amount, 0)::text || ' SP were returned.'
                    ELSE '' END,
          jsonb_build_object(
            'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
            'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades',
            'type', 'trade_cancelled'
          )
        );
      END IF;

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

COMMIT;

-- =============================================================================
-- BLOCK 2 — VERIFICATION (run ONE statement at a time)
-- =============================================================================

-- V1. The trigger function exists and is attached to `trades` (must be 1 row).
-- SELECT t.tgname, c.relname AS table_name, p.proname AS function_name
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_proc  p ON p.oid = t.tgfoid
-- WHERE NOT t.tgisinternal AND p.proname = 'send_trade_status_notification';

-- V2. The new copy is present in the deployed body (expect 2 hits: the buyer's
--     word "wasn" and the tie-off "another buyer").
-- SELECT (pg_get_functiondef(p.oid) LIKE '%wasn''t accepted%') AS has_buyer_copy,
--        (pg_get_functiondef(p.oid) LIKE '%Another Offer Cancelled%') AS has_seller_copy,
--        (pg_get_functiondef(p.oid) LIKE '%has been cancelled.%') AS has_generic_copy
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'send_trade_status_notification';

-- V3. Live proof — write an offer_expired_competing cancellation onto a REAL
--     disposable pending trade and read back both notifications:
-- SELECT public.create_trade_notification(
--   (SELECT t.buyer_id FROM public.trades t WHERE t.id = '<trade-uuid>'),
--   'trade_cancelled', 'Offer Not Accepted',
--   'FIX-Task-32 copy probe', '{}'::jsonb
-- );
