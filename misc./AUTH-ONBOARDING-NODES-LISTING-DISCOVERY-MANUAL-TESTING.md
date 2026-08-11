# Auth · Onboarding · Nodes · Listing · Discovery — Manual Testing Guide

**Source of truth:** `Prompts/Done/MODULE-02-AUTHENTICATION.md` · `Prompts/MODULE-03-AUTH-V2.md` · `Prompts/V3/MODULE-03-AUTH-V3-SOCIAL-LOGIN.md` · `Prompts/MODULE-03-NODE-MANAGEMENT.md` · `Prompts/V3/MODULE-04-ITEM-LISTING-V3.md` · `Prompts/Done/MODULE-05-DISCOVERY-V2.md` · `docs/flow-registry.md`
**Flows covered:** FLOW-01 (Signup/Login/Logout/Session Restore) · FLOW-02 (Profiles & Onboarding) · FLOW-03 (Node/ZIP Gating + Waitlist) · FLOW-04 (Listings — Create/Bulk/Pending) · FLOW-04C (Category SP Calculations & Bonus Badges) · FLOW-05 (Media Upload / Storage) · FLOW-06 (Discovery — Feed/Search/Filters/Favorites) · FLOW-30 (Global App Shell — Header, Floating Nav & Home Composer)
**Last updated:** 2026-08-11
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Signup (Email/Password)** | TC-A01 | Successful signup with valid details |
| | TC-A02 | Field validation errors (name/email/phone/password) |
| | TC-A03 | Password mismatch + weak password |
| | TC-A04 | Under-18 date of birth blocked |
| | TC-A05 | Duplicate email blocked |
| | TC-A06 | Optional referral code (valid / invalid handling) |
| | TC-A07 | Terms of Service & Privacy Policy links |
| **B — Login & Session Restore** | TC-B01 | Successful login routes by onboarding status |
| | TC-B02 | Invalid credentials error |
| | TC-B03 | Forgot Password link |
| | TC-B04 | Session restore after app kill/relaunch |
| | TC-B05 | App resume refreshes silently (no spinner) |
| | TC-B06 | Cold launch does not hang on spinner |
| **C — Social Login** | TC-C01 | Sign in / Continue with Google |
| | TC-C02 | Sign in / Continue with Facebook |
| | TC-C03 | Sign in / Continue with Apple (iOS + Android) |
| | TC-C04 | Existing-email account-link prompt |
| | TC-C05 | Provider unavailable → email fallback banner |
| | TC-C06 | User cancels OAuth — silent return |
| | TC-C07 | Social-only user sets a password |
| **D — Logout** | TC-D01 | Logout from Profile with confirmation |
| | TC-D02 | Sign Out from Settings |
| | TC-D03 | After logout, app returns to Landing |
| **E — Phone Verification (Deferred Gate)** | TC-E01 | OTP screen sends + verifies 6-digit code |
| | TC-E02 | Incomplete / invalid / expired code errors |
| | TC-E03 | Resend cooldown (60s) |
| | TC-E04 | OTP rate limiting message |
| | TC-E05 | Gate blocks first listing until verified |
| **F — Node/ZIP Gating & Waitlist (End User)** | TC-F01 | Active ZIP → assigned to node, no waitlist |
| | TC-F02 | Inactive ZIP → "We're Coming Soon!" + Join Waitlist |
| | TC-F03 | Waitlist confirmation + fallback node access |
| | TC-F04 | Continue Trading without joining waitlist |
| | TC-F05 | ZIP auto-lookup shows city/state |
| | TC-F06 | Node-scoped content (My Node vs Show All Nodes) |
| **G — Node Management (Admin)** | TC-G01 | Admin creates an active node (ZIP auto-lookup) |
| | TC-G02 | Admin creates an inactive node |
| | TC-G03 | Admin edits a node |
| | TC-G04 | Admin deactivates a node with members (warning) |
| | TC-G05 | Admin reactivates a node |
| | TC-G06 | Node stats cards + validation |
| **H — Profile Setup & Onboarding** | TC-H01 | Profile Setup: avatar + display name + ZIP |
| | TC-H02 | Profile Setup validation errors |
| | TC-H03 | Avatar upload failure does not block |
| | TC-H04 | Welcome screen → Get Started |
| | TC-H05 | Feature Highlights carousel |
| | TC-H06 | Onboarding carousel: Next / Skip / Get Started |
| | TC-H07 | Onboarding completion routes to Home |
| **I — Subscription Choice (Onboarding)** | TC-I01 | Start Free Trial enrolls Kids Club+ |
| | TC-I02 | Continue Free stays on free tier |
| | TC-I03 | Trial limit reached hides trial CTA |
| **J — Listing Creation (Single Item)** | TC-J01 | Photo-first gating (fields hidden until 1 photo) |
| | TC-J02 | AI auto-fill Apply All + per-field Use |
| | TC-J03 | Required field validation |
| | TC-J04 | Condition / Age Group / Gender / Color options |
| | TC-J05 | "Other" category → custom name required |
| | TC-J06 | Payment preference — subscriber Accept SP toggle |
| | TC-J07 | Payment preference — free user upgrade prompt |
| | TC-J08 | SP earnings preview (subscriber) |
| | TC-J09 | Submit for Review → pending + success modal |
| | TC-J10 | Phone-verification gate before publish |
| | TC-J11 | Draft auto-save + resume |
| | TC-J12 | Listing photos — multiple upload, type and size validation |
| | TC-J13 | Listing photos — remove, reorder, replace, and persist after resume |
| | TC-J14 | Bonus category badge appears in picker and preview |
| | TC-J15 | Category-specific SP earn and buyer-cap preview recalculates |
| **K — Bulk Listing Creation** | TC-K01 | Multi-photo upload + auto-grouping |
| | TC-K02 | Regroup / merge / move photos |
| | TC-K03 | Step indicator: Photos → Group → Review → Publish |
| | TC-K04 | Apply to All bar (brand/condition/age/gender) |
| | TC-K05 | Submit N Items for Review + confirm sheet |
| | TC-K06 | Bulk SP summary (subscriber) |
| **L — Admin Review / Pending** | TC-L01 | New listing not visible in feed until approved |
| | TC-L02 | Admin approves → item becomes visible |
| | TC-L03 | Seller receives approval notification |
| | TC-L04 | Editing an approved listing returns to pending |
| **M — Discovery: Search & Filters** | TC-M01 | Search bar (debounced) + clear |
| | TC-M02 | Recent searches + autocomplete |
| | TC-M03 | Sort options |
| | TC-M04 | Filters modal (category/condition/price/age/gender/brand/color) |
| | TC-M05 | SP Only toggle |
| | TC-M06 | Empty / no-results states |
| **N — Discovery: Category & Favorites** | TC-N01 | Category browse filters results |
| | TC-N02 | Favorite heart toggle on item card |
| | TC-N03 | Infinite scroll pagination |
| **O — Discovery: Node Scoping & SP Visibility** | TC-O01 | Results scoped to user's node |
| | TC-O02 | Location ZIP + radius filter |
| | TC-O03 | Inactive ZIP in filter → waitlist prompt |
| | TC-O04 | Subscriber vs free SP visibility |
| | TC-O05 | Admin radius defaults and bounds reflect in Discover |
| **P — Global Header, Floating Nav & Home Composer** | TC-P01 | Header node chip shows registered market (read-only) |
| | TC-P02 | Header right cluster: bell + chat + avatar; logout removed from header |
| | TC-P03 | Header chat icon opens Messages with unread badge |
| | TC-P04 | Floating pill nav: order, margins, radius, shadow, safe area |
| | TC-P05 | Inbox removed from nav; Messages via header chat only |
| | TC-P06 | Trades tab: Active Trades (item, counterpart, status label) |
| | TC-P07 | Trades tab: Trade History (reverse chronological) |
| | TC-P08 | Trades badge counts active (not completed/cancelled) |
| | TC-P09 | Basket badge + Home active state unchanged |
| | TC-P10 | Post FAB globally visible + opens Sell sheet |
| | TC-P11 | Composer bar: tap focuses, type, placeholder |
| | TC-P12 | Composer "+" → New Item Photos step, Title pre-filled |
| | TC-P13 | Composer empty submit → empty Title |
| | TC-P14 | Composer camera → New Item straight to camera |
| | TC-P15 | AI never overwrites composer-pre-filled Title |
| | TC-P16 | FAB Sell sheet unchanged (parallel entry point) |
| | TC-P17 | Logout still reachable from Profile/Settings |
| | TC-P18 | Composer analytics (tap + submit with/without text) |
| | TC-P19 | Accessibility identifiers (Trades tab, header chat) |

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

