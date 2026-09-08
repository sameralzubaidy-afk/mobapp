# QA Task 43e — FIX-Task-3 On-Device Verification (Both Platforms) — Report

**Run folder:** `e2e-test-results/qa-task43e-fix-task3-verify-auth-cont-2026-09-07/`
**Date:** 2026-09-07 · **HEAD:** `b11c73ff` (FIX-Task-3 — already committed + pushed) · **Metro:** :8081 (dev-client)
**Devices:** iOS `iPhone 17 Pro Max` (3F3293A3…) · Android `Medium_Phone_API_36.1` (emulator-5554)
**App:** `com.sameralzubaidi.p2pmarketplace` (Pass It Up, dev build) · **LLM:** DeepSeek V4 Flash
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Parallel:** none (43a–43d complete)

## 1. Summary

This round verified **FIX-Task-3 on-device (iOS + Android both — mandatory)** with the **cold-reload-first discipline** applied on both platforms (43d's stale-bundle failure mode explicitly avoided). **All 6 numbered items PASS on both platforms.** However, the **builder-flagged Linked-Accounts spot-check surfaced an open Part-1 defect on BOTH platforms**: the Linked-Accounts screen calls the same `initiateSocialLogin` path, and the FIX-Task-3 pre-check **does** fire there (no browser sheet / custom tab opens — the primary 43d-Item-4 goal holds on that surface too), **but** the error UI that renders is a **generic `Alert('Error', 'Failed to link apple account. Please try again.')`** — the friendly in-app banner (which lives only in `SocialLoginButtons`) is **not** shown. Because the brief's structure requires Part 1 to be fully clean ("all 6 items + spot-check, both platforms, no new FAILs") before Part 2, and this spot-check is an open defect, **Part 2 (AUTH continuation) is DEFERRED** per the brief's explicit rule — root-caused and reported here rather than burning session budget on Part 2 with an open Part-1 defect.

> **NOTE re: "uncommitted" framing in the brief:** FIX-Task-3 was found **already committed** at `b11c73ff` (HEAD, `origin/main`, working tree clean aside from this run folder) at session start — not sitting uncommitted as the brief states. Nothing for QA to commit; this round's clean 6-item verification is the confirmation the diff was waiting on, and the spot-check finding below is a **new** item to file for FIX-Task-4.

### 1.1 Verdict roll-up (this round)

| Verdict | Count | Verdicts |
|---|---|---|
| ✅ PASS | 12 | Item1 iOS+Android · Item2 iOS+Android · Item3 iOS+Android (3 dialogs each) · Item4 iOS+Android · Item5 iOS+Android · Item6 iOS+Android |
| 🔴 SPOT-CHECK FINDING | 2 | Linked-Accounts error UI not friendly (iOS + Android) — open Part-1 defect |
| ⏭️ Part 2 deferred | — | O04 free leg, B01, Groups Q/J/K/L — explicit per-case reasons (§6) |

### 1.2 Per-verdict evidence index (screenshots in `screenshots/`)

| Item | iOS | Android |
|---|---|---|
| Item1 — Apple disabled → friendly banner, NO sheet | `ios-item1-apple-disabled-friendly-banner.png` | `android-item1-apple-disabled-friendly-banner.png` |
| Item4 — outage email-fallback full-width green CTA | `ios-item4-google-outage-fullwidth-green-cta.png` | `android-item4-google-outage-fullwidth-green-cta.png` |
| Item6 — SMTP-500 "Open Supabase Docs" on staging | `ios-item6-smtp500-open-supabase-docs.png` | `android-item6-smtp500-open-supabase-docs.png` |
| Items 2+5 — Filters "Show 81 results" = grid, "Your area: 06850" | `ios-item2-item5-filters-show81-your-area-06850.png` | `android-item2-item5-filters-show81-your-area-06850.png` |
| Item3 — A06 "Continue anyway" green outline + centered | `ios-item3-a06-invalid-referral-dialog.png` | `android-item3-a06-invalid-referral-dialog.png` |
| Item3 — Remove-favorite Cancel green outline | `ios-item3a-remove-favorite-dialog.png` | `android-item3a-remove-favorite-dialog.png` |
| Item3 — Settings Sign Out Cancel green outline | `ios-item3b-settings-signout-dialog.png` | `android-item3b-settings-signout-dialog.png` |
| Spot-check — Linked Accounts generic error (not friendly) | `ios-linked-accounts-apple-link-generic-error.png` | `android-linked-accounts-apple-link-generic-error.png` |

## 2. Cold-reload discipline (both platforms — confirmed)

- **iOS:** app fully terminated → launched fresh → fresh bundle confirmed via the **Item-1 discriminating behavior check** (tapping Apple with `qa_provider_unavailable=none` produced the FIX-Task-3 friendly disabled-provider banner immediately — a behavior that does not exist on any pre-FIX-Task-3 bundle). No sheet opened.
- **Android:** app terminated → launched → tapped the `10.0.2.2:8081` row in Expo Dev Launcher fresh → same discriminating check (friendly banner, no custom tab) confirmed the current bundle before any verdict was recorded.
- 43d's exact failure mode (resumed process silently serving a stale bundle) was **not** repeated.

## 3. Part 1 — FIX-Task-3 on-device verification (both platforms)

### Item 1 — Apple Provider Pre-Check → friendly banner, no sheet/tab — ✅ PASS both platforms
- **iOS:** Login → tap Apple (outage toggle confirmed `none` first) → **immediate in-app friendly banner "Apple Sign-In is temporarily unavailable. Please use email or another method instead."** + full-width green "Use Email" CTA. **No native consent sheet / SFSafari / browser sheet opened at all.** This closes 43d's Change-4 FAIL (raw JSON sheet) — the actual fix, not just copy inside the sheet.
- **Android:** identical — tap Apple → friendly banner, **no Chrome custom tab**. Fresh-bundle discriminating check passed.
- C03 re-confirmed with the corrected behavior on both platforms.

### Item 2 — Discover Filter Count (Default State) — ✅ PASS both platforms
- **iOS:** test-buyer, Show-All-Nodes OFF, no ZIP applied (fresh Discover load) → open Filters → **"Show 81 results" now matches the grid's node-scoped "81 results · near CT"** — the global 1154-style number is GONE on the default state (the exact leg that failed in 43d is now fixed).
- **Android:** identical — Filters "Show 81 results" = grid "81 results · near CT".

### Item 5 — "Your area: {zip}" prefill label — ✅ PASS both platforms
- **iOS:** Filters ZIP field prefilled with home ZIP 06850 and the **"Your area: 06850"** label visible (green, `filter-home-prefill-label`), summary "Showing items from your area — no location filter applied yet." — present simultaneously with the Item-2 matching count. **Android:** identical.
- Note: grid count showed the "20 results" page-size fallback briefly on first Discover mount then resolved to 81 (known cosmetic first-load artifact; the modal count and resolved grid agree).

### Item 3 — Button Text Centering (all three Secondary-Outline buttons) — ✅ PASS both platforms
- **A06 "Continue anyway"** (Invalid Referral dialog, fresh signup, 8-char ZZZZZZZZ): white + green `#5DBB8E` outline, **text vertically+horizontally centered**, no layout/spacing regression. iOS outline fill 16.39%; Android 16.08%. Function check: Continue anyway proceeded signup to OTP (dialog closed correctly).
- **Remove-favorite "Cancel"**: green `#5DBB8E` outline + centered text. iOS 11.79%; Android 11.69%. Function: Cancel dismissed the dialog, favorite retained (then cleaned up to 0 favorites).
- **Settings Sign Out "Cancel"**: green `#5DBB8E` outline + centered text. iOS 11.79%; Android 11.78%. Function: Cancel kept the session signed in.
- No centering/layout regression on any of the three, on either platform.

### Item 4 — Email-Fallback CTA Styling (outage) — ✅ PASS both platforms
- **iOS:** `qa_provider_unavailable=all` armed → tap Google → outage banner + **"Use email login instead" CTA now renders as a full-width solid `#5DBB8E` button with white bold centered text** (94.11% band fill) — the small orange link is gone. **Android:** identical (94.90% fill).
- Toggle **disarmed immediately** after the check and DB-verified `none` (22:06:41Z).

### Item 6 — Dev-Only Supabase Docs Link (staging) — ✅ PASS both platforms
- **iOS:** `qa_reset_error_simulation=smtp_500` armed → Forgot Password → submit → "Reset Email Failed / Error sending recovery email…" alert with **"Open Supabase Docs"** still present (correct for staging; production would show "Contact Support"). **Android:** identical.
- Staging behavior is unchanged/correct. Toggle **disarmed** after (22:07:50Z). "Contact Support" not expected on staging — production-only, code-review-verified.

### Spot-check — Linked-Accounts error UI — 🔴 FINDING (open Part-1 defect), both platforms
- **Driver:** Profile → Linked Accounts (deep link `p2pkidsmarketplace://linked-accounts`) → Apple "Not linked" → Link → password re-auth gate (UX-correct) → confirm → `initiateSocialLogin('apple')` fires.
- **What happens:** the FIX-Task-3 pre-check **does** fire on this surface (Apple disabled) — **no browser sheet/custom tab opens**, so the primary 43d-Item-4 goal (no raw JSON) holds here too. **But** the error rendered is a **generic `Alert('Error', 'Failed to link apple account. Please try again.')`**, NOT the friendly disabled-provider banner. iOS and Android identical.
- **Root cause (source-confirmed):** `LinkedAccountsScreen.performLinking` (L120-163) calls the same `initiateSocialLogin` (which throws `ProviderDisabledError`), but its `catch` only special-cases `EmailMismatchError`; the `ProviderDisabledError` falls through to the generic `else` branch → `Alert('Error', ...)`. The friendly banner is a UI element rendered only inside `SocialLoginButtons` — it is not shared. The friendly copy exists but is unreachable on the Linked-Accounts surface.
- **Recommended fix (FIX-Task-4):** route `ProviderDisabledError` in `LinkedAccountsScreen.performLinking` to the same friendly in-app banner/template (share the error component or extract a shared `ProviderDisabledBanner`), so the pre-check's friendly message renders on both the Login and Linked-Accounts surfaces. No identity mutation occurred (test-buyer Apple still "Not linked").

## 4. Post-round required actions — COMPLETE

- **Fixture disarm DB-verified (read-back):** `qa_provider_unavailable=none` (22:06:41Z), `qa_reset_error_simulation=none` (22:07:50Z), `qa_avatar_upload_failure=none` (19:18:54Z — untouched this round). Staging no longer simulates outages/failures.
- **FIX-Task-3 commit status:** already committed + pushed at `b11c73ff` (not uncommitted as the brief states). The 6 numbered items are confirmed working on-device on both platforms — no commit action needed from QA. The spot-check finding is the new item to file.

## 5. Perceived load-time observations
All app-behavior transitions (pre-check banner, filter count, dialog render, screen nav) landed within ~2s on both platforms. The only multi-second waits were dev-client cold-start bundle loads after the forced cold reloads (~4-6s iOS, ~5-8s Android via Expo Dev Launcher) — environment artifacts, not app behavior.

## 6. Part 2 — AUTH continuation (NOT run — explicit deferral, R40)
Session budget was deliberately NOT spent on Part 2 because the brief's structure requires Part 1 fully clean ("all 6 items + spot-check, both platforms, no new FAILs") first, and the **Linked-Accounts spot-check is an open Part-1 defect on both platforms**. Per the brief: "If anything in Part 1 fails, stop, root-cause it like a fresh finding, and report — don't burn session budget on Part 2 while Part 1 has an open defect." Deferred with explicit reasons:
- **AUTH-TC-O04 free-user leg** — cheapest remaining deferral (~6-8 calls); persona available. Deferred: do NOT half-drive Part 2 while a Part-1 defect is open; this remains the #1 priority for the next AUTH round after FIX-Task-4 lands.
- **AUTH-TC-B01 incomplete-onboarding leg** — needs a genuinely mid-onboarding persona (dedicated signup); deferred with the above.
- **Group Q** (education Help / SP calculator) — needs SpWallet/MySubscription nav mapping; deferred.
- **Groups J + K** (listing creation single + bulk) — largest untested block; dedicated block required; deferred.
- **Group L** (admin review/pending) — real admin-portal session + mobile legs; dedicated mixed-surface block; deferred.
- **S08 + S11-Case2** (minted reset tokens) — needs the admin-trigger password-reset minting harness (unchanged).

## 7. Process findings / friction
1. **Cold-reload discipline worked on both platforms** — no stale-bundle incidents this round; the Item-1 discriminating check is an effective fresh-bundle gate.
2. **Android soft-keyboard on the Linked-Accounts re-auth modal** occluded the Confirm button even with the KeyboardAvoidingView — needed the Gboard hide-chevron to dismiss the keyboard before Confirm was reachable (a real Android UX note worth flagging to dev: the re-auth modal's buttons sit under the keyboard).
3. **iOS direct profile-logout tap at an off-screen coordinate** (list un-scrolled) mis-hit Billing History — re-listed after scroll and used the correct canonical coordinate (R78-7 discipline).
4. Call-count ledger: the full session transcript was **not** cleanly mineable this run (only the pointer `main.jsonl` exists — same limitation as 43d), so the ledger is a careful manual tally (QA Task 41 / 43d precedent).

## 8. App state left behind
- **Personas created (both reusable, phone-verified):** iOS `qa.alice.17888183703295187@kidsmarketplace.test` ("QA A06 iOS", zip 06850, node Norwalk Central, onboarding-skipped) and Android `qa.alice.17888198382012019@kidsmarketplace.test` ("QA A06 Droid", zip 06850, phone-verified). **Both logged out** at session end (iOS logged out via the Logout confirm; Android already on Landing).
- **test-buyer:** favorites left at 0 (added/removed cleanly); Apple never linked (no identity mutation); Discover default state intact.
- **Toggles:** all 3 `none`, DB-verified (§4).
- **Screenshots:** 35+ evidence files in `screenshots/` (see §1.2).
- No `admin_config` values left changed beyond the 3 toggles (all `none`).

## 9. Design-system / copy compliance notes
- Item 3's three Secondary-Outline dialogs remain design-doc compliant (green 2px `#5DBB8E` escape buttons, centered text, max-one-primary) — the 43d fixes hold with no regression.
- Item 4's outage CTA now complies (full-width solid `#5DBB8E`, white bold centered) — closes the small-orange-link deviation.
- Item 1's friendly disabled-provider banner copy matches the FIX-Task-3 template; no raw JSON visible on Login or Linked-Accounts.
- **[MODERATE / UX — new]** Spot-check: Linked-Accounts' Apple-link disabled-provider path shows a **generic developer-toned "Failed to link apple account. Please try again."** alert instead of the friendly banner — an inconsistent error-UI experience across two surfaces that call the same `initiateSocialLogin`. Root cause + fix direction in §3 Spot-check.
- **[LOW]** Dev-only LogBox console-error toasts (`[SocialLoginButtons] apple/google OAuth error…`) surfaced under the banners on both platforms — dev-build artifacts, not user-facing in release.
- No off-brand legacy hexes observed on rendered surfaces this round.
