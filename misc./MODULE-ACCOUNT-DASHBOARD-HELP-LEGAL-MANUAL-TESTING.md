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
| **A — Settings Hub** | TC-A01 | Settings screen sections + rows render |
| | TC-A02 | Sign Out confirmation |
| | TC-A03 | Test Push Notification (rate limit / quiet hours / queued) |
| | TC-A04 | Settings → legal & help links navigate |
| **B — Edit Profile** | TC-B01 | Edit profile fields load + save (optimistic) |
| | TC-B02 | Email change requires re-verification |
| | TC-B03 | Phone change → OTP verification modal |
| | TC-B04 | Avatar upload |
| | TC-B05 | Profile screen stats, badges, reviews, status badge |
| **C — Linked Accounts** | TC-C01 | Linked accounts list (email readonly, password, social) |
| | TC-C02 | Link a social provider (password re-auth gate) |
| | TC-C03 | Unlink provider (confirmation + last-method guard) |
| | TC-C04 | Email mismatch on link blocked |
| **D — Notification Preferences** | TC-D01 | Five categories × three channel toggles |
| | TC-D02 | Optimistic toggle reverts on failure |
| | TC-D03 | Quiet hours toggle + time validation |
| | TC-D04 | Empty state → Initialize Settings |
| **E — Delete Account (COPPA)** | TC-E01 | Delete account consequences + password gate |
| | TC-E02 | Wrong password blocked |
| | TC-E03 | Two-step confirmation → deletion + logout |
| **F — Suspended / Unsubscribe / Offline** | TC-F01 | Suspended account screen (logout only) |
| | TC-F02 | Unsubscribe via email token (success/error) |
| | TC-F03 | Offline screen + Try Again |
| **G — Home Dashboard** | TC-G01 | Greeting + subscription badge + SP balance |
| | TC-G02 | Priority banners (grace > payment fail > trial > draft) |
| | TC-G03 | Quick action tiles route correctly |
| | TC-G04 | ID verification CTA banner (dismissible) |
| | TC-G05 | Recommendations + recent trade card |
| | TC-G06 | Pull-to-refresh reloads dashboard |
| **H — Help & Support Menu** | TC-H01 | Help & Support menu (3 cards) routes |
| | TC-H02 | FAQ list — search + category filter |
| | TC-H03 | FAQ fallback when offline |
| | TC-H04 | FAQ detail — helpful vote (Yes/No) |
| | TC-H05 | Contact Support form (auth gate + validation) |
| **I — Education & SP Calculator** | TC-I01 | Education Help screen sections (accordion + deep link) |
| | TC-I02 | SP Calculator (free mode) sell/buy outputs |
| | TC-I03 | SP Calculator bonus category badge |
| | TC-I04 | SP Calculator validation (price range) |
| | TC-I05 | Education analytics events fire |
| **J — Legal Screens** | TC-J01 | Terms of Service view + last updated |
| | TC-J02 | TOS acceptance flow (requireAcceptance) |
| | TC-J03 | Privacy Policy view + acceptance |
| | TC-J04 | Liability Disclaimer view (read-only + retry) |
| | TC-J05 | Policy versioning — re-acceptance on new version |
| **K — Privacy & Security / MFA** | TC-K01 | MFA factors list + enrollment entry points |
| | TC-K02 | Enroll and verify an authenticator factor |
| | TC-K03 | Protected action prompts MFA challenge + invalid code handling |
| | TC-K04 | Recovery path and remove verified factor |
| **L — Error Recovery & Crash Reporting** | TC-L01 | Render-time error shows fallback instead of red/white screen |
| | TC-L02 | Try Again recovers after transient error |
| | TC-L03 | Persistent error stays contained to fallback |
| | TC-L04 | Error reporting is safe with and without telemetry |

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

### TC-A01 · Settings screen sections + rows render

**Ref:** FLOW-02 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify the Settings screen shows all sections and rows.

**Steps:**
1. As **test-buyer**, open **Settings**.

**Expected Result:**
- Header "Settings".
- Notifications section: "Enable Push Notifications", "Notification Preferences", "Test Push Notification".
- Account section: "Linked Accounts", "Privacy & Security", "Help & Support".
- Legal section: "Terms of Service", "Privacy Policy", "Liability Disclaimer".
- Danger Zone: "Sign Out", "Delete Account".

---

### TC-A02 · Sign Out confirmation

