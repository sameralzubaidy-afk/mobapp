# QA Session Report — F02 Valid Leg + G07 3-CTA Re-Verification (2 Cases)

**Run:** `e2e-test-results/account-file-f02-g07-closures-2026-08-25/`
**Date:** 2026-08-25, 13:00–13:06 local (17:00–17:06 UTC), ~6 min active execution
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` — ACC-TC-F02 (valid leg) + ACC-TC-G07 (3-CTA leg)
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), Expo RN dev build + Metro (localhost:8081), staging `drntwgporzabmxdqykrp`
**Personas:** `test-buyer@…` (F02-valid, token owner) · `test-grace@…` (G07-3CTA, new standing grace persona, id `a1234567-…-011`)
**Auth cycles:** 2 logins + 2 logouts (persona-batched per §5.26; teardown via `qa-logout` deep link)
**Evidence:** `screenshots/` (6 PNGs) + `cdp-capture.txt` (continuous Hermes CDP console stream) + `capture-cdp.mjs` (reconnect-capable capture script)

---

## Verdict roll-up (this run)

| TC-ID | Verdict | Top finding |
|---|---|---|
| ACC-TC-F02 (valid leg) | **PASS** | `generate_unsubscribe_token` fix live (`extensions.gen_random_bytes(32)` schema-qualified) → valid token minted by seed → deep link → **"You've Been Unsubscribed"** + category `subscription` + **Go to Home** → Home. DB-close: token `used_at` set, `notification_preferences.subscription.email_enabled` → `false`, `updated_at` bumped. CDP clean (no errors). |
| ACC-TC-G07 (3-CTA leg) | **PASS** | `test-grace` grace persona provisioned (status `grace`, grace_ends 2026-10-24, 1 active draft, id-verif `none`) → Home stacks exactly **3 Action Items** (ID verification + grace + drafts) → **"Show 1 more action"** toggle (MAX_VISIBLE=2) → tap → all 3 visible + **"Show less"** → tap → collapse back to 2. On-device expand/collapse verified via AX tree + OCR. No console errors. |

**Roll-up: 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.**

---

## Part 1 — ACC-TC-F02 · Unsubscribe via email token (valid leg) — PASS

**Guide entry:** `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` §ACC-TC-F02 (FLOW-17 · UnsubscribeScreen).
**Persona:** `test-buyer@kidsmarketplace.test` (token owner; the fixture mints the token for the standing buyer persona).

**DB precondition (read-only, §4):**
- `generate_unsubscribe_token` function def confirms the **search_path fix is LIVE** — `v_token := encode(extensions.gen_random_bytes(32), 'hex')` (schema-qualified `extensions.`). The prior run's root cause (unqualified `gen_random_bytes` under `SET search_path TO 'public','pg_temp'` → 42883) is resolved (verified via `pg_get_functiondef`).
- `unsubscribe_tokens` already held **1 valid unused token** for test-buyer, category `subscription`, 64-char hex, `expires_at` 2027-08-25 (minted by the dev's post-fix `seed:staging` at 15:50 today — the same run that provisioned test-grace). Baseline: `notification_preferences.subscription.email_enabled = true` (updated_at 2026-08-24).
- **Token read read-only** (full value used in the deep-link command only; **redacted here** as `<redacted hex token>`) — no re-seed was needed, keeping the shared-staging write surface minimal (the user's seed approval was held as fallback).

**Trace:**
1. Login (email/password) as test-buyer → Home ("Good afternoon, Test" greeting; node Norwalk Central). *(Perceived load time: login → Home ~1 s.)*
2. Delivered deep link `p2pkidsmarketplace://unsubscribe?token=<redacted hex token>` (warm — app on Home) via `xcrun simctl openurl`.
3. **Success state rendered** on first poll: `success-title` = **"You've Been Unsubscribed"**; message **"You will no longer receive subscription email notifications."** (category = `subscription`, from the token); note "You can manage your notification preferences anytime in the app settings."; **[Go to Home]** (`go-home-button`). *(Perceived load time: deep-link → success screen <1 s.)*
4. Tapped **Go to Home** → navigated to **Home** (dashboard-greeting "Good afternoon, Test" re-rendered). *(<1 s.)*
5. **DB-close (read-only):** `unsubscribe_tokens` row → `used_at = 2026-08-25 17:01:05` (set after use), `expires_at` still valid; `notification_preferences.subscription.email_enabled = false`; `updated_at = 2026-08-25 17:01:05` (bumped from 2026-08-24). Final state check: `consumed_tokens=1`, `unused_tokens=0`.
6. **CDP:** `[NAV] route: Unsubscribe` (17:01:05) → `[NAV] route: Home` (17:01:18, Go-to-Home). **Zero** exceptions / `console.error` lines across the whole run. (The repeated entry/replay bursts in the capture are the §5.12 reconnect replay, not real navigations.)

