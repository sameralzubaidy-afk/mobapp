# MODULE-16-19-31 Account · Home Dashboard · Help & Education · Legal — Manual Testing Guide

**Source of truth:** `docs/flow-registry.md` (FLOW-02 Profiles/Onboarding · FLOW-16 Home Dashboard · FLOW-19 Trading Education / Help & Support / SP Calculator · FLOW-21 Error Recovery & Crash Reporting · FLOW-24 MFA / Multi-Factor Enrollment & Assurance Level · FLOW-EDU-001 Education Analytics · FLOW-31 TOS · FLOW-32 Privacy Policy · FLOW-33 Liability Disclaimer · COPPA account deletion)
**Tasks covered:** Account Management (settings, edit profile, linked accounts, notification preferences, delete account, suspended, unsubscribe, offline, MFA / privacy & security) · Home Dashboard · Help / Education / SP Calculator (FAQ, contact support, education sections, calculator) · Legal screens (TOS, Privacy, Liability) · App-wide error recovery fallback behavior
**Last updated:** 2026-05-30
**Scope:** End-user manual testing via app screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Settings Hub** | ACC-TC-A01 | Settings screen sections + rows render |
| | ACC-TC-A02 | Sign Out confirmation |
| | ACC-TC-A03 | Test Push Notification (rate limit / quiet hours / queued) |
| | ACC-TC-A04 | Settings → legal & help links navigate |
| | ACC-TC-A05 | "Manage Payment Methods" row navigates |
| **B — Edit Profile** | ACC-TC-B01 | Edit profile fields load + save (optimistic) |
| | ACC-TC-B02 | Email change requires re-verification |
| | ACC-TC-B03 | Phone change → OTP verification modal |
| | ACC-TC-B04 | Avatar upload |
| | ACC-TC-B05 | Profile screen stats, badges, reviews, status badge |
| | ACC-TC-B06 | Form validation (phone 10-digit, email format) |
| | ACC-TC-B07 | "No Changes" alert |
| | ACC-TC-B08 | Waitlist prompt (unreachable from Edit Profile — flag) |
| | ACC-TC-B09 | "Already verified" phone path |
| | ACC-TC-B10 | Locked-field "cannot be changed" alerts |
| **C — Linked Accounts** | ACC-TC-C01 | Linked accounts list (email readonly, password, social) |
| | ACC-TC-C02 | Link a social provider (password re-auth gate) |
| | ACC-TC-C03 | Unlink provider (confirmation + last-method guard) |
| | ACC-TC-C04 | Email mismatch on link blocked |
| **D — Notification Preferences** | ACC-TC-D01 | Five categories × three channel toggles |
| | ACC-TC-D02 | Optimistic toggle reverts on failure |
| | ACC-TC-D03 | Quiet hours toggle + time validation |
| | ACC-TC-D04 | Empty state → Initialize Settings |
| **E — Delete Account (COPPA)** | ACC-TC-E01 | Delete account consequences + password gate |
| | ACC-TC-E02 | Wrong password blocked |
| | ACC-TC-E03 | Two-step confirmation → deletion + logout |
| **F — Suspended / Unsubscribe / Offline** | ACC-TC-F01 | Suspended account screen (logout only) |
| | ACC-TC-F02 | Unsubscribe via email token (success/error) |
| | ACC-TC-F03 | Offline screen + Try Again |
| | ACC-TC-F04 | Suspended account — Log Out tap |
| **G — Home Dashboard** | ACC-TC-G01 | Greeting + subscription badge + SP balance |
| | ACC-TC-G02 | Priority banners (grace > payment fail > trial > draft) |
| | ACC-TC-G03 | Quick action tiles route correctly |
| | ACC-TC-G04 | ID verification CTA banner (dismissible) |
| | ACC-TC-G05 | Recommendations + recent trade card |
| | ACC-TC-G06 | Pull-to-refresh reloads dashboard |
| | ACC-TC-G07 | "Show more actions" toggle |
| | ACC-TC-G08 | Free-user "Unlock Swap Points" strip |
| | ACC-TC-G09 | "No session found" state |
| | ACC-TC-G10 | Empty-trade state |
| | ACC-TC-G11 | "View Timeline" nav |
| | ACC-TC-G12 | "See All" → Discover nav |
| | ACC-TC-G13 | Subscription-card Upgrade button |
| **H — Help & Support Menu** | ACC-TC-H01 | Help & Support menu (3 cards) routes |
| | ACC-TC-H02 | FAQ list — search + category filter |
| | ACC-TC-H03 | FAQ fallback when offline |
| | ACC-TC-H04 | FAQ detail — helpful vote (Yes/No) |
| | ACC-TC-H05 | Contact Support form (auth gate + validation) |
| **I — Education & SP Calculator** | ACC-TC-I01 | Education Help screen sections (accordion + deep link) |
| | ACC-TC-I02 | SP Calculator (free mode) sell/buy outputs |
| | ACC-TC-I03 | SP Calculator bonus category badge |
| | ACC-TC-I04 | SP Calculator validation (price range) |
| | ACC-TC-I05 | Education analytics events fire |
| **J — Legal Screens** | ACC-TC-J01 | Terms of Service view + last updated |
| | ACC-TC-J02 | TOS acceptance flow (requireAcceptance) |
| | ACC-TC-J03 | Privacy Policy view + acceptance |
| | ACC-TC-J04 | Liability Disclaimer view (read-only + retry) |
| | ACC-TC-J05 | Policy versioning — re-acceptance on new version |
| | ACC-TC-J06 | Signup implies TOS + Privacy agreement (no mandatory dialog) |
| | ACC-TC-J07 | Legal screen unavailable state (no published policy) |
| | ACC-TC-J08 | Legal screen load failure — error + Retry |
| | ACC-TC-J09 | Very long policy content renders + scrolls smoothly |
| | ACC-TC-J10 | Legal screens render consistently on iOS and Android |
| | ACC-TC-J11 | Legal screen loads < 2s and scrolls without lag |
| | ACC-TC-J12 | Liability Disclaimer unavailable state |
| **K — Privacy & Security / MFA** | ACC-TC-K01 | MFA factors list + enrollment entry points |
| | ACC-TC-K02 | Enroll and verify an authenticator factor |
| | ACC-TC-K03 | Protected action prompts MFA challenge + invalid code handling |
| | ACC-TC-K04 | Recovery path and remove verified factor |
| **L — Error Recovery & Crash Reporting** | ACC-TC-L01 | Render-time error shows fallback instead of red/white screen |
| | ACC-TC-L02 | Try Again recovers after transient error |
| | ACC-TC-L03 | Persistent error stays contained to fallback |
| | ACC-TC-L04 | Error reporting is safe with and without telemetry |

---

## Pre-conditions (set up before testing)

- App is running on iOS Simulator and/or Android Emulator.
- The following test accounts exist and are confirmed (see Accounts table).
- test-buyer has a profile with avatar, at least one listing, completed trades, earned badges, and at least one received review.
- Published education sections (including `sp_definition`) and published FAQs exist; a published TOS, Privacy Policy, and Liability Disclaimer exist with known "last updated" dates.
- A suspended account and a valid unsubscribe token (from a notification email) are available.
- test-buyer has at least one linked social provider and a password set (for linked-accounts cases).
- For MFA tests: a user account exists with access to an authenticator app or test OTP receiver, plus a fresh recovery code set if the environment supports backup codes.
- For error-recovery tests: a QA/dev build is available with a reproducible screen-level test error or toggle, and access to the Sentry project or captured device logs when telemetry verification is required.

## Accounts for testing

| Role | Email | Subscription | Notes |
|---|---|---|---|
| Subscriber | test-buyer@kidsmarketplace.test | Kids Club+ Active | Full profile, badges, reviews |
| Trial user | test-trial@kidsmarketplace.test | Kids Club+ Trial | Dashboard trial-reminder banner |
| Grace user | test-grace@kidsmarketplace.test | Grace period | Dashboard grace banner |
| Free | test-free@kidsmarketplace.test | None | Help/FAQ, legal, contact support |
| Suspended | test-suspended@kidsmarketplace.test | — | Suspended account screen |
| Admin | test-admin@kidsmarketplace.test | — | Publish/update policies & education content |

