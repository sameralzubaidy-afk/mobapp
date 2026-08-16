# Auth · Onboarding · Nodes · Listing · Discovery — Manual Testing Guide

**Source of truth:** `Prompts/Done/MODULE-02-AUTHENTICATION.md` · `Prompts/MODULE-03-AUTH-V2.md` · `Prompts/V3/MODULE-03-AUTH-V3-SOCIAL-LOGIN.md` · `Prompts/MODULE-03-NODE-MANAGEMENT.md` · `Prompts/V3/MODULE-04-ITEM-LISTING-V3.md` · `Prompts/Done/MODULE-05-DISCOVERY-V2.md` · `docs/flow-registry.md`
**Flows covered:** FLOW-01 (Signup/Login/Logout/Session Restore) · FLOW-02 (Profiles & Onboarding) · FLOW-03 (Node/ZIP Gating + Waitlist) · FLOW-04 (Listings — Create/Bulk/Pending) · FLOW-04C (Category SP Calculations & Bonus Badges) · FLOW-05 (Media Upload / Storage) · FLOW-06 (Discovery — Feed/Search/Filters/Favorites) · FLOW-30 (Global App Shell — Header, Floating Nav & Home Composer)
**Last updated:** 2026-08-16
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Signup (Email/Password)** | AUTH-TC-A01 | Successful signup with valid details |
| | AUTH-TC-A02 | Field validation errors (name/email/phone/password) |
| | AUTH-TC-A03 | Password mismatch + weak password |
| | AUTH-TC-A04 | Under-18 date of birth blocked |
| | AUTH-TC-A05 | Duplicate email blocked |
| | AUTH-TC-A06 | Optional referral code (valid / invalid handling) |
| | AUTH-TC-A07 | Terms of Service & Privacy Policy links |
| | AUTH-TC-A08 | Landing footer legal links (Terms / Privacy Policy) |
| **B — Login & Session Restore** | AUTH-TC-B01 | Successful login routes by onboarding status |
| | AUTH-TC-B02 | Invalid credentials error |
| | AUTH-TC-B03 | Forgot Password link |
| | AUTH-TC-B04 | Session restore after app kill/relaunch |
| | AUTH-TC-B05 | App resume refreshes silently (no spinner) |
| | AUTH-TC-B06 | Cold launch does not hang on spinner |
| | AUTH-TC-B07 | Empty-field + invalid-email inline validation |
| | AUTH-TC-B08 | ACCOUNT_DELETED login branch |
| | AUTH-TC-B09 | PROFILE_NOT_FOUND login branch |
| | AUTH-TC-B10 | Back button returns to previous screen |
| | AUTH-TC-B11 | Sign Up footer link |
| | AUTH-TC-B12 | Log In footer link (Create Account) |
| **C — Social Login** | AUTH-TC-C01 | Sign in / Continue with Google |
| | AUTH-TC-C02 | Sign in / Continue with Facebook |
| | AUTH-TC-C03 | Sign in / Continue with Apple (iOS + Android) |
| | AUTH-TC-C04 | Existing-email account-link prompt |
| | AUTH-TC-C05 | Provider unavailable → email fallback banner |
| | AUTH-TC-C06 | User cancels OAuth — silent return |
| | AUTH-TC-C07 | Social-only user sets a password |
| **D — Logout** | AUTH-TC-D01 | Logout from Profile with confirmation |
| | AUTH-TC-D02 | Sign Out from Settings |
| | AUTH-TC-D03 | After logout, app returns to Landing |
| **E — Phone Verification (Deferred Gate)** | AUTH-TC-E01 | OTP screen sends + verifies 6-digit code |
| | AUTH-TC-E02 | Incomplete / invalid / expired code errors |
| | AUTH-TC-E03 | Resend cooldown (60s) |
| | AUTH-TC-E04 | OTP rate limiting message |
| | AUTH-TC-E05 | Gate blocks first listing until verified |
| **F — Node/ZIP Gating & Waitlist (End User)** | AUTH-TC-F01 | Active ZIP → assigned to node, no waitlist |
| | AUTH-TC-F02 | Inactive ZIP → "We're Coming Soon!" + Join Waitlist |
| | AUTH-TC-F03 | Waitlist confirmation + fallback node access |
| | AUTH-TC-F04 | Continue Trading without joining waitlist |
| | AUTH-TC-F05 | ZIP auto-lookup shows city/state |
| | AUTH-TC-F06 | Node-scoped content (My Node vs Show All Nodes) |
| **G — Node Management (Admin)** | AUTH-TC-G01 | Admin creates an active node (ZIP auto-lookup) |
| | AUTH-TC-G02 | Admin creates an inactive node |
| | AUTH-TC-G03 | Admin edits a node |
| | AUTH-TC-G04 | Admin deactivates a node with members (warning) |
| | AUTH-TC-G05 | Admin reactivates a node |
| | AUTH-TC-G06 | Node stats cards + validation |
| **H — Profile Setup & Onboarding** | AUTH-TC-H01 | Profile Setup: avatar + display name + ZIP |
| | AUTH-TC-H02 | Profile Setup validation errors |
| | AUTH-TC-H03 | Avatar upload failure does not block |
| | AUTH-TC-H04 | Welcome screen → Get Started |
| | AUTH-TC-H05 | Feature Highlights carousel |
| | AUTH-TC-H06 | Onboarding carousel: Next / Skip / Get Started |
| | AUTH-TC-H07 | Onboarding completion routes to Home |
| **I — Subscription Choice (Onboarding)** | AUTH-TC-I01 | Start Free Trial enrolls Kids Club+ |
| | AUTH-TC-I02 | Continue Free stays on free tier |
| | AUTH-TC-I03 | Trial limit reached hides trial CTA |
| **J — Listing Creation (Single Item)** | AUTH-TC-J01 | Photo-first gating (fields hidden until 1 photo) |
| | AUTH-TC-J02 | AI auto-fill Apply All + per-field Use |
| | AUTH-TC-J03 | Required field validation |
| | AUTH-TC-J04 | Condition / Age Group / Gender / Color options |
| | AUTH-TC-J05 | "Other" category → custom name required |
| | AUTH-TC-J06 | Payment preference — subscriber Accept SP toggle |
| | AUTH-TC-J07 | Payment preference — free user upgrade prompt |
| | AUTH-TC-J08 | SP earnings preview (subscriber) |
| | AUTH-TC-J09 | Submit for Review → pending + success modal |
| | AUTH-TC-J10 | Phone-verification gate before publish |
| | AUTH-TC-J11 | Draft auto-save + resume |
| | AUTH-TC-J12 | Listing photos — multiple upload, type and size validation |
| | AUTH-TC-J13 | Listing photos — remove, reorder, replace, and persist after resume |
| | AUTH-TC-J14 | Bonus category badge appears in picker and preview |
| | AUTH-TC-J15 | Category-specific SP earn and buyer-cap preview recalculates |
| **K — Bulk Listing Creation** | AUTH-TC-K01 | Multi-photo upload + auto-grouping |
| | AUTH-TC-K02 | Regroup / merge / move photos |
| | AUTH-TC-K03 | Step indicator: Photos → Group → Review → Publish |
| | AUTH-TC-K04 | Apply to All bar (brand/condition/age/gender) |
| | AUTH-TC-K05 | Submit N Items for Review + confirm sheet |
| | AUTH-TC-K06 | Bulk SP summary (subscriber) |
| **L — Admin Review / Pending** | AUTH-TC-L01 | New listing not visible in feed until approved |
| | AUTH-TC-L02 | Admin approves → item becomes visible |
| | AUTH-TC-L03 | Seller receives approval notification |
| | AUTH-TC-L04 | Editing an approved listing returns to pending |
| **M — Discovery: Search & Filters** | AUTH-TC-M01 | Search bar (debounced) + clear |
| | AUTH-TC-M02 | Recent searches + autocomplete |
| | AUTH-TC-M03 | Sort options |
| | AUTH-TC-M04 | Filters modal: SP toggle, Location/Category/Age, More Filters, live count |
| | AUTH-TC-M05 | "Accepts SP" quick-toggle (header ↔ sheet sync) |
| | AUTH-TC-M06 | Empty / no-results states |
| | AUTH-TC-M07 | Recent Searches chip row + Clear |
| | AUTH-TC-M08 | Trending in {State} section |
| | AUTH-TC-M09 | Result count + active filter chips (incl. gold SP chip) |
| | AUTH-TC-M10 | Discover header: bookmark → Favorites (local header) |
| **N — Discovery: Category & Favorites** | AUTH-TC-N01 | Category browse filters results |
| | AUTH-TC-N02 | Favorite heart toggle on item card |
| | AUTH-TC-N03 | Infinite scroll pagination |
| | AUTH-TC-N04 | "Accepts SP" badge on item card (gold, §6.7) |
| **O — Discovery: Node Scoping & SP Visibility** | AUTH-TC-O01 | Results scoped to user's node |
| | AUTH-TC-O02 | Location ZIP + radius filter |
| | AUTH-TC-O03 | Inactive ZIP in filter → waitlist prompt |
| | AUTH-TC-O04 | Subscriber vs free SP visibility |
| | AUTH-TC-O05 | Admin radius defaults and bounds reflect in Discover |
| **P — Global Header, Floating Nav & Home Composer** | AUTH-TC-P01 | Header node chip shows registered market (read-only) |
| | AUTH-TC-P02 | Header right cluster: bell + chat + avatar; logout removed from header |
| | AUTH-TC-P03 | Header chat icon opens Messages with unread badge |
| | AUTH-TC-P04 | Floating pill nav: order, margins, radius, shadow, safe area |
| | AUTH-TC-P05 | Inbox removed from nav; Messages via header chat only |
| | AUTH-TC-P06 | Trades tab: Active Trades (item, counterpart, status label) |
| | AUTH-TC-P07 | Trades tab: Trade History (reverse chronological) |
| | AUTH-TC-P08 | Trades badge counts active (not completed/cancelled) |
| | AUTH-TC-P09 | Basket badge + Home active state unchanged |
| | AUTH-TC-P10 | Post FAB globally visible + opens Sell sheet |
| | AUTH-TC-P11 | Composer bar: tap focuses, type, placeholder |
| | AUTH-TC-P12 | Composer "+" → New Item Photos step, Title pre-filled |
| | AUTH-TC-P13 | Composer empty submit → empty Title |
| | AUTH-TC-P14 | Composer camera → New Item straight to camera |
| | AUTH-TC-P15 | AI never overwrites composer-pre-filled Title |
| | AUTH-TC-P16 | FAB Sell sheet unchanged (parallel entry point) |
| | AUTH-TC-P17 | Logout still reachable from Profile/Settings |
| | AUTH-TC-P18 | Composer analytics (tap + submit with/without text) |
| | AUTH-TC-P19 | Accessibility identifiers (Trades tab, header chat) |
| **Q — Trading Education (End User)** | AUTH-TC-Q01 | Education Help screen — published sections only |
| | AUTH-TC-Q02 | Education Help screen — section by type |
| | AUTH-TC-Q03 | SP calculator — sell mode (no hardcoded rates) |
| | AUTH-TC-Q04 | SP calculator — buy mode (cash + fee + cap) |
| | AUTH-TC-Q05 | SP calculator — bonus categories + example SP |
| | AUTH-TC-Q06 | Education analytics — event tracking (no throw) |
| | AUTH-TC-Q07 | Education prompts — onboarding + in-app prompt state machine |
| **S — Password Recovery** | AUTH-TC-S01 | Forgot Password — success + Send Another Email |
| | AUTH-TC-S02 | Forgot Password — invalid email |
| | AUTH-TC-S03 | Forgot Password — rate-limit error |
| | AUTH-TC-S04 | Forgot Password — SMTP-config (500) error |
| | AUTH-TC-S05 | Forgot Password — 400 error |
| | AUTH-TC-S06 | Forgot Password — Back to Login |
| | AUTH-TC-S07 | Reset Password — validation + requirements card |
| | AUTH-TC-S08 | Reset Password — success → Login |
| | AUTH-TC-S09 | Reset Password — link-error (expired) → Request New Reset Email |
| | AUTH-TC-S10 | Reset Password — no active reset session |
| | AUTH-TC-S11 | Deep link `p2pkidsmarketplace://reset-password` |

