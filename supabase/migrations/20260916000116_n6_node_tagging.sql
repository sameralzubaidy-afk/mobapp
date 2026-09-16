-- ============================================================================
-- N6 — Node Tagging (Cross-Cutting)
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   Guarantees every user, listing, trade, and cost/ledger record resolves to
--   exactly ONE node (pilot market) so per-node KPIs and expansion-gate metrics
--   can be computed (GTM plan §13 Success Metrics + §15.6 Expansion Readiness;
--   BRD §10 / §N6; SR-N6-001..006).
--
-- CURRENT STATE (verified against staging 2026-08-09 — one statement per call):
--   profiles.node_id          UUID ✓ canonical user→node (RLS + admin RPCs use it)
--   items.node_id             UUID ✓ EXISTS live, but out-of-band only (NOT in any
--                             committed migration) → MUST be defined here for fresh
--                             builds; 1597/1918 rows NULL → backfill + write trigger
--   trades.node_id            UUID ✓ trigger populate_trade_node_id (migration 089);
--                             20/662 rows NULL → backfill
--   tax_records.node_id       UUID ✓ 0 NULL
--   payments / trade_refunds / sp_wallets / sp_ledger / sp_batches /
--   seller_payouts / seller_balance / cart_items  → NO node_id → this migration adds
--
-- DESIGN (backward-compatible — additive only, never breaks a working path):
--   * All new columns are NULLABLE. Existing write paths that don't set node_id
--     keep working (value stays NULL until a trigger or the one-time backfill).
--   * Triggers SET node_id only when it is NULL — an explicitly-provided value is
--     always respected (mirrors populate_trade_node_id / set_item_node_id_from_seller).
--   * Backfills touch NULL rows only.
--   * Node semantics (single source of truth): a listing's node = the SELLER's
--     node (snapshot at write). A trade's node = the SELLER's node (snapshot).
--     Cost/ledger rows derive node from their related TRADE (seller node), falling
--     back to the user's profile node. This matches create-trade-offer's existing
--     sellerNodeId behavior and migration 089.
--   * FKs are added NOT VALID and VALIDATE only when no orphaned node_id exists
--     (backward-compat safety — legacy values that predate FK integrity never
--     fail the migration).
--   * No existing function/trigger is modified. The only recreated object is
--     set_item_node_id_from_seller() + trg_set_item_node_id, re-asserted with the
--     SAME logic so fresh `supabase db reset` builds get it (BP-16: it currently
--     exists only out-of-band).
--
-- RULES applied: SQL-0 (Mode B), BP-9 (columns → FKs → triggers → backfill →
--   indexes → RPC), BP-10 (verification queries), p_/v_ naming, qualified columns,
--   BP-5 (SECURITY DEFINER documented + search_path), HP-4 (FK integrity),
--   HP-5 (node derivation kept server-side via triggers).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: Add node_id columns (additive, nullable, backward-compatible)
-- ---------------------------------------------------------------------------
ALTER TABLE public.items         ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.payments       ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.trade_refunds  ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.sp_wallets     ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.sp_ledger      ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.sp_batches     ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.seller_payouts ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.seller_balance ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE public.cart_items     ADD COLUMN IF NOT EXISTS node_id UUID;

