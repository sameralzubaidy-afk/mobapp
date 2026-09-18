# QA round 2026-09-17 — SUB Android Round 8 (FINAL CLOSING: G01 · E04 · grace spend · webhook)

Run: `e2e-test-results/qa-sub-android-r8-final-2026-09-17/` (report.md + ledger.md + 10 screenshots).
Platform: Android AVD `Medium_Phone_API_36.1`, 1080×2400 (tree coords == px). iOS NOT driven (R80).
Personas: qa-payout-seller → test-buyer → test-grace.

## Verdicts — 3 PASS · 1 FAIL (new defect) · 1 BLOCKED
- **SUB-TC-G01 🟡 PARTIAL → ✅ PASS** — the incomplete/onboarding clause is DRIVEN. 3-layer AGREE
  (UI `acct_****wVu4` ⇄ DB `e560e139…` is_verified=false ⇄ provider `details_submitted=false`).
- **SUB-TC-E04 ⏸ NOT DRIVEN → ✅ PASS** — via the new `qa-subscription-status` deep link; every field DB-exact.
- **SUB-TC-L03 🚫 N/A → ✅ PASS** — live negative-signature POST on the PAYOUT `stripe-webhook` (HTTP 400 + zero mutation).
- **SUB-TC-L05 🚫 BLOCKED (enablement)** — `STRIPE_WEBHOOK_SECRET` absent from `.env` AND `.env.staging` (0 occurrences). ONE owner paste unblocks it. Negative half (L03) now passes.
- **FIX-Task-51 grace spend — entitlement ✅ / actual spend ❌ FAIL.**

## 🔴 NEW MED-HIGH DEFECT — grace users cannot spend SP in the app
`src/screens/trade/TradeOfferScreen.tsx:653` — `isSubscriber` lists `'active' | 'trial' | 'grace'` and **omits `'grace_period'`**.
- `canSpendSPNow` (L87-88) is CORRECT (allows walletState active|grace_period); only the status check is wrong.
- Effect: SP branch (L710) skipped → `!isSubscriber` upsell (L764) renders → Make Offer shows
  *"Grace Period Active — You can keep spending existing Swap Points"* **and** *"Save up to 75% … Join Kids Club+"* with **no SP control**.
- **Why now:** FIX-Task-51 normalized the only legacy `'grace'` row → `'grace_period'`, so the gate's legacy spelling no longer matches ANY row.
- Same-class candidates (audit, only L653 confirmed): `TradeInitiationScreen.tsx:436` (fee tier → `'free'`), `AuthContext.tsx:813`, `hooks/useAuth.ts:64`.
- Correct siblings: `TradeInitiationScreen.tsx:328-331`, `TradeOfferScreen.tsx:363-367`, `CartCheckoutScreen.tsx:103`, `usePaymentFailure.ts:53`, `SubscriptionStatusScreen.tsx:71/180`.

## 🔴 F4 — a guide-registered copy branch is UNREACHABLE (G01)
`PayoutSettingsScreen.tsx:1620` tests `resumingOnboarding` FIRST; `resumingOnboarding` (L1264) = *any* stripe_connect method with an account id and `stripe_onboarding_complete === false` — i.e. EXACTLY the state branch 3 describes ⇒ **L1626 can never render for it**. Live copy = "You will now be redirected to continue your Stripe onboarding. + Note: You may need to re-verify your phone number…".

## Durable facts / gotchas
- **⚠️ A Metro bundle can be fresh for one edited module and STALE for a newly-added one.** `qa-subscription-status` no-op'd 3× while `qa-dev-toggle` (alert), `qa-login-as` (persona switch) and `sp-history` (navigator) all worked, and source showed the matcher byte-identical to dev-toggle's, route registered (`AppNavigator.tsx:808`) and handler mounted (`:1141`). A **cold dev-client reload fixed it.** ⇒ "a new FIX-Task copy string rendered" is NOT proof the new *handler file* is loaded. **R79-1 cold reload is mandatory before filing a broken-enablement finding.**
- `qa:payout-fixture`: subcommand must be **argv[2]** (`-- methods --scenario none`); persona is **hard-wired** to qa-payout-seller; `--persona` first ⇒ prints usage.
- `qa:ensure-cards` does **NOT** support `test-grace` ⇒ no sanctioned card for the grace persona.
- `fn_item_effective_sp_cap` = **40–70% of price** (max 17 SP / $23) ⇒ `cash_amount_cents > 0` always ⇒ **a saved card is mandatory for ANY offer**; no cash-0 bypass.
- `qa:set-sp-balance` prints a **FALSE `❌ VERIFY FAILED`** on a fully successful, DB-verified update (reproduced both directions). Trust the DB.
- `qa:express-complete -- create` refuses a real-but-unverified account without `--replace` (BP-71 working) and its refusal enumerates the exact `requirements.currently_due` — a great provider read.
- `qa:stripe-inspect -- by-user` lists `connect_accounts` with **`details_submitted`** — a Stripe-only field, so it is a genuine provider read (not a DB projection).
- FIX-Task-52 item 7a enablement works: `payout-fixture methods --scenario none` → EF mints a NEW account → UI "Onboarding required" + "Continue Onboarding" + radio "Cannot set as primary".
- Restore after a methods fixture: `qa:express-complete -- create --replace` (mints a fresh real verified account; the old one is deleted).

## App-state residue
- `qa-payout-seller`: verified method restored (`acct_1UGfka43WgHtBC9V`), balance $50.00; G01-drive account `acct_1UGfi533TYJKwVu4` deleted; older `acct_1UGO3X3J8Vt0lE5T` orphaned in Stripe (test mode). R7 payout `e1893558…` + transfer `tr_1UGeom4I6kCJlvXoMOti9yRj` untouched.
- `test-grace`: SP 0 → 20 → 0 (reverted), `state='grace_period'` throughout; 2 `sp_ledger` audit rows remain; no trade/offer created.
- `test-buyer` unchanged; no toggles armed; no `admin_config` writes. App left as `test-grace` on Make Offer.

## Tracker
SUB **79 PASS / 1 PARTIAL / 2 OPEN / 15 RETIRED / 2 N/A**. ⚠️ Pre-existing 2-row roll-up ⇄ row-set gap persists (row PARTIAL set `{F03, F06, L05}` = 3) — carried forward, not papered over.