**Assert result: PASS** — all F02 success-leg assertions met with UI + DB + console evidence:
- ✅ Processing → "You've Been Unsubscribed" with the correct category (`subscription`).
- ✅ **[Go to Home]** present and navigates to Home.
- ✅ Token `used_at` set after use.
- ✅ Associated notification preference (`subscription.email_enabled`) actually updated to `false`.

**UX notes**
- *Structural:* clear success icon (✓), title, message, note, single primary CTA. Back affordance + header + tab bar present (the screen renders within the app's detail chrome — consistent with other stack screens). No loading-stall (processing state was sub-second).
- *Wording:* copy is plain and parent-appropriate ("You've Been Unsubscribed" / "You will no longer receive subscription email notifications." / "You can manage your notification preferences anytime in the app settings."). Clear.
- *Design-system compliance:* success screen uses standard `ScreenLayout` + primary pill **Go to Home**; checkmark icon centered; text properly padded/centered. **No deviations found** (vs `docx/design-system-passitup.md`).

**Locator gaps:** none — `success-title`, `go-home-button` all AX-instrumentable.

**Friction:** none. (Deep link delivered cleanly on first attempt — no LogBox fatal overlay; the §5.8 clean-launch check passed: plain launch = Landing with no overlay.)

> **Note on fixture state:** the token is now **consumed** (one-time use by design). Re-running F02-valid needs a fresh mint via `npm run seed:staging` (prints the new deep link to stdout). The error leg (invalid/expired token) was already PASS in the prior run and is unchanged.

---

## Part 2 — ACC-TC-G07 · "Show more actions" toggle (3-CTA leg) — PASS

**Guide entry:** `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` §ACC-TC-G07 (FLOW-16 · UserDashboardScreen).
**Persona:** `test-grace@kidsmarketplace.test` / documented fixture password (new standing persona, id `a1234567-0000-0000-0000-000000000011`).

**DB precondition (read-only):** `test-grace` exists (email confirmed) with `subscriptions.status='grace'`, `grace_ends_at` 2026-10-24 (~60 days), **1 active draft** (`item_drafts.expires_at` future), **0** `id_badge_verification_requests` rows → all 3 CTA conditions hold (id_verification `none` + grace_period + drafts). Source verified: `MAX_VISIBLE = 2`; `showAllCtas` toggle renders `action-items-show-all` when `hiddenCount = allCtas.length - 2 > 0`, and `action-items-show-less` when expanded.

**Trace:**
1. Logout test-buyer (`qa-logout` deep link) → Landing.
2. Login as test-grace → Home. *(~1 s.)*
3. **Collapsed state (initial):** Home Action Items renders **exactly 2 visible CTAs** —
   - **CTA 1** `id-verification-cta-banner-*`: "Verify Your Identity" + "Build trust with buyers and sellers. Verify your ID to earn the Trusted Seller badge and boost your listings." + **Verify Now** + Maybe later.
   - **CTA 2** `Grace Period Active` ("You have 60 days to re-subscribe before your Swap Points are deleted." + **Re-subscribe Now**).
   - **`action-items-show-all`** = **"Show 1 more action"** rendered (tree + OCR confirmed) — hiddenCount = 1. `action-items-show-less` **absent**. Draft banner **absent** (3rd CTA hidden). ✅
4. Tapped **Show 1 more action** → **expanded state:** all **3 CTAs** present in tree — ID verification + Grace Period Active + `resume-draft-banner-*` ("You have 1 unfinished listing" / "Continue where you left off" / **Resume listing** / Dismiss); toggle switched to **`action-items-show-less`** = "Show less"; `action-items-show-all` gone. Screenshot + OCR confirm all 3 on-screen (draft title clipped at the fold edge pre-scroll; fully visible after a small scroll — captured as `G07-03`). ✅
5. Tapped **Show less** → **re-collapsed state:** `action-items-show-all` = "Show 1 more action" back; `action-items-show-less` gone; `resume-draft-banner-*` (drafts CTA) gone; the 2 visible CTAs (ID verification + Grace Period Active) remain. ✅
6. **DB-close:** no DB writes (session-local `useState` toggle; fixture intact: `status='grace'`, 1 active draft, 0 id requests).
7. **CDP:** no errors/exceptions during the whole G07 interaction sequence.

**Assert result: PASS** — G07's 3-CTA leg now demonstrable end-to-end on-device:
- ✅ Home shows exactly 3 Action Items (ID verification + grace period + drafts) with **"Show 1 more action"** visible (MAX_VISIBLE=2).
- ✅ Tap expand → all 3 visible + **"Show less"**.
- ✅ Tap collapse → back to 2 (draft hidden, "Show 1 more action" restored).
- ✅ No regression for 1–2 CTA states (verified in the prior run; source confirms the toggle only renders when hiddenCount > 0).

**UX notes**
- *Structural:* toggle is a full-width tappable row below the CTA stack; expand/collapse is instant and state-consistent; CTA order matches source priority (ID > grace > drafts). The 3rd CTA + toggle sit just below the fold at the natural top position (partially behind the tab bar) — a minor layout observation, not a defect; the user scrolls naturally to reach them.
- *Wording:* "Show 1 more action" (correct singular) and "Show less" are plain and unambiguous. CTA copy (ID, grace, draft) is clear and parent-appropriate.
- *Design-system compliance:* Action Items banners use the app's standard card/banner styling (consistent with the prior exhaustive audit of Home). **No deviations found.**

**Locator gaps:** none — `action-items-show-all`, `action-items-show-less`, `id-verification-cta-banner-*`, `resume-draft-banner-*` all AX-instrumentable (`accessible` + `accessibilityRole="button"` + label).

**Friction (tooling, not app):** Home's ScrollView is flingy — each `mobile_swipe_on_screen` moved content ~950pt regardless of the requested distance, overshooting the toggle past the fold twice. Recovered with short controlled swipes + tree re-lists (§5.9/§5.2 discipline). Not an app defect.

---

## Groups A–G final roll-up

Prior cumulative (2026-08-25 full-closure run): **47 cases — 37 PASS / 0 FAIL / 10 BLOCKED** (F02-valid + G07-3CTA were 2 of the 10 BLOCKED).

This run's closures against that baseline:

| Case | Prior | Now |
|---|---|---|
| F02 (valid leg) | BLOCKED (root-caused: `generate_unsubscribe_token` `gen_random_bytes` search_path defect) | **PASS** (RPC fix verified live + seed-minted token consumed end-to-end) |
| G07 (3-CTA leg) | BLOCKED (setup gap: no grace persona) | **PASS** (grace persona + on-device expand/collapse demonstrated) |

**New cumulative Groups A–G: 47 cases — 39 PASS / 0 FAIL / 8 BLOCKED.**

The 8 remaining BLOCKED (all dev-owned, unchanged from the prior run):
1. **B-group (8):** B02 email re-verify (feature not implemented), B03 phone OTP, B04 avatar upload, B05 profile stats, B06 validation, B07 "No Changes" alert, B08 waitlist dead-code, B09 "already verified" phone — need feature/fixture work or are unreachable-by-design.
2. **G02 grace/payment-fail/trial legs + G04 pending/approved/rejected ID-CTA legs + G09 no-session fallback:** time/dead-code legs (unchanged).
3. **C03 last-method-guard alert:** needs the C07 social-only persona with a real identity (documented in repo memory).

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| ACC-TC-F02 (valid) | Account | PASS | Unsubscribe success via valid token: UI + `used_at` + `email_enabled=false` all verified |
| ACC-TC-G07 (3-CTA) | Account | PASS | Grace persona stacks 3 CTAs; "Show 1 more action" expand/collapse verified on-device |

**Roll-up: 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.**

### Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Login (test-buyer) → Home | ~1–2 s | OK |
| Deep link → Unsubscribe success screen | <1 s | OK |
| Go to Home → Home | <1 s | OK |
| Login (test-grace) → Home | ~1–2 s | OK |
| Show 1 more action → expanded (3 CTAs) | <1 s | OK |
| Show less → re-collapsed (2 CTAs) | <1 s | OK |

**Perceived Load-Time Verdict:** GOOD — every in-app transition <3 s; no flags.

## Cross-cutting UX findings
1. **Unsubscribe screen renders within the app's detail chrome** (header + tab bar visible, incl. the notification "99+" badge) rather than a focused full-screen email-context page. Consistent with the app's stack-screen pattern — not a defect. Optional consideration below.
2. **Home ScrollView is flingy under automation** (tooling friction, not app): single swipes moved ~950pt, overshooting past the toggle. Recovered with short swipes + re-lists.

## Cross-cutting design-system compliance (vs `docx/design-system-passitup.md`)

Screens visited this run — Landing, Login (×2 personas), Home (test-buyer + test-grace), Unsubscribe success screen. No dialogs/modals/toasts appeared this run.
- **No deviations found** on any screen. Primary CTAs (Log In, Go to Home, Verify Now, Re-subscribe Now) use the documented filled green pill `#5DBB8E` styling; action-item banners and the toggle are consistent with the prior exhaustive Home audit; text padding/centering correct; touch targets ≥44 pt.
- **Design-System Compliance: PASS.**

---

## 📋 QA Session Handoff

**Test Scope:** ACC-TC-F02 (valid leg) + ACC-TC-G07 (3-CTA leg) — the two remaining closures from the search-path/grace-persona dev task, `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`, iOS Simulator (staging).
**Design-System Compliance:** PASS — no deviations found against `design-system-passitup.md` on any screen visited (Landing, Login ×2, Home test-buyer + test-grace, Unsubscribe success screen). No dialogs/modals visited.
**Perceived Load-Time Verdict:** GOOD — all observed transitions <3 s (login×2 ~1–2 s; deep-link→Unsubscribe success <1 s; Go to Home <1 s; G07 expand <1 s; G07 collapse <1 s). Nothing flagged.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing / Login: standard, clear.
- CONFIRMED — Home (test-buyer): greeting "Good afternoon, Test", node header, SP strip, tiles — clear.
- CONFIRMED — Unsubscribe success screen: "You've Been Unsubscribed", "You will no longer receive subscription email notifications.", "You can manage your notification preferences anytime in the app settings.", [Go to Home] — plain, parent-appropriate, correct singular category.
- CONFIRMED — Home (test-grace): 3 Action Items ("Verify Your Identity", "Grace Period Active — You have 60 days to re-subscribe before your Swap Points are deleted.", "You have 1 unfinished listing — Continue where you left off") + "Show 1 more action"/"Show less" toggle — all copy clear and unambiguous.
**Verdict Summary:** 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED (this run). Cumulative Groups A–G: 47 cases — 39 PASS / 0 FAIL / 8 BLOCKED.
**Critical Findings:**
1. **[CLOSED — HIGH backend defect] `generate_unsubscribe_token` search_path defect — FIXED and verified.** RPC now schema-qualifies `extensions.gen_random_bytes(32)`; seed mints a valid token; F02-valid PASSES end-to-end (UI + `used_at` + `email_enabled=false`). (Was the prior run's #1 HIGH finding.)
2. **[CLOSED — MED setup gap] G07 3-CTA leg — FIXED and verified.** `test-grace` persona (status `grace`, future `grace_ends_at`, 1 active draft, id-verif `none`) stacks all 3 CTAs; "Show 1 more action"/"Show less" expand/collapse demonstrated on-device. (Was the prior run's #2 MED finding.)
3. No new defects surfaced this run.
**App State Left Behind:**
- **F02 token CONSUMED** (one-time use, by design): `unsubscribe_tokens` now has 1 consumed / 0 unused rows for test-buyer. test-buyer's `subscription.email_enabled` is now `false` (the intended end-state of the F02 success leg — re-seeding will restore the default pref state).
- `test-grace` fixture left INTACT and in the G07-verifiable state (status `grace`, 1 active draft, 0 id requests) — reusable for future G07 re-runs.
- Both personas logged out; simulator left on Landing. No throwaway accounts created. No session-local toggles armed/disarmed this run.
**Why It Matters:** The two remaining open items from the search-path/grace-persona dev task are now **closed with on-device + DB proof**. F02's success leg is fully verified (the `gen_random_bytes` fix works end-to-end: seed mint → deep link → success screen → token consumed → preference disabled). G07's 3-CTA toggle is demonstrated live for the first time (grace persona stacks 3 CTAs → MAX_VISIBLE=2 → "Show 1 more action" expand/collapse). Groups A–G are now 39 PASS / 0 FAIL / 8 BLOCKED — the 8 remaining BLOCKED are the B-group (feature/fixture work needed) plus the documented time/dead-code legs (G02/G04/G09) and the C03 last-method guard (needs C07 social-only + real identity).
**How to Verify/Reproduce:** Evidence in `e2e-test-results/account-file-f02-g07-closures-2026-08-25/` (`screenshots/F02-01..02`, `G07-01..04`, `cdp-capture.txt`). F02: `npm run seed:staging` (re-mints a fresh token — the prior one is consumed; read the printed deep link from stdout), log in as test-buyer, deliver `p2pkidsmarketplace://unsubscribe?token=<token>` warm → "You've Been Unsubscribed" + `subscription` category + Go to Home; DB: token `used_at` set + `notification_preferences.subscription.email_enabled=false`. G07: log in as `test-grace@kidsmarketplace.test` → Home → 3 Action Items (ID verification + Grace Period Active + "You have 1 unfinished listing") + "Show 1 more action" → tap → all 3 + "Show less" → tap → back to 2 + "Show 1 more action".
**Known Gaps / Not Tested:** F02 error leg (invalid/expired token) — unchanged, already PASS in the prior run. G07 1-CTA/2-CTA no-toggle states — verified in the prior run; source confirms no toggle when hiddenCount ≤ 0. B-group (8 cases) not re-run this batch (prior BLOCKEDs stand). No regression re-run of G01/G03/G08 etc. this batch (not touched by this task).
**What Needs To Be Fixed Next:**
1. **None required to close the two verified fixes.** Both F02-valid and G07-3CTA are PASS with on-device + DB proof.
2. **B-group (8 cases)** remains the single largest open batch — needs dev feature/fixture work (B02 email re-verify not implemented, B03 phone OTP, B04 avatar upload, B05 profile stats, B06 validation, B07 "No Changes" alert, B08 waitlist dead-code, B09 "already verified" phone).
3. **C03 last-method-guard alert** still needs a dev-attached real provider identity on the C07 social-only user (count = 1) to be reachable.
**UX Enhancement Ideas (optional, not defects):**
- On the Unsubscribe success screen, the app's full chrome (header + tab bar + notification badge) is visible for an email-context flow — consider a focused, chrome-light confirmation layout for link-opened screens so parents land on a distraction-free confirmation after clicking an email link (observed in F02's success screenshot; the current stack-chrome presentation is consistent with the app but not email-first).
- On the Home dashboard, the 3rd Action Item and the "Show 1 more action" toggle sit just below the fold (partially behind the tab bar) at the natural scroll position — consider a slightly tighter Action-Items stack or auto-keeping the toggle above the fold so the affordance is immediately visible without scrolling (observed in G07; minor).
**Suggested Next Session:** Attack the B-group (phone/avatar/validation — needs dev feature work), then Group H (Help & Support) from the same account guide. F02/G07 are closed; no re-run needed unless the fixtures are reset.
**Suggested to Improve Agent Rules:** None this run — the session reused the established playbook techniques cleanly (read-only token retrieval to avoid an unnecessary shared-staging seed; flingy-ScrollView recovery via short swipes + re-lists). One minor note worth keeping: the Home ScrollView's ~950pt fling per swipe on this build is now a known tooling-friction data point for future dashboard-heavy runs.