**Ref:** FLOW-02 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify Sign Out requires confirmation.

**Steps:**
1. On Settings, tap **Sign Out** and review the alert; cancel, then repeat and confirm.

**Expected Result:**
- An "Are you sure you want to sign out?" alert appears. Cancel keeps the session; confirm logs the user out to the login/landing screen.

---

### TC-A03 · Test Push Notification (rate limit / quiet hours / queued)

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

### TC-A04 · Settings → legal & help links navigate

**Ref:** FLOW-31/32/33 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify legal and help rows route to the right screens.

**Steps:**
1. From Settings, tap Terms of Service, Privacy Policy, Liability Disclaimer, Help & Support, Linked Accounts, Notification Preferences (back each time).

**Expected Result:**
- Each opens its respective screen; "Privacy & Security" is a known not-yet-implemented stub.

---

## Group B — Edit Profile

### TC-B01 · Edit profile fields load + save (optimistic)

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify profile fields load and save with optimistic update.

**Steps:**
1. From Profile, tap **Edit**; change Display Name, Zip Code, and Bio; save.

**Expected Result:**
- Fields prefill from the profile (display name, DOB, email, zip, bio, phone, avatar).
- After save, the screen returns to Profile and the new values appear immediately (optimistic patch) without a flash of stale data.

---

### TC-B02 · Email change requires re-verification

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify changing email triggers verification.

**Steps:**
1. On Edit Profile, change the email to a new address and save.

**Expected Result:**
- The app requires verification of the new email (verification link sent); the email isn't switched until verified.

---

### TC-B03 · Phone change → OTP verification modal

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify the phone verification modal flow.

**Steps:**
1. On Edit Profile, change the phone number and save.
2. In the OTP modal, request resend (observe countdown), then enter the code.

**Expected Result:**
- The phone normalizes to digits; an OTP modal appears with a resend button + countdown and a verifying state; a valid code marks the phone verified.

---

### TC-B04 · Avatar upload

**Ref:** FLOW-05 media · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify avatar upload.

**Steps:**
1. On Edit Profile, tap the Camera icon and pick an image.

**Expected Result:**
- An uploading state shows; on success the new avatar renders (resolving storage path vs full URL).

---

### TC-B05 · Profile screen stats, badges, reviews, status badge

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

---

## Group C — Linked Accounts

### TC-C01 · Linked accounts list (email readonly, password, social)

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer

**Objective:** Verify the linked-accounts layout.

**Steps:**
1. Open Settings → **Linked Accounts**.

**Expected Result:**
- Account Email row (readonly badge), an info card about keeping ≥1 login method, a Password row ("Password ✓ set" or "No password set" + "Set Password"), and Google/Facebook/Apple rows each showing "Linked • {email}" or "Not linked" with a Link/Unlink button.

---

### TC-C02 · Link a social provider (password re-auth gate)

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer (has password)

**Objective:** Verify linking requires re-auth and starts OAuth.

**Steps:**
1. On a "Not linked" provider, tap **Link**.

**Expected Result:**
- Because the user has a password, a password re-auth modal appears first; after re-auth the OAuth flow starts (in test it shows the simulated provider message).

---

### TC-C03 · Unlink provider (confirmation + last-method guard)

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer

**Objective:** Verify unlink confirmation and the last-method guard.

**Steps:**
1. On a linked provider, tap **Unlink** and confirm.
2. Attempt to unlink the only remaining login method.

**Expected Result:**
- Unlink shows a confirmation ("…you can always link it again later"); confirming unlinks.
- Attempting to remove the last login method is blocked: "You must keep at least one login method. Add another method first."

---

### TC-C04 · Email mismatch on link blocked

**Ref:** FLOW-01 · LinkedAccountsScreen
**Actors:** test-buyer

**Objective:** Verify a mismatched provider email is rejected.

**Steps:**
1. Attempt to link a provider account whose email differs from the account email.

**Expected Result:**
- An error states the provider email doesn't match and the link is not created.

---

## Group D — Notification Preferences

### TC-D01 · Five categories × three channel toggles

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

### TC-D02 · Optimistic toggle reverts on failure

**Ref:** FLOW-17 · NotificationPreferencesScreen
**Actors:** test-buyer

**Objective:** Verify a failed update reverts the toggle.

**Steps:**
1. Force a save failure (e.g., offline) and flip a toggle.

