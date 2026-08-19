# QA Final Combined Verification — E05 End-to-End (Sell-Tab) + C04 Reproduction (Facebook OAuth)

**Run:** 2026-08-19 (~12:30–13:06Z) · Device: iPhone 17 Pro Max (iOS 26.1), Debug build + Metro
**Agent:** QA Test Agent (execution-only) · Guides: `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (AUTH-TC-E05, AUTH-TC-C04)
**Evidence dir:** `e2e-test-results/qa-final-verify-e05-c04-2026-08-19/` (00–34 screenshots + CDP console capture + pixel-scan/OCR helpers)

---

## Roll-up

| Item | Case | Verdict | Top finding |
|---|---|---|---|
| 1 | AUTH-TC-E05 (phone gate before first listing) — **full end-to-end, Sell-tab path** | **PASS** | Phone-verification gate fires immediately on Publish for the unverified seller; verification completes (dev bypass 123456); publish resumes and the listing is created (pending); sticky footer always visible; no tab-bar occlusion. |
| 2 | AUTH Group C04 (account-linking prompt) — **Facebook OAuth reproduction** | **PASS** | AccountLinkingPrompt fires with the collision copy + password re-authentication required (session = fixture user B, email owned by A). Google sanity: lands directly on A, no prompt — C01 path intact. |

**Roll-up: 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED**

---

## Item 1 — AUTH-TC-E05 · Gate blocks first listing until verified (full E2E, Sell tab) — **PASS**

### Precondition (read-only DB)
- Migration `20260819000001_enforce_phone_verification_on_items_insert.sql` **live on staging**: trigger `trg_items_enforce_phone_verified` BEFORE INSERT on `items`; helpers `is_phone_verified(uuid)` / `enforce_phone_verified_on_item_insert()` present (`pg_proc` + `pg_get_triggerdef` verified).
- Client fixes verified in source before execution: `handlePublish` hoists `isPhoneRequired()` **above** `canPublish()` (ItemCreateScreen L811-827); `PersistentTabBar` hides on `ItemCreate` via `TAB_BAR_HIDDEN_ROUTES` (index.tsx L42-45, L207-209); Publish is a **sticky footer** outside the ScrollView (ItemCreateScreen L1207-1221).

### Execution trace (abridged; full tool sequence in transcript)
1. **Fresh unverified seller:** Landing → Get Started → Signup. `dev-fill-test-user-1` (uniqueContact) → email `qa.alice.17871428540565018@kidsmarketplace.test`, phone `+12025554056397`. Create Account → OTP screen. **Left unverified** (terminated app on OTP screen; no code entered) → relaunch → onboarding carousel → Skip → Home. DB read-back: `phone_verified = false`, `phone_verified_at = NULL`, no node, email confirmed.
2. **Sell-tab path (not the deep link):** tapped `tab-sell` (Sell FAB) → Sell action sheet → OCR-located `List One Item` (sheet is an RN Modal; options not in AX tree) → **ItemCreate**. No `tab-*` elements anywhere on ItemCreate across every tree poll → **no tab bar** (Assert 4a ✓).
3. `dev-add-test-photo` → photos=1. `dev-set-category` → button label OCR-verified **"Dev: Set Category (Books)"**. Filled Title "QA E05 test book" (value verified). **Condition = Good** — condition rows (`condition-*`) do **not** surface in the AX tree (locator gap); selected via guide-button-anchored tap (guide-good at y=780) + **pixel-verified green radio dot** `#5DBB8E` present on the Good row only (control rows New/Like New/Fair/Worn gray — pixel-scan of the full condition band). Price `12.50` (value verified) → SP estimate rendered: **"You'll earn: ~16 SP" + "1.30x multiplier for this category"**.
4. **Sticky footer (Assert 4b ✓):** `publish-button` (`Submit for Review`) was pinned at screen y≈842 in **every** tree poll across all scroll positions — visible without scrolling to the absolute bottom.
5. **Publish tap → phone-verification modal (Assert 1 ✓):** tapping Publish instantly presented the modal — `listing-phone-verification-phone-input`, `listing-phone-verification-send-code`, title "Verify Your Phone", copy "Phone verification is required before you can publish listings or make purchases." **Not skipped.**
6. **Complete phone verification (Assert 2 ✓):** entered `+12035551234` (auto-+1) → Send Code → code step ("We sent a 6-digit code to +12035551234", "DEV mode: use code 123456") → entered `123456` digit-by-digit → Verify → modal dismissed, publish resumed.
7. **Publish resumes & listing created (Assert 3 ✓):** "Thanks for submitting!" + "we are going to review your item and approve it." DB read-back: `items` row `0913b3e6-89f3-411d-a4e9-86ee14f7f43d` — title "QA E05 test book", price 12.50, condition `good`, **status `pending`**, seller `e1cd647f-…`, created 13:00:34Z; `profiles.phone_verified_at` = **13:00:32Z** (verified 2s before insert → server-side `trg_items_enforce_phone_verified` satisfied). CDP console confirmed the full pipeline: `[createListing] min_listing_price check`, `✅ All 1 images uploaded successfully`, `✅ Listing 0913b3e6… passed CPSC safety check`.

