


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."admin_config_category" AS ENUM (
    'subscription',
    'swap_points',
    'fees',
    'sms',
    'email',
    'moderation',
    'safety',
    'analytics',
    'feature_flags'
);


ALTER TYPE "public"."admin_config_category" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_force_delete_listing"("p_listing_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin status (check user metadata)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id 
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only admins can force delete listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status before deletion
  SELECT status INTO v_old_status FROM items WHERE id = p_listing_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- If already deleted, skip update but still log
  IF v_old_status != 'deleted' THEN
    -- Force delete by setting status to deleted
    UPDATE items
    SET 
      status = 'deleted',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'force_delete', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'force_delete',
    'old_status', v_old_status,
    'new_status', 'deleted',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."admin_force_delete_listing"("p_listing_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_pause_listing"("p_listing_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id 
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only admins can pause listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status FROM items WHERE id = p_listing_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- Pause listing if not already paused/deleted
  IF v_old_status NOT IN ('paused', 'deleted') THEN
    UPDATE items
    SET 
      status = 'paused',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'pause', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'pause',
    'old_status', v_old_status,
    'new_status', 'paused',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."admin_pause_listing"("p_listing_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_unpause_listing"("p_listing_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id 
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only admins can unpause listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status FROM items WHERE id = p_listing_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- Unpause listing if currently paused
  IF v_old_status = 'paused' THEN
    UPDATE items
    SET 
      status = 'available',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'unpause', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'unpause',
    'old_status', v_old_status,
    'new_status', 'available',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."admin_unpause_listing"("p_listing_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_node_by_zip"("p_zip" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_node_id TEXT;
BEGIN
  SELECT node_id INTO v_node_id
  FROM zip_codes
  WHERE zip = p_zip
  LIMIT 1;
  
  IF v_node_id IS NULL THEN
    -- ZIP not found, return NULL
    RETURN NULL;
  END IF;
  
  RETURN v_node_id;
END;
$$;


ALTER FUNCTION "public"."assign_node_by_zip"("p_zip" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_distance"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) RETURNS double precision
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."calculate_distance"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_node_distance"("node1_id" "uuid", "node2_id" "uuid") RETURNS double precision
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    AS $$
DECLARE
  node1_lat DOUBLE PRECISION;
  node1_lng DOUBLE PRECISION;
  node2_lat DOUBLE PRECISION;
  node2_lng DOUBLE PRECISION;
  distance_meters DOUBLE PRECISION;
BEGIN
  -- Get node 1 coordinates
  SELECT latitude, longitude INTO node1_lat, node1_lng
  FROM geographic_nodes
  WHERE id = node1_id;

  -- Get node 2 coordinates
  SELECT latitude, longitude INTO node2_lat, node2_lng
  FROM geographic_nodes
  WHERE id = node2_id;

  -- Handle case where either node not found
  IF node1_lat IS NULL OR node2_lat IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate distance in meters using PostGIS ST_DistanceSphere
  distance_meters := ST_DistanceSphere(
    ST_MakePoint(node1_lng, node1_lat),
    ST_MakePoint(node2_lng, node2_lat)
  );

  -- Convert meters to miles (1 mile = 1609.34 meters)
  RETURN distance_meters / 1609.34;
END;
$$;


ALTER FUNCTION "public"."calculate_node_distance"("node1_id" "uuid", "node2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_points_balance"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO balance FROM points_transactions WHERE user_id = user_uuid AND status = 'released';
  RETURN balance;
END;
$$;


ALTER FUNCTION "public"."calculate_points_balance"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_phone_verification_status"("p_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "name" "text", "email" "text", "phone" "text", "phone_verified" boolean, "phone_verified_at" timestamp with time zone, "last_verification_code" "text", "last_verification_sent_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.name,
    au.email,
    au.phone,
    p.phone_verified,
    p.phone_verified_at,
    pvc.code AS last_verification_code,
    pvc.created_at AS last_verification_sent_at
  FROM profiles p
  JOIN auth.users au ON au.id = p.user_id
  LEFT JOIN LATERAL (
    SELECT code, created_at
    FROM phone_verification_codes
    WHERE user_id = p.user_id
    ORDER BY created_at DESC
    LIMIT 1
  ) pvc ON true
  WHERE p.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."check_phone_verification_status"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_sms_rate_limit"("p_phone" "text", "p_max_per_hour" integer DEFAULT 10) RETURNS TABLE("allowed" boolean, "sms_count_this_hour" integer, "limit_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count SMS sent in last hour
  SELECT COUNT(*) INTO v_count
  FROM sms_rate_limit_log
  WHERE phone = p_phone
    AND sent_at > NOW() - INTERVAL '1 hour'
    AND status = 'sent';
  
  RETURN QUERY SELECT 
    (v_count < p_max_per_hour)::BOOLEAN,
    v_count::INTEGER,
    p_max_per_hour::INTEGER;
END;
$$;


ALTER FUNCTION "public"."check_sms_rate_limit"("p_phone" "text", "p_max_per_hour" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'free'::"text" NOT NULL,
    "trial_start_date" timestamp with time zone,
    "trial_end_date" timestamp with time zone,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['free'::"text", 'trial'::"text", 'active'::"text", 'grace'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_trial_subscription"("p_user_id" "uuid") RETURNS "public"."subscriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_days INTEGER;
BEGIN
  -- Check if subscription already exists
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Subscription already exists for user %', p_user_id;
  END IF;

  -- Get configurable trial duration (defaults to 30 if not found)
  v_trial_days := get_trial_duration_days();

  -- Create trial subscription with dynamic trial days from admin_config
  INSERT INTO subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    stripe_customer_id,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    NULL, -- No Stripe customer during no-card trial
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;


ALTER FUNCTION "public"."create_trial_subscription"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_trial_subscription"("p_user_id" "uuid") IS 'MODULE-03 AUTH-V2-002: Creates Kids Club+ trial subscription using configurable trial duration from admin_config';



CREATE OR REPLACE FUNCTION "public"."debug_auth_context"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'email', auth.email(),
    'jwt', auth.jwt()
  );
END;
$$;


ALTER FUNCTION "public"."debug_auth_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_node_member_count"("node_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.nodes
  SET member_count = COALESCE(member_count, 0) - 1,
      updated_at = now()
  WHERE id = node_id AND member_count > 0;
END;
$$;


ALTER FUNCTION "public"."decrement_node_member_count"("node_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_referral_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  code TEXT;
  found BOOLEAN;
BEGIN
  LOOP
    -- Generate random 8-character code (A-Z, 0-9)
    code := UPPER(substr(md5(gen_random_uuid()::TEXT), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE referral_code = code
    ) INTO found;
    
    -- If code doesn't exist, return it
    IF NOT found THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_referral_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_referral_code_on_profile_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  -- Only generate if referral_code is NULL
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Generate unique 8-character code
  LOOP
    v_code := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)
    );
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = v_code) THEN
      NEW.referral_code := v_code;
      EXIT;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_referral_code_on_profile_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearest_node"("user_lat" numeric, "user_lng" numeric, "p_status" "text" DEFAULT 'active'::"text") RETURNS TABLE("node_id" "text", "node_name" "text", "distance" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id::TEXT AS node_id,
    n.name::TEXT AS node_name,
    SQRT(
      POWER(CAST(n.latitude AS NUMERIC) - CAST(user_lat AS NUMERIC), 2) +
      POWER(CAST(n.longitude AS NUMERIC) - CAST(user_lng AS NUMERIC), 2)
    )::NUMERIC AS distance
  FROM public.nodes n
  WHERE n.status = p_status
  ORDER BY distance ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_nearest_node"("user_lat" numeric, "user_lng" numeric, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nodes_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) RETURNS TABLE("id" "uuid", "name" "text", "city" "text", "state" "text", "distance_miles" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    gn.id,
    gn.name,
    gn.city,
    gn.state,
    (ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34) AS distance_miles
  FROM geographic_nodes gn
  WHERE
    gn.is_active = true
    AND ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34 <= radius_miles
  ORDER BY distance_miles ASC;
END;
$$;


ALTER FUNCTION "public"."get_nodes_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_subscription_summary"("p_user_id" "uuid") RETURNS TABLE("status" "text", "can_spend_sp" boolean, "trial_end_date" timestamp with time zone, "current_period_end" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.status,
    CASE 
      WHEN s.status IN ('trial', 'active') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    s.trial_end_date,
    s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_subscription_summary"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trial_duration_days"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  duration_value TEXT;
  duration INTEGER;
BEGIN
  SELECT value INTO duration_value
  FROM admin_config
  WHERE key = 'trial_period_days'
    AND is_active = TRUE;

  -- Default to 30 days if not found
  IF duration_value IS NULL THEN
    RETURN 30;
  END IF;

  -- Convert value to integer
  duration := duration_value::INTEGER;
  RETURN COALESCE(duration, 30);
END;
$$;


ALTER FUNCTION "public"."get_trial_duration_days"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_trial_duration_days"() IS 'MODULE-12: Get configured trial duration in days (V2 schema)';



CREATE OR REPLACE FUNCTION "public"."get_user_rating"("user_uuid" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  avg_rating NUMERIC;
BEGIN
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating FROM reviews WHERE reviewee_id = user_uuid;
  RETURN ROUND(avg_rating::numeric, 2);
END;
$$;


ALTER FUNCTION "public"."get_user_rating"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_sp_wallet_summary"("p_user_id" "uuid") RETURNS TABLE("available_points" integer, "pending_points" integer, "lifetime_earned" integer, "lifetime_spent" integer, "wallet_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.available_balance AS available_points,
    w.pending_balance AS pending_points,
    w.lifetime_earned,
    w.lifetime_spent,
    w.status AS wallet_status
  FROM sp_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_sp_wallet_summary"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_trade_count"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  trade_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trade_count FROM trades WHERE (buyer_id = user_uuid OR seller_id = user_uuid) AND status = 'completed';
  RETURN trade_count;
END;
$$;


ALTER FUNCTION "public"."get_user_trade_count"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_dob DATE;
  calculated_age INTEGER;
BEGIN
  -- Extract DOB from metadata
  user_dob := CASE WHEN (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> ''
    THEN (NEW.raw_user_meta_data->>'dob')::date
    ELSE NULL
  END;

  -- Calculate age if DOB is provided
  calculated_age := CASE WHEN user_dob IS NOT NULL
    THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))::INTEGER
    ELSE NULL
  END;

  INSERT INTO public.profiles (user_id, name, dob, age, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    user_dob,
    calculated_age,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_node_member_count"("node_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.nodes
  SET member_count = COALESCE(member_count, 0) + 1,
      updated_at = now()
  WHERE id = node_id;
END;
$$;


ALTER FUNCTION "public"."increment_node_member_count"("node_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_verification_attempts"("p_user_id" "uuid", "p_code" "text") RETURNS TABLE("attempts" integer, "max_attempts" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_attempts INTEGER;
BEGIN
  UPDATE phone_verification_codes
  SET attempts = attempts + 1
  WHERE user_id = p_user_id
    AND code = p_code
    AND verified = false
  RETURNING attempts INTO v_current_attempts;
  
  RETURN QUERY SELECT 
    COALESCE(v_current_attempts, 0)::INTEGER,
    3::INTEGER;
END;
$$;


ALTER FUNCTION "public"."increment_verification_attempts"("p_user_id" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sp_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "available_balance" integer DEFAULT 0 NOT NULL,
    "pending_balance" integer DEFAULT 0 NOT NULL,
    "lifetime_earned" integer DEFAULT 0 NOT NULL,
    "lifetime_spent" integer DEFAULT 0 NOT NULL,
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sp_wallets_available_balance_check" CHECK (("available_balance" >= 0)),
    CONSTRAINT "sp_wallets_lifetime_earned_check" CHECK (("lifetime_earned" >= 0)),
    CONSTRAINT "sp_wallets_lifetime_spent_check" CHECK (("lifetime_spent" >= 0)),
    CONSTRAINT "sp_wallets_pending_balance_check" CHECK (("pending_balance" >= 0)),
    CONSTRAINT "sp_wallets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'frozen'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."sp_wallets" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_sp_wallet"("p_user_id" "uuid") RETURNS "public"."sp_wallets"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_wallet sp_wallets;
BEGIN
  -- Check if wallet already exists
  SELECT * INTO v_wallet FROM sp_wallets WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'SP wallet already exists for user %', p_user_id;
  END IF;

  -- Create SP wallet with zero balance
  INSERT INTO sp_wallets (
    user_id,
    status,
    available_balance,
    pending_balance,
    lifetime_earned,
    lifetime_spent,
    last_activity_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'active',
    0,
    0,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;


ALTER FUNCTION "public"."initialize_sp_wallet"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("p_uid" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;
  SELECT role INTO v_role FROM public.users WHERE id = p_uid;
  RETURN (v_role = 'admin');
END;
$$;


ALTER FUNCTION "public"."is_admin"("p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_trial_enabled"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  trial_enabled_value TEXT;
BEGIN
  SELECT value INTO trial_enabled_value
  FROM admin_config
  WHERE key = 'trial_enabled'
    AND is_active = TRUE;

  -- Return TRUE if value is 'true' or '1'
  RETURN COALESCE(trial_enabled_value = 'true', FALSE);
END;
$$;


ALTER FUNCTION "public"."is_trial_enabled"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_trial_enabled"() IS 'MODULE-12: Check if trial subscription enrollment is enabled (V2 schema)';



CREATE OR REPLACE FUNCTION "public"."mark_referral_claimed"("p_referred_user_id" "uuid", "p_referral_code" "text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_referrer_user_id UUID;
BEGIN
  -- Find referrer by code
  SELECT id INTO v_referrer_user_id
  FROM profiles
  WHERE referral_code = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid referral code'::TEXT;
    RETURN;
  END IF;
  
  -- Update referral status
  UPDATE referrals
  SET status = 'claimed', claimed_at = NOW()
  WHERE referrer_user_id = v_referrer_user_id
    AND referred_user_id = p_referred_user_id
    AND status = 'pending';
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Referral marked as claimed'::TEXT;
END;
$$;


ALTER FUNCTION "public"."mark_referral_claimed"("p_referred_user_id" "uuid", "p_referral_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_referral_bonus"("p_referred_user_id" "uuid", "p_referral_code" "text", "p_bonus_amount" integer DEFAULT 50) RETURNS TABLE("success" boolean, "message" "text", "referrer_user_id" "uuid", "referred_user_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_referrer_user_id UUID;
  v_referral_record RECORD;
BEGIN
  -- Find the referral code owner
  SELECT id INTO v_referrer_user_id
  FROM profiles
  WHERE referral_code = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid referral code'::TEXT,
      NULL::UUID,
      p_referred_user_id;
    RETURN;
  END IF;
  
  -- Check if referral already exists
  SELECT * INTO v_referral_record
  FROM referrals
  WHERE referrer_user_id = v_referrer_user_id
    AND referred_user_id = p_referred_user_id;
  
  IF v_referral_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Referral already processed'::TEXT,
      v_referrer_user_id,
      p_referred_user_id;
    RETURN;
  END IF;
  
  -- Create referral record
  INSERT INTO referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    bonus_points,
    bonus_points_referrer,
    claimed_at,
    bonus_claimed_at,
    bonus_claimed_referrer_at
  ) VALUES (
    v_referrer_user_id,
    p_referred_user_id,
    p_referral_code,
    'claimed',
    p_bonus_amount,
    p_bonus_amount,
    NOW(),
    NOW(),
    NOW()
  );
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Referral bonus awarded successfully'::TEXT,
    v_referrer_user_id,
    p_referred_user_id;
END;
$$;


ALTER FUNCTION "public"."process_referral_bonus"("p_referred_user_id" "uuid", "p_referral_code" "text", "p_bonus_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_referral_bonus_on_trade"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_referral RECORD;
  v_trade_count INTEGER;
  v_referral_bonus INTEGER := 5; -- 5 points per referral
BEGIN
  -- Only process for completed trades
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if buyer has a pending referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = NEW.buyer_id
    AND status = 'pending'
  LIMIT 1;

  -- No pending referral found
  IF v_referral IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is the buyer's first completed trade
  SELECT COUNT(*) INTO v_trade_count
  FROM trades
  WHERE buyer_id = NEW.buyer_id
    AND status = 'completed'
    AND id != NEW.id;

  -- Not the first trade
  IF v_trade_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Award 5 points to referrer
  INSERT INTO points_transactions (
    user_id,
    points,
    transaction_type,
    description,
    related_id,
    created_at
  ) VALUES (
    v_referral.referrer_user_id,
    v_referral_bonus,
    'referral_bonus',
    'Referral bonus: ' || v_referral.referral_code,
    v_referral.id,
    NOW()
  );

  -- Award 5 points to referee
  INSERT INTO points_transactions (
    user_id,
    points,
    transaction_type,
    description,
    related_id,
    created_at
  ) VALUES (
    v_referral.referred_user_id,
    v_referral_bonus,
    'referral_bonus',
    'Referral bonus: ' || v_referral.referral_code,
    v_referral.id,
    NOW()
  );

  -- Update referral status to claimed
  UPDATE referrals
  SET
    status = 'claimed',
    bonus_points = v_referral_bonus,
    bonus_claimed_at = NOW(),
    bonus_points_referrer = v_referral_bonus,
    bonus_claimed_referrer_at = NOW(),
    claimed_at = NOW()
  WHERE id = v_referral.id;

  -- TODO: Create notifications for both users
  -- TODO: Track analytics event

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_referral_bonus_on_trade"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_active_node_for_signup"("requested_zip" "text", "user_lat" double precision, "user_lng" double precision) RETURNS TABLE("id" "uuid", "name" "text", "zip_code" "text", "city" "text", "state" "text", "latitude" double precision, "longitude" double precision, "distance_km" double precision, "match_type" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  exact_match_count INT;
BEGIN
  SELECT COUNT(*) INTO exact_match_count
  FROM public.nodes
  WHERE public.nodes.zip_code = requested_zip AND public.nodes.is_active = TRUE;

  IF exact_match_count > 0 THEN
    RETURN QUERY
    SELECT
      n.id,
      n.name,
      n.zip_code,
      n.city,
      n.state,
      n.latitude,
      n.longitude,
      NULL::DOUBLE PRECISION as distance_km,
      'zip'::TEXT as match_type
    FROM public.nodes n
    WHERE n.zip_code = requested_zip AND n.is_active = TRUE
    LIMIT 1;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.name,
    n.zip_code,
    n.city,
    n.state,
    n.latitude,
    n.longitude,
    (ST_DistanceSphere(
      ST_MakePoint(user_lng, user_lat),
      ST_MakePoint(n.longitude, n.latitude)
    ) / 1000.0) as distance_km,
    'nearest'::TEXT as match_type
  FROM public.nodes n
  WHERE n.is_active = TRUE
  ORDER BY ST_DistanceSphere(
    ST_MakePoint(user_lng, user_lat),
    ST_MakePoint(n.longitude, n.latitude)
  ) ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."resolve_active_node_for_signup"("requested_zip" "text", "user_lat" double precision, "user_lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_session"("p_user_id" "uuid", "p_device_id" "text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE auth_sessions
  SET status = 'revoked', revoked_at = NOW()
  WHERE user_id = p_user_id
    AND device_id = p_device_id
    AND status = 'active';
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      'Session revoked successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Session not found or already revoked'::TEXT;
  END IF;
END;
$$;


ALTER FUNCTION "public"."revoke_session"("p_user_id" "uuid", "p_device_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_message_expiration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
    -- set all messages in trade to expire in 30 days
    UPDATE messages SET expires_at = NOW() + INTERVAL '30 days' WHERE trade_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_message_expiration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_points_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_points_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_admin_config_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_admin_config_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_admin_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_admin_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_favorites_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE items SET favorites_count = COALESCE(favorites_count, 0) + 1 WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE items SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0) WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_favorites_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_tokens_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_tokens_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sp_wallets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sp_wallets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subscriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_subscriptions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upgrade_free_subscription_to_trial"("p_user_id" "uuid") RETURNS "public"."subscriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_duration INTEGER;
  v_trial_end_date TIMESTAMPTZ;
BEGIN
  -- Get the user's subscription
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for user %', p_user_id;
  END IF;

  IF v_subscription.status != 'free' THEN
    RETURN v_subscription;
  END IF;

  -- Get trial duration from admin config
  v_trial_duration := get_trial_duration_days();
  v_trial_end_date := NOW() + (v_trial_duration || ' days')::INTERVAL;

  -- Update the free subscription to trial
  UPDATE subscriptions
  SET 
    status = 'trial',
    trial_start_date = NOW(),
    trial_end_date = v_trial_end_date,
    updated_at = NOW()
  WHERE id = v_subscription.id
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;


ALTER FUNCTION "public"."upgrade_free_subscription_to_trial"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_admin_config_setting"("p_key" "text", "p_value" "text", "p_category" "public"."admin_config_category", "p_data_type" "text" DEFAULT 'string'::"text", "p_is_secret" boolean DEFAULT false, "p_is_active" boolean DEFAULT true) RETURNS TABLE("out_id" bigint, "out_key" "text", "out_value" "text", "out_category" "public"."admin_config_category", "out_data_type" "text", "out_is_secret" boolean, "out_is_active" boolean, "out_updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  INSERT INTO admin_config (
    key,
    value,
    category,
    data_type,
    is_secret,
    is_active,
    updated_at
  )
  VALUES (
    p_key,
    p_value,
    p_category,
    p_data_type,
    p_is_secret,
    p_is_active,
    NOW()
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = EXCLUDED.value,
    category = EXCLUDED.category,
    data_type = EXCLUDED.data_type,
    is_secret = EXCLUDED.is_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING
    admin_config.id,
    admin_config.key,
    admin_config.value,
    admin_config.category,
    admin_config.data_type,
    admin_config.is_secret,
    admin_config.is_active,
    admin_config.updated_at;
END;
$$;


ALTER FUNCTION "public"."upsert_admin_config_setting"("p_key" "text", "p_value" "text", "p_category" "public"."admin_config_category", "p_data_type" "text", "p_is_secret" boolean, "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_phone_code"("p_user_id" "uuid", "p_code" "text") RETURNS TABLE("success" boolean, "message" "text", "user_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_record RECORD;
  v_attempts INTEGER;
BEGIN
  -- Find the verification code (qualify column references)
  SELECT * INTO v_record
  FROM phone_verification_codes
  WHERE phone_verification_codes.user_id = p_user_id
    AND phone_verification_codes.code = p_code
    AND phone_verification_codes.verified = false
    AND phone_verification_codes.expires_at > NOW()
  ORDER BY phone_verification_codes.created_at DESC
  LIMIT 1;

  -- Code not found or expired
  IF v_record IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid or expired verification code'::TEXT,
      p_user_id;
    RETURN;
  END IF;

  -- Check attempts
  IF v_record.attempts >= 3 THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Too many attempts. Please request a new code.'::TEXT,
      p_user_id;
    RETURN;
  END IF;

  -- Mark as verified
  UPDATE phone_verification_codes
  SET verified = true
  WHERE phone_verification_codes.id = v_record.id;

  -- Update user profile
  UPDATE profiles
  SET 
    phone_verified = true,
    phone_verified_at = NOW()
  WHERE profiles.user_id = p_user_id;

  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Phone number verified successfully'::TEXT,
    p_user_id;
END;
$$;


ALTER FUNCTION "public"."verify_phone_code"("p_user_id" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_user_phone"("p_user_id" "uuid", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_rows_updated INTEGER := 0;
  v_verified_count INTEGER := 0;
BEGIN
  -- Ensure there is a verified code for this user and phone within the last 24 hours
  SELECT COUNT(*) INTO v_verified_count
  FROM phone_verification_codes pvc
  WHERE pvc.user_id = p_user_id
    AND pvc.phone = p_phone
    AND pvc.verified = true
    AND pvc.created_at >= (NOW() - INTERVAL '24 hours');

  IF v_verified_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No recent verified code found for this phone',
      'verified_count', v_verified_count
    );
  END IF;

  -- Update the profile
  UPDATE profiles
  SET 
    phone_verified = true,
    phone_verified_at = NOW()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Phone verified successfully',
      'rows_updated', v_rows_updated,
      'verified_count', v_verified_count
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No profile found for user_id',
      'rows_updated', 0,
      'verified_count', v_verified_count
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."verify_user_phone"("p_user_id" "uuid", "p_phone" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" character varying(50) NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid",
    "changes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_config" (
    "id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "category" "public"."admin_config_category" NOT NULL,
    "data_type" "text" DEFAULT 'string'::"text" NOT NULL,
    "is_secret" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    CONSTRAINT "valid_data_type" CHECK (("data_type" = ANY (ARRAY['string'::"text", 'number'::"text", 'boolean'::"text", 'json'::"text"]))),
    CONSTRAINT "valid_key_format" CHECK (("key" ~ '^[a-z0-9_]+$'::"text"))
);


ALTER TABLE "public"."admin_config" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."admin_config_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."admin_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."admin_config_id_seq" OWNED BY "public"."admin_config"."id";



CREATE TABLE IF NOT EXISTS "public"."admin_listing_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action_type" character varying(50) NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_listing_actions_action_type_check" CHECK ((("action_type")::"text" = ANY ((ARRAY['force_delete'::character varying, 'pause'::character varying, 'unpause'::character varying])::"text"[])))
);


ALTER TABLE "public"."admin_listing_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_moderation_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid",
    "model" "text",
    "result" "jsonb",
    "confidence" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_moderation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "device_name" "text",
    "device_type" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval) NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "auth_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."auth_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boost_listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "duration_minutes" integer DEFAULT 60,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."boost_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cpsc_recalls" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_name" "text" NOT NULL,
    "recall_date" "date",
    "description" "text",
    "product_codes" "text"[],
    "keywords" "tsvector",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cpsc_recalls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."geographic_nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(2) NOT NULL,
    "zip_code" character varying(5) NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "radius_miles" integer DEFAULT 10 NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "member_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."geographic_nodes" OWNER TO "postgres";


COMMENT ON TABLE "public"."geographic_nodes" IS 'DEPRECATED: Use public.nodes table instead. This table will be removed in future migration.';



CREATE TABLE IF NOT EXISTS "public"."item_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "thumbnail_url" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."item_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "category_id" "uuid",
    "condition" "text",
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "accepts_swap_points" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sold_at" timestamp with time zone,
    "seller_subscription_status_at_creation" "text",
    CONSTRAINT "items_condition_check" CHECK (("condition" = ANY (ARRAY['new'::"text", 'like_new'::"text", 'good'::"text", 'fair'::"text", 'poor'::"text"]))),
    CONSTRAINT "items_description_check" CHECK (("length"("description") <= 1000)),
    CONSTRAINT "items_price_check" CHECK ((("price" >= (0)::numeric) AND ("price" <= (10000)::numeric))),
    CONSTRAINT "items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'available'::"text", 'pending'::"text", 'sold'::"text", 'deleted'::"text", 'paused'::"text"]))),
    CONSTRAINT "items_title_check" CHECK ((("length"("title") >= 3) AND ("length"("title") <= 100)))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."items"."seller_subscription_status_at_creation" IS 'V2: Seller subscription status when listing created (audit trail)';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "node_id" "uuid",
    "profile_completed" boolean DEFAULT false NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "phone_verified" boolean DEFAULT false NOT NULL,
    "phone_verified_at" timestamp with time zone,
    "referral_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dob" "date",
    "onboarding_completed_at" timestamp with time zone,
    "referred_by" "uuid",
    "subscription_id" "uuid",
    "sp_wallet_id" "uuid",
    "parental_consent_verified" boolean DEFAULT false,
    "age" integer,
    CONSTRAINT "profiles_age_check" CHECK ((("age" >= 5) AND ("age" <= 17)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."referred_by" IS 'User ID of the person who referred this user (temporary workaround for referrals table schema cache issue)';



CREATE OR REPLACE VIEW "public"."items_with_node_info" AS
 SELECT "i"."id",
    "i"."seller_id",
    "i"."title",
    "i"."description",
    "i"."price",
    "i"."category_id",
    "i"."condition",
    "i"."status",
    "i"."accepts_swap_points",
    "i"."created_at",
    "i"."updated_at",
    "i"."sold_at",
    "p"."node_id" AS "seller_node_id",
    "gn"."name" AS "seller_node_name",
    "gn"."city" AS "seller_node_city",
    "gn"."state" AS "seller_node_state",
    "gn"."latitude" AS "seller_node_latitude",
    "gn"."longitude" AS "seller_node_longitude"
   FROM (("public"."items" "i"
     JOIN "public"."profiles" "p" ON (("i"."seller_id" = "p"."user_id")))
     LEFT JOIN "public"."geographic_nodes" "gn" ON (("p"."node_id" = "gn"."id")))
  WHERE ("i"."status" = 'available'::"text");


ALTER VIEW "public"."items_with_node_info" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."listing_admin_analytics" AS
 SELECT "count"(*) FILTER (WHERE ("status" = 'available'::"text")) AS "active_listings",
    "count"(*) FILTER (WHERE ("status" = 'deleted'::"text")) AS "deleted_listings",
    "count"(*) FILTER (WHERE ("status" = 'pending'::"text")) AS "paused_listings",
    "count"(*) FILTER (WHERE ("accepts_swap_points" = true)) AS "sp_eligible_listings",
    "count"(*) FILTER (WHERE (("accepts_swap_points" = true) AND ("status" = 'available'::"text"))) AS "active_sp_listings",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("accepts_swap_points" = true)))::numeric) / (NULLIF("count"(*), 0))::numeric), 2) AS "sp_adoption_rate",
    "avg"(("price")::numeric) AS "avg_listing_price",
    "min"("price") AS "min_listing_price",
    "max"("price") AS "max_listing_price",
    "count"(DISTINCT "seller_id") AS "total_sellers",
    "count"(DISTINCT "date"("created_at")) AS "days_active"
   FROM "public"."items"
  WHERE ("created_at" > ("now"() - '30 days'::interval));


ALTER VIEW "public"."listing_admin_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trade_id" "uuid",
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid",
    "content" "text",
    "image_url" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "messages_check" CHECK ((("content" IS NOT NULL) OR ("image_url" IS NOT NULL)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid",
    "reported_by" "uuid",
    "reason" "text",
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."moderation_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nodes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "latitude" double precision,
    "longitude" double precision,
    "radius_miles" integer DEFAULT 10,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "member_count" integer DEFAULT 0,
    "description" "text",
    CONSTRAINT "nodes_member_count_check" CHECK (("member_count" >= 0)),
    CONSTRAINT "nodes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'waitlist'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."nodes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."nodes"."city" IS 'City of the node (central location)';



COMMENT ON COLUMN "public"."nodes"."state" IS 'State code (2 letters, e.g., CT)';



COMMENT ON COLUMN "public"."nodes"."zip_code" IS 'Primary ZIP code of the node center';



COMMENT ON COLUMN "public"."nodes"."radius_miles" IS 'Radius in miles for node coverage area';



COMMENT ON COLUMN "public"."nodes"."is_active" IS 'Whether this node is accepting new members';



COMMENT ON COLUMN "public"."nodes"."updated_at" IS 'Last update timestamp';



COMMENT ON COLUMN "public"."nodes"."description" IS 'Admin notes about this node';



CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_verification_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "phone_verification_codes_attempts_check" CHECK ((("attempts" >= 0) AND ("attempts" <= 3)))
);


ALTER TABLE "public"."phone_verification_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "reason" "text",
    "related_trade_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."points_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_with_auth" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."user_id",
    "p"."name",
    "p"."avatar_url",
    "p"."bio",
    "p"."city",
    "p"."state",
    "p"."zip_code",
    "p"."node_id",
    "p"."profile_completed",
    "p"."onboarding_completed",
    "p"."phone_verified",
    "p"."phone_verified_at",
    "p"."referral_code",
    "p"."created_at",
    "p"."updated_at",
    "au"."email",
    "au"."phone",
    "au"."email_confirmed_at",
    "au"."last_sign_in_at",
    "au"."created_at" AS "auth_created_at"
   FROM ("public"."profiles" "p"
     LEFT JOIN "auth"."users" "au" ON (("au"."id" = "p"."user_id")));


ALTER VIEW "public"."profiles_with_auth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "device_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "push_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trade_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewee_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "is_anonymous" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_based_access_control" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_based_access_control" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_rate_limit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "user_id" "uuid",
    "sms_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    CONSTRAINT "sms_rate_limit_log_sms_type_check" CHECK (("sms_type" = ANY (ARRAY['verification_code'::"text", 'password_reset'::"text", 'notification'::"text"]))),
    CONSTRAINT "sms_rate_limit_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sms_rate_limit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_tiers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "price_monthly" numeric(8,2) DEFAULT 0.00,
    "max_active_listings" integer DEFAULT 3,
    "max_boost_listings" integer DEFAULT 0,
    "priority_support" boolean DEFAULT false,
    "early_access_features" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trades" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'initiated'::"text",
    "payment_method" "text" DEFAULT 'cash'::"text",
    "swap_points_used" integer DEFAULT 0,
    "price_cents" integer,
    "platform_fee_cents" integer DEFAULT 0,
    "node_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferred_radius_miles" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_preferences_preferred_radius_miles_check" CHECK (("preferred_radius_miles" >= 0))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "email" "text",
    "phone" "text",
    "bio" "text",
    "avatar_url" "text",
    "node_id" "uuid",
    "role" "text" DEFAULT 'user'::"text",
    "subscription_tier_id" "uuid",
    "swap_points_balance" integer DEFAULT 0,
    "lifetime_swap_points_earned" integer DEFAULT 0,
    "is_banned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "zip" "text" NOT NULL,
    "kids_count" integer,
    "kids_ages" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone,
    "converted_user_id" "uuid"
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zip_codes" (
    "zip" "text" NOT NULL,
    "node_id" "uuid" NOT NULL,
    "city" "text",
    "state" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."zip_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zip_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "requested_zip" "text" NOT NULL,
    "assigned_node_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "zip_waitlist_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'notified'::"text", 'joined'::"text"])))
);


ALTER TABLE "public"."zip_waitlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_config"
    ADD CONSTRAINT "admin_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."admin_config"
    ADD CONSTRAINT "admin_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_listing_actions"
    ADD CONSTRAINT "admin_listing_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_moderation_logs"
    ADD CONSTRAINT "ai_moderation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."boost_listings"
    ADD CONSTRAINT "boost_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cpsc_recalls"
    ADD CONSTRAINT "cpsc_recalls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_item_id_key" UNIQUE ("user_id", "item_id");



ALTER TABLE ONLY "public"."geographic_nodes"
    ADD CONSTRAINT "geographic_nodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."geographic_nodes"
    ADD CONSTRAINT "geographic_nodes_zip_code_unique" UNIQUE ("zip_code");



ALTER TABLE ONLY "public"."item_images"
    ADD CONSTRAINT "item_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_queue"
    ADD CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."phone_verification_codes"
    ADD CONSTRAINT "phone_verification_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_id_referee_id_key" UNIQUE ("referrer_id", "referee_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_trade_id_reviewer_id_key" UNIQUE ("trade_id", "reviewer_id");



ALTER TABLE ONLY "public"."role_based_access_control"
    ADD CONSTRAINT "role_based_access_control_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_based_access_control"
    ADD CONSTRAINT "role_based_access_control_user_id_role_unique" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."sms_rate_limit_log"
    ADD CONSTRAINT "sms_rate_limit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sp_wallets"
    ADD CONSTRAINT "sp_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sp_wallets"
    ADD CONSTRAINT "sp_wallets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zip_codes"
    ADD CONSTRAINT "zip_codes_pkey" PRIMARY KEY ("zip");



ALTER TABLE ONLY "public"."zip_waitlist"
    ADD CONSTRAINT "zip_waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zip_waitlist"
    ADD CONSTRAINT "zip_waitlist_unique" UNIQUE ("user_id", "requested_zip");



CREATE INDEX "idx_admin_audit_log_created_at" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_audit_log_entity_type" ON "public"."admin_audit_log" USING "btree" ("entity_type");



CREATE INDEX "idx_admin_config_category" ON "public"."admin_config" USING "btree" ("category");



CREATE INDEX "idx_admin_config_is_active" ON "public"."admin_config" USING "btree" ("is_active");



CREATE INDEX "idx_admin_config_key" ON "public"."admin_config" USING "btree" ("key");



CREATE INDEX "idx_admin_listing_actions_admin_id" ON "public"."admin_listing_actions" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_listing_actions_created_at" ON "public"."admin_listing_actions" USING "btree" ("created_at");



CREATE INDEX "idx_admin_listing_actions_listing_id" ON "public"."admin_listing_actions" USING "btree" ("listing_id");



CREATE INDEX "idx_auth_sessions_device_id" ON "public"."auth_sessions" USING "btree" ("device_id");



CREATE INDEX "idx_auth_sessions_expires_at" ON "public"."auth_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_auth_sessions_status" ON "public"."auth_sessions" USING "btree" ("status");



CREATE INDEX "idx_auth_sessions_user_id" ON "public"."auth_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_cpsc_recalls_keywords" ON "public"."cpsc_recalls" USING "gin" ("keywords");



CREATE INDEX "idx_cpsc_recalls_product_name_trgm" ON "public"."cpsc_recalls" USING "gin" ("product_name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_favorites_item_id" ON "public"."favorites" USING "btree" ("item_id");



CREATE INDEX "idx_favorites_user_id" ON "public"."favorites" USING "btree" ("user_id");



CREATE INDEX "idx_geographic_nodes_created_at" ON "public"."geographic_nodes" USING "btree" ("created_at");



CREATE INDEX "idx_geographic_nodes_is_active" ON "public"."geographic_nodes" USING "btree" ("is_active");



CREATE INDEX "idx_geographic_nodes_zip_code" ON "public"."geographic_nodes" USING "btree" ("zip_code");



CREATE INDEX "idx_item_images_display_order" ON "public"."item_images" USING "btree" ("item_id", "display_order");



CREATE INDEX "idx_item_images_item_id" ON "public"."item_images" USING "btree" ("item_id");



CREATE INDEX "idx_items_accepts_swap_points" ON "public"."items" USING "btree" ("accepts_swap_points") WHERE ("status" = 'available'::"text");



CREATE INDEX "idx_items_category_id" ON "public"."items" USING "btree" ("category_id");



CREATE INDEX "idx_items_created_at" ON "public"."items" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_items_seller_id" ON "public"."items" USING "btree" ("seller_id");



CREATE INDEX "idx_items_status" ON "public"."items" USING "btree" ("status");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_is_read" ON "public"."messages" USING "btree" ("is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_messages_recipient_id" ON "public"."messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_messages_trade_id" ON "public"."messages" USING "btree" ("trade_id");



CREATE INDEX "idx_moderation_queue_item_id" ON "public"."moderation_queue" USING "btree" ("item_id");



CREATE INDEX "idx_moderation_queue_status" ON "public"."moderation_queue" USING "btree" ("status");



CREATE INDEX "idx_nodes_city_state" ON "public"."nodes" USING "btree" ("city", "state");



CREATE INDEX "idx_nodes_is_active" ON "public"."nodes" USING "btree" ("is_active");



CREATE INDEX "idx_nodes_location" ON "public"."nodes" USING "gist" ("extensions"."st_makepoint"("longitude", "latitude"));



CREATE INDEX "idx_nodes_member_count" ON "public"."nodes" USING "btree" ("member_count" DESC);



CREATE INDEX "idx_nodes_updated_at" ON "public"."nodes" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_nodes_zip_code" ON "public"."nodes" USING "btree" ("zip_code");



CREATE INDEX "idx_password_reset_tokens_expires_at" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_password_reset_tokens_token" ON "public"."password_reset_tokens" USING "btree" ("token");



CREATE INDEX "idx_password_reset_tokens_user_id" ON "public"."password_reset_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_phone_verification_codes_created_at" ON "public"."phone_verification_codes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_phone_verification_codes_expires_at" ON "public"."phone_verification_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_phone_verification_codes_phone" ON "public"."phone_verification_codes" USING "btree" ("phone");



CREATE INDEX "idx_phone_verification_codes_user_id" ON "public"."phone_verification_codes" USING "btree" ("user_id");



CREATE INDEX "idx_points_transactions_created_at" ON "public"."points_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_points_transactions_user_id" ON "public"."points_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_created_at" ON "public"."profiles" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_profiles_dob" ON "public"."profiles" USING "btree" ("dob");



CREATE INDEX "idx_profiles_node_id" ON "public"."profiles" USING "btree" ("node_id");



CREATE INDEX "idx_profiles_onboarding_completed_at" ON "public"."profiles" USING "btree" ("onboarding_completed_at");



CREATE INDEX "idx_profiles_referral_code" ON "public"."profiles" USING "btree" ("referral_code");



CREATE INDEX "idx_profiles_referred_by" ON "public"."profiles" USING "btree" ("referred_by");



CREATE INDEX "idx_profiles_sp_wallet_id" ON "public"."profiles" USING "btree" ("sp_wallet_id");



CREATE INDEX "idx_profiles_subscription_id" ON "public"."profiles" USING "btree" ("subscription_id");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_push_tokens_created_at" ON "public"."push_tokens" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_push_tokens_device_id" ON "public"."push_tokens" USING "btree" ("device_id");



CREATE INDEX "idx_push_tokens_token" ON "public"."push_tokens" USING "btree" ("token");



CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_referrals_created_at" ON "public"."referrals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reviews_reviewee_id" ON "public"."reviews" USING "btree" ("reviewee_id");



CREATE INDEX "idx_reviews_trade_id" ON "public"."reviews" USING "btree" ("trade_id");



CREATE INDEX "idx_role_based_access_control_role" ON "public"."role_based_access_control" USING "btree" ("role");



CREATE INDEX "idx_role_based_access_control_user_id" ON "public"."role_based_access_control" USING "btree" ("user_id");



CREATE INDEX "idx_sms_rate_limit_log_phone" ON "public"."sms_rate_limit_log" USING "btree" ("phone");



CREATE INDEX "idx_sms_rate_limit_log_sent_at" ON "public"."sms_rate_limit_log" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_sms_rate_limit_log_sms_type" ON "public"."sms_rate_limit_log" USING "btree" ("sms_type");



CREATE INDEX "idx_sms_rate_limit_log_user_id" ON "public"."sms_rate_limit_log" USING "btree" ("user_id");



CREATE INDEX "idx_sp_wallets_status" ON "public"."sp_wallets" USING "btree" ("status");



CREATE INDEX "idx_sp_wallets_user_id" ON "public"."sp_wallets" USING "btree" ("user_id");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_trades_buyer_id" ON "public"."trades" USING "btree" ("buyer_id");



CREATE INDEX "idx_trades_created_at" ON "public"."trades" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_trades_item_id" ON "public"."trades" USING "btree" ("item_id");



CREATE INDEX "idx_trades_seller_id" ON "public"."trades" USING "btree" ("seller_id");



CREATE INDEX "idx_trades_status" ON "public"."trades" USING "btree" ("status");



CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_node_id" ON "public"."users" USING "btree" ("node_id");



CREATE INDEX "idx_users_phone" ON "public"."users" USING "btree" ("phone");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_waitlist_created_at" ON "public"."waitlist" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_waitlist_email" ON "public"."waitlist" USING "btree" ("email");



CREATE INDEX "idx_waitlist_phone" ON "public"."waitlist" USING "btree" ("phone");



CREATE INDEX "idx_waitlist_zip" ON "public"."waitlist" USING "btree" ("zip");



CREATE INDEX "idx_zip_codes_city_state" ON "public"."zip_codes" USING "btree" ("city", "state");



CREATE INDEX "idx_zip_codes_node_id" ON "public"."zip_codes" USING "btree" ("node_id");



CREATE INDEX "idx_zip_waitlist_created_at" ON "public"."zip_waitlist" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_zip_waitlist_requested_zip" ON "public"."zip_waitlist" USING "btree" ("requested_zip");



CREATE INDEX "idx_zip_waitlist_status" ON "public"."zip_waitlist" USING "btree" ("status");



CREATE INDEX "idx_zip_waitlist_user_id" ON "public"."zip_waitlist" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "admin_config_updated_at_trigger" BEFORE UPDATE ON "public"."admin_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_admin_config_timestamp"();



CREATE OR REPLACE TRIGGER "items_updated_at_trigger" BEFORE UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."update_items_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at_trigger" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "push_tokens_updated_at_trigger" BEFORE UPDATE ON "public"."push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_tokens_updated_at"();



CREATE OR REPLACE TRIGGER "set_message_expiration_after_trade_complete" AFTER UPDATE ON "public"."trades" FOR EACH ROW EXECUTE FUNCTION "public"."set_message_expiration"();



CREATE OR REPLACE TRIGGER "sp_wallets_updated_at_trigger" BEFORE UPDATE ON "public"."sp_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_sp_wallets_updated_at"();



CREATE OR REPLACE TRIGGER "subscriptions_updated_at_trigger" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_subscriptions_updated_at"();



CREATE OR REPLACE TRIGGER "sync_points_balance_after_insert" AFTER INSERT ON "public"."points_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_points_balance"();



CREATE OR REPLACE TRIGGER "trigger_generate_referral_code_on_profile_creation" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."generate_referral_code_on_profile_creation"();



CREATE OR REPLACE TRIGGER "trigger_process_referral_bonus_on_trade" AFTER INSERT OR UPDATE OF "status" ON "public"."trades" FOR EACH ROW WHEN (("new"."status" = 'completed'::"text")) EXECUTE FUNCTION "public"."process_referral_bonus_on_trade"();



CREATE OR REPLACE TRIGGER "update_cpsc_recalls_updated_at" BEFORE UPDATE ON "public"."cpsc_recalls" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_favorites_count_after_delete" AFTER DELETE ON "public"."favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_favorites_count"();



CREATE OR REPLACE TRIGGER "update_favorites_count_after_insert" AFTER INSERT ON "public"."favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_favorites_count"();



CREATE OR REPLACE TRIGGER "update_nodes_updated_at" BEFORE UPDATE ON "public"."nodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trades_updated_at" BEFORE UPDATE ON "public"."trades" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_preferences_updated_at_trigger" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_preferences_updated_at"();



ALTER TABLE ONLY "public"."admin_listing_actions"
    ADD CONSTRAINT "admin_listing_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_listing_actions"
    ADD CONSTRAINT "admin_listing_actions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boost_listings"
    ADD CONSTRAINT "fk_boost_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "fk_favorites_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "fk_messages_recipient_id" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "fk_messages_sender_id" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "fk_messages_trade_id" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_queue"
    ADD CONSTRAINT "fk_mod_reporter" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "fk_points_transactions_trade_id" FOREIGN KEY ("related_trade_id") REFERENCES "public"."trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "fk_points_transactions_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_node_id" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "fk_referrals_referee" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "fk_referrals_referrer" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "fk_reviews_reviewee_id" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "fk_reviews_reviewer_id" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "fk_reviews_trade_id" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "fk_trades_buyer_id" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "fk_trades_seller_id" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "fk_users_node_id" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "fk_users_subscription_tier_id" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_images"
    ADD CONSTRAINT "item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_verification_codes"
    ADD CONSTRAINT "phone_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_sp_wallet_id_fkey" FOREIGN KEY ("sp_wallet_id") REFERENCES "public"."sp_wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_based_access_control"
    ADD CONSTRAINT "role_based_access_control_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_rate_limit_log"
    ADD CONSTRAINT "sms_rate_limit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sp_wallets"
    ADD CONSTRAINT "sp_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_converted_user_id_fkey" FOREIGN KEY ("converted_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zip_codes"
    ADD CONSTRAINT "zip_codes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."zip_waitlist"
    ADD CONSTRAINT "zip_waitlist_assigned_node_id_fkey" FOREIGN KEY ("assigned_node_id") REFERENCES "public"."nodes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zip_waitlist"
    ADD CONSTRAINT "zip_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can manage geographic nodes" ON "public"."geographic_nodes" USING ((EXISTS ( SELECT 1
   FROM "public"."role_based_access_control"
  WHERE (("role_based_access_control"."user_id" = "auth"."uid"()) AND (("role_based_access_control"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can delete items" ON "public"."items" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage listing actions" ON "public"."admin_listing_actions" USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "auth"."users"
  WHERE (("users"."raw_user_meta_data" ->> 'is_admin'::"text") = 'true'::"text"))));



CREATE POLICY "Admins can manage nodes" ON "public"."nodes" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage queue" ON "public"."moderation_queue" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage recalls" ON "public"."cpsc_recalls" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage tiers" ON "public"."subscription_tiers" USING ("public"."is_admin"());



CREATE POLICY "Admins can update all users" ON "public"."users" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update items" ON "public"."items" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view AI logs" ON "public"."ai_moderation_logs" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all boosts" ON "public"."boost_listings" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all items" ON "public"."items" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all push tokens" ON "public"."push_tokens" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Admins can view all trades" ON "public"."trades" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all transactions" ON "public"."points_transactions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all users" ON "public"."users" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view messages" ON "public"."messages" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view moderation queue" ON "public"."moderation_queue" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view waitlist" ON "public"."waitlist" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow phone verification updates" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (("auth"."role"() = 'anon'::"text") AND ("user_id" IS NOT NULL)))) WITH CHECK ((("auth"."uid"() = "user_id") OR (("auth"."role"() = 'anon'::"text") AND ("user_id" IS NOT NULL))));



CREATE POLICY "Anyone can join waitlist" ON "public"."waitlist" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view categories" ON "public"."categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view item images" ON "public"."item_images" FOR SELECT USING (true);



CREATE POLICY "Public can read active nodes" ON "public"."geographic_nodes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view available items" ON "public"."items" FOR SELECT USING (("status" = 'available'::"text"));



CREATE POLICY "Public profiles are viewable" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read admin config" ON "public"."admin_config" FOR SELECT USING (true);



CREATE POLICY "Sellers can delete own items" ON "public"."items" FOR DELETE USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Sellers can update own items" ON "public"."items" FOR UPDATE USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Sellers can view own items" ON "public"."items" FOR SELECT USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "Service role can update profiles" ON "public"."profiles" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "System can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert verification codes" ON "public"."phone_verification_codes" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can update verification codes" ON "public"."phone_verification_codes" FOR UPDATE USING (true);



CREATE POLICY "Users can delete their own push tokens" ON "public"."push_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own verification codes" ON "public"."phone_verification_codes" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert images for own items" ON "public"."item_images" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."items"
  WHERE (("items"."id" = "item_images"."item_id") AND ("items"."seller_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own items" ON "public"."items" FOR INSERT WITH CHECK (("auth"."uid"() = "seller_id"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own subscription" ON "public"."subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own wallet" ON "public"."sp_wallets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((("auth"."uid"() IS NULL) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can insert their own push tokens" ON "public"."push_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can revoke their own sessions" ON "public"."auth_sessions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own push tokens" ON "public"."push_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own wallet" ON "public"."sp_wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own push tokens" ON "public"."push_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own reset tokens" ON "public"."password_reset_tokens" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own sessions" ON "public"."auth_sessions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own verification codes" ON "public"."phone_verification_codes" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "admin_config_delete_service_role" ON "public"."admin_config" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "admin_config_insert_service_role" ON "public"."admin_config" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "admin_config_select_all" ON "public"."admin_config" FOR SELECT USING (true);



CREATE POLICY "admin_config_update_service_role" ON "public"."admin_config" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."admin_listing_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_logs_admin_select" ON "public"."ai_moderation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "ai_logs_system_create" ON "public"."ai_moderation_logs" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."ai_moderation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boost_admin_select" ON "public"."boost_listings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "boost_insert" ON "public"."boost_listings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."boost_listings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boost_select_own" ON "public"."boost_listings" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cpsc_admin_manage" ON "public"."cpsc_recalls" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "cpsc_public_select" ON "public"."cpsc_recalls" FOR SELECT USING (true);



ALTER TABLE "public"."cpsc_recalls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorites_manage_own" ON "public"."favorites" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "favorites_select_own" ON "public"."favorites" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."geographic_nodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_sender" ON "public"."messages" FOR INSERT WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_select_own" ON "public"."messages" FOR SELECT USING ((("sender_id" = "auth"."uid"()) OR ("recipient_id" = "auth"."uid"())));



CREATE POLICY "messages_update_sender" ON "public"."messages" FOR UPDATE USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "moderation_admin_manage" ON "public"."moderation_queue" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "moderation_admin_select" ON "public"."moderation_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "moderation_insert_report" ON "public"."moderation_queue" FOR INSERT WITH CHECK (("reported_by" = "auth"."uid"()));



ALTER TABLE "public"."moderation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nodes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nodes_admin_manage" ON "public"."nodes" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "nodes_public_active" ON "public"."nodes" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_verification_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "points_transactions_admin_select" ON "public"."points_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "points_transactions_create_system" ON "public"."points_transactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "points_transactions_select_own" ON "public"."points_transactions" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referrals_insert" ON "public"."referrals" FOR INSERT WITH CHECK (("referrer_id" = "auth"."uid"()));



CREATE POLICY "referrals_select_own" ON "public"."referrals" FOR SELECT USING ((("referrer_id" = "auth"."uid"()) OR ("referee_id" = "auth"."uid"())));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_insert" ON "public"."reviews" FOR INSERT WITH CHECK (("reviewer_id" = "auth"."uid"()));



CREATE POLICY "reviews_public_non_anonymous" ON "public"."reviews" FOR SELECT USING (("is_anonymous" = false));



CREATE POLICY "reviews_select_own" ON "public"."reviews" FOR SELECT USING ((("reviewer_id" = "auth"."uid"()) OR ("reviewee_id" = "auth"."uid"())));



ALTER TABLE "public"."sp_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_tiers_admin" ON "public"."subscription_tiers" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "subscription_tiers_public" ON "public"."subscription_tiers" FOR SELECT USING (true);



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trades_admin_select" ON "public"."trades" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "trades_insert_own" ON "public"."trades" FOR INSERT WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "trades_select_own" ON "public"."trades" FOR SELECT USING ((("buyer_id" = "auth"."uid"()) OR ("seller_id" = "auth"."uid"())));



CREATE POLICY "trades_update_own" ON "public"."trades" FOR UPDATE USING ((("buyer_id" = "auth"."uid"()) OR ("seller_id" = "auth"."uid"())));



ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_self" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_self" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zip_waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zip_waitlist_admin_all" ON "public"."zip_waitlist" USING (( SELECT "public"."is_admin"("auth"."uid"()) AS "is_admin"));



CREATE POLICY "zip_waitlist_user_insert" ON "public"."zip_waitlist" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "zip_waitlist_user_select" ON "public"."zip_waitlist" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "zip_waitlist_user_update" ON "public"."zip_waitlist" FOR UPDATE USING (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_force_delete_listing"("p_listing_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_force_delete_listing"("p_listing_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_force_delete_listing"("p_listing_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_pause_listing"("p_listing_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_pause_listing"("p_listing_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_pause_listing"("p_listing_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_unpause_listing"("p_listing_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_unpause_listing"("p_listing_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_unpause_listing"("p_listing_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_node_by_zip"("p_zip" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_node_by_zip"("p_zip" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_node_by_zip"("p_zip" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_node_distance"("node1_id" "uuid", "node2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_node_distance"("node1_id" "uuid", "node2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_node_distance"("node1_id" "uuid", "node2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_points_balance"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_points_balance"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_points_balance"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_phone_verification_status"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_phone_verification_status"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_phone_verification_status"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_sms_rate_limit"("p_phone" "text", "p_max_per_hour" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_sms_rate_limit"("p_phone" "text", "p_max_per_hour" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_sms_rate_limit"("p_phone" "text", "p_max_per_hour" integer) TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_trial_subscription"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_trial_subscription"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_trial_subscription"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_auth_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_auth_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_auth_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_node_member_count"("node_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_node_member_count"("node_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_node_member_count"("node_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_referral_code_on_profile_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_referral_code_on_profile_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_referral_code_on_profile_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearest_node"("user_lat" numeric, "user_lng" numeric, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearest_node"("user_lat" numeric, "user_lng" numeric, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearest_node"("user_lat" numeric, "user_lng" numeric, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nodes_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nodes_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nodes_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_subscription_summary"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_subscription_summary"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_subscription_summary"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trial_duration_days"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_trial_duration_days"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trial_duration_days"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_rating"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_rating"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_rating"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_sp_wallet_summary"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_sp_wallet_summary"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_sp_wallet_summary"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_trade_count"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_trade_count"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_trade_count"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_node_member_count"("node_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_node_member_count"("node_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_node_member_count"("node_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_verification_attempts"("p_user_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_verification_attempts"("p_user_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_verification_attempts"("p_user_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."sp_wallets" TO "anon";
GRANT ALL ON TABLE "public"."sp_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."sp_wallets" TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_sp_wallet"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_sp_wallet"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_sp_wallet"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("p_uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("p_uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_trial_enabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_trial_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_trial_enabled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_referral_claimed"("p_referred_user_id" "uuid", "p_referral_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_referral_claimed"("p_referred_user_id" "uuid", "p_referral_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_referral_claimed"("p_referred_user_id" "uuid", "p_referral_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_referral_bonus"("p_referred_user_id" "uuid", "p_referral_code" "text", "p_bonus_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_referral_bonus"("p_referred_user_id" "uuid", "p_referral_code" "text", "p_bonus_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_referral_bonus"("p_referred_user_id" "uuid", "p_referral_code" "text", "p_bonus_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_referral_bonus_on_trade"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_referral_bonus_on_trade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_referral_bonus_on_trade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_active_node_for_signup"("requested_zip" "text", "user_lat" double precision, "user_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_active_node_for_signup"("requested_zip" "text", "user_lat" double precision, "user_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_active_node_for_signup"("requested_zip" "text", "user_lat" double precision, "user_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_session"("p_user_id" "uuid", "p_device_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_session"("p_user_id" "uuid", "p_device_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_session"("p_user_id" "uuid", "p_device_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_message_expiration"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_message_expiration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_message_expiration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_points_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_points_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_points_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_admin_config_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_admin_config_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_admin_config_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_admin_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_admin_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_admin_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_favorites_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_favorites_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_favorites_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_push_tokens_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_push_tokens_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_push_tokens_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sp_wallets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sp_wallets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sp_wallets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subscriptions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_subscriptions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subscriptions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upgrade_free_subscription_to_trial"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upgrade_free_subscription_to_trial"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upgrade_free_subscription_to_trial"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_admin_config_setting"("p_key" "text", "p_value" "text", "p_category" "public"."admin_config_category", "p_data_type" "text", "p_is_secret" boolean, "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_admin_config_setting"("p_key" "text", "p_value" "text", "p_category" "public"."admin_config_category", "p_data_type" "text", "p_is_secret" boolean, "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_admin_config_setting"("p_key" "text", "p_value" "text", "p_category" "public"."admin_config_category", "p_data_type" "text", "p_is_secret" boolean, "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_phone_code"("p_user_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_phone_code"("p_user_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_phone_code"("p_user_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_user_phone"("p_user_id" "uuid", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_user_phone"("p_user_id" "uuid", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_user_phone"("p_user_id" "uuid", "p_phone" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_config" TO "anon";
GRANT ALL ON TABLE "public"."admin_config" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."admin_listing_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_listing_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_listing_actions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_moderation_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_moderation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_moderation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."auth_sessions" TO "anon";
GRANT ALL ON TABLE "public"."auth_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."boost_listings" TO "anon";
GRANT ALL ON TABLE "public"."boost_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."boost_listings" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."cpsc_recalls" TO "anon";
GRANT ALL ON TABLE "public"."cpsc_recalls" TO "authenticated";
GRANT ALL ON TABLE "public"."cpsc_recalls" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."geographic_nodes" TO "anon";
GRANT ALL ON TABLE "public"."geographic_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."geographic_nodes" TO "service_role";



GRANT ALL ON TABLE "public"."item_images" TO "anon";
GRANT ALL ON TABLE "public"."item_images" TO "authenticated";
GRANT ALL ON TABLE "public"."item_images" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."items_with_node_info" TO "anon";
GRANT ALL ON TABLE "public"."items_with_node_info" TO "authenticated";
GRANT ALL ON TABLE "public"."items_with_node_info" TO "service_role";



GRANT ALL ON TABLE "public"."listing_admin_analytics" TO "anon";
GRANT ALL ON TABLE "public"."listing_admin_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_admin_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_queue" TO "anon";
GRANT ALL ON TABLE "public"."moderation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."nodes" TO "anon";
GRANT ALL ON TABLE "public"."nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."nodes" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."phone_verification_codes" TO "anon";
GRANT ALL ON TABLE "public"."phone_verification_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_verification_codes" TO "service_role";



GRANT ALL ON TABLE "public"."points_transactions" TO "anon";
GRANT ALL ON TABLE "public"."points_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."points_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_with_auth" TO "anon";
GRANT ALL ON TABLE "public"."profiles_with_auth" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_with_auth" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."role_based_access_control" TO "anon";
GRANT ALL ON TABLE "public"."role_based_access_control" TO "authenticated";
GRANT ALL ON TABLE "public"."role_based_access_control" TO "service_role";



GRANT ALL ON TABLE "public"."sms_rate_limit_log" TO "anon";
GRANT ALL ON TABLE "public"."sms_rate_limit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_rate_limit_log" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."trades" TO "anon";
GRANT ALL ON TABLE "public"."trades" TO "authenticated";
GRANT ALL ON TABLE "public"."trades" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."zip_codes" TO "anon";
GRANT ALL ON TABLE "public"."zip_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."zip_codes" TO "service_role";



GRANT ALL ON TABLE "public"."zip_waitlist" TO "anon";
GRANT ALL ON TABLE "public"."zip_waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."zip_waitlist" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







