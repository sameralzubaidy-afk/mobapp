# Guide-Currency Audit — MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md

**Date:** 2026-09-02 · **Agent:** Guide-Currency Audit (read-only, Explore research) · **Scope:** Sections 2–4 of the Guide Currency Audit v2 task — **audit + classify only; NO guide rewrite performed.** A rewrite (if needed) becomes its own follow-up task.
**Guide audited:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (module MODULE-16-19-31; header "Last updated: 2026-05-30")
**Audit method:** READ-ONLY source audit of `p2p-kids-marketplace/src` (screens, `src/navigation/AppNavigator.tsx` route registry, `HomeTabNavigator.tsx`, supporting components/services). Every referenced screen/route/copy/testID checked for (1) file existence, (2) route registration, (3) at least one live `navigate()`/nav-row/deep-link caller, (4) string-level copy/testID match. Route registry truth = `AppNavigator.tsx` + `HomeTabNavigator.tsx`. No files written by the audit.

---

## Per-group / per-case audit

### Group A — Settings Hub (A01–A05)

| TC-IDs | Surface(s) | Existence + reachability | Verdict | Reason + evidence |
|---|---|---|---|---|
| A01 | `SettingsScreen`, route `Settings` | File ✅ · Registered ✅ · Reachable ✅ | **Current** | Reached from Profile "App Settings" row (`ProfileScreen.tsx:612`). Sections/rows exact (Notifications 3, Account 3, Legal 3, Danger Zone 2). **Caveat:** "Privacy & Security" row (`settings-privacy-security-button`) has an **empty `onPress` (TODO stub)** — renders but does nothing. |
| A02 | Sign Out | — | **Current** | Native `Alert.alert('Sign Out', 'Are you sure…', Cancel/Sign Out)` (`SettingsScreen.tsx:89-113`). |
| A03 | Test Push row | — | **Current** (real-push leg fixture-gated) | Alerts exactly `Rate Limited`/`Quiet Hours`/`Notification Queued`/`You must be logged in…` (L60–90). "Received push" leg needs push-capable device. |
| A04 | Legal rows | — | **Current** | Rows → `TermsOfService`/`PrivacyPolicy`/`LiabilityDisclaimer` (L175–190); Privacy & Security inert stub documented (true); "Help & Support" absent from Settings (true). |
| A05 | PaymentMethods | ✅ row `SettingsScreen.tsx:147` | **Current** | Row navigates to live `PaymentMethods` route. |

### Group B — Edit Profile (B01–B10)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| B01 | **Current** | `EditProfileScreen` route `EditProfile`, caller ProfileScreen `handleEditProfile` (L300). Canonical `ScreenLayout title="Edit Profile"` (L894) — **known "hand-rolled header" anchor is RESOLVED**. |
| B02 (email re-verification) | **Current** | **Known anchor "not implemented" is RESOLVED (implemented 2026-08-25).** `requestEmailChange`/`verifyEmailChangeCode`/`resendEmailChangeCode`; "Verify Your Email" modal; dev hint "the code is 123456 on staging" (L1066–1120). |
| B03 | **Current** | "Verify Your Phone" modal; 60s countdown; dev hint 123456 (L956–1040). |
| B04 | **Current** | `edit-profile-avatar-button` → upload spinner (L900–930). |
| B05 | **Current** | `ProfileScreen` route `Profile`; canonical `ScreenLayout title="My Profile"` (L380). Stats chips; promo cards = "Join Kid's Club"/"Kid's Club Member"/"Grace Period" (not explicit Trial/Canceled status badge — copy nuance). |
| B06 | **Current** | `Phone number must be 10 digits`, `Please enter a valid email address` (L320–326). |
| B07 | **Current** | `Alert('No Changes','No changes were made to your profile.')` (L514). |
| B08 | **N/A** (documented dead path) | ZIP `editable={false}` + helper `Zip codes are locked to your node.` (L1235–1244); no waitlist code on this screen — guide accurately documents it dead here. |
| B09 | **Current** | `Alert('Info','This phone number is already verified and active on your account.')` (L391). |
| B10 | **Current** | `?` icons → `navigate('ContactSupport')` (L288–293, L1140–1180); no raw support email on screen. |

### Group C — Linked Accounts (C01–C04) → **Current** (C-set-password stub noted)

`LinkedAccountsScreen` route `LinkedAccounts`, Settings row (L154). Account Email + Readonly badge; info card "You must keep at least one login method."; Password row ("Password ✓ set"/"No password set" + "Set Password" = **Coming Soon stub**); Google/Facebook/Apple rows `Linked • {email}`/`Not linked`; C02 `PasswordReauthModal` (`link-password-reauth`); C03 unlink confirm + last-method guard (`Cannot Unlink` …); C04 Email Mismatch alert. Guide does not exercise the Set-Password stub — fine, note it.

### Group D — Notification Preferences (D01–D04) → **Current**