### Assert result — **PASS (all 4 brief assertions)**
1. Phone-verification modal appears immediately (not skipped) — ✓ on-device.
2. Complete phone verification — ✓ (phone_verified_at set; dev bypass 123456; CDP `DEV SMS bypass verification successful: +12035551234`).
3. Publish resumes/succeeds after verification, listing actually created — ✓ (DB `items` row, pending; gate satisfied at insert).
4. Publish button visible without scrolling to bottom (sticky footer) + no tab bar occluding at any point — ✓ (pinned footer at y≈842 in all polls; zero `tab-*` elements on ItemCreate).

### Findings (E05)
- **F1 (LOW, data consistency):** after verification, `profiles.phone_verified = false` while `profiles.phone_verified_at` is set. All gates (`is_phone_required` client + `is_phone_verified` server) read `phone_verified_at`, so there is **no functional impact** — the gate is satisfied and won't re-fire (verified: `isPhoneRequired` returns `phone_verified_at === null`). Cosmetic: the verify flow updates `phone_verified_at` but not the `phone_verified` boolean. Recommend dev glance (update both) — non-blocking.
- **F2 (INFO, dev-environment):** `send-phone-otp` Edge Function returned **non-2xx** on the send attempts (CDP + LogBox: `FunctionsHttpError: Edge Function returned a non-2xx status code`). The DEV SMS bypass activated correctly and the flow completed with `123456` — this is the designed dev fallback, not a defect. If this persists in staging env, the underlying Twilio/function failure is worth a dev check (rate limit is the most likely cause given multiple sends to one phone).

### UX notes (E05)
- **Structural/affordance:** Sell FAB → sheet → ItemCreate is a clean, obvious path; the sticky Publish footer is a real UX win (CTA always visible). Category dev-button behaved as documented (disabled until categories load; shows real name). No overlap/truncation observed.
- **Wording/copy:** "Submit for Review", "Phone verification is required before you can publish listings or make purchases.", "We sent a 6-digit code to +12035551234", "DEV mode: use code 123456" (dev-only), "You'll earn: ~16 SP", "1.30x multiplier for this category" — all clear and parent-appropriate. No rewrites needed.
- **Design-system compliance:** No deviations on ItemCreate (filled inputs `#F0F0F0`, green dev pill + primary Publish `#5DBB8E`, 16px label scale, radio active `#5DBB8E`) or the phone-verification modal (title/subtitle spacing per doc, primary "Send Code"/"Verify" green pill, single primary per step). Minor: the price/SP area shows two green CTAs ("Subscribe to Kids Club+" promo banner + `upgrade-cta`) — banner semantics, not a max-one-primary violation (both not actionable in the same primary role).

### Locator-gap findings (E05)
- **Condition selector rows** (`condition-new/like_new/good/fair/worn`, `accessibilityRole="radio"`) do **not** surface in the iOS AX tree even when on-screen (only the `guide-*` buttons do). Worked around via guide-button-anchored coordinates + pixel-scan of the radio dot. **Recommended:** verify why the radio TouchableOpacity doesn't expose itself (likely needs explicit `accessible` on the radioContainer) and add it to the instrumentation backlog — this is the single biggest friction item on ItemCreate.
- **Sell action-sheet options** (`sell-option-list-one-item`, `sell-option-bulk-upload`) render in an RN `Modal` and do **not** surface in the AX tree (only the sheet title "Sell" does). Worked around via OCR. Recommend instrumenting the sheet's Modal container (`accessibilityViewIsModal` + `accessible` on options) or accept as a known Modal-exposure gap.

