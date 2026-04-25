-- ================================================================
-- Migration: 20260425000004_enable_realtime_core_tables.sql
-- Module: MODULE-14 Notifications / Auth Realtime stability
-- Description:
--   Ensure core app tables are included in supabase_realtime publication
--   for wallet/subscription/profile/notification channel listeners.
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- BLOCK 1 - Publication membership updates
-- ================================================================

DO $$
DECLARE
  v_schema_name TEXT := 'public';
  v_table_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    WHERE p.pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Publication % does not exist', 'supabase_realtime';
  END IF;

  FOREACH v_table_name IN ARRAY ARRAY[
    'user_notifications',
    'subscriptions',
    'sp_wallets',
    'profiles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_schema_name
        AND c.relname = v_table_name
        AND c.relkind = 'r'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables ppt
        WHERE ppt.pubname = 'supabase_realtime'
          AND ppt.schemaname = v_schema_name
          AND ppt.tablename = v_table_name
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',
          v_schema_name,
          v_table_name
        );
      END IF;
    ELSE
      RAISE NOTICE 'Skipping %.% (table not found)', v_schema_name, v_table_name;
    END IF;
  END LOOP;
END;
$$;

-- ================================================================
-- BLOCK 2 - Verification queries
-- ================================================================

-- 1) Publication includes required tables
-- SELECT ppt.schemaname, ppt.tablename
-- FROM pg_publication_tables ppt
-- WHERE ppt.pubname = 'supabase_realtime'
--   AND ppt.schemaname = 'public'
--   AND ppt.tablename IN ('user_notifications', 'subscriptions', 'sp_wallets', 'profiles')
-- ORDER BY ppt.tablename;

-- 2) Missing membership check (should return zero rows)
-- WITH v_required AS (
--   SELECT unnest(ARRAY['user_notifications', 'subscriptions', 'sp_wallets', 'profiles']) AS table_name
-- )
-- SELECT vr.table_name AS missing_table
-- FROM v_required vr
-- LEFT JOIN pg_publication_tables ppt
--   ON ppt.pubname = 'supabase_realtime'
--  AND ppt.schemaname = 'public'
--  AND ppt.tablename = vr.table_name
-- WHERE ppt.tablename IS NULL;

-- 3) Optional realtime table inventory
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
-- ORDER BY schemaname, tablename;

-- Common failure modes:
-- 1) Publication missing in the target environment (self-hosted misconfiguration).
-- 2) Table not found because prior migrations were not applied yet.
-- 3) Running statements directly without idempotent guard causes duplicate-object errors.
