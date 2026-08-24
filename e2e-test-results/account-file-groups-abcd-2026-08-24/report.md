# QA Run Report — Account File, Groups A+B+C+D: Settings, Edit Profile, Linked Accounts, Notifications (23 cases)

- **Date:** 2026-08-24, 21:47–22:22 UTC (~35 min active)
- **Device:** iPhone 17 Pro Max simulator (3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E), iOS 26.1, debug build + Metro
- **Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`
- **Personas:** test-buyer (`49243010-…`) for Groups A/B/C/D01–D03; fresh throwaway `qa.alice.17876099769423378@kidsmarketplace.test` (`167abdc4-…`) for D04
- **Auth cycles:** 3 logins (2× test-buyer, 1× fresh via signup), 3 logouts (A02 UI confirm, 2× qa-logout deep link)

---

## Roll-up

| Group | Cases | PASS | FAIL | BLOCKED | SKIPPED |
|---|---|---|---|---|---|
| A — Settings Hub | A01–A05 | 4 | 0 | 1 | 0 |
| B — Edit Profile | B01–B10 | 8 | 0 | 2 | 0 |
| C — Linked Accounts | C01–C04 | 2 | 0 | 2 | 0 |
| D — Notification Prefs | D01–D04 | 2 | 0 | 2 | 0 |
| **Total** | **23** | **16** | **0** | **7** | **0** |

**16 PASS / 0 FAIL / 7 BLOCKED / 0 SKIPPED**

## Batch summary

| TC-ID | Verdict | Top finding |
|---|---|---|
| ACC-TC-A01 | PASS | 4 sections + 11 rows render; no "Help & Support" row (drift note wording stale) |
| ACC-TC-A02 | PASS | Sign Out confirm (Cancel keeps session; Sign Out → Landing); in-app GlobalAlert (doc drift) |
| ACC-TC-A03 | BLOCKED | No Expo push token on sim → "Send Failed: No push tokens registered" (env); rate-limit/quiet-hours legs not inducible |
| ACC-TC-A04 | PASS | TOS/Privacy/Liability/LinkedAccounts/NotificationPrefs navigate + back; Privacy & Security = no-op stub. **Legal content = imported 3rd-party boilerplate** |
| ACC-TC-A05 | PASS | Manage Payment Methods → PaymentMethodsScreen (saved Mastercard ••••4444) |
| ACC-TC-B01 | PASS | Fields prefill; locked fields verified; optimistic save DB-proven (bio persisted, updated_at matches) |
| ACC-TC-B02 | BLOCKED | Guide-documented NOT-IMPLEMENTED; source-verified `supabase.auth.updateUser` direct, no gate (no email mutation performed) |
| ACC-TC-B03 | PASS | Phone change → OTP modal → 123456 → Profile. **Findings: profile.phone/phone_verified_at NOT synced after verify; transient Profile stuck-loader; Verify not AX-exposed + first-tap swallow** |
| ACC-TC-B04 | PASS | Avatar upload end-to-end (native picker drivable this session); storage object + avatar_url DB-proven |
| ACC-TC-B05 | PASS | Stats/badges/reviews/status/ID/referral render; grace-state label observation |
| ACC-TC-B06 | PASS | Email + phone inline validation; valid values clear + proceed |
| ACC-TC-B07 | PASS | "No Changes / No changes were made to your profile." → OK → Profile |
| ACC-TC-B08 | PASS | ZIP locked + helper; waitlist `needsWaitlist` unreachable (source-verified) |
| ACC-TC-B09 | BLOCKED | "Already verified" Info path unreachable — `phone_verification_codes.verified` column missing → alreadyVerified always false |
| ACC-TC-B10 | PASS | Both Question icons → "Contact Support / …admin-support@kidsmarketplace.app."; inputs disabled; ZIP no icon |
| ACC-TC-C01 | PASS | Email readonly + info card + "Password ✓ set" + 3× "Not linked" + Link buttons |
| ACC-TC-C02 | PASS | Link → password re-auth modal → Confirm → simulated OAuth Flow alert |
| ACC-TC-C03 | BLOCKED | No linked provider on persona → unlink leg + last-method guard unreachable (setup gap; guard source-verified) |
| ACC-TC-C04 | BLOCKED | `EmailMismatchError` requires a real OAuth callback; dev Link flow is simulated → not inducible |
| ACC-TC-D01 | PASS | 5 categories × 3 toggles render + persist (DB + reload verified) |
| ACC-TC-D02 | BLOCKED | No failure-forcing mechanism in dev (no hook; network manipulation required) |
| ACC-TC-D03 | PASS | Valid 24h save → "Quiet hours have been updated."; invalid "9pm" → "Invalid time format…" |
| ACC-TC-D04 | BLOCKED | Empty-state + Initialize Settings unreachable — signup auto-creates prefs (DB-proven) + self-healing init |

## Perceived load-time table (all labeled "Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile")

| Screen → Transition | Elapsed | ≥3s? |
|---|---|---|
| Login → Home dashboard | ~1.5s | no |
| Profile → Settings | ~1s | no |
| Settings → TOS / Privacy / Liability (WebView) | ~1s | no |
| Settings → Payment Methods | ~0.5s | no |
| Settings → Notification Preferences | ~1s | no |
| Settings → Linked Accounts | ~1s | no |
| Profile → Edit Profile (load) | ~1s | no |
| Save → Profile optimistic patch | ~1s | no |
| Phone verify → Profile redirect | ~1.5s | no |
| Signup → OTP → Profile setup | ~2s | no |

No transition ≥3s. **Perceived Load-Time Verdict: GOOD.**

## Cross-cutting findings (severity-ranked)

1. **HIGH — Legal documents are imported third-party boilerplate.** Terms of Service = Google Cloud Marketplace TOS; Privacy Policy = Walmart Global Marketplace Seller Privacy Notice; Liability Disclaimer = Amazon commercial-liability insurance text (all with "Last updated: 4/1/2026"). For a kids' marketplace used by parents, this is a legal/trust problem (parent reads an unrelated company's policy). Applies to A04 (and J-series). Recommend replacing with the app's own drafted policies.
2. **HIGH — `phone_verification_codes` schema drift breaks the already-verified path (B09) and pollutes OTP bookkeeping.** The `verified` column does not exist; `EditProfileScreen` and `requestPhoneVerification` query/insert it → errors every time → `alreadyVerified` always false and dev-bypass fallback always used. B09's "already verified" Info alert is unreachable.
3. **MODERATE-HIGH — Phone change via Edit Profile does not persist to the profile row.** After OTP verify, `auth-update-phone` updates `auth.users.phone` but NOT `profiles.phone`/`phone_verified_at` (DB-verified: auth=5559998888, profile=5551234001, verified_at=NULL). User still counts as phone-unverified for gating; profile display inconsistent.
4. **MODERATE — Profile stuck on "Loading profile…" after phone-verify redirect** (B03). Recovers only after navigating away/back.
5. **MODERATE — D04 empty-state / Initialize Settings is dead code.** Signup auto-creates all 5 pref rows (DB: created_at = signup time) and `getNotificationPreferences` self-heals via `initialize_user_preferences`; fresh user opened the screen and saw the full populated view. Guide expectation is obsolete.
6. **LOW-MOD — In-app dialogs are GlobalAlertProvider, not native `Alert.alert`** (A02/A03/B07/B10/C02 confirmed; guide Dependencies labels are doc drift — buttons are `global-alert-button-*`, fully instrumentable).
7. **LOW — A01 "Help & Support" drift is resolved in the Expected Result but the Locator-hints note is stale.** Settings renders exactly 11 rows (no Help & Support) matching the current Expected Result; the guide note claiming it "appears in Expected Result" is outdated wording.
8. **LOW — Locator gaps (pixel-scan required):** fullScreen OTP modal Verify/Cancel/Change-Phone buttons (B03) and PasswordReauthModal Cancel/Confirm buttons (C02) are not AX-exposed. Also the Verify button on the OTP modal frequently swallows the first tap (2-tap needed).
9. **LOW — Linked Accounts action buttons use `#4A7C59`** (design-system.md primary) instead of canonical passitup `#5DBB8E` — minor design-token inconsistency on that surface.