> Some banners and notifications are time/state driven (trial reminder, grace, payment failure). QA may need to fast-forward the clock or set the relevant subscription state in the test environment.

---

## Group A — Settings Hub

### ACC-TC-A01 · Settings screen sections + rows render

**Ref:** FLOW-02 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify the Settings screen shows all sections and rows.

**Steps:**
1. As **test-buyer**, open **Settings**.

**Expected Result:**
- Header "Settings".
- Notifications section: "Enable Push Notifications", "Notification Preferences", "Test Push Notification".
- Account section: "Manage Payment Methods", "Linked Accounts", "Privacy & Security".
- Legal section: "Terms of Service", "Privacy Policy", "Liability Disclaimer".
- Danger Zone: "Sign Out", "Delete Account".

**Setup:**
- Logged in as **test-buyer** (any tier). No other state required — Settings renders for all account states, so `Actors` already captures the precondition; kept brief per pilot rule.

**Locator hints:**
- Scroll container: `testID="settings-scroll"` (`src/screens/profile/SettingsScreen.tsx`).
- Section containers: `testID="settings-section-notifications"` / `settings-section-account` / `settings-section-legal` / `settings-section-danger-zone`.
- Rows (each `accessibilityRole="button"`): Enable Push Notifications → `settings-enable-notifications-button` · Notification Preferences → `settings-notification-preferences-button` · Test Push Notification → `settings-test-push-notification-button` · Manage Payment Methods → `settings-payment-methods-button` · Linked Accounts → `settings-linked-accounts-button` · Privacy & Security → `settings-privacy-security-button` · Terms of Service → `settings-tos-button` · Privacy Policy → `settings-privacy-policy-button` · Liability Disclaimer → `settings-liability-disclaimer-button` · Sign Out → `settings-sign-out-button` · Delete Account → `settings-delete-account-button`.
- **"Help & Support" → NO TESTID FOUND — recommend adding; the row is also absent from the current row config (Account section has only 3 rows: Payment Methods, Linked Accounts, Privacy & Security), so listing it in Expected Result is a spec/code drift.** (`SettingsScreen.tsx`)
- Header "Settings" is rendered by `<ScreenLayout title="Settings">` — no dedicated header testID; assert by visible text.

**Assert:**
1. 4 section headers render: "Notifications", "Account", "Legal", "Danger Zone" (via the `settings-section-*` containers).
2. All 11 rows render with their labels (see locators); "Help & Support" is **not** present in current code.
3. Tapping a row fires its `onPress` (navigation or alert) without error.

**Dependencies:**
- None. Pure render check — deterministic; no timers, network, or third-party calls.

---

### ACC-TC-A02 · Sign Out confirmation

**Ref:** FLOW-02 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify Sign Out requires confirmation.

**Steps:**
1. On Settings, tap **Sign Out** and review the alert; cancel, then repeat and confirm.

**Expected Result:**
- An "Are you sure you want to sign out?" alert appears. Cancel keeps the session; confirm logs the user out to the login/landing screen.

**Locator hints:**
- Sign Out confirmation is a native `Alert.alert` — dialog locator: N/A — see Dependencies.

**Dependencies:**
- Native `Alert.alert` ('Sign Out' title) — match 'Cancel' / 'Sign Out' buttons by text via Detox (`by.text('Sign Out')`) / Appium; assert by title and that cancel keeps the session.

---

### ACC-TC-A03 · Test Push Notification (rate limit / quiet hours / queued)

**Ref:** FLOW-17 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify the Test Push action and its guard alerts.

**Steps:**
1. On Settings, tap **Test Push Notification** (observe loading spinner).
2. Repeat 10+ times within an hour; also test during quiet hours.

**Expected Result:**
- Normal: a "Notification Queued" result and a received test push.
- After 10+ in an hour: a "Rate Limited" alert.
- During quiet hours: a "Quiet Hours" alert.
- If not logged in: "You must be logged in".

---

### ACC-TC-A04 · Settings → legal & help links navigate

**Ref:** FLOW-31/32/33 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify legal and help rows route to the right screens.

**Steps:**
1. From Settings, tap Terms of Service, Privacy Policy, Liability Disclaimer, Linked Accounts, Notification Preferences (back each time).

> **Note (2026-08-13):** "Help & Support" was removed from this step — no such row exists in the current `SettingsScreen` row config (Legal section has only Terms of Service, Privacy Policy, Liability Disclaimer). Same spec drift documented in ACC-TC-A01's locator hints.

**Expected Result:**
- Each opens its respective screen; "Privacy & Security" is a known not-yet-implemented stub.
- Back-navigation returns correctly for every legal/help row; signup form data is preserved after back-navigation from a legal screen.

### ACC-TC-A05 · "Manage Payment Methods" row navigates

**Ref:** FLOW-02 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify the Manage Payment Methods row opens the Payment Methods screen.

**Steps:**
1. Open **Settings** and tap **Manage Payment Methods** (Account section).

**Expected Result:**
- Navigates to the **Payment Methods** screen (route `PaymentMethods` → `PaymentMethodsScreen`).
- **Note:** the row is already listed in ACC-TC-A01's expected Account section; this case verifies the navigation itself.

---

## Group B — Edit Profile

### ACC-TC-B01 · Edit profile fields load + save (optimistic)

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify profile fields load and save with optimistic update.

**Steps:**
1. From Profile, tap **Edit**; change the editable fields (Bio, email, phone) and save.

**Expected Result:**
- Fields prefill from the profile (display name, DOB, email, zip, bio, phone, avatar).
- Display Name, Date of Birth, and Zip Code are **not editable** — the fields are locked (`editable=false`) with labels like "FULL NAME (CANNOT BE CHANGED)" / "ZIP CODE (CANNOT BE CHANGED)" and the zip helper "Zip codes are locked to your node." Only Bio, email, and phone are editable.
- After save, the screen returns to Profile and the new values appear immediately (optimistic patch) without a flash of stale data.

**Setup:**
- Logged in as **test-buyer** with a **complete profile** (display name, DOB, zip, email, phone, bio set) so the Edit screen has prefilled values to assert against. A seeded complete profile is required.

