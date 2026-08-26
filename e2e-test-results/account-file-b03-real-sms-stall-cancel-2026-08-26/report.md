# QA Run — ACC-TC-B03 Real-SMS (US 10DLC blocker) + Regression: Cancel Hit-Area / Profile Stall

**Date:** 2026-08-26 · **Agent:** QA Test Agent (execution-only) · **Device:** iPhone 17 Pro Max sim (iOS 26.1) · **Persona:** test-buyer (`49243010-…`)
**Run dir:** `e2e-test-results/account-file-b03-real-sms-stall-cancel-2026-08-26/` (screenshots/)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (ACC-TC-B03 + FLOW-02 EditProfile) · **Prompt:** real-SMS leg (one send), Profile-stall regression (email+phone), Verify-modal Cancel hit-area regression.

**Roll-up: 1 PASS / 0 FAIL / 1 BLOCKED / 2 NOT-TESTED (deferred per user wrap-up).** The B03 real-SMS leg is now **BLOCKED at the Twilio A2P US-10DLC carrier-compliance layer** (new root cause, supersedes the prior 21606 API error); the Cancel hit-area regression is **PASS (verified live)**; both Profile-stall regressions remain **not exercised on-device** (phone path needs the real verify the user declined; email path deferred on wrap-up request).

---

## Batch summary

| Check | Guide | Verdict | Top finding |
|---|---|---|---|
| ACC-TC-B03 real-SMS leg | Account | **BLOCKED** | `send-phone-otp` v13 **succeeded at the Twilio API layer** (HTTP 200, SID `SMd1377ec056fc4185cb94d337794a3221`) — 21606 resolved — but the SMS was **never delivered to the handset**: Twilio console shows **"Message from an Unregistered US 10DLC"** (the From number `+19853154226` is not registered under a US A2P 10DLC campaign). Carrier-compliance rejection, not an app/config-API defect. |
| Regression — Cancel hit-area | Account | **PASS** | `edit-profile-phone-verify-cancel` now renders at **(20,36,50×44)** = 44pt target; a single tap at the **exact AX-frame center (45,58)** — the point that previously missed — closed the modal reliably, no offset tap needed. Fix verified live in the running bundle. |
| Regression — Profile stall (phone path) | Account | **NOT TESTED** | Requires completing phone verify (real SMS + real code), which the user declined ("will not complete this registration now"). Fix is present in source (`ProfileScreen.tsx` diff verified); not yet exercised end-to-end on-device. |
| Regression — Profile stall (email path) | Account | **NOT TESTED** | Deferred on user wrap-up request. Quick to run later (uses dev-bypass `123456`, no real email read needed). Fix present in source. |

**Perceived load-time table** (all labeled: perceived load time, simulator, wall-clock, ±polling-interval — not a formal performance profile):

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Login | ~1s | OK |
| Login → Home (test-buyer) | ~1–2s | OK |
| Home → Profile → Edit Profile | <2s | OK |
| Edit Profile Save (phone) → Verify-Your-Phone modal | ~1–2s | OK |
| Verify modal → Cancel → Edit Profile | ~1s | OK |

No transition ≥ 3s. **Perceived Load-Time Verdict: GOOD.**

---

## ACC-TC-B03 · Real-SMS leg — BLOCKED (US 10DLC, carrier-compliance)

**Guide:** Account (FLOW-02 · EditProfileScreen) · **Actors:** test-buyer

### Execution trace (abbreviated)

1. Login as test-buyer → Home → Profile → Edit Profile.
2. Phone field `5551234002` → Cmd+A + type `5519985017` (app normalizes to E.164 `+15519985017`) → value confirmed in tree.
3. Dismiss keyboard → scroll → **Save Changes** → **Verify Your Phone** modal opens ("We sent a 6-digit code to 5519985017", dev hint, 59s countdown).
4. **Real-send outcome (server-side, immediate):**
   - `function_edge_logs` **20:26:22.147Z**: `POST | 200 | …/send-phone-otp` (deployment `_13`, exec 1152ms) — **first-ever 200 for this number** (prior v6/v10 both 500).
   - `function_logs` (same execution): `[send-phone-otp] OTP generated for phone: +15519985017` → **`SMS sent successfully: SMd1377ec056fc4185cb94d337794a3221`** → shutdown. **No error lines.**
   - `phone_verification_codes`: new row `009cb40d` (attempts 0, expires 20:36:21Z).
