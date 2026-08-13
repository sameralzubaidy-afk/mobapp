# STAGING — New Test Cases (Auth / Password Recovery)

> **STATUS: DRAFT — DO NOT MERGE into the canonical file without explicit per-batch approval.**
> **Target canonical file:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
> **Drafted:** 2026-08-13 · grounded against current source (`p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx`, `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`).
> **Entry format:** matches the AUTH file convention — `### TC-XXX · Description` heading, then `**Actors:**`, `**Objective:**`, numbered `**Steps:**`, bulleted `**Expected Result:**`. No `Ref:` line (this file does not use one).
> **Merge instructions:** append Group B rows to the existing `## Group B — Login & Session Restore` section; insert the new `## Group S — Password Recovery` section after Group Q (before the non-indexed "Regression checks" section); add the corresponding rows to the top-of-file `Test Case Index` table.
> **NOTE (merged 2026-08-13):** the group letter is **S**, not R — the file's existing non-indexed "Regression checks" section already uses `TC-R01–R06`, so "Password Recovery" was renamed to Group S (`TC-S01–S11`).

---

## Index addendum (rows to add to the `Test Case Index` table)

| Group | TC# | Description |
|---|---|---|
| **B — Login & Session Restore** | TC-B07 | Empty-field + invalid-email inline validation |
| | TC-B08 | ACCOUNT_DELETED login branch |
| | TC-B09 | PROFILE_NOT_FOUND login branch |
| | TC-B10 | Back button returns to previous screen |
| | TC-B11 | Sign Up footer link |
| **S — Password Recovery** | TC-S01 | Forgot Password — success + Send Another Email |
| | TC-S02 | Forgot Password — invalid email |
| | TC-S03 | Forgot Password — rate-limit error |
| | TC-S04 | Forgot Password — SMTP-config (500) error |
| | TC-S05 | Forgot Password — 400 error |
| | TC-S06 | Forgot Password — Back to Login |
| | TC-S07 | Reset Password — validation + requirements card |
| | TC-S08 | Reset Password — success → Login |
| | TC-S09 | Reset Password — link-error (expired) → Request New Reset Email |
| | TC-S10 | Reset Password — no active reset session |
| | TC-S11 | Deep link `p2pkidsmarketplace://reset-password` |

---

## Group B — Login & Session Restore (additions)

### TC-B07 · Empty-field + invalid-email inline validation

**Actors:** test-free

**Objective:** Verify the Login form shows inline validation messages for empty fields and a malformed email, and does not submit.

**Steps:**
1. From the Landing screen tap **Log In**.
2. Leave **Email** and **Password** empty and tap **Log In**.
3. Enter `not-an-email` in **Email**, enter any **Password**, and tap **Log In** again.

**Expected Result:**
- With empty fields, `Email is required` shows under Email and `Password is required` shows under Password; no login request is made.
- With a malformed email, `Email is invalid` shows under Email.
- The user remains on the Login screen in both cases.

### TC-B08 · ACCOUNT_DELETED login branch

**Actors:** test-admin, test-free

**Objective:** Verify a soft-deleted account cannot log in and sees the account-deleted message.

**Steps:**
1. As **test-admin**, open the admin portal `/users`, open a test user's detail modal, and run **Delete User (Soft)** with a reason (this stages the `account_status = deleted` state).
2. As that user, attempt to log in with the same email + password.

**Expected Result:**
- The **Login Failed** modal appears with the message `Your account has been deleted. Please contact admin-support@kidsmarketplace.app.`
- The user is not signed in and stays on the Login screen.

### TC-B09 · PROFILE_NOT_FOUND login branch

**Actors:** test-free

**Objective:** Verify the profile-not-found error branch renders its message.

> **Precondition flag:** this branch requires an auth user whose profile row is missing/never created, which cannot currently be staged from the admin UI alone. Use a seeded QA account in this state, or mark as deferred if no such seed exists.

**Steps:**
1. Attempt to log in with the credentials of an account that authenticates but has no profile record.

