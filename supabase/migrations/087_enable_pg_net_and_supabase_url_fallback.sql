-- ================================================================
-- Migration: 087_enable_pg_net_and_supabase_url_fallback.sql
-- Module: MODULE-07 MSG-006 - Push Notifications for New Messages
-- Description:
--   1) Ensure pg_net is enabled (required for net.http_post)
--   2) Add a robust fallback for resolving Supabase URL:
--      - Prefer current_setting('app.supabase_url', true)
--      - Fallback to admin_config key 'supabase_url'
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1 — Schema
-- ================================================================

-- 1) Enable pg_net extension (creates schema net + functions like net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Optional: seed Supabase URL in admin_config (preferred over DB GUC)
-- NOTE: Replace the value with your real project URL.
-- This is safe to keep non-secret.
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'supabase_url',
  'https://<PROJECT_REF>.supabase.co',
  'Supabase project URL used by DB triggers to call Edge Functions',
  'feature_flags',
  'string',
  false,
  true
)
ON CONFLICT (key) DO NOTHING;

-- 3) Update trigger function to use the fallback
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade public.trades;
  v_recipient_id uuid;
  v_sender_profile public.profiles;
  v_supabase_url text;
BEGIN
  SELECT * INTO v_trade
  FROM public.trades
  WHERE public.trades.id = NEW.trade_id;

  IF NOT FOUND THEN
    RAISE WARNING 'notify_new_message: trade not found for trade_id=%', NEW.trade_id;
    RETURN NEW;
  END IF;

  IF NEW.sender_id = v_trade.buyer_id THEN
    v_recipient_id := v_trade.seller_id;
  ELSE
    v_recipient_id := v_trade.buyer_id;
  END IF;

  SELECT * INTO v_sender_profile
  FROM public.profiles
  WHERE public.profiles.user_id = NEW.sender_id;

  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'notify_new_message: pg_net not installed (net.http_post missing); skipping push';
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.supabase_url', true);

  IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
    SELECT ac.value INTO v_supabase_url
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_url'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
    RAISE WARNING 'notify_new_message: Supabase URL not configured (app.supabase_url or admin_config.supabase_url); skipping push';
    RETURN NEW;
  END IF;

  -- Normalize to avoid double slashes
  v_supabase_url := rtrim(v_supabase_url, '/');

  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'userId', v_recipient_id,
        'title', 'New message from ' || COALESCE(v_sender_profile.name, 'Someone'),
        'body', substring(NEW.content, 1, 100),
        'data', jsonb_build_object(
          'type', 'message',
          'tradeId', NEW.trade_id,
          'messageId', NEW.id
        ),
        'priority', 'high'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notify_new_message: push http_post failed for message_id=%: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- BLOCK 2 — Verification
-- ================================================================

-- 1) pg_net installed
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';

-- 2) Supabase URL resolvable via either method
-- SELECT current_setting('app.supabase_url', true) AS app_supabase_url;
-- SELECT key, value, is_active FROM public.admin_config WHERE key = 'supabase_url';

-- 3) Trigger still enabled and points to notify_new_message()
-- SELECT tgname, tgenabled, tgrelid::regclass, tgfoid::regprocedure
-- FROM pg_trigger
-- WHERE tgname = 'on_message_insert_notify';

-- 4) Smoke test
-- INSERT INTO public.messages (id, trade_id, sender_id, content, created_at)
-- VALUES (gen_random_uuid(), '<TRADE_ID>', '<SENDER_ID>', 'Push smoke test', NOW());