5. **User reports NO SMS received** at `+15519985017`; Twilio console shows **`Error detected: Message from an Unregistered US 10DLC`** → the message was accepted by the API (hence SID/200) but **rejected at Twilio's A2P 10DLC compliance gate** → never sent to the carrier.
6. **Resend** (user-requested): Resend button tapped (countdown expired) → `function_edge_logs` **20:31:08Z: `POST | 429`** → modal shows **"Too many attempts. Please try again in 86400 seconds."** → **rate-limit enforcement, not a bug**: test-buyer has **5** `phone_verification_codes` rows in the last 24h (2 from 08-25 on `+15551234002`, 3 today on `+15519985017`) = the EF's 5/24h user limit → correctly blocked. No new row created.
7. User declined to complete the verification ("will not complete this registration now") → **Cancel** tapped (see Cancel hit-area check) → modal closed → back on Edit Profile.

### Assert result: **BLOCKED** (real-SMS leg impossible — US-10DLC carrier-compliance blocker; user opted not to proceed)

Guide assert map: (1) phone change opens modal, no immediate apply — PASS (modal opened, `auth.users.phone` unchanged); (2) resend countdown + Resend — PASS (countdown observed; Resend fired → 429 rate-limited, expected); (3) wrong-code error — not reached; (4) valid real code → Profile + `auth.users.phone`/`profiles.phone_verified_at` — **NOT REACHABLE**: no real SMS is delivered (10DLC), so the real code can never be entered; entering `123456` would only exercise the dev bypass. One real send consumed (accepted by API, not delivered) + one resend attempt (rate-limited). Per discipline: no blind retries.

### Evidence
- Screenshots: `01-b03-editprofile-phone-5519985017.png`, `02-b03-verify-phone-modal-real-sms-sent.png`, `03-b03-modal-waiting-for-real-code.png`, `04-b03-resend-rate-limited-429.png`.
- `function_edge_logs`: 200 @ 20:26:22Z (deploy `_13`); 429 @ 20:31:08Z.
- `function_logs` 20:26:21–22Z: full execution incl. `SMS sent successfully: SMd1377ec056fc4185cb94d337794a3221`.
- `phone_verification_codes`: `009cb40d` (20:26:21Z) stored; 5 total rows/24h for test-buyer.
- DB cross-table (post-abort): `auth.users.phone` = `profiles.phone` = `5551234002`, email in sync, phone_verified true — **no partial state**.

### Root cause (supersedes prior finding)
- **Prior (21606):** From `+19853154226` "not a valid message-capable Twilio phone number for this destination" — an API-level config error. **RESOLVED** (v13 send returns 200 + SID).
- **Current (US 10DLC):** the From number is **not registered under a US A2P 10-Digit Long Code (10DLC) campaign**. Twilio accepts the message at the API layer (SID, HTTP 200) but its compliance gate drops it before carrier delivery → `Error detected: Message from an Unregistered US 10DLC` in the console. **Fix is an ops/trust-and-safety action** (register the From number under an approved 10DLC brand/campaign in Twilio), not app code.

### UX review
- *Structural:* modal clear (Cancel, title, single OTP field, Verify pill, resend area). OK.
- *Wording:* The rate-limit message **"Too many attempts. Please try again in 86400 seconds."** is accurate and parent-understandable, but the sibling **"Resend code in 742s"** countdown (capped at 3600 via `Math.min(retryAfterSeconds, 3600)`, `EditProfileScreen.tsx:403/774`) shows a different number than the 86400s message — minor internal inconsistency (countdown caps at 1h, message shows 24h). Suggest aligning the countdown display with the actual retry window.
- *Design-system:* no token deviation on the modal or the rate-limit state.

### Locator-gap findings
- **CLOSED:** verify-modal Cancel is now AX-exposed with `testID` + accessible + role AND a correct 44pt frame — the previous AX-frame-offset locator gap is resolved (see Cancel hit-area check).

---

## Regression — Verify-Modal Cancel Hit-Area — PASS

**Guide:** Account (FLOW-02) · **Assert:** tap Cancel at its reported AX-frame center (now ≥44pt) → closes reliably without the previously-required offset tap.

**Trace:** On the open Verify-Your-Phone modal, `edit-profile-phone-verify-cancel` reported frame **(20,36,50×44)** → tapped exactly at the **AX-frame center (45,58)** — the point that missed pre-fix (old frame center was (45,49), working tap ~(40,58)) → **modal closed on the first tap** → Edit Profile rendered.

**Assert result: PASS.** The 44pt `minHeight`/`minWidth` + centering fix (`EditProfileScreen.tsx` `verificationBackButton`) is verified live in the running bundle: the AX-reported frame center now coincides with the tappable region. (Also confirms the fix applies to the shared style used by BOTH phone + email verify modals.)

---