---

## Pre-conditions (set up before testing)

- The app is installed and running on an iOS Simulator and/or Android Emulator pointed at the staging environment.
- The admin portal is reachable in a browser and you can log in as an admin.
- At least one **active** node exists with a known ZIP code (e.g., Norwalk, CT — ZIP `06850`).
- At least one **inactive** node (or a ZIP with no active node, e.g., `07999`) exists so waitlist behavior can be tested.
- For social login: Google/Facebook/Apple providers are enabled in the auth provider settings and a test provider account is available.
- For phone verification in DEV: the SMS bypass code `123456` is available, or a real phone number that can receive SMS.
- For listing/discovery: a subscriber test account and a free test account both exist and have completed onboarding in an active node.
- For listing media tests: sample JPG/PNG/WebP images under 5MB, one image over 5MB, and one unsupported file type are available on the test device.
- For category bonus tests: at least one active category with `sp_earning_multiplier > 1.10` exists so the bonus badge and category-specific SP preview can be verified.

## Accounts for testing

| Account | Role / tier | Notes |
|---|---|---|
| new-user | Fresh email, no account | Used for signup, onboarding, ZIP/waitlist tests |
| test-buyer | Kids Club+ subscriber | Completed onboarding; in an active node |
| test-free | Free tier | Completed onboarding; in an active node |
| test-seller | Kids Club+ subscriber | Has phone verified; used for listing creation |
| admin | Admin portal | Manages nodes and listing approvals |

> All tests are screen-driven. No SQL or direct database access is required.

---

## Group A — Signup (Email/Password)

### AUTH-TC-A01 · Successful signup with valid details

**Actors:** new-user

**Objective:** Verify a new user can sign up with valid details and is routed to phone verification.

**Steps:**
1. Launch the app and tap **Sign Up** from the Landing screen.
2. On **Create Account**, enter a valid Full Name, Email Address, Phone Number, Date of Birth (age 18+), Password, and matching Confirm Password.
3. Tap **Sign Up**.

**Expected Result:**
- The header reads "Create Account" with the subheading "Join the P2P Kids Marketplace community".
- No validation errors appear for valid input.
- After submitting, the app navigates to the **Verify Your Phone** screen showing the entered phone number.

### AUTH-TC-A02 · Field validation errors

**Actors:** new-user

**Objective:** Verify inline validation for required fields.

**Steps:**
1. On **Create Account**, leave fields blank or enter invalid values: a 1-character name, an invalid email (`abc`), a 5-digit phone, and a weak password.
2. Attempt to submit.

**Expected Result:**
- Inline red errors appear under the relevant fields, e.g., "Name must be at least 2 characters", "Please enter a valid email address", "Please enter a valid phone number (10+ digits)", and password rule errors ("at least 8 characters", "one uppercase letter", "one lowercase letter", "one number").
- Submission is blocked until errors are resolved.

### AUTH-TC-A03 · Password mismatch and weak password

**Actors:** new-user

**Objective:** Verify password confirmation and strength rules.

**Steps:**
1. Enter a password and a different value in Confirm Password; attempt to submit.
2. Then set a weak password (e.g., `abc`) and submit.

**Expected Result:**
- "Passwords do not match" appears when the two fields differ.
- Password strength errors appear for weak passwords and submission is blocked.

### AUTH-TC-A04 · Under-18 date of birth blocked

**Actors:** new-user

**Objective:** Verify the 18+ age gate.

**Steps:**
1. In the date-of-birth picker, choose a date that makes the user younger than 18.
2. Attempt to submit.

**Expected Result:**
- An error appears: "Sorry, you must be 18 years old to register." (or equivalent), and signup is blocked.

### AUTH-TC-A05 · Duplicate email blocked

**Actors:** new-user

**Objective:** Verify signing up with an already-registered email is rejected.

**Steps:**
1. Enter the email of an existing account and complete the rest of the form.
2. Tap **Sign Up**.

**Expected Result:**
- A message appears: "This email is already registered. Please log in instead." and no new account is created.

### AUTH-TC-A06 · Optional referral code

**Actors:** new-user

**Objective:** Verify referral code is optional and invalid codes are handled gracefully.

**Steps:**
1. Enter a valid 8-character referral code and complete signup.
2. In a separate attempt, enter an invalid referral code and submit.

**Expected Result:**
- A valid code is accepted and signup proceeds.
- An invalid code shows a prompt like "The referral code you entered is invalid. Would you like to fix it or continue without a code?" with **Fix it** and **Continue anyway** options; choosing **Continue anyway** completes signup without a code.

### AUTH-TC-A07 · Terms and Privacy links

**Actors:** new-user

**Objective:** Verify the legal links are present and open.

**Setup:**
- App on Landing, unauthenticated. Navigate: Landing → **Create Account** (Get Started). Scroll the signup form to the bottom so the legal line is fully visible.

**Steps:**
1. On the **Create Account** screen, tap **Terms of Service**, then **Privacy Policy**.

**Expected Result:**
- Each link opens the corresponding policy content.
- On successful signup, the current Terms and Privacy acceptances are recorded for the user.

**Assert:**
- Tapping **Terms of Service** (`signup-terms-of-service-link`) opens the Terms content (full-screen WebView) without crashing.
- Tapping **Privacy Policy** (`signup-privacy-policy-link`) opens the Privacy content (full-screen WebView) without crashing.
- App remains responsive; returning to the form preserves entered state.

**Locator hints:**
- Screen: `src/screens/auth/SignupScreen.tsx` (instrumented 2026-08-16).
- Terms of Service → `signup-terms-of-service-link` · Privacy Policy → `signup-privacy-policy-link` · Create Account entry → `landing-signup-button`.

**Dependencies:**
- None (no native dialog). Link targets open a full-screen WebView — assert by visible content (screenshot); return via iOS edge-swipe back (no in-app close control exposed).

---

### AUTH-TC-A08 · Landing footer legal links

**Actors:** new-user

**Objective:** Verify the Landing footer legal links open the policy content.

**Setup:**
- App on Landing, unauthenticated.

**Steps:**
1. On the **Landing** screen, tap **Terms** in the footer line "By continuing, you agree to our Terms and Privacy Policy", return (iOS edge-swipe back), then tap **Privacy Policy**.

**Expected Result:**
- Each link opens the corresponding policy content without crashing.

**Assert:**
- Tapping **Terms** (`landing-terms-link`) opens the Terms content (full-screen WebView) without crashing.
- Tapping **Privacy Policy** (`landing-privacy-policy-link`) opens the Privacy content (full-screen WebView) without crashing.

**Locator hints:**
- Screen: `src/screens/auth/LandingScreen.tsx` (instrumented 2026-08-16).
- Terms → `landing-terms-link` · Privacy Policy → `landing-privacy-policy-link`.

**Dependencies:**
- None (no native dialog). Link targets open a full-screen WebView — assert by visible content (screenshot); return via iOS edge-swipe back.

---

## Group B — Login & Session Restore

### AUTH-TC-B01 · Successful login routes by onboarding status

**Actors:** test-buyer, new-user

**Objective:** Verify login routes a completed user to Home and an incomplete user to onboarding.

**Steps:**
1. From the Landing screen tap **Log In**, enter the email/password for **test-buyer**, and tap **Log In**.
2. Repeat with a user who has not finished onboarding.

**Expected Result:**
- **test-buyer** lands on the Home tabs (main app).
- A user with onboarding incomplete lands on the onboarding stack (Welcome / carousel).

### AUTH-TC-B02 · Invalid credentials error

**Actors:** test-free

**Objective:** Verify wrong credentials show a clear error.

**Steps:**
1. Enter a valid email with the wrong password and tap **Log In**.

**Expected Result:**
- "Invalid email or password." appears and the user stays on the Login screen.

### AUTH-TC-B03 · Forgot Password link

**Actors:** test-free

**Objective:** Verify the Forgot Password entry point works.

**Setup:**
- App on Landing, unauthenticated. Navigate: Landing → **Log In**.

**Steps:**
1. On the Login screen tap **Forgot Password?**.

**Expected Result:**
- The password reset flow opens.

**Assert:**
- Tapping **Forgot Password?** (`login-forgot-password-link`) navigates to the Forgot Password screen.
- Do not submit a real reset request unless a documented safe path exists — verify the entry screen appears.

**Locator hints:**
- Screen: `src/screens/auth/LoginScreen.tsx` (instrumented 2026-08-16).
- Forgot Password → `login-forgot-password-link` · Login entry → `landing-login-button`.

**Dependencies:**
- None (no native dialog). Reset-email send path intentionally not executed — verify entry screen only.

### AUTH-TC-B04 · Session restore after app kill/relaunch

**Actors:** test-buyer

**Objective:** Verify the session persists across an app restart.

**Steps:**
1. Log in as **test-buyer**.
2. Fully kill the app (swipe it away).
3. Relaunch the app.

**Expected Result:**
- The user is restored straight into the Home tabs without re-entering credentials.

### AUTH-TC-B05 · App resume refreshes silently

**Actors:** test-buyer

**Objective:** Verify resuming from background refreshes state without a blocking spinner.

**Steps:**
1. With **test-buyer** logged in, background the app, then bring it back to the foreground.

**Expected Result:**
- The app returns to the same screen; no full-screen loading spinner blocks the UI during the background refresh.

### AUTH-TC-B06 · Cold launch does not hang on spinner

**Actors:** test-buyer

**Objective:** Verify the app does not get stuck on a full-screen spinner when network/profile calls stall.

**Steps:**
1. With a slow or briefly interrupted network, cold-launch the app while logged in.

**Expected Result:**
- Within roughly 12 seconds the app stops showing the full-screen spinner and renders either the authenticated app or the unauthenticated Landing screen; it never hangs indefinitely.

### AUTH-TC-B07 · Empty-field + invalid-email inline validation

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

### AUTH-TC-B08 · ACCOUNT_DELETED login branch

**Actors:** test-admin, test-free

**Objective:** Verify a soft-deleted account cannot log in and sees the account-deleted message.

**Steps:**
1. As **test-admin**, open the admin portal `/users`, open a test user's detail modal, and run **Delete User (Soft)** with a reason (this stages the `account_status = deleted` state).
2. As that user, attempt to log in with the same email + password.

**Expected Result:**
- The **Login Failed** modal appears with the message `Your account has been deleted. Please contact admin-support@kidsmarketplace.app.`
- The user is not signed in and stays on the Login screen.

### AUTH-TC-B09 · PROFILE_NOT_FOUND login branch

**Actors:** test-free

**Objective:** Verify the profile-not-found error branch renders its message.

**Steps:**
1. Attempt to log in with the credentials of an account that authenticates but has no profile record.

