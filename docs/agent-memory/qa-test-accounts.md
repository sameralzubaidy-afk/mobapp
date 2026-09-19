# QA standing test accounts / personas — staging (created 2026-08-16, Phase 13.8)

Maintained registry of standing staging personas for the QA Test Agent. **Check this file BEFORE creating a throwaway account** — reuse an existing persona wherever the case's `Setup:` calls for one. Passwords below are the documented, non-sensitive per-persona test passwords already committed in the repo's test fixtures (`p2p-kids-marketplace/scripts/seed-staging-data.ts`); reference personas by name in reports, do not echo credentials.

## Provisioning (dev-team task — NEVER run by the QA agent)
- Standing personas are provisioned/refreshed by the dev team via `npm run seed:staging` (or `--extended` for extra trade data) from `p2p-kids-marketplace/`. Cleanup: `npm run reset:staging` (clean + reseed). Source of truth: `TEST_USERS` in `scripts/seed-staging-data.ts` + the AUTH guide's "Accounts for testing" table.
- The agent must NOT create accounts via raw SQL or service-role writes. If a persona is missing/stale and can't be provisioned within an execution-only run, report a **setup gap** (BLOCKED).

## Standing personas
| Persona | Role / tier | Email | Node / ZIP | Subscription | Phone verified | Notes |
|---|---|---|---|---|---|---|
| new-user | Fresh, no account | any fresh email (e.g. `qa{timestamp}@kidsmarketplace.test`) | assigned during onboarding | None | not yet | Created **per-run via UI signup** (never pre-provisioned). Used for signup, onboarding, ZIP/waitlist tests. Password: any meeting app rules (e.g. fixture `TestPass123!`). |
| test-buyer | Kids Club+ subscriber | `test-buyer@kidsmarketplace.test` | active node (e.g. Norwalk, CT ZIP `06850`) | Kids Club+ Active | yes (onboarding completed — inferred) | Completed onboarding; in an active node; TradeFlow cases assume SP ≥ 15 after fresh seed. |
| test-free | Free tier | `test-free@kidsmarketplace.test` | active node (e.g. `06850`) | None | yes (onboarding completed — inferred) | Completed onboarding; cannot use SP. |
| test-seller | Kids Club+ subscriber | `test-seller@kidsmarketplace.test` | active node | Kids Club+ Active | **yes — explicitly documented** | Phone verified; used for listing creation; must be subscriber to offer Accept-SP listings. |
| admin | Admin portal | `test-admin@kidsmarketplace.test` | n/a | n/a | n/a | Full admin access (role = admin). Admin-web cases are OUT of scope for the QA agent (Playwright path) — listed for completeness. |
| qa-deleted (B08 fixture) | soft-deleted account | `qa-deleted@kidsmarketplace.test` | n/a | n/a | n/a | **Standing fixture — provisioned by `seed:staging` (2026-08-16).** Full normal profile with `deleted_at` set (`deletion_type='admin'`, reason `QA fixture: AUTH-TC-B08...`). Normal login → "Login Failed" dialog **"Your account has been deleted. Please contact admin-support@kidsmarketplace.app."** (`ACCOUNT_DELETED`). Password: `TestDeleted123!`. **NOTE:** the app keys the B08 branch off `profiles.deleted_at`, NOT `account_status` (the enum has no `'deleted'` value — the guide's "account_status = deleted" phrasing is doc drift). |
| qa-no-profile (B09 fixture) | auth-user-without-profile | `qa-no-profile@kidsmarketplace.test` | n/a | n/a | n/a | **Standing fixture — provisioned by `seed:staging` (2026-08-16).** Exists in `auth.users` (GoTrue login succeeds) with **NO `profiles` row** (profile hard-deleted after the signup trigger auto-created it; wallet/prefs/subscription rows may remain — harmless, login only checks `profiles`). Normal login → "Login Failed" dialog **"Profile not found. Please contact support."** (`PROFILE_NOT_FOUND`). Password: `TestNoProfile123!`. |
| qa-social-only (C07 fixture) | social-only (password-less) | `qa-social-only@kidsmarketplace.test` | active node (Norwalk CT, ZIP `06850`) | None | yes (onboarding completed) | **Standing fixture — provisioned by `seed:staging` (2026-08-24).** Auth user created via `admin.createUser` with **NO password ever set** (`auth.users.encrypted_password IS NULL` → `can_set_password()` RPC returns `true` → the Set Password modal is reachable in Settings → Linked Accounts). Completed profile (node/zip/onboarding/phone), `app_metadata` marked as Google social. User id `a1234567-0000-0000-0000-00000000000d`. **NO password — never set one.** See "C07 social-only fixture" section below for the login-leg operator step. |
| qa-linked-provider (C03 fixture) | password + linked Google | `qa-linked-provider@kidsmarketplace.test` | active node (Norwalk CT, ZIP `06850`) | None | yes (onboarding completed) | **Standing fixture — provisioned by `npm run seed:linked-provider-fixture` (2026-08-24).** Auth user WITH password (`TestLinked123!`) + ONE genuinely linked **Google** identity (operator SQL INSERT into `auth.identities`, synthetic provider id `qa-linked-provider-google`, identity email = fixture email) → Settings → Linked Accounts shows Google "Linked". Unlink flow (ACC-TC-C03 step 1: confirmation + success + "Active login methods" 3→2) fully testable via email/password login. **Method count = 3** (the user also carries the auto-created `email` identity + password): `check_account_exists_by_email` → `{exists:true, providers:[email,google], has_password:true}` (verified on staging 2026-08-24). User id `a1234567-0000-0000-0000-00000000000e`. See "C03 linked-provider fixture" section below for the operator SQL + last-method-guard note. |
| test-suspended (F01/F04 fixture) | suspended account | `test-suspended@kidsmarketplace.test` | active node (Norwalk CT, ZIP `06850`) | n/a | yes (onboarding completed) | **Standing fixture — provisioned by `seed:staging` (2026-08-25).** Full normal profile then `account_status='suspended'` (+`suspended_at`/`suspension_reason`, `suspended_by` NULL) → login lands on the **logout-only SuspendedAccountScreen** (gate: `AuthContext` enriches `session.user.account_status` from `profiles`; `AppNavigator` routes authenticated+suspended to the gate). User id `a1234567-0000-0000-0000-00000000000f`. Password: `TestSuspended123!`. See `seedSuspendedAccountFixture()` in `scripts/seed-staging-data.ts`. **Deep link escape if stuck:** `p2pkidsmarketplace://qa-logout`. |
| **test-buyer LEFT-STATE 2026-08-25 (B/H/I run) — seed restores:** `auth.users.phone`=**5551234002** (was 5551234001, via B03 verify), `profiles.phone`=**5551234001** (STALE — canonical B03 stack updates auth phone + verified flags but NOT `profiles.phone`; cross-table divergence, MOD finding, §5.35), `profiles.phone_verified_at`/`phone_verified`/`method='sms'` set. Email unchanged. 1 pending `email_change_verifications` row (`c1d80f61…`, new_email `test-buyer+new@…`, unverified, 24h expiry). 1 support_message ("QA Test Contact Subject"). 2 faq_votes (device-id scoped). education_analytics rows (help_view + calculator_use). **NOTE:** B09's already-verified Info path is OPTIMISTIC-ONLY (no persist); re-entering 5551234001 always hits it, so the phone cannot be restored via the app — use `seed:staging`.** |
| **test-buyer LEFT-STATE 2026-08-26 (Group J + email-stall run) — email RESTORED, no seed needed:** `auth.users.email`=**test-buyer@kidsmarketplace.test** = `profiles.email` (verified after a forward change to `test-buyer+stallcheck@…` + verify 123456 + restore). **Email-path Profile stall regression PASS** (Profile renders immediately after verify, no "Loading profile..." stall). 2 sealed `email_change_verifications` rows: `a87007d0` (stallcheck) + `4f225eb8` (restore), both verified_at+used_at — harmless. Phone `5551234002`, node Norwalk Central unchanged. |
| test-grace (G07 fixture) | grace-period persona | `test-grace@kidsmarketplace.test` | active node (Norwalk CT, ZIP `06850`) | **status `grace`** (grace_ends ~+60d) | yes (onboarding completed) | **Standing fixture — provisioned by `seed:staging` (2026-08-25) via `seedGracePersonaFixture()`.** Stacks **all 3 dashboard Action Items** (id_verification `none` + `grace_period` + 1 active `item_drafts` row) so ACC-TC-G07's "Show 1 more action"/"Show less" (MAX_VISIBLE=2) is demonstrable. User id `a1234567-0000-0000-0000-000000000011`. Password: `TestGrace123!`. **VERIFIED 2026-08-25: G07 3-CTA leg PASS on-device** (expand → 3 CTAs + Show less → collapse → 2 CTAs + Show 1 more action). Note: grace-status user sees the FREE SP strip ("Unlock Swap Points / Upgrade →") on Home — `get_subscription_status` normalizes `grace`→`grace_period`, which is not "active" for the SP-strip logic. Fixture left intact for future G07 re-runs. |
| test-expired (C09/D03 fixture) | genuinely-expired persona | `test-expired@kidsmarketplace.test` | active node (Norwalk CT, ZIP `06850`) | **status `expired`** (period/grace dates in the PAST) | yes (onboarding completed) | **Standing fixture — provisioned by `seed:staging` (2026-09-03, Dev Task R41) via `seedExpiredPersonaFixture()`.** `subscriptions.status='expired'` (CHECK-valid) + past `current_period_end`/`grace_ends_at`/`cancelled_at` + `sp_wallets.state='frozen'` (mirrors the grace cron's R6 expiry freeze). Login as the persona lands on the navigator's `SubscriptionExpired` initial route (D03 reachable branch); Manage Kids Club+ shows the expired info box + Re-subscribe CTA (C09). User id `a1234567-0000-0000-0000-000000000013`. Password: `TestExpired123!`. One-call login: `qa-login-as?persona=test-expired`. **NOTE (flagged gap):** SubscriptionExpiredScreen's "plan ended on {expiredDate}" copy branch needs route params {planName, expiredDate} that NO production path passes (navigator mounts it param-less → "no longer active" copy) — needs a product decision if the real date should be derived from the row. |
| qa-first-trade (F08 fixture) | FREE — genuinely-first-trade persona | `qa-first-trade@kidsmarketplace.test` | active node | **`status='free'` (trigger row only — NO trial/active)** | yes (onboarding completed) | **Standing fixture — provisioned ON DEMAND by the dev team via `npm run qa:r41-first-trade -- create` (DEV-TASK-113, 2026-09-05), NOT by `seed:staging`.** Zero trade history by construction (`profiles.fee_state` stays `no_completed_trade`, `completed_trade_count` 0) + a saved Stripe test card (MASTERCARD •••• 4444) → verifies `buyer_fee_first_trade_cents` (149 baseline) applies on the first offer and reverts to the normal fee on a second. Cleanup: `npm run qa:r41-first-trade -- reset` (BP-70 full user delete). User id `a1234567-0000-0000-0000-000000000014`. Password: `TestFirstTrade123!`. One-call login: `qa-login-as?persona=qa-first-trade`. |
| test-trial (G02 fixture) | Kids Club+ **Trial** (≤7d) | `test-trial@kidsmarketplace.test` | Norwalk CT `06850` | **status `trial`** (`trial_end_date` = now+5d) | yes (onboarding completed) | **Standing fixture — on-demand via `npm run qa:r41-trial -- ensure [--days-remaining N]` (Dev Task 120); clean revert `-- reset`.** Drives the dashboard `TrialReminderBanner` ("5 Days Left in Your Trial") + ContinueKidsClub trial-≤7d branch for ACC-TC-G02 / SUB-TC-N06. **Re-provisioned 2026-09-07** (days_remaining 5, trial_end 2026-09-12; QA Task 40 had deleted it). User id `a1234567-0000-0000-0000-000000000015`. Password `TestTrial123!`. One-call login `qa-login-as?persona=test-trial`. |
| test-payfail (G02 fixture) | Kids Club+ **active w/ payment failure** | `test-payfail@kidsmarketplace.test` | Norwalk CT `06850` | **status `active`** + `payment_retry_count`≥1 + `payment_failed_at` set | yes (onboarding completed) | **Standing fixture — on-demand via `npm run qa:payfail -- ensure [--retry-count 1\|2\|3]` (2026-09-07); clean revert `-- reset`.** Drives the dashboard `PaymentFailureBanner` for ACC-TC-G02 (banner renders whenever `payment_retry_count>=1` — the `get_subscription_status` RPC never returns `payment_failed_at`, so `isRecentFailure` falls back true; retry 1 = "Retry 1 of 3" medium tier). **Provisioned 2026-09-07** (retry 1, active, future period, auto-renew). User id `a1234567-0000-0000-0000-000000000016`. Password `TestPayfail123!`. One-call login `qa-login-as?persona=test-payfail`. |

## Item-2 fixtures — Accept-SP item + Connect-enabled seller (provisioned 2026-08-28, dev-team)

- **Accept-SP item (A02 / FLOW-11 C04-C05 fixture):** `LEGO Star Wars Set` (id `b3ab73b6-26ba-4e98-8e3c-d83e4b75a99e`, $30, `accepts_swap_points=true`, status `available`, `approved_at` set) under **test-seller**. It was already available+approved; the durable fix is in the seed (`scripts/seed-staging-data.ts` now resets `status` → `available` for `['sold','pending','unavailable','paused']` — a PAUSED listing was previously never reset). Re-seed preserves it.
- **Connect-enabled seller (FLOW-22 fixture) — ⚠️ STALE, corrected 2026-09-18 (FIX-Task-62):** live read shows test-seller has **0** `seller_payout_methods` rows, so its **14** `requires_action` payouts (**19** `seller_payouts` rows in total = **14 `requires_action` + 5 `failed`**; the counts were 18/1 before FIX-Task-62's Fix E terminalised 4 orphaned trade-less parked rows on 2026-09-18) are correctly parked (it is the standing negative-control fixture for that state). Historical entry follows: test-seller had ONE `seller_payout_methods` row (`fcc0aa5f-ea70-41dd-8cff-ae71985821e5`, `method_type='stripe_connect'`, `is_primary=true`, `is_verified=true`, `stripe_onboarding_complete=true`) backed by a real test-mode Stripe Connect **custom** account **`acct_1U9DMMKX7Q9JD914`** (US individual, `details_submitted=true`, **`transfers` capability active**, bank account attached; charges/payouts remain `pending_verification` in test mode — that does NOT block `initiate-payout`'s `transfers.create`). `profiles.stripe_connect_account_id` DOES NOT EXIST on staging (BP-73 — do not reference it).
- **Verified end-to-end (backend, 2026-08-28):** synthetic completed trade → `initiate-payout` → real Stripe transfer `tr_1U9DTY4I6kCJlvXoasgL8h12` ($30) and DB recorded `trades.payout_status='paid'` + `stripe_transfer_id` + `payout_paid_at` (columns added by migration `20260828000000_add_trades_payout_columns.sql`). `create-stripe-connect-account` (with seller JWT) returns the existing account idempotently (no duplicate). `sync-stripe-connect-status` syncs the method. `process-paypal-payout`/`release-payment` are NOT seller-payout functions (PayPal-specific / PaymentIntent-release) — guard-path only.

## Dev Task 25 — QA friction fixes (2026-08-28) — session-local toggles + fixtures

New self-service QA session-local toggles (arm via `xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=<short>&value=<value>"`; all fail-closed in release builds; cleared on logout):
- **`card_decline`** (`qa_local_card_decline`, values `hold_decline`|`none`) — TRD-TC-B06 unblock: when armed, `createTradeOfferWithHold` returns `STRIPE_HOLD_FAILED` ("Your card was declined.") WITHOUT invoking the EF → no offer created, no SP reserved. Submit with a NORMAL valid card to drive the decline at the hold step (PaymentSheet validates cards at entry, so a real declining card never reaches the hold).
- **`config_fetch_failure`** (`qa_local_config_fetch_failure`, values `fetch_failure`|`none`) — TRD-TC-B05i unblock: when armed, `getAdminConfig` fail-softs to defaults AND `createTradeOfferWithHold` returns `CONFIG_UNAVAILABLE` ("Offer limit configuration is unavailable. Please try again."). Reproduces the config-fetch-failure graceful-degradation WITHOUT touching shared-staging admin_config.
- **`keyboard-done-button`** — iOS keyboard accessory "Done" button (`testID: keyboard-done-button`) on the SP amount inputs of `TradeOfferScreen` + `TradeInitiationScreen`; one-tap keyboard dismiss instead of the hardware-keyboard keystroke.

New seed fixtures (`npm run seed:staging`):
- **QA in-node item pool:** 6 always-available listings owned by test-seller (`QA_POOL_LISTINGS`, e.g. "Remote Control Car", "Kids Kindle Tablet", "Soccer Ball & Goal Set", "Puzzle Set — 4 Pack", "Roald Dahl Collection", "Skateboard — Youth") — the 3 seeded pending trades used to leave only 2 available on-node items.
- **TRD-TC-B08 canned cancelled-trade conversation:** dedicated "QA Canned Cancelled-Trade Item" listing + a `cancelled` trade (buyer_cancelled) + 2 exchanged messages between test-buyer & test-seller → the frozen-chat case no longer depends on leftover data.
- **Pending-trade reset:** `npm run reset:pending-trades` (= `npm run cleanup:trades`) now clears ALL pending/payment_failed offers where buyer is test-buyer OR seller is test-seller (per-seller cap counts every buyer's offers against the seller) + resets listings to available.

Modal locators now stable: `TradeConfirmationModal` buttons `trade-confirm-button`/`trade-cancel-button` defaults + per-instance overrides (`accept-trade-confirm-button`, `decline-trade-confirm-button`, `complete-trade-confirm-button`, `confirm-all-trades-button`, `cancel-all-trades-button`, `extension-accept-button`/`extension-decline-button`, `notif-ok-button`, `offer-limit-view-offers-button`); `CancellationReasonModal` reason rows `cancellation-reason-<id>` + footer `cancel-trade-keep-button`/`cancel-trade-confirm-button`. AX-tree helper: `npm run qa:ax-tree -- <resource-file> --name <anchor> [--max N] [--list]` (`scripts/qa/ax-tree.mjs`).

Pre-existing (NOT from Task 25): `TradeOfferScreen › submits trade after disclaimer accept` unit test FAILS on HEAD too; full `yarn lint` has 98 pre-existing errors in untouched files.


## Dev Task 44 — Test-Infra Round 2 (2026-08-29) — forced-card toggle + AX-viewport + keyboard-done app-wide

**STATUS: `get-payment-method` EF DEPLOYED (v28, 2026-08-29 12:08) + buyer-3 valid card PROVISIONED.** Live verification PASSED: plain + `force_card=mastercard_4444` both return test-buyer's MASTERCARD •••• 4444 (`pm_1To5Vb4I6kCJlvXoCUYo0CI3`); test-buyer's stored card is already the valid MASTERCARD (flakiness resolved).

New session-local QA toggle (same arm pattern as above; fail-closed in release; cleared on logout):
- **`payment_card`** (`qa_local_payment_card`, values `mastercard_4444`|`visa_4242`|`none`, or a raw `pm_...` id) — fixes the #1 measured QA bottleneck (non-deterministic saved-card selection between a valid MASTERCARD 4444 and an invalid VISA 4242 on the same customer). When armed, `getPaymentMethod` sends `force_card` to the `get-payment-method` EF (deployed v28), which returns THAT specific saved card (matched by brand+last4 or pm id) and persists it to `subscriptions.stripe_payment_method_id`. Arm e.g. `xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=payment_card&value=mastercard_4444"`.
- **buyer-3 valid card fixture — DONE (2026-08-29):** `npm run qa:ensure-buyer3-card` (`scripts/qa/ensure-buyer3-valid-card.mjs`, `--dry-run` to preview) attached a valid MASTERCARD •••• 4444 (created from `tok_mastercard`, BP-69) to test-buyer-3's Stripe customer `cus_V9pjqgGrgMlKNq` (PM `pm_1U9l644I6kCJlvXoCCKRUJik`) and persisted it to `subscriptions.stripe_payment_method_id` — unblocks the 3-buyer TRD-TC-B03 variant. Reads the Stripe key from `~/.dt11-stripe-key`.
- **`qa:ax-tree` viewport/occlusion flags:** `--screen-width W --screen-height H --pill-top N --pill-bottom M` (POINTS) annotate elements `⚠ below-viewport` / `⚠ under-pill` — catches off-screen Send-Offer and pill-occluded Report-Problem before a silent no-op tap. Screen size auto-detects from the tree if flags omitted.
- **`keyboard-done-button` is now app-wide:** `<KeyboardDoneAccessory />` is mounted once at the app root (AppNavigator); ALL non-test/non-.old TextInputs carry `inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}` (shared `ui/TextInput`, `shared/TextInput`, `atoms/Input` + every raw `<TextInput>` screen/component). Login fields included (they use `@/components/ui` TextInput).
- **`qa:badge-scan` token syntax:** accepts a bare leading color name (`SP100,rmin=250,...`) as well as `name=SP100,...`; error messages state the exact syntax.
- **`qa:badge-scan` reads 0% on ALL-GRAY regions (not just thin text) — a 0% is never a negative.** ImageMagick dumps an all-gray crop as grayscale, so there are no `srgb(r,g,b)` triples for ANY token to match. FIX-Task-65 proved it with an any-colour control token (`rmin=0,rmax=255,gmin=0,gmax=255,bmin=0,bmax=255`): **0 px (0.00%)** on the gray privacy-box region vs **302,400 px (100.00%)** on the coloured error region of the same screenshot. On neutral/gray surfaces use `qa:inspect-screen`'s 12-colour histogram (e.g. 368,570 px of `#F7F7F7`) or a single-pixel sample instead. A *large solid coloured* fill IS reliable per-region (R62e: 97.48%).
- **`reset:pending-trades` also clears cart_items** for test personas (test-buyer, test-free, test-buyer-2, test-buyer-3) so a run never starts with months-old stale cart rows.

## Dev Task 51 — QA Toolkit Round 2 (2026-08-29) — 7 friction-removal tools + standing rules

New QA tooling (all in `p2p-kids-marketplace/`, npm scripts in package.json). Standing rules R23–R28 encoded in `.github/instructions/QA-Test-Agent.instructions.md` §5.40.

- **Offer-fixture reset — `npm run qa:reset-offer-fixtures [--persona X] [--dry-run]`** (`scripts/qa/reset-offer-fixtures.mjs`): clears `cart_items` + cancels ALL pending/payment_failed offers for the QA buyer personas (test-buyer, test-free, test-buyer-2, test-buyer-3) + resets listings to available. Run at the START of any session touching offers/bundles to prevent `MAX_PENDING_OFFERS`/already-in-active-trade collisions. Buyer-side counterpart to `npm run cleanup:trades`. **`--dry-run` is truly read-only** (was a real bug — the cart delete ran before the guard on v1).
- **One-call persona login — `p2pkidsmarketplace://qa-login-as?persona=<name>`** (`src/components/QaLoginAsDeepLinkHandler.tsx`, registry `src/services/qaPersonas.ts`): collapses the 8–10-call email/password login to 1, via the CANONICAL path (`loginWithContext` → `AuthContext.setSession`, same as LoginScreen). **Also auto-accepts current TOS + Privacy Policy** for the persona (PolicyReacceptanceGate skips while the handler runs — gate-flag via `isQaLoginAsInProgress()`). Personas: test-buyer, test-free, test-seller, test-seller-2/-3, test-buyer-2/-3, test-grace, test-suspended, test-admin, qa-deleted, qa-no-profile, qa-linked-provider. `qa-social-only` deliberately ABSENT (password-less). Gated dev/staging only.
- **Valid saved cards for ALL buyers — `npm run qa:ensure-cards [--persona X] [--dry-run]`** (`scripts/qa/ensure-valid-cards.mjs`): generalized `ensure-buyer3-valid-card.mjs` to all QA buyers (test-buyer, test-free, test-buyer-2, test-buyer-3); MASTERCARD •••• 4444 from `tok_mastercard` (BP-69), persisted to `subscriptions.stripe_payment_method_id`. Verified 2026-08-29 dry-run: all 4 already have valid 4444 cards. Legacy `qa:ensure-buyer3-card` still works.
- **Force seller TradeSuccess — `p2pkidsmarketplace://qa-trade-success?role=seller&listingType=cash_only&tradeStatus=completed[&tradeId=<uuid>]`** (`src/components/QaForceTradeSuccessDeepLinkHandler.tsx`): force-renders the TradeSuccess screen with explicit params — unblocks TRD-TC-H04 (seller "Sold for cash!" CTA) on one simulator. Requires session (login via qa-login-as first). Dev/staging gated.
- **Bundle fixture generator — `npm run qa:create-bundle-fixture -- --buyer <name> --seller <name> --count N [--dry-run]`** (`scripts/qa/create-bundle-fixture.mjs`): creates N same-seller items + preloads the buyer's active cart as one bundle (single bundle_id/cart_id) in one call.
- **EF repro harness — `npm run qa:ef-repro -- --persona X --ef create-trade-offer --items <id>[,<id>] [--fee-mode cash_only|donate] [--pm <pm_id>] [--body '<json>']`** (`scripts/qa/ef-repro.mjs`): JWT exchange + service-role reads + POST to the EF with the app's exact headers, prints the RAW response — read the backend error (`NO_PAYMENT_METHOD` vs `MAX_PENDING_OFFERS` vs `TRADE_INSERT_ERROR`) before concluding a UI failure is an app bug. Has fixed-UUID persona fallback (listUsers pagination misses early-created personas like test-buyer).
- **Alert dismissal — `GlobalAlertProvider` now MOUNTED at the app root (AppNavigator)**: routes EVERY `Alert.alert` through an AX-exposed branded modal (buttons get accessible+role+testID `global-alert-button-N`). Trade-accept confirmations on ReviewOfferScreen converted to explicit `showAlert` with deterministic testIDs: `offer-accepted-ok-button`, `bundle-accepted-ok-button`, `offer-declined-ok-button`. No native UIAlertController blocks QA anymore.
- **Items 8/9 (DT49 admin sidebar, DT48 Basket CTA):** scoped in their own tasks — NOT re-implemented here.


## Admin portal QA credentials — Group L (Playwright path) — added 2026-08-21

The admin web app (`p2p-kids-admin/`, repo `mobappadmin`, branch `develop`) is exercised by the QA agent via **Playwright** (browser session), NOT via the mobile persona registry above. Group L (`AUTH-TC-L01`–`L04`, listing approval flow) needs a real admin sign-in against the target env.

**Fill in the placeholders below LOCALLY** — the QA agent must never invent or request credential values, and must never echo them in a report/log/issue body (reference this persona as `admin-qa` only).

| Field | Local value (fill in) | Where it lives |
|---|---|---|
| Admin QA email (username) | `test-admin@kidsmarketplace.test` | `test-automation/trade-flow-v2/.env` → `PLAYWRIGHT_ADMIN_EMAIL` (the Playwright spec also accepts `ADMIN_E2E_EMAIL`) |
| Admin QA password | `<REDACTED - see password manager or .env.local>` (test-only staging credential — never commit) | same file → `PLAYWRIGHT_ADMIN_PASSWORD` / `ADMIN_E2E_PASSWORD`; also in `p2p-kids-admin/.env.local` (git-ignored). Values are single-quoted in both files so `$1` survives shell `source`. |
| Admin base URL — local | `http://localhost:3001` | `p2p-kids-admin/playwright.config.ts` `baseURL` / `ADMIN_BASE_URL` |
| Admin base URL — staging | `___FILL_IN___` (Vercel deploy URL; project `mobappadmin` per `.vercel/project.json`) | `p2p-kids-admin/.env.staging` |
| Run gate | `true` | `PLAYWRIGHT_ADMIN_E2E` (Playwright specs self-skip unless set) |

Notes:
- The account must have a `role_based_access_control` row with `role='admin'` on the target env, or login shows "You do not have admin access. Contact your administrator." (see `src/app/auth/login/page.tsx`).
- **`test-admin@kidsmarketplace.test` — RESOLVED as the Group L admin (2026-08-21).** Was doc drift (no admin rbac row, verified Phase 16). Now: user id `e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f`, email confirmed, `role_based_access_control` row `role='admin'` (granted 2026-08-21, mirroring samer's row), complete profile (onboarding_completed, node `550e8400-…`). Password: **user-provided automation credential** (requested as the test-admin password; verified working via GoTrue password-grant login 2026-08-21). **NOW FILLED (2026-08-21)** into `test-automation/trade-flow-v2/.env` (`PLAYWRIGHT_ADMIN_EMAIL`/`PASSWORD` + `ADMIN_E2E_*`) and `p2p-kids-admin/.env.local` (`ADMIN_E2E_*`) — both git-ignored local files, do NOT commit. Values are single-quoted (the `$1` must survive shell `source`). The documented `samer@samer.com` portal credential remains available but is no longer required for the Playwright path.
- The login page's hardcoded `admin@example.com` demo box does NOT exist on staging (returns "Invalid login credentials") — never use it for real runs.
- ⚠️ **The "read `.env.local` inside the script" pattern is NOT available in the `run_playwright_code` sandbox** — `require` is not defined, so `fs`/`dotenv` cannot be loaded there. The in-script credential read works only for a Node-run script, never the inline browser tool. Establish the admin session some other way (owner-supplied credential, or a manual sign-in in the shared page), and **never echo the credential**. Trap this caused (2026-09-18, MSG Round 2): the unavailable fallback *looked* like a credentials gap and cost 4 admin cases (E01/E04/E05/H01) a premature BLOCKED. It is not a gap — see the "try every documented pair" candidate in `rule-candidates.md`.
- Group L E2E scaffold: `p2p-kids-admin/__tests__/group-l-listing-approval.e2e.test.ts` (gated by `PLAYWRIGHT_ADMIN_E2E`).
- **Group L run status 2026-08-21 (QA) — EXECUTED, 4/4 PASS:** the scaffold carries REAL AUTH-TC-L01–L04 assertions (serial chain; DB read-backs via service-role client; `/listings` UI approval). Credential gate CLEARED; full run executed with mobile legs via mobile-mcp on the simulator: **L01 PASS, L02 PASS, L03 PASS (incl. on-device NotificationCenter green Tag icon + tap→Item Detail), L04 PASS** (seller edit price 15→25 → reapproval trigger reverted to pending). Two spec fixes applied during the run: (1) `ensureAdminSession` must `waitForURL('**/auth/login**')` — the admin app's auth guard is client-side (ProtectedLayout → getUser → router.push), so checking `page.url()` right after `goto('/listings')` races the redirect; (2) L02 post-approval badge check must switch the filter to `active` and poll-and-re-search (the auto-refresh runs with the stale `pending` filter and clobbers results). Run command: `cd p2p-kids-admin && PLAYWRIGHT_ADMIN_E2E=true npx playwright test --grep "L0[1-3]" --reporter=list`; L04: `--grep "editing the approved listing"`. Evidence/report: `e2e-test-results/group-l-playwright-l01-l04-2026-08-21/` (`report-execution.md`, `screenshots/`, `execution-trace-l01-mobile-prep.md`, `decision-outcome-log.md` — the full action→reasoning→tool-call→outcome trace with (a)/(b)/(c) derivations, reference format per the Phase 25 Group K decision log).
- **test-buyer waitlist state (2026-08-22, CLOSED — see below):** the stale `zip_waitlist` row for ZIP 99999 (created by the Group O O03 run's old auto-enroll) was DELETED (id `86d1eec9-d1b5-4567-af52-56c57d9c469f`); test-buyer then had 0 waitlist rows. Combined with the ZIP-waitlist scope-decouple fix (Discover only treats a row for the user's OWN home ZIP as "waitlisted"), test-buyer's Discover default is node-scoped (Norwalk Central).
- **Group O final closure (2026-08-22, `e2e-test-results/group-o-closeout-o03-o01-2026-08-22/`):** O03 re-verify against the updated guide = **PASS** (fix `47a20dfb`). Inactive ZIP 99999 now asks explicit **Yes/No**; **No** → 0 rows (DB-proven); **Yes** → exactly 1 row created ONLY at the Yes tap (`5b67f3ed-5170-48f0-a139-d8f4b8729641`, requested_zip 99999, status pending). Scope stays node-scoped ("71 results · near CT", Show All Nodes toggle visible) even after opting in, incl. across remount. Dialog buttons (`inactive-zip-waitlist-yes/no`, `inactive-zip-back-to-filters`, `inactive-zip-see-all-results`) are now AX-exposed (accessible+role+label added in `47a20dfb`). O01 sanity PASS. **Item 3 (separate locator-gap/admin fix) still outstanding** except the dialog AX portion: `filter-modal-apply` + RadiusSlider −/+/track still not AX-exposed; admin `/settings/nodes` still lacks `node-settings-*-input`/`btn-save-node-settings` testIDs (Save button is a plain `<button>`) and `handleSave` doesn't refresh `last-updated-*` meta. **CLEANUP NEEDED (dev-team):** delete `zip_waitlist` row `5b67f3ed-5170-48f0-a139-d8f4b8729641` to restore the 0-row baseline for future O03 re-runs.
- **Group O locator-gap + cleanup fixes (2026-08-23, DEV — RESOLVED):** Fix 1 (BP-53): `filter-modal-apply`, `filter-modal-close`, `filter-modal-reset` now carry `accessible`+`accessibilityRole="button"`; RadiusSlider `−`/`+`/track now carry `accessible`+role+label with testIDs `radius-slider-decrease`/`radius-slider-increase`/`radius-slider-track`. **KEY ON-DEVICE FINDING (RN 0.81 Fabric): the track with `accessibilityRole="adjustable"` did NOT surface in the iOS AX tree; changing it to `"button"` made it surface — same class of issue as the `tab` note.** All verified on-device via mobile-mcp list_elements_on_screen (Discover → Filters modal). Fix 2: admin `/settings/nodes` now has `node-settings-default-radius-input`/`-max-assignment-input`/`-distance-warning-input`/`-allow-user-radius-adjustment`/`-min-user-radius-input`/`-max-user-radius-input` + `btn-save-node-settings`; `handleSave` now re-fetches `getAdminConfigMeta` → `last-updated-*` meta refreshes after save (verified in-browser: 8/22→8/23 timestamps; note: the real save re-wrote same values and changed those 6 keys' `updated_by` to `samer@samer.com`, +1 admin_audit_log row). Fix 3: test-buyer `zip_waitlist` row `5b67f3ed-5170-48f0-a139-d8f4b8729641` (ZIP 99999) DELETED (0-row baseline restored) and `user_preferences.preferred_radius_miles` reset 25→15 (DB-verified: 0 waitlist rows, radius 15).
- **test-seller phone_verified_at now SET (2026-08-21, 16:55Z)** — was NULL at Group L run start (registry "phone verified: yes" was doc drift). Verified via the on-device phone-verification gate (DEV bypass `123456`). Shared-persona state change; leave as-is unless a phone-unverified seller is needed for a case.
- **Re-verify run 2026-08-21 (Group L closeout, `e2e-test-results/group-l-reverify-l01-l04-2026-08-21/`):** throwaway fresh user `qa.alice.17873458702106256@kidsmarketplace.test` (user `df5b8011-5200-4c1d-8cd7-6503ede2a1c4`) now **phone-verified** (consumed — no longer an unverified persona); its item `945d43df` left pending. Test-seller anchor item `83c8823b-0089-4602-afe6-183997f1aa1d` "QA Dev Fixture Item" price 25 — **now `available`** (re-approved during the post-run admin-evidence capture via `capture-admin-evidence.cjs`; a fresh pending anchor is needed for any future L01 re-run). Prior `cc81e86c`/`f5bac12c` remain available. Admin dev server was restarted (stale 404 state).
- **Admin §5.20 evidence gap closed (2026-08-21):** the Group L spec has NO `page.screenshot()` calls, so a passing run saves no admin screenshots. Post-run capture via `capture-admin-evidence.cjs` (CommonJS; run from p2p-kids-admin with `NODE_PATH=$PWD/node_modules`; reads creds from `.env.local`; run dir is 2 levels under workspace, NOT 3) produced `ADMIN-L02-01..05` screenshots (pending queue → details modal → confirm → approval alert → available). Lesson: admin-side visual evidence for passing Playwright runs needs an explicit screenshot step (spec edit or capture script) — noted for the playbook.

## Secondary personas (competing-offer / multi-party trade cases)
| Persona | Role / tier | Email | Subscription | Notes |
|---|---|---|---|---|
| test-seller-2 | Kids Club+ subscriber | `test-seller-2@kidsmarketplace.test` | Kids Club+ Active | second seller for competing-offer scenarios; node NULL on staging (reach via deep link). Seed (`--extended`) now resets its 3 items to `available` on re-seed (B05e needs 2+). |
| test-seller-3 | Kids Club+ subscriber | `test-seller-3@kidsmarketplace.test` | Kids Club+ Active | **TRD-TC-B05e fixture, provisioned 2026-08-28 (Dev Task 20).** Third seller for the no-global-cap case. User id `a1234567-0000-0000-0000-000000000012`, password `TestSeller3123!` (fixture). 3 available items: "Kids Bike Helmet", "Chapter Book Box Set", "Building Blocks Bucket" (idempotent by title, reset-to-available on re-seed via `seedSeller3()` in `scripts/seed-staging-data.ts`, `--extended` mode). Node assigned via `signupTestUser` (Norwalk Central on re-seed). |
| test-buyer-2 | competing-offer buyer | `test-buyer-2@kidsmarketplace.test` | — | competing-offer buyer |
| test-buyer-3 | competing-offer buyer | `test-buyer-3@kidsmarketplace.test` | — | competing-offer buyer |

## Admin-config writes during QA runs — STANDING RULE (Dev Task 20, 2026-08-28)

**Standing rule (embedded in `.github/instructions/QA-Test-Agent.instructions.md` §5.37a):** any test case with a dependency on an admin-portal or admin-config change MUST be executed end-to-end for real — never SKIPPED/BLOCKED solely because the change originates on the admin side. This SUPERSEDES the older "QA agent must NOT self-arm shared-staging config — dev-team task" language for ONE well-scoped, reversible category: `admin_config` writes for a specific test value, through the shared RPC, reverted afterward. It does NOT extend to any other table or to raw table writes.

**Two sanctioned mechanisms:**
1. **Admin-portal Playwright path** (REQUIRED for admin-UI-assertion cases like B05h; preferred for B05f/g/j admin leg): `p2p-kids-admin` at `http://localhost:3001`, `PLAYWRIGHT_ADMIN_E2E=true`, creds from `test-automation/trade-flow-v2/.env` (`test-admin@kidsmarketplace.test`). Settings → Trade Timing → `input-max_pending_offers_per_seller` → Save → assert `success-banner`/`error-*`.
2. **Shared-RPC direct write** (BP-48, never a raw table write):
   ```sql
   SELECT * FROM public.upsert_admin_config_setting(
     p_key => 'max_pending_offers_per_seller', p_value => '5',
     p_category => 'feature_flags', p_data_type => 'number',
     p_is_secret => false, p_is_active => true, p_admin_id => 'e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f');
   ```
   Note: on staging this key's category is `feature_flags` (the admin Trade Timing page writes that category), not the migration's original `trade` — use `feature_flags` so the write matches what the admin UI produces.

**Discipline:** scope to the test value → verify on-device → revert to pre-run value → verify revert via read-only SQL (`SELECT value FROM admin_config WHERE key=...`). If the case tests persistence (B05g), verify the revert-and-persist explicitly. Record writes/reverts in the run report.

**Baseline (2026-08-28):** `max_pending_offers_per_seller` = `3`, category `feature_flags`, active, updated_by `1a546991-...`. Revert target after any B05f/g/j write.

**B05 batch CLOSED 2026-08-28 (Dev Task 20) — 6/6 PASS, executed end-to-end with real admin-side changes** (report: `e2e-test-results/qa-trd-b05e-j-admin-deps-2026-08-28/report.md`): B05e (no global cap; 6 offers / 2 per seller via UI; needs test-seller-3 ✓) · B05f (admin 3→5 via Trade Timing page, immediate effect, 6th blocked) · B05g (revert 5→3, forward-looking, existing 4 offers survived, 5th blocked) · B05h (validation: 0→"Must be at least 1", 11→"Maximum is 10", 3→saved) · B05i (config-fetch-failure toggle → "Offer limit configuration is unavailable. Please try again.", no trade, no crash; disarmed → offer succeeds) · B05j (per-seller + cap=5 cross-referenced from B05e/B05f; bundle=1 verified at EF layer — `countPendingSlotsForSeller` dedups by `bundle_id`; cart-UI leg not re-driven, recommended dedicated pass). Final state: cap=3, test-buyer 0 pending, test-seller-3 intact. Standing rule embedded at `.github/instructions/QA-Test-Agent.instructions.md` §5.37a (admin-side deps executed for real; Playwright path + shared-RPC write pattern; scope+revert discipline).

## External OAuth test accounts — REAL external accounts (use sparingly)
Distinct from the app-internal staging personas above. These are **real external Google/Facebook accounts** (not `@kidsmarketplace.test` fixtures; NOT committed in seed data or fixtures). Credentials are sensitive — **never echo a password in a report, log, issue body, or chat summary**; reference by persona name only. Use deliberately for social-login completion cases (AUTH-TC-C01/C02/C04), never in tight automated loops — Google/Meta anti-automation detection (CAPTCHA, device-verification challenges) can interrupt a session. If an unexpected challenge screen appears mid-OAuth-flow, treat it as an **environment/account-risk blocker** (honest BLOCKED, same discipline as other unreachable states) — NOT an app defect.

| Persona | Provider | Email | Notes |
|---|---|---|---|
| google-oauth-test-user | Google | `kidsp2p@gmail.com` | Real external Google account. Added as a Test User in the Google Cloud Console OAuth consent screen (required while the app is in "Testing" publishing status). Password: `<REDACTED - see password manager or .env.local>` — stored in registry (real external credential — sensitive, never echo in reports/chat). |
| facebook-oauth-test-user | Facebook | `kidsp2p@gmail.com` | Real external Facebook account — manually created dummy account (Meta deprecated/restricted the official Test Users API for most apps ~2023, so this is the practical alternative). Confirmed working via manual on-device login test. Password: `<REDACTED - see password manager or .env.local>` — stored in registry (real external credential — sensitive, never echo in reports/chat). |

## Per-run throwaway emails (NOT standing personas)
- **Group J+H closure 2026-08-24 (`e2e-test-results/group-j-h-closure-2026-08-24/`):** H01 throwaway `qa.alice.17876013524609211@kidsmarketplace.test` (profile `3a98fe7b-3c33-493c-ba10-af6ec7dc61b7`, name "H01 Avatar Persist", zip 06850, node Norwalk Central, **avatar_url SET** `avatars/f9edb222-…jpg`, phone_verified, profile_completed) — logged in at Home; cleanup candidate. test-seller gained a NEW draft `667898b8-74c9-4b5b-9c71-8a44bc2dbf62` (3 dev-fixture photo URLs, reordered [1093661, 1175644, 1129292], step "details") — cleanup candidate alongside pre-existing `466c440d`/`0a8d54b8` (both from dev fixture verification; all in sync column↔draft_data after the merge_item_draft migration).
- `qaparent@kidsmarketplace.test` — used in Phase 14 Group S (password recovery) as a per-run UI-created account. **Not a standing fixture**; recreated per run. Its password is throwaway — store separately, do not commit.
- **Group F run 2026-08-23 (Groups F+G batch):** three throwaway UI-created accounts — `qa.alice.17875246083483536@kidsmarketplace.test` (F01, node Norwalk Central, no waitlist), `qa.bob.17875248862184744@kidsmarketplace.test` (F02/F03, node Little Falls Central, **HAS zip_waitlist row `b1129e6c-e1dd-465e-aa2a-8c37312beda6` for 07999, pending — cleanup candidate**), `qa.charlie.17875251796216233@kidsmarketplace.test` (F04, node Little Falls Central, 0 waitlist rows). Passwords are the fixture test-user passwords (TestPass123!-style), throwaway.
- **Admin node state left by Groups F+G run (2026-08-23):** QA nodes `0c1195ef-2d2e-4794-acda-53ffca93dc63` "QA Auto G01 Active EDITED" (ZIP 10001, active) and "QA Auto G02 Inactive" (ZIP 90210, inactive) created via admin UI (G01/G02/G03); Test Node 1 (`550e8400-…0000`) deactivated then reactivated (state restored). `nodes.member_count` is stale on staging (Norwalk Central=0 though 145 profiles assigned; Test Node 1=100 though 0 profiles) — admin stats/deactivation warning read the stored column; a backfill is recommended (not a test failure).
- **H01 spot-check 2026-08-24 (report `e2e-test-results/spotcheck-h01-avatar-carousel-2026-08-23/`):** throwaway `qa.alice.17875311421161451@kidsmarketplace.test` (user `8dba7348-ee7b-4182-a52f-a72662f5b145`) — phone-verified, profile completed (name "H01 Spot Check Parent", zip 06850, node **Norwalk Central**), **`avatar_url = NULL`** (dev-set-avatar fixture URI fails ImageManipulator preprocess → Warning → non-blocking), onboarding **skipped** 00:32:48Z. **H01 preview sub-assertion UNBLOCKED + PASS; persistence leg NOT MET until fixture fix (file:// URI).** Carousel slide 3 typo **FIXED** on-device: "How You Earn PIPs (Pass It Up Points)" (commit `f4d3de8e`). Cleanup candidate.
- **Group H run 2026-08-23 (report `e2e-test-results/group-h-profile-setup-2026-08-23/`):** throwaway accounts — `qa.alice.17875266480161531@kidsmarketplace.test` (user `0fcfbcdc-…`, phone-verified, **profile INCOMPLETE** — got stuck in the native photo-picker crop editor during H01's avatar attempt before submit; `onboarding_skipped_at` set, node NULL — cleanup candidate) and `qa.bob.17875274353311948@kidsmarketplace.test` (user `19f20454-…`, name "H01 Test Parent B", zip 06850, **Norwalk Central**, `profile_completed=true`, `onboarding_completed_at` 23:26:54, avatar_url NULL, 0 waitlist). Group H verdicts: H01 PASS (avatar-preview sub-assertion TOOLSET-LIMITED — native photo-picker crop editor "Cancel/Choose" rejects all toolset taps/swipes, same class as CategorySelectModal; needs a dev avatar fixture), H02 PASS, H06 PASS (Skip→Home + Get Started→Home; **Phase 24 no-tab-bar-after-Skip bug is FIXED** — tab bar mounts immediately), H07 PASS (relaunch→straight Home both paths), H03 BLOCKED (`qa_avatar_upload_failure` still `none` — dev must arm), H04/H05 BLOCKED (orphaned routes; reachable only via deep links). **Defects found:** (1) WelcomeScreen `welcome-headline` renders literal `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button"` junk text (accessibility props pasted as string content — orphaned route so latent); (2) onboarding carousel slide 3 title typo "How You Earn PIPs ( Pass It Up **Pionts**)".
- **Group I run 2026-08-23 (report `e2e-test-results/group-i-subscription-choice-2026-08-23/`):** AUTH-TC-I01–I03 all **BLOCKED** — the Subscription Choice (Onboarding) screen does NOT exist in the build (HEAD `24fbd0be`). No `SubscriptionChoiceScreen.tsx` anywhere; `SubscriptionChoice` route maps to `JoinKidsClubScreen` (R7 web-first, zero purchase UI); nothing navigates to it; post-Profile-Setup lands on the 5-slide EDU carousel → Home. On-device confirmed with throwaway `qa.alice.17875322953503556@kidsmarketplace.test` (user `cbaca155-2e1b-41ab-bef2-bc36ad1392aa`, name "Group I Test Parent", zip 06850, node Norwalk Central `550e8400-…`, phone_verified, `onboarding_skipped_at` 2026-08-24 00:47:24Z, **0 subscription rows, trial_uses_count 0** — free tier, never offered trial). **admin_config: `trial_enabled=false`, `trial_period_days=30`, `max_trial_uses=1`**. Cleanup candidate account.
- **Dev Task 11 subscription idempotency fixture (2026-08-27, DISPOSABLE — soft-deleted):** throwaway `qa.dt11.sub.1787865162@kidsmarketplace.test` (user `5114896d-5104-46d4-acce-f54d43f9430f`, sub row `bd06f0c3-ea6a-457b-9a0b-f0a3ba8e6928`, Stripe customer `cus_V9TZk8dbXI3GW6`) used for the DT-11 real-activation verification of `create-subscription-from-payment-method` / `renew-subscription` / `retry-failed-payment`. **CLEANED UP**: all Stripe subs canceled, PMs detached, `subscriptions.status='cancelled'`, profile soft-deleted (`deleted_at` + `deletion_type='admin'` + reason "Dev Task 11 throwaway subscription verification fixture (disposable)") → login = ACCOUNT_DELETED. Do NOT reuse; a fresh throwaway is created per-run. Test-mode Stripe customer/charges remain on `acct_1ShGft4I6kCJlvXo` (harmless, test mode).
- **Group I CLOSED OUT as a product decision (2026-08-24, dev commit `a6b97c0b`, local-only):** project owner decided the native Subscription Choice (Start Free Trial / Continue Free) screen is **NOT implemented — permanently**. Web-first `JoinKidsClubScreen` purchase path is the intended design (`SubscriptionChoice` route → `JoinKidsClubScreen` per `AppNavigator.tsx` L562). The QA guide now deprecates **AUTH-TC-I01–I03** (REMOVED, mirroring H04/H05) in `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (index L69–71, bodies L1015–1036, checklist L2423). Decision logged durably in **`docs/DECISIONS.md` D-001** (new standing decisions log) incl. a FLAG of trial-backend deprecation candidates (`create_trial_subscription`, `upgrade_free_subscription_to_trial`, `checkTrialEligibility`, `enrollInTrialSubscription` — no live UI callers; **`signupWithTrial` at `src/services/auth.ts:137` is STILL LIVE** via `src/screens/auth/SignupScreen.tsx:294` but is a misnomer — it creates a FREE subscription, not a trial → rename/cleanup candidate, keep-vs-remove review as a separate future task). `docs/flow-registry.md` SUB-020 L3100 corrected (route → JoinKidsClubScreen, permanent). **`admin_config.trial_enabled=false` on staging is CONFIRMED intentional — do not flag as a bug.** Future QA: Group I is not a runnable batch; do not re-report it BLOCKED.

## Gaps / not determinable (flagged, not guessed)
- Per-persona node membership is not pinned in the seed script — the active-node ZIP (`06850`, Norwalk CT) is the documented example from the AUTH guide preconditions; treat node assignment as seed-dependent (verify by logging in).
- Only `test-seller`'s phone-verified status is explicitly documented; `test-buyer`/`test-free` "yes" is inferred from onboarding completion (onboarding includes phone verification).
- Exact SP balance / ledger state is seed-dependent; TradeFlow cases needing SP ≥ 15 assume a fresh `seed:staging` (or `--extended`). Flag as setup gap if balances are stale.
- Admin portal browser-verification creds (`samer@samer.com` / `samer`, staging UI) are documented in repo instructions — not a persona of this registry (admin-web is the Playwright path).
- **Resolved 2026-08-16 (Consolidated QA Backend Fixture Provisioning):** B08 (soft-deleted) + B09 (no-profile) are now STANDING fixtures via `seed:staging` (see Standing personas table); S03 (rate-limit) + S04 (SMTP-500) are now an ON-DEMAND staging toggle (see "QA auth error-simulation toggle" section) — these were the Phase 14 "not inducible on healthy staging" blockers. Provisioning still requires the dev team to run `npm run seed:staging` and to arm/disarm the S03/S04 toggle; the QA agent executes only.
- **Resolved 2026-08-16 (External OAuth creds registered):** the "no test credentials documented" gap for **AUTH-TC-C01 (Google)** and **AUTH-TC-C02 (Facebook)** is resolved via the "External OAuth test accounts" section above (`google-oauth-test-user` / `facebook-oauth-test-user`, email `kidsp2p@gmail.com`, passwords stored in registry). **AUTH-TC-C04 (account-linking):** the credential portion is resolved (both OAuth accounts can complete a real login), but the case STILL needs the OAuth email to collide with an *existing* app account. **Phase 20 (2026-08-16) — collision setup is IMPOSSIBLE via UI for this email:** `kidsp2p@gmail.com` is a SINGLE confirmed social-only auth user (no password); GoTrue `POST /auth/v1/signup` with it returns **HTTP 422 `user_already_exists` / "User already registered"** (verified). A distinct password account for this email cannot be created — the earlier "UI password signup on staging" suggestion is infeasible. C04 needs a dev-provisioned collision fixture via a NON-UI mechanism (e.g., a password account + a separate OAuth identity sharing an email under a permitted config). C01/C02 now test the RETURNING-USER login for this email (not first-time signup) — first-time profile auto-fill needs a fresh never-used email/account.
- **OAuth credential usage (cumulative, as of Phase 21 2026-08-16): Google ×4, Facebook ×4** (Phase 18 ×1 each + Phase 19 ×1 each + Phase 20 ×1 each + Phase 21 Google ×1). **Phase 21: AUTH-TC-C01 (Google) CLOSED — PASS** on the final attempt. No password typed (cached returning-user consent). The Phase 20 C01 FAIL is confirmed as an **automation-tap-timing artifact on the Google account-chooser step** (the deliberate pause before tapping the account row fixed it: re-list → confirm row stable → then tap; identical setup works for manual touch + automated tap-with-pause). Evidence: JS console (`Auth session result: success`, `Setting session from implicit flow tokens`, `[NAV] route: Home`), AsyncStorage `sb-drntwgporzabmxdqykrp-auth-token` present, device-log callback delivery, `auth.users.last_sign_in_at` = 2026-08-17 00:39:37Z. The Google OAuth logging fix (console.log of result.errorCode/errorMessage in SocialLoginButtons) is in place and capturable via the Hermes CDP inspector (`ws://localhost:8081/inspector/debug?device=...&page=1` — the Metro `/json` endpoint; this SOLVES the Phase 20 P2 console-inaccessibility bottleneck).


## Reset-link minting harness (QA password-reset happy path — added 2026-08-16)
Unblocks AUTH-TC-S08 (success → Login) and AUTH-TC-S11 Case 2 (tokenized link) in the simulator, which has no mail client. Uses the **existing** `admin-trigger-password-reset` Edge Function — no new endpoint.

**Exact call (from any HTTP client with an admin JWT):**
```
POST https://<staging-ref>.supabase.co/functions/v1/admin-trigger-password-reset
Authorization: Bearer <admin JWT>      # admin caller, role = admin
apikey: <anon key>
Content-Type: application/json
Body: { "email": "test-buyer@kidsmarketplace.test", "return_link": true }
```
**Admin JWT source (Phase 16 verified 2026-08-16):** the RBAC admin on staging is **`samer@samer.com`** — mint the JWT by password-grant login with it. `test-admin@kidsmarketplace.test` has **NO** `role_based_access_control` row on staging (verified via SQL) → the harness returns `403 Forbidden: Admin access required` with its JWT. The registry's `admin` persona row is doc drift vs. staging reality; the working admin is the documented portal-verification cred (`samer@samer.com`).
(Alternatively `{ "target_user_id": "<uuid>", "return_link": true }` — `email` is the QA convenience; `target_user_id` remains the canonical admin path.)

**Response shape:**
```json
{ "success": true, "message": "Password reset link minted for test-buyer@kidsmarketplace.test",
  "resetLink": "https://<ref>.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=..." }
```
`resetLink` is present ONLY when the staging gate is active; otherwise the response is the legacy email-only `{ success, message }`.

**Convert to a simulator deep link (open the app's ResetPassword screen with the tokens):**
1. **The minted `resetLink` is the OTP form**, NOT the fragment form (Phase 16 verified): `https://<ref>.supabase.co/auth/v1/verify?token=<OTP>&type=recovery&redirect_to=http://localhost:3000`. The `access_token`/`refresh_token` are only issued by the **web redirect exchange** (what a browser does when the user taps the email link).
2. **Exchange the OTP for the tokens** (the `.auth/v1/verify` POST returns `otp_expired` — do NOT use that path; use the GET redirect instead):
   ```
   curl -s -o /dev/null -D - "https://<ref>.supabase.co/auth/v1/verify?token=<OTP>&type=recovery&redirect_to=p2pkidsmarketplace%3A%2F%2Freset-password" -H "apikey: <anon>"
   # → HTTP/2 303, Location: p2pkidsmarketplace://reset-password#access_token=<AT>&...&refresh_token=<RT>&type=recovery
   ```
3. `xcrun simctl openurl booted "p2pkidsmarketplace://reset-password#access_token=<AT>&refresh_token=<RT>&type=recovery"` — **warm only** (ResetPassword already mounted via a plain `p2pkidsmarketplace://reset-password` openurl first; cold/fragment-from-Landing delivery is unreliable — the fragment URL from an unmounted state is ignored by React Navigation).
4. Complete the reset as per AUTH-TC-S08 steps.

**Security posture (mandatory for the QA agent):**
- The `resetLink` is a session-minting credential — treat it as a SECRET. NEVER echo the link/tokens in a report, log, or issue body; redact it (e.g. `<resetLink redacted>`).
- Gating is fail-closed: returning the link requires BOTH `return_link: true` in the body AND the server-side `APP_ENV` function env var == `staging`/`development`. Otherwise the endpoint returns `403 { error: { code: 'LINK_RETURN_DISABLED' } }` and behaves like the legacy email-only path. Service-role key stays server-side and is never returned/logged.
- **Setup status: ✅ LIVE as of 2026-08-16.** `APP_ENV=staging` is provisioned on the staging project (`drntwgporzabmxdqykrp`) and `admin-trigger-password-reset` is deployed at **v17** (`verify_jwt: true`) with the mint-and-return logic. QA can now use the harness directly. If a call ever returns `403 LINK_RETURN_DISABLED`, re-check the `APP_ENV` secret — do not treat it as a test failure.
- **Phase 16 closeout (2026-08-16):** S08 + S11 Case 2 executed via this harness — both PASS. Security-boundary re-confirmed: live negative call (no `return_link`) returns email-only with NO resetLink; code-verified that non-staging `APP_ENV` → `403 LINK_RETURN_DISABLED` (fail-closed). `test-buyer`'s password was changed during S08, then **reset back to the fixture value** (`TestBuyer123!`, per seed) and re-verified by login — the shared persona is left in the documented fixture state.

## QA auth error-simulation toggle — AUTH-TC-S03 (rate-limit) / AUTH-TC-S04 (SMTP-500) — added 2026-08-16

Unblocks S03 ("Reset Email Failed — requested too frequently") and S04 ("Possible causes: SMTP/email provider not configured...") in the simulator, on demand, WITHOUT genuinely exhausting GoTrue's per-email/IP rate limit or breaking staging SMTP for all traffic.

**Mechanism (dev-only, fail-closed):** `ForgotPasswordScreen` (dev/test builds only) checks an `admin_config` toggle before the real GoTrue call. When armed, it short-circuits with a **faithful synthetic GoTrue error** that flows through the screen's existing error-branching, so the exact alert copy from the AUTH guide renders. Release builds (`__DEV__` false) and any toggle unset/unknown → `null` → the real `resetPasswordForEmail` always runs. Implemented in `src/services/devTestingService.ts` (`getSimulatedForgotPasswordError`, reads the toggle via the anon-granted SECURITY DEFINER RPC `fn_get_admin_config_values` — required because `admin_config` RLS is authenticated/service-role-only and this screen is pre-login).

**Toggle key:** `qa_reset_error_simulation` — values `rate_limited` | `smtp_500` | `none` (absent/`none`/unknown = no simulation).

**Arm / disarm (DEV-TEAM task — the QA agent must NOT self-arm: it is execution-only and the write touches shared staging config):**
```sql
-- ARM (S03)
SELECT * FROM public.upsert_admin_config_setting(
  p_key => 'qa_reset_error_simulation', p_value => 'rate_limited',
  p_category => 'feature_flags', p_data_type => 'string',
  p_is_secret => false, p_is_active => true, p_admin_id => '<admin user id>');
-- ARM (S04)
... p_value => 'smtp_500' ...
-- DISARM (after run)
... p_value => 'none' ...
```
`p_admin_id` = `samer@samer.com`'s staging user id (records the editor per BP-48; the shared 7-arg RPC, not a direct table write). Category must be an `admin_config_category` enum value (`feature_flags` is the right bucket).

**QA usage (after dev arms it):** fresh dev build → Login → Forgot Password → enter ANY valid-format email (e.g. `test-free@kidsmarketplace.test`) → Send Reset Link → expect:
- S03: alert **Reset Email Failed** / "You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes." + Open Supabase Docs + OK.
- S04: alert **Reset Email Failed** / base message + "Possible causes: • SMTP/email provider not configured in Supabase Auth • Redirect URL not allowed in Auth settings" + "Check Supabase Auth > Email Settings and Email Logs." + Open Supabase Docs + OK.
No real reset email is sent in either case (the call is short-circuited), so no state changes.
**Reminder for the run:** if the alert does NOT appear, the toggle is unset/unknown OR the build is a release build OR `fn_get_admin_config_values` is missing on the target DB (deployment lag) — check the toggle value first, don't treat it as a test failure. Disarm to `none` after the run.

**No-code fallback (S03 only, if the toggle is not available):** genuinely exhaust GoTrue's recovery rate limit — loop `POST <ref>.supabase.co/auth/v1/recover` (body `{"email":"<dedicated fixture email>","options":{"redirect_to":"p2pkidsmarketplace://reset-password"}}`, header `apikey: <anon>`) ~30+× in an hour until a `429`. CAVEAT: the limit is keyed per email+IP, so hammering can briefly throttle other staging clients from the same egress IP — prefer the toggle. Use a dedicated throwaway email, never a shared persona.

## QA avatar-upload failure simulation toggle — AUTH-TC-H03 — added 2026-08-18

Unblocks H03 ("avatar upload fails during Profile Setup → profile still created without avatar") on demand, WITHOUT breaking storage or network. Implemented in `src/services/devTestingService.ts` (`getSimulatedAvatarUploadError`, reads the same anon-granted SECURITY DEFINER RPC `fn_get_admin_config_values`) and injected at the top of `uploadProfileAvatar` (`src/services/profile.ts`). When armed, the simulated error flows through `ProfileSetupScreen`'s existing non-blocking branch (Warning alert → profile created without avatar). Fail-closed: release builds / toggle unset → real upload always runs.

**Toggle key:** `qa_avatar_upload_failure` — values `upload_failure` | `none` (absent/`none`/unknown = no simulation).

**Arm / disarm (DEV-TEAM task — the QA agent must NOT self-arm: execution-only; write touches shared staging config):**
```sql
-- ARM
SELECT * FROM public.upsert_admin_config_setting(
  p_key => 'qa_avatar_upload_failure', p_value => 'upload_failure',
  p_category => 'feature_flags', p_data_type => 'string',
  p_is_secret => false, p_is_active => true, p_admin_id => '<admin user id>');
-- DISARM (after run)
... p_value => 'none' ...
```
`p_admin_id` = `samer@samer.com`'s staging user id (records the editor per BP-48). Category must be an `admin_config_category` enum value (`feature_flags`).

**QA usage (after dev arms it):** fresh dev build → signup → Profile Setup → select an avatar → expect the **Warning** alert "Profile will be created without avatar. You can add it later." and the profile completes WITHOUT an avatar. Disarm to `none` after the run.

**Status: ✅ VERIFIED 2026-08-18.** H03 executed on-device with the toggle armed → Warning alert shown + profile created without avatar (non-blocking path confirmed). Toggle lifecycle that day: armed 16:15Z → disarmed 16:24Z → re-armed 16:25Z → **disarmed 17:06Z (current state = `none`)**. Real uploads work normally.

**Node-assignment fix (2026-08-18):** RESOLVED & APPLIED to staging. The "Per-persona node membership is not pinned in the seed script" gap was fixed in the SEED SCRIPT (`seed:staging` now assigns/re-assigns `profiles.node_id` for standard personas even on re-seed). **VERIFIED 2026-08-18 (combined-verification run):** after the user re-ran `npm run seed:staging`, `test-buyer` now HAS `profiles.node_id = 550e8400-e29b-41d4-a716-446655440001` (Norwalk Central, zip 06850) on `drntwgporzabmxdqykrp` (read-only SQL + Home header "Norwalk Central"). **AUTH-TC-F06 re-run natively as test-buyer = PASS** (toggle `discover-show-all-nodes-toggle` renders Off; default count 66 = node's `available` items; On → 1207 "all nodes" + `…-other-node-badge`s; Off → 66). Backend now honors `p_node_ids` in `search_listings`/`count_listings` (Phase 24 "backend ignores p_node_ids" finding RESOLVED). Minor cosmetic: first Discover load shows page-size fallback (20) before `count_listings` resolves. E05 phone-gate + C04 findings: see `e2e-test-results/qa-combined-verify-e05-c04-f06-2026-08-18/report.md`.


## C04 account-linking collision fixture — PROVISIONED 2026-08-19 (staging) via `npm run seed:c04-fixture`

- **What it is:** a staging-only NON-UI fixture that makes `AccountLinkingPrompt` fire for AUTH-TC-C04. `kidsp2p@gmail.com` (user A) is now password-capable, and its **Facebook identity was MOVED** to a new fixture user (B). A **Facebook** sign-in now lands on B while the email is owned by A → `checkAccountExists(email).userId !== sessionUserId` → the prompt fires (password re-auth mode, because A has_password=true).
- **Provider for C04 = FACEBOOK.** Google stays on A (C01 returning-user path intact). Consequence: a Facebook sign-in now resolves to B instead of A — C02 is already closed, so this is acceptable; note it if C02 is ever re-run.
- **User A** = `kidsp2p@gmail.com` (id `27699457-3d25-4c82-bb75-5ad10fd60228`): password now `TestC04Link123!` (documented fixture credential; `has_password` true), identities = `[google]` only.
- **User B** = `qa-c04-account-link@kidsmarketplace.test` (id `a1234567-0000-0000-0000-00000000000c`, password `TestC04Link123!`, email-confirmed): owns the moved facebook identity (`provider_id 122126097519161744`, identity email `kidsp2p@gmail.com` preserved) + its own `email` identity.
- **QA reproduction (exact steps):** Login → tap **Facebook** button → complete OAuth with `facebook-oauth-test-user` (`kidsp2p@gmail.com`) → expect **AccountLinkingPrompt** "An account with kidsp2p@gmail.com already exists" + option to continue/link with **password re-authentication**. Sanity: tapping **Google** should NOT show the prompt (lands on A itself).
- **Verified (read-only SQL + script re-run 2026-08-19):** `check_account_exists_by_email('kidsp2p@gmail.com')` → `{exists:true, user_id:27699457…, providers:[google], has_password:true}`; A identities `[google]`, B identities `[facebook, email]`. Script idempotent (re-run safe).
- **Rollback (restore original state):** `UPDATE auth.identities SET user_id='27699457-3d25-4c82-bb75-5ad10fd60228' WHERE id='2920f416-dfce-478f-a001-c9b0f58fae54' AND provider='facebook';` then optionally delete B (`auth.admin.deleteUser`) and clear A's password (admin update). 
- **Tooling:** `p2p-kids-marketplace/scripts/provision-c04-collision-fixture.ts` + `npm run seed:c04-fixture`. The identity move is a separate operator SQL step (printed by the script); supabase-js cannot write `auth.identities`.
- **Durability:** `reset:staging`/`clean:staging` only deletes test-buyer/seller/admin — A and B survive reseeds.
- **VERIFIED 2026-08-19 (final QA combined run, `e2e-test-results/qa-final-verify-e05-c04-2026-08-19/`):** Facebook OAuth (`facebook-oauth-test-user`, "Continue as Sam") → **AccountLinkingPrompt fires** with "An account with email kidsp2p@gmail.com already exists." + password re-auth (session JWT sub = B `a1234567-…-c`, `app_metadata.providers:[facebook,email]`, identity email kidsp2p@gmail.com → checkAccountExists→A ≠ session B → prompt). Google sanity → **no prompt**, lands on A (`27699457-…`; CDP `[NAV] route: Home` + `view_recommendations user_id:27699457…`; A last_sign_in 13:05:02Z). Fixture intact after run (A `[google]`, B `[email,facebook]`). **C04 = PASS.** Nuance: attempting to COMPLETE the link raises `EmailMismatchError` (B's account email ≠ identity email) — the fixture exercises prompt+re-auth display, NOT link-completion; a different fixture shape is needed to test the successful-link leg.


## C07 social-only fixture — AUTH-TC-C07 — added 2026-08-24

Unblocks C07 ("Social-only user sets a password") on demand. Provisioned as a standing fixture by `npm run seed:staging` (new `seedSocialOnlyFixture()` in `scripts/seed-staging-data.ts`, called right after `seedQaAuthFixtures()`).

**What it is:** an auth user `qa-social-only@kidsmarketplace.test` (id `a1234567-0000-0000-0000-00000000000d`) created via `admin.createUser` with **NO password ever set** (`app_metadata: { provider: 'google', providers: ['google'] }`, `email_confirm: true`) + a normal **completed** profile (node Norwalk Central `06850`, onboarding, phone verified). Because `auth.users.encrypted_password IS NULL`, `can_set_password()` returns `true` → `SetPasswordModal` is reachable (Settings → Linked Accounts → Set Password).

**Login leg (operator step — required for the QA agent to sign in as this user):** signing IN via social requires an OAuth identity attached to this user. supabase-js cannot write `auth.identities`; GoTrue has no transfer endpoint — the C04 fixture's mechanism (an operator SQL `UPDATE auth.identities SET user_id=...`) applies. Attach a real Google identity (the only real Google account `kidsp2p@gmail.com` is already taken by user A, so a NEW real Google account is needed, OR the QA can verify the Set-Password state via the fixture's existence + `can_set_password` without completing the OAuth login leg). The seed script verifies the password-less precondition via `check_account_exists_by_email` (expects `has_password: false`).

**Seed verification output:** `✓ C07 VERIFY OK: account exists, NO password (can_set_password=true expected)`.

**STATUS 2026-09-07 (post-QA-Task-41 fixes) — C07 now drivable up to the real-OAuth leg:**
- QA Task 41 (2026-09-06) found the staging fixture had DRIFTED to a bcrypt password (`auth.users.encrypted_password` non-null, len 60) → `can_set_password()` false → C07 blocked (GitHub #19).
- **Fixed 2026-09-07:** (1) `encrypted_password` NULLed via operator SQL — verified `can_set_password(...)=true`, `check_account_exists_by_email(...).has_password=false`. (2) **`can_set_password` RPC did NOT exist on staging** (only `check_account_exists_by_email`); without it `canSetPassword()` fails closed → `setPasswordForSocialUser()` rejects every attempt `NOT_ALLOWED` — so it was CREATED + applied (migration `20260420000017_can_set_password_rpc.sql`, SECURITY DEFINER, grants authenticated-only, mirrors `...000015`). (3) **`SetPasswordModal` was orphaned** (LinkedAccounts `set-password-button` was a "Coming Soon" stub) — now wired in `LinkedAccountsScreen.tsx` (opens the modal when `!hasPassword`; `onSuccess` reloads → row flips to "Password ✓ set").
- **Remaining leg (manual, blocked on external):** attach a REAL Google identity to `...000d` via the real-OAuth operator step (one real Google sign-in on a throwaway user → `UPDATE auth.identities SET user_id='a1234567-0000-0000-0000-00000000000d'` → delete throwaway). `kidsp2p@gmail.com` is taken by user A (id `27699457-…`), so a NEW real Google account is needed; Manual Linking is ENABLED on staging (since 2026-08-25), which supports the identity op. The Set-Password state itself (modal open → set → row flips) can be verified WITHOUT completing the OAuth login leg once a synthetic identity makes the fixture reachable via a session.
- **C07 consumes the fixture** (it gains a password) — restore (NULL pw + identity) before any re-run.

## QA provider-outage simulation toggle — AUTH-TC-C05 — added 2026-08-24

Unblocks C05 ("Provider unavailable → email fallback banner") on demand, WITHOUT breaking a real provider. Implemented in `src/services/devTestingService.ts` (`getSimulatedProviderOutage`, reads the same anon-granted SECURITY DEFINER RPC `fn_get_admin_config_values`) and injected at the top of `initiateSocialLogin` (`src/services/oauthService.ts`). When armed for the requested provider (or `all`), it throws a FAITHFUL `ProviderUnavailableError` BEFORE any real OAuth interaction → SocialLoginButtons' existing catch renders the inline "{Provider} is temporarily unavailable. Sign up with email instead?" banner. Fail-closed: release builds / toggle unset / unknown value → real OAuth always runs.

**Toggle key:** `qa_provider_unavailable` — values `google` | `facebook` | `apple` | `all` | `none` (absent/`none`/unknown = no simulation).

**Arm / disarm (DEV-TEAM task — the QA agent must NOT self-arm: execution-only; write touches shared staging config):**
```sql
-- ARM (simulate Google down)
SELECT * FROM public.upsert_admin_config_setting(
  p_key => 'qa_provider_unavailable', p_value => 'google',
  p_category => 'feature_flags', p_data_type => 'string',
  p_is_secret => false, p_is_active => true, p_admin_id => '<admin user id>');
-- ARM (all providers)
... p_value => 'all' ...
-- DISARM (after run)
... p_value => 'none' ...
```
`p_admin_id` = `samer@samer.com`'s staging user id (records the editor per BP-48). Category must be an `admin_config_category` enum value (`feature_flags`).

**QA usage (after dev arms it):** fresh dev build → Login (or Signup) → tap the armed provider's button (e.g. Google) → expect the inline banner "{Provider} is temporarily unavailable. Sign up with email instead?" + `provider-error-cta` "Use Email" button; no crash, no provider browser opens. Disarm to `none` after the run.

## P03 unread-message fixture — AUTH-TC-P03 — added 2026-08-24

Unblocks P03 ("Header chat icon opens Messages with an unread badge"). test-buyer had **zero** `messages` rows after a fresh seed, so the header chat badge could never render. `seed:staging` now seeds ONE trade-scoped message **from test-seller → test-buyer** with `read_at IS NULL` (`seedUnreadMessageFixture(buyerId, sellerId)` in `scripts/seed-staging-data.ts`, run after the trades are seeded) → `getTotalUnreadMessageCount` returns 1 → the header chat icon badge shows `1`. Opening the chat calls `mark_trade_messages_read` → `read_at` set → badge clears (P03's read flow).

**FIX 2026-09-07 (P03 re-runnability):** the old guard skipped if *any* non-deleted seller message existed on the target trade (checked only `deleted_at`, never `read_at`) — so after the QA read the message, a re-seed never restored the unread state. The guard is now **self-refreshing**: if a non-deleted seller→buyer message exists on the chosen trade it `UPDATE`s `read_at = NULL` (restores unread); otherwise it inserts. The target-trade pick is also narrowed to `status IN ('pending','in_progress')` + `seller_id = sellerId` so it never collides with the B08 cancelled-trade fixture or DT-96 threads. Re-running `seed:staging` now reliably re-creates the badge = 1 fixture.

## C03 linked-provider fixture — ACC-TC-C03 — added 2026-08-24

Unblocks C03's unlink flow ("On a linked provider, tap Unlink and confirm"). Provisioned as a standing fixture by `npm run seed:linked-provider-fixture` (`scripts/provision-linked-provider-fixture.ts`).

**What it is:** `qa-linked-provider@kidsmarketplace.test` (id `a1234567-0000-0000-0000-00000000000e`, password `TestLinked123!`) — a password-capable auth user (email/password login works) with a **completed profile** (Norwalk CT 06850, onboarding, phone) and **ONE genuinely linked Google identity** (operator SQL `INSERT INTO auth.identities` — see below). Settings → Linked Accounts → Google shows **"Linked • qa-linked-provider@kidsmarketplace.test"** + an Unlink button.

**Operator SQL (supabase-js cannot write `auth.identities`; apply on staging, then re-run the script to verify):**
```sql
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'a1234567-0000-0000-0000-00000000000e', 'qa-linked-provider-google',
  jsonb_build_object('sub','qa-linked-provider-google','email','qa-linked-provider@kidsmarketplace.test','email_verified',true,'name','QA Linked Provider'),
  'google', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;
```

**QA reproduction (unlink flow):** Login (email/password `TestLinked123!`) → Settings → Linked Accounts → Google "Unlink" → confirmation alert → Unlink → "Success" alert → Google "Not linked" → "Active login methods: 2". (Method count starts at **3** because the fixture also carries the auto-created `email` identity + password; `user_linked_providers` includes that `email` row but the screen only renders social providers google/facebook/apple, so it's harmless.)

**Last-method guard (C03 step 2) — honest limitation:** the "Cannot Unlink — you must keep at least one login method" alert only fires when `countLoginMethods() <= 1`, which requires a **social-only** persona (no password + exactly one provider). A password-bearing user can never reach it (the password always counts as a method). The natural guard fixture is the existing **C07** social-only user (`qa-social-only@...`, password-less) once a REAL provider identity is operator-attached (count = 1) — same login-leg mechanism as C07's documented note. No C04 fixture is touched.

**QA VERIFIED 2026-08-24 (Group EFG+C03 run) — C03 UNLINK BLOCKED BY BACKEND CONFIG:** the unlink flow fails with **"Failed to unlink identity: Manual linking is disabled"** (Hermes CDP-captured console.error; 3 consistent attempts; DB-closed: google identity still in `auth.identities`, no audit row). Root cause = **staging Supabase Auth has "Manual Linking" DISABLED** (Dashboard → Authentication → Settings) → GoTrue `DELETE /user/identities/{provider_id}` refuses. This blocks C03 AND real `linkIdentity`/`unlinkIdentity` on staging. **Fix = one-toggle backend config (dev/ops), NOT code or fixture.** Re-run C03 after enabling. Fixture `qa-linked-provider@…` left INTACT (google still linked, methods:3) for the re-run.
- **C03 CLOSED 2026-08-25 (Groups A-G full-closure run):** Manual Linking now ENABLED → unlink SUCCEEDS. UI: "Success / google account unlinked successfully" → Google "Not linked", "Active login methods: 2"; DB: `auth.identities` now email-only (identity_count=1), has_password=true. **⚠️ FIXTURE NOW CONSUMED:** Google identity removed; re-provision via `npm run seed:linked-provider-fixture` before any future C03 unlink re-run. C04 (email-mismatch on link) also PASS this run via the session-local `link_email_mismatch=facebook` toggle (self-armed deep link) → "Email Mismatch" alert, no link, no stuck spinner.

## QA push simulation toggle — AUTH-TC-A03 — SESSION-LOCAL since 2026-08-25

Unblocks A03 ("Test Push Notification") on the simulator, where `Device.isDevice` is false so no real Expo push token exists → `sendPushNotification` hits "No push tokens registered" before the rate-limit / quiet-hours / send legs. Implemented in `src/services/devTestingService.ts` (`getPushSimulationMode`) and consumed in `sendPushNotification` (`src/services/pushDelivery.ts`). **Session-local (AsyncStorage) since 2026-08-25** — the QA agent arms/disarms it itself via a deep link, no SQL, no human operator step, no shared-staging blast radius. Fail-closed: release builds / toggle unset / expired / unknown → real push path always runs.

**Deep link key (short name):** `push_simulation` → AsyncStorage key `qa_local_push_simulation`. Values `token` | `rate_limited` | `quiet_hours` | `none` (absent/`none`/unknown = no simulation).

**Arm / disarm (QA agent — self-service, session-local, no DB write):**
```
# ARM (token mode — normal leg)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=token"
# ARM (rate_limited / quiet_hours)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=rate_limited"
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=quiet_hours"
# DISARM (after run)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_simulation&value=none"
```
Confirm arming via console (Hermes CDP): `[QaDevToggleDeepLink] Armed push_simulation=token`. The toggle auto-expires after 60 min (TTL safety net) and is cleared on logout — so a logout-then-different-persona run starts clean.

## QA push-registration failure-reason toggle — MSG-TC-I01/I02 (FIX-Task-65 item 3) — SESSION-LOCAL since 2026-09-18

Closes the "four causes, one misleading string" finding and makes every failure copy observable **on a simulator**. `registerForPushNotifications()` (`src/services/notifications.ts`) now returns a discriminated `{ ok: true, token } | { ok: false, reason }`, where `reason` ∈ `not_device | expo_go | permission_denied | token_error`; `NotificationSetup` renders one cause-specific message per reason (exported as `PUSH_FAILURE_COPY`). Implemented in `src/services/devTestingService.ts` (`getPushRegistrationReasonOverride`), read at the **top** of `registerForPushNotifications`. Fail-closed: release builds / toggle unset / expired (TTL) / unknown value → the real path always runs.

**Why it is needed:** the real causes are unreachable on a simulator — `!Device.isDevice` short-circuits **before** the permission check, so `permission_denied` and `token_error` can never be produced there; `expo_go` needs Expo Go; the **success** leg needs a physical device. An armed toggle returns the forced reason **without** requesting permissions, calling Expo, or writing a notification channel (so it also proves the null-token path really short-circuits).

**Deep link key (short name):** `push_registration_reason` → AsyncStorage key `qa_local_push_registration_reason`. Values `not_device` | `expo_go` | `permission_denied` | `token_error` | `none`.

**Arm / disarm (QA agent — self-service, session-local, no DB write):**
```
# ARM (one deep link per cause)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_registration_reason&value=not_device"
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_registration_reason&value=expo_go"
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_registration_reason&value=permission_denied"
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_registration_reason&value=token_error"
# DISARM (after the run)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_registration_reason&value=none"
```
Then open `p2pkidsmarketplace://notification-setup` and tap `notification-enable-button`.

**Locators added by FIX-Task-65 item 4** (tap by locator — the 2026-09-18 round had to derive tree coordinates): `notification-enable-button`, `notification-maybe-later-button`, `notification-continue-button`, `notification-error-message`, `notification-error-section`, `notification-open-settings-button`. The **Open Settings** button renders **only** for `permission_denied`.

**Optional variant (item 4 extra):** `p2pkidsmarketplace://notification-setup?isOptional=1` makes **Maybe Later** render — the route passes no props, so that branch was dead UI before FIX-Task-65.

**Side-effect check (R24):** with the toggle armed nothing is persisted — `push_tokens` must stay at **0 rows** for the persona.

**QA usage:** dev build → Login → Settings → Test Push Notification:
- `token` → "Test Notification Sent" (normal leg; repeat taps within 1 min hit dedup → "Notification Queued").
- `rate_limited` → "Rate Limited" alert.
- `quiet_hours` → "Quiet Hours" alert.
No real Expo call is made in `token` mode (send is mocked). Disarm to `none` after the run.

> **Note (2026-08-25):** the old shared `admin_config` key `qa_push_simulation` is no longer read by the app — any existing row is inert and can be deleted by dev/ops. The C05 `qa_provider_unavailable` toggle is NOT migrated (still DB-backed).

## QA notification-pref save-failure toggle — AUTH-TC-D02 — SESSION-LOCAL since 2026-08-25

Unblocks D02 ("Optimistic toggle reverts on failure") on demand, without breaking network or DB permissions. Implemented in `src/services/devTestingService.ts` (`getSimulatedNotificationPrefSaveError`) and injected at the top of `updateNotificationPreference` (`src/services/notificationPreferences.ts`) after the auth check. When armed, it returns a FAILED result → NotificationPreferencesScreen's existing revert branch (optimistic update → revert + error alert). **Session-local (AsyncStorage) since 2026-08-25** — the QA agent arms/disarms it itself via a deep link, no SQL, no human operator step. Fail-closed: release builds / toggle unset / expired / unknown → real save always runs.

**Deep link key (short name):** `pref_save_failure` → AsyncStorage key `qa_local_pref_save_failure`. Values `save_failure` | `none` (absent/`none`/unknown = no simulation).

**Arm / disarm (QA agent — self-service, session-local, no DB write):**
```
# ARM
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=pref_save_failure&value=save_failure"
# DISARM (after run)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=pref_save_failure&value=none"
```

**QA usage:** dev build → Login → Settings → Notification Preferences → flip any Push/In-App/Email toggle → the toggle updates then **reverts** with the error alert ("Simulated preference save failure…"). Disarm to `none` after the run.

> **Note (2026-08-25):** the old shared `admin_config` key `qa_force_pref_save_failure` is no longer read by the app — any existing row is inert.

## QA link email-mismatch toggle — AUTH-TC-C04 — SESSION-LOCAL since 2026-08-25

Unblocks C04 ("Email mismatch on link blocked") — the dev Link flow is simulated (initiateSocialLogin + "OAuth Flow" alert), so `EmailMismatchError` (which needs a REAL OAuth callback) is never exercised. Implemented in `src/services/devTestingService.ts` (`getSimulatedLinkEmailMismatch`) and injected into `LinkedAccountsScreen.performLinking` AFTER the simulated initiation. When armed for the requested provider (or `all`), it throws a FAITHFUL `EmailMismatchError` → the screen's existing catch shows the "Email Mismatch" alert. **Session-local (AsyncStorage) since 2026-08-25** — the QA agent arms/disarms it itself via a deep link, no SQL, no human operator step. Fail-closed: release builds / toggle unset / expired / unknown → simulated link-success alert as before.

**Deep link key (short name):** `link_email_mismatch` → AsyncStorage key `qa_local_link_email_mismatch`. Values `google` | `facebook` | `apple` | `all` | `none` (absent/`none`/unknown = no simulation).

**Arm / disarm (QA agent — self-service, session-local, no DB write):**
```
# ARM (facebook)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=link_email_mismatch&value=facebook"
# ARM (google | apple | all)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=link_email_mismatch&value=google"
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=link_email_mismatch&value=all"
# DISARM (after run)
xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=link_email_mismatch&value=none"
```

**QA usage:** dev build → Login → Settings → Linked Accounts → tap Link on the armed provider (e.g. Facebook) → complete the password re-auth modal (if prompted) → expect the "Email Mismatch" alert ("The email on your facebook account doesn't match your account email…") and NO link created. Disarm to `none` after the run.

> **Note (2026-08-25):** the old shared `admin_config` key `qa_link_email_mismatch` is no longer read by the app — any existing row is inert.

## F02 valid unsubscribe-token fixture — ACC-TC-F02 — added 2026-08-25

Unblocks F02's **success leg** ("You've Been Unsubscribed" + category + Go to Home). `unsubscribe_tokens` was empty on staging and an execution-only QA agent can't mint one. `seed:staging` now calls `seedUnsubscribeTokenFixture()` (`scripts/seed-staging-data.ts`), which mints a **valid, unexpired** token via the existing `generate_unsubscribe_token` RPC for **test-buyer** (category `subscription`), printing the deep link `p2pkidsmarketplace://unsubscribe?token=<TOKEN>` to the seed console (stdout only — do NOT paste the token into a report/issue/chat).

**QA usage:** `npm run seed:staging` → read the token from stdout → `xcrun simctl openurl booted "p2pkidsmarketplace://unsubscribe?token=<TOKEN>"` → expect processing state → "You've Been Unsubscribed" / "You will no longer receive subscription email notifications." / **[Go to Home]**.

**Consumption + idempotency:** `process_unsubscribe` marks the token `used_at` and disables test-buyer's `subscription` `email_enabled` pref (a no-op in practice — email defaults false) on the first run. Re-seeding deletes prior **unused** tokens for test-buyer and mints a fresh one (used tokens are kept as audit), so the table never grows unbounded. The invalid/expired-token leg needs a bad token (any garbage string) — no fixture required.
- **✅ FIXED + VERIFIED (2026-08-25, F02 valid leg PASS):** the `generate_unsubscribe_token` search_path defect was fixed — RPC now schema-qualifies `extensions.gen_random_bytes(32)` (verified via `pg_get_functiondef`). `seed:staging` mints a valid token for test-buyer (`category=subscription`, 64-char hex, 1-yr expiry) and prints the deep link to stdout. **QA usage (read-only): the token may be read via read-only SQL (`unsubscribe_tokens` for test-buyer where `used_at IS NULL`) instead of re-running the seed — smaller shared-staging blast radius.** F02 success leg fully verified: deep link → "You've Been Unsubscribed" + `subscription` category + Go to Home; DB: `used_at` set, `notification_preferences.subscription.email_enabled=false`, `updated_at` bumped. **Token is one-time use (consumed on first run) — re-mint via `npm run seed:staging` for any re-run.** The token is a secret — redact in reports.


## Real Delivery Test Contacts — real SMS/email delivery verification (added 2026-08-26)

Standing contacts for **real SMS/email delivery verification legs only** — NOT for the dev-bypass code paths (`123456`), which remain the default for routine runs. These are real external recipients, so treat them as sensitive (never echo beyond a run report's documented "which number/email was used" note).

### Test Phone Numbers (real SMS delivery)
- **Test Phone 1:** `+15519985017`
- **Test Phone 2:** `+12038200746`

Use one of these when a test case specifically requires confirming a *real* SMS actually arrives (e.g., B03's real-Twilio leg), not for routine OTP-flow testing where the dev bypass (`123456`) is sufficient. Document in the run report which number was used and that the recipient (the project owner) manually confirmed message receipt if that step was possible.

### Test Email (real email delivery)
- **Test Email:** `samer.alzubaidi82@gmail.com`

Use this when a test case specifically requires confirming a *real* email actually arrives and is readable (e.g., verifying `send-email`/`auth-email-change` delivery after the email-breakage fix, or F02's unsubscribe email content), not for routine flows where checking `email_logs` for a DB-logged send intent is sufficient.

### Cost/Frequency Discipline
Real SMS sends are billed per message and real emails consume send quota — do not use these in every routine re-run. Reserve them specifically for legs that require *confirmed real delivery* as the pass criterion, and note in the report exactly when/why a real send was triggered.

