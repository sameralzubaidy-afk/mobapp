-- File: supabase/migrations/20260902120000_subscription_authority_consolidation.sql
-- DEV-TASK (QA Task 20 unblock, Step 1) — Consolidate subscription price/fee authorities.
--
-- Purpose: make the three "authority" values agree on staging (and any fresh env):
--   * Monthly price: $5.99 (599 cents) everywhere.
--       - subscription_tiers.kids_club_plus.price_cents       499 -> 599
--       - admin_config.subscription_price_monthly             = 599 (already, cents)
--       - subscriptions.monthly_price_cents snapshot          = 599 (already)
--       - (Stripe Price = 599 is linked separately by the DevOps step, not here.)
--   * Subscriber flat transaction fee: $1.49 (149 cents) everywhere.
--       - The AUTHORITATIVE charged fee is the R1 buyer-fee engine key
--         buyer_fee_active_member_cents = 149 (unchanged here — create-trade-offer
--         charges it server-side via fn_get_buyer_fee_for_checkout).
--       - Align the vestigial subscription fee key
--         transaction_fee_subscriber_cents   100 -> 149  (only feeds the client
--         subscription-summary preview; NO charging EF reads it).
--       - subscription_features.reduced_fee marketing copy "$0.99 … vs $2.99" -> flat $1.49.
--   * Trial: config trial_enabled = false (D-001 — do NOT change here). The trial
--     marketing gating + create-checkout-session honoring of trial_enabled are code
--     changes (separate commits); this migration only aligns money data.
--
-- MODE: B — idempotent / rerunnable (ON CONFLICT / WHERE-guarded UPDATEs). Safe to re-run.
-- NOTE: migrations must NOT force admin_config.subscription_price_monthly (admin-editable at
-- runtime); staging already = 599. Only deterministic repo-owned data is touched.

-- =============================================================================
-- BLOCK 1 — Schema/data consolidation (rerunnable)
-- =============================================================================

-- 1a. Tier monthly price: 499 ($4.99) -> 599 ($5.99) for the Kids Club+ tier.
UPDATE public.subscription_tiers
SET price_cents = 599,
    updated_at  = NOW()
WHERE name = 'kids_club_plus'
  AND price_cents IS DISTINCT FROM 599;

-- 1b. Vestigial subscriber transaction-fee key: 100 -> 149 (aligns to the
--     authoritative R1 active-member fee). Rerun-safe; touches only the value.
UPDATE public.admin_config
SET value       = '149',
    description = 'Transaction fee for Kids Club+ subscribers in cents ($1.49 flat)',
    updated_at  = NOW()
WHERE key = 'transaction_fee_subscriber_cents'
  AND value IS DISTINCT FROM '149';

-- 1c. Tier feature marketing copy (reduced_fee row) — drop the stale "$0.99 vs $2.99"
--     figure; describe the flat member fee without a hardcoded alternative fee.
UPDATE public.subscription_features sf
SET feature_description = 'Pay one flat $1.49 safety & platform fee per checkout instead of the free-user percentage fee.',
    updated_at          = NOW()
FROM public.subscription_tiers st
WHERE st.id = sf.tier_id
  AND st.name = 'kids_club_plus'
  AND sf.feature_key = 'reduced_fee'
  AND sf.feature_description IS DISTINCT FROM
      'Pay one flat $1.49 safety & platform fee per checkout instead of the free-user percentage fee.';

-- =============================================================================
-- BLOCK 2 — Verification queries (run after Block 1)
-- =============================================================================

-- 2a. Tier authority: expect price_cents = 599 for the default Kids Club+ tier.
-- SELECT id, name, price_cents, trial_days, stripe_price_id, is_default
-- FROM public.subscription_tiers WHERE name = 'kids_club_plus';

-- 2b. Config authorities: expect subscription_price_monthly=599 (cents),
--     transaction_fee_subscriber_cents=149, buyer_fee_active_member_cents=149,
--     trial_enabled=false, trial_period_days=30.
-- SELECT key, value, data_type FROM public.admin_config
-- WHERE key IN ('subscription_price_monthly','transaction_fee_subscriber_cents',
--               'buyer_fee_active_member_cents','trial_enabled','trial_period_days')
-- ORDER BY key;

-- 2c. Feature copy: reduced_fee row now reads the flat $1.49 description.
-- SELECT sf.feature_key, sf.feature_description
-- FROM public.subscription_features sf
-- JOIN public.subscription_tiers st ON st.id = sf.tier_id
-- WHERE st.name = 'kids_club_plus' AND sf.feature_key = 'reduced_fee';
