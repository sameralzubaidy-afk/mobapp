# QA Task 36 — Decision & Outcome Log (2026-09-06)

Action → reasoning → outcome trace for the key calls that shaped the run.

## Environment / setup decisions
- **Device handle:** mobile-mcp requires the full sim UDID (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), not the short `xcrun` form; WDA needed a relaunch after the sim reboot. Deep links (`openurl`) are **not** delivered to a foregrounded running app reliably this session — UI-navigation (Payouts tile) was the reliable path.
- **Persona confirm (R-NEW-4):** after the sim reboot the Home greeting "Good morning, QA" was ambiguous; DB `auth.users.last_sign_in_at` (2026-09-06 11:52Z) + node "Diag Test Node" confirmed qa-payout-seller was signed in (first-name greeting from "QA Payout Seller").

## Batch A decisions
- **Fresh disposable, real Checkout:** built a genuinely fresh subscription from the UI → hosted Checkout → webhook, to satisfy the "independent re-drive, not reusing a prior session's fixture" requirement.
- **Card save via PaymentSheet** (native sheet is AX-exposed) → `pm_1UCdhX…` persisted. Confirmed via DB read-back of `subscriptions.stripe_payment_method_id`.
- **Admin/manual cancel** driven for real via the admin portal `:3001` (subscriptions manage page, `window.confirm` override) → DB `admin_override` grace. Confirmed grace on-device.
- **Renewal negative leg (b):** the UI cannot store a declining card (PaymentSheet rejects at set-up) — so the deterministic negative leg was driven at the EF boundary with a `tok_chargeDeclined` PaymentMethod → loud `CARD_DECLINED` 402, no state change. This satisfies "no silent swallow" with real Stripe objects.
- **MED finding:** two `billing_history` rows for the same invoice (`in_1UCdlR4…`) after renewal — webhook fallback (invoice-id charge key) + EF (real charge `ch_3UCdlS…`) both wrote; `UNIQUE(charge_id)` missed because the charge ids differ. Flagged for dev (not a guide blocker).

## Batch B decisions
- **Resume onboarding** by re-firing Add Payout Method → Stripe Connect (idempotent `create-stripe-connect-account` returns the existing account + a fresh account-link), because the sim reboot had killed the first in-app onboarding WebView.
- **Website placeholder:** `www.example.com` Save is silently rejected by Stripe (API: `business_profile.url` stayed null while it remained in `currently_due`) — switched to the **product-description** alternative (typed on-device) which satisfied the requirement (left `currently_due`).
- **Stripe ID-verification gate (owner-directed SKIP):** after phone/SSN/URL cleared, `currently_due` = `individual.verification.document` + TOS. Stripe demanded a government-ID document verification and reported "We couldn't confirm your name and SSN". Root cause: `create-stripe-connect-account` set `individual.first_name="QA Payout Seller"` / `last_name="Seller"` from the display name. No clean UI workaround within reach; **owner (2026-09-06) accepted skipping the Stripe portion**. G01 recorded PARTIAL with the precise remaining leg; method never transitioned to verified; withdrawal leg not attempted.
- **Delete-guard observed:** Payout Settings refuses to delete the only payout method ("Cannot Delete Only Method") — cleanup therefore done via Stripe API + SQL (both my own disposables; BP-70/R41).

## Cleanup decisions (BP-70 / R41)
- **Batch A:** cancel sub → delete customer → delete child rows + profiles → GoTrue admin deleteUser (HTTP 200). Orphan declining PM `pm_1UCdtq4…` non-deletable standalone (Stripe rule) — recorded as harmless residue.
- **Batch B:** Stripe account DELETE (`acct_1UCe24KmLuEOxYxB` → 200 deleted) + method row delete. Read-back: qa-payout-seller 0 methods + active sub (baseline restored).
- **Batch C:** read-back confirms `test-trial` absent → SKIPPED (fixture-gated), N06 not closable.

## Final state
- D05: **PASS** (fresh independent positive + negative legs; 1 new MED logged for dev).
- G01: **PARTIAL** — onboarding driven on-device through personal/business/bank/review; **SKIPPED** at Stripe ID-document verification (owner-directed); withdrawal/verified-transition not tested.
- N06: **SKIPPED** (fixture-gated on DT120 Phase 2 — owner approval + staging ensure).
- Disposable Stripe objects + DB rows: cleaned + read-back verified (0 residue except the harmless orphan PM).