## Regression — Profile Stall (phone path) — NOT TESTED

Requires completing the phone verify (real SMS → real code), which the user declined this run. The fix is confirmed present in source (`ProfileScreen.tsx` diff: the focus handler now only honors `skipNextFocusRefreshRef` when `hasFocusedOnceRef.current` is true; fresh mounts always run `loadProfile({showFullScreenLoader:true})`), and the running bundle is served from the current working tree (Metro live), so the fix is very likely live — but the end-to-end "verify → immediate Profile render, no 'Loading profile...' stall" assertion was **not exercised on-device**. Quick follow-up (~5 min, dev-bypass path).

---

## Regression — Profile Stall (email path) — NOT TESTED

Deferred on user wrap-up request. Uses the dev-bypass code `123456` (server `DEV_EMAIL_CODE_FIXED=true`), so it needs no real email read; a quick B02 happy-path repeat (change email → save → modal → `123456` → Verify → check Profile renders immediately with the new email → restore baseline) completes this check. **Suggested next session item.**

---

## Cross-cutting UX / design-system findings

- **Structural:** Edit Profile renders the bottom tab bar as a sticky footer (Sell/Home/Discover/Trades/Basket) — same long-standing structural note as prior runs (flag for design review; not a defect against the docs).
- **Wording:** (a) rate-limit countdown vs message mismatch (742s countdown vs "86400 seconds" message) — minor, see B03 UX note; (b) "Dev mode: use 123456 to skip SMS." remains client-hardcoded `__DEV__` text (harmless in prod, matches server today).
- **Design-system:** no concrete token deviations found on any screen/modal visited (Login, Home, Profile, Edit Profile, Verify-Your-Phone modal incl. rate-limit state) — primary `#5DBB8E` pill Verify, filled inputs, white modal surface, GlobalAlertProvider-style handling.

---

## QA Session Handoff