-- ---------------------------------------------------------------------------
-- BLOCK 1 (cont): Foreign keys → public.nodes(id). NOT VALID + guarded VALIDATE
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_orphans INTEGER;
BEGIN
  -- items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_items_node_id' AND conrelid = 'public.items'::regclass) THEN
    ALTER TABLE public.items ADD CONSTRAINT fk_items_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.items i LEFT JOIN public.nodes n ON n.id = i.node_id WHERE i.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.items VALIDATE CONSTRAINT fk_items_node_id; END IF;

  -- trades (column pre-dates this migration; add FK only if missing)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trades_node_id' AND conrelid = 'public.trades'::regclass) THEN
    ALTER TABLE public.trades ADD CONSTRAINT fk_trades_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.trades t LEFT JOIN public.nodes n ON n.id = t.node_id WHERE t.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.trades VALIDATE CONSTRAINT fk_trades_node_id; END IF;

  -- payments
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_node_id' AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments ADD CONSTRAINT fk_payments_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.payments p LEFT JOIN public.nodes n ON n.id = p.node_id WHERE p.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.payments VALIDATE CONSTRAINT fk_payments_node_id; END IF;

  -- trade_refunds
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trade_refunds_node_id' AND conrelid = 'public.trade_refunds'::regclass) THEN
    ALTER TABLE public.trade_refunds ADD CONSTRAINT fk_trade_refunds_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.trade_refunds r LEFT JOIN public.nodes n ON n.id = r.node_id WHERE r.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.trade_refunds VALIDATE CONSTRAINT fk_trade_refunds_node_id; END IF;

  -- sp_wallets
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sp_wallets_node_id' AND conrelid = 'public.sp_wallets'::regclass) THEN
    ALTER TABLE public.sp_wallets ADD CONSTRAINT fk_sp_wallets_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.sp_wallets w LEFT JOIN public.nodes n ON n.id = w.node_id WHERE w.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.sp_wallets VALIDATE CONSTRAINT fk_sp_wallets_node_id; END IF;

  -- sp_ledger
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sp_ledger_node_id' AND conrelid = 'public.sp_ledger'::regclass) THEN
    ALTER TABLE public.sp_ledger ADD CONSTRAINT fk_sp_ledger_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.sp_ledger l LEFT JOIN public.nodes n ON n.id = l.node_id WHERE l.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.sp_ledger VALIDATE CONSTRAINT fk_sp_ledger_node_id; END IF;

  -- sp_batches
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sp_batches_node_id' AND conrelid = 'public.sp_batches'::regclass) THEN
    ALTER TABLE public.sp_batches ADD CONSTRAINT fk_sp_batches_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.sp_batches b LEFT JOIN public.nodes n ON n.id = b.node_id WHERE b.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.sp_batches VALIDATE CONSTRAINT fk_sp_batches_node_id; END IF;

  -- seller_payouts
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_payouts_node_id' AND conrelid = 'public.seller_payouts'::regclass) THEN
    ALTER TABLE public.seller_payouts ADD CONSTRAINT fk_seller_payouts_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.seller_payouts sp LEFT JOIN public.nodes n ON n.id = sp.node_id WHERE sp.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.seller_payouts VALIDATE CONSTRAINT fk_seller_payouts_node_id; END IF;

  -- seller_balance
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_balance_node_id' AND conrelid = 'public.seller_balance'::regclass) THEN
    ALTER TABLE public.seller_balance ADD CONSTRAINT fk_seller_balance_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.seller_balance sb LEFT JOIN public.nodes n ON n.id = sb.node_id WHERE sb.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.seller_balance VALIDATE CONSTRAINT fk_seller_balance_node_id; END IF;

  -- cart_items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cart_items_node_id' AND conrelid = 'public.cart_items'::regclass) THEN
    ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.cart_items ci LEFT JOIN public.nodes n ON n.id = ci.node_id WHERE ci.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.cart_items VALIDATE CONSTRAINT fk_cart_items_node_id; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- BLOCK 2: Write-time node resolution triggers (fill ONLY when NULL)
-- SECURITY DEFINER: profiles/trades/items RLS would otherwise hide the rows the
-- trigger needs to resolve the node. search_path pinned (BP-5).
-- ---------------------------------------------------------------------------

-- 2a. items — resolve from seller profile at INSERT (re-asserted so fresh builds
--     get it; live already has identical logic, so this is a behavior no-op).
CREATE OR REPLACE FUNCTION public.set_item_node_id_from_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    SELECT p.node_id INTO NEW.node_id
    FROM public.profiles p
    WHERE p.user_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_item_node_id ON public.items;
CREATE TRIGGER trg_set_item_node_id
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_item_node_id_from_seller();