**Expected Result:**
- The **Login Failed** modal appears with `Profile not found. Please contact support.`
- The user is not signed in.

### TC-B10 · Back button returns to previous screen

**Actors:** test-free

**Objective:** Verify the Login screen back button returns to the prior screen without logging in.

**Steps:**
1. From the Landing screen tap **Log In**.
2. Tap the back arrow (←) at the top-left of the Login screen.

**Expected Result:**
- The app returns to the Landing screen (or whichever screen opened Login); no session is created.

### TC-B11 · Sign Up footer link

**Actors:** test-free

**Objective:** Verify the footer Sign Up link opens account creation.

**Steps:**
1. From the Login screen, tap **Sign Up** in the `Don't have an account?` footer.

**Expected Result:**
- The app navigates to the **Create Account** (Signup) screen.

---

## Group S — Password Recovery

### TC-S01 · Forgot Password — success + Send Another Email

**Actors:** test-free

**Objective:** Verify a valid email triggers the reset-email send and shows the "Check Your Inbox" success state, and that "Send Another Email" returns to the form.

**Steps:**
1. On the Login screen tap **Forgot Password?**.
2. Enter a valid email address and tap **Send Reset Link**.
3. On the success screen, tap **Send Another Email**.

**Expected Result:**
- The title changes to **Check Your Inbox** with the subtitle `Check your inbox! If you have an account with us, you'll find a link to reset your password. Don't forget to check your spam folder if you don't see it in a few minutes.` (the message does not disclose whether the account exists).
- A reset email arrives containing a `p2pkidsmarketplace://reset-password` link.
- Tapping **Send Another Email** returns to the email form with the field cleared.

### TC-S02 · Forgot Password — invalid email

**Actors:** test-free

**Objective:** Verify an invalid email is rejected and the button is disabled when the field is empty.

**Steps:**
1. Open the Forgot Password screen and observe **Send Reset Link** with an empty Email field.
2. Enter `abc` and tap **Send Reset Link**.

**Expected Result:**
- With the Email field empty, **Send Reset Link** is disabled.
- With `abc`, an alert titled **Invalid Email** shows `Please enter a valid email address`; no request is sent.

### TC-S03 · Forgot Password — rate-limit error

**Actors:** test-free

**Objective:** Verify a rate-limited reset request shows the friendly retry guidance.

> **Precondition flag:** requires triggering Supabase Auth's reset-email rate limit (repeated rapid requests on the same address).

**Steps:**
1. Trigger password-reset requests for the same address until Supabase returns the rate-limit error.

**Expected Result:**
- An alert titled **Reset Email Failed** shows `You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes.`
- The alert has an **Open Supabase Docs** button and an **OK** button.

### TC-S04 · Forgot Password — SMTP-config (500) error

**Actors:** test-free

**Objective:** Verify the error alert surfaces SMTP/redirect-URL troubleshooting guidance on a 500-class error.

> **Precondition flag:** requires the staging Supabase Auth email provider to be misconfigured (SMTP off / redirect URL not allowed) to produce a `status >= 500` or "error sending recovery" response.

**Steps:**
1. Attempt to send a reset email while the Supabase Auth SMTP configuration is broken.

**Expected Result:**
- An alert titled **Reset Email Failed** shows the base error message followed by:
  - `Possible causes: • SMTP/email provider not configured in Supabase Auth • Redirect URL not allowed in Auth settings`
  - `Check Supabase Auth > Email Settings and Email Logs.`
- The alert has **Open Supabase Docs** and **OK** buttons.

### TC-S05 · Forgot Password — 400 error

**Actors:** test-free

**Objective:** Verify the error alert appends account-guidance on a 400 response.

> **Precondition flag:** requires staging conditions that produce a `status === 400` (e.g., email auth temporarily disabled).

**Steps:**
1. Attempt to send a reset email under the condition that yields a 400 response.