**Expected Result:**
- The toggle updates immediately, then reverts with an error alert when the save fails.

---

### TC-D03 · Quiet hours toggle + time validation

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

### TC-D04 · Empty state → Initialize Settings

**Ref:** FLOW-17 · NotificationPreferencesScreen
**Actors:** A user with no preferences yet

**Objective:** Verify the empty/initialize state.

**Steps:**
1. Open Notification Preferences for a user with no rows.

**Expected Result:**
- A "No preferences found" empty state with an **[Initialize Settings]** button that creates defaults.

---

## Group E — Delete Account (COPPA)

### TC-E01 · Delete account consequences + password gate

**Ref:** COPPA / FLOW-21 error recovery · DeleteAccountScreen
**Actors:** A disposable test account

**Objective:** Verify the delete screen warnings and password requirement.

**Steps:**
1. Open Settings → **Delete Account**.

**Expected Result:**
- "Delete Account?" with the five consequences (profile/listings deleted, active trades cancelled, SP forfeited, subscription cancelled, cannot be undone) and a required password field.

---

### TC-E02 · Wrong password blocked

**Ref:** DeleteAccountScreen
**Actors:** A disposable test account

**Objective:** Verify wrong password is rejected.

**Steps:**
1. Enter an incorrect password and tap **[Delete My Account]**.

**Expected Result:**
- "Incorrect password. Please try again." (or re-auth failure) — no deletion occurs.

---

### TC-E03 · Two-step confirmation → deletion + logout

**Ref:** DeleteAccountScreen
**Actors:** A disposable test account

**Objective:** Verify successful deletion and auto-logout.

**Steps:**
1. Enter the correct password, tap **[Delete My Account]**, and confirm the final "This cannot be undone." alert.

**Expected Result:**
- The account deletion RPC runs (profile marked self-deleted, SP wallet frozen, audit log written) and the user is logged out automatically.

---

## Group F — Suspended / Unsubscribe / Offline

### TC-F01 · Suspended account screen (logout only)

**Ref:** FLOW-34 / FLOW-02 · SuspendedAccountScreen
**Actors:** test-suspended

**Objective:** Verify the suspended-account gate.

**Steps:**
1. Log in as **test-suspended**.

**Expected Result:**
- A 🚫 "Account Suspended" screen with the support email and a single **[Log Out]** action; the rest of the app is inaccessible.

---

### TC-F02 · Unsubscribe via email token (success/error)

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

### TC-F03 · Offline screen + Try Again

**Ref:** FLOW-21 error recovery · OfflineScreen
**Actors:** Any user

**Objective:** Verify the offline state and retry.

**Steps:**
1. Disable connectivity to trigger the offline screen, then re-enable and tap **[Try Again]**.

**Expected Result:**
- "No Internet Connection" with a WifiX icon and **[Try Again]** that retries/returns once connectivity is restored.

---

## Group G — Home Dashboard

### TC-G01 · Greeting + subscription badge + SP balance

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the dashboard hero.

**Steps:**
1. Open the **Home / Dashboard**.

**Expected Result:**
- A time-based greeting ("Good morning/afternoon/evening, {name}"), the subscription badge (Trial/Active/Grace/Canceled/Free), and the SP balance.

---

### TC-G02 · Priority banners (grace > payment fail > trial > draft)

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-grace, test-trial, a user with a payment failure, a user with a draft

**Objective:** Verify banner priority and content.

**Steps:**
1. Open the dashboard in each state.

**Expected Result:**
- Grace period banner ("expires on {date} … keep your Swap Points") outranks payment-failure, which outranks trial-reminder, which outranks resume-draft.
- The resume-draft banner shows the first draft with "Continue listing" / "Dismiss".

---

### TC-G03 · Quick action tiles route correctly

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify all six quick-action tiles.

**Steps:**
1. Tap each tile: Sell, Discover, My Trades, My Listings, Messages, Payouts.

**Expected Result:**
- Each routes to its screen (item create, discover, trade list, my listings, conversations, payout settings).

---

### TC-G04 · ID verification CTA banner (dismissible)

**Ref:** FLOW-16 / FLOW-21 · UserDashboardScreen
**Actors:** test-free (verification = none)

**Objective:** Verify the ID verification CTA banner states.

**Steps:**
1. Open the dashboard with verification status none/pending/approved/rejected.

**Expected Result:**
- none → "Verify your identity…" CTA (dismissible); pending → "Pending…"; approved → hidden; rejected → "Rejected".

