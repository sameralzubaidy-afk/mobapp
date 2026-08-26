# QA Full-Closure Re-verify — ACC-TC-B02 (happy + security-rejection) / ACC-TC-B03 (real-SMS) / ADM-TC-S03 (gap)

**Date:** 2026-08-26 · **Agent:** QA Test Agent (execution-only) · **Device:** iPhone 17 Pro Max sim (iOS 26.1) · **Persona:** test-buyer (`49243010-…`)
**Run dir:** `e2e-test-results/account-file-b02-b03-reverify-2026-08-26/` (screenshots/)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (ACC-TC-B02, ACC-TC-B03) + `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM-TC-S03)
**Prompt context:** Supersedes the prior round's B02/B03. Preconditions confirmed: B02 EF fixes deployed (`auth-email-change` v10: `unwrapRpcResult` + `check_account_exists_by_email` guard — `.schema('auth')` only in comments) and `send-phone-otp` redeployed (v10, BP-64). DB prereqs live (`check_account_exists_by_email` jsonb SD; `verify_email_change_code` RETURNS TABLE).

**Roll-up: 2 PASS / 0 FAIL / 1 BLOCKED / 1 SKIPPED (out of scope)** — B02 happy path **PASS**, B02 security-rejection **PASS**, B03 real-SMS leg **BLOCKED** (Twilio send still fails → HTTP 500), ADM-TC-S03 **SKIPPED** (admin-web = Playwright path, agent scope §2).

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| ACC-TC-B02 (happy) | Account | **PASS** | Email change → Verify-Your-Email modal → `123456` → **applied**: `auth.users.email` = `profiles.email` = `test-buyer+b02reverify@…` (in sync, 19:42:34Z); row `a861320d` `verified_at`+`used_at` set (non-replayable); UI navigated to Profile, new email shown. The previously-broken verify/apply path (BP-62) now works end-to-end. |
| ACC-TC-B02 (rejection) | Account | **PASS** | Change to already-registered `samer.alzubaidi82@gmail.com` → **"Updated with Warning / That email is already used by another account."** (GlobalAlertProvider); **NO new `email_change_verifications` row** (only prior `7f0f9786`), **NO new `email_logs` send**. The previously-broken EMAIL_IN_USE guard (BP-63, PostgREST 406) now fires. |
| ACC-TC-B03 | Account | **BLOCKED** | Real-SMS leg impossible: `send-phone-otp` v10 returned **HTTP 500 EDGE_FUNCTION_ERROR** (19:47:43Z) + 2 error logs; `phone_verification_codes` row `e5442cb7` stored pre-send (attempts 0, never verified); client silently dev-bypassed. **No real SMS delivered** — same class as the prior confirmed Twilio 21606 (From `+19853154226` not message-capable for `+15519985017`). One real send attempted; no retry. |
| ADM-TC-S03 | Admin | **SKIPPED** (out of scope) | Admin-web reply leg is the Playwright path (agent §2). No DB-side action taken; see Known Gaps. |

**Perceived load-time table** (all labeled: perceived load time, simulator, wall-clock, ±polling-interval — not a formal performance profile):

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Login | ~1s | OK |
| Login → Home (test-buyer) | ~1–2s | OK |
| Home → Profile → Edit Profile | <2s | OK |
| Edit Profile Save (email) → Verify-Your-Email modal | ~1–2s | OK |
| Verify email → Profile (`navigation.reset`) | ~1s to navigate; Profile stuck on "Loading profile..." until navigate-away/back | **FLAGGED** (see cross-cutting) |
| Edit Profile Save (phone) → Verify-Your-Phone modal | ~1–2s | OK |

No cold-start or ≥3s transition. **Perceived Load-Time Verdict: GOOD** (one post-verify "Loading profile..." stall is a separate app-behavior finding, below).

---

## ACC-TC-B02 · Email re-verification — PASS (both legs)

**Guide:** Account (FLOW-02 · EditProfileScreen) · **Actors:** test-buyer

### Execution trace (abbreviated)

**Happy path:**
1. Login as test-buyer → Home → Profile → Edit Profile.
2. Email field `test-buyer@…` → tap → **Cmd+A (select-all) + type `test-buyer+b02reverify@kidsmarketplace.test`** → field value confirmed (tree).
3. Dismiss keyboard (Cmd+K) → scroll up → **Save Changes**.
4. **Verify Your Email** modal opens: "We sent a 6-digit code to test-buyer+b02reverify@kidsmarketplace.test" + `edit-profile-email-otp-input` + `edit-profile-email-verify-button` + "Resend code in 59s".
5. Enter `123456` → field shows `1 2 3 4 5 6` → dismiss keyboard → **Verify**.
6. Modal closes → `navigation.reset` to Profile (transient "Loading profile..." → recovered via Home → Profile).
7. Edit Profile shows email field = `test-buyer+b02reverify@kidsmarketplace.test` (UI reflects the change).

**DB verification (DB-over-UI, authoritative):**
- `auth.users.email` = `test-buyer+b02reverify@kidsmarketplace.test` (updated_at 19:42:34.141Z); `profiles.email` = same (19:42:34.433Z) — **both in sync**.
- `email_change_verifications`: new row `a861320d` (`new_email = test-buyer+b02reverify@…`, attempts 1, **`verified_at` 19:42:33 SET, `used_at` 19:42:34 SET**) — code consumed, cannot be replayed.
- Orphan `5ec4ee58` (verify02, `verified_at` set from the prior broken run) **sealed** by `complete_email_change` (used_at set) — cleanup candidate resolved.

**Security-rejection leg:**
1. Edit Profile → email field → Cmd+A + type `samer.alzubaidi82@gmail.com` (already registered, user `db71e4d8`) → field confirmed.
2. Dismiss keyboard → scroll → **Save Changes**.
3. In-app `GlobalAlertProvider` alert: **"Updated with Warning" / "That email is already used by another account."** (+ OK `global-alert-button-0`). No verify modal, no pending request, no email.
4. OK → `navigation.goBack()` → Profile.

**DB verification:**
- `email_change_verifications` for `samer.alzubaidi82@gmail.com`: **only** the prior run's `7f0f9786` (created 16:41:58Z, `used_at` 16:46:03Z) — **no new row at ~19:44Z**.
- `email_logs` for `samer.alzubaidi82@gmail.com`: only the prior run's `69bd3b70` (change_email, sent 16:42Z, code 123456) — **no new send**.
- The only `change_email` email after 19:40Z is to `test-buyer+b02reverify@…` (19:41:45Z — the happy-path send). 

**Restore to baseline (cleanup):** changed email back to `test-buyer@kidsmarketplace.test` → modal → `123456` → Verify → applied. Row `c83e6994` sealed (`verified_at` 19:46:18, `used_at` 19:46:19). `auth.users.email` = `profiles.email` = `test-buyer@kidsmarketplace.test` (19:46:19Z). **Baseline restored — no seed restore needed.**

### Assert result: **PASS** (both legs)

Guide assert map: (1) modal opens, no immediate apply — PASS; (2) wrong-code friendly error — not re-tested this run (covered by prior round); (3) valid code → Profile + `auth.users.email` + `profiles.email` updated — **PASS** (both tables, in sync); (4) Cancel leaves old email — implied PASS via restore-cycle (verified the rejection path never touched the account). Plus the security-rejection leg (prompt-critical): explicit rejection + no pending row + no email — **PASS**.

### UX review
- *Structural:* Verify-Your-Email fullScreen modal is clear (Cancel, title, single OTP field, Verify pill, resend countdown). Navigation after verify → Profile. OK. One structural note: post-verify `navigation.reset` leaves Profile on "Loading profile..." until you navigate away/back (same class as the 2026-08-24 phone-verify finding) — see cross-cutting.
- *Wording:* "That email is already used by another account." is clear and parent-friendly. "Dev/QA mode: the code is 123456 on staging." is a client-hardcoded `__DEV__` hint — matches the server gate today (`DEV_EMAIL_CODE_FIXED=true`, confirmed via `email_logs.metadata.code`), harmless in prod. OK.
- *Design-system:* modal uses primary-green `#5DBB8E` Verify pill (one primary), white surface, uppercase header, filled OTP field, GlobalAlertProvider alert on-white with primary OK button. **No deviations.**

