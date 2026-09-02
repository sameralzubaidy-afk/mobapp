# QA Task 20 — Web Subscription Purchase Flow — Full E2E Verification

**Date:** 2026-09-02 · **Agent:** QA Test Agent · **Device:** iPhone 17 Pro Max (iOS 26.1) UDID `3F3293A3` · **Backend:** staging `drntwgporzabmxdqykrp` · **Web app:** `p2p-kids-web` (passitup.com consumer app) local `:3002` + production `https://passitup.com` (config only) · **Admin portal:** `:3001` (not needed this run)
**Run dir:** `e2e-test-results/qa-task20-web-sub-e2e-2026-09-02/`

**Priority note (per brief):** the SUB guide's stale-case deep-dive confirmed the in-app subscription purchase flow (Group B) is dead; joining is web-first. This run tests that real web-first journey end-to-end, treating it as a money-path investigation.

---

## Verdict Summary (per the 6 scope items)

| # | Scope item | Verdict | Top finding / evidence |
|---|---|---|---|
| 1 | Mobile entry point → web URL + return mechanism | **PASS** | JoinKidsClub → "Join on the web" opens the membership page (dev `localhost:3002/join`, prod `https://passitup.com/join`) with the user's email pre-filled; "Return to Pass It Up!" breadcrumb + web success-page deep link (`p2pkidsmarketplace://my-subscription`) both return to the app. Live on-device + web. |
| 2 | Web checkout — plan/price/trial + real Stripe Checkout + declined card | **BLOCKED (upstream config) + PARTIAL UI-shell** | Web UI shell verified (join page, email validation, success page). Real Stripe-hosted Checkout cannot be created: **no active `subscription_tiers` row has a `stripe_price_id`** (0 rows) so the deployed `create-checkout-session` EF returns `CONFIG_UNAVAILABLE`; local web is `SUBSCRIPTION_DEV_MODE=true` (mock); prod is live-only. No plan/price is shown on the web join page at all; "$1.49 flat fee" copy conflicts with live config $1.00. |
| 3 | Webhook verification (record/status/period/idempotency/audit) | **PARTIAL** (mechanisms VERIFIED server-side; live event not drivable) | DB unique constraints + `rpc_upsert_web_subscription` + `billing_history` upsert-on-`charge_id` prove replay idempotency; audit channel is `subscription_events` (`web_subscription_upsert`) — **zero rows ever** (R7 flow never ran). L01–L05 mapped; positive-leg replay needs a real checkout (blocked by #2). |
| 4 | Cross-system reflection back to mobile | **PARTIAL** (state-driven reflection verified; free→active *transition* not drivable) | Active member view correct on test-buyer (Kids Club+ Plan / ACTIVE / fees/SP gated by status); free view correct on test-free. `useSubscription` refetches on foreground (no manual refresh). The transition itself blocked upstream by #2. **Finding:** test-buyer shown ACTIVE with Renew Date **Jul 27 2026 — in the past** (renewal not advancing on staging). |
| 5 | Cancellation full-loop | **PARTIAL** (mechanism verified + reachable UI; not a real full loop) | Cancellation is **NOT web-first** — no cancel UI exists on p2p-kids-web. It is in-app (Manage Kids Club+ → Cancel Kids Club+ → `cancel-subscription` EF → Stripe `cancel_at_period_end` → webhook). Cancel entry + auto-renew toggle verified present on-device for the active subscriber; real cancel loop not executed (only real-Stripe active persona is shared + stale; fresh-purchase path blocked by #2). |
| 6 | Renewal (if testable) | **NOT TESTABLE in this env** | No live-cadence renewal can be produced: the only real Stripe sub (test-buyer) last billed 2026-06-30 and its `current_period_end` (2026-07-27) has not advanced; fast-forward needs Stripe test clocks + the webhook path (blocked by #2). Grace logic (I05) previously verified live. |

**Roll-up: 1 PASS / 4 PARTIAL / 1 NOT-TESTABLE** (with the single hard BLOCKER being the missing Stripe Price linkage + web dev-mode — see §Why It Matters).

---

## The blocker chain (why the real money path is not drivable today) — evidence-backed

1. **Staging has NO Stripe Price on any active tier.** `SELECT ... FROM subscription_tiers WHERE stripe_price_id IS NOT NULL` → **0 rows**; the default Kids Club+ tier (`c8a1a3d1`, `price_cents` 499, `trial_days` 30, `is_default`) has `stripe_price_id = NULL`. The deployed `create-checkout-session` EF (v11, deployed, matches repo) filters active tiers `.not('stripe_price_id','is',null)` and returns `CONFIG_UNAVAILABLE` ("Subscription pricing is not configured yet") when the allowlist/default tier has no Stripe price → **a Checkout Session cannot be created, so no Stripe-hosted checkout, no webhook, no subscription row can be produced by the real path.**
2. **Local web is in DEV_MODE.** `p2p-kids-web/.env.local` sets `SUBSCRIPTION_DEV_MODE=true` → `/api/checkout` returns a mock success URL (`…/account/subscription?session_id=dev_mock_<ts>`) and never calls the EF/Stripe (live-probed: `{"success":true,"url":"…dev_mock_…","bind_token":null}`). No DB/webhook side effects by design.
3. **The only non-dev web deployment is production.** Mobile `.env.staging` and `subscriptionWeb.ts`'s default both resolve `https://passitup.com` — live-mode, not a legitimate QA checkout target.
4. **`trial_enabled=false`** in `admin_config`; the mobile Upgrade screen and JoinKidsClub/Manage screens still advertise "30-day free trial" / "$1.49 flat fee" (see findings) — and the checkout EF derives `trial_days` from the tier (30) **without consulting `trial_enabled`** (config-intent inconsistency).

These are **environment/config gaps, not app-code bugs** — the code path (web route → EF → Stripe → webhook → DB → mobile) is all present, deployed, and source-verified; it is simply not exercisable end-to-end until (a) the Kids Club+ tier gets a real Stripe test Price id and (b) a non-DEV_MODE web deployment points at staging (or the local env is flipped and the EF `SUBSCRIPTION_WEB_SECRET` matches). Full unblock recipe in §What Needs To Be Fixed Next.

---

## Scope item 1 — Mobile entry point (PASS)

**Guide anchor:** SUB-TC-N01/N02 (JoinKidsClub value-prop + web redirect). Executed live on-device as **test-free** (free user, the persona the value-prop is aimed at).

**Trace (mobile):**
1. `qa-login-as?persona=test-free` → Home (free state; "Upgrade to Kids Club+" card present).
2. Scrolled Home → tapped `dashboard-upgrade-kids-club-button` → **JoinKidsClub** value-prop screen.
3. Verified full N01 value-prop: title "Kids Club+"; headline "Get more out of every trade"; 3 benefit rows (Earn Swap Points / Pay a flat $1.49 fee / Spend SP up to 50%); web card "Membership is managed on the web"; CTA `join-kids-club-button` "Join on the web"; footnote "No charge in the app… passitup.com…". *(Cross-references QA Task 19 N01 PASS — reconfirmed.)*
4. Tapped **Join on the web** → the app opened the membership page in a Safari-based browser (Safari chrome: Back / Page Format / "localhost" address / Reload) at the dev URL, with **email pre-filled `test-free@kidsmarketplace.test`** (OCR + AX verified).
   - Dev target `http://localhost:3002/join?email=test-free@kidsmarketplace.test` (from `EXPO_PUBLIC_SUBSCRIPTION_WEB_URL` in `.env` = `http://localhost:3002`; prod target `https://passitup.com/join` from `.env.staging` + `subscriptionWeb.ts` default). **URL wiring confirmed from source + live.**
5. **Return mechanism:** (a) the browser's top-left "Return to Pass It Up!" breadcrumb was tapped → returned to the app's JoinKidsClub screen (live). (b) The web success page's "Return to Pass It Up" button (`href = p2pkidsmarketplace://my-subscription`, verified in the rendered page) was confirmed to land on **My Subscription** in-app via the deep link (live, on test-free).

**Evidence:** `MOBILE-joinkidsclub-value-prop-testfree.png`, `MOBILE-joinkidsclub-inappbrowser.png`, `MOBILE-after-join-web-tap.png`, `MOBILE-my-subscription-testfree-free-plan.png`, `WEB-join-page-filled.png`.

**Verdict: PASS.** Correct membership URL opens with the user's email; both the browser breadcrumb and the web success-page deep link return to the app. *Nuance noted:* the "external system browser" per `subscriptionWeb.ts` comment renders as an **SFSafariViewController-style in-app browser** (Safari chrome + breadcrumb) on this build — this is App-Store-compliant (no in-app purchase UI), just an implementation detail worth a doc note.

**UX/design-system:** header on JoinKidsClub is the canonical detail header (back `back-button`, title, bell+chat) — compliant. Value-prop copy is plain and parent-appropriate. The recurring "$1.49 flat fee" benefit line does **not** match the live config subscriber fee ($1.00) — see §Scope 2 finding F-2.

---

## Scope item 2 — Web checkout: plan/price/trial + real Stripe Checkout + declined card

### What ran for real (web UI shell, DEV_MODE mock)
The `p2p-kids-web` dev server was started (`:3002`) and the journey driven in a browser:
- `/join` (with `?email=`) renders "Kids Club+ Membership", 3 benefit rows, email field, **Join on the web** button, footnote. Screenshot: `WEB-join-page-top.png`, `WEB-join-page-filled.png`.
- **Email validation:** invalid email → inline error **"Please enter a valid email address."** renders (clear, non-silent). Screenshot: `WEB-join-invalid-email-error.png`.
- **Mock checkout:** valid email → DEV_MODE `/api/checkout` → success page **"🎉 You're all set!"** (URL `…/account/subscription?email=…&session_id=dev_mock_<ts>`). Screenshot: `WEB-subscription-success-devmock.png`. The success page text says benefits "unlock automatically … you'll be able to … pay the flat $1.49 fee" and the **Return to Pass It Up** button (`p2pkidsmarketplace://my-subscription`) is present.

### What could NOT run (real Stripe) — see §blocker chain
- **Stripe-hosted Checkout** (real test card entry, Apple/Google Pay) — cannot be created (no `stripe_price_id` on any tier → EF `CONFIG_UNAVAILABLE`).
- **Declined-card handling** at Stripe's hosted page — cannot be reached for the same reason (Stripe's own decline UX can therefore not be observed here).

### Findings (scope-2-relevant, all evidence-backed)
- **F-1 (price transparency, web):** the web `/join` page displays **no plan/price** (no "$5.99/month" or equivalent anywhere — only the "$1.49 flat fee" benefit line). Price first appears only inside Stripe Checkout (unreachable). Per scope-2's "Correct plan/price displayed on the web page (matches `monthly_price_cents` from config, same number verified on mobile in A03)" — **there is no web price display to match**; the mobile value is **$5.99/month** (verified live on the Upgrade Plan screen `price-kids_club_plus` = "$5.99", driven by `admin_config.subscription_price_monthly = 599`, DB-verified). Recommendation: add the monthly price (+ trial terms) to `/join` so parents see price before leaving the app.
- **F-2 (cross-surface fee copy vs config):** the benefit copy "Pay a flat **$1.49** fee" is hardcoded on the **web** join page, the **web** success page, and the **mobile** JoinKidsClub / Manage Kids Club+ / My Subscription benefit rows — but the live config is `transaction_fee_subscriber_cents = 100` (**$1.00**). Every surface claims $1.49 while the actual subscriber checkout fee is $1.00 (and the webhook welcome body also says $1.49). **Config-vs-copy mismatch across all three surfaces** — money-adjacent; flag for dev copy fix.
- **F-3 (trial-terms inconsistency):** mobile shows "30-day free trial" / CTA "Start 30-day Trial" and the tier has `trial_days = 30`, but `admin_config.trial_enabled = false`, and the checkout EF derives trial days from the tier **without consulting `trial_enabled`** → the config's trial-off switch is not honored by the web checkout EF (a trial would still be granted to a first-time user). Config-intent flag for dev.
- **F-4 (price-source divergence):** mobile Upgrade Plan price = `admin_config.subscription_price_monthly` 599 ($5.99) — while `subscription_tiers` Kids Club+ `price_cents` = **499** ($4.99, used by `formatTierForDisplay` in other display paths) and test-buyer's `subscriptions.monthly_price_cents` snapshot = 599. Three different price authorities disagree (599 / 499 / 599); the Stripe Price (the amount actually charged) is a 4th authority and is **not linked**. Flag for consolidation.
- Trial-terms note: `trial_enabled=false` means the "free trial" claim on mobile/web is currently not actually offered by the (would-be) checkout — but per F-3 the EF would still grant it.

**Verdict: BLOCKED (real Stripe legs) + UI-shell PASS (validation + mock success).**

---

## Scope item 3 — Webhook verification (record/status/period/idempotency/audit)

Real webhook *events* cannot be produced (blocked by §2). What was **verified server-side with live DB evidence**:

1. **Subscriptions-row idempotency (replay of `checkout.session.completed` / `customer.subscription.created`):** `rpc_upsert_web_subscription` (live definition read) resolves the row by `user_id` (latest) → INSERT if none, else UPDATE with `COALESCE` — **one row per user, replay-safe**. DB enforces `subscriptions_user_id_key` UNIQUE + `subscriptions_stripe_subscription_id_key` UNIQUE. The R7 design deliberately handles both event types with the same upsert (idempotent regardless of Checkout/webhook ordering).
2. **Billing-ledger idempotency (`invoice.payment_succeeded`, L01/L04):** the webhook `billing_history` upsert runs `onConflict: 'charge_id'`, and `billing_history_charge_id_key` is UNIQUE (live) → a replayed invoice cannot create a second billing row. Live proof of the mechanism: test-buyer has exactly **one** billing row (`in_1To5Vg…`, $0.00 SUCCEEDED, 2026-06-30) — no dupes.
3. **Payment-failure → grace (L02):** `invoice.payment_failed` → `record_payment_attempt` RPC (live def): increments `payment_retry_count`, sets `payment_failed_at`, transitions to grace after 3 failures + SP freeze (`triggerSpFreeze`). Mechanism present.
4. **Signature gate (L03):** the deployed webhook EF verifies `stripe.signature` via `constructEventAsync` against `STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET`; invalid signature → **400 `INVALID_SIGNATURE` with no DB mutation** (source + deployed-function parity confirmed: all handlers present in the deployed v). verify_jwt=false (public webhook URL). A live negative-signature probe requires a direct call to the remote EF or Stripe CLI forwarding — not run under the read-only terminal discipline (§5.14); exact recipe in §Known Gaps.
5. **Audit/event trail:** the upsert RPC writes a `subscription_events` row (`event_type='web_subscription_upsert'`, metadata incl. stripe ids/status/source `web_first_subscription_r7`). **Live check: `subscription_events` for the test personas contains only `trial_not_converted` rows — zero `web_subscription_upsert` rows.** This is itself the strongest confirmation that **the R7 web-first purchase path has never completed on staging** (the pilot's premise). `trade_events` is not the correct channel for subscription events (that's trades); the subscription audit channel is `subscription_events` + `user_notifications` (welcome/cancel/renew rows) + `billing_history`.
6. **L05 (payout webhook)** — payout domain, not the subscription webhook; unchanged from prior classification (source = `stripe-webhook`/payout EFs, not `stripe-webhook-subscriptions`).

**Verdict: PARTIAL** — server machinery fully verified (deployed + live DB contract), but no live event was produced/driven. L01–L05 now have a precise mapping + the idempotency proof the task asked for.

---

## Scope item 4 — Cross-system reflection back to mobile

**Verified live (state-driven reflection):**
- **Active member (test-buyer):** My Subscription shows "Kids Club+ Plan", **ACTIVE MEMBER**, Renew Date, Member Since, benefits, Cancel link — matches the DB (`status=active`, tier kids_club_plus, snapshot 599). Manage Kids Club+ shows Status **Active**, Payment Method Visa •••• 4242, **Auto-Renew ON**, benefits, Cancel Kids Club+. Screenshots: `MOBILE-my-subscription-testbuyer-active.png`, `MOBILE-manage-kids-club-testbuyer-active.png`.
- **Free (test-free):** My Subscription shows Free Plan / Renew N/A; Home shows the free SP strip + Upgrade CTA. Screenshot: `MOBILE-my-subscription-testfree-free-plan.png`.
- **No-manual-refresh mechanism (source):** `useSubscription` subscribes to `AppState` and **refetches on foreground**, so a subscription completed on the web is picked up when the parent reopens the app (R7 Step 6) — the app does not require a manual refresh. Fee discount (subscriber vs non-subscriber fee) and SP earn/spend gating are driven off the same subscription status the summary returns (verified: active → SP wallet "490 SP" + SP strip; subscriber fee config $1.00).
- The SP strip / Home subscription badge, Discover/gating, and trade-fee logic all branch on `subscription_status` — i.e., **the same status the webhook writes**.

**Not drivable:** the actual free→active *transition* caused by a completed web purchase (blocked by §2), so "feats unlock without a manual refresh" could not be observed as a live transition.

**Finding (scope-4/6 relevant):** test-buyer is displayed **ACTIVE MEMBER with Renew Date Jul 27, 2026** (also "Next Billing Date July 27, 2026" on Manage) — **in the past** (today 2026-09-02). Its `current_period_end` (2026-07-27) has not advanced and no renewal billing row exists since 2026-06-30 → the one real Stripe subscription on staging has been **stale-active for ~5 weeks** (no renewal processing on staging for this fixture). Either a test-fixture artifact or an ops signal that renewals aren't being driven on staging; must be resolved before scope-6/L01 can be verified live.

**Verdict: PARTIAL** (state-driven reflection + refresh mechanism verified; the purchase transition itself blocked upstream).

---

## Scope item 5 — Cancellation full-loop

**Key structural finding:** cancellation is **NOT web-first**. `p2p-kids-web` contains only `/join`, `/account/subscription` (success), `/api/checkout` — **no cancel/manage UI exists on the web**. Cancellation is in-app: **Manage Kids Club+ → Cancel Kids Club+** → reason modal → `cancel-subscription` EF → Stripe `cancel_at_period_end` → `customer.subscription.updated`/`deleted` webhook → DB (canceled/grace) → mobile Manage reflects it. (Per the repo source: active → Stripe `cancel_at_period_end`, status 'cancelled'; trial-with-SP → grace; trial-without-SP → free.)

**Verified:** the cancel entry + auto-renew toggle are present and instrumented on the active subscriber's Manage screen (`cancel-kids-club-button`, auto-renew `Switch` ON) — reachable UI confirmed. The guide's C05 cancel-reason modal path is instrumented (per guide locators).

**Not executed as a real loop:** the only real-Stripe active persona (test-buyer) is the shared subscriber used by many SUB cases and is in the stale-active state above; cancelling it would leave the shared persona cancelled (seed-restorable but costly), and the fresh-purchase→cancel journey (the natural full loop) is blocked by §2. No web cancel exists to test even if the purchase worked.

**Verdict: PARTIAL** — cancel mechanism (EF chain + webhook mapping + reachable UI) verified; real end-to-end cancel loop not executed (shared-persona risk + upstream config block). Recommended as part of the dedicated post-unblock session on a disposable user.

---

## Scope item 6 — Renewal (if testable)

**Not testable in this environment.** A renewal requires either (a) a real subscription on a live billing cadence whose `invoice.payment_succeeded` fires, or (b) fast-forwarding (Stripe **test clocks**) to advance `current_period_end` and emit the renewal webhook. Both require the real Stripe path (§2 blocker) and/or Stripe API access. The only real Stripe sub on staging (test-buyer) has **not renewed since 2026-06-30** (period ended 2026-07-27, no advance) — so even the "does the current_period_end advance on renewal" check cannot be observed. Grace/expiry behavior (the I05 grace banner, `grace_ends_at` handling) was already verified live in QA Task 19 (I05 PASS) and the grace-period webhook code (`customer.subscription.deleted` → `grace_period` + `triggerSpFreeze`, admin-config `grace_period_days`=500 on staging) is source-verified.

**Verdict: NOT TESTABLE** (with the exact fast-clock/webhook recipe recorded for the post-unblock session).

---

## Zero-residue / state accounting
- test-free and test-buyer remain in their prior DB states (free / active respectively); **no subscription was created, cancelled, or charged** (no real checkout possible). No `admin_config`/tier writes.
- The local `p2p-kids-web` dev server was started for the test and is still running on `:3002` (DEV_MODE mock) — left running for the next session; no repo change.
- Browser page for the web app opened and left on `/join`; the shared admin-portal session (`:3001`) was not touched.
- No Stripe objects created.

## Friction / tooling notes
- Terminal tooling silently drops a leading `cd` (§5.6) — used `npm --prefix` for the web server.
- Playwright `locator.click` on the web join button was intercepted by a layout-shifting `.error` element (a real layout-shift UX nit on the join page — the error div pushes the button); worked around with DOM-level dispatch (§5.20.5). Tooling friction + minor UX observation (form shifts when the validation error appears).
- `view_image`/screenshot tools return URIs (R5) — routed all visual checks through `qa:ocr` (§5.23).
- The staging function log stream exposes internal function UUIDs (not slugs), so EF-invocation evidence was gathered via DB state + deployed-function reads instead.

**Evidence:** all screenshots under `e2e-test-results/qa-task20-web-sub-e2e-2026-09-02/screenshots/` (`MOBILE-*`, `WEB-*`).