---

### TC-G05 · Recommendations + recent trade card

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify recommendations carousel and recent-trade card.

**Steps:**
1. On the dashboard, review the recommendations carousel, category chips, and the recent trade card.

**Expected Result:**
- A swipeable recommendations carousel; tappable category chips filter recommendations; the recent trade card shows title + color-coded status.

---

### TC-G06 · Pull-to-refresh reloads dashboard

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify refresh reloads dashboard data.

**Steps:**
1. Pull-to-refresh on the dashboard.

**Expected Result:**
- Subscription, timeline, recent trade, ID verification, and drafts reload; old content stays visible during refresh.

---

## Group H — Help & Support Menu

### TC-H01 · Help & Support menu (3 cards) routes

**Ref:** FLOW-19 · HelpSupportMenuScreen
**Actors:** test-buyer

**Objective:** Verify the help menu cards.

**Steps:**
1. Open **Help & Support** (from Settings).

**Expected Result:**
- Three cards: FAQ (→ FAQ list), How to Earn SP (→ Education Help), Contact Us (→ Contact Support), each with the documented subtitle.

---

### TC-H02 · FAQ list — search + category filter

**Ref:** FLOW-19 · HelpScreen (FAQ)
**Actors:** test-buyer

**Objective:** Verify FAQ search and category filtering.

**Steps:**
1. Open the FAQ list; type a query in the search bar; select category chips.

**Expected Result:**
- Header "Help & Support"; the list filters by question/answer text (case-insensitive) and by selected category chip (active chip green); "No results found" shows when nothing matches.

---

### TC-H03 · FAQ fallback when offline

**Ref:** FLOW-19 · HelpScreen (FAQ)
**Actors:** Any user offline

**Objective:** Verify hardcoded fallback FAQs when the DB fetch fails.

**Steps:**
1. Open the FAQ list while offline / with a failed fetch.

**Expected Result:**
- A fallback set of FAQs (Getting Started, Swap Points, Trading, Account, Safety) renders instead of an error.

---

### TC-H04 · FAQ detail — helpful vote (Yes/No)

**Ref:** FLOW-19 · FAQDetailScreen
**Actors:** test-buyer

**Objective:** Verify the FAQ detail and helpful voting.

**Steps:**
1. Open a FAQ; tap **👍 Yes**; open another and tap **👎 No**.

**Expected Result:**
- Detail shows a category badge, question, and answer.
- "Yes" records the vote and returns back; "No" records the vote and routes to Contact Support. A "Contact Support" button is also present.

---

### TC-H05 · Contact Support form (auth gate + validation)

**Ref:** FLOW-19 · ContactSupportScreen
**Actors:** test-buyer (logged in) + logged-out

**Objective:** Verify the contact form and its validation.

**Steps:**
1. Logged out: open Contact Support.
2. Logged in: submit with empty fields, then with a Subject + Message.

**Expected Result:**
- Logged out: "Please log in to contact support." + the email fallback.
- Logged in: Subject (≤100) and Message (≤1000 with counter) are required; empty fields alert; a valid submit shows "Sending…" then "Message Sent…We'll respond within 24 hours." and returns back. Failure shows an error alert with the email fallback.

---

## Group I — Education & SP Calculator

### TC-I01 · Education Help screen sections (accordion + deep link)

**Ref:** FLOW-19 · HelpScreen (education)
**Actors:** test-buyer

**Objective:** Verify education sections render and deep-link expands.

**Steps:**
1. Open **How to Earn SP** (education Help screen).
2. Expand/collapse sections; open via a deep link `?section=sp_definition`.

**Expected Result:**
- Header "Help"; a hero card and published sections (title + markdown body + optional image); `sp_definition` is expanded by default; a deep link auto-expands and scrolls to the target section.
- Footer support email is shown.

---

### TC-I02 · SP Calculator (free mode) sell/buy outputs

**Ref:** FLOW-19 · SPCalculator
**Actors:** test-buyer

**Objective:** Verify the SP calculator computes sell and buy values.

**Steps:**
1. In the education Help screen calculator, select a category and enter a price (e.g., $30).

**Expected Result:**
- "If You Sell: {earn_sp} SP" and "If You Buy: {max_sp_usable} SP" update live based on the category and price.

---

### TC-I03 · SP Calculator bonus category badge