### TC-A01 · Successful signup with valid details

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

### TC-A02 · Field validation errors

**Actors:** new-user

**Objective:** Verify inline validation for required fields.

**Steps:**
1. On **Create Account**, leave fields blank or enter invalid values: a 1-character name, an invalid email (`abc`), a 5-digit phone, and a weak password.
2. Attempt to submit.

**Expected Result:**
- Inline red errors appear under the relevant fields, e.g., "Name must be at least 2 characters", "Please enter a valid email address", "Please enter a valid phone number (10+ digits)", and password rule errors ("at least 8 characters", "one uppercase letter", "one lowercase letter", "one number").
- Submission is blocked until errors are resolved.

### TC-A03 · Password mismatch and weak password

**Actors:** new-user

**Objective:** Verify password confirmation and strength rules.

**Steps:**
1. Enter a password and a different value in Confirm Password; attempt to submit.
2. Then set a weak password (e.g., `abc`) and submit.

**Expected Result:**
- "Passwords do not match" appears when the two fields differ.
- Password strength errors appear for weak passwords and submission is blocked.

### TC-A04 · Under-18 date of birth blocked

**Actors:** new-user

**Objective:** Verify the 18+ age gate.

**Steps:**
1. In the date-of-birth picker, choose a date that makes the user younger than 18.
2. Attempt to submit.

**Expected Result:**
- An error appears: "Sorry, you must be 18 years old to register." (or equivalent), and signup is blocked.

### TC-A05 · Duplicate email blocked

**Actors:** new-user

**Objective:** Verify signing up with an already-registered email is rejected.

**Steps:**
1. Enter the email of an existing account and complete the rest of the form.
2. Tap **Sign Up**.

**Expected Result:**
- A message appears: "This email is already registered. Please log in instead." and no new account is created.

### TC-A06 · Optional referral code

**Actors:** new-user

**Objective:** Verify referral code is optional and invalid codes are handled gracefully.

**Steps:**
1. Enter a valid 8-character referral code and complete signup.
2. In a separate attempt, enter an invalid referral code and submit.

**Expected Result:**
- A valid code is accepted and signup proceeds.
- An invalid code shows a prompt like "The referral code you entered is invalid. Would you like to fix it or continue without a code?" with **Fix it** and **Continue anyway** options; choosing **Continue anyway** completes signup without a code.

### TC-A07 · Terms and Privacy links

**Actors:** new-user

**Objective:** Verify the legal links are present and open.

**Steps:**
1. On the **Create Account** screen, tap **Terms of Service**, then **Privacy Policy**.

**Expected Result:**
- Each link opens the corresponding policy content.
- On successful signup, the current Terms and Privacy acceptances are recorded for the user.

---

## Group B — Login & Session Restore

### TC-B01 · Successful login routes by onboarding status

**Actors:** test-buyer, new-user

**Objective:** Verify login routes a completed user to Home and an incomplete user to onboarding.

**Steps:**
1. From the Landing screen tap **Log In**, enter the email/password for **test-buyer**, and tap **Log In**.
2. Repeat with a user who has not finished onboarding.

**Expected Result:**
- **test-buyer** lands on the Home tabs (main app).
- A user with onboarding incomplete lands on the onboarding stack (Welcome / carousel).

### TC-B02 · Invalid credentials error

**Actors:** test-free

**Objective:** Verify wrong credentials show a clear error.

**Steps:**
1. Enter a valid email with the wrong password and tap **Log In**.

**Expected Result:**
- "Invalid email or password." appears and the user stays on the Login screen.

### TC-B03 · Forgot Password link

**Actors:** test-free

**Objective:** Verify the Forgot Password entry point works.

**Steps:**
1. On the Login screen tap **Forgot Password?**.

**Expected Result:**
- The password reset flow opens.

### TC-B04 · Session restore after app kill/relaunch

**Actors:** test-buyer

**Objective:** Verify the session persists across an app restart.

**Steps:**
1. Log in as **test-buyer**.
2. Fully kill the app (swipe it away).
3. Relaunch the app.

**Expected Result:**
- The user is restored straight into the Home tabs without re-entering credentials.

### TC-B05 · App resume refreshes silently

**Actors:** test-buyer

**Objective:** Verify resuming from background refreshes state without a blocking spinner.

**Steps:**
1. With **test-buyer** logged in, background the app, then bring it back to the foreground.

**Expected Result:**
- The app returns to the same screen; no full-screen loading spinner blocks the UI during the background refresh.

### TC-B06 · Cold launch does not hang on spinner

**Actors:** test-buyer

**Objective:** Verify the app does not get stuck on a full-screen spinner when network/profile calls stall.

**Steps:**
1. With a slow or briefly interrupted network, cold-launch the app while logged in.

**Expected Result:**
- Within roughly 12 seconds the app stops showing the full-screen spinner and renders either the authenticated app or the unauthenticated Landing screen; it never hangs indefinitely.

---

## Group C — Social Login

### TC-C01 · Sign in / Continue with Google

**Actors:** new-user

**Objective:** Verify Google sign-in creates a session and auto-fills the profile on first signup.

**Steps:**
1. On the Login or Signup screen tap **Continue with Google** (Signup) / **Sign in with Google** (Login).
2. Complete authentication in the Google consent screen.

**Expected Result:**
- A browser opens the Google sign-in/consent page; after success the app returns and a session is created.
- For a first-time signup, the profile name and avatar are auto-filled from Google and email verification is skipped.

