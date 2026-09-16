-- File: supabase/migrations/20241213000005_base_schema_repair_missing_base_functions.sql
-- Mode B: idempotent rerunnable migration
--
-- FIX-Task-40 — base-schema repair, part 3 of 3 (continuation of FIX-Task-38).
--
-- Eleven functions exist in the live database but no migration in this repo ever
-- creates them (verified with a case-insensitive search over the only working
-- tree, matching both `CREATE FUNCTION` and `CREATE OR REPLACE FUNCTION`, plus a
-- check against the full git history for the two that looked like renames).
-- Bodies and signatures below are the LIVE definitions returned by
-- `pg_get_functiondef()` — they are copied verbatim, not re-authored, so the
-- replayed schema matches the running database.
--
-- CONVENTION NOTE (deliberate deviation):
--   Several of these use `user_uuid` / `lat1` rather than the repo's required
--   `p_`-prefixed parameter convention.  Rewriting the parameter names would
--   change the live function identity, so the live names are preserved on
--   purpose.  New functions authored from here on must still use `p_`.
--
-- NOT RECREATED (extension-provided, not schema):
--   bytea_to_text, text_to_bytea, urlencode — LANGUAGE c functions owned by the
--   `http`/pg_net extension.  They appear in `public` on the live database only
--   because that extension is installed into a different schema per environment.

-- =====================================================================
-- Distance helper — used by node/radius matching
-- =====================================================================
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  radlat1 DOUBLE PRECISION := radians(lat1);
  radlat2 DOUBLE PRECISION := radians(lat2);
  dlat DOUBLE PRECISION := radians(lat2 - lat1);
  dlon DOUBLE PRECISION := radians(lon2 - lon1);
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
  earth_radius DOUBLE PRECISION := 3959; -- miles
BEGIN
  a := sin(dlat/2) * sin(dlat/2) + cos(radlat1) * cos(radlat2) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN earth_radius * c;
END;
$function$;