**Ref:** FLOW-04C / FLOW-19 · SPCalculator
**Actors:** test-buyer

**Objective:** Verify bonus categories show a multiplier badge.

**Steps:**
1. Select a bonus category in the calculator and enter a price.

**Expected Result:**
- The sell output shows a bonus badge ("Bonus category! Earns {multiplier}× SP") and the listed bonus categories appear.

---

### TC-I04 · SP Calculator validation (price range)

**Ref:** FLOW-19 · SPCalculator
**Actors:** test-buyer

**Objective:** Verify price validation bounds.

**Steps:**
1. Enter $0, then a value over $10,000, then a valid value.

**Expected Result:**
- Results only render for a price > 0 and ≤ 10,000 with a valid category; out-of-range inputs show no result.

---

### TC-I05 · Education analytics events fire

**Ref:** FLOW-EDU-001 · educationAnalyticsService
**Actors:** test-buyer

**Objective:** Verify education/calculator analytics events are tracked.

**Steps:**
1. Open the education Help screen and perform a calculator calculation. (Verify via the admin education analytics dashboard or logs.)

**Expected Result:**
- A `help_view` event fires on mount and a `calculator_use` event (mode, category_id, price_bucket) fires on calculation; both appear in the analytics dashboard.

---

## Group J — Legal Screens

### TC-J01 · Terms of Service view + last updated

**Ref:** FLOW-31 · TermsOfServiceScreen
**Actors:** test-buyer

**Objective:** Verify TOS renders the current published policy.

**Steps:**
1. Open Settings → **Terms of Service**.

**Expected Result:**
- Header "Terms of Service", a "Last updated: {date}" line, and the policy content rendered as markdown. (No Accept/Decline buttons when opened from Settings.)

---

### TC-J02 · TOS acceptance flow (requireAcceptance)

**Ref:** FLOW-31 · TermsOfServiceScreen
**Actors:** A user prompted to accept (auth flow)

**Objective:** Verify the acceptance path records acceptance.

**Steps:**
1. Reach the TOS screen with requireAcceptance = true (e.g., during onboarding/policy update).
2. Tap **[I Accept]**; on a separate run tap **[Decline]**.

**Expected Result:**
- **[I Accept]** records acceptance (RPC) and proceeds; **[Decline]** returns without accepting; an accepting spinner shows during the call.

---

### TC-J03 · Privacy Policy view + acceptance

**Ref:** FLOW-32 · PrivacyPolicyScreen
**Actors:** test-buyer / a prompted user

**Objective:** Verify Privacy Policy view and acceptance.

**Steps:**
1. Open Privacy Policy from Settings (view-only).
2. Reach it with requireAcceptance = true and tap **[Accept Privacy Policy]**.

**Expected Result:**
- View-only from Settings (last updated + markdown). With requireAcceptance, **[Accept Privacy Policy]** records acceptance and proceeds.

---

### TC-J04 · Liability Disclaimer view (read-only + retry)

**Ref:** FLOW-33 · LiabilityDisclaimerScreen
**Actors:** test-buyer

**Objective:** Verify the disclaimer is read-only with a retry on error.

**Steps:**
1. Open Settings → **Liability Disclaimer**; simulate a load failure and tap **[Retry]**.

**Expected Result:**
- Header "Disclaimer" with a warning icon, title, last-updated date, and markdown content; no acceptance buttons. On error, a warning + **[Retry]** reloads.

---

### TC-J05 · Policy versioning — re-acceptance on new version

**Ref:** FLOW-31/32 · admin policies
**Actors:** test-admin + test-buyer

**Objective:** Verify publishing a new policy version re-prompts acceptance.

**Steps:**
1. As **test-admin**, publish a new TOS (and Privacy) version.
2. As **test-buyer** who accepted the previous version, trigger the acceptance check.

**Expected Result:**
- The user is treated as not having accepted the current version and is prompted to accept the new one; after accepting, the check passes.

## Group K — Privacy & Security / MFA

### TC-K01 · MFA factors list + enrollment entry points

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

### TC-K02 · Enroll and verify an authenticator factor

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

### TC-K03 · Protected action prompts MFA challenge + invalid code handling

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

### TC-K04 · Recovery path and remove verified factor

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

### TC-L01 · Render-time error shows fallback instead of red/white screen

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

### TC-L02 · Try Again recovers after transient error

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

### TC-L03 · Persistent error stays contained to fallback