**Expected Result:**
- The **Login Failed** modal appears with `Profile not found. Please contact support.`
- The user is not signed in.

### AUTH-TC-B10 · Back button returns to previous screen

**Actors:** test-free

**Objective:** Verify the Login screen back button returns to the prior screen without logging in.

**Steps:**
1. From the Landing screen tap **Log In**.
2. Tap the back arrow (←) at the top-left of the Login screen.

**Expected Result:**
- The app returns to the Landing screen (or whichever screen opened Login); no session is created.

### AUTH-TC-B11 · Sign Up footer link

**Actors:** test-free

**Objective:** Verify the footer Sign Up link opens account creation.

**Setup:**
- App on Landing, unauthenticated. Navigate: Landing → **Log In**.

**Steps:**
1. From the Login screen, tap **Sign Up** in the `Don't have an account?` footer.

**Expected Result:**
- The app navigates to the **Create Account** (Signup) screen.

**Assert:**
- Tapping **Sign Up** (`login-signup-link`) navigates to the Create Account screen.

**Locator hints:**
- Screen: `src/screens/auth/LoginScreen.tsx` (instrumented 2026-08-16).
- Sign Up → `login-signup-link` · Login entry → `landing-login-button`.

**Dependencies:**
- None (no native dialog).

---

### AUTH-TC-B12 · Log In footer link (Create Account)

**Actors:** test-free

**Objective:** Verify the Create Account footer Log In link opens the Login screen.

**Setup:**
- App on Landing, unauthenticated. Navigate: Landing → **Create Account** (Get Started). Scroll to the bottom of the signup form.

**Steps:**
1. On the **Create Account** screen, tap **Log In** in the "Already have an account? " footer.

**Expected Result:**
- The app navigates to the **Login** screen.

**Assert:**
- Tapping **Log In** (`signup-login-link`) navigates to the Login screen.

**Locator hints:**
- Screen: `src/screens/auth/SignupScreen.tsx` (instrumented 2026-08-16).
- Log In → `signup-login-link` · Create Account entry → `landing-signup-button`.

**Dependencies:**
- None (no native dialog).

---

## Group C — Social Login

### AUTH-TC-C01 · Sign in / Continue with Google

**Actors:** new-user

**Objective:** Verify Google sign-in creates a session and auto-fills the profile on first signup.

**Steps:**
1. On the Login or Signup screen tap **Continue with Google** (Signup) / **Sign in with Google** (Login).
2. Complete authentication in the Google consent screen.

**Expected Result:**
- A browser opens the Google sign-in/consent page; after success the app returns and a session is created.
- For a first-time signup, the profile name and avatar are auto-filled from Google and email verification is skipped.

### AUTH-TC-C02 · Sign in / Continue with Facebook

**Actors:** new-user

**Objective:** Verify Facebook sign-in works.

**Steps:**
1. Tap **Continue with Facebook** / **Sign in with Facebook** and complete authentication.

**Expected Result:**
- A session is created and (on first signup) the profile is auto-filled from Facebook.

### AUTH-TC-C03 · Sign in / Continue with Apple (iOS + Android)

**Actors:** new-user

**Objective:** Verify the Apple button renders on both platforms and works.

**Steps:**
1. Confirm the **Sign in with Apple** button is present on both iOS and Android.
2. Tap it and complete Apple authentication.

**Expected Result:**
- The Apple button is shown on both platforms.
- Authentication succeeds and a session is created.

### AUTH-TC-C04 · Existing-email account-link prompt

**Actors:** test-free

**Objective:** Verify linking a social provider to an existing email account is prompted safely.

**Steps:**
1. Sign in with a social provider whose email matches an existing email/password account.

**Expected Result:**
- An "Account Exists" prompt appears, e.g., "An account with {email} already exists" with an option to continue and link the provider.
- Linking requires password re-authentication when the existing account has a password.

### AUTH-TC-C05 · Provider unavailable → email fallback banner

**Actors:** new-user

**Objective:** Verify a provider outage surfaces a graceful fallback.

**Steps:**
1. Attempt social login when the provider is unavailable / times out.

**Expected Result:**
- An inline banner appears: "{Provider} is temporarily unavailable. Sign up with email instead?" with a path to email signup. The app does not crash.

### AUTH-TC-C06 · User cancels OAuth — silent return

**Actors:** new-user

**Objective:** Verify cancelling the provider screen returns quietly.

**Steps:**
1. Start a social login, then cancel/deny on the provider screen.

**Expected Result:**
- The app silently returns to the previous screen with no error toast.

### AUTH-TC-C07 · Social-only user sets a password

**Actors:** new-user (social-only)

**Objective:** Verify a social-only user can add a password and then log in with email.

**Steps:**
1. As a social-only user, open the Set Password modal (from settings/linked accounts).
2. Enter a password meeting the strength rules and confirm.
3. Log out and log in with email + the new password.

**Expected Result:**
- Live password-strength feedback is shown; mismatched confirm is rejected.
- After saving, email + password login succeeds.

---

## Group D — Logout

### AUTH-TC-D01 · Logout from Profile with confirmation

**Actors:** test-buyer

**Objective:** Verify logout from the Profile screen requires confirmation.

**Steps:**
1. Open the **Profile** screen and tap **Logout** (red).
2. Confirm in the dialog.

**Expected Result:**
- A confirmation dialog appears ("Are you sure you want to logout?") with Cancel and Logout.
- Confirming signs out and returns to the Landing screen.

### AUTH-TC-D02 · Sign Out from Settings

**Actors:** test-buyer

**Objective:** Verify the Settings sign-out path.

**Steps:**
1. Open **Settings** and tap **Sign Out**; confirm.

**Expected Result:**
- The user is signed out and returned to the Landing screen.

### AUTH-TC-D03 · After logout, app returns to Landing

**Actors:** test-buyer

**Objective:** Verify logged-out state shows no user data.

**Steps:**
1. After logging out, observe the Landing screen.

**Expected Result:**
- The Landing screen shows **Sign Up** / **Log In** and no authenticated content is accessible.

---

## Group E — Phone Verification (Deferred Gate)

### AUTH-TC-E01 · OTP screen sends and verifies a 6-digit code

**Actors:** new-user

**Objective:** Verify the phone verification screen sends a code and accepts a valid 6-digit OTP.

**Steps:**
1. Reach the **Verify Your Phone** screen (after signup).
2. Enter the 6-digit code received (or the DEV bypass `123456`).
3. Tap **Verify**.

**Expected Result:**
- The screen shows "We sent a 6-digit code to {phone}" and a 6-box OTP input.
- A valid code shows a success message and proceeds to **Complete Your Profile** (Profile Setup).

### AUTH-TC-E02 · Incomplete / invalid / expired code errors

**Actors:** new-user

**Objective:** Verify OTP error states.

**Steps:**
1. Tap **Verify** with fewer than 6 digits.
2. Enter a wrong 6-digit code and verify.
3. Wait beyond the code's validity (5 minutes) and try the old code.

**Expected Result:**
- "Please enter all 6 digits" for an incomplete code.
- "Invalid code" for a wrong code (the input clears).
- An expired-code message instructs the user to request a new code.

### AUTH-TC-E03 · Resend cooldown

**Actors:** new-user

**Objective:** Verify the resend cooldown timer.

**Steps:**
1. On the OTP screen, observe the **Resend Code** control immediately after a code is sent.

**Expected Result:**
- Resend is disabled and shows a countdown (e.g., "Resend in 59s"); it becomes enabled after 60 seconds.

### AUTH-TC-E04 · OTP rate limiting message

**Actors:** new-user

**Objective:** Verify rate limiting surfaces a clear message.

**Steps:**
1. Request codes repeatedly to exceed the limit (3 per hour per phone / 5 per day per user).

**Expected Result:**
- A message like "Too many attempts. Try again in {N} seconds." appears and further sends are blocked until the window passes.

### AUTH-TC-E05 · Gate blocks first listing until verified

**Actors:** new-user

**Objective:** Verify an unverified phone blocks publishing a listing.

**Steps:**
1. As a user who has not verified a phone, start creating a listing and attempt to publish.

**Expected Result:**
- A phone verification modal appears and publishing is blocked until verification completes; after verifying, the publish flow resumes.

---

## Group F — Node/ZIP Gating & Waitlist (End User)

### AUTH-TC-F01 · Active ZIP → assigned to node, no waitlist

**Actors:** new-user

**Precondition:** ZIP `06850` belongs to an active node.

**Objective:** Verify an active ZIP assigns the user to that node with no waitlist prompt.

**Steps:**
1. On **Complete Your Profile**, enter a display name and ZIP `06850`.
2. Tap **Complete Setup**.

**Expected Result:**
- The ZIP field auto-displays "📍 Norwalk, CT" (city/state) below it.
- No waitlist modal appears; a success message ("Your profile has been created!") shows and the user proceeds into the app able to browse that node's items.

### AUTH-TC-F02 · Inactive ZIP → "We're Coming Soon!" + Join Waitlist

**Actors:** new-user

**Precondition:** ZIP `07999` has no active node.

**Objective:** Verify an inactive ZIP offers the waitlist and a fallback node.

**Steps:**
1. On **Complete Your Profile**, enter ZIP `07999` and submit.

**Expected Result:**
- A modal titled "We're Coming Soon!" explains the area isn't active yet and that the user has been connected with traders in a nearby (fallback) node.
- The modal offers **Join Waitlist** (primary) and **Continue Trading** (secondary).

### AUTH-TC-F03 · Waitlist confirmation + fallback node access

**Actors:** new-user

**Objective:** Verify joining the waitlist confirms and grants fallback-node access.

**Steps:**
1. In the "We're Coming Soon!" modal, tap **Join Waitlist**.
2. After confirmation, tap **Got it**.

**Expected Result:**
- A "Waitlist Confirmed" modal thanks the user and states they'll be notified when the area launches, and that they can trade with users in the assigned (fallback) node meanwhile.
- Tapping **Got it** proceeds into the app with access to the fallback node's items.

### AUTH-TC-F04 · Continue Trading without joining waitlist

**Actors:** new-user

**Objective:** Verify the user can skip the waitlist and still use the app.

**Steps:**
1. In the "We're Coming Soon!" modal, tap **Continue Trading**.

**Expected Result:**
- The modal closes and the user proceeds into the app on the fallback node without being added to the waitlist.

### AUTH-TC-F05 · ZIP auto-lookup shows city/state

**Actors:** new-user

**Objective:** Verify the ZIP field resolves to a city/state.

**Steps:**
1. On **Complete Your Profile**, type a valid 5-digit ZIP.

**Expected Result:**
- Once 5 digits are entered, "📍 {City}, {State}" appears in green beneath the field, with helper text "We'll assign you to your nearest community node".

### AUTH-TC-F06 · Node-scoped content (My Node vs Show All Nodes)

**Actors:** test-buyer

**Objective:** Verify browsing is scoped to the user's node with an option to view all nodes.

**Steps:**
1. As **test-buyer**, open the browse/discover view (default scope).
2. Enable **Show All Nodes** (if available), then disable it again.

**Expected Result:**
- By default only the user's node items appear.
- With Show All Nodes on, items from other nodes appear with an "Other Node" indicator and distance; turning it off returns to the user's node only.

---

## Group G — Node Management (Admin)

### AUTH-TC-G01 · Admin creates an active node

**Actors:** admin

**Objective:** Verify an admin can create an active node with ZIP auto-lookup.

