-- File: supabase/migrations/20260601000001_coppa_enforcement.sql
-- PROD-P005: COPPA Compliance Server-Side Enforcement
--
-- Mode: idempotent rerunnable migration
--
-- Adds server-side gate so users under 13 without verified parental consent
-- cannot insert into items (create listings) or trades (initiate trades).
--
-- Notes:
--   - profiles uses column `dob DATE` (not `date_of_birth`).
--   - profiles.user_id is the auth.users UUID and is the join key for items/trades.
--   - SECURITY DEFINER is required so the gate can read profiles regardless of
--     the calling user's RLS context. Search path is pinned to public.
--   - We do NOT wrap PERFORM in EXCEPTION-WHEN-OTHERS — silent swallow of a
--     COPPA failure would let unconsented minors through. Instead, we raise.

-- ----------------------------------------------------------------------------
-- 1) Compliance check (read-only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_coppa_compliant(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER required: must read public.profiles regardless of caller RLS.
DECLARE
  v_dob DATE;
  v_consent BOOLEAN;
  v_age_years INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.dob, p.parental_consent_verified
    INTO v_dob, v_consent
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  -- No profile or no DOB on file: not compliant (fail closed).
  IF NOT FOUND OR v_dob IS NULL THEN
    RETURN FALSE;
  END IF;

  v_age_years := EXTRACT(YEAR FROM age(CURRENT_DATE, v_dob))::INTEGER;

  -- 13+ -> COPPA does not apply
  IF v_age_years >= 13 THEN
    RETURN TRUE;
  END IF;

  -- Under 13 -> must have verified parental consent
  RETURN COALESCE(v_consent, FALSE);
END;
$$;

COMMENT ON FUNCTION public.is_coppa_compliant(UUID) IS
  'PROD-P005: Returns TRUE if user is COPPA-compliant (>=13 or under-13 with parental_consent_verified). Fail-closed when profile/DOB missing.';

-- ----------------------------------------------------------------------------
-- 2) Gate that raises a structured exception on violation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_coppa(p_user_id UUID, p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER required: calls is_coppa_compliant + writes debug_logs.
BEGIN
  IF public.is_coppa_compliant(p_user_id) THEN
    RETURN;
  END IF;

  -- Best-effort audit log (does NOT swallow the violation).
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'coppa_enforcement',
      'Action blocked: ' || COALESCE(p_action, '<unknown>'),
      jsonb_build_object(
        'user_id', p_user_id,
        'action', p_action,
        'blocked_at', NOW()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit failure must NEVER prevent the COPPA block from firing.
    RAISE WARNING 'coppa_enforcement audit log failed: %', SQLERRM;
  END;

  RAISE EXCEPTION 'COPPA_CONSENT_REQUIRED: Parental consent is required for users under 13 to %', p_action
    USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.enforce_coppa(UUID, TEXT) IS
  'PROD-P005: Raises COPPA_CONSENT_REQUIRED (SQLSTATE P0001) if user is not compliant. Audit-logs the block.';

-- ----------------------------------------------------------------------------
-- 3) Triggers — block writes by unconsented minors
-- ----------------------------------------------------------------------------

-- Items (listing creation)
CREATE OR REPLACE FUNCTION public.check_coppa_before_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- seller_id is the auth user creating the listing.
  PERFORM public.enforce_coppa(NEW.seller_id, 'create listings');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coppa_check_item_insert ON public.items;
CREATE TRIGGER trigger_coppa_check_item_insert
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_coppa_before_item_insert();

-- Trades (purchase initiation)
CREATE OR REPLACE FUNCTION public.check_coppa_before_trade_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- buyer_id is the auth user initiating the trade.
  PERFORM public.enforce_coppa(NEW.buyer_id, 'initiate trades');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coppa_check_trade_insert ON public.trades;
CREATE TRIGGER trigger_coppa_check_trade_insert
  BEFORE INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.check_coppa_before_trade_insert();

-- ----------------------------------------------------------------------------
-- 4) Grants — allow callers (Edge Functions, RPCs) to invoke the check.
--    The triggers don't need explicit grants because they execute as table owner.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_coppa_compliant(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_coppa(UUID, TEXT) TO authenticated, service_role;