**Test Scope:** ACC-TC-B03 real-SMS leg (one send + one resend attempt) + regressions: Verify-Modal Cancel hit-area, Profile stall (phone + email paths) — Account guide, iOS mobile.
**Design-System Compliance:** PASS — no concrete token deviations this run (primary `#5DBB8E`, filled inputs, pill buttons, white modal surface, GlobalAlertProvider-style alerts). One minor wording inconsistency flagged (rate-limit countdown vs message).
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the ideal UX threshold (<3s); none flagged.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login: wording + layout match; no raw email surface.
- CONFIRMED — Home (Norwalk Central header, dashboard): token-consistent.
- CONFIRMED — Profile: canonical back-button; stats/SP balance render.
- CONFIRMED — Edit Profile: canonical back-button; locked-field "?" icons AX-exposed (BP-53 fix verified live); Save button primary pill.
- CONFIRMED — Verify Your Phone modal: clear copy ("We sent a 6-digit code to 5519985017"), single OTP field, primary Verify, dev hint consistent with server gate.
- CONFIRMED — Rate-limit state (in-modal): "Too many attempts. Please try again in 86400 seconds." — clear, accurate; sibling "Resend code in Ns" countdown is capped at 1h → shows a different number than the 24h message (minor inconsistency, flagged).
- CONFIRMED — Cancel on verify modal: closes reliably at the reported AX-frame center (44pt hit-area fix verified).
- DEVIATION (minor, wording) — resend countdown (742s) does not match the "86400 seconds" rate-limit message shown simultaneously.
**Verdict Summary:** 1 PASS / 0 FAIL / 1 BLOCKED / 2 NOT-TESTED (deferred per user wrap-up). (B03 real-SMS BLOCKED; Cancel hit-area PASS; Profile-stall phone + email regressions not exercised on-device.)
**Critical Findings:**
1. **HIGH (ops — Twilio A2P compliance, B03 real-SMS):** `send-phone-otp` v13 now **succeeds at the API layer** (HTTP 200, SID `SMd1377…`, 21606 resolved) but delivery is **rejected by Twilio's US 10DLC compliance gate** — console: **"Message from an Unregistered US 10DLC"**. The From number `+19853154226` must be registered under an approved US A2P 10DLC brand/campaign. Until then, no real SMS can reach any US destination → the B03 real-code leg (and the phone-path Profile-stall regression) remain untestable.
2. **INFO (rate-limit state):** test-buyer's OTP send quota (5/24h) is exhausted until ~22:16Z (2026-08-26) — a legitimate enforcement; the next real send is possible after the oldest `phone_verification_codes` row drops out of the 24h window.
3. **CLOSED (AX, low):** verify-modal Cancel hit-area + exposure fixed and verified live (44pt target, tap at AX center works).
4. **MINOR (wording):** rate-limit resend countdown (capped at 3600s) ≠ the "86400 seconds" message — align the countdown with the real retry window.
**App State Left Behind:**
- test-buyer: **email + phone at documented baseline** (`test-buyer@kidsmarketplace.test` / `5551234002`, auth=profile in sync, phone_verified true) — the aborted B03 phone change did **NOT** apply. **No seed restore needed.**
- `phone_verification_codes`: rows `009cb40d` (20:26Z, valid until 20:36Z — now expired) + earlier orphans auto-expire; 5 rows/24h total for test-buyer (rate-limit state as of this run).
- App left on **Edit Profile** (logged in as test-buyer) with the phone field showing the unsaved `5519985017` value (local form state only; not persisted). No `crash_trigger`/toggles armed.
- One real Twilio send consumed this run (API-accepted, carrier-rejected — no delivery cost to a handset); one resend attempt was rate-limited (no SMS attempt).
**Why It Matters:** The B03 blocker has been **narrowed from an API-config error (21606, fixed) to a carrier-compliance gap (US 10DLC)** — this is the precise remaining ops action needed to make real SMS delivery work, and it is not app code. It also confirms the two UI-follow-up fixes (Profile stall + Cancel hit-area) are present in the running bundle, with the Cancel fix verified live; the Profile-stall fix still needs its end-to-end on-device confirmation (blocked by the same 10DLC issue for the phone path; the email path is an easy quick check).
**How to Verify/Reproduce:**
- Real-send path: as test-buyer, Edit Profile → phone `5519985017` → Save → modal; `function_logs` shows `SMS sent successfully: SMd1377…` + 200 edge log; handset at `+15519985017` receives nothing; Twilio console shows "Message from an Unregistered US 10DLC". (Evidence: screenshots 01–03; function/edge log queries in trace.)
- Rate-limit: tap Resend while 5 rows/24h exist → 429 → "Too many attempts. Please try again in 86400 seconds." (Evidence: screenshot 04; edge log 429 @ 20:31:08Z.)
- Cancel hit-area: open either verify modal → tap Cancel at AX center (45,58) → modal closes (Evidence: screenshot 05).
**Known Gaps / Not Tested:** Real-code entry + phone-path Profile-stall regression (user declined; blocked by 10DLC); email-path Profile-stall regression (deferred on wrap-up); actual handset delivery of the SMS (impossible until 10DLC is resolved). The "Message from an Unregistered US 10DLC" text is from the user's Twilio console (human-confirmed), not retrievable via the available log-query channel.
**What Needs To Be Fixed Next:**
1. Fix (ops/trust-and-safety): register the staging Twilio From number (`+19853154226`) under an approved **US A2P 10DLC brand + campaign** so real SMS is actually delivered to US destinations. This unblocks B03's real-code leg AND the phone-path Profile-stall regression.
2. Fix (minor, wording): align the verify-modal resend countdown with the true rate-limit retry window (currently capped at 3600s while the message can say 86400s) in `EditProfileScreen.tsx` (`setResendCountdown(Math.min(retryAfterSeconds, 3600))`).
3. Verify (QA follow-up, ~5 min, no dependency on 10DLC): run the **email-path Profile-stall regression** (dev-bypass `123456`) to confirm the `ProfileScreen.tsx` fix end-to-end on-device; then re-run the phone path once 10DLC is live.
**UX Enhancement Ideas (optional, not defects):** On the verify modal, when the client dev-bypass is active (send failed/rate-limited), the UI shows a normal-looking modal with only the dev hint — consider a dev-only visual tag when the bypass is active so dev/QA runs don't misread a real delivery failure as success (reduces confusion; not required for production).
**Suggested Next Session:** (1) quick email-path Profile-stall regression (dev-bypass, ~5 min); (2) once 10DLC registration is confirmed, one real send to `+15519985017` → real code → verify → confirm immediate Profile render + DB cross-table (`auth.users.phone` = `profiles.phone`), closing B03 and the phone-path stall check.
**Suggested to Improve Agent Rules:** (1) Record that `function_logs.event_message` DOES expose the full console output (incl. Twilio error text + SIDs) when filtered by `log_attributes['function_id']` — the prior "message bodies not retrievable" note was a query-filter artifact and cost a full investigation cycle; correct the standing note. (2) Note the US 10DLC failure signature ("Message from an Unregistered US 10DLC"): Twilio returns HTTP 200 + SID but delivery is silently blocked at the compliance layer — a "sent" SID is not proof of handset delivery; check the Twilio console message status when a real-SMS leg reports non-receipt.