-- =====================================================================
-- Legacy points helpers (points_transactions, not sp_ledger)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.calculate_points_balance(user_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO balance FROM points_transactions WHERE user_id = user_uuid AND status = 'released';
  RETURN balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_points_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- When points transaction is released, update user's swap_points_balance and lifetime earned on positive amounts
  IF (NEW.status = 'released') THEN
    UPDATE users SET swap_points_balance = COALESCE(swap_points_balance, 0) + NEW.amount WHERE id = NEW.user_id;
    IF (NEW.amount > 0) THEN
      UPDATE users SET lifetime_swap_points_earned = COALESCE(lifetime_swap_points_earned, 0) + NEW.amount WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- =====================================================================
-- Rating / trade-count helpers (read models)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_rating(user_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  avg_rating NUMERIC;
BEGIN
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating FROM reviews WHERE reviewee_id = user_uuid;
  RETURN ROUND(avg_rating::numeric, 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_trade_count(user_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  trade_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trade_count FROM trades WHERE (buyer_id = user_uuid OR seller_id = user_uuid) AND status = 'completed';
  RETURN trade_count;
END;
$function$;

-- =====================================================================
-- Debug logging — must never raise into its caller
-- =====================================================================
CREATE OR REPLACE FUNCTION public.log_debug(
  p_process_name text,
  p_user_id uuid,
  p_message text,
  p_payload jsonb DEFAULT NULL::jsonb,
  p_error_message text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.debug_logs (process_name, user_id, message, payload, error_message)
  VALUES (p_process_name, p_user_id, p_message, p_payload, p_error_message);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$function$;

-- =====================================================================
-- Referral-code backfill trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  -- Only backfill when missing
  IF NEW.referral_code IS NULL THEN
    PERFORM public.create_referral_code(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- FAQ voting RPCs (faq_votes is created by the base-objects repair)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_record_faq_vote(
  p_faq_item_id uuid,
  p_vote text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_anonymous_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean := false;
BEGIN
  IF p_vote NOT IN ('yes', 'no') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_vote');
  END IF;

  IF p_user_id IS NULL AND (p_anonymous_id IS NULL OR p_anonymous_id = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_identifier');
  END IF;

  -- Check uniqueness
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.faq_votes fv
      WHERE fv.faq_item_id = p_faq_item_id AND fv.user_id = p_user_id
    ) INTO v_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.faq_votes fv
      WHERE fv.faq_item_id = p_faq_item_id AND fv.anonymous_id = p_anonymous_id
    ) INTO v_exists;
  END IF;

  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_voted');
  END IF;

  INSERT INTO public.faq_votes (faq_item_id, user_id, anonymous_id, vote)
  VALUES (p_faq_item_id, p_user_id, p_anonymous_id, p_vote);

  IF p_vote = 'yes' THEN
    UPDATE public.faq_items SET yes_count = yes_count + 1 WHERE id = p_faq_item_id;
  ELSE
    UPDATE public.faq_items SET no_count = no_count + 1 WHERE id = p_faq_item_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_reset_faq_votes(p_faq_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.faq_votes WHERE faq_item_id = p_faq_item_id;
  UPDATE public.faq_items SET yes_count = 0, no_count = 0 WHERE id = p_faq_item_id;
END;
$function$;

-- =====================================================================
-- Auth metadata -> profile DOB/age reconciliation
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_profile_dob_from_auth(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auth_dob TEXT;
  v_parsed_dob DATE;
  v_calculated_age INTEGER;
  v_rows_updated INTEGER;
BEGIN
  -- Get DOB from auth
  SELECT raw_user_meta_data->>'dob' INTO v_auth_dob
  FROM auth.users
  WHERE id = p_user_id;

  IF v_auth_dob IS NULL OR v_auth_dob = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No DOB found in auth metadata',
      'dob', NULL
    );
  END IF;

  -- Parse DOB
  BEGIN
    v_parsed_dob := TO_DATE(TRIM(v_auth_dob), 'YYYY-MM-DD');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Failed to parse DOB: ' || SQLERRM,
      'dob_raw', v_auth_dob
    );
  END;

  -- Calculate age
  v_calculated_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_parsed_dob))::INTEGER;

  -- Only set age if in valid range (5-17)
  IF v_calculated_age < 5 OR v_calculated_age > 17 THEN
    v_calculated_age := NULL;
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET
    dob = v_parsed_dob,
    age = v_calculated_age,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Profile updated with DOB and age',
      'dob', v_parsed_dob,
      'age', v_calculated_age,
      'rows_updated', v_rows_updated
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found',
      'user_id', p_user_id
    );
  END IF;
END;
$function$;

-- =====================================================================
-- QA/test-data cleanup helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_cleanup_test_buyer_trades(p_buyer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trade_count INTEGER := 0;
  v_listing_ids UUID[] := '{}';
  v_listing_id UUID;
BEGIN
  -- 1. Collect listing_ids that will be affected
  SELECT ARRAY_AGG(DISTINCT listing_id)
  INTO v_listing_ids
  FROM trades
  WHERE buyer_id = p_buyer_id
    AND status IN ('pending', 'payment_failed');

  -- 2. Cancel all pending/payment_failed trades for this buyer
  UPDATE trades
  SET
    status = 'cancelled',
    cancellation_reason = 'test_cleanup',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE buyer_id = p_buyer_id
    AND status IN ('pending', 'payment_failed');

  GET DIAGNOSTICS v_trade_count = ROW_COUNT;

  -- 3. Reset affected listings back to 'available'
  IF array_length(v_listing_ids, 1) > 0 THEN
    FOREACH v_listing_id IN ARRAY v_listing_ids
    LOOP
      UPDATE items
      SET status = 'available', updated_at = NOW()
      WHERE id = v_listing_id
        AND status IN ('pending', 'sold');
    END LOOP;
  END IF;

  -- 4. Return result
  RETURN json_build_object(
    'success', true,
    'trades_cancelled', v_trade_count,
    'listings_reset', array_length(v_listing_ids, 1)
  );
END;
$function$;

-- =====================================================================
-- Verification (run one statement at a time):
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public'
--     and p.proname in ('calculate_distance','calculate_points_balance','get_user_rating',
--                       'get_user_trade_count','log_debug','sync_points_balance',
--                       'ensure_profile_referral_code','rpc_record_faq_vote',
--                       'rpc_reset_faq_votes','sync_profile_dob_from_auth',
--                       'fn_cleanup_test_buyer_trades')
--   order by 1, 2;
--   -- Expected: 11 rows
-- =====================================================================
