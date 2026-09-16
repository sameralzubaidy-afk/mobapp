-- ============================================================================
-- R9 — Minimal Event Instrumentation (Cross-Cutting)
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   Captures pilot analytics events tagged to their node so Westport (and
--   future markets) can measure the funnel — registered → activated (first
--   listing OR first purchase) → engaged (completed trade within 30 days) —
--   plus checkout, subscription, SP, and trade-outcome events. Every event
--   row carries a node_id.
--
-- EVENT CATALOG (event_name → event_category):
--   funnel:        user_registered, user_activated, user_engaged
--   checkout:      checkout_fee_shown, checkout_started, checkout_completed,
--                  checkout_failed
--   subscription:  subscription_trial_start, subscription_converted,
--                  subscription_retention_30d, subscription_retention_60d,
--                  subscription_retention_90d
--   sp:            sp_issued, sp_redeemed, sp_frozen, sp_outstanding,
--                  sp_pending
--   trade_outcome: trade_completed, trade_cancelled, trade_timed_out
--
-- NODE-TAGGING RULE (single source of truth, matches N6):
--   * Funnel / subscription / client checkout events  → the USER's node
--     (profiles.node_id), resolved server-side (get_seller_node_id()).
--   * Trade outcomes / checkout_completed              → the TRADE's node
--     (trades.node_id = seller's node snapshot).
--   * SP movement events                               → the sp_ledger row's
--     node_id (N6 trigger fills it).
--   * SP state snapshots                               → per-node totals.
--   In the single-pilot market these are identical; the rule only matters for
--   multi-node expansion.
--
-- SERVER-SIDE CAPTURE (TRADING-FLOW-V2 §16.2):
--   State-change events are inserted by DB triggers so cron-triggered and
--   server-only changes (offer expiry, auto-complete, SP freeze) are never
--   missed. Client-origin events (checkout_fee_shown / checkout_started /
--   checkout_failed) are forwarded by the mobile app to the `analytics-track`
--   Edge Function, which calls rpc_track_analytics_event(). The user-JWT
--   authenticated RPC is SECURITY DEFINER so it can insert despite RLS.
--
-- RULES applied: SQL-0 (Mode B), BP-9 (table → RLS → policies → functions →
--   triggers → cron → verification), BP-10 (verification queries), p_/v_
--   naming, qualified columns, BP-5 (SECURITY DEFINER documented +
--   search_path), BP-4 (event-logging failures are logged, never break the
--   primary operation).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: analytics_events table (append-only pilot event log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,   -- actor; NULL for system/cron events
  node_id        UUID REFERENCES public.nodes(id) ON DELETE SET NULL, -- node tag (R9 requirement)
  event_name     TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'other'
                 CHECK (event_category IN ('funnel','checkout','subscription','sp','trade_outcome','other')),
  properties     JSONB NOT NULL DEFAULT '{}',
  source         TEXT NOT NULL DEFAULT 'server_trigger'
                 CHECK (source IN ('server_trigger','edge_function','mobile','cron')),
  idempotency_key TEXT,  -- deterministic dedupe key (cron/triggers); NULL allowed (Postgres unique treats NULLs as distinct)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (query patterns: per node, per user, per event over time)
CREATE INDEX IF NOT EXISTS idx_analytics_events_node_id     ON public.analytics_events(node_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id     ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name  ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at  ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON public.analytics_events(event_name, created_at DESC);

-- Unique on idempotency_key → ON CONFLICT (idempotency_key) DO NOTHING works
-- for the daily snapshot / retention cron.
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_events_idempotency ON public.analytics_events(idempotency_key);

-- RLS: insert-only; regular users have NO direct table access (events are
-- written only via SECURITY DEFINER RPC/triggers). Service role: full.
-- Admin: read. Mirrors the trade_events pattern.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events service_role all" ON public.analytics_events;
CREATE POLICY "analytics_events service_role all" ON public.analytics_events
  FOR ALL USING (auth.role() = 'service_role');

-- FIX (2026-08-22): the original policy referenced public.admin_users, which does
-- NOT exist in this project's schema (that was a copy-paste from the trade_events
-- pattern). The canonical admin check here is public.admin_has_role() — the same
-- enforcement point used by admin RPCs (20260809000001). admin_has_role prefers
-- is_admin() (raw_user_meta_data.is_admin='true') and falls back to legacy roles.
DROP POLICY IF EXISTS "analytics_events admin read" ON public.analytics_events;
CREATE POLICY "analytics_events admin read" ON public.analytics_events
  FOR SELECT USING (public.admin_has_role(auth.uid()));

-- ---------------------------------------------------------------------------
-- BLOCK 2: Core helper functions
-- ---------------------------------------------------------------------------

-- Core insert (used by RPC + triggers). Never raises — logs and returns NULL
-- so analytics can never break the primary operation (BP-4).
CREATE OR REPLACE FUNCTION public.fn_insert_analytics_event(
  p_event_name TEXT,
  p_user_id UUID,
  p_node_id UUID,
  p_category TEXT,
  p_properties JSONB,
  p_source TEXT,
  p_idempotency_key TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT ae.id INTO v_id
    FROM public.analytics_events ae
    WHERE ae.idempotency_key = p_idempotency_key;
    IF v_id IS NOT NULL THEN
      RETURN v_id;  -- already recorded (idempotent)
    END IF;
  END IF;

  INSERT INTO public.analytics_events
    (user_id, node_id, event_name, event_category, properties, source, idempotency_key)
  VALUES
    (p_user_id, p_node_id, p_event_name, p_category, COALESCE(p_properties, '{}'), p_source, p_idempotency_key)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_insert_analytics_event failed for %: %', p_event_name, SQLERRM;
  RETURN NULL;
END;
$$;

-- Trigger-facing helper (void; catches errors internally via fn_insert_*).
CREATE OR REPLACE FUNCTION public.fn_log_analytics_event(
  p_event_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_node_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT 'other',
  p_properties JSONB DEFAULT '{}',
  p_source TEXT DEFAULT 'server_trigger',
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_insert_analytics_event(
    p_event_name, p_user_id, p_node_id, p_category, p_properties, p_source, p_idempotency_key
  );
END;
$$;

-- EF-facing RPC: resolves the node server-side from profiles.node_id when the
-- caller doesn't supply one, so every event is tagged even if the client
-- forgets to send node_id.
CREATE OR REPLACE FUNCTION public.rpc_track_analytics_event(
  p_event_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_node_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT 'other',
  p_properties JSONB DEFAULT '{}',
  p_source TEXT DEFAULT 'edge_function',
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_node_id UUID := p_node_id;
BEGIN
  IF v_node_id IS NULL AND p_user_id IS NOT NULL THEN
    v_node_id := public.get_seller_node_id(p_user_id);  -- user→node resolver (migration 089)
  END IF;
  RETURN public.fn_insert_analytics_event(
    p_event_name, p_user_id, v_node_id, p_category, p_properties, p_source, p_idempotency_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_track_analytics_event(TEXT, UUID, UUID, TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;

-- user_engaged (funnel): emit once per user when their first completed trade
-- happens within 30 days of registration.
CREATE OR REPLACE FUNCTION public.fn_emit_engagement(
  p_user_id UUID,
  p_node_id UUID,
  p_trade_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_days INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT (CURRENT_DATE - p2.created_at::date) INTO v_days
  FROM public.profiles p2
  WHERE p2.user_id = p_user_id;

  IF v_days IS NULL OR v_days > 30 THEN
    RETURN;  -- not engaged within the 30-day window
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.analytics_events ae
    WHERE ae.user_id = p_user_id AND ae.event_name = 'user_engaged'
  ) THEN
    PERFORM public.fn_log_analytics_event(
      'user_engaged', p_user_id, p_node_id, 'funnel',
      jsonb_build_object('days_since_registration', v_days, 'trade_id', p_trade_id),
      'server_trigger', 'user_engaged:' || p_user_id::text
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- BLOCK 3: Triggers (server-side capture — TRADING-FLOW-V2 §16.2)
-- ---------------------------------------------------------------------------

-- 1) user_registered (funnel) — fires on profile creation. node_id is usually
--    NULL until onboarding; trg_analytics_backfill_node tags it later.
CREATE OR REPLACE FUNCTION public.fn_analytics_user_registered()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_log_analytics_event(
    'user_registered', NEW.user_id, NEW.node_id, 'funnel', '{}'::jsonb,
    'server_trigger', 'user_registered:' || NEW.user_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_user_registered ON public.profiles;
CREATE TRIGGER trg_analytics_user_registered
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_user_registered();

-- 2) node backfill — once a user's node is assigned, tag any analytics rows
--    created before the node existed (guarantees "every event tagged").
CREATE OR REPLACE FUNCTION public.fn_analytics_backfill_node()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NOT NULL AND NEW.node_id IS DISTINCT FROM OLD.node_id THEN
    UPDATE public.analytics_events ae
    SET node_id = NEW.node_id
    WHERE ae.user_id = NEW.user_id AND ae.node_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_backfill_node ON public.profiles;
CREATE TRIGGER trg_analytics_backfill_node
  AFTER UPDATE OF node_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_backfill_node();

-- 3) user_activated (funnel, reason=first_listing) — fires on the seller's
--    very first listing. items.node_id is populated by the N6 BEFORE trigger.
CREATE OR REPLACE FUNCTION public.fn_analytics_user_activated_listing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.items i WHERE i.seller_id = NEW.seller_id AND i.id <> NEW.id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.analytics_events ae
    WHERE ae.user_id = NEW.seller_id AND ae.event_name = 'user_activated'
  ) THEN
    PERFORM public.fn_log_analytics_event(
      'user_activated', NEW.seller_id, NEW.node_id, 'funnel',
      jsonb_build_object('reason', 'first_listing', 'listing_id', NEW.id),
      'server_trigger', 'user_activated:' || NEW.seller_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_user_activated_listing ON public.items;
CREATE TRIGGER trg_analytics_user_activated_listing
  AFTER INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_user_activated_listing();

-- 4) checkout_completed + user_activated (reason=first_purchase) — on trades
--    INSERT (both single-item and bundle checkouts create trades).
CREATE OR REPLACE FUNCTION public.fn_analytics_trade_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- checkout_completed (one per trade created; bundles create one per item)
  PERFORM public.fn_log_analytics_event(
    'checkout_completed', NEW.buyer_id, NEW.node_id, 'checkout',
    jsonb_build_object(
      'trade_id', NEW.id,
      'listing_id', NEW.listing_id,
      'sp_amount', COALESCE(NEW.sp_amount, 0),
      'cash_amount_cents', COALESCE(NEW.cash_amount_cents, 0)
    ),
    'server_trigger', 'checkout_completed:' || NEW.id::text
  );

  -- user_activated (first_purchase) — buyer's node, only if not activated yet
  IF NOT EXISTS (
    SELECT 1 FROM public.trades t WHERE t.buyer_id = NEW.buyer_id AND t.id <> NEW.id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.analytics_events ae
    WHERE ae.user_id = NEW.buyer_id AND ae.event_name = 'user_activated'
  ) THEN
    PERFORM public.fn_log_analytics_event(
      'user_activated', NEW.buyer_id, public.get_seller_node_id(NEW.buyer_id), 'funnel',
      jsonb_build_object('reason', 'first_purchase', 'trade_id', NEW.id),
      'server_trigger', 'user_activated:' || NEW.buyer_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_trade_created ON public.trades;
CREATE TRIGGER trg_analytics_trade_created
  AFTER INSERT ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_trade_created();

-- 5) trade outcomes — completed / cancelled / timed-out (offer expiry).
CREATE OR REPLACE FUNCTION public.fn_analytics_trade_outcome()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' THEN
    v_event := 'trade_completed';
  ELSIF NEW.status = 'cancelled' AND COALESCE(NEW.cancellation_reason, '') = 'Offer expired' THEN
    v_event := 'trade_timed_out';
  ELSIF NEW.status = 'cancelled' THEN
    v_event := 'trade_cancelled';
  ELSE
    RETURN NEW;  -- pending → in_progress / payment_failed are not outcomes
  END IF;

  PERFORM public.fn_log_analytics_event(
    v_event, NULL, NEW.node_id, 'trade_outcome',
    jsonb_build_object(
      'trade_id', NEW.id,
      'buyer_id', NEW.buyer_id,
      'seller_id', NEW.seller_id,
      'listing_id', NEW.listing_id,
      'previous_status', OLD.status
    ),
    'server_trigger', v_event || ':' || NEW.id::text
  );

  -- user_engaged (funnel): first completed trade within 30 days, for both parties.
  IF NEW.status = 'completed' THEN
    PERFORM public.fn_emit_engagement(NEW.buyer_id, public.get_seller_node_id(NEW.buyer_id), NEW.id);
    PERFORM public.fn_emit_engagement(NEW.seller_id, NEW.node_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_trade_outcome ON public.trades;
CREATE TRIGGER trg_analytics_trade_outcome
  AFTER UPDATE OF status ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_trade_outcome();

-- 6) subscription events — trial start + conversion to paid.
CREATE OR REPLACE FUNCTION public.fn_analytics_subscription_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- trial start: status → 'trial' (INSERT or UPDATE; OLD.status is NULL on INSERT)
  IF NEW.status = 'trial' AND OLD.status IS DISTINCT FROM 'trial' THEN
    PERFORM public.fn_log_analytics_event(
      'subscription_trial_start', NEW.user_id, public.get_seller_node_id(NEW.user_id), 'subscription',
      jsonb_build_object('trial_start_date', NEW.trial_start_date, 'status', NEW.status),
      'server_trigger', 'subscription_trial_start:' || NEW.user_id::text
    );
  END IF;

  -- conversion to paid: status → 'active' from trial/free
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    PERFORM public.fn_log_analytics_event(
      'subscription_converted', NEW.user_id, public.get_seller_node_id(NEW.user_id), 'subscription',
      jsonb_build_object('previous_status', OLD.status, 'current_period_start', NEW.current_period_start),
      'server_trigger', 'subscription_converted:' || NEW.user_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_subscription_events ON public.subscriptions;
CREATE TRIGGER trg_analytics_subscription_events
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_subscription_events();

-- 7) SP movement events — issued (earn), redeemed (spend), frozen (freeze).
--    sp_ledger.node_id is filled by the N6 BEFORE trigger.
CREATE OR REPLACE FUNCTION public.fn_analytics_sp_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event TEXT;
BEGIN
  IF NEW.transaction_type LIKE 'earn\_%' THEN
    v_event := 'sp_issued';
  ELSIF NEW.transaction_type LIKE 'spend\_%' THEN
    v_event := 'sp_redeemed';
  ELSIF NEW.transaction_type = 'freeze' THEN
    v_event := 'sp_frozen';
  ELSE
    RETURN NEW;  -- expire / unfreeze / admin_deduct — not in the R9 minimal set
  END IF;

  PERFORM public.fn_log_analytics_event(
    v_event, NEW.user_id, NEW.node_id, 'sp',
    jsonb_build_object(
      'amount', NEW.amount,
      'transaction_type', NEW.transaction_type,
      'balance_after', NEW.balance_after,
      'wallet_id', NEW.wallet_id
    ),
    'server_trigger', v_event || ':' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_sp_events ON public.sp_ledger;
CREATE TRIGGER trg_analytics_sp_events
  AFTER INSERT ON public.sp_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_sp_events();

-- ---------------------------------------------------------------------------
-- BLOCK 4: Daily state snapshots (SP outstanding / pending per node +
--          subscription retention 30/60/90-day) via one guarded pg_cron job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_emit_daily_analytics_snapshots()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_rows     INTEGER := 0;
BEGIN
  -- SP outstanding (total available SP per node)
  INSERT INTO public.analytics_events (user_id, node_id, event_name, event_category, properties, source, idempotency_key)
  SELECT
    NULL,
    COALESCE(w.node_id, p.node_id),
    'sp_outstanding',
    'sp',
    jsonb_build_object('total_sp', COALESCE(SUM(w.available_balance), 0), 'user_count', COUNT(*)),
    'cron',
    'sp_outstanding:' || COALESCE(w.node_id, p.node_id)::text || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
  FROM public.sp_wallets w
  LEFT JOIN public.profiles p ON p.user_id = w.user_id
  WHERE COALESCE(w.node_id, p.node_id) IS NOT NULL
  GROUP BY COALESCE(w.node_id, p.node_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  -- FIX (2026-08-22): GET DIAGNOSTICS RHS must be a single item (ROW_COUNT), not
  -- an expression like v_inserted + ROW_COUNT (42601). Accumulate via a temp var.
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- SP pending (total pending_balance per node)
  INSERT INTO public.analytics_events (user_id, node_id, event_name, event_category, properties, source, idempotency_key)
  SELECT
    NULL,
    COALESCE(w.node_id, p.node_id),
    'sp_pending',
    'sp',
    jsonb_build_object('total_pending_sp', COALESCE(SUM(w.pending_balance), 0), 'user_count', COUNT(*)),
    'cron',
    'sp_pending:' || COALESCE(w.node_id, p.node_id)::text || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
  FROM public.sp_wallets w
  LEFT JOIN public.profiles p ON p.user_id = w.user_id
  WHERE COALESCE(w.node_id, p.node_id) IS NOT NULL
  GROUP BY COALESCE(w.node_id, p.node_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- Subscription retention milestones (30/60/90 days since cohort anchor).
  -- Cohort = every subscription that is no longer the default 'free' row, so
  -- churned users are included with still_active=false (correct denominator).
  INSERT INTO public.analytics_events (user_id, node_id, event_name, event_category, properties, source, idempotency_key)
  SELECT
    s.user_id,
    public.get_seller_node_id(s.user_id),
    m.event_name,
    'subscription',
    jsonb_build_object(
      'days', m.days,
      'status', s.status,
      'still_active', s.status IN ('trial','active','grace')
    ),
    'cron',
    m.event_name || ':' || s.user_id::text
  FROM public.subscriptions s
  CROSS JOIN (
    VALUES ('subscription_retention_30d', 30),
           ('subscription_retention_60d', 60),
           ('subscription_retention_90d', 90)
  ) AS m(event_name, days)
  WHERE s.status <> 'free'
    AND (CURRENT_DATE - (COALESCE(s.trial_start_date, s.current_period_start, s.created_at))::date) = m.days
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_emit_daily_analytics_snapshots() TO service_role;

-- Schedule daily at 03:00 (guarded, mirrors other cron migrations; BP-21).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'analytics-daily-snapshots') THEN
      PERFORM cron.unschedule('analytics-daily-snapshots');
    END IF;
    PERFORM cron.schedule(
      'analytics-daily-snapshots',
      '0 3 * * *',
      'SELECT public.rpc_emit_daily_analytics_snapshots();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping analytics-daily-snapshots cron schedule: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- BLOCK 5: Verification queries (run in Supabase SQL Editor, one at a time)
-- ---------------------------------------------------------------------------
-- 1. Table + columns:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'analytics_events' ORDER BY ordinal_position;
-- 2. RLS enabled:
--    SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'analytics_events';
-- 3. Functions present:
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('fn_insert_analytics_event','fn_log_analytics_event',
--                      'rpc_track_analytics_event','fn_emit_engagement',
--                      'rpc_emit_daily_analytics_snapshots') ORDER BY proname;
-- 4. Triggers attached:
--    SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE tgname LIKE 'trg_analytics_%' ORDER BY tgname;
-- 5. Manual event insert (should return a UUID):
--    SELECT public.rpc_track_analytics_event('checkout_fee_shown', NULL, NULL, 'checkout',
--      jsonb_build_object('test', true), 'edge_function', NULL);
-- 6. Verify node tag + row:
--    SELECT event_name, event_category, user_id, node_id, source, created_at
--    FROM public.analytics_events ORDER BY created_at DESC LIMIT 10;
-- 7. Cron job present:
--    SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'analytics-daily-snapshots';
-- 8. Idempotency (re-run 5 → returns the SAME event id):
--    SELECT public.rpc_track_analytics_event('checkout_fee_shown', NULL, NULL, 'checkout',
--      jsonb_build_object('test', true), 'edge_function', 'manual:test:1') AS a,
--           public.rpc_track_analytics_event('checkout_fee_shown', NULL, NULL, 'checkout',
--      jsonb_build_object('test', true), 'edge_function', 'manual:test:1') AS b;
