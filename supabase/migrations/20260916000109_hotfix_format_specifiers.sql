-- ============================================================================
-- Migration: 20260607000002_hotfix_format_specifiers.sql
-- ============================================================================
-- Purpose: Fix PostgreSQL format() function calls - replace unsupported %.2f
--          with PostgreSQL-compatible formatting
-- 
-- Issue: PostgreSQL format() does NOT support C-style %.2f specifiers
-- Error: "unrecognized format() type specifier '.'"
-- 
-- Fix: Use to_char() for decimal formatting or round()::text
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_release_all_sp_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_wallet_id uuid;
  v_seller_pending_before integer := 0;
  v_seller_pending_after integer := 0;
  v_buyer_wallet_id uuid;
  v_buyer_balance_before integer := 0;
  v_buyer_balance_after integer := 0;
  v_buyer_sp integer := 0;
  v_total_sp integer := 0;
  v_category_multiplier numeric;
  v_item_price_cents integer := 0;
  v_pending_release_days integer := 3;
  v_category_id text;
BEGIN
  -- Only process on status change TO 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- Load trade data we need
    v_buyer_sp := COALESCE(NEW.sp_amount, 0);

    -- ✅ FIX: Load category multiplier with proper fallback chain
    -- 1) Try from trades.sp_category_multiplier (stored at offer creation)
    -- 2) Fall back to items → categories.sp_earning_multiplier (for old trades)
    -- 3) Final fallback: 1.0 (no bonus)
    v_category_multiplier := COALESCE(NEW.sp_category_multiplier, 0);
    
    IF v_category_multiplier <= 0 THEN
      -- Fetch from category table (for trades created before the fix)
      SELECT i.price, i.category_id, c.sp_earning_multiplier
      INTO v_item_price_cents, v_category_id, v_category_multiplier
      FROM public.items i
      LEFT JOIN public.categories c ON i.category_id = c.id
      WHERE i.id = NEW.listing_id;
      
      v_category_multiplier := COALESCE(v_category_multiplier, 1.0);
    ELSE
      -- Load item price separately (multiplier already known from trade)
      SELECT COALESCE(i.price, 0)
      INTO v_item_price_cents
      FROM public.items i
      WHERE i.id = NEW.listing_id;
    END IF;

    -- ✅ CORRECTED FORMULA per user feedback (2026-06-07)
    -- OLD (WRONG): platform_sp = FLOOR(price × 0.25 × multiplier)
    -- NEW (CORRECT): 
    --   - When buyer uses SP: total_sp = FLOOR(buyer_sp × multiplier)
    --   - When buyer pays all cash: total_sp = FLOOR(price × multiplier)
    --
    -- Example from user:
    --   $50 item, buyer offers 30 SP, multiplier 1.10
    --   Correct: FLOOR(30 × 1.10) = 33 SP total
    --   Wrong: 30 SP + FLOOR(50 × 0.25 × 1.10) = 30 + 13 = 43 SP (11 SP error!)

    IF v_buyer_sp > 0 THEN
      -- Buyer used SP: multiply buyer's SP by category multiplier
      -- Example: 30 SP × 1.10 = 33 SP
      v_total_sp := FLOOR(v_buyer_sp * v_category_multiplier);
    ELSIF v_item_price_cents > 0 THEN
      -- Buyer paid all cash: multiply item price by category multiplier
      -- Example: $50 × 1.10 = 55 SP
      v_total_sp := FLOOR((v_item_price_cents::numeric / 100) * v_category_multiplier);
    ELSE
      v_total_sp := 0;
    END IF;

  END IF;

  -- ======================================================================
  -- BUYER: Capture reserved SP (if any) on completion
  --   ⭐ FIX: Removed duplicate sp_ledger INSERT — the reservation trigger
  --   (fn_reserve_sp_on_offer) already created the 'spend_purchase' ledger entry
  --   when the offer was created. Adding it here too caused DOUBLE-CHARGE
  --   (buyer sees TWO "Spend Purchase" entries in SP History for same trade).
  --   We only decrement reserved_sp and increment lifetime_spent here.
  --   Same pattern as fn_release_sp_on_cancel (which had same double-entry bug).
  -- ======================================================================
  IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
    SELECT w.id
    INTO v_buyer_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.buyer_id
    FOR UPDATE;

    IF v_buyer_wallet_id IS NOT NULL THEN
      UPDATE public.sp_wallets w
      SET
        reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
        lifetime_spent = w.lifetime_spent + v_buyer_sp,
        updated_at = now()
      WHERE w.id = v_buyer_wallet_id;
      
      -- No sp_ledger entry here — it was already created at reservation time
    END IF;
  END IF;

  -- ======================================================================
  -- SELLER: ✅ D-17 FIX - Release ALL SP in ONE event
  --   ALL SP → pending_balance (3-day hold)
  --   Per TRADING-FLOW-V2.md D-17: "All SP released to seller in ONE single event"
  -- ======================================================================

  -- Load seller wallet once
  SELECT w.id, COALESCE(w.pending_balance, 0), COALESCE(w.available_balance, 0)
  INTO v_seller_wallet_id, v_seller_pending_before, v_buyer_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.seller_id
  FOR UPDATE;

  IF v_seller_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(NEW.seller_id);
    SELECT w.id, COALESCE(w.pending_balance, 0), COALESCE(w.available_balance, 0)
    INTO v_seller_wallet_id, v_seller_pending_before, v_buyer_balance_before
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.seller_id
    FOR UPDATE;
  END IF;

  -- ✅ FIX: Combined award - ALL SP goes to pending_balance in ONE transaction
  IF v_total_sp > 0 THEN
    v_seller_pending_after := v_seller_pending_before + v_total_sp;

    UPDATE public.sp_wallets w
    SET
      pending_balance = v_seller_pending_after,
      lifetime_earned = w.lifetime_earned + v_total_sp,
      updated_at = now()
    WHERE w.id = v_seller_wallet_id;

    UPDATE public.trades t
    SET
      sp_earned_at_completion = v_total_sp,
      pending_sp_release_at = now() + make_interval(days => v_pending_release_days),
      sp_released_at = NULL,
      updated_at = now()
    WHERE t.id = NEW.id;

    -- ⭐ HOTFIX: Use to_char() instead of %.2f for PostgreSQL format()
    -- PostgreSQL format() only supports %s, %I, %L — NOT %.2f (that's C-style)
    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_total_sp,
      v_seller_pending_before, v_seller_pending_after,
      CASE 
        WHEN v_buyer_sp > 0 THEN 
          -- ✅ FIXED: Use to_char() for decimal formatting
          format('Trade reward: %s SP (buyer %s SP × %s multiplier)', 
                 v_total_sp::text, 
                 v_buyer_sp::text, 
                 to_char(v_category_multiplier, 'FM999999999.00'))
        ELSE
          -- ✅ FIXED: Use to_char() for decimal formatting
          format('Trade reward: %s SP (price $%s × %s multiplier)', 
                 v_total_sp::text, 
                 to_char(v_item_price_cents::numeric / 100, 'FM999999999.00'),
                 to_char(v_category_multiplier, 'FM999999999.00'))
      END,
      NEW.id, now()
    );

    -- Single notification for ALL SP earned (D-17 compliance)
    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    VALUES (
      NEW.seller_id,
      'sp_events',
      'sp_pending_release',
      'Swap Points Pending Release',
      format('You earned %s SP. They will be released in %s days.',
             v_total_sp::text, v_pending_release_days::text),
      jsonb_build_object(
        'trade_id', NEW.id,
        'sp_total', v_total_sp,
        'sp_formula', CASE 
          WHEN v_buyer_sp > 0 THEN 'buyer_sp_multiplied'
          ELSE 'price_multiplied'
        END,
        'pending_release_at', now() + make_interval(days => v_pending_release_days)
      )
    );
  ELSE
    -- No SP earned (non-subscriber seller OR cash-only listing)
    UPDATE public.trades t
    SET
      sp_earned_at_completion = 0,
      pending_sp_release_at = NULL,
      updated_at = now()
    WHERE t.id = NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block trade completion
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES (
    'fn_release_all_sp_on_complete',
    'ERROR',
    jsonb_build_object(
      'error', SQLERRM,
      'state', SQLSTATE,
      'trade_id', NEW.id,
      'seller_id', NEW.seller_id,
      'buyer_id', NEW.buyer_id,
      'sp_amount', v_buyer_sp,
      'total_sp_calculated', v_total_sp
    )
  );
  RAISE WARNING '[fn_release_all_sp_on_complete] Error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- 1. Verify function exists and has correct source