## App State Left Behind (needs cleanup)

- **test-buyer** (`49243010-…`): `auth.phone` + `profiles.phone` = **5551234001** (restored ✓); **bio = "QA test bio 0824"** (changed from "Rr" during B01 — restore via seed); **avatar_url = new avatar** `…-1787609347283.jpg` (changed during B04 — old avatar object remains in storage); `phone_verified_at` = NULL (unchanged); **subscription email notification toggle = ON** (changed during D01); quiet-hours = 22:00/08:00 unchanged in DB. Session cleared (logged out).
- **Fresh D04 throwaway** `qa.alice.17876099769423378@kidsmarketplace.test` (user `167abdc4-…`, name "D04 Test Parent", zip 06850, Norwalk Central) — 5 pref rows auto-created; logged out. Cleanup candidate.
- Simulator left logged-out on Landing.

## How to Verify / Reproduce

- Evidence: `e2e-test-results/account-file-groups-abcd-2026-08-24/screenshots/` (A01…D04 named PNGs) + this report.
- B03 persistence gap: change test-buyer phone → OTP 123456 → verify → query `auth.users.phone` vs `profiles.phone`/`phone_verified_at`.
- B09: set phone to current value → Save → "No Changes" (not the Info alert); source: `phone_verification_codes` has no `verified` column.
- D04: fresh signup → immediately query `notification_preferences` (5 rows exist before ever opening the screen) → open screen → full populated view, no empty state.
- Legal content: Settings → Terms of Service / Privacy Policy / Liability Disclaimer.

## QA Session Handoff