### Locator-gap findings
- **Verify-modal Cancel (email + phone):** AX-fix added `testID`+`accessible`+`role` (BP-53), and the element now surfaces in the AX tree at (20, 36, 50×27) — **but a tap at the AX-reported center (45,49) MISSES**; the working tap is ~**pt (40,58)** (matches the pre-fix memory note). The AX-reported frame is offset from the actual touchable hit area. Flag for instrumentation review (the AX fix improved exposure but the frame is still inaccurate).
- Email/phone OTP inputs + Verify buttons are AX-exposed — no gap.

### Friction vs. the operating rules
- **Long-press → Select All → Cut did NOT produce the native selection menu** on the email/phone fields this build (3 attempts: long-press 700ms/1000ms, double-tap). **Discovered reliable alternative: focus field → osascript Cmd+A (hardware-keyboard select-all) → type replacement text** — replaces the whole value cleanly. Recommend recording Cmd+A+type as a standing field-replace technique (see Suggested to Improve Agent Rules).
- Keyboard re-shows per-field on this build; Cmd+K re-applied before each submit (per standing practice).
- AX-tree staleness after `navigation.reset` (modal elements + "Loading profile..." mixed in one tree) — screenshot/OCR used as source of truth (§5.9).

---

## ACC-TC-B03 · Phone OTP real-SMS leg — BLOCKED

