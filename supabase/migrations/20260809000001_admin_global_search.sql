-- ============================================================================
-- Admin Global Search — Command Palette (⌘K) aggregation RPC
-- Mode B: Idempotent Rerunnable Migration
--
-- PROBLEM:
--   Admins must open the right page to find a user, listing, trade, or
--   setting — there is no single cross-entity search. This migration adds ONE
--   READ-ONLY, SECURITY DEFINER RPC that searches four entity types in
--   parallel and returns grouped JSONB:
--     1) admin_global_search(p_query, p_limit) -> JSONB
--        {
--          query:    "<normalized query>",
--          settings: { total, items: [...] },   -- admin_config + sp_config
--          users:    { total, items: [...] },   -- profiles
--          listings: { total, items: [...] },   -- items + category + seller
--          trades:   { total, items: [...] }    -- trades + buyer/seller
--        }
--
--   DATA-ONLY (no writes). Permission-scoped: the RPC rejects any caller who
--   is not an admin (public.admin_has_role(auth.uid())). admin_config secrets
--   (is_secret = TRUE) are never matched nor returned. Each group returns its
--   true match count (`total`) plus up to `p_limit` rows (`items`) so the
--   command palette can render top-N then a "see all N results" expansion.
--
-- BLOCK 1: RPC (run first, verify)
-- BLOCK 2: Security (grants)
--
-- Naming: p_ params, v_ locals, qualified columns (supabase-sql.instructions).
-- ============================================================================