**Test Scope:** ACC-TC-A01–A05, B01–B10, C01–C04, D01–D04 (Account File, 23 cases)
**Design-System Compliance:** PASS (see per-screen confirmations below; one minor token deviation noted)
**Perceived Load-Time Verdict:** GOOD — no transition ≥3s; fastest ~0.5s (Settings→Payment Methods), slowest ~2s (signup→OTP); all within ideal UX threshold
**Design & Copy Compliance Confirmation:**
- CONFIRMED — SettingsScreen: wording + layout match design system (pill rows, destructive red for Danger Zone, 4px spacing scale)
- CONFIRMED — EditProfileScreen: locked-field labels, filled inputs, green pill Save; Contact Support alerts in-app
- CONFIRMED — PaymentMethodsScreen: secure-payments copy clear; Stripe framing appropriate
- CONFIRMED — LinkedAccountsScreen: info card + password/social rows; re-auth modal (outline Cancel + green Confirm) matches conventions
- CONFIRMED — NotificationPreferencesScreen: category cards + green toggles + quiet-hours card; footer "cannot be disabled" note clear
- DEVIATION — LinkedAccountsScreen: provider Link/Unlink buttons use `#4A7C59` (design-system.md green) rather than canonical passitup `#5DBB8E` (minor token inconsistency, same class as prior Phase 24 Discover findings)
- DEVIATION — Legal screens (TOS/Privacy/Liability): content is third-party boilerplate (see Critical Findings #1) — wording does not match a kids-marketplace service
- DEVIATION — B05 Profile subscription badge: shows "Kid's Club Member / Exclusive perks active" while DB is in a grace period (grace_ends_at 2026-09-12) — status-label nuance vs guide taxonomy
**Verdict Summary:** 16 PASS / 0 FAIL / 7 BLOCKED / 0 SKIPPED
**Critical Findings:** (1) Legal docs = imported Google/Walmart/Amazon boilerplate (HIGH); (2) `phone_verification_codes.verified` column missing → B09 path broken + OTP dev-bypass always used (HIGH); (3) phone change persists to auth user but not `profiles.phone`/`phone_verified_at` (MOD-HIGH); (4) Profile stuck-loader after phone-verify redirect (MOD); (5) D04 empty-state dead code — signup auto-creates prefs (MOD); (6) in-app dialogs are GlobalAlertProvider not native alerts (doc drift); (7) OTP-modal + re-auth-modal button locator gaps + Verify first-tap swallow (LOW)
**App State Left Behind:** test-buyer phone restored (5551234001); bio → "QA test bio 0824", avatar → new file, subscription-email toggle ON (all documented; seed restores); fresh D04 throwaway created; simulator logged out
**Why It Matters:** Groups A/B/C/D of the Account module are broadly functional (16/23 PASS, 0 FAIL). The run surfaces one high-severity legal-content gap, a real phone-persistence/schema-drift defect cluster in the Edit-Profile flow (B03/B09), and one obsolete spec expectation (D04) — plus confirms account-management dialogs are in-app (not native) as in prior runs.
**How to Verify/Reproduce:** See "How to Verify" above + screenshots.
**Known Gaps / Not Tested:** A03 rate-limit (10+/hr) & quiet-hours legs; B02 (feature not implemented — no email mutation attempted to protect persona); B04 uploading-state spinner (deferred upload path — success leg verified); C03 unlink execution (no linked provider on persona; C04 fixture Facebook identity intentionally not mutated); C04 email-mismatch completion; D02 forced-save-failure; D04 empty-state (unreachable).
**What Needs To Be Fixed Next:**
1. Fix: replace imported legal boilerplate with the app's own drafted TOS / Privacy Policy / Liability Disclaimer (A04/J-series) — content-owner task.
2. Fix: add the missing `verified` column to `phone_verification_codes` (or change app queries) so the already-verified detection works (B09) and OTP bookkeeping doesn't fall to dev-bypass (B03).
3. Fix: make phone-verification success sync `profiles.phone` + `phone_verified_at` (in `auth-update-phone` edge function or the app fallback) so the profile row and phone-gate reflect the verified number (B03).
4. Fix: Profile "Loading profile…" hang after phone-verify `navigation.reset` — investigate the focus/fetch race (B03).
5. Fix: update the D04 guide or remove the dead empty-state (signup auto-creates prefs + self-healing init) — doc decision.
6. Fix (AX): add accessible/role/label to the fullScreen OTP modal buttons (Verify/Cancel/Change Phone) and PasswordReauthModal Cancel/Confirm; investigate the OTP Verify first-tap swallow.
7. Fix: standardize Linked Accounts action buttons on canonical `#5DBB8E` (or document the `#4A7C59` exception).
**UX Enhancement Ideas (optional, not defects):** None this run — no friction or enhancement opportunities observed beyond what's already noted above.
**Suggested Next Session:** Group E (Delete Account, ACC-TC-E01–E03) + F (Suspended/Unsubscribe/Offline) with test-buyer, or the J-series legal-content re-verification once the legal fix lands.
**Suggested to Improve Agent Rules:** Note that the mobile-mcp AX-tree resource files contain the FULL tree (17KB+) though the inline tool output truncates at ~2k chars — extract specific elements with `grep -o '"name":"…"[^]]*'` on the resource file (used successfully for Switch/input coordinates this run). Also record that the expo-image-picker crop/confirm window WAS AX-drivable this session (photos exposed in grid, Choose tappable) — amending the §5.31 known-undrivable note to "build-dependent, verify per run".