**Steps:**
1. In the admin portal open **Geographic Nodes** and tap **+ Add Node**.
2. Enter a Node Name and a 5-digit ZIP; wait for the lookup to populate City, State, Latitude, Longitude.
3. Set a Radius (1–100), leave **Active** checked, and tap **Create Node**.

**Expected Result:**
- The ZIP lookup auto-fills City/State/Lat/Lng (showing "Looking up ZIP code..." briefly).
- On save, the modal closes, a success message shows, and the new node appears in the table with a green **Active** badge.

### AUTH-TC-G02 · Admin creates an inactive node

**Actors:** admin

**Objective:** Verify creating a node with Active unchecked.

**Steps:**
1. Add a node as in AUTH-TC-G01 but uncheck **Active (users can be assigned to this node)** before saving.

**Expected Result:**
- The node is created with a gray **Inactive** badge and its action shows **Activate**.

### AUTH-TC-G03 · Admin edits a node

**Actors:** admin

**Objective:** Verify editing node fields persists.

**Steps:**
1. On the Nodes table tap **Edit** for a node.
2. Change the Name/Radius/Description and tap **Update Node**.

**Expected Result:**
- The modal title reads "Edit Node"; saved changes appear in the table and persist after a page refresh.

### AUTH-TC-G04 · Admin deactivates a node with members (warning)

**Actors:** admin

**Objective:** Verify deactivation of a node with members shows a warning and keeps members assigned.

**Steps:**
1. On an active node with members > 0, tap **Deactivate**.
2. Read the confirmation and confirm.

**Expected Result:**
- The confirmation warns that the node has N active members who remain assigned but that new users cannot join the node.
- After confirming, the badge changes to **Inactive** and the action becomes **Activate**.
- New signups with that node's ZIP are routed to a different active node (or offered the waitlist).

### AUTH-TC-G05 · Admin reactivates a node

**Actors:** admin

**Objective:** Verify reactivation restores assignability.

**Steps:**
1. On an inactive node tap **Activate** and confirm.

**Expected Result:**
- The badge returns to **Active** and new users with that ZIP can be assigned to it.

### AUTH-TC-G06 · Node stats cards + validation

**Actors:** admin

**Objective:** Verify the stats cards and form validation.

**Steps:**
1. Observe the **Total Nodes**, **Active Nodes**, and **Total Members** cards.
2. In Add/Edit Node, try to save with a missing name, a non-5-digit ZIP, and a radius outside 1–100.

**Expected Result:**
- The stats cards reflect current counts.
- Validation blocks invalid input (name min length, 5-digit ZIP, radius 1–100, 2-letter state) with clear messages.

---

## Group H — Profile Setup & Onboarding

### AUTH-TC-H01 · Profile Setup: avatar + display name + ZIP

**Actors:** new-user

**Objective:** Verify the Profile Setup screen captures avatar, name, and ZIP.

**Steps:**
1. On **Complete Your Profile**, tap the camera icon and choose a photo.
2. Enter a display name and a valid ZIP, then tap **Complete Setup**.

**Expected Result:**
- The avatar preview updates, the ZIP resolves to city/state, and on submit the user advances (to Welcome / onboarding).

### AUTH-TC-H02 · Profile Setup validation errors

**Actors:** new-user

**Objective:** Verify required-field validation on Profile Setup.

**Steps:**
1. Attempt **Complete Setup** with a 1-character display name and a 3-digit ZIP.

**Expected Result:**
- "Display name must be at least 2 characters" and "Zip code must be 5 digits" appear; submission is blocked.

### AUTH-TC-H03 · Avatar upload failure does not block

**Actors:** new-user

**Objective:** Verify a failed avatar upload still allows completion.

**Steps:**
1. Trigger an avatar upload failure (e.g., interrupted network) and complete the rest of the form.

**Expected Result:**
- A warning notes the profile will be created without an avatar (addable later); profile completion still succeeds.

### AUTH-TC-H04 · Welcome screen → Get Started

**Actors:** new-user

**Objective:** Verify the Welcome screen advances onboarding.

**Steps:**
1. On the Welcome screen, read the headline and tap **Get Started**.

**Expected Result:**
- The Welcome copy about a "safe, neighborhood marketplace" is shown; tapping **Get Started** marks onboarding progress and moves forward (eventually to Home).

### AUTH-TC-H05 · Feature Highlights carousel

**Actors:** new-user

**Objective:** Verify the 4-slide feature highlights.

**Steps:**
1. Step through the Feature Highlights slides (Discover Items, Earn Money, Safe Trading, Build Reputation).
2. On the last slide tap **Get Started**.

**Expected Result:**
- Each slide shows a title, description, emoji, and pagination dots; the final **Get Started** advances the flow.

### AUTH-TC-H06 · Onboarding carousel: Next / Skip / Get Started

**Actors:** new-user

**Objective:** Verify the educational onboarding carousel controls.

**Steps:**
1. Swipe through the onboarding carousel screens.
2. On one screen tap **Skip**; in a separate run, reach the last screen and tap **Get Started**.

**Expected Result:**
- Progress dots track the current screen.
- **Skip** marks onboarding skipped and goes to Home; **Get Started** on the last screen marks onboarding complete and goes to Home.

### AUTH-TC-H07 · Onboarding completion routes to Home

**Actors:** new-user

**Objective:** Verify finishing onboarding lands on the Home tabs.

**Steps:**
1. Complete the full onboarding sequence.

**Expected Result:**
- The user arrives on the Home tabs and, on subsequent launches, is taken straight to Home (onboarding not shown again).

---

## Group I — Subscription Choice (Onboarding)

### AUTH-TC-I01 · Start Free Trial enrolls Kids Club+

**Actors:** new-user

**Precondition:** Trial is enabled in admin config.

**Objective:** Verify starting the trial enrolls the user in Kids Club+.

**Steps:**
1. On the Subscription Choice screen, tap **Start Free Trial**.

**Expected Result:**
- The screen shows "Try Kids Club+ Free for N days" at $0.00; after enrolling, the user proceeds to Home and gains subscriber features (e.g., SP, Accept SP toggle).

### AUTH-TC-I02 · Continue Free stays on free tier

**Actors:** new-user

**Objective:** Verify choosing free keeps the user on the free tier.

**Steps:**
1. On the Subscription Choice screen, tap **Continue Free**.

**Expected Result:**
- The user proceeds to Home on the free tier with subscriber-only features locked.

### AUTH-TC-I03 · Trial limit reached hides trial CTA

**Actors:** new-user (who already used the max trials)

**Objective:** Verify the trial CTA hides once the trial limit is reached.

**Steps:**
1. Reach the Subscription Choice screen as a user who has exhausted allowed trials.

**Expected Result:**
- **Start Free Trial** is hidden; only the paid Kids Club+ option and **Continue Free** are shown.

---

## Group J — Listing Creation (Single Item)

### AUTH-TC-J01 · Photo-first gating

**Actors:** test-seller

**Objective:** Verify item fields stay hidden until at least one photo is added.

**Steps:**
1. Open **New Item** (ItemCreate).
2. Observe the form before adding any photo, then add one photo.

**Expected Result:**
- Before a photo is added, the title/category/price fields are hidden.
- After adding at least one photo, the rest of the form appears. Up to 10 photos are allowed; adding an 11th shows "You can add up to 10 photos."

### AUTH-TC-J02 · AI auto-fill Apply All + per-field Use

**Actors:** test-seller

**Objective:** Verify AI suggestions can be applied wholesale or per field.

**Steps:**
1. Add a clear product photo and wait for the AI Analysis card.
2. Tap **Apply All**; in a separate item, tap an individual **Use** button on one suggested field.
3. If AI is slow, tap **Continue Without AI**.

**Expected Result:**
- **Apply All** fills only empty fields (title, category, condition, brand, color, age group, gender).
- Per-field **Use** applies a single suggestion.
- After ~7 seconds a **Continue Without AI** option lets the seller proceed manually; a failure shows a "Retry AI" option.

### AUTH-TC-J03 · Required field validation

**Actors:** test-seller

**Objective:** Verify required fields are enforced before publishing.

**Steps:**
1. With a photo added, leave Title/Category/Price empty or invalid and attempt to submit.

**Expected Result:**
- The submit button stays disabled or shows errors like "Title must be between 3 and 100 characters", "Please select a category", "Please enter a valid price greater than $0".

### AUTH-TC-J04 · Condition / Age Group / Gender / Color options

**Actors:** test-seller

**Objective:** Verify the selectable enums render correctly.

**Steps:**
1. Open Condition, Age Group, Gender, and Color selectors.

**Expected Result:**
- Condition shows New / Like New / Good / Fair / Worn with descriptions.
- Age Group shows 0-2, 3-5, 6-8, 9-12, 13+ years.
- Gender shows Boy / Girl / Unisex / Any.
- Color allows multi-select from the 12-color palette.

### AUTH-TC-J05 · "Other" category requires a custom name

**Actors:** test-seller

**Objective:** Verify selecting "Other" requires a custom category name.

**Steps:**
1. In the Category modal choose **Other**.
2. Try to submit without entering a custom category name, then enter one.

**Expected Result:**
- A "Custom Category Name *" field appears with helper text that it will be sent to admin for review.
- Submission is blocked until a custom name is provided.

### AUTH-TC-J06 · Payment preference — subscriber Accept SP toggle

**Actors:** test-seller (subscriber)

**Objective:** Verify subscribers can enable Accept Swap Points.

**Steps:**
1. In the Payment Preference section, toggle **Accept Swap Points?** on.

**Expected Result:**
- A "✓ SP Eligible" badge appears while the toggle is on; the hint reads "Allow buyers to pay with Swap Points".

### AUTH-TC-J07 · Payment preference — free user upgrade prompt

**Actors:** test-free

**Objective:** Verify free users see an upgrade prompt instead of the SP toggle.

**Steps:**
1. As **test-free**, open the Payment Preference section while creating a listing.

**Expected Result:**
- A message like "🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!" is shown with an **Upgrade Now** button that opens Subscription Choice. No Accept SP toggle is available.

### AUTH-TC-J08 · SP earnings preview (subscriber)

**Actors:** test-seller (subscriber)

**Objective:** Verify the SP earnings preview shows for subscribers.

**Steps:**
1. As a subscriber, enter a price on the item form.

**Expected Result:**
- An SP earnings preview appears below the price reflecting the category and price (hidden/greyed for free users).

### AUTH-TC-J09 · Submit for Review → pending + success modal

**Actors:** test-seller

**Objective:** Verify a completed item submits as pending with the review message.

**Steps:**
1. Complete all required fields and tap **Submit for Review**.

**Expected Result:**
- A "Submitting Item For Review..." overlay shows, then a success modal: "Thanks for submitting!" explaining the item will be reviewed and the seller notified, with **Go To My Items** / **Go To Dashboard**.
- The item is created as pending and does not appear in the public feed yet.

### AUTH-TC-J10 · Phone-verification gate before publish

**Actors:** new-user (unverified phone)

**Objective:** Verify publishing requires a verified phone.

**Steps:**
1. As a user without phone verification, complete the item form and tap **Submit for Review**.

**Expected Result:**
- A phone verification modal appears and blocks publishing until completed; afterward the publish resumes.

### AUTH-TC-J11 · Draft auto-save + resume

**Actors:** test-seller

**Objective:** Verify drafts auto-save and can be resumed.

**Steps:**
1. Start an item, add a photo and partial details, then leave the screen.
2. Return to item creation.

**Expected Result:**
- A resume banner offers to continue the saved draft (drafts persist up to 7 days, up to 5 per seller).