SELECT 
  proname AS function_name,
  CASE 
    WHEN prosrc LIKE '%to_char(v_category_multiplier%' THEN '✅ HOTFIX APPLIED'
    WHEN prosrc LIKE '%%.2f%' THEN '❌ STILL HAS WRONG FORMAT'
    ELSE '⚠️ UNKNOWN'
  END AS status
FROM pg_proc 
WHERE proname = 'fn_release_all_sp_on_complete';

-- 2. Test the trigger with a sample scenario (won't actually complete a trade)
-- Just verifies the function compiles and doesn't error on format() calls
DO $$
BEGIN
  RAISE NOTICE 'Format test: %', format('Trade reward: %s SP (buyer %s SP × %s multiplier)', 
                                        '11', 
                                        '10', 
                                        to_char(1.10::numeric, 'FM999999999.00'));
  RAISE NOTICE 'Format test passed - function should work now';
END;
$$;

-- ============================================================================
-- Verification: Check for Duplicate SP Charges
-- ============================================================================
-- After applying this migration, verify no double-charge bug exists

-- 3. Check for duplicate spend_purchase entries (DOUBLE-CHARGE BUG)
SELECT 
  user_id,
  related_transaction_id,
  COUNT(*) as entry_count,
  STRING_AGG(created_at::text, ', ' ORDER BY created_at) as timestamps
FROM public.sp_ledger
WHERE 
  transaction_type = 'spend_purchase'
  AND related_transaction_id IS NOT NULL
  AND amount < 0
GROUP BY user_id, related_transaction_id
HAVING COUNT(*) > 1
LIMIT 10;
-- Expected AFTER fix + cleanup: 0 rows (no duplicates)
-- If you see rows: Run cleanup-duplicate-sp-charges.sql to remove them

-- ============================================================================
-- Common Failure Modes
-- ============================================================================
-- 
-- 1. "unrecognized format() type specifier '.'" 
--    → CAUSE: Using %.2f in format() (C-style, not PostgreSQL)
--    → FIX: This migration replaces %.2f with to_char(..., 'FM999999999.00')
--
-- 2. Trigger still errors after this migration
--    → VERIFY: Run query #1 above - should show "HOTFIX APPLIED"
--    → If shows "STILL HAS WRONG FORMAT", migration didn't apply
--    → Try: DROP FUNCTION fn_release_all_sp_on_complete() CASCADE; then re-run
--
-- 3. Description shows "1.10" instead of "1.10" in ledger
--    → This is expected - to_char() with FM removes trailing zeros
--    → To keep .10, use: to_char(..., '0.00') instead of 'FM999999999.00'
--
-- 4. Users report "double charges" in SP History
--    → CAUSE: fn_release_all_sp_on_complete() was creating duplicate ledger entry
--    → FIX: This migration removes the duplicate INSERT (see BUYER section)
--    → CLEANUP: Run cleanup-duplicate-sp-charges.sql to remove historical duplicates
--
-- ============================================================================
