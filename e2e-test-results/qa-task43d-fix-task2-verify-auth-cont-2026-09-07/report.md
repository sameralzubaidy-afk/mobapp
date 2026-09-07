# QA Task 43d — FIX-Task-2 Verification + AUTH Continuation — Report

**Run folder:** `e2e-test-results/qa-task43d-fix-task2-verify-auth-cont-2026-09-07/`
**Date:** 2026-09-07 · **HEAD:** `59a657c8` (FIX-Task-2) · **Metro:** :8081 (dev-client)
**Devices:** iOS `iPhone 17 Pro Max` (3F3293A3…) · Android `Medium_Phone_API_36.1` (emulator-5554)
**App:** `com.sameralzubaidi.p2pmarketplace` (Pass It Up, dev build) · **LLM:** DeepSeek V4 Flash
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Parallel:** none (43a/43b/43c complete)

## 1. Summary

This round verified **FIX-Task-2's 6 completed changes on-device (iOS + Android both — required)** and consumed the **newly-armed fixtures (C05/H03/S03/S04/S05)** that were BLOCKED-on-fixture in 43c. All 3 fixture toggles were disarmed at session end (DB-verified). 5 of the 6 FIX-Task-2 changes PASS on-device (Items 1, 2, 3, 5 fully; Item 6 partial). **Item 4 (Apple provider friendly banner) FAILS on both platforms — the ProviderDisabled classification never fires because supabase-js (`skipBrowserRedirect:true`) returns the authorize URL without erroring for a disabled provider, so the `400 provider is not enabled` still renders as raw JSON inside the opened browser sheet/custom tab.** Item 6 is PARTIAL (applied-location count now matches; the default prefilled-ZIP state still shows the global count).

**A mid-run build-staleness hazard was hit on BOTH platforms** (iOS resumed an old process; Android resumed the 43c process) — both needed a forced cold reload to load the current FIX-Task-2 bundle before behavior was trustworthy. This is the single biggest process lesson of the round (see §7 / agent-rules suggestion).

### 1.1 Verdict roll-up (this round)

| Verdict | Count | Verdicts |
|---|---|---|
| ✅ PASS | 20 | Item1 iOS+Android · Item2 iOS+Android · Item3 iOS+Android (2 dialogs each) · Item5 iOS+Android · Item6-applied-leg iOS+Android · C05 iOS+Android · H03 iOS+Android · S03/S04/S05 iOS+Android |
| 🟡 PARTIAL | 2 | Item6 default-state (iOS, Android) — the 43c UX note is only half-fixed |
| 🔴 FAIL | 2 | Item4 Apple-provider friendly banner (iOS, Android) — raw JSON sheet/custom tab persists |
| ⏭️ Disarm | 1 | 3 fixture toggles → `none`, DB-verified (mandated action item) |
| ⏭️ Part 3 deferred | — | Groups J/K/L/Q, B01 leg, O04-free leg — explicit per-case reasons (§6) |

### 1.2 Per-verdict evidence index (screenshots in `screenshots/`)

| Item | iOS | Android |
|---|---|---|
| Item1 — O02 ZIP 06850 apply, no waitlist | `ios-item1-o02-zip06850-applied-97-no-waitlist.png` | `android-item1-o02-zip06850-applied-97-no-waitlist.png` |
| Item2 — A06 "Continue anyway" green outline | `ios-item2-a06-invalid-referral-dialog.png` | `android-item2-a06-invalid-referral-dialog.png` |
| Item3 — Remove-favorite Cancel green outline | `ios-item3a-remove-favorite-dialog.png` | `android-item3a-remove-favorite-dialog.png` |
| Item3 — Settings Sign Out Cancel green outline | `ios-item3b-settings-signout-dialog.png` | `android-item3b-settings-signout-dialog.png` |
| Item4 — Apple raw-JSON (no friendly banner) | `ios-item4-c03-apple-raw-json-sheet.png` | `android-item4-c03-apple-raw-json-customtab.png` |
| Item5 — E02 "Please enter all 6 digits" | `ios-item5-e02-please-enter-all-6-digits.png` | `android-item5-e02-please-enter-all-6-digits.png` |
| Item5 — E02 wrong code 999999 | `ios-item5-e02-wrong-code-999999.png` | `android-item5-e02-wrong-code-999999.png` |
| Item6 — default-state modal 1154 vs grid 81 | `ios-item6-filters-modal-show1154-vs-grid81.png` | `android-item6-filters-modal-show1154-vs-grid81.png` |
| Item6 — applied-state count 97 = grid | (iOS via `ios-item6-*`/traces) | `android-item6-applied-97-fresh-bundle.png` |
| C05 — provider-outage banner | `ios-c05-apple-outage-banner.png` | `android-c05-google-outage-banner.png` |
| H03 — avatar-failure warning + profile created | `ios-h03-avatar-failure-warning.png`, `ios-h03-profile-created-no-avatar.png` | `android-h03-avatar-failure-warning.png`, `android-h03-profile-created-no-avatar.png` |
| S03 — rate-limit | `ios-s03-rate-limited.png` | `android-s03-rate-limited.png` |
| S04 — SMTP-500 | `ios-s04-smtp-500.png` | `android-s04-smtp-500.png` |
| S05 — 400 bad_email | `ios-s05-400-bad-email.png` | `android-s05-400-bad-email.png` |