**Ref:** FLOW-21 · repeated error containment
**Actors:** test-buyer

**Objective:** Verify repeated failures do not escape the fallback boundary.

**Steps:**
1. Trigger a persistent QA error.
2. On the fallback screen, tap **Try Again** without removing the fault.

**Expected Result:**
- The fallback reappears instead of the app crashing or showing a native red/white screen.
- The app remains contained to the failing surface and stays usable after backing out or navigating away if supported.

### TC-L04 · Error reporting is safe with and without telemetry

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

### TC-R01 · Logout from Settings clears session
**Objective:** Confirm sign-out fully clears the session and returns to login.
**Steps:** 1. Sign out from Settings; relaunch the app.
**Expected Result:** The app opens at login/landing, not an authenticated screen.

### TC-R02 · Profile edits persist after relaunch
**Objective:** Confirm saved profile edits persist beyond the optimistic patch.
**Steps:** 1. Edit profile, save, relaunch the app, reopen Profile.
**Expected Result:** The saved values persist.

### TC-R03 · Notification preference respected end-to-end
**Objective:** Confirm disabling a category's push stops that push.
**Steps:** 1. Disable push for one category; trigger an event of that category.
**Expected Result:** No push is delivered for that category (other channels per their toggles).

### TC-R04 · Legal links reachable from both Settings and onboarding
**Objective:** Confirm TOS/Privacy/Liability open from Settings and signup links.
**Steps:** 1. Open each from Settings and from the signup screen.
**Expected Result:** Both entry points open the same current policy content.

### TC-R05 · Dashboard reflects subscription state changes
**Objective:** Confirm the dashboard badge/banner updates after a subscription state change.
**Steps:** 1. Change subscription state (e.g., cancel/grace) and reopen the dashboard.
**Expected Result:** The badge and banners update to the new state.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Settings sections + rows (FLOW-02) | TC-A01 |
| Sign Out confirmation | TC-A02, TC-R01 |
| Test push rate limit / quiet hours / queued (FLOW-17) | TC-A03 |
| Settings → legal & help routing | TC-A04, TC-R04 |
| Edit profile load + optimistic save | TC-B01, TC-R02 |
| Email change re-verification | TC-B02 |
| Phone change OTP modal | TC-B03 |
| Avatar upload | TC-B04 |
| Profile stats/badges/reviews/status | TC-B05 |
| Linked accounts layout (FLOW-01) | TC-C01 |
| Link provider with re-auth gate | TC-C02 |
| Unlink confirmation + last-method guard | TC-C03 |
| Email mismatch blocked | TC-C04 |
| Notification categories × channels (FLOW-17) | TC-D01, TC-R03 |
| Optimistic toggle revert | TC-D02 |
| Quiet hours toggle + validation | TC-D03 |
| Notification prefs empty/initialize | TC-D04 |
| Delete account consequences + password (COPPA) | TC-E01 |
| Delete wrong password blocked | TC-E02 |
| Delete two-step confirm + logout | TC-E03 |
| Suspended account gate (FLOW-34) | TC-F01 |
| Unsubscribe email token success/error (FLOW-17) | TC-F02 |
| Offline screen + retry | TC-F03 |
| Dashboard greeting + badge + SP (FLOW-16) | TC-G01, TC-R05 |
| Dashboard banner priority | TC-G02 |
| Dashboard quick-action routing | TC-G03 |
| Dashboard ID verification CTA | TC-G04 |
| Dashboard recommendations + recent trade | TC-G05 |
| Dashboard pull-to-refresh | TC-G06 |
| Help & Support menu routing (FLOW-19) | TC-H01 |
| FAQ search + category filter | TC-H02 |
| FAQ offline fallback | TC-H03 |
| FAQ detail helpful vote | TC-H04 |
| Contact Support form + validation | TC-H05 |
| Education sections accordion + deep link | TC-I01 |
| SP Calculator sell/buy outputs | TC-I02 |
| SP Calculator bonus badge | TC-I03 |
| SP Calculator price validation | TC-I04 |
| Education analytics events (FLOW-EDU-001) | TC-I05 |
| TOS view + last updated (FLOW-31) | TC-J01 |
| TOS acceptance flow | TC-J02 |
| Privacy Policy view + acceptance (FLOW-32) | TC-J03 |
| Liability Disclaimer read-only + retry (FLOW-33) | TC-J04 |
| Policy versioning re-acceptance | TC-J05 |
