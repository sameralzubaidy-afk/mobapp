# QA Full Closure Batch — B02 / B03 / B10 / H05 / H06 / H07 / ADM-S03 / L01–L04 + Back-Button Spot-Check

**Date:** 2026-08-26 · **Agent:** QA Test Agent (execution-only) · **Device:** iPhone 17 Pro Max sim (iOS 26.1) · **Personas:** test-buyer (`49243010-…`), test-suspended (`a1234567-…-f`), guest (logged out)
**Run dir:** `e2e-test-results/account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26/` (screenshots/, cdp-l01-l04-capture.txt)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` + `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM-TC-S03)

**Roll-up: 5 PASS / 1 FAIL / 1 BLOCKED / 1 SKIPPED** (out-of-scope) + 1 regression spot-check PASS. (11 requested case-lines; ADM-TC-S03 admin-web leg skipped per agent scope §2.)

**Account-file roll-up (cumulative, per user's 75-total-case baseline):** this batch's B02 (FAIL), B03 (BLOCKED), B10 (PASS), H05 (PASS), H06 (PASS), H07 (PASS), L01–L04 (PASS) are now closed into the cumulative. Guide note: the Account guide registers 80 distinct `ACC-TC-` IDs, of which some are deprecated (I01–I03 removed; H04/H05 rewritten; H03/H04-era blockers closed) — treat the 75-total figure as the current cumulative and add this batch's +6 closed (5 PASS + 1 FAIL + 1 BLOCKED, L01–L04 as 1 line) to it. Standing B02/B03 backend fixes are tracked in `/memories/repo/email-phone-verify-defects-b02-b03.md`.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| ACC-TC-B02 | Account | **FAIL** | Email re-verification happy path blocked: `auth-email-change` EF verify/apply bug (TABLE-returning RPC read as object → always "Verification failed") + `EMAIL_IN_USE` guard silently broken (PostgREST 406). |
| ACC-TC-B03 | Account | **BLOCKED** | Real SMS leg impossible: Twilio error 21606 (From `+19853154226` not message-capable for `+15519985017`); client silently dev-bypassed, no SMS delivered. |
| ACC-TC-B10 | Account | **PASS** | Both "?" icons → Contact Support (no Alert/email); ZIP locked + helper; locator gap on the icons (BP-53). |
| ACC-TC-H05 | Account | **PASS** | Logged-in + guest legs; missing-email validation; valid submit; no guest fields when logged in; no email fallback; DB row verified. |
| ACC-TC-H06 | Account | **PASS** | No raw support-email surfaces on any swept screen (tree + OCR + source grep). |
| ACC-TC-H07 | Account | **PASS** | Login + Signup entries; guest ticket (user_id NULL, contact_email set); 4th submit blocked "Limit Reached" (GRATL); honeypot source-verified. |
| ADM-TC-S03 | Admin | **SKIPPED** (out of scope) | Admin-web reply leg is the Playwright path (agent §2). Guest ticket ready (3 rows, contact_email set); `support_message_replies` = 0; real reply-email confirmation pending that leg. |
| ACC-TC-L01–L04 | Account | **PASS** (4/4) | ErrorBoundary fallback, once-mode recovery, persist containment, telemetry (`[ErrorBoundary] caught`) via CDP. |
| Back-button spot-check | Regression | **PASS** | Canonical `back-button` on 6 screens beyond Edit Profile. |

**Perceived load-time table** (all labeled: perceived load time, simulator, wall-clock, ±polling-interval — not a formal performance profile):

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Login → Home (test-buyer) | ~2s | OK |
| Landing → Login | ~1s | OK |
| Contact Support open (all entries) | ~1s | OK |
| ErrorBoundary fallback render | ~1s | OK |
| Profile/MySubscription/Help navigation | <2s | OK |

No transition ≥ 3s. **Perceived Load-Time Verdict: GOOD.**

---

## ACC-TC-B02 · Email re-verification — FAIL

**Guide:** Account (FLOW-02 · EditProfileScreen) · **Actors:** test-buyer

**Execution trace (abbreviated):** Edit Profile → email field → long-press → Select All → Cut → type `samer.alzubaidi82@gmail.com` (exact-spec target) → Save Changes → "Verify Your Email" modal opened with "We sent a 6-digit code to samer.alzubaidi82@gmail.com" and "Dev/QA mode: the code is 123456 on staging." → Cancelled (to protect the owner's registered email) → email field cleared → typed fresh `test-buyer+verify02@kidsmarketplace.test` → Save → modal → code `123456` → Verify → **"Verification failed. Please try again."** → modal message shown; email NOT applied.

**Assert result: FAIL.**

**Evidence:**
- Screenshots: `05-b02-verify-email-modal-exactspec.png`, `06-b02-verify-failed.png`.
- `email_logs`: two `change_email` rows status `sent` (to `samer.alzubaidi82@gmail.com` at 16:42Z and `test-buyer+verify02@…` at 16:46Z) — **real sends fired**; `template_data.code = "123456"` → **server `DEV_EMAIL_CODE_FIXED=true` confirmed** (the on-screen hint is client-hardcoded but the server code really is `123456`).
- `email_change_verifications`: row `7f0f9786` (samer.alzubaidi82@gmail.com, superseded), row `5ec4ee58` (verify02) has `attempts:1` + **`verified_at` SET** at 16:46:45 but `auth.users.email`/`profiles.email` unchanged.
- Edge logs: `GET | 406 | …/rest/v1/users?select=id&email=eq…` (the uniqueness-check PostgREST call returning 406 → guard never sees the row) and `POST | 200 | …/rpc/verify_email_change_code`.
- Function source + deployed v6 both carry the `EMAIL_IN_USE` guard, yet a change to an **already-registered** email (`samer.alzubaidi82@gmail.com`, user `db71e4d8`) was accepted.

**Root causes (two CRITICAL backend defects — see `/memories/repo/email-phone-verify-defects-b02-b03.md`):**
1. **verify/apply bug:** `verify_email_change_code` returns `RETURNS TABLE(...)` → supabase-js returns an **array**; the EF reads `verifyResult.success`/`verifyResult.new_email` as an object → always falsy → EF always returns "Verification failed" even though the RPC verified the code and set `verified_at`. `admin.auth.admin.updateUserById` never runs (no auth_logs entry). Fix: unwrap the array result (read `data[0]`).
2. **EMAIL_IN_USE guard broken:** the `auth`-schema PostgREST query returns HTTP 406 → `existing` null → guard never fires → account-email-takeover hazard (a change to another account's email is accepted).

**Verdict note:** The exact-spec target could not be verified (deliberately cancelled to avoid reassigning the owner's registered `samer.alzubaidi82@gmail.com` to test-buyer via the broken guard). The mechanism (request → real email → code → RPC verify) all worked except the EF's apply step. Real-delivery of the `change_email` email to `samer.alzubaidi82@gmail.com` is **confirmed via email_logs** (status sent) — owner inbox confirmation of the actual message body remains a human check.

**UX review:**
- *Structural:* modal is clear (Cancel, title, code, verify, resend countdown). OK.
- *Wording:* "Verification failed. Please try again." is unhelpful — the real cause is "We verified your code but couldn't update your email." Recommend surfacing the actual EF error message instead of the generic fallback.
- *Design-system:* "Verify Your Email" fullScreen modal uses primary pill Verify (green), Cancel is a text button (fine as the secondary affordance). No deviation observed.

**Locator gaps:** "Cancel" on the fullScreen modal is a Text `TouchableOpacity` — not AX-exposed (pixel-tapped ~pt 40,58). The OTP input + Verify button are exposed.

---

## ACC-TC-B03 · Phone OTP real-SMS leg — BLOCKED

**Guide:** Account (FLOW-02 · EditProfileScreen) · **Actors:** test-buyer

**Execution trace (abbreviated):** Edit Profile → phone field cleared → typed `5519985017` (10-digit; `toE164` → `+15519985017`) → Save Changes → "Verify Your Phone" modal opened ("We sent a 6-digit code to 5519985017", "Resend code in 60s").

**Assert result: BLOCKED** (real-SMS leg impossible — environment/backend config defect).

**Evidence:**
- `function_logs` 16:52:34–35Z: `[send-phone-otp] Generated OTP … for phone: +15519985017` then **`Twilio API error: {"code":21606,"message":"The 'From' phone number provided (+19853154226) is not a valid message-capable Twilio phone number for this destination","status":400}`** then `[send-phone-otp] Error: Twilio SMS failed: 400`.
- `phone_verification_codes`: **no row** stored for `5519985017` (send failed before persist).
- Client `phoneService` fell back to the DEV SMS bypass (`123456`) — the modal showed success but **no real SMS was ever sent/delivered**.

**Verdict note:** Per the prompt's one-send discipline, no second real send was attempted. The real-code entry cannot be performed because no SMS arrives. A dev fix (Twilio From number / region config for the staging project) is required before the real leg is testable. The generated OTP is also logged in plaintext by `send-phone-otp` (minor privacy note).

**UX review:**
- *Structural:* phone OTP modal mirrors the email one; countdown + verify present. OK.
- *Wording:* "Dev mode: use 123456 to skip SMS." is a dev-only hint (client-hardcoded) — invisible to production users. Acceptable.
- *Design-system:* no deviation observed on the modal.

---

## ACC-TC-B10 · Locked-field affordance — PASS

**Guide:** Account · **Actors:** test-buyer

**Trace:** Edit Profile → tap Full Name "?" icon (pixel ~pt 408,131) → **Contact Support** opened (no Alert, no email) → back → tap DOB "?" icon (~pt 408,235) → **Contact Support** opened → back → ZIP field observed.

**Assert result: PASS** — both "?" icons navigate to Contact Support; Full Name + DOB inputs disabled (`editable=false`); ZIP renders **"ZIP CODE (CANNOT BE CHANGED)"** + helper **"Zip codes are locked to your node."** (no "?" icon); no support-email surface on Edit Profile.

**Locator gap (flagged):** the "?" icons are bare `TouchableOpacity` with `accessibilityLabel` only (no `accessible`/`accessibilityRole`) → **not in the AX tree** (BP-53 class). Pixel-derived at the label-row right edge. Recommend adding `accessible` + `accessibilityRole="button"`.

**Design-system:** icons are green `#5DBB8E` 16px (matches primary token). No deviation.

---

## ACC-TC-H05 · Logged-in Contact Support, no email fallback — PASS

**Guide:** Account (FLOW-19 · ContactSupportScreen) · **Actors:** test-buyer + guest

**Logged-in leg:** empty submit → **"Missing Subject / Please enter a subject for your message."** (GlobalAlertProvider); valid submit (subject + message) → **"Message Sent / Thank you for contacting us. We'll respond within 24 hours."** → DB row `2c087f2a` (`user_id=49243010…`, `contact_email=null`). No guest email/phone fields shown when logged in. No raw email surface.

**Guest leg:** from Login → "Need help? Contact Support" → guest form renders with **"YOUR EMAIL (SO WE CAN REPLY)"** (required) + **"PHONE (OPTIONAL)"**; submitting with subject+message but no email → **"Missing Email / Please enter your email so we can reply."** (matches guide copy exactly).

**Assert result: PASS.** No email-fallback UI/copy anywhere on the screen (logged-in or guest).

**Design-system:** Contact Support screen — primary pill Send button, filled inputs, labels uppercase — matches design tokens. The screen shows the bottom tab bar (structural note only; see cross-cutting).

---

## ACC-TC-H06 · No-raw-email sweep — PASS

**Surfaces swept (tree + OCR):** Login, Signup, Help & Support menu, FAQ list, education Help footer (`help-contact-support-link` → Contact Support), Contact Support (logged-in + guest), Edit Profile, My Subscription (Support button → Contact Support), Suspended Account (`suspended-contact-support-button` → Contact Support), "Contact Us" menu item (→ Contact Support). **No visible `support@` / `admin-support@` / `mailto:` / "email us" on any screen.**

**Source grep corroboration:** `grep -rn "support@|admin-support@|mailto:|email us" p2p-kids-marketplace/src` → only a code comment in `ContactSupportScreen.tsx:168` ("no raw 'email us' surfaces exist…" — a comment) and `AccountLinkingPrompt.tsx:168` ("email using another login method" — false positive). Clean.

**Assert result: PASS.** Every support/contact affordance routes to the in-app Contact Support form; the only email input is the guest "YOUR EMAIL (SO WE CAN REPLY)" field.

---

## ACC-TC-H07 · Guest ticket + rate limit — PASS

**Guide:** Account (D2 · unauth branch) · **Actors:** guest

**Trace:** Login → Contact Support → guest submit #1 (`samer.alzubaidi82@gmail.com`, subject "QA guest ticket 1…") → "Message Sent" → DB row `423f1ad8` (`user_id=NULL`, `contact_email` set). → Submissions #2 and #3 (same email) → "Message Sent" → **submission #4 → "Limit Reached / You have reached the limit for support messages. Please try again later."** (SQLSTATE GRATL surfaced). → Signup → "Need help? Contact Support" opens the guest form; back returns to Signup.

**DB verification:** exactly **3** guest rows for `samer.alzubaidi82@gmail.com` (17:04–17:06Z); the 4th was blocked by the `fn_support_guest_rate_limit` trigger (max 3 per contact_email / 24h).

**Honeypot:** the `company-input` honeypot is off-screen + transparent and **not AX-exposed** → not harness-fillable. **Source-verified:** `handleSubmit` checks `company.trim() !== ''` → shows the fake "Message Sent" alert and returns **without inserting a row** (bots get fake success, no ticket). Documented as source-verified only per prompt.

**Assert result: PASS.**

---

## ADM-TC-S03 · Admin reply flow — SKIPPED (out of scope for this agent)

**Reason:** per agent scope §2, the admin web app has no mobile-mcp equivalent and is automated via the Playwright path, **not** through this agent. The reply submission is an admin-UI action I am not scoped to perform.

**What was verified (DB/read side):**
- The guest ticket for the reply exists and is ready: **3** `support_messages` rows with `contact_email=samer.alzubaidi82@gmail.com`, `user_id=NULL` (would display as "Guest" with the reply email in `/support`).
- `support_message_replies` currently = **0** (no reply yet).
- The `send-email` EF `support_reply` path (plain-HTML handler) is present in the deployed function — the reply email leg is wired but unexercised until an admin submits a reply.

**Gap to close (Playwright/manual):** open the guest ticket in the admin `/support` UI, confirm the "Guest" pill + contact fields, submit a reply (`support-reply-input` / `btn-support-reply`), then DB-verify the `support_message_replies` row and confirm the real reply email arrives at `samer.alzubaidi82@gmail.com`. Flag as a follow-up for the Playwright path.

---

## ACC-TC-L01–L04 · Crash trigger / ErrorBoundary — PASS (4/4)

**Guide:** Account (FLOW-21 · ErrorBoundary) · **Actors:** test-buyer

**Trace:**
- **L01:** armed `crash_trigger=once` (`p2pkidsmarketplace://qa-dev-toggle?key=crash_trigger&value=once`) → Profile (fresh mount) → dev LogBox "Render Error" + **ErrorBoundary fallback** (😵 "Something went wrong", subtitle, DEV details, **Try Again** `error-boundary-retry`). No red/white screen. PASS.
- **L02:** "Try Again" → once-mode auto-disarmed → boundary reset → **Home rendered** (recovery without kill/relaunch). PASS.
- **L03:** armed `crash_trigger=persist` → Profile → fallback → Try Again → reset to Home (contained) → re-navigate Profile → **fallback re-appears** (persist, contained — no native crash, Home usable between attempts). PASS.
- **L04:** CDP capture (`cdp-l01-l04-capture.txt`) shows **`[console.error] [ErrorBoundary] caught Error: [QA crash trigger] …` on every crash** → telemetry/reporting fires via `componentDidCatch` + `captureException`; fail-closed design (release/`captureException` no-op) keeps the fallback working. No native crash. PASS.

Toggle **disarmed** to `none` after.

**Design-system:** fallback uses `#5DBB8E` primary pill, `#FFFFFF` surface, `#FEF3C7` dev box — consistent with tokens. No deviation.

---

## Back-button spot-check (regression) — PASS

Canonical `back-button` (40×40, "Go back" accessibility label, header-left, `testID="back-button"`, bell+chat right) verified on **Contact Support, Help & Support menu, FAQ, education Help, MySubscription, SuspendedAccount** — all beyond Edit Profile. No green/undersized/labeled/stacked deviations observed. (Fix already user-confirmed; this is a light re-check.)

---

## Cross-cutting UX / design-system findings

- **Structural:** Contact Support, Edit Profile, Profile, MySubscription, Help screens all render the bottom tab bar (Sell/Home/Discover/Trades/Basket). This is arguably intentional for the main tab surfaces, but on a pushed detail screen like Contact Support/Edit Profile it is a notable layout choice — flag for design review whether detail screens should hide the tab bar (not a defect against the docs I have).
- **Wording:** (a) B02 verify failure shows the generic "Verification failed. Please try again." instead of the actual EF message ("We verified your code but couldn't update your email…") — surface the real message. (b) The "Dev/QA mode: the code is 123456" / "Dev mode: use 123456 to skip SMS" hints are client-hardcoded `__DEV__` text — harmless in prod, but misleading if the server gate differs (it currently matches).
- **Design-system:** no concrete token deviations found on any screen/modal visited this batch (primary green `#5DBB8E`, filled inputs, pill buttons, GlobalAlertProvider alerts on-white with primary/neutral styling).

---

## QA Session Handoff

**Test Scope:** ACC-TC-B02, ACC-TC-B03, ACC-TC-B10, ACC-TC-H05, ACC-TC-H06, ACC-TC-H07, ADM-TC-S03 (skipped), ACC-TC-L01–L04 + back-button spot-check (Account file, iOS mobile).
**Design-System Compliance:** PASS — no concrete deviations found this batch (all screens/modals use the documented tokens: primary `#5DBB8E`, filled inputs, pill buttons, white modal surfaces, GlobalAlertProvider alerts). Two structural observations flagged for review (tab bar on detail screens; generic failure copy), not token deviations.
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the ideal UX threshold (<3s); none flagged.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Contact Support (logged-in & guest): wording + layout match; no email fallback.
- CONFIRMED — Login / Signup: "Need help? Contact Support" links, no raw email.
- CONFIRMED — Help & Support menu, FAQ, education Help footer: Contact Support links, no email.
- CONFIRMED — My Subscription: Support button → Contact Support; no email.
- CONFIRMED — Suspended Account: Contact Support button; copy "contact our support team" (no email).
- CONFIRMED — Edit Profile: locked-field "?" → Contact Support; no email.
- CONFIRMED — ErrorBoundary fallback, Verify-Your-Email / Verify-Your-Phone modals, Guest form, Missing-Email / Limit-Reached alerts: token-consistent.
- DEVIATION (minor, copy) — B02 verify failure surfaces generic "Verification failed. Please try again." instead of the specific EF error; and "Dev/QA mode: the code is 123456" is client-hardcoded (matches server today, but is a fragile dev hint).
**Verdict Summary:** 5 PASS / 1 FAIL / 1 BLOCKED / 1 SKIPPED (out-of-scope) + 1 regression spot-check PASS. (L01–L04 counted as one PASS line; 11 requested case-lines total.)
**Critical Findings:**
1. **CRITICAL (B02):** `auth-email-change` EF verify/apply is broken — TABLE-returning RPC read as an object → verification always "fails" after the code verifies; email never applied. Blocks the whole email re-verification feature.
2. **CRITICAL (B02):** `EMAIL_IN_USE` uniqueness guard silently broken (PostgREST 406 on `auth.users` query) — a change to an already-registered email is accepted → account-email-takeover hazard.
3. **HIGH (B03):** Twilio From number `+19853154226` not message-capable for `+15519985017` (error 21606) → real SMS never delivered; the real-delivery leg is untestable until Twilio config is fixed. (Minor: `send-phone-otp` logs the generated OTP in plaintext.)
4. **LOW (locator gap):** EditProfile "?" icons not AX-exposed (BP-53); verify-modals' "Cancel" not AX-exposed.
**App State Left Behind:**
- test-buyer: **email + phone unchanged in DB** (`test-buyer@…` / `5551234002`, auth=profile) — B02/B03 changes did NOT apply, **no seed restore needed**.
- 3 guest tickets for `samer.alzubaidi82@gmail.com` (rate-limit full — next slot opens after 17:06Z+24h).
- 1 H05 logged-in ticket (`2c087f2a`).
- `email_change_verifications` orphans for test-buyer: `7f0f9786` (superseded) + `5ec4ee58` (`verified_at` set, never used) — cleanup candidates.
- `crash_trigger` disarmed to `none`. App left at Landing (logged out). Simulator clean.
**Why It Matters:** This batch proves the support-channel consolidation (guest tickets, rate limit, no raw email surfaces, admin-reply wiring) is largely working, but it surfaced two CRITICAL backend defects in the newly-added email re-verification feature (B02) and a Twilio config blocker for real SMS delivery (B03) that must be fixed before those flows can be considered shippable or the real-delivery legs testable.
**How to Verify/Reproduce:**
- B02 #1: as test-buyer, change email → modal → enter `123456` → "Verification failed"; DB: `email_change_verifications.verified_at` set but `auth.users.email` unchanged. (Evidence: screenshots 05/06, `email_logs`, edge/function logs.)
- B02 #2: attempt a change to `samer.alzubaidi82@gmail.com` (registered) → accepted (pending row + email sent) instead of `EMAIL_IN_USE`. (Evidence: edge_logs 406.)
- B03: change phone to `5519985017` → modal; `function_logs` shows Twilio 21606; no `phone_verification_codes` row; no SMS at `+15519985017`.
- H07: submit 3 guest tickets from one email, 4th → "Limit Reached".
- L01–L04: `qa-dev-toggle?key=crash_trigger&value=once|persist` on Profile.
**Known Gaps / Not Tested:** ADM-TC-S03 admin-UI reply submission (Playwright path — out of scope); honeypot fake-success (source-verified only, field not AX-reachable); owner-inbox confirmation of the actual `change_email` email body and the (not-yet-sent) `support_reply` email are human checks.
**What Needs To Be Fixed Next:**
1. Fix: `auth-email-change` verify action must unwrap the TABLE-returning `verify_email_change_code` result (read `data[0]`/array form) so `success`/`new_email` resolve and the apply (`admin.auth.admin.updateUserById` + `profiles.email` sync) actually runs. (Blocks B02.)
2. Fix: the `EMAIL_IN_USE` guard — replace the broken `admin.schema('auth').from('users').maybeSingle()` (PostgREST 406) with a reliable uniqueness check (e.g., a SECURITY DEFINER RPC or the GoTrue admin `listUsers` filter) so registered emails are rejected. (Account-takeover hazard.)
3. Fix (ops): correct the staging Twilio "From" number so it is message-capable for `+15519985017` (error 21606) — unblocks B03's real-SMS leg; also stop logging generated OTPs in plaintext.
4. Fix (low): add `accessible`+`accessibilityRole="button"` to the EditProfile "?" icons (BP-53) and expose the verify-modals' "Cancel".
**UX Enhancement Ideas (optional, not defects):** None this run beyond the flagged copy/structural items above — no friction observed that isn't already captured as a defect or follow-up.
**Suggested Next Session:** Re-run B02 after the EF fixes, then B03's real-SMS leg after the Twilio fix (one real send); close ADM-TC-S03 via the Playwright path (reply → `support_message_replies` row → real reply email to `samer.alzubaidi82@gmail.com`).
**Suggested to Improve Agent Rules:** Consider recording in the playbook that `admin.schema('auth').from('users')` PostgREST queries return 406 (unreliable) for uniqueness checks, and that TABLE-returning RPCs arrive as arrays in supabase-js (both cost significant on-device time to root-cause this run).