### TC-C02 · Sign in / Continue with Facebook

**Actors:** new-user

**Objective:** Verify Facebook sign-in works.

**Steps:**
1. Tap **Continue with Facebook** / **Sign in with Facebook** and complete authentication.

**Expected Result:**
- A session is created and (on first signup) the profile is auto-filled from Facebook.

### TC-C03 · Sign in / Continue with Apple (iOS + Android)

**Actors:** new-user

**Objective:** Verify the Apple button renders on both platforms and works.

**Steps:**
1. Confirm the **Sign in with Apple** button is present on both iOS and Android.
2. Tap it and complete Apple authentication.

**Expected Result:**
- The Apple button is shown on both platforms.
- Authentication succeeds and a session is created.

### TC-C04 · Existing-email account-link prompt

**Actors:** test-free

**Objective:** Verify linking a social provider to an existing email account is prompted safely.

**Steps:**
1. Sign in with a social provider whose email matches an existing email/password account.

**Expected Result:**
- An "Account Exists" prompt appears, e.g., "An account with {email} already exists" with an option to continue and link the provider.
- Linking requires password re-authentication when the existing account has a password.

### TC-C05 · Provider unavailable → email fallback banner

**Actors:** new-user

**Objective:** Verify a provider outage surfaces a graceful fallback.

**Steps:**
1. Attempt social login when the provider is unavailable / times out.

**Expected Result:**
- An inline banner appears: "{Provider} is temporarily unavailable. Sign up with email instead?" with a path to email signup. The app does not crash.

### TC-C06 · User cancels OAuth — silent return

**Actors:** new-user

**Objective:** Verify cancelling the provider screen returns quietly.

**Steps:**
1. Start a social login, then cancel/deny on the provider screen.

**Expected Result:**
- The app silently returns to the previous screen with no error toast.

### TC-C07 · Social-only user sets a password

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

### TC-D01 · Logout from Profile with confirmation

**Actors:** test-buyer

**Objective:** Verify logout from the Profile screen requires confirmation.

**Steps:**
1. Open the **Profile** screen and tap **Logout** (red).
2. Confirm in the dialog.

**Expected Result:**
- A confirmation dialog appears ("Are you sure you want to logout?") with Cancel and Logout.
- Confirming signs out and returns to the Landing screen.

### TC-D02 · Sign Out from Settings

**Actors:** test-buyer

**Objective:** Verify the Settings sign-out path.

**Steps:**
1. Open **Settings** and tap **Sign Out**; confirm.

**Expected Result:**
- The user is signed out and returned to the Landing screen.

### TC-D03 · After logout, app returns to Landing

**Actors:** test-buyer

**Objective:** Verify logged-out state shows no user data.

**Steps:**
1. After logging out, observe the Landing screen.

**Expected Result:**
- The Landing screen shows **Sign Up** / **Log In** and no authenticated content is accessible.

---

## Group E — Phone Verification (Deferred Gate)

### TC-E01 · OTP screen sends and verifies a 6-digit code

**Actors:** new-user

**Objective:** Verify the phone verification screen sends a code and accepts a valid 6-digit OTP.

**Steps:**
1. Reach the **Verify Your Phone** screen (after signup).
2. Enter the 6-digit code received (or the DEV bypass `123456`).
3. Tap **Verify**.

**Expected Result:**
- The screen shows "We sent a 6-digit code to {phone}" and a 6-box OTP input.
- A valid code shows a success message and proceeds to **Complete Your Profile** (Profile Setup).

### TC-E02 · Incomplete / invalid / expired code errors

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

### TC-E03 · Resend cooldown

**Actors:** new-user

**Objective:** Verify the resend cooldown timer.

**Steps:**
1. On the OTP screen, observe the **Resend Code** control immediately after a code is sent.

**Expected Result:**
- Resend is disabled and shows a countdown (e.g., "Resend in 59s"); it becomes enabled after 60 seconds.

### TC-E04 · OTP rate limiting message

**Actors:** new-user

**Objective:** Verify rate limiting surfaces a clear message.

**Steps:**
1. Request codes repeatedly to exceed the limit (3 per hour per phone / 5 per day per user).

**Expected Result:**
- A message like "Too many attempts. Try again in {N} seconds." appears and further sends are blocked until the window passes.

### TC-E05 · Gate blocks first listing until verified

**Actors:** new-user

**Objective:** Verify an unverified phone blocks publishing a listing.

**Steps:**
1. As a user who has not verified a phone, start creating a listing and attempt to publish.

**Expected Result:**
- A phone verification modal appears and publishing is blocked until verification completes; after verifying, the publish flow resumes.

---

## Group F — Node/ZIP Gating & Waitlist (End User)

### TC-F01 · Active ZIP → assigned to node, no waitlist

**Actors:** new-user

**Precondition:** ZIP `06850` belongs to an active node.

**Objective:** Verify an active ZIP assigns the user to that node with no waitlist prompt.

**Steps:**
1. On **Complete Your Profile**, enter a display name and ZIP `06850`.
2. Tap **Complete Setup**.

**Expected Result:**
- The ZIP field auto-displays "📍 Norwalk, CT" (city/state) below it.
- No waitlist modal appears; a success message ("Your profile has been created!") shows and the user proceeds into the app able to browse that node's items.

### TC-F02 · Inactive ZIP → "We're Coming Soon!" + Join Waitlist

**Actors:** new-user

**Precondition:** ZIP `07999` has no active node.

**Objective:** Verify an inactive ZIP offers the waitlist and a fallback node.

**Steps:**
1. On **Complete Your Profile**, enter ZIP `07999` and submit.

**Expected Result:**
- A modal titled "We're Coming Soon!" explains the area isn't active yet and that the user has been connected with traders in a nearby (fallback) node.
- The modal offers **Join Waitlist** (primary) and **Continue Trading** (secondary).

### TC-F03 · Waitlist confirmation + fallback node access

**Actors:** new-user

**Objective:** Verify joining the waitlist confirms and grants fallback-node access.

**Steps:**
1. In the "We're Coming Soon!" modal, tap **Join Waitlist**.
2. After confirmation, tap **Got it**.

**Expected Result:**
- A "Waitlist Confirmed" modal thanks the user and states they'll be notified when the area launches, and that they can trade with users in the assigned (fallback) node meanwhile.
- Tapping **Got it** proceeds into the app with access to the fallback node's items.

### TC-F04 · Continue Trading without joining waitlist

**Actors:** new-user

**Objective:** Verify the user can skip the waitlist and still use the app.

**Steps:**
1. In the "We're Coming Soon!" modal, tap **Continue Trading**.

**Expected Result:**
- The modal closes and the user proceeds into the app on the fallback node without being added to the waitlist.

### TC-F05 · ZIP auto-lookup shows city/state

**Actors:** new-user

**Objective:** Verify the ZIP field resolves to a city/state.

**Steps:**
1. On **Complete Your Profile**, type a valid 5-digit ZIP.

**Expected Result:**
- Once 5 digits are entered, "📍 {City}, {State}" appears in green beneath the field, with helper text "We'll assign you to your nearest community node".

