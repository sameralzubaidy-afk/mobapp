# STAGING — New Test Cases (Account / Dashboard / Help / Legal)

> **STATUS: DRAFT — DO NOT MERGE into the canonical file without explicit per-batch approval.**
> **Target canonical file:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`
> **Drafted:** 2026-08-13 · grounded against current source (`p2p-kids-marketplace/src/screens/profile/EditProfileScreen.tsx` re-read this session; `SettingsScreen.tsx`, `dashboard/UserDashboardScreen.tsx`, `auth/SuspendedAccountScreen.tsx` read this session via exploration).
> **Entry format:** matches this file's convention — `### TC-XXX · Description` heading, then `**Ref:**`, `**Actors:**`, `**Objective:**`, numbered `**Steps:**`, bulleted `**Expected Result:**`.
> **Merge instructions:** append `A05` to Group A, `B06–B10` to Group B, `F04` to Group F, `G07–G13` to Group G, in both index and body.

---

## Index addendum (rows to add to the `Test Case Index` table)

| Group | TC# | Description |
|---|---|---|
| **A — Settings Hub** | TC-A05 | "Manage Payment Methods" row navigates |
| **B — Edit Profile** | TC-B06 | Form validation (phone 10-digit, email format) |
| | TC-B07 | "No Changes" alert |
| | TC-B08 | Waitlist prompt (unreachable from Edit Profile — flag) |
| | TC-B09 | "Already verified" phone path |
| | TC-B10 | Locked-field "cannot be changed" alerts |
| **F — Suspended / Unsubscribe / Offline** | TC-F04 | Suspended account — Log Out tap |
| **G — Home Dashboard** | TC-G07 | "Show more actions" toggle |
| | TC-G08 | Free-user "Unlock Swap Points" strip |
| | TC-G09 | "No session found" state |
| | TC-G10 | Empty-trade state |
| | TC-G11 | "View Timeline" nav |
| | TC-G12 | "See All" → Discover nav |
| | TC-G13 | Subscription-card Upgrade button |

---

## Group A — Settings Hub (additions)

### TC-A05 · "Manage Payment Methods" row navigates

**Ref:** FLOW-02 · SettingsScreen
**Actors:** test-buyer

**Objective:** Verify the Manage Payment Methods row opens the Payment Methods screen.

**Steps:**
1. Open **Settings** and tap **Manage Payment Methods** (Account section).

**Expected Result:**
- Navigates to the **Payment Methods** screen (route `PaymentMethods` → `PaymentMethodsScreen`).
- **Note:** the row is already listed in TC-A01's expected Account section; this case verifies the navigation itself.

---

## Group B — Edit Profile (additions)

### TC-B06 · Form validation (phone 10-digit, email format)

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

### TC-B07 · "No Changes" alert

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify saving with no changes shows the No Changes alert.

**Steps:**
1. Open **Edit Profile**, make no changes, and tap **Save Changes**.

**Expected Result:**
- Alert **No Changes** reads `No changes were made to your profile.`; tapping **OK** returns to Profile.

### TC-B08 · Waitlist prompt (unreachable from Edit Profile — flag)

**Ref:** FLOW-02 · EditProfileScreen · `updateUserProfile.needsWaitlist`
**Actors:** test-buyer

**Objective:** Document the waitlist-prompt code path and its current reachability.

**Steps:**
1. On **Edit Profile**, attempt to change the ZIP code.

**Expected Result:**
- The ZIP field renders **ZIP CODE (CANNOT BE CHANGED)** with `editable={false}` and the helper `Zip codes are locked to your node.` — it cannot be edited.
- Because ZIP cannot change, the `needsWaitlist` path (alert **Area Not Yet Available** / `We're not live in your area ({zip}) yet! Would you like to join the waitlist to be notified when we launch?` → **Join Waitlist** → `Added to Waitlist!` / `We'll notify you when we launch.`) never fires from this screen.
- **Flag:** this is effectively dead code on this screen; the waitlist prompt is more likely exercised from onboarding/signup where ZIP is first entered.

### TC-B09 · "Already verified" phone path

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify the no-OTP path when the entered phone is already verified.

**Steps:**
1. On **Edit Profile**, change the phone to a number that is already verified on the account, then save.

**Expected Result:**
- Alert **Info** reads `This phone number is already verified and active on your account.`
- No **Verify Your Phone** modal appears; the phone is saved without re-verification.

### TC-B10 · Locked-field "cannot be changed" alerts

**Ref:** FLOW-02 · EditProfileScreen
**Actors:** test-buyer

**Objective:** Verify the locked-field labels and their contact-support affordances.

**Steps:**
1. Tap the **Question** icon next to **FULL NAME (CANNOT BE CHANGED)**.
2. Tap the **Question** icon next to **DATE OF BIRTH (CANNOT BE CHANGED)**.
3. Observe the ZIP field.

**Expected Result:**
- Full Name and Date of Birth each show alert **Contact Support** / `For profile help, contact admin-support@kidsmarketplace.app.`
- Full Name and Date of Birth inputs are disabled (`editable={false}`).
- ZIP renders **ZIP CODE (CANNOT BE CHANGED)** with the helper `Zip codes are locked to your node.` (no Question icon).

---

## Group F — Suspended / Unsubscribe / Offline (additions)

### TC-F04 · Suspended account — Log Out tap

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

## Group G — Home Dashboard (additions)

### TC-G07 · "Show more actions" toggle

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the Action Items expand/collapse toggle.

**Steps:**
1. On the Home dashboard with more actions than the initial limit, tap **Show {n} more action(s)**.
2. Tap **Show less**.

**Expected Result:**
- Tapping expands the Action Items list; the label changes to **Show less**.
- Tapping **Show less** collapses back to the initial set.

### TC-G08 · Free-user "Unlock Swap Points" strip

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

### TC-G09 · "No session found" state

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the dashboard's no-session fallback.

**Steps:**
1. Render Home without an authenticated session.

**Expected Result:**
- Shows `No session found. Please log in.` instead of a blank or crashed screen.

### TC-G10 · Empty-trade state

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer (no active trades)

**Objective:** Verify the empty-trade message.

**Steps:**
1. As a user with no active trades, open Home.

**Expected Result:**
- The recent-trade area shows `No active trades right now`.

### TC-G11 · "View Timeline" nav

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer (with a recent trade)

**Objective:** Verify the View Timeline button opens the trade timeline.

**Steps:**
1. On the recent trade card, tap **View Timeline**.

**Expected Result:**
- Navigates to **TradeTimeline** for that trade (`tradeId`).

### TC-G12 · "See All" → Discover nav

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-buyer

**Objective:** Verify the See All link opens Discover.

**Steps:**
1. In **Recommended for You**, tap **See All**.

**Expected Result:**
- Navigates to the **Discover** screen.

### TC-G13 · Subscription-card Upgrade button

**Ref:** FLOW-16 · UserDashboardScreen
**Actors:** test-free

**Objective:** Verify the subscription card's upgrade CTA for free users.

**Steps:**
1. As **test-free**, on the subscription card tap **Upgrade to Kids Club+**.

**Expected Result:**
- Navigates to **JoinKidsClub**.
- (The upgrade button only appears for free users.)