### AUTH-TC-J12 · Listing photos — multiple upload, type and size validation

**Actors:** test-seller

**Objective:** Verify listing photo upload accepts supported images, rejects invalid files, and allows multiple photos.

**Steps:**
1. Open **New Item** and add three valid photos (mix of JPG/PNG/WebP if available).
2. Attempt to add an image larger than 5MB.
3. Attempt to add an unsupported file type.

**Expected Result:**
- Valid images upload successfully, appear in the photo strip, and keep the listing form unlocked.
- The seller can keep adding photos until the 10-photo cap is reached.
- A file larger than 5MB is rejected with a clear size error.
- An unsupported format is rejected with a clear type error and is not added to the listing.

### AUTH-TC-J13 · Listing photos — remove, reorder, replace, and persist after resume

**Actors:** test-seller

**Objective:** Verify listing photos can be managed after upload and that the draft restores the same photo set/order.

**Steps:**
1. Add at least three photos to a new item.
2. Remove one photo, reorder the remaining photos so a different image becomes first, and replace one image with a different valid image.
3. Leave the screen so the draft auto-saves, then reopen the draft.

**Expected Result:**
- Removing a photo updates the count immediately.
- Reordering changes the lead photo used by the draft preview.
- Replacing a photo keeps the slot but shows the new image.
- Reopening the draft restores the same remaining photos and order.

### AUTH-TC-J14 · Bonus category badge appears in picker and preview

**Actors:** test-seller (subscriber)

**Objective:** Verify bonus categories are visually identified during listing creation.

**Steps:**
1. Open the Category picker while creating a listing.
2. Select a category configured as a bonus category.
3. Return to the listing form.

**Expected Result:**
- Bonus categories show a badge/indicator in the picker.
- After selection, the chosen category remains identified as a bonus category on the form or SP preview area.
- Non-bonus categories do not show the bonus indicator.

### AUTH-TC-J15 · Category-specific SP earn and buyer-cap preview recalculates

**Actors:** test-seller (subscriber)

**Objective:** Verify the listing form recalculates SP earnings and buyer SP cap from the selected category and price.

**Steps:**
1. Create a new listing as **test-seller** and choose a standard category.
2. Enter a price and note the SP preview.
3. Change to a bonus category and change the price again.
4. Toggle back to a non-bonus category.

**Expected Result:**
- The SP preview updates when either the category or price changes.
- The form shows both the seller earn preview and the buyer max-SP preview for the selected category.
- A bonus category increases the earn preview relative to a standard category at the same price.
- Switching back to a standard category removes the bonus uplift and recalculates the preview.

---

## Group K — Bulk Listing Creation

### AUTH-TC-K01 · Multi-photo upload + auto-grouping

**Actors:** test-seller

**Objective:** Verify bulk photo upload auto-groups into items.

**Steps:**
1. Open **Bulk Listing Create** and add multiple photos (up to 30).

**Expected Result:**
- Photos are auto-grouped into items (up to ~15); duplicate photos are flagged via perceptual-hash detection.

### AUTH-TC-K02 · Regroup / merge / move photos

**Actors:** test-seller

**Objective:** Verify grouping can be adjusted.

**Steps:**
1. In the Group step, long-press to multi-select, then merge groups, move a photo to another item, and reorder photos within a group.

**Expected Result:**
- Grouping updates accordingly (merge, move-to-new, reorder), and the cover photo updates as expected.

### AUTH-TC-K03 · Step indicator

**Actors:** test-seller

**Objective:** Verify the bulk step indicator reflects progress.

**Steps:**
1. Move through Photos → Group → Review → Publish.

**Expected Result:**
- The step indicator highlights the current step at each stage.

### AUTH-TC-K04 · Apply to All bar

**Actors:** test-seller

**Objective:** Verify the Apply to All bar fills common fields non-destructively.

**Steps:**
1. In the Review step (with 2+ items), tap the **Brand**, **Condition**, **Age**, and **Gender** chips in the Apply to All bar.

**Expected Result:**
- Each chip suggests the most common value and fills only blank fields across included items, without overwriting existing values.

### AUTH-TC-K05 · Submit N Items for Review + confirm sheet

**Actors:** test-seller

**Objective:** Verify bulk publish shows a count and confirmation.

**Steps:**
1. Complete required fields for the included items and tap **Submit N Items for Review**.
2. Review the confirmation sheet and confirm.

**Expected Result:**
- The publish button reads e.g. "Submit 5 Items for Review" (or "Submit 1 Item for Review") and is disabled if any included item is missing required fields.
- The confirmation sheet summarizes the items (and SP totals for subscribers); confirming submits them as pending.

### AUTH-TC-K06 · Bulk SP summary (subscriber)

**Actors:** test-seller (subscriber)

**Objective:** Verify the combined SP summary shows for subscribers.

**Steps:**
1. As a subscriber, reach the bulk review/confirm with multiple items.

**Expected Result:**
- A combined SP earnings summary across all items is shown (hidden for free users).

---

## Group L — Admin Review / Pending

### AUTH-TC-L01 · New listing not visible until approved

**Actors:** test-seller, test-buyer

**Objective:** Verify pending listings are hidden from the public feed.

**Steps:**
1. As **test-seller**, submit a new item.
2. As **test-buyer** in the same node, search/browse for that item.

**Expected Result:**
- The item does not appear in discovery while pending; in **My Items** the seller sees it marked as pending/under review.

### AUTH-TC-L02 · Admin approves → item becomes visible

**Actors:** admin, test-buyer

**Objective:** Verify approval makes the item live.

**Steps:**
1. In the admin portal, open the pending/flagged listings queue and approve the item.
2. As **test-buyer**, browse the node feed.

**Expected Result:**
- After approval the item becomes visible (status available) and appears in the buyer's node feed.

### AUTH-TC-L03 · Seller receives approval notification

**Actors:** test-seller

**Objective:** Verify the seller is notified on approval (respecting notification preferences).

**Steps:**
1. After an admin approves the listing, check the seller's notifications.

**Expected Result:**
- The seller receives a "listing approved" notification; tapping it deep-links to the listing detail.

### AUTH-TC-L04 · Editing an approved listing returns to pending

**Actors:** test-seller

**Objective:** Verify edits re-trigger review.

**Steps:**
1. Edit an approved listing (e.g., change title/price/photos) and save.

**Expected Result:**
- The listing returns to pending and requires admin re-approval before it is publicly visible again.

---

## Group M — Discovery: Search & Filters

### AUTH-TC-M01 · Search bar (debounced) + clear

**Actors:** test-buyer

**Objective:** Verify search is debounced and clearable.

**Steps:**
1. On **Discover**, type a query in the "Search items..." field.
2. Tap the clear (X) control.

**Expected Result:**
- Results update shortly after typing (debounced, not on every keystroke); the X clears the query and restores the default feed.

### AUTH-TC-M02 · Recent searches + autocomplete

**Actors:** test-buyer

**Objective:** Verify recent searches and autocomplete suggestions.

**Steps:**
1. Focus the empty search field; observe the **Recent Searches** chip row directly below the search bar (Neutral-100 pills).
2. Tap a recent-search chip to re-run that search; use the **Clear** text action to empty history.
3. Type 2+ characters and observe autocomplete suggestions (the chip row hides while typing).

**Expected Result:**
- Recent searches appear as tappable chips (max 8, most recent first); tapping one reuses it; **Clear** empties them.
- Up to 5 autocomplete suggestions appear; tapping one applies the search.

### AUTH-TC-M03 · Sort options

**Actors:** test-buyer

**Objective:** Verify sort ordering.

**Steps:**
1. Open the sort control and choose Relevance, Newest, Price (Low→High), then Price (High→Low).

**Expected Result:**
- Results reorder according to each selection.

### AUTH-TC-M04 · Filters modal — progressive disclosure + live count

**Actors:** test-buyer

**Objective:** Verify the redesigned Filters sheet: SP toggle on top, Location/Category/Age Group always expanded, Condition/Gender/Color/Brand/Price Range collapsed under "More Filters", and the live "Show {n} Results" Apply button.

**Steps:**
1. Open the **Filters** sheet.
2. Confirm the **"💰 Accepts Swap Points"** toggle card is at the very top (SP-gold styling), above Location.
3. Confirm **Location (ZIP + radius)**, **Category**, and **Age Group** are always visible.
4. Confirm **More Filters (Condition, Gender, Color, Brand, Price Range)** is collapsed by default; tap it to expand, set a Condition and a Price Range, then collapse it again.
5. Observe the Apply button updates live ("Show {n} Results") as you toggle filters (debounced).
6. Tap **Show {n} Results**.

**Expected Result:**
- Sheet follows the Bottom Sheet spec (white, 20px top radius, drag handle, slide-up).
- The SP toggle sits above Location; Location/Category/Age Group always expanded; the rest hidden under the collapsible More Filters section.
- Apply reads "Show {n} Results" with a live (debounced) count and applies the draft on tap; the Filters button shows an active-filter count badge.

### AUTH-TC-M05 · "Accepts SP" quick-toggle — header ↔ sheet sync

**Actors:** test-buyer, test-free

**Objective:** Verify the "💰 Accepts SP" quick-toggle chip and the Filters-sheet toggle share one state and filter to SP-eligible items.

**Steps:**
1. As **test-buyer**, toggle **Accepts SP** in the Discover controls row; confirm only SP-eligible items show and the chip highlights in SP-gold.
2. Open the Filters sheet and confirm the **"💰 Accepts Swap Points"** toggle reflects the same ON state (single source of truth).
3. Flip it OFF inside the sheet; close the sheet and confirm the header chip is OFF and results refetch.
4. As **test-free**, enable **Accepts SP**.

**Expected Result:**
- Header chip and sheet toggle never desync (both read/write `filters.spEligibleOnly`); toggling either refetches results + count immediately.
- With it ON, only SP-eligible items are shown (with the gold **Accepts SP** badge).
- For a free user, the toggle still filters but an upgrade CTA is surfaced for SP features.

### AUTH-TC-M06 · Empty / no-results states

**Actors:** test-buyer

**Objective:** Verify empty and no-results messaging.

**Steps:**
1. Search for a term with no matches and/or apply very narrow filters.

**Expected Result:**
- A "No Results Found" state appears with guidance to adjust filters and a **Clear Filters** action.

### AUTH-TC-M07 · Recent Searches chip row + Clear

**Actors:** test-buyer

**Objective:** Verify the Recent Searches section renders as tappable chips above Trending with a Clear action.

**Steps:**
1. Run 2–3 searches with distinct queries (e.g., "bike", "lego").
2. On Discover, look directly below the search bar for the **Recent Searches** chip row.
3. Tap one chip, then tap **Clear**.

**Expected Result:**
- Chips are Neutral-100 pills (§6.7), most-recent first; tapping a chip re-runs that search; **Clear** empties the row and it disappears.

### AUTH-TC-M08 · Trending in {State} section

**Actors:** test-buyer

**Objective:** Verify the Trending section shows top categories by active listing count in the user's state, styled distinctly from Recent Searches.

**Steps:**
1. With a node assigned (state detected), open Discover and locate **Trending in {State}** below Recent Searches.
2. Tap a trending chip.

**Expected Result:**
- Chips use Primary-100 background / Primary-600 text / Primary-400 border (distinct from the Neutral-100 recent-search pills) and come from the top 4–6 categories by active listing count in the user's state (`get_top_categories_by_state`).
- Tapping a chip filters results to that category.
- If the user has no node/state, the section is hidden.