### TC-F06 · Node-scoped content (My Node vs Show All Nodes)

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

### TC-G01 · Admin creates an active node

**Actors:** admin

**Objective:** Verify an admin can create an active node with ZIP auto-lookup.

**Steps:**
1. In the admin portal open **Geographic Nodes** and tap **+ Add Node**.
2. Enter a Node Name and a 5-digit ZIP; wait for the lookup to populate City, State, Latitude, Longitude.
3. Set a Radius (1–100), leave **Active** checked, and tap **Create Node**.

**Expected Result:**
- The ZIP lookup auto-fills City/State/Lat/Lng (showing "Looking up ZIP code..." briefly).
- On save, the modal closes, a success message shows, and the new node appears in the table with a green **Active** badge.

### TC-G02 · Admin creates an inactive node

**Actors:** admin

**Objective:** Verify creating a node with Active unchecked.

**Steps:**
1. Add a node as in TC-G01 but uncheck **Active (users can be assigned to this node)** before saving.

**Expected Result:**
- The node is created with a gray **Inactive** badge and its action shows **Activate**.

### TC-G03 · Admin edits a node

**Actors:** admin

**Objective:** Verify editing node fields persists.

**Steps:**
1. On the Nodes table tap **Edit** for a node.
2. Change the Name/Radius/Description and tap **Update Node**.

**Expected Result:**
- The modal title reads "Edit Node"; saved changes appear in the table and persist after a page refresh.

### TC-G04 · Admin deactivates a node with members (warning)

**Actors:** admin

**Objective:** Verify deactivation of a node with members shows a warning and keeps members assigned.

**Steps:**
1. On an active node with members > 0, tap **Deactivate**.
2. Read the confirmation and confirm.

**Expected Result:**
- The confirmation warns that the node has N active members who remain assigned but that new users cannot join the node.
- After confirming, the badge changes to **Inactive** and the action becomes **Activate**.
- New signups with that node's ZIP are routed to a different active node (or offered the waitlist).

### TC-G05 · Admin reactivates a node

**Actors:** admin

**Objective:** Verify reactivation restores assignability.

**Steps:**
1. On an inactive node tap **Activate** and confirm.

**Expected Result:**
- The badge returns to **Active** and new users with that ZIP can be assigned to it.

### TC-G06 · Node stats cards + validation

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

### TC-H01 · Profile Setup: avatar + display name + ZIP

**Actors:** new-user

**Objective:** Verify the Profile Setup screen captures avatar, name, and ZIP.

**Steps:**
1. On **Complete Your Profile**, tap the camera icon and choose a photo.
2. Enter a display name and a valid ZIP, then tap **Complete Setup**.

**Expected Result:**
- The avatar preview updates, the ZIP resolves to city/state, and on submit the user advances (to Welcome / onboarding).

### TC-H02 · Profile Setup validation errors

**Actors:** new-user

**Objective:** Verify required-field validation on Profile Setup.

**Steps:**
1. Attempt **Complete Setup** with a 1-character display name and a 3-digit ZIP.

**Expected Result:**
- "Display name must be at least 2 characters" and "Zip code must be 5 digits" appear; submission is blocked.

### TC-H03 · Avatar upload failure does not block

**Actors:** new-user

**Objective:** Verify a failed avatar upload still allows completion.

**Steps:**
1. Trigger an avatar upload failure (e.g., interrupted network) and complete the rest of the form.

**Expected Result:**
- A warning notes the profile will be created without an avatar (addable later); profile completion still succeeds.

### TC-H04 · Welcome screen → Get Started

**Actors:** new-user

**Objective:** Verify the Welcome screen advances onboarding.

**Steps:**
1. On the Welcome screen, read the headline and tap **Get Started**.

**Expected Result:**
- The Welcome copy about a "safe, neighborhood marketplace" is shown; tapping **Get Started** marks onboarding progress and moves forward (eventually to Home).

### TC-H05 · Feature Highlights carousel

**Actors:** new-user

**Objective:** Verify the 4-slide feature highlights.

**Steps:**
1. Step through the Feature Highlights slides (Discover Items, Earn Money, Safe Trading, Build Reputation).
2. On the last slide tap **Get Started**.

**Expected Result:**
- Each slide shows a title, description, emoji, and pagination dots; the final **Get Started** advances the flow.

### TC-H06 · Onboarding carousel: Next / Skip / Get Started

**Actors:** new-user

**Objective:** Verify the educational onboarding carousel controls.

**Steps:**
1. Swipe through the onboarding carousel screens.
2. On one screen tap **Skip**; in a separate run, reach the last screen and tap **Get Started**.

**Expected Result:**
- Progress dots track the current screen.
- **Skip** marks onboarding skipped and goes to Home; **Get Started** on the last screen marks onboarding complete and goes to Home.

### TC-H07 · Onboarding completion routes to Home

**Actors:** new-user

**Objective:** Verify finishing onboarding lands on the Home tabs.

**Steps:**
1. Complete the full onboarding sequence.

**Expected Result:**
- The user arrives on the Home tabs and, on subsequent launches, is taken straight to Home (onboarding not shown again).

---

## Group I — Subscription Choice (Onboarding)

### TC-I01 · Start Free Trial enrolls Kids Club+

**Actors:** new-user

**Precondition:** Trial is enabled in admin config.

**Objective:** Verify starting the trial enrolls the user in Kids Club+.

**Steps:**
1. On the Subscription Choice screen, tap **Start Free Trial**.

**Expected Result:**
- The screen shows "Try Kids Club+ Free for N days" at $0.00; after enrolling, the user proceeds to Home and gains subscriber features (e.g., SP, Accept SP toggle).

### TC-I02 · Continue Free stays on free tier

**Actors:** new-user

**Objective:** Verify choosing free keeps the user on the free tier.

**Steps:**
1. On the Subscription Choice screen, tap **Continue Free**.

**Expected Result:**
- The user proceeds to Home on the free tier with subscriber-only features locked.

### TC-I03 · Trial limit reached hides trial CTA

**Actors:** new-user (who already used the max trials)

**Objective:** Verify the trial CTA hides once the trial limit is reached.

**Steps:**
1. Reach the Subscription Choice screen as a user who has exhausted allowed trials.

**Expected Result:**
- **Start Free Trial** is hidden; only the paid Kids Club+ option and **Continue Free** are shown.

---

## Group J — Listing Creation (Single Item)

### TC-J01 · Photo-first gating

**Actors:** test-seller

**Objective:** Verify item fields stay hidden until at least one photo is added.

**Steps:**
1. Open **New Item** (ItemCreate).
2. Observe the form before adding any photo, then add one photo.

**Expected Result:**
- Before a photo is added, the title/category/price fields are hidden.
- After adding at least one photo, the rest of the form appears. Up to 10 photos are allowed; adding an 11th shows "You can add up to 10 photos."

### TC-J02 · AI auto-fill Apply All + per-field Use

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

### TC-J03 · Required field validation

**Actors:** test-seller

**Objective:** Verify required fields are enforced before publishing.