### Friction vs. operating rules (E05)
- **ItemCreate ScrollView "teleportation":** large swipes (150–300px) jumped ~500–1500pt past the condition band (momentum/deceleration). Resolved with small 80px swipes + tree-position verification each step (§5.9 screenshot-as-truth applied). Cost ~10 wasted scrolls — flagged as the dominant ItemCreate time sink.
- **OTP 6-box input drops characters** when the full code is typed at once (`123456` → `124`); **populated boxes do not accept replacement** (tap+type into a filled box is ignored). Resolved via "Change phone number" reset + digit-by-digit entry (tap box → type digit → verify each). This is tooling/typing friction, not an app defect, but it makes the phone-verification modal slow to drive — worth a note for the next instrumentation pass.
- **LogBox console-error overlays** (from `send-phone-otp` non-2xx + `EmailMismatchError`) intercepted taps; dismissed via pixel-located Dismiss (bottom-left) per Phase 14 technique.
- **CDP capture reconnect loop:** the Hermes inspector target dropped repeatedly; the capture re-emitted buffered logs on each `Runtime.enable`, so the log repeats mount-sequence lines. Decisive lines (JWT sub, session set, `[NAV] route: Home`, user_id) were still captured and are valid.

### Perceived load times (E05)
- Signup submit → OTP screen: **<2s** (first poll) — GOOD.
- Sell FAB → sheet → ItemCreate: **<2s** — GOOD.
- Publish tap → phone-verification modal: **<1s** (first poll; modal already present) — GOOD.
- Send Code → code step: **<2s** — GOOD.
- Verify → "Thanks for submitting!" + listing created: **<2s** — GOOD.
- No ≥3s app-screen transitions observed. Label: perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.

---

## Item 2 — AUTH Group C04 · Existing-email account-link prompt (Facebook OAuth reproduction) — **PASS**

### Precondition (read-only DB)
- C04 fixture **confirmed live** (2026-08-19 provisioning): User A = `kidsp2p@gmail.com` (id `27699457-…`) with `[google]` identity + `has_password: true`; User B = `qa-c04-account-link@kidsmarketplace.test` (id `a1234567-…-c`) owns the **facebook** identity (`provider_id 122126097519161744`, identity email `kidsp2p@gmail.com`) + its own `email` identity. `check_account_exists_by_email('kidsp2p@gmail.com')` → `{exists:true, user_id:27699457…, providers:[google], has_password:true}`.

### Execution trace (abridged)
1. qa-logout deep link → Landing → Log In. Tapped **Facebook** (`facebook-login-button`).
2. ASWebAuthenticationSession system prompt → Continue. Facebook consent page → **"Continue as Sam"** (cached facebook-oauth-test-user, email `kidsp2p@gmail.com`) → tap.
3. **AccountLinkingPrompt FIRED** (on-screen, instrumentable): title "Link Facebook Account"; body **"An account with email kidsp2p@gmail.com already exists."**; **password re-auth mode** ("To link your Facebook account, please enter your password for security." + `account-linking-prompt-password-input` + `account-linking-prompt-link` "Link Facebook account" + `account-linking-prompt-dismiss` "Maybe later").
4. Attempted re-auth with a **wrong** password → surfaced `EmailMismatchError` ("The email on your Facebook account doesn't match your account email."; CDP: `linkSocialAccount failed: EmailMismatchError: Cannot link provider email "kidsp2p@gmail.com" - account email is "qa-c04-account-link@kidsmarketplace.test"`) → dismissed the two LogBox overlays → "Maybe later" → back to Login.
5. **Google sanity:** tapped **Google** (`google-login-button`) → account chooser → "KidsP2P / kidsp2p@gmail.com" → **landed directly on Home — NO AccountLinkingPrompt**. CDP: `[NAV] route: Home` + `view_recommendations user_id:27699457-3d25-4c82-bb75-5ad10fd60228` (user A). DB: A `last_sign_in_at` = 13:05:02Z.
6. **Fixture intact after run (read-only):** A still `[google]` only; B still `[email, facebook]`; B `last_sign_in_at` = 13:02:48Z (the Facebook OAuth). No identity was moved/removed.