### AUTH-TC-M09 · Result count + active filter chips

**Actors:** test-buyer

**Objective:** Verify the "{n} results · near {ZIP/state}, {radius} mi" line and per-filter removable chips above the grid.

**Steps:**
1. Apply a category + age group + the SP toggle via the Filters sheet.
2. Observe the summary line and the active-filter chip row above the grid.
3. Tap the × on one chip, then tap **Clear all**.

**Expected Result:**
- Summary reads e.g. "24 results · near 06880, 10 mi" in Body Small / Neutral-700.
- One chip per applied filter; standard chips use Primary-100/600 tokens, the SP chip uses SP-gold tokens.
- Removing a chip refetches; **Clear all** resets all filters and refetches unfiltered results.

### AUTH-TC-M10 · Discover header: bookmark → Favorites (local header)

**Actors:** test-buyer

**Objective:** Verify the Discover header shows a Bookmark icon that opens Favorites, while the bell/chat behave as before and other screens' headers are unchanged.

**Steps:**
1. On Discover, tap the **Bookmark/Saved** icon in the header.
2. Confirm it opens the **Favorites** screen; go back.
3. Tap the **bell** and **chat** icons to confirm unchanged behavior (badges intact).
4. Visit Home, Inbox, and Profile and confirm their headers are visually unchanged.

**Expected Result:**
- The bookmark is a 44×44 Icon Button that opens Favorites; the local Discover header keeps the bell + chat behavior of the shared header.
- Home/Inbox/Profile headers render identically to before the change.

---

## Group N — Discovery: Category & Favorites

### AUTH-TC-N01 · Category browse filters results

**Actors:** test-buyer

**Objective:** Verify browsing by category filters discovery.

**Steps:**
1. Open **Browse Categories** and tap a category.

**Expected Result:**
- Discovery results filter to that category; categories with SP-eligible items show an SP badge.

### AUTH-TC-N02 · Favorite heart toggle on item card

**Actors:** test-buyer

**Objective:** Verify favoriting from a discovery card.

**Steps:**
1. Tap the heart icon on an item card, then tap it again.

**Expected Result:**
- The heart toggles filled/outline; the favorite state persists to the account and is reflected in the Favorites list.

### AUTH-TC-N03 · Infinite scroll pagination

**Actors:** test-buyer

**Objective:** Verify results paginate on scroll.

**Steps:**
1. Scroll to the bottom of a results grid with many items.

**Expected Result:**
- More items load automatically (≈20 per page) in the 2-column grid without a manual "load more" tap.

### AUTH-TC-N04 · "Accepts SP" badge on item card

**Actors:** test-buyer

**Objective:** Verify SP-eligible item cards show the gold "Accepts SP" badge per design-system §6.7.

**Steps:**
1. Enable **Accepts SP** and browse the grid.
2. Inspect an SP-eligible item card.

**Expected Result:**
- Cards render per §6.2 (white bg, 16px radius, Level-1 shadow, 1:1 image, heart overlay, H4 title, Body Large 700 price).
- SP-eligible cards show the gold **Accepts SP** badge (SP-100 bg, SP-500 border + coin icon); non-SP cards show no badge.

---

## Group O — Discovery: Node Scoping & SP Visibility

### AUTH-TC-O01 · Results scoped to user's node

**Actors:** test-buyer

**Objective:** Verify default discovery is node-scoped.

**Steps:**
1. As **test-buyer**, open Discover without changing location filters.

**Expected Result:**
- Only items from the user's node (or within the configured radius) appear by default.

### AUTH-TC-O02 · Location ZIP + radius filter

**Actors:** test-buyer

**Objective:** Verify the ZIP + radius location filter.

**Steps:**
1. In the Filters modal, set a ZIP and adjust the radius slider (5–100 miles); apply.

**Expected Result:**
- Results scope to nearby nodes within the chosen radius; the radius preference is remembered.

### AUTH-TC-O03 · Inactive ZIP in filter → waitlist prompt

**Actors:** test-buyer

**Objective:** Verify filtering by an inactive ZIP surfaces a waitlist prompt.

**Steps:**
1. In the location filter, enter a ZIP with no active node and apply.

**Expected Result:**
- A prompt like "We are not live in ZIP {zip} yet. We can add you to the waitlist." appears with options such as **Back to Filters** / **See All Results**.

### AUTH-TC-O04 · Subscriber vs free SP visibility

**Actors:** test-buyer (subscriber), test-free

**Objective:** Verify SP-related visibility differs by tier.

**Steps:**
1. Browse discovery as **test-buyer**, then as **test-free**.

**Expected Result:**
- Subscribers see SP-eligible items prioritized with the SP filter enabled and SP earnings context.
- Free users still see SP-eligible items but with upgrade CTAs for SP features.

### AUTH-TC-O05 · Admin radius defaults and bounds reflect in Discover

**Actors:** test-admin, test-buyer

**Objective:** Verify `default_radius_miles`, `min_user_radius_miles`, and `max_user_radius_miles` from Node Settings control the Discover filter.

**Steps:**
1. As **test-admin**, open **/settings/nodes** and save distinct values for default radius, min user radius, and max user radius (for example 15, 10, and 25 miles).
2. As **test-buyer**, force-close/reopen Discover, open the Filters modal, and inspect the radius control.
3. Set a ZIP and try moving the radius below and above the configured bounds.

**Expected Result:**
- Discover opens with the configured default radius.
- The radius control does not go below the configured minimum or above the configured maximum.
- Search results and the remembered radius preference honor the new bounds on next load.

---

## Group P — Global Header, Floating Nav & Home Composer

> Chrome redesign (2026-08-11): read-only node chip header, floating pill bottom nav (Home / Discover / Sell / Trades / Basket), Trades tab, and Home composer bar that pre-fills the New Item Title. See `docs/flow-registry.md` FLOW-30.

### AUTH-TC-P01 · Header node chip shows the registered market (read-only)

**Actors:** test-buyer

**Objective:** Verify the Home header shows the user's registered node/local market name and is display-only.

**Steps:**
1. Log in as **test-buyer** (assigned to a node during onboarding).
2. Observe the left side of the Home header.

**Expected Result:**
- A compact pill chip shows the node/local market name selected at registration (e.g., "Ledgewood Dr").
- Tapping the chip does nothing — no picker, modal, or navigation opens, and no caret/chevron is shown.

### AUTH-TC-P02 · Header right cluster: bell + chat + avatar; logout removed from header

**Actors:** test-buyer

**Objective:** Verify the Home header shows bell, chat and avatar in a tight cluster and no longer shows a logout icon.

**Steps:**
1. Log in and observe the Home header right side.
2. Look for a standalone logout icon.

**Expected Result:**
- Right cluster shows (left to right): notification bell, chat/messages icon, user avatar.
- No logout icon appears in the header.

### AUTH-TC-P03 · Header chat icon opens Messages with an unread badge

**Actors:** test-buyer

**Objective:** Verify the header chat icon opens the Messages screen and shows the same unread count the old Inbox tab badge showed.

**Steps:**
1. Have a trade with an unread message (or send one from another account).
2. Tap the chat icon in the header.

**Expected Result:**
- A red numeric badge on the chat icon shows the unread-message count (99+ capped).
- Tapping it opens the Messages (conversations) screen.

### AUTH-TC-P04 · Floating pill bottom nav: layout

**Actors:** test-buyer

**Objective:** Verify the bottom nav is a floating pill, not a full-width bar.

**Steps:**
1. Log in and observe the bottom of the screen.

**Expected Result:**
- The nav is a rounded pill with horizontal margin from both screen edges, elevated with a subtle shadow, and sits above the iOS home-indicator safe area.
- Tab order left to right: Home, Discover, Sell FAB, Trades, Basket.

### AUTH-TC-P05 · Inbox removed from nav; Messages via header chat only

**Actors:** test-buyer

**Objective:** Verify the bottom nav no longer has an Inbox tab and Messages is reached from the header.

**Steps:**
1. Observe the bottom nav (no Inbox tab).
2. Tap the header chat icon to open Messages.

**Expected Result:**
- No Inbox tab in the bottom nav.
- Messages opens from the header chat icon; the Messages screen still works as before.

### AUTH-TC-P06 · Trades tab — Active Trades

**Actors:** test-buyer

**Objective:** Verify the Trades tab shows active trades with item, counterpart, and status label.

**Steps:**
1. Have at least one trade in `pending` or `in_progress` status.
2. Tap the Trades tab.

**Expected Result:**
- Active Trades lists each active trade with the item, the counterpart user, and a status label (e.g., Pending Confirmation, In Progress).

### AUTH-TC-P07 · Trades tab — Trade History

**Actors:** test-buyer

**Objective:** Verify completed/cancelled trades appear in Trade History, reverse-chronological.

**Steps:**
1. Have at least one completed and/or cancelled trade.
2. Open the Trades tab History section.

**Expected Result:**
- Completed and cancelled trades appear under Trade History, newest first.

### AUTH-TC-P08 · Trades badge counts active trades only

**Actors:** test-buyer

**Objective:** Verify the Trades tab badge equals active (non-terminal) trades and excludes completed/cancelled.

**Steps:**
1. Note the badge on the Trades tab.
2. Complete or cancel a trade, then return to the tab bar.

**Expected Result:**
- The badge counts trades with status `pending`, `in_progress` (and `payment_failed`/legacy `payment_processing` if present).
- Completed and cancelled trades do NOT count toward the badge.

### AUTH-TC-P09 · Basket badge + Home active state unchanged

**Actors:** test-buyer

**Objective:** Verify the Basket badge and Home tab active styling carry over.

**Steps:**
1. Add items to the trade basket and observe the Basket badge.
2. Navigate between tabs and observe Home's active highlight.

**Expected Result:**
- Basket badge shows the item count (99+ capped).
- Home tab shows the active green highlight when selected.

### AUTH-TC-P10 · Post FAB globally visible + Sell sheet

**Actors:** test-buyer

**Objective:** Verify the Sell FAB is visible on every screen and still opens the Sell sheet.

**Steps:**
1. Visit Home, Discover, Trades, Messages, and Basket.
2. Tap the Sell FAB.

**Expected Result:**
- The FAB is visible on every screen (raised orange circle above the pill).
- Tapping it opens the Sell action sheet with "List One Item" and "Bulk Upload".

### AUTH-TC-P11 · Composer bar: focus + type

**Actors:** test-buyer

**Objective:** Verify tapping the Home composer bar focuses an inline text field.

**Steps:**
1. On Home, tap anywhere on the composer bar below the header.

**Expected Result:**
- The inline field focuses (keyboard appears) and the user can type freely.
- No navigation happens on focus.

### AUTH-TC-P12 · Composer "+" → New Item with Title pre-filled

**Actors:** test-buyer

**Objective:** Verify the composer "+" routes to the single-item flow and pre-fills the Title.

**Steps:**
1. Type "Lego Star Wars Set" into the composer.
2. Tap the "+" button (or press keyboard return).

**Expected Result:**
- The New Item screen opens on its Photos step (no Sell sheet appears).
- The Title field already contains "Lego Star Wars Set".

### AUTH-TC-P13 · Composer empty submit → empty Title

**Actors:** test-buyer

**Objective:** Verify submitting with no text leaves the Title empty (no regression).

**Steps:**
1. Tap "+" with the composer empty.

**Expected Result:**
- New Item opens on its Photos step with an empty Title field.