**Steps:**
1. With a photo added, leave Title/Category/Price empty or invalid and attempt to submit.

**Expected Result:**
- The submit button stays disabled or shows errors like "Title must be between 3 and 100 characters", "Please select a category", "Please enter a valid price greater than $0".

### TC-J04 · Condition / Age Group / Gender / Color options

**Actors:** test-seller

**Objective:** Verify the selectable enums render correctly.

**Steps:**
1. Open Condition, Age Group, Gender, and Color selectors.

**Expected Result:**
- Condition shows New / Like New / Good / Fair / Worn with descriptions.
- Age Group shows 0-2, 3-5, 6-8, 9-12, 13+ years.
- Gender shows Boy / Girl / Unisex / Any.
- Color allows multi-select from the 12-color palette.

### TC-J05 · "Other" category requires a custom name

**Actors:** test-seller

**Objective:** Verify selecting "Other" requires a custom category name.

**Steps:**
1. In the Category modal choose **Other**.
2. Try to submit without entering a custom category name, then enter one.

**Expected Result:**
- A "Custom Category Name *" field appears with helper text that it will be sent to admin for review.
- Submission is blocked until a custom name is provided.

### TC-J06 · Payment preference — subscriber Accept SP toggle

**Actors:** test-seller (subscriber)

**Objective:** Verify subscribers can enable Accept Swap Points.

**Steps:**
1. In the Payment Preference section, toggle **Accept Swap Points?** on.

**Expected Result:**
- A "✓ SP Eligible" badge appears while the toggle is on; the hint reads "Allow buyers to pay with Swap Points".

### TC-J07 · Payment preference — free user upgrade prompt

**Actors:** test-free

**Objective:** Verify free users see an upgrade prompt instead of the SP toggle.

**Steps:**
1. As **test-free**, open the Payment Preference section while creating a listing.

**Expected Result:**
- A message like "🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!" is shown with an **Upgrade Now** button that opens Subscription Choice. No Accept SP toggle is available.

### TC-J08 · SP earnings preview (subscriber)

**Actors:** test-seller (subscriber)

**Objective:** Verify the SP earnings preview shows for subscribers.

**Steps:**
1. As a subscriber, enter a price on the item form.

**Expected Result:**
- An SP earnings preview appears below the price reflecting the category and price (hidden/greyed for free users).

### TC-J09 · Submit for Review → pending + success modal

**Actors:** test-seller

**Objective:** Verify a completed item submits as pending with the review message.

**Steps:**
1. Complete all required fields and tap **Submit for Review**.

**Expected Result:**
- A "Submitting Item For Review..." overlay shows, then a success modal: "Thanks for submitting!" explaining the item will be reviewed and the seller notified, with **Go To My Items** / **Go To Dashboard**.
- The item is created as pending and does not appear in the public feed yet.

### TC-J10 · Phone-verification gate before publish

**Actors:** new-user (unverified phone)

**Objective:** Verify publishing requires a verified phone.

**Steps:**
1. As a user without phone verification, complete the item form and tap **Submit for Review**.

**Expected Result:**
- A phone verification modal appears and blocks publishing until completed; afterward the publish resumes.

### TC-J11 · Draft auto-save + resume

**Actors:** test-seller

**Objective:** Verify drafts auto-save and can be resumed.

**Steps:**
1. Start an item, add a photo and partial details, then leave the screen.
2. Return to item creation.

**Expected Result:**
- A resume banner offers to continue the saved draft (drafts persist up to 7 days, up to 5 per seller).

### TC-J12 · Listing photos — multiple upload, type and size validation

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

### TC-J13 · Listing photos — remove, reorder, replace, and persist after resume

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

### TC-J14 · Bonus category badge appears in picker and preview

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

### TC-J15 · Category-specific SP earn and buyer-cap preview recalculates

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

### TC-K01 · Multi-photo upload + auto-grouping

**Actors:** test-seller

**Objective:** Verify bulk photo upload auto-groups into items.

**Steps:**
1. Open **Bulk Listing Create** and add multiple photos (up to 30).

**Expected Result:**
- Photos are auto-grouped into items (up to ~15); duplicate photos are flagged via perceptual-hash detection.

### TC-K02 · Regroup / merge / move photos

**Actors:** test-seller

**Objective:** Verify grouping can be adjusted.

**Steps:**
1. In the Group step, long-press to multi-select, then merge groups, move a photo to another item, and reorder photos within a group.

**Expected Result:**
- Grouping updates accordingly (merge, move-to-new, reorder), and the cover photo updates as expected.

### TC-K03 · Step indicator

**Actors:** test-seller

**Objective:** Verify the bulk step indicator reflects progress.

**Steps:**
1. Move through Photos → Group → Review → Publish.

**Expected Result:**
- The step indicator highlights the current step at each stage.

### TC-K04 · Apply to All bar

**Actors:** test-seller

**Objective:** Verify the Apply to All bar fills common fields non-destructively.

**Steps:**
1. In the Review step (with 2+ items), tap the **Brand**, **Condition**, **Age**, and **Gender** chips in the Apply to All bar.

**Expected Result:**
- Each chip suggests the most common value and fills only blank fields across included items, without overwriting existing values.

### TC-K05 · Submit N Items for Review + confirm sheet

**Actors:** test-seller

**Objective:** Verify bulk publish shows a count and confirmation.

**Steps:**
1. Complete required fields for the included items and tap **Submit N Items for Review**.
2. Review the confirmation sheet and confirm.

**Expected Result:**
- The publish button reads e.g. "Submit 5 Items for Review" (or "Submit 1 Item for Review") and is disabled if any included item is missing required fields.
- The confirmation sheet summarizes the items (and SP totals for subscribers); confirming submits them as pending.

### TC-K06 · Bulk SP summary (subscriber)

**Actors:** test-seller (subscriber)

**Objective:** Verify the combined SP summary shows for subscribers.

**Steps:**
1. As a subscriber, reach the bulk review/confirm with multiple items.

**Expected Result:**
- A combined SP earnings summary across all items is shown (hidden for free users).

---

## Group L — Admin Review / Pending

### TC-L01 · New listing not visible until approved

**Actors:** test-seller, test-buyer

**Objective:** Verify pending listings are hidden from the public feed.

**Steps:**
1. As **test-seller**, submit a new item.
2. As **test-buyer** in the same node, search/browse for that item.

**Expected Result:**
- The item does not appear in discovery while pending; in **My Items** the seller sees it marked as pending/under review.

### TC-L02 · Admin approves → item becomes visible

**Actors:** admin, test-buyer

**Objective:** Verify approval makes the item live.

**Steps:**
1. In the admin portal, open the pending/flagged listings queue and approve the item.
2. As **test-buyer**, browse the node feed.

**Expected Result:**
- After approval the item becomes visible (status available) and appears in the buyer's node feed.

### TC-L03 · Seller receives approval notification

**Actors:** test-seller

**Objective:** Verify the seller is notified on approval (respecting notification preferences).

**Steps:**
1. After an admin approves the listing, check the seller's notifications.

**Expected Result:**
- The seller receives a "listing approved" notification; tapping it deep-links to the listing detail.

