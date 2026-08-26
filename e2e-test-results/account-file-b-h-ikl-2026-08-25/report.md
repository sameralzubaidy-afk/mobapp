# QA Session Report — Account File: B-Group Closure + Groups H, I, K, L (22 Cases)

**Run:** `e2e-test-results/account-file-b-h-ikl-2026-08-25/`
**Date:** 2026-08-25, ~21:50–22:15 UTC (Part 2 in progress)
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), Expo RN dev build + Metro (localhost:8081), staging `drntwgporzabmxdqykrp`
**Personas:** test-buyer (Part 2 H/I + Part 1 B)
**Evidence:** `screenshots/` (PNGs) + `cdp-capture.txt` (continuous Hermes CDP console stream) + `capture-cdp.mjs`

---

## Part 2 — Groups H, I, K, L (fresh first-pass coverage)

### Group H — Help & Support Menu

#### ACC-TC-H01 · Help & Support menu (3 cards) routes — PASS
**Trace:** Profile → Help & Support (`profile-help-support`) → menu renders 3 cards: **FAQ** (`help-menu-faq`, subtitle "Browse frequently asked questions and contact support"), **How to Earn SP** (`help-menu-earn-sp`, "Learn about Swap Points, the SP calculator, and bonus categories"), **Contact Us** (`help-menu-contact`, "Send us a message and we'll get back to you within 24 hours"). Routes verified: FAQ → FAQ list (Support screen), How to Earn SP → education Help screen, Contact Us → Contact Support. Each nav <1 s.
**Screenshots:** `H01-help-menu.png`, `H01-H02-faq-list.png`, `H01-I01-education-help.png`.
**Verdict: PASS** (3/3 cards + subtitles + routes).
*Design-system:* cards use white surface + green icon chips (#5DBB8E) + CaretRight; touch targets 89pt tall. No deviations.
*Wording:* subtitles clear and parent-appropriate.

#### ACC-TC-H02 · FAQ list — search + category filter — PASS
**Trace:** FAQ screen (Help & Support title, `search-input`, `category-chip-*`). Search "earn" → **single result** "How do I earn Swap Points?" (case-insensitive question/answer filter; OCR-verified). Selected **Swap Points** chip → active chip green (`#5DBB8E` pixel-scan: 12.0% of chip band = 26,897 px). Search "earnzzzz" → **"No results found" / "Try a different search or category"** (empty state, OCR-verified).
**Verdict: PASS** — header, text filter, green active chip, empty state all verified.
*Locator gap:* `faq-row-*` testIDs exist in source but do NOT surface in the iOS AX tree (rows verified via OCR only). Recommend BP-53 audit of the FAQ row TouchableOpacity.
*Design-system:* active chip = primary green pill with white text; inactive = white + #E0E0E0 border. No deviations.

#### ACC-TC-H03 · FAQ fallback when offline — BLOCKED (mechanism gap, root-caused)
**Trace:** Dropped host Wi-Fi while on the FAQ screen (authenticated, test-buyer). Within seconds the **ConnectivityGate navigated to the Offline screen** ("No Internet Connection" / "Check your connection and try again") — the F03 gate intercepts any authenticated connected→disconnected transition, so the FAQ screen is replaced before its DB fetch can fail and render the fallback. Try Again offline → "Still offline. Check your connection and try again." (F03 re-confirmed). No fetch-failure QA toggle exists to induce the fallback independently.
**Root cause:** the offline gate (F03, verified) + no `qa_*` FAQ-fetch-failure toggle → the hardcoded fallback path in `fetchPublishedFaqs` (catch → `FALLBACK_FAQS`, 10 FAQs / 5 categories) is not drivable on-device while authenticated. Fallback is source-verified (`src/services/faqService.ts`) and unit-tested (`src/screens/support/__tests__/HelpScreen.test.tsx`).
**Verdict: BLOCKED** — not an app defect; a mechanism gap (no way to induce a live FAQ fetch failure without tripping the offline gate). Screenshot: `H03-offline-gate.png`.

#### ACC-TC-H04 · FAQ detail — helpful vote (Yes/No) — PASS
**Trace:** FAQ detail (`faq-detail-screen`) shows category badge ("GETTING STARTED"), question, answer. **👍 Yes** on "How do I create my first listing 222?" → records vote + returns to FAQ list. **👎 No** on "What is the Kids P2P Marketplace?" → records vote + **routes to Contact Support**. "Still need help?" + `contact-support-button` present.
**DB-close:** `faq_votes` — `134e2f9b…` vote=**yes** 22:01:45, `07ebce1b…` vote=**no** 22:02:04, both same anonymous device id (`c34623b1-…`, `user_id` NULL — votes are device-scoped, not user-bound; privacy-positive, note as intended).
**Verdict: PASS** — detail + both vote paths + routing verified.
*Wording:* "Was this helpful?" + "Still need help?" clear for parents.

#### ACC-TC-H05 · Contact Support form (auth gate + validation) — PASS (logged-in leg); logged-out leg route-gated
**Trace (logged-in):** Empty subject → "Missing Subject" / "Please enter a subject for your message." Empty message (subject filled) → "Missing Message" / "Please enter your message." Valid submit (Subject + 94-char message) → **"Message Sent" / "Thank you for contacting us. We'll respond within 24 hours."** → OK returns back. Character counter **94 / 1000** live. Email fallback "Or email us at support@passitup.com" present.
**DB-close:** `support_messages` row for test-buyer (`49243010-…`), subject "QA Test Contact Subject", 22:03:47 UTC.
**Logged-out leg:** ContactSupport is inside the authenticated navigator with **no deep-link entry** → cannot be opened logged-out via UI. The auth-gate copy ("Please log in to contact support." + email fallback) is source-verified (`ContactSupportScreen` early-return branch) but not drivable logged-out. **BLOCKED (route-gating), not an app defect.**
**Verdict: PASS** (logged-in leg) — validation + counter + submit + return verified.
*Design-system:* alerts are in-app GlobalAlertProvider (not native); green Send pill; inputs filled per design doc. No deviations.

### Group I — Education & SP Calculator

#### ACC-TC-I01 · Education Help screen (accordion + deep link) — PASS (reachable legs); deep-link leg not-wired
**Trace:** How to Earn SP → education `HelpScreen`: header "Help", hero card ("Learn how to trade safely and earn Swap Points…"), all 4 published sections as accordions (`help-section-sp_definition|sp_earning|sp_spending|safety`), **`sp_definition` expanded by default** (accessibilityValue="expanded"; "What are Swap Points?" body visible), footer "Still have questions? Contact us at support@p2pkidsmarketplace.com". Expand/collapse works (chevron ^/V via OCR).
**Deep-link leg (`?section=sp_definition`):** **NOT wired** — the React Navigation `linking.config.screens` map has **no `Help` entry**, so `p2pkidsmarketplace://help?section=…` cannot navigate; `HelpScreen`'s `route.params?.section` deep-link code is latent/unreachable. The `sp_definition` default-expand satisfies the visible intent anyway.
**Verdict: PASS** at case level (header, hero, sections, default-expand, footer email) with the deep-link leg flagged as a **wiring gap / doc drift** (guide's deep-link instruction unreachable).
**DB precondition:** 4 published education sections (sp_definition, sp_earning, sp_spending, safety) confirmed.

#### ACC-TC-I02 · SP Calculator (free mode) sell/buy outputs — PASS
**Trace:** Select **Games**, enter **$30** → **"If You Sell: 33 SP"** + **"If You Buy: 21 SP"** (live update). DB-corroborated: Games `sp_earning_multiplier=1.10` → 30×1.10=33; `sp_spending_cap_percent=70` → 30×0.70=21. Empty-state progression: no category → "Select a category to see your SP"; category + no price → "Enter a price to calculate".
**Verdict: PASS** (two-source corroborated). Screenshot `I02-calc-games-30.png`.
*UX note:* CategorySelectModal (full-screen native modal) was **fully AX-drivable this build** — a direct reversal of the old §5.31 "undrivable" note (build-dependent).

#### ACC-TC-I03 · SP Calculator bonus category badge — PASS
**Trace:** Select **Books** (bonus, 1.30×), price 30 → **"If You Sell: 39 SP"** (30×1.30) with **`help-sp-calculator-sell-bonus-badge` = "Bonus category! Earns 1.3× SP"**; buy 21 SP (Books cap 70%). Bonus categories list below shows Electronics 1.3×, Art & Crafts 1.3×, Books 1.3×, Toys 1.2× with ⭐ badges.
**Verdict: PASS.** Screenshot `I03-bonus-badge-books-30.png`.

#### ACC-TC-I04 · SP Calculator validation (price range) — PASS
**Trace:** $0 → results area **blank** (no If You Sell/Buy). >$10,000 → the price input **rejects the value at the input level** (`onChangeText` guard `num >= 0 && num <= 10000`; verified on-device: typing "10001" twice left the field at "1000") — source-corroborated, plus the `handleCalculate` `priceNum > 10000` guard. Valid **50** (Books) → **"If You Sell: 65 SP"** (50×1.30) + bonus badge.
**Verdict: PASS.** Note: the >$10,000 leg manifests as input-level rejection rather than "accept then clear" — defensible, arguably better UX (the field refuses invalid input). Screenshots `I04-price-0.png`, `I04-price-over-10000.png`, `I04-valid-50.png`.

#### ACC-TC-I05 · Education analytics events fire — PASS
**DB-close:** `education_analytics` for test-buyer (last hour): **`help_view`** 21:54:08 (education Help mount) + **`calculator_use`** ×multiple with `{mode:"free", category_id, price_bucket}` (Games 21:56:02 → "10-50"; Books 21:57:02 → "10-50"; edge inputs → "<10"/">100" buckets; 22:00:06/07 → "<10"/"10-50" for the 50 test).
**Verdict: PASS** — both events fire with the documented payload shape.

### Group K — Privacy & Security / MFA — BLOCKED (feature not implemented, source-proven)

**Root cause (all four K cases):** The app has **no MFA/Privacy-Security implementation**. Source grep: zero `mfa`/`totp`/`enrollFactor`/`listFactors`/`getAuthenticatorAssurance`/`verifyChallenge` references in `p2p-kids-marketplace/src`. The **Settings → "Privacy & Security" row (`settings-privacy-security-button`) has an EMPTY `onPress`** (`/* TODO(UX): Link to Privacy & Security screen when implemented */`). No `PrivacySecurityScreen`/`Mfa*Screen` exists. GoTrue backend MFA tables exist (`auth.mfa_factors/challenges/amr_claims`), so this is a **pure app-side feature gap** — the backend is ready, the app UI is not.
- **ACC-TC-K01 (factors list + entry points): BLOCKED** — no Privacy & Security screen; row is a no-op.
- **ACC-TC-K02 (enroll + verify authenticator): BLOCKED** — no enrollment UI; no MFA-enrolled persona.
- **ACC-TC-K03 (protected action MFA challenge): BLOCKED** — no challenge UI; no verified factor.
- **ACC-TC-K04 (recovery + remove factor): BLOCKED** — no recovery/removal UI.

**Verdict: K01–K04 all BLOCKED** — feature not implemented (source-proven), not a fixture/persona issue. Dev: build the Privacy & Security/MFA surface (the backend + GoTrue MFA APIs are available) or de-scope Group K in the guide.

### Group L — Error Recovery & Crash Reporting — BLOCKED (no crash-trigger mechanism, source-proven)

**Root cause (all four L cases):** `ErrorBoundary` exists and is correctly wired at root (`<SafeAreaProvider><ErrorBoundary><GlobalAlertProvider>…` in `App.tsx`), with a friendly fallback (`error-boundary-fallback` / "Something went wrong" + `error-boundary-retry` "Try Again") and `captureException` via `errorReporter` (no-op when DSN unset). **However, there is NO crash-trigger mechanism** — no QA toggle/screen that throws a render-time error (`devTestingService` has no render-error trigger; toggles are OTP/forgot-password/avatar/provider-outage/push/pref-save/link-mismatch only, all async-screen-error paths, not render errors). L01–L04 each require "a QA screen or toggle that intentionally triggers a render-time error," which does not exist. Unit tests exist (`ErrorBoundary.test.tsx` 6 tests, `errorReporter.test.ts` 6 tests) but do not substitute for on-device trigger.
- **ACC-TC-L01 (render error → fallback): BLOCKED** — no trigger.
- **ACC-TC-L02 (Try Again recovers): BLOCKED** — no trigger to reach the fallback.
- **ACC-TC-L03 (persistent error contained): BLOCKED** — no trigger.
- **ACC-TC-L04 (telemetry on/off): BLOCKED** — no trigger; `errorReporter` no-op behavior source-verified (safe when DSN unset).

**Verdict: L01–L04 all BLOCKED** — crash-trigger mechanism missing (source-proven). Dev: add a `__DEV__`-only render-error toggle (e.g. a deep-link-armed flag that makes a screen throw) or document a manual trigger route; then L01–L04 become executable.

---

## Part 1 — B-Group Full Closure

### ACC-TC-B08 · Waitlist dead-code removal — PASS
**Trace:** On Edit Profile, the ZIP field renders **"ZIP CODE (CANNOT BE CHANGED)"** with value "06850", non-editable, helper **"Zip codes are locked to your node."**. Attempted to type "10001" into the ZIP field → value stayed "06850" (locked; no keyboard accepted input). No "Area Not Yet Available" waitlist prompt appears on this screen. Source: the `needsWaitlist` branch was removed from `EditProfileScreen.handleSave` (2026-08-25, commit `1b3828f3`) — `updates.zip_code` is never sent (ZIP locked), so the waitlist prompt is dead code on this screen (it remains active on signup/ProfileSetup). No crash, no dead artifact.
**Verdict: PASS** — locked/non-editable ZIP, no waitlist path, no artifact.

### ACC-TC-B02 · Email re-verification — BLOCKED (backend delivery defect, root-caused)
**Trace:** Edit Profile → changed email to `test-buyer+new@kidsmarketplace.test` → Save → **"Updated with Warning" / "We sent the code but couldn't deliver it. Please try again."** → navigated to Profile; **email NOT applied** (`auth.users.email`/`profiles.email` unchanged). The **"Verify Your Email" modal never opens** because `requestEmailChange` returns failure.
**DB-close:** an `email_change_verifications` row WAS minted (`c1d80f61-…`, new_email `test-buyer+new@…`, attempts 0, verified_at/used_at NULL, 24h expiry) — so the server-side mint works.
**Root cause (HIGH, backend EF defect):** the `auth-email-change` Edge Function's internal call to `send-email` returns **401 `UNAUTHORIZED_API_KEY_CONFLICTS`** (edge-log verified) → auth-email-change returns 500 `EMAIL_SEND_FAILED`. Cause: `sendVerificationEmail` in `auth-email-change` sends `apikey: <ANON_KEY>` + `Authorization: Bearer <SERVICE_ROLE_KEY>` to `send-email` (a `verify_jwt=true` function by default) — the anon `apikey` conflicts with the service-role JWT → platform 401. `email_logs` has **no successful send since 2026-04-17** → the same EF→send-email header pattern is used by sibling EFs (e.g. `id-badge-notifications`), so email notification delivery has been broadly broken on staging. **Fix (dev):** in `auth-email-change`'s `sendVerificationEmail` (and sibling EF callers), send `apikey: <SERVICE_ROLE_KEY>` (match the Authorization JWT) or omit `apikey`. Re-deploy, re-test.
**Verdict: BLOCKED** — the B02 success leg (modal → 123456 → verify → new email) is unreachable until the EF auth-conflict is fixed. App-side handling is correct: old email preserved, friendly delivery-failure warning, minted code stays pending. The cancel path is trivially satisfied (change is never applied).

### ACC-TC-B03 · Phone change → OTP verification modal (canonical stack) — PASS
**Trace:** Edit Profile → changed phone to `5551234002` → Save → **"Verify Your Phone" modal** opens ("We sent a 6-digit code to 5551234002", resend countdown "Resend code in 59s", dev note "Dev mode: use 123456 to skip SMS."). Phone NOT applied before verify. **Invalid code** `111111` → inline **"Invalid verification code"** error, modal stays open, countdown continues (no crash). **Valid code** `123456` → Verify → navigates to Profile (momentary "Loading profile…" — known post-verify loading state, recovers on re-entry). Edit Profile now shows phone `5551234002`.
**DB-close:** `auth.users.phone` = **5551234002** ✓, `profiles.phone_verified_at` = **2026-08-25 22:18:35** ✓, `profiles.phone_verified` = true ✓, `profiles.phone_verification_method` = "sms" ✓. **CROSS-TABLE DIVERGENCE (MOD):** `profiles.phone` = **5551234001 (stale — NOT updated)**; only `auth.users.phone` moved. Same class as the prior Group A+B+D finding — the canonical B03 stack updates auth phone + verification flags but not `profiles.phone` (per §5.35, all mirrored tables must be checked).
**Real-SMS path (MOD, backend):** CDP shows **`[phoneService] DEV SMS bypass activated due to Edge Function failure`**; `send-phone-otp` returned **500** ×3 (edge-log verified) — real Twilio delivery fails on staging; the dev bypass (`123456`) rescued the flow. B03's UI/flow assertions pass via the documented dev bypass; the real SMS leg is broken on staging.
**Verdict: PASS** — all four assertions met (modal/no-immediate-apply, 60s resend countdown, invalid-code inline error + modal stays open, valid-code → Profile + DB updated), with the `profiles.phone` divergence + send-phone-otp 500 findings.

### ACC-TC-B09 · "Already verified" phone path — PASS
**Setup (post-B03):** `auth.users.phone`=5551234002, `profiles.phone`=5551234001 (verified=true) → `accountVerifiedPhones=[5551234002, 5551234001]`; Edit Profile hydrates phone from auth (5551234002).
**Trace:** Changed phone to **5551234001** (the profile-verified number) → Save → **Info alert: "This phone number is already verified and active on your account."** → OK → navigates to Profile. **No "Verify Your Phone" modal** appears.
**DB-close:** unchanged by B09 — `auth.users.phone` still 5551234002, `profiles.phone` 5551234001 (the B09 Info path is optimistic-only; it patches the UI but does not persist). LOW nuance: after B09, Profile shows 5551234001 until reload, then reverts to 5551234002 (auth is the source of truth) — cosmetic inconsistency, not a blocker.
**Verdict: PASS** — Info alert + no OTP modal, exactly as the guide expects. The B09 fix (detection from auth.users.phone + profiles.phone_verified, no longer the dropped `phone_verification_codes.verified` column) is verified on-device.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| ACC-TC-H01 | Account | **PASS** | 3 cards + subtitles; FAQ/How to Earn SP/Contact Us all route correctly |
| ACC-TC-H02 | Account | **PASS** | Search filter (earn→1), active chip green (pixel-verified), "No results found" empty state |
| ACC-TC-H03 | Account | **BLOCKED** | Offline gate (F03) intercepts authenticated drops → FAQ fallback not drivable; no fetch-failure toggle (source-verified fallback) |
| ACC-TC-H04 | Account | **PASS** | Detail (badge/q/a); Yes records+returns, No records+routes to Contact Support; both votes DB-verified |
| ACC-TC-H05 | Account | **PASS** (logged-in) | Missing Subject/Message alerts, 94/1000 counter, Message Sent + return, email fallback; logged-out leg route-gated (BLOCKED leg) |
| ACC-TC-I01 | Account | **PASS** (deep-link leg not-wired) | Header "Help", hero, 4 published accordions, sp_definition expanded by default, footer email; `?section=` deep link not in linking config |
| ACC-TC-I02 | Account | **PASS** | Games $30 → 33 SP sell / 21 SP buy (DB-corroborated 1.10× / 70%) |
| ACC-TC-I03 | Account | **PASS** | Books $30 → 39 SP + "Bonus category! Earns 1.3× SP" badge |
| ACC-TC-I04 | Account | **PASS** | $0 no result; >$10,000 input-level rejected (source+on-device); valid 50 → 65 SP |
| ACC-TC-I05 | Account | **PASS** | `help_view` + `calculator_use`(mode/category/price_bucket) DB-verified |
| ACC-TC-K01–K04 | Account | **BLOCKED ×4** | MFA not implemented (no screen/UI); Privacy & Security row = dead TODO onPress (empirically no-op); GoTrue MFA tables exist |
| ACC-TC-L01–L04 | Account | **BLOCKED ×4** | ErrorBoundary wired at root but no crash-trigger toggle exists (source-proven) |
| ACC-TC-B08 | Account | **PASS** | ZIP locked/non-editable; waitlist branch removed (dead code); no artifact |
| ACC-TC-B02 | Account | **BLOCKED** | send-email 401 `UNAUTHORIZED_API_KEY_CONFLICTS` → Verify Email modal unreachable; code minted server-side |
| ACC-TC-B03 | Account | **PASS** | Verify Phone modal, resend countdown, invalid-code inline error, 123456 → auth.phone+verified flags updated; `profiles.phone` stale (MOD) + send-phone-otp 500 (dev bypass used) |
| ACC-TC-B09 | Account | **PASS** | Info alert "This phone number is already verified…", no OTP modal; optimistic-only persistence (LOW) |

**Roll-up: 12 PASS / 0 FAIL / 10 BLOCKED / 0 SKIPPED** (H05 counts PASS with its logged-out leg noted as a route-gated sub-block; the 10 BLOCKED = H03, K01–K04, L01–L04, B02).

### Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Login → Home | ~1–2 s | OK |
| Profile → Help & Support → FAQ / Help / Contact | <1 s each | OK |
| FAQ search filter apply / row → detail | <1 s | OK |
| FAQ detail → Yes/No vote | <1 s | OK |
| Education Help mount / calculator calc | <1 s | OK |
| Contact Support submit → Message Sent | <1 s | OK |
| Edit Profile → Verify Phone modal | <1 s | OK |
| Phone Verify → Profile | <1 s (then "Loading profile…" until re-entry — known post-verify state, recovers) | OK |
| H03 Wi-Fi drop → Offline (gate) | <5 s | OK (gate, expected) |
| H03 reconnect → Home | ~5 min | **FLAGGED (environment):** simulator NetInfo/network recovery after host Wi-Fi toggle (F03-documented) |

**Perceived Load-Time Verdict:** GOOD — all in-app transitions <3 s; the only ≥3 s event (H03 reconnect) is the documented simulator-network-recovery environment artifact.

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Login → Home | ~1–2 s | OK |
| Profile → Help & Support | <1 s | OK |
| Help menu → FAQ / Help / Contact | <1 s each | OK |
| FAQ search filter apply | <1 s | OK |
| FAQ row → detail | <1 s | OK |
| FAQ detail → Yes/No vote | <1 s | OK |
| Education Help mount | <1 s | OK |
| SP calculator category select + calc | <1 s | OK |
| Contact Support submit → Message Sent | <1 s | OK |
| H03 Wi-Fi drop → Offline (gate) | <5 s | OK (gate, expected) |
| H03 reconnect → Home | ~5 min | **FLAGGED (environment):** simulator NetInfo/network recovery after host Wi-Fi toggle (F03-documented) |

## QA Session Handoff

**Test Scope:** ACC-TC-B02/B03/B08/B09 (Part 1 — B-group closure) + ACC-TC-H01–H05 (Group H), I01–I05 (Group I), K01–K04 (Group K), L01–L04 (Group L) (Part 2 — fresh first-pass) — `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`, iOS Simulator (staging), test-buyer persona.
**Design-System Compliance:** PASS — no deviations found vs `design-system-passitup.md` on any screen/dialog visited this run (Help & Support menu, FAQ list/detail, education Help + SP Calculator + CategorySelectModal, Contact Support, Edit Profile, Verify Phone modal, and all in-app GlobalAlertProvider dialogs incl. Missing Subject/Message, Message Sent, Info already-verified, Updated-with-Warning). Primary green #5DBB8E confirmed on active chips, CTAs, verify buttons, and the bonus badge.
**Perceived Load-Time Verdict:** GOOD — all in-app transitions <3 s. Only ≥3 s event = H03's reconnect (~5 min), an environment artifact (simulator NetInfo/network recovery after a host Wi-Fi toggle). No app-behavior load flags.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Help & Support menu: 3 cards + clear subtitles.
- CONFIRMED — FAQ list/detail: header, search, category chips, category badge, question/answer, "Was this helpful?", "No results found" empty state — all clear.
- CONFIRMED — Education Help: hero card, accordion sections, "Try the SP Calculator", bonus categories, footer support email — clear.
- CONFIRMED — SP Calculator: sell/buy outputs, "Bonus category! Earns 1.3× SP" badge, price-hint/empty states — clear.
- CONFIRMED — Contact Support: intro, Subject/Message labels, counter, email fallback, validation alerts — clear.
- CONFIRMED — Edit Profile: locked-field labels ("FULL NAME/ZIP CODE (CANNOT BE CHANGED)"), zip helper — clear.
- CONFIRMED — Verify Your Phone modal: "We sent a 6-digit code to {phone}", resend countdown, dev-bypass note, inline error — clear.
- CONFIRMED — Info already-verified alert, Updated-with-Warning alert: clear.
- NOTE — B02 "Updated with Warning / We sent the code but couldn't deliver it. Please try again." is accurate but the root cause is backend (send-email 401), not the app.
**Verdict Summary:** 12 PASS / 0 FAIL / 10 BLOCKED / 0 SKIPPED (this run, 22 cases).
**Critical Findings:**
1. **[HIGH — backend, blocks B02] `auth-email-change` → `send-email` internal call returns 401 `UNAUTHORIZED_API_KEY_CONFLICTS`** — `sendVerificationEmail` sends `apikey: anon` + `Authorization: Bearer service-role` to a `verify_jwt=true` function; the keys conflict → send-email 401 → auth-email-change 500 → "Verify Your Email" modal unreachable. `email_logs` shows no successful send since 2026-04-17 (same header pattern in sibling EFs → broad email-delivery breakage on staging). Fix: `apikey` = service-role key (or omit) in EF→EF calls; re-deploy send-email callers.
2. **[MOD — backend] `send-phone-otp` returns 500** (Twilio) on staging → real SMS fails; B03/B09 pass only via the DEV SMS bypass (`123456`). Fix: restore Twilio config on staging.
3. **[MOD — cross-table, §5.35] B03 leaves `profiles.phone` stale** (auth.users.phone=5551234002, profiles.phone=5551234001) — same class as the prior Group A+B+D finding; the canonical stack updates auth phone + verification flags but not `profiles.phone`. Recommend the EF also sync `profiles.phone`.
4. **[MED — setup gap] Group K (MFA) + Group L (ErrorBoundary trigger) not executable** — no MFA screen/UI (Privacy & Security row is a dead TODO onPress; GoTrue MFA tables exist) and no crash-trigger toggle. Both are app-side feature gaps.
5. **[MED — mechanism gap] H03 FAQ offline fallback not drivable** — the ConnectivityGate (F03) intercepts authenticated drops before the FAQ fetch can fail; no fetch-failure toggle. Fallback source-verified (`faqService` catch → FALLBACK_FAQS) + unit-tested.
6. **[LOW — wiring/doc drift] I01 deep link `?section=sp_definition` not wired** — `Help` has no entry in the React Navigation linking config; `route.params.section` is latent. Default-expand satisfies the visible intent.
7. **[LOW — locator] FAQ rows (`faq-row-*`) do not surface in the iOS AX tree** — verified via OCR only; recommend BP-53 audit of the FAQ row TouchableOpacity.
8. **[LOW — UX nuance] B09 Info path is optimistic-only** — after the Info alert the Profile shows the entered number until reload, then reverts to `auth.users.phone`; the account phone never changes. Cosmetic inconsistency.
9. **[LOW — env] H05 logged-out leg + logged-out Contact Support unreachable** — ContactSupport route is inside the authenticated navigator with no deep-link entry; the auth-gate copy is source-verified only.
**App State Left Behind:**
- **test-buyer (shared persona) changed:** `auth.users.phone` = **5551234002** (was 5551234001, via B03 verify); `profiles.phone` = **5551234001** (stale); `profiles.phone_verified_at`/`phone_verified`/`method='sms'` now set (was NULL/true/null). Email unchanged (`test-buyer@…`). **1 pending `email_change_verifications` row** (`c1d80f61…`, new_email `test-buyer+new@…`, unverified, 24h expiry — harmless). **1 support message** row (QA Test Contact Subject). **2 `faq_votes`** rows (device-id scoped) from H04. **`education_analytics`** rows for test-buyer (help_view + calculator_use). Restore note: `npm run seed:staging` re-syncs test-buyer's phone/email; the B09 path prevents restoring the phone via the app (re-entering 5551234001 always hits the already-verified Info path).
- All sessions cleared; app left on Landing. Network restored (Wi-Fi on). No throwaway accounts created. No QA session-local toggles armed (B02/B03 use the fixed `123456` dev code path, not toggles).
**Why It Matters:** This run closes the B-group's on-device behavior for the parts that work (B03 phone-OTP canonical stack PASS incl. invalid-code + resend-countdown + DB persistence; B08 waitlist dead-code removal confirmed; B09 already-verified phone path fixed and PASS) and root-causes the parts that don't (B02 blocked by a concrete EF auth-conflict that also explains the ~4-month email-log silence on staging). Groups H and I are fully first-pass PASS (Help & Support, FAQ search/filter/vote, Education + SP Calculator incl. analytics, all DB-corroborated). Groups K (MFA) and L (ErrorBoundary trigger) are honest app-side feature gaps, and H03 is a gate mechanism gap — none are app-UI defects.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/account-file-b-h-ikl-2026-08-25/` (`screenshots/*.png`, `cdp-capture.txt`, `capture-cdp.mjs`, `report.md`). B03: login test-buyer → Profile → Edit → change phone → Save → Verify Phone modal → 123456. B09: re-enter 5551234001 → Save → Info alert. B02: change email → Save → "Updated with Warning / We sent the code but couldn't deliver it" (send-email 401). H02: FAQ search "earn" / category chips / nonsense query. I02–I04: education Help → SP Calculator (Games/Books @ 30/0/10001/50). H04: FAQ detail Yes/No votes → DB `faq_votes`. I05: DB `education_analytics` for test-buyer.
**Known Gaps / Not Tested:** B02 success/cancel legs (blocked by the send-email 401 — the cancel path is trivially satisfied since the change is never applied). B03 real-Twilio SMS delivery (send-phone-otp 500; verified via dev bypass only). H03 live fallback rendering. H05 logged-out leg. I01 `?section=` deep-link navigation. K01–K04 (no MFA UI) and L01–L04 (no crash-trigger).
**What Needs To Be Fixed Next:**
1. **Fix (dev, HIGH):** `auth-email-change` (and sibling EF→send-email callers) — send `apikey` = service-role key (or omit `apikey`) so the internal call passes `verify_jwt`; re-deploy; re-run `npm run seed:staging` if needed; re-test B02. This unblocks the entire email-notification surface on staging (silent since ~April).
2. **Fix (dev/ops, MOD):** restore Twilio config so `send-phone-otp` returns 200 (currently 500); re-test B03's real-SMS leg.
3. **Fix (dev, MOD):** make the B03 persist path also update `profiles.phone` (cross-table divergence; §5.35).
4. **Fix (dev, MED):** implement a Privacy & Security/MFA surface (GoTrue MFA tables already exist) OR de-scope Group K in the guide; add a `__DEV__` render-error crash-trigger for L01–L04.
5. **Fix (dev, LOW):** add a `Help` route entry to the linking config (or drop the I01 deep-link instruction); BP-53 audit FAQ row `faq-row-*` testIDs.
**UX Enhancement Ideas (optional, not defects):**
- On the Contact Support success alert, consider a post-send confirmation state on the form itself (not just the alert) so parents see the message is in progress/queued even if they dismiss the alert quickly.
- On the Verify Your Phone modal, the inline error "Invalid verification code" is clear — consider also showing the remaining attempt count if the backend tracks attempts, so parents know how many tries are left.
**Suggested Next Session:** Re-run ACC-TC-B02 after the `auth-email-change`/send-email 401 fix (single most valuable closure), then re-run B03's real-SMS leg after the Twilio fix.
**Suggested to Improve Agent Rules:** None critical — the session techniques (OTP single-field reset via "Change Phone Number", `send-email`/`send-phone-otp` edge-log characterization via `function_edge_logs` + `UNAUTHORIZED_API_KEY_CONFLICTS` semantics, cross-table `profiles.phone` check per §5.35, `logs` query_logs schema exploration) are captured in session memory for reuse.