**Expected Result:**
- An alert titled **Reset Email Failed** shows the base error message followed by `Check that the email you entered is correct and belongs to an account.`
- The alert has **Open Supabase Docs** and **OK** buttons.

### TC-S06 · Forgot Password — Back to Login

**Actors:** test-free

**Objective:** Verify the Back to Login link returns to the Login screen from both the form and the success state.

**Steps:**
1. Open Forgot Password and tap **Back to Login**.
2. Repeat, after reaching the **Check Your Inbox** success state, tapping **Back to Login** there.

**Expected Result:**
- In both cases the app returns to the Login screen.

### TC-S07 · Reset Password — validation + requirements card

**Actors:** test-free

**Objective:** Verify password validation (length, complexity, mismatch) and the requirements card.

**Steps:**
1. Open the Reset Password screen (via a valid reset link).
2. Observe the **Password Requirements:** card.
3. Enter `short` in **New Password** and tap **Reset Password**.
4. Enter `lowercase1` (no uppercase) and tap **Reset Password**.
5. Enter a valid `Password123` in New Password and `Password124` in **Confirm Password**, then tap **Reset Password**.

**Expected Result:**
- The requirements card lists: `• At least 8 characters · • Contains uppercase letter · • Contains lowercase letter · • Contains number`.
- Short password → inline error `Password must be at least 8 characters`.
- No-uppercase password → inline error `Password must contain uppercase, lowercase, and number`.
- Mismatched confirm → inline error `Passwords do not match`.
- The **Reset Password** button is disabled while either field is empty.

### TC-S08 · Reset Password — success → Login

**Actors:** test-free

**Objective:** Verify a valid reset updates the password and routes to Login.

**Steps:**
1. Open the Reset Password screen from a valid reset link.
2. Enter a new password matching all requirements in **New Password** and the same value in **Confirm Password**.
3. Tap **Reset Password**.
4. On the success alert tap **OK**, then log in with the new password.

**Expected Result:**
- An alert titled **Success!** shows `Your password has been reset successfully.`
- Tapping **OK** navigates to the Login screen.
- The new password authenticates successfully.

### TC-S09 · Reset Password — link-error (expired) → Request New Reset Email

**Actors:** test-free

**Objective:** Verify an expired reset link shows the Link Error card and the request-new-email path.

**Steps:**
1. Open the app via an expired reset link (a URL whose hash contains `error=…&error_description=…expired`).

**Expected Result:**
- A **Link Error** card shows `This reset link has expired. Please request a new password reset email.`
- The card's **Request New Reset Email** button navigates to the Forgot Password screen.

### TC-S10 · Reset Password — no active reset session

**Actors:** test-free

**Objective:** Verify that submitting without a valid reset session blocks the update with a clear message.

**Steps:**
1. Open the Reset Password screen without a valid reset session (no access/refresh token in the link).
2. Enter a valid new password + matching confirm and tap **Reset Password**.

**Expected Result:**
- An alert titled **No active reset session** shows `This link does not provide a valid reset session. Please request a new password reset email.`
- The password is not changed.

### TC-S11 · Deep link `p2pkidsmarketplace://reset-password`

**Actors:** test-free

**Objective:** Verify the `p2pkidsmarketplace://reset-password` deep link opens the Reset Password screen, and that token/error fragments are handled.

**Steps:**
1. With the app installed (cold), open the deep link without a token fragment — iOS: `xcrun simctl openurl booted "p2pkidsmarketplace://reset-password"`; Android: `adb shell am start -a android.intent.action.VIEW -d "p2pkidsmarketplace://reset-password"`.
2. Open the app via a reset link whose URL hash contains `access_token`/`refresh_token` (the link from the reset email).
3. Open the app via a reset link whose URL hash contains `error=…&error_description=…` (an expired/used link).

**Expected Result:**
- Case 1: the **Reset Password** screen opens with the New Password / Confirm Password form and requirements card.
- Case 2: the tokens establish the reset session; the user can set a new password (no "No active reset session" alert on submit).
- Case 3: the **Link Error** card appears with the applicable message.
