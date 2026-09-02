# Guide Currency Audit (v2) — FULL Close-Out Report for External Agent

**Date:** 2026-09-02 · **Repo:** `kids_marketplace_app` (Kids P2P Marketplace monorepo) · **Backend:** Supabase staging `drntwgporzabmxdqykrp`
**Intended reader:** An AI agent WITHOUT repo access that must pick up guide-currency QA work. This report is self-contained: it tells you what changed, where, why, the live-surface facts you must trust, and exactly what is still blocked/deferred.

---

## 0. TL;DR

Four canonical manual-testing guides were audited against the live codebase. **All four are now updated/accurate** so QA rounds can start with correct scope instead of discovering stale tests mid-run:

1. `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SUB) — **rewritten** (Section 1 of the task): retired the removed in-app subscription-purchase group, rewrote payout groups to the live screen, re-homed fixture-gated cases, cross-referenced the web-first join E2E.
2. `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM) — **audited then rewritten** (Section 2 + follow-up): copy/locator/surface fixes + page-drift flags.
3. `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (ACC) — **audited then rewritten** (Section 3 + follow-up): 4 stale + 4 dead (MFA) cases resolved.
4. `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (MSG) — **audited then rewritten** (Section 4 + follow-up): 6 stale + 1 dead-premise case resolved.

**All guides live at:** `cross-checked-and-consolidated/<filename>`. Do **not** edit root/`archive/misc.` copies — they are old duplicates (see §9). Each guide's `## Test Case Index`, `## Verification checklist mapping`, and the `**Last updated:**` header line were updated in the SAME pass as the bodies (a standing lesson: index and bodies drift independently).

---

## 1. Cross-cutting facts an external agent MUST trust (source-verified 2026-09-02)