-- ============================================================================
-- BLOCK 1: admin_global_search(p_query, p_limit)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_global_search(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.admin_global_search(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q        TEXT;      -- normalized, escaped query
  v_pattern  TEXT;      -- '%' || v_q || '%' for ILIKE
  v_cap      INTEGER;   -- per-group row cap (1..25)
  v_settings JSONB;
  v_users    JSONB;
  v_listings JSONB;
  v_trades   JSONB;
BEGIN
  -- Permission gate: only admins may run global search. admin_has_role is
  -- compatible with is_admin(), role_based_access_control, profiles.role, and
  -- auth.users metadata. (SECURITY DEFINER required to read trades, which are
  -- participant-scoped under RLS.)
  IF NOT public.admin_has_role(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  -- Normalize + escape LIKE wildcards so user input is matched literally.
  v_q := LOWER(BTRIM(COALESCE(p_query, '')));
  v_q := REPLACE(REPLACE(REPLACE(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_pattern := '%' || v_q || '%';
  v_cap := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 25);

  -- Empty query -> empty groups (the palette shows a "type to search" state).
  IF v_q = '' THEN
    RETURN jsonb_build_object(
      'query',    v_q,
      'settings', jsonb_build_object('total', 0, 'items', '[]'::jsonb),
      'users',    jsonb_build_object('total', 0, 'items', '[]'::jsonb),
      'listings', jsonb_build_object('total', 0, 'items', '[]'::jsonb),
      'trades',   jsonb_build_object('total', 0, 'items', '[]'::jsonb)
    );
  END IF;

  -- 1) Settings: admin_config (canonical single source, BP-48) + sp_config.
  SELECT jsonb_build_object(
    'total', COALESCE(MAX(x.cnt), 0),
    'items', COALESCE(
      jsonb_agg(x.item ORDER BY x.sort_key) FILTER (WHERE x.rn <= v_cap),
      '[]'::jsonb
    )
  )
  INTO v_settings
  FROM (
    SELECT
      m.item,
      m.sort_key,
      COUNT(*) OVER () AS cnt,
      ROW_NUMBER() OVER (ORDER BY m.sort_key) AS rn
    FROM (
      SELECT
        jsonb_build_object(
          'source',      'config',
          'key',         ac.key,
          'category',    ac.category::text,
          'label',       COALESCE(NULLIF(ac.description, ''), ac.key),
          'description', ac.description,
          'is_secret',   ac.is_secret,
          'breadcrumb',  'Config → ' || ac.category::text || ' → ' || ac.key,
          'href',        '/config?tab=' || ac.category::text
        ) AS item,
        LOWER(ac.key) AS sort_key
      FROM public.admin_config ac
      WHERE ac.is_active = TRUE
        AND (
          ac.key ILIKE v_pattern
          OR COALESCE(ac.description, '') ILIKE v_pattern
          OR ac.category::text ILIKE v_pattern
          OR (NOT ac.is_secret AND ac.value ILIKE v_pattern)
        )
      UNION ALL
      SELECT
        jsonb_build_object(
          'source',      'sp_config',
          'key',         sc.config_key,
          'category',    COALESCE(sc.category, 'general'),
          'label',       COALESCE(NULLIF(sc.description, ''), sc.config_key),
          'description', sc.description,
          'is_secret',   FALSE,
          'breadcrumb',  'SP Config → ' || COALESCE(sc.category, 'general') || ' → ' || sc.config_key,
          'href',        '/config?tab=' || COALESCE(sc.category, 'general')
        ) AS item,
        LOWER(sc.config_key) AS sort_key
      FROM public.sp_config sc
      WHERE (
        sc.config_key ILIKE v_pattern
        OR COALESCE(sc.description, '') ILIKE v_pattern
        OR COALESCE(sc.category, 'general') ILIKE v_pattern
        OR sc.config_value::text ILIKE v_pattern
      )
    ) m
  ) x;

  -- 2) Users: profiles (name, email, phone, user id, referral code).
  SELECT jsonb_build_object(
    'total', COALESCE(MAX(x.cnt), 0),
    'items', COALESCE(
      jsonb_agg(x.item ORDER BY x.sort_key) FILTER (WHERE x.rn <= v_cap),
      '[]'::jsonb
    )
  )
  INTO v_users
  FROM (
    SELECT
      m.item,
      m.sort_key,
      COUNT(*) OVER () AS cnt,
      ROW_NUMBER() OVER (ORDER BY m.sort_key) AS rn
    FROM (
      SELECT
        jsonb_build_object(
          'source',         'users',
          'profile_id',     pr.id,
          'user_id',        pr.user_id,
          'name',           pr.name,
          'email',          pr.email,
          'phone',          pr.phone,
          'avatar_url',     pr.avatar_url,
          'account_status', pr.account_status,
          'breadcrumb',     'Users → ' || COALESCE(NULLIF(pr.name, ''), pr.email),
          'href',           '/users?search=' || pr.user_id
        ) AS item,
        LOWER(COALESCE(NULLIF(pr.name, ''), pr.email)) AS sort_key
      FROM public.profiles pr
      WHERE (
        pr.name ILIKE v_pattern
        OR COALESCE(pr.email, '') ILIKE v_pattern
        OR COALESCE(pr.phone, '') ILIKE v_pattern
        OR pr.user_id::text ILIKE v_pattern
        OR COALESCE(pr.referral_code, '') ILIKE v_pattern
      )
    ) m
  ) x;

  -- 3) Listings: items + category name + seller name/email.
  SELECT jsonb_build_object(
    'total', COALESCE(MAX(x.cnt), 0),
    'items', COALESCE(
      jsonb_agg(x.item ORDER BY x.sort_key) FILTER (WHERE x.rn <= v_cap),
      '[]'::jsonb
    )
  )
  INTO v_listings
  FROM (
    SELECT
      m.item,
      m.sort_key,
      COUNT(*) OVER () AS cnt,
      ROW_NUMBER() OVER (ORDER BY m.sort_key) AS rn
    FROM (
      SELECT
        jsonb_build_object(
          'source',        'listings',
          'id',            it.id,
          'title',         it.title,
          'category_name', c.name,
          'status',        it.status,
          'seller_id',     it.seller_id,
          'seller_name',   sp.name,
          'breadcrumb',    'Listings → ' || it.title,
          'href',          '/listings?tab=search&q=' || it.id
        ) AS item,
        LOWER(it.title) AS sort_key
      FROM public.items it
      LEFT JOIN public.categories c ON c.id = it.category_id
      LEFT JOIN public.profiles sp ON sp.user_id = it.seller_id
      WHERE it.status <> 'deleted'
        AND (
          it.title ILIKE v_pattern
          OR COALESCE(it.description, '') ILIKE v_pattern
          OR COALESCE(it.brand, '') ILIKE v_pattern
          OR COALESCE(c.name, '') ILIKE v_pattern
          OR COALESCE(sp.name, '') ILIKE v_pattern
          OR COALESCE(sp.email, '') ILIKE v_pattern
          OR it.id::text ILIKE v_pattern
        )
    ) m
  ) x;

  -- 4) Trades: trades + buyer/seller names/emails/phones (most recent first).
  SELECT jsonb_build_object(
    'total', COALESCE(MAX(x.cnt), 0),
    'items', COALESCE(
      jsonb_agg(x.item ORDER BY x.sort_key DESC) FILTER (WHERE x.rn <= v_cap),
      '[]'::jsonb
    )
  )
  INTO v_trades
  FROM (
    SELECT
      m.item,
      m.sort_key,
      COUNT(*) OVER () AS cnt,
      ROW_NUMBER() OVER (ORDER BY m.sort_key DESC) AS rn
    FROM (
      SELECT
        jsonb_build_object(
          'source',            'trades',
          'id',                t.id,
          'short_id',          LEFT(t.id::text, 8),
          'buyer_id',          t.buyer_id,
          'seller_id',         t.seller_id,
          'buyer_name',        pb.name,
          'seller_name',       ps.name,
          'status',            t.status,
          'cash_amount_cents', t.cash_amount_cents,
          'sp_amount',         t.sp_amount,
          'created_at',        t.created_at,
          'bundle_id',         t.bundle_id,
          'breadcrumb',        'Trades → ' || LEFT(t.id::text, 8) || '…',
          'href',              '/trades/' || t.id
        ) AS item,
        t.created_at AS sort_key
      FROM public.trades t
      LEFT JOIN public.profiles pb ON pb.user_id = t.buyer_id
      LEFT JOIN public.profiles ps ON ps.user_id = t.seller_id
      WHERE (
        LOWER(t.id::text) ILIKE v_pattern
        OR COALESCE(pb.name, '') ILIKE v_pattern
        OR COALESCE(pb.email, '') ILIKE v_pattern
        OR COALESCE(pb.phone, '') ILIKE v_pattern
        OR COALESCE(ps.name, '') ILIKE v_pattern
        OR COALESCE(ps.email, '') ILIKE v_pattern
        OR COALESCE(ps.phone, '') ILIKE v_pattern
        OR COALESCE(t.status, '') ILIKE v_pattern
      )
    ) m
  ) x;

  RETURN jsonb_build_object(
    'query',    v_q,
    'settings', v_settings,
    'users',    v_users,
    'listings', v_listings,
    'trades',   v_trades
  );
END;
$$;

-- ============================================================================
-- BLOCK 2: Security — admin-only via the in-function gate (authenticated role).
-- ============================================================================
-- The palette runs from the admin portal client with the logged-in user's JWT
-- (role = authenticated). admin_has_role(auth.uid()) is the enforcement point,
-- so the function is deliberately NOT granted to anon or service_role (both
-- have auth.uid() = NULL and would always be rejected anyway).
GRANT EXECUTE ON FUNCTION public.admin_global_search(TEXT, INTEGER) TO authenticated;

-- ============================================================================
-- Verification (run one statement at a time):
--   SELECT public.admin_global_search('kids', 5);
--   SELECT public.admin_global_search('b1f6', 5);
--   SELECT public.admin_global_search('', 5);
--   SELECT public.admin_global_search('sms', 10);
--   SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--   WHERE proname = 'admin_global_search';
--   -- Non-admin check: run as a non-admin JWT -> 'Forbidden: admin role required'
-- ============================================================================
