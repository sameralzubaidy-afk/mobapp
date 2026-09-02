# Web Subscription Checkout — Unblock Runbook (QA Task 20 / dev follow-up)

**Date:** 2026-09-02 · **Backend:** staging `drntwgporzabmxdqykrp` · **Goal:** make the R7
web-first Kids Club+ purchase create a real (test-mode) Stripe charge end-to-end.

## What is DONE (this session)
1. **Authorities consolidated (DB applied + verified):**
   - `subscription_tiers.kids_club_plus.price_cents` = **599** ($5.99) — was 499.
   - `admin_config`: `subscription_price_monthly`=599, `transaction_fee_subscriber_cents`=**149**
     (was 100), `buyer_fee_active_member_cents`=149, `trial_enabled`=false, `trial_period_days`=30.
   - Tier feature copy `reduced_fee` updated to the flat $1.49 wording (was "$0.99 vs $2.99").
   - Migration file for reproducibility: `supabase/migrations/20260902120000_subscription_authority_consolidation.sql`
     (data applied to staging via SQL; file is rerun-safe).
2. **EF code deployed:** `create-checkout-session` now honors `admin_config.trial_enabled`
   (trial OFF → no trial even if tier `trial_days`>0); `stripe-webhook-subscriptions` welcome
   notification body now reads `buyer_fee_active_member_cents` (live fee). Both deployed
   `--use-api`; live smoke returns the function's own structured response.
3. **Copy → live config (code ready, mobile + web):** `$1.49` is no longer hardcoded anywhere on
   the six subscription surfaces; fee reads live config. Trial marketing is config-gated on
   `trial_enabled` across subscription screens (re-enable = config flip). Web `/join`, success,
   home now render price/fee from a server-side public-config read (`p2p-kids-web/lib/publicConfig.ts`);
   `/join` shows the $X/mo price, has a fixed-height error slot (no layout shift), and the success
   page has a plain "Continue on the web" fallback link.
4. **Tests:** mobile `test:unit` 3126 pass / 2 pre-existing `UserDashboardScreen` failures
   (unrelated); web typecheck + build pass; EF `deno check` pass.

## REMAINING — Step A (you, ~2 min): create the Stripe test Price
The app runs on Stripe account **`acct_1ShGft4I6kCJlvXo`** ("New business sandbox" — confirmed:
the mobile publishable key prefix `pk_test_51ShGft4I6kC…` matches). The local `stripe` CLI's stored
test key expired (2026-05-21), so the Price must be created one of these ways:

**Option A1 (Dashboard — easiest, recommended):**
1. Log into the Stripe Dashboard for the account above → **Products** → **Add product**.
2. Name it `Kids Club+`; under **Pricing** choose **Recurring** → **monthly** → price **$5.99**
   (599 cents, USD). Save.
3. Copy the **price id** (starts `price_…`) and paste it to the agent. To see it later:
   Dashboard → **Products** → *Kids Club+* → the price row shows `price_…` under "API ID".

**Option A2 (CLI):** run `stripe login` in a terminal (opens browser), then tell the agent to
continue — the agent will create the Product + Price via the CLI.

Once the `price_…` id is available, the agent will (SQL, already approved):
```sql
UPDATE public.subscription_tiers SET stripe_price_id = '<price_...>', updated_at = NOW()
WHERE name = 'kids_club_plus' AND stripe_price_id IS DISTINCT FROM '<price_...>';
-- verify
SELECT name, price_cents, stripe_price_id FROM public.subscription_tiers WHERE name='kids_club_plus';
```
then invoke `create-checkout-session` (with the web secret) and confirm it returns a real
`https://checkout.stripe.com/…` URL.

## REMAINING — Step B (agent after A1/A2): wire the EF ↔ web secret + web target
The staging EF currently has **no** `SUBSCRIPTION_WEB_SECRET` / `SUBSCRIPTION_WEB_URL` set (only
`STRIPE_SECRET_KEY` + webhook secrets). To run the real flow:
1. `supabase secrets set SUBSCRIPTION_WEB_SECRET=<generated> --project-ref drntwgporzabmxdqykrp`
2. For a LOCAL QA run (the sim reaches `localhost:3002`), also set
   `SUBSCRIPTION_WEB_URL=http://localhost:3002` and flip `p2p-kids-web/.env.local` to
   `SUBSCRIPTION_DEV_MODE=false` with the same `SUBSCRIPTION_WEB_SECRET`.
3. For a real non-DEV_MODE web target: deploy `p2p-kids-web` (no Vercel CLI present on this
   machine — use your hosting/Dashboard or a preview deploy) with `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUBSCRIPTION_WEB_SECRET` (same as EF), no `SUBSCRIPTION_DEV_MODE`; then
   set the EF `SUBSCRIPTION_WEB_URL` to that origin.
4. Point a QA mobile build's `EXPO_PUBLIC_SUBSCRIPTION_WEB_URL` at the chosen origin.

> **Stripe-side visibility of this work:** nothing was created in Stripe yet (price link is
> Step A). After Step A you will see the new `Kids Club+` Product + `$5.99/month` Price under
> Dashboard → Products. After the first real checkout you can see Checkout Sessions under
> Dashboard → Payments (test mode) and the test subscription under Customers.
