# MODULE-15.1 MANUAL TESTING GUIDE
## FLOW-01: Authentication & Session Management
### Auth Screens UI Redesign - Whisk-Inspired Design System

**Test Environment:** iOS Simulator (iPhone 14 Pro) + Android Emulator (Pixel 6)  
**Prerequisites:** 
- App installed on both simulators
- No user session active (logged out)
- Clean state (clear app data if needed)

---

## TC-001: Landing Screen - Initial Load

**Priority:** P0 (Critical)  
**Estimated Time:** 3 minutes

### Test Steps
1. Launch the app (cold start - not logged in)
2. Wait for Landing Screen to appear

### Expected Results
- ✅ Screen loads with white background (#FFFFFF)
- ✅ Emoji "🤝" displays at top, centered, 80px size
- ✅ Headline "Welcome to Pass It Up" displays: 28px, semibold, #1A1A1A, centered
- ✅ Subheading displays: "Buy, sell, and trade gently used kids' items locally" - 15px, #6B6B6B, centered
- ✅ Three feature items visible: "Safe & Secure", "Earn Points", "Local First" with emojis 🔒, 💰, 🌍
- ✅ "Get Started" button: green (#5DBB8E), pill shape (52px height, 26px radius), full width
- ✅ "Already have an account? Log In" text below: 14px, #6B6B6B with green "Log In"
- ✅ Screen horizontal padding is 24px (visible equal margins on left/right)
- ✅ No console errors or warnings

### Notes
- Verify pill shape: border radius should be exactly half of button height
- Confirm no orange (#FF6B35) colors anywhere on screen

---

## TC-002: Landing Screen - Navigation

**Priority:** P0 (Critical)  
**Estimated Time:** 2 minutes

### Test Steps
1. From Landing Screen, tap "Get Started" button
2. Tap back button to return to Landing
3. Tap "Log In" text link
4. Tap back button to return to Landing
5. Tap "Terms" link in footer
6. Tap back button
7. Tap "Privacy Policy" link in footer

### Expected Results
- ✅ "Get Started" → navigates to Signup Screen
- ✅ "Log In" → navigates to Login Screen
- ✅ "Terms" → navigates to Terms of Service Screen
- ✅ "Privacy Policy" → navigates to Privacy Policy Screen
- ✅ Back button returns to Landing Screen in all cases
- ✅ Navigation transitions are smooth (no flicker or lag)

---

## TC-003: Login Screen - UI Elements

**Priority:** P0 (Critical)  
**Estimated Time:** 5 minutes

### Test Steps
1. Navigate to Login Screen
2. Inspect all UI elements

### Expected Results
- ✅ White background (#FFFFFF)
- ✅ "Log In" heading: 24px, semibold, #1A1A1A
- ✅ Email input field:
  - Label "EMAIL": 13px, uppercase, #6B6B6B
  - Filled style: #F0F0F0 background, 12px border radius, 52px height
  - NO border (borderWidth = 0)
  - Envelope icon (EnvelopeSimple from Phosphor) on left: 20px, #6B6B6B
  - Placeholder text: #999999
- ✅ Password input field:
  - Label "PASSWORD": 13px, uppercase, #6B6B6B
  - Same filled style as email
  - Lock icon on left: 20px, #6B6B6B
  - Eye icon on right for show/hide: 20px
  - Text is obscured (••••••)
- ✅ "Forgot password?" link: 14px, #5DBB8E green, aligned to right
- ✅ "Log In" button: green pill (#5DBB8E), 52px height, 26px radius, full width
- ✅ OR divider: horizontal lines (#E0E0E0) with "or" text (#6B6B6B) in center
- ✅ Social login buttons: 3 circles, 50×50px, white background, #E0E0E0 border, centered
- ✅ "Don't have an account? Sign Up" text: 14px, gray text with green "Sign Up"
- ✅ Screen horizontal padding: 24px
- ✅ No Ionicons or MaterialIcons (all icons are Phosphor or text placeholders)

---

## TC-004: Login Screen - Password Visibility Toggle

**Priority:** P1 (High)  
**Estimated Time:** 2 minutes

### Test Steps
1. On Login Screen, enter "test123" in password field
2. Tap the eye icon on the right side of password field
3. Tap the eye icon again

### Expected Results
- ✅ Initially, password shows as dots (••••••)
- ✅ After first tap, password shows as plain text "test123"
- ✅ Eye icon changes from Eye to EyeSlash (or vice versa)
- ✅ After second tap, password returns to dots
- ✅ Icon animates smoothly (no flicker)

---

## TC-005: Login Screen - Form Validation

**Priority:** P0 (Critical)  
**Estimated Time:** 5 minutes

### Test Steps
1. Leave email and password empty, tap "Log In"
2. Enter invalid email "notanemail", tap "Log In"
3. Enter valid email "test@example.com" but leave password empty, tap "Log In"
4. Enter valid email + password, tap "Log In" (with no account registered)

### Expected Results
- ✅ Step 1: Alert shows "Email is required"
- ✅ Step 2: Alert shows "Email is invalid"
- ✅ Step 3: Alert shows "Password is required"
- ✅ Step 4: Alert shows "Invalid email or password"
- ✅ Input fields highlight with error state (red border appears)
- ✅ Error text displays below invalid fields in red (#E85D75)
- ✅ Button is disabled during validation errors (grayed out)

---

## TC-006: Login Screen - Forgot Password Flow

**Priority:** P1 (High)  
**Estimated Time:** 3 minutes

### Test Steps
1. On Login Screen, tap "Forgot password?" link
2. Verify Forgot Password Screen appears
3. Tap back button to return to Login

### Expected Results
- ✅ "Forgot password?" link is tappable and green (#5DBB8E)
- ✅ Navigates to Forgot Password Screen
- ✅ Back button returns to Login Screen

---

## TC-007: Login Screen - Social Login Buttons

**Priority:** P1 (High)  
**Estimated Time:** 3 minutes

### Test Steps
1. Tap each social login button (Google, Facebook, Apple)
2. Observe loading state

### Expected Results
- ✅ Each button shows proper icon/text
- ✅ Buttons are circular: 50px width, 50px height, 25px border radius
- ✅ White background (#FFFFFF), border #E0E0E0
- ✅ Tap triggers social login flow (or shows "not configured" alert in dev)
- ✅ Loading indicator appears on pressed button (ActivityIndicator)
- ✅ Other buttons remain enabled while one is loading

### Notes
- In dev/staging without OAuth configured, expect Alert "Provider not configured"

---

## TC-008: Signup Screen - UI Elements

**Priority:** P0 (Critical)  
**Estimated Time:** 5 minutes

### Test Steps
1. Navigate to Signup Screen
2. Inspect all UI elements

### Expected Results
- ✅ White background (#FFFFFF)
- ✅ "Create Account" heading: 24px, semibold, #1A1A1A
- ✅ All input fields use filled style (#F0F0F0, no border, 52px height, 12px radius):
  - Name input: label "NAME"
  - Email input: label "EMAIL", EnvelopeSimple icon
  - Phone input: label "PHONE"
  - Date of Birth input: label "DATE OF BIRTH"
  - Password input: label "PASSWORD", Lock icon + Eye/EyeSlash toggle
  - Confirm Password input: label "CONFIRM PASSWORD", Lock icon + Eye/EyeSlash toggle
- ✅ Optional referral code input: label "REFERRAL CODE (OPTIONAL)"
- ✅ Terms & Privacy checkbox:
  - Square icon (20px, #6B6B6B) when unchecked
  - CheckSquare icon (20px, #5DBB8E) when checked
  - Text "I agree to the Terms and Privacy Policy" with green links
- ✅ "Sign Up" button: green pill (#5DBB8E), 52px height, 26px radius, full width
- ✅ OR divider + social login buttons (same as Login Screen)
- ✅ "Already have an account? Log In" text: 14px, gray + green "Log In"
- ✅ Screen horizontal padding: 24px
- ✅ No Ionicons or MaterialIcons

---

## TC-009: Signup Screen - Form Validation

**Priority:** P0 (Critical)  
**Estimated Time:** 8 minutes

### Test Steps
1. Leave all fields empty, tap "Sign Up"
2. Enter name "A", tap "Sign Up"
3. Enter valid name "John Doe", invalid email "john", tap "Sign Up"
4. Enter valid name + email, weak password "abc", tap "Sign Up"
5. Enter valid name + email, strong password "Abc12345", mismatched confirm "Abc12346", tap "Sign Up"
6. Enter valid name + email + password + confirm, invalid phone "123", tap "Sign Up"
7. Enter valid name + email + password + confirm + phone, DOB for 15-year-old, tap "Sign Up"
8. Uncheck terms checkbox, tap "Sign Up" (all other fields valid)
9. Enter all valid data, check terms, tap "Sign Up"

### Expected Results
- ✅ Step 1: Alert shows "Name is required"
- ✅ Step 2: Alert shows "Name must be at least 2 characters"
- ✅ Step 3: Alert shows "Please enter a valid email address"
- ✅ Step 4: Alert shows "Password must be at least 8 characters" (or similar strength requirement)
- ✅ Step 5: Alert shows "Passwords do not match"
- ✅ Step 6: Alert shows "Please enter a valid phone number (10+ digits)"
- ✅ Step 7: Alert shows "Sorry, you must be 18 years old to register"
- ✅ Step 8: Alert shows "Please accept the Terms and Privacy Policy"
- ✅ Step 9: Proceeds to Phone Verification Screen (or shows "Email already registered" if account exists)

---

## TC-010: Phone Verification Screen - UI Elements

**Priority:** P0 (Critical)  
**Estimated Time:** 4 minutes

### Test Steps
1. Complete signup to reach Phone Verification Screen
2. Inspect all UI elements

### Expected Results
- ✅ White background (#FFFFFF)
- ✅ "Verify Your Phone" heading: 24px, semibold, #1A1A1A, centered
- ✅ Subtitle: "We sent a 6-digit code to [phone number]" - 15px, #6B6B6B, centered
- ✅ OTP input field:
  - Filled style: #F0F0F0 background, 12px radius, 52px height
  - Text centered, 24px font size, letter-spacing 8
  - No border
  - Monospace feel
- ✅ "Verify" button: green pill (#5DBB8E), 52px height, 26px radius, full width
- ✅ "Didn't receive the code? Resend" text: 14px, "Resend" in green (#5DBB8E)
- ✅ Resend button shows countdown timer (e.g., "Resend (45s)") when active
- ✅ "Change phone number" link: 14px, #6B6B6B
- ✅ Centered layout (all content centered vertically and horizontally)

---

## TC-011: Phone Verification Screen - OTP Entry & Verification

**Priority:** P0 (Critical)  
**Estimated Time:** 6 minutes

### Test Steps
1. Enter 5 digits in OTP field
2. Enter 6th digit to complete OTP
3. If verification fails, observe error state
4. Tap "Resend" button (if countdown has expired)
5. Enter correct OTP code
6. Wait for verification

### Expected Results
- ✅ OTP field accepts only numeric input
- ✅ "Verify" button is disabled until all 6 digits entered
- ✅ After 6 digits, "Verify" button becomes enabled and green
- ✅ If code is invalid, alert shows "Invalid code"
- ✅ OTP field clears on error
- ✅ "Resend" button disabled during countdown (e.g., "Resend (45s)")
- ✅ After countdown expires, "Resend" becomes enabled
- ✅ Tapping "Resend" shows alert "Code Sent" (or dev bypass message)
- ✅ On successful verification, alert shows "Success! Your phone number has been verified"
- ✅ Navigates to Profile Setup Screen after success

---

## TC-012: Forgot Password Screen - UI Elements

**Priority:** P1 (High)  
**Estimated Time:** 4 minutes

### Test Steps
1. Navigate to Forgot Password Screen
2. Inspect all UI elements

### Expected Results
- ✅ White background (#FFFFFF)
- ✅ "Forgot Password?" heading: 24px, semibold, #1A1A1A
- ✅ Subtitle: "Enter your email address and we'll send you a link to reset your password" - 15px, #6B6B6B
- ✅ Email input:
  - Label "EMAIL": 13px, uppercase, #6B6B6B
  - Filled style: #F0F0F0 background, 12px radius, 52px height, no border
  - EnvelopeSimple icon (20px, #6B6B6B)
- ✅ "Send Reset Link" button: green pill (#5DBB8E), 52px height, 26px radius, full width
- ✅ "Back to Login" link: 14px, #6B6B6B, bottom of screen

---

## TC-013: Forgot Password Screen - Send Reset Email

**Priority:** P1 (High)  
**Estimated Time:** 5 minutes

### Test Steps
1. Leave email empty, tap "Send Reset Link"
2. Enter invalid email "notvalid", tap "Send Reset Link"
3. Enter valid email "test@example.com", tap "Send Reset Link"
4. Observe success state

### Expected Results
- ✅ Step 1: Alert shows "Please enter a valid email address"
- ✅ Step 2: Alert shows "Please enter a valid email address"
- ✅ Step 3: Loading indicator shows on button
- ✅ After send, screen shows success message:
  - Emoji "📧" (64px, centered)
  - Heading "Check Your Email" (24px, semibold, centered)
  - Subtitle "We've sent a password reset link to [email]" (15px, #6B6B6B, centered)
  - Instructions card with bullet points
  - "Send Another Email" button (secondary style, not green)
  - "Back to Login" link
- ✅ Email is sent successfully (check inbox - may be in spam folder)

### Notes
- In dev/staging, SMTP may not be configured; check Supabase Auth > Email Logs

---

## TC-014: Reset Password Screen - UI Elements

**Priority:** P1 (High)  
**Estimated Time:** 4 minutes

### Test Steps
1. Open reset password link from email (or simulate via deep link)
2. Inspect all UI elements

### Expected Results
- ✅ White background (#FFFFFF)
- ✅ "Reset Password" heading: 24px, semibold, #1A1A1A
- ✅ Subtitle: "Enter your new password" - 15px, #6B6B6B
- ✅ Password input:
  - Label "NEW PASSWORD": 13px, uppercase, #6B6B6B
  - Filled style: #F0F0F0 background, 12px radius, 52px height, no border
  - Lock icon (20px, #6B6B6B)
  - Eye/EyeSlash toggle (20px)
- ✅ Confirm Password input: same style
- ✅ "Reset Password" button: green pill (#5DBB8E), 52px height, 26px radius, full width
- ✅ Password strength requirements shown below inputs:
  - At least 8 characters
  - One uppercase letter
  - One lowercase letter
  - One number
- ✅ If reset link is expired, shows error message with link to request new reset

---

## TC-015: Reset Password Screen - Password Reset

**Priority:** P1 (High)  
**Estimated Time:** 5 minutes

### Test Steps
1. Enter weak password "abc", tap "Reset Password"
2. Enter strong password "Abc12345", mismatched confirm "Abc12346", tap "Reset Password"
3. Enter matching strong passwords, tap "Reset Password"
4. Wait for success

### Expected Results
- ✅ Step 1: Alert shows "Password must be at least 8 characters" (or other strength requirement)
- ✅ Step 2: Alert shows "Passwords do not match"
- ✅ Step 3: Loading indicator shows on button
- ✅ On success, alert shows "Password Updated Successfully"
- ✅ Navigates to Login Screen
- ✅ Can log in with new password

---

## TC-016: Suspended Account Screen - UI Elements

**Priority:** P2 (Medium)  
**Estimated Time:** 3 minutes

### Test Steps
1. Log in with a suspended account (or simulate via dev flag)
2. Inspect Suspended Account Screen

### Expected Results
- ✅ White background (#FFFFFF)
- ✅ Warning icon: 🚫 emoji (64px, centered) OR WarningCircle Phosphor icon (64px, #E85D75 red)
- ✅ "Account Suspended" heading: 24px, semibold, #1A1A1A, centered
- ✅ Message: "Your account is currently suspended. Please contact admin for help." - 15px, #6B6B6B, centered
- ✅ "Support Email" label: 13px, uppercase, #6B6B6B
- ✅ Support email address: 14px, #5DBB8E green (or #5B8FB9 blue link color)
- ✅ "Log Out" button: green pill (#5DBB8E), 52px height, 26px radius, full width
- ✅ **CRITICAL:** NO "Log In" or "Sign Up" navigation links visible (per MODULE-15.1 spec: "only one button")
- ✅ Card layout with subtle shadow and padding
- ✅ Centered vertically on screen

---

## TC-017: Suspended Account Screen - Logout

**Priority:** P2 (Medium)  
**Estimated Time:** 2 minutes

### Test Steps
1. On Suspended Account Screen, tap "Log Out" button
2. Wait for logout to complete

### Expected Results
- ✅ Loading indicator shows briefly
- ✅ Navigates back to Landing Screen (or Login Screen)
- ✅ User session is cleared (cannot access app without logging in again)

---

## TC-018: Cross-Screen Design Consistency

**Priority:** P0 (Critical)  
**Estimated Time:** 10 minutes

### Test Steps
1. Navigate through all 7 auth screens
2. Verify design system consistency

### Expected Results
- ✅ All screens use white background (#FFFFFF) - NO gray or off-white
- ✅ All input fields use filled style: #F0F0F0 background, 12px radius, 52px height, NO borderWidth
- ✅ All input labels use: 13px, uppercase, #6B6B6B
- ✅ All primary buttons use: #5DBB8E green, 52px height, 26px radius (pill shape)
- ✅ All icons are from Phosphor React Native (NO Ionicons, NO MaterialIcons)
- ✅ Icon sizes: 20px for input icons, 64px for status icons
- ✅ All screens use 24px horizontal padding
- ✅ All headings use: 24px or 28px, semibold, #1A1A1A
- ✅ All body text uses: 15-16px, #6B6B6B or #1A1A1A
- ✅ All green links use: #5DBB8E
- ✅ All error text uses: #E85D75 red

---

## TC-019: Accessibility & Responsiveness

**Priority:** P1 (High)  
**Estimated Time:** 8 minutes

### Test Steps
1. Test on iPhone SE (small screen)
2. Test on iPhone 14 Pro Max (large screen)
3. Test on Android Pixel 6
4. Test on Android tablet (if available)
5. Enable VoiceOver/TalkBack and navigate through Login Screen

### Expected Results
- ✅ All content is visible on small screens without cutoff
- ✅ Buttons remain full width on all screen sizes
- ✅ Text scales appropriately for different screen sizes
- ✅ No horizontal scrolling required
- ✅ All interactive elements have minimum 44×44px touch target
- ✅ VoiceOver/TalkBack reads all labels, buttons, and inputs correctly
- ✅ Tab order is logical (top to bottom)
- ✅ Focus indicators are visible on keyboard navigation

---

## TC-020: iOS Simulator - Social Login (Apple Sign In)

**Priority:** P1 (High)  
**Estimated Time:** 5 minutes  
**Platform:** iOS Only

### Test Steps
1. Ensure iOS Simulator is signed into iCloud (Settings → Sign in to your Apple ID)
2. On Login or Signup Screen, tap Apple Sign In button
3. Observe Apple Sign In modal
4. Select account and authenticate
5. Wait for redirect back to app

### Expected Results
- ✅ Apple Sign In button is visible (required on iOS per App Store guidelines)
- ✅ Tapping button opens Apple Sign In modal
- ✅ Modal shows user's Apple ID accounts
- ✅ After authentication, modal closes and returns to app
- ✅ App receives profile data (name, email) from Apple
- ✅ User is logged in and navigated to Home Screen
- ✅ On second login, Apple does not request name again (only first sign-in)

### Notes
- If iCloud not signed in, alert should show "Please sign in to iCloud in Settings"
- If OAuth not configured in Supabase, expect error alert

---

## TC-021: Android Emulator - Social Login (Google Sign In)

**Priority:** P1 (High)  
**Estimated Time:** 5 minutes  
**Platform:** Android Only

### Test Steps
1. Ensure Android Emulator has Google account signed in (Settings → Accounts)
2. On Login or Signup Screen, tap Google Sign In button
3. Observe Google Sign In modal
4. Select account
5. Wait for redirect back to app

### Expected Results
- ✅ Google Sign In button is visible
- ✅ Tapping button opens Google account picker
- ✅ Picker shows signed-in Google accounts
- ✅ After selecting account, picker closes and returns to app
- ✅ App receives profile data (name, email, avatar) from Google
- ✅ User is logged in and navigated to Home Screen

### Notes
- If no Google account signed in, picker will show "Add account" option
- If OAuth not configured in Supabase, expect error alert

---

## TC-022: Social Login Error Handling

**Priority:** P1 (High)  
**Estimated Time:** 5 minutes

### Test Steps
1. Tap a social login button (Google/Facebook/Apple)
2. When OAuth modal appears, tap "Cancel" or close the modal
3. Observe app behavior

### Expected Results
- ✅ OAuth modal closes
- ✅ App returns to Login/Signup Screen
- ✅ NO error alert shows (user cancel is expected behavior per AUTH-V3-003 spec)
- ✅ Screen remains functional, can retry login

### Test Steps (Provider Unavailable)
1. Disable network connection
2. Tap social login button
3. Observe error handling

### Expected Results
- ✅ Loading indicator shows briefly
- ✅ After timeout (10s), orange error banner appears: "Provider is temporarily unavailable. Use Email instead?"
- ✅ "Use Email" CTA focuses email input field
- ✅ Error banner dismisses when "Use Email" is tapped
- ✅ Can proceed with email/password login

---

## REGRESSION CHECKLIST

After completing all test cases, verify:

- [ ] All 7 screens pass visual design checks (no orange colors, correct green #5DBB8E)
- [ ] All inputs use filled style (no borders)
- [ ] All icons are from Phosphor React Native (no Ionicons/MaterialIcons)
- [ ] All buttons are pill-shaped (borderRadius = height/2)
- [ ] All screens work on both iOS and Android simulators
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] No ESLint errors (`npm run lint` passes)
- [ ] Unit tests pass (`npm run test:unit` passes)
- [ ] Integration tests pass (`RUN_SUPABASE_E2E=true npm run test:e2e` passes)
- [ ] Maestro tests pass (`npm run test:maestro:ios` and `npm run test:maestro:android` pass)
- [ ] No console errors or warnings during manual testing
- [ ] Navigation flows work correctly (no broken back buttons)
- [ ] Form validation works for all fields
- [ ] Social login triggers OAuth flows (or shows proper error if not configured)
- [ ] Phone verification screen appears after signup
- [ ] Forgot password email is sent successfully
- [ ] Reset password flow works end-to-end
- [ ] Suspended account screen prevents navigation to login/signup

---

## KNOWN LIMITATIONS & NOTES

1. **OAuth Configuration:** Social login requires OAuth providers to be enabled in Supabase Dashboard. If not configured, expect "Provider not configured" alerts.

2. **Email Delivery:** Forgot password emails require SMTP configuration in Supabase Auth settings. Check Email Logs in Supabase Dashboard if emails not received.

3. **Phone Verification:** Requires Twilio configuration. In dev mode, a bypass code may be shown in console/alert instead of SMS delivery.

4. **Apple Sign In:** Only works when iOS Simulator has iCloud account signed in. Not available on Android (but button should still render per App Store compliance).

5. **Maestro Limitations:** Full OAuth flows cannot be automated via Maestro (external OAuth pages). Manual testing required for complete social login flows.

6. **Deep Links:** Reset password deep links may behave differently in Expo Go vs standalone builds. Test both if possible.

---

## TEST EXECUTION LOG

| TC ID | Test Case | iOS Status | Android Status | Tester | Date | Notes |
|-------|-----------|------------|----------------|--------|------|-------|
| TC-001 | Landing Screen - Initial Load | ⬜ | ⬜ | | | |
| TC-002 | Landing Screen - Navigation | ⬜ | ⬜ | | | |
| TC-003 | Login Screen - UI Elements | ⬜ | ⬜ | | | |
| TC-004 | Login Screen - Password Toggle | ⬜ | ⬜ | | | |
| TC-005 | Login Screen - Form Validation | ⬜ | ⬜ | | | |
| TC-006 | Login Screen - Forgot Password | ⬜ | ⬜ | | | |
| TC-007 | Login Screen - Social Login | ⬜ | ⬜ | | | |
| TC-008 | Signup Screen - UI Elements | ⬜ | ⬜ | | | |
| TC-009 | Signup Screen - Form Validation | ⬜ | ⬜ | | | |
| TC-010 | Phone Verification - UI Elements | ⬜ | ⬜ | | | |
| TC-011 | Phone Verification - OTP Entry | ⬜ | ⬜ | | | |
| TC-012 | Forgot Password - UI Elements | ⬜ | ⬜ | | | |
| TC-013 | Forgot Password - Send Email | ⬜ | ⬜ | | | |
| TC-014 | Reset Password - UI Elements | ⬜ | ⬜ | | | |
| TC-015 | Reset Password - Password Reset | ⬜ | ⬜ | | | |
| TC-016 | Suspended Account - UI Elements | ⬜ | ⬜ | | | |
| TC-017 | Suspended Account - Logout | ⬜ | ⬜ | | | |
| TC-018 | Cross-Screen Design Consistency | ⬜ | ⬜ | | | |
| TC-019 | Accessibility & Responsiveness | ⬜ | ⬜ | | | |
| TC-020 | iOS - Apple Sign In | ⬜ | N/A | | | iOS Only |
| TC-021 | Android - Google Sign In | N/A | ⬜ | | | Android Only |
| TC-022 | Social Login Error Handling | ⬜ | ⬜ | | | |

**Legend:** ⬜ Not Tested | ✅ Pass | ❌ Fail | ⚠️ Partial Pass | N/A Not Applicable
