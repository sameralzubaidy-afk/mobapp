# QA Task 32 — Part 2 (SUB First Execution round 1) + ADM Re-Verify + M03/M04 — 2026-09-05

**Run folder:** `e2e-test-results/qa-task32-adm-r6-sub-2026-09-05/Part2-SUB/`
**Device:** iPhone 17 Pro Max sim (3F3293A3, iOS 26.1) · Admin portal `:3001` (shared session) · Staging `drntwgporzabmxdqykrp`
**Build under test:** Dev Task 116 (all 9 fixes live; the 3 Batch-0 items below are DT116's)
**Per-case status source of truth:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (updated — see §7)

---

## Verdict roll-up

| Batch | Scope | Result |
|---|---|---|
| **Batch 0** | ADM re-verify: Waitlist real-name fix · P02 badge-icon upload · R03 education publish | **3 PASS** (E05 note refresh; P02 PARTIAL→PASS; R03 PARTIAL→PASS) |
| **Batch 1** | Disposable **real** subscription fixture (Stripe test-mode) | **Built + verified** (DB + mobile ACTIVE) |
| **Batch 2** | ADM M03 (Extend/Cancel/Reactivate) + M04 (Reactivate confirm + mobile) | **2 PASS** (both PARTIAL→PASS) + 1 MED finding (audit/actor attribution) |
| **Batch 3** | SUB first execution (33 active cases) | **2 PASS + 1 DOC-DRIFT executed** (A05, N03 PASS; I06 DOC-DRIFT); **30 explicitly deferred** (per-case list §6, R40) |

**Net verdicts this session:** 7 PASS / 0 FAIL / 1 DOC-DRIFT / 30 deferred (not rushed — SUB first-execution discipline).

---

## Batch 0 — ADM Re-Verification (quick, done first) — 3 PASS

### B0-1 · Waitlist User column (real names) — PASS (E05 note refresh)
- Admin `/waitlist` now renders real profile names: "Samer Test Update 10" (×4), "Test Out Of Active Node", "Test" — the DT116 fix (select `user_id, name` instead of nonexistent `profiles.display_name`) is **verified live**.
- The 3 remaining "Unknown user" rows (Dec-2025 `charlie*.smith`/`1222214charlie` rows `580fc18d`, `8089a641`, `c36bc8a2`) were **DB-verified to have NO profiles row** (their auth users were deleted; orphan waitlist rows) → the "Unknown user" fallback is **correct rendering for genuinely-missing profiles**, not a residual defect.
- Evidence: `ADMIN-B0-waitlist-real-names.png`; DB: waitlist 9 rows, 6 with profiles (real names), 3 orphan.

### B0-2 · ADM-TC-P02 badge-icon upload (previously BLOCKED leg) — **PARTIAL → PASS**
- Badge Editor ("50 Trades", badge `3ac79591`) → **Upload New Icon** (`#icon-upload` → temp PNG) → saved (auto-save on upload, "Badge updated success") → DB `badges.icon_url` now `…/badge-icons/icons/3ac79591-…1788645898583.png`.
- Public URL fetch → **HTTP 200**; the /badges list row renders the `<img>` from `badge-icons` → **icon visible**. The RLS-400 ("new row violates row-level security policy") defect from QA Task 32 Part 1 is **gone** (DT116's service-role upload route works).
- Residue: badge `3ac79591` keeps the uploaded icon (was NULL). No remove-icon affordance exists → flagged for dev cleanup (mirrors the pre-existing `d886e2af` icon residue).

### B0-3 · ADM-TC-R03 education-section publish (previously BLOCKED) — **PARTIAL → PASS** (mobile leg driven)
- Admin `/education` → **Add Section** "QA B0 R03 Disposable Section" (general, draft) → **Publish** → confirm modal ("…will unpublish any other section of the same type…"; none was general) → **Published** (no PGRST202; DT116 arg+audit-col fix verified). DB: `is_published=true`, `published_at` 2026-09-05 22:05:54Z (section `535c06d2`).
- **Mobile leg (R55/§5.57 — required for a PASS):** education Help (Profile → Help & Support → "How to Earn SP") as test-buyer rendered the new accordion `help-section-general-header` = "QA B0 R03 Disposable Section. Collapsed…" — present on fresh mount AND persists after a **pull-to-refresh**. Evidence: `ADMIN-B0-R03-published.png`, `MOBILE-B0-R03-help-general-section.png`.
- **Cleanup:** unpublished → deleted the draft via the new item-9 Delete flow (native confirm accepted) → `education_sections` back to 4, R03 residue 0.

---

## Batch 1 — Disposable REAL Subscription Fixture (built + verified)

Built ONE disposable **real** Kids Club+ subscription (Stripe test-mode) per the scope-note plan:
- **User:** `qa.alice.1788646329130763@kidsmarketplace.test` (Alice dev-autofill, unique email/phone), name "QA Sub32 Parent", ZIP 06850 → Norwalk Central, phone-verified via dev bypass, profile completed (dev avatar). User id `bb862192-6dce-4c2c-ad77-7fce5999d0a8`.
- **Real purchase:** GoTrue password-grant → `create-checkout-session` EF (user JWT) → real **Stripe hosted Checkout** (`cs_test_a1XbMF7…`) → card **4242**, $5.99/mo (Kids Club+ price `price_1UBLkH4…`) → webhook → `subscriptions` row `fbada8e7` **status active**, `current_period_end` 2026-10-05, `stripe_subscription_id sub_1UCRtq4I6kCJlvXoIDL8Oq5Z`.
- **Mobile verified:** relaunch → Manage Kids Club+ (deep link) shows **Status Active · Next Billing Date Oct 5, 2026 · 30 days · Auto-Renew ON · Cancel CTA**.
- **Stripe-Checkout drive facts (for the record):** card fields live in the MAIN frame with camelCase ids `#cardNumber/#cardExpiry/#cardCvc/#billingName/#billingPostalCode`; a **phone number** is required; Card is selected via `#payment-method-accordion-item-title-card`; the session URL's `#…` fragment is mandatory (a bare URL → "This link is incomplete").
- **Retention:** the fixture is **kept ACTIVE** for the Batch-3 continuation session (explicitly deferred cases D05 + the subscription lifecycle reuse) per the scope-note's "build once, use for both purposes". See App State Left Behind.

---

## Batch 2 — ADM M03/M04 Closure — 2 PASS (both PARTIAL→PASS) + 1 MED finding

Drove the disposable real subscription (Batch 1) through admin state changes with **mobile reflection in the same session** (R55).

### ADM-TC-M03 · Extend / Cancel / Reactivate — PASS
- **Cancel** (active row `bb862192`): admin `/subscriptions/manage` → Cancel → native confirm "Are you sure you want to manually cancel subscription for QA Sub32 Parent?" → accepted → DB `status active → grace_period`, `cancelled_at` set, `grace_ends_at` set (+90d). **Mobile reflection:** Manage Kids Club+ → **Grace Period** badge + "Grace Period Active / Your Swap Points are frozen. Re-subscribe before October 5, 2026…" warning (`MOBILE-M03-after-admin-cancel-grace.png`).
  - **DOC-DRIFT (guide Assert 2):** the guide says Cancel "sets status to 'cancelled'"; the implementation **intentionally** moves active/trial rows to `grace_period` (benefits-until-period-end + grace window; source `handleManualCancel` L137-180). The guide's expected status value is stale; behavior intent is correct.
- **Reactivate** (grace_period row): Reactivate → native confirm → DB `status → active`, `cancelled_at`/`grace_ends_at` cleared. **Mobile reflection:** Manage Kids Club+ → **Active** (`MOBILE-M04-after-reactivate-active.png`).
- **Extend Trial** (disposable trial row `cd4b766b`, `sub003-e2e-isolated-…4633@test.com`): **window.prompt override (ADM-R6)** was required — the action is prompt()-gated and `prompt() is not supported` in the embedded browser. Overrode `window.prompt → '7'` → "✓ Trial extended by 7 days. New end date: 9/14/2026" → DB `trial_end_date 2026-09-07 → 2026-09-14`. PASS.
  - Note: Extend Trial is a prompt()-day-entry action (ADM-R3-adjacent); it IS drivable with the R6 prompt override. No mobile leg exists for trial-state (trial is web-first/disabled product-wide).

### ADM-TC-M04 · Reactivate button (confirm + mobile reflection) — PASS
- Confirm copy was an **exact** match: "Are you sure you want to manually reactivate subscription for QA Sub32 Parent? This will set status to active."
- After confirm the admin row + DB show active, and the mobile Manage Kids Club+ reflects **Active** in the same session.

### FINDING (MED — R35 actor attribution + DT116 legacy-column class)
- `p2p-kids-admin/src/app/api/admin/subscriptions/actions/route.ts` — `handleManualCancel`, `handleExtendTrial`, `handleReactivate` each insert into **`admin_audit_logs`** with columns **`admin_user_id` / `action` / `target_user_id` / `changes`** — but the LIVE `admin_audit_logs` table has **`actor_id` / `action_type` / `entity_type` / `entity_id` / `payload` / `reason`**. The insert therefore fails (42703), the `.error` is **never checked**, and the state update (committed first, no transaction) silently leaves **NO audit/actor row** for any of the three admin subscription actions.
- Additionally the actor is hardcoded `admin_user_id: 'system'` (with a `// TODO: Extract from auth session`) — even if the columns matched, real admin actor attribution would be lost (R35).
- This is the same legacy-column bug class DT116 fixed for `publish_section`/`unpublish_section` (on `admin_activity_log`); this one is on `admin_audit_logs` in the subscriptions-actions route. **Fix:** rewrite the three audit inserts to `{actor_id, action_type, entity_type:'subscription', entity_id, payload, reason}` and pass the signed-in admin's user id (not `'system'`).

---

## Batch 3 — SUB First Execution (partial — see §6 deferrals)

### SUB-TC-A05 · Kids Club+ overview by subscription status — **PASS**
- **Free leg (fresh on-device this session):** test-free Home SP strip → **JoinKidsClub** → headline "Get more out of every trade", three benefit rows ("Earn Swap Points on every sale", "Pay a flat $1.49 fee instead of a percentage", "Spend SP on purchases (up to 50%)"), web card "Membership is managed on the web" + "Your benefits unlock automatically in the app right after you subscribe.", CTA **Join on the web**, footnote "No charge in the app…" — the canonical non-trial join surface (`SUB-A05-free-joinkidsclub.png`).
- **Active leg:** disposable-user Manage Kids Club+ — **Active** badge + Next Billing Date + Auto-Renew + Cancel (verified twice this session, B1 + M04) — matches A05's active assertion.
- **Grace leg:** disposable-user Manage post-cancel shows **Grace Period** badge + SP-frozen warning; the Re-subscribe CTA on the grace Manage surface was verified on-device for test-grace in QA Task 28's D01 PASS (cross-referenced; guide A05's per-status coverage note already routes here).
- Verdict: PASS with the three legs evidenced across the disposable user + test-free + D01 cross-ref.

### SUB-TC-I06 · Free user SP wallet inactive state — **DOC-DRIFT**
- test-free SP Wallet (deep link `sp-wallet`) renders a **normal 0-SP wallet**: balance hero 0, quick actions, "How to Earn SP", expiration note, lifetime 0/0/0, "🔒 SP can only be used for item purchases". **No "inactive" lock state and no subscribe/upgrade CTA exists on the wallet surface.**
- Source-confirmed: `WalletWarningBanner` **returns null for `inactive`** ("user has no wallet"); `SpWalletScreen` has no free/subscription gate. A free user with an auto-created wallet row (state `active`, 0 balance) simply sees the standard wallet.
- The free-user SP gating intent (can't earn/spend until subscribing) is delivered on **Home's "Unlock Swap Points / Upgrade" SP strip** and at the **offer/checkout SP gate** — not on the SP Wallet screen.
- Guide assertion is stale → 📄 DOC-DRIFT (with a product note: whether the wallet itself should show a free/inactive lock is a product decision, not a confirmed defect).

### SUB-TC-N03 · Route-alias reachability (JoinKidsClub vs deep-link-only aliases) — **PASS**
- Source-confirmed in `AppNavigator.tsx`: `JoinKidsClub` (L632/L1007) is navigable — verified on-device via the test-free SP strip. `SubscriptionChoice` (L627/L1002), `KidsClubOverview` (L786), `SubscriptionPlans` (L791) are registered but **zero `navigate()` call sites** exist for them → deep-link-only aliases rendering JoinKidsClubScreen. Matches the guide's documented flag (no new finding).

---

## §6 · Batch 3 — Explicit per-case deferral list (R40) — 30 cases → next session

Not rushed (SUB first-execution discipline + this session's budget). Each deferred case needs dedicated fixture/persona engineering that did not fit this session; reasons stated per case.

| TC-ID | Why deferred |
|---|---|
| SUB-TC-D05 (Reactivate from cancelled) | Needs an in-app cancelled→reactivate drive; reusable via the retained disposable sub (cancel again → in-app Reactivate CTA). Reserved for the continuation session. |
| SUB-TC-F01, F03, F04, F05, F08, G10 (payout history/hero) | test-seller payout domain; F08/G10 Load More need >5 payouts (test-seller has 25 pending/requires_action rows — no completed rows for F04's completed-row/net check); needs a completed payout fixture. |
| SUB-TC-F06 (pending release timing) | Admin `pending_sp_release_days` config write + a fresh completed trade creating pending earnings on test-seller (admin+DB+mobile). Config-write + fixture session. |
| SUB-TC-F07 (payout load error) | Requires a forced fetch failure + recovery drive. |
| SUB-TC-G01, G04, G05, G07, G08, G09, G11 (payout methods) | test-seller method-state manipulation (≥2 methods for G04/G08, unverified-method-only for G05/G09, no-method for G11, Edit-Details sheet G07, Stripe-Connect onboarding G01) — dedicated method-fixture engineering. |
| SUB-TC-G06 (requires_action → Set Up Payout Method) | Requires a requires_action payout row staged for a drivable seller. |
| SUB-TC-H01–H04, H06, H07 (withdraw) | Balance/method-state engineering on test-seller (0-balance for H01, verified-primary+balance for H02/H03, no-primary for H04) + admin `minimum_withdrawal_amount_cents` config writes (H06/H07, 1000→0 scope-write-revert) — money-path fixture session. |
| SUB-TC-K02 (Transaction History empty+error) | Empty leg already PASS (E02); error/retry leg needs a forced load-failure drive on Transaction History. |
| SUB-TC-M01, M06, M07 (payment methods) | M01 transient loading state + M06 Go Back need a payment-methods drive; M07 backend attach/detach contract touches test-buyer's saved card (shared-state risk → disposable preferred). |
| SUB-TC-N04, N05, N06 (ContinueKidsClub) | ContinueKidsClub is deep-link-only; needs route reachability + active/trial variants driven against the disposable/trial personas. |

These stay in the tracker's ACTIVE remaining list (30 after this round's 3 moves) — see §7.

---

## §7 · Coverage tracker update (R52/R56)

`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` updated:
- **ADM:** P02 PARTIAL→✅ PASS; R03 PARTIAL→✅ PASS; M03 PARTIAL→✅ PASS; M04 PARTIAL→✅ PASS; E05 note refreshed (waitlist real-name fix verified; orphan rows = correct no-profile fallback). §1 ADM: PASS 139→**143**, PARTIAL 16→**12**.
- **SUB:** A05 (Remaining→✅ PASS), N03 (Remaining→✅ PASS), I06 (Remaining→📄 DOC-DRIFT). ACTIVE remaining 33→**30**. §1 SUB: PASS 45→**47**, PARTIAL 2→2, DRIFT 0→**1**, Remaining **30**. Section header + never-run table header reconciled to 30 (R56).

---

## §8 · App state left behind (cleanup status)

**Intentional retention (for the Batch-3 continuation):**
- Disposable user `qa.alice.1788646329130763` (`bb862192`) with its **real active Kids Club+ subscription** (`fbada8e7`, Stripe `sub_1UCRtq4…`, period to 2026-10-05) — kept so D05 + subscription-lifecycle reuse can run without rebuilding the ~40-call fixture. Cleanup (BP-70: cancel Stripe sub, delete sub/profile/auth + child rows) is scheduled for the END of the continuation session.

**Residue to flag for dev:**
- Badge `3ac79591` ("50 Trades") now has an uploaded icon (`badge-icons/…1788645898583.png`) from the P02 re-verify — no remove-icon affordance exists; flag for cleanup (mirrors pre-existing `d886e2af` icon).
- Disposable e2e-isolated trial row `cd4b766b` trial end moved 09-07→09-14 (M03 Extend Trial leg) — low-impact, automated-suite throwaway.

**Cleaned this session (DB-verified):**
- R03 disposable section unpublished + deleted (education_sections back to 4, 0 residue).
- No `admin_config` writes were made (F06/H06/H07 deferred), so no config reverts needed.
- Mobile app logged out (Landing) at end of run.

---

## §9 · Friction / tooling notes (for agent rules + next instrumentation)

- **Stripe hosted Checkout drive:** card fields are camelCase (`#cardNumber` etc.) in the MAIN frame after selecting Card; phone required; the URL `#…` fragment is mandatory. §5.50 should be updated with these specifics.
- **Admin subscription Extend Trial** is `window.prompt()`-gated → "prompt() is not supported" in the embedded browser; ADM-R6's prompt override (evaluate `window.prompt` before clicking) makes it drivable — worth noting as a NEW drivable exception to the ADM-R3 prompt() class.
- **`admin_audit_logs` (plural) vs `admin_audit_log`/`admin_activity_log`:** three audit tables exist with different column sets; the subscriptions-actions route targets the plural one with the WRONG columns (see Batch 2 finding). Schema cheat-sheet should note all three.
- The `qa-login-as` deep link is delivery-sensitive right after a cold bundle load — fire it only once the app is fully settled (Landing or Home visible).
- test-buyer's node is now "Diag Test Node" (reassigned by a prior diag task) — shared-persona state note for anyone asserting test-buyer's node.
