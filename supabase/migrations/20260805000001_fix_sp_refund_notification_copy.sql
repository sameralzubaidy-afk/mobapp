-- =====================================================================
-- FILE: supabase/migrations/20260805000001_fix_sp_refund_notification_copy.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-003) / BP-14
-- TASK: Fix misleading "SP Earned!" notification when reserved SP is
--       returned to the buyer's wallet after a cancelled / declined /
--       expired trade (TC-R01 UX bug).
-- MODE: B (idempotent rerunnable) — CREATE OR REPLACE FUNCTION preserves
--       the existing trigger trigger_sp_transaction_notification ON sp_ledger.
--
-- DESCRIPTION:
--   When a buyer's reserved SP is released back to available on a
--   cancelled trade, the sp_ledger gets an 'earn_refund' entry (positive
--   amount). The trigger classified ALL 'earn_%' entries as "SP Earned",
--   so the buyer saw: "🎉 +70 SP Earned! You received 70 SP refund!" —
--   contradictory and misleading. Nothing was earned; the SP was held
--   (reserved) and is now returned.
--
--   Per BP-14, earn_refund means "refunded" (returned to available), NOT
--   "earned". This migration gives earn_refund its own notification type
--   (sp_refunded) and accurate copy. Genuine earn events
--   (starter_pack / reward / referral / challenge / admin_grant /
--   promotion) keep the "SP Earned!" wording unchanged.
-- =====================================================================

-- =====================================================================
-- BLOCK 1 — Schema: redefine the SP transaction notification function
-- =====================================================================

CREATE OR REPLACE FUNCTION send_sp_transaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet RECORD;
  v_title TEXT;
  v_body TEXT;
  v_notification_type TEXT;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet
  FROM sp_wallets
  WHERE id = NEW.wallet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine if earned or spent based on transaction_type
  IF NEW.transaction_type = 'earn_refund' THEN
    -- Reserved SP returned to available (trade cancelled / declined / expired).
    -- BP-14: earn_refund means "refunded" (returned to available), NOT "earned".
    v_notification_type := 'sp_refunded';
    v_title := '✨ ' || NEW.amount || ' SP Returned';
    v_body := NEW.amount || ' SP returned to your wallet because the trade was cancelled.';

  ELSIF NEW.transaction_type LIKE 'earn_%' THEN
    -- Earned SP (genuine earning events only)
    v_notification_type := 'sp_earned';
    v_title := '🎉 +' || NEW.amount || ' SP Earned!';

    -- Custom body based on transaction type
    v_body := CASE
      WHEN NEW.transaction_type = 'earn_starter_pack' THEN 'You earned ' || NEW.amount || ' SP as a welcome bonus!'
      WHEN NEW.transaction_type = 'earn_reward' THEN 'You earned ' || NEW.amount || ' SP from a reward!'
      WHEN NEW.transaction_type = 'earn_referral' THEN 'You earned ' || NEW.amount || ' SP from a referral!'
      WHEN NEW.transaction_type = 'earn_challenge' THEN 'You earned ' || NEW.amount || ' SP from completing a challenge!'
      WHEN NEW.transaction_type = 'earn_admin_grant' THEN 'You received ' || NEW.amount || ' SP!'
      WHEN NEW.transaction_type = 'earn_promotion' THEN 'You earned ' || NEW.amount || ' SP from a promotion!'
      ELSE 'You earned ' || NEW.amount || ' SP!'
    END;

  ELSIF NEW.transaction_type LIKE 'spend_%' THEN
    -- Spent SP (copy unchanged — spend_purchase is reported as "Reserved")
    v_notification_type := 'sp_spent';
    v_title := '✨ ' || ABS(NEW.amount) || ' SP Reserved';

    -- Custom body based on transaction type
    v_body := CASE
      WHEN NEW.transaction_type = 'spend_purchase' THEN ABS(NEW.amount) || ' SP reserved for your offer — returned if trade is cancelled.'
      WHEN NEW.transaction_type = 'spend_fee' THEN 'You spent ' || ABS(NEW.amount) || ' SP on fees!'
      WHEN NEW.transaction_type = 'spend_boost' THEN 'You spent ' || ABS(NEW.amount) || ' SP on a boost!'
      ELSE 'You spent ' || ABS(NEW.amount) || ' SP!'
    END;

  ELSE
    -- Other transaction types (expire, freeze, unfreeze, admin_deduct)
    RETURN NEW;
  END IF;

  -- Create the notification
  PERFORM create_sp_notification(
    v_wallet.user_id,
    v_notification_type,
    v_title,
    v_body,
    jsonb_build_object(
      'amount', NEW.amount,
      'transaction_type', NEW.transaction_type,
      'balance_after', NEW.balance_after,
      'ledger_id', NEW.id,
      'deep_link', '/wallet'
    ),
    TRUE  -- check_subscription = TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger (trigger_sp_transaction_notification ON sp_ledger, created in
-- 142_sp_notifications.sql) is preserved by CREATE OR REPLACE — no need to
-- drop/recreate it.

-- =====================================================================
-- BLOCK 2 — Verification
-- =====================================================================
-- 1) Function + trigger exist:
--    SELECT proname FROM pg_proc WHERE proname = 'send_sp_transaction_notification';
--    SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_sp_transaction_notification';
--    Expected: 1 row each.

-- 2) Simulate the refund path (run TC-R01: buyer cancels a pending trade
--    that used SP), then query:
--    SELECT type, title, body, data->>'transaction_type' AS ledger_type
--    FROM user_notifications
--    WHERE user_id = '<buyer-uuid>' AND type = 'sp_refunded'
--    ORDER BY created_at DESC LIMIT 1;
--    Expected: title = '✨ 70 SP Returned',
--              body  = '70 SP returned to your wallet because the trade was cancelled.'

-- 3) Genuine earn events still say "SP Earned!":
--    SELECT type, title FROM user_notifications
--    WHERE type = 'sp_earned' ORDER BY created_at DESC LIMIT 5;
--    Expected: title LIKE '🎉 +% SP Earned!'

-- ROLLBACK:
--   Re-run the previous function definition (from migration
--   20260704000001_add_reserved_sp_to_wallet_summary.sql) via CREATE OR
--   REPLACE FUNCTION, or `supabase db reset` to rebuild from all migrations.
--   This migration itself is safe to re-run (Mode B).