### AUTH-TC-P14 · Composer camera icon → New Item straight to camera

**Actors:** test-buyer

**Objective:** Verify the composer camera icon opens New Item directly to the camera.

**Steps:**
1. Type a title, then tap the camera icon.

**Expected Result:**
- New Item opens on the Photos step and auto-launches the camera.
- The typed title is still pre-filled.

### AUTH-TC-P15 · AI never overwrites a composer-pre-filled Title

**Actors:** test-buyer

**Objective:** Verify AI analysis cannot overwrite a Title pre-filled from the composer bar.

**Steps:**
1. Pre-fill a Title via the composer (AUTH-TC-P12).
2. Add a photo and let AI analysis complete; tap "Apply All" and per-field "Use".

**Expected Result:**
- The pre-filled Title is never replaced by the AI-suggested title.
- If the user entered no text, AI may still populate the Title as before.

### AUTH-TC-P16 · FAB Sell sheet unchanged (parallel entry point)

**Actors:** test-buyer

**Objective:** Verify the FAB still opens the full Sell sheet with Bulk Upload.

**Steps:**
1. Tap the Sell FAB and confirm the sheet shows "List One Item" and "Bulk Upload".

**Expected Result:**
- The FAB sheet is unchanged; Bulk Upload is reachable only from here (not the composer bar).

### AUTH-TC-P17 · Logout still reachable from Profile/Settings

**Actors:** test-buyer

**Objective:** Verify logout still exists after being removed from the header.

**Steps:**
1. Tap the header avatar → Profile.
2. Tap Logout (confirm) and also check Settings → Sign Out.

**Expected Result:**
- Logout works from Profile and Settings; the user returns to Landing.

### AUTH-TC-P18 · Composer analytics events

**Actors:** test-admin

**Objective:** Verify composer events are recorded.

**Steps:**
1. On Home, tap the composer bar (focus).
2. Submit with text, then submit empty.
3. As admin, inspect `analytics_events` (or the analytics dashboard).

**Expected Result:**
- `composer_bar_tapped` recorded on focus.
- `composer_bar_submit` recorded with `has_text=true` and `has_text=false` respectively.

### AUTH-TC-P19 · Accessibility identifiers (Trades tab + header chat)

**Actors:** test-buyer

**Objective:** Verify stable accessibility identifiers/roles on the new chrome.

**Steps:**
1. Enable VoiceOver/TalkBack and navigate the bottom nav and header.

**Expected Result:**
- Trades tab has a button role + label "Trades" (testID `tab-trades`).
- Header chat button has label "Messages" (testID `header-chat-btn`); the node chip is not announced as a button.

---

## Group Q — Trading Education (End User)

### AUTH-TC-Q01 · Education Help screen — published sections only

**Ref:** FLOW-21 / FLOW-EDU-001 · HelpScreen
**Actors:** test user (mobile)

**Objective:** Verify the Help screen lists only published, ordered education sections.

**Steps:**
1. Open the in-app Help/Education screen.
2. Inspect the loaded sections.

**Expected Result:**
- Only published sections are shown, ordered by display_order ascending; each has id/title/body/section_type/image_url/published_at/created_at; drafts are hidden.

---

### AUTH-TC-Q02 · Education Help screen — section by type

**Ref:** FLOW-21 / FLOW-EDU-001 · HelpScreen
**Actors:** test user (mobile)

**Objective:** Verify a specific section type resolves to one published section.

**Steps:**
1. Request the "sp_definition" section (e.g., tap the SP-definition entry).

**Expected Result:**
- A single section object is returned with section_type = 'sp_definition', is_published = true, and non-empty title/body.

---

### AUTH-TC-Q03 · SP calculator — sell mode (no hardcoded rates)

**Ref:** FLOW-EDU-001 · SP calculator
**Actors:** test user (mobile, subscriber)

**Objective:** Verify sell-mode SP calculation delegates to MODULE-12 V3 (no hardcoded rates).

**Steps:**
1. In the education SP calculator, select a bonus category and enter a price (e.g., 25).

**Expected Result:**
- mode = 'sell'; earn_sp = round(price × category multiplier); is_bonus = true for multiplier > 1.10; category_name shown; source code contains no literal rates (1.10 / 1.30 / 70, etc.).

---

### AUTH-TC-Q04 · SP calculator — buy mode (cash + fee + cap)

**Ref:** FLOW-EDU-001 · SP calculator
**Actors:** test user (mobile)

**Objective:** Verify buy-mode SP calculation (cash, fee, total, cap).

**Steps:**
1. In the SP calculator, enter price 25 and SP 10 for the same category.

**Expected Result:**
- mode = 'buy'; sp_to_use = 10; cash_paid = 15; fee = 2.5 (10%); total_cost = 17.5; max_sp_usable is floored to the category cap (e.g., 70%).

---

### AUTH-TC-Q05 · SP calculator — bonus categories + example SP

**Ref:** FLOW-EDU-001 · SP calculator
**Actors:** test user (mobile)

**Objective:** Verify bonus-category listing and example SP calculation.

**Steps:**
1. List bonus categories; then calculate example SP for a price + category and for a null category.

**Expected Result:**
- Bonus list returns only categories with sp_earning_multiplier > 1.10, ordered descending.
- Example SP returns { earn_sp, max_use_sp, cash_paid, fee, is_bonus, category_name } with rounded/floored values; null category returns null.

---

### AUTH-TC-Q06 · Education analytics — event tracking (no throw)

**Ref:** FLOW-EDU-001 · analytics
**Actors:** test user (mobile)

**Objective:** Verify education events are tracked without throwing.

**Steps:**
1. Trigger a help_view event; also fire an invalid event type.

**Expected Result:**
- No exception; the valid event lands in education_analytics with correct user_id, event_type, event_data; the invalid event fails silently (warning only).

---

### AUTH-TC-Q07 · Education prompts — onboarding + in-app prompt state machine

**Ref:** FLOW-EDU-001 · analytics
**Actors:** test user (mobile)

**Objective:** Verify onboarding/prompt show logic, idempotency, and auto-suppression.

**Steps:**
1. With onboarding_completed_at/skipped_at NULL, check shouldShowOnboarding.
2. Mark complete, then mark skipped (after reset).
3. Mark a prompt seen twice and inspect education_prompts_seen.
4. With onboarding skipped + 3 prompts seen, check a new prompt.

**Expected Result:**
- shouldShowOnboarding = true initially; false after complete or skip.
- markPromptSeen is idempotent (single array entry).
- After 3 seen prompts, a new prompt is auto-suppressed and education_prompts_suppressed_at is set.

---

## Group S — Password Recovery

### AUTH-TC-S01 · Forgot Password — success + Send Another Email

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

**Locator hints:**
- Screen: `src/screens/auth/ForgotPasswordScreen.tsx` (instrumented 2026-08-15).
- Email input → `forgot-email-input` · Send Reset Link → `forgot-send-reset-button` · Back to Login (form) → `forgot-back-to-login` · Send Another Email → `forgot-send-another-button` · Back to Login (success) → `forgot-back-to-login-success`.
- Error alerts are native `Alert.alert` — assert by title.

### AUTH-TC-S02 · Forgot Password — invalid email

**Actors:** test-free

**Objective:** Verify an invalid email is rejected and the button is disabled when the field is empty.

**Steps:**
1. Open the Forgot Password screen and observe **Send Reset Link** with an empty Email field.
2. Enter `abc` and tap **Send Reset Link**.

**Expected Result:**
- With the Email field empty, **Send Reset Link** is disabled.
- With `abc`, an alert titled **Invalid Email** shows `Please enter a valid email address`; no request is sent.

**Locator hints:**
- Email input → `forgot-email-input` · Send Reset Link → `forgot-send-reset-button`.
- Invalid-email alert is native `Alert.alert` — assert by title **Invalid Email**.

### AUTH-TC-S03 · Forgot Password — rate-limit error

**Actors:** test-free

**Objective:** Verify a rate-limited reset request shows the friendly retry guidance.

**Steps:**
1. Trigger password-reset requests for the same address until Supabase returns the rate-limit error.

**Expected Result:**
- An alert titled **Reset Email Failed** shows `You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes.`
- The alert has an **Open Supabase Docs** button and an **OK** button.

**Locator hints:**
- Rate-limit alert is native `Alert.alert` — assert by title **Reset Email Failed**.

### AUTH-TC-S04 · Forgot Password — SMTP-config (500) error

**Actors:** test-free

**Objective:** Verify the error alert surfaces SMTP/redirect-URL troubleshooting guidance on a 500-class error.

**Steps:**
1. Attempt to send a reset email while the Supabase Auth SMTP configuration is broken.

**Expected Result:**
- An alert titled **Reset Email Failed** shows the base error message followed by:
  - `Possible causes: • SMTP/email provider not configured in Supabase Auth • Redirect URL not allowed in Auth settings`
  - `Check Supabase Auth > Email Settings and Email Logs.`
- The alert has **Open Supabase Docs** and **OK** buttons.

**Locator hints:**
- SMTP/500 alert is native `Alert.alert` — assert by title **Reset Email Failed**.

### AUTH-TC-S05 · Forgot Password — 400 error

**Actors:** test-free

**Objective:** Verify the error alert appends account-guidance on a 400 response.

**Steps:**
1. Attempt to send a reset email under the condition that yields a 400 response.

**Expected Result:**
- An alert titled **Reset Email Failed** shows the base error message followed by `Check that the email you entered is correct and belongs to an account.`
- The alert has **Open Supabase Docs** and **OK** buttons.

**Locator hints:**
- 400 alert is native `Alert.alert` — assert by title **Reset Email Failed**.

### AUTH-TC-S06 · Forgot Password — Back to Login

**Actors:** test-free

**Objective:** Verify the Back to Login link returns to the Login screen from both the form and the success state.

**Steps:**
1. Open Forgot Password and tap **Back to Login**.
2. Repeat, after reaching the **Check Your Inbox** success state, tapping **Back to Login** there.

**Expected Result:**
- In both cases the app returns to the Login screen.

**Locator hints:**
- Back to Login (form) → `forgot-back-to-login` · Back to Login (success state) → `forgot-back-to-login-success`.

### AUTH-TC-S07 · Reset Password — validation + requirements card

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

**Locator hints:**
- Screen: `src/screens/auth/ResetPasswordScreen.tsx` (instrumented 2026-08-15).
- New Password → `reset-new-password-input` · Confirm Password → `reset-confirm-password-input` · Reset Password → `reset-submit-button` · Back to Login → `reset-back-to-login` · Link-Error "Request New Reset Email" → `reset-request-new-email-button`.
- Requirements card is static text — assert by label; error/success alerts are native `Alert.alert`.

### AUTH-TC-S08 · Reset Password — success → Login

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

**Locator hints:**
- New Password → `reset-new-password-input` · Confirm Password → `reset-confirm-password-input` · Reset Password → `reset-submit-button`.
- Success alert is native `Alert.alert` — tap OK, then assert Login screen.

### AUTH-TC-S09 · Reset Password — link-error (expired) → Request New Reset Email

**Actors:** test-free

**Objective:** Verify an expired reset link shows the Link Error card and the request-new-email path.

**Steps:**
1. Open the app via an expired reset link (a URL whose hash contains `error=…&error_description=…expired`).

**Expected Result:**
- A **Link Error** card shows `This reset link has expired. Please request a new password reset email.`
- The card's **Request New Reset Email** button navigates to the Forgot Password screen.

**Locator hints:**
- Link-Error card button "Request New Reset Email" → `reset-request-new-email-button`.