**Locator hints:**
- "Edit basic info" entry (ProfileScreen): `testID="avatar-upload-button"` (name is misleading — this is the Edit link) (`src/screens/profile/ProfileScreen.tsx`).
- Locked Display Name: label "FULL NAME (CANNOT BE CHANGED)" + support icon `accessibilityLabel="Contact support to change full name"` — field has **no** testID.
- Locked DOB: label "DATE OF BIRTH (CANNOT BE CHANGED)" + support icon `accessibilityLabel="Contact support to change date of birth"` — field has **no** testID.
- Locked Zip: label "ZIP CODE (CANNOT BE CHANGED)" + helper "Zip codes are locked to your node." — **no** testID.
- Email field: TextInput placeholder "Enter your email" — `testID="edit-profile-email-input"` (`src/screens/profile/EditProfileScreen.tsx`).
- Phone field: TextInput placeholder "(XXX) XXX-XXXX" — `testID="edit-profile-phone-input"`.
- Bio field: TextInput placeholder "Tell us a bit about yourself..." — `testID="edit-profile-bio-input"`.
- Save button: TouchableOpacity text "Save Changes" — `testID="edit-profile-save-button"` (`accessible` + `accessibilityRole="button"` + `accessibilityLabel="Save Changes"`).
- Avatar picker (photo upload on Edit Profile): `testID="edit-profile-avatar-button"` (`accessible` + `accessibilityRole="button"` + `accessibilityLabel="Change profile photo"`).
- ⚠️ `avatar-upload-button` naming note (2026-08-13): the pre-existing `avatar-upload-button` lives on `ProfileScreen.tsx` (the "Edit basic info" link) and `ProfileSetupScreen.tsx` (the avatar upload). It is **NOT renamed** here — it is load-bearing in `detox/tests/42-edit-profile.e2e.ts` and `ProfileSetupScreen.test.tsx`, and `EditProfileScreen.tsx` never carried it (that was the pilot's mismatch). The correctly-named identifier for the actual upload control on Edit Profile is the new `edit-profile-avatar-button` above.

**Assert:**
1. Display Name / DOB / Zip inputs render `editable=false` with the "(CANNOT BE CHANGED)" labels + the zip helper "Zip codes are locked to your node.".
2. Email / Phone / Bio prefill the current profile values and accept new text.
3. After Save, the screen returns to Profile and shows the updated values immediately (optimistic patch, no stale flash).

**Dependencies:**
- Network: Save calls `supabase.auth.updateUser` + profile update (no Stripe/3rd-party). Deterministic given the seeded profile; default fetch timeouts suffice (no fixed wait needed).

---

### ACC-TC-B02 · Email change requires re-verification

> ✅ **IMPLEMENTED (2026-08-25, Dev Task B02, Option A — 6-digit code):** Changing the
> email on Edit Profile no longer applies immediately. It mints a pending
> `email_change_verifications` row, emails a 6-digit code to the NEW address via the
> `send-email` function (`change_email` type), and opens an in-app "Verify Your Email"
> modal (same UX as the phone OTP modal). The OLD email stays active on `auth.users` +
> `profiles` until the code is verified; only then does the `auth-email-change` Edge
> Function apply the new email (via `auth.admin.updateUserById`) and sync `profiles.email`.
> If the user never confirms, the request expires after 24h and the old email stays active.

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify changing email triggers verification and that the old email stays active until confirmed.

**Steps:**
1. On Edit Profile, change the email to a new address (e.g. `test-buyer+new@kidsmarketplace.test`) and tap **Save Changes**.
2. The **"Verify Your Email"** modal appears with the new address and a 6-digit code field.
3. Enter the code (on staging, use **`123456`** — `DEV_EMAIL_CODE_FIXED=true` is set for QA) and tap **Verify**.

**Expected Result:**
- After Save, the modal opens with "We sent a 6-digit code to {new email}"; the profile is NOT updated yet and no navigation happens until verified.
- After a valid code, the app navigates to **Profile** showing the new email. `auth.users.email` and `profiles.email` both reflect the new address (DB-close: check `auth.users` + `profiles`).
- **Cancel** (or closing the modal) leaves the old email fully active — no change to `auth.users.email` / `profiles.email`.
- The emailed code contains the 6 digits in a "Verify your new email" message; a code cannot be replayed after success (`email_change_verifications.used_at` set).

**Setup:**
- Requires the B02 feature (migration `20260825000001_email_change_verification.sql` + `auth-email-change` Edge Function + `send-email` `change_email` type deployed). The old email (`test-buyer@…`) must remain valid for the login used.

**Locator hints:**
- Email field: TextInput placeholder "Enter your email" — `testID="edit-profile-email-input"` (`EditProfileScreen.tsx`).
- Save button: "Save Changes" — `testID="edit-profile-save-button"`.
- Email OTP field: `testID="edit-profile-email-otp-input"`.
- Verify button: `testID="edit-profile-email-verify-button"` (`accessible` + `accessibilityRole="button"`).

**Assert:**
1. Changing the email opens the "Verify Your Email" modal and does NOT apply the change immediately (no `supabase.auth.updateUser` direct call; profile email unchanged until verified).
2. Wrong code → friendly in-app error ("That code didn't match. Check it and try again.").
3. Valid code (`123456` on staging) → navigates to Profile with the new email; `auth.users.email` + `profiles.email` updated.
4. Cancel → old email still active; `email_change_verifications` still pending (unverified) or expires.

**Dependencies:**
- Backend: `auth-email-change` Edge Function (request/verify/resend), `email_change_verifications` table + RPCs, `send-email` `change_email` type. Network call on Save (no Stripe/3rd-party). On staging the code is fixed to `123456` (dev gate) so no real email read is required; the email is still sent (SendGrid) and tracked in `email_logs`.

---

### ACC-TC-B03 · Phone change → OTP verification modal

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify the phone verification modal flow.

**Steps:**
1. On Edit Profile, change the phone number and save.
2. In the OTP modal, request resend (observe countdown), then enter the code.

**Expected Result:**
- The phone normalizes to digits; an OTP modal appears with a resend button + countdown and a verifying state; a valid code marks the phone verified.

**Locator hints:**
- Phone field: TextInput placeholder "(XXX) XXX-XXXX" — `testID="edit-profile-phone-input"` (`EditProfileScreen.tsx`).
- Save button: "Save Changes" — `testID="edit-profile-save-button"`.
- Phone OTP field: `testID="edit-profile-phone-otp-input"`.
- Verify button: `testID="edit-profile-phone-verify-button"` (`accessible` + `accessibilityRole="button"`).
- Resend: `testID="edit-profile-phone-resend-button"` (rendered only after the 60s countdown expires).

**Assert:**
1. Changing the phone and saving opens the "Verify Your Phone" modal and does NOT apply the phone immediately (no `auth.users.phone` change until verified).
2. The resend area shows a 60s countdown; Resend re-sends once the countdown expires.
3. Wrong code → friendly in-app error in the modal (e.g. "Invalid code", or "Code expired. Please request a new one."); modal stays open.
4. Valid code (`123456` on staging — dev bypass) → navigates to Profile; `auth.users.phone` + `profiles.phone_verified_at`/`phone_verified` updated.

**Dependencies:**
- Backend (all deployed + DB-verified): `send-phone-otp` Edge Function (Twilio SMS + rate limits + bcrypt via `hash_otp_code`), `verify_otp_code` RPC, `auth-update-phone` Edge Function (persists `auth.users.phone`), `updateUserProfile({ phone })`. Network call on Save/Verify (no Stripe/3rd-party). On staging, the dev bypass (`123456`) is active in dev builds, so no real SMS read is required; the SMS is still sent (Twilio) when the function succeeds.

---

### ACC-TC-B04 · Avatar upload

**Ref:** FLOW-05 media · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify avatar upload.

**Steps:**
1. On Edit Profile, tap the Camera icon and pick an image.

**Expected Result:**
- An uploading state shows; on success the new avatar renders (resolving storage path vs full URL).

---

### ACC-TC-B05 · Profile screen stats, badges, reviews, status badge

**Ref:** FLOW-02 · ProfileScreen
**Actors:** test-buyer

**Objective:** Verify the Profile screen display sections.

**Steps:**
1. Open **Profile**.

**Expected Result:**
- Header with avatar + display name + Edit (pencil).
- Stats cards: listings, trades, SP balance.
- Subscription status badge correct for the account (Trial/Active/Grace/Canceled/Free).
- ID verification status, referral code (if any), reviews section (with "Show All"), and badge showcase render.
- A brief "profile saved" banner appears after returning from Edit Profile.

### ACC-TC-B06 · Form validation (phone 10-digit, email format)

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify inline validation for the editable email and phone fields.

**Steps:**
1. On **Edit Profile**, enter an invalid email (e.g., `abc`) and tap **Save Changes**.
2. Enter a phone number shorter than 10 digits and tap **Save Changes**.
3. Enter a valid email and a 10-digit phone.

**Expected Result:**
- Invalid email → inline `Please enter a valid email address` under Email.
- Short phone → inline `Phone number must be 10 digits` under Phone.
- Valid values clear the errors and save proceeds.
- **Flag:** the `Zip code must be 5 digits` validator exists but the ZIP field is locked (`editable={false}`), so that validation is unreachable from this screen.

### ACC-TC-B07 · "No Changes" alert

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify saving with no changes shows the No Changes alert.

**Steps:**
1. Open **Edit Profile**, make no changes, and tap **Save Changes**.

**Expected Result:**
- Alert **No Changes** reads `No changes were made to your profile.`; tapping **OK** returns to Profile.

**Locator hints:**
- "No Changes" alert is a native `Alert.alert` — dialog locator: N/A — see Dependencies.

**Dependencies:**
- Native `Alert.alert` ('No Changes' title) — match 'OK' by text via Detox (`by.text('OK')`) / Appium; assert by title and that OK returns to Profile.

### ACC-TC-B08 · Waitlist prompt (unreachable from Edit Profile — flag)

**Ref:** FLOW-02 · EditProfileScreen · `updateUserProfile.needsWaitlist`
**Actors:** test-buyer

**Objective:** Document the waitlist-prompt code path and its current reachability.

**Steps:**
1. On **Edit Profile**, attempt to change the ZIP code.

**Expected Result:**
- The ZIP field renders **ZIP CODE (CANNOT BE CHANGED)** with `editable={false}` and the helper `Zip codes are locked to your node.` — it cannot be edited.
- Because ZIP cannot change, the `needsWaitlist` path (alert **Area Not Yet Available** / `We're not live in your area ({zip}) yet! Would you like to join the waitlist to be notified when we launch?` → **Join Waitlist** → `Added to Waitlist!` / `We'll notify you when we launch.`) never fires from this screen.
- **Flag:** this is effectively dead code on this screen; the waitlist prompt is more likely exercised from onboarding/signup where ZIP is first entered.

### ACC-TC-B09 · "Already verified" phone path

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify the no-OTP path when the entered phone is already verified.

**Steps:**
1. On **Edit Profile**, change the phone to a number that is already verified on the account, then save.

**Expected Result:**
- Alert **Info** reads `This phone number is already verified and active on your account.`
- No **Verify Your Phone** modal appears; the phone is saved without re-verification.

### ACC-TC-B10 · Locked-field "cannot be changed" + contact-support affordances

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify the locked-field labels and that the contact-support affordances route to the in-app Contact Support form (no email/Alert).

**Steps:**
1. Tap the **Question** icon next to **FULL NAME (CANNOT BE CHANGED)**.
2. Tap the **Question** icon next to **DATE OF BIRTH (CANNOT BE CHANGED)**.
3. Observe the ZIP field.

**Expected Result:**
- Tapping either **Question** icon navigates to the **Contact Support** screen (the in-app support form) — NOT an Alert, and no support email is shown anywhere.
- Full Name and Date of Birth inputs are disabled (`editable={false}`).
- ZIP renders **ZIP CODE (CANNOT BE CHANGED)** with the helper `Zip codes are locked to your node.` (no Question icon).
- No raw support-email address appears on Edit Profile.

**Locator hints:**
- Question icons: `accessibilityLabel="Contact support to change full name"` / `"Contact support to change date of birth"`.
- After tapping, assert the Contact Support screen header title "Contact Support" and the `subject-input`/`send-message-button` testIDs.

**Dependencies:**
- Unified support flow (D1–D2, 2026-08-26): support affordances navigate to `ContactSupport`; the Contact Support form is reachable logged-in and logged-out.

---

## Group C — Linked Accounts

### ACC-TC-C01 · Linked accounts list (email readonly, password, social)

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer

**Objective:** Verify the linked-accounts layout.

**Steps:**
1. Open Settings → **Linked Accounts**.

**Expected Result:**
- Account Email row (readonly badge), an info card about keeping ≥1 login method, a Password row ("Password ✓ set" or "No password set" + "Set Password"), and Google/Facebook/Apple rows each showing "Linked • {email}" or "Not linked" with a Link/Unlink button.

---

### ACC-TC-C02 · Link a social provider (password re-auth gate)

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer (has password)

**Objective:** Verify linking requires re-auth and starts OAuth.

**Steps:**
1. On a "Not linked" provider, tap **Link**.

**Expected Result:**
- Because the user has a password, a password re-auth modal appears first; after re-auth the OAuth flow starts (in test it shows the simulated provider message).

---

### ACC-TC-C03 · Unlink provider (confirmation + last-method guard)

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer

**Objective:** Verify unlink confirmation and the last-method guard.

**Steps:**
1. On a linked provider, tap **Unlink** and confirm.
2. Attempt to unlink the only remaining login method.

**Expected Result:**
- Unlink shows a confirmation ("…you can always link it again later"); confirming unlinks.
- Attempting to remove the last login method is blocked: "You must keep at least one login method. Add another method first."

**Locator hints:**
- Unlink confirmation / last-method guard / success alerts are native `Alert.alert` — dialog locator: N/A — see Dependencies.

**Dependencies:**
- Native `Alert.alert` ('Unlink Account' / 'Cannot Unlink' / 'Success' titles) — match 'Cancel' / 'Unlink' by text via Detox (`by.text('Unlink')`) / Appium; assert by title and the last-method guard message.

---

### ACC-TC-C04 · Email mismatch on link blocked

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer

**Objective:** Verify a mismatched provider email is rejected.

**Steps:**
1. Attempt to link a provider account whose email differs from the account email.

**Expected Result:**
- An error states the provider email doesn't match and the link is not created.

---

## Group D — Notification Preferences

### ACC-TC-D01 · Five categories × three channel toggles

**Ref:** FLOW-17 · NotificationPreferencesScreen
**Actors:** test-buyer

**Objective:** Verify all categories and channel toggles render and persist.

**Steps:**
1. Open Settings → **Notification Preferences**.
2. Toggle Push/In-App/Email for each category.

**Expected Result:**
- Categories: Subscription & Membership, Swap Points Events, Badges & Achievements, Trades & Transactions, System Updates.
- Each has Push, In-App, and Email toggles that persist across reloads.

---

### ACC-TC-D02 · Optimistic toggle reverts on failure

**Ref:** FLOW-17 · NotificationPreferencesScreen
**Actors:** test-buyer

**Objective:** Verify a failed update reverts the toggle.

**Steps:**
1. Force a save failure (e.g., offline) and flip a toggle.

**Expected Result:**
- The toggle updates immediately, then reverts with an error alert when the save fails.

---

### ACC-TC-D03 · Quiet hours toggle + time validation

**Ref:** FLOW-17 · NotificationPreferencesScreen
**Actors:** test-buyer

**Objective:** Verify quiet hours (subscription category) and time format validation.

**Steps:**
1. Enable Quiet Hours; set start "22:00" and end "08:00"; save.
2. Enter an invalid time (e.g., "9pm") and save.

**Expected Result:**
- Valid 24-hour times save with a "Quiet hours have been updated." confirmation.
- Invalid format shows "Invalid time format. Please use 24-hour format: HH:MM (example: 22:00)."

---

### ACC-TC-D04 · Empty state → Initialize Settings

**Ref:** FLOW-17 · NotificationPreferencesScreen
**Actors:** A user with no preferences yet

**Objective:** Verify the empty/initialize state.

**Steps:**
1. Open Notification Preferences for a user with no rows.

**Expected Result:**
- A "No preferences found" empty state with an **[Initialize Settings]** button that creates defaults.

---

## Group E — Delete Account (COPPA)

### ACC-TC-E01 · Delete account consequences + password gate

**Ref:** COPPA / FLOW-21 error recovery · DeleteAccountScreen
**Actors:** A disposable test account

**Objective:** Verify the delete screen warnings and password requirement.

**Steps:**
1. Open Settings → **Delete Account**.

**Expected Result:**
- "Delete Account?" with the five consequences (profile/listings deleted, active trades cancelled, SP forfeited, subscription cancelled, cannot be undone) and a required password field.

---

### ACC-TC-E02 · Wrong password blocked

**Ref:** DeleteAccountScreen
**Actors:** A disposable test account

**Objective:** Verify wrong password is rejected.

**Steps:**
1. Enter an incorrect password and tap **[Delete My Account]**.

**Expected Result:**
- "Incorrect password. Please try again." (or re-auth failure) — no deletion occurs.

---

### ACC-TC-E03 · Two-step confirmation → deletion + logout

**Ref:** DeleteAccountScreen
**Actors:** A disposable test account

**Objective:** Verify successful deletion and auto-logout.

**Steps:**
1. Enter the correct password, tap **[Delete My Account]**, and confirm the final "This cannot be undone." alert.

**Expected Result:**
- The account deletion RPC runs (profile marked self-deleted, SP wallet frozen, audit log written) and the user is logged out automatically.

**Locator hints:**
- Final "This cannot be undone." confirmation is a native `Alert.alert` — dialog locator: N/A — see Dependencies.

**Dependencies:**
- Native `Alert.alert` ('Delete Account' title) — match 'Cancel' / 'Delete' by text via Detox (`by.text('Delete')`) / Appium; assert by title and that deletion logs the user out.

---

## Group F — Suspended / Unsubscribe / Offline

### ACC-TC-F01 · Suspended account screen (logout only)

**Ref:** FLOW-34 / FLOW-02 · SuspendedAccountScreen
**Actors:** test-suspended

**Objective:** Verify the suspended-account gate.

**Steps:**
1. Log in as **test-suspended**.

**Expected Result:**
- A 🚫 "Account Suspended" screen with the support email and a single **[Log Out]** action; the rest of the app is inaccessible.

---

### ACC-TC-F02 · Unsubscribe via email token (success/error)

> ⚠️ **Needs re-verification (2026-08-12):** The unsubscribe flow uses a deep-link token as a route param rather than "email token" terminology — verify the description wording.

**Ref:** FLOW-17 · UnsubscribeScreen
**Actors:** test-buyer (via email link)

**Objective:** Verify the email-unsubscribe deep link.

**Steps:**
1. Open the app via a valid unsubscribe deep link (token).
2. Open it again with an invalid/expired token.

**Expected Result:**
- Valid: a processing state then "You've Been Unsubscribed" with the category and a **[Go to Home]** button.
- Invalid: "Unable to Unsubscribe" with the error and **[Go to Home]**.

---

### ACC-TC-F03 · Offline screen + Try Again

**Ref:** FLOW-21 error recovery · OfflineScreen
**Actors:** Any user

**Objective:** Verify the offline state and retry.

**Steps:**
1. Disable connectivity to trigger the offline screen, then re-enable and tap **[Try Again]**.

**Expected Result:**
- "No Internet Connection" with a WifiX icon and **[Try Again]** that retries/returns once connectivity is restored.

### ACC-TC-F04 · Suspended account — Log Out tap

**Ref:** FLOW-34 / FLOW-02 · SuspendedAccountScreen
**Actors:** test-suspended

**Objective:** Verify tapping Log Out signs the user out and leaves the suspended gate.

**Steps:**
1. Log in as **test-suspended**.
2. On the **Account Suspended** screen, tap **Log Out**.

**Expected Result:**
- `logout()` clears the session; the RootNavigator switches to the unauthenticated stack and shows the Landing/Welcome screen.
- The app does not remain stuck on the suspended screen; the user can attempt to log in as another account.

---

## Group G — Home Dashboard

### ACC-TC-G01 · Greeting + subscription badge + SP balance

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the dashboard hero.

**Steps:**
1. Open the **Home / Dashboard**.

**Expected Result:**
- A time-based greeting ("Good morning/afternoon/evening, {name}"), the subscription badge (Trial/Active/Grace/Canceled/Free), and the SP balance.

---

### ACC-TC-G02 · Priority banners (grace > payment fail > trial > draft)

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-grace, test-trial, a user with a payment failure, a user with a draft

**Objective:** Verify banner priority and content.

**Steps:**
1. Open the dashboard in each state.

**Expected Result:**
- Grace period banner ("expires on {date} … keep your Swap Points") outranks payment-failure, which outranks trial-reminder, which outranks resume-draft.
- The resume-draft banner shows the first draft with "Continue listing" / "Dismiss".

---

### ACC-TC-G03 · Quick action tiles route correctly

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the four quick-action tiles.

**Steps:**
1. Tap each tile: Favorites, My Trades, My Listings, Payouts.

**Expected Result:**
- Each routes to its screen (favorites, trade list, my listings, payout settings).

**Setup:**
- Logged in as **test-buyer** (any tier); dashboard renders. No seeded trades/listings required — the 4 tiles always render.

**Locator hints:**
- Screen: `testID="dashboard-screen"` (`src/screens/dashboard/UserDashboardScreen.tsx`).
- Tiles (each `testID={\`action-tile-${key}\`}`): Favorites → `action-tile-favorites` · My Trades → `action-tile-myTrades` · My Listings → `action-tile-myListings` · Payouts → `action-tile-payouts`.
- ⚠️ BP-53 resolved (2026-08-13): the tiles now set `accessible` + `accessibilityRole="button"` + `accessibilityLabel={label}` (mirror `ui/Button`), so the identifiers surface on the iOS accessibility tree. Still confirm on-device before relying on them in Maestro.

**Assert:**
1. Dashboard shows exactly 4 tiles labeled Favorites / My Trades / My Listings / Payouts (locators above visible).
2. Tapping Favorites lands on the Favorites screen; My Trades → trade list; My Listings → My Listings; Payouts → payout settings (assert via destination route/header).

**Dependencies:**
- None. Pure navigation — deterministic.

---

### ACC-TC-G04 · ID verification CTA banner (dismissible)

**Ref:** FLOW-16 / FLOW-21 · UserDashboardScreen
**Actors:** test-free (verification = none)

**Objective:** Verify the ID verification CTA banner states.

**Steps:**
1. Open the dashboard with verification status none/pending/approved/rejected.

**Expected Result:**
- none → "Verify your identity…" CTA (dismissible); pending → "Pending…"; approved → hidden; rejected → "Rejected".

---

### ACC-TC-G05 · Recommendations + recent trade card

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify recommendations carousel and recent-trade card.

**Steps:**
1. On the dashboard, review the recommendations carousel, category chips, and the recent trade card.

**Expected Result:**
- A swipeable recommendations carousel; tappable category chips filter recommendations; the recent trade card shows title + color-coded status.

---

### ACC-TC-G06 · Pull-to-refresh reloads dashboard

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify refresh reloads dashboard data.

**Steps:**
1. Pull-to-refresh on the dashboard.

**Expected Result:**
- Subscription, timeline, recent trade, ID verification, and drafts reload; old content stays visible during refresh.

### ACC-TC-G07 · "Show more actions" toggle

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the Action Items expand/collapse toggle.

**Steps:**
1. On the Home dashboard with more actions than the initial limit, tap **Show {n} more action(s)**.
2. Tap **Show less**.

**Expected Result:**
- Tapping expands the Action Items list; the label changes to **Show less**.
- Tapping **Show less** collapses back to the initial set.

### ACC-TC-G08 · Free-user "Unlock Swap Points" strip

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-free

**Objective:** Verify the free-user SP strip and its upgrade navigation.

**Steps:**
1. As **test-free**, open Home and observe the SP strip.
2. Tap **Upgrade →**.

**Expected Result:**
- Strip shows **Unlock Swap Points** with **Upgrade →**.
- Tapping navigates to **JoinKidsClub**.
- (Subscribers instead see `{n} SP` with **Earn More →** → **SpWallet**.)

### ACC-TC-G09 · "No session found" state

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the dashboard's no-session fallback.

**Steps:**
1. Render Home without an authenticated session.

**Expected Result:**
- Shows `No session found. Please log in.` instead of a blank or crashed screen.

### ACC-TC-G10 · Empty-trade state

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer (no active trades)

**Objective:** Verify the empty-trade message.

**Steps:**
1. As a user with no active trades, open Home.

**Expected Result:**
- The recent-trade area shows `No active trades right now`.

### ACC-TC-G11 · "View Timeline" nav

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer (with a recent trade)

**Objective:** Verify the View Timeline button opens the trade timeline.

**Steps:**
1. On the recent trade card, tap **View Timeline**.

**Expected Result:**
- Navigates to **TradeTimeline** for that trade (`tradeId`).

### ACC-TC-G12 · "See All" → Discover nav

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the See All link opens Discover.

**Steps:**
1. In **Recommended for You**, tap **See All**.

**Expected Result:**
- Navigates to the **Discover** screen.

### ACC-TC-G13 · Subscription-card Upgrade button

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-free

**Objective:** Verify the subscription card's upgrade CTA for free users.

**Steps:**
1. As **test-free**, on the subscription card tap **Upgrade to Kids Club+**.

**Expected Result:**
- Navigates to **JoinKidsClub**.
- (The upgrade button only appears for free users.)

---

## Group H — Help & Support Menu

### ACC-TC-H01 · Help & Support menu (3 cards) routes

**Ref:** FLOW-19 · HelpSupportMenuScreen
**Actors:** test-buyer

**Objective:** Verify the help menu cards.

**Steps:**
1. Open **Help & Support** (from Settings).

**Expected Result:**
- Three cards: FAQ (→ FAQ list), How to Earn SP (→ Education Help), Contact Us (→ Contact Support), each with the documented subtitle.

---

### ACC-TC-H02 · FAQ list — search + category filter

**Ref:** FLOW-19 · HelpScreen (FAQ)
**Actors:** test-buyer

**Objective:** Verify FAQ search and category filtering.

**Steps:**
1. Open the FAQ list; type a query in the search bar; select category chips.

**Expected Result:**
- Header "Help & Support"; the list filters by question/answer text (case-insensitive) and by selected category chip (active chip green); "No results found" shows when nothing matches.

---

### ACC-TC-H03 · FAQ fallback when offline

**Ref:** FLOW-19 · HelpScreen (FAQ)
**Actors:** Any user offline

**Objective:** Verify hardcoded fallback FAQs when the DB fetch fails.

**Steps:**
1. Open the FAQ list while offline / with a failed fetch.

**Expected Result:**
- A fallback set of FAQs (Getting Started, Swap Points, Trading, Account, Safety) renders instead of an error.

---

### ACC-TC-H04 · FAQ detail — helpful vote (Yes/No)

**Ref:** FLOW-19 · FAQDetailScreen
**Actors:** test-buyer

**Objective:** Verify the FAQ detail and helpful voting.

**Steps:**
1. Open a FAQ; tap **👍 Yes**; open another and tap **👎 No**.

**Expected Result:**
- Detail shows a category badge, question, and answer.
- "Yes" records the vote and returns back; "No" records the vote and routes to Contact Support. A "Contact Support" button is also present.

---

### ACC-TC-H05 · Contact Support form (unified flow — logged-in AND logged-out)

**Ref:** FLOW-19 · ContactSupportScreen
**Actors:** test-buyer (logged in) + logged-out (guest)

**Objective:** Verify the contact form works for logged-in and logged-out users, with NO raw support-email surfaces.

**Steps:**
1. Logged out (guest): from **Login** tap **Need help? Contact Support**; also confirm the same link on **Signup**. Submit a guest ticket.
2. Logged in: submit with empty fields, then with a Subject + Message.

**Expected Result (guest, logged out):**
- The **Contact Support** form renders (no "Please log in" gate, no email fallback) with an extra **"YOUR EMAIL (SO WE CAN REPLY)"** (required) and **"PHONE (OPTIONAL)"** field.
- Submitting without an email alerts `Missing Email` / `Please enter your email so we can reply.`; a bad email alerts `Invalid Email`.
- A valid guest submit (email + subject + message, optional phone) shows "Sending…" then "Message Sent…We'll respond within 24 hours." and returns.
- Admin `/support` shows this ticket as **Guest** with the reply email (+ phone if provided).

**Expected Result (logged in):**
- Subject (≤100) and Message (≤1000 with counter) are required; empty fields alert. No guest email/phone fields shown.
- A valid submit shows "Sending…" then "Message Sent…We'll respond within 24 hours." and returns back.
- Failure shows an error alert **without** an email fallback.

**No raw email surfaces:**
- No `support@…` / `admin-support@…` / "email us" text appears anywhere on the Contact Support screen (logged-in or logged-out).

**Locator hints:**
- `login-contact-support-link` / `signup-contact-support-link` (logged-out entry) · `contact-email-input` / `contact-phone-input` (guest only) · `subject-input`, `message-input`, `send-message-button`.

### ACC-TC-H06 · No raw support-email surfaces (cross-screen sweep)

**Ref:** D1 · design-system-passitup.md
**Actors:** test-buyer + guest

**Objective:** Verify NO screen shows a support email address or "email us" copy — every support/contact affordance routes to the in-app Contact Support form.

**Steps:**
1. Visit every screen with a support/contact affordance: Login, Signup, Help & Support menu, FAQ list/detail, education Help (footer), Contact Support (logged-in AND logged-out), Edit Profile (`?` icons), My Subscription (Get Help), Suspended Account, and any alert/empty/error state reached during the case.
2. Grep/OCR each screen for `support@`, `admin-support@`, `mailto:`, or the phrase "email us".

**Expected Result:**
- No visible support email address, `mailto:` link, or "email us" copy on any screen (logged-in or logged-out).
- Every support/contact affordance navigates to the **Contact Support** screen.
- The only email input in the app is the Contact Support form's logged-out **"YOUR EMAIL (SO WE CAN REPLY)"** field.

**Verdict:** any visible raw email surface = FAIL (report the screen + file/line).

### ACC-TC-H07 · Contact Support reachable logged-out (Login + Signup entry)

**Ref:** D2 · AppNavigator (unauth branch)
**Actors:** guest (not logged in)

**Objective:** Verify a logged-out user can reach and submit the in-app Contact Support form.

**Steps:**
1. From **Login**, tap **Need help? Contact Support** (`login-contact-support-link`).
2. From **Signup**, tap **Need help? Contact Support** (`signup-contact-support-link`).
3. Submit a guest ticket (email required, phone optional).

**Expected Result:**
- Both links open the **Contact Support** form (not the auth stack / not a "log in first" gate).
- Back returns to Login/Signup respectively.
- The submitted ticket appears in admin `/support` as **Guest** with the reply email.

---

## Group I — Education & SP Calculator

### ACC-TC-I01 · Education Help screen sections (accordion + deep link)

**Ref:** FLOW-19 · HelpScreen (education)
**Actors:** test-buyer

**Objective:** Verify education sections render and deep-link expands.

**Steps:**
1. Open **How to Earn SP** (education Help screen).
2. Expand/collapse sections; open via a deep link `?section=sp_definition`.

**Expected Result:**
- Header "Help"; a hero card and published sections (title + markdown body + optional image); `sp_definition` is expanded by default; a deep link auto-expands and scrolls to the target section.
- Footer shows a **"Still have questions? Contact Support"** link (`help-contact-support-link`) that routes to the in-app Contact Support form — **no support email is shown**.

---

### ACC-TC-I02 · SP Calculator (free mode) sell/buy outputs

**Ref:** FLOW-19 · SPCalculator
**Actors:** test-buyer

**Objective:** Verify the SP calculator computes sell and buy values.

**Steps:**
1. In the education Help screen calculator, select a category and enter a price (e.g., $30).

**Expected Result:**
- "If You Sell: {earn_sp} SP" and "If You Buy: {max_sp_usable} SP" update live based on the category and price.

---

### ACC-TC-I03 · SP Calculator bonus category badge

**Ref:** FLOW-04C / FLOW-19 · SPCalculator
**Actors:** test-buyer

**Objective:** Verify bonus categories show a multiplier badge.

**Steps:**
1. Select a bonus category in the calculator and enter a price.

**Expected Result:**
- The sell output shows a bonus badge ("Bonus category! Earns {multiplier}× SP") and the listed bonus categories appear.

---

### ACC-TC-I04 · SP Calculator validation (price range)

**Ref:** FLOW-19 · SPCalculator
**Actors:** test-buyer

**Objective:** Verify price validation bounds.

**Steps:**
1. Enter $0, then a value over $10,000, then a valid value.

**Expected Result:**
- Results only render for a price > 0 and ≤ 10,000 with a valid category; out-of-range inputs show no result.

---

### ACC-TC-I05 · Education analytics events fire

**Ref:** FLOW-EDU-001 · educationAnalyticsService
**Actors:** test-buyer

**Objective:** Verify education/calculator analytics events are tracked.

**Steps:**
1. Open the education Help screen and perform a calculator calculation. (Verify via the admin education analytics dashboard or logs.)

**Expected Result:**
- A `help_view` event fires on mount and a `calculator_use` event (mode, category_id, price_bucket) fires on calculation; both appear in the analytics dashboard.

---

## Group J — Legal Screens

### ACC-TC-J01 · Terms of Service view + last updated

**Ref:** FLOW-31 · TermsOfServiceScreen
**Actors:** test-buyer

**Objective:** Verify TOS renders the current published policy.

**Steps:**
1. Open Settings → **Terms of Service**.

**Expected Result:**
- Header "Terms of Service", a "Last updated: {date}" line, and the policy content rendered as markdown. (No Accept/Decline buttons when opened from Settings.)

---

### ACC-TC-J02 · TOS acceptance flow (requireAcceptance)

**Ref:** FLOW-31 · TermsOfServiceScreen
**Actors:** A user prompted to accept (auth flow)

**Objective:** Verify the acceptance path records acceptance.

**Steps:**
1. Reach the TOS screen with requireAcceptance = true (e.g., during onboarding/policy update).
2. Tap **[I Accept]**; on a separate run tap **[Decline]**.

**Expected Result:**
- **[I Accept]** records acceptance (RPC) and proceeds; **[Decline]** returns without accepting; an accepting spinner shows during the call.

---

### ACC-TC-J03 · Privacy Policy view + acceptance

**Ref:** FLOW-32 · PrivacyPolicyScreen
**Actors:** test-buyer / a prompted user

**Objective:** Verify Privacy Policy view and acceptance.

**Steps:**
1. Open Privacy Policy from Settings (view-only).
2. Reach it with requireAcceptance = true and tap **[Accept Privacy Policy]**.

**Expected Result:**
- View-only from Settings (last updated + markdown). With requireAcceptance, **[Accept Privacy Policy]** records acceptance and proceeds.
- Policy version number and effective date are displayed (in addition to "Last updated"); markdown formatting (bold, italic, bullet/numbered lists, links) renders correctly.

---

### ACC-TC-J04 · Liability Disclaimer view (read-only + retry)

**Ref:** FLOW-33 · LiabilityDisclaimerScreen
**Actors:** test-buyer

**Objective:** Verify the disclaimer is read-only with a retry on error.

**Steps:**
1. Open Settings → **Liability Disclaimer**; simulate a load failure and tap **[Retry]**.

**Expected Result:**
- Header "Disclaimer" with a warning icon, title, last-updated date, and markdown content; no acceptance buttons. On error, a warning + **[Retry]** reloads.

---

### ACC-TC-J05 · Policy versioning — re-acceptance on new version

**Ref:** FLOW-31/32 · admin policies
**Actors:** test-admin + test-buyer

**Objective:** Verify publishing a new policy version re-prompts acceptance.

**Steps:**
1. As **test-admin**, publish a new TOS (and Privacy) version.
2. As **test-buyer** who accepted the previous version, trigger the acceptance check.

**Expected Result:**
- The user is treated as not having accepted the current version and is prompted to accept the new one; after accepting, the check passes.
- Draft versions are never visible to end users; only the latest published version is shown after an app restart.

---

### ACC-TC-J06 · Signup implies TOS + Privacy agreement (no mandatory dialog)

**Ref:** FLOW-31/32 · SignupScreen
**Actors:** A fresh (not logged-in) user

**Objective:** Verify that completing signup implies agreement to the current published policies without a separate mandatory accept/decline dialog.

**Steps:**
1. Open the Signup screen; confirm the "By signing up, you agree to our Terms of Service and Privacy Policy" text renders with tappable links.
2. Fill valid signup fields and submit.

**Expected Result:**
- Signup proceeds normally (e.g., to phone verification); no separate policy accept/decline dialog is shown; no error is displayed.

---

### ACC-TC-J07 · Legal screen unavailable state (no published policy)

**Ref:** FLOW-31/32 · TermsOfServiceScreen / PrivacyPolicyScreen
**Actors:** test-buyer

**Objective:** Verify graceful behavior when no published policy exists.

**Steps:**
1. With no published TOS/Privacy, open Settings → Terms of Service (repeat for Privacy Policy).

**Expected Result:**
- A clear "…not available" message is shown; the app does not crash; the user can navigate back.

---

### ACC-TC-J08 · Legal screen load failure — error + Retry

**Ref:** FLOW-31/32 · TermsOfServiceScreen / PrivacyPolicyScreen
**Actors:** test-buyer

**Objective:** Verify a fetch failure shows an error with a retry path.

**Steps:**
1. Simulate a load failure and open Settings → Terms of Service (repeat for Privacy Policy).
2. Tap **[Retry]**.

**Expected Result:**
- A warning/error message with a Retry action renders; retry reloads once connectivity/state is restored; no crash or blank screen.

---

### ACC-TC-J09 · Very long policy content renders + scrolls smoothly

**Ref:** FLOW-31 · TermsOfServiceScreen
**Actors:** test-buyer

**Objective:** Verify a large published policy renders and scrolls without issue.

**Steps:**
1. Open Settings → Terms of Service for a 10,000+ word policy.
2. Scroll through the full content.

**Expected Result:**
- Markdown formatting (headings/lists) preserved; content scrolls smoothly with no lag; back returns to Settings.

---

### ACC-TC-J10 · Legal screens render consistently on iOS and Android

**Ref:** FLOW-31/32/33
**Actors:** test-buyer

**Objective:** Verify identical legal-screen behavior on both platforms.

**Steps:**
1. Repeat ACC-TC-J01 / ACC-TC-J03 / ACC-TC-J04 on iOS Simulator, then Android Emulator.

**Expected Result:**
- Same content, formatting, link behavior, and navigation on both platforms; no platform-specific bugs.

---

### ACC-TC-J11 · Legal screen loads < 2s and scrolls without lag

**Ref:** FLOW-31/32/33
**Actors:** test-buyer

**Objective:** Verify acceptable load performance.

**Steps:**
1. Clear cache and open Settings → Terms of Service / Privacy Policy; measure time to render.

**Expected Result:**
- Policy renders in < 2s; no noticeable scroll lag; repeated opens do not leak memory.

---

### ACC-TC-J12 · Liability Disclaimer unavailable state

**Ref:** FLOW-33 · LiabilityDisclaimerScreen
**Actors:** test-buyer

**Objective:** Verify the no-policy state for the disclaimer.

**Steps:**
1. With no published disclaimer, open Settings → Liability Disclaimer.

**Expected Result:**
- "Liability Disclaimer not available" message; no Accept button; user can navigate back.

---

## Group K — Privacy & Security / MFA

### ACC-TC-K01 · MFA factors list + enrollment entry points

**Ref:** FLOW-24 · Settings → Privacy & Security
**Actors:** test-buyer

**Objective:** Verify the Privacy & Security area exposes factor-management entry points and current MFA state.

**Steps:**
1. Open **Settings → Privacy & Security**.
2. Review the MFA section before any factor is enrolled.

**Expected Result:**
- The screen shows MFA status, existing factors (if any), and available actions to add a factor.
- Unsupported factor types are hidden or clearly marked unavailable on the current device.
- If no factor is enrolled, the account is shown as not fully MFA-protected.

### ACC-TC-K02 · Enroll and verify an authenticator factor

**Ref:** FLOW-24 · MFA enrollment
**Actors:** test-buyer

**Objective:** Verify a user can enroll and verify a new MFA factor.

**Steps:**
1. In **Privacy & Security**, start MFA setup.
2. Scan the QR code or enter the setup key into the authenticator app.
3. Enter the generated verification code and submit.

**Expected Result:**
- Setup instructions render with a QR code or manual key.
- A valid code completes enrollment and marks the factor as **Verified**.
- The screen updates to show MFA is enabled for the account.

### ACC-TC-K03 · Protected action prompts MFA challenge + invalid code handling

**Ref:** FLOW-24 · MFA assurance level
**Actors:** test-buyer

**Objective:** Verify a sensitive account action requires the second factor once MFA is enabled.

**Steps:**
1. Ensure **test-buyer** has a verified MFA factor.
2. Start a sensitive action such as changing account security details, deleting the account, or another gated security action in the build.
3. Enter an invalid MFA code, then retry with a valid code.

**Expected Result:**
- The sensitive action prompts for the enrolled MFA factor.
- An invalid code is rejected with a clear error and does not complete the action.
- A valid code completes the challenge and allows the protected action to proceed.

### ACC-TC-K04 · Recovery path and remove verified factor

**Ref:** FLOW-24 · recovery and factor removal
**Actors:** test-buyer

**Objective:** Verify the user can recover access and remove an enrolled factor without leaving the account in a broken state.

**Steps:**
1. Start the MFA challenge but use the recovery option instead of the live authenticator code.
2. Complete the recovery step with a valid recovery code or backup flow supported by the environment.
3. Return to **Privacy & Security** and remove the verified factor.

**Expected Result:**
- The recovery path is clearly available when a factor challenge cannot be completed normally.
- A valid recovery step restores access without forcing logout loops.
- Removing the factor requires confirmation and updates the screen so the account no longer shows that factor as active.

## Group L — Error Recovery & Crash Reporting

### ACC-TC-L01 · Render-time error shows fallback instead of red/white screen

**Ref:** FLOW-21 · ErrorBoundary
**Actors:** test-buyer

**Objective:** Verify a render-time JavaScript error is contained by the app fallback.

**Steps:**
1. Navigate to a QA screen or toggle that intentionally triggers a render-time error.
2. Observe the app behavior when the error is thrown.

**Expected Result:**
- The app shows a friendly fallback UI instead of a red screen, white screen, or frozen app.
- The fallback includes a **Try Again** action.
- The rest of the app shell remains responsive.

### ACC-TC-L02 · Try Again recovers after transient error

**Ref:** FLOW-21 · ErrorBoundary reset
**Actors:** test-buyer

**Objective:** Verify the fallback can recover when the underlying issue is gone.

**Steps:**
1. Trigger the test error and land on the fallback UI.
2. Remove the underlying temporary condition or disable the QA fault.
3. Tap **Try Again**.

**Expected Result:**
- Tapping **Try Again** resets the boundary state.
- The original screen loads successfully once the transient issue is gone.
- The user does not need to kill and relaunch the app to recover.

### ACC-TC-L03 · Persistent error stays contained to fallback

**Ref:** FLOW-21 · repeated error containment
**Actors:** test-buyer

**Objective:** Verify repeated failures do not escape the fallback boundary.

**Steps:**
1. Trigger a persistent QA error.
2. On the fallback screen, tap **Try Again** without removing the fault.

**Expected Result:**
- The fallback reappears instead of the app crashing or showing a native red/white screen.
- The app remains contained to the failing surface and stays usable after backing out or navigating away if supported.

### ACC-TC-L04 · Error reporting is safe with and without telemetry

**Ref:** FLOW-21 · crash reporting
**Actors:** QA

**Objective:** Verify error capture works when telemetry is enabled and remains safe when telemetry is disabled.

**Steps:**
1. In a build with telemetry enabled, trigger the QA error once and confirm the event appears in Sentry or the configured error dashboard.
2. In a build with telemetry disabled, trigger the same error again.

**Expected Result:**
- With telemetry enabled, one error event is recorded with error context sufficient for triage.
- With telemetry disabled, the fallback UI still works and the app does not crash because reporting is unavailable.
- No raw user PII is visible in the captured error payload.

---

## Regression

### ACC-TC-R01 · Logout from Settings clears session
**Objective:** Confirm sign-out fully clears the session and returns to login.
**Steps:** 1. Sign out from Settings; relaunch the app.
**Expected Result:** The app opens at login/landing, not an authenticated screen.

### ACC-TC-R02 · Profile edits persist after relaunch
**Objective:** Confirm saved profile edits persist beyond the optimistic patch.
**Steps:** 1. Edit profile, save, relaunch the app, reopen Profile.
**Expected Result:** The saved values persist.

### ACC-TC-R03 · Notification preference respected end-to-end
**Objective:** Confirm disabling a category's push stops that push.
**Steps:** 1. Disable push for one category; trigger an event of that category.
**Expected Result:** No push is delivered for that category (other channels per their toggles).

### ACC-TC-R04 · Legal links reachable from both Settings and onboarding
**Objective:** Confirm TOS/Privacy/Liability open from Settings and signup links.
**Steps:** 1. Open each from Settings and from the signup screen.
**Expected Result:** Both entry points open the same current policy content.

### ACC-TC-R05 · Dashboard reflects subscription state changes
**Objective:** Confirm the dashboard badge/banner updates after a subscription state change.
**Steps:** 1. Change subscription state (e.g., cancel/grace) and reopen the dashboard.
**Expected Result:** The badge and banners update to the new state.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Settings sections + rows (FLOW-02) | ACC-TC-A01 |
| Sign Out confirmation | ACC-TC-A02, ACC-TC-R01 |
| Test push rate limit / quiet hours / queued (FLOW-17) | ACC-TC-A03 |
| Settings → legal & help routing | ACC-TC-A04, ACC-TC-R04 |
| Edit profile load + optimistic save | ACC-TC-B01, ACC-TC-R02 |
| Email change re-verification | ACC-TC-B02 |
| Phone change OTP modal | ACC-TC-B03 |
| Avatar upload | ACC-TC-B04 |
| Profile stats/badges/reviews/status | ACC-TC-B05 |
| Linked accounts layout (FLOW-01) | ACC-TC-C01 |
| Link provider with re-auth gate | ACC-TC-C02 |
| Unlink confirmation + last-method guard | ACC-TC-C03 |
| Email mismatch blocked | ACC-TC-C04 |
| Notification categories × channels (FLOW-17) | ACC-TC-D01, ACC-TC-R03 |
| Optimistic toggle revert | ACC-TC-D02 |
| Quiet hours toggle + validation | ACC-TC-D03 |
| Notification prefs empty/initialize | ACC-TC-D04 |
| Delete account consequences + password (COPPA) | ACC-TC-E01 |
| Delete wrong password blocked | ACC-TC-E02 |
| Delete two-step confirm + logout | ACC-TC-E03 |
| Suspended account gate (FLOW-34) | ACC-TC-F01 |
| Unsubscribe email token success/error (FLOW-17) | ACC-TC-F02 |
| Offline screen + retry | ACC-TC-F03 |
| Dashboard greeting + badge + SP (FLOW-16) | ACC-TC-G01, ACC-TC-R05 |
| Dashboard banner priority | ACC-TC-G02 |
| Dashboard quick-action routing | ACC-TC-G03 |
| Dashboard ID verification CTA | ACC-TC-G04 |
| Dashboard recommendations + recent trade | ACC-TC-G05 |
| Dashboard pull-to-refresh | ACC-TC-G06 |
| Help & Support menu routing (FLOW-19) | ACC-TC-H01 |
| FAQ search + category filter | ACC-TC-H02 |
| FAQ offline fallback | ACC-TC-H03 |
| FAQ detail helpful vote | ACC-TC-H04 |
| Contact Support form + validation | ACC-TC-H05 |
| Education sections accordion + deep link | ACC-TC-I01 |
| SP Calculator sell/buy outputs | ACC-TC-I02 |
| SP Calculator bonus badge | ACC-TC-I03 |
| SP Calculator price validation | ACC-TC-I04 |
| Education analytics events (FLOW-EDU-001) | ACC-TC-I05 |
| TOS view + last updated (FLOW-31) | ACC-TC-J01 |
| TOS acceptance flow | ACC-TC-J02 |
| Privacy Policy view + acceptance (FLOW-32) | ACC-TC-J03 |
| Liability Disclaimer read-only + retry (FLOW-33) | ACC-TC-J04 |
| Policy versioning re-acceptance | ACC-TC-J05 |
