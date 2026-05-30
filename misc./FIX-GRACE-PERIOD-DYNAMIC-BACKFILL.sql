-- FIX-GRACE-PERIOD-DYNAMIC-BACKFILL.sql
-- Purpose: backfill existing grace-period subscriptions so grace_ends_at follows current admin-config grace_period_days.
-- Safe to re-run (idempotent): yes, it recalculates from grace_started_at/cancelled_at each run.

-- ==============================
-- BLOCK 1 — Verify current config + impacted rows
-- ==============================

-- 1) Confirm active grace config value
SELECT c.key, c.value, c.data_type, c.is_active
FROM public.admin_config c
WHERE c.key = 'grace_period_days'
  AND c.is_active = true;

-- 2) Preview subscriptions currently in grace period
SELECT s.id,
       s.user_id,
       s.status,
       s.grace_started_at,
       s.cancelled_at,
       s.grace_ends_at,
       (
         COALESCE(s.grace_started_at, s.cancelled_at, s.updated_at, NOW())
         + (COALESCE(NULLIF(c.value::text, ''), '90')::int * INTERVAL '1 day')
       ) AS computed_grace_ends_at
FROM public.subscriptions s
LEFT JOIN public.admin_config c
  ON c.key = 'grace_period_days'
 AND c.is_active = true
WHERE s.status = 'grace_period'
ORDER BY s.updated_at DESC;

-- ==============================
-- BLOCK 2 — Backfill + verify
-- ==============================

WITH cfg AS (
  SELECT COALESCE(NULLIF(c.value::text, ''), '90')::int AS grace_days
  FROM public.admin_config c
  WHERE c.key = 'grace_period_days'
    AND c.is_active = true
  LIMIT 1
),
upd AS (
  UPDATE public.subscriptions s
  SET grace_ends_at = (
        COALESCE(s.grace_started_at, s.cancelled_at, s.updated_at, NOW())
        + (COALESCE((SELECT grace_days FROM cfg), 90) * INTERVAL '1 day')
      ),
      updated_at = NOW()
  WHERE s.status = 'grace_period'
  RETURNING s.id, s.user_id, s.grace_started_at, s.cancelled_at, s.grace_ends_at
)
SELECT * FROM upd;

-- Post-update verification
SELECT s.id,
       s.user_id,
       s.status,
       s.grace_started_at,
       s.cancelled_at,
       s.grace_ends_at
FROM public.subscriptions s
WHERE s.status = 'grace_period'
ORDER BY s.updated_at DESC;