### Assert result — **PASS**
- **Facebook OAuth → AccountLinkingPrompt fires with password re-authentication required** — ✓ on-device (collision copy + password field + hasPassword=true mode) and corroborated by the captured JWT: the Facebook session resolves to **User B** (`sub a1234567-…-c`, `app_metadata.providers:["facebook","email"]`) whose identity email is `kidsp2p@gmail.com` → `checkAccountExists(email).userId (A) ≠ sessionUserId (B)` → prompt fires. This is the exact precondition C04 needs.
- **Google sanity (C01 not broken)** — ✓ no prompt; Google lands on **A** (`27699457-…`).

### Findings (C04)
- **F3 (INFO, fixture-config nuance — not a C04 defect):** attempting to **complete** the link in this fixture raises `EmailMismatchError` because the session user (B, `qa-c04-account-link@kidsmarketplace.test`) has a different email than the provider identity email (`kidsp2p@gmail.com`). In the real (non-fixture) collision scenario, the freshly-created OAuth session's email would equal the existing account's email, so the link would proceed to password re-auth then link. The fixture was designed to trigger the prompt (which it does perfectly); it does not exercise the successful link-completion leg. The prompt + re-auth-mode assertion (the guide's Expected Result) is fully met.

### UX notes (C04)
- **Structural:** AccountLinkingPrompt is a clean page-sheet modal, fully instrumentable (buttons surface in the AX tree — unlike the Phase 17 `ui/Modal` gap), with "Link Account" (primary) + "Maybe later" (secondary). Good affordance.
- **Wording/copy:** "An account with email kidsp2p@gmail.com already exists." + "To link your Facebook account, please enter your password for security." — clear and appropriate. The edge-case `EmailMismatchError` copy "The email on your Facebook account doesn't match your account email." is a little technical for a parent audience but only surfaces in the fixture-specific mismatch case.
- **Design-system compliance:** No deviations on the Login screen, Facebook/Google consent (OS), or the AccountLinkingPrompt (green primary `#5DBB8E` "Link Account", secondary outline "Maybe later", 16px title/subtitle scale, single primary per dialog).

### Locator-gap findings (C04)
- None: Facebook/Google buttons (`facebook-login-button`/`google-login-button`) and all AccountLinkingPrompt controls surface in the AX tree.

### Friction vs. operating rules (C04)
- OAuth browser flows (Facebook consent, Google account chooser) handled per §5.5 (screenshots/OCR + AX tree for browser content — the SFSafariViewController surfaced its content in the tree this session, which was convenient).
- Two LogBox overlays from the `EmailMismatchError` console errors — dismissed via pixel-located Dismiss.

### Perceived load times (C04)
- Facebook OAuth (tap → prompt): **~10s** — this includes the multi-step ASWebAuthenticationSession browser consent flow (Continue → Continue as Sam → callback). App-side transition after callback → prompt: <2s. Not flagged (browser flow, not an app-screen transition).
- Google OAuth (tap → Home): **~10–15s** — includes the browser account-chooser interaction. App-side callback → Home: <2s. Not flagged.
- No ≥3s app-screen transitions observed. Label: perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.

---

## Cross-cutting findings (ranked)
1. **LOW — `profiles.phone_verified` boolean left false after verification** (E05 F1): `phone_verified_at` set, boolean not. No functional impact (all gates read `phone_verified_at`), cosmetic data inconsistency worth a dev glance.
2. **INFO — `send-phone-otp` Edge Function non-2xx** (E05 F2): dev SMS bypass (123456) handled it; underlying function failure (likely rate limit) worth a dev check if it persists.
3. **INFO — C04 link-completion leg not exercisable in the fixture** (C04 F3): EmailMismatchError due to B's email ≠ identity email; prompt + re-auth-mode fully verified.

## Friction vs. operating rules
- ItemCreate scroll teleportation → small-swipe + tree-verify technique (worked).
- Condition-rows AX gap → guide-anchored tap + pixel-scan (worked, flagged as locator gap).
- OTP box typing drops/replacement-ignored → reset + digit-by-digit (worked).
- LogBox dismissals → pixel-located Dismiss (worked).
- CDP capture reconnect flapping → evidence still valid (JWT + session + nav lines captured).

## App State Left Behind
- **Throwaway unverified seller** `qa.alice.17871428540565018@kidsmarketplace.test` (created via UI signup; now **phone-verified** as a result of the E05 flow; no node/profile-completion). Do not reuse.
- **Test listing created:** `0913b3e6-89f3-411d-a4e9-86ee14f7f43d` — "QA E05 test book", $12.50, good, category Books, **status `pending`** (awaiting admin review; expected for a first/starter listing). Left for the dev/admin team to approve or remove.
- `test-buyer`/`test-free`/`test-seller` untouched. C04 fixture **intact** (A `[google]`, B `[email, facebook]`).
- All users logged out; app terminated; simulator on Landing.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-E05 (phone-gate end-to-end via Sell tab) + AUTH-TC-C04 (Facebook OAuth account-linking prompt + Google sanity) — the final Phase-25-unblocking verification (2026-08-19).

**Design-System Compliance:** PASS — no deviations found on screens/dialogs reviewed (Signup, Home, ItemCreate incl. sticky footer + SP estimate, phone-verification modal, Login, AccountLinkingPrompt, Facebook/Google consent). Minor note: ItemCreate price/SP area shows two green CTAs (Kids Club+ promo banner + `upgrade-cta`) — banner semantics, not a max-one-primary violation.

**Perceived Load-Time Verdict:** GOOD — all app-screen transitions (signup → OTP, Sell FAB → ItemCreate, Publish → phone modal, Send Code → code step, Verify → success, OAuth callback → prompt, OAuth callback → Home) rendered <2s with no ≥3s flags. OAuth browser flows (Facebook consent, Google account chooser) took ~10–15s wall-clock but are multi-step external-browser interactions, not app-screen transitions. Label: perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — ItemCreate (New Item): sticky "Submit for Review" footer always visible; labels, SP estimate ("You'll earn: ~16 SP", "1.30x multiplier for this category"), condition selector, dev fixtures on-brand.
- CONFIRMED — Phone-verification modal (transaction gate): "Phone verification is required…" + "We sent a 6-digit code to…" + single primary per step; instrumentable.
- CONFIRMED — "Thanks for submitting!" submission screen: copy clear and parent-appropriate.
- CONFIRMED — Login screen: wording/layout match.
- CONFIRMED — AccountLinkingPrompt: "An account with email kidsp2p@gmail.com already exists." + password re-auth copy; single primary "Link Account" + secondary "Maybe later".
- CONFIRMED — Signup screen (visited for the E05 seller): labels, dev autofill, Create Account CTA on-brand.

**Verdict Summary:** 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.

**Critical Findings:**
1. **E05 is fully fixed and verified end-to-end (PASS).** The phone-verification gate now fires immediately when an unverified seller taps Publish on a valid form (the AUTH-V3-008 dead-code fix is effective); completing verification resumes the publish and creates the listing (status `pending`); the server-side `trg_items_enforce_phone_verified` trigger is live and consistent; the tab-bar occlusion is gone (no tab bar on ItemCreate) and the sticky Publish footer is always reachable. No defects found in the E05 path this run.
2. **C04 is reproduced (PASS).** The provisioned fixture makes the AccountLinkingPrompt fire via Facebook OAuth with password re-authentication required (session resolves to fixture user B; email `kidsp2p@gmail.com` owned by A). Google sanity confirms C01 is intact (lands on A, no prompt). No defects found in the C04 prompt behavior.
3. Minor non-blocking items: `profiles.phone_verified` boolean not updated by the verify flow (gates read `phone_verified_at`, so no impact); `send-phone-otp` Edge Function non-2xx on send (dev SMS bypass handled it — likely rate limit); C04's link-completion leg surfaces EmailMismatchError in the fixture layout (session user B's email differs from the identity email — fixture-config nuance, not a C04 defect).