### AUTH-TC-S10 · Reset Password — no active reset session

**Actors:** test-free

**Objective:** Verify that submitting without a valid reset session blocks the update with a clear message.

**Steps:**
1. Open the Reset Password screen without a valid reset session (no access/refresh token in the link).
2. Enter a valid new password + matching confirm and tap **Reset Password**.

**Expected Result:**
- An alert titled **No active reset session** shows `This link does not provide a valid reset session. Please request a new password reset email.`
- The password is not changed.

**Locator hints:**
- New Password → `reset-new-password-input` · Confirm Password → `reset-confirm-password-input` · Reset Password → `reset-submit-button`.
- "No active reset session" alert is native `Alert.alert` — assert by title.

### AUTH-TC-S11 · Deep link `p2pkidsmarketplace://reset-password`

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

**Locator hints:**
- New Password → `reset-new-password-input` · Confirm Password → `reset-confirm-password-input` · Reset Password → `reset-submit-button` · Link-Error card button → `reset-request-new-email-button`.

---

## Regression checks (run after any change to these flows)

### AUTH-TC-R01 · Auth boundary integrity

**Objective:** Verify logout always returns to the unauthenticated stack and login returns to the correct stack.
**Steps:**
1. Log in, then log out; log back in as a completed user and as an onboarding-incomplete user.
**Expected Result:**
- Logout shows Landing; a completed user lands on Home; an incomplete user lands on onboarding.

### AUTH-TC-R02 · Session restore does not loop

**Objective:** Verify cold launch does not get stuck or loop on auth refresh.
**Steps:**
1. Cold-launch the app while logged in several times.
**Expected Result:**
- The app restores to Home without an infinite spinner or repeated re-subscribe loops.

### AUTH-TC-R03 · Node assignment consistency

**Objective:** Verify active vs inactive ZIP routing is consistent.
**Steps:**
1. Sign up with an active ZIP, then with an inactive ZIP.
**Expected Result:**
- Active ZIP assigns directly with no waitlist; inactive ZIP offers the waitlist and a fallback node.

### AUTH-TC-R04 · Pending listings never leak to feed

**Objective:** Verify a pending or edited-pending listing is never publicly visible.
**Steps:**
1. Submit a new listing and edit an approved listing; browse as another user.
**Expected Result:**
- Neither pending listing appears in discovery until (re)approved.

### AUTH-TC-R05 · Discovery node isolation

**Objective:** Verify discovery stays node-scoped by default.
**Steps:**
1. Browse as a user in one node; confirm other nodes' items are not shown unless Show All Nodes / cross-node filter is used.
**Expected Result:**
- Default results contain only the user's node items.

### AUTH-TC-R06 · Free vs subscriber gating holds

**Objective:** Verify SP/Accept-SP gating is enforced for free users across listing and discovery.
**Steps:**
1. As a free user, attempt to enable Accept SP on a listing and use SP-only discovery features.
**Expected Result:**
- SP creation/earn features are locked with upgrade prompts; browsing remains available.

---

## Accessibility & Automation Identifiers (2026-08-11)

> These cases verify the stable accessibility identifiers added for the AI-agent / accessibility-tree automation pilot.
> They apply to the iOS accessibility tree (Accessibility Inspector or the automation harness). Identifiers must be
> discoverable WITHOUT screenshot/coordinate tapping. See `docs/flow-registry.md` FLOW-00/FLOW-01 (ACCESSIBILITY-IDENTIFIERS).

### AUTH-TC-ACC-01 · Sign Up submit button is discoverable by identifier

**Objective:** Verify the Create Account submit button appears as a button with a stable identifier.
**Steps:**
1. From Landing, tap **Sign Up** (Create Account screen).
2. Inspect the iOS accessibility tree.
**Expected Result:**
- The submit control appears as a button with identifier `signup-submit-button` and label "Create Account". No coordinate tap needed.

### AUTH-TC-ACC-02 · Log In submit button is discoverable by identifier

**Objective:** Verify the Log In submit button appears as a button with a stable identifier.
**Steps:**
1. From Landing, tap **Log In**.
2. Inspect the iOS accessibility tree.
**Expected Result:**
- The submit control appears as a button with identifier `login-submit-button` and label "Log In". No coordinate tap needed.

### AUTH-TC-ACC-03 · Auth error dialog OK buttons are discoverable by identifier

**Objective:** Verify the blocking auth error dialogs expose an identifiable OK button.
**Steps:**
1. Log in with a wrong password (e.g. `WrongPassword123!`) to trigger the "Login Failed" dialog.
2. Inspect the tree while the dialog is up; confirm identifier `login-failed-dialog-ok-button`; tap it via the tree to dismiss.
3. (If reachable) trigger a backend signup failure so the "Signup Failed" dialog appears; confirm identifier `signup-error-dialog-ok-button`.
**Expected Result:**
- Each dialog's OK button is a button in the tree with its own identifier and is activatable by identifier. User stays on the same screen after dismiss (no navigation change).

### AUTH-TC-ACC-04 · Bottom tab bar items are discoverable by identifier

**Objective:** Verify every persistent bottom tab exposes an accessible button with a stable identifier.
**Steps:**
1. Log in and land on Home.
2. Inspect the tree at the bottom bar.
**Expected Result:**
- Tabs appear as buttons: `tab-home`, `tab-discover`, `tab-sell` (Sell FAB), `tab-inbox`, `tab-trade-basket` — each with its visible label and selected state, activatable by identifier.

### AUTH-TC-ACC-05 · No visual/layout regression from identifiers

**Objective:** Confirm adding accessibility props changed no visuals.
**Steps:**
1. Screenshot Create Account, Login, the "Login Failed" dialog, and Home before and after this change.
2. Compare pixels (or eyeball layout) — no shifts, color changes, or text changes.
**Expected Result:**
- Identical layout/colors/text. (Zero-logic UI change.)

### AUTH-TC-ACC-06 · Widget tests still pass

**Objective:** Ensure the accessibility props did not break unit tests.
**Steps:**
1. Run `cd p2p-kids-marketplace && yarn test`.
**Expected Result:**
- All suites pass. If a widget test asserts on the tree structure and a new identifier breaks a finder, update the finder to the new `testID` — do not remove the accessibility props.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Accessibility identifiers: Sign Up / Log In / dialog OK / tab bar | AUTH-TC-ACC-01 … AUTH-TC-ACC-06 |
| Signup happy path → phone verification | AUTH-TC-A01 |
| Signup field validation | AUTH-TC-A02, AUTH-TC-A03 |
| 18+ age gate | AUTH-TC-A04 |
| Duplicate email blocked | AUTH-TC-A05 |
| Optional referral code handling | AUTH-TC-A06 |
| Terms/Privacy acceptance recorded | AUTH-TC-A07 |
| Login routes by onboarding status | AUTH-TC-B01 |
| Invalid credentials error | AUTH-TC-B02 |
| Forgot password entry | AUTH-TC-B03 |
| Session restore after relaunch | AUTH-TC-B04 |
| Silent resume refresh | AUTH-TC-B05 |
| Cold launch no hang | AUTH-TC-B06, AUTH-TC-R02 |
| Social login Google/Facebook/Apple | AUTH-TC-C01, AUTH-TC-C02, AUTH-TC-C03 |
| Account-link prompt (email match) | AUTH-TC-C04 |
| Provider unavailable fallback | AUTH-TC-C05 |
| OAuth cancel silent return | AUTH-TC-C06 |
| Social-only set password | AUTH-TC-C07 |
| Logout from Profile / Settings | AUTH-TC-D01, AUTH-TC-D02 |
| Logout returns to Landing | AUTH-TC-D03, AUTH-TC-R01 |
| Phone OTP send/verify | AUTH-TC-E01 |
| OTP error states | AUTH-TC-E02 |
| Resend cooldown | AUTH-TC-E03 |
| OTP rate limiting | AUTH-TC-E04 |
| Phone gate before listing | AUTH-TC-E05, AUTH-TC-J10 |
| Active ZIP node assignment | AUTH-TC-F01, AUTH-TC-R03 |
| Inactive ZIP waitlist offer | AUTH-TC-F02, AUTH-TC-F03, AUTH-TC-F04, AUTH-TC-R03 |
| ZIP auto-lookup city/state | AUTH-TC-F05 |
| Node-scoped content toggle | AUTH-TC-F06, AUTH-TC-O01, AUTH-TC-R05 |
| Admin create active/inactive node | AUTH-TC-G01, AUTH-TC-G02 |
| Admin edit node | AUTH-TC-G03 |
| Admin deactivate/reactivate node | AUTH-TC-G04, AUTH-TC-G05 |
| Node stats + form validation | AUTH-TC-G06 |
| Profile Setup capture + validation | AUTH-TC-H01, AUTH-TC-H02, AUTH-TC-H03 |
| Welcome / Feature Highlights | AUTH-TC-H04, AUTH-TC-H05 |
| Onboarding carousel + completion | AUTH-TC-H06, AUTH-TC-H07 |
| Subscription choice trial/free | AUTH-TC-I01, AUTH-TC-I02, AUTH-TC-I03 |
| Listing photo-first gating | AUTH-TC-J01 |
| AI auto-fill apply | AUTH-TC-J02 |
| Listing required-field validation | AUTH-TC-J03 |
| Listing enums (condition/age/gender/color) | AUTH-TC-J04 |
| Other category custom name | AUTH-TC-J05 |
| Payment preference subscriber/free | AUTH-TC-J06, AUTH-TC-J07, AUTH-TC-R06 |
| SP earnings preview | AUTH-TC-J08, AUTH-TC-K06 |
| Submit for review → pending modal | AUTH-TC-J09 |
| Draft auto-save/resume | AUTH-TC-J11 |
| Bulk upload + grouping | AUTH-TC-K01, AUTH-TC-K02, AUTH-TC-K03 |
| Bulk Apply to All | AUTH-TC-K04 |
| Bulk submit + confirm | AUTH-TC-K05 |
| Pending hidden until approved | AUTH-TC-L01, AUTH-TC-R04 |
| Admin approval makes visible | AUTH-TC-L02 |
| Seller approval notification | AUTH-TC-L03 |
| Edit returns to pending | AUTH-TC-L04, AUTH-TC-R04 |
| Search debounce + clear | AUTH-TC-M01 |
| Recent searches + autocomplete | AUTH-TC-M02 |
| Sort options | AUTH-TC-M03 |
| Filters modal (SP toggle, More Filters, live count) | AUTH-TC-M04 |
| "Accepts SP" toggle (header ↔ sheet sync) | AUTH-TC-M05, AUTH-TC-O04, AUTH-TC-R06 |
| Empty/no-results states | AUTH-TC-M06 |
| Recent Searches chip row + Clear | AUTH-TC-M07 |
| Trending in state (top categories by count) | AUTH-TC-M08 |
| Result count + active filter chips (incl. gold SP chip) | AUTH-TC-M09 |
| Discover header bookmark → Favorites (local header) | AUTH-TC-M10 |
| Category browse | AUTH-TC-N01 |
| Favorites toggle | AUTH-TC-N02 |
| Infinite scroll pagination | AUTH-TC-N03 |
| Item card §6.2 layout + gold Accepts SP badge | AUTH-TC-N04 |
| Location ZIP + radius | AUTH-TC-O02 |
| Inactive ZIP in discovery filter | AUTH-TC-O03 |
| Admin radius defaults/bounds | AUTH-TC-O05 |