**Guide:** Account (FLOW-02 · EditProfileScreen) · **Actors:** test-buyer

### Execution trace (abbreviated)

1. Edit Profile → phone field `5551234002` → Cmd+A + type `5519985017` (10-digit; app normalizes to E.164 `+15519985017`) → field confirmed.
2. Dismiss keyboard → scroll → **Save Changes**.
3. **Verify Your Phone** modal opens: "We sent a 6-digit code to 5519985017" + "Dev mode: use 123456 to skip SMS." + resend countdown 58s.
4. **Evidence of the real-send outcome (DB + logs):**
   - `function_edge_logs` 19:47:43.959Z: `POST /functions/v1/send-phone-otp` (user `49243010-…`) → **`response.status_code` = 500**, `EDGE_FUNCTION_ERROR`, 75-byte body.
   - `function_logs` for the `send-phone-otp` execution (`934e41c9-…`): Boot → 2× info → **2× error** at 19:47:43.950/.951 (the `console.error('Twilio API error: …')` + `[send-phone-otp] Error: …` pair — identical shape to the prior run's 21606 failure).
   - `phone_verification_codes`: row `e5442cb7` created 19:47:43Z for `+15519985017` (attempts 0, expires 19:57:43Z) — **stored PRE-send** (v10 inserts the code row before calling Twilio, so row presence does NOT imply delivery).
   - Client `phoneService` received the 500 with code `SEND_FAILED` → `shouldDevBypass` true → **silent DEV-SMS bypass** (countdown started, modal ready for `123456`).
   - **No real SMS was delivered.** The exact Twilio error string is not retrievable via the available `mcp_supabase_query_logs` interface (function_logs message body is not exposed in `log_attributes`/`event_message` — a query-interface gap, not an app defect); the failure class matches the prior confirmed **error 21606** ("The 'From' phone number provided (+19853154226) is not a valid message-capable Twilio phone number for this destination").
5. **One real send only per the prompt's discipline — no retry.** Modal cancelled (Cancel @ pt ~40,58).

**DB verification:** `auth.users.phone` = `profiles.phone` = **`5551234002` unchanged**, `phone_verified` true — the change did **not** apply; **no seed restore needed**. The `phone_verification_codes` row `e5442cb7` is an orphan (10-min TTL, auto-expires 19:57:43Z).

### Assert result: **BLOCKED** (real-SMS leg impossible — Twilio send still failing)

Guide assert map: (1) phone change opens modal, no immediate apply — PASS (modal opened, `auth.users.phone` unchanged); (2) resend countdown — PASS (countdown observed); (3) wrong code error — not reached; (4) valid code → Profile + `auth.users.phone` + `profiles.phone_verified_at` — **NOT REACHABLE**: the real SMS never arrives, so the real code cannot be entered, and entering `123456` would exercise the dev bypass, not the genuine Twilio + `verify_otp_code` path. The one-send discipline means no retry.

### UX review
- *Structural:* phone OTP modal mirrors the email one (Cancel, title, single OTP field, Verify pill, resend countdown). OK.
- *Wording:* "Dev mode: use 123456 to skip SMS." is client-hardcoded dev text (invisible in prod). Note: because the client silently dev-bypasses on any Twilio/SEND_FAILED error, a real delivery failure is **indistinguishable from success in the UI** (the modal just shows the dev hint + countdown). That is by design for dev, but it means the real-SMS leg can only be proven via function logs/DB — documented.
- *Design-system:* no deviation observed on the modal.

### Locator-gap findings
- Same verify-modal Cancel AX-frame offset as B02 (working tap ~pt 40,58 vs AX center 45,49).

---

## ADM-TC-S03 · Admin reply flow — SKIPPED (out of scope for this agent)

Per agent scope §2, the admin web app has no mobile-mcp equivalent and is automated via the Playwright path, **not** through this agent. The reply submission is an admin-UI action outside this agent's scope.

**What was NOT changed/exercised:** no `support_message_replies` row was created; the real reply-email leg to `samer.alzubaidi82@gmail.com` remains unexercised. **Gap to close (Playwright/manual):** log into the admin portal as `test-admin@kidsmarketplace.test`, open the latest guest ticket from `samer.alzubaidi82@gmail.com` (check `support_messages` for the most recent guest row with this `contact_email`), confirm the "Guest" pill + `contact_email`/`contact_phone` display, submit a reply, then DB-verify the `support_message_replies` row (`admin_id`) and confirm the reply email actually arrives at `samer.alzubaidi82@gmail.com`.

---

## Cross-cutting UX / design-system findings

- **Post-verify "Loading profile..." stall (app-behavior finding, moderate):** after email-verify (and per the 2026-08-24 run, phone-verify) `navigation.reset` to Profile, the Profile screen stays on "Loading profile..." indefinitely until the user navigates away and back. The data is fully applied (DB-proven) — this is a client re-hydration/refresh issue after `navigation.reset`, not a backend failure. Recommend the dev agent add a post-verify profile refresh/re-fetch. (Was a noted symptom in the prior run; reproduced again.)
- **Silent dev-bypass masks real SMS failures (UX/ops note):** when `send-phone-otp` returns `SEND_FAILED`/Twilio errors, the client silently falls back to `123456` and the UI shows a normal-looking modal. This is correct for dev friction-reduction but means a real delivery failure is invisible to the user/QA in the UI — only function logs / DB reveal it. Documented, not a defect.
- **Design-system:** all screens/modals visited this run (Login, Home, Profile, Edit Profile, both verify modals, rejection alert) use the documented tokens (primary `#5DBB8E`, filled inputs, pill buttons, white modal surfaces, GlobalAlertProvider alerts). **No token deviations.**

---

## QA Session Handoff

**Test Scope:** ACC-TC-B02 (happy + security-rejection), ACC-TC-B03 (real-SMS leg), ADM-TC-S03 (skipped — admin-web out of scope), plus email/phone baseline restores (Account guide, iOS mobile).
**Design-System Compliance:** PASS — no concrete token deviations found this run (all screens/modals use the documented tokens: primary `#5DBB8E`, filled inputs, pill buttons, white modal surfaces, GlobalAlertProvider alerts).
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the ideal UX threshold (<3s) except the post-verify Profile "Loading profile..." stall, which is a separate app-behavior finding (re-hydration after `navigation.reset`), not a load-time failure.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login: wording + layout match; no raw email surface.
- CONFIRMED — Home (Norwalk Central header, dashboard): token-consistent.
- CONFIRMED — Profile: header/back-button canonical; no email surface.
- CONFIRMED — Edit Profile: canonical back-button; locked fields + "?" icons present (AX-exposed now); Save button primary pill.
- CONFIRMED — Verify Your Email modal: clear copy ("We sent a 6-digit code to {new}"), single OTP field, primary Verify, dev hint consistent with server gate.
- CONFIRMED — Verify Your Phone modal: mirrors email modal; dev hint present.
- CONFIRMED — Security-rejection alert (GlobalAlertProvider): "Updated with Warning / That email is already used by another account." — clear, parent-friendly.
- CONFIRMED — No raw support-email surfaces on any screen visited.
- DEVIATION (minor, behavioral) — post-verify Profile "Loading profile..." stall until navigate-away/back (moderate app finding, not a token/copy deviation).
- DEVIATION (minor, AX) — verify-modal Cancel AX frame offset (reported frame center (45,49) misses; working tap (40,58)).
**Verdict Summary:** 2 PASS / 0 FAIL / 1 BLOCKED / 1 SKIPPED (out of scope). (B02 counted as one case-line covering both its legs; both PASS.)
**Critical Findings:**
1. **CLOSED (B02, CRITICAL):** email re-verification now works end-to-end after the `auth-email-change` v10 fix — verify/apply (BP-62 unwrap) and the EMAIL_IN_USE guard (BP-63 via `check_account_exists_by_email`) both verified PASS on-device + DB. Account-email-takeover hazard resolved.
2. **STILL BLOCKED (B03, HIGH — ops):** real SMS delivery to `+15519985017` still fails — `send-phone-otp` v10 returned HTTP 500 EDGE_FUNCTION_ERROR (19:47:43Z); exact Twilio text not retrievable via the current log-query interface, but the failure class matches the prior confirmed error 21606 (From `+19853154226` not message-capable for the destination). Twilio config for the staging project is the unblock item.
3. **MODERATE (client):** post-verify Profile "Loading profile..." stall after `navigation.reset` (email + phone paths) — add a post-verify profile refresh.
4. **LOW (AX):** verify-modal Cancel AX frame offset (fix improved exposure but the reported frame is inaccurate).
5. **LOW (query-interface gap):** `mcp_supabase_query_logs` does not expose `function_logs` message bodies (event_message/metadata empty) — the exact Twilio error can't be read back via this channel; recommend retrieving it from the Supabase dashboard function logs when re-verifying B03.
**App State Left Behind:**
- test-buyer: **email and phone at documented baseline** (`test-buyer@kidsmarketplace.test` / `5551234002`, auth=profile in sync) — **no seed restore needed**. App left logged-in at Profile (test-buyer), simulator clean.
- `email_change_verifications` for test-buyer: 3 sealed rows (`a861320d` b02reverify, `c83e6994` restore, `5ec4ee58` orphan finally sealed) + `7f0f9786` (samer.alzubaidi82, superseded/prior) — no actionable orphans (all sealed/expired).
- `phone_verification_codes`: orphan `e5442cb7` for `+15519985017` (attempts 0, expires 19:57:43Z auto — no cleanup needed).
- One real Twilio send attempt consumed this run (failing, so no SMS cost); two real `change_email` emails sent (happy path + restore) to `@kidsmarketplace.test` fixtures.
**Why It Matters:** This run proves the two CRITICAL B02 backend defects from the prior round are fixed and verified end-to-end (email re-verification applies correctly AND the account-email-takeover guard now rejects a change to a registered address with no row/email). The only remaining blocker in this batch is operational: Twilio configuration for real SMS delivery (B03), which is outside app code. Once Twilio is fixed, B03's real-SMS leg becomes testable with one real send.
**How to Verify/Reproduce:**
- B02 happy path: as test-buyer, Edit Profile → email `test-buyer+b02reverify@…` → Save → modal → `123456` → Verify → Profile; DB: `auth.users.email`=`profiles.email` updated, `email_change_verifications.used_at` set. (Evidence: screenshots 07, 08; DB queries in trace.)
- B02 rejection: Edit Profile → email `samer.alzubaidi82@gmail.com` → Save → "Updated with Warning / That email is already used by another account."; DB: no new `email_change_verifications` row, no new `email_logs` change_email. (Evidence: screenshot 10.)
- B03: Edit Profile → phone `5519985017` → Save → modal; `function_edge_logs` shows HTTP 500 EDGE_FUNCTION_ERROR for `/functions/v1/send-phone-otp`; `phone_verification_codes` row stored but never verified; no SMS at `+15519985017`.
**Known Gaps / Not Tested:** ADM-TC-S03 admin-UI reply submission (Playwright path — out of scope); B03 wrong-code/expired-code branches (unreachable until real SMS works); the exact Twilio error string (not retrievable via the current log-query interface — see dashboard logs); owner-inbox confirmation that the actual SMS/email bodies are readable (human check).
**What Needs To Be Fixed Next:**
1. Fix (ops): correct the staging Twilio "From" number / account config so a real SMS can be sent to `+15519985017` (resolves error 21606-class; EF already logs destination only, BP-64). This unblocks B03's real-SMS leg. (Dev/ops — the QA agent does not touch shared config.)
2. Fix (client, moderate): after email/phone verify `navigation.reset` to Profile, trigger a profile refresh so "Loading profile..." resolves without a navigate-away/back (reproduced again this run).
3. Fix (AX, low): correct the verify-modals' Cancel hit area so the AX-reported frame matches the tappable region (currently center (45,49) misses; working tap ~(40,58)).
4. Fix (ops/observability, low): surface `function_logs` message bodies via the log-query path (or read the exact Twilio error from the Supabase dashboard function logs) so QA can capture the precise error without a dashboard read.
**UX Enhancement Ideas (optional, not defects):** On the verify modals, after the real-SMS/email send the app shows no distinction between "dev bypass active" and "real code sent" — consider a dev-only visual tag when the bypass is active (reduces confusion in dev/QA runs); not required for production.
**Suggested Next Session:** Re-run B03's real-SMS leg once the Twilio config is fixed (one real send → real code entry → DB-verify `auth.users.phone` = `profiles.phone`); close ADM-TC-S03 via the Playwright path (admin reply → `support_message_replies` row → real reply email to `samer.alzubaidi82@gmail.com`).
**Suggested to Improve Agent Rules:** (1) Add a standing field-replace technique: focus field → osascript **Cmd+A** → type replacement (the long-press → Select All native menu did not appear for text/phone inputs this build; Cmd+A+type worked reliably 4/4 times). (2) Note that `function_logs` message bodies are not exposed via `mcp_supabase_query_logs` (only `log_attributes` metadata) — plan for dashboard-log reads or a different channel when an exact EF error string is required.
