-- ============================================================================
-- Migration: 20260903000004_dev_task_100_remove_stale_admin_config_referral_keys.sql
-- Task: DEV-TASK-100 item 3 — remove dead referral keys from admin_config
-- Mode B: Idempotent / rerunnable (DELETE ... IN is a no-op when already gone).
--
-- Context: referral reward/program configuration now lives in `sp_config`
-- (keys referral_reward_* / referral_first_* / referral_program_enabled /
-- starter_pack_*), and the admin Referrals UI reads/writes sp_config via
-- /api/admin/sp-config. The same keys were historically duplicated into
-- `admin_config` by 20260207000001 (step 3: "POPULATE admin_config with same
-- referral keys (for admin UI)") and 20260207000002 — residue from the
-- pre-move admin UI that no longer exists. `feature_flag_referral_program_enabled`
-- (20250113, feature_flags category) is the same dead referral-program toggle,
-- superseded by sp_config.referral_program_enabled and never consumed anywhere.
--
-- Belt-and-suspenders source-grep (DEV-TASK-100, 2026-09-03) — zero live readers:
--   * DB functions/RPCs read referral amounts/toggles from sp_config only
--     (sp_config_int(...), get_referral_config_values) — never admin_config.
--   * Edge Functions: no reference to any admin_config referral key.
--   * Mobile app: referral gating via RPCs on sp_config; adminConfig.ts only
--     TYPES feature_flag_referral_program_enabled (default false) and nothing
--     consumes it.
--   * Admin portal: Referrals configuration-tab reads sp_config via
--     SPConfigService (/api/admin/sp-config); no page reads admin_config
--     referral keys. Deleting the rows removes them from the generic
--     row-driven admin Config page automatically — no display code references
--     a specific key.
--
-- Explicit-key list (NOT `LIKE 'referral_%'`): trial-extension keys
-- max_referral_extensions / referral_extension_days are a different feature
-- (already removed from admin_config by 20260122000001) and must never be
-- caught by a wildcard in a future rerun.
--
-- Note (BP-48): this is a dead-row cleanup DELETE in a migration, not an
-- admin-config setting WRITE — there is no editor/audit semantic to record, so
-- a direct DELETE (not the shared upsert RPC) is the correct vehicle.
-- ============================================================================

DELETE FROM public.admin_config
WHERE key IN (
  'referral_bonus',
  'referral_reward_referee_sp',
  'referral_reward_referrer_sp',
  'referral_reward_referrer_listing_sp',
  'referral_reward_referee_listing_sp',
  'referral_first_listing_enabled',
  'referral_program_enabled',
  'referral_first_trade_enabled',
  'feature_flag_referral_program_enabled'
);

-- ============================================================================
-- Verification queries (run after applying this migration).
-- A) No referral reward/program rows left in admin_config:
--      SELECT key FROM public.admin_config
--      WHERE key IN ('referral_bonus','referral_reward_referee_sp',
--        'referral_reward_referrer_sp','referral_reward_referrer_listing_sp',
--        'referral_reward_referee_listing_sp','referral_first_listing_enabled',
--        'referral_program_enabled','referral_first_trade_enabled',
--        'feature_flag_referral_program_enabled');
--    Expected: 0 rows.
-- B) Live config untouched — sp_config referral keys still present:
--      SELECT config_key, config_value FROM public.sp_config
--      WHERE config_key LIKE 'referral_%' ORDER BY config_key;
--    Expected: the canonical referral config rows remain.
-- C) Unrelated admin_config keys untouched (spot check):
--      SELECT COUNT(*) FROM public.admin_config;  -- count matches pre-apply - 9
-- ============================================================================
