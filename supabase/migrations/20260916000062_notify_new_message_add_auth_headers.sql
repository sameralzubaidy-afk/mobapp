-- ================================================================
-- Migration: 088_notify_new_message_add_auth_headers.sql
-- Module: MODULE-07 MSG-006 - Push Notifications for New Messages
-- Description:
--   Fix missing Edge Function invocations by including required
--   authentication headers (Authorization + apikey) in net.http_post.
--
--   Supabase Edge Functions verify JWT by default. When the DB trigger
--   calls /functions/v1/send-push-notification without headers, the
--   request is typically rejected before the function executes, so you
--   see no function logs.
--
--   This migration:
--     1) Uses existing Supabase URL resolution (DB setting or admin_config)
--     2) Resolves an auth JWT (prefers admin_config 'supabase_anon_key',
--        optionally 'supabase_service_role_key')
--     3) Adds headers so the function actually runs.
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- Optional: seed supabase_anon_key (recommended)
-- NOTE: Replace the value with your project's anon key (JWT).
-- The anon key is publishable, but still treat it as sensitive in docs.
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'supabase_anon_key',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<REPLACE_ME>',
  'Supabase anon JWT used by DB triggers to call Edge Functions (Authorization/apikey)',
  'feature_flags',
  'string',
  false,
  true
)
ON CONFLICT (key) DO NOTHING;

-- Optional: seed service role key (NOT recommended in DB unless you fully trust RLS)
-- If you do add it, set is_secret=true and lock down admin_config RLS.
-- INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
-- VALUES (
--   'supabase_service_role_key',
--   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<REPLACE_ME>',
--   'Supabase service role JWT for server-only use',
--   'feature_flags',
--   'string',
--   true,
--   true
-- )
-- ON CONFLICT (key) DO NOTHING;

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
  v_auth_jwt text;
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

  -- Resolve Supabase URL
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

  v_supabase_url := rtrim(v_supabase_url, '/');

  -- Resolve JWT for calling Edge Functions (required unless verify_jwt=false)
  -- Prefer anon key (publishable JWT) to avoid storing service role.
  v_auth_jwt := current_setting('app.supabase_anon_key', true);

  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    SELECT ac.value INTO v_auth_jwt
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_anon_key'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  -- Optional fallback: service role key if provided (server-only)
  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    v_auth_jwt := current_setting('app.supabase_service_role_key', true);
  END IF;

  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    SELECT ac.value INTO v_auth_jwt
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_service_role_key'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    RAISE WARNING 'notify_new_message: Missing auth JWT (admin_config.supabase_anon_key or app.supabase_anon_key); Edge Function call would be rejected; skipping push';
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_auth_jwt,
        'apikey', v_auth_jwt
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

-- Verification
-- SELECT key, left(value, 20) || '...' as value_preview, is_active FROM public.admin_config WHERE key in ('supabase_url','supabase_anon_key');
-- SELECT tgname, tgenabled, tgrelid::regclass, tgfoid::regprocedure FROM pg_trigger WHERE tgname='on_message_insert_notify';