### TC-L04 · Editing an approved listing returns to pending

**Actors:** test-seller

**Objective:** Verify edits re-trigger review.

**Steps:**
1. Edit an approved listing (e.g., change title/price/photos) and save.

**Expected Result:**
- The listing returns to pending and requires admin re-approval before it is publicly visible again.

---

## Group M — Discovery: Search & Filters

### TC-M01 · Search bar (debounced) + clear

**Actors:** test-buyer

**Objective:** Verify search is debounced and clearable.

**Steps:**
1. On **Discover**, type a query in the "Search items..." field.
2. Tap the clear (X) control.

**Expected Result:**
- Results update shortly after typing (debounced, not on every keystroke); the X clears the query and restores the default feed.

### TC-M02 · Recent searches + autocomplete

**Actors:** test-buyer

**Objective:** Verify recent searches and autocomplete suggestions.

**Steps:**
1. Focus the empty search field to view recent searches; remove one and use **Clear All**.
2. Type 2+ characters and observe autocomplete suggestions.

**Expected Result:**
- Recent searches list appears with per-item remove (✕) and Clear All; tapping one reuses it.
- Up to 5 autocomplete suggestions appear; tapping one applies the search.

### TC-M03 · Sort options

**Actors:** test-buyer

**Objective:** Verify sort ordering.

**Steps:**
1. Open the sort control and choose Relevance, Newest, Price (Low→High), then Price (High→Low).

**Expected Result:**
- Results reorder according to each selection.

### TC-M04 · Filters modal

**Actors:** test-buyer

**Objective:** Verify the filters modal applies and shows an active count.

**Steps:**
1. Open the **Filters** modal and set category, condition, price range, age group, gender, brand, and color.
2. Apply the filters.

**Expected Result:**
- Results respect the chosen filters and the Filters button shows an active-filter count badge.

### TC-M05 · SP Only toggle

**Actors:** test-buyer, test-free

**Objective:** Verify the SP Only toggle filters to SP-eligible items.

**Steps:**
1. As **test-buyer**, enable **SP Only** and review results.
2. As **test-free**, enable **SP Only**.

**Expected Result:**
- With SP Only on, only SP-eligible items (with a "✓ SP Eligible" badge) are shown.
- For a free user, the toggle still filters but an upgrade CTA is surfaced for SP features.

### TC-M06 · Empty / no-results states

**Actors:** test-buyer

**Objective:** Verify empty and no-results messaging.

**Steps:**
1. Search for a term with no matches and/or apply very narrow filters.

**Expected Result:**
- A "No Results Found" state appears with guidance to adjust filters and a **Clear Filters** action.

---

## Group N — Discovery: Category & Favorites

### TC-N01 · Category browse filters results

**Actors:** test-buyer

**Objective:** Verify browsing by category filters discovery.

**Steps:**
1. Open **Browse Categories** and tap a category.

**Expected Result:**
- Discovery results filter to that category; categories with SP-eligible items show an SP badge.

### TC-N02 · Favorite heart toggle on item card

**Actors:** test-buyer

**Objective:** Verify favoriting from a discovery card.

**Steps:**
1. Tap the heart icon on an item card, then tap it again.

**Expected Result:**
- The heart toggles filled/outline; the favorite state persists to the account and is reflected in the Favorites list.

### TC-N03 · Infinite scroll pagination

**Actors:** test-buyer

**Objective:** Verify results paginate on scroll.

**Steps:**
1. Scroll to the bottom of a results grid with many items.

**Expected Result:**
- More items load automatically (≈20 per page) in the 2-column grid without a manual "load more" tap.

---

## Group O — Discovery: Node Scoping & SP Visibility

### TC-O01 · Results scoped to user's node

**Actors:** test-buyer

**Objective:** Verify default discovery is node-scoped.

**Steps:**
1. As **test-buyer**, open Discover without changing location filters.

**Expected Result:**
- Only items from the user's node (or within the configured radius) appear by default.

### TC-O02 · Location ZIP + radius filter

**Actors:** test-buyer

**Objective:** Verify the ZIP + radius location filter.

**Steps:**
1. In the Filters modal, set a ZIP and adjust the radius slider (5–100 miles); apply.

**Expected Result:**
- Results scope to nearby nodes within the chosen radius; the radius preference is remembered.

### TC-O03 · Inactive ZIP in filter → waitlist prompt

**Actors:** test-buyer

**Objective:** Verify filtering by an inactive ZIP surfaces a waitlist prompt.

**Steps:**
1. In the location filter, enter a ZIP with no active node and apply.

**Expected Result:**
- A prompt like "We are not live in ZIP {zip} yet. We can add you to the waitlist." appears with options such as **Back to Filters** / **See All Results**.

### TC-O04 · Subscriber vs free SP visibility

**Actors:** test-buyer (subscriber), test-free

**Objective:** Verify SP-related visibility differs by tier.

**Steps:**
1. Browse discovery as **test-buyer**, then as **test-free**.

**Expected Result:**
- Subscribers see SP-eligible items prioritized with the SP filter enabled and SP earnings context.
- Free users still see SP-eligible items but with upgrade CTAs for SP features.

### TC-O05 · Admin radius defaults and bounds reflect in Discover

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

### TC-P01 · Header node chip shows the registered market (read-only)

**Actors:** test-buyer

**Objective:** Verify the Home header shows the user's registered node/local market name and is display-only.

**Steps:**
1. Log in as **test-buyer** (assigned to a node during onboarding).
2. Observe the left side of the Home header.

**Expected Result:**
- A compact pill chip shows the node/local market name selected at registration (e.g., "Ledgewood Dr").
- Tapping the chip does nothing — no picker, modal, or navigation opens, and no caret/chevron is shown.

### TC-P02 · Header right cluster: bell + chat + avatar; logout removed from header

**Actors:** test-buyer

**Objective:** Verify the Home header shows bell, chat and avatar in a tight cluster and no longer shows a logout icon.

**Steps:**
1. Log in and observe the Home header right side.
2. Look for a standalone logout icon.

**Expected Result:**
- Right cluster shows (left to right): notification bell, chat/messages icon, user avatar.
- No logout icon appears in the header.

### TC-P03 · Header chat icon opens Messages with an unread badge

**Actors:** test-buyer

**Objective:** Verify the header chat icon opens the Messages screen and shows the same unread count the old Inbox tab badge showed.

**Steps:**
1. Have a trade with an unread message (or send one from another account).
2. Tap the chat icon in the header.

**Expected Result:**
- A red numeric badge on the chat icon shows the unread-message count (99+ capped).
- Tapping it opens the Messages (conversations) screen.

### TC-P04 · Floating pill bottom nav: layout

**Actors:** test-buyer

**Objective:** Verify the bottom nav is a floating pill, not a full-width bar.

**Steps:**
1. Log in and observe the bottom of the screen.

**Expected Result:**
- The nav is a rounded pill with horizontal margin from both screen edges, elevated with a subtle shadow, and sits above the iOS home-indicator safe area.
- Tab order left to right: Home, Discover, Sell FAB, Trades, Basket.