### 1a. Architecture / where things live
- **Mobile app:** `p2p-kids-marketplace/` (React Native / Expo). Route registry = `src/navigation/AppNavigator.tsx`. Home tab = `UserDashboardScreen`. Messaging = header **chat icon** → `InboxTab` (there is NO bottom Messages tab). Notification center = header **bell** → `Notifications`.
- **Admin portal:** `p2p-kids-admin/` (Next.js, port 3001). Live shell = `src/app/layout.tsx` → `AdminShell` (grouped purple `Sidebar` + `TopNavbar` + `CommandPalette`). `src/app/components/ProtectedLayout.tsx` is **dead/legacy** (zero importers).
- **Web subscription app:** `p2p-kids-web/` (consumer, port 3002) — `/join`, `/account/subscription`, `/api/checkout`. This is where membership is now purchased (web-first).
- **Canonical manual-testing guides:** `cross-checked-and-consolidated/` (6 guides; the 4 above plus AUTH/… and TradeFlowV2). Older copies live in `archive/misc./` and workspace root — ignore them for editing.
- **Credentials:** staging admin login = `samer@samer.com` / `samer` (NOT `admin@example.com` which is only the login page's demo box; NOT `test-admin@…` which is a guide-only account). Admin API calls need the `x-admin-secret` header.

### 1b. The single most important product fact: subscriptions are now WEB-FIRST
- The in-app Stripe subscription purchase flow is **removed**. All join CTAs route to `JoinKidsClubScreen` → **"Join on the web"** (passitup.com). `SubscriptionPaymentScreen`/`SubscriptionSuccessScreen` are gone (no callers).
- The full web journey is **still not drivable end-to-end on staging** (QA Task 20): **no `subscription_tiers` row has a `stripe_price_id`** (0 rows) so the deployed `create-checkout-session` Edge Function returns `CONFIG_UNAVAILABLE`; local web is `SUBSCRIPTION_DEV_MODE=true` (mock). Unblock = link a real Stripe **test** Price + point a non-DEV_MODE web build at staging (or flip local env + matching `SUBSCRIPTION_WEB_SECRET`).
- Cancellation is **NOT web-first** — it is in-app (Manage Kids Club+ → Cancel → `cancel-subscription` EF → Stripe `cancel_at_period_end` → webhook). No cancel UI exists on p2p-kids-web.
- `useSubscription` refetches on AppState foreground, so a web purchase reflects in-app without manual refresh.
- QA Task 20's report: `e2e-test-results/qa-task20-web-sub-e2e-2026-09-02/report.md` (1 PASS / 4 PARTIAL / 1 NOT-TESTABLE).

### 1c. Payouts: the LIVE surface is `PayoutSettingsScreen` only
- `PayoutSettingsScreen` (`src/screens/seller/PayoutSettingsScreen.tsx`, route `PayoutSettings`) is the live payout surface. Reach it via Dashboard **Payouts** tile.
- **Dead/unreachable:** `PayoutDashboardScreen` (unregistered), `SellerEarningsScreen` and `RequestPayoutScreen` (registered but their only caller was the dead dashboard).
- Payout settings shows: **Available Balance** (`balance-amount`) + **Pending** (`balance-pending`) + **Lifetime Earned** (`balance-lifetime`) in **USD $** (not SP/AUD), a **Withdraw Now** button (`request-payout-btn`), a **PAYOUT METHOD** section (method cards `method-card-{id}`, radio `radio-btn-{id}`, kebab `kebab-btn-{id}`, "Add Another Method" `add-another-method-row` / empty-state "Add Bank Account" `add-bank-row`), and a **PAYOUT HISTORY** section (`history-row-{id}`, empty `empty-history` "No payouts yet", "Load More" +5).
- Withdrawals are **full-available-balance only** (no manual amount entry): Withdraw Now → if no balance `Alert("No Balance","You have no available balance to withdraw")`; if no verified primary method → `NoMethodModal` ("Payment Method Required"); else **WithdrawModal** ("Withdraw Funds": Available Balance / Payout Fee (-fee) / "You'll Receive:" net / Payout Method; **Confirm Withdrawal**). Success `Alert("Withdrawal Requested", "Your withdrawal of {amount} has been initiated. After fees, you will receive {net}.")`; failure `Alert("Withdrawal Failed", …)`.
- Method bottom sheet: **Set as Primary** (disabled + "Verification required before setting as primary" when unverified) / **Edit Details** (Alert "Editing payout method details is not yet available. Contact support for changes.") / **Delete Method** (guards: primary → "Cannot Delete Primary Method"; only → "Cannot Delete Only Method"; else confirm "Delete Payout Method") / Cancel. Radio on unverified → Alert "Cannot Set as Primary".
- **Provider reality:** only **Stripe Connect** is a configured/verifiable payout provider. The Add-method modal lists PayPal/Venmo UI buttons, but those providers are **not configured/drivable**; there is **no Bank ACH UI option**.
- Fee schedule `calculatePayoutFee`: stripe_connect = $0.25 + 0.25%; paypal/venmo = 2% capped at $20; bank_ach = $0.25 flat (unused).
- Minimum withdrawal = admin config `minimum_withdrawal_amount_cents`, enforced client + RPC on the full-balance request.

### 1d. TC-ID reuse hazard (esp. ADM)
TC-IDs are reused across guides with different meanings, and **within** ADM (Group R = Education/FAQ CMS `ADM-TC-R01–R03` AND a Regression section also uses `ADM-TC-R01–R05`). Always state `(guide, TC-ID)` and grep `^## `/`^### ` in the target guide before trusting an ID.

---

## 2. SUB guide — what changed (Section 1, done first)

File: `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (1915 → 1786 lines; 105 unique TC headings; no duplicates).

**A. Retired 33 stale cases (web-first / dead surfaces) — each kept as a stub that cross-references where coverage now lives:**
- **Group B (B01–B13)** + **D02** + **D04** → 🔴 **RETIRED (web-first)** stubs. They described the removed in-app Stripe purchase/renewal flow. Coverage now = **SUB-TC-N01/N02** (live `JoinKidsClubScreen` join surface) + the **Web Subscription Purchase E2E** (QA Task 20). Group B header now carries a "Group retired" note.
- **E04** (Subscription Status diagnostics) → ⏸ **FIXTURE-GATED (push-payload)** — screen only reachable via push deep link.
- **G02** (PayPal/Venmo) & **G03** (Bank ACH) → 🚫 **N/A (unconfigured providers)**.
- Full body text of retired cases replaced with short status notes (do not re-expand; the flow is gone).

**B. Rewrote 15 payout cases to the LIVE `PayoutSettingsScreen` (using source-verified F02/H05 as templates):**
- **Group F (F01–F08)**: hero Available/Pending/Lifetime ($), PAYOUT METHOD section, PAYOUT HISTORY + "Load More" (+5), error = `Alert("Failed to load payout data. Please try again.")` + pull-to-refresh (no inline Retry screen), F09-equivalent data reconciled.
- **G05** (unverified method blocks payout) → live guard: cannot set unverified as primary + Withdraw Now opens NoMethodModal.
- **Group H (H01–H04, H06–H07)**: rewritten from the dead `RequestPayoutScreen` amount-entry flow to the live full-balance WithdrawModal. H05 (verified template) left intact.

**C. Re-homed 7 adjacent cases:**
- **Group L (L01–L05)** webhooks → cross-reference **QA Task 20 scope 3** server-verified mechanisms (subscriptions upsert idempotency, `billing_history` UNIQUE(charge_id), `record_payment_attempt` retry→grace, signature gate 400 INVALID_SIGNATURE, `subscription_events` audit channel with zero `web_subscription_upsert` rows on staging).
- **D06/D07** (subscription/grace reminder notifications) → moved into a new clearly-labeled **`## Fixture-Gated Backlog`** section (full bodies preserved; Group D left an inline pointer note so no duplicate `###` headings exist).

**D. Left untouched (verified live in QA Task 19):** A01/A03/A04, C01–C03/C10–C12, E01, I01–I05/I07/I09, J01/J02, K01, M02–M05, N01/N02. (Other classified-but-not-enumerated cases — A02/A05/C04–C09/N03–N06, I08/E02/E03/M01/M06/M07/J03/J04/K02 — were intentionally left untouched per the task's authoritative scope.)

**E. Also updated:** header `**Last updated:**` → 2026-09-02, the **Test Case Index**, and the **Verification checklist mapping** (F group renamed "Payout Settings (live surface)", H group "Withdraw (Payout Settings — live surface)").

---

## 3. ADM guide — audit result + rewrite (Sections 2 + follow-up)

File: `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (172 unique TC headings — the R01–R03 duplicates are the pre-existing Education-CMS group vs Regression section).
Audit report: `docs/guide-currency-audit-ADM-2026-09-02.md`.

**Audit verdict:** 24 groups Current, 0 Dead, Stale = Group F (big), J (bare `/tax`), L (L06), Q (Q02/Q03), W (W01).

**Rewrites applied (2026-09-02):**
1. **Group F — page-drift note added at the group header** + ⚠️ **BLOCKED-ON-PAGE** banners on **F03/F05/F06/F08/F10**, and **F09 moved → `/analytics`**. WHY: the live `/settings/trade-timing` page renders ONLY: Offer Expiry · Offer Limits · Auto-Complete · Buyer Cancel Requests · Swap Points · Transaction Fees (**exactly 2 keys** — `transaction_fee_subscriber_cents` "Kids Club+ Member Fee" + `transaction_fee_non_subscriber_cents` "Free-Tier User Fee") + Reset/Save. The spec sections (seller/buyer platform fees + Charge-One-Fee, Pickup & Payout `pickup_window_hours`/`payout_buffer_days`, R2 7-day guardrail + pickup reminders, R1 Tiered Buyer Fee, "Legacy fee keys") are **NOT rendered** — the page drifted behind its own mirror test (`trade-timing-settings.test.ts` has the R2 guardrail, page.tsx does not). F01/F02/F04/F07/F11 remain Current.
   - **Action for the next agent:** this is a real **page regression** (admin UI), not just guide drift. Options: (a) restore the trade-timing page to render those sections (dev task), or (b) re-scope F03/F05/F06/F08/F10 in the guide and keep F09 on /analytics. The audit also lists copy/locator evidence (fee keys currently live/editable named `transaction_fee_subscriber_cents`/`…_non_subscriber_cents`).
2. **J01** — bare `/tax` has **no page** (`src/app/tax/` has only `nodes/ reports/ rules/ settings/ category-mapping/` subfolders). Fixed step to use sub-pages only; note the 404.
3. **L06** — legacy dashboard "SP Economy" nav card `card-sp-wallet` **removed** (grep = 0). Rewrote to the dashboard `sp-economy-summary` 4-tile section + `/sp-economy` hub → Wallets tab → `/sp-wallet` (sidebar links `/sp-economy`, not `/sp-wallet`).
4. **Q02/Q03** — confirmation copy corrected to live source (`src/app/reviews/page.tsx`): Hide = **"This will remove the review and notify everyone who reported it. Continue?"**; Approve/unhide = **"This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?"** (endpoints are `/api/reviews/*`, not `/api/admin/reviews`).
5. **W01** — OVERVIEW contains the **pinned Action Center + Dashboard together** (not Dashboard-alone; matches X09). Fixed the assertion.
6. Credential note recorded (staging admin = samer@samer.com / samer).

**Still-reachable-only-via-direct-URL/deep-link (no sidebar item) — not bugs:** `/audit-logs` (SQL-reference stub; superseded by `/audit`), `/monitoring` + `/monitoring/cron`, `/disputes`, `/sp-wallet`, `/sp-analytics`, `/settings/nodes`, `/subscriptions/manage`, `/payouts/earnings`.

---

## 4. ACC guide — audit result + rewrite (Sections 3 + follow-up)

File: `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (80 unique TC headings).
Audit report: `docs/guide-currency-audit-ACC-2026-09-02.md`.

**Audit verdict:** 66 Current, 4 Stale (F01, G02, G04, J08), **4 Dead (Group K — MFA/Privacy & Security)**, 6 fixture-gated.

**Rewrites applied (2026-09-02):**
1. **F01** (Suspended account) — live `SuspendedAccountScreen` shows 🚫 "Account Suspended" with **TWO actions**: in-app **Contact Support** (`suspended-contact-support-button`) AND **Log Out** (`logout-button`); **no support-email text**. Fixed the expected result.
2. **F02** — wording confirmed: unsubscribe is a **deep-link `token` route param** (route `Unsubscribe`), not "email token". Removed the stale re-verify caveat.
3. **G02** (dashboard banners) — no single grace>payment-fail>trial>draft cascade. Live: `TrialReminderBanner` + `PaymentFailureBanner` are **independent top banners**; grace/draft/ID CTAs live in a collapsible **"Action Items"** list (max 2 visible, `action-items-show-all/…-less`); draft buttons are **"Continue"/"Maybe later"** (`ResumeDraftBanner.tsx`). Rewrote.
4. **G04** (ID-verification CTA) — banner renders only for `none`/`rejected`; no pending/approved banner state. Rewrote.
5. **H01** — Help & Support entry is on **Profile** (not Settings — Settings has no Help row). Fixed the nav step.
6. **J08** (legal load failure) — TOS/Privacy show an inline "…not available" message with **NO Retry button**; only `LiabilityDisclaimerScreen` has a Retry. Rewrote expected results.
7. **Group K (K01–K04, MFA)** — **NOT IMPLEMENTED**: no MFA/Privacy & Security screen, route, or code exists (the Settings "Privacy & Security" row is an inert TODO stub at `SettingsScreen.tsx:158-164`). Marked the whole group 🚫 **NOT IMPLEMENTED (dead surface)** with per-case status notes; do NOT run. **Product decision pending**: implement MFA (then rewrite these cases) or formally drop FLOW-24.
8. Index rows + date + verification mapping synced (H06/H07 index rows that were missing were added).

---

## 5. MSG guide — audit result + rewrite (Sections 4 + follow-up)

File: `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (78 unique TC headings).
Audit report: `docs/guide-currency-audit-MSG-2026-09-02.md`.

**Audit verdict:** 59 Current, 6 Stale (B05, C05, C06, J01/J02/J03), 1 Dead-premise (J05), 12 fixture-gated/backend.

**Rewrites applied (2026-09-02):**
1. **B05** (Leaderboard) — `LeaderboardScreen` is registered but has **no in-app `navigate('Leaderboard')` caller**; reachable only via a `leaderboard_rank_up` notification or the `/leaderboard` deep link. Rewrote the entry + added the reachability flag.
2. **C01** — re-verify caveat **resolved**: `Alert('Success','Your review has been submitted!')` exists (`SubmitReviewScreen.tsx` L106).
3. **C05** (seller-profile review display) — live shows star row + numeric average + `(N reviews)` + section header `Reviews (N)`; the strings `"Average Rating: {x}/5"` / `"Total Reviews: {n}"` do NOT exist. Rewrote copy.
4. **C06** (report a review) — success copy is now **"Review reported. Thank you!"** (changed 2026-08-31), and a **4th option `Report Other`** exists (`review-report-other`). Rewrote.
5. **Group J (notification preferences)** — the previously-documented screen `src/screens/notifications/NotificationSettingsScreen.tsx` is **unregistered/dead** (only its own test imports it). The **live** screen is `NotificationPreferencesScreen` (route `NotificationPreferences`, entered from Settings), categories = {Subscription & Membership, Swap Points Events, Badges & Achievements, **Trades & Transactions**, System Updates} — **no `Safety Alerts` category, no `Trade Updates` label, no hardcoded defaults (DB-driven)**; footer copy = **"Critical system alerts and safety notifications cannot be disabled."** Rewrote J01/J02/J03; **J05** (ID-verification preference category) → 🚫 **NOT SUPPORTED** (no `id_verification` category in the `NotificationCategory` union).
6. Group header note + index rows + date + verification mapping synced.

**Also true (unchanged, for context):** quick-reply chips = 5-chip set (📅 Available today / 📆 Available tomorrow / 🗓 Suggest times / 📍 Public place only / ⏰ Running late); safety banner/modal = "Trade Smart, Trade Safe" with "Got it — Let's Trade Safely".

---

## 6. Deliverable files produced (all in the repo)

| File | Purpose |
|---|---|
| `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` | SUB guide finalized (§2) |
| `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` | ADM guide rewritten (stale/dead fixes + Group F flags) |
| `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` | ACC guide rewritten |
| `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` | MSG guide rewritten |
| `docs/guide-currency-audit-ADM-2026-09-02.md` | ADM audit report (per-section classification + evidence) |
| `docs/guide-currency-audit-ACC-2026-09-02.md` | ACC audit report |
| `docs/guide-currency-audit-MSG-2026-09-02.md` | MSG audit report |
| `docs/guide-currency-audit-FULL-REPORT-2026-09-02.md` | THIS file — full close-out for an external agent |

No code, DB, migration, or test-file changes were made. No staging mutation was executed. Tier 0 (compile/lint) is N/A — these are documentation-only edits.

---

## 7. What an external agent should do NEXT (recommended order)

1. **Dev fix — ADM Group F page regression (highest priority):** restore `/settings/trade-timing` to render the spec sections (seller/buyer fee params, Charge-One-Fee, Pickup & Payout, pickup reminders + R2 168h guardrail, R1 Tiered Buyer Fee, legacy-fee audit block) OR formally de-scope them in the guide (remove the BLOCKED-ON-PAGE banners once resolved). Mirror test `trade-timing-settings.test.ts` is the intended behavior reference.
2. **Product decision — ACC Group K (MFA):** decide implement-vs-drop. If implemented, rewrite K01–K04 against the new UI; if dropped, remove FLOW-24 from the header and delete the group.
3. **QA Task 20 unblock (subscriptions):** link a Stripe test Price to the Kids Club+ tier + deploy/point a non-DEV_MODE web build at staging (or flip local + `SUBSCRIPTION_WEB_SECRET`), then re-drive SUB's retired B/D/L web-first E2E legs (report recipe in `e2e-test-results/qa-task20-web-sub-e2e-2026-09-02/report.md` + `/memories/repo/qa-task20-web-sub-e2e-2026-09-02.md`). Use a disposable user (test-free/test-buyer are shared/stale).
4. **QA execution** can now proceed with accurate scope: SUB groups A/C/(I/J/K/M/N current), F/G05/H live-payout cases; ADM all but the flagged Group F cases + bare `/tax`; ACC all but Group K + the 4 corrected cases; MSG all but J05 + the corrected cases. Fixture-gated cases (noted per guide) require dedicated tooling (clock fast-forward, real push, DB fixtures).

---

## 8. Money/financial-state verification discipline (QA ground rules)

- **DB read-back is mandatory** for every money/SP/payout assertion (never trust the UI alone).
- Stripe test PaymentMethods must be created via magic token `card: { token: 'tok_visa' }`.
- Disposable-user cleanup: delete `profiles` rows by `user_id` (profiles.id ≠ user_id), then `admin.deleteUser`.
- Money-path verification must drive the ACTUAL charge/pay path on a fresh throwaway user — guard-path-only smokes hide broken pay paths.
- Read-only DB/Stripe verification is pre-approved (no per-call owner sign-off); mutating actions still need owner approval and safe fixtures.
- Admin portal client→API fetches must send `x-admin-secret: NEXT_PUBLIC_ADMIN_UI_SECRET`.

---

## 9. Do-nots / gotchas

- Do NOT edit root-level or `archive/misc.` guide copies (older duplicates). Canonical = `cross-checked-and-consolidated/`.
- Do NOT create a second copy of any guide or re-letter TC-IDs; keep every TC-ID grep-able (`^### <PREFIX>-TC-…`). If a case is dead, mark it (RETIRED / N/A / NOT IMPLEMENTED) rather than deleting the ID silently.
- When editing a guide section body, update that group's index/summary table AND the verification-checklist mapping AND the `Last updated:` header in the same pass (they drift independently).
- After batch edits, grep-verify every intended new string landed (silent partial-apply has occurred before).
- ADM `ADM-TC-R01–R03` appears twice (Education CMS group vs Regression) — disambiguate by line/context.
- Two same-named `HelpScreen.tsx` files are BOTH live: `src/screens/help/HelpScreen.tsx` = education/"How to Earn SP" (route `Help`); `src/screens/support/HelpScreen.tsx` = FAQ list (route `Support`).
- A stale top-level `src/screens/SignupScreen.tsx` exists (ZIP-based, no referral field, zero importers) — the live signup is `src/screens/auth/SignupScreen.tsx` (has the referral-code input).

---

*End of report. For deeper per-case evidence, see the three `docs/guide-currency-audit-*.md` files and the QA Task 19/20 run reports under `e2e-test-results/`.*
