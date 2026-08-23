# Group Q + S Combined — Second Calibration Stress Test (18 Cases)

**Run date:** 2026-08-23 · **Agent:** QA Test Agent (execution-only) · **Device:** iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`, dev build + Metro) · **Backend:** staging `drntwgporzabmxdqykrp`
**Guides:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group Q (Trading Education, Q01–Q07) + Group S (Password Recovery, S01–S11)
**Execution order:** Group Q first (single logged-in persona: `test-buyer`), then Group S (logged-out Forgot/Reset flow; one login at the end to confirm S08). Per Phase 13.36 v2 Rule 4 (persona batching).

---

## Result roll-up

| Verdict | Count | Cases |
|---|---|---|
| **PASS** | 13 | Q01, Q02, Q03, Q05, Q07, S02, S04, S06, S07, S08, S09, S10, S11 |
| **FAIL** | 2 | Q04, Q06 |
| **BLOCKED** | 1 | S01 |
| **SKIPPED** | 2 | S03, S05 |
| **TOTAL** | **18** | |

**Wall-clock:** ~21 minutes (11:51 → 12:12). **Login/logout cycles:** 2 (test-buyer for Group Q; qa.p22.e3 throwaway for S08) vs. Group P's 6. **Transitions ≥3s flagged:** none.

---

## Batch summary table

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-Q01 | AUTH (Group Q) | **PASS** | Help lists 4 published sections in display_order (sp_definition → safety), drafts hidden (none in DB; query filters is_published) |
| AUTH-TC-Q02 | AUTH (Group Q) | **PASS** | sp_definition expanded by default; exactly 1 published row (partial unique index); title/body non-empty |
| AUTH-TC-Q03 | AUTH (Group Q) | **PASS** | Sell mode Books $25 → earn_sp 33 (Math.round 25×1.3), is_bonus + badge + "1.3× SP"; math delegates to MODULE-12 V3 (fallback literals `\|\|1.1`/`\|\|70` are defaults, not hardcoded rates) |
| AUTH-TC-Q04 | AUTH (Group Q) | **FAIL** | Guide (fee=2.5=10%, SP-10 input) is stale — flat-fee model replaced it. Actual: max_sp_usable 17 ✓, cash $8.00 (no SP-input field), fee **$20.00** (non-subscriber flat), total $28.00. Doc drift + subscriber-sees-non-subscriber-fee UX concern |
| AUTH-TC-Q05 | AUTH (Group Q) | **PASS** | Bonus list only >1.10 descending (Electronics/Art & Crafts/Books 1.3, Toys 1.2); example SP full field set + null→null source-verified. Gap: no published `education_examples` in DB |
| AUTH-TC-Q06 | AUTH (Group Q) | **FAIL** | DB CHECK `chk_education_analytics_event_type` excludes `help_view` (TS union includes it) → app's own help_view silently dropped (0 rows all-time, DB-proven); valid `calculator_use` lands (+2 this run). Real TS/DB type-mismatch defect |
| AUTH-TC-Q07 | AUTH (Group Q) | **PASS** | shouldShowOnboarding true (both NULL) / false after complete+skip (source+DB+live no-carousel); markPromptSeen idempotent; 3-seen auto-suppress sets `education_prompts_suppressed_at` (source+unit tests). Gap: prompt fns have NO production call sites |
| AUTH-TC-S01 | AUTH (Group S) | **BLOCKED** | Staging SMTP cannot send reset emails — app's real send errors; success state unreachable. UI source-verified (non-disclosing Check Your Inbox + Send Another Email→cleared form). S04 live-triggered as proof of the env condition |
| AUTH-TC-S02 | AUTH (Group S) | **PASS** | Empty email → Send Reset Link disabled (tap no-op + source); "abc" → "Invalid Email / Please enter a valid email address" |
| AUTH-TC-S03 | AUTH (Group S) | **SKIPPED** | Rate-limit branch source-verified (toggle `qa_reset_error_simulation` not armed); no live trigger (fail-fast, avoid hammering GoTrue) |
| AUTH-TC-S04 | AUTH (Group S) | **PASS** | **Live-triggered**: real send returned the exact SMTP/500 alert (Reset Email Failed + Possible causes… + Open Supabase Docs + OK) |
| AUTH-TC-S05 | AUTH (Group S) | **SKIPPED** | 400 branch source-verified (status 400 → "Check that the email you entered is correct…"); no live trigger possible with client-valid email |
| AUTH-TC-S06 | AUTH (Group S) | **PASS** | Back to Login (form) → Login live; success-state leg source-verified (blocked by S01 env) |
| AUTH-TC-S07 | AUTH (Group S) | **PASS** | Requirements card exact copy; short→"at least 8"; no-uppercase→"uppercase, lowercase, and number"; mismatch→"Passwords do not match"; submit disabled when a field empty |
| AUTH-TC-S08 | AUTH (Group S) | **PASS** | Full reset via minting harness: tokenized deep link → real session → Success! → OK → Login → new password authenticates → Home (DB: last_sign_in 16:12Z) |
| AUTH-TC-S09 | AUTH (Group S) | **PASS** | Expired fragment → Link Error card (exact copy) + Request New Reset Email → ForgotPassword; submit correctly hidden (max-one-primary) |
| AUTH-TC-S10 | AUTH (Group S) | **PASS** | No-token deep link → "No active reset session" alert (exact copy); guard blocks updateUser (password not changed) |
| AUTH-TC-S11 | AUTH (Group S) | **PASS** | Case 1 no-token → ResetPassword form (no LogBox overlay — Phase 14 blocker fixed); Case 2 valid token → real session; Case 3 error fragment → Link Error card |

---

## Perceived load-time table

Each measurement labeled: **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

| Screen / transition | Elapsed | Flagged (≥3s)? |
|---|---|---|
| Login (test-buyer) → Home | ~1–2s | No |
| Home → Profile → SP Wallet → Help | ~1–2s each | No |
| Help screen load (4 sections + calculator + bonus list) | ~1–2s | No |
| SP calculator calc (Books, $25) | <1s (200ms debounce + render) | No |
| Deep link → ResetPassword (fresh mount) | ~1–2s | No |
| Reset submit → Success! alert | ~1–3s | No |
| Success OK → Login | <2s | No |
| Login (new password) → Home | ~1–2s | No |

No screen/transition hit the ≥3s flag this run.

---

## Cross-cutting UX findings

**Structural / affordance**
- (High) **Staging Supabase Auth SMTP cannot send reset emails** — the app's real `resetPasswordForEmail` returns `Error sending recovery email` for every address. This is an **environment blocker** (S01) and is precisely the S04 SMTP/500 condition (live-triggered). The minting harness (server-side `generateLink`) is unaffected and remains the only in-simulator way to obtain a valid reset token. Dev follow-up: configure the staging Supabase Auth SMTP sender (or allowlist the `p2pkidsmarketplace://` redirect).
- (Med) **ResetPassword `linkError` is never cleared when a valid token arrives** (Phase 16 finding #1, still present). I hit it live: after S09's Link Error card, a fresh plain deep link re-showed the persisted card on the retained screen instance, and the submit button stayed hidden — a valid token delivered in that state cannot recover. Worked around via app relaunch + fresh mount.
- (Med) **Education SP calculator always shows the non-subscriber flat fee ($20.00)** even for a Kids Club+ subscriber (test-buyer). `spCalculatorService.calculateSP` buy mode reads `transaction_fee_non_subscriber_cents` unconditionally. For a subscriber the real checkout fee is $1.00 (admin config `transaction_fee_subscriber_cents=100`), so the education preview is misleading (its own comment says "illustrative only", but $20 vs $1 is a large discrepancy).

**Wording / copy clarity**
- S01 success-state copy ("Check your inbox! If you have an account with us, you'll find a link… Don't forget to check your spam folder…") is appropriately non-disclosing and parent-friendly — source-verified; not live-rendered this run (S01 blocked).
- S04 SMTP guidance ("Possible causes: • SMTP/email provider not configured… • Redirect URL not allowed… Check Supabase Auth > Email Settings and Email Logs.") reads like a developer/admin diagnostic for a parent-facing flow. When this error is shown to an end user it should be softened (e.g. "We couldn't send that right now. Please try again in a few minutes, and contact support if it keeps happening."). Note: on staging this 500 path is an environment artifact, but the copy is the user-facing surface for it.
- S10 "No active reset session" body is clear and actionable.

**Design-system compliance (screens/dialogs visited — vs `docx/design-system-passitup.md`)**
- ForgotPassword form: primary green pill (Send Reset Link), filled input, text back-link — compliant.
- ResetPassword: filled inputs, requirements card, primary pill submit (hidden on Link Error — max-one-primary honored), Link Error card uses error-100 surface + error title — compliant.
- Alerts (Invalid Email, Reset Email Failed, No active reset session, Success!): GlobalAlertProvider (in-app), title/body/primary CTA — visually compliant in captured screenshots.
- Help screen + SP Calculator + Bonus Categories: green accents, SP gold on SP surfaces, neutral text tiers — compliant.
- No visual deviations observed on any screen fully inspected this run. Functional/copy deviations are captured above.

**Locator-gap findings**
1. **Profile stats (SP Balance / Listings / Trades)** and **Settings row** are plain `TouchableOpacity` with `testID` but no `accessible`/`accessibilityRole` → invisible to the iOS AX tree (BP-53). Worked around via OCR-derived coordinates. **Fix:** add `accessible`+`accessibilityRole="button"`+`accessibilityLabel` (mirror `Button.tsx`).
2. **SP Wallet "How Trading Works" button** (`sp-wallet-how-trading-works-btn`) not AX-exposed (same class). Worked around via OCR. **Fix:** same.
3. Guide labels Group S alerts "native Alert.alert" — **doc drift**: they render in-app via `GlobalAlertProvider` (`global-alert-button-0/1`), fully locator-instrumentable. No Option B needed. (Consistent with Phase 14 finding; recommend guide correction.)

**Friction vs operating rules**
- `rg` not installed on this machine → used `grep` fallback (minor).
- `mobile_list_apps` tool disabled by user → verified app install/state via screenshots instead.
- The minting harness first run hit `URL is not a constructor` (Node env) — the mint had actually succeeded; I inspected the error, fixed the parse (`import { URL } from 'node:url'`), and re-ran once. Trigger-based checkpoint (§5.24b) fired and was handled.
- The S04 SMTP block initially looked like a case failure (S01) before the fail-fast source read confirmed the exact S04 branch — the live S04 trigger turned a blocker into a PASS plus root-cause diagnosis.

---

## Group Q detail (education / SP calculator)

**Q01 — PASS.** Help screen (`HelpScreen.tsx`) rendered exactly the 4 published sections in `display_order` ascending: What are Swap Points? (sp_definition) → How do I earn Swap Points? (sp_earning) → How do I spend Swap Points? (sp_spending) → Safety & Community Guidelines (safety). DB has no unpublished sections (drafts hidden trivially); `getPublishedSections` filters `.eq('is_published', true).order('display_order')`. Evidence: `Q01-help-screen.png`.

**Q02 — PASS.** sp_definition ("What are Swap Points?") is expanded by default (`expandedSection='sp_definition'`), body OCR-matched the DB body exactly. Exactly one published row per type (partial unique index `uq_education_sections_one_published_per_type`); `getSectionByType` uses `maybeSingle`. Evidence: `Q01-help-screen.png` (expanded body).

**Q03 — PASS.** Sell mode, Books (sp_earning_multiplier 1.30), price 25 → "You'll earn: **33 SP**" + bonus badge + "Bonus category! Earns **1.3× SP**". 33 = `Math.round(25 × 1.3)`. Source: `spCalculatorService.calculateSP` → `calculateCategorySP` (MODULE-12 V3): `earn_sp = Math.round(price × multiplier)`, `is_bonus = multiplier > 1.1`. No hardcoded per-category rates; the only literals are fallback defaults (`multiplier || 1.1`, `capPercent || 70`) used when a category lacks configured values — the guide's "no literal rates (1.10/1.30/70)" is satisfied in intent (DB-driven), with that minor nuance. Evidence: `Q03-Q04-calculator-books-25.png`.

**Q04 — FAIL (doc drift).** Guide expects `sp_to_use=10, cash_paid=15, fee=2.5 (10%), total_cost=17.5`. Actual (Books, cap 70%): `max_sp_usable` = 17 ✓ (floor(25×0.7)=17), but the current calculator has **no SP-to-use input** (always uses max SP → cash $8.00), and the fee is a **flat** $20.00 (`transaction_fee_non_subscriber_cents=2000`) → total $28.00. The 10%-of-price fee and SP-amount input were removed per `BACKEND-AUDIT-REPORT Part 1` (BRD: flat fees $2.99/$0.99 — staging now $20/$1). Verdict: **app behavior is internally consistent with the current spec; the guide's Assert is stale.** Recommend updating the guide's Q04 (and noting the subscriber fee preview concern above). Evidence: `Q03-Q04-calculator-books-25.png`.

**Q05 — PASS.** Bonus categories list shows ONLY multiplier > 1.10, ordered descending: Electronics 1.3, Art & Crafts 1.3, Books 1.3, Toys 1.2 (all 1.30s before 1.20; non-bonus Games/Shoes/etc. excluded). `calculateExampleSP` source returns the full field set `{ earn_sp, max_use_sp, cash_paid, fee, is_bonus, category_name }` (round/floor), null category → null. **Gap:** all 3 `education_examples` rows are `is_published=false` → no published examples; HelpScreen has no examples UI anyway. Evidence: `Q01-help-screen.png` (bonus list).

**Q06 — FAIL.** DB CHECK `chk_education_analytics_event_type` allows `{onboarding_start, onboarding_complete, onboarding_skip, section_expand, section_collapse, calculator_use, prompt_view, prompt_dismiss, prompt_action}` — **`help_view` is NOT allowed** (nor `seller_prompt_view`/`buyer_prompt_view`), while the TS union `EducationAnalyticsEventType` includes them. The app's own `help_view` (fired on Help mount) is silently dropped: `education_analytics` has **0 help_view rows all-time** (DB-proven), while valid `calculator_use` lands (+2 this run: user test-buyer, event_data {mode:'free', category_id: books, price_bucket:'10-50'}). The invalid-event half behaves correctly (silent console.warn, no throw). But the guide's specified valid event (help_view) does not persist → **TS/DB type mismatch is a real defect**. Evidence: `education_analytics` aggregate + per-user read-back.

**Q07 — PASS (with limitation).** `shouldShowOnboarding` = true only when both `onboarding_completed_at` AND `onboarding_skipped_at` are NULL — DB: `qa.p22.e1` (both NULL) → true; `test-free` (completed) → false; `test-buyer` (skipped) → false (live: no carousel after test-buyer login). `markPromptSeen` idempotent (source: includes-check before append; unit test asserts no duplicate update). `shouldShowPrompt` auto-suppression: onboarding skipped + 3 seen → sets `education_prompts_suppressed_at` + returns false (source + unit test). **Limitation:** `shouldShowPrompt`/`markPromptSeen` have **no production call sites** (only service + unit tests) — the auto-suppression write is source/unit-verified, not live-UI-verified. This is a product gap worth a follow-up (the in-app prompt feature isn't wired up).

---

## Group S detail (password recovery)

**S01 — BLOCKED (environment).** The app's real `resetPasswordForEmail` fails on staging (SMTP send error) → the "Check Your Inbox" success state cannot be reached via the real path. Success-state UI is source-verified: title "Check Your Inbox", non-disclosing subtitle, `forgot-send-another-button` → `setEmailSent(false); setEmail('')` (cleared form). The S04 alert (same send) is the live proof of the env condition. Dev follow-up: fix staging SMTP sender.

**S02 — PASS.** Empty email → Send Reset Link disabled (tap no-op; source `disabled={loading || !email}`). "abc" → alert **Invalid Email** / "Please enter a valid email address" (no request sent — client-side regex). Evidence: `S02-empty-forgot-form.png`, `S02-invalid-email-alert.png`.

**S03 — SKIPPED (source-verified).** Rate-limit branch: `message.includes('rate limit')` → "You have requested password reset emails too frequently…" + Open Supabase Docs + OK. Toggle `qa_reset_error_simulation` is **not armed** on staging (fail-closed → real call). No live trigger attempted (would require hammering GoTrue; fail-fast per user instruction).

**S04 — PASS (live-triggered).** The real send produced the exact SMTP/500 alert: **Reset Email Failed** / "Error sending recovery email\n\nPossible causes: • SMTP/email provider not configured in Supabase Auth • Redirect URL not allowed in Auth settings\n\nCheck Supabase Auth > Email Settings and Email Logs." + **Open Supabase Docs** + **OK**. Evidence: `S04-reset-email-failed-smtp-alert.png`.

**S05 — SKIPPED (source-verified).** 400 branch: `status === 400` → base + "\n\nCheck that the email you entered is correct and belongs to an account." + Open Supabase Docs + OK. No live 400 trigger possible with a client-valid email.

**S06 — PASS.** Back to Login (form) → Login (live). Success-state Back to Login (`forgot-back-to-login-success`) source-verified (goBack); blocked from live by S01 env.

**S07 — PASS.** Requirements card exact copy ("• At least 8 characters • Contains uppercase letter • Contains lowercase letter • Contains number"). Validation: "short" → "Password must be at least 8 characters"; "lowercase1" → "Password must contain uppercase, lowercase, and number"; Password123/Password124 → "Passwords do not match". Submit disabled while a field empty (source). Evidence: `S07-mismatch-error.png`.

**S08 — PASS.** Full loop via the documented minting harness (staging admin, `return_link: true`): minted recovery OTP → GET-redirect exchange → tokenized deep link (`#access_token=…&refresh_token=…`, delivered warm, tokens redacted) → real reset session (no "No active reset session") → new password `TestReset123!` → **Success!** alert ("Your password has been reset successfully.") → OK → Login → **new password authenticates → Home** (DB: `last_sign_in_at 2026-08-23 16:12:00Z`). Target: throwaway `qa.p22.e3.1786964375@kidsmarketplace.test` (no standing persona mutated). Evidence: `S08-success-alert.png`, `S08-login-home-new-password.png`.

**S09 — PASS.** Expired fragment (`#error=otp_expired&error_description=The+link+has+expired`) → **Link Error** card "This reset link has expired. Please request a new password reset email." + **Request New Reset Email** → **ForgotPassword** (live). Submit button correctly hidden while the error card shows (max-one-primary). Evidence: `S09-link-error-card.png`.

**S10 — PASS.** No-token deep link (no reset session) → matching valid passwords → submit → alert **No active reset session** / "This link does not provide a valid reset session. Please request a new password reset email." The guard short-circuits before `updateUser` — password not changed. Evidence: `S10-no-active-reset-session-alert.png`.

**S11 — PASS (all three states).** Case 1 (no token): ResetPassword form + requirements card, **no LogBox fatal overlay** (Phase 14 env blocker FIXED by the static-Linking fix). Case 2 (valid token): real session established, reset succeeded (folded into S08). Case 3 (error fragment): Link Error card (folded into S09).

---

## V2 trigger-based checkpoint report (comparison vs Group P)

| V2 mechanism | Did it fire? | Did it help? |
|---|---|---|
| §5.24(a) re-auth/login checkpoint → zero-exception re-list | **Fired 2×** (test-buyer login; S08 login) | Yes — no field-corruption incidents; every keyboard-state change re-listed |
| §5.24(b) tooling-failure checkpoint → verify target content before negative conclusion | **Fired 2×** (Node `URL` parse failure; `rg`→grep fallback) | Yes — the harness `URL` error was inspected (mint had succeeded) and fixed by parse, not blind retry |
| Pause-and-confirm re-list discipline at every login/relaunch | Held with zero exceptions | Yes — Group Q login + S08 login both clean |
| DB-over-CDP for persistence assertions | Applied (Q06) | Yes — DB read-back definitively proved help_view dropped vs calculator_use landed |
| Fail-fast on impossible paths | Applied (S03/S05 source-verify; S01 env root-cause; Q04 stale guide) | Yes — avoided exhaustive hunting; S04 live-trigger converted a blocker into a PASS + diagnosis |

**Direct comparison vs Group P (baseline):** Group P = 19 cases, 6 login/logout cycles, ~50 min wall-clock. **This run (Q+S v2): 18 cases, 2 login/logout cycles, ~21 min wall-clock.** The v2 trigger-based discipline fired and helped (voluntary version in Group P failed to trigger at all).

---

## App State Left Behind

- **`qa.p22.e3.1786964375@kidsmarketplace.test`** (throwaway, non-standing): password changed to `TestReset123!` during S08. Left as-is (throwaway). Recorded here for traceability; no standing persona affected.
- **`education_analytics`**: +2 `calculator_use` rows for test-buyer (this run).
- Standing personas untouched: test-buyer, test-free, test-seller passwords unchanged.
- App left **logged out at Landing**.
- Supabase side: 2 harness mints (1 unused OTP from the first failed-run mint) + recovery-link generates for the throwaway. `admin_activity_log` rows for the harness calls (expected).
- Evidence + `qa-reset-harness.mjs` in `e2e-test-results/group-qs-calibration-2026-08-23/`.

---

## Recommended follow-ups (dev-side, ranked)

1. **Fix (backend): staging Supabase Auth SMTP sender** — reset emails can't be sent from the app (S01 blocked, S04 live). Configure SMTP provider (or allowlist the `p2pkidsmarketplace://` redirect) on `drntwgporzabmxdqykrp`.
2. **Fix (backend): reconcile `chk_education_analytics_event_type` with the TS union** — add `help_view`, `seller_prompt_view`, `buyer_prompt_view` (or trim the TS union); currently the app's own `help_view` event is silently dropped (Q06 FAIL).
3. **Fix (app, minor): `ResetPasswordScreen.handleResetUrl`** — clear `linkError` when a valid `access_token` is processed so a valid link delivered after the Link Error card is usable (submit stays hidden otherwise). Re-confirmed live this run (Phase 16 finding #1 still open).
4. **Fix (app): education SP calculator fee preview** — show the subscriber-appropriate flat fee (or label the non-subscriber figure as illustrative), so a Kids Club+ member isn't shown a $20 "platform fee" when their real fee is $1 (Q04 UX concern).
5. **Fix (locator, BP-53): Profile stats + SP Wallet "How Trading Works"** — add `accessible`+`accessibilityRole="button"`+`accessibilityLabel` (not AX-exposed this run).
6. **Docs: update guide Q04 + Group S alert type** — Q04's 10%-fee/SP-10 model is stale (flat-fee spec); Group S "native Alert.alert" is GlobalAlertProvider (in-app).
7. **Product gap: prompt state machine** — `shouldShowPrompt`/`markPromptSeen` have no production call sites; the in-app education prompt feature isn't wired (Q07 limitation).

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-Q01–Q07 (Trading Education) + AUTH-TC-S01–S11 (Password Recovery) — 18 cases, single session, persona-batched (Group Q then Group S).
**Design-System Compliance:** PASS — no visual deviations observed vs `docx/design-system-passitup.md` on the screens/dialogs fully inspected (ForgotPassword, ResetPassword + Link Error card, Help + SP Calculator + bonus list, all GlobalAlertProvider alerts). Functional/copy findings are captured under the UX sections, not visual deviations.
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the ideal UX threshold (<3s); no screen/transition flagged.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ForgotPassword form: wording, layout, filled input, primary pill, text back-link.
- CONFIRMED — ResetPassword form: requirements card, validation inline errors, hidden-submit-on-Link-Error (max-one-primary).
- CONFIRMED — Link Error card: clear recovery copy + single primary CTA.
- CONFIRMED — Success! / Invalid Email / No active reset session / Reset Email Failed alerts (GlobalAlertProvider): title/body/CTA structure.
- CONFIRMED — Help screen: hero, accordions, calculator, bonus list.
- DEVIATION — Reset Email Failed (S04/SMTP) alert body: developer-diagnostic wording ("Possible causes: SMTP/email provider not configured… Check Supabase Auth > Email Settings and Email Logs.") on a parent-facing surface — propose softened copy ("We couldn't send that right now. Please try again in a few minutes…") while keeping the developer detail behind an expandable/support path. (App behavior matches the implemented error branch; the wording itself is the finding.)
**Verdict Summary:** 13 PASS / 2 FAIL (Q04 doc-drift, Q06 event-type mismatch) / 1 BLOCKED (S01 env-SMTP) / 2 SKIPPED (S03, S05 source-verified)
**Critical Findings:**
1. **S01 blocked / S04 live**: staging Supabase Auth SMTP cannot send reset emails — blocks the app's real Forgot Password happy path (env blocker; also root-causes S04, which passed live).
2. **Q06**: DB CHECK constraint vs TS union mismatch — `help_view` (the app's own event, fired on Help mount) is silently dropped (0 rows all-time, DB-proven); valid events land.
3. **Q04**: guide Assert is stale — flat-fee model ($20 non-sub / $1 sub) replaced the 10% fee + SP-amount input; education calculator shows the non-subscriber fee even for subscribers.
4. **ResetPassword `linkError` never cleared on valid token** (Phase 16 #1, still present) — a valid reset link delivered after the Link Error card can't recover.
5. **Q07**: prompt state machine (`shouldShowPrompt`/`markPromptSeen`) has no production UI call sites — auto-suppression only source/unit-verified.
**App State Left Behind:** Throwaway `qa.p22.e3.1786964375@kidsmarketplace.test` password now `TestReset123!` (S08; not a standing persona). +2 `calculator_use` analytics rows (test-buyer). Standing personas untouched. App logged out at Landing. Evidence + harness script in `e2e-test-results/group-qs-calibration-2026-08-23/`.
**Why It Matters:** Proves the Phase 13.36 v2 discipline measurably reduces friction vs Group P: 18 cases in ~21 min with 2 login/logout cycles (vs Group P's 6 / ~50 min), zero field-corruption incidents, trigger-based checkpoints fired and helped. Also surfaces two real defects (help_view dropped; reset-link recovery edge) and one environment blocker (staging SMTP) that would block any future 100+ case run of the Forgot/Reset flow.
**How to Verify/Reproduce:** Screenshots + `qa-reset-harness.mjs` in `e2e-test-results/group-qs-calibration-2026-08-23/`. Q06: run any reset of `education_analytics` event_type for `help_view` → 0 rows; Q04: Help → SP Calculator → Books → 25 → observe fee/total; S04/S01: Forgot Password with any valid email → SMTP error alert; S08: mint via harness, GET-redirect exchange, warm fragment delivery.
**Known Gaps / Not Tested:** S03/S05 not live-triggered (toggle unarmed / no 400 path). S01 success-state UI not live-rendered (env). Q07 prompt auto-suppression not live-UI-verified (no call sites). Q05 example-SP not live (no published examples + no examples UI). S06 success-state Back-to-Login leg source-verified.
**What Needs To Be Fixed Next:**
1. Fix (backend): staging Supabase Auth SMTP sender (unblocks S01 + the app's real Forgot Password happy path).
2. Fix (backend): reconcile `chk_education_analytics_event_type` with the TS union so `help_view`/`seller_prompt_view`/`buyer_prompt_view` persist.
3. Fix (app, minor): `ResetPasswordScreen.handleResetUrl` — clear `linkError` on valid `access_token` so a valid link delivered after the error card recovers.
4. Fix (app): education SP calculator fee preview — subscriber-aware flat fee (or clearly label illustrative non-subscriber figure).
5. Fix (locator, BP-53): Profile stats + SP Wallet "How Trading Works" buttons — add `accessible`+`accessibilityRole`+`accessibilityLabel`.
6. Docs: update guide Q04 (flat-fee model) and Group S alert type (GlobalAlertProvider, not native Alert.alert).
7. Product gap: wire the education prompt state machine into a real UI surface (or document as intentionally test-only).
**UX Enhancement Ideas (optional, not defects):**
- On the education SP calculator, a subscriber (Kids Club+) selecting their category sees a $20.00 "Platform fee" — consider a small "Your fee: $1.00 as a Kids Club+ member" callout (or a toggle) to reduce confusion between the illustrative preview and the real checkout fee.
- On the Reset Email Failed alert, the SMTP developer guidance reads as a support-admin diagnostic — consider a parent-first message with the technical detail behind an expandable "Technical details" affordance.
- On the Help screen, the bonus-category list and calculator are below the accordions; a first-time visitor may not discover them — consider a compact "SP calculator" quick action in the Help hero or a sticky tab, reducing scroll distance.
**Suggested Next Session:** With staging SMTP fixed, re-run S01 (happy path → Check Your Inbox → Send Another Email) and re-verify S04 returns to a genuine only-on-SMTP-failure state; then proceed to the planned 100+ case full-group run using the validated v2 discipline.
**Suggested to Improve Agent Rules:** When a case's expected error state (e.g., S04 SMTP/500) is triggered live as a side effect of an environment condition that also blocks a different case (S01), the report should explicitly pair the two — one finding with a single root cause, not two disconnected verdicts — so the dev follow-up is unambiguous.
