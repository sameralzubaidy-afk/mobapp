# QA Task 43b — AUTH Android R1 (clean) — 2026-09-07 session

> **Provenance:** promoted from session scope (`/memories/session/qa-task43b-android.md`) on 2026-09-12 by the agent-rules audit, because session memory is ephemeral and the reference was unreachable from later sessions. Content is the original 2026-09-07 session note, unedited.

Run folder: e2e-test-results/qa-task43b-auth-android-r1-2026-09-07/
Device: Medium_Phone_API_36.1 (Android 16, emulator-5554), screen 1080x2400 PHYSICAL PX.
App: com.sameralzubaidi.p2pmarketplace — DEV-CLIENT build. Metro :8081 running (10.0.2.2:8081 from device).
QA Task 43a running in parallel (ADM config audit) — independent workstreams; J04/J15/K01/N01/O05 verdicts come from 43a.

## ANDROID DEVICE FACTS (calibration — first AUTH Android run)
- AX tree (mobile_list_elements_on_screen) reports PHYSICAL PX coords (0-1080 x, 0-2400 y), 1:1 with screenshots. NO 3x multiply (unlike iOS points).
- testIDs/identifiers SAME as iOS (`landing-signup-button`, `signup-email-input`, `global-alert-button-0`...). uiautomator dump.
- Soft keyboard does NOT auto-show on this emulator (hardware keyboard) — mobile_type_keys types directly; layout does not shift; no Cmd+K needed. BACK press blurs focus. uiautomator dump can return "no XML content" transiently mid-transition → poll/screenshot.
- Cold launch → Expo Dev Launcher home (dev-client). Tap dev server http://10.0.2.2:8081 (row ~(540,562)) to load app. Session persists across relaunch (B04 PASS).
- Android system Photo Picker (expo-image-picker) IS AX-drivable: Photos sheet → select photo (badge "Selected") → Done → native CropImageActivity (Rotate/Flip/CROP all AX-exposed; CROP at ~(1000,136)) → returns. dev-set-avatar fixture also present on Profile Setup.
- Native/dialog: GlobalAlertProvider alerts AX-exposed (global-alert-button-0). Phone-verify dev bypass dialogs AX-exposed (otp-dev-bypass-dialog-ok-button).
- Deep links: NOT yet tested on Android (need adb am start -d). qa-logout/qa-login-as untested here.
- In-app dialogs render AX-visible; RN Modal full-screen on Android = separate activity window (AX may still show).

## VERDICTS — LIVE-EXECUTED ON ANDROID (this session): 25 PASS / 1 PARTIAL / ~0 FAIL
PASS: A01 A02 A03 A04 A05 A07 A08 · B01 B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 · D01 D03 · E01 · H01 H07 · P04
PARTIAL: H06 (Get-Started leg PASS on qa.a01; Skip leg needs a fresh user — not driven)
NOTABLE: E01 exercised during qa.a01 A01-continuation (OTP screen + dev-bypass 123456 verify → Success → Profile Setup).
Remaining ~100 cases NOT executed this session — deferred to follow-up Android rounds (honest SKIP/deferred rows in report).
Doc-drift noted: B02 "Invalid login credentials" (guide "Invalid email or password."); B08 app copy has NO raw admin-support@ email (guide stale — GOOD).
Design note (LOW): Sell FAB renders #FF8C42 (theme accent colors.ts 500) — not in canonical passitup palette, design doc does not spec FAB color.

## NEW ANDROID TECHNIQUE FACTS
- Select-all + retype WORKS: `adb shell input keycombination 113 29` (CTRL+A) then `adb shell input text "..."` replaces a focused field's content. THE field-clear for Android (analog of iOS Cmd+A). Recorded for A/S/B/C reuse.
- Deep links via `adb shell am start -W -a android.intent.action.VIEW -d "p2pkidsmarketplace://<path>" com.sameralzubaidi.p2pmarketplace` WORK (qa-logout verified → Landing).
- Long-press select-all menu NOT AX-exposed on Android TextInputs (floating toolbar not surfaced) — use adb keycombination instead.
- Android list tool truncates at ~2000 chars; resource file also truncated in display; to find below-fold rows: scroll + `grep -o` the resource content file (absolute path, terminal) for the element label.

## PERSONAS / STATE
- qa.a01 (73c54410...): free, onboarded, node Norwalk Central, avatar set. LOGGED OUT (clean Landing at end).
- test-free / test-deleted / test-no-profile: untouched (only used for login-verdict probes; sessions cleared).
- qa.a04.and.1788797905@: NOT created (A05 duplicate-email submit blocked) — no cleanup.
- No DB/config writes. Session toggles: none armed. App on Landing, logged out — clean.
- Deliverables written: report.md + ledger.md + screenshots/ in e2e-test-results/qa-task43b-auth-android-r1-2026-09-07/; AUTH tracker addendum (Android R1) added.
- Round = 25 PASS / 1 PARTIAL live on Android; ~100 deferred to follow-up Android rounds; 5 (J04/J15/K01/N01/O05) from Task 43a; 5 dead-screen removed.

## PERSONAS CREATED
- qa.a01 = user_id 73c54410-2c3f-4b5b-8f8c-aed96909d7b7, email qa.a01.and.1788797905@kidsmarketplace.test, pw TestPass123!, FREE tier, node Norwalk Central, phone-verified, onboarding complete. Currently logged in on Home. Reusable for discovery/Q/P/F06/O04-free.
- Epoch base 1788797905 for unique emails.

## NEXT
- P04 (floating pill nav) with qa.a01 on Home
- Then logout → B-group login cases + A-group remaining + E/C groups.