`NotificationPreferencesScreen` route `NotificationPreferences`, Settings row (L127). `CATEGORY_LABELS` = Subscription & Membership / Swap Points Events / Badges & Achievements / Trades & Transactions / System Updates (L36–42) — exact. Per-category Push/In-App/Email toggles. D03 Quiet Hours + `Invalid time format` alert. D04 empty state "No preferences found" + Initialize — **caveat:** service auto-initializes on empty, so D04 may be hard to reach live.

### Group E — Delete Account / COPPA (E01–E03) → **Current** (destructive — disposable account)

`DeleteAccountScreen` route `DeleteAccount`, Settings Danger Zone row (L209). `ScreenLayout title="Delete Account"`, heading "Delete Account?", 5-item `CONSEQUENCES`. Password gate → wrong = `Alert('Incorrect password','The password you entered is wrong. Please try again.')` (minor copy diff from guide's single-line phrasing — title matches). Final confirm → RPC `request_account_deletion` → `logout()`.

### Group F — Suspended / Unsubscribe / Offline (F01–F04)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| F01 / F04 | **STALE** (copy/expected-result drift on F01; F04 logout leg current) | `SuspendedAccountScreen` shows 🚫 "Account Suspended" + **TWO actions**: "Contact Support" (`suspended-contact-support-button` → in-app ContactSupport) AND "Log Out" (`logout-button`) — **no support email text** (L34–57). Guide F01 expects "the support email and a single [Log Out] action" — both wrong. |
| F02 | **Current** (wording note) | `UnsubscribeScreen` deep-link `token` route param (linking config `unsubscribe`); no in-app caller (correct). **Recommend updating TC-F02 description wording from "email unsubscribe token" to "deep-link token".** |
| F03 | **Current** | `OfflineScreen` route `Offline`, live trigger `ConnectivityGate` → `navigate('Offline')`. "No Internet Connection" + `retry-button` "Try Again". |

### Group G — Home Dashboard (G01–G13)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| G01 | **Current** | Greeting `Good morning/afternoon/evening, {firstName}`; subBadge (Kids Club+ Trial/Active/Grace/Canceled/Free). |
| G02 | **STALE** (structure/priority changed) | No single grace>payment-fail>trial>draft cascade. `TrialReminderBanner` + `PaymentFailureBanner` render **independently above** (L436–437); grace/draft/ID CTAs in a collapsible **"Action Items"** list (max 2, L455–497). Draft buttons now **"Continue"/"Maybe later"** (`ResumeDraftBanner.tsx`), not "Continue listing"/"Dismiss". |
| G03 | **Current** | `QUICK_ACTIONS` Favorites/My Trades/My Listings/Payouts; `action-tile-{key}`. |
| G04 | **STALE** (states) | `IDVerificationCTABanner` renders only for `none`/`rejected` (L404); no "pending → Pending…" banner state. Copy: none → "Verify Your Identity"; rejected → "ID Verification Not Approved". |
| G05–G13 | **Current** | Recommendations + recent trade (color-coded status); pull-to-refresh (guard keeps old content); `action-items-show-all/…-less`; free/subscriber SP strip; "No session found"; "No active trades right now"; View Timeline; See All → Discover; Upgrade CTA (`dashboard-upgrade-kids-club-button`). |

### Group H — Help & Support / FAQ / Contact (H01–H07)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| H01 | **Current** (nav-step drift) | `HelpSupportMenuScreen` route `HelpSupport`, **live caller = Profile "Help & Support" row** (`ProfileScreen.tsx:639`) — **Settings has no Help row**, so the guide's "Open Help & Support (from Settings)" step is wrong; entry is from Profile. Fix the navigation step. |
| H02–H07 | **Current** | FAQ list = `support/HelpScreen.tsx` route `Support` (search/categories/"No results found"); FAQ offline fallback (`faqService.ts`); `FAQDetailScreen` route `FAQDetail` ("Was this helpful?" 👍/👎 → records + ContactSupport); `ContactSupportScreen` route `ContactSupport` (guest email/phone + honeypot; "Message Sent … within 24 hours"); no-raw-email sweep confirmed (all → ContactSupport incl. Suspended screen, My Subscription "Get Help"); guest links on Login/Signup. |

### Group I — Education & SP Calculator (I01–I05)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| I01–I04 | **Current** | Education Help = `help/HelpScreen.tsx` route `Help` (callers: menu "How to Earn SP" + SpWallet L233); `sp_definition` expanded by default; `?section=` param; footer → ContactSupport. **Caveat:** route `Help` is **not** in deep-link config (in-app param nav works; cold-start external deep link not wired). `SPCalculator` widget copy exact ("If You Sell"/"If You Buy"/bonus badge/price guard). |
| I05 | **Fixture-gated** | `help_view` + calculator events fire into DB; verification needs the admin education-analytics dashboard/logs. |

### Group J — Legal Screens (J01–J12)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| J01–J04, J06–J07, J09–J12 | **Current** | TOS (`TermsOfServiceScreen` route `TermsOfService`) / Privacy (`PrivacyPolicyScreen`) / Liability (`LiabilityDisclaimerScreen` route `LiabilityDisclaimer`) — all with acceptance-mode, version + "Last updated", error states "…not available". J06 signup agreement links live. J09–J11 perceptual (run on live screens). |
| J05 | **Fixture-gated** | `PolicyReacceptanceGate` re-prompts on launch when a new published policy isn't accepted — needs admin-publishing a new version in staging. |
| J08 | **STALE** (Retry claim) | Guide expects error + **[Retry]** on TOS/Privacy. Only `LiabilityDisclaimerScreen` has a `Retry` (L96); TOS/Privacy show inline "not available" text with **no Retry control** (`TermsOfServiceScreen.tsx:124`, `PrivacyPolicyScreen.tsx:125`). Update J08's expectation (or scope Retry to J04/J12). |

### Group K — Privacy & Security / MFA (K01–K04) → **DEAD**

**No MFA code anywhere in `src`** (regex `\bmfa\b|MFA|multi-factor|authenticator|factor…enroll` → 0 matches). "Privacy & Security" exists **only** as a Settings row whose `onPress` is an **empty TODO stub** (`SettingsScreen.tsx:158-164`); no PrivacySecurity/MFA screen file, no route, no factor UI. **None of K01–K04 is executable from the app UI.** The guide's A04 note (stub) is accurate, but Group K as written describes screens that don't exist → **drop or convert to a backend/Supabase-auth-MFA contract note pending UI work.**

### Group L — Error Recovery & Crash Reporting (L01–L04)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| L01–L03 | **Current** (dev/QA-build gated) | `ErrorBoundary` mounted on Settings + Profile; `QaCrashProbe` via `qa-dev-toggle` deep-link (dev/staging only). |
| L04 | **Fixture-gated** | `errorReporter.ts` lazy Sentry; no-op without `EXPO_PUBLIC_SENTRY_DSN`. |

### Regression (R01–R05)

| TC-IDs | Verdict | Reason + evidence |
|---|---|---|
| R01 | **Current** | Sign Out → unauth Landing. |
| R02 | **Current** | Edit-Profile optimistic patch persists via real DB write. |
| R03 | **Fixture-gated** | Needs real push for a disabled category. |
| R04 | **Current** | Legal rows live in Settings + Signup links. |
| R05 | **Fixture-gated** | Needs backend subscription-state change (cancel/grace). |

---

## Roll-up

**Counts (80 cases):**
- **Current:** 66 — A01–A05, B01–B07, B09–B10, C01–C04, D01–D04, E01–E03, F02–F04, G01, G03, G05–G13, H01–H07, I01–I04, J01–J04, J06–J07, J09–J12, L01–L03, R01, R02, R04.
- **Stale:** 4 — F01, G02, G04, J08.
- **Dead:** 4 — K01–K04 (MFA / Privacy & Security).
- **Fixture-gated / backend-only / N/A:** 6 — B08 (N/A documented dead path), I05, J05, L04, R03, R05.

**Top findings (exact file evidence):**
1. **Group K (MFA / Privacy & Security) is entirely Dead.** Zero MFA code in `src`; the only "Privacy & Security" artifact is an inert Settings row (`SettingsScreen.tsx:158-164`). Rewrite or drop K01–K04.
2. **F01 Suspended-account expected result is stale.** `SuspendedAccountScreen.tsx:34-57` shows TWO actions (in-app Contact Support + Log Out) and **no raw support email**. Guide's "support email + single Log Out" contradicts current code.
3. **G02 banner-priority semantics changed.** `UserDashboardScreen.tsx:436-497` renders Trial/PaymentFailure as independent top banners; grace/draft/ID CTAs in collapsible "Action Items" (max 2). Draft buttons are "Continue"/"Maybe later", not "Continue listing"/"Dismiss".
4. **G04 ID-CTA states narrowed** to `none`/`rejected` only — no "pending" banner.
5. **J08 "Retry" exists only on Liability** — not on TOS/Privacy.
6. **Help & Support entry moved** — Profile, not Settings (H01 nav step needs rewording).

**Re-verified anchors (do NOT assume still stale):** Edit-Profile header = canonical (RESOLVED); B02 email re-verification = implemented (RESOLVED); F02 deep-link-token wording (accurate, update description); Settings has no Help row (confirmed); Legal docs + acceptance gate all live.

**Screens with no live caller referenced by this guide:** **None** — every referenced surface has ≥1 live registration + caller. Notable file-tree notes: Privacy & Security has no screen file at all (only the dead Settings row); two same-named `HelpScreen.tsx` files are both live (education `help/HelpScreen.tsx` = route `Help`; FAQ `support/HelpScreen.tsx` = route `Support`) — easy to confuse.

**QA-round scoping recommendation:** Run A–E (disposable account for E), F02–F04, G01/G03/G05–G13, H, I01–I04, J01–J04/J06/J07/J09–J12, L01–L03 as written. **Rewrite before running:** F01, G02, G04, J08 (+ H01 nav step). **Do not run Group K as written** (Dead — deprecate-or-keep decision needed). Treat B08/I05/J05/L04/R03/R05 as fixture-gated.
