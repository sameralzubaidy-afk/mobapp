-- Promote a user to admin (safe & robust: avoids selecting non-existing columns)
-- Run in Supabase SQL Editor with service_role privileges
-- Usage: set v_user_id and v_email below, then run. Optionally set password (dev only).

DO $$
DECLARE
  v_user_id uuid := '1a546991-5361-4b4e-b44b-eee9bf730757';
  v_email text := 'samer@samer.com';
  v_password text := 'samer'; -- Temporary dev password. Rotate immediately after use.
  v_name text := 'Samer';
  v_phone text := NULL; -- optionally set phone
  v_node_name text := NULL; -- optionally set node name to assign
  v_node_id uuid := NULL;
  v_auth_exists boolean := false;
  created_by_function boolean := false;
  cols text := '';
  col_rec record;
  insert_sql text;
  upsert_sql text;
  select_sql text;
  user_json jsonb;
BEGIN
  -- Optional: resolve node id if node name provided
  IF v_node_name IS NOT NULL THEN
    SELECT id INTO v_node_id FROM public.nodes WHERE name ILIKE v_node_name LIMIT 1;
    IF v_node_id IS NULL THEN
      RAISE NOTICE 'Node "%" not found; node assignment skipped.', v_node_name;
    ELSE
      RAISE NOTICE 'Node id found: %', v_node_id;
    END IF;
  END IF;

  -- Show columns on public.users for debugging
  RAISE NOTICE 'public.users columns:';
  FOR col_rec IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  - %', col_rec.column_name;
  END LOOP;

  -- Check if auth user exists (id or email)
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id OR email = v_email) INTO v_auth_exists;
  IF v_auth_exists THEN
    RAISE NOTICE 'Auth user exists in auth.users (id or email matched).';
  ELSE
    RAISE NOTICE 'Auth user does not exist. Attempting to create via available auth.*create_user functions...';
    -- Try to call auth.create_user style functions if present
    FOR col_rec IN
      SELECT p.proname, pg_get_function_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'auth' AND p.proname ILIKE '%create_user%'
    LOOP
      BEGIN
        RAISE NOTICE 'Trying auth.% with args: %', col_rec.proname, col_rec.args;
        -- Try a JSON payload approach if the function accepts a single JSON argument
        BEGIN
          EXECUTE format('SELECT auth.%I($1::json)', col_rec.proname)
          USING json_build_object('id', v_user_id, 'email', v_email, 'password', v_password, 'phone', v_phone, 'raw_user_meta_data', json_build_object('name', v_name));
          created_by_function := true;
          EXIT;
        EXCEPTION WHEN OTHERS THEN
          -- Continue trying other signatures
        END;
        -- Try a common signature (email, password, boolean)
        BEGIN
          EXECUTE format('SELECT auth.%I($1::text, $2::text, $3::boolean)', col_rec.proname) USING v_email, v_password, true;
          created_by_function := true;
          EXIT;
        EXCEPTION WHEN OTHERS THEN
          -- Continue
        END;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'auth.% raised error: %', col_rec.proname, SQLERRM;
      END;
    END LOOP;

    IF NOT created_by_function THEN
      -- Fallback: attempt direct insert into auth.users if pgcrypto is available.
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        BEGIN
          INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
          VALUES (
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            crypt(v_password, gen_salt('bf')),
            now(),
            json_build_object('name', v_name),
            now(),
            now()
          );
          RAISE NOTICE 'Inserted auth.users row via direct insertion (pgcrypto).';
          v_auth_exists := true;
        EXCEPTION WHEN unique_violation THEN
          RAISE NOTICE 'Direct insert failed: unique violation - perhaps created concurrently.';
          v_auth_exists := true;
        WHEN OTHERS THEN
          RAISE NOTICE 'Direct insert into auth.users failed: %', SQLERRM;
        END;
      ELSE
        RAISE NOTICE 'pgcrypto not installed and no auth.create_user function available; cannot create auth user via SQL. Please use Admin API or Supabase Dashboard.';
      END IF;
    END IF;
  END IF;

  -- Build dynamic column list for public.users (columns we may include in insert/upsert)
  cols := '';
  FOR col_rec IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('id','email','phone','name','role','is_banned','points_balance','subscription_tier_id','node_id','created_at','updated_at')
    ORDER BY ordinal_position
  LOOP
    IF cols = '' THEN
      cols := col_rec.column_name;
    ELSE
      cols := cols || ', ' || col_rec.column_name;
    END IF;
  END LOOP;

  IF cols = '' THEN
    RAISE EXCEPTION 'public.users table has no expected columns (id/email/role/etc). Aborting.';
  END IF;

  RAISE NOTICE 'Columns to use for upsert: %', cols;

  -- Build values for insert based on columns
  -- We'll include literal values for known columns; others we'll insert defaults via NULL
  insert_sql := 'INSERT INTO public.users (' || cols || ') VALUES (';
  FOR col_rec IN
    SELECT unnest(string_to_array(cols, ', ')) AS col
  LOOP
    IF col_rec.col = 'id' THEN
      insert_sql := insert_sql || quote_literal(v_user_id);
    ELSIF col_rec.col = 'email' THEN
      insert_sql := insert_sql || quote_literal(v_email);
    ELSIF col_rec.col = 'phone' THEN
      insert_sql := insert_sql || coalesce(quote_literal(v_phone), 'NULL');
    ELSIF col_rec.col = 'name' THEN
      insert_sql := insert_sql || quote_literal(v_name);
    ELSIF col_rec.col = 'role' THEN
      insert_sql := insert_sql || quote_literal('admin');
    ELSIF col_rec.col = 'is_banned' THEN
      insert_sql := insert_sql || 'false';
    ELSIF col_rec.col = 'points_balance' THEN
      insert_sql := insert_sql || '0';
    ELSIF col_rec.col = 'subscription_tier_id' THEN
      insert_sql := insert_sql || 'NULL';
    ELSIF col_rec.col = 'node_id' THEN
      IF v_node_id IS NOT NULL THEN
        insert_sql := insert_sql || quote_literal(v_node_id::text);
      ELSE
        insert_sql := insert_sql || 'NULL';
      END IF;
    ELSIF col_rec.col = 'created_at' THEN
      insert_sql := insert_sql || 'now()';
    ELSIF col_rec.col = 'updated_at' THEN
      insert_sql := insert_sql || 'now()';
    ELSE
      insert_sql := insert_sql || 'NULL';
    END IF;
    insert_sql := insert_sql || ', ';
  END LOOP;
  -- Remove trailing comma and space
  insert_sql := left(insert_sql, length(insert_sql) - 2);
  insert_sql := insert_sql || ') ';

  -- Build ON CONFLICT update clause: ensure role=admin and update some fields
  upsert_sql := 'ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role';
  -- Optionally update email/phone/name if present
  IF position('email' in cols) > 0 THEN
    upsert_sql := upsert_sql || ', email = EXCLUDED.email';
  END IF;
  IF position('phone' in cols) > 0 THEN
    upsert_sql := upsert_sql || ', phone = EXCLUDED.phone';
  END IF;
  IF position('name' in cols) > 0 THEN
    upsert_sql := upsert_sql || ', name = COALESCE(EXCLUDED.name, public.users.name)';
  END IF;
  upsert_sql := upsert_sql || ', updated_at = now()';

  -- Put together final SQL
  insert_sql := insert_sql || upsert_sql || ' RETURNING id';

  RAISE NOTICE 'Upsert SQL: %', insert_sql;
  BEGIN
    EXECUTE insert_sql INTO col_rec;
    IF FOUND THEN
      RAISE NOTICE 'Upserted/updated public.users row (id=%).', col_rec.id;
    ELSE
      RAISE NOTICE 'Upsert did not insert or update a row - check constraints or RLS.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Upsert failed: %', SQLERRM;
  END;

  -- Compose a dynamic SELECT for the row and print as json
  select_sql := format('SELECT row_to_json(t) FROM (SELECT %s FROM public.users WHERE id = %L) t', cols, v_user_id::text);
  RAISE NOTICE 'Select SQL: %', select_sql;
  BEGIN
    EXECUTE select_sql INTO user_json;
    IF user_json IS NULL THEN
      RAISE NOTICE 'No public.users row found for id %', v_user_id;
    ELSE
      RAISE NOTICE 'public.users row for id %: %', v_user_id, user_json;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Select failed: %', SQLERRM;
  END;

  -- Show the auth.users row too (dynamic select of common columns)
  RAISE NOTICE 'auth.users (id, email, phone, created_at):';
  FOR col_rec IN SELECT id, email, phone, created_at FROM auth.users WHERE id = v_user_id OR email = v_email LOOP
    RAISE NOTICE '  % | % | % | %', col_rec.id, col_rec.email, col_rec.phone, col_rec.created_at;
  END LOOP;

  RAISE NOTICE 'Promote script completed. Please verify auth and public.users rows and rotate the password ASAP.';
END$$ LANGUAGE plpgsql;

-- NOTES:
-- 1) The script avoids referencing specific columns directly; it dynamically finds columns available in public.users and uses them.
-- 2) If the auth user still does not exist, create it via the Supabase Admin API or UI.
-- 3) Use the Supabase SQL Editor as an admin (service_role) to run this.