### TC-P05 · Inbox removed from nav; Messages via header chat only

**Actors:** test-buyer

**Objective:** Verify the bottom nav no longer has an Inbox tab and Messages is reached from the header.

**Steps:**
1. Observe the bottom nav (no Inbox tab).
2. Tap the header chat icon to open Messages.

**Expected Result:**
- No Inbox tab in the bottom nav.
- Messages opens from the header chat icon; the Messages screen still works as before.

### TC-P06 · Trades tab — Active Trades

**Actors:** test-buyer

**Objective:** Verify the Trades tab shows active trades with item, counterpart, and status label.

**Steps:**
1. Have at least one trade in `pending` or `in_progress` status.
2. Tap the Trades tab.

**Expected Result:**
- Active Trades lists each active trade with the item, the counterpart user, and a status label (e.g., Pending Confirmation, In Progress).

### TC-P07 · Trades tab — Trade History

**Actors:** test-buyer

**Objective:** Verify completed/cancelled trades appear in Trade History, reverse-chronological.

**Steps:**
1. Have at least one completed and/or cancelled trade.
2. Open the Trades tab History section.

**Expected Result:**
- Completed and cancelled trades appear under Trade History, newest first.

### TC-P08 · Trades badge counts active trades only

**Actors:** test-buyer

**Objective:** Verify the Trades tab badge equals active (non-terminal) trades and excludes completed/cancelled.

**Steps:**
1. Note the badge on the Trades tab.
2. Complete or cancel a trade, then return to the tab bar.

**Expected Result:**
- The badge counts trades with status `pending`, `in_progress` (and `payment_failed`/legacy `payment_processing` if present).
- Completed and cancelled trades do NOT count toward the badge.

### TC-P09 · Basket badge + Home active state unchanged

**Actors:** test-buyer

**Objective:** Verify the Basket badge and Home tab active styling carry over.

**Steps:**
1. Add items to the trade basket and observe the Basket badge.
2. Navigate between tabs and observe Home's active highlight.

**Expected Result:**
- Basket badge shows the item count (99+ capped).
- Home tab shows the active green highlight when selected.

### TC-P10 · Post FAB globally visible + Sell sheet

**Actors:** test-buyer

**Objective:** Verify the Sell FAB is visible on every screen and still opens the Sell sheet.

**Steps:**
1. Visit Home, Discover, Trades, Messages, and Basket.
2. Tap the Sell FAB.

**Expected Result:**
- The FAB is visible on every screen (raised orange circle above the pill).
- Tapping it opens the Sell action sheet with "List One Item" and "Bulk Upload".

### TC-P11 · Composer bar: focus + type

**Actors:** test-buyer

**Objective:** Verify tapping the Home composer bar focuses an inline text field.

**Steps:**
1. On Home, tap anywhere on the composer bar below the header.

**Expected Result:**
- The inline field focuses (keyboard appears) and the user can type freely.
- No navigation happens on focus.

### TC-P12 · Composer "+" → New Item with Title pre-filled

**Actors:** test-buyer

**Objective:** Verify the composer "+" routes to the single-item flow and pre-fills the Title.

**Steps:**
1. Type "Lego Star Wars Set" into the composer.
2. Tap the "+" button (or press keyboard return).

**Expected Result:**
- The New Item screen opens on its Photos step (no Sell sheet appears).
- The Title field already contains "Lego Star Wars Set".

### TC-P13 · Composer empty submit → empty Title

**Actors:** test-buyer

**Objective:** Verify submitting with no text leaves the Title empty (no regression).

**Steps:**
1. Tap "+" with the composer empty.

**Expected Result:**
- New Item opens on its Photos step with an empty Title field.

### TC-P14 · Composer camera icon → New Item straight to camera

**Actors:** test-buyer

**Objective:** Verify the composer camera icon opens New Item directly to the camera.

**Steps:**
1. Type a title, then tap the camera icon.

**Expected Result:**
- New Item opens on the Photos step and auto-launches the camera.
- The typed title is still pre-filled.

### TC-P15 · AI never overwrites a composer-pre-filled Title

**Actors:** test-buyer

**Objective:** Verify AI analysis cannot overwrite a Title pre-filled from the composer bar.

**Steps:**
1. Pre-fill a Title via the composer (TC-P12).
2. Add a photo and let AI analysis complete; tap "Apply All" and per-field "Use".

**Expected Result:**
- The pre-filled Title is never replaced by the AI-suggested title.
- If the user entered no text, AI may still populate the Title as before.

### TC-P16 · FAB Sell sheet unchanged (parallel entry point)

**Actors:** test-buyer

**Objective:** Verify the FAB still opens the full Sell sheet with Bulk Upload.

**Steps:**
1. Tap the Sell FAB and confirm the sheet shows "List One Item" and "Bulk Upload".

**Expected Result:**
- The FAB sheet is unchanged; Bulk Upload is reachable only from here (not the composer bar).

### TC-P17 · Logout still reachable from Profile/Settings

**Actors:** test-buyer

**Objective:** Verify logout still exists after being removed from the header.

**Steps:**
1. Tap the header avatar → Profile.
2. Tap Logout (confirm) and also check Settings → Sign Out.

**Expected Result:**
- Logout works from Profile and Settings; the user returns to Landing.

### TC-P18 · Composer analytics events

**Actors:** test-admin

**Objective:** Verify composer events are recorded.

**Steps:**
1. On Home, tap the composer bar (focus).
2. Submit with text, then submit empty.
3. As admin, inspect `analytics_events` (or the analytics dashboard).

**Expected Result:**
- `composer_bar_tapped` recorded on focus.
- `composer_bar_submit` recorded with `has_text=true` and `has_text=false` respectively.

### TC-P19 · Accessibility identifiers (Trades tab + header chat)

**Actors:** test-buyer

**Objective:** Verify stable accessibility identifiers/roles on the new chrome.

**Steps:**
1. Enable VoiceOver/TalkBack and navigate the bottom nav and header.

**Expected Result:**
- Trades tab has a button role + label "Trades" (testID `tab-trades`).
- Header chat button has label "Messages" (testID `header-chat-btn`); the node chip is not announced as a button.

---

## Regression checks (run after any change to these flows)

### TC-R01 · Auth boundary integrity

**Objective:** Verify logout always returns to the unauthenticated stack and login returns to the correct stack.
**Steps:**
1. Log in, then log out; log back in as a completed user and as an onboarding-incomplete user.
**Expected Result:**
- Logout shows Landing; a completed user lands on Home; an incomplete user lands on onboarding.

### TC-R02 · Session restore does not loop

**Objective:** Verify cold launch does not get stuck or loop on auth refresh.
**Steps:**
1. Cold-launch the app while logged in several times.
**Expected Result:**
- The app restores to Home without an infinite spinner or repeated re-subscribe loops.

### TC-R03 · Node assignment consistency

**Objective:** Verify active vs inactive ZIP routing is consistent.
**Steps:**
1. Sign up with an active ZIP, then with an inactive ZIP.
**Expected Result:**
- Active ZIP assigns directly with no waitlist; inactive ZIP offers the waitlist and a fallback node.