## 2. Part 1 — FIX-Task-2 on-device verification (both platforms)

### Change 1 — ZIP lookup `.limit(1)` + Diag node deactivated (AUTH-TC-O02 apply) — ✅ PASS both platforms
- DB precondition verified before driving: exactly 1 active 06850 node (Norwalk `550e8400…`); Diag `6bf728cf…` deactivated (FIX-Task-2 cleanup live).
- **iOS:** Discover → Filters (ZIP 06850 prefilled) → Apply → **"97 results · near 06850, 15 mi"** — NO "Not Available in Your Area" waitlist dialog (was the 43c Finding #1 repro). **Android (fresh bundle):** identical — "97 results · near 06850, 15 mi", no waitlist.
- The 43c MODERATE finding (duplicate-node false waitlist on an active home ZIP) is CLOSED on-device.

### Change 2 — GlobalAlertProvider cancel → Secondary Outline `#5DBB8E` 2px (AUTH-TC-A06 dialog) — ✅ PASS both platforms
- **iOS A06:** fresh signup → invalid 8-char referral ZZZZZZZZ → dialog: "Fix it" = solid primary (region scan 79.46% `#5DBB8E` fill) and **"Continue anyway" = white + green `#5DBB8E` outline (14.66%)** — the gray 1px `neutral[700]` outline is GONE.
- **Android A06:** identical — Continue anyway = 14.04% `#5DBB8E` outline vs Fix it solid.
- 43c Finding #2 (owner-reported design deviation) is CLOSED on-device.

### Change 3 — 2 additional cancel-button dialogs (Remove-favorite, Settings Sign Out) — ✅ PASS both platforms
- **Remove-favorite (iOS):** Favorites → Remove → dialog "Remove favorite?" → **Cancel = 10.61% `#5DBB8E`** (green Secondary Outline); Cancel functional (dialog dismissed, favorite row intact DB+UI). **Android:** Cancel = 9.89% `#5DBB8E`.
- **Settings Sign Out (iOS):** Profile → App Settings → DANGER ZONE Sign Out → "Are you sure you want to sign out?" → **Cancel = 11.27% `#5DBB8E`**; Cancel functional. **Android:** Cancel = 10.17% `#5DBB8E`.
- Shared-component change propagates cleanly without layout/spacing regressions on either platform (button bands measured consistent ~10-15%).

### Change 4 — C03 Apple provider → friendly in-app banner (Item 4) — 🔴 FAIL both platforms (real finding, Tier-0 PASS ≠ on-device)
- **Attribution method:** `qa_provider_unavailable` was DISARMED first so the outage path couldn't mask the disabled-provider path; source-confirmed the two copy templates differ ("…is temporarily unavailable. Sign in with email instead?" = ProviderUnavailableError; "…Sign-In is temporarily unavailable. Please use email…" = ProviderDisabledError).
- **iOS:** with the outage toggle disarmed, tapping Apple opened the native "PassItUp wants to use supabase.co to Sign In" consent → in-app SFSafari sheet to `drntwgporzabmxdqykrp.supabase.co` showing the **raw JSON `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`**. Closing the sheet returned to Login **silently — no friendly banner**.
- **Android:** identical — Chrome custom tab showed the same raw JSON; closing returned silently.
- **Root cause (source-confirmed):** `oauthService.ts` calls `supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })` (L143-151). With that flag supabase-js returns the authorize URL **without erroring** for a disabled provider — the 400 only renders when the browser opens that URL. So the FIX-Task-2 `ProviderDisabledError` classification (oauthService L162-174, unit-tested) **never fires on this flow** — it is effectively dead code for the disabled-Apple case on both platforms. FIX-Task-2's own §1 deferral ("whether the disabled-Apple case currently opens the tab (raw JSON) vs rejects at initiation must be confirmed on-device") is now answered: it opens the tab/sheet with raw JSON. **Recommended fix direction:** pre-validate the provider against the enabled-provider list client-side before `signInWithOAuth` (fail fast with the friendly banner), or detect the enabled-provider set from a lightweight endpoint.

### Change 5 — E02 OTP: Verify tappable at ≥1 digit → "Please enter all 6 digits" — ✅ PASS both platforms
- **iOS:** OTP field "1 2" (2 digits) → Verify **enabled** → alert "Invalid Code / Please enter all 6 digits" (the previously-unreachable guard now fires). Wrong-code leg: 999999 → "Verification Failed / Invalid verification code" — **not broken**.
- **Android:** identical — "1 2" → Verify → "Invalid Code / Please enter all 6 digits"; 999999 → "Verification Failed / Invalid verification code". Field value read back "1 2"/"9 9 9 9 9 9".

### Change 6 — Discover Filters live count node-scope — 🟡 PARTIAL both platforms (real finding)
- **Applied-location leg — ✅ PASS:** after applying ZIP 06850 (grid "97 results · near 06850"), reopening Filters shows **"Show 97 results"** (iOS and Android fresh bundle) — matches the grid. The `countScopeNodeIds` fix works when the location is actually applied.
- **Default-state leg — 🔴 FAIL (the exact 43c UX note):** Show-All-Nodes OFF + Discover prefills the Filters ZIP with the home ZIP 06850 but does NOT apply it (`appliedZipCode=''`; source L305 "Keep ZIP prefilled for convenience, but do not auto-apply"). SearchFilterModal's `locationUnchanged = zipInput === zipApplied` = `'06850' === ''` → **false** → `nodeIds = undefined` → global count. Result: grid **81 results · near CT** while the modal Apply reads **"Show 1154 results"** — the numbers still visibly disagree on the default state (both platforms).
- **Recommended fix direction:** treat "ZIP input equals the user's home/effective scope ZIP" (or the prefilled-but-not-applied case) as `locationUnchanged`, or have the modal count use the grid's scope unless the user explicitly edits the ZIP field.

## 3. Part 2 — Newly-armed fixtures (43c BLOCKED-on-fixture now unblocked)

### AUTH-TC-C05 (provider outage banner) — ✅ PASS both platforms
- **iOS:** tap Apple with `qa_provider_unavailable=all` → in-app banner "Apple is temporarily unavailable. Sign in with email instead?" + "Use email login instead" CTA (`provider-error-cta`). Copy matches the ProviderUnavailableError template (source L435).
- **Android:** tap Google with toggle armed → "Google is temporarily unavailable. Sign in with email instead?" banner + CTA. (A dev LogBox console-error toast also surfaced the raw `ProviderUnavailableError` string — dev-only overlay, the user-facing banner is clean.)
- 43c C05 BLOCKED → CLOSED (both platforms).

### AUTH-TC-H03 (avatar upload failure, non-blocking) — ✅ PASS + DB-verified both platforms
- **iOS:** fresh persona `qa.alice.17888071480089182@…` ("QA H03 Alice") — dev-set-avatar → Complete Setup with `qa_avatar_upload_failure=upload_failure` → Warning "Profile will be created without avatar. You can add it later." → profile created; **DB: avatar_url NULL**, phone verified, node Norwalk.
- **Android:** fresh persona `qa.alice.1788808174560139@…` ("QA H03 Droid") — identical result; **DB: avatar_url NULL**. (Note: Android Complete Setup needed a 2nd tap — first tap was a silent no-op, same class as 43c's H02 Complete-Setup first-tap miss.)
- 43c H03 BLOCKED → CLOSED (both platforms).

### AUTH-TC-S03 (rate-limit) / S04 (SMTP-500) / S05 (400 bad_email) — ✅ PASS all branches, both platforms
- Sequential re-arm of `qa_reset_error_simulation` (rate_limited → smtp_500 → bad_email) between cases.
- S03: "Reset Email Failed / You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes." + Open Supabase Docs + OK. Both platforms.
- S04: "Reset Email Failed / Error sending recovery email / Possible causes: • SMTP/email provider not configured… • Redirect URL not allowed… / Check Supabase Auth > Email Settings and Email Logs." Both platforms.
- **S05 — the FIX-Task-2 Item-3 `bad_email` value (new 400 sim) makes this branch inducible for the first time ever:** "Reset Email Failed / Email address is invalid / Check that the email you entered is correct and belongs to an account." Both platforms. 43c S05 (400 not inducible) → CLOSED.
- C07 **remains BLOCKED** as briefed (real Google identity attach deferred — ticket #19, would break a live login). Not attempted.

## 4. Post-round required action — toggle disarm ✅ COMPLETE
All three fixture toggles set back to `none` via `upsert_admin_config_setting` and **verified by DB read-back** (19:18Z): `qa_provider_unavailable=none`, `qa_avatar_upload_failure=none`, `qa_reset_error_simulation=none`. Staging no longer simulates outages/failures. Toggle re-arm/disarm used the sanctioned `qa:admin-config-set` helper (R37) throughout (MCP SQL correctly returns P0001 without service role).

## 5. Perceived load-time observations
All app-behavior transitions (filter apply, dialog render, screen nav) landed within ~2s on both platforms. The only multi-second waits were dev-client cold-start bundle loads after the forced reloads (~4-6s iOS, ~5-8s Android via Expo Dev Launcher) — environment artifacts, not app behavior.

## 6. Part 3 — AUTH backlog (NOT run this round — explicit deferral, R40)
Session budget consumed by the mandatory dual-platform Part 1 + Part 2 minimum. Deferred with explicit reasons (same honest-deferral discipline as 43b/43c):
- **Groups J + K** (listing creation single + bulk, test-seller): largest untested block; needs ItemCreate deep link + dev-category/photo flows on both platforms — dedicated block.
- **Group L** (admin review/pending): needs a real admin-portal session + seller/buyer mobile legs — dedicated mixed-surface block.
- **Group Q** (education Help/SP calculator): navigation needs mapping via SpWallet/MySubscription; no deep link.
- **B01 incomplete-onboarding leg:** needs a persona whose onboarding is genuinely incomplete (dedicated mid-onboarding signup).
- **O04 free-user leg:** persona available (`qa.alice.17888028470414455@…`, `qa.a01.and.1788797905@…`) but not driven this session; the subscriber leg was already PASS. This is the cheapest remaining deferral (6-8 calls) — highest priority for the next AUTH round.
- **S08 + S11-Case2** (minted reset tokens): needs the admin-trigger-password-reset minting harness (unchanged).

## 7. Process findings / friction
1. **Dev-client bundle staleness (BOTH platforms — highest-value lesson):** after a new commit (FIX-Task-2), a launched dev-client that RESUMES an old process serves a STALE JS bundle. On iOS the app resumed and showed the pre-fix count behavior; on Android the `adb` deep link even reported "delivered to currently running top-most instance". Fix: after any code change, force a cold reload (iOS terminate→launch downloads the bundle; Android terminate→launch→tap the `10.0.2.2:8081` row in Expo Dev Launcher) and confirm via a discriminating behavior test before trusting results. **Recommended agent-rule addition.**
2. **uiautomator transient "no XML content"** on the Android OTP screen (3 consecutive empty dumps then recovery) — R77#3 class; poll/screenshot, not a hang.
3. **iOS signup dev-fill buttons sit at logical y1112 (below fold)** — a tap at their tree coordinate is off-screen and does nothing; swipe the form up first (worked around; a known iOS signup quirk).
4. Item-4 attribution required disarming/re-arming the outage toggle (3 extra config writes) — necessary to separate the ProviderUnavailable vs ProviderDisabled paths.
5. Call-count note: the full session transcript wasn't mineable this run (only the pointer `main.jsonl` exists), so the call ledger is a careful manual tally (QA Task 41 precedent) — see §8.3 + ledger.

## 8. App state left behind
- **Personas created (both reusable, phone-verified, node Norwalk):** `qa.alice.17888071480089182@…` ("QA H03 Alice", iOS) and `qa.alice.1788808174560139@…` ("QA H03 Droid", Android) — both `avatar_url=NULL` by design (H03). Both **logged out** at session end.
- **test-buyer:** Discover location filter left at 06850 in-memory (cleared on logout); no favorites left (favorite added/removed cleanly); **not signed out** — last session state on iOS was logged out; Android test-buyer was signed out during the D02 sign-out confirm Cancel and left on Landing.
- **Toggles:** all 3 disarmed (`none`), DB-verified.
- **Screenshots:** 30+ evidence files in `screenshots/` (see §1.2).
- No `admin_config` values left changed beyond the 3 toggles (all reverted to `none`).

## 9. Design-system / copy compliance notes
- Item 2 + Item 3 dialogs now comply with the design doc's Secondary-Outline rule (green 2px `#5DBB8E` escape buttons) — the 43c Finding #2 deviation is fixed and verified on both platforms.
- A06/Remove-favorite/Sign-Out/Reset-Email dialogs: single primary + one outline/text alternative present (max-one-primary respected); OK buttons and copy correct.
- No off-brand legacy hexes observed on the rendered surfaces this round.
- **[LOW/UX]** Item 4's raw JSON (`{"code":400,…"provider is not enabled"}`) remains visible to a real user inside the browser sheet/custom tab on both platforms — a developer-facing string leak class (R58-relevant) on the disabled-provider path; the friendly copy exists in code but is unreachable (see Change 4 root cause).
- **[LOW]** A dev LogBox console-error toast surfaced the raw `ProviderUnavailableError` string under the C05 banner on Android — dev-only build artifact, not a user-facing leak in release.