**App State Left Behind:** throwaway seller `qa.alice.17871428540565018@kidsmarketplace.test` (now phone-verified, no node/profile); test listing `0913b3e6-…` (pending, awaiting admin review); C04 fixture intact; all logged out; app terminated; simulator on Landing.

**Why It Matters:** This is the run that **unblocks Phase 25**: E05 — the P0 phone-gate gap (dead code + no server enforcement) is closed and proven end-to-end on a fresh unverified seller via the real Sell-tab path; C04 — the account-linking collision that was previously impossible to exercise is now reproduced on-device with password re-auth, and the C01 returning-user path is confirmed unbroken by the identity move. Both prior blockers are resolved.

**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/qa-final-verify-e05-c04-2026-08-19/` — 02 OTP screen (unverified); 03 sell sheet; 04/23 ItemCreate (no tab bar, sticky footer); 17–22 condition Good selection (radio green pixel-scan); 24–31 phone-verification modal → submission success; 32 AccountLinkingPrompt; 33 LogBox EmailMismatchError; 34 Google Home (user A); `cdp-console-c04.log` (JWT sub=B, `[NAV] route: Home` user A, DEV SMS bypass, listing pipeline).
- E05: fresh signup → leave OTP unverified → Sell FAB → List One Item → photo/category/title/condition/price → Publish → modal → 123456 → verify → "Thanks for submitting!". DB: `items` row + `profiles.phone_verified_at`.
- C04: Login → Facebook → "Continue as Sam" → prompt with password re-auth; then Google → Home directly. DB: `auth.identities` (fixture intact); `auth.users.last_sign_in_at`.
- Source refs: `ItemCreateScreen.tsx` L811-827 (hoisted gate), L1207-1221 (sticky footer); `PersistentTabBar/index.tsx` L42-45/207-209 (hide on ItemCreate); `AccountLinkingPrompt.tsx`; `phoneService.ts` L104-120 (`isPhoneRequired` reads `phone_verified_at`).

**Known Gaps / Not Tested:**
- E05: the phone-verification *resume* after app relaunch mid-verification, and a second listing publish post-verification (gate must not re-fire) were not explicitly exercised — the gate-not-re-firing is implied by `isPhoneRequired` reading `phone_verified_at` (now set), but a repeat-publish spot check is a reasonable next-session addition.
- C04: the successful link-completion leg (correct password → link → session A) was **not** exercised — this fixture raises EmailMismatchError on the link step (B's email ≠ identity email), so only the prompt + re-auth-mode display were verified. Verifying the actual link completion would require either a fixture where the session user's email equals the identity email, or accepting a mutation + documented rollback.
- OAuth credential use kept sparing (Facebook ×1, Google ×1 this run).

**What Needs To Be Fixed Next:**
1. Fix (minor, dev): update `profiles.phone_verified` boolean alongside `phone_verified_at` in the verify flow for data consistency (all gates currently read `phone_verified_at`; no behavior impact). (E05 F1 — P3)
2. Investigate (dev): `send-phone-otp` Edge Function non-2xx on send (rate limit vs. Twilio config) — the dev bypass masks it, but the underlying failure is worth confirming in staging env. (E05 F2 — P3)
3. Instrumentation (dev, non-blocking): expose the ItemCreate condition-row radios (`accessible` on the radioContainer) and the Sell action-sheet options so future runs don't need pixel/OCR fallbacks. (Locator gaps — P3)
4. Note (dev-team): the C04 fixture exercises the prompt + re-auth display; the successful link-completion leg needs a different fixture shape (or a scripted identity-merge) to test end-to-end. (C04 F3 — P3)

**UX Enhancement Ideas (optional, not defects):**
- On ItemCreate, the sticky Publish footer was the single best affordance observed this run (CTA always reachable). Once the condition-selector AX exposure is fixed, the same "always reachable" pattern could be applied to the category selector if it ever moves below the fold with a sticky form — no further change needed here; observed while navigating the long form via many small scrolls.
- The OTP digit boxes dropped characters under fast typing (tooling-side, not app-side); a "paste/auto-fill" affordance on the verification code field would help real users on autofill-dependent devices — optional, grounded in the friction observed while entering `123456` digit-by-digit.

**Suggested Next Session:** A short follow-up to (a) spot-check that Publish does **not** re-fire the phone gate on a second listing for the now-verified E05 seller, and (b) re-run C04's Google sanity once more after any future identity-move changes; then close Phase 25.

**Suggested to Improve Agent Rules:** The small-swipe (≤80px) + tree-position-verify technique for the ItemCreate long-form ScrollView (and the "populated OTP boxes ignore replacement → use Change Phone Number reset + digit-by-digit" recovery) are worth codifying as first-class §5 techniques — both are generalizable to any long form with a sticky footer and any 6-box OTP.