### TC-R04 · Pending listings never leak to feed

**Objective:** Verify a pending or edited-pending listing is never publicly visible.
**Steps:**
1. Submit a new listing and edit an approved listing; browse as another user.
**Expected Result:**
- Neither pending listing appears in discovery until (re)approved.

### TC-R05 · Discovery node isolation

**Objective:** Verify discovery stays node-scoped by default.
**Steps:**
1. Browse as a user in one node; confirm other nodes' items are not shown unless Show All Nodes / cross-node filter is used.
**Expected Result:**
- Default results contain only the user's node items.

### TC-R06 · Free vs subscriber gating holds

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

### TC-ACC-01 · Sign Up submit button is discoverable by identifier

**Objective:** Verify the Create Account submit button appears as a button with a stable identifier.
**Steps:**
1. From Landing, tap **Sign Up** (Create Account screen).
2. Inspect the iOS accessibility tree.
**Expected Result:**
- The submit control appears as a button with identifier `signup-submit-button` and label "Create Account". No coordinate tap needed.

### TC-ACC-02 · Log In submit button is discoverable by identifier

**Objective:** Verify the Log In submit button appears as a button with a stable identifier.
**Steps:**
1. From Landing, tap **Log In**.
2. Inspect the iOS accessibility tree.
**Expected Result:**
- The submit control appears as a button with identifier `login-submit-button` and label "Log In". No coordinate tap needed.

### TC-ACC-03 · Auth error dialog OK buttons are discoverable by identifier

**Objective:** Verify the blocking auth error dialogs expose an identifiable OK button.
**Steps:**
1. Log in with a wrong password (e.g. `WrongPassword123!`) to trigger the "Login Failed" dialog.
2. Inspect the tree while the dialog is up; confirm identifier `login-failed-dialog-ok-button`; tap it via the tree to dismiss.
3. (If reachable) trigger a backend signup failure so the "Signup Failed" dialog appears; confirm identifier `signup-error-dialog-ok-button`.
**Expected Result:**
- Each dialog's OK button is a button in the tree with its own identifier and is activatable by identifier. User stays on the same screen after dismiss (no navigation change).

### TC-ACC-04 · Bottom tab bar items are discoverable by identifier

**Objective:** Verify every persistent bottom tab exposes an accessible button with a stable identifier.
**Steps:**
1. Log in and land on Home.
2. Inspect the tree at the bottom bar.
**Expected Result:**
- Tabs appear as buttons: `tab-home`, `tab-discover`, `tab-sell` (Sell FAB), `tab-inbox`, `tab-trade-basket` — each with its visible label and selected state, activatable by identifier.

### TC-ACC-05 · No visual/layout regression from identifiers

**Objective:** Confirm adding accessibility props changed no visuals.
**Steps:**
1. Screenshot Create Account, Login, the "Login Failed" dialog, and Home before and after this change.
2. Compare pixels (or eyeball layout) — no shifts, color changes, or text changes.
**Expected Result:**
- Identical layout/colors/text. (Zero-logic UI change.)

### TC-ACC-06 · Widget tests still pass

**Objective:** Ensure the accessibility props did not break unit tests.
**Steps:**
1. Run `cd p2p-kids-marketplace && yarn test`.
**Expected Result:**
- All suites pass. If a widget test asserts on the tree structure and a new identifier breaks a finder, update the finder to the new `testID` — do not remove the accessibility props.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Accessibility identifiers: Sign Up / Log In / dialog OK / tab bar | TC-ACC-01 … TC-ACC-06 |
| Signup happy path → phone verification | TC-A01 |
| Signup field validation | TC-A02, TC-A03 |
| 18+ age gate | TC-A04 |
| Duplicate email blocked | TC-A05 |
| Optional referral code handling | TC-A06 |
| Terms/Privacy acceptance recorded | TC-A07 |
| Login routes by onboarding status | TC-B01 |
| Invalid credentials error | TC-B02 |
| Forgot password entry | TC-B03 |
| Session restore after relaunch | TC-B04 |
| Silent resume refresh | TC-B05 |
| Cold launch no hang | TC-B06, TC-R02 |
| Social login Google/Facebook/Apple | TC-C01, TC-C02, TC-C03 |
| Account-link prompt (email match) | TC-C04 |
| Provider unavailable fallback | TC-C05 |
| OAuth cancel silent return | TC-C06 |
| Social-only set password | TC-C07 |
| Logout from Profile / Settings | TC-D01, TC-D02 |
| Logout returns to Landing | TC-D03, TC-R01 |
| Phone OTP send/verify | TC-E01 |
| OTP error states | TC-E02 |
| Resend cooldown | TC-E03 |
| OTP rate limiting | TC-E04 |
| Phone gate before listing | TC-E05, TC-J10 |
| Active ZIP node assignment | TC-F01, TC-R03 |
| Inactive ZIP waitlist offer | TC-F02, TC-F03, TC-F04, TC-R03 |
| ZIP auto-lookup city/state | TC-F05 |
| Node-scoped content toggle | TC-F06, TC-O01, TC-R05 |
| Admin create active/inactive node | TC-G01, TC-G02 |
| Admin edit node | TC-G03 |
| Admin deactivate/reactivate node | TC-G04, TC-G05 |
| Node stats + form validation | TC-G06 |
| Profile Setup capture + validation | TC-H01, TC-H02, TC-H03 |
| Welcome / Feature Highlights | TC-H04, TC-H05 |
| Onboarding carousel + completion | TC-H06, TC-H07 |
| Subscription choice trial/free | TC-I01, TC-I02, TC-I03 |
| Listing photo-first gating | TC-J01 |
| AI auto-fill apply | TC-J02 |
| Listing required-field validation | TC-J03 |
| Listing enums (condition/age/gender/color) | TC-J04 |
| Other category custom name | TC-J05 |
| Payment preference subscriber/free | TC-J06, TC-J07, TC-R06 |
| SP earnings preview | TC-J08, TC-K06 |
| Submit for review → pending modal | TC-J09 |
| Draft auto-save/resume | TC-J11 |
| Bulk upload + grouping | TC-K01, TC-K02, TC-K03 |
| Bulk Apply to All | TC-K04 |
| Bulk submit + confirm | TC-K05 |
| Pending hidden until approved | TC-L01, TC-R04 |
| Admin approval makes visible | TC-L02 |
| Seller approval notification | TC-L03 |
| Edit returns to pending | TC-L04, TC-R04 |
| Search debounce + clear | TC-M01 |
| Recent searches + autocomplete | TC-M02 |
| Sort options | TC-M03 |
| Filters modal | TC-M04 |
| SP Only toggle | TC-M05, TC-O04, TC-R06 |
| Empty/no-results states | TC-M06 |
| Category browse | TC-N01 |
| Favorites toggle | TC-N02 |
| Infinite scroll pagination | TC-N03 |
| Location ZIP + radius | TC-O02 |
| Inactive ZIP in discovery filter | TC-O03 |
| Admin radius defaults/bounds | TC-O05 |