-- 2b. payments — resolve from the trade (seller node), fallback seller profile.
CREATE OR REPLACE FUNCTION public.set_payment_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    SELECT t.node_id INTO NEW.node_id
    FROM public.trades t
    WHERE t.id = NEW.trade_id;
  END IF;
  IF NEW.node_id IS NULL AND NEW.seller_id IS NOT NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.seller_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_payment_node_id ON public.payments;
CREATE TRIGGER trg_set_payment_node_id
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_node_id();

-- 2c. trade_refunds — resolve from the trade.
CREATE OR REPLACE FUNCTION public.set_trade_refund_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    SELECT t.node_id INTO NEW.node_id
    FROM public.trades t
    WHERE t.id = NEW.trade_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_trade_refund_node_id ON public.trade_refunds;
CREATE TRIGGER trg_set_trade_refund_node_id
  BEFORE INSERT OR UPDATE ON public.trade_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trade_refund_node_id();

-- 2d. sp_wallets — resolve from the user's profile (wallets can be created at
--     signup before the node is assigned → also fires on UPDATE).
CREATE OR REPLACE FUNCTION public.set_wallet_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_wallet_node_id ON public.sp_wallets;
CREATE TRIGGER trg_set_wallet_node_id
  BEFORE INSERT OR UPDATE ON public.sp_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_wallet_node_id();

-- 2e. sp_ledger — resolve from the related trade first, then the user's profile.
CREATE OR REPLACE FUNCTION public.set_sp_ledger_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL AND NEW.related_transaction_id IS NOT NULL THEN
    SELECT t.node_id INTO NEW.node_id
    FROM public.trades t
    WHERE t.id = NEW.related_transaction_id;
  END IF;
  IF NEW.node_id IS NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_sp_ledger_node_id ON public.sp_ledger;
CREATE TRIGGER trg_set_sp_ledger_node_id
  BEFORE INSERT ON public.sp_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sp_ledger_node_id();

-- 2f. sp_batches — resolve from the user's profile.
CREATE OR REPLACE FUNCTION public.set_sp_batch_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_sp_batch_node_id ON public.sp_batches;
CREATE TRIGGER trg_set_sp_batch_node_id
  BEFORE INSERT ON public.sp_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sp_batch_node_id();

-- 2g. seller_payouts — resolve from the trade (seller node), fallback user profile.
CREATE OR REPLACE FUNCTION public.set_payout_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL AND NEW.trade_id IS NOT NULL THEN
    SELECT t.node_id INTO NEW.node_id
    FROM public.trades t
    WHERE t.id = NEW.trade_id;
  END IF;
  IF NEW.node_id IS NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_payout_node_id ON public.seller_payouts;
CREATE TRIGGER trg_set_payout_node_id
  BEFORE INSERT ON public.seller_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payout_node_id();

-- 2h. seller_balance — resolve from the user's profile.
CREATE OR REPLACE FUNCTION public.set_seller_balance_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_seller_balance_node_id ON public.seller_balance;
CREATE TRIGGER trg_set_seller_balance_node_id
  BEFORE INSERT OR UPDATE ON public.seller_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_seller_balance_node_id();

-- 2i. cart_items — resolve from the listing (items.node_id), fallback seller profile.
CREATE OR REPLACE FUNCTION public.set_cart_item_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL AND NEW.listing_id IS NOT NULL THEN
    SELECT i.node_id INTO NEW.node_id
    FROM public.items i
    WHERE i.id = NEW.listing_id;
  END IF;
  IF NEW.node_id IS NULL AND NEW.seller_id IS NOT NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.seller_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_cart_item_node_id ON public.cart_items;
CREATE TRIGGER trg_set_cart_item_node_id
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cart_item_node_id();

-- ---------------------------------------------------------------------------
-- BLOCK 3: One-time backfill — NULL rows only (backward compatible).
--   Rows whose user/listing/trade has no node (e.g. pre-node legacy users) stay
--   NULL; they are the documented residual (see verification query #4).
-- ---------------------------------------------------------------------------
UPDATE public.items i
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = i.seller_id
  AND i.node_id IS NULL
  AND p.node_id IS NOT NULL;

UPDATE public.trades t
SET node_id = public.get_seller_node_id(t.seller_id)
WHERE t.node_id IS NULL;

UPDATE public.trades t
SET node_id = public.get_seller_node_id(t.buyer_id)
WHERE t.node_id IS NULL;

UPDATE public.payments pm
SET node_id = t.node_id
FROM public.trades t
WHERE t.id = pm.trade_id
  AND pm.node_id IS NULL
  AND t.node_id IS NOT NULL;

UPDATE public.trade_refunds r
SET node_id = t.node_id
FROM public.trades t
WHERE t.id = r.trade_id
  AND r.node_id IS NULL
  AND t.node_id IS NOT NULL;

UPDATE public.sp_ledger l
SET node_id = t.node_id
FROM public.trades t
WHERE t.id = l.related_transaction_id
  AND l.node_id IS NULL
  AND t.node_id IS NOT NULL;

UPDATE public.sp_ledger l
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = l.user_id
  AND l.node_id IS NULL
  AND p.node_id IS NOT NULL;

UPDATE public.sp_wallets w
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = w.user_id
  AND w.node_id IS NULL
  AND p.node_id IS NOT NULL;

UPDATE public.sp_batches b
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = b.user_id
  AND b.node_id IS NULL
  AND p.node_id IS NOT NULL;

UPDATE public.seller_payouts sp
SET node_id = t.node_id
FROM public.trades t
WHERE t.id = sp.trade_id
  AND sp.node_id IS NULL
  AND t.node_id IS NOT NULL;

UPDATE public.seller_payouts sp
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = sp.user_id
  AND sp.node_id IS NULL
  AND p.node_id IS NOT NULL;

UPDATE public.seller_balance sb
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = sb.user_id
  AND sb.node_id IS NULL
  AND p.node_id IS NOT NULL;

UPDATE public.cart_items ci
SET node_id = i.node_id
FROM public.items i
WHERE i.id = ci.listing_id
  AND ci.node_id IS NULL
  AND i.node_id IS NOT NULL;

UPDATE public.cart_items ci
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = ci.seller_id
  AND ci.node_id IS NULL
  AND p.node_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- BLOCK 4: Indexes for per-node KPI queries (BP-9: indexes after backfill)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_node_id         ON public.items(node_id);
CREATE INDEX IF NOT EXISTS idx_trades_node_id_n6      ON public.trades(node_id);
CREATE INDEX IF NOT EXISTS idx_payments_node_id       ON public.payments(node_id);
CREATE INDEX IF NOT EXISTS idx_trade_refunds_node_id  ON public.trade_refunds(node_id);
CREATE INDEX IF NOT EXISTS idx_sp_wallets_node_id     ON public.sp_wallets(node_id);
CREATE INDEX IF NOT EXISTS idx_sp_ledger_node_id      ON public.sp_ledger(node_id);
CREATE INDEX IF NOT EXISTS idx_sp_batches_node_id     ON public.sp_batches(node_id);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_node_id ON public.seller_payouts(node_id);
CREATE INDEX IF NOT EXISTS idx_seller_balance_node_id ON public.seller_balance(node_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_node_id     ON public.cart_items(node_id);

-- ---------------------------------------------------------------------------
-- BLOCK 5: admin_node_kpis(p_node_id) — read-only per-node KPI RPC.
--   Returns the GTM §13 per-node KPIs for one node (or all when p_node_id is
--   NULL) so expansion-gate metrics are computable per node (SR-N6-006).
--   Data-only (no writes). Service-role only (mirrors admin_health_summary).
--   Correlated subqueries are used deliberately — a multi-JOIN GROUP BY would
--   cross-multiply rows and double-count SUMs.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_node_kpis(UUID);

CREATE OR REPLACE FUNCTION public.admin_node_kpis(p_node_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(j), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'node_id',            n.id,
      'node_name',          n.name,
      'users',              (SELECT COUNT(*) FROM public.profiles p     WHERE p.node_id = n.id),
      'listings',           (SELECT COUNT(*) FROM public.items i        WHERE i.node_id = n.id AND i.status IN ('available','pending')),
      'trades',             (SELECT COUNT(*) FROM public.trades t       WHERE t.node_id = n.id),
      'completed_trades',   (SELECT COUNT(*) FROM public.trades t       WHERE t.node_id = n.id AND t.status = 'completed'),
      'gmv_cents',          (SELECT COALESCE(SUM(t.cash_amount_cents),0)::BIGINT FROM public.trades t WHERE t.node_id = n.id AND t.status = 'completed'),
      'platform_fee_cents', (SELECT COALESCE(SUM(pm.platform_fee_cents),0)::BIGINT FROM public.payments pm WHERE pm.node_id = n.id),
      'paid_payouts_cents', (SELECT COALESCE(SUM(sp.gross_amount_cents),0)::BIGINT FROM public.seller_payouts sp WHERE sp.node_id = n.id AND sp.status = 'paid'),
      'sp_earned',          (SELECT COALESCE(SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END),0)::BIGINT FROM public.sp_ledger l WHERE l.node_id = n.id),
      'sp_spent',           (SELECT COALESCE(SUM(CASE WHEN l.amount < 0 THEN -l.amount ELSE 0 END),0)::BIGINT FROM public.sp_ledger l WHERE l.node_id = n.id)
    ) AS j
    FROM public.nodes n
    WHERE (p_node_id IS NULL OR n.id = p_node_id)
    ORDER BY n.name
  ) s;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_node_kpis(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_node_kpis(UUID) TO service_role;

-- ============================================================================
-- VERIFICATION (run one statement at a time — result-granularity rule):
--  1) Columns exist:
--     SELECT table_name FROM information_schema.columns
--     WHERE table_schema='public' AND column_name='node_id'
--       AND table_name IN ('items','trades','payments','trade_refunds',
--         'sp_wallets','sp_ledger','sp_batches','seller_payouts','seller_balance','cart_items')
--     ORDER BY table_name;
--     -- Expected: 10 rows.
--
--  2) FKs + triggers present:
--     SELECT conname FROM pg_constraint WHERE conname LIKE 'fk_%_node_id' ORDER BY conname;
--     SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_set_%node_id%' OR tgname LIKE '%set_item_node_id%' ORDER BY tgname;
--
--  3) Backfill coverage (per-node resolvable rows):
--     SELECT 'items' AS tbl, count(*) FILTER (WHERE node_id IS NULL) AS nulls, count(*) AS total FROM public.items
--     UNION ALL SELECT 'trades', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.trades
--     UNION ALL SELECT 'payments', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.payments
--     UNION ALL SELECT 'trade_refunds', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.trade_refunds
--     UNION ALL SELECT 'sp_wallets', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.sp_wallets
--     UNION ALL SELECT 'sp_ledger', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.sp_ledger
--     UNION ALL SELECT 'sp_batches', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.sp_batches
--     UNION ALL SELECT 'seller_payouts', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.seller_payouts
--     UNION ALL SELECT 'seller_balance', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.seller_balance
--     UNION ALL SELECT 'cart_items', count(*) FILTER (WHERE node_id IS NULL), count(*) FROM public.cart_items;
--     -- Expected: nulls → 0 for every table (rows whose user/listing/trade has NO
--     -- node at all are unresolvable and are the documented residual — see #4).
--
--  4) Residual (rows whose actor has no node — expected and acceptable):
--     SELECT 'items' AS tbl, count(*) FROM public.items i
--       JOIN public.profiles p ON p.user_id = i.seller_id
--       WHERE i.node_id IS NULL AND p.node_id IS NULL
--     UNION ALL
--     SELECT 'trades', count(*) FROM public.trades t
--       JOIN public.profiles p ON p.user_id = t.seller_id
--       WHERE t.node_id IS NULL AND p.node_id IS NULL;
--     -- Expected: small, non-zero only for legacy users with no assigned node.
--
--  5) Per-node KPIs (new RPC):
--     SELECT public.admin_node_kpis(NULL);
--     SELECT public.admin_node_kpis('<a live node id>');
-- ============================================================================
